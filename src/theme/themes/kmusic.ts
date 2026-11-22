import { createThemeColors } from './utils'

const kmusicTheme = {
  id: 'kmusic',
  name: 'KMusic 暗夜',
  isDark: true,
  isCustom: false,
  config: {
    primary: 'rgb(255, 59, 48)',
    themeColors: {
      ...(createThemeColors('rgb(255, 59, 48)', 'rgb(245, 245, 247)', true) as Record<string, string>),
      'c-primary-light-1000': 'rgb(10, 10, 13)',
    },
    extInfo: {
      'c-app-background': 'rgb(8, 8, 10)',
      'c-main-background': 'rgb(12, 12, 16)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',
      'c-badge-primary': '#ff3b30',
      'c-badge-secondary': '#ff9f0a',
      'c-badge-tertiary': '#30d158',
    },
  },
}

export default kmusicTheme as unknown as LX.Theme
