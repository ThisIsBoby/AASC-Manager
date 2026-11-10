import { useState, type FormEvent } from 'react'
import { errMsg, supabase } from '../supabase'
import { Field, useToast } from '../ui'
import { useAuth } from './AuthProvider'
import { AuthLayout } from './AuthLayout'

export function ResetPasswordPage() {
  const { clearRecovery } = useAuth()
  const toast = useToast()
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pwd !== pwd2) { setError('Les deux mots de passe ne correspondent pas.'); return }
    setBusy(true); setError(null)
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setBusy(false)
    if (error) { setError(errMsg(error)); return }
    toast('Mot de passe mis à jour')
    clearRecovery()
  }

  return (
    <AuthLayout>
      <h2 className="title-sport mb-4 text-xl">Nouveau mot de passe</h2>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Mot de passe"><input className="input" type="password" minLength={6} required value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Confirmation"><input className="input" type="password" minLength={6} required value={pwd2} onChange={e => setPwd2(e.target.value)} autoComplete="new-password" /></Field>
        {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}
        <button className="btn-primary w-full py-3" disabled={busy}>Enregistrer</button>
      </form>
    </AuthLayout>
  )
}
