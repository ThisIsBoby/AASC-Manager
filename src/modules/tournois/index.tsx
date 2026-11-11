import { LayoutTemplate, Trophy } from 'lucide-react'
import type { AppModule } from '@/core/modules'
import { TournoisListePage } from './pages/TournoisListePage'
import { TournoiDashboardPage } from './pages/TournoiDashboardPage'
import { ModelesPage } from './pages/ModelesPage'
import { TournoisAccueil } from './components/TournoisAccueil'

export const tournoisModule: AppModule = {
  id: 'tournois',
  nom: 'Tournois',
  nav: [
    { to: '/tournois', label: 'Tournois', icon: Trophy, end: true },
    { to: '/tournois/modeles', label: 'Modèles', icon: LayoutTemplate },
  ],
  Accueil: TournoisAccueil,
  routes: [
    { path: 'tournois', element: <TournoisListePage /> },
    { path: 'tournois/modeles', element: <ModelesPage /> },
    { path: 'tournois/:id', element: <TournoiDashboardPage /> },
  ],
}
