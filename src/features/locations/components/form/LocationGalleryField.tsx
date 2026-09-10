import type { RefObject } from 'react'
import LocationImageUploader, {
  type LocationImageUploaderHandle,
} from '../../LocationImageUploader'
import LocationImagesGrid from '../../LocationImagesGrid'
import type {
  LocationImageRecord,
  PendingLocationImageFile,
} from '../../location-images.types'
import type { LocationFormMode } from '../../LocationForm'

type CombinedEditGalleryImage =
  | {
      kind: 'persisted'
      image: LocationImageRecord
      index: number
    }
  | {
      kind: 'pending'
      image: PendingLocationImageFile
    }

type LocationGalleryFieldProps = {
  combinedEditGalleryImages: CombinedEditGalleryImage[]
  editDeleteErrorMessage: string | null
  galleryImageUploaderRef: RefObject<LocationImageUploaderHandle | null>
  imageErrorsById: Record<string, string | undefined>
  isDropboxImporting: boolean
  isPreparingImages: boolean
  isSubmitting: boolean
  manualBlurLoadingImageId: string | null
  mode: LocationFormMode
  onDeletePersistedImage: (imageId: string) => void
  onGalleryImagesSelected: (files: FileList | null) => void
  onManualBlur: (imageId: string) => void
  onOpenImageSourceModal: (target: 'cover' | 'gallery') => void
  onOpenPersistedManualBlur: (imageId: string) => void
  onRemovePendingImage: (imageId: string) => void
  pendingGalleryImages: PendingLocationImageFile[]
  persistedGalleryImages: LocationImageRecord[]
  processedImagesCount: number
  showImagesSection: boolean
  totalImagesToProcess: number
}

function getGalleryUploadLabel(
  isPreparingImages: boolean,
  processedImagesCount: number,
  totalImagesToProcess: number,
) {
  if (!isPreparingImages) {
    return 'Subir imágenes'
  }

  return `Procesando imágenes ${processedImagesCount} de ${totalImagesToProcess}...`
}

export default function LocationGalleryField({
  combinedEditGalleryImages,
  editDeleteErrorMessage,
  galleryImageUploaderRef,
  imageErrorsById,
  isDropboxImporting,
  isPreparingImages,
  isSubmitting,
  manualBlurLoadingImageId,
  mode,
  onDeletePersistedImage,
  onGalleryImagesSelected,
  onManualBlur,
  onOpenImageSourceModal,
  onOpenPersistedManualBlur,
  onRemovePendingImage,
  pendingGalleryImages,
  persistedGalleryImages,
  processedImagesCount,
  showImagesSection,
  totalImagesToProcess,
}: LocationGalleryFieldProps) {
  if (showImagesSection && mode === 'create') {
    return (
      <div className="space-y-4 border-t border-slate-200 pt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-2xl font-semibold text-slate-950">
            Galería de imágenes
          </h3>
          <LocationImageUploader
            ref={galleryImageUploaderRef}
            disabled={isSubmitting || isPreparingImages || isDropboxImporting}
            label={getGalleryUploadLabel(
              isPreparingImages,
              processedImagesCount,
              totalImagesToProcess,
            )}
            onTrigger={() => onOpenImageSourceModal('gallery')}
            onFilesSelected={onGalleryImagesSelected}
          />
        </div>
        {pendingGalleryImages.length > 0 ? (
          <LocationImagesGrid
            imageErrorsById={imageErrorsById}
            images={pendingGalleryImages}
            isLocked={isSubmitting}
            manualBlurLoadingImageId={manualBlurLoadingImageId}
            mode="pending"
            onManualBlur={onManualBlur}
            onRemove={onRemovePendingImage}
            showCount={false}
            showCover={false}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            Todavía no cargaste imágenes de galería.
          </div>
        )}
      </div>
    )
  }

  if (showImagesSection && mode === 'edit') {
    return (
      <div className="space-y-4 border-t border-slate-200 pt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-2xl font-semibold text-slate-950">
            Galería de imágenes
          </h3>
          <LocationImageUploader
            ref={galleryImageUploaderRef}
            disabled={isSubmitting || isPreparingImages || isDropboxImporting}
            label={getGalleryUploadLabel(
              isPreparingImages,
              processedImagesCount,
              totalImagesToProcess,
            )}
            onTrigger={() => onOpenImageSourceModal('gallery')}
            onFilesSelected={onGalleryImagesSelected}
          />
        </div>
        {combinedEditGalleryImages.length > 0 ? (
          <LocationImagesGrid
            imageErrorsById={imageErrorsById}
            images={combinedEditGalleryImages}
            isLocked={isSubmitting}
            manualBlurLoadingImageId={manualBlurLoadingImageId}
            mode="mixed"
            onManualBlurPending={onManualBlur}
            onManualBlurPersisted={(imageId) => void onOpenPersistedManualBlur(imageId)}
            onRemovePending={onRemovePendingImage}
            onRemovePersisted={(imageId) => void onDeletePersistedImage(imageId)}
            showCount={false}
            showCover={false}
          />
        ) : null}

        {combinedEditGalleryImages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            Esta locación todavía no tiene imágenes de galería.
          </div>
        ) : null}
        {editDeleteErrorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {editDeleteErrorMessage}
          </div>
        ) : null}
      </div>
    )
  }

  if (showImagesSection && mode === 'view') {
    return (
      <div className="space-y-4 border-t border-slate-200 pt-6">
        <h3 className="text-2xl font-semibold text-slate-950">
          Galería de imágenes
        </h3>
        {persistedGalleryImages.length > 0 ? (
          <LocationImagesGrid
            imageErrorsById={imageErrorsById}
            images={persistedGalleryImages}
            isLocked
            mode="persisted"
            showCount={false}
            showCover={false}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            Esta locación todavía no tiene imágenes de galería.
          </div>
        )}
      </div>
    )
  }

  return null
}
