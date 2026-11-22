import ActivityKit
import SwiftUI
import WidgetKit

private let lxAccent = Color(red: 0.13, green: 0.62, blue: 0.42)
private let lxBackground = Color(red: 0.055, green: 0.07, blue: 0.065)

@available(iOS 16.1, *)
struct LXMusicLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LXMusicActivityAttributes.self) { context in
            LockScreenView(state: context.state)
                .activityBackgroundTint(lxBackground)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 8) {
                        ArtworkPlaceholder(size: 34)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(context.state.title)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            Text(context.state.artist)
                                .font(.caption2)
                                .foregroundStyle(.white.opacity(0.62))
                                .lineLimit(1)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Image(systemName: context.state.isPlaying ? "waveform" : "pause.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(lxAccent)
                        .frame(width: 22)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(context.state.lyric.isEmpty ? "歌词加载中…" : context.state.lyric)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        if !context.state.nextLyric.isEmpty {
                            Text(context.state.nextLyric)
                                .font(.system(size: 12))
                                .foregroundStyle(.white.opacity(0.55))
                                .lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                Image(systemName: "music.note")
                    .foregroundStyle(lxAccent)
            } compactTrailing: {
                Image(systemName: context.state.isPlaying ? "waveform" : "pause.fill")
                    .foregroundStyle(lxAccent)
            } minimal: {
                Image(systemName: "music.note")
                    .foregroundStyle(lxAccent)
            }
            .keylineTint(lxAccent)
        }
    }
}

@available(iOS 16.1, *)
private struct LockScreenView: View {
    let state: LXMusicActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                ArtworkPlaceholder(size: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text(state.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(state.artist)
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.62))
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                Image(systemName: state.isPlaying ? "waveform" : "pause.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(lxAccent)
            }

            Text(state.lyric.isEmpty ? "歌词加载中…" : state.lyric)
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)

            if !state.nextLyric.isEmpty {
                Text(state.nextLyric)
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.52))
                    .lineLimit(1)
            }

            if state.duration > 0 {
                ProgressView(value: max(0, min(state.elapsed, state.duration)), total: state.duration)
                    .tint(lxAccent)
                HStack {
                    Text(formatTime(state.elapsed))
                    Spacer()
                    Text(formatTime(state.duration))
                }
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.white.opacity(0.55))
            }
        }
        .padding(14)
    }

    private func formatTime(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "00:00" }
        let total = Int(seconds.rounded())
        return String(format: "%02d:%02d", total / 60, total % 60)
    }
}

@available(iOS 16.1, *)
private struct ArtworkPlaceholder: View {
    let size: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [lxAccent.opacity(0.9), lxAccent.opacity(0.35)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .frame(width: size, height: size)
            .overlay(
                Image(systemName: "music.note")
                    .font(.system(size: size * 0.4, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.92))
            )
    }
}


struct LXMusicFallbackEntry: TimelineEntry {
    let date: Date
}

struct LXMusicFallbackProvider: TimelineProvider {
    func placeholder(in context: Context) -> LXMusicFallbackEntry {
        LXMusicFallbackEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (LXMusicFallbackEntry) -> Void) {
        completion(LXMusicFallbackEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LXMusicFallbackEntry>) -> Void) {
        completion(Timeline(entries: [LXMusicFallbackEntry(date: Date())], policy: .never))
    }
}

struct LXMusicFallbackWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LXMusicFallback", provider: LXMusicFallbackProvider()) { _ in
            VStack(spacing: 4) {
                Image(systemName: "music.note")
                    .foregroundStyle(lxAccent)
                Text("LX Music")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .configurationDisplayName("LX Music")
        .description("在 iOS 16.1 及以上版本支持灵动岛实时歌词")
        .supportedFamilies([.systemSmall])
    }
}
