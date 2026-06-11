import { getSupabaseClient } from '../../lib/supabase'
import type { ZoneCreatePayload } from './zones.types'

type ZoneIdRow = {
  id: string
}

type ZoneInsertCandidate = Record<string, boolean | number | string | null>

function buildInsertCandidates(payload: ZoneCreatePayload): ZoneInsertCandidate[] {
  return [
    {
      name: payload.name,
      slug: payload.slug,
      department_id: payload.department_id,
      active: payload.active,
      department: payload.department ?? null,
      lat: payload.lat ?? null,
      lng: payload.lng ?? null,
    },
    {
      name: payload.name,
      slug: payload.slug,
      department_id: payload.department_id,
      active: payload.active,
    },
    {
      name: payload.name,
      department_id: payload.department_id,
      active: payload.active,
    },
    {
      name: payload.name,
      department_id: payload.department_id,
    },
  ]
}

export async function createZone(payload: ZoneCreatePayload): Promise<string> {
  const supabase = getSupabaseClient()
  const candidates = buildInsertCandidates(payload)
  let lastErrorMessage = 'No pudimos crear la zona.'

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from('zones')
      .insert(candidate)
      .select('id')
      .single()

    if (!error && data) {
      return (data as ZoneIdRow).id
    }

    if (error) {
      lastErrorMessage = error.message
    }
  }

  throw new Error(lastErrorMessage)
}
