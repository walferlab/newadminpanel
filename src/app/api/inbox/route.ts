import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { PDFRequest } from '@/types'

export const runtime = 'nodejs'

type RequestStatus = PDFRequest['status']

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

async function isApprovedUser(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
  email: string | null,
): Promise<boolean> {
  if (!supabase) {
    return false
  }

  const [byClerkRes, byEmailRes] = await Promise.all([
    supabase
      .from('admins')
      .select('approved, created_at')
      .eq('clerk_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    email
      ? supabase
          .from('admins')
          .select('approved, created_at')
          .eq('email', email)
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (byClerkRes.error || byEmailRes.error) {
    return false
  }

  const rows = [...(byClerkRes.data ?? []), ...(byEmailRes.data ?? [])]
  return rows.some((row) => row.approved === true)
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
  const approved = await isApprovedUser(supabase, userId, email)
  if (!approved) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [messagesRes, requestsRes] = await Promise.all([
    supabase
      .from('contact_messages')
      .select('id, name, email, message, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('pdf_requests')
      .select('id, name, email, details, status, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  if (messagesRes.error || requestsRes.error) {
    return NextResponse.json({ error: 'Failed to load inbox data' }, { status: 500 })
  }

  return NextResponse.json(
    {
      messages: messagesRes.data ?? [],
      requests: requestsRes.data ?? [],
    },
    { status: 200 },
  )
}

export async function PATCH(req: Request) {
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
  const approved = await isApprovedUser(supabase, userId, email)
  if (!approved) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as
    | { kind: 'message'; id: number; status: boolean }
    | { kind: 'messages_all'; status: boolean }
    | { kind: 'request'; id: number; status: RequestStatus }

  if (body.kind === 'messages_all') {
    if (typeof body.status !== 'boolean') {
      return NextResponse.json({ error: 'Invalid bulk message update payload' }, { status: 400 })
    }

    const { error } = await supabase
      .from('contact_messages')
      .update({ status: body.status })
      .eq('status', !body.status)

    if (error) {
      return NextResponse.json({ error: 'Failed to update message statuses' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  }

  if (body.kind === 'message') {
    if (typeof body.id !== 'number' || typeof body.status !== 'boolean') {
      return NextResponse.json({ error: 'Invalid message update payload' }, { status: 400 })
    }

    const { error } = await supabase
      .from('contact_messages')
      .update({ status: body.status })
      .eq('id', body.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update message status' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  }

  if (body.kind === 'request') {
    if (
      typeof body.id !== 'number' ||
      (body.status !== 'reviewing' && body.status !== 'approved' && body.status !== 'rejected')
    ) {
      return NextResponse.json({ error: 'Invalid request update payload' }, { status: 400 })
    }

    const { error } = await supabase
      .from('pdf_requests')
      .update({ status: body.status })
      .eq('id', body.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update request status' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  }

  return NextResponse.json({ error: 'Unsupported update kind' }, { status: 400 })
}
