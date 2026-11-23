#import <MediaPlayer/MediaPlayer.h>
#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

@interface LXNowPlaying : NSObject <RCTBridgeModule>
@end

@implementation LXNowPlaying

RCT_EXPORT_MODULE(LXNowPlaying)

+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

static NSMutableDictionary *LXNowPlayingInfo(void) {
  NSDictionary *current = MPNowPlayingInfoCenter.defaultCenter.nowPlayingInfo;
  return current != nil ? [current mutableCopy] : [NSMutableDictionary dictionary];
}

- (void)applyArtwork:(NSString *)urlString {
  if (urlString.length == 0) return;
  NSURL *url = [NSURL URLWithString:urlString];
  if (url == nil || url.scheme.length == 0) return;
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
    NSData *data = [NSData dataWithContentsOfURL:url];
    if (data.length == 0) return;
    UIImage *image = [UIImage imageWithData:data];
    if (image == nil) return;
    MPMediaItemArtwork *artwork = [[MPMediaItemArtwork alloc] initWithBoundsSize:image.size requestHandler:^UIImage * _Nonnull(CGSize size) {
      return image;
    }];
    dispatch_async(dispatch_get_main_queue(), ^{
      NSMutableDictionary *now = LXNowPlayingInfo();
      now[MPMediaItemPropertyArtwork] = artwork;
      MPNowPlayingInfoCenter.defaultCenter.nowPlayingInfo = now;
    });
  });
}

RCT_EXPORT_METHOD(update:(NSDictionary *)info resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSMutableDictionary *now = LXNowPlayingInfo();
  id value = info[@"title"];
  if ([value isKindOfClass:[NSString class]] && [value length] > 0) now[MPMediaItemPropertyTitle] = value;
  value = info[@"artist"];
  if ([value isKindOfClass:[NSString class]] && [value length] > 0) now[MPMediaItemPropertyArtist] = value;
  value = info[@"album"];
  if ([value isKindOfClass:[NSString class]] && [value length] > 0) now[MPMediaItemPropertyAlbumTitle] = value;

  value = info[@"duration"];
  if ([value respondsToSelector:@selector(doubleValue)]) {
    double duration = MAX(0, [value doubleValue]);
    if (duration > 0) now[MPMediaItemPropertyPlaybackDuration] = @(duration);
  }
  value = info[@"elapsedTime"];
  if ([value respondsToSelector:@selector(doubleValue)]) {
    now[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(MAX(0, [value doubleValue]));
  }
  value = info[@"playbackRate"];
  if ([value respondsToSelector:@selector(doubleValue)]) {
    now[MPNowPlayingInfoPropertyPlaybackRate] = @(MAX(0, [value doubleValue]));
  } else if (info[@"isPlaying"] != nil) {
    now[MPNowPlayingInfoPropertyPlaybackRate] = [info[@"isPlaying"] boolValue] ? @1.0 : @0.0;
  }

  MPNowPlayingInfoCenter.defaultCenter.nowPlayingInfo = now;

  if (@available(iOS 13.0, *)) {
    NSNumber *playing = info[@"isPlaying"];
    if (playing != nil) {
      MPNowPlayingInfoCenter.defaultCenter.playbackState = playing.boolValue
        ? MPNowPlayingPlaybackStatePlaying
        : MPNowPlayingPlaybackStatePaused;
    }
  }

  value = info[@"artwork"];
  if ([value isKindOfClass:[NSString class]]) [self applyArtwork:value];

  resolve(nil);
}

@end
