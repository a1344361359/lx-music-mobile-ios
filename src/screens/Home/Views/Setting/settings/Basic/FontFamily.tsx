import { memo, useMemo } from 'react'

import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'

const LIST = [
  { value: '', name: 'setting_basic_font_family_system' },
  { value: 'PingFang SC', name: 'setting_basic_font_family_pingfang' },
  { value: 'Songti SC', name: 'setting_basic_font_family_songti' },
  { value: 'Kaiti SC', name: 'setting_basic_font_family_kaiti' },
  { value: 'Yuanti SC', name: 'setting_basic_font_family_yuanti' },
  { value: 'Avenir Next', name: 'setting_basic_font_family_avenir' },
] as const

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const active = useSettingValue('common.fontFamily')
  const list = useMemo(() => LIST.map(item => ({ ...item, label: t(item.name) })), [t])

  return (
    <SubTitle title={t('setting_basic_font_family')}>
      <View style={styles.preview}>
        <Text color={theme['c-primary']} size={16}>
          {t('setting_basic_font_family_preview')}
        </Text>
      </View>
      <View style={styles.list}>
        {list.map(({ value, label }) => (
          <CheckBox
            key={value || 'system'}
            marginRight={8}
            check={active === value}
            label={label}
            onChange={() => { updateSetting({ 'common.fontFamily': value }) }}
            need
          />
        ))}
      </View>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  preview: {
    justifyContent: 'center',
    paddingBottom: 10,
    height: 45,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
