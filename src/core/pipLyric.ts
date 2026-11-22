import type { Line } from '@/plugins/lyric'

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

const formatTimestamp = (milliseconds: number) => {
  const total = Math.max(0, Math.round(milliseconds))
  const hours = Math.floor(total / 3600000)
  const minutes = Math.floor(total % 3600000 / 60000)
  const seconds = Math.floor(total % 60000 / 1000)
  const millis = total % 1000
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`
}

const escapeCue = (text: string) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\r/g, '')

/**
 * Builds a WebVTT track for the system Picture-in-Picture video. Each LRC line
 * becomes one cue and its translation/romanization stays on the next line.
 */
export const buildPipLyricVtt = (lines: readonly Line[]) => {
  if (!lines.length) return 'WEBVTT\n\n'

  const cues: string[] = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const text = line.text.trim()
    if (!text) continue

    const nextTime = lines[index + 1]?.time
    const start = Math.max(0, line.time)
    const end = nextTime != null && nextTime > start ? nextTime : start + (index === lines.length - 1 ? 12000 : 4000)
    const cueLines = [text, ...line.extendedLyrics.map(item => item.trim()).filter(Boolean)]
    cues.push(`${formatTimestamp(start)} --> ${formatTimestamp(end)}\n${escapeCue(cueLines.join('\n'))}`)
  }

  return `WEBVTT\n\n${cues.join('\n\n')}\n`
}
