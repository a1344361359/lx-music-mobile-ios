import { createContext, useContext } from 'react'

// iOS 设置详情页等局部区域可以单独放大，不影响首页和底部导航。
export const UIScaleContext = createContext(1)

export const useUIScale = () => useContext(UIScaleContext)
