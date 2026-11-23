import { memo, useState } from 'react'
import { ActivityIndicator, ImageBackground, StyleSheet, TouchableOpacity, View } from 'react-native'
import SubTitle from '../../components/SubTitle'
import CheckBoxItem from '../../components/CheckBoxItem'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { applyTheme } from '@/core/theme'
import { getTheme } from '@/theme/themes'
import { updateSetting } from '@/core/common'
import { pickPhoto } from '@/utils/nativeModules/photoPicker'
import { createStyle, toast } from '@/utils/tools'
import { mkdir, moveFile, privateStorageDirectoryPath, unlink } from '@/utils/fs'
import { useI18n } from '@/lang'

const styles = createStyle({
  preview: {
    height: 128,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  previewMask: {
    ...StyleSheet.absoluteFillObject,
  },
  previewLabel: {
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  choose: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 16,
  },
  reset: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  tip: {
    marginTop: 8,
    lineHeight: 19,
  },
})

export default memo(() => {
  const t = useI18n()
  const wallpaper = useSettingValue('theme.glassWallpaper')
  const blur = useSettingValue('theme.glassWallpaperBlur')
  const theme = useTheme()
  const [busy, setBusy] = useState(false)
  const uri = wallpaper ? (wallpaper.startsWith('file://') ? wallpaper : `file://${wallpaper}`) : undefined

  const chooseWallpaper = async() => {
    if (busy) return
    setBusy(true)
    try {
      const file = await pickPhoto()
      if (!file) return
      const folder = `${privateStorageDirectoryPath}/theme_images`
      try { await mkdir(folder) } catch {}
      const target = `${folder}/theme-wallpaper-${Date.now()}.jpg`
      if (wallpaper) await unlink(wallpaper)
      await moveFile(file, target)
      // 新选的照片默认保持清晰，是否虚化交给下面的开关。
      updateSetting({ 'theme.glassWallpaper': target, 'theme.glassWallpaperBlur': false })
      void getTheme().then(applyTheme)
      toast(t('setting_basic_theme_wallpaper_saved'))
    } catch (error: any) {
      if (error?.code !== 'picker_cancelled' && error?.code !== 'picker_busy') {
        toast(`${t('setting_basic_theme_wallpaper_failed')}${error?.message ?? ''}`, 'long')
      }
    } finally {
      setBusy(false)
    }
  }

  const clearWallpaper = async() => {
    try { if (wallpaper) await unlink(wallpaper) } catch {}
    updateSetting({ 'theme.glassWallpaper': '', 'theme.glassWallpaperBlur': false })
    void getTheme().then(applyTheme)
  }

  return (
    <SubTitle title={t('setting_basic_theme_wallpaper')}>
      <View style={[styles.preview, { borderColor: theme['c-border-background'], backgroundColor: theme['c-main-background'] }]}>
        {uri
          ? <ImageBackground source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" blurRadius={blur ? 18 : 0} />
          : null}
        <View style={[styles.previewMask, { backgroundColor: theme['c-content-background'], opacity: uri ? 0.62 : 0.9 }]} />
        <Text style={styles.previewLabel} color={theme['c-font']} numberOfLines={1}>
          {wallpaper ? wallpaper.split('/').pop() : t('setting_basic_theme_wallpaper_none')}
        </Text>
      </View>
      <CheckBoxItem
        label={t('setting_basic_theme_wallpaper_blur')}
        check={blur}
        disabled={!wallpaper}
        onChange={(check) => {
          updateSetting({ 'theme.glassWallpaperBlur': check })
          void getTheme().then(applyTheme)
        }}
      />
      <TouchableOpacity
        activeOpacity={0.75}
        disabled={busy}
        style={[styles.choose, { backgroundColor: theme['c-primary-background'] }]}
        onPress={() => { void chooseWallpaper() }}
      >
        {busy
          ? <ActivityIndicator size="small" color={theme['c-primary-font']} />
          : <Text size={14} color={theme['c-primary-font']}>{t('setting_basic_theme_wallpaper_choose')}</Text>}
      </TouchableOpacity>
      {wallpaper
        ? <TouchableOpacity
          style={[styles.reset, { backgroundColor: theme['c-primary-background'] }]}
          onPress={() => { void clearWallpaper() }}
        >
          <Text size={13} color={theme['c-primary-font']}>{t('setting_basic_theme_wallpaper_reset')}</Text>
        </TouchableOpacity>
        : null}
      <Text style={styles.tip} size={12} color={theme['c-font-label']}>
        {t('setting_basic_theme_wallpaper_tip')}
      </Text>
    </SubTitle>
  )
})
