import { Link } from 'react-router-dom'

export type PageBreadcrumbItem = {
  label: string
  to?: string
  onClick?: () => void
}

type PageBreadcrumbProps = {
  items: PageBreadcrumbItem[]
}

function PageBreadcrumb({ items }: PageBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-lg text-slate-700 sm:text-xl">
        {items.map((item, index) => {
          const isLastItem = index === items.length - 1

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.to ? (
                <Link
                  to={item.to}
                  onClick={item.onClick}
                  className="font-semibold text-slate-600 underline-offset-4 transition hover:text-slate-900 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={
                    isLastItem
                      ? 'font-semibold text-slate-950'
                      : 'font-semibold text-slate-700'
                  }
                >
                  {item.label}
                </span>
              )}

              {!isLastItem ? (
                <span
                  aria-hidden="true"
                  className="text-lg font-semibold text-slate-300 sm:text-xl"
                >
                  &gt;
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default PageBreadcrumb
