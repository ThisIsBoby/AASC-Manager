import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Pencil, Phone, ShoppingBag, Wrench } from 'lucide-react'
import { AdminOnly } from '@/core/auth/guards'
import { Badge, EmptyState, PageHeader, Spinner, StatTile } from '@/core/ui'
import { fmtDate } from '@/modules/stock/components/shared'
import { useCordages, useVentes } from '@/modules/boutique/api'
import { CordageForm, VenteForm } from '@/modules/boutique/components/shared'
import { CordagesTable, VentesTable } from '@/modules/boutique/components/tables'
import { fmtEuro, resteAPayer } from '@/modules/boutique/logic'
import type { Adherent } from '@/core/types'
import { useAdherents } from '../api'
import { nomComplet } from '../logic'
import { AdherentForm } from './AdherentsPage'

export function AdherentFichePage() {
  const { id } = useParams()
  const adherents = useAdherents()
  const ventes = useVentes(id).data ?? []
  const cordages = useCordages(id).data ?? []
  const [vente, setVente] = useState(false)
  const [cordage, setCordage] = useState(false)
  const [edit, setEdit] = useState<Partial<Adherent> | null>(null)

  if (adherents.isLoading) return <Spinner />
  const a = adherents.data?.find(x => x.id === id)
  if (!a) return <EmptyState title="Adhérent introuvable"><Link to="/adherents" className="text-aasc-orange-soft underline">Retour à la liste</Link></EmptyState>

  const du = resteAPayer(ventes, cordages).total
  const enCours = cordages.filter(c => c.statut !== 'rendue').length

  return (
    <div>
      <Link to="/adherents" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={14} /> Adhérents</Link>
      <PageHeader kicker={a.licence ? `Licence ${a.licence}` : 'Adhérent'} title={nomComplet(a)}
        actions={<>
          <button className="btn-primary" onClick={() => setVente(true)}><ShoppingBag size={18} /> Vente</button>
          <button className="btn-primary" onClick={() => setCordage(true)}><Wrench size={18} /> Cordage</button>
          <AdminOnly><button className="btn-ghost" onClick={() => setEdit(a)}><Pencil size={16} /> Modifier</button></AdminOnly>
        </>} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile label="Reste à payer" value={fmtEuro(du)} tone={du > 0 ? 'red' : 'green'} />
        <StatTile label="Raquettes en cours" value={enCours} tone="blue" />
        <div className="card space-y-1.5 p-4 text-sm">
          <div className="flex flex-wrap gap-1.5">
            {a.actif ? <Badge tone="green">Saison {a.saison || 'en cours'}</Badge> : <Badge>Ancien adhérent{a.saison ? ` (${a.saison})` : ''}</Badge>}
            {a.categorie && <Badge tone="blue">{a.categorie}</Badge>}
            {a.sexe && <Badge>{a.sexe}</Badge>}
          </div>
          {a.date_naissance && <p className="text-slate-400">Né(e) le {fmtDate(a.date_naissance)}</p>}
          {a.email && <a href={`mailto:${a.email}`} className="flex items-center gap-1.5 text-slate-300 hover:underline"><Mail size={14} />{a.email}</a>}
          {a.telephone && <a href={`tel:${a.telephone}`} className="flex items-center gap-1.5 text-slate-300 hover:underline"><Phone size={14} />{a.telephone}</a>}
        </div>
      </div>

      <h2 className="title-sport mb-2 text-xl">Cordages</h2>
      {cordages.length ? <CordagesTable cordages={cordages} avecAdherent={false} /> : <p className="mb-2 text-sm text-slate-400">Aucun cordage.</p>}

      <h2 className="title-sport mb-2 mt-6 text-xl">Achats</h2>
      {ventes.length ? <VentesTable ventes={ventes} avecAdherent={false} /> : <p className="text-sm text-slate-400">Aucun achat.</p>}

      <VenteForm open={vente} onClose={() => setVente(false)} adherentId={a.id} />
      <CordageForm open={cordage} onClose={() => setCordage(false)} adherentId={a.id} />
      <AdherentForm value={edit} onClose={() => setEdit(null)} />
    </div>
  )
}
