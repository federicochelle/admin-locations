import { useEffect, useState } from 'react'
import {
  getAdminLocationRequestsPage,
  updateAdminLocationRequestStatus,
} from './admin-location-requests.service'
import { usePendingNavCounts } from '../../app/layouts/PendingNavCountsContext'
import type {
  AdminLocationRequest,
  LocationRequestStatus,
} from './admin-location-requests.types'

const PAGE_SIZE = 30

type UseAdminLocationRequestsResult = {
  requests: AdminLocationRequest[]
  currentPage: number
  pageSize: number
  totalCount: number
  selectedStatus: 'all' | LocationRequestStatus
  isLoading: boolean
  errorMessage: string | null
  actionErrorMessage: string | null
  actionSuccessMessage: string | null
  activeActionKey: string | null
  loadRequests: () => Promise<void>
  retry: () => Promise<void>
  setCurrentPage: (page: number) => void
  setSelectedStatus: (status: 'all' | LocationRequestStatus) => void
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
  const [currentPage, setCurrentPageState] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedStatus, setSelectedStatusState] = useState<'all' | LocationRequestStatus>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null)
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null)

  function setCurrentPage(page: number) {
    setCurrentPageState(Math.max(1, page))
  }

  function setSelectedStatus(status: 'all' | LocationRequestStatus) {
    setSelectedStatusState(status)
    setCurrentPageState(1)
  }

  async function fetchRequestsPage(page: number) {
    const result = await getAdminLocationRequestsPage({
      page,
      pageSize: PAGE_SIZE,
      status: selectedStatus,
    })

    const lastAvailablePage = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE))

    if (page > lastAvailablePage) {
      setCurrentPageState(lastAvailablePage)
      return null
    }

    return result
  }

  async function loadRequests() {
    if (!enabled) {
      setRequests([])
      setTotalCount(0)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setErrorMessage(null)

      const result = await fetchRequestsPage(currentPage)

      if (!result) {
        return
      }

      setRequests(result.items)
      setTotalCount(result.totalCount)
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
      return
    }

    let isActive = true

    void getAdminLocationRequestsPage({
      page: currentPage,
      pageSize: PAGE_SIZE,
      status: selectedStatus,
    })
      .then((result) => {
        if (!isActive) {
          return
        }

        const lastAvailablePage = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE))

        if (currentPage > lastAvailablePage) {
          setCurrentPageState(lastAvailablePage)
          return
        }

        setRequests(result.items)
        setTotalCount(result.totalCount)
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
  }, [currentPage, enabled, selectedStatus])

  return {
    requests: enabled ? requests : [],
    currentPage,
    pageSize: PAGE_SIZE,
    totalCount: enabled ? totalCount : 0,
    selectedStatus,
    isLoading: enabled ? isLoading : false,
    errorMessage: enabled ? errorMessage : null,
    actionErrorMessage,
    actionSuccessMessage,
    activeActionKey,
    loadRequests,
    retry,
    setCurrentPage,
    setSelectedStatus,
    updateStatus,
  }
}
