'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import { Bell, CheckCheck, LogOut, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { getNavLabel } from '@/config/navigation'
import { cn, formatDate, getRoleLabel } from '@/lib/utils'
import type { AdminRole } from '@/types'

interface NotificationItem {
  id: string
  type: 'message' | 'request' | 'approval'
  title: string
  subtitle: string
  createdAt: string
  href: string
}

interface NotificationCounts {
  unreadMessages: number
  pendingPdfRequests: number
  pendingApprovals: number
  total: number
}

interface TopNavbarProps {
  compactSidebar?: boolean
  role: AdminRole | null
}

export function TopNavbar({ compactSidebar = false, role }: TopNavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const { signOut } = useClerk()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const previousCountsRef = useRef<NotificationCounts | null>(null)
  const hasLoadedRef = useRef(false)

  const [search, setSearch] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [counts, setCounts] = useState<NotificationCounts>({
    unreadMessages: 0,
    pendingPdfRequests: 0,
    pendingApprovals: 0,
    total: 0,
  })
  const [items, setItems] = useState<NotificationItem[]>([])

  const roleLabel = getRoleLabel(role ?? 'uploader')
  const totalUnread = counts.total

  const refreshNotifications = useCallback(async (notifyOnIncrease: boolean) => {
    setLoadingNotifications((prev) => (notificationsOpen ? true : prev))

    try {
      const response = await fetch('/api/notifications', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        setLoadingNotifications(false)
        return
      }

      const payload = (await response.json()) as {
        counts?: NotificationCounts
        items?: NotificationItem[]
      }
      const nextCounts = payload.counts ?? {
        unreadMessages: 0,
        pendingPdfRequests: 0,
        pendingApprovals: 0,
        total: 0,
      }
      const nextItems = payload.items ?? []

      if (notifyOnIncrease && hasLoadedRef.current && previousCountsRef.current) {
        const prev = previousCountsRef.current

        const newMessages = Math.max(0, nextCounts.unreadMessages - prev.unreadMessages)
        const newRequests = Math.max(0, nextCounts.pendingPdfRequests - prev.pendingPdfRequests)
        const newApprovals = Math.max(0, nextCounts.pendingApprovals - prev.pendingApprovals)

        if (newMessages > 0) {
          toast(`${newMessages} new unread message${newMessages > 1 ? 's' : ''}`)
        }
        if (newRequests > 0) {
          toast(`${newRequests} new PDF request${newRequests > 1 ? 's' : ''} pending`)
        }
        if (newApprovals > 0) {
          toast(`${newApprovals} new approval request${newApprovals > 1 ? 's' : ''}`)
        }
      }

      previousCountsRef.current = nextCounts
      hasLoadedRef.current = true
      setCounts(nextCounts)
      setItems(nextItems)
      setLoadingNotifications(false)
    } catch {
      setLoadingNotifications(false)
    }
  }, [notificationsOpen])

  useEffect(() => {
    void refreshNotifications(false)
    const timer = setInterval(() => void refreshNotifications(true), 25000)
    return () => clearInterval(timer)
  }, [refreshNotifications])

  useEffect(() => {
    if (!notificationsOpen) {
      return
    }

    void refreshNotifications(false)
  }, [notificationsOpen, refreshNotifications])

  useEffect(() => {
    setNotificationsOpen(false)
  }, [pathname])

  useEffect(() => {
    const onFocus = () => {
      void refreshNotifications(true)
    }

    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshNotifications])

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!panelRef.current) {
        return
      }
      if (!panelRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  async function markMessagesAsRead() {
    const response = await fetch('/api/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'messages_all',
        status: true,
      }),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(payload.error ?? 'Failed to mark messages as read')
      return
    }

    await refreshNotifications(false)
    toast.success('Unread messages marked as read')
  }

  function handleQuickSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = search.trim()

    if (!query) {
      router.push('/books')
      return
    }

    router.push(`/books?q=${encodeURIComponent(query)}`)
  }

  return (
    <header
      className={cn(
        'fixed left-0 right-0 top-0 z-40 border-b border-border-subtle bg-bg-primary/95 backdrop-blur-sm',
        compactSidebar ? 'md:left-[76px]' : 'md:left-[220px]',
      )}
    >
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-4 px-4 md:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
          <Image src="/logo.png" alt="PDF Lovers" width={26} height={26} />
          <span className="font-display text-lg text-text-primary">PDF Lovers</span>
        </Link>

        <div className="hidden md:block">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            {roleLabel}
          </p>
          <h1 className="font-display text-lg text-text-primary">{getNavLabel(pathname)}</h1>
        </div>

        <form className="relative ml-auto hidden w-full max-w-sm md:block" onSubmit={handleQuickSearch}>
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            className="admin-input h-9 pl-9"
            placeholder="Quick search books"
            aria-label="Quick search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </form>

        <div className="relative" ref={panelRef}>
          <button
            className="relative inline-flex h-9 w-9 items-center justify-center border border-border-subtle text-text-secondary transition-colors hover:text-text-primary"
            type="button"
            aria-label="Notifications"
            onClick={() => setNotificationsOpen((prev) => !prev)}
          >
            <Bell size={15} />
            {totalUnread > 0 ? <span className="absolute right-2 top-2 h-1.5 w-1.5 bg-accent-amber" /> : null}
          </button>

          {notificationsOpen ? (
            <div className="absolute right-0 top-11 w-[320px] border border-border-default bg-bg-secondary p-3 shadow-card">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-text-primary">Notifications ({totalUnread})</p>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary"
                  onClick={() => void markMessagesAsRead()}
                  disabled={counts.unreadMessages === 0}
                >
                  <CheckCheck size={13} />
                  Mark messages read
                </button>
              </div>

              {loadingNotifications ? (
                <p className="py-5 text-center text-xs text-text-muted">Loading notifications...</p>
              ) : items.length > 0 ? (
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="block border border-transparent p-2 transition-colors hover:border-border-subtle hover:bg-bg-elevated/60"
                    >
                      <p className="text-sm text-text-primary">{item.title}</p>
                      <p className="truncate text-xs text-text-muted">{item.subtitle}</p>
                      <p className="mt-1 text-[11px] text-text-muted">
                        {item.type === 'approval'
                          ? 'Approval'
                          : item.type === 'request'
                            ? 'Request'
                            : 'Message'}{' '}
                        - {formatDate(item.createdAt, 'relative')}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-text-muted">You are all caught up.</p>
              )}
            </div>
          ) : null}
        </div>

        <button
          className="hidden h-9 items-center gap-2 border border-border-subtle px-3 text-xs text-text-secondary transition-colors hover:text-text-primary md:inline-flex"
          type="button"
          onClick={() => signOut()}
        >
          <span className="max-w-[120px] truncate">{user?.firstName ?? 'Account'}</span>
          <LogOut size={14} />
        </button>
      </div>
    </header>
  )
}
