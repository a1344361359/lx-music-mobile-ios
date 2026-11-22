import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct LXMusicActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var title: String
        var artist: String
        var artworkUrl: String
        var lyric: String
        var previousLyric: String
        var nextLyric: String
        var isPlaying: Bool
        var elapsed: Double
        var duration: Double
        var playedColor: String
        var unplayedColor: String
        var lineProgress: Double
    }

    var songId: String
}
