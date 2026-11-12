import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCheck, ChevronRight, Lock, Printer, ScanLine, Trash2 } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthProvider'
import { errMsg } from '@/core/supabase'
import type { InventaireCaisse, InventaireLigne } from '@/core/types'
import { Badge, EmptyState, PageHeader, Spinner, StatTile, fmtQ, useToast } from '@/core/ui'
import { useCloturerInventaire, useDelete, useInventaire, useInventaireCaisses, useInventaireLignes, useValiderComptage } from '../api'
import { Avancement, Ecart, EtatEcartBadge, StatutCaisseBadge } from '../components/inventaire'
import { fmtDate, useRefs } from '../components/shared'
import { ecartLigne, estEcart, resumeInventaire } from '../logic'

type Onglet = 'caisses' | 'ecarts'

export function InventaireDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data: inv, isLoading } = useInventaire(id)
  const caissesInv = useInventaireCaisses(id)
  const lignes = useInventaireLignes(id).data ?? []
  const refs = useRefs()
  const { isAdmin } = useAuth()
  const toast = useToast()
  const valider = useValiderComptage()
  const cloturer = useCloturerInventaire()
  const supprimer = useDelete('inventaires', ['inventaires'])
  const [onglet, setOnglet] = useState<Onglet>('caisses')
  const [ecartsSeuls, setEcartsSeuls] = useState(true)

  const cs = useMemo(() => [...(caissesInv.data ?? [])].sort((a, b) =>
    (refs.caisse.get(a.caisse_id)?.code ?? '').localeCompare(refs.caisse.get(b.caisse_id)?.code ?? '')), [caissesInv.data, refs])
  const resume = useMemo(() => resumeInventaire(cs, lignes), [cs, lignes])
  const lignesParCaisse = useMemo(() => {
    const m = new Map<string, InventaireLigne[]>()
    for (const l of lignes) m.set(l.inventaire_caisse_id, [...(m.get(l.inventaire_caisse_id) ?? []), l])
    return m
  }, [lignes])

  if (isLoading || caissesInv.isLoading) return <Spinner />
  if (!inv) return <EmptyState title="Inventaire introuvable"><Link className="text-aasc-orange" to="/stock/inventaires">Retour aux inventaires</Link></EmptyState>

  const ouvert = inv.statut === 'en_cours'
  const nbEcarts = (icId: string) => (lignesParCaisse.get(icId) ?? []).filter(l => estEcart(ecartLigne(l).etat)).length

  async function validerCaisse(ic: InventaireCaisse) {
    const c = refs.caisse.get(ic.caisse_id)
    const n = nbEcarts(ic.id)
    if (!confirm(`Valider ${c?.code ?? 'la caisse'} ? ${n ? `Écarts à appliquer au stock : ${n}.` : 'Aucun écart.'}`)) return
    try {
      const nb = await valider.mutateAsync(ic.id)
      toast(nb ? `${c?.code} validée · ${nb} ajustement${nb > 1 ? 's' : ''}` : `${c?.code} validée · stock conforme`)
    } catch (e) { toast(errMsg(e), 'err') }
  }

  async function validerTout() {
    const aValider = cs.filter(c => c.statut === 'compte')
    if (!confirm(`Valider les ${aValider.length} caisses comptées et appliquer leurs écarts au stock ?`)) return
    for (const ic of aValider) {
      try { await valider.mutateAsync(ic.id) } catch (e) { toast(`${refs.caisse.get(ic.caisse_id)?.code} : ${errMsg(e)}`, 'err'); return }
    }
    toast(`${aValider.length} caisse${aValider.length > 1 ? 's' : ''} validée${aValider.length > 1 ? 's' : ''}`)
  }

  async function clore() {
    const restantes = resume.total - resume.valides
    const msg = restantes
      ? `${restantes} caisse${restantes > 1 ? 's ne sont pas validées' : ' n\'est pas validée'} : ${restantes > 1 ? 'leurs' : 'ses'} comptages ne seront pas appliqués au stock. Clôturer quand même ?`
      : 'Clôturer cet inventaire ?'
    if (!confirm(msg)) return
    try { await cloturer.mutateAsync(inv!.id); toast('Inventaire clôturé') } catch (e) { toast(errMsg(e), 'err') }
  }

  async function effacer() {
    if (!confirm('Supprimer cet inventaire et ses comptages ? Les ajustements déjà appliqués au stock sont conservés dans l\'historique.')) return
    try { await supprimer.mutateAsync(inv!.id); toast('Inventaire supprimé'); nav('/stock/inventaires') } catch (e) { toast(errMsg(e), 'err') }
  }

  return (
    <div>
      <Link to="/stock/inventaires" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Inventaires</Link>
      <PageHeader kicker={ouvert ? 'Inventaire en cours' : `Inventaire clôturé le ${fmtDate(inv.cloture_le)}`} title={inv.nom}
        actions={<div className="no-print flex flex-wrap gap-2">
          {isAdmin && ouvert && <button className="btn-ghost" onClick={clore} disabled={cloturer.isPending}><Lock size={16} /> Clôturer</button>}
          {isAdmin && <button className="btn-icon btn-ghost text-red-300" title="Supprimer l'inventaire" onClick={effacer}><Trash2 size={16} /></button>}
        </div>} />

      <div className="no-print mb-4 flex items-center gap-3">
        <Avancement faites={resume.faites} valides={resume.valides} total={resume.total} />
        <span className="shrink-0 text-sm tabular-nums text-slate-300">{resume.faites}/{resume.total} caisses comptées</span>
      </div>

      {ouvert && (
        <Link to={`/stock/scanner?inventaire=${inv.id}`} className="btn-primary no-print mb-5 w-full py-3 text-base sm:w-auto">
          <ScanLine size={18} /> Scanner une caisse
        </Link>
      )}

      <div className="no-print mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="À compter" value={resume.aFaire + resume.enCours} tone="orange" />
        <StatTile label="À valider" value={resume.aValider} tone="blue" />
        <StatTile label="Validées" value={resume.valides} tone="green" />
        <StatTile label="Lignes en écart" value={resume.lignesEnEcart} tone={resume.lignesEnEcart ? 'red' : 'green'} onClick={() => setOnglet('ecarts')} />
      </div>

      <div className="no-print mb-4 flex gap-2">
        <button className={onglet === 'caisses' ? 'btn-primary' : 'btn-ghost'} onClick={() => setOnglet('caisses')}>Caisses</button>
        <button className={onglet === 'ecarts' ? 'btn-primary' : 'btn-ghost'} onClick={() => setOnglet('ecarts')}>Écarts</button>
      </div>

      {onglet === 'caisses' ? (
        <>
          {isAdmin && ouvert && resume.aValider > 1 && (
            <button className="btn-secondary mb-3" onClick={validerTout} disabled={valider.isPending}><CheckCheck size={16} /> Valider les {resume.aValider} caisses comptées</button>
          )}
          {!cs.length ? <EmptyState title="Aucune caisse">Scannez une caisse pour l'ajouter à l'inventaire.</EmptyState> : (
            <ul className="space-y-2">
              {cs.map(ic => {
                const c = refs.caisse.get(ic.caisse_id)
                const n = nbEcarts(ic.id)
                return (
                  <li key={ic.id} className="card flex items-center gap-3 p-3">
                    <Link to={`/stock/inventaire/${inv.id}/caisse/${ic.caisse_id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="font-display text-2xl font-black italic text-aasc-orange">{c?.code ?? '…'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{c?.nom}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <StatutCaisseBadge statut={ic.statut} />
                          {ic.statut !== 'a_faire' && (n ? <Badge tone="red">{n} écart{n > 1 ? 's' : ''}</Badge> : ic.statut !== 'en_cours' && <Badge tone="green">Conforme</Badge>)}
                          {ic.compte_par && <span className="text-xs text-slate-500">par {refs.membre.get(ic.compte_par)?.nom ?? '…'}</span>}
                        </span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-slate-500" />
                    </Link>
                    {isAdmin && ouvert && ic.statut === 'compte' && (
                      <button className="btn-secondary shrink-0" onClick={() => validerCaisse(ic)} disabled={valider.isPending}>Valider</button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      ) : (
        <RapportEcarts
          caisses={cs} lignesParCaisse={lignesParCaisse} ecartsSeuls={ecartsSeuls} setEcartsSeuls={setEcartsSeuls}
          parProduit={resume.parProduit} titre={inv.nom} />
      )}
    </div>
  )
}

function RapportEcarts({ caisses, lignesParCaisse, ecartsSeuls, setEcartsSeuls, parProduit, titre }: {
  caisses: InventaireCaisse[]
  lignesParCaisse: Map<string, InventaireLigne[]>
  ecartsSeuls: boolean
  setEcartsSeuls: (v: boolean) => void
  parProduit: ReturnType<typeof resumeInventaire>['parProduit']
  titre: string
}) {
  const refs = useRefs()
  const produits = ecartsSeuls ? parProduit.filter(p => p.ecart !== 0) : parProduit
  const nonFaites = caisses.filter(c => c.statut === 'a_faire' || c.statut === 'en_cours')

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" className="h-4 w-4 accent-aasc-orange" checked={ecartsSeuls} onChange={e => setEcartsSeuls(e.target.checked)} />
          Écarts seulement
        </label>
        <button className="btn-ghost ml-auto" onClick={() => window.print()}><Printer size={16} /> Imprimer</button>
      </div>
      <h2 className="print-only mb-2 text-xl font-bold">Rapport d'écarts · {titre}</h2>

      <section className="mb-6">
        <h3 className="title-sport mb-2 text-lg">Par produit</h3>
        {!produits.length ? <p className="text-sm text-slate-400">Aucun écart sur les caisses comptées.</p> : (
          <div className="card overflow-x-auto">
            <table className="table-sport">
              <thead><tr><th>Produit</th><th className="text-right">Attendu</th><th className="text-right">Compté</th><th className="text-right">Écart</th></tr></thead>
              <tbody>
                {produits.map(p => {
                  const prod = refs.produit.get(p.produitId)
                  return (
                    <tr key={p.produitId}>
                      <td className="font-semibold">{prod?.designation ?? '…'}</td>
                      <td className="text-right tabular-nums text-slate-400">{fmtQ(p.reference)}</td>
                      <td className="text-right tabular-nums">{fmtQ(p.compte)}</td>
                      <td className="text-right"><Ecart value={p.ecart} /> <span className="text-xs text-slate-500">{prod?.unite}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="title-sport mb-2 text-lg">Par caisse</h3>
        <div className="space-y-4">
          {caisses.filter(c => c.statut === 'compte' || c.statut === 'valide').map(ic => {
            const c = refs.caisse.get(ic.caisse_id)
            const ls = (lignesParCaisse.get(ic.id) ?? [])
              .map(l => ({ l, e: ecartLigne(l) }))
              .filter(x => !ecartsSeuls || estEcart(x.e.etat))
              .sort((a, b) => (refs.produit.get(a.l.produit_id)?.designation ?? '').localeCompare(refs.produit.get(b.l.produit_id)?.designation ?? '', 'fr'))
            if (ecartsSeuls && !ls.length) return null
            return (
              <div key={ic.id} className="card overflow-x-auto break-inside-avoid">
                <div className="flex flex-wrap items-center gap-2 border-b border-aasc-line/60 px-4 py-2">
                  <span className="font-display text-xl font-black italic text-aasc-orange">{c?.code}</span>
                  <span className="font-semibold">{c?.nom}</span>
                  <StatutCaisseBadge statut={ic.statut} />
                </div>
                {!ls.length ? <p className="px-4 py-3 text-sm text-slate-400">Caisse vide.</p> : (
                  <table className="table-sport">
                    <thead><tr><th>Produit</th><th className="max-sm:hidden">État</th><th className="text-right">Attendu</th><th className="text-right">Compté</th><th className="text-right">Écart</th></tr></thead>
                    <tbody>
                      {ls.map(({ l, e }) => (
                        <tr key={l.id}>
                          <td>
                            <p className="font-semibold">{refs.produit.get(l.produit_id)?.designation ?? '…'}</p>
                            {l.date_peremption && <p className="text-xs text-slate-500">Péremption {fmtDate(l.date_peremption, 'dd/MM/yy')}</p>}
                            <span className="sm:hidden"><EtatEcartBadge etat={e.etat} /></span>
                          </td>
                          <td className="max-sm:hidden"><EtatEcartBadge etat={e.etat} /></td>
                          <td className="text-right tabular-nums text-slate-400">{fmtQ(e.reference)}</td>
                          <td className="text-right tabular-nums">{fmtQ(l.qte_comptee)}</td>
                          <td className="text-right"><Ecart value={e.ecart} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
        {nonFaites.length > 0 && (
          <p className="mt-4 text-sm text-slate-400">
            <b className="text-slate-200">Non inventoriées ({nonFaites.length}) :</b>{' '}
            {nonFaites.map(ic => refs.caisse.get(ic.caisse_id)?.code).join(', ')}
          </p>
        )}
      </section>
    </div>
  )
}
