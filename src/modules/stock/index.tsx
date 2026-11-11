import { Navigate, useParams } from 'react-router-dom'
import { ScanLine, Boxes, Package, History, ShoppingCart, QrCode } from 'lucide-react'
import type { AppModule } from '@/core/modules'
import { StockAccueil } from './components/StockAccueil'
import { ScannerPage } from './pages/ScannerPage'
import { CaissesPage } from './pages/CaissesPage'
import { CaisseDetailPage } from './pages/CaisseDetailPage'
import { ProduitsPage } from './pages/ProduitsPage'
import { HistoriquePage } from './pages/HistoriquePage'
import { AchatsPage } from './pages/AchatsPage'
import { EtiquettesPage } from './pages/EtiquettesPage'

export const stockModule: AppModule = {
  id: 'stock',
  nom: 'Stock & Inventaire',
  nav: [
    { to: '/stock/scanner', label: 'Scanner', icon: ScanLine },
    { to: '/stock/caisses', label: 'Caisses', icon: Boxes },
    { to: '/stock/produits', label: 'Produits', icon: Package },
    { to: '/stock/achats', label: 'Achats à faire', icon: ShoppingCart },
    { to: '/stock/historique', label: 'Historique', icon: History },
    { to: '/stock/etiquettes', label: 'Étiquettes QR', icon: QrCode },
  ],
  quickActions: [
    { id: 'scanner', label: 'Scanner une caisse', hint: 'Entrée, sortie, inventaire', icon: ScanLine, to: '/stock/scanner' },
  ],
  Accueil: StockAccueil,
  routes: [
    // L'ancien tableau de bord stock est désormais l'accueil commun
    { path: 'stock', element: <Navigate to="/accueil" replace /> },
    { path: 'stock/scanner', element: <ScannerPage /> },
    { path: 'stock/caisses', element: <CaissesPage /> },
    { path: 'stock/caisse/:id', element: <CaisseDetailPage /> },
    { path: 'stock/produits', element: <ProduitsPage /> },
    { path: 'stock/historique', element: <HistoriquePage /> },
    // Anciennes adresses : les tournois ont maintenant leur propre module
    { path: 'stock/tournois', element: <Navigate to="/tournois" replace /> },
    { path: 'stock/tournois/:id', element: <RedirectTournoi /> },
    { path: 'stock/achats', element: <AchatsPage /> },
    { path: 'stock/etiquettes', element: <EtiquettesPage /> },
  ],
}

function RedirectTournoi() {
  const { id } = useParams()
  return <Navigate to={`/tournois/${id}`} replace />
}
