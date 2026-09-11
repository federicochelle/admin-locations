import { annotateLocationDeleteFailure } from './location-edge-errors'
import { annotateAdminError, normalizeAdminError } from '../../lib/admin-error-reporting'
import { getAdminCorrelationHeaders } from '../../lib/admin-correlation'
import { getSupabaseClient } from '../../lib/supabase'
import type {
  DeleteLocationImageInput,
  DeleteLocationImageResult,
  CloudflareDirectUploadResponse,
  LocationImageContentType,
  LocationImageFinalizeInput,
  LocationImageRecord,
  LocationImageSourceInput,
  LocationImageSourceResult,
  LocationImageUploadUrlInput,
  LocationImageUploadUrlResult,
  ReplaceLocationImageInput,
  UploadLocationImageInput,
  UploadLocationImageResult,
} from './location-images.types'

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error.message
  }

  return fallbackMessage
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error
      ? error.name === 'AbortError'
      : false
}

function getUploadAbortMessage(signal?: AbortSignal) {
  const reason = signal?.reason

  if (reason instanceof Error && reason.message.trim().length > 0) {
    return reason.message
  }

  if (typeof reason === 'string' && reason.trim().length > 0) {
    return reason
  }

  return 'La subida tardó demasiado y fue cancelada. Intenta nuevamente.'
}

function toNullableString(value?: string | null) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getCloudflareUploadErrorMessage(
  response: CloudflareDirectUploadResponse,
) {
  return (
    response.errors
      ?.map((entry) => entry.message)
      .filter((message): message is string => Boolean(message))
      .join('; ') || 'No pudimos subir la imagen a Cloudflare.'
  )
}

const ALLOWED_LOCATION_IMAGE_CONTENT_TYPES = new Set<LocationImageContentType>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
])

function validateLocationImageContentType(
  contentType: string,
): LocationImageContentType {
  if (
    ALLOWED_LOCATION_IMAGE_CONTENT_TYPES.has(
      contentType as LocationImageContentType,
    )
  ) {
    return contentType as LocationImageContentType
  }

  throw new Error(
    'Formato de imagen no permitido para upload final. Usá JPG, PNG, WEBP o AVIF; los archivos HEIC/HEIF se convierten automáticamente antes de subir.',
  )
}

export async function getLocationImageUploadUrl(
  input: LocationImageUploadUrlInput,
  signal?: AbortSignal,
): Promise<LocationImageUploadUrlResult> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.functions.invoke<LocationImageUploadUrlResult>(
      'location-image-upload-url',
      {
        body: {
          contentType: input.contentType,
          filename: input.filename,
          locationId: input.locationId,
        },
        headers: getAdminCorrelationHeaders(input.correlationId),
        signal,
      },
    )

    if (error) {
      throw normalizeAdminError(error)
    }

    if (!data) {
      throw new Error('No recibimos datos al solicitar la URL de upload.')
    }

    return data
  } catch (error) {
    throw annotateAdminError(error, { stage: 'images.upload_url', provider: 'supabase' })
  }
}

export async function uploadImageFileToCloudflare(
  uploadURL: string,
  file: File,
  signal?: AbortSignal,
): Promise<CloudflareDirectUploadResponse> {
  try {
    const formData = new FormData()
    formData.set('file', file)

    const response = await fetch(uploadURL, {
      body: formData,
      method: 'POST',
      signal,
    })

    const payload =
      (await response.json().catch(() => null)) as CloudflareDirectUploadResponse | null

    if (!response.ok || !payload || payload.success === false) {
      throw annotateAdminError(new Error(
        payload
          ? getCloudflareUploadErrorMessage(payload)
          : 'No pudimos subir la imagen a Cloudflare.',
      ), { httpStatus: response.status })
    }

    return payload
  } catch (error) {
    throw annotateAdminError(error, { stage: 'images.upload', provider: 'cloudflare' })
  }
}

export async function finalizeLocationImageUpload(
  input: LocationImageFinalizeInput,
  signal?: AbortSignal,
): Promise<LocationImageRecord> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.functions.invoke<LocationImageRecord>(
      'location-image-finalize',
      {
        body: {
          altText: toNullableString(input.altText),
          caption: toNullableString(input.caption),
          clientUploadId: toNullableString(input.clientUploadId),
          cloudflareImageId: input.cloudflareImageId,
          height: input.height,
          isCover: input.isCover,
          locationId: input.locationId,
          sortOrder: input.sortOrder,
          width: input.width,
        },
        headers: getAdminCorrelationHeaders(input.correlationId),
        signal,
      },
    )

    if (error) {
      throw normalizeAdminError(error)
    }

    if (!data) {
      throw new Error('No recibimos datos al finalizar la imagen.')
    }

    return data
  } catch (error) {
    throw annotateAdminError(error, { stage: 'images.finalize', provider: 'supabase' })
  }
}

