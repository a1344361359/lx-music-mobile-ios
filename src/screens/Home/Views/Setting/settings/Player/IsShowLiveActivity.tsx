import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { NativeModules, Platform, View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'

import CheckBoxItem from '../../components/CheckBoxItem'
import Text from '@/components/common/Text'
import { endLiveActivity, syncLiveActivity } from '@/core/liveActivity'
import LiveActivityColorPicker from './LiveActivityColorPicker'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const isShowLiveActivity = useSettingValue('player.isShowLiveActivity')
  const playedColor = useSettingValue('player.liveActivityLyricPlayedColor')
  const unplayedColor = useSettingValue('player.liveActivityLyricUnplayedColor')

  if (Platform.OS !== 'ios' || !NativeModules.LXLiveActivity || parseFloat(String(Platform.Version)) < 16.1) return null

  const setShowLiveActivity = (isShow: boolean) => {
    updateSetting({ 'player.isShowLiveActivity': isShow })
    if (isShow) {
      syncLiveActivity(true)
    } else {
      endLiveActivity()
    }
  }

  const setPlayedColor = (value: string) => {
    updateSetting({ 'player.liveActivityLyricPlayedColor': value })
    if (isShowLiveActivity) syncLiveActivity(true)
  }

  const setUnplayedColor = (value: string) => {
    updateSetting({ 'player.liveActivityLyricUnplayedColor': value })
    if (isShowLiveActivity) syncLiveActivity(true)
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={isShowLiveActivity} onChange={setShowLiveActivity} label={t('setting_play_show_live_activity')} />
      {isShowLiveActivity
        ? <View style={styles.colorSection}>
            <Text style={styles.hint} size={12} color={theme['c-font-label']}>{t('setting_play_live_activity_color_tip')}</Text>
            <LiveActivityColorPicker
              label={t('setting_play_live_activity_played_color')}
              value={playedColor}
              onChange={setPlayedColor}
            />
            <LiveActivityColorPicker
              label={t('setting_play_live_activity_unplayed_color')}
              value={unplayedColor}
              onChange={setUnplayedColor}
            />
            <View style={styles.preview}>
              <Text style={styles.previewText} size={15} color={playedColor}>{t('setting_play_live_activity_played_color')}</Text>
              <Text size={15} color={unplayedColor}>{t('setting_play_live_activity_unplayed_color')}</Text>
            </View>
          </View>
        : null}
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
  colorSection: {
    paddingLeft: 25,
    paddingRight: 4,
    marginTop: 8,
    marginBottom: 6,
  },
  hint: {
    marginBottom: 10,
  },
  previewText: {
    marginRight: 12,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 6,
  },
})
