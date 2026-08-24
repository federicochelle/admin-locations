import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  getSupabaseClient,
} from '../../lib/supabase'
import type {
  ProductionCompanyFormValues,
  ProductionCompanyListItem,
} from './production-companies.types'

type ProductionCompanyRow = {
  id: string
  name: string | null
  logo_url: string | null
  logo_public_id: string | null
  active: boolean | null
  created_at: string | null
  updated_at: string | null
}

type ProductionCompanyLogoContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/avif'

type ProductionCompanyLogoUploadUrlInput = {
  productionCompanyId: string
  fileName: string
  contentType: ProductionCompanyLogoContentType
}

type ProductionCompanyLogoUploadUrlResult = {
  uploadURL: string | null
}

type ProductionCompanyLogoFinalizeInput = {
  productionCompanyId: string
  cloudflareImageId: string
}

type ProductionCompanyLogoFinalizeResult = {
  logoPublicId: string | null
  logoUrl: string | null
}

type DeleteProductionCompanyLogoInput = {
  productionCompanyId: string
}

type DeleteProductionCompanyLogoResult = {
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

type UploadProductionCompanyLogoInput = {
  productionCompanyId: string
  file: File
  onStatusChange?: (
    status: 'preparing' | 'uploading' | 'finalizing',
  ) => void
}

type UploadProductionCompanyLogoResult = {
  directUpload: CloudflareDirectUploadResponse
  finalizedImage: ProductionCompanyLogoFinalizeResult
  imageId: string
}

function normalizeNullableString(value: string | null | undefined) {
  const normalizedValue = value?.trim() ?? ''
  return normalizedValue.length > 0 ? normalizedValue : null
}

function mapProductionCompanyRow(
  row: ProductionCompanyRow,
): ProductionCompanyListItem {
  return {
    id: row.id,
    name: row.name?.trim() || 'Sin nombre',
    logoUrl: normalizeNullableString(row.logo_url),
    logoPublicId: normalizeNullableString(row.logo_public_id),
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function buildUpsertPayload(values: ProductionCompanyFormValues) {
  const normalizedName = values.name.trim()

  if (!normalizedName) {
    throw new Error('El nombre de la productora es obligatorio.')
  }

  return {
    name: normalizedName,
  }
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
      .join('; ') || 'No pudimos subir el logo a Cloudflare.'
  )
}

const ALLOWED_PRODUCTION_COMPANY_LOGO_CONTENT_TYPES =
  new Set<ProductionCompanyLogoContentType>([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
  ])

function validateProductionCompanyLogoContentType(
  contentType: string,
): ProductionCompanyLogoContentType {
  if (
    ALLOWED_PRODUCTION_COMPANY_LOGO_CONTENT_TYPES.has(
      contentType as ProductionCompanyLogoContentType,
    )
  ) {
    return contentType as ProductionCompanyLogoContentType
  }

  throw new Error(
    'Formato de imagen no permitido para upload final. Usá JPG, PNG, WEBP o AVIF; los archivos HEIC/HEIF se convierten automáticamente antes de subir.',
  )
}

export async function getActiveProductionCompanies(): Promise<
  ProductionCompanyListItem[]
> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('production_companies')
    .select('id, name, logo_url, logo_public_id, active, created_at, updated_at')
    .eq('active', true)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as ProductionCompanyRow[]).map(mapProductionCompanyRow)
}

export async function getAdminProductionCompanies(): Promise<
  ProductionCompanyListItem[]
> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('production_companies')
    .select('id, name, logo_url, logo_public_id, active, created_at, updated_at')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as ProductionCompanyRow[]).map(mapProductionCompanyRow)
}

export async function createProductionCompany(
  values: ProductionCompanyFormValues,
): Promise<ProductionCompanyListItem> {
  const supabase = getSupabaseClient()
  const payload = {
    ...buildUpsertPayload(values),
    active: true,
  }

  const { data, error } = await supabase
    .from('production_companies')
    .insert(payload)
    .select('id, name, logo_url, logo_public_id, active, created_at, updated_at')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'No pudimos crear la productora.')
  }

  return mapProductionCompanyRow(data as ProductionCompanyRow)
}

