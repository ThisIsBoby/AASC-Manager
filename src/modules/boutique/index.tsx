import { Navigate } from 'react-router-dom'
import { Receipt, ShoppingBag, Tags, Wrench } from 'lucide-react'
import type { AppModule } from '@/core/modules'
import { BoutiqueAccueil } from './components/BoutiqueAccueil'
import { CordageForm, VenteForm } from './components/shared'
import { CordagesPage } from './pages/CordagesPage'
import { VentesPage } from './pages/VentesPage'
import { ArticlesPage } from './pages/ArticlesPage'

export const boutiqueModule: AppModule = {
  id: 'boutique',
  nom: 'Boutique & Cordage',
  nav: [
    { to: '/boutique/cordages', label: 'Cordages', icon: Wrench },
    { to: '/boutique/ventes', label: 'Ventes', icon: Receipt },
    { to: '/boutique/articles', label: 'Articles & prix', icon: Tags },
  ],
  quickActions: [
    { id: 'cordage', label: 'Nouveau cordage', hint: 'Déposer une raquette', icon: Wrench, Form: CordageForm },
    { id: 'vente', label: 'Nouvelle vente', hint: 'Vêtement, volants, accessoire…', icon: ShoppingBag, Form: VenteForm },
  ],
  Accueil: BoutiqueAccueil,
  routes: [
    // L'ancien tableau de bord boutique est désormais l'accueil commun
    { path: 'boutique', element: <Navigate to="/accueil" replace /> },
    { path: 'boutique/cordages', element: <CordagesPage /> },
    { path: 'boutique/ventes', element: <VentesPage /> },
    { path: 'boutique/articles', element: <ArticlesPage /> },
  ],
}
