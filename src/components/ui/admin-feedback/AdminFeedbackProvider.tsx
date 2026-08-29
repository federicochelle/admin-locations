import { useEffect, useRef, useState, type PropsWithChildren } from 'react'
import AdminLoadingModal from './AdminLoadingModal'
import AdminModal from './AdminModal'
import AdminToastViewport from './AdminToastViewport'
import { AdminFeedbackContext } from './admin-feedback.context'
import type {
  AdminAlertOptions,
  AdminConfirmOptions,
  AdminLoadingOptions,
  AdminLoadingState,
  AdminModalState,
  AdminToast,
  AdminToastOptions,
} from './admin-feedback.types'

type ActiveModal = AdminModalState & {
  resolve: (confirmed: boolean) => void
}

const SIMULATED_LOADING_START = 12
const SIMULATED_LOADING_MAX = 94
const SIMULATED_LOADING_INTERVAL_MS = 180
const SIMULATED_LOADING_COMPLETE_DELAY_MS = 240

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'No pudimos completar la acción. Intentá nuevamente.'
}

function getNextProgressPercentage(current: number) {
  if (current >= SIMULATED_LOADING_MAX) {
    return SIMULATED_LOADING_MAX
  }

  const remaining = SIMULATED_LOADING_MAX - current
  const step = Math.max(1, Math.round(remaining * 0.18))

  return Math.min(SIMULATED_LOADING_MAX, current + step)
}