export async function updateProductionCompany(
  id: string,
  values: ProductionCompanyFormValues,
): Promise<ProductionCompanyListItem> {
  const supabase = getSupabaseClient()
  const payload = buildUpsertPayload(values)

  const { data, error } = await supabase
    .from('production_companies')
    .update(payload)
    .eq('id', id)
    .select('id, name, logo_url, logo_public_id, active, created_at, updated_at')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'No pudimos actualizar la productora.')
  }

  return mapProductionCompanyRow(data as ProductionCompanyRow)
}

export async function getProductionCompanyLogoUploadUrl(
  input: ProductionCompanyLogoUploadUrlInput,
): Promise<ProductionCompanyLogoUploadUrlResult> {
  const supabase = getSupabaseClient()

  const { data, error } =
    await supabase.functions.invoke<ProductionCompanyLogoUploadUrlResult>(
      'production-company-logo-upload-url',
      {
        body: input,
      },
    )

  if (error) {
    throw new Error(
      await getEdgeFunctionErrorMessage(
        error,
        'No pudimos solicitar la URL de upload del logo.',
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

export async function uploadProductionCompanyLogoToCloudflare(
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
        : 'No pudimos subir el logo a Cloudflare.',
    )
  }

  return payload
}

export async function finalizeProductionCompanyLogoUpload(
  input: ProductionCompanyLogoFinalizeInput,
): Promise<ProductionCompanyLogoFinalizeResult> {
  const supabase = getSupabaseClient()

  const { data, error } =
    await supabase.functions.invoke<ProductionCompanyLogoFinalizeResult>(
      'production-company-logo-finalize',
      {
        body: input,
      },
    )

  if (error) {
    throw new Error(
      await getEdgeFunctionErrorMessage(
        error,
        'No pudimos finalizar el logo de la productora.',
      ),
      {
        cause: error,
      },
    )
  }

  if (!data) {
    throw new Error('No recibimos datos al finalizar el logo.')
  }

  return data
}

export async function uploadProductionCompanyLogo(
  input: UploadProductionCompanyLogoInput,
): Promise<UploadProductionCompanyLogoResult> {
  try {
    input.onStatusChange?.('preparing')
    const contentType = validateProductionCompanyLogoContentType(input.file.type)

    const uploadUrlResult = await getProductionCompanyLogoUploadUrl({
      productionCompanyId: input.productionCompanyId,
      fileName: input.file.name,
      contentType,
    })

    if (!uploadUrlResult.uploadURL) {
      throw new Error('Cloudflare no devolvió una upload URL válida.')
    }

    input.onStatusChange?.('uploading')
    const directUpload = await uploadProductionCompanyLogoToCloudflare(
      uploadUrlResult.uploadURL,
      input.file,
    )

    const cloudflareImageId = directUpload.result?.id ?? null

    if (!cloudflareImageId) {
      throw new Error('No pudimos identificar el logo subido en Cloudflare.')
    }

    input.onStatusChange?.('finalizing')
    const finalizedImage = await finalizeProductionCompanyLogoUpload({
      productionCompanyId: input.productionCompanyId,
      cloudflareImageId,
    })

    return {
      directUpload,
      finalizedImage,
      imageId: cloudflareImageId,
    }
  } catch (error) {
    throw new Error(
      getErrorMessage(error, 'No pudimos completar la subida del logo.'),
      {
        cause: error,
      },
    )
  }
}

export async function deleteProductionCompanyLogo(
  input: DeleteProductionCompanyLogoInput,
): Promise<DeleteProductionCompanyLogoResult> {
  const supabase = getSupabaseClient()

  const { data, error } =
    await supabase.functions.invoke<DeleteProductionCompanyLogoResult>(
      'production-company-logo-delete',
      {
        body: input,
      },
    )

  if (error) {
    throw new Error(
      await getEdgeFunctionErrorMessage(
        error,
        'No pudimos eliminar el logo de la productora.',
      ),
      {
        cause: error,
      },
    )
  }

  if (!data) {
    throw new Error('No recibimos datos al eliminar el logo.')
  }

  return data
}
