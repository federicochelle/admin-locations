import type {
  LocationImageRecord,
  PendingLocationImageFile,
} from '../location-images.types'

export type LocationImageUploadPlanMode = 'create' | 'edit' | 'view'

export type LocationImageUploadPlanItem = {
  image: PendingLocationImageFile
  isCover: boolean
  sortOrder: number
}

export type LocationImageUploadPlan = {
  invalidPendingImages: PendingLocationImageFile[]
  persistedSortOrderBase: number
  uploads: LocationImageUploadPlanItem[]
}

type BuildLocationImageUploadPlanInput = {
  mode: LocationImageUploadPlanMode
  pendingImages: PendingLocationImageFile[]
  visiblePersistedImages: LocationImageRecord[]
}

function isUploadablePendingImage(image: PendingLocationImageFile) {
  return (
    image.status === 'pending' ||
    (image.status === 'error' && image.width > 0 && image.height > 0)
  )
}

export function buildLocationImageUploadPlan({
  mode,
  pendingImages,
  visiblePersistedImages,
}: BuildLocationImageUploadPlanInput): LocationImageUploadPlan {
  const persistedSortOrderBase =
    mode === 'edit'
      ? visiblePersistedImages.reduce(
          (maxSortOrder, image) => Math.max(maxSortOrder, image.sort_order),
          -1,
        ) + 1
      : 0
  const uploads = [...pendingImages]
    .filter(isUploadablePendingImage)
    .sort((leftImage, rightImage) => leftImage.originalIndex - rightImage.originalIndex)
    .map((image) => ({
      image,
      isCover: image.isCover,
      sortOrder: persistedSortOrderBase + image.originalIndex,
    }))
  const invalidPendingImages = pendingImages.filter(
    (image) =>
      image.status !== 'done' &&
      !uploads.some((upload) => upload.image.id === image.id),
  )

  return {
    invalidPendingImages,
    persistedSortOrderBase,
    uploads,
  }
}
