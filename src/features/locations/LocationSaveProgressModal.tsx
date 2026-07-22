import SaveProgressModal from '../../components/ui/SaveProgressModal'

export type LocationSaveStageKey =
  | 'location'
  | 'deleteImages'
  | 'uploadImages'
  | 'syncGallery'
  | 'completed'

export type LocationSaveStageStatus =
  | 'pending'
  | 'active'
  | 'done'
  | 'error'
  | 'skipped'

export type LocationSaveStage = {
  key: LocationSaveStageKey
  status: LocationSaveStageStatus
}

export type LocationSaveProgressState = {
  errorMessage: string | null
  stages: LocationSaveStage[]
  successMessage: string | null
  deletingDone: number
  deletingTotal: number
  uploadingDone: number
  uploadingTotal: number
  uploadingCurrentIndex: number | null
  uploadingCurrentName: string | null
  uploadingCurrentStep: 'uploading' | 'finalizing' | null
}

type LocationSaveProgressModalProps = {
  progress: LocationSaveProgressState | null
}

type ProgressSegment = {
  completedUnits: number
  totalUnits: number
}

function getStageStatus(
  progress: LocationSaveProgressState,
  key: LocationSaveStageKey,
) {
  return progress.stages.find((stage) => stage.key === key)?.status ?? 'pending'
}

function getLocationSegment(progress: LocationSaveProgressState): ProgressSegment {
  const status = getStageStatus(progress, 'location')

  if (status === 'done' || status === 'skipped') {
    return { completedUnits: 1, totalUnits: 1 }
  }

  if (status === 'active') {
    return { completedUnits: 0.35, totalUnits: 1 }
  }

  return { completedUnits: 0, totalUnits: 1 }
}

function getDeleteSegment(progress: LocationSaveProgressState): ProgressSegment {
  const status = getStageStatus(progress, 'deleteImages')

  if (status === 'skipped') {
    return { completedUnits: 0, totalUnits: 0 }
  }

  const totalUnits = Math.max(progress.deletingTotal, 1)

  if (status === 'done') {
    return { completedUnits: totalUnits, totalUnits }
  }

  if (status === 'active') {
    return {
      completedUnits: Math.min(progress.deletingDone, totalUnits),
      totalUnits,
    }
  }

  return { completedUnits: 0, totalUnits }
}

function getUploadSegment(progress: LocationSaveProgressState): ProgressSegment {
  const status = getStageStatus(progress, 'uploadImages')

  if (status === 'skipped') {
    return { completedUnits: 0, totalUnits: 0 }
  }

  const totalUnits = Math.max(progress.uploadingTotal, 1)

  if (status === 'done') {
    return { completedUnits: totalUnits, totalUnits }
  }

  if (status === 'active') {
    const baseCompleted = Math.min(progress.uploadingDone, totalUnits)
    const inFlightBonus =
      progress.uploadingCurrentIndex !== null &&
      progress.uploadingCurrentIndex > progress.uploadingDone
        ? progress.uploadingCurrentStep === 'finalizing'
          ? 0.9
          : 0.55
        : 0

    return {
      completedUnits: Math.min(baseCompleted + inFlightBonus, totalUnits),
      totalUnits,
    }
  }

  return { completedUnits: 0, totalUnits }
}

function getSyncSegment(progress: LocationSaveProgressState): ProgressSegment {
  const status = getStageStatus(progress, 'syncGallery')

  if (status === 'skipped') {
    return { completedUnits: 0, totalUnits: 0 }
  }

  if (status === 'done') {
    return { completedUnits: 1, totalUnits: 1 }
  }

  if (status === 'active') {
    return { completedUnits: 0.5, totalUnits: 1 }
  }

  return { completedUnits: 0, totalUnits: 1 }
}

function getCompletedSegment(progress: LocationSaveProgressState): ProgressSegment {
  const status = getStageStatus(progress, 'completed')

  if (status === 'done') {
    return { completedUnits: 1, totalUnits: 1 }
  }

  return { completedUnits: 0, totalUnits: 1 }
}

function getProgressPercentage(progress: LocationSaveProgressState) {
  if (progress.successMessage) {
    return 100
  }

  const segments = [
    getLocationSegment(progress),
    getDeleteSegment(progress),
    getUploadSegment(progress),
    getSyncSegment(progress),
    getCompletedSegment(progress),
  ]

  const completedUnits = segments.reduce(
    (total, segment) => total + segment.completedUnits,
    0,
  )
  const totalUnits = segments.reduce(
    (total, segment) => total + segment.totalUnits,
    0,
  )

  if (totalUnits === 0) {
    return 0
  }

  return Math.max(
    0,
    Math.min(100, Math.round((completedUnits / totalUnits) * 100)),
  )
}

function getProgressMessage(progress: LocationSaveProgressState) {
  if (progress.successMessage) {
    return 'Cambios guardados correctamente'
  }

  if (progress.errorMessage) {
    return 'Finalizando...'
  }

  const locationStatus = getStageStatus(progress, 'location')
  const uploadStatus = getStageStatus(progress, 'uploadImages')
  const syncStatus = getStageStatus(progress, 'syncGallery')

  if (locationStatus === 'pending') {
    return 'Preparando cambios...'
  }

  if (locationStatus === 'active') {
    return 'Actualizando informacion...'
  }

  if (uploadStatus === 'active' || progress.uploadingDone > 0) {
    return 'Procesando imagenes...'
  }

  if (syncStatus === 'active' || getStageStatus(progress, 'completed') === 'active') {
    return 'Finalizando...'
  }

  if (locationStatus === 'done') {
    return 'Finalizando...'
  }

  return 'Preparando cambios...'
}

function LocationSaveProgressModal({
  progress,
}: LocationSaveProgressModalProps) {
  if (!progress) {
    return null
  }

  const percentage = getProgressPercentage(progress)
  const message = getProgressMessage(progress)

  return (
    <SaveProgressModal
      errorMessage={progress.errorMessage}
      message={message}
      percentage={percentage}
      title="Guardando cambios"
    />
  )
}

export default LocationSaveProgressModal
