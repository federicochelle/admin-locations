import { useMemo, useState } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
import ProposalsTable from './ProposalsTable'
import { useProposalSubmissions } from './useProposalSubmissions'
import {
  PROPOSAL_STATUS_OPTIONS,
  type ProposalStatus,
} from './proposal-submissions.types'

function ProposalsPage() {
  const { proposals, isLoading, errorMessage, retry } = useProposalSubmissions()
  const [selectedStatus, setSelectedStatus] = useState<'all' | ProposalStatus>('all')

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Panel admin', to: routePaths.dashboard },
        { label: 'Propuestas' },
      ],
      title: 'Propuestas',
      description:
        'Gestioná las postulaciones recibidas desde la web pública y revisá su estado de seguimiento.',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  const filteredProposals =
    selectedStatus === 'all'
      ? proposals
      : proposals.filter((proposal) => proposal.status === selectedStatus)

  return (
    <PageContainer
      title="Propuestas"
      description="Gestioná las postulaciones recibidas desde la web pública y revisá su estado de seguimiento."
      hideHeader
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-300">
            {filteredProposals.length} de {proposals.length} propuestas visibles
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-100" htmlFor="proposal-status-filter">
            Estado
          </label>
          <select
            id="proposal-status-filter"
            value={selectedStatus}
            onChange={(event) =>
              setSelectedStatus(event.target.value as 'all' | ProposalStatus)
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

      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando propuestas...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos cargar las propuestas
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {errorMessage}
              </p>
            </div>
            <Button variant="secondary" onClick={() => void retry()}>
              Reintentar
            </Button>
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && filteredProposals.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            title={
              proposals.length === 0
                ? 'Todavía no hay propuestas'
                : 'No hay propuestas para este estado'
            }
            description={
              proposals.length === 0
                ? 'Cuando lleguen nuevas postulaciones desde la web pública, aparecerán acá.'
                : 'Probá con otro estado para ver más resultados.'
            }
          />
        </Card>
      ) : null}

      {!isLoading && !errorMessage && filteredProposals.length > 0 ? (
        <ProposalsTable proposals={filteredProposals} />
      ) : null}
    </PageContainer>
  )
}

export default ProposalsPage
