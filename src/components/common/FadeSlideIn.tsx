import { memo, useEffect, useRef } from 'react'
import { Animated, Easing, type ViewStyle } from 'react-native'

interface Props {
  children: React.ReactNode
  index?: number
  delay?: number
  distance?: number
  duration?: number
  style?: ViewStyle | ViewStyle[]
}

/**
 * Flutter 风格的列表入场动效：轻微上滑 + 淡入，按 index 错峰播放。
 * 只改变 opacity/transform，走 native driver，滚动时不掉帧。
 */
export default memo(({ children, index = 0, delay, distance = 10, duration = 280, style }: Props) => {
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    progress.setValue(0)
    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    }, delay ?? Math.min(index, 12) * 38)
    return () => { clearTimeout(timer) }
  }, [delay, duration, index, progress])

  return (
    <Animated.View
      style={[style, {
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  )
})
