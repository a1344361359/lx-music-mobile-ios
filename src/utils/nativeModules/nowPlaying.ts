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
  const trackPlayer = NativeModules.TrackPlayerModule
  if (trackPlayer?.updateNowPlayingMetadata) {
    // 部分安装包/系统版本下 LXNowPlaying 模块可能没有注册成功。
    // 同时走 TrackPlayer 自己的 Now Playing 控制器做兜底，确保标题和
    // 进度至少有一条路径能进系统锁屏卡片。这里不能因为兜底失败就跳过
    // 后面的 LXNowPlaying，否则一条路径异常会把另一条也拖死。
    try {
      await trackPlayer.updateNowPlayingMetadata({
        title: info.title,
        artist: info.artist,
        album: info.album,
        artwork: info.artwork,
        duration: info.duration,
        elapsedTime: info.elapsedTime,
        isLiveStream: false,
      })
    } catch {}
  }

  const module = NativeModules.LXNowPlaying
  if (!module?.update) return
  try {
    await module.update(info)
  } catch {}
}
