import { useEffect, useState, type FormEvent } from 'react'
import { ListChecks, Package, Plus, Save, Trash2 } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthProvider'
import { errMsg } from '@/core/supabase'
import type { ModeleChecklist, ModeleTournoi } from '@/core/types'
import { EmptyState, Field, Modal, PageHeader, useToast } from '@/core/ui'
import { useDelete, useModeleLignes, useModeles, useProduits, useSaveModeleLignes, useUpsert } from '@/modules/stock/api'
import { useModeleChecklistTaches, useModelesChecklist, useSaveModeleChecklistTaches } from '../api'

export function ModelesPage() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<'checklists' | 'besoins'>('checklists')
  return (
    <div>
      <PageHeader kicker="Tournois" title={`Modèles${isAdmin ? '' : ' (lecture)'}`} />
      <div className="mb-5 flex gap-2">
        <button className={`btn ${tab === 'checklists' ? 'bg-aasc-orange text-white' : 'btn-ghost'}`} onClick={() => setTab('checklists')}><ListChecks size={16} /> Checklists</button>
        <button className={`btn ${tab === 'besoins' ? 'bg-aasc-orange text-white' : 'btn-ghost'}`} onClick={() => setTab('besoins')}><Package size={16} /> Besoins stock</button>
      </div>
      {tab === 'checklists' ? <ModelesChecklist /> : <ModelesBesoins />}
    </div>
  )
}

/** Liste de modèles à gauche + formulaire de création, commun aux deux onglets */
function ListeModeles<M extends { id: string; nom: string }>({ list, sel, setSel, onNew }: {
  list: M[]; sel: string; setSel: (id: string) => void; onNew?: () => void
}) {
  return (
    <div className="space-y-2">
      {list.map(m => (
        <button key={m.id} onClick={() => setSel(m.id)}
          className={`card w-full p-3 text-left font-semibold transition ${sel === m.id ? 'border-aasc-orange shadow-glow' : 'hover:border-aasc-blue'}`}>{m.nom}</button>
      ))}
      {onNew && <button className="btn-ghost w-full" onClick={onNew}><Plus size={16} /> Nouveau modèle</button>}
    </div>
  )
}

function NouveauModele({ open, onClose, onCreate, placeholder }: {
  open: boolean; onClose: () => void; onCreate: (nom: string, desc: string) => Promise<void>; placeholder: string
}) {
  const [nom, setNom] = useState('')
  const [desc, setDesc] = useState('')
  useEffect(() => { if (open) { setNom(''); setDesc('') } }, [open])
  return (
    <Modal open={open} onClose={onClose} title="Nouveau modèle">
      <form onSubmit={async (e: FormEvent) => { e.preventDefault(); await onCreate(nom.trim(), desc.trim()) }} className="space-y-4">
        <Field label="Nom"><input className="input" required value={nom} onChange={e => setNom(e.target.value)} placeholder={placeholder} /></Field>
        <Field label="Description"><input className="input" value={desc} onChange={e => setDesc(e.target.value)} /></Field>
        <button className="btn-primary w-full">Créer</button>
      </form>
    </Modal>
  )
}

// ---------------- Checklists ----------------
interface TacheEdit { libelle: string; categorie: string; jours_avant: string }

