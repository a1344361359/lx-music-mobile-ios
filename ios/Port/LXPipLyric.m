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

@interface LXSampleBufferView : UIView
@end

@implementation LXSampleBufferView
+ (Class)layerClass {
  return [AVSampleBufferDisplayLayer class];
}
@end

API_AVAILABLE(ios(15.0))
@interface LXPipLyricModule : RCTEventEmitter <RCTBridgeModule, AVPictureInPictureControllerDelegate, AVPictureInPictureSampleBufferPlaybackDelegate>
@property (nonatomic, strong) AVPictureInPictureController *pipController;
@property (nonatomic, strong) AVSampleBufferDisplayLayer *displayLayer;
@property (nonatomic, strong) UIView *displayView;
@property (nonatomic, strong) NSTimer *tickTimer;
@property (nonatomic, strong) NSDictionary *lyricState;
@property (nonatomic, assign) BOOL configured;
@property (nonatomic, assign) BOOL playing;
@property (nonatomic, assign) double basePosition;
@property (nonatomic, assign) CFTimeInterval basePositionTime;
@property (nonatomic, assign) NSInteger lastLineIndex;
@property (nonatomic, assign) CFTimeInterval lastRenderTime;
@property (nonatomic, assign) CFTimeInterval lastPositionSyncTime;
@property (nonatomic, assign) BOOL positionRequestInFlight;
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
    _lastRenderTime = 0;
    _lastPositionSyncTime = 0;
    _positionRequestInFlight = NO;
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

- (void)attachDisplayViewIfNeeded {
  if (self.displayView != nil) return;
  UIWindow *window = [self keyWindow];
  if (window == nil) return;
  LXSampleBufferView *view = [[LXSampleBufferView alloc] initWithFrame:CGRectMake(0, window.bounds.size.height - 36.0, 160, 36)];
  view.alpha = 1.0;
  view.userInteractionEnabled = NO;
  view.clipsToBounds = YES;
  view.layer.masksToBounds = YES;
  view.backgroundColor = UIColor.clearColor;
  self.displayView = view;
  self.displayLayer = (AVSampleBufferDisplayLayer *)view.layer;
  // 让歌词画面铺满整个系统画中画窗口，避免上下或左右出现黑色留边。
  self.displayLayer.videoGravity = AVLayerVideoGravityResizeAspectFill;
  self.displayLayer.opaque = NO;
  self.displayLayer.backgroundColor = UIColor.clearColor.CGColor;
  CMTimebaseRef timebase = NULL;
  CMTimebaseCreateWithMasterClock(kCFAllocatorDefault, CMClockGetHostTimeClock(), &timebase);
  if (timebase != NULL) {
    CMTimebaseSetTime(timebase, kCMTimeZero);
    CMTimebaseSetRate(timebase, 1.0);
    self.displayLayer.controlTimebase = timebase;
    CFRelease(timebase);
  }
  // 放在最底层，不遮挡正常界面，但保留在窗口层级中供系统画中画取源。
  [window.rootViewController.view insertSubview:view atIndex:0];
}

// 直接向原生 TrackPlayer 查询真实播放位置；JS 在后台会被挂起，不能再依赖每秒上报。
- (void)refreshPlayerPosition {
  if (self.positionRequestInFlight || self.playing == NO) return;
  id module = [self.bridge moduleForName:@"TrackPlayerModule"];
  SEL selector = NSSelectorFromString(@"getPosition:rejecter:");
  if (module == nil || ![module respondsToSelector:selector]) return;
  NSMethodSignature *signature = [module methodSignatureForSelector:selector];
  if (signature == nil) return;
  self.positionRequestInFlight = YES;
  __weak typeof(self) weakSelf = self;
  RCTPromiseResolveBlock resolve = ^(id result) {
    dispatch_async(dispatch_get_main_queue(), ^{
      typeof(self) self = weakSelf;
      if (self == nil) return;
      self.positionRequestInFlight = NO;
      if (![result respondsToSelector:@selector(doubleValue)]) return;
      double actual = [result doubleValue];
      double elapsed = self.playing ? CACurrentMediaTime() - self.basePositionTime : 0;
      double currentRaw = self.basePosition + MAX(0, elapsed);
      // 只有和当前歌词时钟差得明显时才校正，避免把延迟回调当成拖动。
      if (fabs(actual - currentRaw) > 0.25) {
        self.basePosition = MAX(0, actual);
        self.basePositionTime = CACurrentMediaTime();
        self.lastLineIndex = -1;
        [self renderCurrentFrame];
      }
    });
  };
  RCTPromiseRejectBlock reject = ^(NSString *code, NSString *message, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      typeof(self) self = weakSelf;
      if (self != nil) self.positionRequestInFlight = NO;
    });
  };
  NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:signature];
  invocation.target = module;
  invocation.selector = selector;
  [invocation setArgument:&resolve atIndex:2];
  [invocation setArgument:&reject atIndex:3];
  @try {
    [invocation invoke];
  } @catch (NSException *exception) {
    self.positionRequestInFlight = NO;
  }
}

