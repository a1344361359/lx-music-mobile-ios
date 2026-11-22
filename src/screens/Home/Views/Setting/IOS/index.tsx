import { useCallback, useEffect, useState } from 'react'
import { BackHandler, ScrollView, TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { type SettingScreenIds } from '../Main'
import { UIScaleContext } from '@/components/common/UIScaleContext'
import Detail from './Detail'

const DETAIL_SCALE = 1.5

const GROUPS: Array<{ title: string, ids: SettingScreenIds[] }> = [
  { title: '常用', ids: ['basic', 'player', 'lyric_desktop'] },
  { title: '内容与数据', ids: ['search', 'list', 'sync', 'backup', 'platform_auth'] },
  { title: '其他', ids: ['other', 'version', 'about'] },
]

const Row = ({ id, last, onPress }: { id: SettingScreenIds, last: boolean, onPress: (id: SettingScreenIds) => void }) => {
  const t = useI18n()
  const theme = useTheme()
  return (
    <TouchableOpacity
      activeOpacity={0.65}
      style={{
        ...styles.row,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: theme['c-border-background'],
      }}
      onPress={() => { onPress(id) }}
    >
      <Text size={16} style={styles.rowLabel}>{t(`setting_${id}`)}</Text>
      <Icon name="chevron-right" size={13} color={theme['c-font-label']} />
    </TouchableOpacity>
  )
}

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const [active, setActive] = useState<SettingScreenIds | null>(null)

  const handleBack = useCallback(() => {
    setActive(null)
    return true
  }, [])

  useEffect(() => {
    const openDetail = (id: SettingScreenIds) => { setActive(id) }
    global.app_event.on('iosSettingOpenDetail', openDetail)
    return () => { global.app_event.off('iosSettingOpenDetail', openDetail) }
  }, [])

  useEffect(() => {
    if (!active) return
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBack)
    return () => { sub.remove() }
  }, [active, handleBack])

  if (active) {
    return (
      <View style={{ flex: 1, backgroundColor: theme['c-content-background'] }}>
        <View style={{ ...styles.navBar, borderBottomColor: theme['c-border-background'] }}>
          <TouchableOpacity style={styles.backBtn} activeOpacity={0.6} onPress={() => { setActive(null) }}>
            <Icon name="chevron-left" size={22} color={theme['c-primary-font-active']} />
            <Text size={16} color={theme['c-primary-font-active']}>设置</Text>
          </TouchableOpacity>
          <Text size={17} style={styles.navTitle}>{t(`setting_${active}`)}</Text>
          <View style={styles.backBtn} />
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ ...styles.detailContent, paddingTop: styles.detailContent.paddingTop * DETAIL_SCALE }}
          keyboardShouldPersistTaps="always"
        >
          <UIScaleContext.Provider value={DETAIL_SCALE}>
            <Detail id={active} />
          </UIScaleContext.Provider>
        </ScrollView>
      </View>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme['c-content-background'] }}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="always"
    >
      <Text size={30} style={styles.largeTitle}>设置</Text>
      {GROUPS.map(group => (
        <View key={group.title} style={styles.group}>
          <Text size={12} color={theme['c-font-label']} style={styles.groupTitle}>{group.title}</Text>
          <View style={{ ...styles.card, backgroundColor: theme['c-main-background'] }}>
            {group.ids.map((id, index) => (
              <Row key={id} id={id} last={index === group.ids.length - 1} onPress={setActive} />
            ))}
          </View>
        </View>
      ))}
      <Text size={11} color={theme['c-font-label']} style={styles.footer}>KMusic · iOS</Text>
    </ScrollView>
  )
}

const styles = createStyle({
  scroll: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
  },
  largeTitle: {
    fontWeight: '700',
    marginBottom: 18,
    marginLeft: 2,
  },
  group: { marginBottom: 22 },
  groupTitle: {
    marginLeft: 16,
    marginBottom: 7,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 14,
  },
  rowLabel: { flex: 1 },
  navBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 74,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 2,
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  detailContent: {
    paddingTop: 18,
    paddingBottom: 30,
  },
  footer: {
    textAlign: 'center',
    marginTop: 10,
  },
})
