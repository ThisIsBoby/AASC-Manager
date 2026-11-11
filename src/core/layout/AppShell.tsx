import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard, Boxes, Plus, Wrench, Menu, LogOut, Sun, Moon, UserCircle2, X } from 'lucide-react'
import { modules, type NavItem } from '../modules'
import { QuickActionSheet, QuickActionsProvider } from '../accueil/QuickActions'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../supabase'
import { Logo } from '../ui'
import { applyTheme, getTheme, type Theme } from '../theme'

function usePendingCount(enabled: boolean) {
  return useQuery({
    queryKey: ['pending-count'], enabled, refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('statut', 'en_attente')
      return count ?? 0
    },
  })
}

function NavEntry({ item, badge, onClick }: { item: NavItem; badge?: number; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} end={item.end} onClick={onClick}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
          isActive ? 'bg-gradient-to-r from-aasc-orange/25 to-transparent text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
      {({ isActive }) => <>
        {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-aasc-orange" />}
        <Icon size={18} className={isActive ? 'text-aasc-orange' : ''} />
        <span className="flex-1">{item.label}</span>
        {!!badge && <span className="chip bg-aasc-orange text-white">{badge}</span>}
      </>}
    </NavLink>
  )
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin } = useAuth()
  const pending = usePendingCount(isAdmin).data
  return (
    <nav className="flex flex-col gap-5">
      <NavEntry item={{ to: '/accueil', label: 'Accueil', icon: LayoutDashboard }} onClick={onNavigate} />
      {modules.filter(m => !m.adminOnly || isAdmin).map(m => (
        <div key={m.id}>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[.25em] text-slate-500">{m.nom}</p>
          <div className="flex flex-col gap-0.5">
            {m.nav.filter(i => !i.adminOnly || isAdmin).map(i => (
              <NavEntry key={i.to} item={i} onClick={onNavigate} badge={i.to === '/admin/utilisateurs' ? pending : undefined} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

function UserCard() {
  const { profile, signOut, isAdmin } = useAuth()
  const [theme, setTheme] = useState<Theme>(getTheme())
  const nav = useNavigate()
  const toggle = () => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); applyTheme(t) }
  return (
    <div className="card flex items-center gap-2 p-2.5">
      <button onClick={() => nav('/profil')} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left hover:bg-white/5">
        <UserCircle2 className="shrink-0 text-aasc-orange" size={30} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{profile?.nom || profile?.email}</p>
          <p className="text-[11px] uppercase tracking-wider text-slate-500">{isAdmin ? 'Administrateur' : 'Utilisateur'}</p>
        </div>
      </button>
      <button className="btn-icon btn-ghost" onClick={toggle} title="Thème clair / sombre">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
      <button className="btn-icon btn-ghost" onClick={() => signOut()} title="Déconnexion"><LogOut size={16} /></button>
    </div>
  )
}

export function AppShell() {
  const [drawer, setDrawer] = useState(false)
  const [sheet, setSheet] = useState(false)
  const { isAdmin } = useAuth()
  const pending = usePendingCount(isAdmin).data

  const bottom = [
    { to: '/accueil', label: 'Accueil', icon: LayoutDashboard },
    { to: '/boutique/cordages', label: 'Cordages', icon: Wrench },
    null,
    { to: '/stock/caisses', label: 'Caisses', icon: Boxes },
  ]

  return (
    <QuickActionsProvider>
    <div className="min-h-screen lg:flex">
      {/* Sidebar desktop */}
      <aside className="surface no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-aasc-line bg-aasc-ink/60 p-4 backdrop-blur lg:flex">
        <div className="speedlines flex items-center gap-3 px-1">
          <Logo size={52} />
          <div>
            <p className="title-sport text-xl leading-none">AASC</p>
            <p className="font-display text-xs font-bold uppercase tracking-[.2em] text-aasc-orange">Manager</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto"><NavContent /></div>
        <UserCard />
      </aside>

      {/* Barre haute mobile */}
      <header className="surface no-print sticky top-0 z-30 flex items-center gap-3 border-b border-aasc-line bg-aasc-night/85 px-4 py-2.5 backdrop-blur lg:hidden">
        <Logo size={36} />
        <p className="title-sport flex-1 text-lg">AASC <span className="text-aasc-orange">Manager</span></p>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>

      {/* Navigation basse mobile */}
      <nav className="surface no-print fixed inset-x-0 bottom-0 z-40 border-t border-aasc-line bg-aasc-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 items-end">
          {bottom.map((b, i) => b === null ? (
            <button key="actions" onClick={() => setSheet(true)} aria-label="Actions rapides" className="-mt-7 flex flex-col items-center gap-1 pb-2">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-aasc-night text-white shadow-glow"
                style={{ background: 'linear-gradient(135deg,#F6A25B,#EE7D1F 45%,#E8641A)' }}>
                <Plus size={30} />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-aasc-orange">Actions</span>
            </button>
          ) : (
            <NavLink key={i} to={b.to}
              className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-aasc-orange' : 'text-slate-400'}`}>
              <b.icon size={22} />{b.label}
            </NavLink>
          ))}
          <button onClick={() => setDrawer(true)} className="relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <Menu size={22} />Menu
            {!!pending && <span className="absolute right-4 top-1.5 h-2.5 w-2.5 rounded-full bg-aasc-orange" />}
          </button>
        </div>
      </nav>

      {/* Tiroir mobile */}
      {drawer && (
        <div className="no-print fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs animate-rise flex-col gap-5 overflow-y-auto surface border-l border-aasc-line bg-aasc-ink p-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="title-sport text-xl">Menu</p>
              <button className="btn-icon btn-ghost" onClick={() => setDrawer(false)}><X size={18} /></button>
            </div>
            <div className="flex-1"><NavContent onNavigate={() => setDrawer(false)} /></div>
            <UserCard />
          </div>
        </div>
      )}

      <QuickActionSheet open={sheet} onClose={() => setSheet(false)} />
    </div>
    </QuickActionsProvider>
  )
}
