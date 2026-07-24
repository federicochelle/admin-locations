import type { PropsWithChildren } from 'react'

type PageContainerProps = PropsWithChildren<{
  title: string
  description: string
  hideHeader?: boolean
}>

function PageContainer({
  children,
  description,
  hideHeader = false,
  title,
}: PageContainerProps) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      {!hideHeader ? (
        <header className="space-y-2">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.24em] text-[#B8924A]">
            Panel
          </p>
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-50">
              {title}
            </h1>
            <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
              {description}
            </p>
          </div>
        </header>
      ) : null}
      {children}
    </div>
  )
}

export default PageContainer
