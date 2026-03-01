import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

  const { error } = await supabase.from('admins').upsert(
    {
      clerk_id: userId,
      email,
      name,
      approved: false,
      role: 'uploader',
    },
    { onConflict: 'clerk_id' },
  )

  if (error) {
    console.error('Admin sync failed:', error)
    return NextResponse.json({ error: 'Failed to sync admin request' }, { status: 500 })
  }

  return NextResponse.json({ synced: true }, { status: 200 })
}
