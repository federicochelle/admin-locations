import { useEffect, useState } from 'react'
import { getLocationImages } from './location-images.service'
import type { LocationImageRecord } from './location-images.types'

type UseLocationImagesResult = {
  images: LocationImageRecord[]
  isLoading: boolean
  errorMessage: string | null
  loadImages: () => Promise<void>
  refresh: () => Promise<void>
}

export function useLocationImages(
  locationId: string | null | undefined,
): UseLocationImagesResult {
  const [images, setImages] = useState<LocationImageRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function loadImages() {
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
    images,
    isLoading,
    errorMessage,
    loadImages,
    refresh: loadImages,
  }
}
