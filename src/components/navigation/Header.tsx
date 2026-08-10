import { useLayoutHeaderContext } from '../../app/layouts/LayoutHeaderContext'
import PageHeader from '../ui/PageHeader'

function Header() {
  const { header } = useLayoutHeaderContext()

  return (
    <header className="hidden border-b border-slate-200 bg-white/95 backdrop-blur md:block">
      <div className="px-6 py-3 sm:px-8 sm:py-3.5">
        {header ? (
          <PageHeader
            breadcrumbItems={header.breadcrumbItems}
            content={header.content}
          />
        ) : (
          <div className="min-h-20" />
        )}
      </div>
    </header>
  )
}

export default Header
