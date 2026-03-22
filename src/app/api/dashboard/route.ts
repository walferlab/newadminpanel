import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getServiceClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET() {
  const supabase = getServiceClient()
  if (!supabase) return NextResponse.json({ error: 'Server config error' }, { status: 500 })

  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const since14d = new Date(Date.now() - 14 * 86_400_000).toISOString()

  try {
    const [
      pdfsRes, downloadsRes, downloads14dRes,
      requestsRes, messagesRes,
      blogsRes, blogFeedbackRes,
      subsRes, sendLogsRes,
    ] = await Promise.all([
      supabase.from('pdfs').select('id, title, download_count, is_featured, category, created_at').order('created_at', { ascending: false }),
      supabase.from('download_events').select('id, created_at').gte('created_at', since30d),
      supabase.from('download_events').select('id, created_at').gte('created_at', since14d),
      supabase.from('pdf_requests').select('id, status'),
      supabase.from('contact_messages').select('id').eq('status', false),
      supabase.from('blogs').select('id, title, slug, category, is_published, created_at').order('created_at', { ascending: false }),
      supabase.from('blog_feedback').select('blog_id, is_useful'),
      supabase.from('newsletter_subscribers').select('id').eq('is_active', true),
      supabase.from('newsletter_send_logs').select('sent_to_count').eq('status', 'done'),
    ])

    const pdfs = pdfsRes.data ?? []
    const downloads30d = downloadsRes.data ?? []
    const downloads14d = downloads14dRes.data ?? []
    const blogs = blogsRes.data ?? []
    const feedback = blogFeedbackRes.data ?? []

    const totalDownloads = pdfs.reduce((s, p) => s + (p.download_count ?? 0), 0)
    const featuredCount = pdfs.filter((p) => p.is_featured).length
    const publishedBlogs = blogs.filter((b) => b.is_published).length

    // 14-day download trend
    const trendMap: Record<string, number> = {}
    downloads14d.forEach((d) => {
      const day = d.created_at.split('T')[0]
      trendMap[day] = (trendMap[day] ?? 0) + 1
    })
    const trendData = Array.from({ length: 14 }, (_, i) => {
      const dt = new Date()
      dt.setDate(dt.getDate() - (13 - i))
      const key = dt.toISOString().split('T')[0]
      return { date: key.slice(5), downloads: trendMap[key] ?? 0 }
    })

    // Top 5 books by download_count
    const topBooks = [...pdfs]
      .sort((a, b) => (b.download_count ?? 0) - (a.download_count ?? 0))
      .slice(0, 5)
      .map((p) => ({ id: p.id, title: p.title, download_count: p.download_count ?? 0, category: p.category, is_featured: p.is_featured }))

    // Top 5 blogs by useful feedback
    const blogUseful: Record<number, number> = {}
    feedback.forEach((f) => {
      if (f.is_useful) blogUseful[f.blog_id] = (blogUseful[f.blog_id] ?? 0) + 1
    })
    const topBlogs = blogs
      .filter((b) => b.is_published)
      .map((b) => ({ ...b, useful_count: blogUseful[b.id] ?? 0 }))
      .sort((a, b) => b.useful_count - a.useful_count)
      .slice(0, 5)

    // Category breakdown
    const catMap: Record<string, number> = {}
    pdfs.forEach((p) => {
      const cat = p.category ?? 'Uncategorized'
      catMap[cat] = (catMap[cat] ?? 0) + 1
    })
    const categories = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }))

    // Downloads this month vs last month
    const since60d = new Date(Date.now() - 60 * 86_400_000).toISOString()
    const downloadsAllRes = await supabase
      .from('download_events')
      .select('created_at')
      .gte('created_at', since60d)
    const allDl = downloadsAllRes.data ?? []
    const thisMonth = allDl.filter((d) => new Date(d.created_at) >= new Date(since30d)).length
    const lastMonth = allDl.filter((d) => new Date(d.created_at) < new Date(since30d)).length
    const dlGrowth = lastMonth === 0 ? null : Math.round(((thisMonth - lastMonth) / lastMonth) * 100)

    return NextResponse.json({
      stats: {
        totalBooks:        pdfs.length,
        totalDownloads,
        downloadsThisMonth: thisMonth,
        dlGrowth,
        featuredCount,
        publishedBlogs,
        totalBlogs:        blogs.length,
        pendingRequests:   (requestsRes.data ?? []).filter((r) => r.status === 'reviewing').length,
        unreadMessages:    messagesRes.data?.length ?? 0,
        activeSubscribers: subsRes.data?.length ?? 0,
        emailsSent:        (sendLogsRes.data ?? []).reduce((s, l) => s + (l.sent_to_count ?? 0), 0),
      },
      trendData,
      topBooks,
      topBlogs,
      categories,
      recentBooks: pdfs.slice(0, 6).map((p) => ({
        id: p.id, title: p.title,
        download_count: p.download_count ?? 0,
        category: p.category,
        is_featured: p.is_featured,
        created_at: p.created_at,
      })),
    })
  } catch (err) {
    console.error('Dashboard API error:', err)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
