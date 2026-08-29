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

export type PaginatedActivityLogsResult = {
  items: ActivityLogListItem[]
  totalCount: number
}

type CreateActivityLogInput = {
  actorProfileId: string
  action: ActivityLogAction
  entityType: ActivityLogEntityType
  entityId: string
  entityName: string
}

function escapeLikePattern(value: string) {
  return value.replace(/[%,()]/g, '')
}

function normalizeSearchTerm(value: string) {
  return value.trim().toLocaleLowerCase()
}

function getMatchingActionValues(searchTerm: string) {
  const normalizedSearch = normalizeSearchTerm(searchTerm)

  if (normalizedSearch.length === 0) {
    return [] as ActivityLogAction[]
  }

  const labels: Array<{ label: string; value: ActivityLogAction }> = [
    { label: 'creó', value: 'created' },
    { label: 'editó', value: 'updated' },
    { label: 'eliminó', value: 'deleted' },
  ]

  return labels
    .filter((entry) => entry.label.toLocaleLowerCase().includes(normalizedSearch))
    .map((entry) => entry.value)
}

function getMatchingEntityTypeValues(searchTerm: string) {
  const normalizedSearch = normalizeSearchTerm(searchTerm)

  if (normalizedSearch.length === 0) {
    return [] as ActivityLogEntityType[]
  }

  const labels: Array<{ label: string; value: ActivityLogEntityType }> = [
    { label: 'locación', value: 'location' },
    { label: 'dueño', value: 'owner' },
    { label: 'categoría', value: 'category' },
    { label: 'zona', value: 'zone' },
  ]

  return labels
    .filter((entry) => entry.label.toLocaleLowerCase().includes(normalizedSearch))
    .map((entry) => entry.value)
}

async function getMatchingActorProfileIds(searchTerm: string) {
  const normalizedSearch = searchTerm.trim()

  if (normalizedSearch.length === 0) {
    return [] as string[]
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('full_name', `%${escapeLikePattern(normalizedSearch)}%`)

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as Array<{ id: string | null }>)
    .map((row) => row.id)
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
}

function mapActivityLog(row: ActivityLogRow): ActivityLogListItem {
  const profileRelation = Array.isArray(row.profiles)
    ? row.profiles[0]
    : row.profiles

  return {
    id: row.id,
    action: row.action as ActivityLogAction,
    entity_type: row.entity_type as ActivityLogEntityType,
    entity_id: row.entity_id,
    entity_name: row.entity_name?.trim() ?? '',
    created_at: row.created_at ?? '',
    actor_name: profileRelation?.full_name?.trim() || 'Alguien',
  }
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

  return ((data ?? []) as ActivityLogRow[])
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
    .map(mapActivityLog)
}

export async function getActivityLogsPage(input: {
  page: number
  pageSize: number
  searchTerm: string
}): Promise<PaginatedActivityLogsResult> {
  const supabase = getSupabaseClient()
  const page = Math.max(1, input.page)
  const pageSize = Math.max(1, input.pageSize)
  const searchTerm = input.searchTerm.trim()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const searchPattern = `%${escapeLikePattern(searchTerm)}%`

  let actorProfileIds: string[] = []

  if (searchTerm.length > 0) {
    actorProfileIds = await getMatchingActorProfileIds(searchTerm)
  }

  let query = supabase
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
      { count: 'exact' },
    )
    .not('action', 'is', null)
    .not('entity_type', 'is', null)
    .not('entity_name', 'is', null)
    .not('created_at', 'is', null)

  if (searchTerm.length > 0) {
    const filters = [
      `entity_name.ilike.${searchPattern}`,
      `entity_name.ilike.%${escapeLikePattern(searchTerm.replace(/\s+/g, '-'))}%`,
    ]
    const matchingActions = getMatchingActionValues(searchTerm)
    const matchingEntityTypes = getMatchingEntityTypeValues(searchTerm)

    if (matchingActions.length > 0) {
      filters.push(`action.in.(${matchingActions.join(',')})`)
    }

    if (matchingEntityTypes.length > 0) {
      filters.push(`entity_type.in.(${matchingEntityTypes.join(',')})`)
    }

    if (actorProfileIds.length > 0) {
      filters.push(`actor_profile_id.in.(${actorProfileIds.join(',')})`)
    }

    query = query.or(filters.join(','))
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    throw new Error(error.message)
  }

  return {
    items: ((data ?? []) as ActivityLogRow[]).map(mapActivityLog),
    totalCount: typeof count === 'number' ? count : 0,
  }
}
