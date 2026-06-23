import { assertAdmin } from '../_shared/auth.ts'
import {
  assertAllowedContentType,
  createDirectUploadUrl,
} from '../_shared/cloudflare.ts'
import { assertCategoryExists } from '../_shared/categories.ts'
import {
  errorResponse,
  handleOptions,
  HttpError,
  jsonResponse,
} from '../_shared/http.ts'

type UploadUrlRequestBody = {
  categoryId?: unknown
  contentType?: unknown
  fileName?: unknown
}

function parseRequestBody(body: UploadUrlRequestBody) {
  const categoryId =
    typeof body.categoryId === 'string' ? body.categoryId.trim() : ''
  const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : ''
  const contentType =
    typeof body.contentType === 'string' ? body.contentType.trim() : ''

  if (!categoryId) {
    throw new HttpError(400, 'categoryId is required.')
  }

  if (!fileName) {
    throw new HttpError(400, 'fileName is required.')
  }

  if (!contentType) {
    throw new HttpError(400, 'contentType is required.')
  }

  assertAllowedContentType(contentType)

  return {
    categoryId,
    contentType,
    fileName,
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')

  if (request.method === 'OPTIONS') {
    return handleOptions(request)
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      { error: 'Method not allowed.' },
      { status: 405 },
      origin,
    )
  }

  try {
    const body = (await request.json()) as UploadUrlRequestBody
    const input = parseRequestBody(body)
    const { adminClient, user } = await assertAdmin(request)

    await assertCategoryExists(adminClient, input.categoryId)

    const cloudflareResult = await createDirectUploadUrl({
      contentType: input.contentType,
      filename: input.fileName,
      categoryId: input.categoryId,
      userId: user.id,
    })

    return jsonResponse(
      {
        uploadURL: cloudflareResult.uploadURL ?? null,
      },
      { status: 200 },
      origin,
    )
  } catch (error) {
    if (error instanceof HttpError) {
      console.error('[category-image-upload-url] request_failed', {
        details: error.details ?? null,
        message: error.message,
        status: error.status,
      })
    } else if (error instanceof Error) {
      console.error('[category-image-upload-url] request_failed', {
        message: error.message,
        name: error.name,
        stack: error.stack ?? null,
      })
    } else {
      console.error('[category-image-upload-url] request_failed', {
        message: 'Unknown error',
      })
    }

    return errorResponse(error, origin)
  }
})
