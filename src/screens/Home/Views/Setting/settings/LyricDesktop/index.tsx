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
import MaxLineNum from './MaxLineNum'
import TextOpacity from './TextOpacity'
import TextPositionX from './TextPositionX'
import TextPositionY from './TextPositionY'
import { useI18n } from '@/lang'
import Theme from './Theme'
// import { useTranslation } from '@/plugins/i18n'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()

  return (
    <Section title={t('setting_lyric_desktop')}>
      {Platform.OS === 'ios' && (
        <Text size={12} color={theme['c-font-label']} style={{ paddingHorizontal: 15, paddingBottom: 8, lineHeight: 18 }}>
          iOS 版在应用内显示悬浮歌词，点击歌词可打开播放详情；不支持跨 App 悬浮。
        </Text>
      )}
      <IsShowLyric />
      <IsLockLyric />
      <IsShowToggleAnima />
      <IsSingleLine />
      <Theme />
      <TextSize />
      <ViewWidth />
      <MaxLineNum />
      <TextOpacity />
      <TextPositionX />
      <TextPositionY />
    </Section>
  )
})
