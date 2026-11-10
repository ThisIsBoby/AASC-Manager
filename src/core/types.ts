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
}

export interface StockProduit {
  id: string; designation: string; categorie_id: string | null; unite: string; seuil_min: number; actif: boolean
  stock_valide: number; stock_perime: number; prochaine_peremption: string | null; nb_lots: number
}

export interface Peremption {
  lot_id: string; quantite: number; date_peremption: string; date_achat: string | null
  produit_id: string; designation: string; unite: string
  caisse_id: string; caisse_code: string; caisse_nom: string; jours_restants: number
}

export interface ModeleTournoi { id: string; nom: string; description: string }
export interface ModeleLigne { id: string; modele_id: string; produit_id: string; qte_par_joueur: number; qte_fixe: number }
export interface Tournoi {
  id: string; nom: string; date: string | null; nb_joueurs: number
  modele_id: string | null; statut: 'prepa' | 'termine'; created_at: string
}
