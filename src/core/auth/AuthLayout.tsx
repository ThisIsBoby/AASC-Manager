import type { ReactNode } from 'react'
import { Logo } from '../ui'

/** Écran vitrine (connexion, attente...) avec logo et traînées aux couleurs du club */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-[18%] h-6 w-[70%] -rotate-[16deg] -skew-x-[24deg] rounded-full bg-gradient-to-r from-transparent via-aasc-orange to-aasc-orange-deep opacity-70" />
        <div className="absolute -right-24 top-[30%] h-4 w-[60%] -rotate-[16deg] -skew-x-[24deg] rounded-full bg-gradient-to-r from-transparent to-aasc-blue opacity-80" />
        <div className="absolute -left-10 bottom-[22%] h-3 w-[55%] -rotate-[16deg] -skew-x-[24deg] rounded-full bg-gradient-to-r from-transparent to-aasc-blue-light opacity-60" />
        <div className="absolute -right-10 bottom-[12%] h-5 w-[45%] -rotate-[16deg] -skew-x-[24deg] rounded-full bg-gradient-to-r from-transparent to-aasc-orange opacity-50" />
        <div className="absolute inset-y-0 left-0 w-1/3 animate-streak bg-gradient-to-r from-transparent via-white/[.04] to-transparent" />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={148} className="drop-shadow-[0_10px_30px_rgba(238,125,31,.35)]" />
          <h1 className="title-sport mt-2 text-3xl">AASC <span className="text-aasc-orange">Manager</span></h1>
          <p className="text-xs font-semibold uppercase tracking-[.3em] text-slate-400">Cléry St-André Badminton</p>
        </div>
        <div className="card card-accent p-6">{children}</div>
      </div>
    </div>
  )
}
