import {
  createClient,
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type SupabaseClient,
} from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null

function getRequiredEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY') {
  const value = import.meta.env[name]

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}.`)
  }

  return value
}

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient
  }

  const supabaseUrl = getRequiredEnv('VITE_SUPABASE_URL')
  const supabaseAnonKey = getRequiredEnv('VITE_SUPABASE_ANON_KEY')

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

  return supabaseClient
}

export async function getSupabaseSessionAccessToken(): Promise<string> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw new Error(error.message)
  }

  const accessToken = data.session?.access_token

  if (!accessToken) {
    throw new Error('No encontramos una sesión de administrador activa.')
  }

  return accessToken
}

export {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
}
