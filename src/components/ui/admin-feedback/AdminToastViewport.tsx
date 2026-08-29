import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import AdminFeedbackIcon from './AdminFeedbackIcon'
import type { AdminToast } from './admin-feedback.types'

type AdminToastViewportProps = {
  onDismiss: (toastId: string) => void
  toasts: AdminToast[]
}

function ToastItem({ toast, onDismiss }: { toast: AdminToast; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.duration === null) {
      return
    }

    const timeoutId = window.setTimeout(onDismiss, toast.duration ?? 4000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [onDismiss, toast.duration])

  const isUrgent = toast.variant === 'error' || toast.variant === 'warning'

  return (
    <div
      role={isUrgent ? 'alert' : 'status'}
      className="pointer-events-auto rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <span
          className={[
            'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-900',
            toast.variant === 'success' ? 'bg-emerald-50 text-emerald-700' : '',
          ].join(' ')}
        >
          <AdminFeedbackIcon className="h-4 w-4" variant={toast.variant} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description ? <p className="mt-1 text-sm leading-5">{toast.description}</p> : null}
        </div>
        <button
          type="button"
          aria-label={`Cerrar: ${toast.title}`}
          onClick={onDismiss}
          className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-current transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </div>
  )
}

function AdminToastViewport({ onDismiss, toasts }: AdminToastViewportProps) {
  if (typeof document === 'undefined' || toasts.length === 0) {
    return null
  }

  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>,
    document.body,
  )
}

export default AdminToastViewport
