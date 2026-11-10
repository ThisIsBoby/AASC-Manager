import type { ModeleLigne, StockProduit, Tournoi } from '@/core/types'

/** Besoin d'un produit pour un tournoi : quantité fixe + arrondi supérieur (par joueur × nb joueurs) */
export function besoinLigne(qteParJoueur: number, qteFixe: number, nbJoueurs: number): number {
  const v = (Number(qteFixe) || 0) + Math.ceil(round6((Number(qteParJoueur) || 0) * Math.max(0, nbJoueurs)))
  return v
}
// évite 0.1*30 = 3.0000000000000004 -> ceil = 4
const round6 = (n: number) => Math.round(n * 1e6) / 1e6

export interface LignePreparation {
  produitId: string
  besoin: number
  enStock: number
  aAcheter: number
}

/** Tableau besoin / stock / à acheter pour un tournoi */
export function calculPreparation(lignes: ModeleLigne[], nbJoueurs: number, stock: Map<string, number>): LignePreparation[] {
  return lignes.map(l => {
    const besoin = besoinLigne(l.qte_par_joueur, l.qte_fixe, nbJoueurs)
    const enStock = stock.get(l.produit_id) ?? 0
    return { produitId: l.produit_id, besoin, enStock, aAcheter: Math.max(0, besoin - enStock) }
  })
}

export interface LigneAchat {
  produitId: string
  stock: number
  seuil: number
  besoinTournois: number
  cible: number
  aAcheter: number
}

/**
 * Liste d'achats consolidée :
 *   cible = seuil minimum + besoins des tournois en préparation
 *   à acheter = max(0, cible − stock valide (non périmé))
 */
export function calculAchats(
  produits: StockProduit[],
  tournois: Tournoi[],
  lignes: ModeleLigne[],
  inclureTournois = true,
): LigneAchat[] {
  const besoins = new Map<string, number>()
  if (inclureTournois) {
    for (const t of tournois) {
      if (t.statut !== 'prepa' || !t.modele_id) continue
      for (const l of lignes) {
        if (l.modele_id !== t.modele_id) continue
        besoins.set(l.produit_id, (besoins.get(l.produit_id) ?? 0) + besoinLigne(l.qte_par_joueur, l.qte_fixe, t.nb_joueurs))
      }
    }
  }
  return produits
    .filter(p => p.actif)
    .map(p => {
      const besoinTournois = besoins.get(p.id) ?? 0
      const seuil = Number(p.seuil_min) || 0
      const stock = Number(p.stock_valide) || 0
      const cible = seuil + besoinTournois
      return { produitId: p.id, stock, seuil, besoinTournois, cible, aAcheter: Math.max(0, cible - stock) }
    })
    .filter(l => l.aAcheter > 0)
}

export type EtatPeremption = 'perime' | 'bientot' | 'ok' | 'aucune'

/** État d'un lot selon sa date de péremption (bientôt = dans les `seuilJours` jours) */
export function etatPeremption(date: string | null, aujourdHui = new Date(), seuilJours = 30): EtatPeremption {
  if (!date) return 'aucune'
  const d = new Date(date + 'T00:00:00')
  const today = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate())
  const jours = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (jours < 0) return 'perime'
  if (jours <= seuilJours) return 'bientot'
  return 'ok'
}

/** Extrait l'identifiant de caisse d'un contenu de QR (URL de l'app) ou d'un code saisi (C-001) */
export function parseScan(text: string): { id?: string; code?: string } {
  const t = text.trim()
  const m = t.match(/caisse\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  if (m) return { id: m[1].toLowerCase() }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return { id: t.toLowerCase() }
  const c = t.toUpperCase().match(/^C-?(\d{1,6})$/)
  if (c) return { code: 'C-' + c[1].padStart(3, '0') }
  return {}
}
