#import <AVKit/AVKit.h>
#import <AVFoundation/AVFoundation.h>
#import <MediaPlayer/MediaPlayer.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <UIKit/UIKit.h>

static UIColor *LXColorFromSetting(NSString *value, UIColor *fallback) {
  if ([value isKindOfClass:[NSString class]] == NO || value.length == 0) return fallback;
  NSString *text = [value stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  if ([text hasPrefix:@"#"]) {
    NSString *hex = [text substringFromIndex:1];
    if (hex.length == 3) {
      hex = [NSString stringWithFormat:@"%C%C%C%C%C%C",
             [hex characterAtIndex:0], [hex characterAtIndex:0],
             [hex characterAtIndex:1], [hex characterAtIndex:1],
             [hex characterAtIndex:2], [hex characterAtIndex:2]];
    }
    unsigned int rgb = 0;
    NSScanner *scanner = [NSScanner scannerWithString:hex];
    if ([scanner scanHexInt:&rgb]) {
      return [UIColor colorWithRed:((rgb >> 16) & 0xFF) / 255.0
                             green:((rgb >> 8) & 0xFF) / 255.0
                              blue:(rgb & 0xFF) / 255.0
                             alpha:1.0];
    }
  }
  NSString *lower = text.lowercaseString;
  if ([lower hasPrefix:@"rgb"]) {
    NSRange open = [text rangeOfString:@"("];
    NSRange close = [text rangeOfString:@")" options:NSBackwardsSearch];
    if (open.location != NSNotFound && close.location != NSNotFound && close.location > open.location) {
      NSString *inside = [text substringWithRange:NSMakeRange(open.location + 1, close.location - open.location - 1)];
      NSArray<NSString *> *parts = [inside componentsSeparatedByString:@","];
      if (parts.count >= 3) {
        CGFloat r = [[parts[0] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]] doubleValue] / 255.0;
        CGFloat g = [[parts[1] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]] doubleValue] / 255.0;
        CGFloat b = [[parts[2] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]] doubleValue] / 255.0;
        CGFloat a = parts.count >= 4 ? [[parts[3] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]] doubleValue] : 1.0;
        return [UIColor colorWithRed:r green:g blue:b alpha:a];
      }
    }
  }
  return fallback;
}

@interface LXLyricPipView : UIView
@property (nonatomic, copy) NSString *currentText;
@property (nonatomic, copy) NSString *nextText;
@property (nonatomic, strong) UIColor *playedColor;
@property (nonatomic, strong) UIColor *unplayedColor;
@property (nonatomic, assign) BOOL singleLine;
@property (nonatomic, assign) CGFloat fontBase;
@end

@implementation LXLyricPipView
- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    self.backgroundColor = UIColor.clearColor;
    self.opaque = NO;
    self.contentMode = UIViewContentModeRedraw;
    self.clipsToBounds = YES;
    _playedColor = UIColor.whiteColor;
    _unplayedColor = [UIColor colorWithWhite:0.78 alpha:1.0];
    _fontBase = 15.0;
  }
  return self;
}

- (void)setCurrentText:(NSString *)currentText {
  _currentText = [currentText copy];
  [self setNeedsDisplay];
}

- (void)setNextText:(NSString *)nextText {
  _nextText = [nextText copy];
  [self setNeedsDisplay];
}

