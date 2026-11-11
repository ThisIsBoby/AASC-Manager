import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileUp, Plus, Search } from 'lucide-react'
import { AdminOnly } from '@/core/auth/guards'
import { errMsg } from '@/core/supabase'
import type { Adherent } from '@/core/types'
import { Badge, EmptyState, Field, Modal, PageHeader, Spinner, useToast } from '@/core/ui'
import { useUpsert } from '@/modules/stock/api'
import { useCordages, useVentes } from '@/modules/boutique/api'
import { fmtEuro, resteAPayer } from '@/modules/boutique/logic'
import { useAdherents } from '../api'
import { correspondRecherche, saisonCourante } from '../logic'

export function AdherentsPage() {
  const adherents = useAdherents()
  const ventes = useVentes().data ?? []
  const cordages = useCordages().data ?? []
  const nav = useNavigate()
  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState<'actifs' | 'anciens' | 'tous'>('actifs')
  const [edit, setEdit] = useState<Partial<Adherent> | null>(null)

  const dus = useMemo(() => resteAPayer(ventes, cordages).parAdherent, [ventes, cordages])
  const all = adherents.data ?? []
  const list = all.filter(a =>
    (filtre === 'tous' || (filtre === 'actifs') === a.actif) && correspondRecherche(a, search))
  const nbActifs = all.filter(a => a.actif).length

  return (
    <div>
      <PageHeader kicker="Club" title="Adhérents"
        actions={<AdminOnly>
          <Link to="/adherents/import" className="btn-ghost"><FileUp size={18} /> Importer un CSV</Link>
          <button className="btn-primary" onClick={() => setEdit({ actif: true, saison: saisonCourante() })}><Plus size={18} /> Ajouter</button>
        </AdminOnly>} />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Nom, prénom ou licence…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={filtre} onChange={e => setFiltre(e.target.value as typeof filtre)}>
          <option value="actifs">Saison en cours ({nbActifs})</option>
          <option value="anciens">Anciens ({all.length - nbActifs})</option>
          <option value="tous">Tous ({all.length})</option>
        </select>
      </div>

      {adherents.isLoading ? <Spinner /> : !all.length ? (
        <EmptyState title="Aucun adhérent">
          Importez la liste de la saison depuis un fichier CSV (menu <b>Importer un CSV</b>, réservé aux administrateurs).
        </EmptyState>
      ) : !list.length ? <EmptyState title="Aucun résultat" /> : (
        <div className="card overflow-x-auto">
          <table className="table-sport">
            <thead><tr><th>Adhérent</th><th className="hidden sm:table-cell">Licence</th><th className="hidden md:table-cell">Catégorie</th><th className="hidden md:table-cell">Saison</th><th className="text-right">À payer</th></tr></thead>
            <tbody>
              {list.map(a => {
                const du = dus.get(a.id) ?? 0
                return (
                  <tr key={a.id} className={`cursor-pointer hover:bg-white/5 ${!a.actif ? 'opacity-60' : ''}`} onClick={() => nav(`/adherents/${a.id}`)}>
                    <td><p className="font-semibold">{a.nom} {a.prenom}</p>{a.email && <p className="text-xs text-slate-500">{a.email}</p>}</td>
                    <td className="hidden tabular-nums text-slate-400 sm:table-cell">{a.licence ?? '—'}</td>
                    <td className="hidden text-slate-400 md:table-cell">{a.categorie || '—'}</td>
                    <td className="hidden text-slate-400 md:table-cell">{a.saison || '—'}</td>
                    <td className="text-right">{du > 0 ? <Badge tone="red">{fmtEuro(du)}</Badge> : <span className="text-slate-500">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <AdherentForm value={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

export function AdherentForm({ value, onClose }: { value: Partial<Adherent> | null; onClose: () => void }) {
  const upsert = useUpsert<Adherent>('adherents', ['adherents'])
  const toast = useToast()
  const [f, setF] = useState<Partial<Adherent>>({})
  const [prev, setPrev] = useState<Partial<Adherent> | null>(null)
  if (value !== prev) { setPrev(value); setF(value ?? {}) }
  const set = (k: keyof Adherent) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const { id, nom, prenom, licence, sexe, date_naissance, email, telephone, categorie, saison, actif } = f
      await upsert.mutateAsync({
        id, nom: (nom ?? '').trim().toUpperCase(), prenom: (prenom ?? '').trim(), licence: licence?.trim() || null,
        sexe: sexe ?? '', date_naissance: date_naissance || null, email: (email ?? '').trim(), telephone: (telephone ?? '').trim(),
        categorie: (categorie ?? '').trim(), saison: saison ?? '', actif: actif ?? true, updated_at: new Date().toISOString(),
      })
      toast(id ? 'Adhérent modifié' : 'Adhérent ajouté'); onClose()
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <Modal open={!!value} onClose={onClose} title={f.id ? "Modifier l'adhérent" : 'Nouvel adhérent'}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom"><input className="input" required value={f.nom ?? ''} onChange={set('nom')} /></Field>
          <Field label="Prénom"><input className="input" value={f.prenom ?? ''} onChange={set('prenom')} /></Field>
          <Field label="N° de licence"><input className="input" value={f.licence ?? ''} onChange={set('licence')} /></Field>
          <Field label="Date de naissance"><input className="input" type="date" value={f.date_naissance ?? ''} onChange={set('date_naissance')} /></Field>
          <Field label="Sexe">
            <select className="input" value={f.sexe ?? ''} onChange={set('sexe')}><option value="">—</option><option value="H">H</option><option value="F">F</option></select>
          </Field>
          <Field label="Catégorie"><input className="input" value={f.categorie ?? ''} onChange={set('categorie')} placeholder="ex. Senior, Minime…" /></Field>
          <Field label="E-mail"><input className="input" type="email" value={f.email ?? ''} onChange={set('email')} /></Field>
          <Field label="Téléphone"><input className="input" value={f.telephone ?? ''} onChange={set('telephone')} /></Field>
          <Field label="Saison"><input className="input" value={f.saison ?? ''} onChange={set('saison')} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.actif ?? true} onChange={e => setF({ ...f, actif: e.target.checked })} className="h-4 w-4 accent-aasc-orange" /> Adhérent de la saison en cours
        </label>
        <button className="btn-primary w-full" disabled={upsert.isPending}>Enregistrer</button>
      </form>
    </Modal>
  )
}
