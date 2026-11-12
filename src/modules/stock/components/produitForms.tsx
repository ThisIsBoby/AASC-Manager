import { useState, type FormEvent } from 'react'
import { Plus, Ruler, Trash2 } from 'lucide-react'
import { errMsg } from '@/core/supabase'
import type { Produit } from '@/core/types'
import { Field, Modal, fmtQ, useToast } from '@/core/ui'
import { useCaisses, useCategories, useCreerLot, useEnregistrerProduits, useStockProduits, useSupprimerProduits } from '../api'
import { designationTaille, parseTailles, prixGroupe, type GroupeProduits } from '../logic'

const prixVersTexte = (p: number | null | undefined) => (p == null ? '' : String(p))
const texteVersPrix = (t: string) => (t.trim() === '' ? null : Number(t.replace(',', '.')))

function ChampPrix({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <Field label="Prix de vente (€)" hint={hint ?? 'Laisser vide si le produit n\'est pas vendu en boutique'}>
      <input className="input" type="number" min={0} step="0.01" value={value} onChange={e => onChange(e.target.value)} placeholder="Pas vendu" />
    </Field>
  )
}

function ChampCategorie({ value, onChange }: { value: string | null | undefined; onChange: (v: string) => void }) {
  const categories = useCategories().data ?? []
  return (
    <Field label="Catégorie">
      <select className="input" value={value ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">—</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </select>
    </Field>
  )
}

// ---------------------------------------------------------------------
// Suppression : seulement sans stock ; l'historique est conservé
// ---------------------------------------------------------------------
function BoutonSupprimer({ produits, libelle, onDone }: { produits: Pick<Produit, 'id' | 'designation'>[]; libelle: string; onDone: () => void }) {
  const stock = useStockProduits().data ?? []
  const supprimer = useSupprimerProduits()
  const toast = useToast()

  async function go() {
    const ids = new Set(produits.map(p => p.id))
    const avecLots = stock.filter(s => ids.has(s.id) && s.nb_lots > 0)
    if (avecLots.length) {
      return toast(`Impossible : il reste du stock (${avecLots.map(s => `${s.designation} : ${fmtQ(s.stock_valide + s.stock_perime)}`).join(', ')}). Sortez-le d'abord, ou décochez « actif » pour masquer le produit.`, 'err')
    }
    if (!confirm(`Supprimer définitivement ${libelle} ?\n\nL'historique et les ventes passées sont conservés. Le produit est aussi retiré des modèles de tournoi.`)) return
    try { await supprimer.mutateAsync([...ids]); toast('Produit supprimé'); onDone() }
    catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <button type="button" className="btn-ghost w-full text-sm text-red-300" disabled={supprimer.isPending} onClick={go}>
      <Trash2 size={14} /> Supprimer {libelle}
    </button>
  )
}

// ---------------------------------------------------------------------
// Produit (simple, ou une taille d'un modèle)
// ---------------------------------------------------------------------
type FormProduit = Partial<Produit> & { prixTxt: string; avecTailles: boolean; tailles: string }

export function ProduitForm({ value, onClose, onSaved, onTailles }: {
  value: Partial<Produit> | null
  onClose: () => void
  onSaved?: (id: string) => void
  /** Proposé sur un produit simple existant : le décliner en tailles */
  onTailles?: (p: Produit) => void
}) {
  const enregistrer = useEnregistrerProduits()
  const toast = useToast()
  const [f, setF] = useState<FormProduit>({ prixTxt: '', avecTailles: false, tailles: '' })
  const [prev, setPrev] = useState<Partial<Produit> | null>(null)
  if (value !== prev) { setPrev(value); setF({ ...(value ?? {}), prixTxt: prixVersTexte(value?.prix_vente), avecTailles: false, tailles: '' }) }

  const estTaille = !!f.modele
  const tailles = parseTailles(f.tailles)
  const commun = { categorie_id: f.categorie_id || null, unite: (f.unite ?? '').trim() || 'unité', seuil_min: Number(f.seuil_min) || 0 }

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      let rows: Partial<Produit>[]
      if (estTaille) {
        const taille = (f.taille ?? '').trim()
        rows = [{ id: f.id, taille, designation: designationTaille(f.modele!, taille), unite: commun.unite, seuil_min: commun.seuil_min, actif: f.actif ?? true }]
      } else if (!f.id && f.avecTailles) {
        if (!tailles.length) return toast('Indiquez au moins une variante', 'err')
        const modele = (f.designation ?? '').trim()
        rows = tailles.map((t, i) => ({ ...commun, designation: designationTaille(modele, t), modele, taille: t, ordre: i + 1, prix_vente: texteVersPrix(f.prixTxt), actif: true }))
      } else {
        rows = [{ id: f.id, ...commun, designation: (f.designation ?? '').trim(), prix_vente: texteVersPrix(f.prixTxt), actif: f.actif ?? true }]
      }
      const ids = await enregistrer.mutateAsync(rows)
      toast(f.id ? 'Produit modifié' : rows.length > 1 ? `${rows.length} variantes créées` : 'Produit créé')
      onSaved?.(ids[0]); onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  const titre = estTaille ? `${f.modele} — ${f.taille || ''}` : f.id ? 'Modifier le produit' : 'Nouveau produit'

  return (
    <Modal open={!!value} onClose={onClose} title={titre}>
      <form onSubmit={submit} className="space-y-4">
        {estTaille ? (
          <>
            <Field label="Variante"><input className="input" required value={f.taille ?? ''} onChange={e => setF({ ...f, taille: e.target.value })} /></Field>
            <p className="rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-400">Le nom, la catégorie et le prix sont communs à toutes les variantes : modifiez-les sur la ligne « {f.modele} ».</p>
          </>
        ) : (
          <>
            <Field label="Nom"><input className="input" required value={f.designation ?? ''} onChange={e => setF({ ...f, designation: e.target.value })} placeholder="ex. Volants plume (tube de 12), Maillot club" /></Field>
            <ChampCategorie value={f.categorie_id} onChange={v => setF({ ...f, categorie_id: v })} />
            <ChampPrix value={f.prixTxt} onChange={v => setF({ ...f, prixTxt: v })} hint={f.avecTailles ? 'Même prix pour toutes les variantes. Vide = pas vendu en boutique.' : undefined} />
            {!f.id && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={f.avecTailles} onChange={e => setF({ ...f, avecTailles: e.target.checked, tailles: f.tailles })} className="mt-0.5 h-4 w-4 accent-aasc-orange" />
                <span>Existe en plusieurs variantes<span className="block text-xs text-slate-500">Tailles, parfums, couleurs… Chaque variante a son propre stock et son seuil.</span></span>
              </label>
            )}
            {f.avecTailles && (
              <Field label="Variantes" hint="Séparées par des virgules">
                <input className="input" value={f.tailles} onChange={e => setF({ ...f, tailles: e.target.value })} placeholder="ex. S, M, L ou Lion, Snickers, Kitkat" />
              </Field>
            )}
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unité"><input className="input" value={f.unite ?? ''} onChange={e => setF({ ...f, unite: e.target.value })} placeholder="unité, tube, bouteille…" /></Field>
          <Field label={f.avecTailles ? 'Seuil (par variante)' : 'Seuil minimum'} hint="Alerte si le stock passe en dessous">
            <input className="input" type="number" min={0} step="any" value={f.seuil_min ?? 0} onChange={e => setF({ ...f, seuil_min: e.target.value as unknown as number })} />
          </Field>
        </div>
        {f.id && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.actif ?? true} onChange={e => setF({ ...f, actif: e.target.checked })} className="h-4 w-4 accent-aasc-orange" /> {estTaille ? 'Variante active' : 'Produit actif'}
          </label>
        )}
        <button className="btn-primary w-full" disabled={enregistrer.isPending}>
          {!f.id && f.avecTailles ? `Créer ${tailles.length} variante(s)` : 'Enregistrer'}
        </button>
        {f.id && !estTaille && onTailles && (
          <button type="button" className="btn-ghost w-full text-sm" onClick={() => { onClose(); onTailles(value as Produit) }}>
            <Ruler size={14} /> Décliner en variantes
          </button>
        )}
        {f.id && <BoutonSupprimer produits={[{ id: f.id, designation: f.designation ?? '' }]} libelle={estTaille ? `la variante ${f.taille}` : 'ce produit'} onDone={onClose} />}
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Modèle décliné en tailles : nom, catégorie et prix communs
// ---------------------------------------------------------------------
export function ModeleForm({ value, onClose, onTailles }: {
  value: GroupeProduits<Produit> | null
  onClose: () => void
  onTailles: (g: GroupeProduits<Produit>) => void
}) {
  const enregistrer = useEnregistrerProduits()
  const toast = useToast()
  const [f, setF] = useState({ nom: '', categorie_id: '', prixTxt: '' })
  const [prev, setPrev] = useState<GroupeProduits<Produit> | null>(null)
  if (value !== prev) {
    setPrev(value)
    setF({ nom: value?.nom ?? '', categorie_id: value?.produits[0]?.categorie_id ?? '', prixTxt: prixVersTexte(value ? prixGroupe(value.produits) : null) })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!value) return
    const nom = f.nom.trim()
    try {
      await enregistrer.mutateAsync(value.produits.map(p => ({
        id: p.id, modele: nom, designation: designationTaille(nom, p.taille), categorie_id: f.categorie_id || null, prix_vente: texteVersPrix(f.prixTxt),
      })))
      toast('Produit modifié'); onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open={!!value} onClose={onClose} title={`Modifier — ${value?.nom ?? ''}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom"><input className="input" required value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} /></Field>
        <ChampCategorie value={f.categorie_id} onChange={v => setF({ ...f, categorie_id: v })} />
        <ChampPrix value={f.prixTxt} onChange={v => setF({ ...f, prixTxt: v })} hint="Même prix pour toutes les variantes. Vide = pas vendu en boutique." />
        <p className="text-xs text-slate-500">Stock, seuil et activation se règlent variante par variante (crayon sur chaque variante).</p>
        <button className="btn-primary w-full" disabled={enregistrer.isPending}>Enregistrer</button>
        <button type="button" className="btn-ghost w-full text-sm" onClick={() => { const g = value; onClose(); if (g) onTailles(g) }}>
          <Plus size={14} /> Ajouter des variantes
        </button>
        {value && <BoutonSupprimer produits={value.produits} libelle={`« ${value.nom} » et ses ${value.produits.length} variantes`} onDone={onClose} />}
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Ajouter des variantes (à un modèle, ou décliner un produit simple)
// ---------------------------------------------------------------------
export function TaillesForm({ value, stockActuel, onClose }: {
  value: GroupeProduits<Produit> | null
  /** Stock du produit simple qui va être décliné (attribué à la 1re taille) */
  stockActuel?: number
  onClose: () => void
}) {
  const enregistrer = useEnregistrerProduits()
  const toast = useToast()
  const [txt, setTxt] = useState('')
  const [seuil, setSeuil] = useState('0')
  const [prev, setPrev] = useState<GroupeProduits<Produit> | null>(null)
  if (value !== prev) {
    setPrev(value)
    setTxt('')
    setSeuil(String(value?.produits[0]?.seuil_min ?? 0))
  }

  const base = value?.produits[0]
  const existantes = new Set((value?.modele ? value.produits : []).map(p => p.taille.toLowerCase()))
  const tailles = parseTailles(txt).filter(t => !existantes.has(t.toLowerCase()))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!value || !base) return
    if (!tailles.length) return toast('Indiquez au moins une nouvelle variante', 'err')
    const modele = value.modele ?? base.designation
    const ordre0 = value.modele ? Math.max(0, ...value.produits.map(p => p.ordre)) : 0
    const nouvelle = (t: string, i: number): Partial<Produit> => ({
      designation: designationTaille(modele, t), modele, taille: t, ordre: ordre0 + i + 1,
      categorie_id: base.categorie_id, unite: base.unite, seuil_min: Number(seuil) || 0,
      prix_vente: prixGroupe(value.produits), actif: true,
    })
    const rows = value.modele
      ? tailles.map(nouvelle)
      // Produit simple : il devient la 1re taille (il garde son stock et son historique)
      : tailles.map((t, i) => (i === 0 ? { ...nouvelle(t, i), id: base.id, seuil_min: base.seuil_min, actif: base.actif } : nouvelle(t, i)))
    try {
      await enregistrer.mutateAsync(rows)
      toast(`${tailles.length} variante(s) ajoutée(s)`); onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open={!!value} onClose={onClose} title={`Variantes — ${value?.nom ?? ''}`}>
      <form onSubmit={submit} className="space-y-4">
        {value?.modele && <p className="text-sm text-slate-400">Variantes existantes : {value.produits.map(p => p.taille).join(', ')}</p>}
        <Field label={value?.modele ? 'Nouvelles variantes' : 'Variantes'} hint="Séparées par des virgules">
          <input className="input" value={txt} onChange={e => setTxt(e.target.value)} placeholder="ex. S, M, L ou Lion, Snickers, Kitkat" />
        </Field>
        <Field label="Seuil stock bas (par nouvelle variante)"><input className="input" type="number" min={0} step="any" value={seuil} onChange={e => setSeuil(e.target.value)} /></Field>
        {!value?.modele && tailles[0] && (
          <p className="rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-400">
            « {value?.nom} » devient un produit à variantes. Son stock actuel{stockActuel ? ` (${fmtQ(stockActuel)})` : ''} et son historique sont attribués à la variante <b className="text-white">{tailles[0]}</b>.
          </p>
        )}
        <button className="btn-primary w-full" disabled={enregistrer.isPending}>Ajouter {tailles.length} variante(s)</button>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Ajout rapide de stock (nouveau lot) dans une caisse
// ---------------------------------------------------------------------
export function EntreeStock({ value, onClose }: { value: { produitId: string; libelle: string } | null; onClose: () => void }) {
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
        <Field label="Caisse / emplacement" hint="Pour un stock « hors caisse », créez une caisse dédiée (ex. Réserve boutique) dans Stock › Caisses.">
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