- (void)drawRect:(CGRect)rect {
  CGContextRef ctx = UIGraphicsGetCurrentContext();
  if (ctx == NULL) return;
  CGFloat width = CGRectGetWidth(self.bounds);
  CGFloat height = CGRectGetHeight(self.bounds);
  if (width <= 1 || height <= 1) return;

  CGContextClearRect(ctx, CGRectMake(0, 0, width, height));
  CGFloat radius = self.singleLine ? MAX(2.0, height / 2.0 - 1.0) : 18.0;
  CGRect barRect = CGRectInset(CGRectMake(0, 0, width, height), 1, 1);
  UIBezierPath *path = [UIBezierPath bezierPathWithRoundedRect:barRect cornerRadius:radius];
  [[UIColor colorWithWhite:0.055 alpha:0.96] setFill];
  [path fill];
  [[UIColor colorWithWhite:1.0 alpha:0.16] setStroke];
  path.lineWidth = 1.0;
  [path stroke];

  NSMutableParagraphStyle *paragraph = [[NSMutableParagraphStyle alloc] init];
  paragraph.lineBreakMode = NSLineBreakByTruncatingTail;
  paragraph.alignment = NSTextAlignmentLeft;
  CGFloat currentSize = self.singleLine ? MAX(13.0, MIN(22.0, self.fontBase)) : MAX(12.0, MIN(22.0, self.fontBase));
  CGFloat nextSize = MAX(11.0, currentSize - 3.0);
  NSDictionary *currentAttributes = @{
    NSFontAttributeName: [UIFont systemFontOfSize:currentSize weight:UIFontWeightSemibold],
    NSForegroundColorAttributeName: self.playedColor,
    NSParagraphStyleAttributeName: paragraph,
  };
  NSDictionary *nextAttributes = @{
    NSFontAttributeName: [UIFont systemFontOfSize:nextSize weight:UIFontWeightRegular],
    NSForegroundColorAttributeName: self.unplayedColor,
    NSParagraphStyleAttributeName: paragraph,
  };

  NSString *current = self.currentText.length > 0 ? self.currentText : @" ";
  NSString *next = self.nextText.length > 0 ? self.nextText : @" ";
  CGFloat textWidth = MAX(20.0, width - 70.0);
  if (self.singleLine) {
    UIFont *font = [UIFont systemFontOfSize:currentSize weight:UIFontWeightSemibold];
    CGFloat textHeight = font.lineHeight + 2.0;
    CGFloat y = MAX(2.0, (height - textHeight) / 2.0);
    [current drawWithRect:CGRectMake(22.0, y, textWidth, textHeight)
                  options:NSStringDrawingUsesLineFragmentOrigin | NSStringDrawingTruncatesLastVisibleLine
               attributes:currentAttributes
                  context:nil];
  } else {
    [current drawWithRect:CGRectMake(22.0, 8.0, textWidth, nextSize + 5.0)
                  options:NSStringDrawingUsesLineFragmentOrigin | NSStringDrawingTruncatesLastVisibleLine
               attributes:currentAttributes
                  context:nil];
    [next drawWithRect:CGRectMake(22.0, 36.0, textWidth, nextSize + 5.0)
               options:NSStringDrawingUsesLineFragmentOrigin | NSStringDrawingTruncatesLastVisibleLine
            attributes:nextAttributes
               context:nil];
  }

  UIImage *note = [UIImage systemImageNamed:@"music.note"];
  if (note != nil) {
    note = [note imageWithTintColor:[UIColor colorWithWhite:1.0 alpha:0.9] renderingMode:UIImageRenderingModeAlwaysOriginal];
    [note drawInRect:CGRectMake(width - 38.0, (height - 16.0) / 2.0, 16.0, 16.0)];
  }
}
@end

API_AVAILABLE(ios(15.0))
@interface LXPipLyricModule : RCTEventEmitter <RCTBridgeModule, AVPictureInPictureControllerDelegate, AVPictureInPictureSampleBufferPlaybackDelegate>
@property (nonatomic, strong) AVPictureInPictureController *pipController;
@property (nonatomic, strong) AVPictureInPictureVideoCallViewController *pipViewController;
@property (nonatomic, strong) UIView *sourceView;
@property (nonatomic, strong) LXLyricPipView *lyricView;
@property (nonatomic, strong) NSTimer *tickTimer;
@property (nonatomic, strong) NSDictionary *lyricState;
@property (nonatomic, assign) BOOL configured;
@property (nonatomic, assign) BOOL playing;
@property (nonatomic, assign) double basePosition;
@property (nonatomic, assign) CFTimeInterval basePositionTime;
@property (nonatomic, assign) NSInteger lastLineIndex;
@property (nonatomic, assign) BOOL hasStartedEvent;
@end

@implementation LXPipLyricModule

RCT_EXPORT_MODULE(LXPipLyric)

+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

