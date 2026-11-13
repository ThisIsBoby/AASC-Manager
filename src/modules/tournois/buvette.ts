import type { BuvetteLigne, Produit, RubriqueBuvette } from '@/core/types'

export type FormatAffiche = 'a4' | 'a3'

export interface Rubrique { id: RubriqueBuvette; nom: string; genre: 'boisson' | 'nourriture' }

/** Ordre d'affichage des rubriques sur la fiche et l'affiche */
export const RUBRIQUES: Rubrique[] = [
  { id: 'fraiche', nom: 'Boissons fraîches', genre: 'boisson' },
  { id: 'chaude', nom: 'Boissons chaudes', genre: 'boisson' },
  { id: 'sale', nom: 'Salé', genre: 'nourriture' },
  { id: 'sucre', nom: 'Sucré', genre: 'nourriture' },
]

export const FORMATS: Record<FormatAffiche, { nom: string; largeur: number; hauteur: number; usage: string }> = {
  a4: { nom: 'A4', largeur: 210, hauteur: 297, usage: 'comptoir ou table' },
  a3: { nom: 'A3', largeur: 297, hauteur: 420, usage: 'mur ou panneau, visible de loin' },
}

type LigneTriable = Pick<BuvetteLigne, 'rubrique' | 'ordre' | 'libelle' | 'visible'>

export interface Section<L> { rubrique: Rubrique; lignes: L[] }

/** Regroupe les lignes par rubrique (ordre fixe), triées par ordre puis libellé. Rubriques vides omises. */
export function grouperBuvette<L extends LigneTriable>(lignes: L[], seulementVisibles = false): Section<L>[] {
  const l = seulementVisibles ? lignes.filter(x => x.visible) : lignes
  return RUBRIQUES
    .map(r => ({
      rubrique: r,
      lignes: l.filter(x => x.rubrique === r.id).sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle, 'fr')),
    }))
    .filter(s => s.lignes.length)
}

/** Encombrement d'une rubrique sur l'affiche, en « lignes » (le titre compte pour 1,5) */
export const poidsSection = (s: { lignes: unknown[] }) => s.lignes.length + 1.5

/**
 * Répartit les rubriques sur deux colonnes sans changer leur ordre,
 * en équilibrant au mieux la hauteur des colonnes.
 */
export function repartirColonnes<S extends { lignes: unknown[] }>(sections: S[]): [S[], S[]] {
  if (sections.length < 2) return [sections, []]
  const total = sections.reduce((t, s) => t + poidsSection(s), 0)
  let meilleur = 1, ecart = Infinity, gauche = 0
  for (let k = 1; k < sections.length; k++) {
    gauche += poidsSection(sections[k - 1])
    const e = Math.abs(total - 2 * gauche)
    if (e < ecart) { ecart = e; meilleur = k }
  }
  return [sections.slice(0, meilleur), sections.slice(meilleur)]
}

/**
 * Facteur de taille du texte de la carte selon la colonne la plus chargée :
 * 1 pour environ 15 lignes, plus petit au-delà pour tout faire tenir sur la page, un peu plus grand s'il y a peu de produits.
 */
export function echelleCarte(poidsMax: number) {
  if (poidsMax <= 0) return 1
  return Math.round(Math.min(1.25, Math.max(0.55, 15 / poidsMax)) * 100) / 100
}

/** Colonne la plus chargée une fois les rubriques réparties sur deux colonnes */
export function poidsMaxColonnes<S extends { lignes: unknown[] }>(sections: S[]) {
  return Math.max(0, ...repartirColonnes(sections).map(c => c.reduce((t, s) => t + poidsSection(s), 0)))
}

/**
 * Capacité d'une colonne avant de passer à une page de plus : au-delà, le texte
 * descendrait sous 80 % de sa taille normale et l'affiche ne se lirait plus de loin.
 */
export const CAPACITE_COLONNE = 15 / 0.8

/**
 * Répartit les rubriques sur une ou plusieurs pages, sans couper une rubrique ni changer l'ordre.
 * Une rubrique trop longue pour une page reste seule sur la sienne (le texte y est réduit).
 */
