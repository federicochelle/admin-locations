import { Link } from 'react-router-dom'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import {
  buttonBaseClassName,
  buttonVariantClasses,
} from '../../components/ui/button.styles'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
import FeaturesTable from './FeaturesTable'
import { useFeatures } from './useFeatures'

function FeaturesPage() {
  const {
    actionErrorMessage,
    activeActionKey,
    errorMessage,
    features,
    isLoading,
    remove,
    retry,
  } = useFeatures()

  async function handleDelete(id: string) {
    const shouldDelete = window.confirm(
      '¿Seguro que querés eliminar esta feature? Si tiene relaciones con locaciones, puede fallar.',
    )

    if (!shouldDelete) {
      return
    }

    await remove(id)
  }

  return (
    <PageContainer
      title="Features"
      description="Administrá amenities, atributos y características reutilizables asociadas a cada locación."
    >
      <div className="flex justify-end">
        <Link
          to={routePaths.featureNew}
          className={[buttonBaseClassName, buttonVariantClasses.primary].join(' ')}
        >
          Nueva feature
        </Link>
      </div>

      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando features...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos cargar las features
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

      {!isLoading && !errorMessage && actionErrorMessage ? (
        <Card>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              No pudimos actualizar la feature
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {actionErrorMessage}
            </p>
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && features.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            title="Todavía no hay features cargadas"
            description="Cuando agregues amenities o atributos, acá aparecerá el listado completo."
          />
        </Card>
      ) : null}

      {!isLoading && !errorMessage && features.length > 0 ? (
        <FeaturesTable
          features={features}
          activeActionKey={activeActionKey}
          onDelete={handleDelete}
        />
      ) : null}
    </PageContainer>
  )
}

export default FeaturesPage
