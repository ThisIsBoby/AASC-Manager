import { describe, expect, it } from 'vitest'
import type { Cordage, Vente } from '@/core/types'
import { etapeSuivante, fmtEuro, impayesParAdherent, relanceRecente, resteAPayer } from './logic'

describe('boutique', () => {
  it('enchaîne les étapes de cordage', () => {
    expect(etapeSuivante('deposee')).toBe('cordee')
    expect(etapeSuivante('cordee')).toBe('rendue')
    expect(etapeSuivante('rendue')).toBeNull()
  })

  it('calcule le reste à payer', () => {
    const r = resteAPayer(
      [
        { adherent_id: 'a', paye: false, annulee: false, total: 18.5 },
        { adherent_id: 'a', paye: true, annulee: false, total: 30 },
        { adherent_id: 'b', paye: false, annulee: true, total: 12 },
      ],
      [
        { adherent_id: 'a', paye: false, prix: 15 },
        { adherent_id: 'b', paye: false, prix: 0 },
        { adherent_id: 'b', paye: false, prix: 5 },
      ],
    )
    expect(r.total).toBe(38.5)
    expect(r.parAdherent.get('a')).toBe(33.5)
    expect(r.parAdherent.get('b')).toBe(5)
  })

  it('formate les euros', () => {
    expect(fmtEuro(15).replace(/\s/g, ' ')).toBe('15 €')
    expect(fmtEuro(18.5).replace(/\s/g, ' ')).toBe('18,50 €')
  })

  it('regroupe les impayés par adhérent', () => {
    const v = (id: string, adherent: string, total: number, o: Partial<Vente> = {}) =>
      ({ id, adherent_id: adherent, total, paye: false, annulee: false, relance_le: null, ...o }) as Vente
    const c = (id: string, adherent: string, prix: number, o: Partial<Cordage> = {}) =>
      ({ id, adherent_id: adherent, prix, paye: false, relance_le: null, ...o }) as Cordage
    const g = impayesParAdherent(
      [v('v1', 'a', 10), v('v2', 'a', 8.5, { relance_le: '2026-11-01T10:00:00Z' }), v('v3', 'b', 30, { paye: true }), v('v4', 'b', 5, { annulee: true })],
      [c('c1', 'b', 15), c('c2', 'a', 0), c('c3', 'a', 12, { relance_le: '2026-11-05T10:00:00Z' })],
    )
    expect(g.map(x => [x.adherent_id, x.montant])).toEqual([['a', 30.5], ['b', 15]])
    expect(g[0].ventes.map(x => x.id)).toEqual(['v1', 'v2'])
    expect(g[0].cordages.map(x => x.id)).toEqual(['c3'])
    expect(g[0].derniereRelance).toBe('2026-11-05T10:00:00Z')
    expect(g[1].derniereRelance).toBeNull()
  })

  it('détecte une relance récente', () => {
    const now = new Date('2026-11-13T12:00:00Z').getTime()
    expect(relanceRecente('2026-11-13T01:00:00Z', now)).toBe(true)
    expect(relanceRecente('2026-11-11T12:00:00Z', now)).toBe(false)
    expect(relanceRecente(null, now)).toBe(false)
  })
})
