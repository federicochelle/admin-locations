import { useEffect } from 'react'
import {
  useLayoutHeaderContext,
  type LayoutHeaderConfig,
} from './LayoutHeaderContext'

export function useLayoutHeader(header: LayoutHeaderConfig | null) {
  const { clearHeader, setHeader } = useLayoutHeaderContext()

  useEffect(() => {
    setHeader(header)

    return () => {
      clearHeader()
    }
  }, [clearHeader, header, setHeader])
}
