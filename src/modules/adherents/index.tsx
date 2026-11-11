import { FileUp, Users } from 'lucide-react'
import type { AppModule } from '@/core/modules'
import { AdherentsPage } from './pages/AdherentsPage'
import { AdherentFichePage } from './pages/AdherentFichePage'
import { ImportAdherentsPage } from './pages/ImportAdherentsPage'

export const adherentsModule: AppModule = {
  id: 'adherents',
  nom: 'Adhérents',
  nav: [
    { to: '/adherents', label: 'Adhérents', icon: Users, end: true },
    { to: '/adherents/import', label: 'Import CSV', icon: FileUp, adminOnly: true },
  ],
  routes: [
    { path: 'adherents', element: <AdherentsPage /> },
    { path: 'adherents/import', element: <ImportAdherentsPage /> },
    { path: 'adherents/:id', element: <AdherentFichePage /> },
  ],
}
