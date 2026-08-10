export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'cancelled'
  | 'expired'

export type SubscriptionListItem = {
  id: string
  userId: string
  profileId: string | null
  customerName: string | null
  customerEmail: string | null
  planId: string | null
  planName: string | null
  status: string | null
  startsAt: string | null
  expiresAt: string | null
  cancelAtPeriodEnd: boolean
}

export type SubscriptionPlanOption = {
  id: string
  name: string
}

export function getSubscriptionStatusKey(
  status: string | null | undefined,
): SubscriptionStatus {
  const normalizedStatus = status?.trim().toLocaleLowerCase()

  if (normalizedStatus === 'active') {
    return 'active'
  }

  if (normalizedStatus === 'trialing') {
    return 'trialing'
  }

  if (normalizedStatus === 'past_due') {
    return 'past_due'
  }

  if (normalizedStatus === 'cancelled') {
    return 'cancelled'
  }

  return 'expired'
}

export function getSubscriptionStatusLabel(status: string | null | undefined) {
  const statusKey = getSubscriptionStatusKey(status)

  if (statusKey === 'active') {
    return 'Activa'
  }

  if (statusKey === 'trialing') {
    return 'Prueba'
  }

  if (statusKey === 'past_due') {
    return 'Pago pendiente'
  }

  if (statusKey === 'cancelled') {
    return 'Cancelada'
  }

  return 'Vencida'
}
