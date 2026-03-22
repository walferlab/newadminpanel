import type { AdminRole } from '@/types'

export const ADMIN_PLUS       = ['super_admin', 'admin'] as const satisfies readonly AdminRole[]
export const EDITOR_PLUS      = ['super_admin', 'admin', 'senior_editor', 'junior_editor'] as const satisfies readonly AdminRole[]
export const SENIOR_PLUS      = ['super_admin', 'admin', 'senior_editor'] as const satisfies readonly AdminRole[]

// Legacy aliases used by AppShell
export const APPROVALS_ALLOWED_ROLES = ADMIN_PLUS
export const WORKERS_ALLOWED_ROLES   = ADMIN_PLUS
export const REVENUE_ALLOWED_ROLES   = SENIOR_PLUS

interface ProtectedRouteRule {
  path: string
  allowedRoles: readonly AdminRole[]
}

const PROTECTED_ROUTE_RULES: ProtectedRouteRule[] = [
  { path: '/approvals',  allowedRoles: ADMIN_PLUS },
  { path: '/newsletter', allowedRoles: ADMIN_PLUS },
  { path: '/ads',        allowedRoles: ADMIN_PLUS },
]

export function canAccessRoles(
  role: AdminRole | null | undefined,
  allowedRoles?: readonly AdminRole[],
): boolean {
  if (!allowedRoles) return true
  if (!role) return false
  return allowedRoles.includes(role)
}

export function canAccessPath(pathname: string, role: AdminRole | null | undefined): boolean {
  const rule = PROTECTED_ROUTE_RULES.find((r) => pathname.startsWith(r.path))
  if (!rule) return true
  return canAccessRoles(role, rule.allowedRoles)
}
