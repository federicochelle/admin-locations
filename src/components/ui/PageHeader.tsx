import type { ReactNode } from 'react'
import PageBreadcrumb, { type PageBreadcrumbItem } from './PageBreadcrumb'

type PageHeaderProps = {
  breadcrumbItems?: PageBreadcrumbItem[]
  content?: ReactNode
  utilityAction?: ReactNode
}

function PageHeader({
  breadcrumbItems,
  content,
  utilityAction,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {breadcrumbItems && breadcrumbItems.length > 0 ? (
            <div className="hidden sm:block">
              <PageBreadcrumb items={breadcrumbItems} />
            </div>
          ) : null}
        </div>

        {utilityAction ? (
          <div className="flex flex-wrap items-center gap-3">{utilityAction}</div>
        ) : null}
      </div>

      {content ? (
        <div className="min-w-0">{content}</div>
      ) : null}
    </header>
  )
}

export default PageHeader
