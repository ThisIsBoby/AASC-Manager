import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { CalendarDays, ClipboardCheck, Plus, Users } from 'lucide-react'
import { errMsg } from '@/core/supabase'
import type { Tournoi, TypeTournoi } from '@/core/types'
import { Badge, EmptyState, Field, Modal, PageHeader, Spinner, useToast } from '@/core/ui'
import { useModeles, useTournois, useUpsert } from '@/modules/stock/api'
import { fmtDate } from '@/modules/stock/components/shared'
import { useAppliquerModeleChecklist, useModelesChecklist, useTournoiTaches } from '../api'
import { avecArticle, compteARebours, couleurType, libelleParticipants, libelleType, plurielType, progression, TYPES_TOURNOI } from '../logic'

export function TournoisListePage() {
  const tournois = useTournois()
  const taches = useTournoiTaches().data ?? []
  const [open, setOpen] = useState(false)
  const [filtre, setFiltre] = useState<'' | TypeTournoi>('')

  const tous = tournois.data ?? []
  const list = filtre ? tous.filter(t => (t.type ?? 'tournoi') === filtre) : tous
  return (
    <div>
      <PageHeader kicker="Organisation" title="Événements"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Nouveau</button>} />
      {tous.some(t => (t.type ?? 'tournoi') !== 'tournoi') && (
        <div className="mb-4 flex gap-2">
          {[['', 'Tous'] as const, ...TYPES_TOURNOI.map(v => [v, plurielType(v)] as const)].map(([v, l]) => (
            <button key={v} className={`btn ${filtre === v ? 'bg-aasc-orange text-white' : 'btn-ghost'}`} onClick={() => setFiltre(v)}>{l}</button>
          ))}
        </div>
      )}
      {tournois.isLoading ? <Spinner /> : !list.length ? <EmptyState title="Aucun événement">Créez un tournoi, un interclub ou un événement pour préparer sa checklist et ses achats.</EmptyState> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(t => {
            const p = progression(taches.filter(x => x.tournoi_id === t.id))
            const rebours = compteARebours(t.date)
            return (
              <Link key={t.id} to={`/tournois/${t.id}`} className="card card-accent p-4 transition hover:-translate-y-0.5 hover:shadow-glow">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {(t.type ?? 'tournoi') !== 'tournoi' && <Badge tone={couleurType(t.type)}>{libelleType(t.type)}</Badge>}
                    <p className="title-sport text-lg leading-tight">{t.nom}</p>
                  </div>
                  {rebours && <Badge tone={rebours === 'Passé' ? 'slate' : 'blue'}>{rebours}</Badge>}
                </div>
                <div className="mt-2 flex gap-4 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-1"><CalendarDays size={14} />{fmtDate(t.date)}</span>
                  <span className="inline-flex items-center gap-1"><Users size={14} />{libelleParticipants(t.type, t.nb_joueurs)}</span>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1"><ClipboardCheck size={12} />{p.total ? `${p.faites}/${p.total} tâches` : 'Pas de checklist'}</span>
                    {p.retard > 0 && <span className="font-semibold text-red-300">{p.retard} en retard</span>}
                  </div>
                  {p.total > 0 && (
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full -skew-x-[24deg] rounded-full ${p.pct === 100 ? 'bg-emerald-500' : p.retard ? 'bg-red-500' : 'bg-aasc-orange'}`} style={{ width: `${Math.max(p.pct, 3)}%` }} />
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">{t.statut === 'prepa' ? 'Stock : en préparation' : 'Stock : besoins sortis'}</p>
              </Link>
            )
          })}
        </div>
      )}
      <NouveauTournoi open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

function NouveauTournoi({ open, onClose }: { open: boolean; onClose: () => void }) {
  const modeles = useModeles().data ?? []
  const checklists = useModelesChecklist().data ?? []
  const upsert = useUpsert<Tournoi>('tournois', ['tournois'])
  const appliquer = useAppliquerModeleChecklist()
  const nav = useNavigate()
  const toast = useToast()
  const [f, setF] = useState({ type: 'tournoi' as TypeTournoi, nom: '', date: format(new Date(), 'yyyy-MM-dd'), nb_joueurs: '40', modele_id: '', checklist_id: '' })
  const [init, setInit] = useState(false)

  // Pré-sélectionne le premier modèle de chaque type, une seule fois
  useEffect(() => {
    if (init || (!modeles.length && !checklists.length)) return
    setF(s => ({ ...s, modele_id: modeles[0]?.id ?? '', checklist_id: checklists[0]?.id ?? '' }))
    setInit(true)
  }, [modeles, checklists, init])

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const t = await upsert.mutateAsync({ type: f.type, nom: f.nom.trim(), date: f.date || null, nb_joueurs: Number(f.nb_joueurs), modele_id: f.modele_id || null }) as Tournoi
      if (f.checklist_id) {
        try { await appliquer.mutateAsync({ tournoi: t.id, modele: f.checklist_id }) }
        catch (err) { toast(`Tournoi créé, mais la checklist n'a pas pu être copiée : ${errMsg(err)}`, 'err') }
      }
      onClose(); nav(`/tournois/${t.id}`)
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouvel événement">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Type" hint={f.type === 'interclub' ? 'Rencontre reçue au club : comptez toutes les personnes présentes le soir (deux équipes).' : f.type === 'evenement' ? 'Soirée, repas, fête du club… : comptez toutes les personnes attendues.' : undefined}>
          <select className="input" value={f.type} onChange={e => setF({ ...f, type: e.target.value as TypeTournoi })}>
            <option value="tournoi">Tournoi</option>
            <option value="interclub">Interclub (à domicile)</option>
            <option value="evenement">Événement interne</option>
          </select>
        </Field>
        <Field label="Nom"><input className="input" required value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} placeholder={f.type === 'interclub' ? 'ex. Interclub J3 vs Club XYZ' : f.type === 'evenement' ? 'ex. Soirée Halloween' : 'ex. Tournoi de Noël'} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input type="date" className="input" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
          <Field label={f.type === 'tournoi' ? 'Nb de joueurs' : 'Nb de personnes'}><input type="number" min={1} className="input" required value={f.nb_joueurs} onChange={e => setF({ ...f, nb_joueurs: e.target.value })} /></Field>
        </div>
        <Field label="Checklist type" hint="Les tâches sont copiées dans le tournoi ; échéances calculées depuis la date (J-x).">
          <select className="input" value={f.checklist_id} onChange={e => setF({ ...f, checklist_id: e.target.value })}>
            <option value="">Aucune (checklist vide)</option>
            {checklists.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </Field>
        <Field label="Modèle de besoins stock">
          <select className="input" value={f.modele_id} onChange={e => setF({ ...f, modele_id: e.target.value })}>
            <option value="">Aucun</option>
            {modeles.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </Field>
        <button className="btn-primary w-full" disabled={upsert.isPending || appliquer.isPending}>Créer {avecArticle(f.type)}</button>
      </form>
    </Modal>
  )
}
