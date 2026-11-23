// Invoked only by the simulator's LX_IOS_SMOKE launch environment.
import RNFS from 'react-native-fs'
import { Buffer } from '@craftzdog/react-native-buffer'
import { NativeModules } from 'react-native'
import TrackPlayer, { Event, RepeatMode } from '@/plugins/player/trackPlayer'
import { initial, setStop } from '@/plugins/player'
import { playMusic as playQueuedMusic, getCurrentTrack, getCurrentTrackId, isTempTrack } from '@/plugins/player/playList'
import { loadScript, onScriptAction, sendAction, destroy } from '@/utils/nativeModules/userApi'
import { gzipFile, unGzipFile, readFile, writeFile } from '@/utils/fs'
import { getBootLog } from '@/utils/bootLog'
import { setNavActiveId, updateSetting } from '@/core/common'
import { applyTheme } from '@/core/theme'
import { getTheme } from '@/theme/themes'
import settingState from '@/store/setting/state'
import { drawerStates } from '@/utils/iosDrawerSmoke'
import { smokeFatalErrors } from '@/utils/errorHandle'
import { httpFetch } from '@/utils/request'

const httpFixture = 'http://lx-ios-fixture.test:18765'

const pause = async(ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message) }
const waitFor = async(condition: () => boolean, message: string) => {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (condition()) return
    await pause(100)
  }
  throw new Error(message)
}

const testDrawers = async() => {
  const originalPosition = settingState.setting['common.drawerLayoutPosition']
  for (const position of ['left', 'right'] as const) {
    updateSetting({ 'common.drawerLayoutPosition': position })
    await waitFor(() => drawerStates.get('home-menu')?.position === position, 'Menu position did not update')
    global.app_event.changeMenuVisible(true)
    await waitFor(() => drawerStates.get('home-menu')?.visible === true, 'Home menu failed to open')
    await pause(300)
    assert((drawerStates.get('home-menu')?.width ?? 0) > 100, 'Home menu has no usable width')
    global.app_event.changeMenuVisible(false)
    await waitFor(() => drawerStates.get('home-menu')?.visible === false, 'Home menu failed to close')
  }
  updateSetting({ 'common.drawerLayoutPosition': originalPosition })
  setNavActiveId('nav_setting')
  await pause(600)
  global.app_event.changeMenuVisible(true)
  await waitFor(() => drawerStates.get('home-menu')?.visible === true, 'Menu failed to reopen on Settings')
  global.app_event.changeMenuVisible(false)
  await waitFor(() => drawerStates.get('home-menu')?.visible === false, 'Settings menu failed to close')
  setNavActiveId('nav_love')
  await waitFor(() => drawerStates.has('my-lists'), 'My lists drawer did not mount')
  global.app_event.changeLoveListVisible(true)
  await waitFor(() => drawerStates.get('my-lists')?.visible === true, 'My lists drawer failed to open')
  await pause(300)
  global.app_event.changeLoveListVisible(false)
  await waitFor(() => drawerStates.get('my-lists')?.visible === false, 'My lists drawer failed to close')
  setNavActiveId('nav_search')
  await pause(400)
}

