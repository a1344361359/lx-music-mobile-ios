import { NativeModules, Platform } from 'react-native'

/**
 * iOS 系统照片选择器（PHPicker）。返回 App 临时目录中的 JPEG 路径。
 * 不请求相册权限：PHPicker 由系统托管，用户只授权选中的照片。
 */
export const pickPhoto = async(): Promise<string | null> => {
  if (Platform.OS !== 'ios') return null
  const module = NativeModules.LXPhotoPicker
  if (!module?.pickImage) return null
  const path = await module.pickImage() as string | null
  return path ?? null
}
