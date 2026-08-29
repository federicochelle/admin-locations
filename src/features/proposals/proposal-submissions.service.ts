import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  getSupabaseClient,
} from '../../lib/supabase'
import type {
  PaginatedProposalSubmissionsResult,
  ProposalDetails,
  ProposalImage,
  ProposalListItem,
  ProposalStatus,
  UpdateProposalSubmissionInput,
} from './proposal-submissions.types'

type LocationSubmissionRow = {
  id: string
  status: ProposalStatus
  created_at: string
  submitted_at: string
  updated_at: string | null
  owner_name: string
  owner_email: string
  owner_phone: string
  title: string
  department: string | null
  zone: string | null
  address: string | null
  location_type: string | null
  description: string | null
  message: string | null
  admin_notes: string | null
}

type LocationSubmissionImageRow = {
  id: string
  submission_id: string
  cloudflare_image_id: string | null
  image_url: string | null
  storage_bucket: string | null
  storage_path: string | null
  sort_order: number | null
  created_at: string
}

type LocationSubmissionImageReadUrl = {
  imageId: string
  url: string | null
}

type LocationSubmissionImageReadUrlsResult = {
  expiresInSeconds: number
  images: LocationSubmissionImageReadUrl[]
}

function normalizeRequiredText(value: string, fallback: string) {
  const normalizedValue = value.trim()
  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function normalizeOptionalText(value: string | null) {
  const normalizedValue = value?.trim()
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error.message
  }

  return fallbackMessage
}

async function getEdgeFunctionErrorMessage(
  error: unknown,
  fallbackMessage: string,
): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context

    try {
      const payload = await response.json()

      if (
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        typeof payload.error === 'string'
      ) {
        return payload.error
      }
    } catch {
      try {
        const text = await response.text()

        if (text.trim().length > 0) {
          return text
        }
      } catch {
        return fallbackMessage
      }
    }

    return fallbackMessage
  }

  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    return error.message
  }

  return getErrorMessage(error, fallbackMessage)
}

function mapProposalImage(
  row: LocationSubmissionImageRow,
  signedUrlByImageId: Map<string, string>,
): ProposalImage {
  const storageBucket = normalizeOptionalText(row.storage_bucket)
  const storagePath = normalizeOptionalText(row.storage_path)

  return {
    id: row.id,
    submissionId: row.submission_id,
    cloudflareImageId: normalizeOptionalText(row.cloudflare_image_id),
    imageUrl: normalizeOptionalText(row.image_url),
    storageBucket,
    storagePath,
    signedUrl: signedUrlByImageId.get(row.id) ?? null,
    isStorageImage: Boolean(storageBucket && storagePath),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

function mapProposalListItem(row: LocationSubmissionRow): ProposalListItem {
  return {
    id: row.id,
    status: row.status,
    submittedAt: row.submitted_at,
    ownerName: normalizeRequiredText(row.owner_name, 'Sin nombre'),
    ownerEmail: normalizeRequiredText(row.owner_email, 'Sin email'),
    ownerPhone: normalizeRequiredText(row.owner_phone, 'Sin teléfono'),
    address: normalizeOptionalText(row.address),
    department: normalizeOptionalText(row.department),
    zone: normalizeOptionalText(row.zone),
    internalTitle: normalizeRequiredText(row.title, 'Propuesta sin título'),
  }
}

export async function getProposalSubmissions(): Promise<ProposalListItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('location_submissions')
    .select(
      `
        id,
        status,
        submitted_at,
        owner_name,
        owner_email,
        owner_phone,
        address,
        department,
        zone,
        title
      `,
    )
    .order('submitted_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as LocationSubmissionRow[]).map(mapProposalListItem)
}

export async function getProposalSubmissionsPage(input: {
  page: number
  pageSize: number
  status: 'all' | ProposalStatus
}): Promise<PaginatedProposalSubmissionsResult> {
  const supabase = getSupabaseClient()
  const safePage = Math.max(1, input.page)
  const safePageSize = Math.max(1, input.pageSize)
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  let query = supabase
    .from('location_submissions')
    .select(
      `
        id,
        status,
        submitted_at,
        owner_name,
        owner_email,
        owner_phone,
        address,
        department,
        zone,
        title
      `,
      { count: 'exact' },
    )
    .order('submitted_at', { ascending: false })
    .range(from, to)

  if (input.status !== 'all') {
    query = query.eq('status', input.status)
  }

  const { data, count, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return {
    items: ((data ?? []) as LocationSubmissionRow[]).map(mapProposalListItem),
    totalCount: count ?? 0,
  }
}

export async function getPendingProposalSubmissionsCount(): Promise<number> {
  const supabase = getSupabaseClient()

  const { count, error } = await supabase
    .from('location_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

export async function getProposalSubmissionById(
  submissionId: string,
): Promise<ProposalDetails> {
  const supabase = getSupabaseClient()

  const { data: submissionData, error: submissionError } = await supabase
    .from('location_submissions')
    .select(
      `
        id,
        status,
        submitted_at,
        updated_at,
        owner_name,
        owner_email,
        owner_phone,
        title,
        department,
        zone,
        address,
        location_type,
        description,
        message,
        admin_notes
      `,
    )
    .eq('id', submissionId)
    .maybeSingle()

  if (submissionError) {
    throw new Error(submissionError.message)
  }

  if (!submissionData) {
    throw new Error('Proposal not found.')
  }

  const { data: imagesData, error: imagesError } = await supabase
    .from('location_submission_images')
    .select(
      `
        id,
        submission_id,
        cloudflare_image_id,
        image_url,
        storage_bucket,
        storage_path,
        sort_order,
        created_at
      `,
    )
    .eq('submission_id', submissionId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (imagesError) {
    throw new Error(imagesError.message)
  }

  const row = submissionData as LocationSubmissionRow
  const imageRows = (imagesData ?? []) as LocationSubmissionImageRow[]
  const storageBackedImages = imageRows.filter(
    (imageRow) =>
      normalizeOptionalText(imageRow.storage_bucket) &&
      normalizeOptionalText(imageRow.storage_path),
  )
  const signedUrlByImageId = new Map<string, string>()
  let imageReadUrlsError: string | null = null

  if (storageBackedImages.length > 0) {
    const { data, error } =
      await supabase.functions.invoke<LocationSubmissionImageReadUrlsResult>(
        'location-submission-image-read-urls',
        {
          body: { submissionId },
        },
      )

    if (error) {
      imageReadUrlsError = await getEdgeFunctionErrorMessage(
        error,
        'No pudimos resolver temporalmente las imágenes privadas de esta propuesta.',
      )
    } else if (data) {
      for (const image of data.images) {
        if (typeof image.imageId !== 'string') {
          continue
        }

        const url = normalizeOptionalText(image.url)

        if (url) {
          signedUrlByImageId.set(image.imageId, url)
        }
      }
    }
  }

  return {
    ...mapProposalListItem(row),
    updatedAt: row.updated_at,
    locationType: normalizeOptionalText(row.location_type),
    description: normalizeOptionalText(row.description),
    message: normalizeOptionalText(row.message),
    adminNotes: normalizeOptionalText(row.admin_notes),
    imageReadUrlsError,
    images: imageRows.map((imageRow) =>
      mapProposalImage(imageRow, signedUrlByImageId),
    ),
  }
}

export async function updateProposalSubmission(
  input: UpdateProposalSubmissionInput,
): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('location_submissions')
    .update({
      status: input.status,
    })
    .eq('id', input.id)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (!data?.id) {
    throw new Error('No recibimos confirmación al actualizar la propuesta.')
  }

  return data.id
}
