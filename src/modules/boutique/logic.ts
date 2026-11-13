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

/** Impayés (ventes + cordages) d'un adhérent : une relance = un seul e-mail */
export interface ImpayesAdherent {
  adherent_id: string
  ventes: Vente[]
  cordages: Cordage[]
  montant: number
  /** Date de la relance la plus récente parmi ses lignes impayées */
  derniereRelance: string | null
}

/** Regroupe les lignes restant à payer par adhérent, du plus gros montant au plus petit */
export function impayesParAdherent(ventes: Vente[], cordages: Cordage[]): ImpayesAdherent[] {
  const m = new Map<string, ImpayesAdherent>()
  const get = (id: string | null) => {
    const k = id ?? ''
    let g = m.get(k)
    if (!g) m.set(k, g = { adherent_id: k, ventes: [], cordages: [], montant: 0, derniereRelance: null })
    return g
  }
  const relance = (g: ImpayesAdherent, d: string | null) => { if (d && (!g.derniereRelance || d > g.derniereRelance)) g.derniereRelance = d }
  ventes.forEach(v => { const du = venteDue(v); if (du > 0) { const g = get(v.adherent_id); g.ventes.push(v); g.montant += du; relance(g, v.relance_le) } })
  cordages.forEach(c => { const du = cordageDu(c); if (du > 0) { const g = get(c.adherent_id); g.cordages.push(c); g.montant += du; relance(g, c.relance_le) } })
  return [...m.values()]
    .map(g => ({ ...g, montant: Math.round(g.montant * 100) / 100 }))
    .sort((a, b) => b.montant - a.montant)
}

/** Relancé il y a moins de 24 h ? (évite les doublons) */
export const relanceRecente = (d: string | null, now = Date.now()) => d != null && now - new Date(d).getTime() < 24 * 3600 * 1000
