import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { APPROVALS_ALLOWED_ROLES } from '@/lib/rbac'
import { isAdminRole, type AdminRole } from '@/types'

export const runtime = 'nodejs'

const ALLOWED_ROLES = new Set<AdminRole>([
  'super_admin',
  'admin',
  'senior_editor',
  'junior_editor',
  'uploader',
])
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

  if (approvedRoles.length > 0) {
    return approvedRoles.reduce((best, current) =>
      getRolePriority(current) > getRolePriority(best) ? current : best,
    )
  }

  const roles = rows
    .filter((row) => isAdminRole(row.role))
    .map((row) => row.role as AdminRole)

  if (!roles.length) {
    return null
  }

  return roles.reduce((best, current) =>
    getRolePriority(current) > getRolePriority(best) ? current : best,
  )
}

async function canManageApprovals(userId: string, email: string | null) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return { supabase: null as ReturnType<typeof getSupabaseAdminClient>, allowed: false }
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
    return { supabase, allowed: false }
  }

  const merged = [
    ...((byClerkRes.data ?? []) as Array<{
      approved?: boolean | null
      role?: string | null
      created_at?: string | null
      clerk_id?: string | null
      email?: string | null
    }>),
    ...((byEmailRes.data ?? []) as Array<{
      approved?: boolean | null
      role?: string | null
      created_at?: string | null
      clerk_id?: string | null
      email?: string | null
    }>),
  ]

  const dedupedMap = new Map<string, { approved?: boolean | null; role?: string | null }>()
  for (const row of merged) {
    const key = `${row.clerk_id ?? ''}|${row.email ?? ''}|${row.created_at ?? ''}|${row.role ?? ''}|${row.approved ?? ''}`
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, { approved: row.approved, role: row.role })
    }
  }

  const rows = Array.from(dedupedMap.values())
  const approved = rows.some((row) => row.approved === true)
  const role = pickHighestRole(rows)
  const allowed = approved && Boolean(role && APPROVAL_MANAGERS.has(role))
  return { supabase, allowed }
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? null
  const { supabase, allowed } = await canManageApprovals(userId, email)
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase admin configuration' }, { status: 500 })
  }

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('admins')
    .select('id, clerk_id, email, name, approved, role, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Admins list fetch failed:', error)
    return NextResponse.json({ error: 'Failed to load admins' }, { status: 500 })
  }

  return NextResponse.json({ users: data ?? [] }, { status: 200 })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? null
  const { supabase, allowed } = await canManageApprovals(userId, email)
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase admin configuration' }, { status: 500 })
  }

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as {
    id?: string
    approved?: boolean
    role?: AdminRole
  }

  if (!body.id) {
    return NextResponse.json({ error: 'Missing admin id' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (typeof body.approved === 'boolean') {
    updates.approved = body.approved
  }
  if (body.role) {
    if (!ALLOWED_ROLES.has(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    updates.role = body.role
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No update fields provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('admins')
    .update(updates)
    .eq('id', body.id)
    .select('id, clerk_id, email, name, approved, role, created_at')
    .maybeSingle()

  if (error) {
    console.error('Admin update failed:', error)
    return NextResponse.json({ error: 'Failed to update admin' }, { status: 500 })
  }

  return NextResponse.json({ user: data }, { status: 200 })
}
