import type { Adherent } from '@/core/types'

// ---------------------------------------------------------------------
// Lecture d'un fichier CSV (export fédéral, Excel « CSV ; », etc.)
// ---------------------------------------------------------------------

/** Décode le fichier : UTF-8 si valide, sinon Windows-1252 (Excel français). */
export function decoderFichier(buf: ArrayBuffer): string {
  let txt: string
  try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf) }
  catch { txt = new TextDecoder('windows-1252').decode(buf) }
  return txt.replace(/^﻿/, '')
}

/** Séparateur le plus fréquent sur la première ligne (hors guillemets) */
export function detecterSeparateur(texte: string): string {
  const ligne = texte.split(/\r?\n/)[0] ?? ''
  let best = ';', max = -1
  for (const s of [';', ',', '\t', '|']) {
    let n = 0, inQ = false
    for (const c of ligne) { if (c === '"') inQ = !inQ; else if (c === s && !inQ) n++ }
    if (n > max) { max = n; best = s }
  }
  return best
}

/** Parse un CSV (guillemets, "" échappés, retours à la ligne dans un champ). Lignes vides ignorées. */
export function parseCsv(texte: string, sep = detecterSeparateur(texte)): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', inQ = false
  const t = texte.replace(/^﻿/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inQ) {
      if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++ } else inQ = false }
      else cell += c
    } else if (c === '"') inQ = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(x => x.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some(x => x.trim() !== '')) rows.push(row)
  return rows.map(r => r.map(x => x.trim()))
}

// ---------------------------------------------------------------------
// Correspondance des colonnes
// ---------------------------------------------------------------------
export const CHAMPS = ['licence', 'nom', 'prenom', 'sexe', 'date_naissance', 'email', 'telephone', 'categorie'] as const
export type Champ = typeof CHAMPS[number]
export type Correspondance = Record<Champ, number>   // -1 = colonne absente

export const LIBELLES_CHAMPS: Record<Champ, string> = {
  licence: 'N° de licence', nom: 'Nom', prenom: 'Prénom', sexe: 'Sexe', date_naissance: 'Date de naissance',
  email: 'E-mail', telephone: 'Téléphone', categorie: 'Catégorie',
}

export const normEntete = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

const ALIAS: Record<Champ, { exact: string[]; contient: string[] }> = {
  licence: { exact: ['licence', 'license', 'numlicence', 'nlicence', 'nolicence', 'numerolicence', 'numerodelicence', 'licencie'], contient: ['licence', 'license'] },
  nom: { exact: ['nom', 'nomdefamille', 'nomdusage', 'lastname', 'nomjoueur', 'nomadherent'], contient: [] },
  prenom: { exact: ['prenom', 'firstname', 'prenomjoueur', 'prenomadherent'], contient: ['prenom'] },
  sexe: { exact: ['sexe', 'genre', 'civilite', 'sex', 'gender', 'hf', 'mf'], contient: ['sexe'] },
  date_naissance: { exact: ['datedenaissance', 'datenaissance', 'naissance', 'nele', 'nee', 'dob', 'birthdate', 'datenais'], contient: ['naissance'] },
  email: { exact: ['email', 'mail', 'courriel', 'adressemail', 'adresseemail'], contient: ['mail', 'courriel'] },
  telephone: { exact: ['telephone', 'tel', 'portable', 'mobile', 'telportable', 'telephoneportable'], contient: ['tel', 'portable', 'mobile'] },
  categorie: { exact: ['categorie', 'cat', 'categ', 'categorieage', 'categoriedage'], contient: ['categ'] },
}

/** Devine la colonne de chaque champ à partir des en-têtes */
export function detecterColonnes(entetes: string[]): Correspondance {
  const n = entetes.map(normEntete)
  const pris = new Set<number>()
  const res = Object.fromEntries(CHAMPS.map(c => [c, -1])) as Correspondance
  // 1er passage : correspondances exactes ; 2e : « contient »
  for (const passe of ['exact', 'contient'] as const) {
    for (const champ of CHAMPS) {
      if (res[champ] >= 0) continue
      const idx = n.findIndex((h, i) => !pris.has(i) && h !== '' &&
        (passe === 'exact' ? ALIAS[champ].exact.includes(h) : ALIAS[champ].contient.some(a => h.includes(a))))
      if (idx >= 0) { res[champ] = idx; pris.add(idx) }
    }
  }
  return res
}

