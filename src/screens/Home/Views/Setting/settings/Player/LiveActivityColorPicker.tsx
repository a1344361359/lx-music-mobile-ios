import { memo, useEffect, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'

import Input from '@/components/common/Input'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { LIVE_ACTIVITY_COLOR_PRESETS, normalizeHexColor } from '@/utils/color'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
}

export default memo(({ label, value, onChange }: Props) => {
  const theme = useTheme()
  const [text, setText] = useState(value)

  useEffect(() => {
    setText(value)
  }, [value])

  const commit = () => {
    const color = normalizeHexColor(text, value)
    setText(color)
    if (color !== value) onChange(color)
  }

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text size={13} color={theme['c-font-label']}>{label}</Text>
        <Text size={11} color={theme['c-font-label']}>{text}</Text>
      </View>
      <View style={styles.swatches}>
        {LIVE_ACTIVITY_COLOR_PRESETS.map(color => {
          const selected = color.toUpperCase() === value.toUpperCase()
          return (
            <TouchableOpacity
              key={color}
              activeOpacity={0.75}
              onPress={() => {
                setText(color)
                onChange(color)
              }}
              style={[
                styles.swatch,
                { backgroundColor: color, borderColor: selected ? theme['c-font'] : 'rgba(255,255,255,0.18)' },
              ]}
            >
              {selected ? <View style={styles.swatchInner} /> : null}
            </TouchableOpacity>
          )
        })}
      </View>
      <View style={styles.inputRow}>
        <View style={[styles.previewDot, { backgroundColor: normalizeHexColor(text, value) }]} />
        <Input
          value={text}
          onChangeText={setText}
          onBlur={commit}
          onSubmitEditing={commit}
          maxLength={7}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="#31C27C"
          style={{
            ...styles.input,
            backgroundColor: theme['c-primary-input-background'],
            color: theme['c-font'],
          }}
        />
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
    paddingRight: 4,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    marginRight: 9,
    marginBottom: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  input: {
    width: 110,
    height: 32,
    borderRadius: 4,
    paddingLeft: 8,
    paddingRight: 8,
    fontSize: 13,
    flexGrow: 0,
  },
})
