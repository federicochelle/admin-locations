import { Link, useNavigate } from 'react-router-dom'
import Card from '../../components/ui/Card'
import { buttonBaseClassName, buttonVariantClasses } from '../../components/ui/button.styles'
import { getProposalDetailPath } from '../../app/router/route-paths'
import {
  formatProposalDateTime,
  getProposalLocationLabel,
} from './proposal-submissions.helpers'
import {
  PROPOSAL_STATUS_OPTIONS,
  type ProposalListItem,
  type ProposalStatus,
} from './proposal-submissions.types'
import ProposalStatusBadge from './ProposalStatusBadge'

type ProposalsTableProps = {
  proposals: ProposalListItem[]
  totalCount: number
  selectedStatus: 'all' | ProposalStatus
  onSelectedStatusChange: (status: 'all' | ProposalStatus) => void
}

function ProposalsTable({
  proposals,
  totalCount,
  selectedStatus,
  onSelectedStatusChange,
}: ProposalsTableProps) {
  const navigate = useNavigate()

  function isInteractiveEventTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) {
      return false
    }

    return Boolean(
      target.closest(
        'button, a, input, select, textarea, [role="button"]',
      ),
    )
  }

  function handleRowNavigation(
    proposalId: string,
    event: React.MouseEvent<HTMLTableRowElement> | React.KeyboardEvent<HTMLTableRowElement>,
  ) {
    if (isInteractiveEventTarget(event.target)) {
      return
    }

    navigate(getProposalDetailPath(proposalId))
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Listado de propuestas</h2>
            <p className="mt-1 text-sm text-slate-600">
              {totalCount} {totalCount === 1 ? 'propuesta recibida' : 'propuestas recibidas'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700" htmlFor="proposal-status-filter">
              Estado
            </label>
            <select
              id="proposal-status-filter"
              value={selectedStatus}
              onChange={(event) =>
                onSelectedStatusChange(event.target.value as 'all' | ProposalStatus)
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              <option value="all">Todos</option>
              {PROPOSAL_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-[#f3f2ee]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Email</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Teléfono</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Ubicación</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-transparent">
            {proposals.map((proposal) => (
              <tr
                key={proposal.id}
                tabIndex={0}
                className="cursor-pointer align-top transition hover:bg-[rgba(184,146,74,0.10)] focus-visible:bg-[rgba(184,146,74,0.10)] focus-visible:outline-none"
                onClick={(event) => handleRowNavigation(proposal.id, event)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return
                  }

                  event.preventDefault()
                  handleRowNavigation(proposal.id, event)
                }}
              >
                <td className="px-6 py-4 text-sm text-slate-600">
                  <div className="min-w-[160px]">{formatProposalDateTime(proposal.createdAt)}</div>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-950">
                  <div className="min-w-[180px]">{proposal.ownerName}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <div className="min-w-[220px]">{proposal.ownerEmail}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <div className="min-w-[160px]">{proposal.ownerPhone}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <div className="min-w-[220px]">{getProposalLocationLabel(proposal)}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-900">
                  <div className="min-w-[150px]">
                    <ProposalStatusBadge status={proposal.status} />
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <Link
                    to={getProposalDetailPath(proposal.id)}
                    onClick={(event) => event.stopPropagation()}
                    className={[buttonBaseClassName, buttonVariantClasses.secondary].join(' ')}
                  >
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default ProposalsTable
