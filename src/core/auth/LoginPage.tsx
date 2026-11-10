import { useState, type FormEvent } from 'react'
import { LogIn, UserPlus, KeyRound } from 'lucide-react'
import { appBaseUrl, errMsg, supabase } from '../supabase'
import { Field } from '../ui'
import { AuthLayout } from './AuthLayout'

type Mode = 'login' | 'signup' | 'forgot'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nom, setNom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setInfo(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { nom }, emailRedirectTo: appBaseUrl() },
        })
        if (error) throw error
        if (!data.session) setInfo('Demande envoyée ! Confirmez votre e-mail via le lien reçu, puis un administrateur validera votre accès.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appBaseUrl() })
        if (error) throw error
        setInfo("Si un compte existe, un e-mail de réinitialisation vient d'être envoyé.")
      }
    } catch (err) { setError(errMsg(err)) } finally { setBusy(false) }
  }

  const titles: Record<Mode, string> = { login: 'Connexion', signup: 'Demander un accès', forgot: 'Mot de passe oublié' }

  return (
    <AuthLayout>
      <h2 className="title-sport mb-4 text-xl">{titles[mode]}</h2>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'signup' && (
          <Field label="Nom / prénom"><input className="input" required value={nom} onChange={e => setNom(e.target.value)} autoComplete="name" /></Field>
        )}
        <Field label="E-mail"><input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></Field>
        {mode !== 'forgot' && (
          <Field label="Mot de passe">
            <input className="input" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </Field>
        )}
        {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}
        {info && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">{info}</p>}
        <button className="btn-primary w-full py-3 text-base" disabled={busy}>
          {mode === 'login' && <><LogIn size={18} /> Se connecter</>}
          {mode === 'signup' && <><UserPlus size={18} /> Envoyer la demande</>}
          {mode === 'forgot' && <><KeyRound size={18} /> Recevoir le lien</>}
        </button>
      </form>
      <div className="mt-5 flex flex-col gap-2 text-center text-sm">
        {mode !== 'login' && <button className="text-slate-400 hover:text-white" onClick={() => setMode('login')}>← Retour à la connexion</button>}
        {mode === 'login' && <>
          <button className="text-aasc-orange-soft hover:text-aasc-orange" onClick={() => setMode('signup')}>Pas encore de compte ? Demander un accès</button>
          <button className="text-slate-400 hover:text-white" onClick={() => setMode('forgot')}>Mot de passe oublié</button>
        </>}
      </div>
    </AuthLayout>
  )
}
