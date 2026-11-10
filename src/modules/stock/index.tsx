import { LayoutDashboard, ScanLine, Boxes, Package, History, Trophy, ShoppingCart, QrCode } from 'lucide-react'
import type { AppModule } from '@/core/modules'
import { DashboardPage } from './pages/DashboardPage'
import { ScannerPage } from './pages/ScannerPage'
import { CaissesPage } from './pages/CaissesPage'
import { CaisseDetailPage } from './pages/CaisseDetailPage'
import { ProduitsPage } from './pages/ProduitsPage'
import { HistoriquePage } from './pages/HistoriquePage'
import { TournoisPage } from './pages/TournoisPage'
import { TournoiDetailPage } from './pages/TournoiDetailPage'
import { AchatsPage } from './pages/AchatsPage'
import { EtiquettesPage } from './pages/EtiquettesPage'

export const stockModule: AppModule = {
  id: 'stock',
  nom: 'Stock & Inventaire',
  nav: [
    { to: '/stock', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    { to: '/stock/scanner', label: 'Scanner', icon: ScanLine },
    { to: '/stock/caisses', label: 'Caisses', icon: Boxes },
    { to: '/stock/produits', label: 'Produits', icon: Package },
    { to: '/stock/tournois', label: 'Tournois', icon: Trophy },
    { to: '/stock/achats', label: 'Achats à faire', icon: ShoppingCart },
    { to: '/stock/historique', label: 'Historique', icon: History },
    { to: '/stock/etiquettes', label: 'Étiquettes QR', icon: QrCode },
  ],
  routes: [
    { path: 'stock', element: <DashboardPage /> },
    { path: 'stock/scanner', element: <ScannerPage /> },
    { path: 'stock/caisses', element: <CaissesPage /> },
    { path: 'stock/caisse/:id', element: <CaisseDetailPage /> },
    { path: 'stock/produits', element: <ProduitsPage /> },
    { path: 'stock/historique', element: <HistoriquePage /> },
    { path: 'stock/tournois', element: <TournoisPage /> },
    { path: 'stock/tournois/:id', element: <TournoiDetailPage /> },
    { path: 'stock/achats', element: <AchatsPage /> },
    { path: 'stock/etiquettes', element: <EtiquettesPage /> },
  ],
}
