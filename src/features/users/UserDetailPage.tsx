import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { useAdminFeedback } from '../../components/ui/admin-feedback/useAdminFeedback'
import PageContainer from '../../components/ui/PageContainer'
import { useAdminProductionCompanies } from './useAdminProductionCompanies'
import LocationRequestsAdminTable from '../requests-admin/LocationRequestsAdminTable'
import { type LocationRequestStatus } from '../requests-admin/admin-location-requests.types'
import { useSubscriptions } from '../subscriptions/useSubscriptions'
import type {
  SubscriptionListItem,
  SubscriptionPlanOption,
} from '../subscriptions/subscriptions.types'
import { updateUserProductionCompanyAssociation } from './users.service'
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

function getRoleBadgeClassName(role: string | null) {
  return getUserRoleKey(role) === 'admin'
    ? 'border-sky-200 bg-sky-50 text-sky-700'
    : 'border-slate-200 bg-slate-100 text-slate-700'
}

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60'
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
  const { alert, showError, withLoading } = useAdminFeedback()
  const [selectedRequestStatus, setSelectedRequestStatus] = useState<'all' | LocationRequestStatus>('all')
  const [pendingProductionCompanyId, setPendingProductionCompanyId] = useState<string | null>(null)
  const [isSavingProductionCompanyAssociation, setIsSavingProductionCompanyAssociation] = useState(false)
  const {
    user,
    isLoading,
    errorMessage,
    reload,
  } = useUserDetail(profileId)
  const {
    companies,
    errorMessage: productionCompaniesErrorMessage,
    isLoading: isLoadingProductionCompanies,
    retry: retryProductionCompanies,
  } = useAdminProductionCompanies()
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
  const isVisitor = getUserRoleKey(user?.role) === 'visitor'
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
  const currentAssociatedCompany =
    !user?.productionCompanyId
      ? null
      : companies.find((company) => company.id === user.productionCompanyId) ?? null
  const productionCompanyOptions = useMemo(() => {
    if (!user) {
      return []
    }

    return companies.filter((company) =>
      company.active || company.id === user.productionCompanyId,
    )
  }, [companies, user])
  const selectedProductionCompanyId =
    pendingProductionCompanyId ?? user?.productionCompanyId ?? ''

  async function handleProductionCompanyChange(nextProductionCompanyId: string) {
    if (!user || !isVisitor) {
      return
    }

    const nextValue = nextProductionCompanyId || null
    const currentValue = user.productionCompanyId ?? null

    if (nextValue === currentValue) {
      setPendingProductionCompanyId(null)
      return
    }

    setPendingProductionCompanyId(nextValue)
    setIsSavingProductionCompanyAssociation(true)

    try {
      await withLoading({
        title: 'Guardar asociación',
        description: 'Estamos actualizando la productora asociada del usuario.',
        progress: {
          enabled: true,
        },
        action: async () => {
          await updateUserProductionCompanyAssociation({
            profileId: user.profileId,
            productionCompanyId: nextValue,
          })
          await reload()
          setPendingProductionCompanyId(null)
        },
      })

      await alert({
        variant: 'success',
        title: 'Asociación actualizada',
        hideProgressBar: true,
        hideProgressPercentage: true,
        iconVariant: 'success',
        progressPercentage: 100,
        closeLabel: 'Entendido',
      })
    } catch (error) {
      setPendingProductionCompanyId(null)
      await showError({
        title: 'No pudimos guardar la asociación',
        description:
          error instanceof Error && error.message.trim()
            ? error.message
            : 'No pudimos actualizar la productora asociada.',
        closeLabel: 'Entendido',
      })
    } finally {
      setIsSavingProductionCompanyAssociation(false)
    }
  }

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

              <div className="grid gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <DetailField label="Email" value={formatOptionalField(user.email)} />
                    <DetailField label="Teléfono" value={formatOptionalField(user.phone)} />

                    {isVisitor ? (
                      <DetailField
                        label="Productora declarada"
                        value={formatOptionalField(user.companyName)}
                      />
                    ) : (
                      <DetailField label="Empresa" value={formatOptionalField(user.companyName)} />
                    )}

                    {isVisitor ? (
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Productora asociada
                        </p>
                        <div className="mt-2 space-y-3">
                          {productionCompaniesErrorMessage ? (
                            <div className="flex flex-col gap-3">
                              <p className="text-sm leading-6 text-slate-600">
                                {productionCompaniesErrorMessage}
                              </p>
                              <div>
                                <Button variant="secondary" onClick={() => void retryProductionCompanies()}>
                                  Reintentar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <select
                                value={selectedProductionCompanyId}
                                disabled={isLoadingProductionCompanies || isSavingProductionCompanyAssociation}
                                onChange={(event) => {
                                  void handleProductionCompanyChange(event.target.value)
                                }}
                                className={inputClassName()}
                              >
                                <option value="">Sin asociar</option>
                                {productionCompanyOptions.map((company) => (
                                  <option key={company.id} value={company.id}>
                                    {company.active
                                      ? company.name
                                      : `${company.name} (actual inactiva)`}
                                  </option>
                                ))}
                              </select>

                              {!currentAssociatedCompany && user.productionCompanyId ? (
                                <p className="text-sm leading-6 text-slate-600">
                                  La productora asociada actual no está disponible en el catálogo cargado.
                                </p>
                              ) : null}

                              {currentAssociatedCompany?.active === false ? (
                                <p className="text-sm leading-6 text-slate-600">
                                  La asociación actual apunta a una productora inactiva. Podés mantenerla, cambiarla por una activa o limpiarla.
                                </p>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-5 border-t border-slate-200 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                  <div className="space-y-5">
                    <DetailField label="Fecha de registro" value={formatCreatedAt(user.createdAt)} />
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
