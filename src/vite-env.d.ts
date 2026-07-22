/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  readonly VITE_DROPBOX_APP_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
