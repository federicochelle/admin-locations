import { useEffect, useState } from 'react'
import {
  getActiveSubscriptionPlans,
  getSubscriptions,
  updateSubscriptionPlan,
} from './subscriptions.service'
import type {
  SubscriptionListItem,
  SubscriptionPlanOption,
} from './subscriptions.types'

type UseSubscriptionsResult = {
  subscriptions: SubscriptionListItem[]
  plans: SubscriptionPlanOption[]
  isLoading: boolean
  errorMessage: string | null
  actionErrorMessage: string | null
  activeActionKey: string | null
  loadSubscriptions: () => Promise<void>
  retry: () => Promise<void>
  changePlan: (subscriptionId: string, planId: string) => Promise<void>
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'No pudimos cargar las suscripciones en este momento.'
}

export function useSubscriptions(): UseSubscriptionsResult {
  const [subscriptions, setSubscriptions] = useState<SubscriptionListItem[]>([])
  const [plans, setPlans] = useState<SubscriptionPlanOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null)

  async function loadSubscriptions() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const [nextSubscriptions, nextPlans] = await Promise.all([
        getSubscriptions(),
        getActiveSubscriptionPlans(),
      ])
      setSubscriptions(nextSubscriptions)
      setPlans(nextPlans)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function retry() {
    await loadSubscriptions()
  }

  async function changePlan(subscriptionId: string, planId: string) {
    const currentSubscription =
      subscriptions.find((subscription) => subscription.id === subscriptionId) ?? null

    if (!currentSubscription) {
      return
    }

    if (currentSubscription.planId === planId) {
      return
    }

    if (activeActionKey === `plan:${subscriptionId}`) {
      return
    }

    const nextPlan =
      plans.find((plan) => plan.id === planId) ?? null

    const previousPlanId = currentSubscription.planId
    const previousPlanName = currentSubscription.planName

    try {
      setActiveActionKey(`plan:${subscriptionId}`)
      setActionErrorMessage(null)

      setSubscriptions((currentSubscriptions) =>
        currentSubscriptions.map((subscription) =>
          subscription.id === subscriptionId
            ? {
                ...subscription,
                planId,
                planName: nextPlan?.name ?? subscription.planName,
              }
            : subscription,
        ),
      )

      await updateSubscriptionPlan({
        subscriptionId,
        planId,
      })
    } catch (error) {
      setSubscriptions((currentSubscriptions) =>
        currentSubscriptions.map((subscription) =>
          subscription.id === subscriptionId
            ? {
                ...subscription,
                planId: previousPlanId,
                planName: previousPlanName,
              }
            : subscription,
        ),
      )
      setActionErrorMessage(getErrorMessage(error))
    } finally {
      setActiveActionKey(null)
    }
  }

  useEffect(() => {
    let isActive = true

    void Promise.all([getSubscriptions(), getActiveSubscriptionPlans()])
      .then(([nextSubscriptions, nextPlans]) => {
        if (!isActive) {
          return
        }

        setSubscriptions(nextSubscriptions)
        setPlans(nextPlans)
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        setErrorMessage(getErrorMessage(error))
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  return {
    subscriptions,
    plans,
    isLoading,
    errorMessage,
    actionErrorMessage,
    activeActionKey,
    loadSubscriptions,
    retry,
    changePlan,
  }
}
