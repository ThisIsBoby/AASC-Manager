import { LayoutDashboard, Receipt, Tags, Wrench } from 'lucide-react'
import type { AppModule } from '@/core/modules'
import { BoutiqueDashboardPage } from './pages/BoutiqueDashboardPage'
import { CordagesPage } from './pages/CordagesPage'
import { VentesPage } from './pages/VentesPage'
import { ArticlesPage } from './pages/ArticlesPage'

export const boutiqueModule: AppModule = {
  id: 'boutique',
  nom: 'Boutique & Cordage',
  nav: [
    { to: '/boutique', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    { to: '/boutique/cordages', label: 'Cordages', icon: Wrench },
    { to: '/boutique/ventes', label: 'Ventes', icon: Receipt },
    { to: '/boutique/articles', label: 'Articles & prix', icon: Tags },
  ],
  routes: [
    { path: 'boutique', element: <BoutiqueDashboardPage /> },
    { path: 'boutique/cordages', element: <CordagesPage /> },
    { path: 'boutique/ventes', element: <VentesPage /> },
    { path: 'boutique/articles', element: <ArticlesPage /> },
  ],
}
