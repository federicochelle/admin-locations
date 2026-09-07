import { useLayoutEffect, useState } from 'react'
import { createFormProtection, formSnapshot } from '../lib/unsaved-critical-state'

export function useUnsavedCriticalState(value: unknown, options: {
  pending?: boolean
  enabled?: boolean
  baseline?: unknown
} = {}) {
  const [protection] = useState(() => createFormProtection())
  const snapshot = formSnapshot(value)
  const baseline = options.baseline === undefined ? undefined : formSnapshot(options.baseline)
  useLayoutEffect(() => {
    protection.update(snapshot, options.pending ?? false, options.enabled ?? true, baseline)
  }, [protection, snapshot, baseline, options.pending, options.enabled])
  useLayoutEffect(() => () => protection.unregister(), [protection])
  return protection
}
