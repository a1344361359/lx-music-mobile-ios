import ActivityKit
import Foundation
import QuartzCore
import React

private struct LXLyricLine {
    let time: Double
    let text: String
}

@available(iOS 16.1, *)
@objc(LXLiveActivity)
final class LXLiveActivity: NSObject {
    private var activity: Activity<LXMusicActivityAttributes>?
    private var lines: [LXLyricLine] = []
    private var songId = ""
    private var title = ""
    private var artist = ""
    private var duration: Double = 0
    private var basePosition: Double = 0
    private var baseTime: CFTimeInterval = CACurrentMediaTime()
    private var isPlaying = false
    private var currentIndex = -2
    private var timer: DispatchSourceTimer?

    @objc static func requiresMainQueueSetup() -> Bool {
        true
    }

    @objc func isSupported(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.1, *) {
            resolve(ActivityAuthorizationInfo().areActivitiesEnabled)
        } else {
            resolve(false)
        }
    }

    @objc func start(_ payload: NSDictionary) {
        if #available(iOS 16.1, *) {
            DispatchQueue.main.async { [weak self] in
                self?.startOnMain(payload)
            }
        }
    }

    @objc func update(_ payload: NSDictionary) {
        if #available(iOS 16.1, *) {
            DispatchQueue.main.async { [weak self] in
                self?.updateOnMain(payload)
            }
        }
    }

    @objc func end() {
        if #available(iOS 16.1, *) {
            DispatchQueue.main.async { [weak self] in
                self?.endOnMain()
            }
        }
    }

    private func startOnMain(_ payload: NSDictionary) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let nextSongId = string(payload, "songId")
        guard !nextSongId.isEmpty else { return }

        let nextTitle = string(payload, "title")
        let nextArtist = string(payload, "artist")
        let nextDuration = max(0, number(payload, "duration"))
        let nextPosition = max(0, number(payload, "position"))
        let nextPlaying = bool(payload, "isPlaying")
        let nextLines = parseLines(payload["lines"])

        let sameSong = activity?.attributes.songId == nextSongId && activity?.activityState == .active
        songId = nextSongId
        title = nextTitle
        artist = nextArtist
        duration = nextDuration
        lines = nextLines
        basePosition = nextPosition
        baseTime = CACurrentMediaTime()
        isPlaying = nextPlaying
        currentIndex = -2

        if sameSong, let existing = activity {
            activity = existing
            pushState(at: nextPosition)
            restartTimer()
            return
        }

        endExistingActivities()
        activity = nil
        let state = makeState(at: nextPosition)
        do {
            if #available(iOS 16.2, *) {
                activity = try Activity.request(
                    attributes: LXMusicActivityAttributes(songId: nextSongId),
                    content: ActivityContent(state: state, staleDate: nil),
                    pushType: nil
                )
            } else {
                activity = try Activity.request(
                    attributes: LXMusicActivityAttributes(songId: nextSongId),
                    contentState: state,
                    pushType: nil
                )
            }
            currentIndex = index(at: nextPosition)
            restartTimer()
        } catch {
            NSLog("[LXLiveActivity] request failed: %@", String(describing: error))
        }
    }

    private func updateOnMain(_ payload: NSDictionary) {
        guard activity != nil else { return }

        if payload["position"] != nil {
            basePosition = max(0, number(payload, "position"))
            baseTime = CACurrentMediaTime()
        }
        if payload["duration"] != nil {
            duration = max(0, number(payload, "duration"))
        }
        let nextPlaying = bool(payload, "isPlaying")
        if isPlaying != nextPlaying {
            isPlaying = nextPlaying
            if nextPlaying {
                basePosition = max(0, number(payload, "position"))
                baseTime = CACurrentMediaTime()
            }
        }
        pushState(at: basePosition + (isPlaying ? CACurrentMediaTime() - baseTime : 0))
        restartTimer()
    }

    private func endOnMain() {
        stopTimer()
        endExistingActivities()
        activity = nil
        songId = ""
        lines = []
        isPlaying = false
        currentIndex = -2
    }

    private func restartTimer() {
        stopTimer()
        guard isPlaying, activity != nil else { return }
        let source = DispatchSource.makeTimerSource(queue: .main)
        source.schedule(deadline: .now() + 0.5, repeating: 0.5, leeway: .milliseconds(120))
        source.setEventHandler { [weak self] in
            self?.tick()
        }
        timer = source
        source.resume()
    }

    private func stopTimer() {
        timer?.cancel()
        timer = nil
    }

    private func tick() {
        guard isPlaying, activity != nil else { return }
        let elapsed = basePosition + (CACurrentMediaTime() - baseTime)
        let nextIndex = index(at: elapsed)
        guard nextIndex != currentIndex else { return }
        currentIndex = nextIndex
        pushState(at: elapsed)
    }

    private func pushState(at elapsed: Double) {
        guard let activity else { return }
        let state = makeState(at: elapsed)
        Task {
            if #available(iOS 16.2, *) {
                await activity.update(ActivityContent(state: state, staleDate: nil))
            } else {
                await activity.update(using: state)
            }
        }
    }

    private func makeState(at elapsed: Double) -> LXMusicActivityAttributes.ContentState {
        let idx = index(at: elapsed)
        let lyric = idx >= 0 && idx < lines.count ? lines[idx].text : ""
        let nextLyric = idx + 1 >= 0 && idx + 1 < lines.count ? lines[idx + 1].text : ""
        return LXMusicActivityAttributes.ContentState(
            title: title,
            artist: artist,
            lyric: lyric,
            nextLyric: nextLyric,
            isPlaying: isPlaying,
            elapsed: max(0, elapsed),
            duration: duration
        )
    }

    private func index(at elapsed: Double) -> Int {
        guard !lines.isEmpty else { return -1 }
        let milliseconds = max(0, elapsed) * 1000
        var result = -1
        for (idx, line) in lines.enumerated() {
            if line.time <= milliseconds {
                result = idx
            } else {
                break
            }
        }
        return result
    }

    private func parseLines(_ value: Any?) -> [LXLyricLine] {
        guard let raw = value as? [NSDictionary] else { return [] }
        return raw.compactMap { item in
            guard let text = item["text"] as? String else { return nil }
            let time = max(0, (item["time"] as? NSNumber)?.doubleValue ?? 0)
            return LXLyricLine(time: time, text: text)
        }.sorted { $0.time < $1.time }
    }

    private func string(_ payload: NSDictionary, _ key: String) -> String {
        (payload[key] as? String) ?? ""
    }

    private func number(_ payload: NSDictionary, _ key: String) -> Double {
        (payload[key] as? NSNumber)?.doubleValue ?? 0
    }

    private func bool(_ payload: NSDictionary, _ key: String) -> Bool {
        (payload[key] as? NSNumber)?.boolValue ?? false
    }

    private func endExistingActivities() {
        let running = Activity<LXMusicActivityAttributes>.activities
        Task {
            for item in running {
                if #available(iOS 16.2, *) {
                    await item.end(nil, dismissalPolicy: .immediate)
                } else {
                    await item.end(using: nil, dismissalPolicy: .immediate)
                }
            }
        }
    }
}