export function paginer<S extends { lignes: unknown[] }>(sections: S[], capacite = CAPACITE_COLONNE): S[][] {
  const pages: S[][] = []
  let page: S[] = []
  for (const s of sections) {
    if (page.length && poidsMaxColonnes([...page, s]) > capacite) { pages.push(page); page = [] }
    page.push(s)
  }
  if (page.length) pages.push(page)
  return pages.length ? pages : [[]]
}

/** « 1,50 » : toujours deux décimales, virgule française */
export const fmtPrix = (n: number) => Number(n).toFixed(2).replace('.', ',')

/** Rubrique proposée pour un produit du stock (modifiable ensuite) */
export function rubriqueSuggeree(nom: string, categorie?: string | null): RubriqueBuvette {
  const n = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/\b(cafe|the|chocolat chaud|infusion|tisane|cappuccino|soupe)\b/.test(n)) return 'chaude'
  if (/\b(sandwich|chips|fromage|croque|hot.?dog|pizza|quiche|saucisson|panini|salade|frites|bretzel|cacahuete)/.test(n)) return 'sale'
  const c = (categorie ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (c.includes('boisson') || /\b(eau|soda|sirop|jus|ice ?tea|coca|limonade|monster|biere|energy|boisson)\b/.test(n)) return 'fraiche'
  return 'sucre'
}

export interface ArticleStock { cle: string; produitId: string; nom: string; prix: number | null; categorieId: string | null }

/**
 * Produits du stock proposables à la buvette : un seul article par produit à variantes
 * (ex. « Barres de céréales » plutôt que chaque parfum), produits actifs uniquement.
 */
export function articlesStock(produits: Produit[]): ArticleStock[] {
  const map = new Map<string, ArticleStock>()
  for (const p of produits) {
    if (!p.actif) continue
    const nom = (p.modele || p.designation).trim()
    const cle = p.modele ? `m:${p.modele}` : `p:${p.id}`
    if (!map.has(cle)) map.set(cle, { cle, produitId: p.id, nom, prix: p.prix_vente, categorieId: p.categorie_id })
  }
  return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

/** Lignes à créer pour reprendre la buvette d'un autre événement */
export function copierLignes(source: BuvetteLigne[], tournoiId: string) {
  return source.map(({ produit_id, libelle, rubrique, prix, ordre, visible }) => ({ tournoi_id: tournoiId, produit_id, libelle, rubrique, prix, ordre, visible }))
}

/** Ordre à donner à une nouvelle ligne : à la fin de sa rubrique */
export const ordreSuivant = (lignes: Pick<BuvetteLigne, 'rubrique' | 'ordre'>[], rubrique: RubriqueBuvette) =>
  lignes.filter(l => l.rubrique === rubrique).reduce((m, l) => Math.max(m, l.ordre + 1), 0)

// ---------------- Cartes buvette ----------------
/** Montants des cartes vendues et valeur d'une case à cocher */
export const VALEURS_CARTE = [5, 10] as const
export type ValeurCarte = (typeof VALEURS_CARTE)[number]
export const VALEUR_CASE = 0.5
/** 8 cartes de 105 × 74 mm par feuille A4 (2 colonnes × 4 rangées) */
export const CARTES_PAR_PAGE = 8

/** Nombre de cases d'une carte : 10 € → 20 cases de 0,50 € */
export const nbCases = (valeur: number) => Math.round(valeur / VALEUR_CASE)

/** Répartit les cartes à imprimer en feuilles A4, les 5 € d'abord */
export function planchesCartes(quantites: Partial<Record<ValeurCarte, number>>, parPage = CARTES_PAR_PAGE): ValeurCarte[][] {
  const cartes = VALEURS_CARTE.flatMap(v => Array<ValeurCarte>(Math.max(0, Math.floor(quantites[v] ?? 0))).fill(v))
  const pages: ValeurCarte[][] = []
  for (let i = 0; i < cartes.length; i += parPage) pages.push(cartes.slice(i, i + parPage))
  return pages
}
