import { useMemo, useState, type FormEvent } from 'react'
import { Check, ListPlus, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthProvider'
import { errMsg } from '@/core/supabase'
import type { Tournoi, TournoiTache } from '@/core/types'
import { Badge, EmptyState, Field, Modal, useToast } from '@/core/ui'
import { useDelete, useMembres, useUpsert } from '@/modules/stock/api'
import { fmtDate } from '@/modules/stock/components/shared'
import { useAppliquerModeleChecklist, useModelesChecklist, useToggleTache } from '../api'
import { etatTache, grouperParCategorie } from '../logic'

type Filtre = 'tout' | 'a_faire' | 'moi'

export function Checklist({ t, taches }: { t: Tournoi; taches: TournoiTache[] }) {
  const { profile } = useAuth()
  const toast = useToast()
  const membres = useMembres().data ?? []
  const nomMembre = useMemo(() => new Map(membres.map(m => [m.id, m.nom || m.email])), [membres])
  const modeles = useModelesChecklist().data ?? []
  const upsert = useUpsert<TournoiTache>('tournoi_taches', ['tournoi_taches'])
  const del = useDelete('tournoi_taches', ['tournoi_taches'])
  const toggle = useToggleTache()
  const appliquer = useAppliquerModeleChecklist()

  const [filtre, setFiltre] = useState<Filtre>('tout')
  const [libelle, setLibelle] = useState('')
  const [categorie, setCategorie] = useState('')
  const [modele, setModele] = useState('')
  const [edit, setEdit] = useState<TournoiTache | null>(null)

  const categories = useMemo(() => [...new Set(taches.map(x => x.categorie).filter(Boolean))].sort(), [taches])
  const visibles = taches.filter(x =>
    filtre === 'tout' ? true : filtre === 'a_faire' ? !x.fait : x.responsable_id === profile?.id)
  const groupes = grouperParCategorie(visibles)

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    if (!libelle.trim()) return
    try {
      const ordre = Math.max(0, ...taches.map(x => x.ordre)) + 1
      await upsert.mutateAsync({ tournoi_id: t.id, libelle: libelle.trim(), categorie: categorie.trim(), ordre })
      setLibelle('')
    } catch (err) { toast(errMsg(err), 'err') }
  }

  async function depuisModele() {
    if (!modele) return
    try {
      const n = await appliquer.mutateAsync({ tournoi: t.id, modele })
      toast(`${n} tâche(s) ajoutée(s)`); setModele('')
    } catch (err) { toast(errMsg(err), 'err') }
  }

  async function cocher(x: TournoiTache) {
    try { await toggle.mutateAsync({ id: x.id, fait: !x.fait }) } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        {([['tout', 'Tout'], ['a_faire', 'À faire'], ['moi', 'Mes tâches']] as const).map(([k, l]) => (
          <button key={k} className={`btn ${filtre === k ? 'bg-aasc-orange text-white' : 'btn-ghost'}`} onClick={() => setFiltre(k)}>{l}</button>
        ))}
        {modeles.length > 0 && (
          <div className="ml-auto flex gap-2">
            <select className="input" value={modele} onChange={e => setModele(e.target.value)} aria-label="Modèle de checklist">
              <option value="">Ajouter depuis un modèle…</option>
              {modeles.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
            <button className="btn-ghost" onClick={depuisModele} disabled={!modele || appliquer.isPending}><ListPlus size={16} /> Ajouter</button>
          </div>
        )}
      </div>

      <form onSubmit={ajouter} className="no-print card mb-4 flex flex-wrap gap-2 p-3">
        <input className="input min-w-[200px] flex-[3]" placeholder="Nouvelle tâche, ex. Réserver la sono" value={libelle} onChange={e => setLibelle(e.target.value)} />
        <input className="input min-w-[140px] flex-1" placeholder="Catégorie" list="categories-taches" value={categorie} onChange={e => setCategorie(e.target.value)} />
        <datalist id="categories-taches">{categories.map(c => <option key={c} value={c} />)}</datalist>
        <button className="btn-primary" disabled={!libelle.trim() || upsert.isPending}><Plus size={16} /> Ajouter</button>
      </form>

      {!taches.length ? (
        <EmptyState title="Checklist vide">Ajoutez une tâche ci-dessus ou partez d'un modèle de checklist.</EmptyState>
      ) : !visibles.length ? (
        <EmptyState title={filtre === 'moi' ? 'Aucune tâche ne vous est assignée' : 'Tout est fait !'} />
      ) : (
        <div className="space-y-4">
          {groupes.map(([cat, liste]) => (
            <section key={cat || '_'} className="card overflow-hidden">
              <h3 className="flex items-center justify-between border-b border-aasc-line px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>{cat || 'Sans catégorie'}</span>
                <span>{liste.filter(x => x.fait).length}/{liste.length}</span>
              </h3>
              <ul>
                {liste.map(x => {
                  const etat = etatTache(x)
                  return (
                    <li key={x.id} className="flex items-start gap-3 border-b border-aasc-line/60 px-4 py-3 last:border-0">
                      <button onClick={() => cocher(x)} aria-label={x.fait ? 'Décocher' : 'Cocher'}
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${x.fait ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-500 hover:border-aasc-orange'}`}>
                        {x.fait && <Check size={16} strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold ${x.fait ? 'text-slate-500 line-through' : ''}`}>{x.libelle}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          {x.echeance && !x.fait && (
                            <Badge tone={etat === 'retard' ? 'red' : etat === 'semaine' ? 'orange' : 'slate'}>
                              {etat === 'retard' ? 'En retard · ' : 'Avant le '}{fmtDate(x.echeance, 'dd/MM')}
                            </Badge>
                          )}
                          {x.responsable_id && <span className="inline-flex items-center gap-1"><UserRound size={12} />{nomMembre.get(x.responsable_id) ?? '?'}</span>}
                          {x.fait && x.fait_le && (
                            <span className="text-emerald-300">✓ {x.fait_par ? `par ${nomMembre.get(x.fait_par) ?? '?'} ` : ''}le {fmtDate(x.fait_le, 'dd/MM à HH:mm')}</span>
                          )}
                        </div>
                      </div>
                      <div className="no-print flex shrink-0 gap-1">
                        <button className="btn-icon btn-ghost" onClick={() => setEdit(x)} aria-label="Modifier"><Pencil size={14} /></button>
                        <button className="btn-icon btn-ghost text-red-300" aria-label="Supprimer" onClick={async () => {
                          if (!confirm(`Supprimer la tâche « ${x.libelle} » ?`)) return
                          try { await del.mutateAsync(x.id) } catch (err) { toast(errMsg(err), 'err') }
                        }}><Trash2 size={14} /></button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {edit && <EditTache tache={edit} categories={categories} onClose={() => setEdit(null)} />}
    </div>
  )
}

function EditTache({ tache, categories, onClose }: { tache: TournoiTache; categories: string[]; onClose: () => void }) {
  const toast = useToast()
  const membres = (useMembres().data ?? []).filter(m => m.statut === 'actif')
  const upsert = useUpsert<TournoiTache>('tournoi_taches', ['tournoi_taches'])
  const [f, setF] = useState({
    libelle: tache.libelle, categorie: tache.categorie,
    echeance: tache.echeance ?? '', responsable_id: tache.responsable_id ?? '',
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await upsert.mutateAsync({
        id: tache.id, libelle: f.libelle.trim(), categorie: f.categorie.trim(),
        echeance: f.echeance || null, responsable_id: f.responsable_id || null,
      })
      onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open onClose={onClose} title="Modifier la tâche">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Tâche"><input className="input" required value={f.libelle} onChange={e => setF({ ...f, libelle: e.target.value })} /></Field>
        <Field label="Catégorie">
          <input className="input" list="categories-edit" value={f.categorie} onChange={e => setF({ ...f, categorie: e.target.value })} />
          <datalist id="categories-edit">{categories.map(c => <option key={c} value={c} />)}</datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Échéance"><input type="date" className="input" value={f.echeance} onChange={e => setF({ ...f, echeance: e.target.value })} /></Field>
          <Field label="Responsable">
            <select className="input" value={f.responsable_id} onChange={e => setF({ ...f, responsable_id: e.target.value })}>
              <option value="">Personne</option>
              {membres.map(m => <option key={m.id} value={m.id}>{m.nom || m.email}</option>)}
            </select>
          </Field>
        </div>
        <button className="btn-primary w-full" disabled={upsert.isPending}>Enregistrer</button>
      </form>
    </Modal>
  )
}
