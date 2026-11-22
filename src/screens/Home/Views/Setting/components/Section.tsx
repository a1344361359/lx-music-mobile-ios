import { View } from 'react-native'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useUIScale } from '@/components/common/UIScaleContext'


interface Props {
  title: string
  children: React.ReactNode | React.ReactNode[]
}

export default ({ title, children }: Props) => {
  const theme = useTheme()
  const scale = useUIScale()

  return (
    <View style={styles.container}>
      <Text style={{ ...styles.title, borderLeftColor: theme['c-primary'], borderLeftWidth: styles.title.borderLeftWidth * scale, paddingLeft: styles.title.paddingLeft * scale, marginBottom: styles.title.marginBottom * scale }} size={15} >{title}</Text>
      <View>
        {children}
      </View>
    </View>
  )
}


const styles = createStyle({
  container: {
    // paddingLeft: 10,
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  title: {
    borderLeftWidth: 5,
    paddingLeft: 12,
    marginBottom: 10,
    // lineHeight: 16,
  },
})
