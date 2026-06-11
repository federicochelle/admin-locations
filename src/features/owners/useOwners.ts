import { useEffect, useState } from 'react'
import {
  archiveOwner,
  deleteOwner,
  getOwners,
} from './owners.service'
import type { OwnerListItem } from './owners.types'

type UseOwnersResult = {
  owners: OwnerListItem[]
  isLoading: boolean
  errorMessage: string | null
  actionErrorMessage: string | null
  activeActionKey: string | null
  loadOwners: () => Promise<void>
  retry: () => Promise<void>
  archive: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'No pudimos cargar los dueños en este momento.'
}

export function useOwners(): UseOwnersResult {
  const [owners, setOwners] = useState<OwnerListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null)

  async function loadOwners() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextOwners = await getOwners()
      setOwners(nextOwners)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function retry() {
    await loadOwners()
  }

  async function runOwnerAction(
    actionKey: string,
    action: () => Promise<string>,
  ) {
    try {
      setActiveActionKey(actionKey)
      setActionErrorMessage(null)

      await action()
      await loadOwners()
    } catch (error) {
      setActionErrorMessage(getErrorMessage(error))
    } finally {
      setActiveActionKey(null)
    }
  }

  async function archive(id: string) {
    await runOwnerAction(`archive:${id}`, () => archiveOwner(id))
  }

  async function remove(id: string) {
    await runOwnerAction(`delete:${id}`, () => deleteOwner(id))
  }

  useEffect(() => {
    let isActive = true

    void getOwners()
      .then((nextOwners) => {
        if (!isActive) {
          return
        }

        setOwners(nextOwners)
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
    owners,
    isLoading,
    errorMessage,
    actionErrorMessage,
    activeActionKey,
    loadOwners,
    retry,
    archive,
    remove,
  }
}
