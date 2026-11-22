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
    private var artworkUrl = ""
    private var playedColor = "#31C27C"
    private var unplayedColor = "#FFFFFF"
    private var duration: Double = 0
    private var basePosition: Double = 0
    private var baseTime: CFTimeInterval = CACurrentMediaTime()
    private var isPlaying = false
    private var playbackRate: Double = 1
    private var lyricOffset: Double = 0
    private var currentIndex = -2
    private var lastProgress = -1.0
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
        let nextArtwork = string(payload, "artworkUrl")
        let nextPlayedColor = normalizeColor(string(payload, "playedColor"), fallback: "#31C27C")
        let nextUnplayedColor = normalizeColor(string(payload, "unplayedColor"), fallback: "#FFFFFF")
        let nextDuration = max(0, number(payload, "duration"))
        let nextPosition = max(0, number(payload, "position"))
        let nextPlaying = bool(payload, "isPlaying")
        let rawRate = number(payload, "playbackRate")
        let nextRate = rawRate > 0 ? rawRate : 1
        let rawLyricOffset = number(payload, "lyricOffset")
        let nextLyricOffset = max(-5, min(5, rawLyricOffset))
        let nextLines = parseLines(payload["lines"])
        let positionAt = number(payload, "positionAt")
        let elapsedSinceCapture = positionAt > 0 ? max(0, (Date().timeIntervalSince1970 * 1000 - positionAt) / 1000) : 0

        let sameSong = activity?.attributes.songId == nextSongId && activity?.activityState == .active
        songId = nextSongId
        title = nextTitle
        artist = nextArtist
        artworkUrl = nextArtwork
        playedColor = nextPlayedColor
        unplayedColor = nextUnplayedColor
        duration = nextDuration
        lines = nextLines
        basePosition = nextPosition + (nextPlaying ? elapsedSinceCapture * nextRate : 0)
        baseTime = CACurrentMediaTime()
        isPlaying = nextPlaying
        playbackRate = nextRate
        lyricOffset = nextLyricOffset
        currentIndex = index(at: basePosition + lyricOffset)
        lastProgress = lineProgress(at: basePosition + lyricOffset)

        if sameSong, let existing = activity {
            activity = existing
            pushState(at: basePosition)
            restartTimer()
            return
        }

        endExistingActivities()
        activity = nil
        let state = makeState(at: basePosition)
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
            restartTimer()
        } catch {
            NSLog("[LXLiveActivity] request failed: %@", String(describing: error))
        }
    }

    private func updateOnMain(_ payload: NSDictionary) {
        guard activity != nil else { return }
        let payloadSongId = string(payload, "songId")
        if !payloadSongId.isEmpty && payloadSongId != songId { return }

        let nextPlaying = bool(payload, "isPlaying")
        let wasPlaying = isPlaying
        isPlaying = nextPlaying

        if payload["duration"] != nil {
            duration = max(0, number(payload, "duration"))
        }
        if payload["playedColor"] != nil {
            playedColor = normalizeColor(string(payload, "playedColor"), fallback: playedColor)
        }
        if payload["unplayedColor"] != nil {
            unplayedColor = normalizeColor(string(payload, "unplayedColor"), fallback: unplayedColor)
        }
        if payload["artworkUrl"] != nil {
            artworkUrl = string(payload, "artworkUrl")
        }
        if payload["playbackRate"] != nil {
            playbackRate = max(0.1, number(payload, "playbackRate"))
        }
        if payload["lyricOffset"] != nil {
            lyricOffset = max(-5, min(5, number(payload, "lyricOffset")))
        }

        if payload["position"] != nil {
            let position = max(0, number(payload, "position"))
            let positionAt = number(payload, "positionAt")
            let elapsedSinceCapture = positionAt > 0 ? max(0, (Date().timeIntervalSince1970 * 1000 - positionAt) / 1000) : 0
            basePosition = position + (nextPlaying ? elapsedSinceCapture * playbackRate : 0)
            baseTime = CACurrentMediaTime()
        } else if !wasPlaying && nextPlaying {
            baseTime = CACurrentMediaTime()
        }

        pushState(at: elapsedPosition())
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
        lastProgress = -1
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

    private func elapsedPosition() -> Double {
        basePosition + (isPlaying ? (CACurrentMediaTime() - baseTime) * playbackRate : 0)
    }

    private func stopTimer() {
        timer?.cancel()
        timer = nil
    }

    private func tick() {
        guard isPlaying, activity != nil else { return }
        let elapsed = elapsedPosition()
        let adjusted = max(0, elapsed + lyricOffset)
        let nextIndex = index(at: adjusted)
        let nextProgress = lineProgress(at: adjusted)
        guard nextIndex != currentIndex || abs(nextProgress - lastProgress) >= 0.015 else { return }
        currentIndex = nextIndex
        lastProgress = nextProgress
        pushState(at: elapsed)
    }

    private func pushState(at elapsed: Double) {
        guard let activity else { return }
        let state = makeState(at: elapsed)
        lastProgress = state.lineProgress
        Task {
            if #available(iOS 16.2, *) {
                await activity.update(ActivityContent(state: state, staleDate: nil))
            } else {
                await activity.update(using: state)
            }
        }
    }

    private func makeState(at elapsed: Double) -> LXMusicActivityAttributes.ContentState {
        let lyricTime = max(0, elapsed + lyricOffset)
        let idx = index(at: lyricTime)
        let lyric = idx >= 0 && idx < lines.count ? lines[idx].text : ""
        let previousLyric = idx > 0 && idx - 1 < lines.count ? lines[idx - 1].text : ""
        let nextLyric = idx + 1 >= 0 && idx + 1 < lines.count ? lines[idx + 1].text : ""
        let nextLyric2 = idx + 2 >= 0 && idx + 2 < lines.count ? lines[idx + 2].text : ""
        return LXMusicActivityAttributes.ContentState(
            title: title,
            artist: artist,
            artworkUrl: artworkUrl,
            lyric: lyric,
            previousLyric: previousLyric,
            nextLyric: nextLyric,
            nextLyric2: nextLyric2,
            isPlaying: isPlaying,
            elapsed: max(0, elapsed),
            duration: duration,
            playedColor: playedColor,
            unplayedColor: unplayedColor,
            lineProgress: lineProgress(at: lyricTime)
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

    private func lineProgress(at elapsed: Double) -> Double {
        let idx = index(at: elapsed)
        guard idx >= 0, idx < lines.count else { return 0 }
        let start = lines[idx].time
        var end = duration > 0 ? duration * 1000 : start + 6000
        if idx + 1 < lines.count {
            end = lines[idx + 1].time
        }
        guard end > start else { return 1 }
        let value = (max(0, elapsed) * 1000 - start) / (end - start)
        return max(0, min(1, value))
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

    private func normalizeColor(_ value: String, fallback: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let hex = trimmed.hasPrefix("#") ? String(trimmed.dropFirst()) : trimmed
        guard hex.count == 6, hex.unicodeScalars.allSatisfy({ CharacterSet(charactersIn: "0123456789ABCDEFabcdef").contains($0) }) else {
            return fallback
        }
        return "#" + hex.uppercased()
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
