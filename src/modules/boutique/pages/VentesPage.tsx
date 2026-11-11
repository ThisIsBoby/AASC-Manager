import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { EmptyState, PageHeader, Spinner, StatTile } from '@/core/ui'
import { useArticles, useVariantes, useVentes } from '../api'
import { VenteForm } from '../components/shared'
import { VentesTable } from '../components/tables'
import { fmtEuro, venteDue } from '../logic'

export function VentesPage() {
  const ventes = useVentes()
  const articles = useArticles().data ?? []
  const variantes = useVariantes().data ?? []
  const [params] = useSearchParams()
  const [paye, setPaye] = useState<'' | 'oui' | 'non'>(params.get('paye') === 'non' ? 'non' : '')
  const [article, setArticle] = useState('')
  const [depuis, setDepuis] = useState('')
  const [open, setOpen] = useState(false)

  const varsArticle = new Set(variantes.filter(v => v.article_id === article).map(v => v.id))
  const list = (ventes.data ?? []).filter(v =>
    (paye === '' || (paye === 'oui' ? v.paye : !v.paye && !v.annulee && Number(v.total) > 0)) &&
    (!article || (v.variante_id && varsArticle.has(v.variante_id))) &&
    (!depuis || v.created_at >= depuis))
  const actives = list.filter(v => !v.annulee)
  const ca = actives.reduce((s, v) => s + Number(v.total), 0)
  const du = actives.reduce((s, v) => s + venteDue(v), 0)

  return (
    <div>
      <PageHeader kicker="Boutique & Cordage" title="Ventes"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Nouvelle vente</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="input w-auto" value={paye} onChange={e => setPaye(e.target.value as typeof paye)}>
          <option value="">Payées et à payer</option>
          <option value="non">À payer</option>
          <option value="oui">Payées</option>
        </select>
        <select className="input w-auto" value={article} onChange={e => setArticle(e.target.value)}>
          <option value="">Tous les articles</option>
          {articles.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-400">Depuis
          <input type="date" className="input w-auto" value={depuis} onChange={e => setDepuis(e.target.value)} />
        </label>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatTile label="Ventes" value={actives.length} tone="blue" />
        <StatTile label="Montant" value={fmtEuro(ca)} tone="green" />
        <StatTile label="À encaisser" value={fmtEuro(du)} tone={du > 0 ? 'red' : 'green'} />
      </div>
      {ventes.isLoading ? <Spinner /> : list.length ? <VentesTable ventes={list} /> : <EmptyState title="Aucune vente" />}
      <VenteForm open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
