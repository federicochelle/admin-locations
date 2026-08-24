import { assertAdmin } from '../_shared/auth.ts'
import { deleteCloudflareImage } from '../_shared/cloudflare.ts'
import { errorResponse, handleOptions, HttpError, jsonResponse } from '../_shared/http.ts'
import { assertProductionCompanyExists } from '../_shared/production-companies.ts'

type DeleteRequestBody = {
  productionCompanyId?: unknown
}

type ExistingProductionCompanyLogoRow = {
  id: string
  logo_public_id: string | null
}

type DeleteProductionCompanyLogoResponse = {
  success: true
}

function parseRequestBody(body: DeleteRequestBody) {
  const productionCompanyId =
    typeof body.productionCompanyId === 'string'
      ? body.productionCompanyId.trim()
      : ''

  if (!productionCompanyId) {
    throw new HttpError(400, 'productionCompanyId is required.')
  }

  return {
    productionCompanyId,
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
    const { userClient } = await assertAdmin(request)

    await assertProductionCompanyExists(userClient, input.productionCompanyId)

    const { data: companyRow, error: companyError } = await userClient
      .from('production_companies')
      .select('id, logo_public_id')
      .eq('id', input.productionCompanyId)
      .single()

    if (companyError || !companyRow) {
      throw new HttpError(
        500,
        'Could not load production company logo metadata.',
        companyError?.message ?? null,
      )
    }

    const typedCompanyRow = companyRow as ExistingProductionCompanyLogoRow

    if (typedCompanyRow.logo_public_id) {
      await deleteCloudflareImage(typedCompanyRow.logo_public_id)
    }

    const { error: updateError } = await userClient
      .from('production_companies')
      .update({
        logo_public_id: null,
        logo_url: null,
      })
      .eq('id', input.productionCompanyId)

    if (updateError) {
      throw new HttpError(
        500,
        'Could not clear production company logo metadata.',
        updateError.message,
      )
    }

    return jsonResponse(
      { success: true } satisfies DeleteProductionCompanyLogoResponse,
      { status: 200 },
      origin,
    )
  } catch (error) {
    return errorResponse(error, origin)
  }
})
