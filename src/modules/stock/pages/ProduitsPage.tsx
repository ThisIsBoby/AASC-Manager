import { Fragment, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Pencil, Plus, Search } from 'lucide-react'
import { AdminOnly } from '@/core/auth/guards'
import { useAuth } from '@/core/auth/AuthProvider'
import { errMsg } from '@/core/supabase'
import type { Produit } from '@/core/types'
import { Badge, EmptyState, Field, Modal, PageHeader, Spinner, fmtQ, useToast } from '@/core/ui'
import { useCategories, useLots, useStockProduits, useUpsert } from '../api'
import { CategorieTag, PeremptionBadge, fmtDate, useRefs } from '../components/shared'

export function ProduitsPage() {
  const stock = useStockProduits()
  const refs = useRefs()
  const { isAdmin } = useAuth()
  const categories = useCategories().data ?? []
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [edit, setEdit] = useState<Partial<Produit> | null>(null)

  const list = (stock.data ?? []).filter(p =>
    (!cat || p.categorie_id === cat) && (!search || p.designation.toLowerCase().includes(search.toLowerCase())))

  return (
    <div>
      <PageHeader kicker="Stock" title="Produits"
        actions={<AdminOnly><button className="btn-primary" onClick={() => setEdit({ actif: true, unite: 'unité', seuil_min: 0 })}><Plus size={18} /> Nouveau produit</button></AdminOnly>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Rechercher un produit…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>

      {stock.isLoading ? <Spinner /> : list.length === 0 ? <EmptyState title="Aucun produit" /> : (
        <div className="card overflow-x-auto">
          <table className="table-sport">
            <thead><tr><th>Produit</th><th className="hidden sm:table-cell">Catégorie</th><th className="text-right">Stock</th><th className="text-right">Seuil</th><th className="hidden md:table-cell">Prochaine péremption</th><th /></tr></thead>
            <tbody>
              {list.map(p => {
                const bas = p.seuil_min > 0 && p.stock_valide < p.seuil_min
                return (
                  <Fragment key={p.id}>
                    <tr className={`cursor-pointer hover:bg-white/5 ${!p.actif ? 'opacity-50' : ''}`} onClick={() => setOpen(open === p.id ? null : p.id)}>
                      <td>
                        <p className="font-semibold">{p.designation}</p>
                        <p className="text-xs text-slate-500">{p.nb_lots} lot(s){p.stock_perime > 0 && <span className="text-red-300"> · {fmtQ(p.stock_perime)} périmé(s)</span>}</p>
                      </td>
                      <td className="hidden sm:table-cell"><CategorieTag cat={p.categorie_id ? refs.categorie.get(p.categorie_id) : null} /></td>
                      <td className="text-right">
                        <span className={`font-display text-xl font-black italic tabular-nums ${bas ? 'text-red-300' : ''}`}>{fmtQ(p.stock_valide)}</span>
                        <span className="ml-1 text-xs text-slate-500">{p.unite}</span>
                      </td>
                      <td className="text-right tabular-nums">{bas ? <Badge tone="red">{fmtQ(p.seuil_min)}</Badge> : <span className="text-slate-400">{fmtQ(p.seuil_min)}</span>}</td>
                      <td className="hidden text-slate-400 md:table-cell">{fmtDate(p.prochaine_peremption)}</td>
                      <td className="whitespace-nowrap text-right">
                        {isAdmin && <button className="btn-icon btn-ghost" onClick={e => { e.stopPropagation(); setEdit(refs.produit.get(p.id) ?? null) }}><Pencil size={14} /></button>}
                        <ChevronDown size={16} className={`ml-1 inline transition ${open === p.id ? 'rotate-180' : ''}`} />
                      </td>
                    </tr>
                    {open === p.id && <tr><td colSpan={6} className="bg-black/20"><LotsProduit produitId={p.id} /></td></tr>}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <ProduitForm value={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function LotsProduit({ produitId }: { produitId: string }) {
  const lots = useLots({ produitId })
  const refs = useRefs()
  if (lots.isLoading) return <p className="text-sm text-slate-400">Chargement…</p>
  if (!lots.data?.length) return <p className="text-sm text-slate-400">Aucun lot en stock.</p>
  return (
    <ul className="space-y-1.5">
      {lots.data.map(l => {
        const c = refs.caisse.get(l.caisse_id)
        return (
          <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
            <Link to={`/stock/caisse/${l.caisse_id}`} className="font-semibold text-aasc-orange-soft hover:underline">{c?.code} · {c?.nom}</Link>
            <span className="tabular-nums">× {fmtQ(l.quantite)}</span>
            <PeremptionBadge date={l.date_peremption} />
          </li>
        )
      })}
    </ul>
  )
}

export function ProduitForm({ value, onClose, onSaved }: { value: Partial<Produit> | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const categories = useCategories().data ?? []
  const upsert = useUpsert<Produit>('produits', ['produits', 'stock'])
  const toast = useToast()
  const [f, setF] = useState<Partial<Produit>>({})
  const [prev, setPrev] = useState<Partial<Produit> | null>(null)
  if (value !== prev) { setPrev(value); setF(value ?? {}) }

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const { id, designation, categorie_id, unite, seuil_min, actif } = f
      const row = await upsert.mutateAsync({ id, designation, categorie_id: categorie_id || null, unite: unite || 'unité', seuil_min: Number(seuil_min) || 0, actif: actif ?? true }) as Produit
      toast(id ? 'Produit modifié' : 'Produit créé')
      onSaved?.(row.id); onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open={!!value} onClose={onClose} title={f.id ? 'Modifier le produit' : 'Nouveau produit'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Désignation"><input className="input" required value={f.designation ?? ''} onChange={e => setF({ ...f, designation: e.target.value })} placeholder="ex. Volants plume (tube de 12)" /></Field>
        <Field label="Catégorie">
          <select className="input" value={f.categorie_id ?? ''} onChange={e => setF({ ...f, categorie_id: e.target.value })}>
            <option value="">—</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unité"><input className="input" value={f.unite ?? ''} onChange={e => setF({ ...f, unite: e.target.value })} placeholder="unité, tube, bouteille…" /></Field>
          <Field label="Seuil minimum" hint="Alerte si le stock passe en dessous">
            <input className="input" type="number" min={0} step="any" value={f.seuil_min ?? 0} onChange={e => setF({ ...f, seuil_min: e.target.value as unknown as number })} />
          </Field>
        </div>
        {f.id && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.actif ?? true} onChange={e => setF({ ...f, actif: e.target.checked })} className="h-4 w-4 accent-aasc-orange" /> Produit actif
          </label>
        )}
        <button className="btn-primary w-full" disabled={upsert.isPending}>Enregistrer</button>
      </form>
    </Modal>
  )
}
