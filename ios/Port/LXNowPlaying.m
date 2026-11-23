#import <MediaPlayer/MediaPlayer.h>
#import <AVFoundation/AVFoundation.h>
#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

@interface LXNowPlaying : NSObject <RCTBridgeModule>
@end

@implementation LXNowPlaying

RCT_EXPORT_MODULE(LXNowPlaying)

+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

// JS 每秒只上报进度时不会再带歌曲名。这里保留一份原生缓存，
// 即使系统或播放器短暂清空 nowPlayingInfo，下一次进度刷新也能把
// 标题、歌手、封面和总时长重新拼回锁屏卡片。
static NSMutableDictionary *LXNowPlayingCache = nil;

static NSMutableDictionary *LXNowPlayingInfo(void) {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    LXNowPlayingCache = [NSMutableDictionary dictionary];
    NSDictionary *current = MPNowPlayingInfoCenter.defaultCenter.nowPlayingInfo;
    if (current != nil) [LXNowPlayingCache addEntriesFromDictionary:current];
  });
  return LXNowPlayingCache;
}

- (void)applyArtwork:(NSString *)urlString forTitle:(NSString *)expectedTitle {
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
      NSString *currentTitle = now[MPMediaItemPropertyTitle];
      // 网络封面可能在新歌已经切走之后才返回，不能把旧封面贴到新歌上。
      if (expectedTitle.length > 0 && currentTitle.length > 0 &&
          ![expectedTitle isEqualToString:currentTitle]) return;
      now[MPMediaItemPropertyArtwork] = artwork;
      MPNowPlayingInfoCenter.defaultCenter.nowPlayingInfo = [now copy];
    });
  });
}

static void LXActivateNonMixablePlaybackSession(void) {
  // iOS 的“正在播放”资格要求非混音音频会话。桌面歌词/画中画此前为了
  // 压低其他 App 音量使用了 DuckOthers，这会让会话变成可混音，锁屏和
  // 控制中心就可能完全不显示 KMusic。这里在写元数据前纠正回来。
  NSError *error = nil;
  AVAudioSession *session = AVAudioSession.sharedInstance;
  [session setCategory:AVAudioSessionCategoryPlayback
                   mode:AVAudioSessionModeDefault
                options:AVAudioSessionCategoryOptionAllowBluetoothA2DP
                  error:&error];
  if (error == nil) [session setActive:YES error:&error];
}

RCT_EXPORT_METHOD(update:(NSDictionary *)info resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  LXActivateNonMixablePlaybackSession();
  NSMutableDictionary *now = LXNowPlayingInfo();
  id value = info[@"title"];
  if ([value isKindOfClass:[NSString class]] && [value length] > 0) {
    NSString *oldTitle = now[MPMediaItemPropertyTitle];
    if (oldTitle.length > 0 && ![oldTitle isEqualToString:value]) {
      [now removeObjectForKey:MPMediaItemPropertyArtwork];
      [now removeObjectForKey:MPMediaItemPropertyAlbumTitle];
    }
    now[MPMediaItemPropertyTitle] = value;
  }
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

  // 明确告诉系统这是一首普通音频，并补齐默认播放速率/直播标记；
  // iOS 26 的锁屏播放器在没有这些字段时可能只显示空白卡片。
  now[MPNowPlayingInfoPropertyMediaType] = @(MPNowPlayingInfoMediaTypeAudio);
  // 旧版 MediaPlayer 属性也一起写，兼容部分系统/车机读取路径。
  now[MPMediaItemPropertyMediaType] = @(MPMediaTypeMusic);
  now[MPNowPlayingInfoPropertyDefaultPlaybackRate] = @1.0;
  now[MPNowPlayingInfoPropertyIsLiveStream] = @NO;
  now[MPNowPlayingInfoPropertyPlaybackQueueCount] = @1;
  now[MPNowPlayingInfoPropertyPlaybackQueueIndex] = @0;
  if (now[MPNowPlayingInfoPropertyPlaybackRate] == nil) {
    NSNumber *playing = info[@"isPlaying"];
    now[MPNowPlayingInfoPropertyPlaybackRate] = playing.boolValue ? @1.0 : @0.0;
  }
  MPNowPlayingInfoCenter.defaultCenter.nowPlayingInfo = [now copy];

  if (@available(iOS 13.0, *)) {
    NSNumber *playing = info[@"isPlaying"];
    if (playing != nil) {
      MPNowPlayingInfoCenter.defaultCenter.playbackState = playing.boolValue
        ? MPNowPlayingPlaybackStatePlaying
        : MPNowPlayingPlaybackStatePaused;
    }
  }

  value = info[@"artwork"];
  if ([value isKindOfClass:[NSString class]]) {
    [self applyArtwork:value forTitle:now[MPMediaItemPropertyTitle]];
  }

  resolve(nil);
}

@end
