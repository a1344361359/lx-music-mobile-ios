import { fetchSodaPlaylist, toSodaMusicInfo } from './soda'
import musicSdk from '@/utils/musicSdk'

export type PlatformId = 'soda' | 'netease' | 'qq' | 'kugou' | 'kuwo'

export type PlatformPlaylistErrorCode = 'invalid' | 'auth' | 'empty' | 'network' | 'unsupported'

export class PlatformPlaylistError extends Error {
  code: PlatformPlaylistErrorCode
  constructor(code: PlatformPlaylistErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'PlatformPlaylistError'
    this.code = code
  }
}

export interface PlatformMeta {
  id: PlatformId
  name: string
  short: string
  color: string
  placeholder: string
  requiresAuth: boolean
}

export const PLATFORMS: PlatformMeta[] = [
  { id: 'soda', name: '汽水音乐', short: '汽水', color: '#ff5c7a', placeholder: '汽水歌单分享链接或 playlist_id', requiresAuth: false },
  { id: 'netease', name: '网易云音乐', short: '网易云', color: '#e60026', placeholder: '网易云歌单链接或 id= 后的数字', requiresAuth: false },
  { id: 'qq', name: 'QQ 音乐', short: 'QQ', color: '#31c27c', placeholder: 'QQ 音乐歌单分享链接或 id= 后的数字', requiresAuth: false },
  { id: 'kugou', name: '酷狗音乐', short: '酷狗', color: '#2b9cf4', placeholder: '酷狗歌单分享链接或 specialid', requiresAuth: false },
  { id: 'kuwo', name: '酷我音乐', short: '酷我', color: '#ff7a00', placeholder: '酷我歌单链接或 pid= 后的数字', requiresAuth: true },
]

export interface PlatformTrack {
  id: string
  name: string
  singer: string
  album: string
  duration: number
  cover: string
}

export interface PlatformPlaylist {
  platform: PlatformId
  id: string
  title: string
  creator: string
  cover: string
  tracks: PlatformTrack[]
  musicInfos?: LX.Music.MusicInfo[]
}

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const extractDigits = (text: string, patterns: RegExp[]): string => {
  const value = text.trim()
  if (/^\d{5,}$/.test(value)) return value
  let decoded = value
  try { decoded = decodeURIComponent(value) } catch {}
  for (const pattern of patterns) {
    const match = pattern.exec(decoded)
    if (match?.[1]) return match[1]
  }
  return ''
}

const fetchText = async(url: string, headers: Record<string, string> = {}): Promise<string> => {
  let response: Response
  try {
    response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json,text/html,*/*', ...headers } })
  } catch {
    throw new PlatformPlaylistError('network')
  }
  if (!response.ok) throw new PlatformPlaylistError(response.status === 401 || response.status === 403 ? 'auth' : 'network')
  return response.text()
}

const fetchJson = async<T>(url: string, headers: Record<string, string> = {}): Promise<T> => {
  let response: Response
  try {
    response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } })
  } catch {
    throw new PlatformPlaylistError('network')
  }
  if (!response.ok) throw new PlatformPlaylistError(response.status === 401 || response.status === 403 ? 'auth' : 'network')
  try { return await response.json() as T } catch { throw new PlatformPlaylistError('network') }
}

const htmlDecode = (value: string): string => value
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')

const formatCover = (url?: string): string => {
  if (!url) return ''
  return url.replace(/\\\//g, '/').replace('http://', 'https://')
}

const makeHeaders = (auth?: string): Record<string, string> => {
  const value = auth?.trim() ?? ''
  if (!value) return {}
  const cookie = value.replace(/^Cookie\s*:\s*/i, '').trim()
  return { Cookie: cookie }
}

