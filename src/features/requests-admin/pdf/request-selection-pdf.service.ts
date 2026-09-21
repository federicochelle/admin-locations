import { getSupabaseClient } from '../../../lib/supabase'

const OFFICIAL_PDF_SIGNED_URL_TTL_SECONDS = 120

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

function closePopup(popup: Window) {
  try {
    popup.close()
  } catch {
    // Ignore browsers that prevent closing the placeholder tab.
  }
}

function detachPopupOpener(popup: Window) {
  try {
    popup.opener = null
  } catch {
    // Keep the PDF flow working if the browser disallows changing opener.
  }
}

function getSignedUrlErrorMessage(message: string | null | undefined) {
  const normalizedMessage = message?.trim()

  return normalizedMessage
    ? `No pudimos generar el enlace temporal del PDF oficial: ${normalizedMessage}`
    : 'No pudimos generar el enlace temporal del PDF oficial.'
}

export async function openOfficialRequestProjectPdf(
  officialPdf: OfficialRequestProjectPdf | null,
) {
  const resolvedOfficialPdf = validateOfficialPdf(officialPdf)
  const popup = window.open('', '_blank')

  if (!popup) {
    throw new Error(
      'El navegador bloqueó la apertura del PDF. Permití ventanas emergentes para este sitio.',
    )
  }

  detachPopupOpener(popup)

  const supabase = getSupabaseClient()

  const { data, error } = await supabase.storage
    .from(resolvedOfficialPdf.bucket)
    .createSignedUrl(
      resolvedOfficialPdf.path,
      OFFICIAL_PDF_SIGNED_URL_TTL_SECONDS,
    )

  if (error) {
    closePopup(popup)
    throw new Error(getSignedUrlErrorMessage(error.message))
  }

  const signedUrl = data?.signedUrl?.trim()

  if (!signedUrl) {
    closePopup(popup)
    throw new Error('Supabase no devolvió un enlace temporal para el PDF oficial.')
  }

  popup.location.replace(signedUrl)
}
