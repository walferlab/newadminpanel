import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const ALLOWED_ROUTES = new Set(['/dashboard', '/books', '/blogs', '/newsletter', '/ads', '/data-imports', '/approvals'])

export default async function HomePage() {
  const cookieStore = await cookies()
  const preferred = cookieStore.get('pdflovers_default_page')?.value ?? '/dashboard'
  redirect(ALLOWED_ROUTES.has(preferred) ? preferred : '/dashboard')
}
