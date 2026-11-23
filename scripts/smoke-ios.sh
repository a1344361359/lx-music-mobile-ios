#!/bin/bash
set -euo pipefail
runtime=$(xcrun simctl list runtimes -j | python3 -c 'import json,sys; r=[v for v in json.load(sys.stdin)["runtimes"] if v.get("isAvailable") and v["name"].startswith("iOS 18.2")]; print(r[0]["identifier"] if r else "")')
if [ -z "$runtime" ]; then
  xcrun simctl list runtimes
  echo 'iOS 18.2 simulator runtime is required for the Xcode 16.2 smoke test.' >&2
  exit 1
fi
device=''
http_pid=''
cleanup() {
  if [ -n "$http_pid" ]; then kill "$http_pid" 2>/dev/null || true; fi
  if [ -n "$device" ]; then xcrun simctl shutdown "$device" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT
if [ -n "${LX_IOS_REUSE_SIMULATOR_APP:-}" ]; then
  app="$LX_IOS_REUSE_SIMULATOR_APP"
else
  xcodebuild -workspace ios/LxMusicMobile.xcworkspace -scheme LxMusicMobile \
  -configuration Release -sdk iphonesimulator -destination "generic/platform=iOS Simulator" \
  -derivedDataPath build/SimulatorData ARCHS="$(uname -m)" IPHONEOS_DEPLOYMENT_TARGET=15.0 \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' \
  build 2>&1 | tee build/simulator-build.log
  app=build/SimulatorData/Build/Products/Release-iphonesimulator/LxMusicMobile.app
fi
app="$(cd "$(dirname "$app")" && pwd)/$(basename "$app")"
test -d "$app"
test -x "$app/LxMusicMobile"
bundle_id=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app/Info.plist")
device=$(xcrun simctl create 'LX Music CI' com.apple.CoreSimulator.SimDeviceType.iPhone-16 "$runtime")
xcrun simctl boot "$device"
xcrun simctl bootstatus "$device" -b
python3 scripts/check-ios-network.py "$app/Info.plist"
# A qualified hostname is essential: localhost/IP exceptions would hide the ATS bug.
echo '127.0.0.1 lx-ios-fixture.test' | sudo tee -a /etc/hosts
node scripts/ios-http-fixture.cjs > build/http-fixture.log 2>&1 &
http_pid=$!
for attempt in $(seq 1 20); do
  if curl --noproxy '*' --fail --silent http://lx-ios-fixture.test:18765/search >/dev/null; then break; fi
  sleep 1
done
curl --noproxy '*' --fail --silent http://lx-ios-fixture.test:18765/search >/dev/null

# Same binary and endpoint, old policy: prove that HTTP really was blocked.
/usr/libexec/PlistBuddy -c 'Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true' "$app/Info.plist"
echo "Installing $app on $device"
for install_attempt in $(seq 1 3); do
  if xcrun simctl install "$device" "$app"; then break; fi
  echo "install attempt $install_attempt failed; retrying" >&2
  sleep 3
  xcrun simctl boot "$device" >/dev/null 2>&1 || true
  xcrun simctl bootstatus "$device" -b >/dev/null 2>&1 || true
done
xcrun simctl get_app_container "$device" "$bundle_id" app >/dev/null
SIMCTL_CHILD_LX_IOS_SMOKE=1 SIMCTL_CHILD_LX_IOS_HTTP_PROBE=1 xcrun simctl launch --console "$device" "$bundle_id" > build/simulator-ats-control.log 2>&1 &
control_pid=$!
container=$(xcrun simctl get_app_container "$device" "$bundle_id" data)
probe="$container/Library/Caches/lx-ios-http-probe.json"
for attempt in $(seq 1 30); do
  if [ -f "$probe" ]; then break; fi
  if ! kill -0 "$control_pid" 2>/dev/null; then break; fi
  sleep 1
done
cp "$probe" build/lx-ios-http-probe.json
python3 -c 'import json; r=json.load(open("build/lx-ios-http-probe.json")); print("Old ATS policy:",r); assert r["status"]=="blocked",r'
xcrun simctl terminate "$device" "$bundle_id"
wait "$control_pid" || true
xcrun simctl uninstall "$device" "$bundle_id"
/usr/libexec/PlistBuddy -c 'Delete :NSAppTransportSecurity:NSAllowsLocalNetworking' "$app/Info.plist"
python3 scripts/check-ios-network.py "$app/Info.plist"
ditto -c -k --keepParent "$app" build/simulator-app.zip
capture_ui() {
  screen=$1
  output=$2
  container=$(xcrun simctl get_app_container "$device" "$bundle_id" data)
  report="$container/Library/Caches/lx-ios-smoke.json"
  rm -f "$report"
  SIMCTL_CHILD_LX_IOS_SMOKE=1 SIMCTL_CHILD_LX_IOS_UI_SCREEN="$screen" xcrun simctl launch "$device" "$bundle_id" >/dev/null
  for attempt in $(seq 1 40); do
    if [ -f "$report" ]; then break; fi
    sleep 1
  done
  sleep 2
  xcrun simctl io "$device" screenshot "$output"
  xcrun simctl terminate "$device" "$bundle_id" >/dev/null 2>&1 || true
}

xcrun simctl install "$device" "$app"
capture_ui home build/ios-home.png
capture_ui settings build/ios-settings.png
capture_ui glass build/ios-glass.png
capture_ui settings_detail build/ios-settings-detail.png
capture_ui settings_lyric build/ios-settings-lyric.png
capture_ui pip build/ios-pip.png
SIMCTL_CHILD_LX_IOS_SMOKE=1 xcrun simctl launch --console "$device" "$bundle_id" > build/simulator-console.log 2>&1 &
launch_pid=$!
container=$(xcrun simctl get_app_container "$device" "$bundle_id" data)
report="$container/Library/Caches/lx-ios-smoke.json"
for attempt in $(seq 1 60); do
  if [ -f "$report" ]; then break; fi
  if ! kill -0 "$launch_pid" 2>/dev/null; then break; fi
  sleep 2
done
sleep 2
xcrun simctl io "$device" screenshot build/ios-simulator.png
xcrun simctl spawn "$device" log show --last 3m --style compact --predicate 'process == "LxMusicMobile"' > build/simulator-runtime.log
python3 - <<'PY'
import pathlib, shutil
target = pathlib.Path('build/crashes')
target.mkdir(exist_ok=True)
for directory in [pathlib.Path.home() / 'Library/Logs/DiagnosticReports', pathlib.Path.home() / 'Library/Developer/CoreSimulator/Devices']:
    pattern = 'LxMusicMobile*.ips' if directory.name == 'DiagnosticReports' else '**/LxMusicMobile*.ips'
    for report in directory.glob(pattern):
        shutil.copy2(report, target / report.name)
PY
test -f "$report"
cp "$report" build/lx-ios-smoke.json
python3 -c 'import json; r=json.load(open("build/lx-ios-smoke.json")); print(json.dumps(r,ensure_ascii=False,indent=2)); assert r["status"]=="passed",r'
