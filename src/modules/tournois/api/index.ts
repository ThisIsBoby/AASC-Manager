import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/core/supabase'
import type { ModeleChecklist, ModeleChecklistTache, TournoiTache } from '@/core/types'

async function q<T>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data as T
}

export const useModelesChecklist = () =>
  useQuery({ queryKey: ['modeles_checklist'], queryFn: () => q<ModeleChecklist[]>(supabase.from('modeles_checklist').select('*').order('nom')) })

export const useModeleChecklistTaches = () =>
  useQuery({
    queryKey: ['modeles_checklist_taches'],
    queryFn: () => q<ModeleChecklistTache[]>(supabase.from('modeles_checklist_taches').select('*').order('ordre')),
  })

/** Toutes les tâches de tous les tournois (volume faible à l'échelle d'un club) */
export const useTournoiTaches = () =>
  useQuery({
    queryKey: ['tournoi_taches'],
    queryFn: () => q<TournoiTache[]>(supabase.from('tournoi_taches').select('*').order('ordre')),
  })

export function useAppliquerModeleChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { tournoi: string; modele: string }) =>
      q<number>(supabase.rpc('appliquer_modele_checklist', { p_tournoi: p.tournoi, p_modele: p.modele })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tournoi_taches'] }),
  })
}

/** Cocher / décocher une tâche, avec affichage immédiat */
export function useToggleTache() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { id: string; fait: boolean }) =>
      q(supabase.from('tournoi_taches').update({ fait: p.fait }).eq('id', p.id)),
    onMutate: async p => {
      await qc.cancelQueries({ queryKey: ['tournoi_taches'] })
      const prev = qc.getQueryData<TournoiTache[]>(['tournoi_taches'])
      qc.setQueryData<TournoiTache[]>(['tournoi_taches'], l => l?.map(t => t.id === p.id ? { ...t, fait: p.fait } : t))
      return { prev }
    },
    onError: (_e, _p, ctx) => { if (ctx?.prev) qc.setQueryData(['tournoi_taches'], ctx.prev) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tournoi_taches'] }),
  })
}

/** Remplace toutes les tâches d'un modèle de checklist */
export function useSaveModeleChecklistTaches() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ modeleId, taches }: { modeleId: string; taches: Omit<ModeleChecklistTache, 'id' | 'modele_id'>[] }) => {
      await q(supabase.from('modeles_checklist_taches').delete().eq('modele_id', modeleId))
      if (taches.length) await q(supabase.from('modeles_checklist_taches').insert(taches.map(t => ({ ...t, modele_id: modeleId }))))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modeles_checklist_taches'] }),
  })
}
