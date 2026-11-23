import { memo } from 'react'
import { View } from 'react-native'
import CheckBoxItem from '../../components/CheckBoxItem'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

export default memo(() => {
  const t = useI18n()
  const enabled = useSettingValue('desktopLyric.pipEnable')

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={enabled}
        label={t('setting_lyric_desktop_pip_enable')}
        onChange={enable => { updateSetting({ 'desktopLyric.pipEnable': enable }) }}
      />
    </View>
  )
})

const styles = createStyle({
  content: { marginTop: 2, marginBottom: 8 },
})
