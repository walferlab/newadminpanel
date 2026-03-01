import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

interface ClerkEmailAddress {
  email_address?: string
}

interface ClerkUserCreatedEvent {
  type: 'user.created'
  data: {
    id: string
    email_addresses?: ClerkEmailAddress[]
    first_name?: string | null
    last_name?: string | null
  }
}

type ClerkWebhookEvent = ClerkUserCreatedEvent | { type: string; data: unknown }

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

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Missing Clerk webhook secret' }, { status: 500 })
  }

  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Missing Supabase admin configuration' },
      { status: 500 },
    )
  }

  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing Svix headers' }, { status: 400 })
  }

  const payload = await req.text()
  const wh = new Webhook(webhookSecret)
  let event: ClerkWebhookEvent

  try {
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent
  } catch (error) {
    console.error('Clerk webhook verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'user.created') {
    const createdEvent = event as ClerkUserCreatedEvent
    const { id, email_addresses, first_name, last_name } = createdEvent.data
    const email = email_addresses?.[0]?.email_address?.trim().toLowerCase() ?? ''
    const name = [first_name, last_name].filter(Boolean).join(' ').trim() || email || 'New User'

    if (!id || !email) {
      return NextResponse.json({ error: 'Missing user id or email in webhook payload' }, { status: 400 })
    }

    const payload = {
      clerk_id: id,
      email,
      name,
      position: 'Pending Approval',
      approved: false,
      role: 'uploader',
    }

    let { error } = await supabase
      .from('admins')
      .upsert(payload, { onConflict: 'clerk_id' })

    // Fallback for older schemas where clerk_id is not unique yet but email is unique.
    if (error) {
      const fallback = await supabase.from('admins').upsert(payload, { onConflict: 'email' })
      error = fallback.error
    }

    if (error) {
      console.error('Supabase upsert error for Clerk webhook:', error)
      return NextResponse.json({ error: 'DB insert failed' }, { status: 500 })
    }

    console.log(`Created/updated pending admin for ${email}`)
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
