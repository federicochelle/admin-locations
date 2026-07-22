const DROPBOX_DOWNLOAD_CONCURRENCY = 3

export type DownloadDropboxFilesOptions = {
  signal?: AbortSignal
  onProgress?: (processed: number, total: number) => void
}

export type DownloadDropboxFilesResult = {
  files: File[]
  errors: string[]
}

function normalizeDropboxFileName(file: DropboxChooserFile) {
  const normalizedName = file.name.trim()

  if (normalizedName.length > 0) {
    return normalizedName
  }

  return 'archivo-dropbox'
}

function normalizeDropboxFileType(blob: Blob) {
  return blob.type.trim()
}

async function downloadDropboxFile(
  selectedFile: DropboxChooserFile,
  signal?: AbortSignal,
) {
  if (!selectedFile.link || selectedFile.link.trim().length === 0) {
    throw new Error(`${selectedFile.name}: Dropbox no devolvió un enlace válido.`)
  }

  const response = await fetch(selectedFile.link, {
    method: 'GET',
    signal,
  })

  if (!response.ok) {
    throw new Error(
      `${selectedFile.name}: no pudimos descargar el archivo desde Dropbox.`,
    )
  }

  const blob = await response.blob()
  const fileName = normalizeDropboxFileName(selectedFile)
  const fileType = normalizeDropboxFileType(blob)

  return new File([blob], fileName, {
    type: fileType,
    lastModified: Date.now(),
  })
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error
      ? error.name === 'AbortError'
      : false
}

export async function downloadDropboxFiles(
  selectedFiles: DropboxChooserFile[],
  options: DownloadDropboxFilesOptions = {},
): Promise<DownloadDropboxFilesResult> {
  if (selectedFiles.length === 0) {
    return {
      errors: [],
      files: [],
    }
  }

  const filesByIndex = new Map<number, File>()
  const errorsByIndex = new Map<number, string>()
  const total = selectedFiles.length
  let processed = 0
  let nextIndex = 0

  async function processFile(fileIndex: number) {
    const selectedFile = selectedFiles[fileIndex]

    if (!selectedFile) {
      return
    }

    try {
      const file = await downloadDropboxFile(selectedFile, options.signal)
      filesByIndex.set(fileIndex, file)
    } catch (error) {
      if (options.signal?.aborted || isAbortError(error)) {
        throw error
      }

      const message =
        error instanceof Error
          ? error.message
          : `${selectedFile.name}: no pudimos descargar el archivo desde Dropbox.`

      errorsByIndex.set(fileIndex, message)
    } finally {
      processed += 1
      options.onProgress?.(processed, total)
    }
  }

  async function runWorker() {
    while (nextIndex < selectedFiles.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      await processFile(currentIndex)
    }
  }

  const workerCount = Math.min(DROPBOX_DOWNLOAD_CONCURRENCY, selectedFiles.length)

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))

  return {
    errors: selectedFiles.flatMap((_, index) => {
      const message = errorsByIndex.get(index)
      return message ? [message] : []
    }),
    files: selectedFiles.flatMap((_, index) => {
      const file = filesByIndex.get(index)
      return file ? [file] : []
    }),
  }
}
