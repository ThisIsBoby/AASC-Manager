import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, CheckCheck, Minus, Plus, Save, ScanLine, Trash2, X } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthProvider'
import { errMsg } from '@/core/supabase'
import type { Lot } from '@/core/types'
import { EmptyState, Field, Modal, PageHeader, Spinner, fmtQ, useToast } from '@/core/ui'
import {
  type LigneComptage, useAjouterCaisseInventaire, useEnregistrerComptage, useInventaire, useInventaireCaisses,
  useInventaireLignes, useLots, useProduits, useValiderComptage,
} from '../api'
import { Ecart, EtatEcartBadge, StatutCaisseBadge } from '../components/inventaire'
import { PeremptionBadge, fmtDate, useRefs } from '../components/shared'
import { ecartLigne, estEcart } from '../logic'
import { Stepper } from './CaisseDetailPage'

interface Extra { key: string; produit_id: string; qte: string; date_peremption: string; note: string }
interface Brouillon { comptes: Record<string, string>; extras: Extra[] }

const cleBrouillon = (icId: string) => `aasc:inventaire:${icId}`
function lireBrouillon(icId: string): Brouillon | null {
  try { const v = localStorage.getItem(cleBrouillon(icId)); return v ? JSON.parse(v) as Brouillon : null } catch { return null }
}
function ecrireBrouillon(icId: string, b: Brouillon | null) {
  try { if (b) localStorage.setItem(cleBrouillon(icId), JSON.stringify(b)); else localStorage.removeItem(cleBrouillon(icId)) } catch { /* stockage indisponible */ }
}

