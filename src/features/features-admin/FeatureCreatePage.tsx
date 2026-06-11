import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import FeatureForm from './FeatureForm'

function FeatureCreatePage() {
  return (
    <PageContainer
      title="Nueva feature"
      description="Creá una feature base para estructurar amenities, atributos y características reutilizables."
    >
      <Card>
        <FeatureForm />
      </Card>
    </PageContainer>
  )
}

export default FeatureCreatePage
