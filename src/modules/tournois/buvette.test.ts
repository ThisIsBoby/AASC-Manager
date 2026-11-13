import { describe, expect, it } from 'vitest'
import type { BuvetteLigne, Produit, RubriqueBuvette } from '@/core/types'
import { articlesStock, copierLignes, echelleCarte, fmtPrix, grouperBuvette, ordreSuivant, paginer, repartirColonnes, rubriqueSuggeree } from './buvette'

const l = (libelle: string, rubrique: RubriqueBuvette, ordre = 0, visible = true): BuvetteLigne =>
  ({ id: libelle, tournoi_id: 't', produit_id: null, libelle, rubrique, prix: 1, ordre, visible, created_at: '' })

const n = (k: number, r: RubriqueBuvette) => Array.from({ length: k }, (_, i) => l(`${r}${i}`, r, i))

describe('buvette', () => {
  it('regroupe par rubrique dans l\'ordre fixe et masque les lignes cachées', () => {
    const s = grouperBuvette([l('Chips', 'sale'), l('Eau', 'fraiche', 1), l('Soda', 'fraiche', 0), l('Gâteau', 'sucre', 0, false)], true)
    expect(s.map(x => x.rubrique.id)).toEqual(['fraiche', 'sale'])
    expect(s[0].lignes.map(x => x.libelle)).toEqual(['Soda', 'Eau'])
    expect(grouperBuvette([l('Gâteau', 'sucre', 0, false)]).length).toBe(1)
  })

  it('équilibre les deux colonnes sans changer l\'ordre', () => {
    // La maquette : 5 fraîches, 2 chaudes, 3 salés | 9 sucrés
    const s = grouperBuvette([...n(5, 'fraiche'), ...n(2, 'chaude'), ...n(3, 'sale'), ...n(9, 'sucre')])
    const [g, d] = repartirColonnes(s)
    expect(g.map(x => x.rubrique.id)).toEqual(['fraiche', 'chaude', 'sale'])
    expect(d.map(x => x.rubrique.id)).toEqual(['sucre'])
    expect(repartirColonnes(grouperBuvette(n(3, 'sale')))).toEqual([grouperBuvette(n(3, 'sale')), []])
  })

  it('passe sur une deuxième page quand la carte ne tient plus', () => {
    // La carte actuelle (19 produits) tient sur une page
    const une = grouperBuvette([...n(5, 'fraiche'), ...n(2, 'chaude'), ...n(3, 'sale'), ...n(9, 'sucre')])
    expect(paginer(une).length).toBe(1)
    // 34 produits : le sucré part sur la page 2
    const deux = grouperBuvette([...n(10, 'fraiche'), ...n(4, 'chaude'), ...n(6, 'sale'), ...n(14, 'sucre')])
    expect(paginer(deux).map(p => p.map(s => s.rubrique.id))).toEqual([['fraiche', 'chaude', 'sale'], ['sucre']])
    // Une rubrique énorme reste seule sur sa page
    expect(paginer(grouperBuvette([...n(2, 'fraiche'), ...n(40, 'sucre')])).length).toBe(2)
    expect(paginer([])).toEqual([[]])
  })

  it('adapte la taille du texte au nombre de produits', () => {
    expect(echelleCarte(15)).toBe(1)
    expect(echelleCarte(30)).toBe(0.55)
    expect(echelleCarte(20)).toBe(0.75)
    expect(echelleCarte(4)).toBe(1.25)
  })

  it('formate les prix', () => {
    expect(fmtPrix(1.5)).toBe('1,50')
    expect(fmtPrix(0.5)).toBe('0,50')
    expect(fmtPrix(10)).toBe('10,00')
  })

  it('propose une rubrique', () => {
    expect(rubriqueSuggeree('Café')).toBe('chaude')
    expect(rubriqueSuggeree('Thé')).toBe('chaude')
    expect(rubriqueSuggeree('Sandwich jambon')).toBe('sale')
    expect(rubriqueSuggeree('Chips')).toBe('sale')
    expect(rubriqueSuggeree('Ice Tea')).toBe('fraiche')
    expect(rubriqueSuggeree('Orangina', 'Boissons')).toBe('fraiche')
    expect(rubriqueSuggeree('Crêpe')).toBe('sucre')
    expect(rubriqueSuggeree('Théière', 'Matériel')).toBe('sucre')
  })

  it('liste les produits du stock, un seul par produit à variantes', () => {
    const p = (id: string, designation: string, modele = '', actif = true, prix_vente: number | null = 1): Produit =>
      ({ id, designation, categorie_id: null, unite: 'u', seuil_min: 0, actif, prix_vente, modele, taille: '', ordre: 0 })
    const a = articlesStock([p('1', 'Lion', 'Barres de céréales'), p('2', 'Snickers', 'Barres de céréales'), p('3', 'Eau'), p('4', 'Vieux', '', false)])
    expect(a.map(x => x.nom)).toEqual(['Barres de céréales', 'Eau'])
    expect(a[0].produitId).toBe('1')
  })

  it('copie une buvette et place les nouvelles lignes en fin de rubrique', () => {
    expect(copierLignes([l('Eau', 'fraiche', 3)], 'u')).toEqual([{ tournoi_id: 'u', produit_id: null, libelle: 'Eau', rubrique: 'fraiche', prix: 1, ordre: 3, visible: true }])
    expect(ordreSuivant([l('a', 'fraiche', 0), l('b', 'fraiche', 4), l('c', 'sale', 9)], 'fraiche')).toBe(5)
    expect(ordreSuivant([], 'sucre')).toBe(0)
  })
})
