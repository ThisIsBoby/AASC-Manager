import type { StatutCaisseInventaire } from '@/core/types'
import { Badge, fmtQ } from '@/core/ui'
import type { EtatEcart } from '../logic'

const statutCaisse: Record<StatutCaisseInventaire, { label: string; tone: 'slate' | 'orange' | 'blue' | 'green' }> = {
  a_faire: { label: 'À compter', tone: 'slate' },
  en_cours: { label: 'Comptage en cours', tone: 'orange' },
  compte: { label: 'À valider', tone: 'blue' },
  valide: { label: 'Validée', tone: 'green' },
}

export function StatutCaisseBadge({ statut }: { statut: StatutCaisseInventaire }) {
  const s = statutCaisse[statut]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

const etatInfo: Record<EtatEcart, { label: string; tone: 'slate' | 'orange' | 'red' | 'green' | 'blue' }> = {
  conforme: { label: 'Conforme', tone: 'green' },
  manquant: { label: 'Manquant', tone: 'orange' },
  surplus: { label: 'En trop', tone: 'blue' },
  absent: { label: 'Absent', tone: 'red' },
  nouveau: { label: 'Trouvé en plus', tone: 'blue' },
  non_compte: { label: 'Non compté', tone: 'slate' },
}

export function EtatEcartBadge({ etat }: { etat: EtatEcart }) {
  const e = etatInfo[etat]
  return <Badge tone={e.tone}>{e.label}</Badge>
}

/** Écart signé, coloré : rouge si manque, bleu si surplus */
export function Ecart({ value, className = '' }: { value: number; className?: string }) {
  const cls = value < 0 ? 'text-red-400' : value > 0 ? 'text-sky-300' : 'text-slate-500'
  return <span className={`font-bold tabular-nums ${cls} ${className}`}>{value > 0 ? '+' : ''}{value === 0 ? '0' : fmtQ(value)}</span>
}

/** Barre d'avancement d'un inventaire */
export function Avancement({ faites, valides, total }: { faites: number; valides: number; total: number }) {
  const pct = (n: number) => (total ? `${(n / total) * 100}%` : '0%')
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={faites}>
      <div className="flex h-full">
        <div className="h-full bg-emerald-500" style={{ width: pct(valides) }} />
        <div className="h-full bg-aasc-orange" style={{ width: pct(faites - valides) }} />
      </div>
    </div>
  )
}
