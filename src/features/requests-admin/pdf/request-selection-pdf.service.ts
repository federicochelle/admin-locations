import { getSupabaseClient } from '../../../lib/supabase'

type OfficialRequestProjectPdf = {
  bucket: string
  path: string
  fileName: string | null
  generatedAt: string | null
  uploadedAt: string | null
  sizeBytes: number | null
}

function validateOfficialPdf(officialPdf: OfficialRequestProjectPdf | null) {
  if (!officialPdf?.bucket || !officialPdf.path) {
    throw new Error('Esta solicitud no tiene un PDF oficial disponible.')
  }

  return officialPdf
}

function openPdfBlobInNewTab(blob: Blob) {
  const blobUrl = URL.createObjectURL(blob)

  window.open(blobUrl, '_blank', 'noopener,noreferrer')

  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl)
  }, 60_000)
}

export async function openOfficialRequestProjectPdf(
  officialPdf: OfficialRequestProjectPdf | null,
) {
  const resolvedOfficialPdf = validateOfficialPdf(officialPdf)
  const supabase = getSupabaseClient()

  const { data, error } = await supabase.storage
    .from(resolvedOfficialPdf.bucket)
    .download(resolvedOfficialPdf.path)

  if (error) {
    throw new Error('No pudimos descargar el PDF oficial de la solicitud.')
  }

  if (!(data instanceof Blob) || data.size === 0) {
    throw new Error('El PDF oficial de la solicitud no está disponible.')
  }

  openPdfBlobInNewTab(data)
}
