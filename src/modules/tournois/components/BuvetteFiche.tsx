import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Coffee, Cookie, CopyPlus, CupSoda, Eye, EyeOff, Image, PackagePlus, Plus, Sandwich, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { errMsg } from '@/core/supabase'
import type { BuvetteLigne, RubriqueBuvette, Tournoi } from '@/core/types'
import { EmptyState, Field, Modal, Spinner, useToast } from '@/core/ui'
import { useCategories, useProduits, useTournois } from '@/modules/stock/api'
import { fmtDate } from '@/modules/stock/components/shared'
import {
  useAjouterLignesBuvette, useBuvetteLignes, useEchangerOrdreBuvette, useModifierLigneBuvette, useReprendreBuvette, useSupprimerLigneBuvette,
} from '../api'
import { RUBRIQUES, articlesStock, fmtPrix, grouperBuvette, ordreSuivant, rubriqueSuggeree } from '../buvette'

export const ICONES_RUBRIQUE: Record<RubriqueBuvette, LucideIcon> = { fraiche: CupSoda, chaude: Coffee, sale: Sandwich, sucre: Cookie }

/** « 1,5 » ou « 1.50 » → 1.5 ; null si invalide */
function lirePrix(s: string) {
  const n = Number(s.replace(',', '.').replace(/[€\s]/g, ''))
  return s.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

/** Onglet « Buvette » du tableau de bord d'un événement */
export function BuvetteFiche({ t }: { t: Tournoi }) {
  const toutes = useBuvetteLignes()
  const lignes = useMemo(() => (toutes.data ?? []).filter(l => l.tournoi_id === t.id), [toutes.data, t.id])
  const sections = grouperBuvette(lignes)
  const [modal, setModal] = useState<'stock' | 'libre' | 'reprendre' | null>(null)
  const visibles = lignes.filter(l => l.visible).length

  if (toutes.isLoading) return <Spinner />

  const actions = (
    <>
      <button className="btn-primary" onClick={() => setModal('stock')}><PackagePlus size={16} /> Ajouter depuis le stock</button>
      <button className="btn-ghost" onClick={() => setModal('libre')}><Plus size={16} /> Article libre</button>
      <button className="btn-ghost" onClick={() => setModal('reprendre')}><CopyPlus size={16} /> Reprendre une buvette</button>
    </>
  )

  return (
    <div>
      {lignes.length === 0 ? (
        <EmptyState title="Pas encore de buvette">
          <p className="mb-4 max-w-md">Choisissez les produits vendus à la buvette et leur prix pour cet événement, puis imprimez l'affiche en A4 ou A3.</p>
          <div className="flex flex-wrap justify-center gap-2">{actions}</div>
        </EmptyState>
      ) : <>
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          {actions}
          <Link to={`/tournois/${t.id}/buvette`} className="btn-secondary sm:ml-auto"><Image size={16} /> Affiche ({visibles} produit{visibles > 1 ? 's' : ''})</Link>
        </div>
        <p className="mb-4 text-sm text-slate-400">Les prix saisis ici valent pour cet événement : le prix de vente du produit dans le stock ne change pas. L'œil masque un produit de l'affiche sans le supprimer.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map(s => {
            const Icone = ICONES_RUBRIQUE[s.rubrique.id]
            const boisson = s.rubrique.genre === 'boisson'
            return (
              <section key={s.rubrique.id} className="card p-4">
                <h3 className="mb-3 flex items-center gap-3">
                  <span className={`inline-flex -skew-x-[18deg] items-center gap-2 px-3 py-1 text-white ${boisson ? 'bg-aasc-blue' : 'bg-aasc-orange'}`}>
                    <span className="flex skew-x-[18deg] items-center gap-2 font-display text-sm font-black uppercase italic tracking-wide"><Icone size={15} /> {s.rubrique.nom}</span>
                  </span>
                  <span className={`h-0.5 flex-1 -skew-x-[18deg] ${boisson ? 'bg-aasc-blue' : 'bg-aasc-orange'}`} />
                </h3>
                <ul className="divide-y divide-aasc-line/60">
                  {s.lignes.map((l, i) => <LigneBuvette key={l.id} l={l} avant={s.lignes[i - 1]} apres={s.lignes[i + 1]} />)}
                </ul>
              </section>
            )
          })}
        </div>
      </>}

      {modal === 'stock' && <AjoutStock t={t} lignes={lignes} onClose={() => setModal(null)} />}
      {modal === 'libre' && <AjoutLibre t={t} lignes={lignes} onClose={() => setModal(null)} />}
      {modal === 'reprendre' && <Reprendre t={t} lignes={lignes} toutes={toutes.data ?? []} onClose={() => setModal(null)} />}
    </div>
  )
}

