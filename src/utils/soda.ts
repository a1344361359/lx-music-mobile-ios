export type SodaErrorCode = 'invalid' | 'private' | 'empty' | 'network'

export class SodaError extends Error {
  code: SodaErrorCode
  constructor(code: SodaErrorCode) {
    super(code)
    this.name = 'SodaError'
    this.code = code
  }
}

interface SodaImage {
  urls?: string[]
  uri?: string
}

interface SodaTrackRaw {
  id?: string
  name?: string
  duration?: number
  artists?: Array<{ name?: string }>
  album?: {
    name?: string
    url_cover?: SodaImage
  }
}

interface SodaPlaylistRaw {
  id?: string
  title?: string
  public_title?: string
  desc?: string
  owner?: { nickname?: string }
  count_tracks?: number
  url_cover?: SodaImage
}

interface SodaPlaylistResponse {
  status_code?: number
  status_info?: { status_msg?: string }
  playlist?: SodaPlaylistRaw
  media_resources?: Array<{
    type?: string
    entity?: { track_wrapper?: { track?: SodaTrackRaw } }
  }>
  next_cursor?: string | number | null
  has_more?: boolean | null
}

export interface SodaTrack {
  id: string
  name: string
  singer: string
  album: string
  duration: number
  cover: string
}

export interface SodaPlaylist {
  id: string
  title: string
  creator: string
  cover: string
  count: number
  tracks: SodaTrack[]
}

const API_URL = 'https://api.qishui.com/luna/pc/playlist/detail'
const REQUEST_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
}
const MAX_PAGES = 20
const PAGE_SIZE = 100

const playlistIdPatterns = [
  /(?:^|[?&#])playlist_id=(\d+)/i,
  /(?:^|[?&#])playlistId=(\d+)/i,
  /"playlist_id"\s*:\s*"?(\d+)"?/i,
  /"playlistId"\s*:\s*"?(\d+)"?/i,
  /playlist\/(\d+)/i,
  /(?:^|[?&#])playlist%2F(\d+)/i,
]

const extractId = (text: string): string => {
  const value = text.trim()
  if (/^\d{10,}$/.test(value)) return value

  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {}

  for (const pattern of playlistIdPatterns) {
    const match = pattern.exec(decoded)
    if (match?.[1]) return match[1]
  }
  return ''
}

const imageUrl = (image?: SodaImage): string => {
  if (!image) return ''
  let url = image.urls?.[0] ?? ''
  if (url && image.uri && !url.includes(image.uri)) url += image.uri
  if (url && !url.includes('~')) url += '~c5_300x300.jpg'
  return url
}

const formatInterval = (duration: number): string | null => {
  if (!duration || duration < 0) return null
  const seconds = Math.round(duration / 1000)
  const minute = Math.floor(seconds / 60)
  const second = seconds % 60
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

const getPlaylistIdFromResponse = async(input: string): Promise<string> => {
  const direct = extractId(input)
  if (direct) return direct
  if (!/^https?:\/\//i.test(input)) throw new SodaError('invalid')

  let response: Response
  try {
    response = await fetch(input, { headers: REQUEST_HEADERS })
  } catch {
    throw new SodaError('network')
  }
  if (!response.ok) throw new SodaError('invalid')

  const finalUrl = response.url || input
  const fromUrl = extractId(finalUrl)
  if (fromUrl) return fromUrl

  let body = ''
  try {
    body = await response.text()
  } catch {}
  const fromBody = extractId(body)
  if (fromBody) return fromBody
  throw new SodaError('invalid')
}

const requestPage = async(id: string, cursor: string): Promise<SodaPlaylistResponse> => {
  const params = [
    `playlist_id=${encodeURIComponent(id)}`,
    `cursor=${encodeURIComponent(cursor)}`,
    `cnt=${PAGE_SIZE}`,
    'aid=386088',
    'device_platform=web',
    'channel=pc_web',
  ]
  let response: Response
  try {
    response = await fetch(`${API_URL}?${params.join('&')}`, { headers: REQUEST_HEADERS })
  } catch {
    throw new SodaError('network')
  }
  if (!response.ok) {
    throw new SodaError(response.status === 401 || response.status === 403 ? 'private' : 'network')
  }
  let data: SodaPlaylistResponse
  try {
    data = await response.json() as SodaPlaylistResponse
  } catch {
    throw new SodaError('network')
  }
  if (typeof data.status_code === 'number' && data.status_code !== 0) {
    throw new SodaError('private')
  }
  return data
}

const parseTrack = (raw: SodaTrackRaw, fallbackCover: string): SodaTrack | null => {
  if (!raw?.id || !raw.name) return null
  const singer = (raw.artists ?? [])
    .map(artist => artist?.name)
    .filter((name): name is string => !!name)
    .join('、')
  const trackCover = imageUrl(raw.album?.url_cover)
  return {
    id: raw.id,
    name: raw.name,
    singer,
    album: raw.album?.name ?? '',
    duration: Number(raw.duration) || 0,
    cover: trackCover.length ? trackCover : fallbackCover,
  }
}

export const fetchSodaPlaylist = async(input: string): Promise<SodaPlaylist> => {
  const id = await getPlaylistIdFromResponse(input)
  const tracks: SodaTrack[] = []
  const seen = new Set<string>()
  let title = ''
  let creator = ''
  let cover = ''
  let count = 0
  let cursor = '0'

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await requestPage(id, cursor)
    const playlist = data.playlist
    if (playlist) {
      if (!title) title = (playlist.title?.length ? playlist.title : playlist.public_title) ?? ''
      if (!creator) creator = playlist.owner?.nickname ?? ''
      if (!cover) cover = imageUrl(playlist.url_cover)
      const rawCount = Number(playlist.count_tracks)
      if (Number.isFinite(rawCount) && rawCount > 0) count = rawCount
    }

    for (const item of data.media_resources ?? []) {
      if (item?.type && item.type !== 'track') continue
      const raw = item?.entity?.track_wrapper?.track
      if (!raw) continue
      const track = parseTrack(raw, cover)
      if (!track || seen.has(track.id)) continue
      seen.add(track.id)
      tracks.push(track)
    }

    if (count && tracks.length >= count) break
    const next = data.next_cursor == null ? '' : String(data.next_cursor)
    if (!next || next === cursor || (data.media_resources?.length ?? 0) === 0) break
    cursor = next
  }

  if (!title && !tracks.length) throw new SodaError('private')
  if (!tracks.length) throw new SodaError('empty')

  return {
    id,
    title: title || '汽水音乐歌单',
    creator,
    cover,
    count: tracks.length,
    tracks,
  }
}

export const toSodaMusicInfo = (track: SodaTrack, fallbackCover = ''): LX.Music.MusicInfoLocal => {
  return {
    id: `soda_${track.id}`,
    name: track.name,
    singer: track.singer,
    source: 'local',
    interval: formatInterval(track.duration),
    meta: {
      songId: track.id,
      albumName: track.album,
      picUrl: track.cover || fallbackCover || null,
      filePath: '',
      ext: 'mp3',
    },
  }
}
