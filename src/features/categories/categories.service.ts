import { getSupabaseClient } from '../../lib/supabase'
import type {
  CategoryCreatePayload,
  CategoryEditableRecord,
  CategoryFormOptions,
  CategoryLocationListItem,
  CategoryListItem,
  CategoryParentOption,
  CategoryUpdatePayload,
} from './categories.types'

type CategoryRow = {
  id: string
  name: string
  slug: string
  parent_id: string | null
  sort_order: number | null
  active: boolean | null
  locations:
    | {
        count: number | null
      }
    | {
        count: number | null
      }[]
    | null
}

type CategoryIdRow = {
  id: string
}

type CategoryLocationRow = {
  id: string
  title: string
  departments:
    | {
        name: string | null
      }
    | {
        name: string | null
      }[]
    | null
  zones:
    | {
        name: string | null
      }
    | {
        name: string | null
      }[]
    | null
}

function getRelationName(
  relation: CategoryLocationRow['departments'] | CategoryLocationRow['zones'],
) {
  if (!relation) {
    return null
  }

  if (Array.isArray(relation)) {
    return relation[0]?.name ?? null
  }

  return relation.name
}

function mapCategory(row: CategoryRow): CategoryListItem {
  const locationsRelation = row.locations
  const locationsCount = Array.isArray(locationsRelation)
    ? (locationsRelation[0]?.count ?? 0)
    : (locationsRelation?.count ?? 0)

  return {
    id: row.id,
    name: row.name,
    locationsCount,
  }
}

function mapParentOption(row: Pick<CategoryRow, 'id' | 'name'>): CategoryParentOption {
  return {
    id: row.id,
    name: row.name,
  }
}

export async function getCategories(): Promise<CategoryListItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('categories')
    .select(
      `
        id,
        name,
        locations(count)
      `,
    )
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as CategoryRow[]

  return rows.map(mapCategory)
}

export async function getCategoryLocations(
  categoryId: string,
): Promise<CategoryLocationListItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('locations')
    .select(
      `
        id,
        title,
        departments(name),
        zones(name)
      `,
    )
    .eq('category_id', categoryId)
    .order('title', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as CategoryLocationRow[]

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    departmentName: getRelationName(row.departments),
    zoneName: getRelationName(row.zones),
  }))
}

export async function getCategoryById(id: string): Promise<CategoryEditableRecord> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('categories')
    .select(
      `
        id,
        name,
        slug,
        parent_id,
        sort_order,
        active
      `,
    )
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as CategoryEditableRecord
}

export async function getCategoryFormOptions(): Promise<CategoryFormOptions> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('categories')
    .select(
      `
        id,
        name
      `,
    )
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Array<Pick<CategoryRow, 'id' | 'name'>>

  return {
    parentCategories: rows.map(mapParentOption),
  }
}

export async function createCategory(
  payload: CategoryCreatePayload,
): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('categories')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as CategoryIdRow).id
}

export async function updateCategory(
  id: string,
  payload: CategoryUpdatePayload,
): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as CategoryIdRow).id
}

export async function archiveCategory(id: string): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('categories')
    .update({ active: false })
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as CategoryIdRow).id
}

export async function deleteCategory(id: string): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as CategoryIdRow).id
}
