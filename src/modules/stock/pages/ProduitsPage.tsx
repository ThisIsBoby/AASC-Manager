import { Fragment, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, CornerDownRight, PackagePlus, Pencil, Plus, Search } from 'lucide-react'
import { AdminOnly } from '@/core/auth/guards'
import { useAuth } from '@/core/auth/AuthProvider'
import type { Produit, StockProduit } from '@/core/types'
import { Badge, EmptyState, PageHeader, Spinner, fmtQ } from '@/core/ui'
import { fmtEuro } from '@/modules/boutique/logic'
import { useCategories, useLots, useStockProduits } from '../api'
import { CategorieTag, PeremptionBadge, fmtDate, useRefs } from '../components/shared'
import { EntreeStock, ModeleForm, ProduitForm, TaillesForm } from '../components/produitForms'
import { estStockBas, estVendu, grouperProduits, prixGroupe, type GroupeProduits } from '../logic'

type FiltreVente = '' | 'oui' | 'non'

export function ProduitsPage() {
  const stock = useStockProduits()
  const refs = useRefs()
  const { isAdmin } = useAuth()
  const categories = useCategories().data ?? []
  const [params] = useSearchParams()
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')
  const [vente, setVente] = useState<FiltreVente>(params.get('vendu') === '1' ? 'oui' : '')
  const [open, setOpen] = useState<string | null>(null)
  const [edit, setEdit] = useState<Partial<Produit> | null>(null)
  const [editModele, setEditModele] = useState<GroupeProduits<Produit> | null>(null)
  const [tailles, setTailles] = useState<{ g: GroupeProduits<Produit>; stock?: number } | null>(null)
  const [entree, setEntree] = useState<{ produitId: string; libelle: string } | null>(null)

  const s = search.trim().toLowerCase()
  const groupes = useMemo(() => grouperProduits((stock.data ?? []).filter(p =>
    (!cat || p.categorie_id === cat) &&
    (vente === '' || (vente === 'oui') === estVendu(p)) &&
    (!s || p.designation.toLowerCase().includes(s) || p.modele.toLowerCase().includes(s)))), [stock.data, cat, vente, s])

  /** Les formulaires travaillent sur la table produits (pas la vue de stock) */
  const versProduits = (g: GroupeProduits<StockProduit>): GroupeProduits<Produit> =>
    ({ ...g, produits: g.produits.map(p => refs.produit.get(p.id)).filter((p): p is Produit => !!p) })

  const ligneProduit = (p: StockProduit, g: GroupeProduits<StockProduit>) => {
    const bas = estStockBas(p)
    const taille = !!g.modele
    return (
      <Fragment key={p.id}>
        <tr className={`cursor-pointer hover:bg-white/5 ${!p.actif ? 'opacity-50' : ''}`} onClick={() => setOpen(open === p.id ? null : p.id)}>
          <td className={taille ? 'pl-6' : ''}>
            {taille ? (
              <p className="flex items-center gap-1.5 font-semibold"><CornerDownRight size={14} className="text-slate-500" />{p.taille}{!p.actif && <Badge>Inactive</Badge>}</p>
            ) : (
              <p className="font-semibold">{p.designation} {estVendu(p) && <Badge tone="orange">{fmtEuro(p.prix_vente)}</Badge>}</p>
            )}
            <p className="text-xs text-slate-500">{p.nb_lots} lot(s){p.stock_perime > 0 && <span className="text-red-300"> · {fmtQ(p.stock_perime)} périmé(s)</span>}</p>
          </td>
          <td className="hidden sm:table-cell">{!taille && <CategorieTag cat={p.categorie_id ? refs.categorie.get(p.categorie_id) : null} />}</td>
          <td className="text-right">
            <span className={`font-display text-xl font-black italic tabular-nums ${bas ? 'text-red-300' : ''}`}>{fmtQ(p.stock_valide)}</span>
            <span className="ml-1 text-xs text-slate-500">{p.unite}</span>
          </td>
          <td className="text-right tabular-nums">{bas ? <Badge tone="red">{fmtQ(p.seuil_min)}</Badge> : <span className="text-slate-400">{fmtQ(p.seuil_min)}</span>}</td>
          <td className="hidden text-slate-400 md:table-cell">{fmtDate(p.prochaine_peremption)}</td>
          <td className="whitespace-nowrap text-right">
            <button className="btn-icon btn-ghost" title="Ajouter du stock" onClick={e => { e.stopPropagation(); setEntree({ produitId: p.id, libelle: p.designation }) }}><PackagePlus size={14} /></button>
            {isAdmin && <button className="btn-icon btn-ghost" title="Modifier" onClick={e => { e.stopPropagation(); setEdit(refs.produit.get(p.id) ?? null) }}><Pencil size={14} /></button>}
            <ChevronDown size={16} className={`ml-1 inline transition ${open === p.id ? 'rotate-180' : ''}`} />
          </td>
        </tr>
        {open === p.id && <tr><td colSpan={6} className="bg-black/20"><LotsProduit produitId={p.id} /></td></tr>}
      </Fragment>
    )
  }

  return (
    <div>
      <PageHeader kicker="Stock" title="Produits"
        actions={<AdminOnly><button className="btn-primary" onClick={() => setEdit({ actif: true, unite: 'unité', seuil_min: 0 })}><Plus size={18} /> Nouveau produit</button></AdminOnly>} />
      <p className="mb-4 text-sm text-slate-400">
        Tout se gère ici : stock, seuil d'alerte, prix de vente et variantes (tailles, parfums…). Un produit qui a un prix de vente est proposé dans
        {' '}<Link to="/boutique/ventes" className="text-aasc-orange-soft underline">Ventes</Link>.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Rechercher un produit…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <select className="input w-auto" value={vente} onChange={e => setVente(e.target.value as FiltreVente)}>
          <option value="">Vendus et non vendus</option>
          <option value="oui">Vendus en boutique</option>
          <option value="non">Non vendus</option>
        </select>
      </div>

      {stock.isLoading ? <Spinner /> : groupes.length === 0 ? <EmptyState title="Aucun produit" /> : (
        <div className="card overflow-x-auto">
          <table className="table-sport">
            <thead><tr><th>Produit</th><th className="hidden sm:table-cell">Catégorie</th><th className="text-right">Stock</th><th className="text-right">Seuil</th><th className="hidden md:table-cell">Prochaine péremption</th><th /></tr></thead>
            <tbody>
              {groupes.map(g => {
                if (!g.modele) return ligneProduit(g.produits[0], g)
                const prix = prixGroupe(g.produits)
                const total = g.produits.reduce((n, p) => n + Number(p.stock_valide), 0)
                const nbBas = g.produits.filter(p => p.actif && estStockBas(p)).length
                const per = g.produits.map(p => p.prochaine_peremption).filter(Boolean).sort()[0] ?? null
                const p0 = g.produits[0]
                return (
                  <Fragment key={g.cle}>
                    <tr className="bg-white/[0.03]">
                      <td>
                        <p className="font-semibold">{g.nom} {prix != null && <Badge tone="orange">{fmtEuro(prix)}</Badge>}</p>
                        <p className="text-xs text-slate-500">{g.produits.length} variante(s){nbBas > 0 && <span className="text-red-300"> · {nbBas} sous le seuil</span>}</p>
                      </td>
                      <td className="hidden sm:table-cell"><CategorieTag cat={p0.categorie_id ? refs.categorie.get(p0.categorie_id) : null} /></td>
                      <td className="text-right"><span className="tabular-nums text-slate-300">{fmtQ(total)}</span><span className="ml-1 text-xs text-slate-500">au total</span></td>
                      <td />
                      <td className="hidden text-slate-400 md:table-cell">{fmtDate(per)}</td>
                      <td className="whitespace-nowrap text-right">
                        {isAdmin && <button className="btn-icon btn-ghost" title="Nom, catégorie, prix, variantes" onClick={() => setEditModele(versProduits(g))}><Pencil size={14} /></button>}
                      </td>
                    </tr>
                    {g.produits.map(p => ligneProduit(p, g))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ProduitForm value={edit} onClose={() => setEdit(null)}
        onTailles={p => setTailles({ g: { cle: `p:${p.id}`, nom: p.designation, modele: null, produits: [p] }, stock: stock.data?.find(x => x.id === p.id)?.stock_valide })} />
      <ModeleForm value={editModele} onClose={() => setEditModele(null)} onTailles={g => setTailles({ g })} />
      <TaillesForm value={tailles?.g ?? null} stockActuel={tailles?.stock} onClose={() => setTailles(null)} />
      <EntreeStock value={entree} onClose={() => setEntree(null)} />
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
