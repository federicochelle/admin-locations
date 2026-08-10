import { useMemo } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
import SettingsConnectionsTable from './SettingsConnectionsTable'
import { useSettingsConnections } from './useSettingsConnections'

function SettingsPage() {
  const {
    connections,
    errorMessage,
    isLoading,
    retry,
  } = useSettingsConnections()

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [{ label: 'Configuración' }],
      title: 'Configuración',
      description:
        'Pantalla base para revisar el estado de las integraciones y conexiones de la plataforma.',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  return (
    <PageContainer
      title="Configuración"
      description="Pantalla base para revisar el estado de las integraciones y conexiones de la plataforma."
      hideHeader
    >
      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando conexiones...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos cargar las conexiones
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

      {!isLoading && !errorMessage && connections.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            title="Todavía no hay conexiones visibles"
            description="Cuando existan integraciones disponibles para este panel, aparecerán acá."
          />
        </Card>
      ) : null}

      {!isLoading && !errorMessage && connections.length > 0 ? (
        <SettingsConnectionsTable connections={connections} />
      ) : null}
    </PageContainer>
  )
}

export default SettingsPage
