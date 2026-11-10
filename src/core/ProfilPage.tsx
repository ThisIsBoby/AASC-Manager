import { useState, type FormEvent } from 'react'
import { Save, KeyRound } from 'lucide-react'
import { useAuth } from './auth/AuthProvider'
import { errMsg, supabase } from './supabase'
import { Badge, Field, PageHeader, useToast } from './ui'

export function ProfilPage() {
  const { profile, refreshProfile, isAdmin } = useAuth()
  const toast = useToast()
  const [nom, setNom] = useState(profile?.nom ?? '')
  const [pwd, setPwd] = useState('')

  async function saveNom(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update({ nom }).eq('id', profile!.id)
    if (error) return toast(errMsg(error), 'err')
    toast('Profil mis à jour'); refreshProfile()
  }
  async function savePwd(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: pwd })
    if (error) return toast(errMsg(error), 'err')
    setPwd(''); toast('Mot de passe modifié')
  }

  return (
    <div>
      <PageHeader kicker="Mon compte" title="Profil" />
      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={saveNom} className="card card-accent space-y-4 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">{profile?.email}</p>
            <Badge tone={isAdmin ? 'orange' : 'blue'}>{isAdmin ? 'Administrateur' : 'Utilisateur'}</Badge>
          </div>
          <Field label="Nom affiché"><input className="input" value={nom} onChange={e => setNom(e.target.value)} required /></Field>
          <button className="btn-primary"><Save size={16} /> Enregistrer</button>
        </form>
        <form onSubmit={savePwd} className="card card-accent space-y-4 p-5">
          <Field label="Nouveau mot de passe"><input className="input" type="password" minLength={6} required value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="new-password" /></Field>
          <button className="btn-secondary"><KeyRound size={16} /> Changer le mot de passe</button>
        </form>
      </div>
    </div>
  )
}
