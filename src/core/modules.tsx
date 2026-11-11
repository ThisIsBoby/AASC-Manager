import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { RouteObject } from 'react-router-dom'
import { stockModule } from '@/modules/stock'
import { tournoisModule } from '@/modules/tournois'
import { boutiqueModule } from '@/modules/boutique'
import { adherentsModule } from '@/modules/adherents'
import { adminModule } from '@/modules/admin'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
  end?: boolean
}

/** Action rapide : proposée sur l'accueil et dans le bouton « + » mobile. */
export interface QuickAction {
  id: string
  label: string
  hint?: string
  icon: LucideIcon
  /** Navigation vers une page… */
  to?: string
  /** …ou ouverture d'une fenêtre (formulaire en Modal). */
  Form?: ComponentType<{ open: boolean; onClose: () => void }>
  adminOnly?: boolean
}

/** Un module de l'application = un groupe de navigation + ses routes. */
export interface AppModule {
  id: string
  nom: string
  nav: NavItem[]
  routes: RouteObject[]
  adminOnly?: boolean
  /** Actions rapides proposées par le module. */
  quickActions?: QuickAction[]
  /** Bloc affiché sur l'accueil commun. */
  Accueil?: ComponentType
}

// ➜ Pour ajouter un futur module (adhérents, compétitions, finances...), créez src/modules/<nom>/index.tsx
//   et ajoutez-le simplement à cette liste.
export const modules: AppModule[] = [stockModule, boutiqueModule, adherentsModule, tournoisModule, adminModule]
