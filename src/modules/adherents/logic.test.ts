import { describe, expect, it } from 'vitest'
import type { Adherent } from '@/core/types'
import {
  casserPrenom, correspondRecherche, detecterColonnes, detecterSeparateur, diffImport, lignesDepuisCsv,
  normaliserDate, normaliserSexe, parseCsv, saisonCourante,
} from './logic'

const adh = (p: Partial<Adherent>): Adherent => ({
  id: p.id ?? Math.random().toString(), licence: null, nom: 'X', prenom: '', sexe: '', date_naissance: null,
  email: '', telephone: '', categorie: '', saison: '', actif: true, created_at: '', updated_at: '', ...p,
})

describe('CSV', () => {
  it('détecte le séparateur', () => {
    expect(detecterSeparateur('Nom;Prénom;Licence\nA;B;1')).toBe(';')
    expect(detecterSeparateur('Nom,Prénom\n"A;B",C')).toBe(',')
  })

  it('parse guillemets, BOM, lignes vides et CRLF', () => {
    const t = '﻿Nom;Prénom;Note\r\n"DUPONT";"Jean";"dit ""JJ""; gaucher"\r\n\r\nMARTIN;Léa;"sur\ndeux lignes"\r\n'
    expect(parseCsv(t)).toEqual([
      ['Nom', 'Prénom', 'Note'],
      ['DUPONT', 'Jean', 'dit "JJ"; gaucher'],
      ['MARTIN', 'Léa', 'sur\ndeux lignes'],
    ])
  })

  it('devine les colonnes depuis les en-têtes', () => {
    const c = detecterColonnes(['N° Licence', 'Nom', 'Prénom', 'Sexe', 'Date de naissance', 'E-mail', 'Tél. portable', 'Catégorie'])
    expect(c).toEqual({ licence: 0, nom: 1, prenom: 2, sexe: 3, date_naissance: 4, email: 5, telephone: 6, categorie: 7 })
    const d = detecterColonnes(['Prénom', 'NOM', 'Mail'])
    expect(d.nom).toBe(1); expect(d.prenom).toBe(0); expect(d.email).toBe(2); expect(d.licence).toBe(-1)
  })
})

describe('normalisation', () => {
  it('normalise les dates', () => {
    expect(normaliserDate('05/03/2012')).toBe('2012-03-05')
    expect(normaliserDate('2012-03-05')).toBe('2012-03-05')
    expect(normaliserDate('5-3-1985')).toBe('1985-03-05')
    expect(normaliserDate('31/02/2012')).toBeNull()
    expect(normaliserDate('')).toBeNull()
    expect(normaliserDate('05/03/2012 00:00:00')).toBe('2012-03-05')
  })
  it('normalise sexe et prénom', () => {
    expect(normaliserSexe('Masculin')).toBe('H')
    expect(normaliserSexe('f')).toBe('F')
    expect(casserPrenom('JEAN-PIERRE')).toBe('Jean-Pierre')
    expect(casserPrenom('McKenzie')).toBe('McKenzie')
  })
  it('construit les lignes et ignore celles sans nom', () => {
    const c = detecterColonnes(['Licence', 'Nom', 'Prénom', 'Né le'])
    const r = lignesDepuisCsv([['06 123', 'dupont', 'JEAN', '01/02/2010'], ['', '', 'x', '']], c)
    expect(r.ignorees).toBe(1)
    expect(r.ok[0]).toMatchObject({ licence: '06123', nom: 'DUPONT', prenom: 'Jean', date_naissance: '2010-02-01' })
  })
})

describe('aperçu import', () => {
  it('classe nouveaux / mis à jour / absents', () => {
    const existants = [
      adh({ id: 'a', licence: '1', nom: 'DUPONT', prenom: 'Jean' }),
      adh({ id: 'b', nom: 'MARTIN', prenom: 'Léa', date_naissance: '2010-01-01' }),
      adh({ id: 'c', licence: '3', nom: 'DURAND' }),
      adh({ id: 'd', licence: '4', nom: 'ANCIEN', actif: false }),
    ]
    const l = (licence: string, nom: string, prenom = '', date_naissance: string | null = null) =>
      ({ licence, nom, prenom, date_naissance, sexe: '', email: '', telephone: '', categorie: '' })
    const d = diffImport(existants, [l('1', 'DUPONT', 'Jean'), l('', 'Martin', 'léa', '2010-01-01'), l('9', 'NOUVEAU')])
    expect(d.misAJour.map(x => x.nom)).toEqual(['DUPONT', 'Martin'])
    expect(d.nouveaux.map(x => x.nom)).toEqual(['NOUVEAU'])
    expect(d.absents.map(a => a.id)).toEqual(['c'])
  })

  it('calcule la saison', () => {
    expect(saisonCourante(new Date(2026, 10, 11))).toBe('2026-2027')
    expect(saisonCourante(new Date(2027, 5, 1))).toBe('2026-2027')
  })

  it('recherche sans accents', () => {
    const a = { nom: 'LÉGER', prenom: 'Élodie', licence: '0612' }
    expect(correspondRecherche(a, 'elodie leg')).toBe(true)
    expect(correspondRecherche(a, '0612')).toBe(true)
    expect(correspondRecherche(a, 'martin')).toBe(false)
  })
})
