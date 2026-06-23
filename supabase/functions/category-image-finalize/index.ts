import { assertAdmin } from '../_shared/auth.ts'
import { assertCategoryExists } from '../_shared/categories.ts'
import {
  buildCloudflarePublicUrl,
  deleteCloudflareImage,
  getCloudflareImageDetails,
} from '../_shared/cloudflare.ts'
import {
  errorResponse,
  handleOptions,
  HttpError,
  jsonResponse,
} from '../_shared/http.ts'

type FinalizeRequestBody = {
  categoryId?: unknown
  cloudflareImageId?: unknown
}

type ExistingCategoryImageRow = {
  id: string
  image_url: string | null
  image_cloudflare_id: string | null
}

type UpdatedCategoryImageResponse = {
  imageCloudflareId: string | null
  imageUrl: string | null
}

function parseRequestBody(body: FinalizeRequestBody) {
  const categoryId =
    typeof body.categoryId === 'string' ? body.categoryId.trim() : ''
  const cloudflareImageId =
    typeof body.cloudflareImageId === 'string'
      ? body.cloudflareImageId.trim()
      : ''

  if (!categoryId) {
    throw new HttpError(400, 'categoryId is required.')
  }

  if (!cloudflareImageId) {
    throw new HttpError(400, 'cloudflareImageId is required.')
  }

  return {
    categoryId,
    cloudflareImageId,
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
    const body = (await request.json()) as FinalizeRequestBody
    const input = parseRequestBody(body)
    const { adminClient } = await assertAdmin(request)

    await assertCategoryExists(adminClient, input.categoryId)
    await getCloudflareImageDetails(input.cloudflareImageId)

    const { data: existingCategory, error: existingCategoryError } = await adminClient
      .from('categories')
      .select('id, image_url, image_cloudflare_id')
      .eq('id', input.categoryId)
      .single()

    if (existingCategoryError || !existingCategory) {
      throw new HttpError(
        500,
        'Could not load existing category image metadata.',
        existingCategoryError?.message ?? null,
      )
    }

    const previousImageCloudflareId = (
      existingCategory as ExistingCategoryImageRow
    ).image_cloudflare_id
    const nextImageUrl = buildCloudflarePublicUrl(input.cloudflareImageId)

    const { data: updatedCategory, error: updateError } = await adminClient
      .from('categories')
      .update({
        image_url: nextImageUrl,
        image_cloudflare_id: input.cloudflareImageId,
      })
      .eq('id', input.categoryId)
      .select('image_url, image_cloudflare_id')
      .single()

    if (updateError || !updatedCategory) {
      throw new HttpError(
        500,
        'Could not store category image metadata.',
        updateError?.message ?? null,
      )
    }

    if (
      previousImageCloudflareId &&
      previousImageCloudflareId !== input.cloudflareImageId
    ) {
      try {
        await deleteCloudflareImage(previousImageCloudflareId)
      } catch (error) {
        console.warn('[category-image-finalize] previous_image_delete_failed', {
          categoryId: input.categoryId,
          cloudflareImageId: previousImageCloudflareId,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const typedUpdatedCategory = updatedCategory as ExistingCategoryImageRow

    return jsonResponse(
      {
        imageCloudflareId: typedUpdatedCategory.image_cloudflare_id,
        imageUrl: typedUpdatedCategory.image_url,
      } satisfies UpdatedCategoryImageResponse,
      { status: 200 },
      origin,
    )
  } catch (error) {
    return errorResponse(error, origin)
  }
})
