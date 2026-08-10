import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import LocationRequestsAdminTable from '../requests-admin/LocationRequestsAdminTable'
import { type LocationRequestStatus } from '../requests-admin/admin-location-requests.types'
import { useSubscriptions } from '../subscriptions/useSubscriptions'
import type {
  SubscriptionListItem,
  SubscriptionPlanOption,
} from '../subscriptions/subscriptions.types'
import { useUserDetail } from './useUserDetail'
import {
  getUserRoleLabel,
  getUserRoleKey,
} from './users.types'

function formatOptionalField(value: string | null | undefined) {
  const normalizedValue = value?.trim()

  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : '-'
}

function formatCreatedAt(value: string | null | undefined) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatSubscriptionDate(value: string | null | undefined) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function getRoleBadgeClassName(role: string | null) {
  return getUserRoleKey(role) === 'admin'
    ? 'border-sky-200 bg-sky-50 text-sky-700'
    : 'border-slate-200 bg-slate-100 text-slate-700'
}

function getPlanOptions(subscription: SubscriptionListItem, plans: SubscriptionPlanOption[]) {
  const hasCurrentPlan =
    subscription.planId &&
    plans.some((plan) => plan.id === subscription.planId)

  if (hasCurrentPlan || !subscription.planId || !subscription.planName) {
    return plans
  }

  return [
    {
      id: subscription.planId,
      name: subscription.planName,
    },
    ...plans,
  ]
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-sm font-medium leading-6 text-slate-900">
        {value}
      </div>
    </div>
  )
}

function UserDetailPage() {
  const { profileId } = useParams<{ profileId: string }>()
  const [selectedRequestStatus, setSelectedRequestStatus] = useState<'all' | LocationRequestStatus>('all')
  const {
    user,
    isLoading,
    errorMessage,
    reload,
  } = useUserDetail(profileId)
  const {
    subscriptions,
    plans,
    isLoading: isLoadingSubscriptions,
    errorMessage: subscriptionsErrorMessage,
    actionErrorMessage: subscriptionActionErrorMessage,
    activeActionKey,
    changePlan,
    retry: retrySubscriptions,
  } = useSubscriptions()

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Usuarios', to: routePaths.users },
        { label: user?.fullName?.trim() || 'Detalle de usuario' },
      ],
      title: user?.fullName?.trim() || 'Detalle de usuario',
      description: 'Revisá la información básica del usuario y un resumen simple de su actividad.',
    }),
    [user],
  )

  useLayoutHeader(headerConfig)

  const isNotFound = errorMessage === 'USER_NOT_FOUND'
  const filteredRequests =
    !user
      ? []
      : selectedRequestStatus === 'all'
        ? user.activity.requests
        : user.activity.requests.filter((request) => request.status === selectedRequestStatus)
  const userSubscription =
    !user
      ? null
      : subscriptions.find((subscription) => subscription.userId === user.id) ?? null
  const subscriptionPlanOptions =
    userSubscription ? getPlanOptions(userSubscription, plans) : plans

  return (
    <PageContainer
      title="Detalle de usuario"
      description="Revisá la información básica del usuario y un resumen simple de su actividad."
      hideHeader
    >
      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando usuario...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {isNotFound ? 'No encontramos el usuario' : 'No pudimos cargar el usuario'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {isNotFound
                  ? 'El usuario que intentaste abrir no existe o ya no está disponible.'
                  : errorMessage}
              </p>
            </div>
            {!isNotFound ? (
              <Button variant="secondary" onClick={() => void reload()}>
                Reintentar
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && user ? (
        <>
          <Card>
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {formatOptionalField(user.fullName)}
                </h3>
                <span
                  className={[
                    'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                    getRoleBadgeClassName(user.role),
                  ].join(' ')}
                >
                  {getUserRoleLabel(user.role)}
                </span>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-5">
                  <DetailField label="Email" value={formatOptionalField(user.email)} />
                  <DetailField label="Teléfono" value={formatOptionalField(user.phone)} />
                  <DetailField label="Empresa" value={formatOptionalField(user.companyName)} />
                </div>
                <div className="space-y-5">
                  <DetailField label="Fecha de registro" value={formatCreatedAt(user.createdAt)} />
                </div>
                <div className="space-y-5 border-t border-slate-200 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                  <div className="space-y-5">
                    <DetailField
                      label="Plan"
                      value={
                        subscriptionsErrorMessage ? (
                          <div className="flex flex-col gap-3">
                            <span className="text-sm leading-6 text-slate-600">
                              {subscriptionsErrorMessage}
                            </span>
                            <div>
                              <Button variant="secondary" onClick={() => void retrySubscriptions()}>
                                Reintentar
                              </Button>
                            </div>
                          </div>
                        ) : isLoadingSubscriptions ? (
                          <select
                            disabled
                            value=""
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="">Cargando planes...</option>
                          </select>
                        ) : userSubscription && subscriptionPlanOptions.length > 0 ? (
                          <select
                            value={userSubscription.planId ?? ''}
                            disabled={activeActionKey === `plan:${userSubscription.id}`}
                            onChange={(event) => void changePlan(userSubscription.id, event.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {subscriptionPlanOptions.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.name}
                              </option>
                            ))}
                          </select>
                        ) : userSubscription ? (
                          formatOptionalField(userSubscription.planName)
                        ) : (
                          <select
                            disabled
                            value=""
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="">Sin plan</option>
                          </select>
                        )
                      }
                    />
                    <DetailField
                      label="Inicio"
                      value={formatSubscriptionDate(userSubscription?.startsAt)}
                    />
                    <DetailField
                      label="Vencimiento"
                      value={formatSubscriptionDate(userSubscription?.expiresAt)}
                    />
                    {subscriptionActionErrorMessage ? (
                      <p className="text-sm leading-6 text-rose-600">
                        {subscriptionActionErrorMessage}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-6">
              <LocationRequestsAdminTable
                requests={filteredRequests}
                totalCount={user.activity.requests.length}
                selectedStatus={selectedRequestStatus}
                onSelectedStatusChange={setSelectedRequestStatus}
                isEmbedded
              />
            </div>
          </Card>
        </>
      ) : null}
    </PageContainer>
  )
}

export default UserDetailPage
