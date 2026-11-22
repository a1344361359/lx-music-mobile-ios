#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <ifaddrs.h>
#import <arpa/inet.h>

@interface UtilsModule : RCTEventEmitter
@end
@implementation UtilsModule
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }
- (NSArray<NSString *> *)supportedEvents { return @[@"screen-state", @"screen-size-changed"]; }
- (NSDictionary *)constantsToExport {
#if TARGET_OS_SIMULATOR
  return @{@"smokeTestRequested":@([NSProcessInfo.processInfo.environment[@"LX_IOS_SMOKE"] boolValue]),
           @"smokeHTTPProbeRequested":@([NSProcessInfo.processInfo.environment[@"LX_IOS_HTTP_PROBE"] boolValue]),
           @"uiSmokeScreen":NSProcessInfo.processInfo.environment[@"LX_IOS_UI_SCREEN"] ?: @""};
#else
  return @{@"smokeTestRequested":@NO};
#endif
}
RCT_EXPORT_METHOD(getSystemLocales:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *locale = [NSLocale.preferredLanguages.firstObject ?: @"en-US" stringByReplacingOccurrencesOfString:@"-" withString:@"_"];
  // Match Android's language_country representation, including Chinese script variants.
  if ([locale hasPrefix:@"zh_Hans"]) locale = @"zh_CN";
  if ([locale hasPrefix:@"zh_Hant"]) locale = @"zh_TW";
  resolve(locale.lowercaseString);
}
RCT_EXPORT_METHOD(getDeviceName:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) { resolve(UIDevice.currentDevice.name); }
RCT_EXPORT_METHOD(getSupportedAbis:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) { resolve(@[@"arm64"]); }
RCT_EXPORT_METHOD(getWindowSize:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  CGRect bounds = RCTPresentedViewController().view.bounds;
  if (CGRectIsEmpty(bounds)) bounds = UIScreen.mainScreen.bounds;
  CGFloat scale = UIScreen.mainScreen.scale;
  resolve(@{@"width":@(bounds.size.width * scale), @"height":@(bounds.size.height * scale)});
}
RCT_EXPORT_METHOD(listenWindowSizeChanged) {}
RCT_EXPORT_METHOD(screenkeepAwake) { UIApplication.sharedApplication.idleTimerDisabled = YES; }
RCT_EXPORT_METHOD(screenUnkeepAwake) { UIApplication.sharedApplication.idleTimerDisabled = NO; }
// Audio playback does not require Android's notification or battery-optimization permissions.
RCT_EXPORT_METHOD(isNotificationsEnabled:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) { resolve(@YES); }
RCT_EXPORT_METHOD(openNotificationPermissionActivity:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) { resolve(@YES); }
RCT_EXPORT_METHOD(isIgnoringBatteryOptimization:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) { resolve(@YES); }
RCT_EXPORT_METHOD(requestIgnoreBatteryOptimization:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) { resolve(@YES); }
RCT_EXPORT_METHOD(getWIFIIPV4Address:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *address = @"0.0.0.0"; struct ifaddrs *interfaces = NULL;
  if (getifaddrs(&interfaces) == 0) {
    for (struct ifaddrs *item = interfaces; item; item = item->ifa_next) {
      if (item->ifa_addr && item->ifa_addr->sa_family == AF_INET && strcmp(item->ifa_name, "en0") == 0)
        address = [NSString stringWithUTF8String:inet_ntoa(((struct sockaddr_in *)item->ifa_addr)->sin_addr)];
    }
    freeifaddrs(interfaces);
  }
  resolve(address);
}
RCT_EXPORT_METHOD(shareText:(NSString *)shareTitle title:(NSString *)title text:(NSString *)text resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  UIViewController *presenter = RCTPresentedViewController();
  UIActivityViewController *activity = [[UIActivityViewController alloc] initWithActivityItems:@[text ?: @""] applicationActivities:nil];
  activity.popoverPresentationController.sourceView = presenter.view;
  activity.popoverPresentationController.sourceRect = CGRectMake(presenter.view.bounds.size.width/2, presenter.view.bounds.size.height/2,1,1);
  [presenter presentViewController:activity animated:YES completion:^{ resolve(nil); }];
}
RCT_EXPORT_METHOD(exitApp) { /* iOS apps are closed by the user. */ }
RCT_EXPORT_METHOD(installApk:(NSString *)path authority:(NSString *)authority resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  reject(@"IOS_UNSUPPORTED", @"iOS 版本请使用新的 IPA 覆盖安装，无法安装 APK。", nil);
}
@end

@interface CacheModule : NSObject <RCTBridgeModule>
@end
@implementation CacheModule
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return NO; }
RCT_EXPORT_METHOD(getAppCacheSize:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *cache = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES).firstObject;
  unsigned long long total = 0;
  for (NSString *path in [NSFileManager.defaultManager enumeratorAtPath:cache]) {
    NSDictionary *attributes = [NSFileManager.defaultManager attributesOfItemAtPath:[cache stringByAppendingPathComponent:path] error:nil];
    if ([attributes.fileType isEqualToString:NSFileTypeRegular]) total += attributes.fileSize;
  }
  resolve(@(total));
}
RCT_EXPORT_METHOD(clearAppCache:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *cache = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES).firstObject;
  for (NSString *path in [NSFileManager.defaultManager contentsOfDirectoryAtPath:cache error:nil]) {
    NSError *error = nil;
    [NSFileManager.defaultManager removeItemAtPath:[cache stringByAppendingPathComponent:path] error:&error];
    if (error) { reject(@"CACHE",error.localizedDescription,error); return; }
  }
  resolve(nil);
}
@end

