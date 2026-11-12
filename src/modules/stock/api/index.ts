import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/core/supabase'
import type {
  Caisse, Categorie, Inventaire, InventaireCaisse, InventaireLigne, Lot, ModeleLigne, ModeleTournoi, Mouvement, Peremption, Produit, Profile,
  StockProduit, Tournoi, TypeMouvement,
} from '@/core/types'

async function q<T>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data as T
}

// ---------------- Lectures ----------------
export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: () => q<Categorie[]>(supabase.from('categories').select('*').order('ordre')) })

export const useCaisses = () =>
  useQuery({ queryKey: ['caisses'], queryFn: () => q<Caisse[]>(supabase.from('caisses').select('*').order('code')) })

export const useCaisse = (id: string | undefined) =>
  useQuery({
    queryKey: ['caisse', id], enabled: !!id,
    queryFn: () => q<Caisse | null>(supabase.from('caisses').select('*').eq('id', id!).maybeSingle()),
  })

export const useProduits = () =>
  useQuery({ queryKey: ['produits'], queryFn: () => q<Produit[]>(supabase.from('produits').select('*').order('designation')) })

export const useStockProduits = () =>
  useQuery({ queryKey: ['stock'], queryFn: () => q<StockProduit[]>(supabase.from('v_stock_produit').select('*').order('designation')) })

export const useLots = (filter?: { caisseId?: string; produitId?: string }) =>
  useQuery({
    queryKey: ['lots', filter ?? {}],
    queryFn: () => {
      let r = supabase.from('lots').select('*')
      if (filter?.caisseId) r = r.eq('caisse_id', filter.caisseId)
      if (filter?.produitId) r = r.eq('produit_id', filter.produitId)
      return q<Lot[]>(r.order('date_peremption', { ascending: true, nullsFirst: false }))
    },
  })

export const usePeremptions = () =>
  useQuery({ queryKey: ['peremptions'], queryFn: () => q<Peremption[]>(supabase.from('v_peremptions').select('*').order('date_peremption')) })

export interface MouvementFiltre { caisseId?: string; produitId?: string; type?: TypeMouvement | ''; depuis?: string; tournoiId?: string }
export const useMouvements = (f: MouvementFiltre = {}, limit = 200) =>
  useQuery({
    queryKey: ['mouvements', f, limit],
    queryFn: () => {
      let r = supabase.from('mouvements').select('*')
      if (f.caisseId) r = r.or(`caisse_id.eq.${f.caisseId},caisse_dest_id.eq.${f.caisseId}`)
      if (f.produitId) r = r.eq('produit_id', f.produitId)
      if (f.type) r = r.eq('type', f.type)
      if (f.depuis) r = r.gte('created_at', f.depuis)
      if (f.tournoiId) r = r.eq('tournoi_id', f.tournoiId)
      return q<Mouvement[]>(r.order('created_at', { ascending: false }).limit(limit))
    },
  })

export const useMembres = () =>
  useQuery({ queryKey: ['membres'], queryFn: () => q<Profile[]>(supabase.from('profiles').select('*').order('nom')) })

export const useModeles = () =>
  useQuery({ queryKey: ['modeles'], queryFn: () => q<ModeleTournoi[]>(supabase.from('modeles_tournoi').select('*').order('nom')) })

export const useModeleLignes = () =>
  useQuery({ queryKey: ['modele_lignes'], queryFn: () => q<ModeleLigne[]>(supabase.from('modeles_tournoi_lignes').select('*')) })

export const useTournois = () =>
  useQuery({ queryKey: ['tournois'], queryFn: () => q<Tournoi[]>(supabase.from('tournois').select('*').order('date', { ascending: false, nullsFirst: true })) })

// ---------------- Écritures ----------------
/** Invalide tout ce qui dépend du stock */
function useInvalidateStock() {
  const qc = useQueryClient()
  return () => Promise.all(['lots', 'stock', 'peremptions', 'mouvements', 'tournois', 'inventaires'].map(k => qc.invalidateQueries({ queryKey: [k] })))
}

