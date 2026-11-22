import { memo } from 'react'
import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { normalizeHexColor } from '@/utils/color'
import LiveActivityColorPicker from '../Player/LiveActivityColorPicker'

export default memo(() => {
  const played = useSettingValue('desktopLyric.style.lyricPlayedColor')
  const unplay = useSettingValue('desktopLyric.style.lyricUnplayColor')

  return (
    <SubTitle title="歌词颜色">
      <View>
        <LiveActivityColorPicker
          label="已播放歌词"
          value={normalizeHexColor(played, '#31C27C')}
          onChange={(value) => { updateSetting({ 'desktopLyric.style.lyricPlayedColor': value }) }}
        />
        <LiveActivityColorPicker
          label="未播放歌词"
          value={normalizeHexColor(unplay, '#FFFFFF')}
          onChange={(value) => { updateSetting({ 'desktopLyric.style.lyricUnplayColor': value }) }}
        />
      </View>
    </SubTitle>
  )
})
