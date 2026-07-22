import { HttpError } from './http.ts'
import { getRequiredEnv } from './env.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

type GoogleCalendarStatePayload = {
  expiresAt: number
  issuedAt: number
  nonce: string
  userId: string
  version: 1
}

type GoogleOAuthTokenResponse = {
  access_token?: string
  expires_in?: number
  id_token?: string
  refresh_token?: string
  scope?: string
  token_type?: string
}

type GoogleIdTokenPayload = {
  aud?: string
  email?: string
  email_verified?: boolean
  exp?: number
  iss?: string
  sub?: string
}

const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
] as const
const GOOGLE_STATE_MAX_AGE_MS = 10 * 60 * 1000

function bytesToBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function base64UrlToBytes(value: string) {
  const normalized = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(normalized)

  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function signStatePayload(payload: string) {
  const signingKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getRequiredEnv('GOOGLE_CALENDAR_STATE_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    signingKey,
    new TextEncoder().encode(payload),
  )

  return bytesToBase64Url(new Uint8Array(signature))
}

async function verifyStateSignature(payload: string, signature: string) {
  const verificationKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getRequiredEnv('GOOGLE_CALENDAR_STATE_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  return await crypto.subtle.verify(
    'HMAC',
    verificationKey,
    base64UrlToBytes(signature),
    new TextEncoder().encode(payload),
  )
}

function getGoogleCalendarRedirectUri() {
  return getRequiredEnv('GOOGLE_CALENDAR_REDIRECT_URI')
}

export function getGoogleCalendarPanelUrl() {
  return getRequiredEnv('GOOGLE_CALENDAR_PANEL_URL')
}

export function getGoogleCalendarClientId() {
  return getRequiredEnv('GOOGLE_CALENDAR_CLIENT_ID')
}

function getGoogleCalendarClientSecret() {
  return getRequiredEnv('GOOGLE_CALENDAR_CLIENT_SECRET')
}

export function getGoogleCalendarScopes() {
  return [...GOOGLE_CALENDAR_SCOPES]
}

export async function createGoogleCalendarOAuthState(userId: string) {
  const issuedAt = Date.now()
  const payload: GoogleCalendarStatePayload = {
    expiresAt: issuedAt + GOOGLE_STATE_MAX_AGE_MS,
    issuedAt,
    nonce: crypto.randomUUID(),
    userId,
    version: 1,
  }
  const serializedPayload = JSON.stringify(payload)
  const encodedPayload = bytesToBase64Url(new TextEncoder().encode(serializedPayload))
  const signature = await signStatePayload(encodedPayload)

  return {
    payload,
    state: `${encodedPayload}.${signature}`,
  }
}

export async function verifyGoogleCalendarOAuthState(state: string) {
  const trimmedState = state.trim()
  const [encodedPayload, signature] = trimmedState.split('.')

  if (!encodedPayload || !signature) {
    throw new HttpError(400, 'Invalid Google Calendar OAuth state.')
  }

  if (!(await verifyStateSignature(encodedPayload, signature))) {
    throw new HttpError(400, 'Invalid Google Calendar OAuth state.')
  }

  let parsedPayload: GoogleCalendarStatePayload

  try {
    parsedPayload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(encodedPayload)),
    ) as GoogleCalendarStatePayload
  } catch {
    throw new HttpError(400, 'Invalid Google Calendar OAuth state.')
  }

  if (
    !parsedPayload ||
    typeof parsedPayload.userId !== 'string' ||
    typeof parsedPayload.nonce !== 'string' ||
    typeof parsedPayload.issuedAt !== 'number' ||
    typeof parsedPayload.expiresAt !== 'number' ||
    parsedPayload.version !== 1
  ) {
    throw new HttpError(400, 'Invalid Google Calendar OAuth state.')
  }

  if (
    parsedPayload.expiresAt <= parsedPayload.issuedAt ||
    Date.now() > parsedPayload.expiresAt
  ) {
    throw new HttpError(400, 'Google Calendar OAuth state expired.')
  }

  return parsedPayload
}

