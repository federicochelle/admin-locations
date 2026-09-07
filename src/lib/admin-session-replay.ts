import type { makeFetchTransport, replayIntegration } from '@sentry/react'

type Transport = ReturnType<typeof makeFetchTransport>
type Envelope = Parameters<Transport['send']>[0]
type ReplayEnvelope = Extract<Envelope, [unknown, [unknown, unknown]]>
type ReplayEvent = ReplayEnvelope[1][0][1]

export const adminReplayOptions = {
  maskAllText: true,
  maskAllInputs: true,
  blockAllMedia: true,
  block: ['form', 'input', 'textarea', 'select', '[contenteditable]', '[role="dialog"]', '[role="alertdialog"]', 'canvas', 'iframe'],
  unmask: [],
  unblock: [],
  maskFn: () => '[masked]',
  networkDetailAllowUrls: [],
  networkCaptureBodies: false,
  networkRequestHeaders: [],
  networkResponseHeaders: [],
  // Drop console, network, navigation and DOM breadcrumbs, including selectors.
  beforeAddRecordingEvent: () => null,
  // Keep the final privacy filter able to inspect rrweb metadata (not covered by
  // beforeAddRecordingEvent). The SDK supports uncompressed recordings.
  useCompression: false,
} satisfies NonNullable<Parameters<typeof replayIntegration>[0]>

type JsonObject = Record<string, unknown>

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Strict structural replay: no DOM attributes/text/CSS may carry customer data.
// Forms/media are already blocked by rrweb; this also covers dynamic attributes,
// signed links, inline CSS URLs and private content outside a form.
function scrubRecording(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubRecording)
  if (!object(value)) return typeof value === 'string' ? '[masked]' : value
  const result: JsonObject = {}
  for (const [key, entry] of Object.entries(value)) {
    if (value.type === 1 && key === 'name') result[key] = 'html'
    else if (value.type === 1 && (key === 'publicId' || key === 'systemId')) result[key] = ''
    else if (key === 'href') result[key] = 'https://admin.invalid/'
    else if (key === 'tagName') result[key] = typeof entry === 'string' && /^[a-z][a-z0-9-]*$/.test(entry) ? entry : 'div'
    else if (key === 'attributes' && !Array.isArray(entry)) {
      const attributes: JsonObject = {}
      if (object(entry)) {
        for (const name of ['width', 'height', 'rr_width', 'rr_height', 'colspan', 'rowspan']) {
          const dimension = entry[name]
          if (typeof dimension === 'string' && /^\d{1,5}(?:px)?$/.test(dimension)) attributes[name] = dimension
        }
        if (entry.class === 'sentry-block') attributes.class = 'sentry-block'
      }
      result[key] = attributes
    } else result[key] = scrubRecording(entry)
  }
  return result
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
