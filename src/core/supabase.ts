import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && key)

// PKCE : les retours d'e-mail (confirmation, mot de passe oublié) arrivent en ?code=...
// ce qui est compatible avec le HashRouter (#/...) de GitHub Pages.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** URL publique de l'application (sans hash ni query), ex. https://compte.github.io/AASC-Manager/ */
export function appBaseUrl() {
  return window.location.origin + window.location.pathname
}

/** Transforme une erreur Supabase/Postgres en message lisible */
export function errMsg(e: unknown): string {
  if (!e) return 'Erreur inconnue'
  if (typeof e === 'string') return e
  const m = (e as { message?: string }).message ?? String(e)
  if (m.includes('Invalid login credentials')) return 'E-mail ou mot de passe incorrect.'
  if (m.includes('Email not confirmed')) return 'E-mail non confirmé : cliquez sur le lien reçu par e-mail.'
  if (m.includes('User already registered')) return 'Un compte existe déjà avec cet e-mail.'
  if (m.includes('Password should be at least')) return 'Le mot de passe doit contenir au moins 6 caractères.'
  if (m.includes('duplicate key')) return 'Cet élément existe déjà.'
  if (m.includes('violates foreign key') || m.includes('restrict')) return 'Impossible : cet élément est encore utilisé.'
  if (m.includes('row-level security')) return 'Action non autorisée pour votre rôle.'
  return m
}
