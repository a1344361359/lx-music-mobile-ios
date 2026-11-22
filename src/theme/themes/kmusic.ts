import { createThemeColors } from './utils'
import { normalizeHexColor } from '@/utils/color'

export const KMUSIC_DEFAULT_ACCENT = '#FF3B30'

const toRgb = (hex: string): string => {
  const value = normalizeHexColor(hex, KMUSIC_DEFAULT_ACCENT).slice(1)
  return `rgb(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)})`
}

export const hexToRgba = (hex: string, alpha: number): string => {
  const value = normalizeHexColor(hex, KMUSIC_DEFAULT_ACCENT).slice(1)
  return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${alpha})`
}

export const makeKMusicTheme = (id: 'kmusic' | 'kmusic_light', accent = KMUSIC_DEFAULT_ACCENT): LX.Theme => {
  const color = normalizeHexColor(accent, KMUSIC_DEFAULT_ACCENT)
  const isDark = id === 'kmusic'
  const primary = toRgb(color)
  return {
    id,
    name: isDark ? 'KMusic 暗夜' : 'KMusic 浅色',
    isDark,
    isCustom: false,
    config: {
      primary,
      themeColors: {
        ...(createThemeColors(primary, isDark ? 'rgb(245, 245, 247)' : 'rgb(28, 28, 30)', isDark) as Record<string, string>),
        'c-primary-light-1000': isDark ? 'rgb(10, 10, 13)' : 'rgb(245, 245, 247)',
      },
      extInfo: {
        'c-app-background': isDark ? 'rgb(8, 8, 10)' : 'rgb(245, 245, 247)',
        'c-main-background': isDark ? 'rgb(12, 12, 16)' : 'rgb(242, 242, 245)',
        'bg-image': '',
        'bg-image-position': 'center',
        'bg-image-size': 'cover',
        'c-badge-primary': color,
        'c-badge-secondary': '#ff9f0a',
        'c-badge-tertiary': '#30d158',
      },
    },
  } as unknown as LX.Theme
}

const kmusicTheme = makeKMusicTheme('kmusic')
export const kmusicLightTheme = makeKMusicTheme('kmusic_light')

export default kmusicTheme
