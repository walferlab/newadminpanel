'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Clock, Mail, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'
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
  const [expanded, setExpanded]   = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [msgRes, reqRes] = await Promise.all([
      supabase.from('contact_messages').select('*').order('created_at', { ascending: false }),
      supabase.from('pdf_requests').select('*').order('created_at', { ascending: false }),
    ])
    setMessages((msgRes.data ?? []) as ContactMessage[])
    setRequests((reqRes.data ?? []) as PDFRequest[])
    setLoading(false)
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  async function markRead(id: number) {
    const { error } = await supabase.from('contact_messages').update({ status: true }).eq('id', id)
    if (error) return toast.error('Failed to update')
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, status: true } : m))
  }

  async function updateRequestStatus(id: number, status: 'approved' | 'rejected') {
    const { error } = await supabase.from('pdf_requests').update({ status }).eq('id', id)
    if (error) return toast.error('Failed to update')
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
        subtitle={`${unreadCount} unread messages · ${pendingCount} pending requests`}
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
            <Mail size={12} /> Messages
            {unreadCount > 0 && <span className="badge badge-amber ml-1">{unreadCount}</span>}
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
            <MessageSquare size={12} /> PDF Requests
            {pendingCount > 0 && <span className="badge badge-amber ml-1">{pendingCount}</span>}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : tab === 'messages' ? (
          <div className="space-y-2">
            {messages.length === 0 ? (
              <p style={{ color: '#444', fontSize: 14, textAlign: 'center', padding: '48px 0' }}>No messages.</p>
            ) : messages.map((m) => (
              <div key={m.id} style={{ ...card, padding: 0, opacity: m.status ? 0.6 : 1 }}>
                <button
                  className="w-full text-left p-4 transition-all"
                  onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {!m.status && <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-400 shrink-0" />}
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>{m.name}</p>
                        <p style={{ fontSize: 12, color: '#555' }}>{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span style={{ fontSize: 11, color: '#444' }}>{formatDate(m.created_at, 'relative')}</span>
                      {!m.status && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markRead(m.id) }}
                          className="badge badge-blue hover:opacity-80 transition-opacity"
                        >
                          <CheckCircle size={10} /> Mark read
                        </button>
                      )}
                    </div>
                  </div>
                  {expanded === m.id && (
                    <p style={{ fontSize: 13, color: '#aaa', marginTop: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {m.message}
                    </p>
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {requests.length === 0 ? (
              <p style={{ color: '#444', fontSize: 14, textAlign: 'center', padding: '48px 0' }}>No requests.</p>
            ) : requests.map((r) => (
              <div key={r.id} style={{ ...card, padding: 16 }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>{r.name}</p>
                      <span className={
                        r.status === 'approved' ? 'badge badge-green' :
                        r.status === 'rejected' ? 'badge badge-red' :
                        'badge badge-amber'
                      }>
                        {r.status === 'reviewing' ? <><Clock size={10} /> Reviewing</> : r.status}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: '#555' }}>{r.email}</p>
                    <p style={{ fontSize: 13, color: '#aaa', marginTop: 8, lineHeight: 1.6 }}>{r.details}</p>
                    <p style={{ fontSize: 11, color: '#444', marginTop: 6 }}>{formatDate(r.created_at, 'relative')}</p>
                  </div>
                  {r.status === 'reviewing' && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => updateRequestStatus(r.id, 'approved')} className="btn-secondary text-xs py-1.5 px-3" style={{ color: '#4ade80', borderColor: 'rgba(34,197,94,0.2)' }}>Approve</button>
                      <button onClick={() => updateRequestStatus(r.id, 'rejected')} className="btn-danger text-xs py-1.5 px-3">Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
