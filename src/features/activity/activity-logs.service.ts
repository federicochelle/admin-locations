import { getSupabaseClient } from '../../lib/supabase'

export type ActivityLogAction = 'created' | 'updated' | 'deleted'

export type ActivityLogEntityType = 'location' | 'owner' | 'category' | 'zone'

type ActivityLogRow = {
  id: string
  action: ActivityLogAction | null
  entity_type: ActivityLogEntityType | null
  entity_id: string | null
  entity_name: string | null
  created_at: string | null
  profiles:
    | {
        full_name: string | null
      }
    | {
        full_name: string | null
      }[]
    | null
}

export type ActivityLogListItem = {
  id: string
  action: ActivityLogAction
  entity_type: ActivityLogEntityType
  entity_id: string | null
  entity_name: string
  created_at: string
  actor_name: string
}

type CreateActivityLogInput = {
  actorProfileId: string
  action: ActivityLogAction
  entityType: ActivityLogEntityType
  entityId: string
  entityName: string
}

export async function createActivityLog({
  actorProfileId,
  action,
  entityType,
  entityId,
  entityName,
}: CreateActivityLogInput): Promise<void> {
  const supabase = getSupabaseClient()

  const { error } = await supabase.from('activity_logs').insert({
    actor_profile_id: actorProfileId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function getActivityLogs({
  limit = 50,
}: {
  limit?: number
} = {}): Promise<ActivityLogListItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('activity_logs')
    .select(
      `
        id,
        action,
        entity_type,
        entity_id,
        entity_name,
        created_at,
        profiles(full_name)
      `,
    )
    .not('created_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as ActivityLogRow[]

  return rows
    .filter(
      (row): row is ActivityLogRow & {
        action: ActivityLogAction
        entity_type: ActivityLogEntityType
        entity_name: string
        created_at: string
      } =>
        Boolean(row.action) &&
        Boolean(row.entity_type) &&
        Boolean(row.entity_name) &&
        Boolean(row.created_at),
    )
    .map((row) => {
      const profileRelation = Array.isArray(row.profiles)
        ? row.profiles[0]
        : row.profiles

      return {
        id: row.id,
        action: row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        entity_name: row.entity_name.trim(),
        created_at: row.created_at,
        actor_name: profileRelation?.full_name?.trim() || 'Alguien',
      }
    })
}
