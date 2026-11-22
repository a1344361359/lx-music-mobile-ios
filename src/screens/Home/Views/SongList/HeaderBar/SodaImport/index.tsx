import { useRef, useState } from 'react'
import { View } from 'react-native'
import Button from '@/components/common/Button'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import Input, { type InputType } from '@/components/common/Input'
import Text from '@/components/common/Text'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createList } from '@/core/list'
import { fetchSodaPlaylist, SodaError, toSodaMusicInfo, type SodaErrorCode } from '@/utils/soda'

const styles = createStyle({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
    paddingRight: 8,
  },
  content: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'column',
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 280,
    height: 38,
  },
  tip: {
    marginTop: 15,
  },
})

export default () => {
  const alertRef = useRef<ConfirmAlertType>(null)
  const inputRef = useRef<InputType>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const theme = useTheme()
  const t = useI18n()

  const show = () => {
    alertRef.current?.setVisible(true)
    setTimeout(() => inputRef.current?.focus(), 300)
  }

  const handleConfirm = async() => {
    const value = text.trim()
    if (!value || loading) return
    setLoading(true)
    try {
      const playlist = await fetchSodaPlaylist(value)
      const list = playlist.tracks.map(track => toSodaMusicInfo(track, playlist.cover))
      if (!list.length) throw new SodaError('empty')
      await createList({
        name: `汽水·${playlist.title}`,
        list,
      })
      alertRef.current?.setVisible(false)
      setText('')
      toast(t('songlist_soda_import_success', { name: playlist.title, count: list.length }), 'long')
    } catch (error) {
      const code: SodaErrorCode = error instanceof SodaError ? error.code : 'network'
      switch (code) {
        case 'invalid':
          toast(t('songlist_soda_import_invalid'), 'long')
          break
        case 'private':
          toast(t('songlist_soda_import_private'), 'long')
          break
        case 'empty':
          toast(t('songlist_soda_import_empty'), 'long')
          break
        default:
          toast(t('songlist_soda_import_network'), 'long')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button style={styles.button} onPress={show}>
        <Text size={13}>{t('songlist_soda_import')}</Text>
      </Button>
      <ConfirmAlert
        ref={alertRef}
        title={t('songlist_soda_import_title')}
        confirmText={loading ? t('songlist_soda_import_loading') : t('songlist_soda_import_btn')}
        disabledConfirm={loading}
        onConfirm={() => { void handleConfirm() }}
        onHide={() => { if (!loading) setText('') }}
      >
        <View style={styles.content}>
          <Input
            ref={inputRef}
            placeholder={t('songlist_soda_import_placeholder')}
            value={text}
            onChangeText={setText}
            clearBtn
            style={{ ...styles.input, backgroundColor: theme['c-primary-input-background'] }}
          />
          <Text style={styles.tip} size={13} color={theme['c-600']}>{t('songlist_soda_import_tip')}</Text>
        </View>
      </ConfirmAlert>
    </>
  )
}
