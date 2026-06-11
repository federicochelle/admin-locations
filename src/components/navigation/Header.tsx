import { useNavigate } from 'react-router-dom'
import { useLayoutHeaderContext } from '../../app/layouts/LayoutHeaderContext'
import Button from '../ui/Button'
import PageHeader from '../ui/PageHeader'
import { routePaths } from '../../app/router/route-paths'
import { signOut } from '../../features/auth/auth.service'

function Header() {
  const navigate = useNavigate()
  const { header } = useLayoutHeaderContext()

  async function handleSignOut() {
    try {
      await signOut()
    } finally {
      navigate(routePaths.login)
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="px-6 py-3 sm:px-8 sm:py-3.5">
        {header ? (
          <PageHeader
            breadcrumbItems={header.breadcrumbItems}
            content={header.content}
            utilityAction={
              <Button variant="secondary" onClick={() => void handleSignOut()}>
                Cerrar sesión
              </Button>
            }
          />
        ) : (
          <div className="flex min-h-20 items-center justify-end">
            <Button variant="secondary" onClick={() => void handleSignOut()}>
              Cerrar sesión
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
