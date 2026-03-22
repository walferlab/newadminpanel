'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Loader2, Mail, RefreshCw, Send, Trash2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { useAdminRole } from '@/lib/useAdminRole'

interface Subscriber {
  id: number
  email: string
  name: string | null
  genre_preference: string
  source: string
  subscribed_at: string
  is_active: boolean
}

interface SendLog {
  id: number
  subject: string
  sent_to_count: number
  failed_count: number
  status: string
  genre_filter: string
  created_at: string
}

const TEMPLATES = [
  {
    label: '📚 Weekly Picks',
    subject: 'Your 5 Free Reads This Week 📚',
    html: `<h2 style="color:#fff;margin:0 0 16px;font-family:sans-serif">Your Weekly Book Picks</h2>
<p style="color:#ccc;font-family:sans-serif">Hi there,</p>
<p style="color:#ccc;font-family:sans-serif">Here are this week's handpicked free reads from PDF Lovers:</p>
<h3 style="color:#fff;font-family:sans-serif">📖 Book of the Week</h3>
<p style="color:#ccc;font-family:sans-serif"><strong style="color:#fff">Title:</strong> [Book Name]<br/><strong style="color:#fff">Author:</strong> [Author]<br/><strong style="color:#fff">Why you'll love it:</strong> [2-line hook]</p>
<p><a href="https://pdflovers.app" style="background:#fff;color:#000;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;font-family:sans-serif">Read Now →</a></p>
<p style="color:#777;font-family:sans-serif;margin-top:24px">Happy reading,<br/>The PDF Lovers Team</p>`,
  },
  {
    label: '🎉 New Arrivals',
    subject: 'New books just landed on PDF Lovers 🎉',
    html: `<h2 style="color:#fff;margin:0 0 16px;font-family:sans-serif">Fresh Reads Just Added!</h2>
<p style="color:#ccc;font-family:sans-serif">Hi there,</p>
<p style="color:#ccc;font-family:sans-serif">We've just added new books to the library:</p>
<ul style="color:#ccc;font-family:sans-serif;padding-left:20px">
  <li>[Book 1 — Genre]</li>
  <li>[Book 2 — Genre]</li>
  <li>[Book 3 — Genre]</li>
</ul>
<p><a href="https://pdflovers.app/library" style="background:#fff;color:#000;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;font-family:sans-serif">Browse Library →</a></p>
<p style="color:#777;font-family:sans-serif;margin-top:24px">Happy reading,<br/>The PDF Lovers Team</p>`,
  },
  {
    label: '✍️ Blank',
    subject: '',
    html: `<h2 style="color:#fff;margin:0 0 16px;font-family:sans-serif">Your Title Here</h2>
<p style="color:#ccc;font-family:sans-serif">Hi there,</p>
<p style="color:#ccc;font-family:sans-serif">Write your message here...</p>
<p style="color:#777;font-family:sans-serif;margin-top:24px">The PDF Lovers Team</p>`,
  },
]

const GENRE_OPTIONS = [
  { value: 'all',        label: 'All Subscribers' },
  { value: 'fiction',    label: 'Fiction readers' },
  { value: 'nonfiction', label: 'Non-fiction readers' },
  { value: 'classics',   label: 'Classics readers' },
  { value: 'philosophy', label: 'Philosophy readers' },
  { value: 'science',    label: 'Science readers' },
]