function ModelesChecklist() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const modeles = useModelesChecklist()
  const taches = useModeleChecklistTaches().data ?? []
  const upsert = useUpsert<ModeleChecklist>('modeles_checklist', ['modeles_checklist'])
  const del = useDelete('modeles_checklist', ['modeles_checklist', 'modeles_checklist_taches'])
  const save = useSaveModeleChecklistTaches()
  const [sel, setSel] = useState('')
  const [rows, setRows] = useState<TacheEdit[]>([])
  const [nom, setNom] = useState('')
  const [desc, setDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const list = modeles.data ?? []
  useEffect(() => { if (!sel && list[0]) setSel(list[0].id) }, [list, sel])
  const current = list.find(m => m.id === sel)
  useEffect(() => {
    if (!current) return
    setNom(current.nom); setDesc(current.description)
    setRows(taches.filter(x => x.modele_id === current.id).map(x => ({ libelle: x.libelle, categorie: x.categorie, jours_avant: x.jours_avant == null ? '' : String(x.jours_avant) })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, taches])

  async function enregistrer() {
    if (!current) return
    try {
      await upsert.mutateAsync({ id: current.id, nom, description: desc })
      const clean = rows.filter(r => r.libelle.trim())
      await save.mutateAsync({
        modeleId: current.id,
        taches: clean.map((r, i) => ({ libelle: r.libelle.trim(), categorie: r.categorie.trim(), jours_avant: r.jours_avant === '' ? null : Math.max(0, Number(r.jours_avant)), ordre: i + 1 })),
      })
      toast('Checklist enregistrée')
    } catch (err) { toast(errMsg(err), 'err') }
  }

  const ro = !isAdmin
  const categories = [...new Set(rows.map(r => r.categorie.trim()).filter(Boolean))].sort()
  const set = (i: number, patch: Partial<TacheEdit>) => setRows(rows.map((x, j) => j === i ? { ...x, ...patch } : x))

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <ListeModeles list={list} sel={sel} setSel={setSel} onNew={isAdmin ? () => setCreating(true) : undefined} />

      {current ? (
        <div className="card card-accent p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom de la checklist"><input className="input" disabled={ro} value={nom} onChange={e => setNom(e.target.value)} /></Field>
            <Field label="Description"><input className="input" disabled={ro} value={desc} onChange={e => setDesc(e.target.value)} /></Field>
          </div>
          <p className="mt-4 text-sm text-slate-400"><b>J-x</b> = nombre de jours avant le tournoi : l'échéance est calculée à partir de la date du tournoi. Laisser vide pour « sans échéance ».</p>
          <datalist id="categories-modele">{categories.map(c => <option key={c} value={c} />)}</datalist>
          <div className="mt-3 overflow-x-auto">
            <table className="table-sport">
              <thead><tr><th>Tâche</th><th className="w-40">Catégorie</th><th className="w-24">J-x</th>{!ro && <th className="w-10" />}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><input className="input" disabled={ro} value={r.libelle} onChange={e => set(i, { libelle: e.target.value })} placeholder="ex. Réserver la sono" /></td>
                    <td><input className="input" disabled={ro} list="categories-modele" value={r.categorie} onChange={e => set(i, { categorie: e.target.value })} /></td>
                    <td><input className="input" disabled={ro} type="number" min={0} value={r.jours_avant} onChange={e => set(i, { jours_avant: e.target.value })} /></td>
                    {!ro && <td><button className="btn-icon btn-ghost text-red-300" aria-label="Retirer" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!ro && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => setRows([...rows, { libelle: '', categorie: '', jours_avant: '' }])}><Plus size={16} /> Tâche</button>
              <button className="btn-primary" onClick={enregistrer} disabled={save.isPending}><Save size={16} /> Enregistrer</button>
              <button className="btn-ghost ml-auto text-red-300" onClick={async () => {
                if (!confirm(`Supprimer la checklist « ${current.nom} » ? (les tournois déjà créés gardent leurs tâches)`)) return
                try { await del.mutateAsync(current.id); setSel(''); toast('Checklist supprimée') } catch (err) { toast(errMsg(err), 'err') }
              }}><Trash2 size={16} /> Supprimer</button>
            </div>
          )}
        </div>
      ) : <EmptyState title="Aucune checklist type">{isAdmin ? 'Créez une checklist réutilisable pour vos tournois.' : 'Un administrateur doit créer une checklist type.'}</EmptyState>}

      <NouveauModele open={creating} onClose={() => setCreating(false)} placeholder="ex. Tournoi jeunes"
        onCreate={async (n, d) => {
          try { const m = await upsert.mutateAsync({ nom: n, description: d }) as ModeleChecklist; setSel(m.id); setCreating(false); toast('Checklist créée') }
          catch (err) { toast(errMsg(err), 'err') }
        }} />
    </div>
  )
}

// ---------------- Besoins stock ----------------
interface LigneEdit { produit_id: string; qte_par_joueur: string; qte_fixe: string }

