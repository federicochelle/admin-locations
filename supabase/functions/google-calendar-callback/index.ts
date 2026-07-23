import {
  assertActiveAdminProfile,
  getServiceRoleClient,
} from '../_shared/auth.ts'
import {
  assertRequiredGoogleCalendarScopes,
  consumeGoogleCalendarOAuthState,
  exchangeGoogleCalendarCode,
  getGoogleCalendarIdentity,
  getGoogleCalendarPanelUrl,
  getGrantedGoogleCalendarScopes,
  verifyGoogleCalendarOAuthState,
} from '../_shared/google-calendar.ts'
import { buildSafeErrorLog, HttpError, logInternalError } from '../_shared/http.ts'

type ExistingConnectionRow = {
  id: string
  refresh_token: string
}

function buildRedirectUrl(
  status: 'success' | 'error',
  reason?: string,
) {
  const redirectUrl = new URL(getGoogleCalendarPanelUrl())
  redirectUrl.searchParams.set('googleCalendar', status)

  if (reason) {
    redirectUrl.searchParams.set('reason', reason)
  }

  return redirectUrl
}

function redirectToSettings(status: 'success' | 'error', reason?: string) {
  return Response.redirect(buildRedirectUrl(status, reason), 302)
}

function getQueryParam(url: URL, key: string) {
  return url.searchParams.get(key)?.trim() ?? ''
}

function toSafeReason(error: unknown) {
  if (error instanceof HttpError) {
    if (error.status === 400 || error.status === 401 || error.status === 403) {
      return 'invalid_request'
    }

    if (error.status === 502) {
      return 'google_exchange_failed'
    }
  }

  return 'unexpected_error'
}

Deno.serve(async (request) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed.', { status: 405 })
  }

  const url = new URL(request.url)
  const oauthError = getQueryParam(url, 'error')
  const state = getQueryParam(url, 'state')
  const code = getQueryParam(url, 'code')

  if (oauthError) {
    return redirectToSettings('error', 'oauth_denied')
  }

  try {
    if (!state) {
      throw new HttpError(400, 'Missing Google Calendar OAuth state.')
    }

    if (!code) {
      throw new HttpError(400, 'Missing Google Calendar authorization code.')
    }

    const verifiedState = await verifyGoogleCalendarOAuthState(state)
    const adminClient = getServiceRoleClient()
    await consumeGoogleCalendarOAuthState(adminClient, verifiedState)
    const profile = await assertActiveAdminProfile(adminClient, verifiedState.userId)
    const tokenResult = await exchangeGoogleCalendarCode(code)
    const grantedScopes = getGrantedGoogleCalendarScopes(tokenResult.scope)

    assertRequiredGoogleCalendarScopes(grantedScopes)

    const googleIdentity = getGoogleCalendarIdentity(tokenResult.id_token)
    const { data: existingConnection, error: existingConnectionError } = await adminClient
      .from('google_calendar_connections')
      .select('id, refresh_token')
      .eq('connection_key', 'primary')
      .maybeSingle()

    if (existingConnectionError) {
      logInternalError(
        '[google-calendar-callback] connection_select_failed',
        'google_calendar_connections.select_existing',
        existingConnectionError,
      )
      throw new HttpError(
        500,
        'Could not load the existing Google Calendar connection.',
      )
    }

    const currentConnection = existingConnection as ExistingConnectionRow | null
    const refreshToken =
      tokenResult.refresh_token?.trim() ||
      currentConnection?.refresh_token?.trim() ||
      ''

    if (!refreshToken) {
      throw new HttpError(400, 'Google did not return a refresh token.')
    }

    const { error: upsertError } = await adminClient
      .from('google_calendar_connections')
      .upsert(
        {
          connection_key: 'primary',
          connected_at: new Date().toISOString(),
          connected_by_profile_id: profile.id,
          connected_by_user_id: verifiedState.userId,
          google_account_email: googleIdentity.email,
          is_active: true,
          refresh_token: refreshToken,
          scopes: grantedScopes,
        },
        {
          onConflict: 'connection_key',
        },
      )

    if (upsertError) {
      logInternalError(
        '[google-calendar-callback] connection_upsert_failed',
        'google_calendar_connections.upsert_primary',
        upsertError,
      )
      throw new HttpError(500, 'Could not save the Google Calendar connection.')
    }

    return redirectToSettings('success')
  } catch (error) {
    console.error('[google-calendar-callback] request_failed', {
      ...buildSafeErrorLog('request', error),
      reason: toSafeReason(error),
    })

    return redirectToSettings('error', toSafeReason(error))
  }
})