// ---------------------------------------------------------------------
// Normalisation des valeurs
// ---------------------------------------------------------------------
/** jj/mm/aaaa, jj-mm-aa, aaaa-mm-jj… → AAAA-MM-JJ (null si invalide/vide) */
export function normaliserDate(v: string): string | null {
  const s = v.trim().split(/[ T]/)[0]
  if (!s) return null
  let y: number, m: number, d: number
  let r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (r) { y = +r[1]; m = +r[2]; d = +r[3] }
  else if ((r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) {
    d = +r[1]; m = +r[2]; y = +r[3]
    if (r[3].length === 2) y += y > (new Date().getFullYear() % 100) ? 1900 : 2000
  } else return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function normaliserSexe(v: string): string {
  const s = normEntete(v)
  if (!s) return ''
  if (['h', 'm', 'homme', 'masculin', 'male', 'garcon', 'mr', 'monsieur'].includes(s)) return 'H'
  if (['f', 'femme', 'feminin', 'female', 'fille', 'mme', 'madame', 'mlle'].includes(s)) return 'F'
  return v.trim()
}

/** Majuscule initiale sur chaque partie (« jean-pierre » → « Jean-Pierre ») si tout est en minuscules/majuscules */
export function casserPrenom(v: string): string {
  const s = v.trim()
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) return s
  return s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
}

export interface LigneImport {
  licence: string; nom: string; prenom: string; sexe: string; date_naissance: string | null
  email: string; telephone: string; categorie: string
}

/** Transforme les lignes du CSV (sans l'en-tête) en adhérents ; ignore les lignes sans nom. */
export function lignesDepuisCsv(lignes: string[][], c: Correspondance): { ok: LigneImport[]; ignorees: number } {
  const get = (r: string[], ch: Champ) => (c[ch] >= 0 ? (r[c[ch]] ?? '') : '').trim()
  const ok: LigneImport[] = []
  let ignorees = 0
  for (const r of lignes) {
    const nom = get(r, 'nom')
    if (!nom) { ignorees++; continue }
    ok.push({
      licence: get(r, 'licence').replace(/\s/g, ''),
      nom: nom.toUpperCase(),
      prenom: casserPrenom(get(r, 'prenom')),
      sexe: normaliserSexe(get(r, 'sexe')),
      date_naissance: normaliserDate(get(r, 'date_naissance')),
      email: get(r, 'email').toLowerCase(),
      telephone: get(r, 'telephone'),
      categorie: get(r, 'categorie'),
    })
  }
  return { ok, ignorees }
}

// ---------------------------------------------------------------------
// Aperçu de l'import (même règle de correspondance que importer_adherents en base)
// ---------------------------------------------------------------------
const cleNom = (a: { nom: string; prenom: string; date_naissance: string | null }) =>
  `${a.nom.trim().toLowerCase()}|${a.prenom.trim().toLowerCase()}|${a.date_naissance ?? ''}`

export interface DiffImport { nouveaux: LigneImport[]; misAJour: LigneImport[]; absents: Adherent[] }

export function diffImport(existants: Adherent[], lignes: LigneImport[]): DiffImport {
  const parLicence = new Map(existants.filter(a => a.licence).map(a => [a.licence!, a]))
  const parNom = new Map(existants.map(a => [cleNom(a), a]))
  const vus = new Set<string>()
  const nouveaux: LigneImport[] = [], misAJour: LigneImport[] = []
  for (const l of lignes) {
    let a = l.licence ? parLicence.get(l.licence) : undefined
    if (!a) {
      const b = parNom.get(cleNom(l))
      if (b && (!b.licence || !l.licence)) a = b
    }
    if (a && !vus.has(a.id)) { vus.add(a.id); misAJour.push(l) }
    else nouveaux.push(l)
  }
  const absents = existants.filter(a => a.actif && !vus.has(a.id))
  return { nouveaux, misAJour, absents }
}

/** Saison sportive : de septembre à août → « 2026-2027 » */
export function saisonCourante(d = new Date()): string {
  const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1
  return `${y}-${y + 1}`
}

export const nomComplet = (a: Pick<Adherent, 'nom' | 'prenom'> | null | undefined) =>
  a ? `${a.prenom} ${a.nom}`.trim() : 'Adhérent inconnu'

/** Recherche tolérante aux accents sur nom, prénom, licence */
export function correspondRecherche(a: Pick<Adherent, 'nom' | 'prenom' | 'licence'>, q: string): boolean {
  const mots = normEntete(q) ? q.split(/\s+/).map(normEntete).filter(Boolean) : []
  if (!mots.length) return true
  const cible = normEntete(`${a.nom} ${a.prenom} ${a.licence ?? ''}`) + '|' + normEntete(`${a.prenom}${a.nom}`)
  return mots.every(m => cible.includes(m))
}