export function useUpsert<T extends { id?: string }>(table: string, keys: string[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: Partial<T>) => {
      const { id, ...rest } = row
      if (id) return q(supabase.from(table).update(rest).eq('id', id).select().single())
      return q(supabase.from(table).insert(rest).select().single())
    },
    onSuccess: () => Promise.all(keys.map(k => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

export function useDelete(table: string, keys: string[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => q(supabase.from(table).delete().eq('id', id)),
    onSuccess: () => Promise.all(keys.map(k => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

/**
 * Enregistre plusieurs produits d'un coup (tailles d'un modèle) : mise à jour si id, création sinon.
 * Retourne les ids dans l'ordre des lignes.
 */
export function useEnregistrerProduits() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: Partial<Produit>[]) => {
      const ids: string[] = []
      for (const { id, ...rest } of rows) {
        const r = id
          ? await q<Produit>(supabase.from('produits').update(rest).eq('id', id).select().single())
          : await q<Produit>(supabase.from('produits').insert(rest).select().single())
        ids.push(r.id)
      }
      return ids
    },
    onSuccess: () => Promise.all(['produits', 'stock'].map(k => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

/** Supprime des produits (refusé par la base s'il leur reste des lots) */
export function useSupprimerProduits() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => q(supabase.from('produits').delete().in('id', ids)),
    onSuccess: () => Promise.all(['produits', 'stock', 'modele_lignes'].map(k => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

export function useCreerLot() {
  const inv = useInvalidateStock()
  return useMutation({
    mutationFn: (p: { caisse: string; produit: string; quantite: number; date_achat?: string | null; date_peremption?: string | null; note?: string }) =>
      q<string>(supabase.rpc('creer_lot', {
        p_caisse: p.caisse, p_produit: p.produit, p_quantite: p.quantite,
        p_date_achat: p.date_achat || null, p_date_peremption: p.date_peremption || null, p_note: p.note ?? '',
      })),
    onSuccess: inv,
  })
}

export function useMouvement() {
  const inv = useInvalidateStock()
  return useMutation({
    mutationFn: (p: { lot: string; type: 'entree' | 'sortie' | 'ajustement'; quantite: number; motif?: string }) =>
      q<number>(supabase.rpc('enregistrer_mouvement', { p_lot: p.lot, p_type: p.type, p_quantite: p.quantite, p_motif: p.motif ?? '' })),
    onSuccess: inv,
  })
}

export function useTransfert() {
  const inv = useInvalidateStock()
  return useMutation({
    mutationFn: (p: { lot: string; dest: string; quantite: number }) =>
      q<string>(supabase.rpc('transferer_lot', { p_lot: p.lot, p_caisse_dest: p.dest, p_quantite: p.quantite })),
    onSuccess: inv,
  })
}

export function useUpdateLotInfos() {
  const inv = useInvalidateStock()
  return useMutation({
    mutationFn: (p: { id: string; date_achat: string | null; date_peremption: string | null; note: string }) =>
      q(supabase.from('lots').update({ date_achat: p.date_achat, date_peremption: p.date_peremption, note: p.note }).eq('id', p.id)),
    onSuccess: inv,
  })
}

export function useSortirTournoi() {
  const inv = useInvalidateStock()
  return useMutation({
    mutationFn: (id: string) => q<{ produit_id: string; besoin: number; sorti: number }[]>(supabase.rpc('sortir_tournoi', { p_tournoi: id })),
    onSuccess: inv,
  })
}

/** Remplace toutes les lignes d'un modèle de tournoi */
export function useSaveModeleLignes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ modeleId, lignes }: { modeleId: string; lignes: Omit<ModeleLigne, 'id' | 'modele_id'>[] }) => {
      await q(supabase.from('modeles_tournoi_lignes').delete().eq('modele_id', modeleId))
      if (lignes.length) await q(supabase.from('modeles_tournoi_lignes').insert(lignes.map(l => ({ ...l, modele_id: modeleId }))))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modele_lignes'] }),
  })
}

// ---------------- Inventaires ----------------
export const useInventaires = () =>
  useQuery({ queryKey: ['inventaires', 'liste'], queryFn: () => q<Inventaire[]>(supabase.from('inventaires').select('*').order('created_at', { ascending: false })) })

export const useInventaire = (id: string | undefined) =>
  useQuery({
    queryKey: ['inventaires', 'un', id], enabled: !!id,
    queryFn: () => q<Inventaire | null>(supabase.from('inventaires').select('*').eq('id', id!).maybeSingle()),
  })

/** Caisses d'un inventaire (ou de tous les inventaires si id absent) */
export const useInventaireCaisses = (inventaireId?: string) =>
  useQuery({
    queryKey: ['inventaires', 'caisses', inventaireId ?? 'tous'],
    queryFn: () => {
      let r = supabase.from('inventaire_caisses').select('*')
      if (inventaireId) r = r.eq('inventaire_id', inventaireId)
      return q<InventaireCaisse[]>(r)
    },
  })

/** Lignes de comptage de toutes les caisses d'un inventaire */
export const useInventaireLignes = (inventaireId: string | undefined) =>
  useQuery({
    queryKey: ['inventaires', 'lignes', inventaireId], enabled: !!inventaireId,
    queryFn: () => q<InventaireLigne[]>(supabase.from('inventaire_lignes')
      .select('*, inventaire_caisses!inner(inventaire_id)')
      .eq('inventaire_caisses.inventaire_id', inventaireId!)),
  })

function useInvalidateInventaires() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['inventaires'] })
}

export function useCreerInventaire() {
  const inv = useInvalidateInventaires()
  return useMutation({
    mutationFn: (p: { nom: string; caisses: string[] | null }) =>
      q<string>(supabase.rpc('creer_inventaire', { p_nom: p.nom, p_caisses: p.caisses })),
    onSuccess: inv,
  })
}

export function useAjouterCaisseInventaire() {
  const inv = useInvalidateInventaires()
  return useMutation({
    mutationFn: (p: { inventaire: string; caisse: string }) =>
      q<string>(supabase.rpc('ajouter_caisse_inventaire', { p_inventaire: p.inventaire, p_caisse: p.caisse })),
    onSuccess: inv,
  })
}

export interface LigneComptage {
  lot_id: string | null
  produit_id: string
  qte_comptee: number | null
  date_peremption?: string | null
  note?: string
}

/** Enregistre le comptage d'une caisse ; renvoie le nouveau statut (en_cours | compte) */
export function useEnregistrerComptage() {
  const inv = useInvalidateInventaires()
  return useMutation({
    mutationFn: (p: { invCaisse: string; lignes: LigneComptage[] }) =>
      q<'en_cours' | 'compte'>(supabase.rpc('enregistrer_comptage', { p_inv_caisse: p.invCaisse, p_lignes: p.lignes })),
    onSuccess: inv,
  })
}

/** Valide une caisse : applique les écarts au stock ; renvoie le nombre d'ajustements */
export function useValiderComptage() {
  const inv = useInvalidateStock()
  return useMutation({
    mutationFn: (invCaisse: string) => q<number>(supabase.rpc('valider_comptage', { p_inv_caisse: invCaisse })),
    onSuccess: inv,
  })
}

export function useCloturerInventaire() {
  const inv = useInvalidateInventaires()
  return useMutation({
    mutationFn: (id: string) => q(supabase.rpc('cloturer_inventaire', { p_inventaire: id })),
    onSuccess: inv,
  })
}
