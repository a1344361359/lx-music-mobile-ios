import { NativeModules, Platform } from 'react-native'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { getLiveLyricLines } from '@/plugins/lyric'

const native = Platform.OS === 'ios' ? NativeModules.LXLiveActivity : null

let lastSongId: string | null = null
let lastStartAt = 0

const isEnabled = () => {
  return Platform.OS === 'ios' &&
    native != null &&
    !!settingState.setting['player.isShowLiveActivity']
}

const buildPayload = () => {
  const music = playerState.musicInfo
  if (!music.id) return null
  return {
    songId: String(music.id),
    title: music.name || '未知歌曲',
    artist: music.singer || '',
    duration: Math.max(0, playerState.progress.maxPlayTime || 0),
    position: Math.max(0, playerState.progress.nowPlayTime || 0),
    isPlaying: !!playerState.isPlay,
    lines: getLiveLyricLines(),
  }
}

export const syncLiveActivity = (force = false) => {
  if (!isEnabled()) {
    if (lastSongId) void endLiveActivity()
    return
  }
  const payload = buildPayload()
  if (!payload) {
    if (lastSongId) void endLiveActivity()
    return
  }
  const now = Date.now()
  if (!force && payload.songId === lastSongId && now - lastStartAt < 800) return
  lastSongId = payload.songId
  lastStartAt = now
  native?.start?.(payload)
}

export const updateLiveActivityPlayback = (isPlaying?: boolean, position?: number) => {
  if (!isEnabled()) return
  if (!lastSongId) {
    syncLiveActivity(true)
    return
  }
  native?.update?.({
    position: Math.max(0, position ?? playerState.progress.nowPlayTime ?? 0),
    duration: Math.max(0, playerState.progress.maxPlayTime || 0),
    isPlaying: isPlaying ?? !!playerState.isPlay,
  })
}

export const endLiveActivity = () => {
  lastSongId = null
  native?.end?.()
}

export const isLiveActivitySupported = async(): Promise<boolean> => {
  if (Platform.OS !== 'ios' || !native?.isSupported) return false
  try {
    return await native.isSupported()
  } catch {
    return false
  }
}
