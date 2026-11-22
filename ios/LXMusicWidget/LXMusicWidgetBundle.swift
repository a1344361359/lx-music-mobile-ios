import SwiftUI
import WidgetKit

@main
struct LXMusicWidgetBundle: WidgetBundle {
    @WidgetBundleBuilder
    var body: some Widget {
        if #available(iOS 16.1, *) {
            LXMusicLiveActivity()
        } else {
            LXMusicFallbackWidget()
        }
    }
}
