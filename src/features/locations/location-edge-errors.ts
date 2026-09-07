import { annotateAdminError } from '../../lib/admin-error-reporting'

// The current Edge contract has no structured stage/checkpoints. Only these exact
// server messages prove which step failed. Never send the body or infer success
// from a generic 5xx/network error. Server-side checkpoints remain Phase 2.
const deleteFailures: Record<string, { stage: string; outcome: 'partial' | 'failed' | 'unknown' }> = {
  'Could not delete location.': { stage: 'db_delete', outcome: 'partial' },
  'Could not delete image metadata.': { stage: 'db_delete', outcome: 'partial' },
  'Could not load location images.': { stage: 'request', outcome: 'failed' },
  'Could not load image metadata.': { stage: 'request', outcome: 'failed' },
  'Location image is missing its Cloudflare storage key.': { stage: 'cloudflare_cleanup', outcome: 'unknown' },
  'Could not reach Cloudflare Images API.': { stage: 'cloudflare_cleanup', outcome: 'unknown' },
}

export async function annotateLocationDeleteFailure(error: unknown) {
  if (typeof error !== 'object' || error === null || !('context' in error) || !(error.context instanceof Response)) {
    return annotateAdminError(error, { outcome: 'unknown' })
  }
  try {
    const body: unknown = await error.context.clone().json()
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
      const diagnostic = Object.hasOwn(deleteFailures, body.error) ? deleteFailures[body.error] : undefined
      if (diagnostic) return annotateAdminError(error, diagnostic)
    }
  } catch {
    // Keep the original transport error and UI message even if diagnostics fail.
  }
  return annotateAdminError(error, { outcome: 'unknown' })
}
