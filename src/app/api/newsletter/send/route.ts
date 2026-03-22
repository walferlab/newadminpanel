import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function isAdminUser(supabase: ReturnType<typeof getServiceClient>, userId: string, email: string | null) {
  if (!supabase) return false
  const [r1, r2] = await Promise.all([
    supabase.from('admins').select('approved, role').eq('clerk_id', userId).limit(10),
    email ? supabase.from('admins').select('approved, role').eq('email', email).limit(10)
           : Promise.resolve({ data: [], error: null }),
  ])
  const rows = [...(r1.data ?? []), ...(r2.data ?? [])]
  return rows.some((r) => r.approved && (r.role === 'super_admin' || r.role === 'admin'))
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getServiceClient()
  if (!supabase) return NextResponse.json({ error: 'Server config error' }, { status: 500 })

  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? null
  const isAdmin = await isAdminUser(supabase, userId, email)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body?.subject?.trim() || !body?.html?.trim()) {
    return NextResponse.json({ error: 'Subject and HTML are required' }, { status: 400 })
  }

  const { subject, html, genre_filter = 'all' } = body

  // Create log entry using service role (bypasses RLS)
  const { data: logEntry, error: logErr } = await supabase
    .from('newsletter_send_logs')
    .insert({
      subject: subject.trim(),
      body_html: html,
      genre_filter,
      status: 'pending',
      sent_by: email ?? 'admin',
    })
    .select('id')
    .single()

  if (logErr || !logEntry) {
    console.error('Log insert error:', logErr)
    return NextResponse.json({ error: `Failed to create send log: ${logErr?.message ?? 'unknown'}` }, { status: 500 })
  }

  // Trigger Edge Function
  const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-newsletter`
  const secret = process.env.NEWSLETTER_API_SECRET ?? ''

  let edgeResult: { sent?: number; failed?: number; total?: number; error?: string } = {}
  try {
    const edgeRes = await fetch(edgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': secret },
      body: JSON.stringify({ subject: subject.trim(), html, genre_filter, log_id: logEntry.id }),
    })
    edgeResult = await edgeRes.json()

    if (!edgeRes.ok) {
      // Update log to failed
      await supabase.from('newsletter_send_logs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', logEntry.id)
      return NextResponse.json({ error: edgeResult.error ?? 'Edge function failed' }, { status: 500 })
    }
  } catch (err) {
    await supabase.from('newsletter_send_logs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', logEntry.id)
    return NextResponse.json({ error: 'Failed to reach send function' }, { status: 500 })
  }

  return NextResponse.json({ success: true, log_id: logEntry.id, ...edgeResult }, { status: 200 })
}
