import { useEffect, useState } from 'react'
import { getProposalSubmissions } from './proposal-submissions.service'
import type { ProposalListItem } from './proposal-submissions.types'

type UseProposalSubmissionsResult = {
  proposals: ProposalListItem[]
  isLoading: boolean
  errorMessage: string | null
  loadProposals: () => Promise<void>
  retry: () => Promise<void>
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
  const [isLoading, setIsLoading] = useState(enabled)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function loadProposals() {
    if (!enabled) {
      setProposals([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextProposals = await getProposalSubmissions()
      setProposals(nextProposals)
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

    void getProposalSubmissions()
      .then((nextProposals) => {
        if (!isActive) {
          return
        }

        setProposals(nextProposals)
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
    proposals: enabled ? proposals : [],
    isLoading,
    errorMessage,
    loadProposals,
    retry,
  }
}
