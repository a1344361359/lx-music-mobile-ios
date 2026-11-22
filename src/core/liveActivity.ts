import { NativeModules, Platform } from 'react-native'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { getLiveLyricLines } from '@/plugins/lyric'
import { normalizeHexColor } from '@/utils/color'

const native = Platform.OS === 'ios' ? NativeModules.LXLiveActivity : null

let lastSongId: string | null = null
let lastStartAt = 0
let lastPosition = 0
let lastPositionAt = 0

const isEnabled = () => {
  return Platform.OS === 'ios' &&
    native != null &&
    !!settingState.setting['player.isShowLiveActivity']
}

const buildPayload = (music = playerState.musicInfo) => {
  if (!music.id) return null
  return {
    songId: String(music.id),
    title: music.name || '未知歌曲',
    artist: music.singer || '',
    artworkUrl: music.pic ?? '',
    duration: Math.max(0, playerState.progress.maxPlayTime || 0),
    position: Math.max(0, playerState.progress.nowPlayTime || 0),
    positionAt: Date.now(),
    isPlaying: !!playerState.isPlay,
    playbackRate: settingState.setting['player.playbackRate'] || 1,
    lyricOffset: (settingState.setting['desktopLyric.lyricOffset'] || 0) / 1000,
    playedColor: normalizeHexColor(settingState.setting['player.liveActivityLyricPlayedColor'], '#31C27C'),
    unplayedColor: normalizeHexColor(settingState.setting['player.liveActivityLyricUnplayedColor'], '#FFFFFF'),
    lines: getLiveLyricLines(),
  }
}

export const syncLiveActivity = (force = false, musicInfo = playerState.musicInfo) => {
  if (!isEnabled()) {
    if (lastSongId) endLiveActivity()
    return
  }
  const payload = buildPayload(musicInfo)
  if (!payload) {
    if (lastSongId) endLiveActivity()
    return
  }
  const now = Date.now()
  if (!force && payload.songId === lastSongId && now - lastStartAt < 800) return
  lastSongId = payload.songId
  lastStartAt = now
  lastPosition = payload.position
  lastPositionAt = now
  native?.start?.(payload)
}

export const updateLiveActivityPlayback = (isPlaying?: boolean, position?: number) => {
  if (!isEnabled()) return
  if (!lastSongId) {
    syncLiveActivity(true)
    return
  }
  const now = Date.now()
  const nextPosition = Math.max(0, position ?? playerState.progress.nowPlayTime ?? 0)
  // 播放进度每秒都会触发一次；原生侧已经有计时器推进歌词，
  // 这里只在暂停/播放状态变化或用户拖动进度时更新，避免重复刷新实时活动。
  if (isPlaying === undefined && position != null) {
    const expected = lastPosition + (now - lastPositionAt) / 1000 * (settingState.setting['player.playbackRate'] || 1)
    if (Math.abs(nextPosition - expected) < 1.5) return
  }
  lastPosition = nextPosition
  lastPositionAt = now
  native?.update?.({
    songId: lastSongId,
    position: nextPosition,
    positionAt: now,
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
