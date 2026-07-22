import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import CategoryForm from './CategoryForm'

function CategoryCreatePage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formId = 'category-create-form'
  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Listado de categorías', to: routePaths.categories },
        { label: 'Nueva categoría' },
      ],
      title: 'Nueva categoría',
      description:
        'Creá una categoría base para organizar el catálogo de locaciones desde el panel administrativo.',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  return (
    <PageContainer
      title="Nueva categoría"
      description="Creá una categoría base para organizar el catálogo de locaciones desde el panel administrativo."
      hideHeader
    >
      <Card className="-mx-3 rounded-none border-x-0 sm:mx-0 sm:rounded-2xl sm:border-x">
        <CategoryForm formId={formId} onSubmittingChange={setIsSubmitting} />
      </Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="submit"
          form={formId}
          disabled={isSubmitting}
          className="sm:order-2"
        >
          {isSubmitting ? 'Guardando...' : 'Guardar categoría'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate(routePaths.categories)}
          disabled={isSubmitting}
          className="sm:order-1"
        >
          Cancelar
        </Button>
      </div>
    </PageContainer>
  )
}

export default CategoryCreatePage
