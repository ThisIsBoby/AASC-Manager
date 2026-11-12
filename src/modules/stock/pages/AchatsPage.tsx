import { useMemo, useState } from 'react'
import { CheckCheck, Printer, ShoppingCart } from 'lucide-react'
import { Badge, EmptyState, PageHeader, Spinner, StatTile, fmtQ } from '@/core/ui'
import { useModeleLignes, useStockProduits, useTournois } from '../api'
import { CategorieTag, fmtDate, useRefs } from '../components/shared'
import { calculAchats } from '../logic'

export function AchatsPage() {
  const stock = useStockProduits()
  const tournois = useTournois().data ?? []
  const lignes = useModeleLignes().data ?? []
  const refs = useRefs()
  const [inclure, setInclure] = useState(true)
  const [coches, setCoches] = useState<Set<string>>(new Set())

  const prepa = tournois.filter(t => t.statut === 'prepa')
  const achats = useMemo(() => calculAchats(stock.data ?? [], tournois, lignes, inclure), [stock.data, tournois, lignes, inclure])
  const toggle = (id: string) => setCoches(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div>
      <PageHeader kicker="Stock" title="Achats à faire"
        actions={<button className="btn-ghost" onClick={() => window.print()}><Printer size={16} /> Imprimer</button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Produits à acheter" value={achats.length} tone={achats.length ? 'orange' : 'green'} icon={<ShoppingCart size={16} />} />
        <StatTile label="Déjà dans le caddie" value={`${coches.size}/${achats.length}`} tone="blue" icon={<CheckCheck size={16} />} />
        <div className="card col-span-2 p-4 lg:col-span-1">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-aasc-orange" checked={inclure} onChange={e => setInclure(e.target.checked)} />
            <span>
              <span className="font-semibold">Inclure les événements en préparation</span>
              <span className="block text-xs text-slate-400">
                {prepa.length ? prepa.map(t => `${t.nom} (${t.nb_joueurs} ${(t.type ?? 'tournoi') === 'tournoi' ? 'j.' : 'pers.'}, ${fmtDate(t.date, 'dd/MM')})`).join(' · ') : 'Aucun événement en préparation'}
              </span>
            </span>
          </label>
        </div>
      </div>

      <p className="mb-3 text-sm text-slate-400">À acheter = seuil minimum {inclure && '+ besoins des tournois'} − stock non périmé.</p>

      {stock.isLoading ? <Spinner /> : !achats.length ? <EmptyState title="Rien à acheter 🎉">Le stock couvre les seuils{inclure ? ' et les tournois prévus' : ''}.</EmptyState> : (
        <div className="card overflow-x-auto">
          <table className="table-sport">
            <thead><tr>
              <th className="w-10" /><th>Produit</th><th className="text-right">Stock</th><th className="text-right">Seuil</th>
              {inclure && <th className="text-right">Événements</th>}<th className="text-right">À acheter</th>
            </tr></thead>
            <tbody>
              {achats.map(a => {
                const p = refs.produit.get(a.produitId)
                const done = coches.has(a.produitId)
                return (
                  <tr key={a.produitId} onClick={() => toggle(a.produitId)} className={`cursor-pointer hover:bg-white/5 ${done ? 'opacity-40' : ''}`}>
                    <td><input type="checkbox" readOnly checked={done} className="h-5 w-5 accent-aasc-orange" /></td>
                    <td>
                      <p className={`font-semibold ${done ? 'line-through' : ''}`}>{p?.designation}</p>
                      <CategorieTag cat={p?.categorie_id ? refs.categorie.get(p.categorie_id) : null} />
                    </td>
                    <td className="text-right tabular-nums text-slate-300">{fmtQ(a.stock)}</td>
                    <td className="text-right tabular-nums text-slate-400">{fmtQ(a.seuil)}</td>
                    {inclure && <td className="text-right tabular-nums text-slate-400">{a.besoinTournois ? `+${fmtQ(a.besoinTournois)}` : '—'}</td>}
                    <td className="text-right"><span className="font-display text-2xl font-black italic text-aasc-orange tabular-nums">{fmtQ(a.aAcheter)}</span> <span className="text-xs text-slate-500">{p?.unite}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {achats.some(a => a.besoinTournois > 0) && inclure && <p className="mt-3 text-xs text-slate-500"><Badge tone="blue">Info</Badge> Les quantités « Événements » viennent des modèles de besoins × nombre de joueurs (ou de personnes pour un interclub ou un événement).</p>}
    </div>
  )
}
