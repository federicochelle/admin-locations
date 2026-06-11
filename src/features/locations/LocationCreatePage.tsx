import { useMemo } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import { routePaths } from '../../app/router/route-paths'
import LocationForm from './LocationForm'

function LocationCreatePage() {
  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Listado de locaciones', to: routePaths.locations },
        { label: 'Nueva locación' },
      ],
      title: 'Nueva locación',
      description: 'Completá la información principal y las imágenes de la locación.',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  return (
    <PageContainer
      title="Nueva locación"
      description="Completá la información principal y las imágenes de la locación."
      hideHeader
    >
      <Card>
        <LocationForm />
      </Card>
    </PageContainer>
  )
}

export default LocationCreatePage
