import { useState } from 'react'
import LocationImagesGrid from './LocationImagesGrid'
import LocationImageUploader from './LocationImageUploader'
import {
  deleteLocationImage,
  uploadLocationImage,
} from './location-images.service'
import { prepareImageUploadFile } from '../images/image-upload.processor'
import type {
  LocationImageRecord,
  PendingLocationImageFile,
} from './location-images.types'
import { useLocationImages } from './useLocationImages'

type LocationImagesSectionCreateProps = {
  mode?: 'create'
  disabled?: boolean
  images: PendingLocationImageFile[]
  onCoverFilesSelected: (files: FileList | null) => void
  onGalleryFilesSelected: (files: FileList | null) => void
  onRemoveImage: (imageId: string) => void
  onSetCoverImage: (imageId: string) => void
  validationErrors: string[]
}

type LocationImagesSectionEditProps = {
  mode: 'edit'
  disabled?: boolean
  locationId: string
}

type LocationImagesSectionProps =
  | LocationImagesSectionCreateProps
  | LocationImagesSectionEditProps

function getPersistedCoverImage(images: LocationImageRecord[]) {
  return images.find((image) => image.is_cover === true) ?? null
}

function LocationImagesSection({
  disabled = false,
  ...props
}: LocationImagesSectionProps) {
  const isEditMode = props.mode === 'edit'
  const [pendingUploads, setPendingUploads] = useState<PendingLocationImageFile[]>(
    [],
  )
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null)
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null)
  const locationImages = useLocationImages(
    isEditMode ? props.locationId : null,
  )
  const persistedCoverImage = getPersistedCoverImage(locationImages.images)
  const persistedGalleryImages = persistedCoverImage
    ? locationImages.images.filter((image) => image.id !== persistedCoverImage.id)
    : locationImages.images

  function updatePendingUpload(
    imageId: string,
    updates: Partial<PendingLocationImageFile>,
  ) {
    setPendingUploads((currentImages) =>
      currentImages.map((image) =>
        image.id === imageId
          ? {
              ...image,
              ...updates,
            }
          : image,
      ),
    )
  }

  async function handleEditFilesSelected(
    files: FileList | null,
    isCoverSelection: boolean,
  ) {
    if (!files || files.length === 0 || !isEditMode) {
      return
    }

    const nextErrors: string[] = []
    const nextUploads: PendingLocationImageFile[] = []
    const selectedFiles = isCoverSelection ? [files[0]] : Array.from(files)

    for (const [index, file] of selectedFiles.entries()) {
      if (!file) {
        continue
      }

      try {
        const preparedFile = (await prepareImageUploadFile(file)).file

        nextUploads.push({
          id: crypto.randomUUID(),
          file: preparedFile,
          previewUrl: URL.createObjectURL(preparedFile),
          originalIndex: index,
          isCover: isCoverSelection && index === 0,
          status: 'pending',
        })
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `${file.name}: no pudimos procesar la imagen seleccionada.`

        nextErrors.push(message)
      }
    }

    setValidationErrors(nextErrors)
    setUploadErrorMessage(null)
    setDeleteErrorMessage(null)

    if (nextUploads.length === 0) {
      return
    }

    setPendingUploads((currentImages) => [...currentImages, ...nextUploads])
    setIsUploading(true)

    let hasUploadErrors = false

    for (const image of nextUploads) {
      try {
        updatePendingUpload(image.id, {
          errorMessage: null,
          status: 'pending',
        })

        await uploadLocationImage({
          file: image.file,
          isCover: image.isCover,
          locationId: props.locationId,
          onStatusChange: (status) => {
            updatePendingUpload(image.id, {
              status,
            })
          },
        })

        updatePendingUpload(image.id, {
          errorMessage: null,
          status: 'done',
        })
      } catch (error) {
        hasUploadErrors = true

        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos subir esta imagen.'

        updatePendingUpload(image.id, {
          errorMessage: message,
          status: 'error',
        })
      }
    }

    await locationImages.refresh()

    setPendingUploads((currentImages) => {
      currentImages.forEach((image) => {
        if (image.status === 'done') {
          URL.revokeObjectURL(image.previewUrl)
        }
      })

      return currentImages.filter((image) => image.status !== 'done')
    })

    if (hasUploadErrors) {
      setUploadErrorMessage(
        'Algunas imágenes no se pudieron subir. Revisá los errores y volvé a intentar.',
      )
    }

    setIsUploading(false)
  }

  async function handleDeletePersistedImage(imageId: string) {
    if (!isEditMode) {
      return
    }

    try {
      setDeletingImageId(imageId)
      setDeleteErrorMessage(null)

      await deleteLocationImage({
        imageId,
        locationId: props.locationId,
      })

      await locationImages.refresh()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos eliminar la imagen.'

      setDeleteErrorMessage(message)
    } finally {
      setDeletingImageId(null)
    }
  }

  if (!isEditMode) {
    const {
      images,
      onCoverFilesSelected,
      onGalleryFilesSelected,
      onRemoveImage,
      onSetCoverImage,
      validationErrors: createValidationErrors,
    } = props

    return (
      <div className="space-y-4">
        <LocationImagesGrid
          images={images}
          emptyGalleryAction={
            <LocationImageUploader
              disabled={disabled}
              helperText="Podés seleccionar varias imágenes para la galería."
              label="Subir galería"
              variant="empty-state"
              onFilesSelected={onGalleryFilesSelected}
            />
          }
          isLocked={disabled}
          emptyCoverAction={
            <LocationImageUploader
              disabled={disabled}
              helperText="Selecciona una sola imagen para portada."
              label="Subir portada"
              multiple={false}
              variant="empty-state"
              onFilesSelected={onCoverFilesSelected}
            />
          }
          onRemove={onRemoveImage}
          onSetCover={onSetCoverImage}
        />

        <LocationImageUploader
          disabled={disabled}
          helperText="Podés seleccionar varias imágenes para la galería."
          label="Seleccionar galería"
          onFilesSelected={onGalleryFilesSelected}
        />

        {createValidationErrors.length > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <ul className="space-y-1">
              {createValidationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {validationErrors.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ul className="space-y-1">
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {uploadErrorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {uploadErrorMessage}
        </div>
      ) : null}

      {deleteErrorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteErrorMessage}
        </div>
      ) : null}

      {pendingUploads.length > 0 ? (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-slate-900">
              Nuevas imágenes
            </h4>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              El estado se actualiza mientras completamos la subida y
              finalización.
            </p>
          </div>
          <LocationImagesGrid
            images={pendingUploads}
            isLocked
            mode="pending"
            onRemove={() => undefined}
          />
        </div>
      ) : null}

      {locationImages.isLoading ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Cargando imágenes de la locación...
        </div>
      ) : null}

      {!locationImages.isLoading && locationImages.errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {locationImages.errorMessage}
        </div>
      ) : null}

      {!locationImages.isLoading && !locationImages.errorMessage ? (
        <div className="space-y-4">
          <LocationImagesGrid
            images={persistedCoverImage ? [persistedCoverImage] : []}
            emptyCoverAction={
              <LocationImageUploader
                disabled={disabled || isUploading}
                helperText="Selecciona una sola imagen para portada."
                label="Subir portada"
                multiple={false}
                variant="empty-state"
                onFilesSelected={(files) =>
                  void handleEditFilesSelected(files, true)
                }
              />
            }
            isLocked={disabled || isUploading || deletingImageId !== null}
            mode="persisted"
            onRemove={(imageId) => void handleDeletePersistedImage(imageId)}
            showCount={false}
            showGallery={false}
            title="Portada"
          />

          {(persistedGalleryImages.length > 0 || locationImages.images.length === 0) ? (
            <LocationImagesGrid
              images={persistedGalleryImages}
              emptyGalleryAction={
                <LocationImageUploader
                  disabled={disabled || isUploading}
                  helperText="Podés seleccionar varias imágenes para la galería."
                  label="Subir galería"
                  variant="empty-state"
                  onFilesSelected={(files) =>
                    void handleEditFilesSelected(files, false)
                  }
                />
              }
              isLocked={disabled || isUploading || deletingImageId !== null}
              mode="persisted"
              onRemove={(imageId) => void handleDeletePersistedImage(imageId)}
              showCount={false}
              showCover={false}
              title="Galería"
            />
          ) : null}
        </div>
      ) : null}

      <LocationImageUploader
        disabled={disabled || isUploading}
        helperText="Podés seleccionar varias imágenes para la galería."
        label="Seleccionar galería"
        onFilesSelected={(files) =>
          void handleEditFilesSelected(files, false)
        }
      />

      {!locationImages.isLoading &&
      !locationImages.errorMessage &&
      locationImages.images.length === 0 &&
      pendingUploads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Esta locación todavía no tiene imágenes persistidas.
        </div>
      ) : null}
    </div>
  )
}

export default LocationImagesSection
