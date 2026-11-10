import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Boxes, CalendarClock, PackageX, ScanLine, ShoppingCart, Trophy } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthProvider'
import { Badge, PageHeader, Spinner, StatTile, fmtQ } from '@/core/ui'
import { useCaisses, usePeremptions, useStockProduits, useTournois } from '../api'
import { fmtDate } from '../components/shared'

export function DashboardPage() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const caisses = useCaisses().data ?? []
  const stock = useStockProduits()
  const per = usePeremptions().data ?? []
  const tournois = (useTournois().data ?? []).filter(t => t.statut === 'prepa')

  const perimes = per.filter(p => p.jours_restants < 0)
  const bientot = per.filter(p => p.jours_restants >= 0)
  const sousSeuil = (stock.data ?? []).filter(p => p.actif && p.seuil_min > 0 && p.stock_valide < p.seuil_min)

  return (
    <div>
      <PageHeader kicker={`Salut ${profile?.nom?.split(' ')[0] ?? ''} 👋`} title="Tableau de bord"
        actions={<button className="btn-primary" onClick={() => nav('/stock/scanner')}><ScanLine size={18} /> Scanner une caisse</button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Caisses" value={caisses.filter(c => c.actif).length} tone="blue" icon={<Boxes size={16} />} onClick={() => nav('/stock/caisses')} />
        <StatTile label="Sous le seuil" value={sousSeuil.length} tone={sousSeuil.length ? 'orange' : 'green'} icon={<PackageX size={16} />} onClick={() => nav('/stock/achats')} />
        <StatTile label="Périmés" value={perimes.length} tone={perimes.length ? 'red' : 'green'} icon={<AlertTriangle size={16} />} />
        <StatTile label="Péremption < 30 j" value={bientot.length} tone={bientot.length ? 'orange' : 'green'} icon={<CalendarClock size={16} />} />
      </div>

      {stock.isLoading ? <Spinner /> : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="card card-accent p-5">
            <h2 className="title-sport mb-3 flex items-center gap-2 text-lg"><AlertTriangle size={18} className="text-red-400" /> Péremptions</h2>
            {per.length === 0 ? <p className="text-sm text-slate-400">Rien à signaler sur les 30 prochains jours. 🏸</p> : (
              <ul className="divide-y divide-aasc-line/60">
                {per.slice(0, 8).map(p => (
                  <li key={p.lot_id}>
                    <Link to={`/stock/caisse/${p.caisse_id}`} className="flex items-center gap-3 py-2.5 hover:text-aasc-orange-soft">
                      <span className="flex-1">
                        <span className="font-semibold">{p.designation}</span>
                        <span className="block text-xs text-slate-500">{p.caisse_code} · {p.caisse_nom} · {fmtQ(p.quantite)} {p.unite}</span>
                      </span>
                      <Badge tone={p.jours_restants < 0 ? 'red' : 'orange'}>
                        {p.jours_restants < 0 ? `Périmé ${fmtDate(p.date_peremption, 'dd/MM')}` : p.jours_restants === 0 ? "Aujourd'hui" : `J-${p.jours_restants}`}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card card-accent p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="title-sport flex items-center gap-2 text-lg"><PackageX size={18} className="text-aasc-orange" /> Stock bas</h2>
              <Link to="/stock/achats" className="text-sm font-semibold text-aasc-orange-soft hover:underline">Liste d'achats →</Link>
            </div>
            {sousSeuil.length === 0 ? <p className="text-sm text-slate-400">Tous les produits sont au-dessus de leur seuil. 💪</p> : (
              <ul className="space-y-3">
                {sousSeuil.slice(0, 8).map(p => {
                  const pct = Math.min(100, (p.stock_valide / p.seuil_min) * 100)
                  return (
                    <li key={p.id}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-semibold">{p.designation}</span>
                        <span className="tabular-nums text-slate-400">{fmtQ(p.stock_valide)} / {fmtQ(p.seuil_min)} {p.unite}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full -skew-x-[24deg] rounded-full ${pct < 34 ? 'bg-red-500' : 'bg-aasc-orange'}`} style={{ width: `${Math.max(pct, 3)}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="card p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="title-sport flex items-center gap-2 text-lg"><Trophy size={18} className="text-aasc-orange" /> Tournois en préparation</h2>
              <Link to="/tournois" className="text-sm font-semibold text-aasc-orange-soft hover:underline">Gérer →</Link>
            </div>
            {tournois.length === 0 ? <p className="text-sm text-slate-400">Aucun tournoi en préparation.</p> : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {tournois.map(t => (
                  <Link key={t.id} to={`/tournois/${t.id}`} className="rounded-xl border border-aasc-line p-3 transition hover:border-aasc-orange">
                    <p className="font-semibold">{t.nom}</p>
                    <p className="text-xs text-slate-400">{fmtDate(t.date)} · {t.nb_joueurs} joueurs</p>
                  </Link>
                ))}
              </div>
            )}
            <Link to="/stock/achats" className="btn-ghost mt-4"><ShoppingCart size={16} /> Comparer stock et achats à faire</Link>
          </section>
        </div>
      )}
    </div>
  )
}
