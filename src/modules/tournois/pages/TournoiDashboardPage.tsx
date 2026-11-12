import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CalendarClock, ClipboardCheck, ListChecks, Package, Pencil, Printer, Trash2 } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthProvider'
import { errMsg } from '@/core/supabase'
import type { Tournoi, TypeTournoi } from '@/core/types'
import { Badge, EmptyState, Field, Modal, PageHeader, Spinner, StatTile, useToast } from '@/core/ui'
import { useDelete, useTournois, useUpsert } from '@/modules/stock/api'
import { fmtDate } from '@/modules/stock/components/shared'
import { useTournoiTaches } from '../api'
import { BesoinsStock } from '../components/BesoinsStock'
import { Checklist } from '../components/Checklist'
import { avecArticle, compteARebours, libelleType, progression, TYPES_TOURNOI } from '../logic'

export function TournoiDashboardPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { isAdmin } = useAuth()
  const tournois = useTournois()
  const t = tournois.data?.find(x => x.id === id)
  const toutes = useTournoiTaches()
  const del = useDelete('tournois', ['tournois', 'tournoi_taches'])
  const [onglet, setOnglet] = useState<'checklist' | 'stock'>('checklist')
  const [edition, setEdition] = useState(false)

  if (tournois.isLoading) return <Spinner />
  if (!t) return <EmptyState title="Événement introuvable"><Link to="/tournois" className="text-aasc-orange">Retour</Link></EmptyState>

  const taches = (toutes.data ?? []).filter(x => x.tournoi_id === t.id)
  const p = progression(taches)
  const rebours = compteARebours(t.date)

  return (
    <div>
      <Link to="/tournois" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Événements</Link>
      <PageHeader kicker={`${libelleType(t.type)} · ${fmtDate(t.date)}${rebours ? ` · ${rebours}` : ''}`} title={t.nom}
        actions={<>
          <button className="btn-ghost" onClick={() => setEdition(true)}><Pencil size={16} /> Modifier</button>
          <button className="btn-ghost" onClick={() => window.print()}><Printer size={16} /> Imprimer</button>
          {isAdmin && <button className="btn-ghost text-red-300" aria-label={`Supprimer ${avecArticle(t.type)}`} onClick={async () => {
            if (!confirm(`Supprimer ${avecArticle(t.type)} et sa checklist ? (les mouvements de stock déjà faits sont conservés)`)) return
            try { await del.mutateAsync(t.id); nav('/tournois') } catch (e) { toast(errMsg(e), 'err') }
          }}><Trash2 size={16} /></button>}
        </>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card card-accent col-span-2 p-4 lg:col-span-1">
          <p className="label flex items-center gap-1"><ClipboardCheck size={12} /> Checklist</p>
          <p className="font-display text-4xl font-black italic leading-none tabular-nums">{p.pct}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full -skew-x-[24deg] rounded-full ${p.pct === 100 ? 'bg-emerald-500' : 'bg-aasc-orange'}`} style={{ width: `${Math.max(p.pct, 3)}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-400">{p.faites}/{p.total} tâches faites</p>
        </div>
        <StatTile label="En retard" value={p.retard} tone={p.retard ? 'red' : 'green'} icon={<AlertTriangle size={14} />} />
        <StatTile label="À faire sous 7 jours" value={p.semaine} tone={p.semaine ? 'orange' : 'green'} icon={<CalendarClock size={14} />} />
        <StatTile label="Compte à rebours" value={rebours ?? '—'} tone="blue" />
      </div>

      <div className="no-print mb-5 flex gap-2">
        <button className={`btn ${onglet === 'checklist' ? 'bg-aasc-orange text-white' : 'btn-ghost'}`} onClick={() => setOnglet('checklist')}><ListChecks size={16} /> Checklist</button>
        <button className={`btn ${onglet === 'stock' ? 'bg-aasc-orange text-white' : 'btn-ghost'}`} onClick={() => setOnglet('stock')}>
          <Package size={16} /> Besoins stock {t.statut === 'termine' && <Badge tone="green">sorti</Badge>}
        </button>
      </div>

      {onglet === 'checklist'
        ? (toutes.isLoading ? <Spinner /> : <Checklist t={t} taches={taches} />)
        : <BesoinsStock t={t} />}

      {edition && <EditTournoi t={t} onClose={() => setEdition(false)} />}
    </div>
  )
}

function EditTournoi({ t, onClose }: { t: Tournoi; onClose: () => void }) {
  const toast = useToast()
  const upsert = useUpsert<Tournoi>('tournois', ['tournois'])
  const [nom, setNom] = useState(t.nom)
  const [date, setDate] = useState(t.date ?? '')
  const [type, setType] = useState<TypeTournoi>(t.type ?? 'tournoi')

  return (
    <Modal open onClose={onClose} title={`Modifier ${avecArticle(t.type)}`}>
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault()
        try { await upsert.mutateAsync({ id: t.id, type, nom: nom.trim(), date: date || null }); onClose() } catch (err) { toast(errMsg(err), 'err') }
      }}>
        <Field label="Type">
          <select className="input" value={type} onChange={e => setType(e.target.value as TypeTournoi)}>
            {TYPES_TOURNOI.map(v => <option key={v} value={v}>{libelleType(v)}</option>)}
          </select>
        </Field>
        <Field label="Nom"><input className="input" required value={nom} onChange={e => setNom(e.target.value)} /></Field>
        <Field label="Date" hint="Les échéances déjà fixées sur les tâches ne sont pas recalculées."><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <button className="btn-primary w-full" disabled={upsert.isPending}>Enregistrer</button>
      </form>
    </Modal>
  )
}