- (NSArray<NSString *> *)supportedEvents {
  return @[@"LXPipLyricStarted", @"LXPipLyricStopped", @"LXPipLyricFailed"];
}

- (instancetype)init {
  if (self = [super init]) {
    _lastLineIndex = -1;
    _basePosition = 0;
    _basePositionTime = CACurrentMediaTime();
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(handleAppBackground) name:UIApplicationDidEnterBackgroundNotification object:nil];
  }
  return self;
}

- (void)dealloc {
  [NSNotificationCenter.defaultCenter removeObserver:self];
}

- (void)handleAppBackground {
  if (@available(iOS 15.0, *)) {
    if (self.configured == NO || self.pipController == nil) return;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.35 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      if (self.pipController.isPictureInPictureActive) return;
      if (self.pipController.isPictureInPicturePossible) [self.pipController startPictureInPicture];
    });
  }
}

- (UIWindow *)keyWindow {
  UIApplication *app = UIApplication.sharedApplication;
  if (@available(iOS 13.0, *)) {
    for (UIScene *scene in app.connectedScenes) {
      if ([scene isKindOfClass:[UIWindowScene class]]) {
        UIWindowScene *windowScene = (UIWindowScene *)scene;
        for (UIWindow *window in windowScene.windows) {
          if (window.isKeyWindow) return window;
        }
        if (windowScene.windows.count > 0) return windowScene.windows.firstObject;
      }
    }
  }
  return app.windows.firstObject;
}

- (void)setupPipContentIfNeeded {
  UIWindow *window = [self keyWindow];
  if (window == nil) return;
  if (self.sourceView == nil) {
    self.sourceView = [[UIView alloc] initWithFrame:CGRectMake(0, MAX(0, window.bounds.size.height - 36.0), 160, 36)];
    self.sourceView.backgroundColor = UIColor.clearColor;
    self.sourceView.userInteractionEnabled = NO;
    [window.rootViewController.view addSubview:self.sourceView];
  }
  if (@available(iOS 15.0, *)) {
    if (self.pipViewController == nil) {
      AVPictureInPictureVideoCallViewController *controller = [[AVPictureInPictureVideoCallViewController alloc] init];
      controller.view.backgroundColor = UIColor.clearColor;
      controller.preferredContentSize = CGSizeMake(198.0, 68.0);
      LXLyricPipView *lyricView = [[LXLyricPipView alloc] initWithFrame:CGRectMake(0, 0, 198.0, 68.0)];
      lyricView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
      [controller.view addSubview:lyricView];
      self.pipViewController = controller;
      self.lyricView = lyricView;
    }
  }
}

- (NSArray<NSDictionary *> *)lines {
  id value = self.lyricState[@"lines"];
  return [value isKindOfClass:[NSArray class]] ? value : @[];
}

- (double)currentPosition {
  if (self.playing == NO) return self.basePosition;
  double position = self.basePosition + (CACurrentMediaTime() - self.basePositionTime);
  id offsetValue = self.lyricState[@"offset"];
  if ([offsetValue respondsToSelector:@selector(doubleValue)]) position += [offsetValue doubleValue];
  return MAX(0, position);
}

- (NSInteger)currentLineIndexForPosition:(double)position {
  NSArray<NSDictionary *> *lines = [self lines];
  if (lines.count == 0) return -1;
  NSInteger current = 0;
  for (NSInteger i = 0; i < lines.count; i++) {
    id timeValue = lines[i][@"time"];
    double time = [timeValue respondsToSelector:@selector(doubleValue)] ? [timeValue doubleValue] : 0;
    if (time <= position + 0.001) current = i;
    else break;
  }
  return current;
}

- (NSDictionary *)currentAndNextText {
  NSArray<NSDictionary *> *lines = [self lines];
  NSInteger index = [self currentLineIndexForPosition:[self currentPosition]];
  if (lines.count == 0 || index < 0) {
    return @{@"current": self.lyricState[@"currentText"] ?: @"", @"next": self.lyricState[@"nextText"] ?: @""};
  }
  NSDictionary *line = lines[index];
  NSString *current = line[@"text"] ?: @"";
  NSString *next = @"";
  if (index + 1 < lines.count) next = lines[index + 1][@"text"] ?: @"";
  if (current.length == 0 && index + 1 < lines.count) {
    current = next;
    next = index + 2 < lines.count ? (lines[index + 2][@"text"] ?: @"") : @"";
  }
  return @{@"current": current, @"next": next};
}

