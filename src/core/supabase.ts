import { createClient } from '@supabase/supabase-js'

// Tolère une URL copiée avec /rest/v1, /auth/v1 ou un slash final
const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/(rest|auth)\/v1\/?$/i, '').replace(/\/+$/, '')
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/** L'URL doit être celle du projet Supabase (https://xxxx.supabase.co), pas celle du site */
export const supabaseUrlInvalide = Boolean(url) && !/^https?:\/\/[^/]+(\.supabase\.co|:\d+)\/?$/i.test(url!.trim())
export const supabaseConfigured = Boolean(url && key) && !supabaseUrlInvalide

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
  if (m.includes('Failed to fetch') || m.includes('NetworkError'))
    return 'Impossible de joindre le serveur Supabase : vérifiez votre connexion, l\'URL du projet, ou que le projet n\'est pas en pause.'
  if (m.includes('Invalid login credentials')) return 'E-mail ou mot de passe incorrect.'
  if (m.includes('Email not confirmed')) return 'E-mail non confirmé : cliquez sur le lien reçu par e-mail.'
  if (m.includes('User already registered')) return 'Un compte existe déjà avec cet e-mail.'
  if (m.includes('Password should be at least')) return 'Le mot de passe doit contenir au moins 6 caractères.'
  if (m.includes('duplicate key')) return 'Cet élément existe déjà.'
  if (m.includes('violates foreign key') || m.includes('restrict')) return 'Impossible : cet élément est encore utilisé.'
  if (m.includes('row-level security')) return 'Action non autorisée pour votre rôle.'
  return m
}
