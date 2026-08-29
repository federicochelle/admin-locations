import { useMemo } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
import ProposalsTable from './ProposalsTable'
import { useProposalSubmissions } from './useProposalSubmissions'

function ProposalsPage() {
  const {
    proposals,
    currentPage,
    pageSize,
    totalCount,
    selectedStatus,
    isLoading,
    errorMessage,
    retry,
    setCurrentPage,
    setSelectedStatus,
  } = useProposalSubmissions()

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Propuestas' },
      ],
      title: 'Propuestas',
      description:
        'Gestioná las postulaciones recibidas desde la web pública y revisá su estado de seguimiento.',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  return (
    <PageContainer
      title="Propuestas"
      description="Gestioná las postulaciones recibidas desde la web pública y revisá su estado de seguimiento."
      hideHeader
    >
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

      {!isLoading && !errorMessage && proposals.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            title={
              selectedStatus === 'all'
                ? 'Todavía no hay propuestas'
                : 'No hay propuestas para este estado'
            }
            description={
              selectedStatus === 'all'
                ? 'Cuando lleguen nuevas postulaciones desde la web pública, aparecerán acá.'
                : 'Probá con otro estado para ver más resultados.'
            }
          />
        </Card>
      ) : null}

      {!isLoading && !errorMessage && proposals.length > 0 ? (
        <ProposalsTable
          proposals={proposals}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          selectedStatus={selectedStatus}
          onSelectedStatusChange={setSelectedStatus}
          onPageChange={setCurrentPage}
        />
      ) : null}
    </PageContainer>
  )
}

export default ProposalsPage
