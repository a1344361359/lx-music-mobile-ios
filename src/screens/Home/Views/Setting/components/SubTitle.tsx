import { memo } from 'react'

import { View } from 'react-native'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useUIScale } from '@/components/common/UIScaleContext'

export default memo(({ title, children }: {
  title: string
  children: React.ReactNode | React.ReactNode[]
}) => {
  const scale = useUIScale()
  return (
    <View style={{ ...styles.container, paddingLeft: styles.container.paddingLeft * scale, marginBottom: styles.container.marginBottom * scale }}>
      <Text style={{ ...styles.title, marginLeft: styles.title.marginLeft * scale, marginBottom: styles.title.marginBottom * scale }}>{title}</Text>
      {children}
    </View>
  )
})


const styles = createStyle({
  container: {
    paddingLeft: 25,
    marginBottom: 18,
  },
  title: {
    marginLeft: -10,
    marginBottom: 10,
    // lineHeight: 16,
  },
})