function LigneBuvette({ l, avant, apres }: { l: BuvetteLigne; avant?: BuvetteLigne; apres?: BuvetteLigne }) {
  const toast = useToast()
  const modifier = useModifierLigneBuvette()
  const echanger = useEchangerOrdreBuvette()
  const supprimer = useSupprimerLigneBuvette()
  const [libelle, setLibelle] = useState(l.libelle)
  const [prix, setPrix] = useState(fmtPrix(l.prix))

  useEffect(() => { setLibelle(l.libelle) }, [l.libelle])
  useEffect(() => { setPrix(fmtPrix(l.prix)) }, [l.prix])

  async function maj(p: Partial<BuvetteLigne>) {
    try { await modifier.mutateAsync({ id: l.id, ...p }) } catch (e) { toast(errMsg(e), 'err') }
  }
  function validerLibelle() {
    const v = libelle.trim()
    if (!v) { setLibelle(l.libelle); return }
    if (v !== l.libelle) maj({ libelle: v })
  }
  function validerPrix() {
    const n = lirePrix(prix)
    if (n == null) { setPrix(fmtPrix(l.prix)); toast('Prix invalide', 'err'); return }
    setPrix(fmtPrix(n))
    if (n !== Number(l.prix)) maj({ prix: n })
  }
  async function deplacer(autre?: BuvetteLigne) {
    if (!autre) return
    try { await echanger.mutateAsync([l, autre]) } catch (e) { toast(errMsg(e), 'err') }
  }

  return (
    <li className={`flex flex-wrap items-center gap-2 py-2 ${l.visible ? '' : 'opacity-50'}`}>
      <input className="input min-w-0 flex-1 basis-40 py-2" aria-label="Nom sur l'affiche" value={libelle}
        onChange={e => setLibelle(e.target.value)} onBlur={validerLibelle} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
      <div className="relative w-24">
        <input className="input py-2 pr-7 text-right font-display font-black italic tabular-nums" inputMode="decimal" aria-label={`Prix de ${l.libelle}`}
          value={prix} onChange={e => setPrix(e.target.value)} onBlur={validerPrix} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
      </div>
      <select className="input w-auto py-2" aria-label={`Rubrique de ${l.libelle}`} value={l.rubrique}
        onChange={e => maj({ rubrique: e.target.value as RubriqueBuvette })}>
        {RUBRIQUES.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
      </select>
      <div className="flex gap-1">
        <button className="btn-icon btn-ghost" disabled={!avant} onClick={() => deplacer(avant)} aria-label={`Monter ${l.libelle}`}><ArrowUp size={16} /></button>
        <button className="btn-icon btn-ghost" disabled={!apres} onClick={() => deplacer(apres)} aria-label={`Descendre ${l.libelle}`}><ArrowDown size={16} /></button>
        <button className="btn-icon btn-ghost" onClick={() => maj({ visible: !l.visible })}
          aria-label={l.visible ? `Masquer ${l.libelle} de l'affiche` : `Afficher ${l.libelle}`} title={l.visible ? 'Masquer de l\'affiche' : 'Remettre sur l\'affiche'}>
          {l.visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        <button className="btn-icon btn-ghost text-red-300" aria-label={`Retirer ${l.libelle}`} onClick={async () => {
          if (!confirm(`Retirer « ${l.libelle} » de la buvette ?`)) return
          try { await supprimer.mutateAsync(l.id) } catch (e) { toast(errMsg(e), 'err') }
        }}><Trash2 size={16} /></button>
      </div>
    </li>
  )
}

function AjoutStock({ t, lignes, onClose }: { t: Tournoi; lignes: BuvetteLigne[]; onClose: () => void }) {
  const toast = useToast()
  const produits = useProduits()
  const categories = useCategories().data ?? []
  const ajouter = useAjouterLignesBuvette()
  const [recherche, setRecherche] = useState('')
  const [choix, setChoix] = useState<Set<string>>(new Set())

  const articles = useMemo(() => articlesStock(produits.data ?? []), [produits.data])
  const nomCat = useMemo(() => new Map(categories.map(c => [c.id, c.nom])), [categories])
  const deja = useMemo(() => new Set(lignes.map(l => l.libelle.toLowerCase())), [lignes])
  const r = recherche.trim().toLowerCase()
  const liste = articles.filter(a => !r || a.nom.toLowerCase().includes(r))
  // Les produits vendus (avec un prix de vente) d'abord
  liste.sort((a, b) => Number(b.prix != null) - Number(a.prix != null))

  function basculer(cle: string) {
    const n = new Set(choix); if (n.has(cle)) n.delete(cle); else n.add(cle); setChoix(n)
  }

  async function valider() {
    const ordres = new Map<RubriqueBuvette, number>()
    const nouvelles = articles.filter(a => choix.has(a.cle)).map(a => {
      const rubrique = rubriqueSuggeree(a.nom, a.categorieId ? nomCat.get(a.categorieId) : null)
      const ordre = ordres.get(rubrique) ?? ordreSuivant(lignes, rubrique)
      ordres.set(rubrique, ordre + 1)
      return { tournoi_id: t.id, produit_id: a.produitId, libelle: a.nom, rubrique, prix: a.prix ?? 0, ordre, visible: true }
    })
    try {
      await ajouter.mutateAsync(nouvelles)
      toast(`${nouvelles.length} produit(s) ajouté(s). Vérifiez rubriques et prix.`)
      onClose()
    } catch (e) { toast(errMsg(e), 'err') }
  }

  return (
    <Modal open onClose={onClose} title="Ajouter depuis le stock" wide>
      <input className="input mb-3" placeholder="Rechercher un produit…" value={recherche} onChange={e => setRecherche(e.target.value)} autoFocus />
      {produits.isLoading ? <Spinner /> : (
        <ul className="mb-4 max-h-[50dvh] divide-y divide-aasc-line/60 overflow-y-auto">
          {liste.map(a => {
            const present = deja.has(a.nom.toLowerCase())
            return (
              <li key={a.cle}>
                <label className={`flex items-center gap-3 px-1 py-2.5 ${present ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input type="checkbox" className="h-4 w-4 accent-aasc-orange" disabled={present} checked={choix.has(a.cle)} onChange={() => basculer(a.cle)} />
                  <span className="min-w-0 flex-1 truncate">{a.nom}</span>
                  <span className="text-sm text-slate-400">{present ? 'déjà à la buvette' : a.prix != null ? `${fmtPrix(a.prix)} €` : 'pas de prix'}</span>
                </label>
              </li>
            )
          })}
          {!liste.length && <li className="py-6 text-center text-sm text-slate-400">Aucun produit trouvé. Ajoutez-le comme article libre.</li>}
        </ul>
      )}
      <p className="mb-3 text-xs text-slate-500">Le prix de vente du produit est repris, modifiable ensuite pour cet événement. Sans prix de vente, il démarre à 0 €.</p>
      <button className="btn-primary w-full" disabled={!choix.size || ajouter.isPending} onClick={valider}>Ajouter ({choix.size})</button>
    </Modal>
  )
}

function AjoutLibre({ t, lignes, onClose }: { t: Tournoi; lignes: BuvetteLigne[]; onClose: () => void }) {
  const toast = useToast()
  const ajouter = useAjouterLignesBuvette()
  const [libelle, setLibelle] = useState('')
  const [rubrique, setRubrique] = useState<RubriqueBuvette>('sucre')
  const [prix, setPrix] = useState('')
  const [rubriqueChoisie, setRubriqueChoisie] = useState(false)

  async function envoyer(e: FormEvent) {
    e.preventDefault()
    const n = lirePrix(prix)
    if (!libelle.trim()) return
    if (n == null) { toast('Prix invalide', 'err'); return }
    try {
      await ajouter.mutateAsync([{ tournoi_id: t.id, produit_id: null, libelle: libelle.trim(), rubrique, prix: n, ordre: ordreSuivant(lignes, rubrique), visible: true }])
      onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open onClose={onClose} title="Article libre">
      <form className="space-y-4" onSubmit={envoyer}>
        <Field label="Nom sur l'affiche" hint="Pour ce qui n'est pas suivi en stock : crêpes maison, gâteaux apportés…">
          <input className="input" required autoFocus value={libelle} onChange={e => {
            setLibelle(e.target.value)
            if (!rubriqueChoisie) setRubrique(rubriqueSuggeree(e.target.value))
          }} />
        </Field>
        <Field label="Rubrique">
          <select className="input" value={rubrique} onChange={e => { setRubrique(e.target.value as RubriqueBuvette); setRubriqueChoisie(true) }}>
            {RUBRIQUES.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
          </select>
        </Field>
        <Field label="Prix (€)"><input className="input" required inputMode="decimal" placeholder="1,50" value={prix} onChange={e => setPrix(e.target.value)} /></Field>
        <button className="btn-primary w-full" disabled={ajouter.isPending}>Ajouter</button>
      </form>
    </Modal>
  )
}

function Reprendre({ t, lignes, toutes, onClose }: { t: Tournoi; lignes: BuvetteLigne[]; toutes: BuvetteLigne[]; onClose: () => void }) {
  const toast = useToast()
  const tournois = useTournois().data ?? []
  const reprendre = useReprendreBuvette()
  const parTournoi = useMemo(() => {
    const m = new Map<string, BuvetteLigne[]>()
    for (const l of toutes) if (l.tournoi_id !== t.id) m.set(l.tournoi_id, [...(m.get(l.tournoi_id) ?? []), l])
    return m
  }, [toutes, t.id])
  const sources = tournois.filter(x => parTournoi.has(x.id))
  const [source, setSource] = useState('')

  async function valider() {
    const src = parTournoi.get(source)
    if (!src) return
    if (lignes.length && !confirm(`Remplacer les ${lignes.length} produit(s) de la buvette actuelle ?`)) return
    try {
      await reprendre.mutateAsync({ tournoiId: t.id, source: src })
      toast(`${src.length} produit(s) repris. Pensez à vérifier les prix.`)
      onClose()
    } catch (e) { toast(errMsg(e), 'err') }
  }

  return (
    <Modal open onClose={onClose} title="Reprendre une buvette">
      {!sources.length ? <p className="text-sm text-slate-400">Aucun autre événement n'a encore de buvette.</p> : (
        <div className="space-y-4">
          <Field label="Événement" hint={lignes.length ? 'Remplace la buvette actuelle de cet événement.' : 'Copie ses produits, rubriques et prix.'}>
            <select className="input" value={source} onChange={e => setSource(e.target.value)}>
              <option value="">Choisir…</option>
              {sources.map(x => <option key={x.id} value={x.id}>{x.nom} · {fmtDate(x.date)} ({parTournoi.get(x.id)!.length} produits)</option>)}
            </select>
          </Field>
          <button className="btn-primary w-full" disabled={!source || reprendre.isPending} onClick={valider}>Reprendre</button>
        </div>
      )}
    </Modal>
  )
}
