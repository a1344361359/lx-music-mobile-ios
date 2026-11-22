import SwiftUI
import WidgetKit

@available(iOS 16.1, iOSApplicationExtension 16.1, *)
@main
struct LXMusicWidgetBundle: WidgetBundle {
    @WidgetBundleBuilder
    var body: some Widget {
        LXMusicLiveActivity()
    }
}