- (void)updatePipContent {
  if (self.lyricView == nil || self.lyricState == nil) return;
  BOOL singleLine = [self.lyricState[@"singleLine"] boolValue];
  NSNumber *widthValue = self.lyricState[@"width"];
  CGFloat widthPercent = widthValue != nil ? MAX(10.0, MIN(100.0, widthValue.doubleValue)) : 100.0;
  CGFloat width = (248.0 + (widthPercent / 100.0) * 148.0) * 0.5;
  CGFloat height = singleLine ? 36.0 : 68.0;
  if (self.pipViewController != nil) {
    self.pipViewController.preferredContentSize = CGSizeMake(width, height);
    self.lyricView.frame = CGRectMake(0, 0, width, height);
  }
  self.lyricView.singleLine = singleLine;
  NSNumber *fontValue = self.lyricState[@"fontSize"];
  CGFloat fontBase = fontValue != nil ? MAX(12.0, MIN(24.0, fontValue.doubleValue / 12.0)) : 15.0;
  self.lyricView.fontBase = fontBase;
  self.lyricView.playedColor = LXColorFromSetting(self.lyricState[@"playedColor"], UIColor.whiteColor);
  self.lyricView.unplayedColor = LXColorFromSetting(self.lyricState[@"unplayedColor"], [UIColor colorWithWhite:0.78 alpha:1.0]);
  NSDictionary *texts = [self currentAndNextText];
  self.lyricView.currentText = texts[@"current"];
  self.lyricView.nextText = texts[@"next"];
  [self.lyricView setNeedsDisplay];
}

- (void)configure:(NSDictionary *)state {
  self.lyricState = state;
  self.playing = [state[@"isPlaying"] boolValue];
  id positionValue = state[@"position"];
  self.basePosition = [positionValue respondsToSelector:@selector(doubleValue)] ? [positionValue doubleValue] : 0;
  self.basePositionTime = CACurrentMediaTime();
  self.lastLineIndex = -1;
  NSError *audioError = nil;
  AVAudioSession *audioSession = AVAudioSession.sharedInstance;
  [audioSession setCategory:AVAudioSessionCategoryPlayback
                         mode:AVAudioSessionModeMoviePlayback
                      options:AVAudioSessionCategoryOptionDuckOthers | AVAudioSessionCategoryOptionAllowBluetoothA2DP
                        error:&audioError];
  if (audioError == nil) [audioSession setActive:YES error:&audioError];
  [self setupPipContentIfNeeded];
  [self updatePipContent];

  if (self.configured) {
    [self ensureTickTimer];
    return;
  }
  if (@available(iOS 15.0, *)) {
    if ([AVPictureInPictureController isPictureInPictureSupported] == NO || self.sourceView == nil || self.pipViewController == nil) {
      [self sendEventWithName:@"LXPipLyricFailed" body:@{@"message": @"当前设备不支持系统画中画"}];
      return;
    }
    AVPictureInPictureControllerContentSource *source =
      [[AVPictureInPictureControllerContentSource alloc] initWithActiveVideoCallSourceView:self.sourceView contentViewController:self.pipViewController];
    AVPictureInPictureController *controller = [[AVPictureInPictureController alloc] initWithContentSource:source];
    controller.delegate = self;
    controller.canStartPictureInPictureAutomaticallyFromInline = YES;
    self.pipController = controller;
    self.configured = YES;
    [self ensureTickTimer];
  }
}

- (void)ensureTickTimer {
  if (self.tickTimer != nil) return;
  self.tickTimer = [NSTimer scheduledTimerWithTimeInterval:0.35 target:self selector:@selector(tick) userInfo:nil repeats:YES];
  [[NSRunLoop mainRunLoop] addTimer:self.tickTimer forMode:NSRunLoopCommonModes];
}

- (void)stopTickTimer {
  [self.tickTimer invalidate];
  self.tickTimer = nil;
}

