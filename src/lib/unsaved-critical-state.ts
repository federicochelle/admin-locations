// Only booleans/snapshots in memory. Never persisted or sent to telemetry.
export function createUnsavedRegistry() {
  const entries = new Map<symbol, boolean>()
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(listener => listener())
  return {
    hasUnsavedCriticalState: () => [...entries.values()].some(Boolean),
    set(token: symbol, dirty: boolean) {
      if (entries.get(token) === dirty) return
      entries.set(token, dirty)
      notify()
    },
    remove(token: symbol) { if (entries.delete(token)) notify() },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  }
}
export const unsavedRegistry = createUnsavedRegistry()

export function formSnapshot(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
    }
    return entry
  }) ?? 'null'
}

export function createFormProtection(registry = unsavedRegistry) {
  const token = Symbol('form')
  let baseline: string | undefined
  let saved: string | undefined
  let incomplete = false
  let ignorePendingUntilSettled = false
  let latest = { snapshot: '', pending: false, enabled: true }
  return {
    update(snapshot: string, pending: boolean, enabled = true, initial?: string) {
      baseline ??= initial ?? snapshot
      if (initial !== undefined && saved === undefined) baseline = initial
      latest = { snapshot, pending, enabled }
      if (!pending) ignorePendingUntilSettled = false
      registry.set(token, enabled && (incomplete || snapshot !== (saved ?? baseline) || (pending && !ignorePendingUntilSettled)))
    },
    markIncomplete() { incomplete = true; registry.set(token, latest.enabled) },
    markSaved() {
      saved = latest.snapshot
      incomplete = false
      ignorePendingUntilSettled = latest.pending
      registry.set(token, false)
    },
    unregister() { registry.remove(token) },
  }
}
