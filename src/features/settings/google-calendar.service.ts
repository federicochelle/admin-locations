import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  getSupabaseClient,
} from '../../lib/supabase'

export type GoogleCalendarConnectionStatus = {
  connected: boolean
  connectedAt: string
  googleAccountEmail: string
  updatedAt: string
}

type GoogleCalendarStatusResult = {
  connected: boolean
  connectedAt: string | null
  googleAccountEmail: string | null
  updatedAt: string | null
}

type GoogleCalendarConnectResult = {
  authorizationUrl: string
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof FunctionsHttpError) {
    return error.context
      .json()
      .then((payload: unknown) => {
        if (
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload &&
          typeof payload.error === 'string'
        ) {
          return payload.error
        }

        return fallbackMessage
      })
      .catch(() => fallbackMessage)
  }

  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    return Promise.resolve(error.message)
  }

  if (error instanceof Error) {
    return Promise.resolve(error.message)
  }

  return Promise.resolve(fallbackMessage)
}

export async function getGoogleCalendarConnectionStatus() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.functions.invoke<GoogleCalendarStatusResult>(
    'google-calendar-status',
    {
      body: {},
    },
  )

  if (error) {
    throw new Error(
      await getErrorMessage(
        error,
        'No pudimos cargar el estado de Google Calendar.',
      ),
      { cause: error },
    )
  }

  if (!data?.connected || !data.connectedAt || !data.googleAccountEmail || !data.updatedAt) {
    return null
  }

  return {
    connected: true,
    connectedAt: data.connectedAt,
    googleAccountEmail: data.googleAccountEmail,
    updatedAt: data.updatedAt,
  }
}

export async function getGoogleCalendarAuthorizationUrl() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.functions.invoke<GoogleCalendarConnectResult>(
    'google-calendar-connect',
    {
      body: {},
    },
  )

  if (error) {
    throw new Error(
      await getErrorMessage(
        error,
        'No pudimos iniciar la conexión con Google Calendar.',
      ),
      { cause: error },
    )
  }

  if (!data?.authorizationUrl) {
    throw new Error('No recibimos una URL válida para conectar Google Calendar.')
  }

  return data.authorizationUrl
}
