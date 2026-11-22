import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import SubTitle from '../../components/SubTitle'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { applyTheme, setTheme } from '@/core/theme'
import { getTheme } from '@/theme/themes'
import { updateSetting } from '@/core/common'
import LiveActivityColorPicker from '../Player/LiveActivityColorPicker'
import { createStyle } from '@/utils/tools'

const styles = createStyle({
  modes: { flexDirection: 'row', marginBottom: 12 },
  mode: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, marginRight: 10, borderWidth: 1 },
  tip: { marginTop: 4 },
})

export default memo(() => {
  const themeId = useSettingValue('theme.id')
  const accent = useSettingValue('theme.kmusicAccentColor')
  const theme = useTheme()
  if (themeId !== 'kmusic' && themeId !== 'kmusic_light') return null

  const isLight = themeId === 'kmusic_light'
  const changeColor = (color: string) => {
    updateSetting({ 'theme.kmusicAccentColor': color })
    void getTheme().then(applyTheme)
  }

  return (
    <SubTitle title="KMusic 配色">
      <View style={styles.modes}>
        {(['kmusic', 'kmusic_light'] as const).map(id => {
          const active = id === themeId
          return (
            <TouchableOpacity
              key={id}
              style={[styles.mode, {
                borderColor: active ? theme['c-primary'] : theme['c-border-background'],
                backgroundColor: active ? theme['c-primary-background'] : 'transparent',
              }]}
              onPress={() => setTheme(id)}
            >
              <Text size={14} color={active ? theme['c-primary-font'] : theme['c-font-label']}>
                {id === 'kmusic' ? '深色' : '浅色'}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
      <LiveActivityColorPicker label="界面强调色" value={accent} onChange={changeColor} />
      <Text style={styles.tip} size={12} color={theme['c-font-label']}>
        点击预设色立即生效，也可以输入 #RRGGBB 自定义侧栏选中、按钮、进度条等强调颜色；浅色和深色模式共用这套颜色。
      </Text>
    </SubTitle>
  )
})
