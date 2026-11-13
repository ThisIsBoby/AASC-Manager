import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Send } from 'lucide-react'
import { EmptyState, PageHeader, Spinner, StatTile } from '@/core/ui'
import { useProduits } from '@/modules/stock/api'
import { cleGroupe, grouperProduits } from '@/modules/stock/logic'
import { useCordages, useVentes } from '../api'
import { VenteForm } from '../components/shared'
import { ImpayesParAdherentTable, RelanceGlobaleModal } from '../components/relances'
import { CordagesTable, VentesTable } from '../components/tables'
import { cordageDu, fmtEuro, impayesParAdherent, venteDue } from '../logic'

export function VentesPage() {
  const ventes = useVentes()
  const cordages = useCordages()
  const produitsList = useProduits().data
  // Filtre « article » : tous les produits ayant déjà un prix de vente (tailles regroupées)
  const produits = useMemo(() => new Map((produitsList ?? []).map(p => [p.id, p])), [produitsList])
  const articles = useMemo(() => grouperProduits((produitsList ?? []).filter(p => p.prix_vente != null)), [produitsList])
  const [params] = useSearchParams()
  const [paye, setPaye] = useState<'' | 'oui' | 'non'>(params.get('paye') === 'non' ? 'non' : '')
  const [article, setArticle] = useState('')
  const [depuis, setDepuis] = useState('')
  const [open, setOpen] = useState(false)
  const [relanceOpen, setRelanceOpen] = useState(false)

  const cleVente = (produitId: string | null) => { const p = produitId ? produits.get(produitId) : undefined; return p ? cleGroupe(p) : '' }
  const list = (ventes.data ?? []).filter(v =>
    (paye === '' || (paye === 'oui' ? v.paye : !v.paye && !v.annulee && Number(v.total) > 0)) &&
    (!article || cleVente(v.produit_id) === article) &&
    (!depuis || v.created_at >= depuis))
  const actives = list.filter(v => !v.annulee)
  const ca = actives.reduce((s, v) => s + Number(v.total), 0)
  // Cordages restant à payer : affichés ici pour que « À encaisser » corresponde aux impayés de l'accueil
  const cordagesDus = paye === 'oui' || article ? [] : (cordages.data ?? []).filter(c =>
    cordageDu(c) > 0 && (!depuis || c.created_at >= depuis))
  const duCordages = cordagesDus.reduce((s, c) => s + cordageDu(c), 0)
  const du = actives.reduce((s, v) => s + venteDue(v), 0) + duCordages
  // « À payer » : regroupé par adhérent (une relance = un e-mail)
  const groupes = paye === 'non' ? impayesParAdherent(list, cordagesDus) : []
  // Relance globale : tous les impayés, indépendamment des filtres
  const tousImpayes = useMemo(() => impayesParAdherent(ventes.data ?? [], cordages.data ?? []), [ventes.data, cordages.data])

  return (
    <div>
      <PageHeader kicker="Boutique & Cordage" title="Ventes"
        actions={<>
          {tousImpayes.length > 0 && <button className="btn-ghost" onClick={() => setRelanceOpen(true)}><Send size={16} /> Relancer les impayés</button>}
          <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Nouvelle vente</button>
        </>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="input w-auto" value={paye} onChange={e => setPaye(e.target.value as typeof paye)}>
          <option value="">Payées et à payer</option>
          <option value="non">À payer</option>
          <option value="oui">Payées</option>
        </select>
        <select className="input w-auto" value={article} onChange={e => setArticle(e.target.value)}>
          <option value="">Tous les articles</option>
          {articles.map(a => <option key={a.cle} value={a.cle}>{a.nom}</option>)}
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
      {ventes.isLoading ? <Spinner /> : paye === 'non'
        ? groupes.length ? <ImpayesParAdherentTable groupes={groupes} /> : <EmptyState title="Aucun impayé" />
        : list.length ? <VentesTable ventes={list} /> : <EmptyState title="Aucune vente" />}
      {paye !== 'non' && cordagesDus.length > 0 && (
        <section className="mt-6">
          <h2 className="title-sport mb-2 text-xl">Cordages à payer <span className="text-sm font-normal text-slate-400">({fmtEuro(duCordages)})</span></h2>
          <CordagesTable cordages={cordagesDus} />
        </section>
      )}
      <VenteForm open={open} onClose={() => setOpen(false)} />
      <RelanceGlobaleModal open={relanceOpen} onClose={() => setRelanceOpen(false)} groupes={tousImpayes} />
    </div>
  )
}
