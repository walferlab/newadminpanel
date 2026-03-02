import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  Database,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
} from 'lucide-react'
import {
  APPROVALS_ALLOWED_ROLES,
  REVENUE_ALLOWED_ROLES,
  WORKERS_ALLOWED_ROLES,
  canAccessRoles,
} from '@/lib/rbac'
import type { AdminRole } from '@/types'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  allowedRoles?: readonly AdminRole[]
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/books', label: 'Books', icon: BookOpen },
  { href: '/data-imports', label: 'Inbox', icon: Database },
  { href: '/workers', label: 'Workers', icon: Users, allowedRoles: WORKERS_ALLOWED_ROLES },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  {
    href: '/revenue',
    label: 'Revenue',
    icon: CircleDollarSign,
    allowedRoles: REVENUE_ALLOWED_ROLES,
  },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  {
    href: '/approvals',
    label: 'Approvals',
    icon: CheckCircle2,
    allowedRoles: APPROVALS_ALLOWED_ROLES,
  },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function getNavLabel(pathname: string): string {
  const match = NAV_ITEMS.find((item) => pathname.startsWith(item.href))
  return match?.label ?? 'Panel'
}

export function getNavItemsForRole(role: AdminRole | null | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => canAccessRoles(role, item.allowedRoles))
}
