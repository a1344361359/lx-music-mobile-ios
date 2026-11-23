import { memo } from 'react'

import Basic from '../settings/Basic'
import Player from '../settings/Player'
import LyricDesktop from '../settings/LyricDesktop'
import Search from '../settings/Search'
import List from '../settings/List'
import Sync from '../settings/Sync'
import Backup from '../settings/Backup'
import PlatformAuth from '../settings/PlatformAuth'
import Other from '../settings/Other'
import Version from '../settings/Version'
import About from '../settings/About'
import Theme from '../settings/Theme'
import { type SettingScreenIds } from '../Main'

export default memo(({ id }: { id: SettingScreenIds }) => {
  switch (id) {
    case 'player': return <Player />
    case 'lyric_desktop': return <LyricDesktop />
    case 'search': return <Search />
    case 'list': return <List />
    case 'sync': return <Sync />
    case 'backup': return <Backup />
    case 'platform_auth': return <PlatformAuth />
    case 'other': return <Other />
    case 'version': return <Version />
    case 'about': return <About />
    case 'theme': return <Theme />
    case 'basic':
    default: return <Basic />
  }
})