const netease = async(input: string, auth?: string): Promise<PlatformPlaylist> => {
  const id = extractDigits(input, [/(?:^|[?&#])id=(\d+)/i, /playlist\/(\d+)/i, /"id"\s*:\s*(\d+)/i])
  if (!id) throw new PlatformPlaylistError('invalid')
  const data = await fetchJson<any>(`https://music.163.com/api/v6/playlist/detail?id=${id}`, makeHeaders(auth))
  const playlist = data?.playlist
  if (!playlist) throw new PlatformPlaylistError('auth')
  const tracks: PlatformTrack[] = []
  const ids: number[] = (playlist.trackIds ?? []).map((item: any) => Number(item?.id)).filter(Boolean)
  const rawSongs: any[] = []
  if (ids.length) {
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100)
      const result = await fetchJson<any>(`https://music.163.com/api/song/detail?ids=${encodeURIComponent(JSON.stringify(batch))}`, makeHeaders(auth))
      rawSongs.push(...(result?.songs ?? []))
    }
  } else {
    rawSongs.push(...(playlist.tracks ?? []))
  }
  for (const track of rawSongs) {
    if (!track?.id || !track?.name) continue
    tracks.push({
      id: String(track.id),
      name: String(track.name),
      singer: (track.ar ?? track.artists ?? []).map((a: any) => a?.name).filter(Boolean).join('、'),
      album: track.al?.name ?? track.album?.name ?? '',
      duration: Number(track.dt ?? track.duration ?? 0) || 0,
      cover: formatCover(track.al?.picUrl ?? track.album?.picUrl ?? playlist.coverImgUrl),
    })
  }
  if (!tracks.length) throw new PlatformPlaylistError('empty')
  return {
    platform: 'netease', id, title: playlist.name ?? '网易云歌单',
    creator: playlist.creator?.nickname ?? '', cover: formatCover(playlist.coverImgUrl),
    tracks,
  }
}

const qq = async(input: string, auth?: string): Promise<PlatformPlaylist> => {
  const id = extractDigits(input, [/(?:^|[?&#])id=(\d+)/i, /taoge\/?(\d+)/i, /"disstid"\s*:\s*"?"?(\d+)/i])
  if (!id) throw new PlatformPlaylistError('invalid')
  const payload = {
    req_0: {
      module: 'music.srfDissInfo.DissInfo',
      method: 'CgiGetDiss',
      param: { disstid: Number(id), dirid: 0, tag: 1, song_begin: 0, song_num: 500, userinfo: 1 },
    },
    comm: { uin: '0', format: 'json', ct: 24, cv: 0, platform: 'yqq.json' },
  }
  const data = await fetchJson<any>(`https://u.y.qq.com/cgi-bin/musicu.fcg?data=${encodeURIComponent(JSON.stringify(payload))}`, makeHeaders(auth))
  const result = data?.req_0?.data
  if (!result?.dirinfo && !result?.songlist) throw new PlatformPlaylistError('auth')
  const dir = result.dirinfo ?? {}
  const tracks: PlatformTrack[] = []
  for (const track of result.songlist ?? []) {
    if (!track?.name || !track?.mid) continue
    const albumMid = track.albummid ?? ''
    tracks.push({
      id: String(track.mid),
      name: String(track.name),
      singer: (track.singer ?? []).map((s: any) => s?.name).filter(Boolean).join('、'),
      album: track.albumname ?? '',
      duration: Number(track.interval ?? 0) * 1000 || 0,
      cover: albumMid ? `https://y.qq.com/music/photo_new/T002R300x300M000${albumMid}.jpg` : formatCover(dir.picurl),
    })
  }
  if (!tracks.length) throw new PlatformPlaylistError('empty')
  return {
    platform: 'qq', id, title: dir.title ?? 'QQ 音乐歌单',
    creator: dir.hostname ?? '', cover: formatCover(dir.picurl),
    tracks,
  }
}

const kugou = async(input: string, auth?: string): Promise<PlatformPlaylist> => {
  const id = extractDigits(input, [/specialid=(\d+)/i, /special\/single\/(?:collection_\d+_)?(\d+)/i, /"specialid"\s*:\s*(\d+)/i])
  if (!id) throw new PlatformPlaylistError('invalid')
  const html = await fetchText(`https://www.kugou.com/yy/special/single/${id}.html`, makeHeaders(auth))
  if (/页面不存在|404|该页面不存在/.test(html)) throw new PlatformPlaylistError('invalid')
  const titleMatch = /<title>([^<]+)<\/title>/i.exec(html)
  const title = htmlDecode(titleMatch?.[1]?.replace(/_酷狗音乐.*$/, '').trim() ?? '') || '酷狗歌单'
  const tracks: PlatformTrack[] = []
  const seen = new Set<string>()
  const blockPattern = /"songname":"((?:\\.|[^"\\])*)"/g
  let match: RegExpExecArray | null
  while ((match = blockPattern.exec(html))) {
    const start = match.index
    const block = html.slice(start, start + 5000)
    const singerMatch = /"singername":"((?:\\.|[^"\\])*)"/.exec(block)
    const albumMatch = /"albumname":"((?:\\.|[^"\\])*)"/.exec(block)
    const durationMatch = /"duration":(\d+)/.exec(block)
    const hashMatch = /"(?:hash|audio_id)":"?([A-Za-z0-9]+)"?/.exec(block)
    const name = htmlDecode(match[1]).replace(/\\"/g, '"')
    const key = `${name}-${singerMatch?.[1] ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    tracks.push({
      id: hashMatch?.[1] ?? key,
      name,
      singer: htmlDecode(singerMatch?.[1] ?? '').replace(/\\"/g, '"'),
      album: htmlDecode(albumMatch?.[1] ?? '').replace(/\\"/g, '"'),
      duration: Number(durationMatch?.[1] ?? 0) || 0,
      cover: '',
    })
    if (tracks.length >= 1000) break
  }
  if (!tracks.length) throw new PlatformPlaylistError('empty')
  return { platform: 'kugou', id, title, creator: '', cover: '', tracks }
}

const kuwo = async(input: string, auth?: string): Promise<PlatformPlaylist> => {
  const id = extractDigits(input, [/(?:^|[?&#])pid=(\d+)/i, /playlist_detail\/(\d+)/i, /"id"\s*:\s*(\d+)/i])
  if (!id) throw new PlatformPlaylistError('invalid')
  const cookie = auth?.trim() ?? ''
  if (!cookie) throw new PlatformPlaylistError('auth')
  const csrf = /(?:^|;)\s*kw_token=([^;]+)/i.exec(cookie)?.[1] ?? ''
  const data = await fetchJson<any>(`https://www.kuwo.cn/api/www/playlist/playListInfo?pid=${id}&pn=1&rn=1000&httpsStatus=1`, { ...makeHeaders(cookie), csrf, Referer: `https://www.kuwo.cn/playlist_detail/${id}` })
  if (!data?.data?.musicList) throw new PlatformPlaylistError('auth')
  const playlist = data.data
  const tracks: PlatformTrack[] = []
  for (const track of playlist.musicList ?? []) {
    if (!track?.name || !track?.rid) continue
    tracks.push({
      id: String(track.rid),
      name: String(track.name),
      singer: track.artist ?? '',
      album: track.album ?? '',
      duration: Number(track.duration ?? 0) * 1000 || 0,
      cover: formatCover(track.albumpic),
    })
  }
  if (!tracks.length) throw new PlatformPlaylistError('empty')
  return { platform: 'kuwo', id, title: playlist.name ?? '酷我歌单', creator: playlist.uname ?? '', cover: formatCover(playlist.img), tracks }
}