export default function NewsletterPage() {
  const role = useAdminRole()
  const canSend = role === 'super_admin' || role === 'admin'

  const [subscribers, setSubscribers]   = useState<Subscriber[]>([])
  const [logs, setLogs]                 = useState<SendLog[]>([])
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState<'subscribers' | 'compose' | 'history'>('subscribers')
  const [subject, setSubject]           = useState('')
  const [html, setHtml]                 = useState(TEMPLATES[0].html)
  const [genre, setGenre]               = useState('all')
  const [sending, setSending]           = useState(false)
  const [showPreview, setShowPreview]   = useState(false)

  // Fetch using the API route (service role — bypasses RLS)
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/newsletter/subscribers', { cache: 'no-store' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Failed to load newsletter data')
        return
      }
      const data = await res.json()
      setSubscribers(data.subscribers ?? [])
      setLogs(data.logs ?? [])
    } catch {
      toast.error('Network error loading newsletter data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  const activeCount = subscribers.filter((s) => s.is_active).length

  async function handleSend() {
    if (!subject.trim() || !html.trim()) return toast.error('Subject and content are required')
    if (!canSend) return toast.error('Only admins can send newsletters')
    setSending(true)
    try {
      const res = await fetch('/api/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, html, genre_filter: genre }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Send failed')
      toast.success(`Sent to ${data.sent ?? 0} subscribers! ✅`)
      void fetchData()
      setTab('history')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  async function toggleSubscriber(id: number, isActive: boolean) {
    const res = await fetch('/api/newsletter/subscribers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !isActive }),
    })
    if (!res.ok) return toast.error('Failed to update')
    setSubscribers((prev) => prev.map((s) => s.id === id ? { ...s, is_active: !isActive } : s))
    toast.success('Updated')
  }

  async function deleteSubscriber(id: number, email: string) {
    if (!confirm(`Delete subscriber ${email}?`)) return
    const res = await fetch('/api/newsletter/subscribers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'delete' }),
    })
    if (!res.ok) return toast.error('Failed to delete')
    setSubscribers((prev) => prev.filter((s) => s.id !== id))
    toast.success('Deleted')
  }

  const card = { background: 'rgba(14,14,14,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }
  const inputStyle = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, color: '#fff', width: '100%', padding: '8px 12px', fontSize: 13, outline: 'none',
  } as React.CSSProperties

  return (
    <div className="animate-fade-in">
      <Header
        title="Newsletter"
        subtitle={`${activeCount} active subscribers`}
        actions={
          <button onClick={() => fetchData()} className="btn-secondary" title="Refresh">
            <RefreshCw size={13} />
          </button>
        }
      />
      <div className="space-y-4 p-4 md:p-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total',      value: subscribers.length,                                    icon: Users },
            { label: 'Active',     value: activeCount,                                           icon: Bell },
            { label: 'Emails Sent', value: logs.reduce((a, l) => a + (l.sent_to_count ?? 0), 0), icon: Send },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} style={card} className="p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Icon size={13} style={{ color: '#444' }} />
                <span style={{ fontSize: 11, color: '#444', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
              </div>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 4 }}>
          {(['subscribers', 'compose', 'history'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 text-xs font-medium capitalize rounded-lg transition-all"
              style={{
                background: tab === t ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: tab === t ? '#fff' : '#555',
                border: tab === t ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
              }}
            >
              {t === 'compose' ? '✉️ Compose' : t === 'subscribers' ? '👥 Subscribers' : '📋 History'}
            </button>
          ))}
        </div>

        {/* Subscribers tab */}
        {tab === 'subscribers' && (
          <div style={card} className="overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-16"><div className="spinner" /></div>
            ) : subscribers.length === 0 ? (
              <p className="py-12 text-center" style={{ color: '#444', fontSize: 14 }}>No subscribers yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Name</th>
                      <th>Genre</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((s) => (
                      <tr key={s.id}>
                        <td style={{ color: '#fff', fontSize: 13 }}>{s.email}</td>
                        <td style={{ fontSize: 12 }}>{s.name ?? '—'}</td>
                        <td><span className="badge badge-gray">{s.genre_preference}</span></td>
                        <td style={{ fontSize: 12 }}>{s.source}</td>
                        <td>
                          <span className={s.is_active ? 'badge badge-green' : 'badge badge-gray'}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {new Date(s.subscribed_at).toLocaleDateString('en-IN')}
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleSubscriber(s.id, s.is_active)}
                              className="text-xs transition-opacity hover:opacity-60"
                              style={{ color: '#666' }}
                            >
                              {s.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button onClick={() => deleteSubscriber(s.id, s.email)}>
                              <Trash2 size={13} style={{ color: '#444' }} className="hover:text-red-400 transition-colors" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Compose tab */}
        {tab === 'compose' && (
          <div style={card} className="p-5 space-y-4">
            {!canSend && (
              <div
                className="flex items-center gap-2 p-3 rounded-xl text-sm"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}
              >
                Only super_admin and admin roles can send newsletters.
              </div>
            )}

            {/* Templates */}
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  onClick={() => { setSubject(t.subject); setHtml(t.html) }}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label style={{ fontSize: 12, color: '#555' }}>Subject line *</label>
              <input
                style={inputStyle}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Your 5 Free Reads This Week 📚"
              />
            </div>

            {/* Audience */}
            <div className="space-y-1.5">
              <label style={{ fontSize: 12, color: '#555' }}>Send to</label>
              <select
                style={{ ...inputStyle, appearance: 'none' } as React.CSSProperties}
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
              >
                {GENRE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} style={{ background: '#111' }}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* HTML body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label style={{ fontSize: 12, color: '#555' }}>Email body (HTML) *</label>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  style={{ fontSize: 12, color: '#555' }}
                  className="hover:text-white transition-colors"
                >
                  {showPreview ? '← Edit' : '👁 Preview'}
                </button>
              </div>
              {showPreview ? (
                <div
                  style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 24, minHeight: 280 }}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ) : (
                <textarea
                  rows={14}
                  style={{ ...inputStyle, padding: '10px 12px', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.6, minHeight: 200 } as React.CSSProperties}
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  placeholder="Write HTML email content..."
                />
              )}
            </div>

            {/* Active subscriber count */}
            <p style={{ fontSize: 12, color: '#444' }}>
              Will send to <strong style={{ color: '#888' }}>{activeCount}</strong> active subscriber{activeCount !== 1 ? 's' : ''}
            </p>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={sending || !canSend || !subject.trim() || !html.trim()}
              className="btn-primary w-full h-11 text-[13px]"
            >
              {sending
                ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
                : <><Send size={14} /> Send Newsletter to {activeCount} subscribers</>
              }
            </button>
          </div>
        )}

        {/* History tab */}
        {tab === 'history' && (
          <div style={card} className="overflow-hidden">
            {logs.length === 0 ? (
              <p className="py-12 text-center" style={{ color: '#444', fontSize: 14 }}>No emails sent yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Audience</th>
                      <th>Sent</th>
                      <th>Failed</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td style={{ color: '#fff', maxWidth: 240 }}>
                          <p className="truncate">{l.subject}</p>
                        </td>
                        <td><span className="badge badge-gray">{l.genre_filter}</span></td>
                        <td style={{ color: '#4ade80', fontWeight: 600 }}>{l.sent_to_count}</td>
                        <td style={{ color: l.failed_count > 0 ? '#f87171' : '#555' }}>{l.failed_count}</td>
                        <td>
                          <span className={
                            l.status === 'done'    ? 'badge badge-green' :
                            l.status === 'failed'  ? 'badge badge-red' :
                            l.status === 'sending' ? 'badge badge-blue' :
                            'badge badge-amber'
                          }>
                            {l.status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {new Date(l.created_at).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
