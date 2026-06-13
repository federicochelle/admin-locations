import { getSupabaseClient } from '../../lib/supabase'
import { createActivityLog } from '../activity/activity-logs.service'
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

type SupabaseErrorLike = {
  code?: string
  message?: string
}

type CategoryLocationRow = {
  id: string
  location_code: string | null
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

function getCategoryFriendlyErrorMessage(error: SupabaseErrorLike | null) {
  if (!error) {
    return 'No pudimos guardar la categoría.'
  }

  const normalizedMessage = error.message?.toLocaleLowerCase() ?? ''
  const isUniqueViolation =
    error.code === '23505' ||
    normalizedMessage.includes('duplicate key') ||
    normalizedMessage.includes('unique constraint') ||
    normalizedMessage.includes('categories_')

  if (!isUniqueViolation) {
    return error.message ?? 'No pudimos guardar la categoría.'
  }

  if (
    normalizedMessage.includes('name') ||
    normalizedMessage.includes('categories_name_key')
  ) {
    return 'Ya existe una categoría con ese nombre.'
  }

  if (
    normalizedMessage.includes('slug') ||
    normalizedMessage.includes('categories_slug_key')
  ) {
    return 'Ya existe una categoría con un nombre similar.'
  }

  return 'Ya existe una categoría con ese nombre o uno similar.'
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
        location_code,
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
    locationCode: row.location_code,
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
  options?: { actorProfileId?: string | null },
): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('categories')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    throw new Error(getCategoryFriendlyErrorMessage(error))
  }

  const categoryId = (data as CategoryIdRow).id

  if (options?.actorProfileId) {
    try {
      await createActivityLog({
        actorProfileId: options.actorProfileId,
        action: 'created',
        entityType: 'category',
        entityId: categoryId,
        entityName: payload.name.trim(),
      })
    } catch (error) {
      console.warn('No pudimos registrar activity_log para category.', error)
    }
  } else {
    console.warn('No se registró activity_log para category porque falta actorProfileId.')
  }

  return categoryId
}

export async function updateCategory(
  id: string,
  payload: CategoryUpdatePayload,
  options?: { actorProfileId?: string | null },
): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    throw new Error(getCategoryFriendlyErrorMessage(error))
  }

  const categoryId = (data as CategoryIdRow).id

  if (options?.actorProfileId) {
    try {
      await createActivityLog({
        actorProfileId: options.actorProfileId,
        action: 'updated',
        entityType: 'category',
        entityId: categoryId,
        entityName: payload.name.trim(),
      })
    } catch (error) {
      console.warn('No pudimos registrar activity_log de edición para category.', error)
    }
  } else {
    console.warn('No se registró activity_log de edición para category porque falta actorProfileId.')
  }

  return categoryId
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
