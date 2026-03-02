import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { canAccessPath } from '@/lib/rbac'
import { isAdminRole, type AdminRole } from '@/types'

const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/awaiting-approval',
  '/api/webhooks/clerk(.*)',
  '/api/admins/sync(.*)',
])

interface AccessContext {
  approved: boolean | null
  role: AdminRole | null
}

function getRolePriority(role: AdminRole): number {
  const priorities: Record<AdminRole, number> = {
    super_admin: 5,
    admin: 4,
    senior_editor: 3,
    junior_editor: 2,
    uploader: 1,
  }

  return priorities[role]
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function extractEmailFromClaims(claims: unknown): string | null {
  if (!claims || typeof claims !== 'object') {
    return null
  }

  const record = claims as Record<string, unknown>
  const candidates = [
    record.email,
    record.email_address,
    record.primary_email_address,
    record.primaryEmailAddress,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeEmail(candidate)
    if (normalized) {
      return normalized
    }
  }

  return null
}

function resolveRoleFromRows(rows: Array<{ approved?: boolean; role?: string | null }>): AdminRole | null {
  const approvedRoles = rows
    .filter((row) => row.approved === true && isAdminRole(row.role))
    .map((row) => row.role as AdminRole)

  if (approvedRoles.length > 0) {
    return approvedRoles.reduce((best, current) =>
      getRolePriority(current) > getRolePriority(best) ? current : best,
    )
  }

  const validRoles = rows
    .map((row) => row.role)
    .filter((value): value is AdminRole => isAdminRole(value))

  if (validRoles.length === 0) {
    return null
  }

  return validRoles.reduce((best, current) =>
    getRolePriority(current) > getRolePriority(best) ? current : best,
  )
}

async function fetchRowsByColumn(
  url: string,
  serviceKey: string,
  column: 'clerk_id' | 'email',
  value: string,
) {
  const endpoint = new URL(`${url}/rest/v1/admins`)
  endpoint.searchParams.set('select', 'approved,role,created_at,clerk_id,email')
  endpoint.searchParams.set(column, `eq.${value}`)
  endpoint.searchParams.set('order', 'created_at.desc')
  endpoint.searchParams.set('limit', '50')

  const response = await fetch(endpoint.toString(), {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    return null
  }

  return (await response.json()) as Array<{
    approved?: boolean
    role?: string | null
    created_at?: string | null
    clerk_id?: string | null
    email?: string | null
  }>
}

async function getAccessContext(userId: string, email: string | null): Promise<AccessContext> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return { approved: null, role: null }
  }

  try {
    const [clerkRows, emailRows] = await Promise.all([
      fetchRowsByColumn(url, serviceKey, 'clerk_id', userId),
      email ? fetchRowsByColumn(url, serviceKey, 'email', email) : Promise.resolve([]),
    ])

    if (!clerkRows || (email && !emailRows)) {
      return { approved: null, role: null }
    }

    const merged = [...clerkRows, ...(emailRows ?? [])]
    const deduped = new Map<string, { approved?: boolean; role?: string | null }>()
    for (const row of merged) {
      const key = `${row.clerk_id ?? ''}|${row.email ?? ''}|${row.created_at ?? ''}|${row.role ?? ''}|${row.approved ?? ''}`
      if (!deduped.has(key)) {
        deduped.set(key, { approved: row.approved, role: row.role })
      }
    }
    const rows = Array.from(deduped.values())

    if (!rows.length) {
      return { approved: false, role: null }
    }

    const approved = rows.some((row) => row.approved === true)
    const role = resolveRoleFromRows(rows)

    return {
      approved,
      role,
    }
  } catch {
    return { approved: null, role: null }
  }
}

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname
  const isWebhookPath = pathname.startsWith('/api/webhooks/clerk')
  const isApprovalSyncPath = pathname.startsWith('/api/admins/sync')

  if (isWebhookPath || isApprovalSyncPath) {
    return NextResponse.next()
  }

  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  const { userId, sessionClaims } = await auth()
  if (!userId) {
    return NextResponse.next()
  }

  const email = extractEmailFromClaims(sessionClaims)
  const { approved, role } = await getAccessContext(userId, email)
  const isAwaitingApprovalPath = pathname.startsWith('/awaiting-approval')

  if (approved !== true && !isAwaitingApprovalPath) {
    return NextResponse.redirect(new URL('/awaiting-approval', req.url))
  }

  if (approved === true && isAwaitingApprovalPath) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const isApiPath = pathname.startsWith('/api')
  if (!isApiPath && approved === true && !canAccessPath(pathname, role)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
