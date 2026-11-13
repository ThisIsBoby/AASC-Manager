import { CalendarHeart, LayoutTemplate, WalletCards } from 'lucide-react'
import type { AppModule } from '@/core/modules'
import { TournoisListePage } from './pages/TournoisListePage'
import { TournoiDashboardPage } from './pages/TournoiDashboardPage'
import { ModelesPage } from './pages/ModelesPage'
import { BuvetteAffichePage } from './pages/BuvetteAffichePage'
import { CartesBuvettePage } from './pages/CartesBuvettePage'
import { TournoisAccueil } from './components/TournoisAccueil'

export const tournoisModule: AppModule = {
  id: 'tournois',
  nom: 'Événements',
  nav: [
    { to: '/tournois', label: 'Événements', icon: CalendarHeart, end: true },
    { to: '/tournois/modeles', label: 'Modèles', icon: LayoutTemplate },
    { to: '/tournois/cartes-buvette', label: 'Cartes buvette', icon: WalletCards },
  ],
  Accueil: TournoisAccueil,
  routes: [
    { path: 'tournois', element: <TournoisListePage /> },
    { path: 'tournois/modeles', element: <ModelesPage /> },
    { path: 'tournois/cartes-buvette', element: <CartesBuvettePage /> },
    { path: 'tournois/:id', element: <TournoiDashboardPage /> },
    { path: 'tournois/:id/buvette', element: <BuvetteAffichePage /> },
  ],
}
