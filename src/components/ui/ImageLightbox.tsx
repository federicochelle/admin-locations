import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

export type ImageLightboxItem = {
  id: string
  title: string
  url: string
}

type ImageLightboxProps = {
  currentIndex: number
  images: ImageLightboxItem[]
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function ImageLightbox({
  currentIndex,
  images,
  onClose,
  onNext,
  onPrevious,
}: ImageLightboxProps) {
  const dialogTitleId = useId()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const activeImage = images[currentIndex] ?? null
  const hasMultipleImages = images.length > 1

  useEffect(() => {
    if (!activeImage) {
      return
    }

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (!hasMultipleImages) {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onPrevious()
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActiveElementRef.current?.focus()
    }
  }, [activeImage, hasMultipleImages, onClose, onNext, onPrevious])

  if (!activeImage || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/88 px-4 py-4 sm:px-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="relative flex h-full w-full max-w-7xl items-center justify-center"
      >
        <h2 id={dialogTitleId} className="sr-only">
          {activeImage.title}
        </h2>

        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Cerrar imagen"
          onClick={onClose}
          className="absolute right-0 top-0 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <CloseIcon />
        </button>

        {hasMultipleImages ? (
          <button
            type="button"
            aria-label="Imagen anterior"
            onClick={onPrevious}
            className="absolute left-0 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ArrowLeftIcon />
          </button>
        ) : null}

        <figure className="flex h-full w-full flex-col items-center justify-center gap-4 px-12 py-12 sm:px-16">
          <img
            src={activeImage.url}
            alt={activeImage.title}
            className="max-h-full w-full object-contain"
          />

          <figcaption className="flex items-center gap-3 text-center text-sm text-white/90">
            <span>{activeImage.title}</span>
            {hasMultipleImages ? (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
                {currentIndex + 1} / {images.length}
              </span>
            ) : null}
          </figcaption>
        </figure>

        {hasMultipleImages ? (
          <button
            type="button"
            aria-label="Imagen siguiente"
            onClick={onNext}
            className="absolute right-0 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ArrowRightIcon />
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export default ImageLightbox
