import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckSquare, Printer, Square } from 'lucide-react'
import { EmptyState, PageHeader, Spinner } from '@/core/ui'
import { useCaisses } from '../api'
import { EtiquetteCaisse, useRefs } from '../components/shared'

export function EtiquettesPage() {
  const [sp] = useSearchParams()
  const { data, isLoading } = useCaisses()
  const refs = useRefs()
  const caisses = (data ?? []).filter(c => c.actif)
  const initial = sp.get('ids')?.split(',').filter(Boolean)
  const [sel, setSel] = useState<Set<string> | null>(initial ? new Set(initial) : null)
  const selected = sel ?? new Set(caisses.map(c => c.id))
  const toggle = (id: string) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSel(n) }
  const list = caisses.filter(c => selected.has(c.id))

  return (
    <div>
      <PageHeader kicker="Stock" title="Étiquettes QR"
        actions={<button className="btn-primary" disabled={!list.length} onClick={() => window.print()}><Printer size={16} /> Imprimer ({list.length})</button>} />

      {isLoading ? <Spinner /> : !caisses.length ? <EmptyState title="Aucune caisse" /> : <>
        <div className="no-print mb-5 card p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => setSel(new Set(caisses.map(c => c.id)))}>Tout sélectionner</button>
            <button className="btn-ghost" onClick={() => setSel(new Set())}>Tout désélectionner</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {caisses.map(c => (
              <button key={c.id} onClick={() => toggle(c.id)}
                className={`chip border px-3 py-1.5 text-sm ${selected.has(c.id) ? 'border-aasc-orange bg-aasc-orange/20 text-white' : 'border-aasc-line text-slate-400'}`}>
                {selected.has(c.id) ? <CheckSquare size={14} /> : <Square size={14} />} {c.code} · {c.nom}
              </button>
            ))}
          </div>
        </div>
        <p className="no-print mb-3 text-sm text-slate-400">Aperçu (format A4, 2 étiquettes par ligne). Astuce : imprimez sur papier autocollant ou plastifiez les étiquettes.</p>
        <div className="etiquettes-grid grid gap-4 sm:grid-cols-2">
          {list.map(c => <EtiquetteCaisse key={c.id} caisse={c} cat={c.categorie_id ? refs.categorie.get(c.categorie_id) : null} />)}
        </div>
      </>}
    </div>
  )
}
