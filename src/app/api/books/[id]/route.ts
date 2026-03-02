import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ROLE_PERMISSIONS, isAdminRole, type AdminRole } from '@/types'

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

function pickHighestApprovedRole(rows: Array<{ role?: string | null; approved?: boolean | null }>) {
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

async function getApprovedRole(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
  email: string | null,
): Promise<AdminRole | null> {
  if (!supabase) {
    return null
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
    return null
  }

  const rows = [...(byClerkRes.data ?? []), ...(byEmailRes.data ?? [])]
  return pickHighestApprovedRole(rows)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase admin configuration' }, { status: 500 })
  }

  const user = await currentUser()
  const email = normalizeEmail(user?.emailAddresses?.[0]?.emailAddress)
  const role = await getApprovedRole(supabase, userId, email)

  if (!role || !ROLE_PERMISSIONS[role].canDeleteBooks) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const bookId = Number(id)
  if (!Number.isInteger(bookId) || bookId <= 0) {
    return NextResponse.json({ error: 'Invalid book id' }, { status: 400 })
  }

  const { error: deleteEventsError } = await supabase
    .from('download_events')
    .delete()
    .eq('pdf_id', bookId)

  if (deleteEventsError) {
    console.error('Delete download events failed:', deleteEventsError)
    return NextResponse.json({ error: 'Failed to delete linked download events' }, { status: 500 })
  }

  const { data: deletedBook, error: deleteBookError } = await supabase
    .from('pdfs')
    .delete()
    .eq('id', bookId)
    .select('id')
    .maybeSingle()

  if (deleteBookError) {
    console.error('Delete book failed:', deleteBookError)
    return NextResponse.json({ error: 'Failed to delete book' }, { status: 500 })
  }

  if (!deletedBook) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
