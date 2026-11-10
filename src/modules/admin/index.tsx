import { Users } from 'lucide-react'
import type { AppModule } from '@/core/modules'
import { RequireAdmin } from '@/core/auth/guards'
import { UsersPage } from './UsersPage'

export const adminModule: AppModule = {
  id: 'admin',
  nom: 'Administration',
  adminOnly: true,
  nav: [{ to: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users, adminOnly: true }],
  routes: [{ path: 'admin/utilisateurs', element: <RequireAdmin><UsersPage /></RequireAdmin> }],
}
