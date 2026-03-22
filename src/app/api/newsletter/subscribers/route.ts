import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getServiceClient()
  if (!supabase) return NextResponse.json({ error: 'Server config error' }, { status: 500 })

  const { data: subs } = await supabase
    .from('newsletter_subscribers')
    .select('*')
    .order('subscribed_at', { ascending: false })

  const { data: logs } = await supabase
    .from('newsletter_send_logs')
    .select('id, subject, sent_to_count, failed_count, status, genre_filter, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  return NextResponse.json({ subscribers: subs ?? [], logs: logs ?? [] })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getServiceClient()
  if (!supabase) return NextResponse.json({ error: 'Server config error' }, { status: 500 })

  const body = await req.json().catch(() => null)
  if (!body?.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  if (body.action === 'delete') {
    const { error } = await supabase.from('newsletter_subscribers').delete().eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (typeof body.is_active === 'boolean') {
    const { error } = await supabase.from('newsletter_subscribers').update({ is_active: body.is_active }).eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
