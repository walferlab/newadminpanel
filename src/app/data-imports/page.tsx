'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { cn, formatDate } from '@/lib/utils'
import type { ContactMessage, PDFRequest } from '@/types'

type RequestStatus = PDFRequest['status']
type MessageFilter = 'all' | 'unread' | 'read'
type RequestFilter = 'all' | RequestStatus

const REQUEST_STATUSES: RequestStatus[] = ['reviewing', 'approved', 'rejected']
const MESSAGE_FILTERS: MessageFilter[] = ['all', 'unread', 'read']
const AUTO_REFRESH_MS = 30_000

function normalizeMessageStatus(value: unknown): boolean {
  if (value === true) {
    return true
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === 'read'
  }

  if (typeof value === 'number') {
    return value === 1
  }

  return false
}

function normalizeRequestStatus(value: unknown): RequestStatus {
  if (typeof value !== 'string') {
    return 'reviewing'
  }

  const normalized = value.trim().toLowerCase() as RequestStatus
  return REQUEST_STATUSES.includes(normalized) ? normalized : 'reviewing'
}

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
  const [messageFilter, setMessageFilter] = useState<MessageFilter>('all')
  const [requestFilter, setRequestFilter] = useState<RequestFilter>('all')

  const unreadMessages = useMemo(
    () => messages.filter((message) => !message.status).length,
    [messages],
  )
  const readMessages = useMemo(
    () => messages.filter((message) => message.status).length,
    [messages],
  )

  const reviewingRequests = useMemo(
    () => requests.filter((request) => request.status === 'reviewing').length,
    [requests],
  )
  const filteredMessages = useMemo(() => {
    if (messageFilter === 'read') {
      return messages.filter((message) => message.status)
    }

    if (messageFilter === 'unread') {
      return messages.filter((message) => !message.status)
    }

    return messages
  }, [messageFilter, messages])
  const filteredRequests = useMemo(() => {
    if (requestFilter === 'all') {
      return requests
    }

    return requests.filter((request) => request.status === requestFilter)
  }, [requestFilter, requests])

  const fetchInbox = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/inbox', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        toast.error(payload.error ?? 'Failed to load inbox data')
        setLoading(false)
        return
      }

      const payload = (await response.json()) as {
        messages?: ContactMessage[]
        requests?: PDFRequest[]
      }

      const normalizedMessages = ((payload.messages ?? []) as ContactMessage[]).map((message) => ({
        ...message,
        status: normalizeMessageStatus(message.status),
      }))

      const normalizedRequests = ((payload.requests ?? []) as PDFRequest[]).map((request) => ({
        ...request,
        status: normalizeRequestStatus(request.status),
      }))

      setMessages(normalizedMessages)
      setRequests(normalizedRequests)
      setLoading(false)
    } catch {
      toast.error('Failed to load inbox data')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchInbox()
  }, [fetchInbox])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchInbox()
    }, AUTO_REFRESH_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [fetchInbox])

  async function updateMessageStatus(id: number, status: boolean) {
    setSavingMessageId(id)

    const response = await fetch('/api/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'message',
        id,
        status,
      }),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(payload.error ?? 'Failed to update message status')
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

    const response = await fetch('/api/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'request',
        id,
        status,
      }),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(payload.error ?? 'Failed to update request status')
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="glass-card p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Total Messages</p>
            <p className="mt-2 font-display text-2xl text-text-primary">{messages.length}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Unread Messages</p>
            <p className="mt-2 font-display text-2xl text-text-primary">{unreadMessages}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Read Messages</p>
            <p className="mt-2 font-display text-2xl text-text-primary">{readMessages}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Requests In Review</p>
            <p className="mt-2 font-display text-2xl text-text-primary">{reviewingRequests}</p>
          </div>
        </div>

        <section id="messages" className="glass-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
            <h2 className="text-sm font-medium text-text-primary">Contact Messages</h2>
            <div className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-elevated/40 p-1">
              {MESSAGE_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] uppercase tracking-[0.08em] transition-colors',
                    messageFilter === filter
                      ? 'bg-bg-primary text-text-primary'
                      : 'text-text-muted hover:text-text-primary',
                  )}
                  onClick={() => setMessageFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
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
                  filteredMessages.map((row) => {
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

                {!loading && filteredMessages.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="py-10 text-center text-sm text-text-muted">
                        No {messageFilter === 'all' ? '' : messageFilter} messages found
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="requests" className="glass-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
            <h2 className="text-sm font-medium text-text-primary">PDF Requests</h2>
            <div className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-elevated/40 p-1">
              {(['all', ...REQUEST_STATUSES] as RequestFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] uppercase tracking-[0.08em] transition-colors',
                    requestFilter === filter
                      ? 'bg-bg-primary text-text-primary'
                      : 'text-text-muted hover:text-text-primary',
                  )}
                  onClick={() => setRequestFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
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
                  filteredRequests.map((row) => {
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

                {!loading && filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="py-10 text-center text-sm text-text-muted">
                        No {requestFilter === 'all' ? '' : requestFilter} PDF requests found
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
