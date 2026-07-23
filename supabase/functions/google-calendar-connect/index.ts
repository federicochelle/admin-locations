import { assertAdmin } from '../_shared/auth.ts'
import {
  buildGoogleCalendarAuthorizationUrl,
  createGoogleCalendarOAuthState,
  persistGoogleCalendarOAuthState,
} from '../_shared/google-calendar.ts'
import { errorResponse, handleOptions, jsonResponse, logInternalError } from '../_shared/http.ts'

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
    const { adminClient, user } = await assertAdmin(request)
    const { payload, state } = await createGoogleCalendarOAuthState(user.id)
    await persistGoogleCalendarOAuthState(adminClient, payload)
    const authorizationUrl = buildGoogleCalendarAuthorizationUrl(state)

    return jsonResponse(
      {
        authorizationUrl,
      },
      { status: 200 },
      origin,
    )
  } catch (error) {
    logInternalError('[google-calendar-connect] request_failed', 'request', error)

    return errorResponse(error, origin)
  }
})
