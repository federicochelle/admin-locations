import LocationSaveProgressModal, {
  type LocationSaveProgressState,
} from '../../LocationSaveProgressModal'

type LocationSaveProgressViewProps = {
  isReadOnly: boolean
  progress: LocationSaveProgressState | null
}

export default function LocationSaveProgressView({
  isReadOnly,
  progress,
}: LocationSaveProgressViewProps) {
  return !isReadOnly ? <LocationSaveProgressModal progress={progress} /> : null
}
