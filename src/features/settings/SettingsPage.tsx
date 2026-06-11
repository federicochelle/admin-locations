import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'

function SettingsPage() {
  return (
    <PageContainer
      title="Configuración"
      description="Área reservada para parámetros generales del panel y catálogos secundarios que necesiten administración."
    >
      <Card>
        <h2 className="text-lg font-semibold text-slate-950">
          Configuración general
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Acá podremos ubicar más adelante ajustes operativos, taxonomías y
          configuraciones complementarias del sistema.
        </p>
      </Card>
    </PageContainer>
  )
}

export default SettingsPage
