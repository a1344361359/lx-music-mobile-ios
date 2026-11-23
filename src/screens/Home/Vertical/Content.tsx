import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
// import { getWindowSise, onDimensionChange } from '@/utils/tools'
import DrawerNav from './DrawerNav'
import Header from './Header'
import Main from './Main'
import PlayerBar from '@/components/player/PlayerBar'
import TabBar from './TabBar'
import { useSettingValue } from '@/store/setting/hook'
import { COMPONENT_IDS } from '@/config/constant'
import DrawerLayoutFixed, { type DrawerLayoutFixedType } from '@/components/common/DrawerLayoutFixed'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useNavActiveId } from '@/store/common/hook'
import StatusBar from '@/components/common/StatusBar'

const MAX_WIDTH = scaleSizeW(300)

const Content = () => {
  const drawer = useRef<DrawerLayoutFixedType>(null)
  const drawerLayoutPosition = useSettingValue('common.drawerLayoutPosition')
  const navActiveId = useNavActiveId()
  const hideHeader = Platform.OS === 'ios' && navActiveId === 'nav_setting'

  useEffect(() => {
    const changeVisible = (visible: boolean) => {
      if (visible) {
        drawer.current?.openDrawer()
      } else {
        drawer.current?.closeDrawer()
      }
    }

    global.app_event.on('changeMenuVisible', changeVisible)

    return () => {
      global.app_event.off('changeMenuVisible', changeVisible)
    }
  }, [])

  const navigationView = () => <DrawerNav />
  // console.log('render drawer content')

  return (
    <DrawerLayoutFixed
      testID="home-menu"
      ref={drawer}
      widthPercentage={0.7}
      widthPercentageMax={MAX_WIDTH}
      visibleNavNames={[COMPONENT_IDS.home]}
      // drawerWidth={width}
      drawerPosition={drawerLayoutPosition}
      renderNavigationView={navigationView}
    >
      {hideHeader ? <StatusBar /> : <Header />}
      <Main />
      <PlayerBar isHome />
      <TabBar />
      {/* <View style={styles.container}>
      </View> */}
    </DrawerLayoutFixed>
  )
}

// const styles = createStyle({
//   container: {
//     flex: 1,
//   },
// })

export default Content
