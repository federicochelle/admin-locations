import type { ProposalStatus } from './proposal-submissions.types'
import {
  getProposalStatusBadgeClassName,
  getProposalStatusLabel,
} from './proposal-submissions.helpers'

type ProposalStatusBadgeProps = {
  status: ProposalStatus
}

function ProposalStatusBadge({ status }: ProposalStatusBadgeProps) {
  return (
    <span
      className={[
        'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
        getProposalStatusBadgeClassName(status),
      ].join(' ')}
    >
      {getProposalStatusLabel(status)}
    </span>
  )
}

export default ProposalStatusBadge