export async function persistGoogleCalendarOAuthState(
  adminClient: SupabaseClient,
  payload: GoogleCalendarStatePayload,
) {
  const { error } = await adminClient
    .from('google_calendar_oauth_states')
    .insert({
      admin_user_id: payload.userId,
      expires_at: new Date(payload.expiresAt).toISOString(),
      issued_at: new Date(payload.issuedAt).toISOString(),
      state_nonce: payload.nonce,
    })

  if (error) {
    throw new HttpError(500, 'Could not initialize Google Calendar OAuth state.')
  }
}

export async function consumeGoogleCalendarOAuthState(
  adminClient: SupabaseClient,
  payload: GoogleCalendarStatePayload,
) {
  const { data, error } = await adminClient
    .from('google_calendar_oauth_states')
    .update({
      used_at: new Date().toISOString(),
    })
    .eq('admin_user_id', payload.userId)
    .eq('state_nonce', payload.nonce)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('id')
    .maybeSingle()

  if (error) {
    throw new HttpError(500, 'Could not validate Google Calendar OAuth state.')
  }

  if (!data) {
    throw new HttpError(400, 'Google Calendar OAuth state is invalid or already used.')
  }
}

export function buildGoogleCalendarAuthorizationUrl(state: string) {
  const params = new URLSearchParams({
    access_type: 'offline',
    client_id: getGoogleCalendarClientId(),
    include_granted_scopes: 'true',
    prompt: 'consent',
    redirect_uri: getGoogleCalendarRedirectUri(),
    response_type: 'code',
    scope: getGoogleCalendarScopes().join(' '),
    state,
  })

  return `${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`
}

export async function exchangeGoogleCalendarCode(code: string) {
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: getGoogleCalendarClientId(),
      client_secret: getGoogleCalendarClientSecret(),
      code,
      grant_type: 'authorization_code',
      redirect_uri: getGoogleCalendarRedirectUri(),
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  })

  const payload = (await response.json().catch(() => null)) as GoogleOAuthTokenResponse | null

  if (!response.ok || !payload?.access_token || !payload.id_token) {
    throw new HttpError(502, 'Could not exchange Google authorization code.')
  }

  return payload
}

function decodeJwtPayload<T>(token: string) {
  const [, payload] = token.split('.')

  if (!payload) {
    throw new HttpError(502, 'Could not validate Google identity token.')
  }

  try {
    return JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payload)),
    ) as T
  } catch {
    throw new HttpError(502, 'Could not validate Google identity token.')
  }
}

export function getGoogleCalendarIdentity(idToken: string) {
  const payload = decodeJwtPayload<GoogleIdTokenPayload>(idToken)
  const allowedIssuers = new Set([
    'accounts.google.com',
    'https://accounts.google.com',
  ])

  if (!payload || typeof payload !== 'object') {
    throw new HttpError(502, 'Could not validate Google identity token.')
  }

  if (!payload.iss || !allowedIssuers.has(payload.iss)) {
    throw new HttpError(400, 'Invalid Google identity issuer.')
  }

  if (payload.aud !== getGoogleCalendarClientId()) {
    throw new HttpError(400, 'Invalid Google identity audience.')
  }

  if (!payload.exp || payload.exp * 1000 <= Date.now()) {
    throw new HttpError(400, 'Google identity token expired.')
  }

  if (!payload.sub?.trim()) {
    throw new HttpError(400, 'Missing Google subject.')
  }

  if (!payload.email?.trim()) {
    throw new HttpError(400, 'Missing Google account email.')
  }

  if (payload.email_verified !== true) {
    throw new HttpError(400, 'The Google account email is not verified.')
  }

  return {
    email: payload.email.trim().toLowerCase(),
    subject: payload.sub.trim(),
  }
}

export function getGrantedGoogleCalendarScopes(scopeValue?: string) {
  if (!scopeValue) {
    return []
  }

  return Array.from(
    new Set(
      scopeValue
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter((scope) => scope.length > 0),
    ),
  )
}

export function assertRequiredGoogleCalendarScopes(scopes: string[]) {
  const grantedScopes = new Set(scopes)
  const missingScopes = GOOGLE_CALENDAR_SCOPES.filter(
    (scope) => !grantedScopes.has(scope),
  )

  if (missingScopes.length > 0) {
    throw new HttpError(400, 'Google Calendar authorization is missing required scopes.')
  }
}
