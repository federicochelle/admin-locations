import { useRef, useState } from 'react'
import ImageLightbox, {
  type ImageLightboxItem,
} from '../../components/ui/ImageLightbox'
import {
  LOCATION_TOP_STACK_PANEL_HEIGHT_CLASS,
  LOCATION_TOP_STACK_PANEL_SURFACE_CLASS,
} from './location-top-stack.styles'
import type {
  LocationImageRecord,
  PendingLocationImageFile,
} from './location-images.types'

type PendingLocationImagesGridProps = {
  images: PendingLocationImageFile[]
  isLocked?: boolean
  mode?: 'pending'
  onRemove?: (imageId: string) => void
  onSetCover?: (imageId: string) => void
}

type PersistedLocationImagesGridProps = {
  images: LocationImageRecord[]
  isLocked?: boolean
  mode: 'persisted'
  onRemove?: (imageId: string) => void
  onSetCover?: (imageId: string) => void
}

type MixedLocationImagesGridProps = {
  images: Array<
    | {
        kind: 'pending'
        image: PendingLocationImageFile
      }
    | {
        kind: 'persisted'
        image: LocationImageRecord
        index: number
      }
  >
  isLocked?: boolean
  mode: 'mixed'
  onRemovePending?: (imageId: string) => void
  onRemovePersisted?: (imageId: string) => void
}

type LocationImagesGridProps =
  | PendingLocationImagesGridProps
  | PersistedLocationImagesGridProps
  | MixedLocationImagesGridProps

type LocationImagesGridBaseProps = {
  emptyCoverAction?: React.ReactNode
  emptyGalleryAction?: React.ReactNode
  showCount?: boolean
  showCover?: boolean
  showGallery?: boolean
  title?: string
}

