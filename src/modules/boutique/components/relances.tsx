import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Mail, Send } from 'lucide-react'
import { errMsg } from '@/core/supabase'
import type { Adherent } from '@/core/types'
import { Field, Modal, useToast } from '@/core/ui'
import { fmtDate } from '@/modules/stock/components/shared'
import { useAdherentsMap } from '@/modules/adherents/api'
import { nomComplet } from '@/modules/adherents/logic'
import { useCordages, useRelancer, useVentes, type ResultatRelance } from '../api'
import { fmtEuro, impayesParAdherent, relanceRecente, type ImpayesAdherent } from '../logic'
import { PaiementCell } from './shared'

const emailValide = (a?: Adherent) => Boolean(a && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim()))

function bilan(r: ResultatRelance) {
  const parts = [`${r.envoyes.length} relance${r.envoyes.length > 1 ? 's' : ''} envoyée${r.envoyes.length > 1 ? 's' : ''}`]
  if (r.sans_email.length) parts.push(`${r.sans_email.length} sans e-mail`)
  if (r.erreurs.length) parts.push(`${r.erreurs.length} en erreur`)
  return parts.join(' · ')
}

/** Résumé compact des lignes impayées d'un adhérent */
function resume(g: ImpayesAdherent) {
  return [
    ...g.ventes.map(v => (v.quantite > 1 ? `${v.quantite} × ` : '') + v.libelle),
    ...g.cordages.map(c => `Cordage ${c.offre_nom}`),
  ].join(' · ')
}