const testPlaybackQueue = async(audioUrl: string) => {
  await initial({ volume: 0, playRate: 1, cacheSize: 0, isHandleAudioFocus: true, isEnableAudioOffload: false })
  await TrackPlayer.setRepeatMode(RepeatMode.Off)
  let ended = 0
  const onEnded = () => { ended++ }
  const errors: unknown[] = []
  const errorSubscription = TrackPlayer.addEventListener(Event.PlaybackError, error => errors.push(error))
  global.app_event.on('playerEnded', onEnded)
  try {
    for (let index = 0; index < 4; index++) {
      // The app stops its previous song before resolving and playing a new URL.
      await setStop()
      await pause(150)
      assert(ended === 0, 'Explicit stop incorrectly emitted playerEnded')
      const music: LX.Music.MusicInfo = {
        id: `ios-playback-${index}`,
        name: 'Queue fixture',
        singer: 'CI',
        source: 'kw',
        interval: '00:12',
        meta: { songId: String(index), albumName: '', qualitys: [], _qualitys: {} },
      }
      // Use the same playlist path as an online song after its URL is resolved,
      // including the silent end sentinel and pruning the previous queue.
      playQueuedMusic(music, audioUrl, 0)
      let ready = false
      for (let attempt = 0; attempt < 50; attempt++) {
        const [track, queue, position] = await Promise.all([getCurrentTrack(), TrackPlayer.getQueue(), TrackPlayer.getPosition()])
        if (track?.musicId === music.id && queue.length === 2 && position > 0.2) { ready = true; break }
        await pause(100)
      }
      assert(ready, `Song ${index}: queue alignment or playback failed`)
      const currentId = await getCurrentTrackId()
      assert(currentId && !isTempTrack(currentId), 'Active song was misidentified as its silent end sentinel')
      const duration = await TrackPlayer.getDuration()
      assert(duration >= 11.9 && duration <= 12.1, `Unexpected AVPlayer duration: ${duration}`)
      assert(ended === 0, 'Switching songs incorrectly emitted playerEnded')
      assert(errors.length === 0, `Native playback errors: ${JSON.stringify(errors)}`)
    }
    await TrackPlayer.pause()
    await TrackPlayer.seekTo(1)
    await pause(300)
    assert(Math.abs(await TrackPlayer.getPosition() - 1) < 0.25, 'AVPlayer seek failed')
    await TrackPlayer.seekTo(11.5)
    await TrackPlayer.play()
    await waitFor(() => ended === 1, 'Natural completion failed to emit playerEnded')
    await pause(400)
    assert(ended === 1, 'Natural completion emitted duplicate ended events')
  } finally {
    global.app_event.off('playerEnded', onEnded)
    errorSubscription.remove()
    await TrackPlayer.reset()
  }
}

const testUserSource = async() => new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => { finish(new Error('JavaScriptCore user source timed out')) }, 10_000)
  let unsubscribe: () => void = () => {}
  const finish = (error?: Error) => {
    clearTimeout(timeout)
    unsubscribe()
    destroy()
    if (error) reject(error)
    else resolve()
  }
  unsubscribe = onScriptAction(event => {
    if (event.action === 'init') {
      if (!event.data.status) { finish(new Error(event.data.errorMessage)); return }
      const fixture: LX.Music.MusicInfo = {
        id: 'ios-fixture',
        name: 'Fixture',
        singer: 'CI',
        source: 'kw',
        interval: null,
        meta: { songId: '1', albumName: '', qualitys: [], _qualitys: {} },
      }
      const request: LX.UserApi.UserApiRequestParams = {
        requestKey: 'ios-smoke',
        data: { source: 'kw', action: 'musicUrl', info: { type: '128k', musicInfo: fixture } },
      }
      sendAction('request', request)
    } else if (event.action === 'response' && event.data.requestKey === 'ios-smoke') {
      if (!event.data.status || event.data.result?.data.url !== httpFixture + '/audio.wav') {
        finish(new Error(event.data.errorMessage ?? 'Unexpected custom-source response'))
      } else finish()
    }
  })
  loadScript({
    id: 'ios-smoke',
    name: 'Built-in CI fixture',
    description: '',
    author: '',
    version: '1',
    homepage: '',
    allowShowUpdateAlert: false,
    script: `
      lx.on(lx.EVENT_NAMES.request, () => new Promise((resolve, reject) => setTimeout(() => {
        lx.request('${httpFixture}/source', { method: 'GET', headers: {
          'User-Agent': 'lx-music/' + lx.env,
          ver: lx.version,
          'source-ver': lx.currentScriptInfo.version,
          tag: lx.utils.buffer.bufToString(lx.utils.buffer.from('ios-http-fixture'), 'hex'),
        } }, (error, response) => {
          if (error) reject(error);
          else if (response.statusCode !== 200 || response.body.code !== 0) reject(new Error('HTTP source fixture failed'));
          else resolve(response.body.data);
        });
      }, 10)));
      lx.send(lx.EVENT_NAMES.inited, { sources: { kw: { type: 'music', actions: ['musicUrl'], qualitys: ['128k'] } } });
    `,
  })
})

