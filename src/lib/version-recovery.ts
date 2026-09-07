import * as Sentry from '@sentry/react'
import { reportAdminError } from './admin-error-reporting'
import { unsavedRegistry } from './unsaved-critical-state'

export const RELOAD_MARKER = 'admin.version-recovery.reload.v1'
export type RecoveryState = { kind: 'idle' | 'available' | 'manual' | 'reloading'; version?: string }
type Source = 'chunk' | 'focus'
type Dependencies = {
  currentRelease: string
  readVersion: () => Promise<string>
  storage: () => Pick<Storage, 'getItem' | 'setItem'>
  dirty: () => boolean
  reload: () => void
  flush: () => Promise<unknown>
  report: typeof reportAdminError
}
export function isChunkLoadError(error: unknown): boolean {
  const message = typeof error === 'object' && error !== null && 'message' in error ? error.message : error
  return typeof message === 'string' && /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading (?:CSS )?chunk .+ failed|Unable to preload CSS/i.test(message)
}
export function isBuildId(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[a-f0-9]{7,64}|local-[a-f0-9]{7,64}|development)$/.test(value)
}
export function createVersionRecovery(deps: Dependencies) {
  let state: RecoveryState = { kind: 'idle' }
  const listeners = new Set<() => void>()
  let checking = false
  let incident: unknown
  let navigating = false
  const set = (next: RecoveryState) => { state = next; listeners.forEach(listener => listener()) }
  const report = (stage: string, source: Source, version?: string, retryConsumed = false) => {
    try {
      // A separate recovery decision, not another capture of the original upload error.
      deps.report(null, { operation: 'app.version_recovery', module: 'app', stage,
        outcome: 'partial', userFacing: true, extraSafeContext: {
          current_release: deps.currentRelease, available_release: version,
          recovery: stage, source, asset_type: source === 'chunk' ? 'dynamic_import' : 'none',
          retry_consumed: retryConsumed, dirty_state: deps.dirty(),
        } })
    } catch { /* Telemetry must not prevent recovery. */ }
  }
  async function check(source: Source, error?: unknown) {
    if (source === 'chunk') {
      if (!isChunkLoadError(error)) return
      incident = error
    }
    if (checking || navigating) return
    checking = true
    try {
      let consumed = false
      let storageAvailable = true
      try { consumed = deps.storage().getItem(RELOAD_MARKER) !== null } catch { storageAvailable = false }
      if (source === 'chunk' && consumed) {
        report('failed_after_reload', source, undefined, true)
        set({ kind: 'manual' })
        return
      }
      let version: string
      try {
        version = await deps.readVersion()
        if (!isBuildId(version)) throw new Error('Invalid version metadata')
      } catch {
        if (incident) {
          report('version_check', 'chunk')
          set({ kind: 'manual' })
        }
        return
      }
      if (version === deps.currentRelease) {
        if (incident) { report('chunk_error', 'chunk', version); set({ kind: 'manual' }) }
        return
      }
      const hasIncident = incident !== undefined
      const actualSource = hasIncident ? 'chunk' : source
      if (deps.dirty()) {
        report('blocked_dirty_state', actualSource, version, consumed)
        set({ kind: 'available', version })
        return
      }
      // Focus checks announce updates; only an import failure authorizes auto-reload.
      if (!hasIncident || consumed || !storageAvailable) {
        report(consumed && hasIncident ? 'failed_after_reload' : 'version_check', actualSource, version, consumed)
        set({ kind: hasIncident ? 'manual' : 'available', version })
        return
      }
      report('reload', 'chunk', version)
      try { deps.storage().setItem(RELOAD_MARKER, '1') } catch {
        set({ kind: 'manual', version })
        return
      }
      set({ kind: 'reloading', version })
      // Bound the wait even if a broken SDK ignores its own timeout.
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([Promise.resolve().then(deps.flush), new Promise(resolve => { timer = setTimeout(resolve, 900) })])
      } catch { /* Continue without telemetry. */ } finally { clearTimeout(timer) }
      // The user may have started typing while the version check/flush was pending.
      if (deps.dirty()) {
        report('blocked_dirty_state', 'chunk', version, true)
        set({ kind: 'available', version })
        return
      }
      navigating = true
      deps.reload()
    } finally { checking = false }
  }
  return {
    check,
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    manualReload() { navigating = true; deps.reload() },
    isNavigating: () => navigating,
  }
}
export const versionRecovery = createVersionRecovery({
  currentRelease: import.meta.env.VITE_APP_RELEASE,
  async readVersion() {
    const response = await fetch('/version.json', { cache: 'no-store', signal: AbortSignal.timeout(4000) })
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Version unavailable')
    const data: unknown = await response.json()
    if (!data || typeof data !== 'object' || !('version' in data) || !isBuildId(data.version)) throw new Error('Invalid version metadata')
    return data.version
  },
  storage: () => window.sessionStorage,
  dirty: unsavedRegistry.hasUnsavedCriticalState,
  reload: () => window.location.reload(),
  flush: () => Sentry.flush(700),
  report: reportAdminError,
})

export function installVersionRecovery() {
  const preload = (event: Event) => {
    // Preserve rejection so the existing image catch and original diagnostics run.
    void versionRecovery.check('chunk', (event as Event & { payload?: unknown }).payload)
  }
  window.addEventListener('vite:preloadError', preload)
  return () => window.removeEventListener('vite:preloadError', preload)
}
