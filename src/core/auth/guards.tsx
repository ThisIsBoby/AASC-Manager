import type { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { EmptyState } from '../ui'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return (
    <EmptyState title="Accès réservé">
      <span className="inline-flex items-center gap-1"><ShieldAlert size={14} /> Cette page est réservée aux administrateurs.</span>
    </EmptyState>
  )
  return <>{children}</>
}

/** Affiche le contenu uniquement pour les admins */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  return isAdmin ? <>{children}</> : null
}
