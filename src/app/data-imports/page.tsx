'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'
import { cn, formatDate } from '@/lib/utils'
import type { ContactMessage, PDFRequest } from '@/types'

type RequestStatus = PDFRequest['status']

const REQUEST_STATUSES: RequestStatus[] = ['reviewing', 'approved', 'rejected']

function getRequestStatusColor(status: RequestStatus): string {
  if (status === 'approved') {
    return 'border-accent-emerald/20 bg-accent-emerald/10 text-accent-emerald'
  }

  if (status === 'rejected') {
    return 'border-accent-red/20 bg-accent-red/10 text-accent-red'
  }

  return 'border-accent-amber/20 bg-accent-amber/10 text-accent-amber'
}

export default function DataImportsPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [requests, setRequests] = useState<PDFRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [savingMessageId, setSavingMessageId] = useState<number | null>(null)
  const [savingRequestId, setSavingRequestId] = useState<number | null>(null)

  const unreadMessages = useMemo(
    () => messages.filter((message) => !message.status).length,
    [messages],
  )

  const reviewingRequests = useMemo(
    () => requests.filter((request) => request.status === 'reviewing').length,
    [requests],
  )

  const fetchInbox = useCallback(async () => {
    setLoading(true)

    const [messagesRes, requestsRes] = await Promise.all([
      supabase
        .from('contact_messages')
        .select('id, name, email, message, status, created_at')
        .order('created_at', { ascending: false })
        .limit(80),
      supabase
        .from('pdf_requests')
        .select('id, name, email, details, status, user_id, created_at')
        .order('created_at', { ascending: false })
        .limit(80),
    ])

    if (messagesRes.error || requestsRes.error) {
      toast.error('Failed to load inbox data from Supabase')
      setLoading(false)
      return
    }

    const normalizedMessages = ((messagesRes.data ?? []) as ContactMessage[]).map((message) => ({
      ...message,
      status: Boolean(message.status),
    }))

    const normalizedRequests = ((requestsRes.data ?? []) as PDFRequest[]).map((request) => ({
      ...request,
      status: REQUEST_STATUSES.includes(request.status) ? request.status : 'reviewing',
    }))

    setMessages(normalizedMessages)
    setRequests(normalizedRequests)
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchInbox()
  }, [fetchInbox])

  useEffect(() => {
    const channel = supabase
      .channel('data-imports-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_messages',
        },
        () => {
          void fetchInbox()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pdf_requests',
        },
        () => {
          void fetchInbox()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchInbox])

  async function updateMessageStatus(id: number, status: boolean) {
    setSavingMessageId(id)

    const { error } = await supabase.from('contact_messages').update({ status }).eq('id', id)

    if (error) {
      toast.error('Failed to update message status')
      setSavingMessageId(null)
      return
    }

    setMessages((prev) =>
      prev.map((message) => (message.id === id ? { ...message, status } : message)),
    )
    setSavingMessageId(null)
    toast.success(status ? 'Message marked as read' : 'Message marked as unread')
  }

  async function updateRequestStatus(id: number, status: RequestStatus) {
    setSavingRequestId(id)

    const { error } = await supabase.from('pdf_requests').update({ status }).eq('id', id)

    if (error) {
      toast.error('Failed to update request status')
      setSavingRequestId(null)
      return
    }

    setRequests((prev) =>
      prev.map((request) => (request.id === id ? { ...request, status } : request)),
    )
    setSavingRequestId(null)
    toast.success(`Request marked as ${status}`)
  }

  return (
    <div className="animate-fade-in">
      <Header
        title="Inbox"
        subtitle="Handle contact messages and PDF requests from Supabase"
        rightSlot={
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => void fetchInbox()}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        }
      />

      <div className="space-y-6 pb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="glass-card p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Unread Messages</p>
            <p className="mt-2 font-display text-2xl text-text-primary">{unreadMessages}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Requests In Review</p>
            <p className="mt-2 font-display text-2xl text-text-primary">{reviewingRequests}</p>
          </div>
        </div>

        <section id="messages" className="glass-card overflow-hidden">
          <div className="border-b border-border-subtle px-4 py-3">
            <h2 className="text-sm font-medium text-text-primary">Contact Messages</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[980px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`messages-loading-${index}`}>
                      <td colSpan={6}>
                        <div className="skeleton h-8 rounded" />
                      </td>
                    </tr>
                  ))}

                {!loading &&
                  messages.map((row) => {
                    const isSaving = savingMessageId === row.id

                    return (
                      <tr key={row.id}>
                        <td className="text-text-primary">{row.name}</td>
                        <td>{row.email}</td>
                        <td className="max-w-[420px]">
                          <p className="line-clamp-2 text-text-secondary">{row.message}</p>
                        </td>
                        <td>
                          <span
                            className={cn(
                              'badge',
                              row.status
                                ? 'border-accent-emerald/20 bg-accent-emerald/10 text-accent-emerald'
                                : 'border-accent-amber/20 bg-accent-amber/10 text-accent-amber',
                            )}
                          >
                            {row.status ? 'Read' : 'Unread'}
                          </span>
                        </td>
                        <td>{formatDate(row.created_at, 'relative')}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-secondary text-xs"
                            onClick={() => void updateMessageStatus(row.id, !row.status)}
                            disabled={isSaving}
                          >
                            {isSaving ? 'Saving...' : row.status ? 'Mark Unread' : 'Mark Read'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                {!loading && messages.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="py-10 text-center text-sm text-text-muted">
                        No contact messages found
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="requests" className="glass-card overflow-hidden">
          <div className="border-b border-border-subtle px-4 py-3">
            <h2 className="text-sm font-medium text-text-primary">PDF Requests</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[980px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`requests-loading-${index}`}>
                      <td colSpan={6}>
                        <div className="skeleton h-8 rounded" />
                      </td>
                    </tr>
                  ))}

                {!loading &&
                  requests.map((row) => {
                    const isSaving = savingRequestId === row.id

                    return (
                      <tr key={row.id}>
                        <td className="text-text-primary">{row.name}</td>
                        <td>{row.email}</td>
                        <td className="max-w-[420px]">
                          <p className="line-clamp-2 text-text-secondary">{row.details}</p>
                        </td>
                        <td>
                          <span className={cn('badge', getRequestStatusColor(row.status))}>
                            {row.status}
                          </span>
                        </td>
                        <td>{formatDate(row.created_at, 'relative')}</td>
                        <td>
                          <select
                            className="admin-input h-8 min-w-[132px] text-xs"
                            value={row.status}
                            disabled={isSaving}
                            onChange={(event) =>
                              void updateRequestStatus(row.id, event.target.value as RequestStatus)
                            }
                          >
                            {REQUEST_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    )
                  })}

                {!loading && requests.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="py-10 text-center text-sm text-text-muted">
                        No PDF requests found
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
