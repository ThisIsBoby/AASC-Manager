import { useState, type FormEvent } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { errMsg } from '@/core/supabase'
import type { OffreCordage, Produit } from '@/core/types'
import { Field, Modal, fmtQ, useToast } from '@/core/ui'
import { useProduits, useStockProduits, useUpsert } from '@/modules/stock/api'
import { ProduitForm } from '@/modules/stock/components/produitForms'
import { useOffresCordage } from '../api'
import { fmtEuro } from '../logic'

/** Gestion des offres de cordage (prix, garniture sortie du stock) */
export function OffresCordage({ open, onClose }: { open: boolean; onClose: () => void }) {
  const offres = useOffresCordage().data ?? []
  const stock = useStockProduits().data ?? []
  const [edit, setEdit] = useState<Partial<OffreCordage> | null>(null)
  const produit = (id: string | null) => stock.find(s => s.id === id)

  return (
    <>
      <Modal open={open && !edit} onClose={onClose} title="Offres de cordage">
        <div className="space-y-2">
          {offres.map(o => (
            <button key={o.id} type="button" onClick={() => setEdit(o)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 text-left hover:bg-white/10 ${!o.actif ? 'opacity-50' : ''}`}>
              <span>
                <span className="block font-semibold">{o.nom}</span>
                <span className="block text-xs text-slate-400">
                  {o.produit_id ? <>Consomme 1 × {produit(o.produit_id)?.designation} (stock : {fmtQ(produit(o.produit_id)?.stock_valide)})</> : 'Pas de garniture sortie du stock'}
                </span>
              </span>
              <span className="flex items-center gap-2"><span className="font-display text-xl font-black italic">{fmtEuro(o.prix)}</span><Pencil size={14} className="text-slate-500" /></span>
            </button>
          ))}
          <button type="button" className="btn-ghost w-full text-sm" onClick={() => setEdit({ actif: true, prix: 0 })}><Plus size={14} /> Nouvelle offre</button>
        </div>
      </Modal>
      <OffreForm value={edit} onClose={() => setEdit(null)} />
    </>
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
      <Modal open={!!value && !nouveauProduit} onClose={onClose} title={f.id ? "Modifier l'offre" : 'Nouvelle offre de cordage'}>
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
