import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { APPROVALS_ALLOWED_ROLES } from '@/lib/rbac'
import { isAdminRole, type AdminRole } from '@/types'

export const runtime = 'nodejs'

type NotificationType = 'message' | 'request' | 'approval'

interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  subtitle: string
  createdAt: string
  href: string
}

const APPROVAL_MANAGERS = new Set<AdminRole>(APPROVALS_ALLOWED_ROLES)

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return null
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
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

function pickHighestRole(rows: Array<{ role?: string | null; approved?: boolean | null }>): AdminRole | null {
  const approvedRoles = rows
    .filter((row) => row.approved === true && isAdminRole(row.role))
    .map((row) => row.role as AdminRole)

  if (approvedRoles.length === 0) {
    return null
  }

  return approvedRoles.reduce((best, current) =>
    getRolePriority(current) > getRolePriority(best) ? current : best,
  )
}

async function getUserAccess(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
  email: string | null,
) {
  if (!supabase) {
    return { approved: false, role: null as AdminRole | null, allowed: false }
  }

  const [byClerkRes, byEmailRes] = await Promise.all([
    supabase
      .from('admins')
      .select('approved, role, created_at, clerk_id, email')
      .eq('clerk_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    email
      ? supabase
          .from('admins')
          .select('approved, role, created_at, clerk_id, email')
          .eq('email', email)
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (byClerkRes.error || byEmailRes.error) {
    return { approved: false, role: null as AdminRole | null, allowed: false }
  }

  const rows = [...(byClerkRes.data ?? []), ...(byEmailRes.data ?? [])]
  const approved = rows.some((row) => row.approved === true)
  const role = pickHighestRole(rows)
  return { approved, role, allowed: approved && Boolean(role) }
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase admin configuration' }, { status: 500 })
  }

  const user = await currentUser()
  const email = normalizeEmail(user?.emailAddresses?.[0]?.emailAddress ?? null)
  const { allowed, role } = await getUserAccess(supabase, userId, email)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const canManageApprovals = Boolean(role && APPROVAL_MANAGERS.has(role))

  const [messagesRes, requestsRes, approvalsRes] = await Promise.all([
    supabase
      .from('contact_messages')
      .select('id, name, email, created_at', { count: 'exact' })
      .eq('status', false)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('pdf_requests')
      .select('id, name, email, created_at', { count: 'exact' })
      .eq('status', 'reviewing')
      .order('created_at', { ascending: false })
      .limit(6),
    canManageApprovals
      ? supabase
          .from('admins')
          .select('id, name, email, created_at', { count: 'exact' })
          .eq('approved', false)
          .order('created_at', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [], count: 0, error: null }),
  ])

  if (messagesRes.error || requestsRes.error || approvalsRes.error) {
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }

  const messageItems: NotificationItem[] = (messagesRes.data ?? []).map((row) => ({
    id: `message-${row.id}`,
    type: 'message',
    title: `Message from ${row.name ?? 'Unknown'}`,
    subtitle: row.email ?? '-',
    createdAt: row.created_at,
    href: '/data-imports#messages',
  }))

  const requestItems: NotificationItem[] = (requestsRes.data ?? []).map((row) => ({
    id: `request-${row.id}`,
    type: 'request',
    title: `PDF request from ${row.name ?? 'Unknown'}`,
    subtitle: row.email ?? '-',
    createdAt: row.created_at,
    href: '/data-imports#requests',
  }))

  const approvalItems: NotificationItem[] = (approvalsRes.data ?? []).map((row) => ({
    id: `approval-${row.id}`,
    type: 'approval',
    title: `Approval pending for ${row.name ?? row.email ?? 'Unknown user'}`,
    subtitle: row.email ?? '-',
    createdAt: row.created_at,
    href: '/approvals',
  }))

  const items = [...messageItems, ...requestItems, ...approvalItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12)

  const counts = {
    unreadMessages: messagesRes.count ?? 0,
    pendingPdfRequests: requestsRes.count ?? 0,
    pendingApprovals: approvalsRes.count ?? 0,
  }

  return NextResponse.json(
    {
      counts: {
        ...counts,
        total: counts.unreadMessages + counts.pendingPdfRequests + counts.pendingApprovals,
      },
      items,
    },
    { status: 200 },
  )
}
