import { createThemeColors } from './utils'
import { normalizeHexColor } from '@/utils/color'

export const LIQUID_GLASS_DEFAULT_COLOR = '#B8AEC9'
export const LIQUID_GLASS_DEFAULT_TRANSPARENCY = 38

const toRgb = (hex: string): string => {
  const value = hex.slice(1)
  return `rgb(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)})`
}

const rgba = (hex: string, alpha: number): string => {
  const value = hex.slice(1)
  return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${alpha})`
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export const makeLiquidGlassTheme = (
  color = LIQUID_GLASS_DEFAULT_COLOR,
  transparency = LIQUID_GLASS_DEFAULT_TRANSPARENCY,
): LX.Theme => {
  const hex = normalizeHexColor(color, LIQUID_GLASS_DEFAULT_COLOR)
  const t = clamp(Number.isFinite(transparency) ? transparency : LIQUID_GLASS_DEFAULT_TRANSPARENCY, 0, 100) / 100
  // 透明度越高，玻璃越透；保留最低底色，避免文字和控件完全失去承托。
  const appAlpha = 0.92 - 0.78 * t
  const panelAlpha = 0.84 - 0.68 * t
  const contentAlpha = 0.92 - 0.72 * t
  const primary = toRgb(hex)
  const font = 'rgb(245, 246, 250)'
  return {
    id: 'liquid_glass',
    name: '液态玻璃',
    isDark: true,
    isCustom: false,
    config: {
      primary,
      themeColors: {
        ...(createThemeColors(primary, font, true) as Record<string, string>),
        'c-primary-light-1000': rgba('#080A12', contentAlpha),
      },
      extInfo: {
        'c-app-background': rgba('#05070E', appAlpha),
        'c-main-background': rgba('#080A13', panelAlpha),
        'bg-image': 'liquid_glass.jpg',
        'bg-image-position': 'center',
        'bg-image-size': 'cover',
        'c-badge-primary': hex,
        'c-badge-secondary': '#FFD166',
        'c-badge-tertiary': '#7CFFCB',
      },
    },
  } as unknown as LX.Theme
}

const liquidGlassTheme = makeLiquidGlassTheme()

export default liquidGlassTheme
