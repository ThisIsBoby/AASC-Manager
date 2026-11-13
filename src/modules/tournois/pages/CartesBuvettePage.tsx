import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, Printer, Scissors } from 'lucide-react'
import { PageHeader } from '@/core/ui'
import { CARTES_PAR_PAGE, TAILLE_CARTE, VALEURS_CARTE, VALEUR_CASE, colonnesCases, fmtPrix, nbCases, planchesCartes, type ValeurCarte } from '../buvette'
import '../cartes.css'

const CLE = 'aasc-cartes-buvette'
const logoUrl = `${import.meta.env.BASE_URL}logo-aasc.png`

function quantitesEnregistrees(): Record<ValeurCarte, number> {
  try {
    const q = JSON.parse(localStorage.getItem(CLE) ?? '')
    if (Number.isInteger(q?.[5]) && Number.isInteger(q?.[10])) return { 5: q[5], 10: q[10] }
  } catch { /* rien d'enregistré */ }
  return { 5: 5, 10: 5 }
}

export function CartesBuvettePage() {
  const [quantites, setQuantites] = useState(quantitesEnregistrees)
  const pages = planchesCartes(quantites)
  const total = quantites[5] + quantites[10]

  function changer(v: ValeurCarte, n: number) {
    const q = { ...quantites, [v]: Math.max(0, Math.min(400, Math.round(n) || 0)) }
    setQuantites(q)
    try { localStorage.setItem(CLE, JSON.stringify(q)) } catch { /* stockage indisponible */ }
  }

  return (
    <div>
      <style>{'@media print { @page { size: A4 portrait; margin: 0; } }'}</style>
      <div className="no-print">
        <PageHeader kicker="Buvette" title="Cartes buvette"
          actions={<button className="btn-primary" disabled={!total} onClick={() => window.print()}><Printer size={16} /> Imprimer ({pages.length} feuille{pages.length > 1 ? 's' : ''})</button>} />
        <div className="mb-5 flex flex-wrap items-end gap-4">
          {VALEURS_CARTE.map(v => (
            <div key={v}>
              <span className="label">Cartes {v} € · {nbCases(v)} cases</span>
              <div className="flex items-center gap-1">
                <button className="btn-icon btn-ghost" aria-label={`Une carte ${v} € de moins`} onClick={() => changer(v, quantites[v] - 1)}><Minus size={16} /></button>
                <input className="input w-20 text-center tabular-nums" inputMode="numeric" aria-label={`Nombre de cartes ${v} €`}
                  value={quantites[v]} onChange={e => changer(v, Number(e.target.value))} />
                <button className="btn-icon btn-ghost" aria-label={`Une carte ${v} € de plus`} onClick={() => changer(v, quantites[v] + 1)}><Plus size={16} /></button>
              </div>
            </div>
          ))}
          <p className="flex items-center gap-2 pb-2 text-sm text-slate-400">
            <Scissors size={16} /> Format carte de visite : {CARTES_PAR_PAGE} cartes de {TAILLE_CARTE.largeur} × {TAILLE_CARTE.hauteur} mm par feuille A4, à découper le long des pointillés.
          </p>
        </div>
        <p className="mb-4 text-sm text-slate-400">
          Imprimez sur papier épais (160 g ou plus) si possible. Dans la fenêtre d'impression : papier A4, échelle 100 %, sans marges.
          L'affiche de chaque événement s'imprime depuis son onglet <Link to="/tournois" className="text-aasc-orange hover:underline">Buvette</Link>.
        </p>
      </div>

      <div className="cb-stage">
        {pages.map((cartes, i) => (
          <div key={i} className="cb-page" aria-label={`Feuille ${i + 1} sur ${pages.length}`}>
            {Array.from({ length: CARTES_PAR_PAGE }, (_, j) => (
              <div key={j} className="cb-slot">{cartes[j] != null && <CarteBuvette valeur={cartes[j]} />}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CarteBuvette({ valeur }: { valeur: ValeurCarte }) {
  const cases = nbCases(valeur)
  return (
    <div className={`cb-card cb-${valeur}`}>
      <div className="cb-streaks" aria-hidden>
        <i style={{ left: '6%', top: '20%', width: '50%', background: '#EE7D1F' }} />
        <i style={{ left: '16%', top: '48%', width: '62%', background: '#2E7BC4' }} />
        <i style={{ left: 0, top: '74%', width: '30%', background: '#0E1A2E', height: 'calc(.5 * var(--mm))' }} />
      </div>
      <div className="cb-head">
        <img className="cb-logo" src={logoUrl} alt="" />
        <div>
          <p className="cb-club">AASC Cléry St-André Badminton</p>
          <p className="cb-title">Carte buvette</p>
        </div>
        <div className="cb-value">{valeur}<small>€</small></div>
      </div>
      <div className="cb-grid" style={{ gridTemplateColumns: `repeat(${colonnesCases(cases)}, 1fr)` }}>
        {Array.from({ length: cases }, (_, i) => <div key={i} className="cb-box"><span>{fmtPrix(VALEUR_CASE)} €</span></div>)}
      </div>
      <div className="cb-foot">
        <span><b>1 case = {fmtPrix(VALEUR_CASE)} €</b>, cochée à chaque achat</span>
        <span className="cb-num">N°<i /></span>
      </div>
    </div>
  )
}
