import { useEffect, useState } from 'react'
import { Linking, TouchableOpacity, View } from 'react-native'
import Section from '../../components/Section'
import Text from '@/components/common/Text'
import Input from '@/components/common/Input'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { PLATFORMS, type PlatformId } from '@/utils/platformPlaylist'
import { getPlatformAuth, savePlatformAuthValue } from '@/utils/platformAuth'

const LOGIN_URLS: Partial<Record<PlatformId, string>> = {
  netease: 'https://music.163.com/#/login',
  qq: 'https://y.qq.com/',
  kugou: 'https://www.kugou.com/',
  kuwo: 'https://www.kuwo.cn/',
}

const styles = createStyle({
  row: { marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  name: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  input: { borderRadius: 8, minHeight: 38 },
  tip: { marginTop: 6 },
  actions: { flexDirection: 'row', marginTop: 8 },
  action: { marginRight: 16 },
})

const AuthRow = ({ platform, value, onSaved }: { platform: typeof PLATFORMS[number]; value: string; onSaved: (value: string) => void }) => {
  const theme = useTheme()
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const url = LOGIN_URLS[platform.id]

  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <View style={styles.name}>
          <View style={[styles.dot, { backgroundColor: platform.color }]} />
          <Text size={15}>{platform.name}</Text>
        </View>
        {url ? <TouchableOpacity onPress={() => { void Linking.openURL(url) }}><Text size={12} color={theme['c-primary-font']}>打开登录页</Text></TouchableOpacity> : null}
      </View>
      <Input
        value={text}
        onChangeText={setText}
        placeholder="Cookie / Token（只保存在本机）"
        clearBtn
        style={{ ...styles.input, backgroundColor: theme['c-primary-input-background'] }}
      />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={() => { void savePlatformAuthValue(platform.id, text).then(() => { onSaved(text); toast('凭证已保存', 'short') }) }}>
          <Text size={13} color={theme['c-primary-font']}>保存凭证</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setText(''); void savePlatformAuthValue(platform.id, '').then(() => { onSaved(''); toast('凭证已清除', 'short') }) }}>
          <Text size={13} color={theme['c-font-label']}>清除</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default () => {
  const [auth, setAuth] = useState<Partial<Record<PlatformId, string>>>({})
  useEffect(() => { void getPlatformAuth().then(setAuth) }, [])

  return (
    <Section title="平台凭证">
      <View style={{ paddingLeft: 25, paddingRight: 16 }}>
        <Text size={13} style={{ marginBottom: 16 }}>
          用于读取私有歌单。公开歌单不填也能导入；酷我接口需要 Cookie。凭证只写入本机存储，不会上传到任何服务器。
        </Text>
        {PLATFORMS.filter(item => item.id !== 'soda').map(platform => (
          <AuthRow
            key={platform.id}
            platform={platform}
            value={auth[platform.id] ?? ''}
            onSaved={value => setAuth(prev => ({ ...prev, [platform.id]: value }))}
          />
        ))}
      </View>
    </Section>
  )
}
