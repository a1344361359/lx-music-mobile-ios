import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import { USER_API_SOURCE_FILE_EXT_RXP } from '@/config/constant'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { handleImportLocalFile } from './action'
import { selectFile } from '@/utils/fs'
import { TEMP_FILE_PATH, toast } from '@/utils/tools'

export interface ScriptImportExportProps {
  onBeforeNativePicker?: (proceed: () => void) => void
  onAfterNativePicker?: () => void
}

export interface SelectInfo {
  // listInfo: LX.List.MyListInfo
  // selectedList: LX.Music.MusicInfo[]
  // index: number
  // listId: string
  // single: boolean
  action: 'import'
}
const initSelectInfo = {}

// export interface ScriptImportExportProps {
//   // onRename: (listInfo: LX.List.UserListInfo) => void
//   // onImport: (index: number) => void
//   // onExport: (listInfo: LX.List.MyListInfo) => void
//   // onSync: (listInfo: LX.List.UserListInfo) => void
//   // onRemove: (listInfo: LX.List.MyListInfo) => void
// }
export interface ScriptImportExportType {
  import: () => void
  // export: (listInfo: LX.List.MyListInfo, index: number) => void
}

export default forwardRef<ScriptImportExportType, ScriptImportExportProps>((props, ref) => {
  const [visible, setVisible] = useState(false)
  const openingRef = useRef(false)
  const choosePathRef = useRef<ChoosePathType>(null)
  const selectInfoRef = useRef<SelectInfo>((initSelectInfo as SelectInfo))

  const openBuiltInPicker = () => {
    const options = {
      title: global.i18n.t('user_api_import_desc'),
      dirOnly: false,
      filter: USER_API_SOURCE_FILE_EXT_RXP,
    }
    if (visible) choosePathRef.current?.show(options)
    else {
      setVisible(true)
      requestAnimationFrame(() => choosePathRef.current?.show(options))
    }
  }

  useImperativeHandle(ref, () => ({
    import() {
      if (openingRef.current) return
      openingRef.current = true
      selectInfoRef.current = { action: 'import' }
      if (Platform.OS === 'ios' && props.onBeforeNativePicker) {
        // The uploaded IPA waits until every RN modal is gone before presenting
        // UIDocumentPicker. Close the source-manager dialog first, then call the
        // native picker directly instead of presenting it above that dialog.
        props.onBeforeNativePicker(() => {
          void selectFile({
            extTypes: USER_API_SOURCE_FILE_EXT_RXP,
            toPath: TEMP_FILE_PATH,
          }).then(file => {
            if (file?.data) handleImportLocalFile(file.data)
          }).catch((err: any) => {
            const code = String(err?.code ?? '').toLowerCase()
            if (code !== 'picker_cancelled' && code !== 'picker_busy') {
              toast(`打开系统文件选择器失败：${err?.message ?? '未知错误'}`, 'long')
            }
          }).finally(() => {
            openingRef.current = false
            props.onAfterNativePicker?.()
          })
        })
        return
      }
      openingRef.current = false
      openBuiltInPicker()
    },
    // export(listInfo, index) {
    //   selectInfoRef.current = {
    //     action: 'export',
    //     listInfo,
    //     index,
    //   }
    //   if (visible) {
    //     choosePathRef.current?.show({
    //       title: global.i18n.t('list_export_part_desc'),
    //       dirOnly: true,
    //       filter: LXM_FILE_EXT_RXP,
    //     })
    //   } else {
    //     setVisible(true)
    //     requestAnimationFrame(() => {
    //       choosePathRef.current?.show({
    //         title: global.i18n.t('list_export_part_desc'),
    //         dirOnly: true,
    //         filter: LXM_FILE_EXT_RXP,
    //       })
    //     })
    //   }
    // },
  }))


  const onConfirmPath = (path: string) => {
    switch (selectInfoRef.current.action) {
      case 'import':
        handleImportLocalFile(path)
        break
      // case 'export':
      //   handleExport(selectInfoRef.current.listInfo, path)
      //   break
    }
  }

  return (
    visible
      ? <ChoosePath ref={choosePathRef} onConfirm={onConfirmPath} />
      : null
  )
})
