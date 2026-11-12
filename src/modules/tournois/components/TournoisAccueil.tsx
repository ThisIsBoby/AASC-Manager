import { Link } from 'react-router-dom'
import { CalendarHeart, ShoppingCart } from 'lucide-react'
import { useTournois } from '@/modules/stock/api'
import { fmtDate } from '@/modules/stock/components/shared'
import { libelleParticipants, libelleType } from '../logic'

/** Bloc « Événements » de l'accueil commun. */
export function TournoisAccueil() {
  const tournois = (useTournois().data ?? []).filter(t => t.statut === 'prepa')
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="title-sport flex items-center gap-2 text-lg"><CalendarHeart size={18} className="text-aasc-orange" /> Événements en préparation</h2>
        <Link to="/tournois" className="text-sm font-semibold text-aasc-orange-soft hover:underline">Gérer →</Link>
      </div>
      {tournois.length === 0 ? <p className="text-sm text-slate-400">Aucun événement en préparation.</p> : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tournois.map(t => (
            <Link key={t.id} to={`/tournois/${t.id}`} className="rounded-xl border border-aasc-line p-3 transition hover:border-aasc-orange">
              <p className="font-semibold">{(t.type ?? 'tournoi') !== 'tournoi' && <span className="mr-1 text-xs font-bold uppercase text-emerald-300">{libelleType(t.type)}</span>}{t.nom}</p>
              <p className="text-xs text-slate-400">{fmtDate(t.date)} · {libelleParticipants(t.type, t.nb_joueurs)}</p>
            </Link>
          ))}
        </div>
      )}
      <Link to="/stock/achats" className="btn-ghost mt-4"><ShoppingCart size={16} /> Comparer stock et achats à faire</Link>
    </section>
  )
}
