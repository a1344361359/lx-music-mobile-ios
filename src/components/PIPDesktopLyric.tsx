import RNFS from 'react-native-fs'
import Video, { IgnoreSilentSwitchType, MixWithOthersType, SelectedTrackType, TextTrackType, type VideoRef } from 'react-native-video'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, View } from 'react-native'
import { buildPipLyricVtt } from '@/core/pipLyric'
import { useLrcSet } from '@/plugins/lyric'
import { useIsPlay, useProgress } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'

// A long, tiny black H.264 clip is used as the PiP media surface. Lyrics are
// supplied as a local WebVTT text track, which AVPlayer composites in PiP.
const BLACK_VIDEO = require('@/resources/black-pip.mp4')

export default () => {
  const enabled = useSettingValue('desktopLyric.enable')
  const lines = useLrcSet()
  const isPlay = useIsPlay()
  const progress = useProgress()
  const videoRef = useRef<VideoRef>(null)
  const progressRef = useRef(progress.nowPlayTime)
  const lastSeekRef = useRef(0)
  const [vttUri, setVttUri] = useState<string | null>(null)

  progressRef.current = progress.nowPlayTime

  useEffect(() => {
    if (Platform.OS !== 'ios' || !enabled || !lines.length) {
      setVttUri(null)
      return
    }
    const vtt = buildPipLyricVtt(lines)
    if (vtt === 'WEBVTT\n\n') {
      setVttUri(null)
      return
    }

    let cancelled = false
    const path = `${RNFS.DocumentDirectoryPath}/lx-pip-lyrics-${Date.now()}.vtt`
    RNFS.writeFile(path, vtt, 'utf8').then(() => {
      if (!cancelled) setVttUri(`file://${path}`)
    }).catch(() => {
      if (!cancelled) setVttUri(null)
    })
    return () => { cancelled = true }
  }, [enabled, lines])

  useEffect(() => {
    if (!vttUri || !isPlay) {
      return
    }
    const timer = setTimeout(() => {
      try {
        videoRef.current?.enterPictureInPicture()
      } catch {}
    }, 600)
    return () => clearTimeout(timer)
  }, [vttUri, isPlay])

  const source = useMemo(() => {
    if (!vttUri) return null
    return {
      uri: BLACK_VIDEO,
      startPosition: Math.max(0, progressRef.current * 1000),
      textTracks: [{
        title: '歌词',
        language: 'zh' as const,
        type: TextTrackType.VTT,
        uri: vttUri,
      }],
    }
  }, [vttUri])

  if (Platform.OS !== 'ios' || !source) return null

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: 640, height: 360, opacity: 0.01 }}>
      <Video
        ref={videoRef}
        source={source}
        style={{ width: 640, height: 360 }}
        paused={!isPlay}
        muted
        volume={0}
        resizeMode="contain"
        repeat={false}
        playInBackground
        playWhenInactive
        enterPictureInPictureOnLeave
        ignoreSilentSwitch={IgnoreSilentSwitchType.IGNORE}
        mixWithOthers={MixWithOthersType.MIX}
        selectedTextTrack={{ type: SelectedTrackType.INDEX, value: 0 }}
        onLoad={() => {
          if (progressRef.current > 0.5) videoRef.current?.seek(progressRef.current)
        }}
        onProgress={({ currentTime }) => {
          const target = progressRef.current
          const now = Date.now()
          if (Math.abs(currentTime - target) > 1.5 && now - lastSeekRef.current > 1500) {
            lastSeekRef.current = now
            videoRef.current?.seek(target)
          }
        }}
        onError={() => {}}
      />
    </View>
  )
}