type GridImageItem = {
  detailBadges: string[]
  errorMessage?: string | null
  id: string
  isCover: boolean
  kind: 'pending' | 'persisted'
  previewUrl: string
  secondaryLabel: string
  statusLabel?: string | null
  statusTone?: 'default' | 'success' | 'warning' | 'danger'
  title: string
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function overlayActionClassName(tone: 'danger') {
  return tone === 'danger'
    ? 'bg-white/92 text-red-600 hover:bg-red-600 hover:text-white'
    : ''
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function getImageDimensionsLabel(image: LocationImageRecord) {
  if (!image.width || !image.height) {
    return null
  }

  return `${image.width} x ${image.height}`
}

function getPendingStatusLabel(image: PendingLocationImageFile) {
  switch (image.status) {
    case 'uploading':
      return 'Subiendo'
    case 'finalizing':
      return 'Finalizando'
    case 'done':
      return 'Completada'
    case 'error':
      return 'Error'
    default:
      return 'Pendiente'
  }
}

function getPendingStatusTone(
  image: PendingLocationImageFile,
): GridImageItem['statusTone'] {
  switch (image.status) {
    case 'done':
      return 'success'
    case 'error':
      return 'danger'
    case 'uploading':
    case 'finalizing':
      return 'warning'
    default:
      return 'default'
  }
}

function mapPendingImage(image: PendingLocationImageFile): GridImageItem {
  return {
    detailBadges: [formatFileSize(image.file.size)],
    errorMessage: image.errorMessage,
    id: image.id,
    isCover: image.isCover,
    kind: 'pending',
    previewUrl: image.previewUrl,
    secondaryLabel: 'Imagen pendiente',
    statusLabel: getPendingStatusLabel(image),
    statusTone: getPendingStatusTone(image),
    title: image.file.name,
  }
}

function mapPersistedImage(
  image: LocationImageRecord,
  index: number,
): GridImageItem {
  const detailBadges = [getImageDimensionsLabel(image), image.storage_key].filter(
    (value): value is string => Boolean(value),
  )

  return {
    detailBadges,
    id: image.id,
    isCover: image.is_cover,
    kind: 'persisted',
    previewUrl: image.url,
    secondaryLabel: `Orden ${image.sort_order}`,
    title: `Imagen ${index + 1}`,
  }
}

function LocationImagesGrid(
  props: LocationImagesGridProps & LocationImagesGridBaseProps,
) {
  const [coverDropActive, setCoverDropActive] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const shouldSuppressClickRef = useRef(false)
  const showCover = props.showCover ?? true
  const showGallery = props.showGallery ?? true
  const items =
    props.mode === 'persisted'
      ? props.images.map((image, index) => mapPersistedImage(image, index))
      : props.mode === 'mixed'
        ? props.images.map((entry) =>
            entry.kind === 'persisted'
              ? mapPersistedImage(entry.image, entry.index)
              : mapPendingImage(entry.image),
          )
      : props.images.map((image) => mapPendingImage(image))

  const coverItem = showCover
    ? items.find((image) => image.isCover) ?? null
    : null
  const galleryItems = showGallery
    ? coverItem
      ? items.filter((image) => image.id !== coverItem.id)
      : items
    : []
  const orderedItems = coverItem ? [coverItem, ...galleryItems] : galleryItems
  const onSetCoverHandler =
    props.mode === 'mixed' ? undefined : props.onSetCover
  const hasRemoveAction =
    props.mode === 'mixed'
      ? Boolean(props.onRemovePending || props.onRemovePersisted)
      : Boolean(props.onRemove)
  const canDragToCover = Boolean(onSetCoverHandler)
  const title = props.title
  const showCount = props.showCount !== false && orderedItems.length > 0
  const showHeader = Boolean(title) || showCount
  const gridClassName = showGallery
    ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
    : 'grid grid-cols-1 gap-4'
  const lightboxImages: ImageLightboxItem[] = orderedItems.map((image) => ({
    id: image.id,
    title: image.title,
    url: image.previewUrl,
  }))

  function handleCoverDragOver(event: React.DragEvent<HTMLElement>) {
    if (!canDragToCover) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setCoverDropActive(true)
  }

  function handleCoverDragLeave() {
    if (!canDragToCover) {
      return
    }

    setCoverDropActive(false)
  }

  function handleCoverDrop(event: React.DragEvent<HTMLElement>) {
    if (!onSetCoverHandler) {
      return
    }

    event.preventDefault()
    const imageId = event.dataTransfer.getData('text/location-image-id')
    setCoverDropActive(false)

    if (!imageId) {
      return
    }

    onSetCoverHandler(imageId)
  }

  function handleImageDragStart(
    event: React.DragEvent<HTMLElement>,
    imageId: string,
  ) {
    if (!canDragToCover) {
      return
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/location-image-id', imageId)
    shouldSuppressClickRef.current = true
  }

  function handleImageDragEnd() {
    if (!canDragToCover) {
      return
    }

    setCoverDropActive(false)
    window.setTimeout(() => {
      shouldSuppressClickRef.current = false
    }, 0)
  }

  function handleRemoveImage(image: GridImageItem) {
    if (props.mode === 'mixed') {
      if (image.kind === 'pending') {
        props.onRemovePending?.(image.id)
        return
      }

      props.onRemovePersisted?.(image.id)
      return
    }

    props.onRemove?.(image.id)
  }

  function handleOpenLightbox(imageId: string) {
    if (shouldSuppressClickRef.current) {
      return
    }

    const nextIndex = lightboxImages.findIndex((image) => image.id === imageId)

    if (nextIndex === -1) {
      return
    }

    setLightboxIndex(nextIndex)
  }

  function handleLightboxPrevious() {
    setLightboxIndex((currentIndex) => {
      if (currentIndex === null || lightboxImages.length === 0) {
        return currentIndex
      }

      return currentIndex === 0 ? lightboxImages.length - 1 : currentIndex - 1
    })
  }

  function handleLightboxNext() {
    setLightboxIndex((currentIndex) => {
      if (currentIndex === null || lightboxImages.length === 0) {
        return currentIndex
      }

      return currentIndex === lightboxImages.length - 1 ? 0 : currentIndex + 1
    })
  }

  return (
    <div className="space-y-3">
      {showHeader ? (
        <div className="flex items-center justify-between gap-3">
          {title ? (
            <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
          ) : (
            <div />
          )}
          {showCount ? (
          <span className="text-xs text-slate-500">
            {orderedItems.length} imagen{orderedItems.length === 1 ? '' : 'es'}
          </span>
          ) : null}
        </div>
      ) : null}

      <div className={gridClassName}>
        {showCover && coverItem ? (
          <article
            className={['flex w-full items-center justify-center', LOCATION_TOP_STACK_PANEL_HEIGHT_CLASS].join(' ')}
            onDragLeave={handleCoverDragLeave}
            onDragOver={handleCoverDragOver}
            onDrop={handleCoverDrop}
          >
            <div
              className={[
                'group relative cursor-zoom-in',
                LOCATION_TOP_STACK_PANEL_SURFACE_CLASS,
                coverDropActive ? 'border-sky-500 bg-sky-50' : '',
              ].join(' ')}
              onClick={() => handleOpenLightbox(coverItem.id)}
            >
              <img
                src={coverItem.previewUrl}
                alt={coverItem.title}
                className="h-full w-full object-cover"
              />
              <span className="absolute left-3 top-3 inline-flex rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm">
                Portada
              </span>
              {(hasRemoveAction || (onSetCoverHandler && galleryItems.length > 0)) ? (
                <div className="pointer-events-none absolute inset-0 bg-slate-950/0 transition group-hover:bg-slate-950/20">
                  <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2 opacity-0 transition duration-200 group-hover:opacity-100">
                    {hasRemoveAction ? (
                      <button
                        type="button"
                        disabled={props.isLocked}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleRemoveImage(coverItem)
                        }}
                        className={[
                          'inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium shadow-sm backdrop-blur transition disabled:cursor-not-allowed disabled:opacity-50',
                          overlayActionClassName('danger'),
                        ].join(' ')}
                      >
                        <TrashIcon />
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {coverItem.errorMessage ? (
              <div className="border-t border-red-200 bg-red-50 px-4 py-3">
                <p className="text-xs leading-5 text-red-700">
                  {coverItem.errorMessage}
                </p>
              </div>
            ) : null}
          </article>
        ) : showCover && props.emptyCoverAction ? (
          <div className={['flex w-full items-center justify-center text-center', LOCATION_TOP_STACK_PANEL_HEIGHT_CLASS].join(' ')}>
            <div className="w-full">{props.emptyCoverAction}</div>
          </div>
        ) : null}

        {showGallery
          ? galleryItems.map((image) => (
          <article
            key={image.id}
            className="overflow-hidden border border-dashed border-slate-300 bg-slate-50"
            draggable={canDragToCover && !props.isLocked}
            onDragEnd={handleImageDragEnd}
            onDragStart={(event) => handleImageDragStart(event, image.id)}
          >
            <div
              className="group relative aspect-[16/10] cursor-zoom-in bg-slate-100"
              onClick={() => handleOpenLightbox(image.id)}
            >
              <img
                src={image.previewUrl}
                alt={image.title}
                className="h-full w-full object-cover"
              />
              {(onSetCoverHandler || hasRemoveAction) ? (
                <div className="pointer-events-none absolute inset-0 bg-slate-950/0 transition group-hover:bg-slate-950/20">
                  <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2 opacity-0 transition duration-200 group-hover:opacity-100">
                    {hasRemoveAction ? (
                      <button
                        type="button"
                        disabled={props.isLocked}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleRemoveImage(image)
                        }}
                        className={[
                          'inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium shadow-sm backdrop-blur transition disabled:cursor-not-allowed disabled:opacity-50',
                          overlayActionClassName('danger'),
                        ].join(' ')}
                      >
                        <TrashIcon />
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {image.errorMessage ? (
              <div className="border-t border-red-200 bg-red-50 px-4 py-3">
                <p className="text-xs leading-5 text-red-700">
                  {image.errorMessage}
                </p>
              </div>
            ) : null}
          </article>
            ))
          : null}

        {showGallery && props.emptyGalleryAction ? (
          <div className="flex aspect-[16/10] items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
            <div className="w-full">{props.emptyGalleryAction}</div>
          </div>
        ) : null}
      </div>

      {lightboxIndex !== null ? (
        <ImageLightbox
          currentIndex={lightboxIndex}
          images={lightboxImages}
          onClose={() => setLightboxIndex(null)}
          onNext={handleLightboxNext}
          onPrevious={handleLightboxPrevious}
        />
      ) : null}
    </div>
  )
}

export default LocationImagesGrid
