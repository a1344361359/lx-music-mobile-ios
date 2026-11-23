import { NativeModules, Platform } from 'react-native'

export interface NowPlayingInfo {
  title?: string
  artist?: string
  album?: string
  artwork?: string
  duration?: number
  elapsedTime?: number
  playbackRate?: number
  isPlaying?: boolean
}

/**
 * iOS 系统“正在播放”卡片/锁屏播放器信息。
 * react-native-track-player 的标题更新不会稳定刷新 iOS 26 的播放状态和进度，
 * 这里直接写 MPNowPlayingInfoCenter，确保卡片显示当前歌曲、进度和拖动条。
 */
export const updateNowPlaying = async(info: NowPlayingInfo): Promise<void> => {
  if (Platform.OS !== 'ios') return
  const module = NativeModules.LXNowPlaying
  if (!module?.update) return
  await module.update(info)
}
