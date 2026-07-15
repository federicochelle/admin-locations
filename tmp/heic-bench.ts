import { prepareImageUploadFile } from '../src/features/images/image-upload.processor'

const output = document.getElementById('output')

async function run() {
  const params = new URLSearchParams(window.location.search)
  const filePath = params.get('file')
  const mimeType = params.get('mime') ?? 'image/heic'

  if (!output) {
    return
  }

  if (!filePath) {
    output.textContent = JSON.stringify({ ok: false, error: 'missing file' })
    return
  }

  try {
    const startedAt = performance.now()
    const response = await fetch(filePath)

    if (!response.ok) {
      throw new Error(`fetch failed: ${response.status}`)
    }

    const blob = await response.blob()
    const fileName = decodeURIComponent(filePath.split('/').pop() ?? 'image.heic')
    const file = new File([blob], fileName, { type: mimeType })
    const result = await prepareImageUploadFile(file)
    const totalMs = performance.now() - startedAt

    output.textContent = JSON.stringify(
      {
        fileName,
        finalSize: result.file.size,
        heicPerf: result.heicPerf ?? null,
        ok: true,
        outputType: result.file.type,
        totalMs,
      },
      null,
      2,
    )
    document.title = 'done'
  } catch (error) {
    output.textContent = JSON.stringify(
      {
        message: error instanceof Error ? error.message : String(error),
        ok: false,
      },
      null,
      2,
    )
    document.title = 'error'
  }
}

void run()
