import { APIProvider } from '@vis.gl/react-google-maps'
import type { ReactNode } from 'react'

const GOOGLE_MAPS_LIBRARIES = ['places']

export function LocationGoogleProvider({
  apiKey,
  children,
}: {
  apiKey: string | null
  children: ReactNode
}) {
  if (!apiKey) {
    return <>{children}</>
  }

  return (
    <APIProvider apiKey={apiKey} libraries={GOOGLE_MAPS_LIBRARIES}>
      {children}
    </APIProvider>
  )
}

export function SectionCard({
  actions,
  children,
  description,
  title,
}: {
  actions?: ReactNode
  children: ReactNode
  description?: string
  title?: string
}) {
  return (
    <section className="-mx-9 w-[calc(100%+4.5rem)] space-y-5 rounded-none border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur-sm sm:-mx-6 sm:w-[calc(100%+3rem)] sm:rounded-[28px] sm:p-6 lg:p-7">
      {title || description || actions ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {title || description ? (
            <div className="space-y-1">
              {title ? (
                <h3 className="text-2xl font-semibold text-slate-950">{title}</h3>
              ) : null}
              {description ? (
                <p className="text-sm leading-6 text-slate-600">{description}</p>
              ) : null}
            </div>
          ) : (
            <div />
          )}
          {actions ? <div className="shrink-0 sm:ml-auto">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
