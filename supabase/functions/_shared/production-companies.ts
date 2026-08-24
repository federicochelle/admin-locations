import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { HttpError } from './http.ts'

type ProductionCompanyExistsRow = {
  id: string
}

export async function assertProductionCompanyExists(
  adminClient: SupabaseClient,
  productionCompanyId: string,
) {
  const { data, error } = await adminClient
    .from('production_companies')
    .select('id')
    .eq('id', productionCompanyId)
    .maybeSingle()

  if (error) {
    throw new HttpError(500, 'Could not validate production company.', error.message)
  }

  if (!data) {
    throw new HttpError(404, 'Production company not found.')
  }

  return data as ProductionCompanyExistsRow
}
