import { memo } from 'react'

import Button, { type BtnProps } from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { useUIScale } from '@/components/common/UIScaleContext'

type ButtonProps = BtnProps

export default memo(({ disabled, onPress, children }: ButtonProps) => {
  const theme = useTheme()
  const scale = useUIScale()

  return (
    <Button style={{ ...styles.button, backgroundColor: theme['c-button-background'], paddingLeft: styles.button.paddingLeft * scale, paddingRight: styles.button.paddingRight * scale, paddingTop: styles.button.paddingTop * scale, paddingBottom: styles.button.paddingBottom * scale, marginRight: styles.button.marginRight * scale }} onPress={onPress} disabled={disabled}>
      <Text size={14} color={theme['c-button-font']}>{children}</Text>
    </Button>
  )
})

const styles = createStyle({
  button: {
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 5,
    paddingBottom: 5,
    borderRadius: 4,
    marginRight: 10,
  },
})
