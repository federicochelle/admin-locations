export type IntegrationStatus =
  | 'active'
  | 'connected'
  | 'configured'
  | 'pending'
  | 'error'

export type IntegrationBillingCycle =
  | 'monthly'
  | 'usage'
  | 'free'

export type SettingsConnectionItem = {
  billingAmount: string
  billingCycle: IntegrationBillingCycle | null
  id: string
  key: string
  name: string
  status: IntegrationStatus
}

export type SettingsConnectionDetail = {
  billingAmount: string
  billingCycle: IntegrationBillingCycle | null
  id: string
  key: string
  name: string
  status: IntegrationStatus
  billingCycleStart: string
  billingCycleEnd: string
  sortOrder: number | null
  createdAt: string
  updatedAt: string
  isGoogleCalendar: boolean
}

export type SettingsConnectionUpdateInput = {
  billingAmount: string
  billingCycle: IntegrationBillingCycle | null
  billingCycleEnd: string
  billingCycleStart: string
  name: string
  status?: Exclude<IntegrationStatus, 'active' | 'connected'>
}

export const SETTINGS_CONNECTION_BILLING_CYCLE_OPTIONS: Array<{
  label: string
  value: IntegrationBillingCycle
}> = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'usage', label: 'Por uso' },
  { value: 'free', label: 'Gratis' },
]

export const SETTINGS_CONNECTION_STATUS_OPTIONS: Array<{
  label: string
  value: Exclude<IntegrationStatus, 'active' | 'connected'>
}> = [
  { value: 'configured', label: 'Configurado' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'error', label: 'Error' },
]

export function getIntegrationStatusLabel(status: IntegrationStatus) {
  if (status === 'connected') {
    return 'Conectado'
  }

  if (status === 'configured' || status === 'active') {
    return 'Configurado'
  }

  if (status === 'error') {
    return 'Error'
  }

  return 'Pendiente'
}

export function getIntegrationBillingCycleLabel(
  billingCycle: IntegrationBillingCycle | null,
) {
  if (billingCycle === 'monthly') {
    return 'Mensual'
  }

  if (billingCycle === 'usage') {
    return 'Por uso'
  }

  if (billingCycle === 'free') {
    return 'Gratis'
  }

  return '—'
}
