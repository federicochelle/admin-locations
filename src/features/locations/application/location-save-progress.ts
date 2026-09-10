import type {
  LocationSaveProgressState,
  LocationSaveStageKey,
  LocationSaveStageStatus,
} from '../LocationSaveProgressModal'

export function buildSaveProgressState(input: {
  deletingTotal: number
  shouldSyncGallery: boolean
  uploadingTotal: number
}): LocationSaveProgressState {
  return {
    errorMessage: null,
    stages: [
      { key: 'location', status: 'pending' },
      {
        key: 'deleteImages',
        status: input.deletingTotal > 0 ? 'pending' : 'skipped',
      },
      {
        key: 'uploadImages',
        status: input.uploadingTotal > 0 ? 'pending' : 'skipped',
      },
      {
        key: 'syncGallery',
        status: input.shouldSyncGallery ? 'pending' : 'skipped',
      },
      { key: 'completed', status: 'pending' },
    ],
    successMessage: null,
    deletingDone: 0,
    deletingTotal: input.deletingTotal,
    uploadingDone: 0,
    uploadingTotal: input.uploadingTotal,
    uploadingCurrentIndex: null,
    uploadingCurrentName: null,
    uploadingCurrentStep: null,
  }
}

export function updateLocationSaveStageStatus(
  currentState: LocationSaveProgressState,
  key: LocationSaveStageKey,
  status: LocationSaveStageStatus,
): LocationSaveProgressState {
  return {
    ...currentState,
    stages: currentState.stages.map((stage) =>
      stage.key === key
        ? {
            ...stage,
            status,
          }
        : stage,
    ),
  }
}

export function setLocationSaveProgressError(
  currentState: LocationSaveProgressState,
  key: LocationSaveStageKey,
  message: string,
): LocationSaveProgressState {
  return {
    ...currentState,
    errorMessage: message,
    stages: currentState.stages.map((stage) =>
      stage.key === key
        ? {
            ...stage,
            status: 'error',
          }
        : stage,
    ),
  }
}

export function markLocationSaveProgressSuccess(
  currentState: LocationSaveProgressState,
): LocationSaveProgressState {
  return {
    ...currentState,
    successMessage: 'Cambios guardados correctamente',
  }
}
