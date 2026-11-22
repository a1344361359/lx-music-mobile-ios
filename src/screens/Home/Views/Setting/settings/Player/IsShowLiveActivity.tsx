import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { NativeModules, Platform, View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'

import CheckBoxItem from '../../components/CheckBoxItem'
import { endLiveActivity, syncLiveActivity } from '@/core/liveActivity'

export default memo(() => {
  const t = useI18n()
  const isShowLiveActivity = useSettingValue('player.isShowLiveActivity')

  if (Platform.OS !== 'ios' || !NativeModules.LXLiveActivity) return null

  const setShowLiveActivity = (isShow: boolean) => {
    updateSetting({ 'player.isShowLiveActivity': isShow })
    if (isShow) {
      void syncLiveActivity(true)
    } else {
      endLiveActivity()
    }
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={isShowLiveActivity} onChange={setShowLiveActivity} label={t('setting_play_show_live_activity')} />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
