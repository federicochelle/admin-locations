import { useEffect, useState } from 'react'
import { getLocations } from '../locations/locations.service'
import {
  createReservation,
  deleteReservation,
  getReservations,
  updateReservation,
} from './reservations.service'
import type {
  ReservationCreatePayload,
  ReservationListItem,
  ReservationLocationOption,
  ReservationUpdatePayload,
} from './reservations.types'

type UseReservationsResult = {
  reservations: ReservationListItem[]
  locationOptions: ReservationLocationOption[]
  isLoading: boolean
  isSaving: boolean
  errorMessage: string | null
  actionErrorMessage: string | null
  actionSuccessMessage: string | null
  activeActionKey: string | null
  retry: () => Promise<void>
  create: (payload: ReservationCreatePayload) => Promise<boolean>
  update: (id: string, payload: ReservationUpdatePayload) => Promise<boolean>
  remove: (reservation: ReservationListItem) => Promise<void>
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (!(error instanceof Error)) {
    return fallbackMessage
  }

  if (error.message.includes('OVERLAPPING_RESERVATION')) {
    return 'Ya existe una reserva activa para esa locación en el horario indicado.'
  }

  return error.message
}

function mapLocationOption(location: Awaited<ReturnType<typeof getLocations>>[number]) {
  return {
    id: location.id,
    title: location.title,
    locationCode: location.locationCode,
  }
}

export function useReservations(): UseReservationsResult {
  const [reservations, setReservations] = useState<ReservationListItem[]>([])
  const [locationOptions, setLocationOptions] = useState<ReservationLocationOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null)
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null)

  async function loadReservations() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const [nextReservations, nextLocations] = await Promise.all([
        getReservations(),
        getLocations(),
      ])

      setReservations(nextReservations)
      setLocationOptions(nextLocations.map(mapLocationOption))
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, 'No pudimos cargar las reservas en este momento.'),
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function retry() {
    await loadReservations()
  }

  async function create(payload: ReservationCreatePayload) {
    try {
      setIsSaving(true)
      setActionErrorMessage(null)
      setActionSuccessMessage(null)

      const result = await createReservation(payload)
      await loadReservations()
      setActionSuccessMessage(
        result.syncWarning ?? 'Reserva creada correctamente.',
      )
      return true
    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error, 'No pudimos crear la reserva.'),
      )
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function update(id: string, payload: ReservationUpdatePayload) {
    try {
      setIsSaving(true)
      setActionErrorMessage(null)
      setActionSuccessMessage(null)

      const result = await updateReservation(id, payload)
      await loadReservations()
      setActionSuccessMessage(
        result.syncWarning ?? 'Reserva actualizada correctamente.',
      )
      return true
    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error, 'No pudimos actualizar la reserva.'),
      )
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function remove(reservation: ReservationListItem) {
    try {
      setActiveActionKey(`delete:${reservation.id}`)
      setActionErrorMessage(null)
      setActionSuccessMessage(null)

      await deleteReservation(reservation.id)
      await loadReservations()
      setActionSuccessMessage('Reserva eliminada correctamente.')
    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error, 'No pudimos eliminar la reserva.'),
      )
    } finally {
      setActiveActionKey(null)
    }
  }

  useEffect(() => {
    let isActive = true

    void Promise.all([getReservations(), getLocations()])
      .then(([nextReservations, nextLocations]) => {
        if (!isActive) {
          return
        }

        setReservations(nextReservations)
        setLocationOptions(nextLocations.map(mapLocationOption))
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        setErrorMessage(
          getErrorMessage(error, 'No pudimos cargar las reservas en este momento.'),
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
  }, [])

  return {
    reservations,
    locationOptions,
    isLoading,
    isSaving,
    errorMessage,
    actionErrorMessage,
    actionSuccessMessage,
    activeActionKey,
    retry,
    create,
    update,
    remove,
  }
}
