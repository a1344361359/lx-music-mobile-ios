/* eslint-disable @typescript-eslint/no-var-requires */
import { getUserTheme, saveUserTheme } from '@/utils/data'
import themes from '@/theme/themes/themes'
import kmusicTheme, { hexToRgba, kmusicLightTheme, makeKMusicTheme } from '@/theme/themes/kmusic'
import liquidGlassTheme, { makeLiquidGlassTheme } from '@/theme/themes/liquidGlass'
import settingState from '@/store/setting/state'
import themeState from '@/store/theme/state'
import { isUrl } from '@/utils'
import { privateStorageDirectoryPath } from '@/utils/fs'
import { type ImageSourcePropType } from 'react-native'

const allThemes = [...themes, kmusicTheme, kmusicLightTheme, liquidGlassTheme] as LX.Theme[]

export const BG_IMAGES = {
  'china_ink.jpg': require('./images/china_ink.jpg') as ImageSourcePropType,
  'jqbg.jpg': require('./images/jqbg.jpg') as ImageSourcePropType,
  'landingMoon.png': require('./images/landingMoon2.png') as ImageSourcePropType,
  'myzcbg.jpg': require('./images/myzcbg.jpg') as ImageSourcePropType,
  'xnkl.png': require('./images/xnkl.png') as ImageSourcePropType,
  'liquid_glass.jpg': require('./images/liquid_glass.jpg') as ImageSourcePropType,
} as const


let userThemes: LX.Theme[]
export const getAllThemes = async() => {
  // eslint-disable-next-line require-atomic-updates
  userThemes ??= await getUserTheme()
  return {
    themes: allThemes as any,
    userThemes,
    dataPath: privateStorageDirectoryPath + '/theme_images',
  }
}

export const saveTheme = async(theme: LX.Theme) => {
  const targetTheme = userThemes.find(t => t.id === theme.id)
  if (targetTheme) Object.assign(targetTheme, theme)
  else userThemes.push(theme)
  await saveUserTheme(userThemes)
}

export const removeTheme = async(id: string) => {
  const index = userThemes.findIndex(t => t.id === id)
  if (index < 0) return
  userThemes.splice(index, 1)
  await saveUserTheme(userThemes)
}

