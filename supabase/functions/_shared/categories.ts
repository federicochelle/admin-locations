import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { HttpError } from './http.ts'

type CategoryExistsRow = {
  id: string
}

export async function assertCategoryExists(
  adminClient: SupabaseClient,
  categoryId: string,
) {
  const { data, error } = await adminClient
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .maybeSingle()

  if (error) {
    throw new HttpError(500, 'Could not validate category.', error.message)
  }

  if (!data) {
    throw new HttpError(404, 'Category not found.')
  }

  return data as CategoryExistsRow
}
