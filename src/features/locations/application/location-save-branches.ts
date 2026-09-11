import {
  suppressAdminErrorReport,
  type AdminErrorContext,
} from '../../../lib/admin-error-reporting'
import type {
  LocationCreatePayload,
  LocationUpdatePayload,
} from '../locations.types'
import type { PendingLocationImageFile } from '../location-images.types'
import type {
  LocationSaveProgressState,
  LocationSaveStageKey,
  LocationSaveStageStatus,
} from '../LocationSaveProgressModal'

type LocationSaveProtection = {
  markSaved: () => void
}

type CreatedLocationIdRef = {
  current: string | null
}

type RunLocationImageDeletes = (
  locationId: string,
  observation: AdminErrorContext,
) => Promise<void>

type RunLocationImageUploads = (
  locationId: string,
  observation: AdminErrorContext,
) => Promise<string | null>

type SyncVisibleGallery = (observation: AdminErrorContext) => Promise<void>

type SetPendingImages = (
  updater: (
    currentImages: PendingLocationImageFile[],
  ) => PendingLocationImageFile[],
) => void

type UpdateLocation = (
  locationId: string,
  payload: LocationUpdatePayload,
  options?: {
    actorProfileId?: string | null
    correlationId?: string
  },
) => Promise<string>

type CreateLocation = (
  payload: LocationCreatePayload,
  options?: {
    actorProfileId?: string | null
    correlationId?: string
    onLocationCreated?: (locationId: string) => void
  },
) => Promise<string>

type RunEditLocationSaveInput = {
  actorProfileId: string | null
  locationId: string | undefined
  markSaveProgressSuccess: () => void
  navigateToLocations: () => void
  observation: AdminErrorContext
  onEditSuccess?: () => Promise<void>
  payload: LocationUpdatePayload
  protection: LocationSaveProtection
  revokePreviewUrl: (previewUrl: string) => void
  runPendingImageDeletes: RunLocationImageDeletes
  runPendingImageUploads: RunLocationImageUploads
  setPendingDeletedPersistedImageIds: (imageIds: string[]) => void
  setPendingImages: SetPendingImages
  setSaveProgress: (progress: LocationSaveProgressState | null) => void
  syncVisibleGallery: SyncVisibleGallery
  updateLocation: UpdateLocation
  updateLocationWriteObservation: (input: {
    locationId: string
    mode: 'edit'
  }) => Pick<AdminErrorContext, 'extraSafeContext' | 'outcome' | 'resourceId'>
  updateStageStatus: (
    key: LocationSaveStageKey,
    status: LocationSaveStageStatus,
  ) => void
  waitForSuccess: () => Promise<void>
}

type RunCreateLocationSaveInput = {
  actorProfileId: string | null
  createLocation: CreateLocation
  createdLocationIdRef: CreatedLocationIdRef
  markSaveProgressSuccess: () => void
  navigateToLocations: () => void
  observation: AdminErrorContext
  onCreateSuccess?: () => Promise<void>
  payload: LocationCreatePayload
  protection: LocationSaveProtection
  revokePreviewUrl: (previewUrl: string) => void
  runPendingImageDeletes: RunLocationImageDeletes
  runPendingImageUploads: RunLocationImageUploads
  setPendingDeletedPersistedImageIds: (imageIds: string[]) => void
  setPendingImages: SetPendingImages
  setSaveProgress: (progress: LocationSaveProgressState | null) => void
  syncVisibleGallery: SyncVisibleGallery
  updateLocation: UpdateLocation
  updateLocationWriteObservation: (input: {
    locationId: string
    mode: 'create'
  }) => Pick<AdminErrorContext, 'extraSafeContext' | 'outcome' | 'resourceId'>
  updateStageStatus: (
    key: LocationSaveStageKey,
    status: LocationSaveStageStatus,
  ) => void
  waitForSuccess: () => Promise<void>
}

