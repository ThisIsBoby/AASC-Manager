import { describe, expect, it } from 'vitest'
import { besoinLigne, calculAchats, calculPreparation, etatPeremption, parseScan } from './logic'
import type { ModeleLigne, StockProduit, Tournoi } from '@/core/types'

const ligne = (produit_id: string, qte_par_joueur: number, qte_fixe: number, modele_id = 'm1'): ModeleLigne =>
  ({ id: produit_id + modele_id, modele_id, produit_id, qte_par_joueur, qte_fixe })

const sp = (id: string, stock: number, seuil: number, actif = true): StockProduit => ({
  id, designation: id, categorie_id: null, unite: 'u', seuil_min: seuil, actif,
  stock_valide: stock, stock_perime: 0, prochaine_peremption: null, nb_lots: 1,
})

const tournoi = (id: string, nb: number, statut: 'prepa' | 'termine' = 'prepa', modele_id = 'm1'): Tournoi =>
  ({ id, nom: id, date: null, nb_joueurs: nb, modele_id, statut, created_at: '' })

describe('besoinLigne', () => {
  it('fixe + par joueur arrondi au supérieur', () => {
    expect(besoinLigne(0.25, 4, 30)).toBe(12) // 4 + ceil(7.5)
    expect(besoinLigne(2, 10, 30)).toBe(70)
    expect(besoinLigne(0, 5, 100)).toBe(5)
  })
  it("pas d'erreur d'arrondi flottant", () => {
    expect(besoinLigne(0.1, 0, 30)).toBe(3)
  })
})

describe('calculPreparation', () => {
  it('calcule le manque par produit', () => {
    const r = calculPreparation([ligne('eau', 2, 10), ligne('vol', 0.25, 4)], 40, new Map([['eau', 100], ['vol', 5]]))
    expect(r).toEqual([
      { produitId: 'eau', besoin: 90, enStock: 100, aAcheter: 0 },
      { produitId: 'vol', besoin: 14, enStock: 5, aAcheter: 9 },
    ])
  })
})

describe('calculAchats', () => {
  const lignes = [ligne('eau', 2, 10), ligne('vol', 0.25, 4)]
  it('seuil seul', () => {
    const r = calculAchats([sp('eau', 10, 24), sp('vol', 20, 10)], [], lignes)
    expect(r).toEqual([{ produitId: 'eau', stock: 10, seuil: 24, besoinTournois: 0, cible: 24, aAcheter: 14 }])
  })
  it('ajoute les tournois en préparation uniquement', () => {
    const r = calculAchats([sp('eau', 50, 24), sp('vol', 20, 10)], [tournoi('t1', 20), tournoi('t2', 100, 'termine')], lignes)
    // eau : 24 + (10 + 40) = 74 - 50 = 24 ; vol : 10 + (4 + 5) = 19 - 20 -> 0
    expect(r).toEqual([{ produitId: 'eau', stock: 50, seuil: 24, besoinTournois: 50, cible: 74, aAcheter: 24 }])
  })
  it('peut ignorer les tournois', () => {
    expect(calculAchats([sp('eau', 50, 24)], [tournoi('t1', 20)], lignes, false)).toEqual([])
  })
  it('ignore les produits inactifs', () => {
    expect(calculAchats([sp('eau', 0, 24, false)], [], lignes)).toEqual([])
  })
})

describe('etatPeremption', () => {
  const today = new Date(2026, 10, 10)
  it('classe les dates', () => {
    expect(etatPeremption(null, today)).toBe('aucune')
    expect(etatPeremption('2026-11-09', today)).toBe('perime')
    expect(etatPeremption('2026-11-10', today)).toBe('bientot')
    expect(etatPeremption('2026-12-10', today)).toBe('bientot')
    expect(etatPeremption('2026-12-11', today)).toBe('ok')
  })
})

describe('parseScan', () => {
  const id = '3f2b1c4d-1111-4222-8333-944455556666'
  it("lit l'URL d'un QR", () => {
    expect(parseScan(`https://club.github.io/AASC-Manager/#/stock/caisse/${id}`)).toEqual({ id })
  })
  it('lit un uuid brut ou un code court', () => {
    expect(parseScan(id.toUpperCase())).toEqual({ id })
    expect(parseScan('c-7')).toEqual({ code: 'C-007' })
    expect(parseScan('C-012')).toEqual({ code: 'C-012' })
    expect(parseScan('bonjour')).toEqual({})
  })
})
