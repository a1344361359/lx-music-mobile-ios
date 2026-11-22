import { getData, saveData } from '@/plugins/storage'
import type { PlatformId } from './platformPlaylist'

const KEY = 'kmusic_platform_auth_v1'

export type PlatformAuthMap = Partial<Record<PlatformId, string>>

export const getPlatformAuth = async(): Promise<PlatformAuthMap> => {
  const value = await getData<PlatformAuthMap>(KEY)
  return value && typeof value === 'object' ? value : {}
}

export const getPlatformAuthValue = async(platform: PlatformId): Promise<string> => {
  const map = await getPlatformAuth()
  return map[platform] ?? ''
}

export const savePlatformAuthValue = async(platform: PlatformId, value: string) => {
  const map = await getPlatformAuth()
  const trimmed = value.trim()
  if (trimmed) map[platform] = trimmed
  else delete map[platform]
  await saveData(KEY, map)
}
