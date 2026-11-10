import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom'
import { useAuth } from './core/auth/AuthProvider'
import { LoginPage } from './core/auth/LoginPage'
import { PendingPage } from './core/auth/PendingPage'
import { ResetPasswordPage } from './core/auth/ResetPasswordPage'
import { AppShell } from './core/layout/AppShell'
import { modules } from './core/modules'
import { ProfilPage } from './core/ProfilPage'
import { Spinner } from './core/ui'
import { supabaseConfigured } from './core/supabase'
import { AuthLayout } from './core/auth/AuthLayout'

const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/stock" replace /> },
      ...modules.flatMap(m => m.routes),
      { path: 'profil', element: <ProfilPage /> },
      { path: '*', element: <Navigate to="/stock" replace /> },
    ],
  },
])

export default function App() {
  const { loading, session, profile, recovery } = useAuth()

  if (!supabaseConfigured) return <SetupScreen />
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>
  if (recovery && session) return <ResetPasswordPage />
  if (!session) return <LoginPage />
  if (!profile) return <div className="flex min-h-screen items-center justify-center"><Spinner label="Chargement du profil…" /></div>
  if (profile.statut !== 'actif') return <PendingPage />
  return <RouterProvider router={router} />
}

function SetupScreen() {
  return (
    <AuthLayout>
      <h2 className="title-sport mb-2 text-xl">Configuration requise</h2>
      <p className="text-sm text-slate-400">
        Les variables <code className="text-aasc-orange-soft">VITE_SUPABASE_URL</code> et{' '}
        <code className="text-aasc-orange-soft">VITE_SUPABASE_ANON_KEY</code> ne sont pas définies.
        Copiez <code>.env.example</code> en <code>.env.local</code> et renseignez les clés de votre projet Supabase
        (voir le README).
      </p>
    </AuthLayout>
  )
}
