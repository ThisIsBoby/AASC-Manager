import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { subDays } from 'date-fns'
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, SlidersHorizontal } from 'lucide-react'
import type { TypeMouvement } from '@/core/types'
import { EmptyState, PageHeader, Spinner, fmtQ } from '@/core/ui'
import { useCaisses, useMouvements, useProduits } from '../api'
import { fmtDate, useRefs } from '../components/shared'

const typeInfo: Record<TypeMouvement, { label: string; cls: string; Icon: typeof ArrowUpRight }> = {
  entree: { label: 'Entrée', cls: 'bg-emerald-500/20 text-emerald-300', Icon: ArrowDownLeft },
  sortie: { label: 'Sortie', cls: 'bg-aasc-orange/20 text-aasc-orange-soft', Icon: ArrowUpRight },
  ajustement: { label: 'Ajustement', cls: 'bg-aasc-blue/30 text-sky-300', Icon: SlidersHorizontal },
  transfert: { label: 'Transfert', cls: 'bg-violet-500/20 text-violet-300', Icon: ArrowRightLeft },
}

export function HistoriquePage() {
  const [sp, setSp] = useSearchParams()
  const caisseId = sp.get('caisse') ?? ''
  const produitId = sp.get('produit') ?? ''
  const type = (sp.get('type') ?? '') as TypeMouvement | ''
  const periode = sp.get('periode') ?? '30'
  const depuis = useMemo(() => periode === 'tout' ? undefined : subDays(new Date(), Number(periode)).toISOString(), [periode])

  const mv = useMouvements({ caisseId, produitId, type, depuis }, 300)
  const caisses = useCaisses().data ?? []
  const produits = useProduits().data ?? []
  const refs = useRefs()

  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }) }

  return (
    <div>
      <PageHeader kicker="Stock" title="Historique" />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <select className="input" value={caisseId} onChange={e => set('caisse', e.target.value)}>
          <option value="">Toutes les caisses</option>
          {caisses.map(c => <option key={c.id} value={c.id}>{c.code} · {c.nom}</option>)}
        </select>
        <select className="input" value={produitId} onChange={e => set('produit', e.target.value)}>
          <option value="">Tous les produits</option>
          {produits.map(p => <option key={p.id} value={p.id}>{p.designation}</option>)}
        </select>
        <select className="input" value={type} onChange={e => set('type', e.target.value)}>
          <option value="">Tous les types</option>
          {Object.entries(typeInfo).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="input" value={periode} onChange={e => set('periode', e.target.value)}>
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
          <option value="90">3 derniers mois</option>
          <option value="365">12 derniers mois</option>
          <option value="tout">Tout</option>
        </select>
      </div>

      {mv.isLoading ? <Spinner /> : !mv.data?.length ? <EmptyState title="Aucun mouvement" /> : (
        <ol className="relative space-y-2 border-l-2 border-aasc-line pl-4">
          {mv.data.map(m => {
            const t = typeInfo[m.type]
            const p = m.produit_id ? refs.produit.get(m.produit_id) : undefined
            const c = m.caisse_id ? refs.caisse.get(m.caisse_id) : undefined
            const d = m.caisse_dest_id ? refs.caisse.get(m.caisse_dest_id) : undefined
            const u = m.user_id ? refs.membre.get(m.user_id) : undefined
            const pos = m.type === 'transfert' ? null : m.quantite >= 0
            return (
              <li key={m.id} className="card relative flex items-center gap-3 p-3">
                <span className="absolute -left-[23px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-aasc-night bg-aasc-orange" />
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.cls}`}><t.Icon size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p?.designation ?? 'Produit supprimé'}</p>
                  <p className="truncate text-xs text-slate-400">
                    {c ? <Link className="hover:text-aasc-orange-soft" to={`/stock/caisse/${c.id}`}>{c.code}</Link> : '—'}
                    {d && <> → <Link className="hover:text-aasc-orange-soft" to={`/stock/caisse/${d.id}`}>{d.code}</Link></>}
                    {' · '}{u?.nom ?? 'Inconnu'}{' · '}{fmtDate(m.created_at, 'd MMM HH:mm')}
                    {m.motif && <> · <i>{m.motif}</i></>}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-display text-xl font-black italic tabular-nums ${pos === null ? 'text-violet-300' : pos ? 'text-emerald-300' : 'text-aasc-orange-soft'}`}>
                    {pos === null ? '' : pos ? '+' : ''}{fmtQ(m.quantite)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{t.label}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
