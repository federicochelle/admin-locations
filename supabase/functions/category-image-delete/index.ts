import { assertAdmin } from '../_shared/auth.ts'
import { assertCategoryExists } from '../_shared/categories.ts'
import { deleteCloudflareImage } from '../_shared/cloudflare.ts'
import {
  errorResponse,
  handleOptions,
  HttpError,
  jsonResponse,
} from '../_shared/http.ts'

type DeleteRequestBody = {
  categoryId?: unknown
}

type ExistingCategoryImageRow = {
  id: string
  image_cloudflare_id: string | null
}

type DeleteCategoryImageResponse = {
  success: true
}

function parseRequestBody(body: DeleteRequestBody) {
  const categoryId =
    typeof body.categoryId === 'string' ? body.categoryId.trim() : ''

  if (!categoryId) {
    throw new HttpError(400, 'categoryId is required.')
  }

  return {
    categoryId,
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
    const body = (await request.json()) as DeleteRequestBody
    const input = parseRequestBody(body)
    const { adminClient } = await assertAdmin(request)

    await assertCategoryExists(adminClient, input.categoryId)

    const { data: categoryRow, error: categoryError } = await adminClient
      .from('categories')
      .select('id, image_cloudflare_id')
      .eq('id', input.categoryId)
      .single()

    if (categoryError || !categoryRow) {
      throw new HttpError(
        500,
        'Could not load category image metadata.',
        categoryError?.message ?? null,
      )
    }

    const typedCategoryRow = categoryRow as ExistingCategoryImageRow

    if (typedCategoryRow.image_cloudflare_id) {
      await deleteCloudflareImage(typedCategoryRow.image_cloudflare_id)
    }

    const { error: updateError } = await adminClient
      .from('categories')
      .update({
        image_url: null,
        image_cloudflare_id: null,
      })
      .eq('id', input.categoryId)

    if (updateError) {
      throw new HttpError(
        500,
        'Could not clear category image metadata.',
        updateError.message,
      )
    }

    return jsonResponse(
      { success: true } satisfies DeleteCategoryImageResponse,
      { status: 200 },
      origin,
    )
  } catch (error) {
    return errorResponse(error, origin)
  }
})
