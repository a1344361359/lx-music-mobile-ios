const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const babel = require('@babel/core')

const load = (file, mocks, globals = {}) => {
  const filename = path.resolve(file)
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, configFile: false, babelrc: false,
    presets: ['module:@react-native/babel-preset'],
  })
  const module = { exports: {} }
  vm.runInNewContext('(function(require,module,exports){' + code + '\n})', globals)(
    name => {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name.startsWith('@babel/runtime/')) return require(name)
      throw new Error('Unexpected import: ' + name)
    }, module, module.exports,
  )
  return module.exports
}

test('switching songs keeps iOS native and application queues aligned', async() => {
  let queue = []
  let current = -1
  const backend = {
    add: async tracks => { queue.push(...tracks); if (current < 0) current = 0 },
    getQueue: async() => queue,
    getTrack: async index => queue[index] ?? null,
    getCurrentTrack: async() => current < 0 ? null : current,
    skip: async index => { assert(index >= 0 && index < queue.length); current = index },
    // The actual Swift bridge removes each supplied index in sequence and
    // refuses to remove the current item. Earlier removals shift later indexes.
    remove: async indexes => {
      for (const index of indexes) {
        if (index === current || index < 0 || index >= queue.length) continue
        queue.splice(index, 1)
        if (index < current) current--
      }
    },
    pause: async() => {}, play: async() => {}, seekTo: async() => {},
  }
  const native = { Platform: { OS: 'ios' }, NativeModules: { TrackPlayerModule: {} } }
  const adapter = load('src/plugins/player/trackPlayer.ts', {
    'react-native': native,
    'react-native-track-player': { __esModule: true, default: backend, State: {} },
  })
  const player = load('src/plugins/player/playList.ts', {
    '@/plugins/player/trackPlayer': adapter,
    'react-native': native,
    'react-native-background-timer': {},
    '@/config': { defaultUrl: 'silence.mp3' },
    '@/store/setting/state': { setting: {} },
    '@/store/player/state': { musicInfo: {} },
    '@/core/liveActivity': { syncLiveActivity() {} },
    '@/utils/nativeModules/nowPlaying': { updateNowPlaying() {} },
  }, { global: { lx: { restorePlayInfo: null } }, Math, Promise })
  for (let i = 0; i < 4; i++) {
    const music = { id: 'song-' + i, name: 'Fixture', singer: 'CI', meta: {} }
    player.playMusic(music, 'https://example.invalid/song-' + i + '.mp3', 0)
    for (let turn = 0; turn < 4; turn++) await new Promise(setImmediate)
    assert.equal(queue.length, 2, 'Only the active audio and its end sentinel should remain')
    assert.equal(current, 0, 'Current audio must stay at the same index as the application queue')
    assert.equal(await player.getCurrentTrackId(), queue[current].id)
    assert(queue[current].id.startsWith(music.id + '__//'))
    assert(!player.isTempTrack(await player.getCurrentTrackId()), 'A real song must not be identified as the silent end sentinel')
  }
})

test('iOS explicit stop and queue changes do not report natural completion', async() => {
  const listeners = new Map()
  let current = null
  let currentID
  let ended = 0
  const app = {
    lx: { playerStatus: {}, gettingUrlId: '', playerTrackId: '', isPlayedStop: false },
    app_event: { playerPause() {}, pause() {}, playerEnded() { ended++ }, playerEmptied() {} },
  }
  const backend = {
    registerPlaybackService: factory => factory()(),
    addEventListener: (name, listener) => listeners.set(name, listener),
    getCurrentTrack: async() => current,
    pause: async() => {},
  }
  const service = load('src/plugins/player/service.ts', {
    'react-native': { Platform: { OS: 'ios' }, AppState: { currentState: 'active' } },
    '@/plugins/player/trackPlayer': {
      __esModule: true, default: backend, State: {},
      Event: { PlaybackTrackChanged: 'changed', PlaybackQueueEnded: 'ended' },
    },
    './utils': { isTempId: () => true, isEmpty: () => !app.lx.playerTrackId || app.lx.playerTrackId.endsWith('//default') },
    './playList': { getCurrentTrackId: async() => currentID },
    '@/core/common': { exitApp() {} },
    '@/core/player/player': { pause() {}, play() {}, playNext() {}, playPrev() {} },
    '@/utils/nativeModules/backgroundAudio': { setBackgroundAudioPlaying() {} },
  }, { global: app, console })
  service.default()

  // Swift stop() clears the queue and emits queueIndex(currentIndex, nil).
  await listeners.get('changed')({ track: 0 })
  assert.equal(ended, 0, 'Stopping an empty/cleared queue must not start the next song')
  current = 1
  currentID = 'fixture__//default'
  await listeners.get('changed')({ track: 0, nextTrack: 1 })
  assert.equal(ended, 0, 'Index changes alone are not completion events')
  await listeners.get('ended')({ track: 1 })
  assert.equal(ended, 1, 'A real native natural completion must still advance playback')
  current = null
  currentID = undefined
  await listeners.get('ended')({ track: 1 })
  assert.equal(ended, 1, 'Ignore completion queued before a manual stop cleared its track')
})
