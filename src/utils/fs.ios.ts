import RNFS from 'react-native-fs'
import { NativeModules } from 'react-native'
import { Buffer } from '@craftzdog/react-native-buffer'
import { gzip, ungzip } from 'pako'
import type { FileType, Encoding, HashAlgorithm, OpenDocumentOptions } from 'react-native-file-system'

export type { FileType }
export const temporaryDirectoryPath = RNFS.CachesDirectoryPath
export const privateStorageDirectoryPath = RNFS.DocumentDirectoryPath
export const externalStorageDirectoryPath = RNFS.DocumentDirectoryPath
export const extname = (name: string) => name.lastIndexOf('.') > 0 ? name.substring(name.lastIndexOf('.') + 1) : ''
const localPath = (path: string) => path.startsWith('file://') ? decodeURIComponent(path.slice(7)) : path
const fileInfo = (item: RNFS.ReadDirItem | RNFS.StatResult): FileType => ({
  name: item.name ?? item.path.split('/').pop() ?? '',
  path: item.path,
  size: Number(item.size),
  lastModified: item.mtime instanceof Date ? item.mtime.getTime() : item.mtime ?? 0,
  isFile: item.isFile(),
  isDirectory: item.isDirectory(),
  canRead: true,
  data: '',
  mimeType: /\.(mp3|m4a|aac|flac|wav|ogg|aiff)$/i.test(item.path) ? 'audio/*' : 'application/octet-stream',
})
export const getExternalStoragePaths = async(_isRemovable?: boolean) => [privateStorageDirectoryPath]
export const stat = async(path: string) => fileInfo(await RNFS.stat(localPath(path)))
export const selectManagedFolder = async(_isPersist = false) => stat(privateStorageDirectoryPath)
export const selectFile = async(options: OpenDocumentOptions): Promise<{ data: string } | null> => {
  const picker = NativeModules.LXDocumentPicker ?? NativeModules.FilePickerModule
  if (!picker?.openDocument) throw new Error('当前包未提供文件选择器模块')
  return picker.openDocument(options)
}
export const removeManagedFolder = async(_path: string) => {}
export const getManagedFolders = async() => [privateStorageDirectoryPath]
export const getPersistedUriList = getManagedFolders
export const readDir = async(path: string) => (await RNFS.readDir(localPath(path))).map(fileInfo)
export const existsFile = async(path: string) => RNFS.exists(localPath(path))
export const unlink = async(path: string) => { if (await existsFile(path)) await RNFS.unlink(localPath(path)) }
export const mkdir = async(path: string) => RNFS.mkdir(localPath(path))
export const hash = async(path: string, algorithm: HashAlgorithm) => RNFS.hash(localPath(path), algorithm)
export const readFile = async(path: string, encoding: Encoding = 'utf8') => RNFS.readFile(localPath(path), encoding as 'utf8')
export const writeFile = async(path: string, data: string, encoding: Encoding = 'utf8') => RNFS.writeFile(localPath(path), data, encoding as 'utf8')
export const appendFile = async(path: string, data: string, encoding: Encoding = 'utf8') => RNFS.appendFile(localPath(path), data, encoding as 'utf8')
export const moveFile = async(from: string, to: string) => RNFS.moveFile(localPath(from), localPath(to))
export const rename = async(path: string, name: string) => {
  const destination = path.slice(0, path.lastIndexOf('/') + 1) + name
  await moveFile(path, destination)
  return destination
}
export const gzipFile = async(from: string, to: string) => {
  const data = Buffer.from(await readFile(from, 'base64'), 'base64')
  await writeFile(to, Buffer.from(gzip(data)).toString('base64'), 'base64')
}
export const unGzipFile = async(from: string, to: string) => {
  const data = Buffer.from(await readFile(from, 'base64'), 'base64')
  await writeFile(to, Buffer.from(ungzip(data)).toString('base64'), 'base64')
}
export const gzipString = async(data: string, encoding: Encoding = 'utf8') => Buffer.from(gzip(Buffer.from(data, encoding as 'utf8'))).toString('base64')
export const unGzipString = async(data: string, encoding: Encoding = 'utf8') => Buffer.from(ungzip(Buffer.from(data, 'base64'))).toString(encoding as 'utf8')
export const downloadFile = (url: string, path: string, options: Omit<RNFS.DownloadFileOptions, 'fromUrl' | 'toFile'> = {}) => RNFS.downloadFile({ fromUrl: url, toFile: localPath(path), ...options })
export const stopDownload = (jobId: number) => { RNFS.stopDownload(jobId) }
