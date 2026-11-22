import { memo } from 'react'

import { View } from 'react-native'

import CheckBox, { type CheckBoxProps } from '@/components/common/CheckBox'
import { createStyle } from '@/utils/tools'
import { useUIScale } from '@/components/common/UIScaleContext'


export default memo((props: CheckBoxProps) => {
  const scale = useUIScale()
  return (
    <View style={{ ...styles.container, paddingLeft: styles.container.paddingLeft * scale }}>
      <CheckBox {...props} />
    </View>
  )
})

const styles = createStyle({
  container: {
    paddingLeft: 25,
    // marginTop: -10,
    // marginBottom: 0,
  },
})

