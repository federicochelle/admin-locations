import type { PropsWithChildren } from 'react'

type EmptyStateProps = PropsWithChildren<{
  title: string
  description: string
}>

function EmptyState({ children, description, title }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
          {description}
        </p>
        {children ? <div className="mt-6 flex justify-center">{children}</div> : null}
      </div>
    </div>
  )
}

export default EmptyState
