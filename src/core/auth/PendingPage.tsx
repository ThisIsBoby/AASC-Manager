import { Hourglass, Ban, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { AuthLayout } from './AuthLayout'

export function PendingPage() {
  const { profile, signOut, refreshProfile } = useAuth()
  const off = profile?.statut === 'desactive'
  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-3 text-center">
        {off ? <Ban className="text-red-400" size={40} /> : <Hourglass className="text-aasc-orange" size={40} />}
        <h2 className="title-sport text-xl">{off ? 'Compte désactivé' : 'En attente de validation'}</h2>
        <p className="text-sm text-slate-400">
          {off
            ? 'Votre accès a été désactivé par un administrateur du club.'
            : <>Bonjour {profile?.nom || ''} ! Votre demande est bien enregistrée. Un administrateur du club doit valider votre compte avant que vous puissiez accéder à l'application.</>}
        </p>
        <div className="mt-2 flex gap-2">
          {!off && <button className="btn-ghost" onClick={() => refreshProfile()}><RefreshCw size={16} /> Vérifier</button>}
          <button className="btn-ghost" onClick={() => signOut()}><LogOut size={16} /> Déconnexion</button>
        </div>
      </div>
    </AuthLayout>
  )
}
