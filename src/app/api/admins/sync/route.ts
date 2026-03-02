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

function pickApprovedRole(rows: Array<{ role?: string | null; approved?: boolean | null }>): AdminRole | null {
  const approvedRoles = rows
    .filter((row) => row.approved === true && isAdminRole(row.role))
    .map((row) => row.role as AdminRole)

  if (!approvedRoles.length) {
    return null
  }

  return approvedRoles.reduce((best, current) =>
    getRolePriority(current) > getRolePriority(best) ? current : best,
  )
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase admin configuration' }, { status: 500 })
  }

  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ error: 'No email address found for current user' }, { status: 400 })
  }

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.username ||
    email

  const [clerkRowsRes, emailRowsRes] = await Promise.all([
    supabase
      .from('admins')
      .select('id, clerk_id, email, approved, role, created_at')
      .eq('clerk_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('admins')
      .select('id, clerk_id, email, approved, role, created_at')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (clerkRowsRes.error || emailRowsRes.error) {
    console.error('Admin sync lookup failed:', clerkRowsRes.error ?? emailRowsRes.error)
    return NextResponse.json({ error: 'Failed to sync admin request' }, { status: 500 })
  }

  const clerkRows = clerkRowsRes.data ?? []
  const emailRows = emailRowsRes.data ?? []
  const approvedRole = pickApprovedRole(emailRows)
  const approvedByEmail = emailRows.some((row) => row.approved === true)

  const currentByClerk = clerkRows[0]

  if (currentByClerk) {
    const updates: Record<string, unknown> = {
      email,
      name,
    }

    if (approvedByEmail && approvedRole) {
      updates.approved = true
      updates.role = approvedRole
    }

    const { error } = await supabase.from('admins').update(updates).eq('id', currentByClerk.id)
    if (error) {
      console.error('Admin sync update by clerk_id failed:', error)
      return NextResponse.json({ error: 'Failed to sync admin request' }, { status: 500 })
    }

    return NextResponse.json(
      { synced: true, approved: Boolean(updates.approved ?? currentByClerk.approved) },
      { status: 200 },
    )
  }

  const existingByEmail = emailRows[0]
  if (existingByEmail) {
    const { error } = await supabase
      .from('admins')
      .update({
        clerk_id: userId,
        email,
        name,
      })
      .eq('id', existingByEmail.id)

    if (error) {
      console.error('Admin sync update by email failed:', error)
      return NextResponse.json({ error: 'Failed to sync admin request' }, { status: 500 })
    }

    return NextResponse.json({ synced: true, approved: Boolean(existingByEmail.approved) }, { status: 200 })
  }

  const { error } = await supabase.from('admins').insert({
    clerk_id: userId,
    email,
    name,
    approved: false,
    role: 'uploader',
  })

  if (error) {
    console.error('Admin sync insert failed:', error)
    return NextResponse.json({ error: 'Failed to sync admin request' }, { status: 500 })
  }

  return NextResponse.json({ synced: true, approved: false }, { status: 200 })
}
