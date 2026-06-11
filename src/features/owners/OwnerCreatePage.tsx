import { useMemo } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import OwnerForm from './OwnerForm'

function OwnerCreatePage() {
  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Listado de dueños', to: routePaths.owners },
        { label: 'Nuevo dueño' },
      ],
      title: 'Nuevo dueño',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  return (
    <PageContainer title="Nuevo dueño" description="" hideHeader>
      <Card>
        <OwnerForm />
      </Card>
    </PageContainer>
  )
}

export default OwnerCreatePage