- (NSArray<NSDictionary *> *)lines {
  id value = self.lyricState[@"lines"];
  return [value isKindOfClass:[NSArray class]] ? value : @[];
}

- (double)currentPosition {
  double position = self.playing
    ? self.basePosition + MAX(0, CACurrentMediaTime() - self.basePositionTime)
    : self.basePosition;
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

- (void)configure:(NSDictionary *)state {
  self.lyricState = state;
  self.playing = [state[@"isPlaying"] boolValue];
  id positionValue = state[@"position"];
  self.basePosition = [positionValue respondsToSelector:@selector(doubleValue)] ? [positionValue doubleValue] : 0;
  self.basePositionTime = CACurrentMediaTime();
  self.lastLineIndex = -1;
  // 系统画中画需要处于播放类音频会话，否则可能无法拉起。
  NSError *audioError = nil;
  AVAudioSession *audioSession = AVAudioSession.sharedInstance;
  [audioSession setCategory:AVAudioSessionCategoryPlayback
                         mode:AVAudioSessionModeMoviePlayback
                      options:AVAudioSessionCategoryOptionDuckOthers | AVAudioSessionCategoryOptionAllowBluetoothA2DP
                        error:&audioError];
  if (audioError == nil) [audioSession setActive:YES error:&audioError];
  [self attachDisplayViewIfNeeded];
  [self renderCurrentFrame];

  if (self.configured) {
    [self ensureTickTimer];
    return;
  }
  if (@available(iOS 15.0, *)) {
    if ([AVPictureInPictureController isPictureInPictureSupported] == NO || self.displayLayer == nil) {
      [self sendEventWithName:@"LXPipLyricFailed" body:@{@"message": @"当前设备不支持系统画中画"}];
      return;
    }
    AVPictureInPictureControllerContentSource *source =
      [[AVPictureInPictureControllerContentSource alloc] initWithSampleBufferDisplayLayer:self.displayLayer playbackDelegate:self];
    AVPictureInPictureController *controller = [[AVPictureInPictureController alloc] initWithContentSource:source];
    controller.delegate = self;
    controller.canStartPictureInPictureAutomaticallyFromInline = YES;
    controller.requiresLinearPlayback = YES;
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
  CFTimeInterval now = CACurrentMediaTime();
  BOOL pipActive = self.pipController.isPictureInPictureActive;
  if (now - self.lastPositionSyncTime >= 2.0) {
    self.lastPositionSyncTime = now;
    [self refreshPlayerPosition];
  }
  // 画中画常驻时持续喂帧，避免最后一帧播放完导致窗口停住或歌词冻结。
  if (index != self.lastLineIndex || (pipActive && now - self.lastRenderTime >= 1.0)) {
    self.lastLineIndex = index;
    [self renderCurrentFrame];
  }
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

- (void)renderCurrentFrame {
  if (self.displayLayer == nil || self.lyricState == nil) return;
  BOOL singleLine = [self.lyricState[@"singleLine"] boolValue];
  NSNumber *widthValue = self.lyricState[@"pipWidth"];
  NSNumber *heightValue = self.lyricState[@"pipHeight"];
  CGFloat width = widthValue != nil ? MAX(220.0, MIN(500.0, widthValue.doubleValue)) : 380.0;
  CGFloat height = heightValue != nil ? MAX(40.0, MIN(200.0, heightValue.doubleValue)) : 58.0;
  if (heightValue == nil && !singleLine) height = 92.0;
  if (!singleLine) height = MAX(height, 72.0);
  CGFloat cornerRadius = singleLine ? height / 2.0 : 24.0;
  // 系统画中画取的是 displayLayer 的画面，图层本身也要裁圆角，
  // 否则即便绘制内容有圆角，窗口四角仍会被玻璃底色填成直角。
  self.displayLayer.cornerRadius = cornerRadius;
  self.displayLayer.masksToBounds = YES;
  self.displayView.layer.cornerRadius = cornerRadius;
  self.displayView.layer.masksToBounds = YES;
  CGSize pointSize = CGSizeMake(width, height);
  if (self.displayView.superview != nil) {
    CGFloat superHeight = self.displayView.superview.bounds.size.height;
    self.displayView.frame = CGRectMake(0, MAX(0, superHeight - height), pointSize.width, pointSize.height);
  }

  UIColor *playedColor = LXColorFromSetting(self.lyricState[@"playedColor"], UIColor.whiteColor);
  UIColor *unplayedColor = LXColorFromSetting(self.lyricState[@"unplayedColor"], [UIColor colorWithWhite:0.78 alpha:1.0]);
  NSDictionary *texts = [self currentAndNextText];
  NSString *currentText = texts[@"current"];
  NSString *nextText = texts[@"next"];
  NSNumber *fontValue = self.lyricState[@"fontSize"];
  CGFloat fontBase = fontValue != nil ? MAX(12.0, MIN(24.0, fontValue.doubleValue / 12.0)) : 15.0;
  if (singleLine) fontBase = MAX(14.0, MIN(23.0, fontBase + 1.0));

  NSNumber *opacityValue = self.lyricState[@"pipOpacity"];
  CGFloat pipOpacity = opacityValue != nil ? MAX(0, MIN(100, opacityValue.doubleValue)) / 100.0 : 0.55;
  UIColor *glassColor = LXColorFromSetting(self.lyricState[@"glassColor"], [UIColor colorWithRed:184.0 / 255.0 green:174.0 / 255.0 blue:201.0 / 255.0 alpha:1.0]);
  // 0% 最实（接近不透明），100% 最透。
  CGFloat glassAlpha = 0.95 - pipOpacity * 0.80;

  UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
  format.scale = 3.0;
  format.opaque = NO;
  UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:pointSize format:format];
  UIImage *image = [renderer imageWithActions:^(UIGraphicsImageRendererContext *context) {
    CGContextRef ctx = context.CGContext;
    [[UIColor clearColor] setFill];
    CGContextFillRect(ctx, CGRectMake(0, 0, pointSize.width, pointSize.height));

    // 整块玻璃按圆角路径铺满，四角保持透明，系统画中画窗口才不会露出直角底色。
    UIBezierPath *glassPath = [UIBezierPath bezierPathWithRoundedRect:CGRectMake(0, 0, pointSize.width, pointSize.height) cornerRadius:cornerRadius];
    CGContextSetFillColorWithColor(ctx, [glassColor colorWithAlphaComponent:glassAlpha].CGColor);
    CGContextAddPath(ctx, glassPath.CGPath);
    CGContextFillPath(ctx);
    // 采样缓冲尚未上屏时，图层底色也用同一玻璃色兜底，避免启动/切换瞬间闪黑边。
    self.displayLayer.backgroundColor = [glassColor colorWithAlphaComponent:glassAlpha].CGColor;
    self.displayView.backgroundColor = UIColor.clearColor;
    // 内部圆角描边保留液态玻璃的层次，但不再裁掉四角。
    CGRect innerRect = CGRectInset(CGRectMake(0, 0, pointSize.width, pointSize.height), 1, 1);
    UIBezierPath *innerPath = [UIBezierPath bezierPathWithRoundedRect:innerRect cornerRadius:MAX(2.0, cornerRadius - 1.0)];
    [[UIColor colorWithWhite:1.0 alpha:0.20] setStroke];
    innerPath.lineWidth = 0.7;
    [innerPath stroke];

    NSMutableParagraphStyle *paragraph = [[NSMutableParagraphStyle alloc] init];
    paragraph.lineBreakMode = NSLineBreakByTruncatingTail;
    paragraph.alignment = NSTextAlignmentLeft;
    NSDictionary *currentAttributes = @{
      NSFontAttributeName: [UIFont systemFontOfSize:fontBase weight:UIFontWeightSemibold],
      NSForegroundColorAttributeName: playedColor,
      NSParagraphStyleAttributeName: paragraph,
    };
    NSDictionary *nextAttributes = @{
      NSFontAttributeName: [UIFont systemFontOfSize:MAX(12.0, fontBase - 3.0) weight:UIFontWeightRegular],
      NSForegroundColorAttributeName: unplayedColor,
      NSParagraphStyleAttributeName: paragraph,
    };

    // 左右留出系统关闭/画中画按钮的位置，避免文字被按钮盖住。
    CGFloat textWidth = pointSize.width - 118.0;
    if (singleLine) {
      CGSize textSize = [currentText sizeWithAttributes:currentAttributes];
      CGFloat y = MAX(5.0, (height - textSize.height) / 2.0 - 1.0);
      [currentText drawInRect:CGRectMake(54.0, y, textWidth, height - 10.0) withAttributes:currentAttributes];
    } else {
      [currentText drawInRect:CGRectMake(54.0, 14.0, textWidth, fontBase + 5.0) withAttributes:currentAttributes];
      [nextText drawInRect:CGRectMake(54.0, height / 2.0 + 3.0, textWidth, fontBase + 2.0) withAttributes:nextAttributes];
    }

    UIImage *note = [UIImage systemImageNamed:@"music.note"];
    if (note != nil) {
      note = [note imageWithTintColor:[UIColor colorWithWhite:1.0 alpha:0.9] renderingMode:UIImageRenderingModeAlwaysOriginal];
      [note drawInRect:CGRectMake(pointSize.width - 73.0, (pointSize.height - 18.0) / 2.0, 18.0, 18.0)];
    }
  }];

  CVPixelBufferRef pixelBuffer = NULL;
  NSDictionary *options = @{(id)kCVPixelBufferIOSurfacePropertiesKey: @{},
                            (id)kCVPixelBufferCGImageCompatibilityKey: @YES,
                            (id)kCVPixelBufferCGBitmapContextCompatibilityKey: @YES};
  CVReturn status = CVPixelBufferCreate(kCFAllocatorDefault,
                                        (size_t)(pointSize.width * 3.0),
                                        (size_t)(pointSize.height * 3.0),
                                        kCVPixelFormatType_32BGRA,
                                        (__bridge CFDictionaryRef)options,
                                        &pixelBuffer);
  if (status != kCVReturnSuccess || pixelBuffer == NULL) return;

  CVPixelBufferLockBaseAddress(pixelBuffer, 0);
  void *baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer);
  size_t bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer);
  CGContextRef bitmapContext = CGBitmapContextCreate(baseAddress,
                                                     CVPixelBufferGetWidth(pixelBuffer),
                                                     CVPixelBufferGetHeight(pixelBuffer),
                                                     8,
                                                     bytesPerRow,
                                                     CGColorSpaceCreateDeviceRGB(),
                                                     kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Little);
  if (bitmapContext != NULL) {
    CGContextDrawImage(bitmapContext, CGRectMake(0, 0, CVPixelBufferGetWidth(pixelBuffer), CVPixelBufferGetHeight(pixelBuffer)), image.CGImage);
    CGContextRelease(bitmapContext);
  }
  CVPixelBufferUnlockBaseAddress(pixelBuffer, 0);

  CMVideoFormatDescriptionRef formatDescription = NULL;
  CMVideoFormatDescriptionCreateForImageBuffer(kCFAllocatorDefault, pixelBuffer, &formatDescription);
  if (formatDescription == NULL) {
    CVPixelBufferRelease(pixelBuffer);
    return;
  }
  CMTime presentationTime = self.displayLayer.controlTimebase != NULL ? CMTimebaseGetTime(self.displayLayer.controlTimebase) : kCMTimeZero;
  // 每帧给 2 秒时长；画中画常驻期间每秒补一帧，防止最后一帧播完停住。
  CMSampleTimingInfo timing = {CMTimeMake(2, 1), presentationTime, kCMTimeInvalid};
  CMSampleBufferRef sampleBuffer = NULL;
  CMSampleBufferCreateForImageBuffer(kCFAllocatorDefault, pixelBuffer, true, NULL, NULL, formatDescription, &timing, &sampleBuffer);
  if (sampleBuffer != NULL) {
    CFArrayRef attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, true);
    if (attachments != NULL && CFArrayGetCount(attachments) > 0) {
      CFMutableDictionaryRef dictionary = (CFMutableDictionaryRef)CFArrayGetValueAtIndex(attachments, 0);
      CFDictionarySetValue(dictionary, kCMSampleAttachmentKey_DisplayImmediately, kCFBooleanTrue);
    }
    if (self.displayLayer.status == AVQueuedSampleBufferRenderingStatusFailed) {
      [self.displayLayer flush];
    }
    [self.displayLayer enqueueSampleBuffer:sampleBuffer];
    CFRelease(sampleBuffer);
  }
  if (formatDescription != NULL) CFRelease(formatDescription);
  CVPixelBufferRelease(pixelBuffer);
  self.lastRenderTime = CACurrentMediaTime();
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
  double previousPosition = self.basePosition + (self.playing ? MAX(0, CACurrentMediaTime() - self.basePositionTime) : 0);
  BOOL wasPlaying = self.playing;
  self.lyricState = state;
  BOOL nextPlaying = [state[@"isPlaying"] boolValue];
  id positionValue = state[@"position"];
  double nextPosition = [positionValue respondsToSelector:@selector(doubleValue)] ? [positionValue doubleValue] : 0;
  // JS 在后台可能延迟上报，不能每秒都把原生时钟拉回旧位置。
  // 小偏差继续使用本地连续时钟；只有拖动/暂停/切歌这类大跳变才重新对齐。
  if (!(wasPlaying && nextPlaying && fabs(nextPosition - previousPosition) < 1.2)) {
    self.basePosition = nextPosition;
    self.basePositionTime = CACurrentMediaTime();
  }
  self.playing = nextPlaying;
  self.lastLineIndex = -1;
  if (self.configured) [self renderCurrentFrame];
  resolve(nil);
}

