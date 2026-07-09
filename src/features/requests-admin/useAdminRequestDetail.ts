import { useEffect, useState } from 'react'
import {
  getAdminLocationRequestById,
  updateAdminLocationRequestStatus,
} from './admin-location-requests.service'
import type {
  AdminLocationRequestDetail,
  LocationRequestStatus,
} from './admin-location-requests.types'

type UseAdminRequestDetailResult = {
  request: AdminLocationRequestDetail | null
  isLoading: boolean
  isSaving: boolean
  errorMessage: string | null
  saveErrorMessage: string | null
  saveSuccessMessage: string | null
  reload: () => Promise<void>
  save: (status: LocationRequestStatus) => Promise<void>
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error.message
  }

  return fallbackMessage
}

export function useAdminRequestDetail(
  requestId: string | null | undefined,
  enabled = true,
): UseAdminRequestDetailResult {
  const [request, setRequest] = useState<AdminLocationRequestDetail | null>(null)
  const [isLoading, setIsLoading] = useState(enabled && Boolean(requestId))
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)

  async function loadRequest() {
    if (!enabled || !requestId) {
      setRequest(null)
      setErrorMessage(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextRequest = await getAdminLocationRequestById(requestId)
      setRequest(nextRequest)
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message === 'REQUEST_NOT_FOUND'
          ? 'REQUEST_NOT_FOUND'
          : getErrorMessage(error, 'No pudimos cargar la solicitud.'),
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function reload() {
    await loadRequest()
  }

  async function save(status: LocationRequestStatus) {
    if (!request) {
      return
    }

    try {
      setIsSaving(true)
      setSaveErrorMessage(null)
      setSaveSuccessMessage(null)

      await updateAdminLocationRequestStatus(request.id, status)

      setRequest((currentRequest) =>
        currentRequest
          ? {
              ...currentRequest,
              status,
              updatedAt: new Date().toISOString(),
            }
          : currentRequest,
      )
      setSaveSuccessMessage('Solicitud actualizada correctamente.')
    } catch (error) {
      setSaveErrorMessage(
        getErrorMessage(error, 'No pudimos guardar los cambios de la solicitud.'),
      )
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (!enabled || !requestId) {
      return
    }

    let isActive = true

    void getAdminLocationRequestById(requestId)
      .then((nextRequest) => {
        if (!isActive) {
          return
        }

        setRequest(nextRequest)
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        setErrorMessage(
          error instanceof Error && error.message === 'REQUEST_NOT_FOUND'
            ? 'REQUEST_NOT_FOUND'
            : getErrorMessage(error, 'No pudimos cargar la solicitud.'),
        )
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
  }, [enabled, requestId])

  return {
    request: enabled && requestId ? request : null,
    isLoading,
    isSaving,
    errorMessage: enabled && requestId ? errorMessage : null,
    saveErrorMessage,
    saveSuccessMessage,
    reload,
    save,
  }
}
