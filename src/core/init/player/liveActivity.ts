import { AppState, Platform } from 'react-native'
import { addSetLyricHook } from '@/plugins/lyric'
import { endLiveActivity, syncLiveActivity, updateLiveActivityPlayback } from '@/core/liveActivity'

export default async(setting: LX.AppSetting) => {
  if (Platform.OS !== 'ios') return

  addSetLyricHook(() => {
    void syncLiveActivity(true)
  })
  global.app_event.on('musicToggled', () => {
    void syncLiveActivity(true)
  })
  global.app_event.on('play', () => {
    void updateLiveActivityPlayback(true)
  })
  global.app_event.on('pause', () => {
    void updateLiveActivityPlayback(false)
  })
  global.app_event.on('stop', () => {
    endLiveActivity()
  })
  global.app_event.on('setProgress', (position) => {
    void updateLiveActivityPlayback(undefined, position)
  })

  AppState.addEventListener('change', state => {
    if (state === 'active') void syncLiveActivity(true)
  })

  if (setting['player.isShowLiveActivity']) setTimeout(() => { void syncLiveActivity(true) }, 1000)
}
