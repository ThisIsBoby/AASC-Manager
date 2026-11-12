import { CalendarHeart, LayoutTemplate } from 'lucide-react'
import type { AppModule } from '@/core/modules'
import { TournoisListePage } from './pages/TournoisListePage'
import { TournoiDashboardPage } from './pages/TournoiDashboardPage'
import { ModelesPage } from './pages/ModelesPage'
import { TournoisAccueil } from './components/TournoisAccueil'

export const tournoisModule: AppModule = {
  id: 'tournois',
  nom: 'Événements',
  nav: [
    { to: '/tournois', label: 'Événements', icon: CalendarHeart, end: true },
    { to: '/tournois/modeles', label: 'Modèles', icon: LayoutTemplate },
  ],
  Accueil: TournoisAccueil,
  routes: [
    { path: 'tournois', element: <TournoisListePage /> },
    { path: 'tournois/modeles', element: <ModelesPage /> },
    { path: 'tournois/:id', element: <TournoiDashboardPage /> },
  ],
}
