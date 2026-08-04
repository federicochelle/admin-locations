import {
  errorResponse,
  handleOptions,
  HttpError,
  jsonResponse,
  logInternalError,
} from '../_shared/http.ts'

type ResolveGoogleMapsUrlPayload = {
  url?: string | null
}

function isShortGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return url.hostname.trim().toLocaleLowerCase() === 'maps.app.goo.gl'
  } catch {
    return false
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')

  if (request.method === 'OPTIONS') {
    return handleOptions(request)
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      { error: 'Method not allowed.' },
      { status: 405 },
      origin,
    )
  }

  try {
    const body = (await request.json()) as ResolveGoogleMapsUrlPayload
    const url = body.url?.trim() ?? ''

    if (!url) {
      throw new HttpError(400, 'A Google Maps URL is required.')
    }

    if (!isShortGoogleMapsUrl(url)) {
      throw new HttpError(400, 'Only maps.app.goo.gl URLs can be expanded.')
    }

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'admin-locaciones/resolve-google-maps-url',
      },
    })

    if (!response.ok) {
      throw new HttpError(502, 'Could not resolve Google Maps short URL.', {
        status: response.status,
        statusText: response.statusText,
      })
    }

    return jsonResponse(
      {
        resolvedUrl: response.url,
      },
      { status: 200 },
      origin,
    )
  } catch (error) {
    logInternalError('[resolve-google-maps-url] request_failed', 'request', error)
    return errorResponse(error, origin)
  }
})
