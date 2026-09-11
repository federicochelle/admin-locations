import { useEffect, useState } from 'react'
import { reportAdminError } from '../../../lib/admin-error-reporting'
import { getLocationFormOptions } from '../locations.service'
import type { LocationFormOptions } from '../locations.types'

export function useLocationFormOptions() {
  const [options, setOptions] = useState<LocationFormOptions | null>(null)
  const [isOptionsLoading, setIsOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)

  async function loadFormOptions() {
    try {
      setIsOptionsLoading(true)
      setOptionsError(null)

      const nextOptions = await getLocationFormOptions()
      setOptions(nextOptions)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos cargar las opciones del formulario.'

      reportAdminError(error, { operation: 'location.options', stage: 'options', provider: 'supabase', userFacing: true })
      setOptionsError(message)
    } finally {
      setIsOptionsLoading(false)
    }
  }

  async function refreshOptions() {
    const nextOptions = await getLocationFormOptions()
    setOptions(nextOptions)

    return nextOptions
  }

  useEffect(() => {
    let isActive = true

    void getLocationFormOptions()
      .then((nextOptions) => {
        if (!isActive) {
          return
        }

        setOptions(nextOptions)
        setOptionsError(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos cargar las opciones del formulario.'

        reportAdminError(error, { operation: 'location.options', stage: 'options', provider: 'supabase', userFacing: true })
        setOptionsError(message)
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsOptionsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  return {
    isOptionsLoading,
    loadFormOptions,
    options,
    optionsError,
    refreshOptions,
  }
}
