import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct LXMusicActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var title: String
        var artist: String
        var lyric: String
        var nextLyric: String
        var isPlaying: Bool
        var elapsed: Double
        var duration: Double
    }

    var songId: String
}
