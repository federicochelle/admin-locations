import { assertAdmin } from '../_shared/auth.ts'
import {
  buildCloudflarePublicUrl,
  deleteCloudflareImage,
  getCloudflareImageDetails,
} from '../_shared/cloudflare.ts'
import { errorResponse, handleOptions, HttpError, jsonResponse } from '../_shared/http.ts'
import { assertProductionCompanyExists } from '../_shared/production-companies.ts'

type FinalizeRequestBody = {
  productionCompanyId?: unknown
  cloudflareImageId?: unknown
}

type ExistingProductionCompanyLogoRow = {
  id: string
  logo_url: string | null
  logo_public_id: string | null
}

type UpdatedProductionCompanyLogoResponse = {
  logoPublicId: string | null
  logoUrl: string | null
}

function parseRequestBody(body: FinalizeRequestBody) {
  const productionCompanyId =
    typeof body.productionCompanyId === 'string'
      ? body.productionCompanyId.trim()
      : ''
  const cloudflareImageId =
    typeof body.cloudflareImageId === 'string'
      ? body.cloudflareImageId.trim()
      : ''

  if (!productionCompanyId) {
    throw new HttpError(400, 'productionCompanyId is required.')
  }

  if (!cloudflareImageId) {
    throw new HttpError(400, 'cloudflareImageId is required.')
  }

  return {
    productionCompanyId,
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
    const { userClient } = await assertAdmin(request)

    await assertProductionCompanyExists(userClient, input.productionCompanyId)
    await getCloudflareImageDetails(input.cloudflareImageId)

    const { data: existingCompany, error: existingCompanyError } = await userClient
      .from('production_companies')
      .select('id, logo_url, logo_public_id')
      .eq('id', input.productionCompanyId)
      .single()

    if (existingCompanyError || !existingCompany) {
      throw new HttpError(
        500,
        'Could not load existing production company logo metadata.',
        existingCompanyError?.message ?? null,
      )
    }

    const previousLogoPublicId = (
      existingCompany as ExistingProductionCompanyLogoRow
    ).logo_public_id
    const nextLogoUrl = buildCloudflarePublicUrl(input.cloudflareImageId)

    const { data: updatedCompany, error: updateError } = await userClient
      .from('production_companies')
      .update({
        logo_public_id: input.cloudflareImageId,
        logo_url: nextLogoUrl,
      })
      .eq('id', input.productionCompanyId)
      .select('logo_url, logo_public_id')
      .single()

    if (updateError || !updatedCompany) {
      throw new HttpError(
        500,
        'Could not store production company logo metadata.',
        updateError?.message ?? null,
      )
    }

    if (
      previousLogoPublicId &&
      previousLogoPublicId !== input.cloudflareImageId
    ) {
      try {
        await deleteCloudflareImage(previousLogoPublicId)
      } catch (error) {
        console.warn('[production-company-logo-finalize] previous_logo_delete_failed', {
          cloudflareImageId: previousLogoPublicId,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          productionCompanyId: input.productionCompanyId,
        })
      }
    }

    const typedUpdatedCompany = updatedCompany as ExistingProductionCompanyLogoRow

    return jsonResponse(
      {
        logoPublicId: typedUpdatedCompany.logo_public_id,
        logoUrl: typedUpdatedCompany.logo_url,
      } satisfies UpdatedProductionCompanyLogoResponse,
      { status: 200 },
      origin,
    )
  } catch (error) {
    return errorResponse(error, origin)
  }
})