export type LocalTheme = typeof themes[number]
type ColorsKey = keyof LX.Theme['config']['themeColors']
type ExtInfoKey = keyof LX.Theme['config']['extInfo']
const varColorRxp = /^var\((.+)\)$/
export const buildActiveThemeColors = (theme: LX.Theme): LX.ActiveTheme => {
  let bgImg: ImageSourcePropType | undefined
  if (theme.isCustom) {
    if (theme.config.extInfo['bg-image']) {
      theme.config.extInfo['bg-image'] =
        isUrl(theme.config.extInfo['bg-image'])
          ? theme.config.extInfo['bg-image']
          : `${privateStorageDirectoryPath}/theme_images/${theme.config.extInfo['bg-image']}`
    }
  } else {
    const extInfo = (theme as LocalTheme).config.extInfo
    if (extInfo['bg-image']) {
      if (theme.id === 'liquid_glass' || !theme.isDark || !settingState.setting['theme.hideBgDark']) bgImg = BG_IMAGES[extInfo['bg-image']]
    }
  }

  theme.config.extInfo = { ...theme.config.extInfo }

  for (const [k, v] of Object.entries(theme.config.extInfo) as Array<[ExtInfoKey, LX.Theme['config']['extInfo'][ExtInfoKey]]>) {
    if (!v.startsWith('var(')) continue
    theme.config.extInfo[k] = theme.config.themeColors[v.replace(varColorRxp, '$1') as ColorsKey]
  }

  const active = {
    id: theme.id,
    name: theme.name,
    isDark: theme.isDark,
    ...theme.config.themeColors,
    ...theme.config.extInfo,
    'c-font': theme.config.themeColors['c-850'],
    'c-font-label': theme.config.themeColors['c-450'],
    'c-primary-font': theme.config.themeColors['c-primary'],
    'c-primary-font-hover': theme.config.themeColors['c-primary-alpha-300'],
    'c-primary-font-active': theme.config.themeColors['c-primary-dark-100-alpha-200'],
    'c-primary-background': theme.config.themeColors['c-primary-light-400-alpha-700'],
    'c-primary-background-hover': theme.config.themeColors['c-primary-light-300-alpha-800'],
    'c-primary-background-active': theme.config.themeColors['c-primary-light-100-alpha-800'],
    'c-primary-input-background': theme.config.themeColors['c-primary-light-400-alpha-700'],
    'c-button-font': theme.config.themeColors['c-primary-alpha-100'],
    'c-button-font-selected': theme.config.themeColors['c-primary-dark-100-alpha-100'],
    'c-button-background': theme.config.themeColors['c-primary-light-400-alpha-700'],
    'c-button-background-selected': theme.config.themeColors['c-primary-alpha-600'],
    'c-button-background-hover': theme.config.themeColors['c-primary-light-300-alpha-600'],
    'c-button-background-active': theme.config.themeColors['c-primary-light-100-alpha-600'],
    'c-list-header-border-bottom': theme.config.themeColors['c-primary-alpha-900'],
    'c-content-background': theme.config.themeColors['c-primary-light-1000'],
    'c-border-background': theme.config.themeColors['c-primary-light-100-alpha-700'],
    'bg-image': bgImg,
  } as const
  if (theme.id === 'liquid_glass') {
    const transparency = Math.max(0, Math.min(100, Number(settingState.setting['theme.glassTransparency']) || 0)) / 100
    const contentAlpha = 0.92 - 0.72 * transparency
    const panelAlpha = 0.84 - 0.68 * transparency
    const appAlpha = 0.92 - 0.78 * transparency
    return {
      ...active,
      'c-app-background': `rgba(5, 7, 14, ${appAlpha})`,
      'c-main-background': `rgba(8, 10, 19, ${panelAlpha})`,
      'c-content-background': `rgba(8, 10, 18, ${contentAlpha})`,
      'c-border-background': 'rgba(255, 255, 255, 0.16)',
      'c-font': 'rgb(245, 246, 250)',
      'c-font-label': 'rgba(255, 255, 255, 0.62)',
      'c-primary-background': hexToRgba(settingState.setting['theme.glassColor'], 0.2),
      'c-primary-background-active': hexToRgba(settingState.setting['theme.glassColor'], 0.3),
    } as const
  }
  if (theme.id === 'kmusic' || theme.id === 'kmusic_light') {
    const isDark = theme.isDark
    const accent = settingState.setting['theme.kmusicAccentColor']
    return {
      ...active,
      'c-app-background': isDark ? 'rgb(8, 8, 10)' : 'rgb(245, 245, 247)',
      'c-main-background': isDark ? 'rgb(12, 12, 16)' : 'rgb(242, 242, 245)',
      'c-content-background': isDark ? 'rgb(17, 17, 21)' : 'rgb(255, 255, 255)',
      'c-border-background': isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      'c-font': isDark ? 'rgb(245, 245, 247)' : 'rgb(28, 28, 30)',
      'c-font-label': isDark ? 'rgb(142, 142, 147)' : 'rgb(110, 110, 115)',
      'c-primary-background': hexToRgba(accent, isDark ? 0.16 : 0.12),
      'c-primary-background-active': hexToRgba(accent, isDark ? 0.26 : 0.2),
    } as const
  }
  return active
}


// const copyTheme = (theme: LX.Theme): LX.Theme => {
//   return {
//     ...theme,
//     config: {
//       ...theme.config,
//       extInfo: { ...theme.config.extInfo },
//       themeColors: { ...theme.config.themeColors },
//     },
//   }
// }
// type IDS = LocalTheme['id']
export const getTheme = async() => {
  // fs.promises.readdir()
  const shouldUseDarkColors = themeState.shouldUseDarkColors
  // let themeId = settingState.setting['theme.id'] == 'auto'
  //   ? shouldUseDarkColors
  //     ? settingState.setting['theme.darkId']
  //     : settingState.setting['theme.lightId']
  //   // : 'china_ink'
  //   : settingState.setting['theme.id']
  let themeId = settingState.setting['common.isAutoTheme'] && shouldUseDarkColors
    ? 'black'
    : settingState.setting['theme.id']
  // themeId = 'naruto'
  // themeId = 'pink'
  // themeId = 'black'
  let theme: LX.Theme | undefined = allThemes.find(theme => theme.id == themeId)
  if (!theme) {
    userThemes = await getUserTheme()
    theme = userThemes.find(theme => theme.id == themeId)
    if (!theme) {
      themeId = settingState.setting['theme.id'] == 'auto' && shouldUseDarkColors ? 'black' : 'green'
      theme = allThemes.find(theme => theme.id == themeId)
    }
  }

  if (theme && (theme.id === 'kmusic' || theme.id === 'kmusic_light')) {
    theme = makeKMusicTheme(theme.id, settingState.setting['theme.kmusicAccentColor'])
  } else if (theme && theme.id === 'liquid_glass') {
    theme = makeLiquidGlassTheme(settingState.setting['theme.glassColor'], settingState.setting['theme.glassTransparency'])
  }
  return theme!
}
