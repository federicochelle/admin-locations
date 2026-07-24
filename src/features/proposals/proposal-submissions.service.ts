import { getSupabaseClient } from '../../lib/supabase'
import type {
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
  description: string | null
  message: string | null
  admin_notes: string | null
}

type LocationSubmissionImageRow = {
  id: string
  submission_id: string
  cloudflare_image_id: string | null
  image_url: string
  sort_order: number | null
  created_at: string
}

function normalizeRequiredText(value: string, fallback: string) {
  const normalizedValue = value.trim()
  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function normalizeOptionalText(value: string | null) {
  const normalizedValue = value?.trim()
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null
}

function mapProposalImage(row: LocationSubmissionImageRow): ProposalImage {
  return {
    id: row.id,
    submissionId: row.submission_id,
    cloudflareImageId: normalizeOptionalText(row.cloudflare_image_id),
    imageUrl: row.image_url,
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

  return {
    ...mapProposalListItem(row),
    updatedAt: row.updated_at,
    description: normalizeOptionalText(row.description),
    message: normalizeOptionalText(row.message),
    adminNotes: normalizeOptionalText(row.admin_notes),
    images: ((imagesData ?? []) as LocationSubmissionImageRow[]).map(mapProposalImage),
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
      admin_notes: normalizeOptionalText(input.adminNotes),
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
