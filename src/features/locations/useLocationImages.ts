import { reportAdminError, type AdminErrorContext } from '../../lib/admin-error-reporting'
import { useEffect, useRef, useState } from 'react'
import { getLocationImages } from './location-images.service'
import type { LocationImageRecord } from './location-images.types'

type UseLocationImagesResult = {
  hasRefreshError: () => boolean
  images: LocationImageRecord[]
  isLoading: boolean
  errorMessage: string | null
  loadImages: (observation?: Partial<AdminErrorContext>) => Promise<void>
  refresh: (observation?: Partial<AdminErrorContext>) => Promise<void>
}

export function useLocationImages(
  locationId: string | null | undefined,
): UseLocationImagesResult {
  const refreshFailed = useRef(false)
  const [images, setImages] = useState<LocationImageRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function loadImages(observation?: Partial<AdminErrorContext>) {
    refreshFailed.current = false
    if (!locationId) {
      setImages([])
      setErrorMessage(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextImages = await getLocationImages(locationId)
      setImages(nextImages)
    } catch (error) {
      refreshFailed.current = true
      reportAdminError(error, { operation: 'location.image.load', resourceType: 'image', stage: 'images.refresh', provider: 'supabase', resourceId: locationId, userFacing: true, ...observation })
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos cargar las imágenes de la locación.'

      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!locationId) {
      return
    }

    let isActive = true

    void Promise.resolve().then(async () => {
      if (!isActive) {
        return
      }

      try {
        setIsLoading(true)
        setErrorMessage(null)

        const nextImages = await getLocationImages(locationId)

        if (!isActive) {
          return
        }

        setImages(nextImages)
      } catch (error) {
        if (!isActive) {
          return
        }

        reportAdminError(error, { operation: 'location.image.load', resourceType: 'image', stage: 'images.refresh', provider: 'supabase', resourceId: locationId, userFacing: true })
        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos cargar las imágenes de la locación.'

        setErrorMessage(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    })

    return () => {
      isActive = false
    }
  }, [locationId])

  return {
    hasRefreshError: () => refreshFailed.current,
    images,
    isLoading,
    errorMessage,
    loadImages,
    refresh: loadImages,
  }
}
