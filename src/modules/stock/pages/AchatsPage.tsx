import { useMemo, useState } from 'react'
import { CheckCheck, Printer, ShoppingCart } from 'lucide-react'
import { Badge, EmptyState, PageHeader, Spinner, StatTile, fmtQ } from '@/core/ui'
import { useModeleLignes, useStockProduits, useTournois } from '../api'
import { CategorieTag, fmtDate, useRefs } from '../components/shared'
import { calculAchats } from '../logic'

export function AchatsPage() {
  const stock = useStockProduits()
  const tournoisData = useTournois().data
  const lignes = useModeleLignes().data ?? []
  const refs = useRefs()
  const [exclus, setExclus] = useState<Set<string>>(new Set())
  const [coches, setCoches] = useState<Set<string>>(new Set())

  const prepa = useMemo(() => (tournoisData ?? []).filter(t => t.statut === 'prepa'), [tournoisData])
  const selection = useMemo(() => prepa.filter(t => !exclus.has(t.id)), [prepa, exclus])
  const inclure = selection.length > 0
  const tous = prepa.length > 0 && selection.length === prepa.length
  const achats = useMemo(() => calculAchats(stock.data ?? [], selection, lignes), [stock.data, selection, lignes])
  const toggleEvent = (id: string) => setExclus(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleTous = () => setExclus(tous ? new Set(prepa.map(t => t.id)) : new Set())
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
            <input type="checkbox" className="mt-1 h-5 w-5 accent-aasc-orange" disabled={!prepa.length}
              checked={tous} ref={el => { if (el) el.indeterminate = inclure && !tous }} onChange={toggleTous} />
            <span>
              <span className="font-semibold">Inclure les événements en préparation</span>
              {!prepa.length && <span className="block text-xs text-slate-400">Aucun événement en préparation</span>}
            </span>
          </label>
          {prepa.length > 0 && (
            <ul className="mt-2 space-y-1 pl-8">
              {prepa.map(t => (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                    <input type="checkbox" className="h-4 w-4 accent-aasc-orange" checked={!exclus.has(t.id)} onChange={() => toggleEvent(t.id)} />
                    <span>{t.nom} <span className="text-slate-500">({t.nb_joueurs} {(t.type ?? 'tournoi') === 'tournoi' ? 'j.' : 'pers.'}, {fmtDate(t.date, 'dd/MM')})</span></span>
                  </label>
                </li>
              ))}
            </ul>
          )}
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