export function AdminFeedbackProvider({ children }: PropsWithChildren) {
  const activeModalRef = useRef<ActiveModal | null>(null)
  const nextLoadingIdRef = useRef(0)
  const nextToastIdRef = useRef(0)
  const loadingProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const loadingCompletionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [modal, setModal] = useState<AdminModalState | null>(null)
  const [loading, setLoading] = useState<AdminLoadingState | null>(null)
  const [toasts, setToasts] = useState<AdminToast[]>([])

  function clearLoadingTimers() {
    if (loadingProgressIntervalRef.current) {
      clearInterval(loadingProgressIntervalRef.current)
      loadingProgressIntervalRef.current = null
    }

    if (loadingCompletionTimeoutRef.current) {
      clearTimeout(loadingCompletionTimeoutRef.current)
      loadingCompletionTimeoutRef.current = null
    }
  }

  function startSimulatedLoadingProgress(loadingId: number) {
    clearLoadingTimers()
    loadingProgressIntervalRef.current = setInterval(() => {
      setLoading((currentLoading) => {
        if (
          !currentLoading ||
          currentLoading.id !== loadingId ||
          currentLoading.progressPercentage === null
        ) {
          return currentLoading
        }

        const nextProgressPercentage = getNextProgressPercentage(
          currentLoading.progressPercentage,
        )

        if (nextProgressPercentage === currentLoading.progressPercentage) {
          return currentLoading
        }

        return {
          ...currentLoading,
          progressPercentage: nextProgressPercentage,
        }
      })
    }, SIMULATED_LOADING_INTERVAL_MS)
  }

  function completeLoadingProgress(loadingId: number) {
    clearLoadingTimers()

    setLoading((currentLoading) => {
      if (!currentLoading || currentLoading.id !== loadingId) {
        return currentLoading
      }

      return {
        ...currentLoading,
        progressPercentage: 100,
      }
    })

    return new Promise<void>((resolve) => {
      loadingCompletionTimeoutRef.current = setTimeout(() => {
        loadingCompletionTimeoutRef.current = null
        resolve()
      }, SIMULATED_LOADING_COMPLETE_DELAY_MS)
    })
  }

  function closeModal(confirmed: boolean) {
    const currentModal = activeModalRef.current

    if (!currentModal || currentModal.isConfirming) {
      return
    }

    activeModalRef.current = null
    setModal(null)
    currentModal.resolve(confirmed)
  }

  function openModal(
    kind: ActiveModal['kind'],
    options: AdminAlertOptions | AdminConfirmOptions,
  ): Promise<boolean> {
    if (activeModalRef.current?.isConfirming) {
      return Promise.resolve(false)
    }

    closeModal(false)

    return new Promise((resolve) => {
      const nextModal: ActiveModal = {
        errorMessage: null,
        isConfirming: false,
        kind,
        options,
        resolve,
      }

      activeModalRef.current = nextModal
      setModal(nextModal)
    })
  }

  async function confirm(options: AdminConfirmOptions) {
    return openModal('confirm', options)
  }

  async function alert(options: AdminAlertOptions) {
    await openModal('alert', options)
  }

  async function showError(options: Omit<AdminAlertOptions, 'variant'>) {
    await alert({
      ...options,
      variant: 'error',
    })
  }

  async function handleConfirm() {
    const currentModal = activeModalRef.current

    if (!currentModal || currentModal.isConfirming) {
      return
    }

    if (currentModal.kind === 'alert') {
      closeModal(true)
      return
    }

    const onConfirm = (currentModal.options as AdminConfirmOptions).onConfirm

    if (!onConfirm) {
      closeModal(true)
      return
    }

    currentModal.isConfirming = true
    currentModal.errorMessage = null
    setModal({ ...currentModal })

    try {
      await onConfirm()
      currentModal.isConfirming = false
      closeModal(true)
    } catch (error) {
      currentModal.isConfirming = false
      currentModal.errorMessage = getErrorMessage(error)
      setModal({ ...currentModal })
    }
  }

  function showLoading(options: AdminLoadingOptions) {
    nextLoadingIdRef.current += 1
    clearLoadingTimers()
    setLoading({
      ...options,
      id: nextLoadingIdRef.current,
      progressPercentage: options.progress?.enabled ? SIMULATED_LOADING_START : null,
    })
  }

  function hideLoading() {
    clearLoadingTimers()
    setLoading(null)
  }

  async function withLoading<T>(input: AdminLoadingOptions & { action: () => Promise<T> }) {
    nextLoadingIdRef.current += 1
    const loadingId = nextLoadingIdRef.current
    const { action, description, progress, title } = input

    clearLoadingTimers()
    setLoading({
      description,
      id: loadingId,
      progress,
      progressPercentage: progress?.enabled ? SIMULATED_LOADING_START : null,
      title,
    })

    if (progress?.enabled) {
      startSimulatedLoadingProgress(loadingId)
    }

    try {
      return await action()
    } finally {
      if (progress?.enabled) {
        await completeLoadingProgress(loadingId)
      } else {
        clearLoadingTimers()
      }

      setLoading((currentLoading) =>
        currentLoading?.id === loadingId ? null : currentLoading,
      )
    }
  }

  function toast(options: AdminToastOptions) {
    nextToastIdRef.current += 1
    const toastId = `admin-toast-${nextToastIdRef.current}`
    const variant = options.variant ?? 'info'
    const nextToast: AdminToast = {
      ...options,
      id: toastId,
      variant,
    }

    setToasts((currentToasts) => [...currentToasts, nextToast].slice(-4))

    return toastId
  }

  function dismissToast(toastId: string) {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId))
  }

  useEffect(() => {
    return () => {
      clearLoadingTimers()
      const currentModal = activeModalRef.current

      if (currentModal) {
        currentModal.resolve(false)
      }
    }
  }, [])

  const value = {
    alert,
    confirm,
    hideLoading,
    showError,
    showLoading,
    toast,
    withLoading,
  }

  return (
    <AdminFeedbackContext.Provider value={value}>
      {children}
      <AdminModal modal={modal} onCancel={() => closeModal(false)} onConfirm={() => void handleConfirm()} />
      <AdminLoadingModal loading={loading} />
      <AdminToastViewport toasts={toasts} onDismiss={dismissToast} />
    </AdminFeedbackContext.Provider>
  )
}
