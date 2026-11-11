import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { StatutCordage } from '@/core/types'
import { EmptyState, PageHeader, Spinner } from '@/core/ui'
import { useCordages } from '../api'
import { CordageForm } from '../components/shared'
import { CordagesTable } from '../components/tables'
import { STATUTS } from '../logic'

export function CordagesPage() {
  const cordages = useCordages()
  const [statut, setStatut] = useState<StatutCordage | 'en_cours' | ''>('en_cours')
  const [paye, setPaye] = useState<'' | 'oui' | 'non'>('')
  const [open, setOpen] = useState(false)

  const all = cordages.data ?? []
  const list = all.filter(c =>
    (statut === '' || (statut === 'en_cours' ? c.statut !== 'rendue' : c.statut === statut)) &&
    (paye === '' || (paye === 'oui' ? c.paye || Number(c.prix) === 0 : !c.paye && Number(c.prix) > 0)))

  return (
    <div>
      <PageHeader kicker="Boutique & Cordage" title="Cordages"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Nouveau cordage</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="input w-auto" value={statut} onChange={e => setStatut(e.target.value as typeof statut)}>
          <option value="en_cours">En cours (déposées + cordées)</option>
          {STATUTS.map(s => <option key={s.v} value={s.v}>{s.label}s</option>)}
          <option value="">Toutes</option>
        </select>
        <select className="input w-auto" value={paye} onChange={e => setPaye(e.target.value as typeof paye)}>
          <option value="">Payées et à payer</option>
          <option value="non">À payer</option>
          <option value="oui">Payées / offertes</option>
        </select>
      </div>
      {cordages.isLoading ? <Spinner /> : list.length ? <CordagesTable cordages={list} /> : <EmptyState title="Aucun cordage" />}
      <CordageForm open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
