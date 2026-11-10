import type { LucideIcon } from 'lucide-react'
import type { RouteObject } from 'react-router-dom'
import { stockModule } from '@/modules/stock'
import { adminModule } from '@/modules/admin'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
  end?: boolean
}

/** Un module de l'application = un groupe de navigation + ses routes. */
export interface AppModule {
  id: string
  nom: string
  nav: NavItem[]
  routes: RouteObject[]
  adminOnly?: boolean
}

// ➜ Pour ajouter un futur module (adhérents, compétitions, finances...), créez src/modules/<nom>/index.tsx
//   et ajoutez-le simplement à cette liste.
export const modules: AppModule[] = [stockModule, adminModule]
