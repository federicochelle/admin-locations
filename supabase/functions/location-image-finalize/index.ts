import { assertAdmin } from '../_shared/auth.ts'
import {
  buildCloudflarePublicUrl,
  getCloudflareImageDetails,
  getCloudflareImageDimensions,
} from '../_shared/cloudflare.ts'
import { errorResponse, handleOptions, HttpError, jsonResponse } from '../_shared/http.ts'
import { assertLocationExists } from '../_shared/locations.ts'

type FinalizeRequestBody = {
  altText?: unknown
  caption?: unknown
  cloudflareImageId?: unknown
  isCover?: unknown
  locationId?: unknown
}

type CreatedLocationImageRow = {
  id: string
  location_id: string
  url: string
  storage_key: string
  alt_text: string | null
  caption: string | null
  sort_order: number
  is_cover: boolean
  width: number | null
  height: number | null
  created_at: string
  updated_at: string
}

type ExistingLocationImageRow = {
  sort_order: number | null
}

function toNullableText(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseRequestBody(body: FinalizeRequestBody) {
  const locationId =
    typeof body.locationId === 'string' ? body.locationId.trim() : ''
  const cloudflareImageId =
    typeof body.cloudflareImageId === 'string'
      ? body.cloudflareImageId.trim()
      : ''

  if (!locationId) {
    throw new HttpError(400, 'locationId is required.')
  }

  if (!cloudflareImageId) {
    throw new HttpError(400, 'cloudflareImageId is required.')
  }

  return {
    locationId,
    cloudflareImageId,
    altText: toNullableText(body.altText),
    caption: toNullableText(body.caption),
    isCover: body.isCover === true,
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

    await assertLocationExists(adminClient, input.locationId)

    const imageDetails = await getCloudflareImageDetails(input.cloudflareImageId)
    const { width, height } = getCloudflareImageDimensions(imageDetails)

    const { data: existingImages, error: existingImagesError } = await adminClient
      .from('location_images')
      .select('sort_order')
      .eq('location_id', input.locationId)
      .order('sort_order', { ascending: false })
      .limit(1)

    if (existingImagesError) {
      throw new HttpError(
        500,
        'Could not calculate next image sort order.',
        existingImagesError.message,
      )
    }

    const latestSortOrder =
      (existingImages as ExistingLocationImageRow[] | null)?.[0]?.sort_order ?? -1

    const nextSortOrder = latestSortOrder + 1
    const isFirstImage = latestSortOrder === -1
    const isCover = input.isCover === true ? true : isFirstImage

    if (input.isCover === true) {
      const { error: clearCoverError } = await adminClient
        .from('location_images')
        .update({ is_cover: false })
        .eq('location_id', input.locationId)

      if (clearCoverError) {
        throw new HttpError(
          500,
          'Could not update existing cover image.',
          clearCoverError.message,
        )
      }
    }

    const { data: createdRow, error: insertError } = await adminClient
      .from('location_images')
      .insert({
        alt_text: input.altText,
        caption: input.caption,
        height,
        is_cover: isCover,
        location_id: input.locationId,
        sort_order: nextSortOrder,
        storage_key: input.cloudflareImageId,
        url: buildCloudflarePublicUrl(input.cloudflareImageId),
        width,
      })
      .select(
        `
          id,
          location_id,
          url,
          storage_key,
          alt_text,
          caption,
          sort_order,
          is_cover,
          width,
          height,
          created_at,
          updated_at
        `,
      )
      .single()

    if (insertError || !createdRow) {
      throw new HttpError(
        500,
        'Could not store image metadata.',
        insertError?.message ?? null,
      )
    }

    return jsonResponse(createdRow as CreatedLocationImageRow, { status: 201 }, origin)
  } catch (error) {
    return errorResponse(error, origin)
  }
})
