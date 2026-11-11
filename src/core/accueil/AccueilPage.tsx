import { modules } from '../modules'
import { useAuth } from '../auth/AuthProvider'
import { PageHeader } from '../ui'
import { QuickActionGrid } from './QuickActions'

/** Accueil commun à toutes les sections : actions rapides + bloc de chaque module. */
export function AccueilPage() {
  const { profile, isAdmin } = useAuth()
  const sections = modules.filter(m => m.Accueil && (!m.adminOnly || isAdmin))

  return (
    <div>
      <PageHeader kicker={`Salut ${profile?.nom?.trim() ?? ''} 👋`} title="Accueil" />
      <QuickActionGrid />
      {sections.map(m => {
        const Bloc = m.Accueil!
        return (
          <section key={m.id} className="mt-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-[.25em] text-aasc-orange">{m.nom}</p>
            <Bloc />
          </section>
        )
      })}
    </div>
  )
}
