import { Link, useNavigate } from 'react-router-dom'
import Card from '../../components/ui/Card'
import TablePagination from '../../components/ui/TablePagination'
import { buttonBaseClassName, buttonVariantClasses } from '../../components/ui/button.styles'
import { getProposalDetailPath } from '../../app/router/route-paths'
import {
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
  currentPage: number
  pageSize: number
  totalCount: number
  selectedStatus: 'all' | ProposalStatus
  onSelectedStatusChange: (status: 'all' | ProposalStatus) => void
  onPageChange: (page: number) => void
}

function formatProposalDate(value: string) {
  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatProposalTime(value: string) {
  return new Intl.DateTimeFormat('es-UY', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function ProposalsTable({
  proposals,
  currentPage,
  pageSize,
  totalCount,
  selectedStatus,
  onSelectedStatusChange,
  onPageChange,
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
    <Card className="-mx-6 overflow-hidden rounded-none border-x-0 p-0 sm:mx-0 sm:rounded-2xl sm:border-x sm:border-y">
      <div className="border-b border-slate-200 px-3 py-5 sm:px-6">
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
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Fecha</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Nombre</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Email</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Teléfono</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Ubicación</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Estado</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Acción</th>
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
                <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">
                  <div className="min-w-[160px]">
                      <p className="font-medium text-slate-900">
                        {formatProposalDate(proposal.submittedAt)}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {formatProposalTime(proposal.submittedAt)}
                      </p>
                  </div>
                </td>
                <td className="px-3 py-4 text-sm font-medium text-slate-950 sm:px-6">
                  <div className="min-w-[180px]">{proposal.ownerName}</div>
                </td>
                <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">
                  <div className="min-w-[220px]">{proposal.ownerEmail}</div>
                </td>
                <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">
                  <div className="min-w-[160px]">{proposal.ownerPhone}</div>
                </td>
                <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">
                  <div className="min-w-[220px]">{getProposalLocationLabel(proposal)}</div>
                </td>
                <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                  <div className="min-w-[150px]">
                    <ProposalStatusBadge status={proposal.status} />
                  </div>
                </td>
                <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">
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

      <TablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={totalCount}
        itemCount={proposals.length}
        onPageChange={onPageChange}
      />
    </Card>
  )
}

export default ProposalsTable
