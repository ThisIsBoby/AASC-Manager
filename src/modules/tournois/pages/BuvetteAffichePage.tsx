import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Banknote, CreditCard, Printer, WalletCards } from 'lucide-react'
import type { BuvetteLigne, Tournoi } from '@/core/types'
import { EmptyState, PageHeader, Spinner } from '@/core/ui'
import { useTournois } from '@/modules/stock/api'
import { fmtDate } from '@/modules/stock/components/shared'
import { useBuvetteLignes } from '../api'
import { FORMATS, echelleCarte, fmtPrix, grouperBuvette, paginer, poidsMaxColonnes, repartirColonnes, type FormatAffiche, type Section } from '../buvette'
import { ICONES_RUBRIQUE } from '../components/BuvetteFiche'
import '../affiche.css'

const CLE = 'aasc-buvette-format'
const logoUrl = `${import.meta.env.BASE_URL}logo-aasc.png`

function formatEnregistre(): FormatAffiche {
  try { return localStorage.getItem(CLE) === 'a4' ? 'a4' : 'a3' } catch { return 'a3' }
}

export function BuvetteAffichePage() {
  const { id } = useParams()
  const tournois = useTournois()
  const lignes = useBuvetteLignes()
  const [format, setFormat] = useState<FormatAffiche>(formatEnregistre)
  const t = tournois.data?.find(x => x.id === id)

  function choisir(f: FormatAffiche) {
    setFormat(f)
    try { localStorage.setItem(CLE, f) } catch { /* stockage indisponible */ }
  }

  if (tournois.isLoading || lignes.isLoading) return <Spinner />
  if (!t) return <EmptyState title="Événement introuvable"><Link to="/tournois" className="text-aasc-orange">Retour</Link></EmptyState>

  const f = FORMATS[format]
  const miennes = (lignes.data ?? []).filter(l => l.tournoi_id === t.id)

  return (
    <div>
      {/* Format de la page imprimée : sans marge, l'affiche a ses propres marges */}
      <style>{`@media print { @page { size: ${format === 'a3' ? 'A3' : 'A4'} portrait; margin: 0; } }`}</style>

      <div className="no-print">
        <Link to={`/tournois/${t.id}?onglet=buvette`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> {t.nom}</Link>
        <PageHeader kicker="Buvette" title="Affiche"
          actions={<button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Imprimer en {f.nom}</button>} />
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="card inline-flex gap-1 p-1" role="group" aria-label="Format d'impression">
            {(Object.keys(FORMATS) as FormatAffiche[]).map(k => (
              <button key={k} aria-pressed={format === k} onClick={() => choisir(k)}
                className={`btn px-5 py-2 font-display font-black italic ${format === k ? 'bg-aasc-orange text-white' : 'text-slate-300'}`}>{FORMATS[k].nom}</button>
            ))}
          </div>
          <p className="text-sm text-slate-400">
            <b className="text-white">{f.nom}</b> · {f.largeur} × {f.hauteur} mm · {f.usage}.
            Dans la fenêtre d'impression, choisissez le papier {f.nom} et l'échelle 100 %.
          </p>
        </div>
        <p className="mb-4 text-sm text-slate-400">
          Produits et prix se modifient dans l'onglet <Link to={`/tournois/${t.id}?onglet=buvette`} className="text-aasc-orange hover:underline">Buvette</Link> de l'événement.
          Les deux formats sont affichés à la même échelle l'un par rapport à l'autre.
        </p>
      </div>

      <AfficheBuvette t={t} lignes={miennes} format={format} />
    </div>
  )
}

export function AfficheBuvette({ t, lignes, format }: { t: Tournoi; lignes: BuvetteLigne[]; format: FormatAffiche }) {
  const pages = paginer(grouperBuvette(lignes, true))
  return (
    <div className={`bv-stage ${format === 'a3' ? 'bv-a3' : ''}`}>
      {pages.length > 1 && <p className="no-print mb-3 text-center text-sm text-slate-400">
        Trop de produits pour une seule page lisible de loin : l'affiche tient sur {pages.length} pages.
      </p>}
      {pages.map((sections, i) => <Feuille key={i} t={t} sections={sections} format={format} page={pages.length > 1 ? `${i + 1}/${pages.length}` : ''} />)}
    </div>
  )
}

function Feuille({ t, sections, format, page }: { t: Tournoi; sections: Section<BuvetteLigne>[]; format: FormatAffiche; page: string }) {
  const [gauche, droite] = repartirColonnes(sections)
  const base = echelleCarte(poidsMaxColonnes(sections))
  const [k, setK] = useState(base)
  const menu = useRef<HTMLDivElement>(null)
  const signature = sections.map(s => s.rubrique.id + s.lignes.map(l => l.libelle).join('|')).join('/')

  // Repart de la taille calculée quand la carte change, puis réduit jusqu'à ce que tout tienne sur la page
  useLayoutEffect(() => { setK(base) }, [base, signature])
  useLayoutEffect(() => {
    const el = menu.current
    if (!el || k <= 0.5) return
    const contenu = Math.max(0, ...[...el.children].map(c => (c as HTMLElement).offsetHeight))
    if (contenu > el.clientHeight * 0.985) setK(Math.round((k - 0.05) * 100) / 100)
  })
  // Les polices arrivent parfois après le premier affichage : on remesure
  useEffect(() => { document.fonts?.ready.then(() => setK(base)) }, [base])
  const date = t.date ? fmtDate(t.date, 'EEE d MMMM yyyy') : ''

  return (
      <article className="bv-sheet" style={{ '--k': k } as CSSProperties} aria-label={`Affiche buvette ${FORMATS[format].nom}${page ? `, page ${page}` : ''}`}>
        <div className="bv-streaks top" aria-hidden>
          <i className="bv-o" style={{ left: '4%', top: '18%', width: '46%' }} />
          <i className="bv-b" style={{ left: '14%', top: '34%', width: '58%' }} />
          <i className="bv-n" style={{ left: 0, top: '50%', width: '30%', height: 'calc(.9 * var(--mm))' }} />
          <i className="bv-o" style={{ left: '22%', top: '64%', width: '34%', height: 'calc(1 * var(--mm))' }} />
          <i className="bv-b" style={{ left: '8%', top: '78%', width: '24%', height: 'calc(.9 * var(--mm))' }} />
        </div>
        <div className="bv-streaks bottom" aria-hidden>
          <i className="bv-o" style={{ left: 0, top: '10%', width: '60%' }} />
          <i className="bv-b" style={{ left: '10%', top: '50%', width: '70%', height: 'calc(1 * var(--mm))' }} />
        </div>

        <header className="bv-head">
          <div>
            <p className="bv-club">AASC Cléry St-André Badminton</p>
            <h1 className="bv-title">Buvet<span>te</span></h1>
            <div className="bv-event">
              <span className="bv-tag"><span>{t.nom}</span></span>
              {date && <span className="bv-date">{date.charAt(0).toUpperCase() + date.slice(1)}</span>}
            </div>
          </div>
          <img className="bv-logo" src={logoUrl} alt="AASC Cléry St-André Badminton" />
        </header>

        {sections.length ? (
          <div ref={menu} className={`bv-menu ${droite.length ? '' : 'bv-une'}`}>
            <Colonne sections={gauche} />
            {droite.length > 0 && <Colonne sections={droite} />}
          </div>
        ) : <p className="bv-vide">Ajoutez des produits dans l'onglet Buvette de l'événement.</p>}

        <footer className="bv-foot">
          <div className="bv-pay">
            <h3>Paiement</h3>
            <p><Banknote /><span><b>Espèces</b></span></p>
            <p><CreditCard /><span><b>Carte bancaire</b> à partir de 5 €</span></p>
            <p><WalletCards /><span><b>Carte buvette</b> : sans monnaie, sans attente</span></p>
          </div>
          <div className="bv-cards-block">
            <h3>Cartes buvette</h3>
            <div className="bv-cards">
              <div className="bv-card"><span className="bv-lbl">Carte buvette</span><span className="bv-val">5 €</span></div>
              <div className="bv-card"><span className="bv-lbl">Carte buvette</span><span className="bv-val">10 €</span></div>
            </div>
            <p className="bv-hint">En vente ici, à la buvette</p>
          </div>
          <p className="bv-thanks">Merci ! Chaque achat soutient le club.</p>
        </footer>
        {page && <span className="bv-page">{page}</span>}
      </article>
  )
}

function Colonne({ sections }: { sections: Section<BuvetteLigne>[] }) {
  return (
    <div className="bv-col">
      {sections.map(s => {
        const Icone = ICONES_RUBRIQUE[s.rubrique.id]
        return (
          <section key={s.rubrique.id} className={`bv-rub ${s.rubrique.genre === 'boisson' ? 'bv-drink' : 'bv-food'}`}>
            <h2><span className="bv-pill"><span><Icone strokeWidth={2.4} /> {s.rubrique.nom}</span></span></h2>
            <ul>
              {s.lignes.map(l => (
                <li key={l.id}>
                  <span className="bv-name">{l.libelle}</span>
                  <span className="bv-lead" />
                  <span className="bv-price">{fmtPrix(l.prix)}<small>€</small></span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
