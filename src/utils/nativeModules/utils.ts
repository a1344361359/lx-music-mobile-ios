import { AppState, Dimensions, NativeEventEmitter, NativeModules, Platform, Share } from 'react-native'

const UtilsModule = NativeModules.UtilsModule ?? {}
const isIOS = Platform.OS === 'ios'

export const exitApp = (...args: any[]) => UtilsModule.exitApp?.(...args)

export const getSupportedAbis = async() => isIOS ? ['arm64'] : UtilsModule.getSupportedAbis()

export const installApk = (filePath: string, fileProviderAuthority: string) => {
  if (isIOS) return
  return UtilsModule.installApk(filePath, fileProviderAuthority)
}


export const screenkeepAwake = () => {
  if (global.lx.isScreenKeepAwake) return
  global.lx.isScreenKeepAwake = true
  UtilsModule.screenkeepAwake?.()
}
export const screenUnkeepAwake = () => {
  // console.log('screenUnkeepAwake')
  if (!global.lx.isScreenKeepAwake) return
  global.lx.isScreenKeepAwake = false
  UtilsModule.screenUnkeepAwake?.()
}

export const getWIFIIPV4Address = async(): Promise<string> => isIOS ? '0.0.0.0' : UtilsModule.getWIFIIPV4Address()

export const getDeviceName = async(): Promise<string> => {
  if (isIOS) return NativeModules.PlatformConstants?.model ?? 'iPhone'
  return UtilsModule.getDeviceName().then((deviceName: string) => deviceName || 'Unknown')
}

export const isNotificationsEnabled = async(): Promise<boolean> => isIOS ? true : UtilsModule.isNotificationsEnabled()

export const requestNotificationPermission = async(): Promise<boolean> => {
  if (isIOS) return true
  return new Promise<boolean>((resolve) => {
    let subscription = AppState.addEventListener('change', (state) => {
      if (state != 'active') return
      subscription.remove()
      setTimeout(() => {
        void isNotificationsEnabled().then(resolve)
      }, 1000)
    })
    UtilsModule.openNotificationPermissionActivity().then((result: boolean) => {
      if (result) return
      subscription.remove()
      resolve(false)
    })
  })
}

export const shareText = async(shareTitle: string, title: string, text: string): Promise<void> => {
  if (isIOS) {
    await Share.share({ title, message: text })
    return
  }
  UtilsModule.shareText(shareTitle, title, text)
}

export const getSystemLocales = async(): Promise<string> => {
  if (isIOS) {
    return NativeModules.SettingsManager?.settings?.AppleLocale ??
      NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ??
      Intl.DateTimeFormat().resolvedOptions().locale ?? 'zh_CN'
  }
  return UtilsModule.getSystemLocales()
}

export const onScreenStateChange = (handler: (state: 'ON' | 'OFF') => void): () => void => {
  if (isIOS) return () => {}
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  const eventListener = eventEmitter.addListener('screen-state', event => {
    handler(event.state as 'ON' | 'OFF')
  })

  return () => {
    eventListener.remove()
  }
}

export const getWindowSize = async(): Promise<{ width: number, height: number }> => {
  if (isIOS) {
    const { width, height } = Dimensions.get('window')
    return { width, height }
  }
  return UtilsModule.getWindowSize()
}

export const onWindowSizeChange = (handler: (size: { width: number, height: number }) => void): () => void => {
  if (isIOS) {
    const subscription = Dimensions.addEventListener('change', ({ window }) => handler({ width: window.width, height: window.height }))
    return () => subscription.remove()
  }
  UtilsModule.listenWindowSizeChanged()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  const eventListener = eventEmitter.addListener('screen-size-changed', event => {
    handler(event as { width: number, height: number })
  })

  return () => {
    eventListener.remove()
  }
}

export const isIgnoringBatteryOptimization = async(): Promise<boolean> => isIOS ? true : UtilsModule.isIgnoringBatteryOptimization()

export const requestIgnoreBatteryOptimization = async(): Promise<boolean> => {
  if (isIOS) return true
  return new Promise<boolean>((resolve) => {
    let subscription = AppState.addEventListener('change', (state) => {
      if (state != 'active') return
      subscription.remove()
      setTimeout(() => {
        void isIgnoringBatteryOptimization().then(resolve)
      }, 1000)
    })
    UtilsModule.requestIgnoreBatteryOptimization().then((result: boolean) => {
      if (result) return
      subscription.remove()
      resolve(false)
    })
  })
}
