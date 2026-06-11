import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase'

export async function signIn(email: string, password: string): Promise<void> {
  const supabase = getSupabaseClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw new Error(error.message)
  }

  return data.session
}
