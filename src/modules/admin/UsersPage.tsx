import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Check, X, Shield, ShieldOff, Power, PowerOff, Search } from 'lucide-react'
import { errMsg, supabase } from '@/core/supabase'
import type { Profile, Role, Statut } from '@/core/types'
import { useAuth } from '@/core/auth/AuthProvider'
import { Badge, EmptyState, PageHeader, Spinner, StatTile, useToast } from '@/core/ui'

const statutLabel: Record<Statut, string> = { en_attente: 'En attente', actif: 'Actif', desactive: 'Désactivé' }
const statutTone = { en_attente: 'orange', actif: 'green', desactive: 'red' } as const

export function UsersPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { profile: me } = useAuth()
  const [tab, setTab] = useState<Statut | 'tous'>('tous')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['profiles-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data as Profile[]
    },
  })

  const update = useMutation({
    mutationFn: async (p: { id: string; role?: Role; statut?: Statut }) => {
      const { id, ...rest } = p
      const { error } = await supabase.from('profiles').update(rest).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast('Utilisateur mis à jour')
      qc.invalidateQueries({ queryKey: ['profiles-admin'] })
      qc.invalidateQueries({ queryKey: ['pending-count'] })
      qc.invalidateQueries({ queryKey: ['membres'] })
    },
    onError: e => toast(errMsg(e), 'err'),
  })

  const counts = useMemo(() => {
    const c = { en_attente: 0, actif: 0, desactive: 0, admin: 0 }
    for (const p of data ?? []) { c[p.statut]++; if (p.role === 'admin' && p.statut === 'actif') c.admin++ }
    return c
  }, [data])

  const list = (data ?? [])
    .filter(p => tab === 'tous' || p.statut === tab)
    .filter(p => !search || (p.nom + ' ' + p.email).toLowerCase().includes(search.toLowerCase()))

  const tabs: { k: Statut | 'tous'; l: string }[] = [
    { k: 'tous', l: 'Tous' }, { k: 'en_attente', l: `En attente (${counts.en_attente})` },
    { k: 'actif', l: 'Actifs' }, { k: 'desactive', l: 'Désactivés' },
  ]

  return (
    <div>
      <PageHeader kicker="Administration" title="Utilisateurs" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="En attente" value={counts.en_attente} tone="orange" onClick={() => setTab('en_attente')} />
        <StatTile label="Actifs" value={counts.actif} tone="green" onClick={() => setTab('actif')} />
        <StatTile label="Admins" value={counts.admin} tone="blue" />
        <StatTile label="Désactivés" value={counts.desactive} tone="red" onClick={() => setTab('desactive')} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`btn ${tab === t.k ? 'bg-aasc-orange text-white' : 'btn-ghost'}`}>{t.l}</button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? <Spinner /> : list.length === 0 ? <EmptyState title="Aucun utilisateur" /> : (
        <div className="grid gap-3">
          {list.map(p => {
            const self = p.id === me?.id
            return (
              <div key={p.id} className={`card flex flex-wrap items-center gap-3 p-4 ${p.statut === 'en_attente' ? 'card-accent' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{p.nom || '—'}</p>
                    {self && <Badge>Vous</Badge>}
                    <Badge tone={statutTone[p.statut]}>{statutLabel[p.statut]}</Badge>
                    <Badge tone={p.role === 'admin' ? 'orange' : 'blue'}>{p.role === 'admin' ? 'Admin' : 'Utilisateur'}</Badge>
                  </div>
                  <p className="truncate text-sm text-slate-400">{p.email}</p>
                  <p className="text-xs text-slate-500">Inscrit le {format(new Date(p.created_at), 'd MMM yyyy', { locale: fr })}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.statut === 'en_attente' && <>
                    <button className="btn-primary" onClick={() => update.mutate({ id: p.id, statut: 'actif' })}><Check size={16} /> Valider</button>
                    <button className="btn-ghost" onClick={() => update.mutate({ id: p.id, statut: 'desactive' })}><X size={16} /> Refuser</button>
                  </>}
                  {p.statut === 'actif' && !self && <>
                    {p.role === 'utilisateur'
                      ? <button className="btn-ghost" onClick={() => update.mutate({ id: p.id, role: 'admin' })}><Shield size={16} /> Passer admin</button>
                      : <button className="btn-ghost" onClick={() => update.mutate({ id: p.id, role: 'utilisateur' })}><ShieldOff size={16} /> Retirer admin</button>}
                    <button className="btn-ghost text-red-300" onClick={() => confirm(`Désactiver ${p.nom || p.email} ?`) && update.mutate({ id: p.id, statut: 'desactive' })}>
                      <PowerOff size={16} /> Désactiver
                    </button>
                  </>}
                  {p.statut === 'desactive' && (
                    <button className="btn-ghost" onClick={() => update.mutate({ id: p.id, statut: 'actif' })}><Power size={16} /> Réactiver</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
