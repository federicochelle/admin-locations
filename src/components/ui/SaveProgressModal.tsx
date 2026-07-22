import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Button from './Button'

export type SaveProgressModalAction = {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

type SaveProgressModalProps = {
  actions?: SaveProgressModalAction[]
  errorMessage?: string | null
  message: string
  percentage: number
  title: string
}

function SaveProgressModal({
  actions = [],
  errorMessage = null,
  message,
  percentage,
  title,
}: SaveProgressModalProps) {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-progress-modal-title"
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="space-y-5">
          <div>
            <h2
              id="save-progress-modal-title"
              className="text-2xl font-semibold tracking-tight text-slate-950"
            >
              {title}
            </h2>
          </div>

          <div className="space-y-3">
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className={[
                  'h-full rounded-full transition-[width] duration-300 ease-out',
                  errorMessage ? 'bg-red-500' : 'bg-slate-900',
                ].join(' ')}
                style={{ width: `${percentage}%` }}
              />
            </div>

            <p className="text-3xl font-semibold tracking-tight text-slate-950">
              {percentage}%
            </p>

            <p className="text-sm leading-6 text-slate-600">{message}</p>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {actions.length > 0 ? (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant={action.variant ?? 'secondary'}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default SaveProgressModal
