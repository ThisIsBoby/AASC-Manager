import type { TournoiTache, TypeTournoi } from '@/core/types'

/** Date du jour au format AAAA-MM-JJ (heure locale) */
export function aujourdhui(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** Nombre de jours entre deux dates AAAA-MM-JJ (b - a) */
export function ecartJours(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000)
}

/** Échéance d'une tâche « J-x » pour un tournoi à la date donnée */
export function echeanceDepuisJ(dateTournoi: string | null, joursAvant: number | null): string | null {
  if (!dateTournoi || joursAvant == null) return null
  const [y, m, d] = dateTournoi.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - joursAvant)).toISOString().slice(0, 10)
}

/** Compte à rebours : « J-12 », « Jour J », « Passé » */
export function compteARebours(dateTournoi: string | null, today = aujourdhui()): string | null {
  if (!dateTournoi) return null
  const n = ecartJours(today, dateTournoi)
  if (n > 0) return `J-${n}`
  if (n === 0) return 'Jour J'
  return 'Passé'
}

export type EtatTache = 'fait' | 'retard' | 'semaine' | 'a_faire'

export function etatTache(t: Pick<TournoiTache, 'fait' | 'echeance'>, today = aujourdhui()): EtatTache {
  if (t.fait) return 'fait'
  if (!t.echeance) return 'a_faire'
  const n = ecartJours(today, t.echeance)
  if (n < 0) return 'retard'
  if (n <= 7) return 'semaine'
  return 'a_faire'
}

export interface Progression { total: number; faites: number; pct: number; retard: number; semaine: number }

export function progression(taches: Pick<TournoiTache, 'fait' | 'echeance'>[], today = aujourdhui()): Progression {
  const etats = taches.map(t => etatTache(t, today))
  const faites = etats.filter(e => e === 'fait').length
  return {
    total: taches.length,
    faites,
    pct: taches.length ? Math.round((faites / taches.length) * 100) : 0,
    retard: etats.filter(e => e === 'retard').length,
    semaine: etats.filter(e => e === 'semaine').length,
  }
}

/** Regroupe les tâches par catégorie (tri par échéance), « sans catégorie » en dernier */
export function grouperParCategorie<T extends Pick<TournoiTache, 'categorie' | 'ordre' | 'echeance'>>(taches: T[]): [string, T[]][] {
  const tri = [...taches].sort((a, b) =>
    (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999') || a.ordre - b.ordre)
  const map = new Map<string, T[]>()
  for (const t of tri) {
    const k = t.categorie.trim()
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(t)
  }
  return [...map.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : 0))
}

export const TYPES_TOURNOI: TypeTournoi[] = ['tournoi', 'interclub', 'evenement']

const INFOS: Record<TypeTournoi, { libelle: string; pluriel: string; le: string; badge: 'orange' | 'green' | 'blue' }> = {
  tournoi: { libelle: 'Tournoi', pluriel: 'Tournois', le: 'le tournoi', badge: 'orange' },
  interclub: { libelle: 'Interclub', pluriel: 'Interclubs', le: "l'interclub", badge: 'green' },
  evenement: { libelle: 'Événement', pluriel: 'Événements', le: "l'événement", badge: 'blue' },
}
const infos = (t?: TypeTournoi | null) => INFOS[t ?? 'tournoi'] ?? INFOS.tournoi

/** Libellé du type (« Tournoi », « Interclub », « Événement ») */
export const libelleType = (t?: TypeTournoi | null) => infos(t).libelle
/** Libellé au pluriel, pour les filtres */
export const plurielType = (t?: TypeTournoi | null) => infos(t).pluriel
/** Avec article : « le tournoi », « l'interclub », « l'événement » */
export const avecArticle = (t?: TypeTournoi | null) => infos(t).le
/** Couleur du badge */
export const couleurType = (t?: TypeTournoi | null) => infos(t).badge

/** Un tournoi compte des joueurs ; un interclub ou un événement compte toutes les personnes présentes */
export const libelleParticipants = (t?: TypeTournoi | null, n?: number) => {
  const mot = (t ?? 'tournoi') === 'tournoi' ? 'joueur' : 'personne'
  return n === undefined ? mot : `${n} ${mot}${n > 1 ? 's' : ''}`
}
