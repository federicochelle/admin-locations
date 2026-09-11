import * as Sentry from '@sentry/react'

export type AdminErrorContext = {
  operation: string
  module?: string
  resourceType?: string
  resourceId?: string | null
  stage?: string
  route?: string
  httpStatus?: number
  supabaseCode?: string
  retryable?: boolean | 'unknown'
  userFacing?: boolean
  outcome?: 'failed' | 'partial' | 'unknown'
  provider?: string
  correlationId?: string
  level?: 'error' | 'warning'
  extraSafeContext?: Record<string, unknown>
}

// Metadata stays out of Error properties: never serialize a provider error/body.
const errorContext = new WeakMap<object, Partial<AdminErrorContext>>()
const suppressed = new WeakSet<object>()
const operations = new Set([
  'app.version_recovery', 'location.create', 'location.update', 'location.delete', 'location.load',
  'location.list', 'location.options', 'location.archive', 'location.publish',
  'location.image.prepare', 'location.image.delete', 'location.image.replace',
  'location.image.load', 'location.image.upload', 'location.analysis',
  'location.owner.create', 'location.category.create', 'location.zone.create',
])
const stages = new Set([
  'chunk_error', 'version_check', 'reload', 'blocked_dirty_state', 'failed_after_reload',
  'validation', 'payload', 'load', 'request', 'slug', 'owner.inline',
  'location.insert', 'location.update', 'relations.features', 'relations.tags',
  'images.prepare', 'images.convert', 'images.detect', 'images.blur',
  'images.upload_url', 'images.upload', 'images.finalize', 'images.delete',
  'images.replace', 'images.source', 'images.refresh', 'activity_log',
  'cloudflare_cleanup', 'db_delete', 'options', 'analysis', 'completed',
])
const providers = new Set(['supabase', 'cloudflare', 'google_vision', 'browser', 'dropbox'])
const resourceTypes = new Set(['location', 'image', 'owner', 'category', 'zone'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const numericKeys = new Set(['image_count', 'image_bytes', 'image_index', 'attempt', 'duration_ms', 'timeout_ms'])

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
}

function chain(error: unknown): object[] {
  const result: object[] = []
  let current = record(error)
  while (current && result.length < 10 && !result.includes(current)) {
    result.push(current)
    current = record(current.cause)
  }
  return result
}

export function normalizeAdminError(error: unknown, userMessage?: string): Error {
  if (error instanceof Error && (!userMessage || userMessage === error.message)) return error
  const fields = record(error)
  return new Error(userMessage ?? (typeof fields?.message === 'string' ? fields.message : 'Unexpected admin error'), { cause: error })
}

// Inner (more precise) stages win; outer callers can supply operation/ID/checkpoints.
export function annotateAdminError(error: unknown, context: Partial<AdminErrorContext>, userMessage?: string): Error {
  const normalized = normalizeAdminError(error, userMessage)
  errorContext.set(normalized, { ...context, ...errorContext.get(normalized) })
  return normalized
}

export async function withAdminErrorStage<T>(context: Partial<AdminErrorContext>, action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    throw annotateAdminError(error, context)
  }
}

// Expected local validation failures retain the same UI Error, without telemetry.
export function markExpectedAdminError(error: Error): Error {
  suppressed.add(error)
  return error
}

export function isExpectedAdminError(error: unknown): boolean {
  return error instanceof Error && suppressed.has(error)
}

// Only for a UI summary whose individual failures have already been reported.
export function suppressAdminErrorReport(error: Error): Error {
  suppressed.add(error)
  return error
}

export function createAdminCorrelationId(): string {
  try { return globalThis.crypto.randomUUID() } catch { return '' }
}

