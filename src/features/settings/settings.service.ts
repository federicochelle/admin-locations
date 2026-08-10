import { getSupabaseClient } from '../../lib/supabase'
import { getGoogleCalendarConnectionStatus } from './google-calendar.service'
import type {
  IntegrationBillingCycle,
  IntegrationStatus,
  SettingsConnectionDetail,
  SettingsConnectionItem,
  SettingsConnectionUpdateInput,
} from './settings.types'

type IntegrationRow = {
  billing_amount: number | string | null
  billing_cycle: string | null
  billing_cycle_end: string | null
  billing_cycle_start: string | null
  id: string
  name: string | null
  status: string | null
  created_at: string
  sort_order: number | null
  updated_at: string
}

const INTEGRATION_ORDER = [
  'Google Calendar',
  'Google Maps',
  'Cloudflare Images',
  'Algolia',
  'OpenAI',
  'Supabase',
  'Resend',
  'Mercado Pago',
] as const

const INTEGRATION_KEY_BY_NAME: Record<string, string> = {
  'Google Calendar': 'google-calendar',
  'Google Maps': 'google-maps',
  'Cloudflare Images': 'cloudflare-images',
  Algolia: 'algolia',
  OpenAI: 'openai',
  Supabase: 'supabase',
  Resend: 'resend',
  'Mercado Pago': 'mercado-pago',
}

const GOOGLE_CALENDAR_INTEGRATION_NAME = 'Google Calendar'

function getIntegrationKey(name: string, fallbackId: string) {
  return INTEGRATION_KEY_BY_NAME[name] ?? fallbackId
}

function isGoogleCalendarIntegration(name: string) {
  return name === GOOGLE_CALENDAR_INTEGRATION_NAME
}

function normalizeIntegrationStatus(status: string | null | undefined): IntegrationStatus {
  if (status === 'connected') {
    return 'connected'
  }

  if (status === 'configured' || status === 'active') {
    return 'configured'
  }

  if (status === 'error') {
    return 'error'
  }

  return 'pending'
}

function normalizeIntegrationBillingCycle(
  billingCycle: string | null | undefined,
): IntegrationBillingCycle | null {
  if (billingCycle === 'monthly' || billingCycle === 'usage' || billingCycle === 'free') {
    return billingCycle
  }

  return null
}

function buildConnection(input: {
  billingAmount: string
  billingCycle: IntegrationBillingCycle | null
  id: string
  key: string
  name: string
  status: IntegrationStatus
}): SettingsConnectionItem {
  return {
    billingAmount: input.billingAmount,
    billingCycle: input.billingCycle,
    id: input.id,
    key: input.key,
    name: input.name,
    status: input.status,
  }
}

function mapIntegrationRowToDetail(row: IntegrationRow): SettingsConnectionDetail {
  const name = row.name?.trim() || 'Integración'

  return {
    id: row.id,
    key: getIntegrationKey(name, row.id),
    name,
    status: normalizeIntegrationStatus(row.status),
    billingAmount: row.billing_amount == null ? '' : String(row.billing_amount),
    billingCycle: normalizeIntegrationBillingCycle(row.billing_cycle),
    billingCycleStart: row.billing_cycle_start ?? '',
    billingCycleEnd: row.billing_cycle_end ?? '',
    sortOrder: row.sort_order ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isGoogleCalendar: isGoogleCalendarIntegration(name),
  }
}

async function getGoogleCalendarDisplayStatus(): Promise<IntegrationStatus> {
  const googleCalendarConnection = await getGoogleCalendarConnectionStatus()

  return googleCalendarConnection?.connected === true ? 'connected' : 'pending'
}

