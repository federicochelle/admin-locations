import { createContext } from 'react'
import type { AdminFeedbackContextValue } from './admin-feedback.types'

export const AdminFeedbackContext = createContext<AdminFeedbackContextValue | null>(null)
