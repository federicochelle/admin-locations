import { getRequiredEnv } from './env.ts'
import { HttpError } from './http.ts'

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
])

type CloudflareEnvelope<T> = {
  errors?: Array<{ code?: number; message?: string }>
  messages?: Array<{ code?: number; message?: string }>
  result?: T
  success?: boolean
}

export type CloudflareDirectUploadResult = {
  id?: string
  uploadURL?: string
}

export type CloudflareImageDetails = {
  id?: string
  filename?: string
  meta?: unknown
  requireSignedURLs?: boolean
  uploaded?: string
  variants?: string[]
  width?: number
  height?: number
}

function getCloudflareApiBaseUrl() {
  return `https://api.cloudflare.com/client/v4/accounts/${getRequiredEnv('CLOUDFLARE_ACCOUNT_ID')}/images`
}

function getCloudflareHeaders() {
  return {
    Authorization: `Bearer ${getRequiredEnv('CLOUDFLARE_API_TOKEN')}`,
  }
}

function getCloudflareErrorMessage<T>(response: CloudflareEnvelope<T>) {
  return (
    response.errors?.map((error) => error.message).filter(Boolean).join('; ') ||
    'Cloudflare Images request failed.'
  )
}

function isCloudflareImageAlreadyMissing(error: unknown) {
  if (!(error instanceof HttpError) || !error.details) {
    return false
  }

  const details =
    typeof error.details === 'object' && error.details !== null
      ? (error.details as {
          body?: {
            errors?: Array<{ code?: number; message?: string }>
          }
          upstreamStatus?: number
        })
      : null

  if (!details) {
    return false
  }

  const upstreamStatus = details.upstreamStatus
  const cloudflareErrors = details.body?.errors ?? []

  return (
    upstreamStatus === 404 &&
    cloudflareErrors.some(
      (entry) =>
        entry.code === 5404 ||
        entry.message?.toLowerCase().includes('image not found') === true,
    )
  )
}

async function cloudflareRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const url = `${getCloudflareApiBaseUrl()}${path}`
  let response: Response

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...getCloudflareHeaders(),
        ...(init.headers ?? {}),
      },
    })
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError'
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error reaching Cloudflare.'

    console.error('[cloudflare] request_unreachable', {
      errorMessage,
      errorName,
      path,
      url,
    })

    throw new HttpError(502, 'Could not reach Cloudflare Images API.', {
      endpoint: url,
      errorMessage,
      errorName,
      path,
    })
  }

  const rawBody = await response.text()
  let payload: CloudflareEnvelope<T> | null = null

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as CloudflareEnvelope<T>
    } catch {
      console.error('[cloudflare] non_json_response', {
        path,
        status: response.status,
        statusText: response.statusText,
        url,
        bodyPreview: rawBody.slice(0, 500),
      })
      throw new HttpError(502, 'Cloudflare Images returned a non-JSON response.', {
        bodyPreview: rawBody.slice(0, 500),
        upstreamStatus: response.status,
        upstreamStatusText: response.statusText,
      })
    }
  }

  if (!response.ok || payload?.success === false || !payload?.result) {
    console.error('[cloudflare] request_failed', {
      path,
      status: response.status,
      statusText: response.statusText,
      url,
      body: payload,
      rawBodyPreview: payload ? null : rawBody.slice(0, 500),
    })
    throw new HttpError(502, getCloudflareErrorMessage(payload ?? {}), {
      body: payload,
      rawBodyPreview: payload ? null : rawBody.slice(0, 500),
      upstreamStatus: response.status,
      upstreamStatusText: response.statusText,
    })
  }

  return payload.result
}

export function assertAllowedContentType(contentType: string) {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new HttpError(
      400,
      'Unsupported image content type.',
      Array.from(ALLOWED_CONTENT_TYPES),
    )
  }
}

export async function createDirectUploadUrl(input: {
  contentType: string
  filename: string
  userId: string
  locationId?: string
  categoryId?: string
  metadata?: Record<string, unknown>
}) {
  const formData = new FormData()
  const metadata = {
    ...(input.metadata ?? {}),
    contentType: input.contentType,
    filename: input.filename,
    uploadedBy: input.userId,
  }

  if (input.locationId) {
    metadata.locationId = input.locationId
  }

  if (input.categoryId) {
    metadata.categoryId = input.categoryId
  }

  formData.set(
    'metadata',
    JSON.stringify(metadata),
  )

  return await cloudflareRequest<CloudflareDirectUploadResult>(
    '/v2/direct_upload',
    {
      body: formData,
      method: 'POST',
    },
  )
}

export async function getCloudflareImageDetails(cloudflareImageId: string) {
  return await cloudflareRequest<CloudflareImageDetails>(
    `/v1/${cloudflareImageId}`,
    {
      method: 'GET',
    },
  )
}

export async function deleteCloudflareImage(cloudflareImageId: string) {
  try {
    await cloudflareRequest<Record<string, never>>(
      `/v1/${cloudflareImageId}`,
      {
        method: 'DELETE',
      },
    )
  } catch (error) {
    if (isCloudflareImageAlreadyMissing(error)) {
      console.warn('[cloudflare] image_already_missing', {
        cloudflareImageId,
      })
      return
    }

    throw error
  }
}

export function buildCloudflarePublicUrl(cloudflareImageId: string) {
  return `${getRequiredEnv('CLOUDFLARE_DELIVERY_URL').replace(/\/$/, '')}/${cloudflareImageId}/public`
}

function readOptionalNumberField(
  payload: CloudflareImageDetails,
  key: 'width' | 'height',
) {
  const value = payload[key]
  return typeof value === 'number' ? value : null
}

export function getCloudflareImageDimensions(payload: CloudflareImageDetails) {
  return {
    width: readOptionalNumberField(payload, 'width'),
    height: readOptionalNumberField(payload, 'height'),
  }
}
