import { assertAdmin } from '../_shared/auth.ts'
import {
  assertAllowedContentType,
  createDirectUploadUrl,
} from '../_shared/cloudflare.ts'
import { errorResponse, handleOptions, HttpError, jsonResponse } from '../_shared/http.ts'
import { assertProductionCompanyExists } from '../_shared/production-companies.ts'

type UploadUrlRequestBody = {
  productionCompanyId?: unknown
  contentType?: unknown
  fileName?: unknown
}

function parseRequestBody(body: UploadUrlRequestBody) {
  const productionCompanyId =
    typeof body.productionCompanyId === 'string'
      ? body.productionCompanyId.trim()
      : ''
  const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : ''
  const contentType =
    typeof body.contentType === 'string' ? body.contentType.trim() : ''

  if (!productionCompanyId) {
    throw new HttpError(400, 'productionCompanyId is required.')
  }

  if (!fileName) {
    throw new HttpError(400, 'fileName is required.')
  }

  if (!contentType) {
    throw new HttpError(400, 'contentType is required.')
  }

  assertAllowedContentType(contentType)

  return {
    productionCompanyId,
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
    const { user, userClient } = await assertAdmin(request)

    await assertProductionCompanyExists(userClient, input.productionCompanyId)

    const cloudflareResult = await createDirectUploadUrl({
      contentType: input.contentType,
      filename: input.fileName,
      userId: user.id,
      metadata: {
        productionCompanyId: input.productionCompanyId,
      },
    })

    return jsonResponse(
      {
        uploadURL: cloudflareResult.uploadURL ?? null,
      },
      { status: 200 },
      origin,
    )
  } catch (error) {
    console.error('[production-company-logo-upload-url] request_failed', error)
    return errorResponse(error, origin)
  }
})
