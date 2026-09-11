import { installVersionRecovery } from './lib/version-recovery'
import { sanitizeAdminSentryEvent } from './lib/admin-error-reporting'
import { adminReplayOptions, createAdminReplayTransport } from './lib/admin-session-replay'
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
  integrations: isSentryEnabled ? [Sentry.replayIntegration(adminReplayOptions)] : [],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  transport: options => createAdminReplayTransport(Sentry.makeFetchTransport(options)),
  release: import.meta.env.VITE_APP_RELEASE?.trim() || undefined,
  beforeSend: sanitizeAdminSentryEvent,
})
Sentry.setTag('app', 'admin')

const uninstallVersionRecovery = installVersionRecovery()
if (import.meta.hot) import.meta.hot.dispose(uninstallVersionRecovery)

createRoot(document.getElementById('root')!, {
  onCaughtError: Sentry.reactErrorHandler(),
  onUncaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
