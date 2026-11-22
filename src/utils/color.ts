const HEX_COLOR_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

export const normalizeHexColor = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback
  const raw = value.trim()
  if (!HEX_COLOR_RE.test(raw)) return fallback
  let hex = raw.replace(/^#/, '').toUpperCase()
  if (hex.length === 3) hex = hex.split('').map(char => char + char).join('')
  return `#${hex}`
}

export const isHexColor = (value: string): boolean => HEX_COLOR_RE.test(value.trim())

export const LIVE_ACTIVITY_COLOR_PRESETS = [
  '#31C27C',
  '#22D3EE',
  '#60A5FA',
  '#A78BFA',
  '#F472B6',
  '#FB923C',
  '#F87171',
  '#FACC15',
  '#FFFFFF',
  '#A1A1AA',
] as const
