import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { SUPPORTED_IMAGE_EXTENSIONS } from '../../images/image-upload.constants'
import {
  getLoadedDropboxChooser,
  loadDropboxChooser,
} from '../dropbox/dropbox-chooser'
import { downloadDropboxFiles } from '../dropbox/dropbox-files'

export type ImageSelectionTarget = 'cover' | 'gallery'

type UseLocationDropboxInput = {
  handleSelectedImageFiles: (
    files: File[],
    target: ImageSelectionTarget,
  ) => Promise<void>
  imageSelectionTarget: ImageSelectionTarget | null
  isImageSourceModalOpen: boolean
  isMountedRef: MutableRefObject<boolean>
  isReadOnly: boolean
  setEditDeleteErrorMessage: Dispatch<SetStateAction<string | null>>
  setImageSelectionTarget: Dispatch<SetStateAction<ImageSelectionTarget | null>>
  setImageValidationErrors: Dispatch<SetStateAction<string[]>>
  setIsImageSourceModalOpen: Dispatch<SetStateAction<boolean>>
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error
      ? error.name === 'AbortError'
      : false
}

function openDropboxChooser(
  dropbox: DropboxGlobal,
  target: ImageSelectionTarget,
) {
  return new Promise<DropboxChooserFile[]>((resolve, reject) => {
    try {
      dropbox.choose({
        linkType: 'direct',
        multiselect: target === 'gallery',
        folderselect: false,
        extensions: [...SUPPORTED_IMAGE_EXTENSIONS],
        success(files) {
          resolve(files)
        },
        cancel() {
          resolve([])
        },
      })
    } catch (error) {
      reject(error)
    }
  })
}

export function useLocationDropbox({
  handleSelectedImageFiles,
  imageSelectionTarget,
  isImageSourceModalOpen,
  isMountedRef,
  isReadOnly,
  setEditDeleteErrorMessage,
  setImageSelectionTarget,
  setImageValidationErrors,
  setIsImageSourceModalOpen,
}: UseLocationDropboxInput) {
  const [isDropboxImporting, setIsDropboxImporting] = useState(false)
  const [, setDropboxImportProgress] = useState<{
    processed: number
    total: number
  } | null>(null)
  const dropboxAbortControllerRef = useRef<AbortController | null>(null)
  const isDropboxChooserLoadingRef = useRef(false)

  function abortActiveDropboxImport() {
    dropboxAbortControllerRef.current?.abort(
      new DOMException(
        'La importación desde Dropbox fue cancelada.',
        'AbortError',
      ),
    )
    dropboxAbortControllerRef.current = null
  }

  useEffect(() => {
    return () => {
      abortActiveDropboxImport()
    }
  }, [])

  useEffect(() => {
    if (isReadOnly) {
      return
    }

    let isActive = true
    isDropboxChooserLoadingRef.current = true

    void loadDropboxChooser()
      .catch(() => {
        // Si falla la precarga, reintentamos cuando el usuario abra el modal o toque Dropbox.
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        isDropboxChooserLoadingRef.current = false
      })

    return () => {
      isActive = false
    }
  }, [isReadOnly])

  useEffect(() => {
    if (!isImageSourceModalOpen || isReadOnly) {
      return
    }

    if (getLoadedDropboxChooser() || isDropboxChooserLoadingRef.current) {
      return
    }

    let isActive = true
    isDropboxChooserLoadingRef.current = true

    void loadDropboxChooser()
      .catch(() => {
        // Intentamos precargar el script para abrir el chooser desde el click del usuario.
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        isDropboxChooserLoadingRef.current = false
      })

    return () => {
      isActive = false
    }
  }, [isImageSourceModalOpen, isReadOnly])

  async function continueDropboxImport(
    selectedFilesPromise: Promise<DropboxChooserFile[]>,
    target: ImageSelectionTarget,
  ) {
    try {
      const selectedFiles = await selectedFilesPromise

      if (!isMountedRef.current) {
        return
      }

      if (selectedFiles.length === 0) {
        setImageSelectionTarget(null)
        return
      }

      const controller = new AbortController()
      dropboxAbortControllerRef.current = controller
      setIsDropboxImporting(true)
      setDropboxImportProgress({
        processed: 0,
        total: selectedFiles.length,
      })

      const { files, errors } = await downloadDropboxFiles(selectedFiles, {
        signal: controller.signal,
        onProgress: (processed, total) => {
          if (!isMountedRef.current) {
            return
          }

          setDropboxImportProgress({
            processed,
            total,
          })
        },
      })

      if (!isMountedRef.current) {
        return
      }

      if (files.length === 0) {
        setImageValidationErrors(
          errors.length > 0
            ? errors
            : ['No pudimos importar archivos desde Dropbox.'],
        )
        setImageSelectionTarget(null)
        return
      }

      await handleSelectedImageFiles(files, target)

      if (!isMountedRef.current) {
        return
      }

      if (errors.length > 0) {
        setImageValidationErrors((currentErrors) => [
          ...errors,
          ...currentErrors,
        ])
      }

      setImageSelectionTarget(null)
    } catch (error) {
      if (!isMountedRef.current || isAbortError(error)) {
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos importar las imágenes desde Dropbox.'

      setImageValidationErrors([message])
      setImageSelectionTarget(null)
    } finally {
      dropboxAbortControllerRef.current = null

      if (isMountedRef.current) {
        setIsDropboxImporting(false)
        setDropboxImportProgress(null)
      }
    }
  }

  function handleSelectDropboxSource() {
    if (isDropboxImporting) {
      return
    }

    const target = imageSelectionTarget

    if (!target) {
      setImageValidationErrors([
        'No pudimos determinar si querías importar portada o galería.',
      ])
      return
    }

    abortActiveDropboxImport()
    setEditDeleteErrorMessage(null)

    const dropbox = getLoadedDropboxChooser()

    if (!dropbox) {
      setImageValidationErrors([
        'Preparando Dropbox... Intenta nuevamente en un momento.',
      ])

      if (!isDropboxChooserLoadingRef.current) {
        isDropboxChooserLoadingRef.current = true
        void loadDropboxChooser()
          .catch(() => {
            if (!isMountedRef.current) {
              return
            }

            setImageValidationErrors([
              'No pudimos cargar Dropbox Chooser. Intenta nuevamente.',
            ])
          })
          .finally(() => {
            if (!isMountedRef.current) {
              return
            }

            isDropboxChooserLoadingRef.current = false
          })
      }

      return
    }

    if (
      typeof dropbox.isBrowserSupported === 'function' &&
      !dropbox.isBrowserSupported()
    ) {
      setImageValidationErrors([
        'Dropbox no es compatible con este navegador.',
      ])
      return
    }

    const selectedFilesPromise = openDropboxChooser(dropbox, target)
    setIsImageSourceModalOpen(false)
    void continueDropboxImport(selectedFilesPromise, target)
  }

  return {
    abortActiveDropboxImport,
    handleSelectDropboxSource,
    isDropboxImporting,
  }
}
