import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, MapPin, Boxes } from 'lucide-react'
import { AdminOnly } from '@/core/auth/guards'
import { errMsg } from '@/core/supabase'
import type { Caisse } from '@/core/types'
import { EmptyState, Field, Modal, PageHeader, Spinner, useToast } from '@/core/ui'
import { useCaisses, useCategories, useLots, useUpsert } from '../api'
import { CategorieTag, useRefs } from '../components/shared'
import { etatPeremption } from '../logic'

export function CaissesPage() {
  const { data: caisses, isLoading } = useCaisses()
  const lots = useLots().data ?? []
  const refs = useRefs()
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')
  const [edit, setEdit] = useState<Partial<Caisse> | null>(null)
  const categories = useCategories().data ?? []

  const stats = useMemo(() => {
    const m = new Map<string, { n: number; alerte: number }>()
    for (const l of lots) {
      const s = m.get(l.caisse_id) ?? { n: 0, alerte: 0 }
      s.n++
      if (['perime', 'bientot'].includes(etatPeremption(l.date_peremption))) s.alerte++
      m.set(l.caisse_id, s)
    }
    return m
  }, [lots])

  const list = (caisses ?? []).filter(c =>
    (!cat || c.categorie_id === cat) &&
    (!search || `${c.code} ${c.nom} ${c.emplacement} ${c.description}`.toLowerCase().includes(search.toLowerCase())))

  return (
    <div>
      <PageHeader kicker="Stock" title="Caisses"
        actions={<AdminOnly><button className="btn-primary" onClick={() => setEdit({ emplacement: 'Armoire', actif: true })}><Plus size={18} /> Nouvelle caisse</button></AdminOnly>} />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Rechercher une caisse…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>

      {isLoading ? <Spinner /> : list.length === 0 ? <EmptyState title="Aucune caisse">Créez votre première caisse pour commencer.</EmptyState> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c, i) => {
            const s = stats.get(c.id)
            const couleur = c.categorie_id ? refs.categorie.get(c.categorie_id)?.couleur : undefined
            return (
              <Link key={c.id} to={`/stock/caisse/${c.id}`} style={{ animationDelay: `${i * 30}ms` }}
                className={`card group animate-rise overflow-hidden p-4 transition hover:-translate-y-0.5 hover:border-aasc-orange hover:shadow-glow ${!c.actif ? 'opacity-50' : ''}`}>
                <div className="absolute -right-8 top-4 h-3 w-32 -rotate-[16deg] -skew-x-[24deg] rounded-full opacity-60 transition group-hover:opacity-100"
                  style={{ background: `linear-gradient(90deg,transparent,${couleur ?? '#EE7D1F'})` }} />
                <p className="font-display text-3xl font-black italic leading-none text-aasc-orange">{c.code}</p>
                <p className="mt-1 text-lg font-semibold">{c.nom}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400"><MapPin size={12} />{c.emplacement}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <CategorieTag cat={c.categorie_id ? refs.categorie.get(c.categorie_id) : null} />
                  <span className="chip bg-white/5 text-slate-300"><Boxes size={12} /> {s?.n ?? 0} élément{(s?.n ?? 0) > 1 ? 's' : ''}</span>
                  {!!s?.alerte && <span className="chip bg-red-500/20 text-red-300">⚠ {s.alerte} péremption</span>}
                  {!c.actif && <span className="chip bg-slate-500/20">Archivée</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
      <CaisseForm value={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

export function CaisseForm({ value, onClose }: { value: Partial<Caisse> | null; onClose: () => void }) {
  const categories = useCategories().data ?? []
  const upsert = useUpsert<Caisse>('caisses', ['caisses', 'caisse'])
  const toast = useToast()
  const [f, setF] = useState<Partial<Caisse>>({})
  const [prev, setPrev] = useState<Partial<Caisse> | null>(null)
  if (value !== prev) { setPrev(value); setF(value ?? {}) }

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const { id, nom, categorie_id, emplacement, description, actif } = f
      await upsert.mutateAsync({ id, nom, categorie_id: categorie_id || null, emplacement, description: description ?? '', actif: actif ?? true })
      toast(id ? 'Caisse modifiée' : 'Caisse créée'); onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open={!!value} onClose={onClose} title={f.id ? `Modifier ${f.code}` : 'Nouvelle caisse'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom"><input className="input" required value={f.nom ?? ''} onChange={e => setF({ ...f, nom: e.target.value })} placeholder="ex. Boissons fraîches" /></Field>
        <Field label="Catégorie">
          <select className="input" value={f.categorie_id ?? ''} onChange={e => setF({ ...f, categorie_id: e.target.value })}>
            <option value="">—</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Field>
        <Field label="Emplacement"><input className="input" value={f.emplacement ?? ''} onChange={e => setF({ ...f, emplacement: e.target.value })} /></Field>
        <Field label="Description"><textarea className="input" rows={2} value={f.description ?? ''} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        {f.id && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.actif ?? true} onChange={e => setF({ ...f, actif: e.target.checked })} className="h-4 w-4 accent-aasc-orange" /> Caisse active
          </label>
        )}
        {!f.id && <p className="text-xs text-slate-500">Le code (C-001, C-002…) et le QR sont générés automatiquement.</p>}
        <button className="btn-primary w-full" disabled={upsert.isPending}>Enregistrer</button>
      </form>
    </Modal>
  )
}