export async function getLocationImages(
  locationId: string,
): Promise<LocationImageRecord[]> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('location_images')
      .select(
        `
          id,
          location_id,
          url,
          storage_key,
          alt_text,
          caption,
          sort_order,
          is_cover,
          width,
          height,
          created_at,
          updated_at
        `,
      )
      .eq('location_id', locationId)
      .order('sort_order', { ascending: true })

    if (error) {
      throw normalizeAdminError(error)
    }

    return (data ?? []) as LocationImageRecord[]
  } catch (error) {
    throw annotateAdminError(error, { stage: 'images.refresh', provider: 'supabase' })
  }
}

export async function deleteLocationImage(
  input: DeleteLocationImageInput,
): Promise<DeleteLocationImageResult> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.functions.invoke<DeleteLocationImageResult>(
      'location-image-delete',
      {
        body: input,
      },
    )

    if (error) {
      throw await annotateLocationDeleteFailure(error)
    }

    if (!data) {
      throw new Error('No recibimos datos al eliminar la imagen.')
    }

    return data
  } catch (error) {
    throw annotateAdminError(error, { stage: 'images.delete', provider: 'supabase' })
  }
}

export async function downloadLocationImageSource(
  input: LocationImageSourceInput,
): Promise<LocationImageSourceResult> {
  try {
    const supabase = getSupabaseClient()

    const { data, error, response } = await supabase.functions.invoke<Blob>(
      'location-image-source',
      {
        body: input,
      },
    )

    if (error) {
      throw normalizeAdminError(error)
    }

    if (!(data instanceof Blob)) {
      throw new Error('No recibimos los bytes de la imagen.')
    }

    return {
      blob: data,
      contentType:
        response?.headers.get('x-image-content-type')?.trim() ||
        'image/jpeg',
    }
  } catch (error) {
    throw annotateAdminError(error, { stage: 'images.source', provider: 'supabase' })
  }
}

export async function replaceLocationImage(
  input: ReplaceLocationImageInput,
): Promise<LocationImageRecord> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.functions.invoke<LocationImageRecord>(
      'location-image-replace',
      {
        body: input,
      },
    )

    if (error) {
      throw normalizeAdminError(error)
    }

    if (!data) {
      throw new Error('No recibimos la imagen reemplazada.')
    }

    return data
  } catch (error) {
    throw annotateAdminError(error, { stage: 'images.replace', provider: 'supabase' })
  }
}

export async function uploadLocationImageAsset(input: {
  file: File
  locationId: string
  onUploadStart?: () => void
  signal?: AbortSignal
  correlationId?: string
}): Promise<{
  cloudflareImageId: string
  directUpload: CloudflareDirectUploadResponse
}> {
  const contentType = validateLocationImageContentType(input.file.type)
  const uploadUrlResult = await getLocationImageUploadUrl(
    {
      locationId: input.locationId,
      filename: input.file.name,
      contentType,
      correlationId: input.correlationId,
    },
    input.signal,
  )

  if (!uploadUrlResult.uploadURL) {
    throw new Error('Cloudflare no devolvió una upload URL válida.')
  }

  input.onUploadStart?.()

  const directUpload = await uploadImageFileToCloudflare(
    uploadUrlResult.uploadURL,
    input.file,
    input.signal,
  )
  const cloudflareImageId =
    directUpload.result?.id ?? uploadUrlResult.imageId ?? null

  if (!cloudflareImageId) {
    throw new Error('No pudimos identificar la imagen subida en Cloudflare.')
  }

  return {
    cloudflareImageId,
    directUpload,
  }
}

export async function uploadLocationImage(
  input: UploadLocationImageInput,
): Promise<UploadLocationImageResult> {
  try {
    const uploadedAsset = await uploadLocationImageAsset({
      correlationId: input.correlationId,
      file: input.file,
      locationId: input.locationId,
      onUploadStart: () => input.onStatusChange?.('uploading'),
      signal: input.signal,
    })
    const { cloudflareImageId } = uploadedAsset

    input.onStatusChange?.('finalizing')

    const finalizedImage = await finalizeLocationImageUpload({
      locationId: input.locationId,
      cloudflareImageId,
      clientUploadId: input.clientUploadId,
      correlationId: input.correlationId,
      height: input.height,
      altText: input.altText,
      caption: input.caption,
      isCover: input.isCover,
      sortOrder: input.sortOrder,
      width: input.width,
    }, input.signal)

    return {
      directUpload: uploadedAsset.directUpload,
      finalizedImage,
      imageId: cloudflareImageId,
    }
  } catch (error) {
    if (input.signal?.aborted || isAbortError(error)) {
      throw new Error(getUploadAbortMessage(input.signal), {
        cause: error,
      })
    }

    throw new Error(
      getErrorMessage(error, 'No pudimos completar la subida de la imagen.'),
      {
        cause: error,
      },
    )
  }
}