export function normalizeAdminRoute(route?: string): string {
  const path = (route ?? (typeof window !== 'undefined' ? window.location.pathname : '/')).split(/[?#]/)[0]
  const segments = new Set(['locations', 'new', 'edit', 'view', 'owners', 'categories', 'dashboard', 'login'])
  return '/' + path.split('/').filter(Boolean).slice(0, 6).map(part => segments.has(part) ? part : ':id').join('/')
}

function safeExtras(input?: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input ?? {})) {
    if (['current_release', 'available_release'].includes(key) && typeof value === 'string' && /^(?:[a-f0-9]{7,64}|local-[a-f0-9]{7,64}|development)$/.test(value)) safe[key] = value
    if (['retry_consumed', 'dirty_state', 'fallback_used'].includes(key) && typeof value === 'boolean') safe[key] = value
    if (key === 'source' && (value === 'chunk' || value === 'focus')) safe[key] = value
    if (key === 'asset_type' && (value === 'dynamic_import' || value === 'none')) safe[key] = value
    if (key === 'recovery' && typeof value === 'string' && ['chunk_error', 'version_check', 'reload', 'blocked_dirty_state', 'failed_after_reload'].includes(value)) safe[key] = value
    if (numericKeys.has(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0) safe[key] = value
    if (key === 'image_mime' && typeof value === 'string' && /^image\/(jpeg|png|webp|avif|heic|heif|gif)$/i.test(value)) safe[key] = value.toLowerCase()
    if (key === 'confirmed_stages' && Array.isArray(value)) safe[key] = value.filter(stage => stages.has(stage)).slice(0, 20)
    if (key === 'failed_stage' && typeof value === 'string' && stages.has(value)) safe[key] = value
    if (key === 'image_dimensions') {
      const dimensions = record(value)
      if (typeof dimensions?.width === 'number' && Number.isFinite(dimensions.width) && dimensions.width >= 0 && typeof dimensions.height === 'number' && Number.isFinite(dimensions.height) && dimensions.height >= 0) {
        safe[key] = { width: dimensions.width, height: dimensions.height }
      }
    }
  }
  return safe
}

function safeContext(context: AdminErrorContext) {
  const tags: Record<string, string> = {
    operation: operations.has(context.operation) ? context.operation : 'location.load',
    module: context.operation === 'app.version_recovery' ? 'app' : 'locations',
    resource_type: resourceTypes.has(context.resourceType ?? '') ? context.resourceType! : 'location',
    stage: stages.has(context.stage ?? '') ? context.stage! : 'request',
    retryable: typeof context.retryable === 'boolean' ? String(context.retryable) : 'unknown',
    user_facing: String(context.userFacing === true),
    outcome: ['failed', 'partial', 'unknown'].includes(context.outcome ?? '') ? context.outcome! : 'failed',
  }
  if (providers.has(context.provider ?? '')) tags.provider = context.provider!
  if (Number.isInteger(context.httpStatus) && context.httpStatus! >= 100 && context.httpStatus! <= 599) tags.http_status = String(context.httpStatus)
  if (/^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(context.supabaseCode ?? '')) tags.supabase_code = context.supabaseCode!
  const details = safeExtras(context.extraSafeContext)
  details.route = normalizeAdminRoute(context.route)
  details.failed_stage = tags.stage
  if ((!context.resourceType || context.resourceType === 'location' || context.resourceType === 'image') && uuid.test(context.resourceId ?? '')) details.location_id = context.resourceId
  if (uuid.test(context.correlationId ?? '')) details.correlation_id = context.correlationId
  return { tags, contexts: { admin_operation: details }, level: context.level === 'warning' ? 'warning' as const : 'error' as const }
}

export function createAdminErrorReporter(sentry: Pick<typeof Sentry, 'captureException' | 'captureMessage'>) {
  const reported = new WeakSet<object>()
  return (error: unknown, context: AdminErrorContext): string | undefined => {
    try {
      const causes = chain(error)
      if (causes.some(cause => reported.has(cause) || suppressed.has(cause))) return
      // Cancellation is ignored only when explicitly classified by the caller.
      const metadata = Object.assign({}, ...causes.map(cause => Object.fromEntries(Object.entries(errorContext.get(cause) ?? {}).filter(([, value]) => value !== undefined)))) as Partial<AdminErrorContext>
      const fields = causes.map(cause => record(cause)!)
      const code = fields.find(field => typeof field.code === 'string')?.code
      const httpStatus = fields.map(field => field.status ?? record(field.context)?.status).find(status => typeof status === 'number')
      const timeoutMs = fields.map(field => field.timeoutMs).find(timeout => typeof timeout === 'number' && Number.isFinite(timeout) && timeout >= 0)
      const timeoutStage = fields.map(field => field.stage).find(stage => typeof stage === 'string' && stages.has(stage))
      const timeoutProvider = fields.map(field => field.provider).find(provider => typeof provider === 'string' && providers.has(provider))
      const extraSafeContext: Record<string, unknown> = {
        ...context.extraSafeContext,
        ...(timeoutMs !== undefined ? { timeout_ms: timeoutMs } : {}),
        ...metadata.extraSafeContext,
      }
      const enriched = { ...context, ...metadata,
        httpStatus: metadata.httpStatus ?? context.httpStatus ?? httpStatus as number | undefined,
        provider: metadata.provider ?? context.provider ?? timeoutProvider as AdminErrorContext['provider'] | undefined,
        retryable: metadata.retryable ?? context.retryable ?? (timeoutMs !== undefined ? true : undefined),
        stage: metadata.stage ?? context.stage ?? timeoutStage as string | undefined,
        supabaseCode: metadata.supabaseCode ?? context.supabaseCode ?? code as string | undefined,
        extraSafeContext,
      }
      if (context.outcome === 'partial') enriched.outcome = 'partial'
      const confirmedStages = [...(Array.isArray(context.extraSafeContext?.confirmed_stages) ? context.extraSafeContext.confirmed_stages : []), ...(Array.isArray(metadata.extraSafeContext?.confirmed_stages) ? metadata.extraSafeContext.confirmed_stages : [])]
      enriched.extraSafeContext.confirmed_stages = [...new Set(confirmedStages)]
      const scope = safeContext(enriched)
      // Mark before invoking the SDK, including linked causes. Reporting never throws.
      causes.forEach(cause => reported.add(cause))
      if (error == null && context.outcome === 'partial') return sentry.captureMessage('Admin operation invariant', scope)
      return sentry.captureException(normalizeAdminError(error), { captureContext: scope })
    } catch {
      return undefined
    }
  }
}

export const reportAdminError = createAdminErrorReporter(Sentry)

// Strict event allowlist, also applied to automatic React/global events. Raw error
// messages and breadcrumbs can contain private form/file/provider data: omit them.
export function sanitizeAdminSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  try {
    const sourceTags = event.tags ?? {}
    const details = event.contexts?.admin_operation ?? {}
    const scope = safeContext({
      level: event.level === 'warning' ? 'warning' : 'error',
      operation: String(sourceTags.operation ?? 'location.load'),
      resourceType: String(sourceTags.resource_type ?? 'location'),
      stage: String(sourceTags.stage ?? 'request'),
      provider: String(sourceTags.provider ?? ''),
      httpStatus: Number(sourceTags.http_status),
      supabaseCode: String(sourceTags.supabase_code ?? ''),
      retryable: sourceTags.retryable === 'true' ? true : sourceTags.retryable === 'false' ? false : 'unknown',
      userFacing: sourceTags.user_facing === 'true',
      outcome: sourceTags.outcome as AdminErrorContext['outcome'],
      resourceId: typeof details.location_id === 'string' ? details.location_id : undefined,
      correlationId: typeof details.correlation_id === 'string' ? details.correlation_id : undefined,
      route: typeof details.route === 'string' ? details.route : undefined,
      extraSafeContext: details,
    })
    return {
      type: event.type, event_id: event.event_id, timestamp: event.timestamp, platform: event.platform,
      level: event.level, environment: event.environment, release: event.release,
      ...(typeof event.user?.id === 'string' && uuid.test(event.user.id)
        ? { user: { id: event.user.id } }
        : {}),
      // Automatic events retain automatic grouping without being labelled locations.
      ...(sourceTags.operation ? { ...scope, fingerprint: ['{{ default }}', scope.tags.operation, scope.tags.stage, scope.tags.supabase_code ?? scope.tags.http_status ?? 'unknown'] } : {}),
      // Replay 10.73 adds this tag before beforeSend, including global errors.
      ...(typeof sourceTags.replayId === 'string' && /^[a-f0-9]{32}$/.test(sourceTags.replayId)
        ? { tags: { ...(sourceTags.operation ? scope.tags : {}), replayId: sourceTags.replayId } }
        : {}),
      message: event.message ? 'Admin operation invariant' : undefined,
      exception: event.exception ? { values: event.exception.values?.map(value => ({
        type: ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'AbortError', 'TimeoutError', 'FunctionsHttpError', 'FunctionsFetchError', 'FunctionsRelayError'].includes(value.type ?? '') ? value.type : 'Error',
        value: 'Error details omitted for privacy',
        mechanism: value.mechanism ? { type: value.mechanism.type, handled: value.mechanism.handled } : undefined,
        stacktrace: value.stacktrace ? { frames: value.stacktrace.frames?.map(frame => ({
          filename: sanitizeCodeFilename(frame.filename),
          lineno: frame.lineno, colno: frame.colno, in_app: frame.in_app,
          function: /^[\w.$<>]{1,120}$/.test(frame.function ?? '') ? frame.function : undefined,
        })) } : undefined,
      })) } : undefined,
    }
  } catch { return null }
}

function sanitizeCodeFilename(filename?: string): string | undefined {
  if (!filename) return undefined
  try {
    const path = new URL(filename, 'https://admin.invalid').pathname
    // Keep deploy asset filenames for useful frames; never signed/file/data URLs.
    return /^\/assets\/[\w.-]+\.(?:js|mjs)$/.test(path) ? path : undefined
  } catch { return undefined }
}
