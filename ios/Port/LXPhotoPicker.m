#import <PhotosUI/PhotosUI.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>

@interface LXPhotoPicker : NSObject <RCTBridgeModule, PHPickerViewControllerDelegate>
@property (nonatomic, copy) RCTPromiseResolveBlock resolver;
@property (nonatomic, copy) RCTPromiseRejectBlock rejecter;
@end

@implementation LXPhotoPicker

RCT_EXPORT_MODULE(LXPhotoPicker)

+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

- (void)finishWithPath:(NSString *)path error:(NSError *)error {
  RCTPromiseResolveBlock resolve = self.resolver;
  RCTPromiseRejectBlock reject = self.rejecter;
  self.resolver = nil;
  self.rejecter = nil;
  if (error != nil) {
    if (reject != nil) reject(@"photo_picker_error", error.localizedDescription ?: @"无法读取照片", error);
    return;
  }
  if (resolve != nil) resolve(path);
}

RCT_EXPORT_METHOD(pickImage:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (self.resolver != nil) {
    reject(@"picker_busy", @"照片选择器已经打开", nil);
    return;
  }
  UIViewController *presenter = RCTPresentedViewController();
  if (presenter == nil) {
    reject(@"picker_no_presenter", @"当前没有可用的页面", nil);
    return;
  }
  PHPickerConfiguration *configuration = [[PHPickerConfiguration alloc] init];
  configuration.filter = [PHPickerFilter imagesFilter];
  configuration.selectionLimit = 1;
  configuration.preferredAssetRepresentationMode = PHPickerConfigurationAssetRepresentationModeCurrent;
  PHPickerViewController *picker = [[PHPickerViewController alloc] initWithConfiguration:configuration];
  picker.delegate = self;
  self.resolver = resolve;
  self.rejecter = reject;
  [presenter presentViewController:picker animated:YES completion:nil];
}

- (void)picker:(PHPickerViewController *)picker didFinishPicking:(NSArray<PHPickerResult *> *)results {
  [picker dismissViewControllerAnimated:YES completion:nil];
  if (results.count == 0) {
    [self finishWithPath:nil error:nil];
    return;
  }
  NSItemProvider *provider = results.firstObject.itemProvider;
  if (![provider hasItemConformingToTypeIdentifier:UTTypeImage.identifier]) {
    [self finishWithPath:nil error:[NSError errorWithDomain:@"LXPhotoPicker" code:1 userInfo:@{NSLocalizedDescriptionKey: @"所选项目不是图片"}]];
    return;
  }
  __weak typeof(self) weakSelf = self;
  [provider loadFileRepresentationForTypeIdentifier:UTTypeImage.identifier completionHandler:^(NSURL *url, NSError *error) {
    if (error != nil || url == nil) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [weakSelf finishWithPath:nil error:error ?: [NSError errorWithDomain:@"LXPhotoPicker" code:2 userInfo:@{NSLocalizedDescriptionKey: @"无法读取照片"}]];
      });
      return;
    }
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
      @autoreleasepool {
        NSData *data = [NSData dataWithContentsOfURL:url options:0 error:nil];
        UIImage *image = data != nil ? [UIImage imageWithData:data] : nil;
        if (image == nil) {
          dispatch_async(dispatch_get_main_queue(), ^{
            [weakSelf finishWithPath:nil error:[NSError errorWithDomain:@"LXPhotoPicker" code:3 userInfo:@{NSLocalizedDescriptionKey: @"图片解码失败"}]];
          });
          return;
        }
        // 统一转成 JPEG，避免 HEIC/WebP 在跨版本 Image 组件上的兼容问题。
        NSData *jpeg = UIImageJPEGRepresentation(image, 0.92);
        NSString *name = [NSString stringWithFormat:@"kmusic-photo-%@.jpg", [[NSUUID UUID] UUIDString]];
        NSString *path = [NSTemporaryDirectory() stringByAppendingPathComponent:name];
        NSError *writeError = nil;
        if (jpeg == nil || ![jpeg writeToFile:path options:NSDataWritingAtomic error:&writeError]) {
          dispatch_async(dispatch_get_main_queue(), ^{
            [weakSelf finishWithPath:nil error:writeError ?: [NSError errorWithDomain:@"LXPhotoPicker" code:4 userInfo:@{NSLocalizedDescriptionKey: @"无法保存照片"}]];
          });
          return;
        }
        dispatch_async(dispatch_get_main_queue(), ^{
          [weakSelf finishWithPath:path error:nil];
        });
      }
    });
  }];
}

@end
