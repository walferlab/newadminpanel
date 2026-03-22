'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Clock, Loader2, Mail, MessageSquare, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { formatDate } from '@/lib/utils'

interface ContactMessage {
  id: number
  name: string
  email: string
  message: string
  created_at: string
  status: boolean
}

interface PDFRequest {
  id: number
  name: string
  email: string
  details: string
  created_at: string
  status: 'reviewing' | 'approved' | 'rejected'
}

export default function InboxPage() {
  const [tab, setTab]             = useState<'messages' | 'requests'>('messages')
  const [messages, setMessages]   = useState<ContactMessage[]>([])
  const [requests, setRequests]   = useState<PDFRequest[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded]   = useState<number | null>(null)

  // Uses /api/inbox which runs with service_role key — bypasses RLS restrictions
  const fetchData = useCallback(async (background = false) => {
    if (background) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/inbox', { method: 'GET', cache: 'no-store' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Failed to load inbox')
        return
      }
      const data = await res.json()
      setMessages(data.messages ?? [])
      setRequests(data.requests ?? [])
    } catch {
      toast.error('Network error loading inbox')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  async function markRead(id: number) {
    const res = await fetch('/api/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'message', id, status: true }),
    })
    if (!res.ok) return toast.error('Failed to mark as read')
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, status: true } : m))
    toast.success('Marked as read')
  }

  async function markAllRead() {
    const res = await fetch('/api/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'messages_all', status: true }),
    })
    if (!res.ok) return toast.error('Failed to mark all as read')
    setMessages((prev) => prev.map((m) => ({ ...m, status: true })))
    toast.success('All messages marked as read')
  }

  async function updateRequestStatus(id: number, status: 'approved' | 'rejected') {
    const res = await fetch('/api/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'request', id, status }),
    })
    if (!res.ok) return toast.error('Failed to update request')
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r))
    toast.success(`Request ${status}`)
  }

  const card = { background: 'rgba(14,14,14,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }
  const unreadCount = messages.filter((m) => !m.status).length
  const pendingCount = requests.filter((r) => r.status === 'reviewing').length

  return (
    <div className="animate-fade-in">
      <Header
        title="Inbox"
        subtitle={`${unreadCount} unread · ${pendingCount} pending requests`}
        actions={
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="btn-secondary"
            title="Refresh"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />
      <div className="space-y-4 p-4 md:p-5">

        {/* Tabs */}
        <div className="flex gap-1" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 4 }}>
          <button
            onClick={() => setTab('messages')}
            className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all"
            style={{
              background: tab === 'messages' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: tab === 'messages' ? '#fff' : '#555',
              border: tab === 'messages' ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
            }}
          >
            <Mail size={12} />
            Messages
            {unreadCount > 0 && <span className="badge badge-amber">{unreadCount}</span>}
          </button>
          <button
            onClick={() => setTab('requests')}
            className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all"
            style={{
              background: tab === 'requests' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: tab === 'requests' ? '#fff' : '#555',
              border: tab === 'requests' ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
            }}
          >
            <MessageSquare size={12} />
            PDF Requests
            {pendingCount > 0 && <span className="badge badge-amber">{pendingCount}</span>}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner" />
          </div>
        ) : tab === 'messages' ? (
          <>
            {/* Mark all read button */}
            {unreadCount > 0 && (
              <div className="flex justify-end">
                <button onClick={markAllRead} className="btn-secondary text-xs py-1.5 px-3">
                  <CheckCircle size={12} /> Mark all read
                </button>
              </div>
            )}

            <div className="space-y-2">
              {messages.length === 0 ? (
                <p className="py-12 text-center" style={{ color: '#444', fontSize: 14 }}>No messages yet.</p>
              ) : messages.map((m) => (
                <div
                  key={m.id}
                  style={{ ...card, opacity: m.status ? 0.55 : 1, cursor: 'pointer' }}
                  onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Unread dot */}
                        {!m.status && (
                          <span
                            className="mt-1.5 shrink-0 h-2 w-2 rounded-full"
                            style={{ background: '#60a5fa' }}
                          />
                        )}
                        <div className="min-w-0">
                          <p style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>{m.name}</p>
                          <p style={{ fontSize: 12, color: '#555', marginTop: 1 }}>{m.email}</p>
                          {/* Collapsed preview */}
                          {expanded !== m.id && (
                            <p className="mt-1.5 line-clamp-1" style={{ fontSize: 13, color: '#666' }}>
                              {m.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span style={{ fontSize: 11, color: '#444' }}>
                          {formatDate(m.created_at, 'relative')}
                        </span>
                        {!m.status && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markRead(m.id) }}
                            className="badge badge-blue hover:opacity-75 transition-opacity"
                          >
                            <CheckCircle size={10} /> Read
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Expanded message */}
                    {expanded === m.id && (
                      <div
                        className="mt-3 pt-3"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <p style={{ fontSize: 13, color: '#bbb', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                          {m.message}
                        </p>
                        <a
                          href={`mailto:${m.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 mt-3 text-xs transition-opacity hover:opacity-70"
                          style={{ color: '#60a5fa' }}
                        >
                          <Mail size={11} /> Reply via email
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {requests.length === 0 ? (
              <p className="py-12 text-center" style={{ color: '#444', fontSize: 14 }}>No PDF requests yet.</p>
            ) : requests.map((r) => (
              <div key={r.id} style={card}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>{r.name}</p>
                        <span className={
                          r.status === 'approved' ? 'badge badge-green' :
                          r.status === 'rejected' ? 'badge badge-red' :
                          'badge badge-amber'
                        }>
                          {r.status === 'reviewing'
                            ? <><Clock size={10} /> Reviewing</>
                            : r.status === 'approved' ? <><CheckCircle size={10} /> Approved</> : 'Rejected'
                          }
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: '#555' }}>{r.email}</p>
                      <p className="mt-2" style={{ fontSize: 13, color: '#aaa', lineHeight: 1.65 }}>
                        {r.details}
                      </p>
                      <p className="mt-2" style={{ fontSize: 11, color: '#444' }}>
                        {formatDate(r.created_at, 'relative')}
                      </p>
                    </div>
                    {r.status === 'reviewing' && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => updateRequestStatus(r.id, 'approved')}
                          className="btn-secondary text-xs py-1.5 px-3"
                          style={{ color: '#4ade80', borderColor: 'rgba(34,197,94,0.2)' }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateRequestStatus(r.id, 'rejected')}
                          className="btn-danger text-xs py-1.5 px-3"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