const sdkListMap = {
  netease: musicSdk.wy.songList,
  qq: musicSdk.tx.songList,
  kugou: musicSdk.kg.songList,
  kuwo: musicSdk.kw.songList,
} as const

const sdkPlatform = async(platform: Exclude<PlatformId, 'soda'>, input: string, auth?: string): Promise<PlatformPlaylist | null> => {
  try {
    let id = input.trim()
    if (platform === 'netease' && auth) {
      const token = /(?:^|;|\s)MUSIC_U=([^;\s]+)/i.exec(auth)?.[1] ?? auth.replace(/^Cookie\s*:\s*/i, '').trim()
      if (token && !id.includes('###')) id = `${id}###${token}`
    }
    const result = await sdkListMap[platform].getListDetail(id)
    const list = (result?.list ?? []) as LX.Music.MusicInfo[]
    if (!list.length) return null
    return {
      platform,
      id: input,
      title: result.info?.name ?? '',
      creator: result.info?.author ?? '',
      cover: formatCover(result.info?.img ?? ''),
      tracks: list.map(item => ({
        id: item.id,
        name: item.name,
        singer: item.singer,
        album: (item as any).albumName ?? '',
        duration: 0,
        cover: (item as any).img ?? '',
      })),
      musicInfos: list,
    }
  } catch {
    return null
  }
}

export const fetchPlatformPlaylist = async(platform: PlatformId, input: string, auth?: string): Promise<PlatformPlaylist> => {
  if (platform !== 'soda') {
    const sdkResult = await sdkPlatform(platform, input, auth)
    if (sdkResult) return sdkResult
  }
  switch (platform) {
    case 'soda': {
      const playlist = await fetchSodaPlaylist(input)
      return {
        platform, id: playlist.id, title: playlist.title, creator: playlist.creator, cover: playlist.cover,
        tracks: playlist.tracks.map(track => ({ ...track })),
      }
    }
    case 'netease': return netease(input, auth)
    case 'qq': return qq(input, auth)
    case 'kugou': return kugou(input, auth)
    case 'kuwo': return kuwo(input, auth)
    default: throw new PlatformPlaylistError('unsupported')
  }
}

export const toPlatformMusicInfo = (platform: PlatformId, track: PlatformTrack, fallbackCover = ''): LX.Music.MusicInfoLocal => {
  if (platform === 'soda') {
    return toSodaMusicInfo(track, fallbackCover)
  }
  const seconds = Math.round((track.duration || 0) / 1000)
  return {
    id: `${platform}_${track.id}`,
    name: track.name,
    singer: track.singer,
    source: 'local',
    interval: seconds > 0 ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : null,
    meta: {
      songId: track.id,
      albumName: track.album,
      picUrl: track.cover || fallbackCover || null,
      filePath: '',
      ext: 'mp3',
    },
  }
}