RCT_REMAP_METHOD(start, startWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (@available(iOS 15.0, *)) {
    if (self.pipController == nil) {
      reject(@"not_configured", @"画中画歌词尚未初始化", nil);
      return;
    }
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
  [self.displayView removeFromSuperview];
  self.displayView = nil;
  self.displayLayer = nil;
  self.configured = NO;
  self.lyricState = nil;
  resolve(nil);
}

#pragma mark - AVPictureInPictureControllerDelegate

- (void)pictureInPictureControllerDidStartPictureInPicture:(AVPictureInPictureController *)pictureInPictureController {
  [self renderCurrentFrame];
  [self sendEventWithName:@"LXPipLyricStarted" body:@{}];
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.25 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    [self renderCurrentFrame];
  });
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.9 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    [self renderCurrentFrame];
  });
}

- (void)pictureInPictureControllerDidStopPictureInPicture:(AVPictureInPictureController *)pictureInPictureController {
  [self sendEventWithName:@"LXPipLyricStopped" body:@{}];
}

- (void)pictureInPictureController:(AVPictureInPictureController *)pictureInPictureController failedToStartPictureInPictureWithError:(NSError *)error {
  [self sendEventWithName:@"LXPipLyricFailed" body:@{@"message": error.localizedDescription ?: @"画中画启动失败"}];
}

#pragma mark - AVPictureInPictureSampleBufferPlaybackDelegate

- (void)pictureInPictureController:(AVPictureInPictureController *)pictureInPictureController setPlaying:(BOOL)playing {
  self.playing = playing;
  self.basePosition = [self currentPosition];
  self.basePositionTime = CACurrentMediaTime();
}

- (void)pictureInPictureController:(AVPictureInPictureController *)pictureInPictureController skipByInterval:(CMTime)skipInterval completionHandler:(void (^)(void))completionHandler {
  if (completionHandler) completionHandler();
}

- (CMTimeRange)pictureInPictureControllerTimeRangeForPlayback:(AVPictureInPictureController *)pictureInPictureController {
  return CMTimeRangeMake(kCMTimeZero, kCMTimePositiveInfinity);
}

- (void)pictureInPictureController:(AVPictureInPictureController *)pictureInPictureController didTransitionToRenderSize:(CMVideoDimensions)newRenderSize {
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
