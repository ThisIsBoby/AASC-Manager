import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { modules, type QuickAction } from '../modules'
import { useAuth } from '../auth/AuthProvider'
import { Modal } from '../ui'

interface Ctx {
  actions: QuickAction[]
  run: (id: string) => void
}

const QuickActionsCtx = createContext<Ctx>({ actions: [], run: () => {} })
export const useQuickActions = () => useContext(QuickActionsCtx)

/** Rassemble les actions rapides de tous les modules et héberge leurs fenêtres. */
export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  const nav = useNavigate()
  const [ouverte, setOuverte] = useState<string | null>(null)

  const actions = useMemo(() => modules
    .filter(m => !m.adminOnly || isAdmin)
    .flatMap(m => m.quickActions ?? [])
    .filter(a => !a.adminOnly || isAdmin), [isAdmin])

  const run = useCallback((id: string) => {
    const a = actions.find(x => x.id === id)
    if (!a) return
    if (a.Form) setOuverte(a.id)
    else if (a.to) nav(a.to)
  }, [actions, nav])

  const fermer = useCallback(() => setOuverte(null), [])
  const value = useMemo(() => ({ actions, run }), [actions, run])

  return (
    <QuickActionsCtx.Provider value={value}>
      {children}
      {actions.filter(a => a.Form).map(a => {
        const Form = a.Form!
        return <Form key={a.id} open={ouverte === a.id} onClose={fermer} />
      })}
    </QuickActionsCtx.Provider>
  )
}

/** Feuille d'actions du bouton « + » mobile. */
export function QuickActionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions, run } = useQuickActions()
  return (
    <Modal open={open} onClose={onClose} title="Actions rapides">
      <div className="flex flex-col gap-2">
        {actions.map(a => (
          <button key={a.id} onClick={() => { onClose(); run(a.id) }}
            className="flex items-center gap-3 rounded-xl border border-aasc-line p-3 text-left transition hover:border-aasc-orange">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-aasc-orange/20 text-aasc-orange">
              <a.icon size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{a.label}</span>
              {a.hint && <span className="block text-xs text-slate-400">{a.hint}</span>}
            </span>
            <ChevronRight size={18} className="text-slate-500" />
          </button>
        ))}
      </div>
    </Modal>
  )
}

/** Grille de gros boutons pour l'accueil. */
export function QuickActionGrid() {
  const { actions, run } = useQuickActions()
  if (!actions.length) return null
  return (
    <div className="no-print grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {actions.map(a => (
        <button key={a.id} onClick={() => run(a.id)}
          className="card card-accent flex flex-col items-start gap-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-glow">
          <span className="flex h-10 w-10 items-center justify-center rounded-full text-white"
            style={{ background: 'linear-gradient(135deg,#F6A25B,#EE7D1F 45%,#E8641A)' }}>
            <a.icon size={20} />
          </span>
          <span className="font-semibold leading-tight">{a.label}</span>
          {a.hint && <span className="text-xs text-slate-400">{a.hint}</span>}
        </button>
      ))}
    </div>
  )
}
