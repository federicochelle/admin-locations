import { useEffect, useState } from 'react'
import { getProposalSubmissionsPage } from './proposal-submissions.service'
import type { ProposalListItem, ProposalStatus } from './proposal-submissions.types'

const PAGE_SIZE = 30

type UseProposalSubmissionsResult = {
  proposals: ProposalListItem[]
  currentPage: number
  pageSize: number
  totalCount: number
  selectedStatus: 'all' | ProposalStatus
  isLoading: boolean
  errorMessage: string | null
  loadProposals: () => Promise<void>
  retry: () => Promise<void>
  setCurrentPage: (page: number) => void
  setSelectedStatus: (status: 'all' | ProposalStatus) => void
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'No pudimos cargar las propuestas en este momento.'
}

export function useProposalSubmissions(
  enabled = true,
): UseProposalSubmissionsResult {
  const [proposals, setProposals] = useState<ProposalListItem[]>([])
  const [currentPage, setCurrentPageState] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedStatus, setSelectedStatusState] = useState<'all' | ProposalStatus>('all')
  const [isLoading, setIsLoading] = useState(enabled)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function setCurrentPage(page: number) {
    setCurrentPageState(Math.max(1, page))
  }

  function setSelectedStatus(status: 'all' | ProposalStatus) {
    setSelectedStatusState(status)
    setCurrentPageState(1)
  }

  async function fetchProposalsPage(page: number) {
    const result = await getProposalSubmissionsPage({
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

  async function loadProposals() {
    if (!enabled) {
      setProposals([])
      setTotalCount(0)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setErrorMessage(null)

      const result = await fetchProposalsPage(currentPage)

      if (!result) {
        return
      }

      setProposals(result.items)
      setTotalCount(result.totalCount)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function retry() {
    await loadProposals()
  }

  useEffect(() => {
    if (!enabled) {
      return
    }

    let isActive = true

    void getProposalSubmissionsPage({
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

        setProposals(result.items)
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
    proposals: enabled ? proposals : [],
    currentPage,
    pageSize: PAGE_SIZE,
    totalCount: enabled ? totalCount : 0,
    selectedStatus,
    isLoading: enabled ? isLoading : false,
    errorMessage: enabled ? errorMessage : null,
    loadProposals,
    retry,
    setCurrentPage,
    setSelectedStatus,
  }
}
