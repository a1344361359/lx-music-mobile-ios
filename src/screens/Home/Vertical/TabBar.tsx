import { memo } from 'react'
import { Platform, TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { NAV_MENUS } from '@/config/constant'
import { useI18n } from '@/lang'
import { setNavActiveId } from '@/core/common'
import { useNavActiveId } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { useKeyboard } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const activeId = useNavActiveId()
  const { keyboardShown } = useKeyboard()

  if (Platform.OS !== 'ios' || keyboardShown) return null

  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-main-background'], borderTopColor: theme['c-border-background'] }}>
      {NAV_MENUS.map(menu => {
        const active = activeId === menu.id
        const color = active ? theme['c-primary-font-active'] : theme['c-font-label']
        return (
          <TouchableOpacity
            key={menu.id}
            activeOpacity={0.6}
            style={styles.item}
            onPress={() => { setNavActiveId(menu.id) }}
          >
            <Icon name={menu.icon} size={22} color={color} />
            <Text size={10} color={color} style={styles.label}>{t(menu.id)}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
})

const styles = createStyle({
  container: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 0.5,
  },
  item: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    marginTop: 3,
    textAlign: 'center',
  },
})
