import { describe, expect, it } from 'vitest'
import { etapeSuivante, fmtEuro, resteAPayer } from './logic'

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
})