- (void)tick {
  if (self.lyricState == nil || self.playing == NO) return;
  NSInteger index = [self currentLineIndexForPosition:[self currentPosition]];
  if (index != self.lastLineIndex) {
    self.lastLineIndex = index;
    [self updatePipContent];
  }
}

RCT_REMAP_METHOD(configure, configureWithState:(NSDictionary *)state resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (@available(iOS 15.0, *)) {
    [self configure:state];
    resolve(@{@"supported": @(self.pipController != nil)});
  } else {
    reject(@"unsupported", @"系统画中画需要 iOS 15 或更高版本", nil);
  }
}

RCT_REMAP_METHOD(update, updateWithState:(NSDictionary *)state resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (state == nil) {
    resolve(nil);
    return;
  }
  self.lyricState = state;
  self.playing = [state[@"isPlaying"] boolValue];
  id positionValue = state[@"position"];
  self.basePosition = [positionValue respondsToSelector:@selector(doubleValue)] ? [positionValue doubleValue] : 0;
  self.basePositionTime = CACurrentMediaTime();
  self.lastLineIndex = -1;
  if (self.configured) [self updatePipContent];
  resolve(nil);
}

RCT_REMAP_METHOD(start, startWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (@available(iOS 15.0, *)) {
    if (self.pipController == nil) {
      reject(@"not_configured", @"画中画歌词尚未初始化", nil);
      return;
    }
    [self updatePipContent];
    if (self.pipController.isPictureInPictureActive) {
      resolve(@YES);
      return;
    }
    if (self.pipController.isPictureInPicturePossible == NO) {
      resolve(@NO);
      return;
    }
    [self.pipController startPictureInPicture];
    resolve(@YES);
  } else {
    reject(@"unsupported", @"系统画中画需要 iOS 15 或更高版本", nil);
  }
}

RCT_REMAP_METHOD(stop, stopWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (@available(iOS 15.0, *)) {
    if (self.pipController.isPictureInPictureActive) [self.pipController stopPictureInPicture];
  }
  resolve(nil);
}

RCT_REMAP_METHOD(teardown, teardownWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [self stopTickTimer];
  if (@available(iOS 15.0, *)) {
    if (self.pipController.isPictureInPictureActive) [self.pipController stopPictureInPicture];
    self.pipController.delegate = nil;
  }
  self.pipController = nil;
  self.pipViewController = nil;
  self.lyricView = nil;
  [self.sourceView removeFromSuperview];
  self.sourceView = nil;
  self.configured = NO;
  self.lyricState = nil;
  resolve(nil);
}

#pragma mark - AVPictureInPictureControllerDelegate

- (void)pictureInPictureControllerDidStartPictureInPicture:(AVPictureInPictureController *)pictureInPictureController {
  [self updatePipContent];
  [self sendEventWithName:@"LXPipLyricStarted" body:@{}];
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.25 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    [self updatePipContent];
  });
}

- (void)pictureInPictureControllerDidStopPictureInPicture:(AVPictureInPictureController *)pictureInPictureController {
  [self sendEventWithName:@"LXPipLyricStopped" body:@{}];
}

- (void)pictureInPictureController:(AVPictureInPictureController *)pictureInPictureController failedToStartPictureInPictureWithError:(NSError *)error {
  [self sendEventWithName:@"LXPipLyricFailed" body:@{@"message": error.localizedDescription ?: @"画中画启动失败"}];
}

- (void)pictureInPictureController:(AVPictureInPictureController *)pictureInPictureController restoreUserInterfaceForPictureInPictureStopWithCompletionHandler:(void (^)(BOOL restoredUserInterface))completionHandler {
  if (completionHandler != NULL) completionHandler(YES);
}

#pragma mark - AVPictureInPictureSampleBufferPlaybackDelegate

- (void)pictureInPictureController:(AVPictureInPictureController *)pictureInPictureController setPlaying:(BOOL)playing {
  self.basePosition = [self currentPosition];
  self.basePositionTime = CACurrentMediaTime();
  self.playing = playing;
  [self updatePipContent];
}

