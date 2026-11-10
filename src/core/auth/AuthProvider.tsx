import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Profile } from '../types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  recovery: boolean
  isAdmin: boolean
  refreshProfile: () => Promise<void>
  clearRecovery: () => void
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile((data as Profile) ?? null)
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      setLoading(false)
      cleanAuthParams()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      // différé : ne pas rappeler Supabase à l'intérieur du callback
      setTimeout(() => loadProfile(s?.user.id), 0)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  const value: AuthState = {
    session, profile, loading, recovery,
    isAdmin: profile?.role === 'admin' && profile.statut === 'actif',
    refreshProfile: () => loadProfile(session?.user.id),
    clearRecovery: () => setRecovery(false),
    signOut: async () => { await supabase.auth.signOut(); setProfile(null) },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Retire ?code=... de l'URL après l'échange PKCE, sans toucher au hash du routeur */
function cleanAuthParams() {
  const u = new URL(window.location.href)
  if (u.searchParams.has('code') || u.searchParams.has('error')) {
    u.searchParams.delete('code'); u.searchParams.delete('error'); u.searchParams.delete('error_description')
    window.history.replaceState(null, '', u.pathname + (u.search || '') + u.hash)
  }
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth hors AuthProvider')
  return c
}
