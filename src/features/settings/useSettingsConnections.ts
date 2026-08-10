import { useEffect, useState } from 'react'
import { getSettingsConnections } from './settings.service'
import type { SettingsConnectionItem } from './settings.types'

type UseSettingsConnectionsResult = {
  connections: SettingsConnectionItem[]
  isLoading: boolean
  errorMessage: string | null
  loadConnections: () => Promise<void>
  retry: () => Promise<void>
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'No pudimos cargar el estado de las conexiones en este momento.'
}

export function useSettingsConnections(): UseSettingsConnectionsResult {
  const [connections, setConnections] = useState<SettingsConnectionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function loadConnections() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextConnections = await getSettingsConnections()
      setConnections(nextConnections)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function retry() {
    await loadConnections()
  }

  useEffect(() => {
    let isActive = true

    void getSettingsConnections()
      .then((nextConnections) => {
        if (!isActive) {
          return
        }

        setConnections(nextConnections)
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        setErrorMessage(getErrorMessage(error))
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  return {
    connections,
    isLoading,
    errorMessage,
    loadConnections,
    retry,
  }
}
