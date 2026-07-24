import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { getPendingRequestsCount } from '../../features/requests-admin/admin-location-requests.service'
import { getPendingProposalSubmissionsCount } from '../../features/proposals/proposal-submissions.service'

export type PendingNavCounts = {
  pendingProposals: number
  pendingRequests: number
}

type PendingNavCountsContextValue = {
  counts: PendingNavCounts
  refreshCounts: () => Promise<void>
}

const INITIAL_COUNTS: PendingNavCounts = {
  pendingProposals: 0,
  pendingRequests: 0,
}

const PendingNavCountsContext = createContext<PendingNavCountsContextValue | null>(null)

export function PendingNavCountsProvider({ children }: PropsWithChildren) {
  const [counts, setCounts] = useState<PendingNavCounts>(INITIAL_COUNTS)

  const refreshCounts = useCallback(async () => {
    try {
      const [pendingRequests, pendingProposals] = await Promise.all([
        getPendingRequestsCount(),
        getPendingProposalSubmissionsCount(),
      ])

      setCounts({
        pendingProposals,
        pendingRequests,
      })
    } catch (error) {
      console.warn('No pudimos actualizar los contadores pendientes del sidebar.', error)
    }
  }, [])

  useEffect(() => {
    void refreshCounts()
  }, [refreshCounts])

  useEffect(() => {
    function handleWindowFocus() {
      void refreshCounts()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshCounts()
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshCounts])

  const value = useMemo<PendingNavCountsContextValue>(
    () => ({
      counts,
      refreshCounts,
    }),
    [counts, refreshCounts],
  )

  return (
    <PendingNavCountsContext.Provider value={value}>
      {children}
    </PendingNavCountsContext.Provider>
  )
}

export function usePendingNavCounts() {
  const context = useContext(PendingNavCountsContext)

  if (!context) {
    throw new Error(
      'usePendingNavCounts debe usarse dentro de PendingNavCountsProvider.',
    )
  }

  return context
}
