import { useEffect, useState } from 'react'
import {
  archiveLocation,
  deleteLocation,
  getLocations,
  publishLocation,
} from './locations.service'
import type { LocationListItem } from './locations.types'

type UseLocationsResult = {
  locations: LocationListItem[]
  isLoading: boolean
  errorMessage: string | null
  actionErrorMessage: string | null
  activeActionKey: string | null
  loadLocations: () => Promise<void>
  retry: () => Promise<void>
  archive: (id: string) => Promise<void>
  publish: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'No pudimos cargar las locaciones en este momento.'
}

export function useLocations(): UseLocationsResult {
  const [locations, setLocations] = useState<LocationListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null)

  async function loadLocations() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextLocations = await getLocations()
      setLocations(nextLocations)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function retry() {
    await loadLocations()
  }

  async function runLocationAction(
    actionKey: string,
    action: () => Promise<string>,
  ) {
    try {
      setActiveActionKey(actionKey)
      setActionErrorMessage(null)

      await action()
      await loadLocations()
    } catch (error) {
      setActionErrorMessage(getErrorMessage(error))
    } finally {
      setActiveActionKey(null)
    }
  }

  async function archive(id: string) {
    await runLocationAction(`archive:${id}`, () => archiveLocation(id))
  }

  async function publish(id: string) {
    await runLocationAction(`publish:${id}`, () => publishLocation(id))
  }

  async function remove(id: string) {
    await runLocationAction(`delete:${id}`, () => deleteLocation(id))
  }

  useEffect(() => {
    let isActive = true

    void getLocations()
      .then((nextLocations) => {
        if (!isActive) {
          return
        }

        setLocations(nextLocations)
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
    locations,
    isLoading,
    errorMessage,
    actionErrorMessage,
    activeActionKey,
    loadLocations,
    retry,
    archive,
    publish,
    remove,
  }
}
