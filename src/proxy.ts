import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/awaiting-approval',
  '/api/webhooks/clerk(.*)',
])

async function getApprovalStatus(userId: string): Promise<boolean | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return null
  }

  const endpoint = new URL(`${url}/rest/v1/admins`)
  endpoint.searchParams.set('select', 'approved')
  endpoint.searchParams.set('clerk_id', `eq.${userId}`)
  endpoint.searchParams.set('limit', '1')

  try {
    const response = await fetch(endpoint.toString(), {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const rows = (await response.json()) as Array<{ approved?: boolean }>
    if (!rows.length) {
      return false
    }

    return Boolean(rows[0]?.approved)
  } catch {
    return null
  }
}

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  const { userId } = await auth()

  if (!userId) {
    return NextResponse.next()
  }

  const approval = await getApprovalStatus(userId)
  const isAwaitingApprovalPath = req.nextUrl.pathname.startsWith('/awaiting-approval')

  if (approval !== true && !isAwaitingApprovalPath) {
    return NextResponse.redirect(new URL('/awaiting-approval', req.url))
  }

  if (approval === true && isAwaitingApprovalPath) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}

