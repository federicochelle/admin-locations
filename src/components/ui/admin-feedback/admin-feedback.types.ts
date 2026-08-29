export type AdminModalVariant =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'confirm'
  | 'danger'

export type AdminToastVariant = 'success' | 'info' | 'warning' | 'error'

export type AdminConfirmOptions = {
  cancelLabel?: string
  confirmLabel?: string
  description?: string
  onConfirm?: () => Promise<void> | void
  title: string
  variant?: Extract<AdminModalVariant, 'confirm' | 'danger' | 'warning'>
}

export type AdminAlertOptions = {
  closeLabel?: string
  description?: string
  hideProgressBar?: boolean
  hideProgressPercentage?: boolean
  iconVariant?: 'success'
  progressPercentage?: number
  title: string
  variant?: Exclude<AdminModalVariant, 'confirm' | 'danger'>
}

export type AdminLoadingOptions = {
  description?: string
  progress?: {
    enabled: boolean
    message?: string
  }
  title: string
}

export type AdminLoadingState = AdminLoadingOptions & {
  id: number
  progressPercentage: number | null
}

export type AdminToastOptions = {
  description?: string
  duration?: number | null
  title: string
  variant?: AdminToastVariant
}

export type AdminToast = AdminToastOptions & {
  id: string
  variant: AdminToastVariant
}

export type AdminModalState = {
  errorMessage: string | null
  isConfirming: boolean
  kind: 'alert' | 'confirm'
  options: AdminAlertOptions | AdminConfirmOptions
}

export type AdminFeedbackContextValue = {
  alert: (options: AdminAlertOptions) => Promise<void>
  confirm: (options: AdminConfirmOptions) => Promise<boolean>
  hideLoading: () => void
  showError: (options: Omit<AdminAlertOptions, 'variant'>) => Promise<void>
  showLoading: (options: AdminLoadingOptions) => void
  toast: (options: AdminToastOptions) => string
  withLoading: <T>(input: AdminLoadingOptions & { action: () => Promise<T> }) => Promise<T>
}
