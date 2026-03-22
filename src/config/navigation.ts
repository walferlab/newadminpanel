import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  BookOpen,
  CheckCircle2,
  Database,
  LayoutDashboard,
  Megaphone,
  Newspaper,
} from 'lucide-react'
import { canAccessRoles } from '@/lib/rbac'
import type { AdminRole } from '@/types'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  allowedRoles?: readonly AdminRole[]
}

// Role access constants
export const SUPER_ADMIN_ONLY = ['super_admin'] as const satisfies readonly AdminRole[]
export const ADMIN_PLUS = ['super_admin', 'admin'] as const satisfies readonly AdminRole[]
export const EDITOR_PLUS = ['super_admin', 'admin', 'senior_editor', 'junior_editor'] as const satisfies readonly AdminRole[]

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/books',       label: 'Books',        icon: BookOpen },
  { href: '/blogs',       label: 'Blogs',        icon: Newspaper },
  { href: '/newsletter',  label: 'Newsletter',   icon: Bell,         allowedRoles: ADMIN_PLUS },
  { href: '/ads',         label: 'Ads',          icon: Megaphone,    allowedRoles: ADMIN_PLUS },
  { href: '/data-imports',label: 'Inbox',        icon: Database },
  { href: '/approvals',   label: 'Approvals',    icon: CheckCircle2, allowedRoles: ADMIN_PLUS },
]

export function getNavLabel(pathname: string): string {
  const match = NAV_ITEMS.find((item) => pathname.startsWith(item.href))
  return match?.label ?? 'Panel'
}

export function getNavItemsForRole(role: AdminRole | null | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => canAccessRoles(role, item.allowedRoles))
}
