import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useAdherents } from '../api'
import { correspondRecherche, nomComplet } from '../logic'

/** Sélection d'un adhérent par recherche (nom, prénom ou licence) */
export function AdherentPicker({ value, onChange, autoFocus }: { value: string; onChange: (id: string) => void; autoFocus?: boolean }) {
  const adherents = useAdherents()
  const [search, setSearch] = useState('')
  const [focus, setFocus] = useState(0)
  const all = adherents.data ?? []
  const choisi = all.find(a => a.id === value)

  const resultats = useMemo(() => {
    if (!search.trim()) return []
    return all.filter(a => correspondRecherche(a, search))
      .sort((a, b) => Number(b.actif) - Number(a.actif))
      .slice(0, 8)
  }, [all, search])

  if (choisi) return (
    <div className="input flex items-center justify-between gap-2">
      <span className="truncate font-semibold">
        {nomComplet(choisi)}
        {choisi.licence && <span className="ml-2 text-xs font-normal text-slate-500">{choisi.licence}</span>}
        {!choisi.actif && <span className="ml-2 text-xs font-normal text-slate-500">(saison précédente)</span>}
      </span>
      <button type="button" className="btn-icon btn-ghost -mr-2" onClick={() => { onChange(''); setSearch('') }} aria-label="Changer d'adhérent"><X size={16} /></button>
    </div>
  )

  const choisir = (id: string) => { onChange(id); setSearch(''); setFocus(0) }

  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-3 text-slate-500" />
      <input className="input pl-9" placeholder={adherents.isLoading ? 'Chargement…' : all.length ? 'Nom, prénom ou n° de licence…' : 'Aucun adhérent : importez la liste'}
        value={search} autoFocus={autoFocus}
        onChange={e => { setSearch(e.target.value); setFocus(0) }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(f => Math.min(f + 1, resultats.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setFocus(f => Math.max(f - 1, 0)) }
          else if (e.key === 'Enter' && resultats[focus]) { e.preventDefault(); choisir(resultats[focus].id) }
        }} />
      {search.trim() !== '' && (
        <ul className="card absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto p-1 shadow-card">
          {resultats.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Aucun adhérent trouvé</li>}
          {resultats.map((a, i) => (
            <li key={a.id}>
              {/* preventDefault au mousedown : le champ garde le focus, le clavier mobile ne se ferme pas avant le choix */}
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => choisir(a.id)} onMouseEnter={() => setFocus(i)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${i === focus ? 'bg-aasc-orange/20' : ''} ${!a.actif ? 'opacity-60' : ''}`}>
                <span className="font-semibold">{nomComplet(a)}</span>
                <span className="text-xs text-slate-500">{a.licence ?? ''}{a.categorie ? ` · ${a.categorie}` : ''}{!a.actif ? ' · ancien' : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
