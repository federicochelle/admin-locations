/* eslint-disable react-refresh/only-export-components */
import {
  useCallback,
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { PageBreadcrumbItem } from '../../components/ui/PageBreadcrumb'

export type LayoutHeaderConfig = {
  actions?: ReactNode
  breadcrumbItems?: PageBreadcrumbItem[]
  content?: ReactNode
  description?: string
  title: string
}

type LayoutHeaderContextValue = {
  clearHeader: () => void
  header: LayoutHeaderConfig | null
  setHeader: (nextHeader: LayoutHeaderConfig | null) => void
}

const LayoutHeaderContext = createContext<LayoutHeaderContextValue | null>(null)

export function LayoutHeaderProvider({
  children,
}: {
  children: ReactNode
}) {
  const [header, setHeader] = useState<LayoutHeaderConfig | null>(null)
  const clearHeader = useCallback(() => {
    setHeader(null)
  }, [])

  const value = useMemo<LayoutHeaderContextValue>(
    () => ({
      clearHeader,
      header,
      setHeader,
    }),
    [clearHeader, header],
  )

  return (
    <LayoutHeaderContext.Provider value={value}>
      {children}
    </LayoutHeaderContext.Provider>
  )
}

export function useLayoutHeaderContext() {
  const context = useContext(LayoutHeaderContext)

  if (!context) {
    throw new Error(
      'useLayoutHeaderContext debe usarse dentro de LayoutHeaderProvider.',
    )
  }

  return context
}
