import * as Dialog from '@radix-ui/react-dialog'
import SaveProgressModal from '../SaveProgressModal'
import type { AdminLoadingState } from './admin-feedback.types'

type AdminLoadingModalProps = {
  loading: AdminLoadingState | null
}

function AdminLoadingModal({ loading }: AdminLoadingModalProps) {
  if (!loading) {
    return null
  }

  if (loading.progress?.enabled && loading.progressPercentage !== null) {
    return (
      <SaveProgressModal
        message={loading.progress.message}
        percentage={loading.progressPercentage}
        title={loading.title}
      />
    )
  }

  return (
    <Dialog.Root open modal>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl focus:outline-none sm:p-7">
          <div className="flex flex-col items-center gap-4">
            <span
              aria-hidden="true"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-900"
            >
              <svg
                className="h-6 w-6 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 12a8 8 0 1 1-2.3-5.7" />
              </svg>
            </span>
            <div className="space-y-2">
              <Dialog.Title className="text-xl font-semibold tracking-tight text-slate-950">
                {loading.title}
              </Dialog.Title>
              {loading.description ? (
                <Dialog.Description className="text-sm leading-6 text-slate-600">
                  {loading.description}
                </Dialog.Description>
              ) : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default AdminLoadingModal
