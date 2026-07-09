import { useEffect, useState } from 'react'
import {
  getProposalSubmissionById,
  updateProposalSubmission,
} from './proposal-submissions.service'
import { isProposalSubmissionNotFoundError } from './proposal-submissions.helpers'
import type {
  ProposalDetails,
  ProposalStatus,
} from './proposal-submissions.types'

type UseProposalSubmissionDetailResult = {
  proposal: ProposalDetails | null
  isLoading: boolean
  isSaving: boolean
  errorMessage: string | null
  saveErrorMessage: string | null
  saveSuccessMessage: string | null
  reload: () => Promise<void>
  save: (status: ProposalStatus, adminNotes: string) => Promise<void>
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error.message
  }

  return fallbackMessage
}

export function useProposalSubmissionDetail(
  submissionId: string | null | undefined,
  enabled = true,
): UseProposalSubmissionDetailResult {
  const [proposal, setProposal] = useState<ProposalDetails | null>(null)
  const [isLoading, setIsLoading] = useState(enabled && Boolean(submissionId))
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)

  async function loadProposal() {
    if (!enabled || !submissionId) {
      setProposal(null)
      setErrorMessage(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextProposal = await getProposalSubmissionById(submissionId)
      setProposal(nextProposal)
    } catch (error) {
      setErrorMessage(
        isProposalSubmissionNotFoundError(error)
          ? 'PROPOSAL_NOT_FOUND'
          : getErrorMessage(error, 'No pudimos cargar la propuesta.'),
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function reload() {
    await loadProposal()
  }

  async function save(status: ProposalStatus, adminNotes: string) {
    if (!proposal) {
      return
    }

    try {
      setIsSaving(true)
      setSaveErrorMessage(null)
      setSaveSuccessMessage(null)

      await updateProposalSubmission({
        id: proposal.id,
        status,
        adminNotes,
      })

      setProposal((currentProposal) =>
        currentProposal
          ? {
              ...currentProposal,
              status,
              adminNotes: adminNotes.trim().length > 0 ? adminNotes.trim() : null,
              updatedAt: new Date().toISOString(),
            }
          : currentProposal,
      )
      setSaveSuccessMessage('Propuesta actualizada correctamente.')
    } catch (error) {
      setSaveErrorMessage(
        getErrorMessage(error, 'No pudimos guardar los cambios de la propuesta.'),
      )
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (!enabled || !submissionId) {
      return
    }

    let isActive = true

    void getProposalSubmissionById(submissionId)
      .then((nextProposal) => {
        if (!isActive) {
          return
        }

        setProposal(nextProposal)
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        setErrorMessage(
          isProposalSubmissionNotFoundError(error)
            ? 'PROPOSAL_NOT_FOUND'
            : getErrorMessage(error, 'No pudimos cargar la propuesta.'),
        )
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
  }, [enabled, submissionId])

  return {
    proposal: enabled && submissionId ? proposal : null,
    isLoading,
    isSaving,
    errorMessage: enabled && submissionId ? errorMessage : null,
    saveErrorMessage,
    saveSuccessMessage,
    reload,
    save,
  }
}
