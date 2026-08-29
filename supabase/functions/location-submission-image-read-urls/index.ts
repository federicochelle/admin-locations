import { assertAdmin } from '../_shared/auth.ts'
import {
  errorResponse,
  handleOptions,
  HttpError,
  jsonResponse,
} from '../_shared/http.ts'

type ReadUrlsRequestBody = {
  submissionId?: unknown
}

type SubmissionImageRow = {
  id: string
  submission_id: string
  storage_bucket: string | null
  storage_path: string | null
  image_url: string | null
}

type SubmissionImageReadUrl = {
  imageId: string
  url: string | null
}

type SubmissionImageReadUrlsResponse = {
  expiresInSeconds: number
  images: SubmissionImageReadUrl[]
}

const SIGNED_URL_TTL_SECONDS = 600

function normalizeOptionalText(value: string | null | undefined) {
  const normalizedValue = value?.trim()
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null
}

function parseRequestBody(body: ReadUrlsRequestBody) {
  const submissionId =
    typeof body.submissionId === 'string' ? body.submissionId.trim() : ''

  if (!submissionId) {
    throw new HttpError(400, 'submissionId is required.')
  }

  return { submissionId }
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
    const body = (await request.json()) as ReadUrlsRequestBody
    const input = parseRequestBody(body)
    const { adminClient } = await assertAdmin(request)

    const { data, error } = await adminClient
      .from('location_submission_images')
      .select('id, submission_id, storage_bucket, storage_path, image_url')
      .eq('submission_id', input.submissionId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      throw new HttpError(
        500,
        'Could not load submission images.',
        error.message,
      )
    }

    const imageRows = (data ?? []) as SubmissionImageRow[]
    const images = await Promise.all(
      imageRows.map(async (imageRow): Promise<SubmissionImageReadUrl> => {
        const storageBucket = normalizeOptionalText(imageRow.storage_bucket)
        const storagePath = normalizeOptionalText(imageRow.storage_path)

        if (storageBucket && storagePath) {
          const { data: signedData, error: signedUrlError } = await adminClient.storage
            .from(storageBucket)
            .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

          if (signedUrlError) {
            throw new HttpError(
              500,
              'Could not generate a signed URL for a submission image.',
              { imageId: imageRow.id, message: signedUrlError.message },
            )
          }

          return {
            imageId: imageRow.id,
            url: signedData.signedUrl ?? null,
          }
        }

        return {
          imageId: imageRow.id,
          url: normalizeOptionalText(imageRow.image_url),
        }
      }),
    )

    return jsonResponse(
      {
        expiresInSeconds: SIGNED_URL_TTL_SECONDS,
        images,
      } satisfies SubmissionImageReadUrlsResponse,
      { status: 200 },
      origin,
    )
  } catch (error) {
    return errorResponse(error, origin)
  }
})
