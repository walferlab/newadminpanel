import Link from 'next/link'
import { Bell, BookOpen, Download, FileText, MessageSquare, Newspaper, Star } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { SimpleAreaChart } from '@/components/charts/Charts'
import { createServerSupabaseClient } from '@/lib/supabase'
import { formatDate, formatNumber } from '@/lib/utils'

async function getStats() {
  const supabase = createServerSupabaseClient()
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()

  try {
    const [pdfsRes, downloadsRes, requestsRes, messagesRes, blogsRes, subsRes] = await Promise.all([
      supabase.from('pdfs').select('id, title, download_count, created_at, is_featured').order('created_at', { ascending: false }),
      supabase.from('download_events').select('id, created_at').gte('created_at', since),
      supabase.from('pdf_requests').select('id, status'),
      supabase.from('contact_messages').select('id').eq('status', false),
      supabase.from('blogs').select('id, is_published').eq('is_published', true),
      supabase.from('newsletter_subscribers').select('id').eq('is_active', true),
    ])

    const pdfs = pdfsRes.data ?? []
    const downloads = downloadsRes.data ?? []
    const totalDownloads = pdfs.reduce((s, r) => s + (r.download_count ?? 0), 0)
    const featuredCount = pdfs.filter((r) => r.is_featured).length

    // 14-day trend
    const trend: Record<string, number> = {}
    downloads.forEach((r) => {
      const day = r.created_at.split('T')[0]
      trend[day] = (trend[day] ?? 0) + 1
    })
    const trendData = Array.from({ length: 14 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (13 - i))
      const key = d.toISOString().split('T')[0]
      return { date: key.slice(5), downloads: trend[key] ?? 0 }
    })

    return {
      totalBooks: pdfs.length,
      totalDownloads,
      featuredCount,
      pendingRequests: (requestsRes.data ?? []).filter((r) => r.status === 'reviewing').length,
      unreadMessages: messagesRes.data?.length ?? 0,
      publishedBlogs: blogsRes.data?.length ?? 0,
      activeSubscribers: subsRes.data?.length ?? 0,
      trendData,
      recentBooks: pdfs.slice(0, 6).map((b) => ({
        id: b.id,
        title: b.title,
        created_at: formatDate(b.created_at, 'relative'),
        download_count: b.download_count ?? 0,
        is_featured: b.is_featured,
      })),
    }
  } catch {
    return {
      totalBooks: 0, totalDownloads: 0, featuredCount: 0, pendingRequests: 0,
      unreadMessages: 0, publishedBlogs: 0, activeSubscribers: 0,
      trendData: Array.from({ length: 14 }, (_, i) => ({ date: `${i + 1}`, downloads: 0 })),
      recentBooks: [],
    }
  }
}

export default async function DashboardPage() {
  const stats = await getStats()

  const card = { background: 'rgba(14,14,14,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }

  const statCards = [
    { label: 'Total Books',    value: formatNumber(stats.totalBooks),    icon: BookOpen,  href: '/books',       color: '#a78bfa' },
    { label: 'Downloads',      value: formatNumber(stats.totalDownloads),icon: Download,  href: '/books',       color: '#60a5fa' },
    { label: 'Published Blogs',value: stats.publishedBlogs,              icon: Newspaper, href: '/blogs',       color: '#4ade80' },
    { label: 'Subscribers',    value: stats.activeSubscribers,           icon: Bell,      href: '/newsletter',  color: '#fbbf24' },
    { label: 'Featured Books', value: stats.featuredCount,               icon: Star,      href: '/books',       color: '#f472b6' },
    { label: 'Pending Inbox',  value: stats.pendingRequests + stats.unreadMessages, icon: MessageSquare, href: '/data-imports', color: '#fb923c' },
  ]

  return (
    <div className="animate-fade-in">
      <Header title="Dashboard" subtitle="Platform overview" />
      <div className="space-y-5 p-4 md:p-5">

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {statCards.map(({ label, value, icon: Icon, href, color }) => (
            <Link key={label} href={href}>
              <div
                style={card}
                className="p-4 flex flex-col gap-3 cursor-pointer transition-all duration-150 hover:border-white/10"
              >
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11, color: '#555', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
                  <Icon size={14} style={{ color }} />
                </div>
                <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>
                  {value}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Chart + Quick stats */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div style={{ ...card, padding: 20 }} className="xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Downloads (14 days)</h2>
                <p style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Daily download events</p>
              </div>
              <span className="badge badge-green">Live</span>
            </div>
            <SimpleAreaChart data={stats.trendData} dataKey="downloads" xKey="date" color="#a78bfa" height={160} />
          </div>

          <div style={{ ...card, padding: 20 }}>
            <h2 style={{ fontWeight: 600, fontSize: 14, color: '#fff', marginBottom: 4 }}>Quick Actions</h2>
            <p style={{ fontSize: 12, color: '#555', marginBottom: 16 }}>Jump to tasks</p>
            <div className="space-y-2">
              {[
                { label: 'Add a new book', href: '/books',        icon: BookOpen,  count: null },
                { label: 'Write a blog post', href: '/blogs/new', icon: Newspaper, count: null },
                { label: 'View inbox',    href: '/data-imports',  icon: MessageSquare, count: stats.unreadMessages + stats.pendingRequests },
                { label: 'Send newsletter', href: '/newsletter',  icon: Bell,     count: stats.activeSubscribers },
              ].map(({ label, href, icon: Icon, count }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150"
                  style={{ border: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)' }}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={14} style={{ color: '#555' }} />
                    <span style={{ fontSize: 13, color: '#bbb', fontWeight: 500 }}>{label}</span>
                  </div>
                  {count !== null && count > 0 && (
                    <span className="badge badge-amber">{count}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Recent books */}
        <div style={{ ...card, padding: 20 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Recent Uploads</h2>
            <Link href="/books" style={{ fontSize: 12, color: '#555' }} className="hover:text-white transition-colors">View all →</Link>
          </div>
          {stats.recentBooks.length === 0 ? (
            <p style={{ fontSize: 13, color: '#444' }}>No books yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {stats.recentBooks.map((book) => (
                <Link key={book.id} href={`/pdfs/${book.id}`}>
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                    style={{ border: '1px solid rgba(255,255,255,0.05)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)' }}
                  >
                    <div
                      className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.15)' }}
                    >
                      <BookOpen size={12} style={{ color: '#a78bfa' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate" style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{book.title}</p>
                      <p style={{ fontSize: 11, color: '#444' }}>
                        {book.created_at} · {book.download_count.toLocaleString()} dl
                      </p>
                    </div>
                    {book.is_featured && <Star size={12} style={{ color: '#fbbf24', flexShrink: 0 }} />}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