function ModelesBesoins() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const modeles = useModeles()
  const lignes = useModeleLignes().data ?? []
  const produits = (useProduits().data ?? []).filter(p => p.actif)
  const upsert = useUpsert<ModeleTournoi>('modeles_tournoi', ['modeles'])
  const del = useDelete('modeles_tournoi', ['modeles', 'modele_lignes'])
  const save = useSaveModeleLignes()
  const [sel, setSel] = useState<string>('')
  const [rows, setRows] = useState<LigneEdit[]>([])
  const [nom, setNom] = useState('')
  const [desc, setDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const list = modeles.data ?? []
  useEffect(() => { if (!sel && list[0]) setSel(list[0].id) }, [list, sel])
  const current = list.find(m => m.id === sel)
  useEffect(() => {
    if (!current) return
    setNom(current.nom); setDesc(current.description)
    setRows(lignes.filter(l => l.modele_id === current.id).map(l => ({ produit_id: l.produit_id, qte_par_joueur: String(l.qte_par_joueur), qte_fixe: String(l.qte_fixe) })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, lignes.length])

  async function enregistrer() {
    if (!current) return
    try {
      await upsert.mutateAsync({ id: current.id, nom, description: desc })
      const clean = rows.filter(r => r.produit_id)
      const ids = clean.map(r => r.produit_id)
      if (new Set(ids).size !== ids.length) throw new Error('Un produit apparaît deux fois dans le modèle.')
      await save.mutateAsync({ modeleId: current.id, lignes: clean.map(r => ({ produit_id: r.produit_id, qte_par_joueur: Number(r.qte_par_joueur) || 0, qte_fixe: Number(r.qte_fixe) || 0 })) })
      toast('Modèle enregistré')
    } catch (err) { toast(errMsg(err), 'err') }
  }

  const ro = !isAdmin
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <ListeModeles list={list} sel={sel} setSel={setSel} onNew={isAdmin ? () => setCreating(true) : undefined} />

      {current ? (
        <div className="card card-accent p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom du modèle"><input className="input" disabled={ro} value={nom} onChange={e => setNom(e.target.value)} /></Field>
            <Field label="Description"><input className="input" disabled={ro} value={desc} onChange={e => setDesc(e.target.value)} /></Field>
          </div>
          <p className="mt-4 text-sm text-slate-400">Besoin = <b>quantité fixe</b> + <b>quantité par joueur</b> × nombre de joueurs (arrondi au supérieur).</p>
          <div className="mt-3 overflow-x-auto">
            <table className="table-sport">
              <thead><tr><th>Produit</th><th className="w-28">Par joueur</th><th className="w-28">Fixe</th>{!ro && <th className="w-10" />}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <select className="input" disabled={ro} value={r.produit_id} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, produit_id: e.target.value } : x))}>
                        <option value="">Choisir…</option>
                        {produits.map(p => <option key={p.id} value={p.id}>{p.designation} ({p.unite})</option>)}
                      </select>
                    </td>
                    <td><input className="input" disabled={ro} type="number" step="any" min={0} value={r.qte_par_joueur} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, qte_par_joueur: e.target.value } : x))} /></td>
                    <td><input className="input" disabled={ro} type="number" step="any" min={0} value={r.qte_fixe} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, qte_fixe: e.target.value } : x))} /></td>
                    {!ro && <td><button className="btn-icon btn-ghost text-red-300" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!ro && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => setRows([...rows, { produit_id: '', qte_par_joueur: '0', qte_fixe: '0' }])}><Plus size={16} /> Ligne</button>
              <button className="btn-primary" onClick={enregistrer} disabled={save.isPending}><Save size={16} /> Enregistrer</button>
              <button className="btn-ghost ml-auto text-red-300" onClick={async () => {
                if (!confirm(`Supprimer le modèle « ${current.nom} » ?`)) return
                try { await del.mutateAsync(current.id); setSel(''); toast('Modèle supprimé') } catch (err) { toast(errMsg(err), 'err') }
              }}><Trash2 size={16} /> Supprimer</button>
            </div>
          )}
        </div>
      ) : <EmptyState title="Aucun modèle">{isAdmin ? 'Créez un modèle de besoins pour vos tournois.' : 'Un administrateur doit créer un modèle.'}</EmptyState>}

      <NouveauModele open={creating} onClose={() => setCreating(false)} placeholder="ex. Tournoi jeunes"
        onCreate={async (n, d) => {
          try { const m = await upsert.mutateAsync({ nom: n, description: d }) as ModeleTournoi; setSel(m.id); setCreating(false); toast('Modèle créé') }
          catch (err) { toast(errMsg(err), 'err') }
        }} />
    </div>
  )
}
