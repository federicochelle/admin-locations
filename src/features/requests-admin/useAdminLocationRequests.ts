import { useEffect, useState } from 'react'
import {
  getAdminLocationRequests,
  updateAdminLocationRequestStatus,
} from './admin-location-requests.service'
import { usePendingNavCounts } from '../../app/layouts/PendingNavCountsContext'
import type {
  AdminLocationRequest,
  LocationRequestStatus,
} from './admin-location-requests.types'

type UseAdminLocationRequestsResult = {
  requests: AdminLocationRequest[]
  isLoading: boolean
  errorMessage: string | null
  actionErrorMessage: string | null
  actionSuccessMessage: string | null
  activeActionKey: string | null
  loadRequests: () => Promise<void>
  retry: () => Promise<void>
  updateStatus: (requestId: string, status: LocationRequestStatus) => Promise<void>
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'No pudimos cargar las solicitudes en este momento.'
}

export function useAdminLocationRequests(
  enabled = true,
): UseAdminLocationRequestsResult {
  const { refreshCounts } = usePendingNavCounts()
  const [requests, setRequests] = useState<AdminLocationRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null)
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null)

  async function loadRequests() {
    if (!enabled) {
      setRequests([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextRequests = await getAdminLocationRequests()
      setRequests(nextRequests)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function retry() {
    await loadRequests()
  }

  async function updateStatus(requestId: string, status: LocationRequestStatus) {
    try {
      setActiveActionKey(`status:${requestId}`)
      setActionErrorMessage(null)
      setActionSuccessMessage(null)

      await updateAdminLocationRequestStatus(requestId, status)
      setRequests((currentRequests) =>
        currentRequests.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status,
                updatedAt: new Date().toISOString(),
              }
            : request,
        ),
      )
      await refreshCounts()
      setActionSuccessMessage('Estado actualizado correctamente.')
    } catch (error) {
      setActionErrorMessage(getErrorMessage(error))
    } finally {
      setActiveActionKey(null)
    }
  }

  useEffect(() => {
    if (!enabled) {
      setRequests([])
      setIsLoading(false)
      setErrorMessage(null)
      return
    }

    let isActive = true

    void getAdminLocationRequests()
      .then((nextRequests) => {
        if (!isActive) {
          return
        }

        setRequests(nextRequests)
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
  }, [enabled])

  return {
    requests,
    isLoading,
    errorMessage,
    actionErrorMessage,
    actionSuccessMessage,
    activeActionKey,
    loadRequests,
    retry,
    updateStatus,
  }
}
