import type {
  LocationImageRecord,
  PendingLocationImageFile,
} from '../location-images.types'

export type LocationImageStateMode = 'create' | 'edit' | 'view'

export type CombinedEditGalleryImage =
  | {
      kind: 'persisted'
      image: LocationImageRecord
      index: number
    }
  | {
      kind: 'pending'
      image: PendingLocationImageFile
    }

type DeriveLocationImageStateInput = {
  mode: LocationImageStateMode
  pendingDeletedPersistedImageIds: string[]
  pendingImages: PendingLocationImageFile[]
  persistedImages: LocationImageRecord[]
}

export type DerivedLocationImageState = {
  combinedEditGalleryImages: CombinedEditGalleryImage[]
  hasAnalyzablePendingImages: boolean
  hasAnalyzablePersistedImages: boolean
  hasPersistedImagesMode: boolean
  hasProcessingPendingImages: boolean
  pendingCoverImage: PendingLocationImageFile | null
  pendingGalleryImages: PendingLocationImageFile[]
  persistedCoverImage: LocationImageRecord | null
  persistedGalleryImages: LocationImageRecord[]
  visiblePersistedImages: LocationImageRecord[]
}

export function deriveLocationImageState({
  mode,
  pendingDeletedPersistedImageIds,
  pendingImages,
  persistedImages,
}: DeriveLocationImageStateInput): DerivedLocationImageState {
  const hasPersistedImagesMode = mode === 'edit' || mode === 'view'
  const visiblePersistedImages: LocationImageRecord[] =
    hasPersistedImagesMode
      ? persistedImages.filter(
          (image) => !pendingDeletedPersistedImageIds.includes(image.id),
        )
      : []
  const hasAnalyzablePersistedImages =
    mode === 'edit' &&
    visiblePersistedImages.some((image) => image.url.trim().length > 0)
  const hasAnalyzablePendingImages = pendingImages.some(
    (image) => image.status === 'pending' && image.width > 0 && image.height > 0,
  )
  const persistedCoverImage: LocationImageRecord | null =
    hasPersistedImagesMode
      ? visiblePersistedImages.find((image) => image.is_cover === true) ?? null
      : null
  const persistedGalleryImages: LocationImageRecord[] =
    hasPersistedImagesMode
      ? persistedCoverImage
        ? visiblePersistedImages.filter((image) => image.id !== persistedCoverImage.id)
        : visiblePersistedImages
      : []
  const pendingCoverImage = pendingImages.find((image) => image.isCover) ?? null
  const pendingGalleryImages = pendingImages.filter((image) => !image.isCover)
  const hasProcessingPendingImages = pendingImages.some(
    (image) => image.status === 'processing',
  )
  const combinedEditGalleryImages: CombinedEditGalleryImage[] = [
    ...persistedGalleryImages.map((image, index) => ({
      kind: 'persisted' as const,
      image,
      index,
    })),
    ...pendingGalleryImages.map((image) => ({
      kind: 'pending' as const,
      image,
    })),
  ]

  return {
    combinedEditGalleryImages,
    hasAnalyzablePendingImages,
    hasAnalyzablePersistedImages,
    hasPersistedImagesMode,
    hasProcessingPendingImages,
    pendingCoverImage,
    pendingGalleryImages,
    persistedCoverImage,
    persistedGalleryImages,
    visiblePersistedImages,
  }
}
