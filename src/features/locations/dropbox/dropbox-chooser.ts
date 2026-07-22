const DROPBOX_SCRIPT_ID = 'dropboxjs'
const DROPBOX_SCRIPT_SRC = 'https://www.dropbox.com/static/api/2/dropins.js'

let dropboxLoaderPromise: Promise<DropboxGlobal> | null = null

function getDropboxAppKey() {
  const appKey = import.meta.env.VITE_DROPBOX_APP_KEY?.trim()

  if (!appKey) {
    throw new Error('Falta configurar VITE_DROPBOX_APP_KEY.')
  }

  return appKey
}

function resolveDropboxFromWindow() {
  if (!window.Dropbox) {
    throw new Error('Dropbox Chooser no quedó disponible en el navegador.')
  }

  return window.Dropbox
}

function waitForDropboxScript(script: HTMLScriptElement) {
  return new Promise<DropboxGlobal>((resolve, reject) => {
    const cleanup = () => {
      script.removeEventListener('load', handleLoad)
      script.removeEventListener('error', handleError)
    }

    const handleLoad = () => {
      cleanup()

      try {
        const dropbox = resolveDropboxFromWindow()

        if (import.meta.env.DEV) {
          console.debug('[Dropbox] script cargado')
        }

        resolve(dropbox)
      } catch (error) {
        dropboxLoaderPromise = null
        reject(error)
      }
    }

    const handleError = () => {
      cleanup()
      dropboxLoaderPromise = null
      reject(new Error('No pudimos cargar Dropbox Chooser. Intenta nuevamente.'))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
  })
}

function createDropboxScript(appKey: string) {
  const script = document.createElement('script')
  script.id = DROPBOX_SCRIPT_ID
  script.src = DROPBOX_SCRIPT_SRC
  script.setAttribute('data-app-key', appKey)
  script.async = true
  script.defer = true

  return script
}

export async function loadDropboxChooser() {
  if (window.Dropbox) {
    return window.Dropbox
  }

  if (dropboxLoaderPromise) {
    return await dropboxLoaderPromise
  }

  const appKey = getDropboxAppKey()
  const existingScript = document.getElementById(
    DROPBOX_SCRIPT_ID,
  ) as HTMLScriptElement | null

  if (existingScript) {
    if (window.Dropbox) {
      return resolveDropboxFromWindow()
    }

    existingScript.remove()
    const replacementScript = createDropboxScript(appKey)
    dropboxLoaderPromise = waitForDropboxScript(replacementScript)
    document.head.appendChild(replacementScript)
    return await dropboxLoaderPromise
  }

  const script = createDropboxScript(appKey)
  dropboxLoaderPromise = waitForDropboxScript(script)
  document.head.appendChild(script)

  return await dropboxLoaderPromise
}
