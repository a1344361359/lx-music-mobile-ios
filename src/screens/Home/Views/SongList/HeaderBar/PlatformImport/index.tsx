import { useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Button from '@/components/common/Button'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import Input, { type InputType } from '@/components/common/Input'
import Text from '@/components/common/Text'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createList } from '@/core/list'
import { fetchPlatformPlaylist, PlatformPlaylistError, PLATFORMS, toPlatformMusicInfo, type PlatformId } from '@/utils/platformPlaylist'
import { getPlatformAuthValue, savePlatformAuthValue } from '@/utils/platformAuth'

const styles = createStyle({
  button: { alignItems: 'center', justifyContent: 'center', paddingLeft: 8, paddingRight: 8 },
  content: { flexGrow: 1, flexShrink: 1, flexDirection: 'column' },
  platforms: { flexDirection: 'row', marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginRight: 6, marginBottom: 6, borderWidth: 1 },
  input: { flexGrow: 1, flexShrink: 1, minWidth: 280, height: 38 },
  authInput: { flexGrow: 1, flexShrink: 1, minWidth: 280, height: 38, marginTop: 8 },
  tip: { marginTop: 8 },
})

const authPlaceholder = 'Cookie / Token（可选；私有歌单或酷我必填）'

export default () => {
  const alertRef = useRef<ConfirmAlertType>(null)
  const inputRef = useRef<InputType>(null)
  const [platform, setPlatform] = useState<PlatformId>('soda')
  const [text, setText] = useState('')
  const [auth, setAuth] = useState('')
  const [loading, setLoading] = useState(false)
  const theme = useTheme()
  const t = useI18n()

  const meta = PLATFORMS.find(item => item.id === platform)!

  const show = () => {
    void getPlatformAuthValue(platform).then(value => setAuth(value))
    alertRef.current?.setVisible(true)
    setTimeout(() => inputRef.current?.focus(), 300)
  }

  const selectPlatform = (id: PlatformId) => {
    setPlatform(id)
    setText('')
    void getPlatformAuthValue(id).then(value => setAuth(value))
  }

  const handleConfirm = async() => {
    const value = text.trim()
    if (!value || loading) return
    setLoading(true)
    try {
      const playlist = await fetchPlatformPlaylist(platform, value, auth)
      if (!playlist.tracks.length) throw new PlatformPlaylistError('empty')
      await createList({
        name: `${meta.short}·${playlist.title}`,
        list: playlist.musicInfos?.length ? playlist.musicInfos : playlist.tracks.map(track => toPlatformMusicInfo(platform, track, playlist.cover)),
      })
      await savePlatformAuthValue(platform, auth)
      alertRef.current?.setVisible(false)
      setText('')
      toast(`已导入「${playlist.title}」，共 ${playlist.tracks.length} 首`, 'long')
    } catch (error) {
      const code = error instanceof PlatformPlaylistError ? error.code : 'network'
      switch (code) {
        case 'invalid': toast('链接或 ID 无效，请检查后重试', 'long'); break
        case 'auth': toast(`${meta.name} 需要 Cookie / Token 才能读取这个歌单`, 'long'); break
        case 'empty': toast('歌单为空或没有可读取的歌曲', 'long'); break
        case 'unsupported': toast('暂不支持这个平台', 'long'); break
        default: toast('网络错误或平台接口暂时不可用，请稍后重试', 'long')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button style={styles.button} onPress={show}>
        <Text size={13}>{t('songlist_platform_import')}</Text>
      </Button>
      <ConfirmAlert
        ref={alertRef}
        title={t('songlist_platform_import_title')}
        confirmText={loading ? t('songlist_platform_import_loading') : t('songlist_platform_import_btn')}
        disabledConfirm={loading}
        onConfirm={() => { void handleConfirm() }}
        onHide={() => { if (!loading) setText('') }}
      >
        <View style={styles.content}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.platforms}>
            {PLATFORMS.map(item => {
              const active = item.id === platform
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.chip, {
                    borderColor: active ? item.color : theme['c-border-background'],
                    backgroundColor: active ? `${item.color}22` : 'transparent',
                  }]}
                  onPress={() => selectPlatform(item.id)}
                >
                  <Text size={13} color={active ? item.color : theme['c-font-label']}>{item.name}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          <Input
            ref={inputRef}
            placeholder={meta.placeholder}
            value={text}
            onChangeText={setText}
            clearBtn
            style={{ ...styles.input, backgroundColor: theme['c-primary-input-background'] }}
          />
          <Input
            placeholder={authPlaceholder}
            value={auth}
            onChangeText={setAuth}
            clearBtn
            style={{ ...styles.authInput, backgroundColor: theme['c-primary-input-background'] }}
          />
          <Text style={styles.tip} size={12} color={theme['c-600']}>
            支持汽水、网易云、QQ、酷狗、酷我；公开歌单可直接导入，私有歌单需要粘贴对应平台 Cookie / Token。凭证只保存在本机，不会上传。
          </Text>
        </View>
      </ConfirmAlert>
    </>
  )
}
