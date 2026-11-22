import { memo, useCallback, useState } from 'react'
import { Platform, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Slider, { type SliderProps } from '../../components/Slider'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { updateSetting } from '@/core/common'
import { refreshLyricOffset } from '@/core/lyric'
import { syncLiveActivity } from '@/core/liveActivity'

const MIN_VALUE = -3000
const MAX_VALUE = 3000
const STEP = 100

export default memo(() => {
  const t = useI18n()
  const offset = useSettingValue('desktopLyric.lyricOffset')
  const theme = useTheme()
  const [sliderSize, setSliderSize] = useState(offset)
  const [isSliding, setSliding] = useState(false)

  const handleSlidingStart = useCallback<NonNullable<SliderProps['onSlidingStart']>>(() => {
    setSliding(true)
  }, [])
  const handleValueChange = useCallback<NonNullable<SliderProps['onValueChange']>>(value => {
    setSliderSize(value)
  }, [])
  const handleSlidingComplete = useCallback<NonNullable<SliderProps['onSlidingComplete']>>(value => {
    const next = Math.trunc(value)
    updateSetting({ 'desktopLyric.lyricOffset': next })
    refreshLyricOffset()
    if (Platform.OS === 'ios') syncLiveActivity(true)
    setSliding(false)
  }, [])

  const seconds = ((isSliding ? sliderSize : offset) / 1000).toFixed(1)
  const label = `${Number(seconds) > 0 ? '+' : ''}${seconds}s`

  return (
    <SubTitle title={t('setting_lyric_desktop_speed')}>
      <View style={styles.content}>
        <Text style={{ color: theme['c-primary-font'] }}>{label}</Text>
        <Slider
          minimumValue={MIN_VALUE}
          maximumValue={MAX_VALUE}
          onSlidingComplete={handleSlidingComplete}
          onValueChange={handleValueChange}
          onSlidingStart={handleSlidingStart}
          step={STEP}
          value={offset}
        />
      </View>
      <Text size={11} color={theme['c-font-label']} style={styles.tip}>{t('setting_lyric_desktop_speed_tip')}</Text>
    </SubTitle>
  )
})

const styles = createStyle({
  content: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tip: {
    marginTop: -8,
    marginBottom: 6,
    lineHeight: 16,
  },
})
