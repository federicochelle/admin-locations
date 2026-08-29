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
  activeActionKey: string | null
  retry: () => Promise<void>
  create: (payload: ReservationCreatePayload) => Promise<{ syncWarning: string | null }>
  update: (id: string, payload: ReservationUpdatePayload) => Promise<{ syncWarning: string | null }>
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

function compareLocationOptions(
  leftOption: ReservationLocationOption,
  rightOption: ReservationLocationOption,
) {
  const leftCode = leftOption.locationCode?.trim() || ''
  const rightCode = rightOption.locationCode?.trim() || ''

  if (leftCode && rightCode) {
    const codeComparison = leftCode.localeCompare(rightCode, 'es-UY', {
      numeric: true,
      sensitivity: 'base',
    })

    if (codeComparison !== 0) {
      return codeComparison
    }
  }

  if (leftCode && !rightCode) {
    return -1
  }

  if (!leftCode && rightCode) {
    return 1
  }

  return leftOption.title.localeCompare(rightOption.title, 'es-UY', {
    sensitivity: 'base',
  })
}

export function useReservations(): UseReservationsResult {
  const [reservations, setReservations] = useState<ReservationListItem[]>([])
  const [locationOptions, setLocationOptions] = useState<ReservationLocationOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
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
      setLocationOptions(nextLocations.map(mapLocationOption).sort(compareLocationOptions))
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

      const result = await createReservation(payload)
      await loadReservations()
      return {
        syncWarning: result.syncWarning ?? null,
      }
    } catch (error) {
      throw new Error(
        getErrorMessage(error, 'No pudimos crear la reserva.'),
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function update(id: string, payload: ReservationUpdatePayload) {
    try {
      setIsSaving(true)

      const result = await updateReservation(id, payload)
      await loadReservations()
      return {
        syncWarning: result.syncWarning ?? null,
      }
    } catch (error) {
      throw new Error(
        getErrorMessage(error, 'No pudimos actualizar la reserva.'),
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function remove(reservation: ReservationListItem) {
    try {
      setActiveActionKey(`delete:${reservation.id}`)

      await deleteReservation(reservation.id)
      await loadReservations()
    } catch (error) {
      await loadReservations()
      throw new Error(
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
        setLocationOptions(nextLocations.map(mapLocationOption).sort(compareLocationOptions))
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
    activeActionKey,
    retry,
    create,
    update,
    remove,
  }
}
