import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, PackageMinus, Printer, Trash2, Users } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthProvider'
import { errMsg } from '@/core/supabase'
import type { Tournoi } from '@/core/types'
import { Badge, EmptyState, PageHeader, Spinner, StatTile, fmtQ, useToast } from '@/core/ui'
import { useDelete, useModeleLignes, useModeles, useStockProduits, useSortirTournoi, useTournois, useUpsert } from '../api'
import { fmtDate, useRefs } from '../components/shared'
import { calculPreparation } from '../logic'

export function TournoiDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { isAdmin } = useAuth()
  const tournois = useTournois()
  const t = tournois.data?.find(x => x.id === id)
  const modeles = useModeles().data ?? []
  const lignes = useModeleLignes().data ?? []
  const stock = useStockProduits().data ?? []
  const refs = useRefs()
  const upsert = useUpsert<Tournoi>('tournois', ['tournois'])
  const del = useDelete('tournois', ['tournois'])
  const sortir = useSortirTournoi()
  const [nb, setNb] = useState(0)

  useEffect(() => { if (t) setNb(t.nb_joueurs) }, [t?.id, t?.nb_joueurs]) // eslint-disable-line react-hooks/exhaustive-deps

  const prepa = useMemo(() => {
    if (!t?.modele_id) return []
    const map = new Map(stock.map(s => [s.id, Number(s.stock_valide)]))
    return calculPreparation(lignes.filter(l => l.modele_id === t.modele_id), nb, map)
  }, [t?.modele_id, lignes, stock, nb])

  if (tournois.isLoading) return <Spinner />
  if (!t) return <EmptyState title="Tournoi introuvable"><Link to="/stock/tournois" className="text-aasc-orange">Retour</Link></EmptyState>

  const enPrepa = t.statut === 'prepa'
  const manque = prepa.filter(p => p.aAcheter > 0)
  const couverture = prepa.length ? Math.round((prepa.filter(p => p.aAcheter === 0).length / prepa.length) * 100) : 100

  async function saveNb() {
    if (!t || nb === t.nb_joueurs || nb < 1) return
    try { await upsert.mutateAsync({ id: t.id, nb_joueurs: nb }); toast('Nombre de joueurs mis à jour') } catch (e) { toast(errMsg(e), 'err') }
  }

  async function doSortir() {
    if (!t) return
    const msg = manque.length
      ? `Stock insuffisant pour ${manque.length} produit(s) : seul le disponible sera sorti. Continuer ?`
      : `Sortir du stock tous les besoins du tournoi « ${t.nom} » ?`
    if (!confirm(msg)) return
    try {
      await saveNb()
      const r = await sortir.mutateAsync(t.id)
      const total = r.reduce((s, x) => s + Number(x.sorti), 0)
      toast(`Sortie enregistrée : ${fmtQ(total)} unités au total`)
    } catch (e) { toast(errMsg(e), 'err') }
  }

  return (
    <div>
      <Link to="/stock/tournois" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Tournois</Link>
      <PageHeader kicker={`${fmtDate(t.date)} · ${modeles.find(m => m.id === t.modele_id)?.nom ?? 'Sans modèle'}`} title={t.nom}
        actions={<>
          <button className="btn-ghost" onClick={() => window.print()}><Printer size={16} /> Imprimer</button>
          {enPrepa && <button className="btn-primary" onClick={doSortir} disabled={sortir.isPending || !prepa.length}><PackageMinus size={16} /> Sortir du stock</button>}
          {isAdmin && <button className="btn-ghost text-red-300" onClick={async () => {
            if (!confirm('Supprimer ce tournoi ? (les mouvements de stock déjà faits sont conservés)')) return
            try { await del.mutateAsync(t.id); nav('/stock/tournois') } catch (e) { toast(errMsg(e), 'err') }
          }}><Trash2 size={16} /></button>}
        </>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card card-accent col-span-2 p-4 sm:col-span-1">
          <p className="label flex items-center gap-1"><Users size={12} /> Joueurs</p>
          {enPrepa ? (
            <div className="flex items-center gap-3">
              <input type="range" min={1} max={300} value={nb} onChange={e => setNb(Number(e.target.value))} onMouseUp={saveNb} onTouchEnd={saveNb} className="no-print flex-1 accent-aasc-orange" />
              <input type="number" min={1} className="input w-20 text-center font-display text-xl font-black" value={nb} onChange={e => setNb(Number(e.target.value))} onBlur={saveNb} />
            </div>
          ) : <p className="font-display text-4xl font-black italic">{t.nb_joueurs}</p>}
        </div>
        <StatTile label="Produits à acheter" value={manque.length} tone={manque.length ? 'red' : 'green'} />
        <StatTile label="Couverture du stock" value={`${couverture}%`} tone={couverture === 100 ? 'green' : 'orange'} />
      </div>

      {!enPrepa && <p className="mb-4"><Badge tone="green">Besoins déjà sortis du stock</Badge> <Link className="ml-2 text-sm text-aasc-orange-soft hover:underline" to="/stock/historique?periode=tout">voir l'historique</Link></p>}

      {!prepa.length ? <EmptyState title="Aucun besoin">Le modèle associé ne contient aucune ligne.</EmptyState> : (
        <div className="card overflow-x-auto">
          <table className="table-sport">
            <thead><tr><th>Produit</th><th className="text-right">Besoin</th><th className="text-right">En stock</th><th className="text-right">À acheter</th><th className="no-print hidden sm:table-cell" /></tr></thead>
            <tbody>
              {prepa.map(l => {
                const p = refs.produit.get(l.produitId)
                const pct = l.besoin ? Math.min(100, (l.enStock / l.besoin) * 100) : 100
                return (
                  <tr key={l.produitId}>
                    <td className="font-semibold">{p?.designation}<span className="ml-1 text-xs font-normal text-slate-500">{p?.unite}</span></td>
                    <td className="text-right font-display text-lg font-black italic tabular-nums">{fmtQ(l.besoin)}</td>
                    <td className="text-right tabular-nums text-slate-300">{fmtQ(l.enStock)}</td>
                    <td className="text-right">{l.aAcheter > 0 ? <Badge tone="red">{fmtQ(l.aAcheter)}</Badge> : <Badge tone="green">OK</Badge>}</td>
                    <td className="no-print hidden w-40 sm:table-cell">
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full -skew-x-[24deg] rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-aasc-orange' : 'bg-red-500'}`} style={{ width: `${Math.max(pct, 3)}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
