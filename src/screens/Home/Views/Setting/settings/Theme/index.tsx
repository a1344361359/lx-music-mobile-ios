import { memo } from 'react'

// import Section from '../../components/Section'
import Theme from './Theme'
import AppearanceMode from './AppearanceMode'
import Wallpaper from './Wallpaper'
import IsAutoTheme from './IsAutoTheme'
import IsHideBgDark from './IsHideBgDark'
import IsDynamicBg from './IsDynamicBg'
import IsFontShadow from './IsFontShadow'
import KMusicAppearance from './KMusicAppearance'
import LiquidGlassAppearance from './LiquidGlassAppearance'
// import { useI18n } from '@/lang/i18n'

export default memo(() => {
  return (
    <>
      <Theme />
      <AppearanceMode />
      <Wallpaper />
      <KMusicAppearance />
      <LiquidGlassAppearance />
      <IsAutoTheme />
      <IsHideBgDark />
      <IsDynamicBg />
      <IsFontShadow />
    </>
  )
})
