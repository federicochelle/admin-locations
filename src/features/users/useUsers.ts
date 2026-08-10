import { useEffect, useState } from 'react'
import { getUsers } from './users.service'
import type { UserListItem } from './users.types'

type UseUsersResult = {
  users: UserListItem[]
  isLoading: boolean
  errorMessage: string | null
  loadUsers: () => Promise<void>
  retry: () => Promise<void>
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'No pudimos cargar los usuarios en este momento.'
}

export function useUsers(): UseUsersResult {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function loadUsers() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextUsers = await getUsers()
      setUsers(nextUsers)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function retry() {
    await loadUsers()
  }

  useEffect(() => {
    let isActive = true

    void getUsers()
      .then((nextUsers) => {
        if (!isActive) {
          return
        }

        setUsers(nextUsers)
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
    users,
    isLoading,
    errorMessage,
    loadUsers,
    retry,
  }
}
