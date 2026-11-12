import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Euro, PackageCheck, Wrench } from 'lucide-react'
import { Badge, StatTile, fmtQ } from '@/core/ui'
import { useStockProduits } from '@/modules/stock/api'
import { estStockBas, estVendu } from '@/modules/stock/logic'
import { useCordages, useVentes } from '../api'
import { CordagesTable, VentesTable } from './tables'
import { resteAPayer, fmtEuro } from '../logic'

/** Bloc « Boutique & Cordage » de l'accueil commun. */
export function BoutiqueAccueil() {
  const ventes = useVentes().data ?? []
  const cordages = useCordages().data ?? []
  const stock = useStockProduits().data ?? []
  const nav = useNavigate()

  const aCorder = cordages.filter(c => c.statut === 'deposee')
  const aRendre = cordages.filter(c => c.statut === 'cordee')
  const du = resteAPayer(ventes, cordages)
  // Produits vendus en boutique passés sous leur seuil
  const bas = stock.filter(p => estVendu(p) && estStockBas(p))

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Raquettes à corder" value={aCorder.length} tone="orange" icon={<Wrench size={16} />} onClick={() => nav('/boutique/cordages')} />
        <StatTile label="À rendre" value={aRendre.length} tone="blue" icon={<PackageCheck size={16} />} onClick={() => nav('/boutique/cordages')} />
        <StatTile label="Impayés" value={fmtEuro(du.total)} tone={du.total > 0 ? 'red' : 'green'} icon={<Euro size={16} />} onClick={() => nav('/boutique/ventes?paye=non')} />
        <StatTile label="Stock bas" value={bas.length} tone={bas.length ? 'red' : 'green'} icon={<AlertTriangle size={16} />} onClick={() => nav('/stock/produits?vendu=1')} />
      </div>

      {bas.length > 0 && (
        <div className="card mb-4 p-4">
          <p className="mb-2 text-sm font-semibold text-red-300">Articles sous le seuil</p>
          <div className="flex flex-wrap gap-2">
            {bas.map(p => (
              <Badge key={p.id} tone="red">{p.designation} : {fmtQ(p.stock_valide)} / {fmtQ(p.seuil_min)}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="mb-2 flex items-end justify-between">
        <h2 className="title-sport text-xl">Raquettes en cours</h2>
        <Link to="/boutique/cordages" className="text-sm text-aasc-orange-soft hover:underline">Tout voir</Link>
      </div>
      {aCorder.length + aRendre.length ? <CordagesTable cordages={[...aCorder, ...aRendre]} /> : <p className="mb-2 text-sm text-slate-400">Aucune raquette en attente.</p>}

      <div className="mb-2 mt-6 flex items-end justify-between">
        <h2 className="title-sport text-xl">Dernières ventes</h2>
        <Link to="/boutique/ventes" className="text-sm text-aasc-orange-soft hover:underline">Tout voir</Link>
      </div>
      {ventes.length ? <VentesTable ventes={ventes.slice(0, 8)} /> : <p className="text-sm text-slate-400">Aucune vente.</p>}
    </div>
  )
}
