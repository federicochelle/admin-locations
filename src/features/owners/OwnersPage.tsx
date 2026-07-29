import { useMemo } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
import Button from '../../components/ui/Button'
import OwnersTable from './OwnersTable'
import { useOwners } from './useOwners'

function OwnersPage() {
  const {
    errorMessage,
    isLoading,
    owners,
    retry,
  } = useOwners()

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [{ label: 'Dueños' }],
      title: 'Dueños',
      description:
        'Base inicial para gestionar propietarios, productores o responsables asociados a cada locación.',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  return (
    <PageContainer
      title="Dueños"
      description="Base inicial para gestionar propietarios, productores o responsables asociados a cada locación."
      hideHeader
    >
      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando dueños...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos cargar los dueños
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

      {!isLoading && !errorMessage && owners.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            title="Todavía no hay dueños cargados"
            description="Cuando agregues propietarios o responsables, acá aparecerá el listado completo."
          />
        </Card>
      ) : null}

      {!isLoading && !errorMessage && owners.length > 0 ? (
        <OwnersTable owners={owners} />
      ) : null}
    </PageContainer>
  )
}

export default OwnersPage
