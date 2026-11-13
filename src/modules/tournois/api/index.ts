import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/core/supabase'
import type { BuvetteLigne, ModeleChecklist, ModeleChecklistTache, TournoiTache } from '@/core/types'
import { copierLignes } from '../buvette'

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

// ---------------- Buvette ----------------
/** Toutes les lignes de buvette (volume faible) : sert aussi à « Reprendre une buvette » */
export const useBuvetteLignes = () =>
  useQuery({
    queryKey: ['buvette_lignes'],
    queryFn: () => q<BuvetteLigne[]>(supabase.from('buvette_lignes').select('*').order('ordre')),
  })

type NouvelleLigne = Omit<BuvetteLigne, 'id' | 'created_at'>

export function useAjouterLignesBuvette() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (lignes: NouvelleLigne[]) => q(supabase.from('buvette_lignes').insert(lignes)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['buvette_lignes'] }),
  })
}

/** Modifie une ligne, avec affichage immédiat */
export function useModifierLigneBuvette() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...p }: Partial<BuvetteLigne> & { id: string }) => q(supabase.from('buvette_lignes').update(p).eq('id', id)),
    onMutate: async p => {
      await qc.cancelQueries({ queryKey: ['buvette_lignes'] })
      const prev = qc.getQueryData<BuvetteLigne[]>(['buvette_lignes'])
      qc.setQueryData<BuvetteLigne[]>(['buvette_lignes'], l => l?.map(x => x.id === p.id ? { ...x, ...p } : x))
      return { prev }
    },
    onError: (_e, _p, ctx) => { if (ctx?.prev) qc.setQueryData(['buvette_lignes'], ctx.prev) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['buvette_lignes'] }),
  })
}

/** Échange l'ordre de deux lignes (monter / descendre) */
export function useEchangerOrdreBuvette() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ([a, b]: [BuvetteLigne, BuvetteLigne]) => {
      // Ordres égaux (lignes ajoutées ensemble) : on les rend distincts
      const oa = a.ordre === b.ordre ? b.ordre + 1 : b.ordre
      await q(supabase.from('buvette_lignes').update({ ordre: oa }).eq('id', a.id))
      await q(supabase.from('buvette_lignes').update({ ordre: a.ordre }).eq('id', b.id))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['buvette_lignes'] }),
  })
}

export function useSupprimerLigneBuvette() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => q(supabase.from('buvette_lignes').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['buvette_lignes'] }),
  })
}

/** Remplace la buvette d'un événement par celle d'un autre */
export function useReprendreBuvette() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ tournoiId, source }: { tournoiId: string; source: BuvetteLigne[] }) => {
      await q(supabase.from('buvette_lignes').delete().eq('tournoi_id', tournoiId))
      if (source.length) await q(supabase.from('buvette_lignes').insert(copierLignes(source, tournoiId)))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['buvette_lignes'] }),
  })
}
