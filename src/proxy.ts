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

async function getAccessContext(userId: string): Promise<AccessContext> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return { approved: null, role: null }
  }

  const endpoint = new URL(`${url}/rest/v1/admins`)
  endpoint.searchParams.set('select', 'approved,role,created_at')
  endpoint.searchParams.set('clerk_id', `eq.${userId}`)
  endpoint.searchParams.set('order', 'created_at.desc')
  endpoint.searchParams.set('limit', '50')

  try {
    const response = await fetch(endpoint.toString(), {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { approved: null, role: null }
    }

    const rows = (await response.json()) as Array<{ approved?: boolean; role?: string | null }>
    if (!rows.length) {
      return { approved: false, role: null }
    }

    const validRoles = rows
      .map((row) => row.role)
      .filter((value): value is AdminRole => isAdminRole(value))

    const role =
      validRoles.length > 0
        ? validRoles.reduce((best, current) =>
            getRolePriority(current) > getRolePriority(best) ? current : best,
          )
        : null

    const approved = rows.some((row) => row.approved === true)

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

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.next()
  }

  const { approved, role } = await getAccessContext(userId)
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
