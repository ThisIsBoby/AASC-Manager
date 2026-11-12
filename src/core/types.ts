export type Role = 'admin' | 'utilisateur'
export type Statut = 'en_attente' | 'actif' | 'desactive'

export interface Profile {
  id: string
  email: string
  nom: string
  role: Role
  statut: Statut
  created_at: string
}

export interface Categorie { id: string; nom: string; couleur: string; icone: string; ordre: number }

export interface Caisse {
  id: string; code: string; nom: string; categorie_id: string | null
  emplacement: string; description: string; actif: boolean; created_at: string
}

export interface Produit {
  id: string; designation: string; categorie_id: string | null
  unite: string; seuil_min: number; actif: boolean
  /** null = pas vendu en boutique */
  prix_vente: number | null
  /** Regroupe les tailles d'un même produit (ex. « Maillot club ») ; vide = produit simple */
  modele: string; taille: string; ordre: number
}

export interface Lot {
  id: string; caisse_id: string; produit_id: string; quantite: number
  date_achat: string | null; date_peremption: string | null; note: string; created_at: string
}

export type TypeMouvement = 'entree' | 'sortie' | 'ajustement' | 'transfert'

export interface Mouvement {
  id: string; lot_id: string | null; produit_id: string | null; caisse_id: string | null
  caisse_dest_id: string | null; type: TypeMouvement; quantite: number; quantite_apres: number | null
  motif: string; tournoi_id: string | null; user_id: string | null; created_at: string
  inventaire_id?: string | null
}

export type StatutInventaire = 'en_cours' | 'cloture'
export interface Inventaire {
  id: string; nom: string; statut: StatutInventaire; note: string
  created_by: string | null; created_at: string; cloture_le: string | null
}

/** a_faire → en_cours (comptage incomplet) → compte (à valider) → valide (écarts appliqués) */
export type StatutCaisseInventaire = 'a_faire' | 'en_cours' | 'compte' | 'valide'
export interface InventaireCaisse {
  id: string; inventaire_id: string; caisse_id: string; statut: StatutCaisseInventaire
  compte_par: string | null; compte_le: string | null; valide_par: string | null; valide_le: string | null
}

export interface InventaireLigne {
  id: string; inventaire_caisse_id: string; lot_id: string | null; produit_id: string
  /** élément trouvé en plus (absent du stock théorique) */
  nouveau: boolean
  qte_theorique: number
  /** null = pas encore compté */
  qte_comptee: number | null
  /** quantité réelle au moment de la validation */
  qte_avant: number | null
  date_peremption: string | null; note: string
}

export interface StockProduit {
  id: string; designation: string; categorie_id: string | null; unite: string; seuil_min: number; actif: boolean
  stock_valide: number; stock_perime: number; prochaine_peremption: string | null; nb_lots: number
  prix_vente: number | null; modele: string; taille: string; ordre: number
}

export interface Peremption {
  lot_id: string; quantite: number; date_peremption: string; date_achat: string | null
  produit_id: string; designation: string; unite: string
  caisse_id: string; caisse_code: string; caisse_nom: string; jours_restants: number
}

export interface ModeleTournoi { id: string; nom: string; description: string }
export interface ModeleLigne { id: string; modele_id: string; produit_id: string; qte_par_joueur: number; qte_fixe: number }
export type TypeTournoi = 'tournoi' | 'interclub' | 'evenement'
export interface Tournoi {
  id: string; nom: string; date: string | null; nb_joueurs: number; type: TypeTournoi
  modele_id: string | null; statut: 'prepa' | 'termine'; created_at: string
}

export interface Adherent {
  id: string; licence: string | null; nom: string; prenom: string; sexe: string
  date_naissance: string | null; email: string; telephone: string; categorie: string
  saison: string; actif: boolean; created_at: string; updated_at: string
}

export interface OffreCordage { id: string; nom: string; prix: number; produit_id: string | null; actif: boolean; ordre: number }

export type MoyenPaiement = '' | 'especes' | 'cheque' | 'virement'
export type StatutCordage = 'deposee' | 'cordee' | 'rendue'

export interface Vente {
  id: string; adherent_id: string | null; produit_id: string | null; libelle: string
  quantite: number; prix_unitaire: number; total: number
  paye: boolean; moyen_paiement: MoyenPaiement; paye_le: string | null; note: string
  annulee: boolean; user_id: string | null; created_at: string
}
export interface Cordage {
  id: string; adherent_id: string | null; offre_id: string | null; offre_nom: string; prix: number
  raquette: string; cordage_ref: string; tension: string; statut: StatutCordage
  depose_le: string; corde_le: string | null; rendu_le: string | null; stock_sorti: boolean
  paye: boolean; moyen_paiement: MoyenPaiement; paye_le: string | null; note: string
  user_id: string | null; created_at: string
}

export interface ModeleChecklist { id: string; nom: string; description: string }
export interface ModeleChecklistTache {
  id: string; modele_id: string; libelle: string; categorie: string; jours_avant: number | null; ordre: number
}
export interface TournoiTache {
  id: string; tournoi_id: string; libelle: string; categorie: string; echeance: string | null
  responsable_id: string | null; fait: boolean; fait_par: string | null; fait_le: string | null
  ordre: number; created_at: string
}
