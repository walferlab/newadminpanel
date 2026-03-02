import type { AdminRole } from '@/types'

export const APPROVALS_ALLOWED_ROLES = ['super_admin', 'admin'] as const satisfies readonly AdminRole[]
export const WORKERS_ALLOWED_ROLES = ['super_admin', 'admin'] as const satisfies readonly AdminRole[]
export const REVENUE_ALLOWED_ROLES = ['senior_editor'] as const satisfies readonly AdminRole[]

interface ProtectedRouteRule {
  path: string
  allowedRoles: readonly AdminRole[]
}

const PROTECTED_ROUTE_RULES: ProtectedRouteRule[] = [
  { path: '/approvals', allowedRoles: APPROVALS_ALLOWED_ROLES },
  { path: '/workers', allowedRoles: WORKERS_ALLOWED_ROLES },
  { path: '/revenue', allowedRoles: REVENUE_ALLOWED_ROLES },
]

function matchesRoute(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function canAccessRoles(
  role: AdminRole | null | undefined,
  allowedRoles?: readonly AdminRole[],
): boolean {
  if (!allowedRoles) {
    return true
  }

  if (!role) {
    return false
  }

  if (role === 'super_admin' && allowedRoles.includes('admin')) {
    return true
  }

  return allowedRoles.includes(role)
}

export function canAccessPath(pathname: string, role: AdminRole | null | undefined): boolean {
  const rule = PROTECTED_ROUTE_RULES.find((entry) => matchesRoute(pathname, entry.path))
  if (!rule) {
    return true
  }

  return canAccessRoles(role, rule.allowedRoles)
}
