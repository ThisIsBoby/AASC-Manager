import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PackagePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { AdminOnly } from '@/core/auth/guards'
import { useAuth } from '@/core/auth/AuthProvider'
import { errMsg } from '@/core/supabase'
import type { Article, ArticleVariante, OffreCordage, Produit } from '@/core/types'
import { Badge, EmptyState, Field, Modal, PageHeader, Spinner, fmtQ, useToast } from '@/core/ui'
import { useCaisses, useCategories, useCreerLot, useDelete, useProduits, useStockProduits, useUpsert } from '@/modules/stock/api'
import { ProduitForm } from '@/modules/stock/pages/ProduitsPage'
import { useAjouterVariantes, useArticles, useOffresCordage, useVariantes } from '../api'
import { estStockBas, fmtEuro, prixVariante } from '../logic'

export function ArticlesPage() {
  const articles = useArticles()
  const variantes = useVariantes().data ?? []
  const offres = useOffresCordage().data ?? []
  const produits = useProduits().data ?? []
  const stockList = useStockProduits().data
  const stock = useMemo(() => new Map((stockList ?? []).map(s => [s.id, s])), [stockList])
  const { isAdmin } = useAuth()
  const [editArticle, setEditArticle] = useState<Partial<Article> | null>(null)
  const [ajout, setAjout] = useState<Article | null>(null)
  const [editVar, setEditVar] = useState<{ v: ArticleVariante; a: Article } | null>(null)
  const [editProduit, setEditProduit] = useState<Partial<Produit> | null>(null)
  const [entree, setEntree] = useState<{ produitId: string; libelle: string } | null>(null)
  const [editOffre, setEditOffre] = useState<Partial<OffreCordage> | null>(null)
  const delVar = useDelete('article_variantes', ['article_variantes'])
  const toast = useToast()
  const produitNom = (id: string | null) => produits.find(p => p.id === id)?.designation

  async function supprimerVariante(v: ArticleVariante) {
    if (!confirm(`Supprimer la variante « ${v.libelle || 'unique'} » ? (le produit de stock est conservé)`)) return
    try { await delVar.mutateAsync(v.id); toast('Variante supprimée') } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <div>
      <PageHeader kicker="Boutique & Cordage" title="Articles & prix"
        actions={<AdminOnly><button className="btn-primary" onClick={() => setEditArticle({ actif: true, prix: 0, categorie: '' })}><Plus size={18} /> Nouvel article</button></AdminOnly>} />

      <p className="mb-4 text-sm text-slate-400">
        Chaque taille / variante est reliée à un produit du <Link to="/stock/produits" className="text-aasc-orange-soft underline">stock</Link> :
        la quantité et le seuil « stock bas » sont ceux du produit, et chaque vente sort la quantité du stock.
      </p>

      {articles.isLoading ? <Spinner /> : !articles.data?.length ? <EmptyState title="Aucun article">Créez par exemple « Tube de volants » ou « Maillot club ».</EmptyState> : (
        <div className="space-y-4">
          {articles.data.map(a => {
            const vars = variantes.filter(v => v.article_id === a.id)
            return (
              <div key={a.id} className={`card p-4 ${!a.actif ? 'opacity-60' : ''}`}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="title-sport text-lg leading-tight">{a.nom} {!a.actif && <Badge>Inactif</Badge>}</p>
                    <p className="text-sm text-slate-400">{a.categorie && <>{a.categorie} · </>}Prix : <b className="text-white">{fmtEuro(a.prix)}</b>{a.description && <> · {a.description}</>}</p>
                  </div>
                  <AdminOnly>
                    <div className="flex gap-1.5">
                      <button className="btn-ghost text-sm" onClick={() => setAjout(a)}><Plus size={14} /> Tailles / variantes</button>
                      <button className="btn-icon btn-ghost" onClick={() => setEditArticle(a)} title="Modifier l'article"><Pencil size={14} /></button>
                    </div>
                  </AdminOnly>
                </div>
                {!vars.length ? <p className="text-sm text-aasc-orange-soft">Aucune variante : ajoutez-en au moins une (laisser le libellé vide pour un article unique).</p> : (
                  <div className="overflow-x-auto">
                    <table className="table-sport">
                      <thead><tr><th>Variante</th><th className="hidden sm:table-cell">Produit de stock</th><th className="text-right">Stock</th><th className="text-right">Seuil</th><th className="text-right">Prix</th>{isAdmin && <th />}</tr></thead>
                      <tbody>
                        {vars.map(v => {
                          const s = v.produit_id ? stock.get(v.produit_id) : undefined
                          const isBas = estStockBas(v, stock)
                          return (
                            <tr key={v.id} className={!v.actif ? 'opacity-50' : ''}>
                              <td className="font-semibold">{v.libelle || <span className="text-slate-500">Unique</span>}</td>
                              <td className="hidden text-sm text-slate-400 sm:table-cell">{v.produit_id ? produitNom(v.produit_id) : <span className="text-aasc-orange-soft">Non suivi en stock</span>}</td>
                              <td className="text-right tabular-nums">
                                {s ? <span className={`font-display text-lg font-black italic ${isBas ? 'text-red-300' : ''}`}>{fmtQ(s.stock_valide)}</span> : '—'}
                                {s && <button className="btn-icon btn-ghost ml-1" title="Ajouter du stock" onClick={() => setEntree({ produitId: s.id, libelle: `${a.nom}${v.libelle ? ` – ${v.libelle}` : ''}` })}><PackagePlus size={14} /></button>}
                              </td>
                              <td className="text-right tabular-nums">
                                {s ? (isAdmin
                                  ? <button onClick={() => setEditProduit(produits.find(p => p.id === s.id) ?? null)} title="Modifier le seuil">{isBas ? <Badge tone="red">{fmtQ(s.seuil_min)}</Badge> : <span className="text-slate-400 underline decoration-dotted">{fmtQ(s.seuil_min)}</span>}</button>
                                  : <span className="text-slate-400">{fmtQ(s.seuil_min)}</span>) : '—'}
                              </td>
                              <td className="text-right tabular-nums">{fmtEuro(prixVariante(a, v))}{v.prix != null && <span className="block text-[10px] text-slate-500">prix spécifique</span>}</td>
                              {isAdmin && <td className="whitespace-nowrap text-right">
                                <button className="btn-icon btn-ghost" onClick={() => setEditVar({ v, a })} title="Modifier"><Pencil size={14} /></button>
                                <button className="btn-icon btn-ghost" onClick={() => supprimerVariante(v)} title="Supprimer"><Trash2 size={14} /></button>
                              </td>}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mb-2 mt-8 flex items-end justify-between">
        <h2 className="title-sport text-xl">Offres de cordage</h2>
        <AdminOnly><button className="btn-ghost text-sm" onClick={() => setEditOffre({ actif: true, prix: 0 })}><Plus size={14} /> Offre</button></AdminOnly>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {offres.map(o => (
          <div key={o.id} className={`card p-4 ${!o.actif ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{o.nom}</p>
              <AdminOnly><button className="btn-icon btn-ghost -mr-2 -mt-1" onClick={() => setEditOffre(o)}><Pencil size={14} /></button></AdminOnly>
            </div>
            <p className="font-display text-3xl font-black italic">{fmtEuro(o.prix)}</p>
            <p className="mt-1 text-xs text-slate-400">
              {o.produit_id ? <>Consomme 1 × {produitNom(o.produit_id)} (stock : {fmtQ(stock.get(o.produit_id)?.stock_valide)})</> : 'Pas de garniture sortie du stock'}
            </p>
          </div>
        ))}
      </div>

      <ArticleForm value={editArticle} onClose={() => setEditArticle(null)} />
      <AjoutVariantes article={ajout} nbExistants={ajout ? variantes.filter(v => v.article_id === ajout.id).length : 0} onClose={() => setAjout(null)} />
      <VarianteForm value={editVar} onClose={() => setEditVar(null)} />
      <ProduitForm value={editProduit} onClose={() => setEditProduit(null)} />
      <EntreeStock value={entree} onClose={() => setEntree(null)} />
      <OffreForm value={editOffre} onClose={() => setEditOffre(null)} />
    </div>
  )
}

function ArticleForm({ value, onClose }: { value: Partial<Article> | null; onClose: () => void }) {
  const upsert = useUpsert<Article>('articles', ['articles'])
  const toast = useToast()
  const [f, setF] = useState<Partial<Article>>({})
  const [prev, setPrev] = useState<Partial<Article> | null>(null)
  if (value !== prev) { setPrev(value); setF(value ?? {}) }

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const { id, nom, categorie, description, prix, actif, ordre } = f
      await upsert.mutateAsync({ id, nom: (nom ?? '').trim(), categorie: (categorie ?? '').trim(), description: (description ?? '').trim(), prix: Number(prix) || 0, actif: actif ?? true, ordre: Number(ordre) || 0 })
      toast(id ? 'Article modifié' : 'Article créé — ajoutez maintenant ses tailles / variantes'); onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open={!!value} onClose={onClose} title={f.id ? "Modifier l'article" : 'Nouvel article'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom"><input className="input" required value={f.nom ?? ''} onChange={e => setF({ ...f, nom: e.target.value })} placeholder="ex. Maillot club, Tube RSL Grade 3" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Catégorie"><input className="input" list="cat-articles" value={f.categorie ?? ''} onChange={e => setF({ ...f, categorie: e.target.value })} placeholder="Volants, Vêtements…" /></Field>
          <Field label="Prix (€)"><input className="input" type="number" min={0} step="0.01" required value={f.prix ?? 0} onChange={e => setF({ ...f, prix: e.target.value as unknown as number })} /></Field>
        </div>
        <datalist id="cat-articles"><option value="Volants" /><option value="Vêtements" /><option value="Accessoires" /></datalist>
        <Field label="Description (optionnel)"><input className="input" value={f.description ?? ''} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Ordre d'affichage"><input className="input" type="number" value={f.ordre ?? 0} onChange={e => setF({ ...f, ordre: e.target.value as unknown as number })} /></Field>
        {f.id && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.actif ?? true} onChange={e => setF({ ...f, actif: e.target.checked })} className="h-4 w-4 accent-aasc-orange" /> Article en vente
          </label>
        )}
        <button className="btn-primary w-full" disabled={upsert.isPending}>Enregistrer</button>
      </form>
    </Modal>
  )
}

function AjoutVariantes({ article, nbExistants, onClose }: { article: Article | null; nbExistants: number; onClose: () => void }) {
  const ajouter = useAjouterVariantes()
  const categories = useCategories().data ?? []
  const toast = useToast()
  const [tailles, setTailles] = useState('')
  const [creer, setCreer] = useState(true)
  const [seuil, setSeuil] = useState('2')
  const [prev, setPrev] = useState<Article | null>(null)
  if (article !== prev) { setPrev(article); setTailles(nbExistants ? '' : 'XS, S, M, L, XL'); setCreer(true) }

  const libelles = tailles.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!article) return
    try {
      await ajouter.mutateAsync({
        articleId: article.id, articleNom: article.nom, libelles: libelles.length ? libelles : [''], creerProduits: creer,
        seuil: Number(seuil) || 0, categorieId: categories.find(c => c.nom === 'Boutique')?.id ?? null, ordreDepart: nbExistants,
      })
      toast('Variantes ajoutées'); onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open={!!article} onClose={onClose} title={`Variantes — ${article?.nom ?? ''}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Tailles / variantes" hint="Séparées par des virgules. Laisser vide pour un article sans taille (ex. tube de volants).">
          <input className="input" value={tailles} onChange={e => setTailles(e.target.value)} placeholder="XS, S, M, L, XL" />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={creer} onChange={e => setCreer(e.target.checked)} className="mt-0.5 h-4 w-4 accent-aasc-orange" />
          <span>Créer le produit de stock correspondant à chaque variante
            <span className="block text-xs text-slate-500">« {article?.nom}{libelles[0] ? ` – ${libelles[0]}` : ''} »… (réutilisé s'il existe déjà). Décochez pour lier un produit existant ensuite.</span></span>
        </label>
        {creer && <Field label="Seuil stock bas (par variante)"><input className="input" type="number" min={0} value={seuil} onChange={e => setSeuil(e.target.value)} /></Field>}
        <button className="btn-primary w-full" disabled={ajouter.isPending}>Ajouter {libelles.length || 1} variante(s)</button>
      </form>
    </Modal>
  )
}

function VarianteForm({ value, onClose }: { value: { v: ArticleVariante; a: Article } | null; onClose: () => void }) {
  const upsert = useUpsert<ArticleVariante>('article_variantes', ['article_variantes'])
  const produits = (useProduits().data ?? []).filter(p => p.actif)
  const toast = useToast()
  const [f, setF] = useState<Partial<ArticleVariante> & { prixTxt?: string }>({})
  const [prev, setPrev] = useState<typeof value>(null)
  const [nouveauProduit, setNouveauProduit] = useState<Partial<Produit> | null>(null)
  if (value !== prev) { setPrev(value); setF(value ? { ...value.v, prixTxt: value.v.prix == null ? '' : String(value.v.prix) } : {}) }

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await upsert.mutateAsync({ id: f.id, libelle: (f.libelle ?? '').trim(), produit_id: f.produit_id || null, prix: f.prixTxt === '' || f.prixTxt == null ? null : Number(f.prixTxt), actif: f.actif ?? true })
      toast('Variante modifiée'); onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <>
      <Modal open={!!value} onClose={onClose} title="Modifier la variante">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Libellé (taille, couleur…)"><input className="input" value={f.libelle ?? ''} onChange={e => setF({ ...f, libelle: e.target.value })} /></Field>
          <Field label="Produit de stock">
            <div className="flex gap-2">
              <select className="input" value={f.produit_id ?? ''} onChange={e => setF({ ...f, produit_id: e.target.value })}>
                <option value="">— Non suivi en stock —</option>
                {produits.map(p => <option key={p.id} value={p.id}>{p.designation}</option>)}
              </select>
              <button type="button" className="btn-ghost shrink-0" title="Créer un produit"
                onClick={() => setNouveauProduit({ designation: `${value?.a.nom ?? ''}${f.libelle ? ` – ${f.libelle}` : ''}`, unite: 'unité', seuil_min: 0, actif: true })}><Plus size={16} /></button>
            </div>
          </Field>
          <Field label="Prix spécifique (€)" hint={`Vide = prix de l'article (${fmtEuro(value?.a.prix)})`}>
            <input className="input" type="number" min={0} step="0.01" value={f.prixTxt ?? ''} onChange={e => setF({ ...f, prixTxt: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.actif ?? true} onChange={e => setF({ ...f, actif: e.target.checked })} className="h-4 w-4 accent-aasc-orange" /> Variante en vente
          </label>
          <button className="btn-primary w-full" disabled={upsert.isPending}>Enregistrer</button>
        </form>
      </Modal>
      <ProduitForm value={nouveauProduit} onClose={() => setNouveauProduit(null)} onSaved={id => setF(s => ({ ...s, produit_id: id }))} />
    </>
  )
}

/** Ajout rapide de stock (nouveau lot) dans une caisse — ex. « Réserve volants » */
function EntreeStock({ value, onClose }: { value: { produitId: string; libelle: string } | null; onClose: () => void }) {
  const caisses = (useCaisses().data ?? []).filter(c => c.actif)
  const creer = useCreerLot()
  const toast = useToast()
  const [caisse, setCaisse] = useState('')
  const [qte, setQte] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!value) return
    try {
      await creer.mutateAsync({ caisse, produit: value.produitId, quantite: Number(qte) })
      toast('Stock ajouté'); setQte(''); onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open={!!value} onClose={onClose} title={`Ajouter du stock — ${value?.libelle ?? ''}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Caisse / emplacement" hint="Pour un stock « hors caisse », créez une caisse dédiée (ex. Réserve volants) dans Stock › Caisses.">
          <select className="input" required value={caisse} onChange={e => setCaisse(e.target.value)}>
            <option value="">— Choisir —</option>
            {caisses.map(c => <option key={c.id} value={c.id}>{c.code} · {c.nom} ({c.emplacement})</option>)}
          </select>
        </Field>
        <Field label="Quantité"><input className="input" type="number" min={1} step="any" required value={qte} onChange={e => setQte(e.target.value)} /></Field>
        <button className="btn-primary w-full" disabled={creer.isPending}>Ajouter au stock</button>
      </form>
    </Modal>
  )
}

function OffreForm({ value, onClose }: { value: Partial<OffreCordage> | null; onClose: () => void }) {
  const upsert = useUpsert<OffreCordage>('offres_cordage', ['offres_cordage'])
  const produits = (useProduits().data ?? []).filter(p => p.actif)
  const toast = useToast()
  const [f, setF] = useState<Partial<OffreCordage>>({})
  const [prev, setPrev] = useState<Partial<OffreCordage> | null>(null)
  const [nouveauProduit, setNouveauProduit] = useState<Partial<Produit> | null>(null)
  if (value !== prev) { setPrev(value); setF(value ?? {}) }

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const { id, nom, prix, produit_id, actif, ordre } = f
      await upsert.mutateAsync({ id, nom: (nom ?? '').trim(), prix: Number(prix) || 0, produit_id: produit_id || null, actif: actif ?? true, ordre: Number(ordre) || 0 })
      toast('Offre enregistrée'); onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <>
      <Modal open={!!value} onClose={onClose} title={f.id ? "Modifier l'offre" : 'Nouvelle offre de cordage'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom"><input className="input" required value={f.nom ?? ''} onChange={e => setF({ ...f, nom: e.target.value })} /></Field>
            <Field label="Prix (€)"><input className="input" type="number" min={0} step="0.01" required value={f.prix ?? 0} onChange={e => setF({ ...f, prix: e.target.value as unknown as number })} /></Field>
          </div>
          <Field label="Garniture sortie du stock" hint="Pour l'offre « club » : 1 garniture est sortie du stock quand la raquette est cordée.">
            <div className="flex gap-2">
              <select className="input" value={f.produit_id ?? ''} onChange={e => setF({ ...f, produit_id: e.target.value })}>
                <option value="">— Aucune (cordage fourni par le joueur) —</option>
                {produits.map(p => <option key={p.id} value={p.id}>{p.designation}</option>)}
              </select>
              <button type="button" className="btn-ghost shrink-0" title="Créer un produit"
                onClick={() => setNouveauProduit({ designation: 'Garniture cordage club', unite: 'garniture', seuil_min: 3, actif: true })}><Plus size={16} /></button>
            </div>
          </Field>
          {f.id && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.actif ?? true} onChange={e => setF({ ...f, actif: e.target.checked })} className="h-4 w-4 accent-aasc-orange" /> Offre proposée
            </label>
          )}
          <button className="btn-primary w-full" disabled={upsert.isPending}>Enregistrer</button>
        </form>
      </Modal>
      <ProduitForm value={nouveauProduit} onClose={() => setNouveauProduit(null)} onSaved={id => setF(s => ({ ...s, produit_id: id }))} />
    </>
  )
}
