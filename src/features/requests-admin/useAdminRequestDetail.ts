import { useEffect, useState } from 'react'
import { deleteReservation } from '../reservations/reservations.service'
import {
  deleteAdminLocationRequest,
  getActiveAdminLocationRequestReservations,
  getAdminLocationRequestById,
  setAdminLocationRequestActiveVersion,
  updateAdminLocationRequestStatus,
} from './admin-location-requests.service'
import { usePendingNavCounts } from '../../app/layouts/PendingNavCountsContext'
import type {
  AdminLocationRequestDetail,
  LocationRequestStatus,
} from './admin-location-requests.types'

type UseAdminRequestDetailResult = {
  request: AdminLocationRequestDetail | null
  isLoading: boolean
  isSaving: boolean
  isSwitchingVersion: boolean
  isDeleting: boolean
  errorMessage: string | null
  saveErrorMessage: string | null
  versionErrorMessage: string | null
  deleteErrorMessage: string | null
  reload: () => Promise<void>
  save: (status: LocationRequestStatus) => Promise<boolean>
  selectVersion: (requestProjectVersionId: string) => Promise<void>
  getDeleteImpact: () => Promise<number>
  remove: () => Promise<boolean>
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
  const { refreshCounts } = usePendingNavCounts()
  const [request, setRequest] = useState<AdminLocationRequestDetail | null>(null)
  const [isLoading, setIsLoading] = useState(enabled && Boolean(requestId))
  const [isSaving, setIsSaving] = useState(false)
  const [isSwitchingVersion, setIsSwitchingVersion] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const [versionErrorMessage, setVersionErrorMessage] = useState<string | null>(null)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null)

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
      setVersionErrorMessage(null)
      setDeleteErrorMessage(null)

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

  async function getDeleteImpact() {
    if (!request) {
      return 0
    }

    const impact = await getActiveAdminLocationRequestReservations(request.id)

    return impact.count
  }

  async function save(status: LocationRequestStatus) {
    if (!request) {
      return false
    }

    try {
      setIsSaving(true)
      setSaveErrorMessage(null)
      setVersionErrorMessage(null)
      setDeleteErrorMessage(null)

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
      await refreshCounts()
      return true
    } catch (error) {
      setSaveErrorMessage(
        getErrorMessage(error, 'No pudimos guardar los cambios de la solicitud.'),
      )
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function remove() {
    if (!request) {
      return false
    }

    try {
      setIsDeleting(true)
      setDeleteErrorMessage(null)
      setSaveErrorMessage(null)
      setVersionErrorMessage(null)

      const associatedReservations = await getActiveAdminLocationRequestReservations(request.id)

      for (const reservationId of associatedReservations.reservationIds) {
        await deleteReservation(reservationId)
      }

      await deleteAdminLocationRequest(request.id)
      await refreshCounts()

      return true
    } catch (error) {
      setDeleteErrorMessage(
        getErrorMessage(error, 'No pudimos eliminar la solicitud.'),
      )

      return false
    } finally {
      setIsDeleting(false)
    }
  }

  async function selectVersion(requestProjectVersionId: string) {
    if (!request) {
      return
    }

    try {
      setIsSwitchingVersion(true)
      setVersionErrorMessage(null)
      setSaveErrorMessage(null)
      setDeleteErrorMessage(null)

      await setAdminLocationRequestActiveVersion({
        requestId: request.id,
        requestProjectVersionId,
      })
      await loadRequest()
    } catch (error) {
      setVersionErrorMessage(
        getErrorMessage(error, 'No pudimos cambiar la versión activa de la solicitud.'),
      )
    } finally {
      setIsSwitchingVersion(false)
    }
  }

  useEffect(() => {
    let isActive = true

    if (!enabled || !requestId) {
      setRequest(null)
      setErrorMessage(null)
      setIsLoading(false)

      return () => {
        isActive = false
      }
    }

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
    isSwitchingVersion,
    isDeleting,
    errorMessage: enabled && requestId ? errorMessage : null,
    saveErrorMessage,
    versionErrorMessage,
    deleteErrorMessage,
    reload,
    save,
    selectVersion,
    getDeleteImpact,
    remove,
  }
}
