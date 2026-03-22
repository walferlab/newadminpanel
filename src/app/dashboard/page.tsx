'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownRight, ArrowUpRight,
  Bell, BookOpen, Download,
  FileText, MessageSquare, Newspaper,
  RefreshCw, Star, TrendingUp, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { SimpleAreaChart } from '@/components/charts/Charts'

interface DashboardData {
  stats: {
    totalBooks: number
    totalDownloads: number
    downloadsThisMonth: number
    dlGrowth: number | null
    featuredCount: number
    publishedBlogs: number
    totalBlogs: number
    pendingRequests: number
    unreadMessages: number
    activeSubscribers: number
    emailsSent: number
  }
  trendData: Array<{ date: string; downloads: number }>
  topBooks: Array<{ id: number; title: string; download_count: number; category: string | null; is_featured: boolean }>
  topBlogs: Array<{ id: number; title: string; slug: string; category: string | null; useful_count: number }>
  categories: Array<{ name: string; count: number }>
  recentBooks: Array<{ id: number; title: string; download_count: number; category: string | null; is_featured: boolean; created_at: string }>
}

function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: string }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: 6 }} />
}

export default function DashboardPage() {
  const [data, setData]       = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchData(bg = false) {
    if (bg) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void fetchData() }, [])

  const card: React.CSSProperties = {
    background: 'rgba(14,14,14,0.95)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
  }

  const s = data?.stats

  const statCards = [
    { label: 'Total Books',       value: s?.totalBooks ?? 0,          icon: BookOpen,      href: '/books',        color: '#a78bfa' },
    { label: 'Total Downloads',   value: s?.totalDownloads ?? 0,      icon: Download,      href: '/books',        color: '#60a5fa' },
    { label: 'This Month',        value: s?.downloadsThisMonth ?? 0,  icon: TrendingUp,    href: '/books',        color: '#4ade80',
      badge: s?.dlGrowth != null ? s.dlGrowth : null },
    { label: 'Published Blogs',   value: s?.publishedBlogs ?? 0,      icon: Newspaper,     href: '/blogs',        color: '#fb923c' },
    { label: 'Subscribers',       value: s?.activeSubscribers ?? 0,   icon: Bell,          href: '/newsletter',   color: '#fbbf24' },
    { label: 'Featured Books',    value: s?.featuredCount ?? 0,       icon: Star,          href: '/books',        color: '#f472b6' },
    { label: 'Pending Inbox',     value: (s?.pendingRequests ?? 0) + (s?.unreadMessages ?? 0),
      icon: MessageSquare, href: '/data-imports', color: '#f87171' },
    { label: 'Emails Sent',       value: s?.emailsSent ?? 0,          icon: Users,         href: '/newsletter',   color: '#34d399' },
  ]

  return (
    <div className="animate-fade-in">
      <Header
        title="Dashboard"
        subtitle="Platform analytics & overview"
        actions={
          <button onClick={() => fetchData(true)} disabled={refreshing} className="btn-secondary">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      <div className="space-y-5 p-4 md:p-5">

        {/* ── Stat Grid ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {statCards.map(({ label, value, icon: Icon, href, color, badge }) => (
            <Link key={label} href={href}>
              <div
                style={{ ...card, padding: '14px 16px', cursor: 'pointer' }}
                className="flex flex-col gap-2 hover:border-white/10 transition-colors duration-150"
              >
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 10, color: '#444', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600 }}>
                    {label}
                  </span>
                  <Icon size={13} style={{ color }} />
                </div>
                {loading ? <Skeleton h={24} /> : (
                  <div className="flex items-end gap-1.5">
                    <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>
                      {value.toLocaleString()}
                    </span>
                    {badge != null && (
                      <span
                        className="flex items-center gap-0.5 text-[10px] font-semibold mb-0.5"
                        style={{ color: badge >= 0 ? '#4ade80' : '#f87171' }}
                      >
                        {badge >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {Math.abs(badge)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* ── Chart + Category Breakdown ── */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Download trend */}
          <div style={{ ...card, padding: 20 }} className="xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Downloads — Last 14 Days</h2>
                <p style={{ fontSize: 12, color: '#444', marginTop: 2 }}>Daily download events</p>
              </div>
              {s && <span className="badge badge-green">Live</span>}
            </div>
            {loading ? <Skeleton h={160} /> : (
              <SimpleAreaChart
                data={data?.trendData ?? []}
                dataKey="downloads"
                xKey="date"
                color="#a78bfa"
                height={160}
              />
            )}
          </div>

          {/* Category breakdown */}
          <div style={{ ...card, padding: 20 }}>
            <h2 style={{ fontWeight: 600, fontSize: 14, color: '#fff', marginBottom: 4 }}>Books by Category</h2>
            <p style={{ fontSize: 12, color: '#444', marginBottom: 16 }}>Top 6 categories</p>
            {loading ? (
              <div className="space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} h={28} />)}</div>
            ) : data?.categories.length === 0 ? (
              <p style={{ color: '#444', fontSize: 13 }}>No data yet.</p>
            ) : (
              <div className="space-y-2">
                {data?.categories.map(({ name, count }) => {
                  const max = data.categories[0]?.count ?? 1
                  const pct = Math.round((count / max) * 100)
                  return (
                    <div key={name}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ fontSize: 12, color: '#bbb' }} className="truncate max-w-[150px]">{name}</span>
                        <span style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>{count}</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 4 }}>
                        <div style={{ background: '#a78bfa', borderRadius: 4, height: 4, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Top Books + Top Blogs ── */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">

          {/* Top 5 Books by Downloads */}
          <div style={card}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <h2 style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Top 5 Books</h2>
                <p style={{ fontSize: 12, color: '#444', marginTop: 1 }}>By total downloads</p>
              </div>
              <Link href="/books" style={{ fontSize: 12, color: '#555' }} className="hover:text-white transition-colors">View all →</Link>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} h={36} />)}</div>
            ) : (data?.topBooks ?? []).length === 0 ? (
              <p className="p-5" style={{ color: '#444', fontSize: 13 }}>No books yet.</p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {(data?.topBooks ?? []).map((book, idx) => (
                  <Link key={book.id} href={`/pdfs/${book.id}`}>
                    <div className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]">
                      {/* Rank */}
                      <span style={{ fontSize: 12, color: '#333', fontWeight: 700, width: 18, textAlign: 'center', flexShrink: 0 }}>
                        {idx + 1}
                      </span>
                      {/* Icon */}
                      <div
                        className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md"
                        style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.12)' }}
                      >
                        <BookOpen size={11} style={{ color: '#a78bfa' }} />
                      </div>
                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate" style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500 }}>{book.title}</p>
                        <p style={{ fontSize: 11, color: '#444', marginTop: 1 }}>{book.category ?? 'Uncategorized'}</p>
                      </div>
                      {/* Downloads */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Download size={11} style={{ color: '#555' }} />
                        <span style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>{book.download_count}</span>
                        {book.is_featured && <Star size={11} style={{ color: '#fbbf24' }} />}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Top 5 Blogs by Feedback */}
          <div style={card}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <h2 style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Top 5 Blogs</h2>
                <p style={{ fontSize: 12, color: '#444', marginTop: 1 }}>By reader feedback</p>
              </div>
              <Link href="/blogs" style={{ fontSize: 12, color: '#555' }} className="hover:text-white transition-colors">View all →</Link>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} h={36} />)}</div>
            ) : (data?.topBlogs ?? []).length === 0 ? (
              <p className="p-5" style={{ color: '#444', fontSize: 13 }}>No published blogs yet.</p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {(data?.topBlogs ?? []).map((blog, idx) => (
                  <Link key={blog.id} href={`/blogs/${blog.id}`}>
                    <div className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]">
                      <span style={{ fontSize: 12, color: '#333', fontWeight: 700, width: 18, textAlign: 'center', flexShrink: 0 }}>
                        {idx + 1}
                      </span>
                      <div
                        className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md"
                        style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.12)' }}
                      >
                        <Newspaper size={11} style={{ color: '#fb923c' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate" style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500 }}>{blog.title}</p>
                        <p style={{ fontSize: 11, color: '#444', marginTop: 1 }}>{blog.category ?? 'Uncategorized'}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span style={{ fontSize: 11, color: '#444' }}>👍</span>
                        <span style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>{blog.useful_count}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Uploads ── */}
        <div style={card}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <h2 style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Recent Uploads</h2>
              <p style={{ fontSize: 12, color: '#444', marginTop: 1 }}>Last 6 books added</p>
            </div>
            <Link href="/books" style={{ fontSize: 12, color: '#555' }} className="hover:text-white transition-colors">View all →</Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 gap-2 p-5 md:grid-cols-2 xl:grid-cols-3">
              {Array(6).fill(0).map((_, i) => <Skeleton key={i} h={60} />)}
            </div>
          ) : (data?.recentBooks ?? []).length === 0 ? (
            <p className="p-5" style={{ color: '#444', fontSize: 13 }}>No books yet. <Link href="/books" style={{ color: '#60a5fa' }}>Add the first one →</Link></p>
          ) : (
            <div className="grid grid-cols-1 gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">
              {(data?.recentBooks ?? []).map((book) => (
                <Link key={book.id} href={`/pdfs/${book.id}`}>
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/[0.03]"
                    style={{ border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div
                      className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.12)' }}
                    >
                      <BookOpen size={11} style={{ color: '#60a5fa' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate" style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500 }}>{book.title}</p>
                      <p style={{ fontSize: 11, color: '#444' }}>
                        {book.category ?? 'Uncategorized'} · {book.download_count} dl
                      </p>
                    </div>
                    {book.is_featured && <Star size={11} style={{ color: '#fbbf24', flexShrink: 0 }} />}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Quick Actions ── */}
        <div style={{ ...card, padding: 20 }}>
          <h2 style={{ fontWeight: 600, fontSize: 14, color: '#fff', marginBottom: 4 }}>Quick Actions</h2>
          <p style={{ fontSize: 12, color: '#444', marginBottom: 16 }}>Jump to common tasks</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Add a book',      href: '/books',        icon: BookOpen,      color: '#a78bfa' },
              { label: 'Write a blog',    href: '/blogs/new',    icon: Newspaper,     color: '#fb923c' },
              { label: 'Send newsletter', href: '/newsletter',   icon: Bell,          color: '#fbbf24' },
              { label: 'View inbox',      href: '/data-imports', icon: MessageSquare, color: '#f87171',
                badge: (s?.pendingRequests ?? 0) + (s?.unreadMessages ?? 0) },
            ].map(({ label, href, icon: Icon, color, badge }) => (
              <Link key={href} href={href}>
                <div
                  className="flex items-center gap-2.5 px-3 py-3 rounded-xl transition-colors hover:bg-white/[0.04]"
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${color}18` }}
                  >
                    <Icon size={13} style={{ color }} />
                  </div>
                  <span style={{ fontSize: 13, color: '#bbb', fontWeight: 500 }}>{label}</span>
                  {badge != null && badge > 0 && (
                    <span className="badge badge-red ml-auto">{badge}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
