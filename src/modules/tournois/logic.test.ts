import { describe, expect, it } from 'vitest'
import { avecArticle, compteARebours, libelleParticipants, libelleType, echeanceDepuisJ, ecartJours, etatTache, grouperParCategorie, progression } from './logic'

const T = '2026-11-10'
const tache = (fait: boolean, echeance: string | null, categorie = '', ordre = 0) => ({ fait, echeance, categorie, ordre })

describe('checklist tournoi', () => {
  it('calcule les écarts et échéances J-x', () => {
    expect(ecartJours('2026-11-10', '2026-12-01')).toBe(21)
    expect(echeanceDepuisJ('2026-12-06', 14)).toBe('2026-11-22')
    expect(echeanceDepuisJ('2026-03-01', 1)).toBe('2026-02-28')
    expect(echeanceDepuisJ(null, 3)).toBeNull()
    expect(echeanceDepuisJ('2026-12-06', null)).toBeNull()
  })

  it('affiche le compte à rebours', () => {
    expect(compteARebours('2026-11-22', T)).toBe('J-12')
    expect(compteARebours(T, T)).toBe('Jour J')
    expect(compteARebours('2026-11-01', T)).toBe('Passé')
    expect(compteARebours(null, T)).toBeNull()
  })

  it("détermine l'état des tâches", () => {
    expect(etatTache(tache(true, '2026-01-01'), T)).toBe('fait')
    expect(etatTache(tache(false, '2026-11-09'), T)).toBe('retard')
    expect(etatTache(tache(false, '2026-11-17'), T)).toBe('semaine')
    expect(etatTache(tache(false, '2026-11-18'), T)).toBe('a_faire')
    expect(etatTache(tache(false, null), T)).toBe('a_faire')
  })

  it('calcule la progression', () => {
    expect(progression([], T)).toEqual({ total: 0, faites: 0, pct: 0, retard: 0, semaine: 0 })
    const p = progression([tache(true, null), tache(false, '2026-11-01'), tache(false, '2026-11-12')], T)
    expect(p).toEqual({ total: 3, faites: 1, pct: 33, retard: 1, semaine: 1 })
  })

  it('regroupe par catégorie, sans catégorie en dernier, tri par échéance', () => {
    const g = grouperParCategorie([
      tache(false, null, '', 1), tache(false, '2026-12-01', 'Buvette', 2),
      tache(false, '2026-11-20', 'Logistique', 3), tache(false, '2026-11-15', 'Buvette', 4),
    ])
    expect(g.map(([k]) => k)).toEqual(['Buvette', 'Logistique', ''])
    expect(g[0][1].map(t => t.ordre)).toEqual([4, 2])
  })
})

describe('type de tournoi', () => {
  it('libelle le type et les participants', () => {
    expect(libelleType('interclub')).toBe('Interclub')
    expect(libelleType(undefined)).toBe('Tournoi')
    expect(libelleParticipants('interclub', 30)).toBe('30 personnes')
    expect(libelleParticipants('tournoi', 1)).toBe('1 joueur')
    expect(libelleParticipants('tournoi')).toBe('joueur')
    expect(libelleType('evenement')).toBe('Événement')
    expect(libelleParticipants('evenement', 50)).toBe('50 personnes')
    expect(avecArticle('evenement')).toBe("l'événement")
  })
})
