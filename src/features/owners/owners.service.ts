import { getSupabaseClient } from '../../lib/supabase'
import type {
  OwnerCreatePayload,
  OwnerEditableDetails,
  OwnerEditableRecord,
  OwnerLocationListItem,
  OwnerListItem,
  OwnerUpdatePayload,
} from './owners.types'

type OwnerRow = {
  id: string
  full_name: string
  company_name: string | null
  email: string | null
  phone: string | null
  locations?: Array<{ count: number | null }> | { count: number | null } | null
  whatsapp: string | null
  document_or_rut: string | null
  notes: string | null
  status: string | null
}

type OwnerIdRow = {
  id: string
}

type NameRelation =
  | {
      name: string | null
    }
  | {
      name: string | null
    }[]
  | null

type OwnerLocationRow = {
  id: string
  title: string
  location_images:
    | {
        url: string | null
        is_cover: boolean | null
      }[]
    | null
  published: boolean | null
  status: string | null
  departments: NameRelation
  zones: NameRelation
}

type OwnerDetailRow = OwnerEditableRecord & {
  locations:
    | OwnerLocationRow
    | OwnerLocationRow[]
    | null
}

function getRelationName(relation: NameRelation) {
  if (!relation) {
    return null
  }

  if (Array.isArray(relation)) {
    return relation[0]?.name ?? null
  }

  return relation.name
}

function mapOwner(row: OwnerRow): OwnerListItem {
  const locationsCount = Array.isArray(row.locations)
    ? (row.locations[0]?.count ?? 0)
    : (row.locations?.count ?? 0)

  return {
    id: row.id,
    full_name: row.full_name,
    company_name: row.company_name,
    email: row.email,
    phone: row.phone,
    locations_count: locationsCount,
    whatsapp: row.whatsapp,
    status: row.status,
  }
}

function mapOwnerLocation(row: OwnerLocationRow): OwnerLocationListItem {
  const coverImage = (row.location_images ?? []).find(
    (image) => image.is_cover === true,
  )

  return {
    id: row.id,
    title: row.title,
    coverImageUrl: coverImage?.url ?? null,
    departmentName: getRelationName(row.departments),
    zoneName: getRelationName(row.zones),
    published: row.published ?? false,
    status: row.status,
  }
}

export async function getOwners(): Promise<OwnerListItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('owners')
    .select(
      `
        id,
        full_name,
        company_name,
        email,
        phone,
        locations(count),
        whatsapp,
        document_or_rut,
        notes,
        status
      `,
    )
    .order('full_name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as OwnerRow[]

  return rows.map(mapOwner)
}

export async function getOwnerById(id: string): Promise<OwnerEditableDetails> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('owners')
    .select(
      `
        id,
        full_name,
        company_name,
        email,
        phone,
        whatsapp,
        document_or_rut,
        notes,
        status,
        locations(
          id,
          title,
          location_images(url, is_cover),
          published,
          status,
          departments(name),
          zones(name)
        )
      `,
    )
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const row = data as OwnerDetailRow
  const locationRows = Array.isArray(row.locations)
    ? row.locations
    : row.locations
      ? [row.locations]
      : []

  return {
    owner: {
      id: row.id,
      full_name: row.full_name,
      company_name: row.company_name,
      email: row.email,
      phone: row.phone,
      whatsapp: row.whatsapp,
      document_or_rut: row.document_or_rut,
      notes: row.notes,
      status: row.status,
    },
    locations: locationRows.map(mapOwnerLocation),
  }
}

export async function createOwner(payload: OwnerCreatePayload): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('owners')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as OwnerIdRow).id
}

export async function updateOwner(
  id: string,
  payload: OwnerUpdatePayload,
): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('owners')
    .update(payload)
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as OwnerIdRow).id
}

export async function archiveOwner(id: string): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('owners')
    .update({ status: 'inactive' })
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as OwnerIdRow).id
}

export async function deleteOwner(id: string): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('owners')
    .delete()
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as OwnerIdRow).id
}