export async function runEditLocationSave({
  actorProfileId,
  locationId,
  markSaveProgressSuccess,
  navigateToLocations,
  observation,
  onEditSuccess,
  payload,
  protection,
  revokePreviewUrl,
  runPendingImageDeletes,
  runPendingImageUploads,
  setPendingDeletedPersistedImageIds,
  setPendingImages,
  setSaveProgress,
  syncVisibleGallery,
  updateLocation,
  updateLocationWriteObservation,
  updateStageStatus,
  waitForSuccess,
}: RunEditLocationSaveInput) {
  if (!locationId) {
    throw new Error('Falta el identificador de la locación a editar.')
  }

  await updateLocation(locationId, payload, {
    actorProfileId,
    correlationId: observation.correlationId,
  })
  Object.assign(observation, updateLocationWriteObservation({ locationId, mode: 'edit' }))
  updateStageStatus('location', 'done')

  await runPendingImageDeletes(locationId, observation)
  setPendingDeletedPersistedImageIds([])
  const uploadErrorMessage = await runPendingImageUploads(locationId, observation)
  await syncVisibleGallery(observation)

  setPendingImages((currentImages) => {
    currentImages.forEach((image) => {
      if (image.status === 'done') {
        revokePreviewUrl(image.previewUrl)
      }
    })

    return currentImages.filter((image) => image.status !== 'done')
  })

  if (uploadErrorMessage) {
    throw suppressAdminErrorReport(new Error(uploadErrorMessage))
  }

  protection.markSaved()
  updateStageStatus('completed', 'done')
  markSaveProgressSuccess()
  await waitForSuccess()
  setSaveProgress(null)
  if (onEditSuccess) {
    await onEditSuccess()
    return
  }

  navigateToLocations()
}

export async function runCreateLocationSave({
  actorProfileId,
  createLocation,
  createdLocationIdRef,
  markSaveProgressSuccess,
  navigateToLocations,
  observation,
  onCreateSuccess,
  payload,
  protection,
  revokePreviewUrl,
  runPendingImageDeletes,
  runPendingImageUploads,
  setPendingDeletedPersistedImageIds,
  setPendingImages,
  setSaveProgress,
  syncVisibleGallery,
  updateLocation,
  updateLocationWriteObservation,
  updateStageStatus,
  waitForSuccess,
}: RunCreateLocationSaveInput) {
  // Retain a partially created location so retries do not create duplicates.
  const existingCreatedLocationId = createdLocationIdRef.current
  const createdLocationId = existingCreatedLocationId ?? await createLocation(payload, {
    actorProfileId,
    correlationId: observation.correlationId,
    onLocationCreated: (confirmedLocationId) => {
      createdLocationIdRef.current = confirmedLocationId
    },
  })
  if (existingCreatedLocationId) {
    await updateLocation(createdLocationId, payload, {
      actorProfileId,
      correlationId: observation.correlationId,
    })
  }
  createdLocationIdRef.current = createdLocationId
  Object.assign(observation, updateLocationWriteObservation({ locationId: createdLocationId, mode: 'create' }))
  updateStageStatus('location', 'done')

  await runPendingImageDeletes(createdLocationId, observation)
  setPendingDeletedPersistedImageIds([])

  const uploadErrorMessage = await runPendingImageUploads(createdLocationId, observation)

  setPendingImages((currentImages) => {
    currentImages.forEach((image) => {
      if (image.status === 'done') {
        revokePreviewUrl(image.previewUrl)
      }
    })

    return currentImages.filter((image) => image.status !== 'done')
  })

  if (uploadErrorMessage) {
    throw suppressAdminErrorReport(new Error(uploadErrorMessage))
  }

  await syncVisibleGallery(observation)

  protection.markSaved()
  updateStageStatus('completed', 'done')
  markSaveProgressSuccess()
  await waitForSuccess()
  setSaveProgress(null)
  if (onCreateSuccess) {
    await onCreateSuccess()
    return
  }

  navigateToLocations()
}