/** Bouton « Relancer » d'un adhérent : un seul e-mail pour tous ses impayés */
function BoutonRelance({ groupe, adherent, compact }: { groupe: ImpayesAdherent; adherent?: Adherent; compact?: boolean }) {
  const relancer = useRelancer()
  const toast = useToast()
  const ok = emailValide(adherent)

  async function envoyer() {
    if (!adherent) return
    const deja = relanceRecente(groupe.derniereRelance) ? `\n\n⚠ Déjà relancé le ${fmtDate(groupe.derniereRelance!, 'dd/MM à HH:mm')}.` : ''
    if (!confirm(`Envoyer un e-mail de relance à ${nomComplet(adherent)} (${adherent.email}) pour ${fmtEuro(groupe.montant)} ?${deja}`)) return
    try {
      const r = await relancer.mutateAsync({ adherentIds: [groupe.adherent_id] })
      if (r.erreurs.length) toast(r.erreurs[0].message, 'err')
      else if (r.envoyes.length) toast(`Relance envoyée à ${adherent.email}`)
      else toast('Rien à relancer', 'err')
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <button className={compact ? 'chip border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-40' : 'btn-ghost gap-1.5 px-2.5 py-1.5 text-sm'}
      disabled={!ok || relancer.isPending} onClick={e => { e.stopPropagation(); envoyer() }}
      title={ok ? `Relancer par e-mail (${fmtEuro(groupe.montant)} au total)` : 'Pas d\'adresse e-mail valide sur la fiche adhérent'}>
      <Mail size={compact ? 13 : 15} />{compact ? <span>Relancer</span> : <span className="hidden sm:inline">Relancer</span>}
    </button>
  )
}

/** Bouton « Relancer » sur une ligne « À payer » : relance l'adhérent pour l'ensemble de ses impayés */
export function BoutonRelanceLigne({ adherentId }: { adherentId: string | null }) {
  const ventes = useVentes().data
  const cordages = useCordages().data
  const adherent = useAdherentsMap().get(adherentId ?? '')
  const groupe = useMemo(() => adherentId
    ? impayesParAdherent((ventes ?? []).filter(v => v.adherent_id === adherentId), (cordages ?? []).filter(c => c.adherent_id === adherentId))[0]
    : undefined, [adherentId, ventes, cordages])
  if (!groupe || !adherent) return null
  return <BoutonRelance groupe={groupe} adherent={adherent} compact />
}

/** Impayés regroupés par adhérent : une ligne par personne, dépliable pour encaisser ligne à ligne */
export function ImpayesParAdherentTable({ groupes }: { groupes: ImpayesAdherent[] }) {
  const adherents = useAdherentsMap()
  const [ouverts, setOuverts] = useState<Set<string>>(new Set())
  const basculer = (id: string) => setOuverts(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div className="card overflow-x-auto">
      <table className="table-sport">
        <thead><tr><th className="w-8" /><th>Adhérent</th><th>À payer</th><th className="text-right">Total</th><th /></tr></thead>
        <tbody>
          {groupes.map(g => {
            const a = adherents.get(g.adherent_id)
            const ouvert = ouverts.has(g.adherent_id)
            const nb = g.ventes.length + g.cordages.length
            return (
              <Fragment key={g.adherent_id || 'aucun'}>
                <tr className="cursor-pointer" onClick={() => basculer(g.adherent_id)}>
                  <td className="text-slate-500">{ouvert ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                  <td>
                    {a ? <Link to={`/adherents/${a.id}`} onClick={e => e.stopPropagation()} className="font-semibold hover:text-aasc-orange-soft hover:underline">{nomComplet(a)}</Link>
                      : <span className="text-slate-500">Sans adhérent</span>}
                    {a && !emailValide(a) && <p className="text-[11px] text-slate-500">pas d'e-mail</p>}
                  </td>
                  <td className="max-w-xs">
                    <p className="truncate text-sm">{resume(g)}</p>
                    <p className="text-[11px] text-slate-500">
                      {nb} ligne{nb > 1 ? 's' : ''}{g.derniereRelance && ` · relancé le ${fmtDate(g.derniereRelance, 'dd/MM')}`}
                    </p>
                  </td>
                  <td className="whitespace-nowrap text-right font-semibold tabular-nums text-red-300">{fmtEuro(g.montant)}</td>
                  <td className="text-right" onClick={e => e.stopPropagation()}>{a && <BoutonRelance groupe={g} adherent={a} />}</td>
                </tr>
                {ouvert && [
                  ...g.ventes.map(v => ({ key: v.id, date: v.created_at, libelle: (v.quantite > 1 ? `${v.quantite} × ` : '') + v.libelle, montant: v.total, relance: v.relance_le,
                    cell: <PaiementCell table="ventes" id={v.id} paye={v.paye} moyen={v.moyen_paiement} montant={v.total} /> })),
                  ...g.cordages.map(c => ({ key: c.id, date: c.depose_le, libelle: `Cordage ${c.offre_nom}${c.raquette ? ` · ${c.raquette}` : ''}`, montant: c.prix, relance: c.relance_le,
                    cell: <PaiementCell table="cordages" id={c.id} paye={c.paye} moyen={c.moyen_paiement} montant={c.prix} /> })),
                ].sort((x, y) => x.date.localeCompare(y.date)).map(l => (
                  <tr key={l.key} className="bg-white/[0.02] text-sm">
                    <td />
                    <td className="whitespace-nowrap text-slate-400">{fmtDate(l.date, 'dd/MM/yy')}</td>
                    <td>{l.libelle}{l.relance && <p className="text-[11px] text-slate-500">relancé le {fmtDate(l.relance, 'dd/MM')}</p>}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{fmtEuro(l.montant)}</td>
                    <td className="text-right">{l.cell}</td>
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Relance globale : choix des adhérents puis un e-mail chacun */
export function RelanceGlobaleModal({ open, onClose, groupes }: { open: boolean; onClose: () => void; groupes: ImpayesAdherent[] }) {
  const adherents = useAdherentsMap()
  const relancer = useRelancer()
  const toast = useToast()
  const lignes = useMemo(() => groupes.filter(g => g.adherent_id).map(g => ({ g, a: adherents.get(g.adherent_id) })), [groupes, adherents])
  const [choix, setChoix] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [resultat, setResultat] = useState<ResultatRelance | null>(null)
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      // Par défaut : tous ceux qui ont un e-mail et n'ont pas été relancés dans les 24 h
      setChoix(new Set(lignes.filter(l => emailValide(l.a) && !relanceRecente(l.g.derniereRelance)).map(l => l.g.adherent_id)))
      setMessage(''); setResultat(null)
    }
  }

  const selection = lignes.filter(l => choix.has(l.g.adherent_id))
  const total = selection.reduce((s, l) => s + l.g.montant, 0)
  const basculer = (id: string) => setChoix(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const avecEmail = lignes.filter(l => emailValide(l.a))
  const tousCoches = avecEmail.length > 0 && avecEmail.every(l => choix.has(l.g.adherent_id))

  async function envoyer() {
    if (!selection.length) return
    if (!confirm(`Envoyer ${selection.length} e-mail${selection.length > 1 ? 's' : ''} de relance (${fmtEuro(total)}) ?`)) return
    try {
      const r = await relancer.mutateAsync({ adherentIds: selection.map(l => l.g.adherent_id), message })
      setResultat(r)
      toast(bilan(r), r.erreurs.length ? 'err' : 'ok')
    } catch (err) { toast(errMsg(err), 'err') }
  }

  const nom = (id: string) => { const a = adherents.get(id); return a ? nomComplet(a) : id }

  return (
    <Modal open={open} onClose={onClose} title="Relancer les impayés" wide>
      {resultat ? (
        <div className="space-y-3 text-sm">
          <p className="font-semibold">{bilan(resultat)}</p>
          {resultat.envoyes.length > 0 && <ul className="space-y-0.5 text-slate-300">{resultat.envoyes.map(e => <li key={e.adherent_id}>✓ {nom(e.adherent_id)} — {e.email} ({fmtEuro(e.montant)})</li>)}</ul>}
          {resultat.sans_email.length > 0 && <p className="text-slate-400">Sans e-mail : {resultat.sans_email.map(nom).join(', ')}</p>}
          {resultat.erreurs.length > 0 && <ul className="space-y-0.5 text-red-300">{resultat.erreurs.map(e => <li key={e.adherent_id}>✗ {nom(e.adherent_id)} : {e.message}</li>)}</ul>}
          <button className="btn-primary w-full" onClick={onClose}>Fermer</button>
        </div>
      ) : !lignes.length ? (
        <p className="text-sm text-slate-400">Aucun impayé à relancer.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Chaque adhérent coché reçoit un seul e-mail récapitulant tous ses achats et cordages restant à payer.</p>
          <div className="card divide-y divide-white/5">
            <label className="flex items-center gap-3 px-3 py-2 text-sm text-slate-400">
              <input type="checkbox" checked={tousCoches} onChange={() => setChoix(tousCoches ? new Set() : new Set(avecEmail.map(l => l.g.adherent_id)))} />
              Tout cocher
            </label>
            {lignes.map(({ g, a }) => {
              const ok = emailValide(a)
              return (
                <label key={g.adherent_id} className={`flex items-center gap-3 px-3 py-2 ${ok ? 'cursor-pointer' : 'opacity-50'}`}>
                  <input type="checkbox" disabled={!ok} checked={choix.has(g.adherent_id)} onChange={() => basculer(g.adherent_id)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a ? nomComplet(a) : '—'}</p>
                    <p className="truncate text-xs text-slate-500">
                      {ok ? a!.email : 'pas d\'e-mail'}
                      {g.derniereRelance && <span className={relanceRecente(g.derniereRelance) ? 'text-aasc-orange-soft' : ''}> · relancé le {fmtDate(g.derniereRelance, 'dd/MM')}</span>}
                    </p>
                  </div>
                  <span className="whitespace-nowrap font-semibold tabular-nums">{fmtEuro(g.montant)}</span>
                </label>
              )
            })}
          </div>
          <Field label="Message personnel (facultatif)" hint="Ajouté dans chaque e-mail, ex. permanence du bureau, RIB…">
            <textarea className="input min-h-[72px]" value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} />
          </Field>
          <button className="btn-primary w-full" disabled={!selection.length || relancer.isPending} onClick={envoyer}>
            <Send size={16} /> {relancer.isPending ? 'Envoi…' : `Envoyer ${selection.length} relance${selection.length > 1 ? 's' : ''} (${fmtEuro(total)})`}
          </button>
        </div>
      )}
    </Modal>
  )
}
