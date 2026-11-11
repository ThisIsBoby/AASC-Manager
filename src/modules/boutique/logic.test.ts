import { describe, expect, it } from 'vitest'
import { estStockBas, etapeSuivante, fmtEuro, libelleVente, prixVariante, resteAPayer, stockVariante } from './logic'

describe('boutique', () => {
  it('calcule le prix effectif et le libellé', () => {
    expect(prixVariante({ prix: 25 }, { prix: null })).toBe(25)
    expect(prixVariante({ prix: 25 }, { prix: 28 })).toBe(28)
    expect(prixVariante({ prix: 25 }, { prix: 0 })).toBe(0)
    expect(libelleVente({ nom: 'Maillot club' }, { libelle: 'M' })).toBe('Maillot club – M')
    expect(libelleVente({ nom: 'Tube RSL' }, { libelle: '' })).toBe('Tube RSL')
  })

  it('lit le stock et détecte le stock bas', () => {
    const stock = new Map([['p1', { stock_valide: 2, seuil_min: 5 }], ['p2', { stock_valide: 9, seuil_min: 5 }], ['p3', { stock_valide: 0, seuil_min: 0 }]])
    expect(stockVariante({ produit_id: null }, stock)).toBeNull()
    expect(stockVariante({ produit_id: 'p1' }, stock)).toBe(2)
    expect(stockVariante({ produit_id: 'inconnu' }, stock)).toBe(0)
    expect(estStockBas({ produit_id: 'p1' }, stock)).toBe(true)
    expect(estStockBas({ produit_id: 'p2' }, stock)).toBe(false)
    expect(estStockBas({ produit_id: 'p3' }, stock)).toBe(false)
  })

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
