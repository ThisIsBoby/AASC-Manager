import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle2, AlertTriangle } from 'lucide-react'

const logoUrl = `${import.meta.env.BASE_URL}logo-aasc.png`

export function Logo({ size = 48, className = '' }: { size?: number; className?: string }) {
  return <img src={logoUrl} alt="AASC Cléry St-André Badminton" width={size} height={size} className={className} />
}

/** Volant de badminton stylisé (loader / états vides) */
export function Shuttle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M22 6 L42 6 L38 40 L26 40 Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M27 6 L29 40 M32 6 V40 M37 6 L35 40 M23 18 H41 M24.5 29 H39.5" stroke="currentColor" strokeWidth="2" opacity=".7" />
      <path d="M24 40 H40 V46 A8 8 0 0 1 24 46 Z" fill="#EE7D1F" />
    </svg>
  )
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <Shuttle className="h-12 w-12 animate-shuttle text-slate-300" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Shuttle className="h-12 w-12 text-slate-500" />
      <p className="title-sport text-lg text-slate-300">{title}</p>
      {children && <div className="text-sm text-slate-400">{children}</div>}
    </div>
  )
}

export function PageHeader({ title, kicker, actions }: { title: string; kicker?: string; actions?: ReactNode }) {
  return (
    <div className="speedlines mb-6 flex flex-wrap items-end justify-between gap-3 pb-1">
      <div className="min-w-0">
        {kicker && <p className="text-xs font-bold uppercase tracking-[.25em] text-aasc-orange">{kicker}</p>}
        <h1 className="title-sport truncate text-3xl sm:text-4xl">{title}</h1>
        <div className="mt-2 h-1 w-16 -skew-x-[24deg] rounded bg-gradient-to-r from-aasc-orange to-aasc-blue" />
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const tones = {
  orange: 'from-aasc-orange/25 text-aasc-orange-soft',
  blue: 'from-aasc-blue/30 text-sky-300',
  red: 'from-red-500/25 text-red-300',
  green: 'from-emerald-500/20 text-emerald-300',
} as const

/** Tuile chiffre clé, façon tableau de score */
export function StatTile({ label, value, tone = 'orange', icon, onClick }: {
  label: string; value: number | string; tone?: keyof typeof tones; icon?: ReactNode; onClick?: () => void
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp onClick={onClick}
      className={`card animate-rise overflow-hidden bg-gradient-to-br ${tones[tone]} to-transparent p-4 text-left ${onClick ? 'transition hover:-translate-y-0.5 hover:shadow-glow' : ''}`}>
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
        <span>{label}</span>{icon}
      </div>
      <div className="mt-2 font-display text-4xl font-black italic leading-none tabular-nums">{value}</div>
    </Comp>
  )
}

export function Badge({ tone = 'slate', children }: { tone?: 'slate' | 'orange' | 'red' | 'green' | 'blue'; children: ReactNode }) {
  const map = {
    slate: 'bg-slate-500/20 text-slate-300',
    orange: 'bg-aasc-orange/20 text-aasc-orange-soft',
    red: 'bg-red-500/20 text-red-300',
    green: 'bg-emerald-500/20 text-emerald-300',
    blue: 'bg-aasc-blue/30 text-sky-300',
  }
  return <span className={`chip ${map[tone]}`}>{children}</span>
}

/**
 * Champ de formulaire avec intitulé.
 * `group` : à utiliser quand le contenu contient des boutons (choix, recherche, stepper…).
 * Un <label> transmet sinon tout appui à son premier bouton (ex. le « × » qui efface l'adhérent choisi).
 */
export function Field({ label, children, hint, group }: { label: string; children: ReactNode; hint?: string; group?: boolean }) {
  const Comp = group ? 'div' : 'label'
  return (
    <Comp className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </Comp>
  )
}

// Blocage du défilement de la page derrière les fenêtres (compteur : plusieurs fenêtres peuvent se superposer).
// `position: fixed` sur <body> est nécessaire pour iOS Safari, qui ignore `overflow: hidden`.
let verrous = 0
let scrollAvant = 0
function verrouillerScroll() {
  if (verrous++ > 0) return
  scrollAvant = window.scrollY
  Object.assign(document.body.style, { position: 'fixed', top: `-${scrollAvant}px`, left: '0', right: '0', overflow: 'hidden' })
}
function deverrouillerScroll() {
  if (--verrous > 0) return
  Object.assign(document.body.style, { position: '', top: '', left: '', right: '', overflow: '' })
  window.scrollTo(0, scrollAvant)
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  useEffect(() => {
    if (!open) return
    verrouillerScroll()
    return deverrouillerScroll
  }, [open])
  if (!open) return null
  // Portail vers <body> : sinon une carte parente (backdrop-blur, animation…) emprisonne la fenêtre
  return createPortal(
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`card card-accent max-h-[92dvh] w-full animate-rise overflow-y-auto overscroll-contain rounded-b-none p-5 sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="title-sport text-xl">{title}</h2>
          <button className="btn-icon btn-ghost" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

// ---------- Toasts ----------
type Toast = { id: number; msg: string; kind: 'ok' | 'err' }
const ToastCtx = createContext<(msg: string, kind?: 'ok' | 'err') => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const n = useRef(0)
  const push = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = ++n.current
    setList(l => [...l, { id, msg, kind }])
    setTimeout(() => setList(l => l.filter(t => t.id !== id)), kind === 'err' ? 6000 : 3000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        {list.map(t => (
          <div key={t.id}
            className={`pointer-events-auto flex max-w-md animate-rise items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-card ${t.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {t.kind === 'ok' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/** Formate un nombre (supprime les décimales inutiles) */
export function fmtQ(n: number | null | undefined) {
  if (n == null) return '–'
  return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}
