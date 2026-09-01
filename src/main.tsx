import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'react-phone-number-input/style.css'
import './index.css'
import App from './App'

const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim() || ''
const isSentryEnabled = import.meta.env.PROD && sentryDsn.length > 0

Sentry.init({
  dsn: sentryDsn,
  enabled: isSentryEnabled,
  environment: import.meta.env.MODE,
  sendDefaultPii: false,
})

createRoot(document.getElementById('root')!, {
  onCaughtError: Sentry.reactErrorHandler(),
  onUncaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
