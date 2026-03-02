import { auth } from '@clerk/nextjs/server'
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

async function canManageApprovals(userId: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return { supabase: null as ReturnType<typeof getSupabaseAdminClient>, allowed: false }
  }

  const { data, error } = await supabase
    .from('admins')
    .select('approved, role')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (error || !data) {
    return { supabase, allowed: false }
  }

  const role = isAdminRole(data.role) ? data.role : null
  const allowed = Boolean(data.approved) && Boolean(role && APPROVAL_MANAGERS.has(role))
  return { supabase, allowed }
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { supabase, allowed } = await canManageApprovals(userId)
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

  const { supabase, allowed } = await canManageApprovals(userId)
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
