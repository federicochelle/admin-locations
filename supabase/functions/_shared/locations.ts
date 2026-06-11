import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { HttpError } from './http.ts'

type LocationExistsRow = {
  id: string
}

export async function assertLocationExists(
  adminClient: SupabaseClient,
  locationId: string,
) {
  const { data, error } = await adminClient
    .from('locations')
    .select('id')
    .eq('id', locationId)
    .maybeSingle()

  if (error) {
    throw new HttpError(500, 'Could not validate location.', error.message)
  }

  if (!data) {
    throw new HttpError(404, 'Location not found.')
  }

  return data as LocationExistsRow
}
