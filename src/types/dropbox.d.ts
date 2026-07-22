export {}

declare global {
  interface DropboxChooserFile {
    id: string
    name: string
    link: string
    bytes: number
    icon?: string
    thumbnailLink?: string
    isDir?: boolean
  }

  interface DropboxChooseOptions {
    success: (files: DropboxChooserFile[]) => void
    cancel?: () => void
    linkType: 'direct'
    multiselect: boolean
    extensions?: string[]
    folderselect?: boolean
    sizeLimit?: number
  }

  interface DropboxGlobal {
    choose: (options: DropboxChooseOptions) => void
    isBrowserSupported?: () => boolean
  }

  interface Window {
    Dropbox?: DropboxGlobal
  }
}