async function fetchIntegrationRow(
  input:
    | {
        id: string
        name?: never
      }
    | {
        id?: never
        name: string
      },
) {
  const supabase = getSupabaseClient()
  let query = supabase
    .from('integrations')
    .select(
      'id, name, status, billing_cycle, billing_amount, created_at, updated_at, sort_order, billing_cycle_start, billing_cycle_end',
    )

  if ('id' in input) {
    query = query.eq('id', input.id)
  } else {
    query = query.eq('name', input.name)
  }

  const { data, error } = await query.single<IntegrationRow>()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getSettingsConnections(): Promise<SettingsConnectionItem[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('integrations')
    .select('id, name, status, billing_cycle, billing_amount')

  if (error) {
    throw new Error(error.message)
  }

  const googleCalendarConnection = await getGoogleCalendarConnectionStatus()
  const rows = (data ?? []) as IntegrationRow[]
  const orderByName = new Map<string, number>(
    INTEGRATION_ORDER.map((name, index) => [name, index]),
  )

  return rows
    .filter((row) => {
      const normalizedName = row.name?.trim() || ''
      return normalizedName.length > 0 && normalizedName in INTEGRATION_KEY_BY_NAME
    })
    .sort((left, right) => {
      const leftOrder = orderByName.get(left.name?.trim() || '') ?? Number.MAX_SAFE_INTEGER
      const rightOrder = orderByName.get(right.name?.trim() || '') ?? Number.MAX_SAFE_INTEGER

      return leftOrder - rightOrder
    })
    .map((row) => {
      const name = row.name?.trim() || 'Integración'
      const isGoogleCalendar = name === 'Google Calendar'

      return buildConnection({
        id: row.id,
        billingAmount: row.billing_amount == null ? '' : String(row.billing_amount),
        billingCycle: normalizeIntegrationBillingCycle(row.billing_cycle),
        key: getIntegrationKey(name, row.id),
        name,
        status: isGoogleCalendar
          ? googleCalendarConnection?.connected === true
            ? 'connected'
            : 'pending'
          : normalizeIntegrationStatus(row.status),
      })
    })
}

export async function getSettingsConnectionDetailById(id: string) {
  const row = await fetchIntegrationRow({ id })
  const detail = mapIntegrationRowToDetail(row)

  if (!detail.isGoogleCalendar) {
    return detail
  }

  return {
    ...detail,
    status: await getGoogleCalendarDisplayStatus(),
  }
}

export async function getSettingsConnectionDetailByName(name: string) {
  const row = await fetchIntegrationRow({ name })
  const detail = mapIntegrationRowToDetail(row)

  if (!detail.isGoogleCalendar) {
    return detail
  }

  return {
    ...detail,
    status: await getGoogleCalendarDisplayStatus(),
  }
}

export async function updateSettingsConnection(
  id: string,
  input: SettingsConnectionUpdateInput,
) {
  const currentDetail = await getSettingsConnectionDetailById(id)
  const supabase = getSupabaseClient()
  const clearsBillingFields = input.billingCycle === 'free'
  const payload: Record<string, string | null> = {
    name: input.name.trim(),
    billing_cycle: input.billingCycle,
    billing_cycle_start: clearsBillingFields ? null : input.billingCycleStart || null,
    billing_cycle_end: clearsBillingFields ? null : input.billingCycleEnd || null,
    billing_amount: clearsBillingFields
      ? null
      : input.billingAmount.trim()
        ? String(Number(input.billingAmount))
        : null,
  }

  if (!currentDetail.isGoogleCalendar && input.status) {
    payload.status = input.status
  }

  const { data, error } = await supabase
    .from('integrations')
    .update(payload)
    .eq('id', id)
    .select(
      'id, name, status, billing_cycle, billing_amount, created_at, updated_at, sort_order, billing_cycle_start, billing_cycle_end',
    )
    .single<IntegrationRow>()

  if (error) {
    throw new Error(error.message)
  }

  const updatedDetail = mapIntegrationRowToDetail(data)

  if (!updatedDetail.isGoogleCalendar) {
    return updatedDetail
  }

  return {
    ...updatedDetail,
    status: await getGoogleCalendarDisplayStatus(),
  }
}