@interface LXDocumentPicker : NSObject <RCTBridgeModule, UIDocumentPickerDelegate>
@property(nonatomic, copy) RCTPromiseResolveBlock pendingResolve;
@property(nonatomic, copy) RCTPromiseRejectBlock pendingReject;
@property(nonatomic, weak) UIDocumentPickerViewController *activePicker;
@end
@implementation LXDocumentPicker
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

- (void)clearPending {
  self.pendingResolve = nil;
  self.pendingReject = nil;
  self.activePicker = nil;
}

- (void)rejectPending:(NSString *)code message:(NSString *)message {
  if (self.pendingReject) self.pendingReject(code, message, nil);
  [self clearPending];
}

- (BOOL)isPickerVisible {
  UIDocumentPickerViewController *picker = self.activePicker;
  return picker != nil && picker.presentingViewController != nil && picker.view.window != nil;
}

RCT_EXPORT_METHOD(openDocument:(NSDictionary *)options resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (self.pendingResolve) {
    // A previous request can be left pending after its presenting controller was
    // dismissed (for example when a React Native modal closes). Do not block all
    // later imports because of that stale request.
    if ([self isPickerVisible]) {
      reject(@"picker_busy", @"A document picker is already open", nil);
      return;
    }
    if (self.pendingReject) self.pendingReject(@"picker_cancelled", @"Stale document picker request", nil);
    [self clearPending];
  }
  self.pendingResolve = resolve;
  self.pendingReject = reject;

  // Wait for any React Native modal presentation transition to settle first.
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    if (!self.pendingResolve) return;

    UIDocumentPickerViewController *picker;
    if (@available(iOS 14.0, *)) {
      // public.data covers source-code and text files such as .js, while excluding folders.
      picker = [[UIDocumentPickerViewController alloc] initForOpeningContentTypes:@[UTTypeData] asCopy:YES];
    } else {
      picker = [[UIDocumentPickerViewController alloc] initWithDocumentTypes:@[@"public.data"] inMode:UIDocumentPickerModeImport];
    }
    picker.delegate = self;
    picker.allowsMultipleSelection = NO;
    self.activePicker = picker;

    UIViewController *presenter = RCTPresentedViewController();
    while (presenter.presentedViewController && !presenter.presentedViewController.isBeingDismissed) {
      presenter = presenter.presentedViewController;
    }
    if (!presenter || presenter.isBeingDismissed) {
      [self rejectPending:@"picker_present" message:@"No view controller is available to present the document picker"];
      return;
    }

    [presenter presentViewController:picker animated:YES completion:^{
      // Detect a silent presentation failure so the JS layer can fall back immediately.
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        if (!self.pendingResolve || !self.activePicker) return;
        if (![self isPickerVisible]) {
          [self rejectPending:@"picker_present" message:@"The document picker did not become visible"];
        }
      });
    }];
  });
}

// Used by the simulator smoke test to verify presentation and cleanup without a user tap.
RCT_EXPORT_METHOD(dismissActivePicker:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  BOOL visible = [self isPickerVisible];
  UIDocumentPickerViewController *picker = self.activePicker;
  if (visible && picker != nil) {
    [picker dismissViewControllerAnimated:YES completion:^{ resolve(@{@"presented": @YES}); }];
    return;
  }
  if (self.pendingResolve) self.pendingResolve(nil);
  [self clearPending];
  resolve(@{@"presented": @NO});
}

- (void)documentPicker:(UIDocumentPickerViewController *)controller didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls {
  NSURL *url = urls.firstObject;
  if (!url || !self.pendingResolve) {
    if (self.pendingResolve) self.pendingResolve(nil);
    [self clearPending];
    return;
  }

  // asCopy:YES has already copied the selected document into the app container,
  // so return that path directly instead of copying it a second time.
  NSString *path = url.path;
  BOOL scoped = [url startAccessingSecurityScopedResource];
  BOOL readable = path.length > 0 && [NSFileManager.defaultManager isReadableFileAtPath:path];
  if (scoped) [url stopAccessingSecurityScopedResource];

  if (!readable) {
    // Fallback for providers that ignore asCopy: handle the security-scoped URL ourselves.
    BOOL access = [url startAccessingSecurityScopedResource];
    NSString *folder = [NSTemporaryDirectory() stringByAppendingPathComponent:NSUUID.UUID.UUIDString];
    NSError *error = nil;
    [NSFileManager.defaultManager createDirectoryAtPath:folder withIntermediateDirectories:YES attributes:nil error:&error];
    NSString *destination = [folder stringByAppendingPathComponent:url.lastPathComponent ?: @"document"];
    if (!error) [NSFileManager.defaultManager copyItemAtURL:url toURL:[NSURL fileURLWithPath:destination] error:&error];
    if (access) [url stopAccessingSecurityScopedResource];
    if (error) {
      if (self.pendingReject) self.pendingReject(@"DOCUMENT_IMPORT", error.localizedDescription, error);
      [self clearPending];
      return;
    }
    path = destination;
  }

  if (self.pendingResolve) self.pendingResolve(@{@"data": path});
  [self clearPending];
}

- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller {
  if (self.pendingResolve) self.pendingResolve(nil);
  [self clearPending];
}
@end
