import { useMemo } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
import UsersTable from './UsersTable'
import { useUsers } from './useUsers'

function UsersPage() {
  const {
    errorMessage,
    isLoading,
    users,
    retry,
  } = useUsers()

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [{ label: 'Usuarios' }],
      title: 'Usuarios',
      description:
        'Vista inicial para revisar las cuentas registradas dentro del panel administrador.',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  return (
    <PageContainer
      title="Usuarios"
      description="Vista inicial para revisar las cuentas registradas dentro del panel administrador."
      hideHeader
    >
      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando usuarios...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos cargar los usuarios
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

      {!isLoading && !errorMessage && users.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            title="Todavía no hay usuarios visibles"
            description="Cuando existan perfiles accesibles para este admin, acá aparecerá el listado."
          />
        </Card>
      ) : null}

      {!isLoading && !errorMessage && users.length > 0 ? (
        <UsersTable users={users} />
      ) : null}
    </PageContainer>
  )
}

export default UsersPage
