import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { CalendarDays, Plus, Save, Trash2, Trophy, Users } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthProvider'
import { errMsg } from '@/core/supabase'
import type { ModeleTournoi, Tournoi } from '@/core/types'
import { Badge, EmptyState, Field, Modal, PageHeader, Spinner, useToast } from '@/core/ui'
import { useDelete, useModeleLignes, useModeles, useProduits, useSaveModeleLignes, useTournois, useUpsert } from '../api'
import { fmtDate } from '../components/shared'

export function TournoisPage() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<'prepa' | 'modeles'>('prepa')
  return (
    <div>
      <PageHeader kicker="Stock" title="Tournois" />
      <div className="mb-5 flex gap-2">
        <button className={`btn ${tab === 'prepa' ? 'bg-aasc-orange text-white' : 'btn-ghost'}`} onClick={() => setTab('prepa')}><Trophy size={16} /> Préparations</button>
        <button className={`btn ${tab === 'modeles' ? 'bg-aasc-orange text-white' : 'btn-ghost'}`} onClick={() => setTab('modeles')}>Modèles {isAdmin ? '' : '(lecture)'}</button>
      </div>
      {tab === 'prepa' ? <Preparations /> : <Modeles />}
    </div>
  )
}

function Preparations() {
  const tournois = useTournois()
  const modeles = useModeles().data ?? []
  const upsert = useUpsert<Tournoi>('tournois', ['tournois'])
  const nav = useNavigate()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ nom: '', date: format(new Date(), 'yyyy-MM-dd'), nb_joueurs: '40', modele_id: '' })

  useEffect(() => { if (!f.modele_id && modeles[0]) setF(s => ({ ...s, modele_id: modeles[0].id })) }, [modeles, f.modele_id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const t = await upsert.mutateAsync({ nom: f.nom, date: f.date || null, nb_joueurs: Number(f.nb_joueurs), modele_id: f.modele_id || null }) as Tournoi
      setOpen(false); nav(`/stock/tournois/${t.id}`)
    } catch (err) { toast(errMsg(err), 'err') }
  }

  const list = tournois.data ?? []
  return (
    <>
      <button className="btn-primary mb-4" onClick={() => setOpen(true)} disabled={!modeles.length}><Plus size={18} /> Préparer un tournoi</button>
      {!modeles.length && <p className="mb-4 text-sm text-slate-400">Créez d'abord un modèle de tournoi (onglet Modèles, admin).</p>}
      {tournois.isLoading ? <Spinner /> : !list.length ? <EmptyState title="Aucun tournoi" /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(t => (
            <Link key={t.id} to={`/stock/tournois/${t.id}`} className="card card-accent p-4 transition hover:-translate-y-0.5 hover:shadow-glow">
              <div className="flex items-start justify-between gap-2">
                <p className="title-sport text-lg leading-tight">{t.nom}</p>
                <Badge tone={t.statut === 'prepa' ? 'orange' : 'green'}>{t.statut === 'prepa' ? 'En préparation' : 'Sorti du stock'}</Badge>
              </div>
              <div className="mt-2 flex gap-4 text-sm text-slate-400">
                <span className="inline-flex items-center gap-1"><CalendarDays size={14} />{fmtDate(t.date)}</span>
                <span className="inline-flex items-center gap-1"><Users size={14} />{t.nb_joueurs} joueurs</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{modeles.find(m => m.id === t.modele_id)?.nom ?? 'Sans modèle'}</p>
            </Link>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Préparer un tournoi">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nom"><input className="input" required value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} placeholder="ex. Tournoi de Noël" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className="input" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Nb de joueurs"><input type="number" min={1} className="input" required value={f.nb_joueurs} onChange={e => setF({ ...f, nb_joueurs: e.target.value })} /></Field>
          </div>
          <Field label="Modèle de besoins">
            <select className="input" required value={f.modele_id} onChange={e => setF({ ...f, modele_id: e.target.value })}>
              {modeles.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </Field>
          <button className="btn-primary w-full" disabled={upsert.isPending}>Créer et voir les besoins</button>
        </form>
      </Modal>
    </>
  )
}

interface LigneEdit { produit_id: string; qte_par_joueur: string; qte_fixe: string }

function Modeles() {
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

  async function creer(e: FormEvent) {
    e.preventDefault()
    try { const m = await upsert.mutateAsync({ nom, description: desc }) as ModeleTournoi; setSel(m.id); setCreating(false); toast('Modèle créé') }
    catch (err) { toast(errMsg(err), 'err') }
  }

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
      <div className="space-y-2">
        {list.map(m => (
          <button key={m.id} onClick={() => setSel(m.id)}
            className={`card w-full p-3 text-left font-semibold transition ${sel === m.id ? 'border-aasc-orange shadow-glow' : 'hover:border-aasc-blue'}`}>{m.nom}</button>
        ))}
        {isAdmin && <button className="btn-ghost w-full" onClick={() => { setNom(''); setDesc(''); setCreating(true) }}><Plus size={16} /> Nouveau modèle</button>}
      </div>

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

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau modèle">
        <form onSubmit={creer} className="space-y-4">
          <Field label="Nom"><input className="input" required value={nom} onChange={e => setNom(e.target.value)} placeholder="ex. Tournoi jeunes" /></Field>
          <Field label="Description"><input className="input" value={desc} onChange={e => setDesc(e.target.value)} /></Field>
          <button className="btn-primary w-full">Créer</button>
        </form>
      </Modal>
    </div>
  )
}
