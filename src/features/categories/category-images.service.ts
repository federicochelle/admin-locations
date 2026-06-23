import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  getSupabaseClient,
} from '../../lib/supabase'

type CategoryImageContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/avif'

type CategoryImageUploadUrlInput = {
  categoryId: string
  fileName: string
  contentType: CategoryImageContentType
}

type CategoryImageUploadUrlResult = {
  uploadURL: string | null
}

type CategoryImageFinalizeInput = {
  categoryId: string
  cloudflareImageId: string
}

type CategoryImageFinalizeResult = {
  imageCloudflareId: string | null
  imageUrl: string | null
}

type DeleteCategoryImageInput = {
  categoryId: string
}

type DeleteCategoryImageResult = {
  success: true
}

type CloudflareDirectUploadResult = {
  id?: string
  filename?: string
  uploaded?: string
  requireSignedURLs?: boolean
  variants?: string[]
}

type CloudflareDirectUploadResponse = {
  errors?: Array<{ code?: number; message?: string }>
  messages?: Array<{ code?: number; message?: string }>
  result?: CloudflareDirectUploadResult
  success?: boolean
}

type UploadCategoryImageInput = {
  categoryId: string
  file: File
}

type UploadCategoryImageResult = {
  directUpload: CloudflareDirectUploadResponse
  finalizedImage: CategoryImageFinalizeResult
  imageId: string
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error.message
  }

  return fallbackMessage
}

async function getEdgeFunctionErrorMessage(
  error: unknown,
  fallbackMessage: string,
): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context

    try {
      const payload = await response.json()

      if (
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        typeof payload.error === 'string'
      ) {
        return payload.error
      }
    } catch {
      try {
        const text = await response.text()

        if (text.trim().length > 0) {
          return text
        }
      } catch {
        return fallbackMessage
      }
    }

    return fallbackMessage
  }

  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    return error.message
  }

  return getErrorMessage(error, fallbackMessage)
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

const ALLOWED_CATEGORY_IMAGE_CONTENT_TYPES = new Set<CategoryImageContentType>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
])

function validateCategoryImageContentType(
  contentType: string,
): CategoryImageContentType {
  if (
    ALLOWED_CATEGORY_IMAGE_CONTENT_TYPES.has(
      contentType as CategoryImageContentType,
    )
  ) {
    return contentType as CategoryImageContentType
  }

  throw new Error(
    'Formato de imagen no permitido. Usá JPG, PNG, WEBP o AVIF.',
  )
}

export async function getCategoryImageUploadUrl(
  input: CategoryImageUploadUrlInput,
): Promise<CategoryImageUploadUrlResult> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase.functions.invoke<CategoryImageUploadUrlResult>(
    'category-image-upload-url',
    {
      body: input,
    },
  )

  if (error) {
    throw new Error(
      await getEdgeFunctionErrorMessage(
        error,
        'No pudimos solicitar la URL de upload de la imagen.',
      ),
      {
        cause: error,
      },
    )
  }

  if (!data) {
    throw new Error('No recibimos datos al solicitar la URL de upload.')
  }

  return data
}

export async function uploadCategoryImageToCloudflare(
  uploadURL: string,
  file: File,
): Promise<CloudflareDirectUploadResponse> {
  const formData = new FormData()
  formData.set('file', file)

  const response = await fetch(uploadURL, {
    body: formData,
    method: 'POST',
  })

  const payload =
    (await response.json().catch(() => null)) as CloudflareDirectUploadResponse | null

  if (!response.ok || !payload || payload.success === false) {
    throw new Error(
      payload
        ? getCloudflareUploadErrorMessage(payload)
        : 'No pudimos subir la imagen a Cloudflare.',
    )
  }

  return payload
}

export async function finalizeCategoryImageUpload(
  input: CategoryImageFinalizeInput,
): Promise<CategoryImageFinalizeResult> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase.functions.invoke<CategoryImageFinalizeResult>(
    'category-image-finalize',
    {
      body: input,
    },
  )

  if (error) {
    throw new Error(
      await getEdgeFunctionErrorMessage(
        error,
        'No pudimos finalizar la imagen de la categoría.',
      ),
      {
        cause: error,
      },
    )
  }

  if (!data) {
    throw new Error('No recibimos datos al finalizar la imagen.')
  }

  return data
}

export async function uploadCategoryImage(
  input: UploadCategoryImageInput,
): Promise<UploadCategoryImageResult> {
  try {
    const contentType = validateCategoryImageContentType(input.file.type)

    const uploadUrlResult = await getCategoryImageUploadUrl({
      categoryId: input.categoryId,
      fileName: input.file.name,
      contentType,
    })

    if (!uploadUrlResult.uploadURL) {
      throw new Error('Cloudflare no devolvió una upload URL válida.')
    }

    const directUpload = await uploadCategoryImageToCloudflare(
      uploadUrlResult.uploadURL,
      input.file,
    )

    const cloudflareImageId = directUpload.result?.id ?? null

    if (!cloudflareImageId) {
      throw new Error('No pudimos identificar la imagen subida en Cloudflare.')
    }

    const finalizedImage = await finalizeCategoryImageUpload({
      categoryId: input.categoryId,
      cloudflareImageId,
    })

    return {
      directUpload,
      finalizedImage,
      imageId: cloudflareImageId,
    }
  } catch (error) {
    throw new Error(
      getErrorMessage(error, 'No pudimos completar la subida de la imagen.'),
      {
        cause: error,
      },
    )
  }
}

export async function deleteCategoryImage(
  input: DeleteCategoryImageInput,
): Promise<DeleteCategoryImageResult> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase.functions.invoke<DeleteCategoryImageResult>(
    'category-image-delete',
    {
      body: input,
    },
  )

  if (error) {
    throw new Error(
      await getEdgeFunctionErrorMessage(
        error,
        'No pudimos eliminar la imagen de la categoría.',
      ),
      {
        cause: error,
      },
    )
  }

  if (!data) {
    throw new Error('No recibimos datos al eliminar la imagen.')
  }

  return data
}
