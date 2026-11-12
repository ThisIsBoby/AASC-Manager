import { describe, expect, it } from 'vitest'
import { besoinLigne, calculAchats, calculPreparation, designationTaille, ecartLigne, estStockBas, estVendu, etatPeremption, grouperProduits, parseScan, parseTailles, prixGroupe, resumeInventaire } from './logic'
import type { ModeleLigne, StockProduit, Tournoi } from '@/core/types'

const ligne = (produit_id: string, qte_par_joueur: number, qte_fixe: number, modele_id = 'm1'): ModeleLigne =>
  ({ id: produit_id + modele_id, modele_id, produit_id, qte_par_joueur, qte_fixe })

const sp = (id: string, stock: number, seuil: number, actif = true): StockProduit => ({
  id, designation: id, categorie_id: null, unite: 'u', seuil_min: seuil, actif,
  stock_valide: stock, stock_perime: 0, prochaine_peremption: null, nb_lots: 1,
  prix_vente: null, modele: '', taille: '', ordre: 0,
})

const tournoi = (id: string, nb: number, statut: 'prepa' | 'termine' = 'prepa', modele_id = 'm1'): Tournoi =>
  ({ id, nom: id, date: null, nb_joueurs: nb, type: 'tournoi', modele_id, statut, created_at: '' })

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

describe('catalogue', () => {
  const p = (id: string, modele = '', taille = '', ordre = 0) => ({ id, designation: designationTaille(modele || id, taille), modele, taille, ordre })

  it('regroupe les tailles d\'un même modèle, dans l\'ordre', () => {
    const g = grouperProduits([p('volants'), p('m3', 'Maillot club', 'L', 3), p('m1', 'Maillot club', 'S', 1), p('m2', 'Maillot club', 'M', 2), p('eau')])
    expect(g.map(x => x.nom)).toEqual(['eau', 'Maillot club', 'volants'])
    expect(g[1].modele).toBe('Maillot club')
    expect(g[1].produits.map(x => x.taille)).toEqual(['S', 'M', 'L'])
    expect(g[0].modele).toBeNull()
    expect(g[0].cle).toBe('p:eau')
  })

  it('nomme les tailles et lit la saisie', () => {
    expect(designationTaille('Maillot club', 'M')).toBe('Maillot club – M')
    expect(designationTaille('Tube RSL', '')).toBe('Tube RSL')
    expect(parseTailles('XS, S;M\n M , ')).toEqual(['XS', 'S', 'M'])
  })

  it('prix de vente et stock bas', () => {
    expect(estVendu({ prix_vente: 0, actif: true })).toBe(true)
    expect(estVendu({ prix_vente: null, actif: true })).toBe(false)
    expect(estVendu({ prix_vente: 25, actif: false })).toBe(false)
    expect(prixGroupe([{ prix_vente: null, actif: true }, { prix_vente: 25, actif: true }])).toBe(25)
    expect(prixGroupe([{ prix_vente: null, actif: true }])).toBeNull()
    expect(estStockBas({ seuil_min: 5, stock_valide: 2 })).toBe(true)
    expect(estStockBas({ seuil_min: 0, stock_valide: 0 })).toBe(false)
  })
})

const li = (o: Partial<{ nouveau: boolean; qte_theorique: number; qte_comptee: number | null; qte_avant: number | null; produit_id: string; inventaire_caisse_id: string }>) =>
  ({ nouveau: false, qte_theorique: 0, qte_comptee: null, qte_avant: null, produit_id: 'p', inventaire_caisse_id: 'ic1', ...o })

describe('ecartLigne', () => {
  it('classe les lignes', () => {
    expect(ecartLigne(li({ qte_theorique: 5, qte_comptee: 5 })).etat).toBe('conforme')
    expect(ecartLigne(li({ qte_theorique: 5, qte_comptee: 3 }))).toEqual({ reference: 5, ecart: -2, etat: 'manquant' })
    expect(ecartLigne(li({ qte_theorique: 5, qte_comptee: 7 })).etat).toBe('surplus')
    expect(ecartLigne(li({ qte_theorique: 5, qte_comptee: 0 })).etat).toBe('absent')
    expect(ecartLigne(li({ nouveau: true, qte_comptee: 2 }))).toEqual({ reference: 0, ecart: 2, etat: 'nouveau' })
    expect(ecartLigne(li({ qte_theorique: 5 })).etat).toBe('non_compte')
  })
  it('compare à la quantité réelle à la validation si elle est connue', () => {
    expect(ecartLigne(li({ qte_theorique: 10, qte_avant: 9, qte_comptee: 8 })).ecart).toBe(-1)
    expect(ecartLigne(li({ qte_theorique: 10, qte_avant: 8, qte_comptee: 8 })).etat).toBe('conforme')
  })
  it('évite les erreurs d’arrondi', () => {
    expect(ecartLigne(li({ qte_theorique: 0.3, qte_comptee: 0.1 })).ecart).toBe(-0.2)
  })
})

describe('resumeInventaire', () => {
  const caisses = [
    { id: 'ic1', statut: 'valide' as const }, { id: 'ic2', statut: 'compte' as const },
    { id: 'ic3', statut: 'en_cours' as const }, { id: 'ic4', statut: 'a_faire' as const },
  ]
  it('compte l’avancement et consolide les écarts par produit', () => {
    const r = resumeInventaire(caisses, [
      li({ inventaire_caisse_id: 'ic1', produit_id: 'a', qte_theorique: 10, qte_comptee: 8 }),
      li({ inventaire_caisse_id: 'ic2', produit_id: 'a', qte_theorique: 4, qte_comptee: 5 }),
      li({ inventaire_caisse_id: 'ic2', produit_id: 'b', qte_theorique: 3, qte_comptee: 3 }),
      li({ inventaire_caisse_id: 'ic3', produit_id: 'b', qte_theorique: 3, qte_comptee: null }),
      li({ inventaire_caisse_id: 'autre', produit_id: 'c', qte_theorique: 1, qte_comptee: 0 }),
    ])
    expect(r).toMatchObject({ total: 4, aFaire: 1, enCours: 1, aValider: 1, valides: 1, faites: 2, lignesEnEcart: 2 })
    expect(r.parProduit).toEqual([
      { produitId: 'a', reference: 14, compte: 13, ecart: -1 },
      { produitId: 'b', reference: 3, compte: 3, ecart: 0 },
    ])
  })
})
