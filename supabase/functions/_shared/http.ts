export class HttpError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }
}

type SafeErrorLog = {
  code?: string
  details?: string
  hint?: string
  message: string
  operation: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getStringField(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function extractStructuredErrorFields(error: unknown) {
  if (!isRecord(error)) {
    return {}
  }

  return {
    code: getStringField(error, 'code'),
    details: getStringField(error, 'details'),
    hint: getStringField(error, 'hint'),
    message: getStringField(error, 'message'),
  }
}

export function buildSafeErrorLog(operation: string, error: unknown): SafeErrorLog {
  const baseMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string' && error.trim()
        ? error
        : 'Unknown error'

  const errorFields = extractStructuredErrorFields(error)
  const nestedFields =
    error instanceof HttpError ? extractStructuredErrorFields(error.details) : {}

  return {
    operation,
    message: nestedFields.message ?? errorFields.message ?? baseMessage,
    code: nestedFields.code ?? errorFields.code,
    details: nestedFields.details ?? errorFields.details,
    hint: nestedFields.hint ?? errorFields.hint,
  }
}

export function logInternalError(scope: string, operation: string, error: unknown) {
  console.error(scope, buildSafeErrorLog(operation, error))
}

export function getCorsHeaders(origin?: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function jsonResponse(
  data: unknown,
  init?: ResponseInit,
  origin?: string | null,
) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
      ...(init?.headers ?? {}),
    },
  })
}

export function errorResponse(
  error: unknown,
  origin?: string | null,
) {
  if (error instanceof HttpError) {
    return jsonResponse(
      {
        error: error.message,
        details: error.details ?? null,
      },
      { status: error.status },
      origin,
    )
  }

  const message =
    error instanceof Error
      ? error.message
      : 'Unexpected error while processing the request.'

  return jsonResponse(
    {
      error: message,
      details: null,
    },
    { status: 500 },
    origin,
  )
}

export function handleOptions(request: Request) {
  return new Response('ok', {
    headers: getCorsHeaders(request.headers.get('origin')),
  })
}
