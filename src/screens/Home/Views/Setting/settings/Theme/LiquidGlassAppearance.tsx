import { memo, useEffect, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import SubTitle from '../../components/SubTitle'
import Text from '@/components/common/Text'
import Slider from '../../components/Slider'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { applyTheme } from '@/core/theme'
import { getTheme } from '@/theme/themes'
import { updateSetting } from '@/core/common'
import LiveActivityColorPicker from '../Player/LiveActivityColorPicker'
import { createStyle } from '@/utils/tools'
import { hexToRgba } from '@/theme/themes/kmusic'
import { LIQUID_GLASS_DEFAULT_COLOR, LIQUID_GLASS_DEFAULT_TRANSPARENCY } from '@/theme/themes/liquidGlass'

const styles = createStyle({
  preview: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewText: {
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  value: {
    minWidth: 42,
    textAlign: 'right',
  },
  tip: {
    marginTop: 2,
    lineHeight: 18,
  },
  reset: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
})

export default memo(() => {
  const themeId = useSettingValue('theme.id')
  const color = useSettingValue('theme.glassColor')
  const transparency = useSettingValue('theme.glassTransparency')
  const theme = useTheme()
  const [preview, setPreview] = useState(transparency)

  useEffect(() => {
    setPreview(transparency)
  }, [transparency])

  if (themeId !== 'liquid_glass') return null

  const apply = (nextColor = color, nextTransparency = preview) => {
    updateSetting({
      'theme.glassColor': nextColor,
      'theme.glassTransparency': nextTransparency,
    })
    void getTheme().then(applyTheme)
  }

  const changeColor = (nextColor: string) => {
    apply(nextColor, preview)
  }

  const commitTransparency = (value: number) => {
    const next = Math.round(value)
    setPreview(next)
    apply(color, next)
  }

  return (
    <SubTitle title="液态玻璃">
      <View style={[
        styles.preview,
        {
          backgroundColor: hexToRgba(color, 0.08 + (1 - preview / 100) * 0.4),
          borderColor: hexToRgba(color, 0.55),
        },
      ]}>
        <Text style={styles.previewText} size={15} color={theme['c-font']}>液态玻璃预览</Text>
      </View>
      <LiveActivityColorPicker label="玻璃颜色" value={color} onChange={changeColor} />
      <View style={styles.row}>
        <Text size={14} color={theme['c-font']}>透明度</Text>
        <Text style={styles.value} size={13} color={theme['c-primary-font']}>{preview}%</Text>
      </View>
      <Slider
        value={preview}
        minimumValue={0}
        maximumValue={100}
        step={1}
        onValueChange={setPreview}
        onSlidingComplete={commitTransparency}
      />
      <View style={[styles.row, { marginTop: -2, marginBottom: 10 }]}>
        <Text size={11} color={theme['c-font-label']}>更实</Text>
        <Text size={11} color={theme['c-font-label']}>更透</Text>
      </View>
      <Text style={styles.tip} size={12} color={theme['c-font-label']}>
        颜色会同时用于按钮、选中态、进度条和玻璃描边；透明度越高，底层壁纸越明显。设置会自动保存，重启后仍然保留。
      </Text>
      <TouchableOpacity
        style={[styles.reset, { backgroundColor: theme['c-primary-background'] }]}
        onPress={() => {
          setPreview(LIQUID_GLASS_DEFAULT_TRANSPARENCY)
          apply(LIQUID_GLASS_DEFAULT_COLOR, LIQUID_GLASS_DEFAULT_TRANSPARENCY)
        }}
      >
        <Text size={12} color={theme['c-primary-font']}>恢复默认</Text>
      </TouchableOpacity>
    </SubTitle>
  )
})
