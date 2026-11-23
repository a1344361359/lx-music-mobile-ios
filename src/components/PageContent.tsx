// import { useEffect, useState } from 'react'
import { View, SafeAreaView, Platform, StyleSheet } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import ImageBackground from '@/components/common/ImageBackground'
import { useMemo } from 'react'
import { scaleSizeAbsHR } from '@/utils/pixelRatio'
import { defaultHeaders } from './common/Image'
import SizeView from './SizeView'
import FadeSlideIn from './common/FadeSlideIn'
import { useBgPic } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'
import { hexToRgba } from '@/theme/themes/kmusic'

interface Props {
  children: React.ReactNode
}

const BLUR_RADIUS = Math.max(scaleSizeAbsHR(18), 10)
const ContentView = Platform.OS === 'ios' ? SafeAreaView : View

export default ({ children }: Props) => {
  const theme = useTheme()
  const pic = useBgPic()
  const glassColor = useSettingValue('theme.glassColor')
  const glassTransparency = useSettingValue('theme.glassTransparency')
  const customWallpaper = useSettingValue('theme.glassWallpaper')
  const wallpaperBlur = useSettingValue('theme.glassWallpaperBlur')
  const isGlass = theme.id === 'liquid_glass'
  const glassTint = isGlass
    ? hexToRgba(glassColor, 0.05 + (1 - Math.max(0, Math.min(100, glassTransparency)) / 100) * 0.16)
    : undefined
  const customWallpaperUri = customWallpaper
    ? (customWallpaper.startsWith('file://') ? customWallpaper : `file://${customWallpaper}`)
    : undefined
  const backgroundSource = useMemo(() => customWallpaperUri
    ? { uri: customWallpaperUri }
    : theme['bg-image'], [customWallpaperUri, theme])
  const backgroundBlur = customWallpaperUri
    ? (wallpaperBlur ? BLUR_RADIUS : 0)
    : (isGlass ? 10 : 0)
  // const [wh, setWH] = useState<{ width: number | string, height: number | string }>({ width: '100%', height: Dimensions.get('screen').height })

  // 固定宽高度 防止弹窗键盘时大小改变导致背景被缩放
  // useEffect(() => {
  //   const onChange = () => {
  //     setWH({ width: '100%', height: '100%' })
  //   }

  //   const changeEvent = Dimensions.addEventListener('change', onChange)
  //   return () => {
  //     changeEvent.remove()
  //   }
  // }, [])
  // const handleLayout = (e: LayoutChangeEvent) => {
  //   // console.log('handleLayout', e.nativeEvent)
  //   // console.log(Dimensions.get('screen'))
  //   setWH({ width: e.nativeEvent.layout.width, height: Dimensions.get('screen').height })
  // }
  // console.log('render page content')

  const themeComponent = useMemo(() => (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <ImageBackground
        style={[StyleSheet.absoluteFillObject, { backgroundColor: theme['c-content-background'] }]}
        source={backgroundSource}
        resizeMode="cover"
        blurRadius={backgroundBlur}
      >
        {isGlass ? <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: glassTint }]} /> : null}
      </ImageBackground>
      <ContentView style={{ flex: 1 }}>
        <FadeSlideIn duration={240} distance={6} style={{ flex: 1 }}>
          {children}
        </FadeSlideIn>
      </ContentView>
    </View>
  ), [children, theme, backgroundSource, glassTint, isGlass, backgroundBlur])
  const picComponent = useMemo(() => {
    return (
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <ImageBackground
          style={[StyleSheet.absoluteFillObject, { backgroundColor: theme['c-content-background'] }]}
          source={{ uri: pic!, headers: defaultHeaders }}
          resizeMode="cover"
          blurRadius={BLUR_RADIUS}
        >
          <View style={{ flex: 1, flexDirection: 'column', backgroundColor: theme['c-content-background'], opacity: 0.76 }}></View>
        </ImageBackground>
        <ContentView style={{ flex: 1 }}>
          <FadeSlideIn duration={240} distance={6} style={{ flex: 1 }}>
            {children}
          </FadeSlideIn>
        </ContentView>
      </View>
    )
  }, [children, pic, theme])

  // 根视图铺满屏幕，状态栏和底部 Home 指示条区域也由同一张背景覆盖。
  return (
    <View style={{ flex: 1, backgroundColor: theme['c-content-background'] }}>
      <SizeView />
      {pic && !customWallpaperUri ? picComponent : themeComponent}
    </View>
  )
}
