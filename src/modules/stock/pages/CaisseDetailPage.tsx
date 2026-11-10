import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, ArrowRightLeft, History, MapPin, Minus, Pencil, Plus, Printer, QrCode, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthProvider'
import { AdminOnly } from '@/core/auth/guards'
import { errMsg } from '@/core/supabase'
import type { Lot } from '@/core/types'
import { EmptyState, Field, Modal, PageHeader, Spinner, fmtQ, useToast } from '@/core/ui'
import { useCaisse, useCaisses, useCreerLot, useDelete, useLots, useMouvement, useProduits, useTransfert, useUpdateLotInfos } from '../api'
import { CategorieTag, EtiquetteCaisse, PeremptionBadge, fmtDate, useRefs } from '../components/shared'
import { CaisseForm } from './CaissesPage'
import { ProduitForm } from './ProduitsPage'

type Dialog =
  | { kind: 'add' }
  | { kind: 'mvt'; lot: Lot; type: 'entree' | 'sortie' | 'ajustement' }
  | { kind: 'transfert'; lot: Lot }
  | { kind: 'edit'; lot: Lot }
  | { kind: 'qr' }
  | null

export function CaisseDetailPage() {
  const { id } = useParams()
  const { data: caisse, isLoading } = useCaisse(id)
  const lots = useLots({ caisseId: id })
  const refs = useRefs()
  const { isAdmin } = useAuth()
  const toast = useToast()
  const del = useDelete('lots', ['lots', 'stock', 'peremptions'])
  const [dlg, setDlg] = useState<Dialog>(null)
  const [editCaisse, setEditCaisse] = useState(false)

  if (isLoading) return <Spinner />
  if (!caisse) return <EmptyState title="Caisse introuvable"><Link className="text-aasc-orange" to="/stock/caisses">Retour aux caisses</Link></EmptyState>

  const cat = caisse.categorie_id ? refs.categorie.get(caisse.categorie_id) : null

  return (
    <div>
      <Link to="/stock/caisses" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Caisses</Link>
      <PageHeader kicker={caisse.code} title={caisse.nom}
        actions={<>
          <button className="btn-ghost" onClick={() => setDlg({ kind: 'qr' })}><QrCode size={16} /> QR code</button>
          <Link className="btn-ghost" to={`/stock/historique?caisse=${caisse.id}`}><History size={16} /> Historique</Link>
          <AdminOnly><button className="btn-ghost" onClick={() => setEditCaisse(true)}><Pencil size={16} /> Modifier</button></AdminOnly>
        </>} />

      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <CategorieTag cat={cat} />
        <span className="inline-flex items-center gap-1"><MapPin size={14} />{caisse.emplacement}</span>
        {caisse.description && <span>· {caisse.description}</span>}
      </div>

      <button className="btn-primary mb-5 w-full py-3 text-base sm:w-auto" onClick={() => setDlg({ kind: 'add' })}><Plus size={18} /> Ajouter un élément</button>

      {lots.isLoading ? <Spinner /> : (lots.data ?? []).length === 0 ? <EmptyState title="Caisse vide">Ajoutez le premier élément.</EmptyState> : (
        <div className="grid gap-3 md:grid-cols-2">
          {lots.data!.map((l, i) => {
            const p = refs.produit.get(l.produit_id)
            return (
              <div key={l.id} className="card animate-rise p-4" style={{ animationDelay: `${i * 25}ms` }}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold leading-tight">{p?.designation ?? '…'}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5"><PeremptionBadge date={l.date_peremption} /></div>
                    <p className="mt-1.5 text-xs text-slate-500">Acheté le {fmtDate(l.date_achat)}{l.note ? ` · ${l.note}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-4xl font-black italic leading-none tabular-nums">{fmtQ(l.quantite)}</p>
                    <p className="text-xs uppercase tracking-wider text-slate-400">{p?.unite}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-1.5 border-t border-aasc-line/60 pt-3">
                  <button className="btn-ghost flex-1" onClick={() => setDlg({ kind: 'mvt', lot: l, type: 'sortie' })}><Minus size={16} /><span className="max-[420px]:hidden">Sortir</span></button>
                  <button className="btn-ghost flex-1" onClick={() => setDlg({ kind: 'mvt', lot: l, type: 'entree' })}><Plus size={16} /><span className="max-[420px]:hidden">Ajouter</span></button>
                  <button className="btn-icon btn-ghost" title="Transférer" onClick={() => setDlg({ kind: 'transfert', lot: l })}><ArrowRightLeft size={16} /></button>
                  <button className="btn-icon btn-ghost" title="Modifier dates / note" onClick={() => setDlg({ kind: 'edit', lot: l })}><Pencil size={16} /></button>
                  {isAdmin && <>
                    <button className="btn-icon btn-ghost" title="Ajuster (inventaire)" onClick={() => setDlg({ kind: 'mvt', lot: l, type: 'ajustement' })}><SlidersHorizontal size={16} /></button>
                    <button className="btn-icon btn-ghost text-red-300" title="Supprimer" onClick={async () => {
                      if (!confirm('Supprimer ce lot sans enregistrer de sortie ?')) return
                      try { await del.mutateAsync(l.id); toast('Lot supprimé') } catch (e) { toast(errMsg(e), 'err') }
                    }}><Trash2 size={16} /></button>
                  </>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AddLotDialog open={dlg?.kind === 'add'} caisseId={caisse.id} onClose={() => setDlg(null)} />
      {dlg?.kind === 'mvt' && <MouvementDialog lot={dlg.lot} type={dlg.type} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'transfert' && <TransfertDialog lot={dlg.lot} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'edit' && <EditLotDialog lot={dlg.lot} onClose={() => setDlg(null)} />}
      <Modal open={dlg?.kind === 'qr'} onClose={() => setDlg(null)} title={`QR · ${caisse.code}`}>
        <EtiquetteCaisse caisse={caisse} cat={cat} />
        <p className="mt-3 text-xs text-slate-400">Scanné avec l'appareil photo d'un téléphone, ce QR ouvre directement cette caisse.</p>
        <Link to={`/stock/etiquettes?ids=${caisse.id}`} className="btn-primary mt-4 w-full"><Printer size={16} /> Imprimer l'étiquette</Link>
      </Modal>
      <CaisseForm value={editCaisse ? caisse : null} onClose={() => setEditCaisse(false)} />
    </div>
  )
}

function AddLotDialog({ open, caisseId, onClose }: { open: boolean; caisseId: string; onClose: () => void }) {
  const produits = (useProduits().data ?? []).filter(p => p.actif)
  const creer = useCreerLot()
  const toast = useToast()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [f, setF] = useState({ produit: '', quantite: '1', date_achat: today, date_peremption: '', note: '' })
  const [newProduit, setNewProduit] = useState(false)
  const unite = produits.find(p => p.id === f.produit)?.unite

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await creer.mutateAsync({ caisse: caisseId, produit: f.produit, quantite: Number(f.quantite), date_achat: f.date_achat, date_peremption: f.date_peremption, note: f.note })
      toast('Élément ajouté')
      setF({ produit: '', quantite: '1', date_achat: today, date_peremption: '', note: '' })
      onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open={open} onClose={onClose} title="Ajouter un élément">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Désignation (produit)">
          <div className="flex gap-2">
            <select className="input" required value={f.produit} onChange={e => setF({ ...f, produit: e.target.value })}>
              <option value="">Choisir…</option>
              {produits.map(p => <option key={p.id} value={p.id}>{p.designation}</option>)}
            </select>
            <AdminOnly><button type="button" className="btn-icon btn-ghost" title="Nouveau produit" onClick={() => setNewProduit(true)}><Plus size={16} /></button></AdminOnly>
          </div>
        </Field>
        <Field label={`Quantité${unite ? ` (${unite})` : ''}`}>
          <Stepper value={f.quantite} onChange={v => setF({ ...f, quantite: v })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date d'achat"><input type="date" className="input" value={f.date_achat} onChange={e => setF({ ...f, date_achat: e.target.value })} /></Field>
          <Field label="Péremption"><input type="date" className="input" value={f.date_peremption} onChange={e => setF({ ...f, date_peremption: e.target.value })} /></Field>
        </div>
        <Field label="Note"><input className="input" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="optionnel" /></Field>
        <button className="btn-primary w-full" disabled={creer.isPending}>Ajouter</button>
      </form>
      <ProduitForm value={newProduit ? { actif: true, unite: 'unité', seuil_min: 0 } : null} onClose={() => setNewProduit(false)}
        onSaved={id => setF(s => ({ ...s, produit: id }))} />
    </Modal>
  )
}

export function Stepper({ value, onChange, min = 0 }: { value: string; onChange: (v: string) => void; min?: number }) {
  const n = Number(value) || 0
  return (
    <div className="flex items-stretch gap-2">
      <button type="button" className="btn-ghost px-4" onClick={() => onChange(String(Math.max(min, n - 1)))}><Minus size={18} /></button>
      <input className="input text-center font-display text-2xl font-black" type="number" step="any" min={min} required value={value} onChange={e => onChange(e.target.value)} inputMode="decimal" />
      <button type="button" className="btn-ghost px-4" onClick={() => onChange(String(n + 1))}><Plus size={18} /></button>
    </div>
  )
}

function MouvementDialog({ lot, type, onClose }: { lot: Lot; type: 'entree' | 'sortie' | 'ajustement'; onClose: () => void }) {
  const refs = useRefs()
  const mvt = useMouvement()
  const toast = useToast()
  const [q, setQ] = useState(type === 'ajustement' ? String(lot.quantite) : '1')
  const [motif, setMotif] = useState('')
  const p = refs.produit.get(lot.produit_id)
  const titles = { entree: 'Ajouter au stock', sortie: 'Sortir du stock', ajustement: 'Ajuster (inventaire)' }

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const reste = await mvt.mutateAsync({ lot: lot.id, type, quantite: Number(q), motif })
      toast(reste === 0 ? 'Lot épuisé et retiré de la caisse' : `Nouveau stock : ${fmtQ(reste)} ${p?.unite ?? ''}`)
      onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open onClose={onClose} title={titles[type]}>
      <p className="mb-4 text-sm text-slate-400"><b className="text-slate-200">{p?.designation}</b> · en stock : {fmtQ(lot.quantite)} {p?.unite}</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label={type === 'ajustement' ? 'Quantité réelle comptée' : 'Quantité'}><Stepper value={q} onChange={setQ} /></Field>
        <Field label="Motif"><input className="input" value={motif} onChange={e => setMotif(e.target.value)}
          placeholder={type === 'sortie' ? 'ex. entraînement du mardi' : type === 'ajustement' ? 'ex. inventaire annuel' : 'ex. réassort'} /></Field>
        <button className={type === 'sortie' ? 'btn-secondary w-full' : 'btn-primary w-full'} disabled={mvt.isPending}>Valider</button>
      </form>
    </Modal>
  )
}

function TransfertDialog({ lot, onClose }: { lot: Lot; onClose: () => void }) {
  const caisses = (useCaisses().data ?? []).filter(c => c.id !== lot.caisse_id && c.actif)
  const refs = useRefs()
  const tr = useTransfert()
  const toast = useToast()
  const [dest, setDest] = useState('')
  const [q, setQ] = useState(String(lot.quantite))

  async function submit(e: FormEvent) {
    e.preventDefault()
    try { await tr.mutateAsync({ lot: lot.id, dest, quantite: Number(q) }); toast('Transfert effectué'); onClose() }
    catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open onClose={onClose} title="Transférer">
      <p className="mb-4 text-sm text-slate-400">{refs.produit.get(lot.produit_id)?.designation} · {fmtQ(lot.quantite)} disponible(s)</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Vers la caisse">
          <select className="input" required value={dest} onChange={e => setDest(e.target.value)}>
            <option value="">Choisir…</option>
            {caisses.map(c => <option key={c.id} value={c.id}>{c.code} · {c.nom}</option>)}
          </select>
        </Field>
        <Field label="Quantité"><Stepper value={q} onChange={setQ} /></Field>
        <button className="btn-primary w-full" disabled={tr.isPending}><ArrowRightLeft size={16} /> Transférer</button>
      </form>
    </Modal>
  )
}

function EditLotDialog({ lot, onClose }: { lot: Lot; onClose: () => void }) {
  const up = useUpdateLotInfos()
  const toast = useToast()
  const [f, setF] = useState({ date_achat: lot.date_achat ?? '', date_peremption: lot.date_peremption ?? '', note: lot.note })

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await up.mutateAsync({ id: lot.id, date_achat: f.date_achat || null, date_peremption: f.date_peremption || null, note: f.note })
      toast('Élément modifié'); onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open onClose={onClose} title="Modifier l'élément">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date d'achat"><input type="date" className="input" value={f.date_achat} onChange={e => setF({ ...f, date_achat: e.target.value })} /></Field>
          <Field label="Péremption"><input type="date" className="input" value={f.date_peremption} onChange={e => setF({ ...f, date_peremption: e.target.value })} /></Field>
        </div>
        <Field label="Note"><input className="input" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></Field>
        <p className="text-xs text-slate-500">La quantité se modifie via « Sortir », « Ajouter » ou « Ajuster » pour garder l'historique.</p>
        <button className="btn-primary w-full" disabled={up.isPending}>Enregistrer</button>
      </form>
    </Modal>
  )
}