- (void)pictureInPictureController:(AVPictureInPictureController *)pictureInPictureController skipByInterval:(CMTime)skipInterval completionHandler:(void (^)(void))completionHandler {
  if (completionHandler) completionHandler();
}

- (CMTimeRange)pictureInPictureControllerTimeRangeForPlayback:(AVPictureInPictureController *)pictureInPictureController {
  return CMTimeRangeMake(kCMTimeZero, kCMTimePositiveInfinity);
}

- (void)pictureInPictureController:(AVPictureInPictureController *)pictureInPictureController didTransitionToRenderSize:(CMVideoDimensions)newRenderSize {
  [self updatePipContent];
}

- (BOOL)pictureInPictureControllerIsPlaybackPaused:(AVPictureInPictureController *)pictureInPictureController {
  return self.playing == NO;
}

@end

#pragma mark - 后台播放保活

@interface LXBackgroundAudioModule : NSObject <RCTBridgeModule>
@property (nonatomic, assign) BOOL shouldPlay;
@property (nonatomic, strong) NSTimer *keepAliveTimer;
@end

static LXBackgroundAudioModule *LXSharedBackgroundAudio = nil;

@implementation LXBackgroundAudioModule

RCT_EXPORT_MODULE(LXBackgroundAudio)

+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

- (instancetype)init {
  if (self = [super init]) {
    LXSharedBackgroundAudio = self;
    NSNotificationCenter *center = NSNotificationCenter.defaultCenter;
    [center addObserver:self selector:@selector(handleBackground) name:UIApplicationDidEnterBackgroundNotification object:nil];
    [center addObserver:self selector:@selector(handleBackground) name:UIApplicationWillResignActiveNotification object:nil];
  }
  return self;
}

- (void)dealloc {
  [NSNotificationCenter.defaultCenter removeObserver:self];
  [self.keepAliveTimer invalidate];
}

- (void)handleBackground {
  if (self.shouldPlay == NO) return;
  [self activatePlaybackSession];
  if (@available(iOS 13.0, *)) {
    MPNowPlayingInfoCenter.defaultCenter.playbackState = MPNowPlayingPlaybackStatePlaying;
  }
}

- (void)activatePlaybackSession {
  NSError *error = nil;
  AVAudioSession *session = AVAudioSession.sharedInstance;
  [session setCategory:AVAudioSessionCategoryPlayback
                   mode:AVAudioSessionModeDefault
                options:AVAudioSessionCategoryOptionDuckOthers | AVAudioSessionCategoryOptionAllowBluetoothA2DP
                  error:&error];
  if (error != nil) NSLog(@"[LXBackgroundAudio] setCategory error: %@", error.localizedDescription);
  error = nil;
  [session setActive:YES error:&error];
  if (error != nil) NSLog(@"[LXBackgroundAudio] setActive error: %@", error.localizedDescription);
}

RCT_EXPORT_METHOD(setPlaying:(BOOL)playing) {
  self.shouldPlay = playing;
  if (@available(iOS 13.0, *)) {
    MPNowPlayingInfoCenter.defaultCenter.playbackState = playing ? MPNowPlayingPlaybackStatePlaying : MPNowPlayingPlaybackStatePaused;
  }
  if (playing) {
    [self activatePlaybackSession];
    if (self.keepAliveTimer == nil) {
      self.keepAliveTimer = [NSTimer scheduledTimerWithTimeInterval:8.0 target:self selector:@selector(handleKeepAlive) userInfo:nil repeats:YES];
      [[NSRunLoop mainRunLoop] addTimer:self.keepAliveTimer forMode:NSRunLoopCommonModes];
    }
  } else {
    [self.keepAliveTimer invalidate];
    self.keepAliveTimer = nil;
  }
}

- (void)handleKeepAlive {
  if (self.shouldPlay == NO) return;
  [self activatePlaybackSession];
  if (@available(iOS 13.0, *)) {
    MPNowPlayingInfoCenter.defaultCenter.playbackState = MPNowPlayingPlaybackStatePlaying;
  }
}

RCT_EXPORT_METHOD(refresh) {
  if (self.shouldPlay) [self activatePlaybackSession];
}

@end