export function InventaireComptagePage() {
  const { id, caisseId } = useParams()
  const inv = useInventaire(id)
  const caissesInv = useInventaireCaisses(id)
  const ic = caissesInv.data?.find(c => c.caisse_id === caisseId)
  const ajouter = useAjouterCaisseInventaire()
  const refs = useRefs()
  const caisse = caisseId ? refs.caisse.get(caisseId) : undefined
  const ouvert = inv.data?.statut === 'en_cours'

  // Caisse scannée mais pas prévue dans l'inventaire : on l'ajoute
  const ajoutTente = useRef(false)
  useEffect(() => {
    if (!id || !caisseId || !ouvert || caissesInv.isLoading || ic || ajoutTente.current) return
    ajoutTente.current = true
    ajouter.mutate({ inventaire: id, caisse: caisseId })
  }, [id, caisseId, ouvert, caissesInv.isLoading, ic, ajouter])

  if (inv.isLoading || caissesInv.isLoading) return <Spinner />
  if (!inv.data) return <EmptyState title="Inventaire introuvable"><Link className="text-aasc-orange" to="/stock/inventaires">Retour aux inventaires</Link></EmptyState>
  if (!ic) return ajouter.isError
    ? <EmptyState title="Caisse hors inventaire">{errMsg(ajouter.error)}</EmptyState>
    : ouvert ? <Spinner label="Ajout de la caisse à l'inventaire…" /> : <EmptyState title="Caisse non inventoriée">Cette caisse ne fait pas partie de l'inventaire.</EmptyState>

  const lectureSeule = !ouvert || ic.statut === 'valide'

  return (
    <div>
      <Link to={`/stock/inventaire/${inv.data.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> {inv.data.nom}</Link>
      <PageHeader kicker={`Inventaire · ${caisse?.code ?? ''}`} title={caisse?.nom ?? '…'} />
      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <StatutCaisseBadge statut={ic.statut} />
        {ic.compte_le && <span>Compté le {fmtDate(ic.compte_le, 'd MMM à HH:mm')}{ic.compte_par ? ` par ${refs.membre.get(ic.compte_par)?.nom ?? '…'}` : ''}</span>}
      </div>
      {lectureSeule
        ? <ComptageLecture icId={ic.id} inventaireId={inv.data.id} />
        : <ComptageSaisie key={ic.id} icId={ic.id} inventaireId={inv.data.id} caisseId={ic.caisse_id} />}
    </div>
  )
}

/** Comptage validé (ou inventaire clôturé) : affichage des écarts */
function ComptageLecture({ icId, inventaireId }: { icId: string; inventaireId: string }) {
  const lignes = (useInventaireLignes(inventaireId).data ?? []).filter(l => l.inventaire_caisse_id === icId)
  const refs = useRefs()
  if (!lignes.length) return <EmptyState title="Aucun comptage enregistré" />
  return (
    <div className="card overflow-x-auto">
      <table className="table-sport">
        <thead><tr><th>Produit</th><th className="max-sm:hidden">État</th><th className="text-right">Attendu</th><th className="text-right">Compté</th><th className="text-right">Écart</th></tr></thead>
        <tbody>
          {lignes.map(l => {
            const e = ecartLigne(l)
            return (
              <tr key={l.id}>
                <td>
                  <p className="font-semibold">{refs.produit.get(l.produit_id)?.designation ?? '…'}</p>
                  <span className="sm:hidden"><EtatEcartBadge etat={e.etat} /></span>
                </td>
                <td className="max-sm:hidden"><EtatEcartBadge etat={e.etat} /></td>
                <td className="text-right tabular-nums text-slate-400">{fmtQ(e.reference)}</td>
                <td className="text-right tabular-nums">{fmtQ(l.qte_comptee)}</td>
                <td className="text-right"><Ecart value={e.ecart} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ComptageSaisie({ icId, inventaireId, caisseId }: { icId: string; inventaireId: string; caisseId: string }) {
  const nav = useNavigate()
  const toast = useToast()
  const { isAdmin } = useAuth()
  const refs = useRefs()
  const lotsQ = useLots({ caisseId })
  const lignesQ = useInventaireLignes(inventaireId)
  const enregistrer = useEnregistrerComptage()
  const valider = useValiderComptage()
  const [comptes, setComptes] = useState<Record<string, string>>({})
  const [extras, setExtras] = useState<Extra[]>([])
  const [ajoutOuvert, setAjoutOuvert] = useState(false)
  const pret = useRef(false)

  const lots = useMemo(() => [...(lotsQ.data ?? [])].sort((a, b) =>
    (refs.produit.get(a.produit_id)?.designation ?? '').localeCompare(refs.produit.get(b.produit_id)?.designation ?? '', 'fr')), [lotsQ.data, refs])

  // Point de départ : brouillon local, sinon comptage déjà enregistré
  useEffect(() => {
    if (pret.current || lotsQ.isLoading || lignesQ.isLoading) return
    pret.current = true
    const b = lireBrouillon(icId)
    if (b) { setComptes(b.comptes); setExtras(b.extras); return }
    const lignes = (lignesQ.data ?? []).filter(l => l.inventaire_caisse_id === icId)
    const c: Record<string, string> = {}
    for (const l of lignes) if (l.lot_id && !l.nouveau && l.qte_comptee != null) c[l.lot_id] = String(Number(l.qte_comptee))
    setComptes(c)
    setExtras(lignes.filter(l => l.nouveau).map(l => ({
      key: l.id, produit_id: l.produit_id, qte: String(Number(l.qte_comptee ?? 0)), date_peremption: l.date_peremption ?? '', note: l.note,
    })))
  }, [icId, lotsQ.isLoading, lignesQ.isLoading, lignesQ.data])

  // Sauvegarde locale à chaque saisie (le téléphone peut se mettre en veille)
  useEffect(() => { if (pret.current) ecrireBrouillon(icId, { comptes, extras }) }, [icId, comptes, extras])

  if (lotsQ.isLoading || lignesQ.isLoading) return <Spinner />

  const setCompte = (lotId: string, v: string) => setComptes(c => ({ ...c, [lotId]: v }))
  const nonComptes = lots.filter(l => (comptes[l.id] ?? '') === '')
  const ecarts = lots.filter(l => {
    const v = comptes[l.id]
    return v != null && v !== '' && estEcart(ecartLigne({ nouveau: false, qte_theorique: l.quantite, qte_comptee: Number(v), qte_avant: null }).etat)
  }).length + extras.length

  const toutConforme = () => setComptes(c => {
    const n = { ...c }
    for (const l of lots) if ((n[l.id] ?? '') === '') n[l.id] = String(Number(l.quantite))
    return n
  })

  function lignesPayload(): LigneComptage[] {
    return [
      ...lots.map(l => ({ lot_id: l.id, produit_id: l.produit_id, qte_comptee: (comptes[l.id] ?? '') === '' ? null : Number(comptes[l.id]) })),
      ...extras.filter(e => Number(e.qte) > 0).map(e => ({
        lot_id: null, produit_id: e.produit_id, qte_comptee: Number(e.qte), date_peremption: e.date_peremption || null, note: e.note,
      })),
    ]
  }

  async function sauver(etValider: boolean) {
    if (etValider) {
      if (nonComptes.length) { toast('Comptez tous les éléments avant de valider', 'err'); return }
      if (!confirm(ecarts ? `Appliquer ${ecarts} écart${ecarts > 1 ? 's' : ''} au stock ?` : 'Aucun écart : valider la caisse ?')) return
    }
    try {
      const statut = await enregistrer.mutateAsync({ invCaisse: icId, lignes: lignesPayload() })
      ecrireBrouillon(icId, null)
      if (etValider) {
        const nb = await valider.mutateAsync(icId)
        toast(nb ? `Caisse validée · ${nb} ajustement${nb > 1 ? 's' : ''} appliqué${nb > 1 ? 's' : ''}` : 'Caisse validée · stock conforme')
      } else {
        toast(statut === 'compte' ? 'Comptage enregistré' : `Comptage partiel enregistré (${nonComptes.length} élément${nonComptes.length > 1 ? 's' : ''} à compter)`)
      }
      nav(`/stock/inventaire/${inventaireId}`)
    } catch (e) { toast(errMsg(e), 'err') }
  }

  const occupe = enregistrer.isPending || valider.isPending

  return (
    <div>
      {lots.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-slate-400">
            {nonComptes.length ? `${nonComptes.length} élément${nonComptes.length > 1 ? 's' : ''} à compter sur ${lots.length}` : 'Tous les éléments sont comptés'}
          </p>
          {nonComptes.length > 0 && <button className="btn-ghost ml-auto" onClick={toutConforme}><CheckCheck size={16} /> Le reste est conforme</button>}
        </div>
      )}

      {!lots.length && !extras.length && (
        <EmptyState title="Caisse vide en théorie">Si vous trouvez des éléments dans la caisse, ajoutez-les ci-dessous.</EmptyState>
      )}

      <ul className="space-y-2">
        {lots.map(l => <LigneLot key={l.id} lot={l} valeur={comptes[l.id] ?? ''} onChange={v => setCompte(l.id, v)} />)}
        {extras.map(e => {
          const p = refs.produit.get(e.produit_id)
          return (
            <li key={e.key} className="card border-sky-500/40 p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{p?.designation ?? '…'}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5"><EtatEcartBadge etat="nouveau" />{e.date_peremption && <PeremptionBadge date={e.date_peremption} />}</div>
                </div>
                <p className="text-right"><Ecart value={Number(e.qte) || 0} className="font-display text-2xl italic" /> <span className="text-xs text-slate-500">{p?.unite}</span></p>
                <button className="btn-icon btn-ghost text-red-300" title="Retirer" onClick={() => setExtras(x => x.filter(y => y.key !== e.key))}><Trash2 size={16} /></button>
              </div>
            </li>
          )
        })}
      </ul>

      <button className="btn-ghost mt-3 w-full border-dashed" onClick={() => setAjoutOuvert(true)}><Plus size={16} /> Élément trouvé en plus</button>

      {/* Barre d'actions collée en bas, au-dessus de la navigation mobile */}
      <div className="surface sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 mt-4 rounded-2xl border border-aasc-line bg-aasc-ink/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-400">{ecarts ? <><b className="text-red-300">{ecarts}</b> écart{ecarts > 1 ? 's' : ''}</> : 'Aucun écart'}</span>
          <button className="btn-ghost ml-auto" onClick={() => sauver(false)} disabled={occupe}><Save size={16} /> Enregistrer</button>
          {isAdmin && <button className="btn-primary" onClick={() => sauver(true)} disabled={occupe || nonComptes.length > 0}><Check size={16} /> Enregistrer et valider</button>}
        </div>
      </div>

      <AjoutExtra open={ajoutOuvert} onClose={() => setAjoutOuvert(false)}
        onAdd={e => setExtras(x => [...x, { ...e, key: `${Date.now()}-${Math.random()}` }])} />

      <Link to={`/stock/scanner?inventaire=${inventaireId}`} className="mt-6 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ScanLine size={14} /> Scanner une autre caisse</Link>
    </div>
  )
}

function LigneLot({ lot, valeur, onChange }: { lot: Lot; valeur: string; onChange: (v: string) => void }) {
  const refs = useRefs()
  const p = refs.produit.get(lot.produit_id)
  const compte = valeur === '' ? null : Number(valeur)
  const e = ecartLigne({ nouveau: false, qte_theorique: lot.quantite, qte_comptee: compte, qte_avant: null })
  const n = compte ?? 0
  const bord = e.etat === 'non_compte' ? '' : e.etat === 'conforme' ? 'border-emerald-500/40' : 'border-red-500/40'

  return (
    <li className={`card p-3 ${bord}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{p?.designation ?? '…'}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <PeremptionBadge date={lot.date_peremption} />
            {e.etat !== 'non_compte' && <EtatEcartBadge etat={e.etat} />}
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="text-slate-400">Attendu <b className="text-slate-200 tabular-nums">{fmtQ(lot.quantite)}</b> {p?.unite}</p>
          {e.etat !== 'non_compte' && <p>Écart <Ecart value={e.ecart} /></p>}
        </div>
      </div>
      <div className="mt-2 flex items-stretch gap-1.5">
        <button type="button" className="btn-ghost px-3" aria-label="Moins" onClick={() => onChange(String(Math.max(0, n - 1)))}><Minus size={16} /></button>
        <input className="input min-w-0 flex-1 text-center font-display text-xl font-black" type="number" step="any" min={0} inputMode="decimal"
          placeholder="Compté ?" value={valeur} onChange={ev => onChange(ev.target.value)} aria-label={`Quantité comptée de ${p?.designation ?? 'produit'}`} />
        <button type="button" className="btn-ghost px-3" aria-label="Plus" onClick={() => onChange(String(n + 1))}><Plus size={16} /></button>
        <button type="button" className={`px-3 ${e.etat === 'conforme' ? 'btn-primary' : 'btn-ghost'}`} title="Conforme" onClick={() => onChange(String(Number(lot.quantite)))}><Check size={16} /></button>
        <button type="button" className={`px-3 ${e.etat === 'absent' ? 'btn-danger' : 'btn-ghost'}`} title="Absent" onClick={() => onChange('0')}><X size={16} /></button>
      </div>
    </li>
  )
}

function AjoutExtra({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (e: Omit<Extra, 'key'>) => void }) {
  const produits = (useProduits().data ?? []).filter(p => p.actif)
  const vide = { produit_id: '', qte: '1', date_peremption: '', note: '' }
  const [f, setF] = useState(vide)
  const unite = produits.find(p => p.id === f.produit_id)?.unite

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!(Number(f.qte) > 0)) return
    onAdd(f); setF(vide); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Élément trouvé en plus">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Produit">
          <select className="input" required value={f.produit_id} onChange={e => setF({ ...f, produit_id: e.target.value })}>
            <option value="">Choisir…</option>
            {produits.map(p => <option key={p.id} value={p.id}>{p.designation}</option>)}
          </select>
        </Field>
        <Field label={`Quantité trouvée${unite ? ` (${unite})` : ''}`} group><Stepper value={f.qte} onChange={v => setF({ ...f, qte: v })} min={1} /></Field>
        <Field label="Péremption"><input type="date" className="input" value={f.date_peremption} onChange={e => setF({ ...f, date_peremption: e.target.value })} /></Field>
        <Field label="Note"><input className="input" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="optionnel" /></Field>
        <button className="btn-primary w-full"><Plus size={16} /> Ajouter au comptage</button>
      </form>
    </Modal>
  )
}
