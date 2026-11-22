import ActivityKit
import SwiftUI
import WidgetKit

private let lxAccent = Color(red: 0.13, green: 0.62, blue: 0.42)
private let lxBackground = Color(red: 0.055, green: 0.07, blue: 0.065)

private extension Color {
    init(lxHex: String, fallback: Color) {
        let trimmed = lxHex.trimmingCharacters(in: .whitespacesAndNewlines)
        let hex = trimmed.hasPrefix("#") ? String(trimmed.dropFirst()) : trimmed
        guard hex.count == 6, let value = UInt64(hex, radix: 16) else {
            self = fallback
            return
        }
        self.init(
            .sRGB,
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255,
            opacity: 1
        )
    }
}

@available(iOS 16.1, *)
private func lxPlayedColor(_ state: LXMusicActivityAttributes.ContentState) -> Color {
    Color(lxHex: state.playedColor, fallback: lxAccent)
}

@available(iOS 16.1, *)
private func lxUnplayedColor(_ state: LXMusicActivityAttributes.ContentState) -> Color {
    Color(lxHex: state.unplayedColor, fallback: .white)
}

@available(iOS 16.1, iOSApplicationExtension 16.1, *)
struct LXMusicLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LXMusicActivityAttributes.self) { context in
            LockScreenView(state: context.state)
                .activityBackgroundTint(lxBackground)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 7) {
                        ArtworkView(urlString: context.state.artworkUrl, size: 30)
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
                        .foregroundStyle(lxPlayedColor(context.state))
                        .frame(width: 22)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 1) {
                        KaraokeText(
                            text: context.state.lyric.isEmpty ? "歌词加载中…" : context.state.lyric,
                            progress: context.state.lineProgress,
                            playedColor: lxPlayedColor(context.state),
                            unplayedColor: lxUnplayedColor(context.state),
                            font: .system(size: 16, weight: .semibold)
                        )
                        if !context.state.nextLyric.isEmpty {
                            Text(context.state.nextLyric)
                                .font(.system(size: 12))
                                .foregroundStyle(lxUnplayedColor(context.state).opacity(0.72))
                                .lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                ArtworkView(urlString: context.state.artworkUrl, size: 20)
            } compactTrailing: {
                Image(systemName: context.state.isPlaying ? "waveform" : "pause.fill")
                    .foregroundStyle(lxPlayedColor(context.state))
            } minimal: {
                Image(systemName: "music.note")
                    .foregroundStyle(lxPlayedColor(context.state))
            }
            .keylineTint(lxPlayedColor(context.state))
        }
    }
}

@available(iOS 16.1, *)
private struct LockScreenView: View {
    let state: LXMusicActivityAttributes.ContentState

    var body: some View {
        let played = Color(lxHex: state.playedColor, fallback: lxAccent)
        let unplayed = Color(lxHex: state.unplayedColor, fallback: .white)
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 10) {
                ArtworkView(urlString: state.artworkUrl, size: 44)
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
                    .foregroundStyle(played)
            }

            if !state.previousLyric.isEmpty {
                Text(state.previousLyric)
                    .font(.system(size: 12))
                    .foregroundStyle(played.opacity(0.48))
                    .lineLimit(1)
            }

            KaraokeText(
                text: state.lyric.isEmpty ? "歌词加载中…" : state.lyric,
                progress: state.lineProgress,
                playedColor: played,
                unplayedColor: unplayed,
                font: .system(size: 20, weight: .semibold)
            )

            if !state.nextLyric.isEmpty {
                Text(state.nextLyric)
                    .font(.system(size: 13))
                    .foregroundStyle(unplayed.opacity(0.65))
                    .lineLimit(1)
            }

            if state.duration > 0 {
                ProgressView(value: max(0, min(state.elapsed, state.duration)), total: state.duration)
                    .tint(played)
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

private struct KaraokeText: View {
    let text: String
    let progress: Double
    let playedColor: Color
    let unplayedColor: Color
    let font: Font

    var body: some View {
        Text(text)
            .font(font)
            .lineLimit(1)
            .minimumScaleFactor(0.72)
            .foregroundStyle(
                LinearGradient(
                    stops: [
                        .init(color: playedColor, location: 0),
                        .init(color: playedColor, location: progressValue),
                        .init(color: unplayedColor, location: progressValue),
                        .init(color: unplayedColor, location: 1),
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
    }

    private var progressValue: CGFloat {
        CGFloat(min(max(progress, 0), 1))
    }
}

private struct ArtworkView: View {
    let urlString: String
    let size: CGFloat

    var body: some View {
        Group {
            if !urlString.isEmpty, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .empty, .failure:
                        placeholder
                    @unknown default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [lxAccent.opacity(0.9), lxAccent.opacity(0.35)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
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
