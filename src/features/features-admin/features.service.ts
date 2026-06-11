import { getSupabaseClient } from '../../lib/supabase'
import type {
  FeatureCreatePayload,
  FeatureEditableRecord,
  FeatureListItem,
  FeatureUpdatePayload,
} from './features.types'

type FeatureRow = {
  id: string
  name: string
  slug: string
  group: string | null
  type: string | null
  active: boolean | null
}

type FeatureIdRow = {
  id: string
}

function mapFeature(row: FeatureRow): FeatureListItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    group: row.group,
    type: row.type,
    active: row.active,
  }
}

export async function getFeatures(): Promise<FeatureListItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('features')
    .select(
      `
        id,
        name,
        slug,
        group,
        type,
        active
      `,
    )
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as FeatureRow[]

  return rows.map(mapFeature)
}

export async function getFeatureById(id: string): Promise<FeatureEditableRecord> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('features')
    .select(
      `
        id,
        name,
        slug,
        group,
        type,
        active
      `,
    )
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as FeatureEditableRecord
}

export async function createFeature(
  payload: FeatureCreatePayload,
): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('features')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as FeatureIdRow).id
}

export async function updateFeature(
  id: string,
  payload: FeatureUpdatePayload,
): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('features')
    .update(payload)
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as FeatureIdRow).id
}

export async function archiveFeature(id: string): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('features')
    .update({ active: false })
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as FeatureIdRow).id
}

export async function deleteFeature(id: string): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('features')
    .delete()
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as FeatureIdRow).id
}
