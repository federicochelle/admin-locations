import { getSupabaseClient } from '../../lib/supabase'
import { createActivityLog } from '../activity/activity-logs.service'
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

export async function createZone(
  payload: ZoneCreatePayload,
  options?: { actorProfileId?: string | null },
): Promise<string> {
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
      const zoneId = (data as ZoneIdRow).id

      if (options?.actorProfileId) {
        try {
          await createActivityLog({
            actorProfileId: options.actorProfileId,
            action: 'created',
            entityType: 'zone',
            entityId: zoneId,
            entityName: payload.name.trim(),
          })
        } catch (error) {
          console.warn('No pudimos registrar activity_log para zone.', error)
        }
      } else {
        console.warn('No se registró activity_log para zone porque falta actorProfileId.')
      }

      return zoneId
    }

    if (error) {
      lastErrorMessage = error.message
    }
  }

  throw new Error(lastErrorMessage)
}
