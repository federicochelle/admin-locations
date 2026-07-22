import Button from '../../components/ui/Button'
import { createPortal } from 'react-dom'

type ImageSelectionTarget = 'cover' | 'gallery'

type LocationImageSourceModalProps = {
  isDropboxImporting: boolean
  isOpen: boolean
  onChooseDevice: () => void
  onChooseDropbox: () => void
  onClose: () => void
  target: ImageSelectionTarget | null
  title?: string
}

function DeviceImageIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.3" />
      <path d="m21 15-5.5-5.5L8 17" />
      <path d="M12 3v4" />
      <path d="m10 5 2-2 2 2" />
    </svg>
  )
}

function DropboxIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7 4 5 3-5 3-5-3 5-3Z" />
      <path d="m17 4 5 3-5 3-5-3 5-3Z" />
      <path d="m7 12 5 3-5 3-5-3 5-3Z" />
      <path d="m17 12 5 3-5 3-5-3 5-3Z" />
      <path d="m7 19 5 3 5-3" />
    </svg>
  )
}

function getModalTitle(target: ImageSelectionTarget | null) {
  return target === 'cover' ? 'Agregar portada' : 'Agregar imágenes'
}

function LocationImageSourceModal({
  isDropboxImporting,
  isOpen,
  onChooseDevice,
  onChooseDropbox,
  onClose,
  target,
  title,
}: LocationImageSourceModalProps) {
  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={() => {
        if (isDropboxImporting) {
          return
        }

        onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-image-source-modal-title"
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-6">
          <div>
            <h2
              id="location-image-source-modal-title"
              className="text-2xl font-semibold tracking-tight text-slate-950"
            >
              {title ?? getModalTitle(target)}
            </h2>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              className="flex min-h-12 w-full items-center justify-center gap-3"
              onClick={onChooseDevice}
              disabled={isDropboxImporting}
              aria-label="Seleccionar imágenes desde este dispositivo"
            >
              <DeviceImageIcon />
              <span>Desde este dispositivo</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex min-h-12 w-full items-center justify-center gap-3"
              onClick={onChooseDropbox}
              disabled={isDropboxImporting}
              aria-label="Importar imágenes desde Dropbox"
            >
              <DropboxIcon />
              <span>Importar desde Dropbox</span>
            </Button>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isDropboxImporting}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default LocationImageSourceModal
