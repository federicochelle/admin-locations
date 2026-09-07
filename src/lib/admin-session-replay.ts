import type { makeFetchTransport, replayIntegration } from '@sentry/react'

type Transport = ReturnType<typeof makeFetchTransport>
type Envelope = Parameters<Transport['send']>[0]
type ReplayEnvelope = Extract<Envelope, [unknown, [unknown, unknown]]>
type ReplayEvent = ReplayEnvelope[1][0][1]

const privateSelectors = [
  '.sentry-block', '[data-sentry-block]', '.sentry-mask', '[data-sentry-mask]',
  '[data-private]', '[data-sensitive]', '[data-secret]',
  'input[type="password"]', '[autocomplete="current-password"]', '[autocomplete="new-password"]',
  ...['password', 'passwd', 'token', 'secret', 'credential', 'authorization', 'cookie', 'api_key', 'apikey', 'api-key'].flatMap(name => [
    `input[name*="${name}" i]`, `input[id*="${name}" i]`,
    `textarea[name*="${name}" i]`, `textarea[id*="${name}" i]`,
  ]),
]

export const adminReplayOptions = {
  maskAllText: false,
  maskAllInputs: false,
  blockAllMedia: false,
  maskAttributes: [],
  mask: privateSelectors,
  block: privateSelectors,
  ignore: privateSelectors,
  unmask: [],
  unblock: [],
  networkDetailAllowUrls: [],
  networkCaptureBodies: false,
  networkRequestHeaders: [],
  networkResponseHeaders: [],
  // Console/network payloads may contain credentials; retain visual/navigation events.
  beforeAddRecordingEvent: event => event.data.tag === 'breadcrumb' &&
    ['console', 'fetch', 'xhr'].includes(event.data.payload.category) ? null : event,
  // Keep the final privacy filter able to inspect rrweb metadata (not covered by
  // beforeAddRecordingEvent). The SDK supports uncompressed recordings.
  useCompression: false,
} satisfies NonNullable<Parameters<typeof replayIntegration>[0]>

type JsonObject = Record<string, unknown>

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Preserve DOM text, styles, classes, media and layout; redact only secret fields.
const secretKey = /(?:password|passwd|token|secret|credential|authorization|cookie|api[-_]?key|signature)/i

function scrubSecrets(text: string): string {
  return text
    .replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/gi, '$1[redacted]@')
    .replace(/\bBearer\s+[a-z0-9._~+\/=-]+/gi, 'Bearer [redacted]')
    .replace(/\bBasic\s+[a-z0-9+\/=]+/gi, 'Basic [redacted]')
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[redacted]')
    .replace(/((?:[\w-]*(?:password|passwd|token|secret|credential|authorization|cookie|api[-_]?key|signature)[\w-]*)["']?\s*(?:=|:|%3[dDaA])\s*["']?)[^\s&;#"'<>]+/gi, '$1[redacted]')
}

function scrubRecording(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubRecording)
  if (typeof value === 'string') return scrubSecrets(value)
  if (!object(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key, secretKey.test(key) && entry !== null ? '[redacted]' : scrubRecording(entry),
  ]))
}

function scrubReplayMetadata(value: unknown): ReplayEvent {
  if (!object(value)) throw new Error('Invalid replay metadata')
  if (typeof value.replay_id !== 'string' || !/^[a-f0-9]{32}$/.test(value.replay_id)) throw new Error('Invalid replay ID')
  if (!Number.isInteger(value.segment_id) || (value.replay_type !== 'buffer' && value.replay_type !== 'session')) throw new Error('Invalid replay segment')
  const result: ReplayEvent = { type: 'replay_event', urls: [], trace_ids: [], segment_names: [], error_ids: [], replay_id: value.replay_id, segment_id: value.segment_id as number, replay_type: value.replay_type }
  for (const key of ['timestamp', 'replay_start_timestamp', 'segment_id'] as const) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) result[key] = value[key]
  }
  for (const key of ['event_id', 'replay_id'] as const) {
    if (typeof value[key] === 'string' && /^[a-f0-9]{32}$/.test(value[key])) result[key] = value[key]
  }
  result.error_ids = Array.isArray(value.error_ids)
    ? value.error_ids.filter(id => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id)) : []
  result.urls = Array.isArray(value.urls) ? value.urls.filter((url): url is string => typeof url === 'string').map(scrubSecrets) : []
  result.segment_names = Array.isArray(value.segment_names) ? value.segment_names.filter((name): name is string => typeof name === 'string').map(scrubSecrets) : []
  result.platform = 'javascript'
  if (typeof value.release === 'string' && /^(?:[a-f0-9]{7,64}|local-[a-f0-9]{7,64})$/.test(value.release)) result.release = value.release
  if (typeof value.environment === 'string' && ['production', 'development', 'test', 'staging', 'preview'].includes(value.environment)) result.environment = value.environment
  if (value.replay_type === 'buffer' || value.replay_type === 'session') result.replay_type = value.replay_type
  return result
}

export function sanitizeAdminReplayEnvelope(envelope: Envelope): Envelope | null {
  if (!envelope[1].some(([header]) => header.type === 'replay_event' || header.type === 'replay_recording')) return envelope
  try {
    const metadata = envelope[1].find(([header]) => header.type === 'replay_event')
    const recording = envelope[1].find(([header]) => header.type === 'replay_recording')
    if (!metadata || !recording) throw new Error('Incomplete replay envelope')
    const payload = recording[1]
    // SDK 10.73: one JSON header line followed by the rrweb event array.
    if (typeof payload !== 'string') throw new Error('Unexpected compressed replay')
    const newline = payload.indexOf('\n')
    if (newline < 0) throw new Error('Invalid recording header')
    const recordingHeader: unknown = JSON.parse(payload.slice(0, newline))
    const events: unknown = JSON.parse(payload.slice(newline + 1))
    if (!object(recordingHeader) || !Number.isInteger(recordingHeader.segment_id) || !Array.isArray(events)) throw new Error('Invalid recording')
    const clean = JSON.stringify({ segment_id: recordingHeader.segment_id }) + '\n' + JSON.stringify(scrubRecording(events))
    const eventId = envelope[0].event_id
    const result: ReplayEnvelope = [
      typeof eventId === 'string' && /^[a-f0-9]{32}$/.test(eventId) ? { event_id: eventId } : {},
      [
        [{ type: 'replay_event' }, scrubReplayMetadata(metadata[1])],
        [{ type: 'replay_recording', length: new TextEncoder().encode(clean).length }, clean],
      ],
    ]
    return result
  } catch {
    // Fail closed if an SDK upgrade changes the recording format.
    return null
  }
}

export function createAdminReplayTransport(transport: Transport): Transport {
  return {
    send(envelope) {
      const clean = sanitizeAdminReplayEnvelope(envelope)
      return clean ? transport.send(clean) : Promise.resolve({ statusCode: 200 })
    },
    flush: timeout => transport.flush(timeout),
  }
}
