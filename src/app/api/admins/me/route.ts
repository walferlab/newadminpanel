import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminRole, type AdminRole } from '@/types'

export const runtime = 'nodejs'

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
  const validApprovedRoles = rows
    .filter((row) => row.approved === true && isAdminRole(row.role))
    .map((row) => row.role as AdminRole)

  if (validApprovedRoles.length > 0) {
    return validApprovedRoles.reduce((best, current) =>
      getRolePriority(current) > getRolePriority(best) ? current : best,
    )
  }

  const validRoles = rows
    .filter((row) => isAdminRole(row.role))
    .map((row) => row.role as AdminRole)

  if (validRoles.length === 0) {
    return null
  }

  return validRoles.reduce((best, current) =>
    getRolePriority(current) > getRolePriority(best) ? current : best,
  )
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
  const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? null

  const [rowsByClerkRes, rowsByEmailRes] = await Promise.all([
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

  if (rowsByClerkRes.error || rowsByEmailRes.error) {
    return NextResponse.json({ error: 'Failed to load admin role' }, { status: 500 })
  }

  const merged = [
    ...((rowsByClerkRes.data ?? []) as Array<{
      approved?: boolean | null
      role?: string | null
      created_at?: string | null
      clerk_id?: string | null
      email?: string | null
    }>),
    ...((rowsByEmailRes.data ?? []) as Array<{
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

  return NextResponse.json({ approved, role }, { status: 200 })
}
