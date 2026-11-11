import { Link } from 'react-router-dom'
import { ChevronRight, Undo2 } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthProvider'
import { errMsg } from '@/core/supabase'
import type { Cordage, Vente } from '@/core/types'
import { useToast } from '@/core/ui'
import { fmtDate } from '@/modules/stock/components/shared'
import { useAdherentsMap } from '@/modules/adherents/api'
import { nomComplet } from '@/modules/adherents/logic'
import { useAnnulerVente, useAvancerCordage } from '../api'
import { STATUTS, etapeSuivante, fmtEuro } from '../logic'
import { PaiementCell, StatutBadge } from './shared'

function NomAdherent({ id }: { id: string | null }) {
  const a = useAdherentsMap().get(id ?? '')
  if (!a) return <span className="text-slate-500">—</span>
  return <Link to={`/adherents/${a.id}`} onClick={e => e.stopPropagation()} className="font-semibold hover:text-aasc-orange-soft hover:underline">{nomComplet(a)}</Link>
}

export function VentesTable({ ventes, avecAdherent = true }: { ventes: Vente[]; avecAdherent?: boolean }) {
  const { isAdmin } = useAuth()
  const annuler = useAnnulerVente()
  const toast = useToast()

  async function doAnnuler(v: Vente) {
    if (!confirm(`Annuler la vente « ${v.libelle} » ? Les quantités seront remises en stock.`)) return
    try { await annuler.mutateAsync(v.id); toast('Vente annulée, stock remis à jour') }
    catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <div className="card overflow-x-auto">
      <table className="table-sport">
        <thead><tr>
          <th>Date</th>{avecAdherent && <th>Adhérent</th>}<th>Article</th><th className="text-right">Total</th><th>Paiement</th>{isAdmin && <th />}
        </tr></thead>
        <tbody>
          {ventes.map(v => (
            <tr key={v.id} className={v.annulee ? 'opacity-50' : ''}>
              <td className="whitespace-nowrap text-slate-400">{fmtDate(v.created_at, 'dd/MM/yy')}</td>
              {avecAdherent && <td><NomAdherent id={v.adherent_id} /></td>}
              <td>
                <p className={v.annulee ? 'line-through' : ''}>{v.quantite > 1 && <span className="font-semibold">{v.quantite} × </span>}{v.libelle}</p>
                {v.note && <p className="text-xs text-slate-500">{v.note}</p>}
              </td>
              <td className="whitespace-nowrap text-right font-semibold tabular-nums">{fmtEuro(v.total)}</td>
              <td>{v.annulee ? <span className="text-xs text-slate-500">Annulée</span> : <PaiementCell table="ventes" id={v.id} paye={v.paye} moyen={v.moyen_paiement} montant={v.total} />}</td>
              {isAdmin && <td className="text-right">{!v.annulee && (
                <button className="btn-icon btn-ghost" title="Annuler la vente" disabled={annuler.isPending} onClick={() => doAnnuler(v)}><Undo2 size={14} /></button>
              )}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CordagesTable({ cordages, avecAdherent = true }: { cordages: Cordage[]; avecAdherent?: boolean }) {
  const avancer = useAvancerCordage()
  const toast = useToast()

  async function suivant(c: Cordage) {
    const next = etapeSuivante(c.statut)
    if (!next) return
    try {
      const warn = await avancer.mutateAsync({ id: c.id, statut: next })
      if (warn) toast(warn, 'err')
      else toast(next === 'cordee' ? 'Raquette cordée' : 'Raquette rendue')
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <div className="card overflow-x-auto">
      <table className="table-sport">
        <thead><tr>
          <th>Déposée</th>{avecAdherent && <th>Adhérent</th>}<th>Offre</th><th className="hidden md:table-cell">Raquette / cordage</th><th>Étape</th><th>Paiement</th>
        </tr></thead>
        <tbody>
          {cordages.map(c => {
            const next = etapeSuivante(c.statut)
            return (
              <tr key={c.id}>
                <td className="whitespace-nowrap text-slate-400">{fmtDate(c.depose_le, 'dd/MM/yy')}</td>
                {avecAdherent && <td><NomAdherent id={c.adherent_id} /></td>}
                <td><p>{c.offre_nom}</p><p className="text-xs text-slate-500">{fmtEuro(c.prix)}</p></td>
                <td className="hidden text-sm text-slate-400 md:table-cell">
                  {[c.raquette, c.cordage_ref, c.tension].filter(Boolean).join(' · ') || '—'}
                  {c.note && <p className="text-xs text-slate-500">{c.note}</p>}
                </td>
                <td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatutBadge statut={c.statut} />
                    {next && (
                      <button className="chip border border-white/10 text-slate-300 hover:bg-white/5" disabled={avancer.isPending} onClick={() => suivant(c)}
                        title={STATUTS.find(s => s.v === next)?.action}>
                        {STATUTS.find(s => s.v === next)?.label} <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                  {c.rendu_le ? <p className="mt-0.5 text-[11px] text-slate-500">rendue le {fmtDate(c.rendu_le, 'dd/MM')}</p>
                    : c.corde_le ? <p className="mt-0.5 text-[11px] text-slate-500">cordée le {fmtDate(c.corde_le, 'dd/MM')}</p> : null}
                </td>
                <td><PaiementCell table="cordages" id={c.id} paye={c.paye} moyen={c.moyen_paiement} montant={c.prix} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
