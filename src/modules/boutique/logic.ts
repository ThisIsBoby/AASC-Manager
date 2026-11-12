import type { Cordage, MoyenPaiement, StatutCordage, Vente } from '@/core/types'

export const MOYENS: { v: Exclude<MoyenPaiement, ''>; label: string }[] = [
  { v: 'especes', label: 'Espèces' },
  { v: 'cheque', label: 'Chèque' },
  { v: 'virement', label: 'Virement' },
]
export const libelleMoyen = (m: MoyenPaiement | string) => MOYENS.find(x => x.v === m)?.label ?? ''

export const STATUTS: { v: StatutCordage; label: string; action: string }[] = [
  { v: 'deposee', label: 'Déposée', action: 'Déposer' },
  { v: 'cordee', label: 'Cordée', action: 'Marquer cordée' },
  { v: 'rendue', label: 'Rendue', action: 'Marquer rendue' },
]
export const libelleStatut = (s: StatutCordage) => STATUTS.find(x => x.v === s)?.label ?? s

export function etapeSuivante(s: StatutCordage): StatutCordage | null {
  const i = STATUTS.findIndex(x => x.v === s)
  return STATUTS[i + 1]?.v ?? null
}

export const venteDue = (v: Pick<Vente, 'paye' | 'annulee' | 'total'>) => (!v.paye && !v.annulee ? Number(v.total) : 0)
export const cordageDu = (c: Pick<Cordage, 'paye' | 'prix'>) => (!c.paye ? Number(c.prix) : 0)

/** Reste à payer global et par adhérent */
export function resteAPayer(ventes: Pick<Vente, 'adherent_id' | 'paye' | 'annulee' | 'total'>[], cordages: Pick<Cordage, 'adherent_id' | 'paye' | 'prix'>[]) {
  const parAdherent = new Map<string, number>()
  let total = 0
  const add = (id: string | null, m: number) => {
    if (m <= 0) return
    total += m
    const k = id ?? ''
    parAdherent.set(k, (parAdherent.get(k) ?? 0) + m)
  }
  ventes.forEach(v => add(v.adherent_id, venteDue(v)))
  cordages.forEach(c => add(c.adherent_id, cordageDu(c)))
  return { total: Math.round(total * 100) / 100, parAdherent }
}

export const fmtEuro = (n: number | null | undefined) =>
  n == null ? '–' : Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number(n) % 1 ? 2 : 0 })
