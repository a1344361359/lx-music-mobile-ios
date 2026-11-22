#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LXLiveActivity, NSObject)

RCT_EXTERN_METHOD(isSupported:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(start:(NSDictionary *)payload)
RCT_EXTERN_METHOD(update:(NSDictionary *)payload)
RCT_EXTERN_METHOD(end)

@end