export const runSmokeTests = async() => {
  const checks: string[] = ['home screen initialized']
  const reportPath = RNFS.CachesDirectoryPath + '/lx-ios-smoke.json'
  if (NativeModules.UtilsModule.smokeHTTPProbeRequested) {
    // The runner temporarily restores the old ATS policy for a negative control.
    let status = 'allowed'
    try { await httpFetch(httpFixture + '/search').promise } catch { status = 'blocked' }
    await RNFS.writeFile(RNFS.CachesDirectoryPath + '/lx-ios-http-probe.json', JSON.stringify({ status }))
    return
  }
  const uiScreen = NativeModules.UtilsModule.uiSmokeScreen as string | undefined
  if (uiScreen === 'pip') {
    const pip = NativeModules.LXPipLyric
    let started = false
    let supported = false
    try {
      const result = await pip.configure({
        lines: [
          { time: 0, text: '衣锦还乡心似箭' },
          { time: 2, text: '要与马蹄争快' },
          { time: 4, text: '第三行歌词' },
        ],
        position: 0,
        isPlaying: true,
        singleLine: false,
        width: 100,
        fontSize: 180,
        offset: 0,
        playedColor: '#31C27C',
        unplayedColor: '#FFFFFF',
      })
      supported = !!result?.supported
      await pause(600)
      started = !!(await pip.start())
      await pause(2600)
    } catch (err) {
      started = false
    }
    await RNFS.writeFile(reportPath, JSON.stringify({
      status: 'passed',
      checks: [`pip snapshot; supported=${supported}; start=${started}`],
      screen: 'pip',
    }))
    return
  }
  if (uiScreen === 'glass') {
    updateSetting({ 'theme.id': 'liquid_glass' })
    await getTheme().then(applyTheme)
    let nowPlaying = false
    try {
      await NativeModules.LXNowPlaying?.update({
        title: 'KMusic Smoke',
        artist: 'KMusic',
        duration: 180,
        elapsedTime: 30,
        playbackRate: 1,
        isPlaying: true,
      })
      nowPlaying = !!NativeModules.LXNowPlaying
    } catch (err) {
      nowPlaying = false
    }
    setNavActiveId('nav_setting')
    await pause(1800)
    await RNFS.writeFile(reportPath, JSON.stringify({ status: 'passed', checks: [`liquid glass theme snapshot; nowplaying=${nowPlaying}`], screen: 'glass' }))
    return
  }
  if (uiScreen) {
    // Dedicated UI snapshots: keep the screen stable so the runner can capture it.
    if (uiScreen === 'settings_detail' || uiScreen === 'settings_lyric') {
      setNavActiveId('nav_setting')
      await pause(300)
      global.app_event.iosSettingOpenDetail(uiScreen === 'settings_detail' ? 'basic' : 'lyric_desktop')
    } else {
      setNavActiveId(uiScreen === 'settings' ? 'nav_setting' : 'nav_songlist')
    }
    await pause(1800)
    await RNFS.writeFile(reportPath, JSON.stringify({ status: 'passed', checks: [`ui snapshot: ${uiScreen}`], screen: uiScreen }))
    return
  }
  try {
    await testDrawers()
    checks.push('home menu opens and closes on both sides, Settings navigation and My lists drawer')
    const crypto = NativeModules.CryptoModule
    const text = 'Hello iPhone 你好'
    const input = Buffer.from(text).toString('base64')
    const key = Buffer.from('0123456789abcdef').toString('base64')
    const encrypted = crypto.aesEncryptSync(input, key, key, 'AES/CBC/PKCS7Padding')
    assert(crypto.aesDecryptSync(encrypted, key, key, 'AES/CBC/PKCS7Padding') === text, 'Native AES round-trip failed')
    const pair = await crypto.generateRsaKey()
    const cipher = await crypto.rsaEncrypt(input, pair.publicKey, 'RSA/ECB/OAEPWithSHA1AndMGF1Padding')
    assert(await crypto.rsaDecrypt(cipher, pair.privateKey, 'RSA/ECB/OAEPWithSHA1AndMGF1Padding') === text, 'Native RSA round-trip failed')
    checks.push('native AES/RSA bridge')
    const documentPicker = NativeModules.LXDocumentPicker
    assert(documentPicker && typeof documentPicker.openDocument === 'function', 'LXDocumentPicker native module is missing')
    checks.push('native document picker module registered')
    const pickerPromise = documentPicker.openDocument({ extTypes: ['js'], toPath: '' }).catch((err: any) => ({ error: String(err?.message ?? err) }))
    await pause(2500)
    const dismissResult = await documentPicker.dismissActivePicker()
    const pickerResult = await pickerPromise
    if (dismissResult?.presented) {
      assert(pickerResult === null, 'Document picker did not dismiss cleanly')
      checks.push('native document picker presents and cancels cleanly')
    } else {
      // Some CI simulator images have no Files provider extension, so a visible
      // UIDocumentPicker cannot be asserted there. Device builds are unaffected.
      checks.push('native document picker presentation skipped in this simulator')
    }

    const liveActivity = NativeModules.LXLiveActivity
    if (liveActivity && typeof liveActivity.start === 'function') {
      assert(typeof await liveActivity.isSupported() === 'boolean', 'Live Activities support check failed')
      liveActivity.start({
        songId: 'ios-smoke-live-activity',
        title: 'Smoke test',
        artist: 'CI',
        artworkUrl: '',
        playedColor: '#31C27C',
        unplayedColor: '#FFFFFF',
        duration: 12,
        position: 0,
        isPlaying: true,
        playbackRate: 1,
        lines: [
          { time: 0, text: '第一行歌词' },
          { time: 3000, text: '第二行歌词' },
        ],
      })
      await pause(1200)
      liveActivity.end()
      checks.push('native live activity module registered')
    } else checks.push('live activity module not present')


    const path = RNFS.CachesDirectoryPath + '/ios-smoke-fixture'
    await writeFile(path, text)
    await gzipFile(path, path + '.gz')
    await unGzipFile(path + '.gz', path + '.txt')
    assert(await readFile(path + '.txt') === text, 'File gzip round-trip failed')
    checks.push('sandbox files and gzip')

    const search = await httpFetch(httpFixture + '/search').promise
    const searchBody = search.body as unknown as { songs: Array<{ source: string }> }
    assert(search.statusCode === 200 && searchBody.songs[0].source === 'kw', 'HTTP search request failed')
    checks.push('HTTP search through the application request layer')
    await testUserSource()
    checks.push('JavaScriptCore source initialization, timer, real HTTP request/JSON response and preserved headers')

    const sampleRate = 16000
    const dataSize = sampleRate * 12 * 2
    const wave = Buffer.alloc(44 + dataSize)
    wave.write('RIFF', 0); wave.writeUInt32LE(36 + dataSize, 4); wave.write('WAVEfmt ', 8)
    wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22)
    wave.writeUInt32LE(sampleRate, 24); wave.writeUInt32LE(sampleRate * 2, 28)
    wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34); wave.write('data', 36); wave.writeUInt32LE(dataSize, 40)
    const audioPath = RNFS.CachesDirectoryPath + '/ios-smoke.wav'
    await RNFS.writeFile(audioPath, wave.toString('base64'), 'base64')
    const metadata = NativeModules.LocalMediaMetadata
    const info = await metadata.readMetadata(audioPath)
    assert(typeof info.interval === 'number' && Math.abs(info.interval - 12) < 0.1, 'Local audio metadata duration must be numeric seconds')
    await metadata.writeLyric(audioPath, '[00:00.00]Hello iPhone')
    assert(await metadata.readLyric(audioPath, true) === '[00:00.00]Hello iPhone', 'Sidecar lyric round-trip failed')
    checks.push('local WAV metadata and sidecar lyrics')
    await testPlaybackQueue(httpFixture + '/audio.wav')
    checks.push('HTTP audio through the application playlist: four stop/play switches, aligned queue, no false ended events, pause/seek and exactly one natural completion')
    global.app_event.changeMenuVisible(true)
    await waitFor(() => drawerStates.get('home-menu')?.visible === true, 'Final menu screenshot could not open')
    await pause(300)
    assert(smokeFatalErrors.length === 0, `Unexpected UI errors: ${smokeFatalErrors.join('; ')}`)
    await RNFS.writeFile(reportPath, JSON.stringify({ status: 'passed', checks, boot: getBootLog() }))
  } catch (error: any) {
    await RNFS.writeFile(reportPath, JSON.stringify({ status: 'failed', checks, error: String(error), stack: error.stack, boot: getBootLog() }))
  }
}
