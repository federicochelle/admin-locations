import { assertAdmin } from '../_shared/auth.ts'
import { buildCloudflarePublicUrl } from '../_shared/cloudflare.ts'
import { errorResponse, handleOptions, HttpError, jsonResponse } from '../_shared/http.ts'
import { assertLocationExists } from '../_shared/locations.ts'

type FinalizeRequestBody = {
  altText?: unknown
  caption?: unknown
  clientUploadId?: unknown
  cloudflareImageId?: unknown
  height?: unknown
  isCover?: unknown
  locationId?: unknown
  sortOrder?: unknown
  width?: unknown
}

type CreatedLocationImageRow = {
  id: string
  location_id: string
  client_upload_id: string | null
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

type SupabaseAdminClient = {
  from: (table: string) => any
}

const LOCATION_IMAGE_SELECT = `
  id,
  location_id,
  client_upload_id,
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
`

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function toNullableText(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseOptionalSortOrder(value: unknown) {
  if (typeof value !== 'number') {
    if (typeof value === 'undefined') {
      return null
    }

    throw new HttpError(400, 'sortOrder must be a number.')
  }

  if (!Number.isInteger(value)) {
    throw new HttpError(400, 'sortOrder must be an integer.')
  }

  if (value < 0) {
    throw new HttpError(400, 'sortOrder must be greater than or equal to 0.')
  }

  if (!Number.isSafeInteger(value)) {
    throw new HttpError(400, 'sortOrder must be a safe integer.')
  }

  return value
}

function parsePositiveDimension(value: unknown, fieldName: 'width' | 'height') {
  if (typeof value !== 'number') {
    throw new HttpError(400, `${fieldName} must be a number.`)
  }

  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new HttpError(400, `${fieldName} must be an integer.`)
  }

  if (value <= 0) {
    throw new HttpError(400, `${fieldName} must be greater than 0.`)
  }

  if (!Number.isSafeInteger(value)) {
    throw new HttpError(400, `${fieldName} must be a safe integer.`)
  }

  return value
}

function parseOptionalUuid(value: unknown, fieldName: string) {
  if (typeof value === 'undefined' || value === null) {
    return null
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, `${fieldName} must be a UUID.`)
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  if (!UUID_PATTERN.test(trimmed)) {
    throw new HttpError(400, `${fieldName} must be a UUID.`)
  }

  return trimmed
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  )
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
    clientUploadId: parseOptionalUuid(body.clientUploadId, 'clientUploadId'),
    cloudflareImageId,
    height: parsePositiveDimension(body.height, 'height'),
    altText: toNullableText(body.altText),
    caption: toNullableText(body.caption),
    isCover: body.isCover === true,
    sortOrder: parseOptionalSortOrder(body.sortOrder),
    width: parsePositiveDimension(body.width, 'width'),
  }
}

async function findExistingClientUpload(
  adminClient: SupabaseAdminClient,
  input: {
    clientUploadId: string | null
    locationId: string
  },
) {
  if (!input.clientUploadId) {
    return null
  }

  const { data, error } = await adminClient
    .from('location_images')
    .select(LOCATION_IMAGE_SELECT)
    .eq('location_id', input.locationId)
    .eq('client_upload_id', input.clientUploadId)
    .maybeSingle()

  if (error) {
    throw new HttpError(
      500,
      'Could not load existing image metadata.',
      error.message,
    )
  }

  return (data as CreatedLocationImageRow | null) ?? null
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

    const existingClientUpload = await findExistingClientUpload(adminClient, input)

    if (existingClientUpload) {
      return jsonResponse(existingClientUpload, { status: 200 }, origin)
    }

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

    const nextSortOrder = input.sortOrder ?? latestSortOrder + 1
    const isCover = input.isCover === true

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
        client_upload_id: input.clientUploadId,
        height: input.height,
        is_cover: isCover,
        location_id: input.locationId,
        sort_order: nextSortOrder,
        storage_key: input.cloudflareImageId,
        url: buildCloudflarePublicUrl(input.cloudflareImageId),
        width: input.width,
      })
      .select(
        `
          id,
          location_id,
          client_upload_id,
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
      if (input.clientUploadId && isUniqueViolation(insertError)) {
        const recoveredClientUpload = await findExistingClientUpload(adminClient, input)

        if (recoveredClientUpload) {
          return jsonResponse(recoveredClientUpload, { status: 200 }, origin)
        }
      }

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
