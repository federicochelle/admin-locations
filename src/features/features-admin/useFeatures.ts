import { useEffect, useState } from 'react'
import {
  archiveFeature,
  deleteFeature,
  getFeatures,
} from './features.service'
import type { FeatureListItem } from './features.types'

type UseFeaturesResult = {
  features: FeatureListItem[]
  isLoading: boolean
  errorMessage: string | null
  actionErrorMessage: string | null
  activeActionKey: string | null
  loadFeatures: () => Promise<void>
  retry: () => Promise<void>
  archive: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'No pudimos cargar las features en este momento.'
}

export function useFeatures(): UseFeaturesResult {
  const [features, setFeatures] = useState<FeatureListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null)

  async function loadFeatures() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextFeatures = await getFeatures()
      setFeatures(nextFeatures)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function retry() {
    await loadFeatures()
  }

  async function runFeatureAction(
    actionKey: string,
    action: () => Promise<string>,
  ) {
    try {
      setActiveActionKey(actionKey)
      setActionErrorMessage(null)

      await action()
      await loadFeatures()
    } catch (error) {
      setActionErrorMessage(getErrorMessage(error))
    } finally {
      setActiveActionKey(null)
    }
  }

  async function archive(id: string) {
    await runFeatureAction(`archive:${id}`, () => archiveFeature(id))
  }

  async function remove(id: string) {
    await runFeatureAction(`delete:${id}`, () => deleteFeature(id))
  }

  useEffect(() => {
    let isActive = true

    void getFeatures()
      .then((nextFeatures) => {
        if (!isActive) {
          return
        }

        setFeatures(nextFeatures)
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
    features,
    isLoading,
    errorMessage,
    actionErrorMessage,
    activeActionKey,
    loadFeatures,
    retry,
    archive,
    remove,
  }
}
