import { useMemo, useState, type FormEvent } from 'react'
import { errMsg } from '@/core/supabase'
import type { MoyenPaiement, OffreCordage, StatutCordage } from '@/core/types'
import { Badge, Field, Modal, fmtQ, useToast } from '@/core/ui'
import { useStockProduits } from '@/modules/stock/api'
import { AdherentPicker } from '@/modules/adherents/components/AdherentPicker'
import { useArticles, useCreerCordage, useEnregistrerVente, useOffresCordage, usePaiement, useVariantes } from '../api'
import { MOYENS, fmtEuro, libelleMoyen, libelleStatut, prixVariante, stockVariante } from '../logic'

export function StatutBadge({ statut }: { statut: StatutCordage }) {
  const tone = statut === 'deposee' ? 'orange' : statut === 'cordee' ? 'blue' : 'green'
  return <Badge tone={tone}>{libelleStatut(statut)}</Badge>
}

function ChoixMoyen({ value, onChange }: { value: MoyenPaiement; onChange: (m: MoyenPaiement) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MOYENS.map(m => (
        <button type="button" key={m.v} onClick={() => onChange(m.v)}
          className={`chip border px-3 py-1.5 text-sm ${value === m.v ? 'border-aasc-orange bg-aasc-orange/25 text-white' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}>
          {m.label}
        </button>
      ))}
    </div>
  )
}

/** Payé (avec moyen) ou bouton « À payer » qui ouvre le choix du moyen */
export function PaiementCell({ table, id, paye, moyen, montant, disabled }: {
  table: 'ventes' | 'cordages'; id: string; paye: boolean; moyen: MoyenPaiement; montant: number; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [m, setM] = useState<MoyenPaiement>('especes')
  const maj = usePaiement(table)
  const toast = useToast()
  if (Number(montant) === 0) return <Badge>Offert</Badge>

  async function enregistrer(payeNew: boolean) {
    try { await maj.mutateAsync({ id, paye: payeNew, moyen: m }); setOpen(false); toast(payeNew ? 'Paiement enregistré' : 'Remis à payer') }
    catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <>
      {paye
        ? <button type="button" onClick={() => !disabled && setOpen(true)} title="Modifier le paiement"><Badge tone="green">Payé{moyen ? ` · ${libelleMoyen(moyen)}` : ''}</Badge></button>
        : <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="chip bg-red-500/20 text-red-300 hover:bg-red-500/30">À payer</button>}
      <Modal open={open} onClose={() => setOpen(false)} title={paye ? 'Paiement' : `Encaisser ${fmtEuro(montant)}`}>
        <div className="space-y-4">
          <Field label="Moyen de paiement" group><ChoixMoyen value={m} onChange={setM} /></Field>
          <button className="btn-primary w-full" disabled={maj.isPending} onClick={() => enregistrer(true)}>{paye ? 'Mettre à jour' : 'Marquer payé'}</button>
          {paye && <button className="btn-ghost w-full" disabled={maj.isPending} onClick={() => enregistrer(false)}>Remettre « à payer »</button>}
        </div>
      </Modal>
    </>
  )
}

// ---------------------------------------------------------------------
// Saisie d'une vente
// ---------------------------------------------------------------------
export function VenteForm({ open, onClose, adherentId }: { open: boolean; onClose: () => void; adherentId?: string }) {
  const articles = (useArticles().data ?? []).filter(a => a.actif)
  const variantes = (useVariantes().data ?? []).filter(v => v.actif)
  const stockList = useStockProduits().data
  const stock = useMemo(() => new Map((stockList ?? []).map(s => [s.id, s])), [stockList])
  const vendre = useEnregistrerVente()
  const toast = useToast()
  const init = { adherent: adherentId ?? '', article: '', variante: '', quantite: '1', prix: '', paye: false, moyen: 'especes' as MoyenPaiement, note: '' }
  const [f, setF] = useState(init)
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) { setWasOpen(open); if (open) setF({ ...init }) }

  const article = articles.find(a => a.id === f.article)
  const vars = variantes.filter(v => v.article_id === f.article)
  const variante = vars.find(v => v.id === f.variante) ?? (vars.length === 1 ? vars[0] : undefined)
  const dispo = variante ? stockVariante(variante, stock) : null
  const prix = f.prix !== '' ? Number(f.prix) : article && variante ? prixVariante(article, variante) : 0
  const total = prix * (Number(f.quantite) || 0)

  function choisirArticle(id: string) {
    const vs = variantes.filter(v => v.article_id === id)
    setF({ ...f, article: id, variante: vs.length === 1 ? vs[0].id : '', prix: '' })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!f.adherent) return toast('Choisissez un adhérent', 'err')
    if (!variante) return toast(vars.length ? 'Choisissez une taille / variante' : "Cet article n'a aucune variante : configurez-le dans Articles", 'err')
    try {
      await vendre.mutateAsync({ adherent: f.adherent, variante: variante.id, quantite: Number(f.quantite), prix, paye: f.paye, moyen: f.paye ? f.moyen : '', note: f.note })
      toast('Vente enregistrée'); onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle vente">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Adhérent" group><AdherentPicker value={f.adherent} onChange={id => setF({ ...f, adherent: id })} autoFocus={!adherentId} /></Field>
        <Field label="Article">
          <select className="input" required value={f.article} onChange={e => choisirArticle(e.target.value)}>
            <option value="">— Choisir —</option>
            {articles.map(a => <option key={a.id} value={a.id}>{a.nom}{a.categorie ? ` (${a.categorie})` : ''}</option>)}
          </select>
        </Field>
        {vars.length > 1 && (
          <Field label="Taille / variante" group>
            <div className="flex flex-wrap gap-1.5">
              {vars.map(v => {
                const s = stockVariante(v, stock)
                const vide = s !== null && s <= 0
                return (
                  <button type="button" key={v.id} disabled={vide} onClick={() => setF({ ...f, variante: v.id, prix: '' })}
                    className={`chip border px-3 py-1.5 text-sm ${f.variante === v.id ? 'border-aasc-orange bg-aasc-orange/25 text-white' : 'border-white/10 text-slate-300 hover:bg-white/5'} ${vide ? 'opacity-40 line-through' : ''}`}>
                    {v.libelle || '—'}{s !== null && <span className="ml-1 text-xs text-slate-400">({fmtQ(s)})</span>}
                  </button>
                )
              })}
            </div>
          </Field>
        )}
        {variante && dispo !== null && (
          <p className={`text-sm ${dispo < (Number(f.quantite) || 0) ? 'text-red-300' : 'text-slate-400'}`}>En stock : {fmtQ(dispo)}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantité"><input className="input" type="number" min={1} step={1} required value={f.quantite} onChange={e => setF({ ...f, quantite: e.target.value })} /></Field>
          <Field label="Prix unitaire (€)" hint="Pré-rempli, modifiable">
            <input className="input" type="number" min={0} step="0.01" value={f.prix !== '' ? f.prix : (article && variante ? String(prix) : '')}
              onChange={e => setF({ ...f, prix: e.target.value })} />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
          <span className="text-sm text-slate-400">Total</span>
          <span className="font-display text-2xl font-black italic">{fmtEuro(total)}</span>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.paye} onChange={e => setF({ ...f, paye: e.target.checked })} className="h-4 w-4 accent-aasc-orange" /> Payé maintenant
        </label>
        {f.paye && <ChoixMoyen value={f.moyen} onChange={m => setF({ ...f, moyen: m })} />}
        <Field label="Note (optionnel)"><input className="input" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></Field>
        <button className="btn-primary w-full" disabled={vendre.isPending}>Enregistrer la vente</button>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Saisie d'un cordage
// ---------------------------------------------------------------------
export function CordageForm({ open, onClose, adherentId }: { open: boolean; onClose: () => void; adherentId?: string }) {
  const offres = (useOffresCordage().data ?? []).filter(o => o.actif)
  const creer = useCreerCordage()
  const toast = useToast()
  const init = { adherent: adherentId ?? '', offre: '', prix: '', raquette: '', cordage_ref: '', tension: '', paye: false, moyen: 'especes' as MoyenPaiement, note: '' }
  const [f, setF] = useState(init)
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) { setWasOpen(open); if (open) setF({ ...init }) }

  const offre: OffreCordage | undefined = offres.find(o => o.id === f.offre)
  const prix = f.prix !== '' ? Number(f.prix) : Number(offre?.prix ?? 0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!f.adherent) return toast('Choisissez un adhérent', 'err')
    if (!offre) return toast('Choisissez une offre', 'err')
    try {
      await creer.mutateAsync({
        adherent_id: f.adherent, offre_id: offre.id, offre_nom: offre.nom, prix,
        raquette: f.raquette.trim(), cordage_ref: f.cordage_ref.trim(), tension: f.tension.trim(),
        paye: prix > 0 && f.paye, moyen_paiement: prix > 0 && f.paye ? f.moyen : '', note: f.note.trim(),
      })
      toast('Raquette enregistrée'); onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouveau cordage">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Adhérent" group><AdherentPicker value={f.adherent} onChange={id => setF({ ...f, adherent: id })} autoFocus={!adherentId} /></Field>
        <Field label="Offre" group>
          <div className="grid gap-2 sm:grid-cols-3">
            {offres.map(o => (
              <button type="button" key={o.id} onClick={() => setF({ ...f, offre: o.id, prix: '' })}
                className={`rounded-xl border px-3 py-2.5 text-left ${f.offre === o.id ? 'border-aasc-orange bg-aasc-orange/20' : 'border-white/10 hover:bg-white/5'}`}>
                <p className="text-sm font-semibold">{o.nom}</p>
                <p className="font-display text-xl font-black italic">{fmtEuro(o.prix)}</p>
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Raquette"><input className="input" value={f.raquette} onChange={e => setF({ ...f, raquette: e.target.value })} placeholder="Marque, modèle, couleur" /></Field>
          <Field label="Cordage"><input className="input" value={f.cordage_ref} onChange={e => setF({ ...f, cordage_ref: e.target.value })} placeholder="ex. BG65, fourni…" /></Field>
          <Field label="Tension"><input className="input" value={f.tension} onChange={e => setF({ ...f, tension: e.target.value })} placeholder="ex. 11 kg" /></Field>
          <Field label="Prix (€)"><input className="input" type="number" min={0} step="0.01" value={f.prix !== '' ? f.prix : offre ? String(prix) : ''} onChange={e => setF({ ...f, prix: e.target.value })} /></Field>
        </div>
        {prix > 0 && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.paye} onChange={e => setF({ ...f, paye: e.target.checked })} className="h-4 w-4 accent-aasc-orange" /> Payé maintenant
            </label>
            {f.paye && <ChoixMoyen value={f.moyen} onChange={m => setF({ ...f, moyen: m })} />}
          </>
        )}
        <Field label="Note (optionnel)"><input className="input" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></Field>
        <button className="btn-primary w-full" disabled={creer.isPending}>Enregistrer la raquette</button>
      </form>
    </Modal>
  )
}
