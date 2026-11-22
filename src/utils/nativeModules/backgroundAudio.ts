import { NativeModules, Platform } from 'react-native'

const native = Platform.OS === 'ios' ? NativeModules.LXBackgroundAudio : null

export const setBackgroundAudioPlaying = (playing: boolean) => {
  if (!native) return
  try {
    native.setPlaying(playing)
  } catch {}
}

export const refreshBackgroundAudio = () => {
  if (!native) return
  try {
    native.refresh()
  } catch {}
}
