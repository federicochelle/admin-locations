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
