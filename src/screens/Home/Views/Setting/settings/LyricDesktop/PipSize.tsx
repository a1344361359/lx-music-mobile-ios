import { memo, useCallback, useState } from 'react'
import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Slider, { type SliderProps } from '../../components/Slider'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

interface RowProps {
  label: string
  value: number
  unit: string
  minimumValue: number
  maximumValue: number
  step?: number
  onChange: (value: number) => void
}

const Row = ({ label, value, unit, minimumValue, maximumValue, step = 1, onChange }: RowProps) => {
  const theme = useTheme()
  const [preview, setPreview] = useState(value)
  const change = useCallback<NonNullable<SliderProps['onValueChange']>>(next => {
    setPreview(Math.round(next))
  }, [])
  const complete = useCallback<NonNullable<SliderProps['onSlidingComplete']>>(next => {
    const rounded = Math.round(next)
    setPreview(rounded)
    if (rounded !== value) onChange(rounded)
  }, [onChange, value])

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text size={14} color={theme['c-font']}>{label}</Text>
        <Text size={13} color={theme['c-primary-font']}>{Math.round(preview)}{unit}</Text>
      </View>
      <Slider
        value={value}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        onValueChange={change}
        onSlidingComplete={complete}
      />
    </View>
  )
}

export default memo(() => {
  const theme = useTheme()
  const pipWidth = useSettingValue('desktopLyric.pipWidth')
  const pipHeight = useSettingValue('desktopLyric.pipHeight')
  const pipOpacity = useSettingValue('desktopLyric.pipOpacity')

  return (
    <SubTitle title="画中画尺寸与透明度">
      <Row
        label="宽度"
        value={pipWidth}
        unit="pt"
        minimumValue={220}
        maximumValue={500}
        onChange={value => { updateSetting({ 'desktopLyric.pipWidth': value }) }}
      />
      <Row
        label="高度"
        value={pipHeight}
        unit="pt"
        minimumValue={40}
        maximumValue={200}
        onChange={value => { updateSetting({ 'desktopLyric.pipHeight': value }) }}
      />
      <Row
        label="透明度"
        value={pipOpacity}
        unit="%"
        minimumValue={0}
        maximumValue={100}
        onChange={value => { updateSetting({ 'desktopLyric.pipOpacity': value }) }}
      />
      <Text size={11} color={theme['c-font-label']} style={styles.tip}>
        宽度/高度是系统画中画窗口的尺寸；透明度 0% 最实、100% 最透。调整后自动保存。
      </Text>
    </SubTitle>
  )
})

const styles = createStyle({
  row: {
    marginBottom: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 6,
  },
  tip: {
    marginTop: 2,
    lineHeight: 17,
  },
})
