import { Link, useNavigate } from 'react-router-dom'
import Card from '../../components/ui/Card'
import { buttonBaseClassName, buttonVariantClasses } from '../../components/ui/button.styles'
import { getProposalDetailPath } from '../../app/router/route-paths'
import {
  formatOptionalField,
  formatProposalDateTime,
} from './proposal-submissions.helpers'
import type { ProposalListItem } from './proposal-submissions.types'
import ProposalStatusBadge from './ProposalStatusBadge'

type ProposalsTableProps = {
  proposals: ProposalListItem[]
}

function ProposalsTable({ proposals }: ProposalsTableProps) {
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
        <h2 className="text-lg font-semibold text-slate-950">Listado de propuestas</h2>
        <p className="mt-1 text-sm text-slate-600">
          {proposals.length} propuestas encontradas
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Teléfono</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Título</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Departamento</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Zona</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white/95 backdrop-blur-sm">
            {proposals.map((proposal) => (
              <tr
                key={proposal.id}
                tabIndex={0}
                className="cursor-pointer align-top transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                onClick={(event) => handleRowNavigation(proposal.id, event)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return
                  }

                  event.preventDefault()
                  handleRowNavigation(proposal.id, event)
                }}
              >
                <td className="px-6 py-4 text-sm text-slate-900">
                  <div className="min-w-[150px]">
                    <ProposalStatusBadge status={proposal.status} />
                  </div>
                </td>
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
                <td className="px-6 py-4 text-sm text-slate-900">
                  <div className="min-w-[220px] font-medium">{proposal.title}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <div className="min-w-[160px]">{formatOptionalField(proposal.department)}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <div className="min-w-[160px]">{formatOptionalField(proposal.zone)}</div>
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
