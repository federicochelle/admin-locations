import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type Profile = {
  id: string
  user_id: string
  full_name: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  role: string | null
  avatar_url: string | null
  status: string | null
  created_at: string | null
}

export type AuthContextValue = {
  currentUser: User | null
  isLoading: boolean
  isProfileLoading: boolean
  profile: Profile | null
  refreshProfile: () => Promise<void>
  session: Session | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
