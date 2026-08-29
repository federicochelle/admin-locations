import { useEffect, useState } from 'react'
import { getActivityLogsPage, type ActivityLogListItem } from './activity-logs.service'

const PAGE_SIZE = 30

type UseActivityLogsResult = {
  activityLogs: ActivityLogListItem[]
  currentPage: number
  pageSize: number
  totalCount: number
  searchTerm: string
  isLoading: boolean
  errorMessage: string | null
  loadActivityLogs: () => Promise<void>
  retry: () => Promise<void>
  setCurrentPage: (page: number) => void
  setSearchTerm: (value: string) => void
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'No pudimos cargar el historial de actividad.'
}

export function useActivityLogs(): UseActivityLogsResult {
  const [activityLogs, setActivityLogs] = useState<ActivityLogListItem[]>([])
  const [currentPage, setCurrentPageState] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchTerm, setSearchTermState] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function setCurrentPage(page: number) {
    setCurrentPageState(Math.max(1, page))
  }

  function setSearchTerm(value: string) {
    setSearchTermState(value)
    setCurrentPageState(1)
  }

  async function fetchActivityLogsPage(page: number) {
    const result = await getActivityLogsPage({
      page,
      pageSize: PAGE_SIZE,
      searchTerm,
    })
    const lastAvailablePage = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE))

    if (page > lastAvailablePage) {
      setCurrentPageState(lastAvailablePage)
      return null
    }

    return result
  }

  async function loadActivityLogs() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const result = await fetchActivityLogsPage(currentPage)

      if (!result) {
        return
      }

      setActivityLogs(result.items)
      setTotalCount(result.totalCount)
    } catch (error) {
      console.error('No pudimos cargar el historial de actividad.', error)
      setErrorMessage(getErrorMessage(error))
      setActivityLogs([])
    } finally {
      setIsLoading(false)
    }
  }

  async function retry() {
    await loadActivityLogs()
  }

  useEffect(() => {
    let isActive = true

    void getActivityLogsPage({
      page: currentPage,
      pageSize: PAGE_SIZE,
      searchTerm,
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

        setActivityLogs(result.items)
        setTotalCount(result.totalCount)
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        console.error('No pudimos cargar el historial de actividad.', error)
        setErrorMessage(getErrorMessage(error))
        setActivityLogs([])
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
  }, [currentPage, searchTerm])

  return {
    activityLogs,
    currentPage,
    pageSize: PAGE_SIZE,
    totalCount,
    searchTerm,
    isLoading,
    errorMessage,
    loadActivityLogs,
    retry,
    setCurrentPage,
    setSearchTerm,
  }
}
