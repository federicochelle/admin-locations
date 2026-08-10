import { getSupabaseClient } from '../../lib/supabase'
import type {
  SubscriptionListItem,
  SubscriptionPlanOption,
} from './subscriptions.types'

type SubscriptionRow = {
  id: string
  user_id: string
  plan_id: string | null
  status: string | null
  starts_at: string | null
  expires_at: string | null
  cancel_at_period_end: boolean | null
  plans:
    | {
        id: string
        name: string | null
      }
    | {
        id: string
        name: string | null
      }[]
    | null
}

type ProfileRow = {
  id: string
  user_id: string
  full_name: string | null
  email: string | null
}

type PlanOptionRow = {
  id: string
  name: string | null
}

function getSingleRelation<T>(value: T | T[] | null | undefined) {
  if (!value) {
    return null
  }

  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapSubscriptionRow(
  row: SubscriptionRow,
  profile: ProfileRow | null,
): SubscriptionListItem {
  const plan = getSingleRelation(row.plans)

  return {
    id: row.id,
    userId: row.user_id,
    profileId: profile?.id ?? null,
    customerName: profile?.full_name?.trim() || null,
    customerEmail: profile?.email?.trim() || null,
    planId: row.plan_id,
    planName: plan?.name?.trim() || null,
    status: row.status?.trim() || null,
    startsAt: row.starts_at?.trim() || null,
    expiresAt: row.expires_at?.trim() || null,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
  }
}

export async function getSubscriptions(): Promise<SubscriptionListItem[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      id,
      user_id,
      plan_id,
      status,
      starts_at,
      expires_at,
      cancel_at_period_end,
      plans:plan_id (
        id,
        name
      )
    `)
    .order('starts_at', { ascending: false, nullsFirst: false })

  if (error) {
    throw new Error(error.message)
  }

  const subscriptionRows = (data ?? []) as SubscriptionRow[]
  const uniqueUserIds = Array.from(new Set(subscriptionRows.map((row) => row.user_id)))

  let profilesByUserId = new Map<string, ProfileRow>()

  if (uniqueUserIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, email')
      .in('user_id', uniqueUserIds)

    if (profilesError) {
      throw new Error(profilesError.message)
    }

    profilesByUserId = new Map(
      ((profilesData ?? []) as ProfileRow[]).map((profile) => [profile.user_id, profile]),
    )
  }

  return subscriptionRows.map((row) =>
    mapSubscriptionRow(row, profilesByUserId.get(row.user_id) ?? null),
  )
}

export async function getActiveSubscriptionPlans(): Promise<SubscriptionPlanOption[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('plans')
    .select('id, name')
    .eq('active', true)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as PlanOptionRow[])
    .map((row) => ({
      id: row.id,
      name: row.name?.trim() || 'Plan sin nombre',
    }))
}

export async function updateSubscriptionPlan(input: {
  subscriptionId: string
  planId: string
}): Promise<string> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ plan_id: input.planId })
    .eq('id', input.subscriptionId)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (!data?.id) {
    throw new Error('No recibimos confirmación al actualizar la suscripción.')
  }

  return data.id
}
