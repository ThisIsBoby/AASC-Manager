import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ClipboardCheck, Plus } from 'lucide-react'
import { AdminOnly } from '@/core/auth/guards'
import { errMsg } from '@/core/supabase'
import type { InventaireCaisse } from '@/core/types'
import { Badge, EmptyState, Field, Modal, PageHeader, Spinner, useToast } from '@/core/ui'
import { useCaisses, useCreerInventaire, useInventaireCaisses, useInventaires } from '../api'
import { Avancement } from '../components/inventaire'
import { fmtDate } from '../components/shared'

export function InventairesPage() {
  const { data: inventaires, isLoading } = useInventaires()
  const caisses = useInventaireCaisses().data ?? []
  const [creer, setCreer] = useState(false)

  const parInventaire = useMemo(() => {
    const m = new Map<string, InventaireCaisse[]>()
    for (const c of caisses) m.set(c.inventaire_id, [...(m.get(c.inventaire_id) ?? []), c])
    return m
  }, [caisses])

  return (
    <div>
      <PageHeader kicker="Stock" title="Inventaires"
        actions={<AdminOnly><button className="btn-primary" onClick={() => setCreer(true)}><Plus size={18} /> Nouvel inventaire</button></AdminOnly>} />

      <p className="-mt-3 mb-5 max-w-2xl text-sm text-slate-400">
        Ouvrez un inventaire, scannez chaque caisse et comptez ce qu'elle contient. Un administrateur valide ensuite chaque caisse :
        les écarts sont appliqués au stock et restent consultables dans le rapport.
      </p>

      {isLoading ? <Spinner /> : !inventaires?.length ? (
        <EmptyState title="Aucun inventaire">Un administrateur peut ouvrir le premier inventaire.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {inventaires.map((inv, i) => {
            const cs = parInventaire.get(inv.id) ?? []
            const valides = cs.filter(c => c.statut === 'valide').length
            const faites = valides + cs.filter(c => c.statut === 'compte').length
            return (
              <Link key={inv.id} to={`/stock/inventaire/${inv.id}`} style={{ animationDelay: `${i * 30}ms` }}
                className="card animate-rise p-4 transition hover:-translate-y-0.5 hover:border-aasc-orange hover:shadow-glow">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold leading-tight">{inv.nom}</p>
                    <p className="mt-0.5 text-xs text-slate-400">Ouvert le {fmtDate(inv.created_at)}{inv.cloture_le ? ` · clôturé le ${fmtDate(inv.cloture_le)}` : ''}</p>
                  </div>
                  {inv.statut === 'en_cours' ? <Badge tone="orange">En cours</Badge> : <Badge tone="green">Clôturé</Badge>}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Avancement faites={faites} valides={valides} total={cs.length} />
                  <span className="shrink-0 text-sm tabular-nums text-slate-300">{faites}/{cs.length} caisses</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <NouvelInventaire open={creer} onClose={() => setCreer(false)} />
    </div>
  )
}

function NouvelInventaire({ open, onClose }: { open: boolean; onClose: () => void }) {
  const caisses = (useCaisses().data ?? []).filter(c => c.actif)
  const creer = useCreerInventaire()
  const toast = useToast()
  const nav = useNavigate()
  const [nom, setNom] = useState(() => `Inventaire ${format(new Date(), 'MMMM yyyy', { locale: fr })}`)
  const [toutes, setToutes] = useState(true)
  const [choix, setChoix] = useState<Set<string>>(new Set())

  const toggle = (id: string) => setChoix(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!toutes && !choix.size) { toast('Choisissez au moins une caisse', 'err'); return }
    try {
      const id = await creer.mutateAsync({ nom, caisses: toutes ? null : [...choix] })
      toast('Inventaire ouvert')
      onClose()
      nav(`/stock/inventaire/${id}`)
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouvel inventaire">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom"><input className="input" required value={nom} onChange={e => setNom(e.target.value)} /></Field>
        <Field label="Caisses à inventorier" group>
          <div className="flex gap-2">
            <button type="button" className={`flex-1 ${toutes ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setToutes(true)}>Toutes ({caisses.length})</button>
            <button type="button" className={`flex-1 ${!toutes ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setToutes(false)}>Sélection</button>
          </div>
        </Field>
        {!toutes && (
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-aasc-line/60 p-2">
            {caisses.map(c => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
                  <input type="checkbox" className="h-4 w-4 accent-aasc-orange" checked={choix.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="font-semibold text-aasc-orange">{c.code}</span><span className="truncate">{c.nom}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">Une caisse scannée pendant l'inventaire y est ajoutée automatiquement si elle n'était pas prévue.</p>
        <button className="btn-primary w-full" disabled={creer.isPending}><ClipboardCheck size={16} /> Ouvrir l'inventaire</button>
      </form>
    </Modal>
  )
}
