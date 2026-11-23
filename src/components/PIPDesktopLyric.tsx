import { useEffect, useRef } from 'react'
import { AppState, NativeEventEmitter, NativeModules, Platform } from 'react-native'
import { useLrcSet } from '@/plugins/lyric'
import { useIsPlay, useProgress } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { setBackgroundAudioPlaying } from '@/utils/nativeModules/backgroundAudio'

const { LXPipLyric } = NativeModules

interface PipState {
  lines: Array<{ text: string, time: number }>
  position: number
  isPlaying: boolean
  singleLine: boolean
  width: number
  fontSize: number
  offset: number
  playedColor: string
  unplayedColor: string
  glassColor: string
  glassTransparency: number
  pipWidth: number
  pipHeight: number
  pipOpacity: number
}

// QQ 音乐式的系统画中画歌词：由原生 AVSampleBufferDisplayLayer 渲染，
// 不再使用 react-native-video 的黑色视频 + WebVTT 方案。
export default () => {
  const enabled = useSettingValue('desktopLyric.pipEnable')
  const lines = useLrcSet()
  const isPlay = useIsPlay()
  const progress = useProgress()
  const singleLine = useSettingValue('desktopLyric.isSingleLine')
  const width = useSettingValue('desktopLyric.width')
  const pipWidth = useSettingValue('desktopLyric.pipWidth')
  const pipHeight = useSettingValue('desktopLyric.pipHeight')
  const pipOpacity = useSettingValue('desktopLyric.pipOpacity')
  const fontSize = useSettingValue('desktopLyric.style.fontSize')
  const lyricOffset = useSettingValue('desktopLyric.lyricOffset')
  const playedColor = useSettingValue('desktopLyric.style.lyricPlayedColor')
  const unplayedColor = useSettingValue('desktopLyric.style.lyricUnplayColor')
  const glassColor = useSettingValue('theme.glassColor')
  const glassTransparency = useSettingValue('theme.glassTransparency')
  const configuredRef = useRef(false)

  const buildState = (): PipState => ({
    lines: (lines as any[]).filter(line => line.text).map(line => ({
      text: line.text,
      time: line.time / 1000,
    })),
    position: progress.nowPlayTime,
    isPlaying: isPlay,
    singleLine,
    width,
    fontSize,
    offset: lyricOffset / 1000,
    playedColor,
    unplayedColor,
    glassColor,
    glassTransparency,
    pipWidth,
    pipHeight,
    pipOpacity,
  })

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    setBackgroundAudioPlaying(isPlay)
  }, [isPlay])

  useEffect(() => {
    if (Platform.OS !== 'ios' || !LXPipLyric) return
    if (!enabled) {
      configuredRef.current = false
      void LXPipLyric.teardown()
      return
    }
    const state = buildState()
    if (!configuredRef.current) {
      configuredRef.current = true
      void LXPipLyric.configure(state)
    } else {
      void LXPipLyric.update(state)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, lines, isPlay, progress.nowPlayTime, singleLine, width, fontSize, lyricOffset, playedColor, unplayedColor, glassColor, glassTransparency, pipWidth, pipHeight, pipOpacity])

  useEffect(() => {
    if (Platform.OS !== 'ios' || !LXPipLyric) return
    const onAppState = (next: string) => {
      if (!enabled) return
      if (next === 'background') void LXPipLyric.start()
    }
    const sub = AppState.addEventListener('change', onAppState)
    return () => { sub.remove() }
  }, [enabled])

  useEffect(() => {
    if (Platform.OS !== 'ios' || !LXPipLyric) return
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const emitter = new NativeEventEmitter(LXPipLyric)
    const listener = emitter.addListener('LXPipLyricRemoteCommand', (event: { action?: string, position?: number }) => {
      // 播放/暂停和跳转已经由原生直接控制 TrackPlayer；这里把远程操作
      // 同步回 JS 状态，避免每秒 update 用旧状态覆盖画中画。
      if (event.action === 'pause') {
        global.app_event.playerPause()
        global.app_event.pause()
      } else if (event.action === 'play') {
        global.app_event.playerPlaying()
        global.app_event.play()
      } else if (event.action === 'seek' && typeof event.position === 'number') {
        global.app_event.setProgress(event.position)
      }
    })
    return () => { listener.remove() }
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'ios' || !LXPipLyric) return
    return () => {
      configuredRef.current = false
      void LXPipLyric.teardown()
    }
  }, [])

  return null
}
