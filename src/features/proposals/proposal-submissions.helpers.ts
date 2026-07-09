import type {
  ProposalDetails,
  ProposalStatus,
} from './proposal-submissions.types'
import { PROPOSAL_STATUS_OPTIONS } from './proposal-submissions.types'

export function getProposalStatusLabel(status: ProposalStatus) {
  return (
    PROPOSAL_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  )
}

export function getProposalStatusBadgeClassName(status: ProposalStatus) {
  switch (status) {
    case 'pending':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'reviewing':
      return 'border-sky-200 bg-sky-50 text-sky-700'
    case 'contacted':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'scheduled':
      return 'border-violet-200 bg-violet-50 text-violet-700'
    case 'approved':
      return 'border-lime-200 bg-lime-50 text-lime-700'
    case 'rejected':
      return 'border-rose-200 bg-rose-50 text-rose-700'
  }
}

export function formatProposalDateTime(value: string) {
  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatOptionalField(value: string | null | undefined) {
  const normalizedValue = value?.trim()
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : '-'
}

export function isProposalSubmissionNotFoundError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const normalizedMessage = error.message.toLocaleLowerCase()

  return (
    normalizedMessage.includes('cannot coerce the result to a single json object') ||
    normalizedMessage.includes('no rows returned') ||
    normalizedMessage.includes('not found')
  )
}

export function getProposalSummaryTitle(
  proposal: Pick<ProposalDetails, 'title' | 'ownerName'>,
) {
  const title = proposal.title.trim()

  if (title.length > 0) {
    return title
  }

  const ownerName = proposal.ownerName.trim()

  if (ownerName.length > 0) {
    return ownerName
  }

  return 'Propuesta sin título'
}
