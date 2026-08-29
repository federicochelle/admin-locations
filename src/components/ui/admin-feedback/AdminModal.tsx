import * as Dialog from '@radix-ui/react-dialog'
import Button from '../Button'
import SaveProgressModal from '../SaveProgressModal'
import AdminFeedbackIcon from './AdminFeedbackIcon'
import type { AdminModalState } from './admin-feedback.types'

type AdminModalProps = {
  modal: AdminModalState | null
  onCancel: () => void
  onConfirm: () => void
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'No pudimos completar la acción. Intentá nuevamente.'
}

function AdminModal({ modal, onCancel, onConfirm }: AdminModalProps) {
  if (!modal) {
    return null
  }

  const isAlert = modal.kind === 'alert'
  const options = modal.options
  const alertOptions = isAlert
    ? (options as {
        description?: string
        hideProgressBar?: boolean
        hideProgressPercentage?: boolean
        iconVariant?: 'success'
        progressPercentage?: number
      })
    : null
  const variant = options.variant ?? (isAlert ? 'info' : 'confirm')
  const confirmLabel = isAlert
    ? (options as { closeLabel?: string }).closeLabel ?? 'Entendido'
    : (options as { confirmLabel?: string }).confirmLabel ?? 'Confirmar'
  const cancelLabel = (options as { cancelLabel?: string }).cancelLabel ?? 'Cancelar'
  const progressPercentage =
    isAlert && typeof alertOptions?.progressPercentage === 'number'
      ? Math.max(0, Math.min(100, Math.round(alertOptions.progressPercentage)))
      : null

  if (isAlert && progressPercentage !== null) {
    return (
      <SaveProgressModal
        actions={[
          {
            label: confirmLabel,
            onClick: onConfirm,
            variant: 'primary',
          },
        ]}
        hideProgressBar={alertOptions?.hideProgressBar}
        hidePercentage={alertOptions?.hideProgressPercentage}
        iconVariant={alertOptions?.iconVariant}
        message={alertOptions?.description}
        percentage={progressPercentage}
        title={options.title}
      />
    )
  }

  return (
    <Dialog.Root
      open
      modal
      onOpenChange={(isOpen) => {
        if (!isOpen && !modal.isConfirming) {
          onCancel()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl focus:outline-none sm:p-7">
          <div className="space-y-5">
            <span
              className={[
                'inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-900',
                variant === 'success' ? 'bg-emerald-50 text-emerald-700' : '',
              ].join(' ')}
            >
              <AdminFeedbackIcon variant={variant} />
            </span>

            <div className="space-y-2 text-center">
              <Dialog.Title className="text-2xl font-semibold tracking-tight text-slate-950">
                {options.title}
              </Dialog.Title>
              {options.description ? (
                <Dialog.Description className="text-sm leading-6 text-slate-600">
                  {options.description}
                </Dialog.Description>
              ) : null}
            </div>

            {modal.errorMessage ? (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {getErrorMessage(new Error(modal.errorMessage))}
              </div>
            ) : null}

            <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-center">
              {!isAlert ? (
                <Button variant="secondary" onClick={onCancel} disabled={modal.isConfirming}>
                  {cancelLabel}
                </Button>
              ) : null}
              <button
                type="button"
                onClick={onConfirm}
                disabled={modal.isConfirming}
                className={[
                  'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60',
                  variant === 'danger'
                    ? 'bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-100'
                    : 'bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-200',
                ].join(' ')}
              >
                {modal.isConfirming ? 'Procesando...' : confirmLabel}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default AdminModal
