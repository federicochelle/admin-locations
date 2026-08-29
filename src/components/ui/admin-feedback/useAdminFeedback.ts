import { useContext } from 'react'
import { AdminFeedbackContext } from './admin-feedback.context'

export function useAdminFeedback() {
  const context = useContext(AdminFeedbackContext)

  if (!context) {
    throw new Error('useAdminFeedback debe usarse dentro de AdminFeedbackProvider.')
  }

  return context
}
