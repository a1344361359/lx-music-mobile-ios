import { memo } from 'react'
import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { getTheme } from '@/theme/themes'
import { applyTheme } from '@/core/theme'
import { createStyle } from '@/utils/tools'

const MODES = [
  { value: 'auto', name: 'setting_basic_theme_appearance_auto' },
  { value: 'light', name: 'setting_basic_theme_appearance_light' },
  { value: 'dark', name: 'setting_basic_theme_appearance_dark' },
] as const

export default memo(() => {
  const t = useI18n()
  const active = useSettingValue('theme.appearanceMode')

  const change = (value: typeof MODES[number]['value']) => {
    updateSetting({ 'theme.appearanceMode': value })
    void getTheme().then(applyTheme)
  }

  return (
    <SubTitle title={t('setting_basic_theme_appearance')}>
      <View style={styles.list}>
        {MODES.map(({ value, name }) => (
          <CheckBox
            key={value}
            marginRight={10}
            check={active === value}
            label={t(name)}
            onChange={() => { change(value) }}
            need
          />
        ))}
      </View>
    </SubTitle>
  )
})

const styles = createStyle({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
})
