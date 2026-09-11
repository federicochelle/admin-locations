import type { RefObject } from 'react'
import LocationImageUploader, {
  type LocationImageUploaderHandle,
} from '../../LocationImageUploader'
import LocationImagesGrid from '../../LocationImagesGrid'
import LocationMapPreview from '../../LocationMapPreview'
import {
  LOCATION_TOP_STACK_PLACEHOLDER_CLASS,
} from '../../location-top-stack.styles'
import type {
  LocationImageRecord,
  PendingLocationImageFile,
} from '../../location-images.types'
import type { LocationFormMode } from '../../LocationForm'

type LocationCoverFieldProps = {
  coverImageUploaderRef: RefObject<LocationImageUploaderHandle | null>
  googleMapsApiKey: string | null
  imageErrorsById: Record<string, string | undefined>
  isDropboxImporting: boolean
  isPreparingImages: boolean
  isSubmitting: boolean
  manualBlurLoadingImageId: string | null
  mode: LocationFormMode
  onCoverImageSelected: (files: FileList | null) => void
  onDeletePersistedImage: (imageId: string) => void
  onManualBlur: (imageId: string) => void
  onOpenImageSourceModal: (target: 'cover' | 'gallery') => void
  onOpenPersistedManualBlur: (imageId: string) => void
  onRemovePendingImage: (imageId: string) => void
  onRetryPendingImage: (imageId: string) => void
  onSetCoverImage: (imageId: string) => void
  pendingCoverImage: PendingLocationImageFile | null
  persistedCoverImage: LocationImageRecord | null
  renderImageFeedback: () => React.ReactNode
  showImagesSection: boolean
  values: {
    lat: number | null
    lng: number | null
  }
}

function ReadOnlyImagePlaceholder({ message }: { message: string }) {
  return (
    <div
      className={[
        LOCATION_TOP_STACK_PLACEHOLDER_CLASS,
        'rounded-none border-solid border-slate-300 text-sm text-slate-600',
      ].join(' ')}
    >
      <p>{message}</p>
    </div>
  )
}

function renderLocationMapPreview({
  disabled,
  googleMapsApiKey,
  lat,
  lng,
}: {
  disabled: boolean
  googleMapsApiKey: string | null
  lat: number | null
  lng: number | null
}) {
  if (googleMapsApiKey) {
    return (
      <LocationMapPreview
        lat={lat}
        lng={lng}
        disabled={disabled}
      />
    )
  }

  return (
    <LocationMapPreview
      lat={lat}
      lng={lng}
      disabled={disabled}
      mapEnabled={false}
    />
  )
}

export default function LocationCoverField({
  coverImageUploaderRef,
  googleMapsApiKey,
  imageErrorsById,
  isDropboxImporting,
  isPreparingImages,
  isSubmitting,
  manualBlurLoadingImageId,
  mode,
  onCoverImageSelected,
  onDeletePersistedImage,
  onManualBlur,
  onOpenImageSourceModal,
  onOpenPersistedManualBlur,
  onRemovePendingImage,
  onRetryPendingImage,
  onSetCoverImage,
  pendingCoverImage,
  persistedCoverImage,
  renderImageFeedback,
  showImagesSection,
  values,
}: LocationCoverFieldProps) {
  if (showImagesSection && mode === 'create') {
    return (
      <div className="min-w-0 space-y-4 xl:pl-6 2xl:pl-8">
        <LocationImagesGrid
          imageErrorsById={imageErrorsById}
          images={pendingCoverImage ? [pendingCoverImage] : []}
          emptyCoverAction={
            <LocationImageUploader
              ref={coverImageUploaderRef}
              disabled={isSubmitting || isPreparingImages || isDropboxImporting}
              helperText="Selecciona una sola imagen para portada."
              label="Subir portada"
              multiple={false}
              onTrigger={() => onOpenImageSourceModal('cover')}
              variant="empty-state"
              onFilesSelected={onCoverImageSelected}
            />
          }
          isLocked={isSubmitting}
          manualBlurLoadingImageId={manualBlurLoadingImageId}
          mode="pending"
          onManualBlur={onManualBlur}
          onRemove={onRemovePendingImage}
          onRetry={onRetryPendingImage}
          onSetCover={onSetCoverImage}
          showCount={false}
          showGallery={false}
        />
        {renderImageFeedback()}
        {renderLocationMapPreview({
          disabled: isSubmitting,
          googleMapsApiKey,
          lat: values.lat,
          lng: values.lng,
        })}
      </div>
    )
  }

  if (showImagesSection && mode === 'edit') {
    return (
      <div className="min-w-0 space-y-4 xl:pl-6 2xl:pl-8">
        {pendingCoverImage ? (
          <LocationImagesGrid
            imageErrorsById={imageErrorsById}
            images={[pendingCoverImage]}
            isLocked={isSubmitting}
            manualBlurLoadingImageId={manualBlurLoadingImageId}
            mode="pending"
            onManualBlur={onManualBlur}
            onRemove={onRemovePendingImage}
            onRetry={onRetryPendingImage}
            onSetCover={onSetCoverImage}
            showCount={false}
            showGallery={false}
          />
        ) : (
          <LocationImagesGrid
            imageErrorsById={imageErrorsById}
            images={persistedCoverImage ? [persistedCoverImage] : []}
            emptyCoverAction={
              <LocationImageUploader
                ref={coverImageUploaderRef}
                disabled={isSubmitting || isPreparingImages || isDropboxImporting}
                helperText="Selecciona una sola imagen para portada."
                label="Subir portada"
                multiple={false}
                onTrigger={() => onOpenImageSourceModal('cover')}
                variant="empty-state"
                onFilesSelected={onCoverImageSelected}
              />
            }
            isLocked={isSubmitting}
            manualBlurLoadingImageId={manualBlurLoadingImageId}
            mode="persisted"
            onManualBlur={(imageId) => void onOpenPersistedManualBlur(imageId)}
            onRemove={(imageId) => void onDeletePersistedImage(imageId)}
            showCount={false}
            showGallery={false}
          />
        )}
        {renderImageFeedback()}
        {renderLocationMapPreview({
          disabled: isSubmitting,
          googleMapsApiKey,
          lat: values.lat,
          lng: values.lng,
        })}
      </div>
    )
  }

  if (showImagesSection && mode === 'view') {
    return (
      <div className="min-w-0 space-y-4 xl:pl-6 2xl:pl-8">
        <LocationImagesGrid
          imageErrorsById={imageErrorsById}
          images={persistedCoverImage ? [persistedCoverImage] : []}
          emptyCoverAction={
            <ReadOnlyImagePlaceholder message="Esta locación todavía no tiene portada." />
          }
          isLocked
          mode="persisted"
          showCount={false}
          showGallery={false}
        />
        {renderLocationMapPreview({
          disabled: true,
          googleMapsApiKey,
          lat: values.lat,
          lng: values.lng,
        })}
      </div>
    )
  }

  return null
}
