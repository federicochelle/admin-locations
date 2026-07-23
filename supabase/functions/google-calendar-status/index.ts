import { assertAdmin } from '../_shared/auth.ts'
import {
  errorResponse,
  handleOptions,
  HttpError,
  jsonResponse,
  logInternalError,
} from '../_shared/http.ts'

type GoogleCalendarConnectionRow = {
  connected: boolean
  connected_at: string
  google_account_email: string
  is_active: boolean
  updated_at: string
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
    const { adminClient } = await assertAdmin(request)
    const { data, error } = await adminClient
      .from('google_calendar_connections')
      .select(
        `
          google_account_email,
          connected_at,
          updated_at,
          is_active
        `,
      )
      .eq('connection_key', 'primary')
      .maybeSingle()

    if (error) {
      logInternalError(
        '[google-calendar-status] connection_select_failed',
        'google_calendar_connections.select_status',
        error,
      )
      throw new HttpError(500, 'Could not load Google Calendar connection status.')
    }

    const connection = (data ?? null) as GoogleCalendarConnectionRow | null

    return jsonResponse(
      {
        connected: Boolean(connection?.is_active),
        connectedAt: connection?.is_active ? connection.connected_at : null,
        googleAccountEmail: connection?.is_active ? connection.google_account_email : null,
        updatedAt: connection?.is_active ? connection.updated_at : null,
      },
      { status: 200 },
      origin,
    )
  } catch (error) {
    logInternalError('[google-calendar-status] request_failed', 'request', error)

    return errorResponse(error, origin)
  }
})
