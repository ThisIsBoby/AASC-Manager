import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/core/supabase'
import type { Cordage, MoyenPaiement, OffreCordage, StatutCordage, Vente } from '@/core/types'

async function q<T>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data as T
}

// ---------------- Lectures ----------------
export const useOffresCordage = () =>
  useQuery({ queryKey: ['offres_cordage'], queryFn: () => q<OffreCordage[]>(supabase.from('offres_cordage').select('*').order('ordre').order('nom')) })

export const useVentes = (adherentId?: string) =>
  useQuery({
    queryKey: ['ventes', adherentId ?? 'all'],
    queryFn: () => {
      let r = supabase.from('ventes').select('*')
      if (adherentId) r = r.eq('adherent_id', adherentId)
      return q<Vente[]>(r.order('created_at', { ascending: false }).limit(1000))
    },
  })

export const useCordages = (adherentId?: string) =>
  useQuery({
    queryKey: ['cordages', adherentId ?? 'all'],
    queryFn: () => {
      let r = supabase.from('cordages').select('*')
      if (adherentId) r = r.eq('adherent_id', adherentId)
      return q<Cordage[]>(r.order('created_at', { ascending: false }).limit(1000))
    },
  })

// ---------------- Écritures ----------------
/** Une vente ou un cordage touche le stock : on rafraîchit aussi les vues du module Stock */
function useInvalidateBoutique() {
  const qc = useQueryClient()
  return () => Promise.all(['ventes', 'cordages', 'lots', 'stock', 'mouvements', 'peremptions']
    .map(k => qc.invalidateQueries({ queryKey: [k] })))
}

export function useEnregistrerVente() {
  const inv = useInvalidateBoutique()
  return useMutation({
    mutationFn: (p: { adherent: string; produit: string; quantite: number; prix: number; paye: boolean; moyen: MoyenPaiement; note: string }) =>
      q<string>(supabase.rpc('enregistrer_vente', {
        p_adherent: p.adherent, p_produit: p.produit, p_quantite: p.quantite, p_prix: p.prix,
        p_paye: p.paye, p_moyen: p.moyen, p_note: p.note,
      })),
    onSuccess: inv,
  })
}

export function useAnnulerVente() {
  const inv = useInvalidateBoutique()
  return useMutation({
    mutationFn: (id: string) => q(supabase.rpc('annuler_vente', { p_vente: id })),
    onSuccess: inv,
  })
}

export function useAvancerCordage() {
  const inv = useInvalidateBoutique()
  return useMutation({
    mutationFn: (p: { id: string; statut: StatutCordage }) =>
      q<string | null>(supabase.rpc('avancer_cordage', { p_cordage: p.id, p_statut: p.statut })),
    onSuccess: inv,
  })
}

export function useCreerCordage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (row: Partial<Cordage>) => q(supabase.from('cordages').insert(row)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cordages'] }),
  })
}

/** Marque payé / à payer une vente ou un cordage */
export function usePaiement(table: 'ventes' | 'cordages') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { id: string; paye: boolean; moyen: MoyenPaiement }) =>
      q(supabase.from(table).update({ paye: p.paye, moyen_paiement: p.paye ? p.moyen : '' }).eq('id', p.id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  })
}
