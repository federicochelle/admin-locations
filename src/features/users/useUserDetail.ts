import { useEffect, useState } from 'react'
import { getUserByProfileId } from './users.service'
import type { UserDetail } from './users.types'

type UseUserDetailResult = {
  user: UserDetail | null
  isLoading: boolean
  errorMessage: string | null
  reload: () => Promise<void>
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'No pudimos cargar el usuario.'
}

export function useUserDetail(profileId: string | null | undefined): UseUserDetailResult {
  const [user, setUser] = useState<UserDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function loadUser() {
    if (!profileId) {
      setUser(null)
      setErrorMessage('USER_NOT_FOUND')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextUser = await getUserByProfileId(profileId)
      setUser(nextUser)
    } catch (error) {
      setUser(null)
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    if (!profileId) {
      setUser(null)
      setErrorMessage('USER_NOT_FOUND')
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    void getUserByProfileId(profileId)
      .then((nextUser) => {
        if (!isActive) {
          return
        }

        setUser(nextUser)
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        setUser(null)
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
  }, [profileId])

  return {
    user,
    isLoading,
    errorMessage,
    reload: loadUser,
  }
}
