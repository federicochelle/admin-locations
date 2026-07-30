import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import Button from '../../components/ui/Button'

type LocationValidationModalProps = {
  isOpen: boolean
  messages: string[]
  onClose: () => void
}

function LocationValidationModal({
  isOpen,
  messages,
  onClose,
}: LocationValidationModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <h2 id={titleId} className="text-2xl font-semibold tracking-tight text-slate-950">
              Faltan campos obligatorios
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              Completá los siguientes datos antes de guardar la locación.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
            <ul className="space-y-2 text-sm text-amber-900">
              {messages.map((message) => (
                <li key={message} className="flex gap-2">
                  <span aria-hidden="true" className="mt-0.5 text-amber-700">
                    •
                  </span>
                  <span>{message}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Entendido
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default LocationValidationModal
