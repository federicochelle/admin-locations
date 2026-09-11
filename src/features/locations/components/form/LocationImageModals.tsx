import LocationImageSourceModal from '../../LocationImageSourceModal'
import LocationManualBlurModal from '../../LocationManualBlurModal'
import type { BlurStroke } from '../../location-face-blur'
import type { PendingLocationImageFile } from '../../location-images.types'
import type { ImageSelectionTarget } from '../../hooks/useLocationDropbox'

type ManualBlurTarget =
  | {
      imageId: string
      kind: 'pending'
    }
  | {
      editorImage: PendingLocationImageFile
      expectedStorageKey: string
      imageId: string
      kind: 'persisted'
    }

type LocationImageModalsProps = {
  imageSelectionTarget: ImageSelectionTarget | null
  isApplyingManualBlur: boolean
  isDropboxImporting: boolean
  isImageSourceModalOpen: boolean
  isReadOnly: boolean
  manualBlurErrorMessage: string | null
  manualBlurTarget: ManualBlurTarget | null
  onApplyManualBlur: (imageId: string, strokes: BlurStroke[]) => Promise<void>
  onChooseDevice: () => void
  onChooseDropbox: () => void
  onCloseImageSourceModal: () => void
  onCloseManualBlurModal: () => void
  pendingImages: PendingLocationImageFile[]
}

export default function LocationImageModals({
  imageSelectionTarget,
  isApplyingManualBlur,
  isDropboxImporting,
  isImageSourceModalOpen,
  isReadOnly,
  manualBlurErrorMessage,
  manualBlurTarget,
  onApplyManualBlur,
  onChooseDevice,
  onChooseDropbox,
  onCloseImageSourceModal,
  onCloseManualBlurModal,
  pendingImages,
}: LocationImageModalsProps) {
  return (
    <>
      {!isReadOnly ? (
        <LocationImageSourceModal
          isDropboxImporting={isDropboxImporting}
          isOpen={isImageSourceModalOpen}
          onChooseDevice={onChooseDevice}
          onChooseDropbox={onChooseDropbox}
          onClose={onCloseImageSourceModal}
          target={imageSelectionTarget}
        />
      ) : null}
      {!isReadOnly && manualBlurTarget !== null ? (
        <LocationManualBlurModal
          key={manualBlurTarget.imageId}
          errorMessage={manualBlurErrorMessage}
          image={
            manualBlurTarget.kind === 'pending'
              ? pendingImages.find((image) => image.id === manualBlurTarget.imageId) ?? null
              : manualBlurTarget.editorImage
          }
          isApplying={isApplyingManualBlur}
          isOpen={manualBlurTarget !== null}
          onApply={onApplyManualBlur}
          onClose={onCloseManualBlurModal}
        />
      ) : null}
    </>
  )
}
