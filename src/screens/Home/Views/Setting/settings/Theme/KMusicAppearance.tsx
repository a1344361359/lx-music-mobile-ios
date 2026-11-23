import { memo } from 'react'
import SubTitle from '../../components/SubTitle'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { applyTheme } from '@/core/theme'
import { getTheme } from '@/theme/themes'
import { updateSetting } from '@/core/common'
import LiveActivityColorPicker from '../Player/LiveActivityColorPicker'
import { createStyle } from '@/utils/tools'

const styles = createStyle({
  tip: { marginTop: 4 },
})

export default memo(() => {
  const themeId = useSettingValue('theme.id')
  const accent = useSettingValue('theme.kmusicAccentColor')
  const theme = useTheme()
  if (themeId !== 'kmusic' && themeId !== 'kmusic_light') return null

  const changeColor = (color: string) => {
    updateSetting({ 'theme.kmusicAccentColor': color })
    void getTheme().then(applyTheme)
  }

  return (
    <SubTitle title="KMusic 配色">
      <LiveActivityColorPicker label="界面强调色" value={accent} onChange={changeColor} />
      <Text style={styles.tip} size={12} color={theme['c-font-label']}>
        点击预设色立即生效，也可以输入 #RRGGBB 自定义侧栏选中、按钮、进度条等强调颜色；浅色和深色模式共用这套颜色。
      </Text>
    </SubTitle>
  )
})
