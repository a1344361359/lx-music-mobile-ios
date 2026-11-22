import { Platform, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { useLrcPlay, useLrcSet, type Line } from '@/plugins/lyric'
import { useSettingValue } from '@/store/setting/hook'
import { useWindowSize } from '@/utils/hooks'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'

const EMPTY_LINE: Line = { time: 0, text: '播放歌曲后在此显示歌词', extendedLyrics: [] }

// An in-app counterpart to Android's desktop lyric window. It stays above the
// current Home view, follows the same lyric settings, and opens Play Detail on
// tap. iOS itself does not permit this view to remain above other apps.
export default () => {
  const enabled = useSettingValue('desktopLyric.enable')
  const isSingleLine = useSettingValue('desktopLyric.isSingleLine')
  const widthPercent = useSettingValue('desktopLyric.width')
  const maxLineNum = useSettingValue('desktopLyric.maxLineNum')
  const fontSizeSetting = useSettingValue('desktopLyric.style.fontSize')
  const opacitySetting = useSettingValue('desktopLyric.style.opacity')
  const unplayColor = useSettingValue('desktopLyric.style.lyricUnplayColor')
  const playedColor = useSettingValue('desktopLyric.style.lyricPlayedColor')
  const shadowColor = useSettingValue('desktopLyric.style.lyricShadowColor')
  const alignX = useSettingValue('desktopLyric.textPosition.x')
  const lyricLines = useLrcSet()
  const { line } = useLrcPlay()
  const windowSize = useWindowSize()

  if (Platform.OS !== 'ios' || !enabled) return null

  const currentIndex = lyricLines.length
    ? Math.max(0, Math.min(line, lyricLines.length - 1))
    : 0
  const count = isSingleLine ? 1 : Math.max(1, maxLineNum)
  const visibleLines = lyricLines.length
    ? lyricLines.slice(currentIndex, currentIndex + count)
    : [EMPTY_LINE]
  const fontSize = Math.max(12, fontSizeSetting / 10)
  const textAlign = alignX === 'center' ? 'center' : alignX === 'right' ? 'right' : 'left'
  const panelWidth = Math.min(windowSize.width - 24, (windowSize.width - 24) * widthPercent / 100)

  const openPlayDetail = () => {
    if (commonState.componentIds.home) {
      navigations.pushPlayDetailScreen(commonState.componentIds.home)
    }
  }

  return (
    <View pointerEvents="box-none" style={{
      position: 'absolute',
      zIndex: 1000,
      top: 66,
      left: 0,
      right: 0,
      alignItems: 'center',
    }}>
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={openPlayDetail}
        style={{
          width: panelWidth,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: 'rgba(12, 12, 14, 0.68)',
          opacity: Math.max(0.15, opacitySetting / 100),
        }}
      >
        {visibleLines.map((lyricLine, index) => (
          <View key={`${lyricLine.time}-${index}`} style={{ paddingVertical: 2 }}>
            <Text
              size={index === 0 ? fontSize : fontSize * 0.88}
              color={index === 0 ? playedColor : unplayColor}
              numberOfLines={2}
              style={{
                textAlign,
                lineHeight: fontSize * 1.35,
                textShadowColor: shadowColor,
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }}
            >{lyricLine.text}</Text>
            {index === 0 && !isSingleLine && lyricLine.extendedLyrics.map((extended, extendedIndex) => (
              <Text
                key={extendedIndex}
                size={fontSize * 0.72}
                color={playedColor}
                numberOfLines={1}
                style={{ textAlign, lineHeight: fontSize * 1.1, opacity: 0.82 }}
              >{extended}</Text>
            ))}
          </View>
        ))}
      </TouchableOpacity>
    </View>
  )
}
