import { useMemo } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import CategoryForm from './CategoryForm'

function CategoryCreatePage() {
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
      <Card>
        <CategoryForm />
      </Card>
    </PageContainer>
  )
}

export default CategoryCreatePage
