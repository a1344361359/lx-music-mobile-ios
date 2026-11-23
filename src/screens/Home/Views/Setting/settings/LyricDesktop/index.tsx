import { memo } from 'react'
import { Platform } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'

import Section from '../../components/Section'
import IsShowLyric from './IsShowLyric'
import IsLockLyric from './IsLockLyric'
import IsShowToggleAnima from './IsShowToggleAnima'
import IsSingleLine from './IsSingleLine'
import TextSize from './TextSize'
import ViewWidth from './ViewWidth'
import PipSize from './PipSize'
import LyricOffset from './LyricOffset'
import MaxLineNum from './MaxLineNum'
import TextOpacity from './TextOpacity'
import TextPositionX from './TextPositionX'
import TextPositionY from './TextPositionY'
import { useI18n } from '@/lang'
import Theme from './Theme'
import LyricColors from './LyricColors'
// import { useTranslation } from '@/plugins/i18n'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()

  return (
    <Section title={t('setting_lyric_desktop')}>
      {Platform.OS === 'ios' && (
        <Text size={12} color={theme['c-font-label']} style={{ paddingHorizontal: 15, paddingBottom: 8, lineHeight: 18 }}>
          iOS 版开启后会启动 QQ 音乐式系统画中画歌词条，可浮在其他 App 和桌面上；可自定义已播放/未播放歌词颜色。若未弹出，请确认系统设置中已允许“自动开启画中画”。
        </Text>
      )}
      <IsShowLyric />
      {Platform.OS !== 'ios' && <IsLockLyric />}
      {Platform.OS !== 'ios' && <IsShowToggleAnima />}
      <IsSingleLine />
      <LyricOffset />
      <Theme />
      <LyricColors />
      <TextSize />
      {Platform.OS === 'ios' ? <PipSize /> : <ViewWidth />}
      {Platform.OS !== 'ios' && <MaxLineNum />}
      {Platform.OS !== 'ios' && <TextOpacity />}
      {Platform.OS !== 'ios' && <TextPositionX />}
      {Platform.OS !== 'ios' && <TextPositionY />}
    </Section>
  )
})
