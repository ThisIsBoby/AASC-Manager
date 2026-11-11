import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/core/supabase'
import type { Adherent } from '@/core/types'
import type { LigneImport } from '../logic'

async function q<T>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data as T
}

/** Tous les adhérents (quelques centaines au plus : chargés en une fois) */
export const useAdherents = () =>
  useQuery({
    queryKey: ['adherents'],
    queryFn: () => q<Adherent[]>(supabase.from('adherents').select('*').order('nom').order('prenom').limit(5000)),
  })

export function useAdherentsMap() {
  const data = useAdherents().data
  return useMemo(() => new Map<string, Adherent>((data ?? []).map(a => [a.id, a])), [data])
}

export function useImporterAdherents() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { saison: string; lignes: LigneImport[]; desactiverAbsents: boolean }) =>
      q<{ crees: number; mis_a_jour: number; desactives: number }>(supabase.rpc('importer_adherents', {
        p_saison: p.saison, p_lignes: p.lignes, p_desactiver_absents: p.desactiverAbsents,
      })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adherents'] }),
  })
}
