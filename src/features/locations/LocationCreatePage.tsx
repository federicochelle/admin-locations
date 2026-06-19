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
      <Card className="border-0 bg-[radial-gradient(circle_at_top_left,_rgba(184,146,74,0.10),_transparent_24%),linear-gradient(180deg,_#111111_0%,_#151515_52%,_#1a1a1a_100%)] p-6 shadow-none backdrop-blur-0">
        <LocationForm />
      </Card>
    </PageContainer>
  )
}

export default LocationCreatePage
