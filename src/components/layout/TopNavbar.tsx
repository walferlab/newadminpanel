'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import { Bell, CheckCheck, LogOut, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { getNavLabel } from '@/config/navigation'
import { supabase } from '@/lib/supabase'
import { cn, formatDate, getRoleLabel } from '@/lib/utils'
import type { AdminRole } from '@/types'

interface NotificationItem {
  id: string
  type: 'message' | 'request'
  title: string
  subtitle: string
  createdAt: string
  href: string
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

  const [search, setSearch] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [pendingRequests, setPendingRequests] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])

  const roleLabel = getRoleLabel(role ?? 'uploader')
  const totalUnread = unreadMessages + pendingRequests

  const refreshCounts = useCallback(async () => {
    const [messagesRes, requestsRes] = await Promise.all([
      supabase
        .from('contact_messages')
        .select('*', { count: 'exact', head: true })
        .eq('status', false),
      supabase
        .from('pdf_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'reviewing'),
    ])

    setUnreadMessages(messagesRes.count ?? 0)
    setPendingRequests(requestsRes.count ?? 0)
  }, [])

  const refreshItems = useCallback(async () => {
    setLoadingNotifications(true)

    const [messagesRes, requestsRes] = await Promise.all([
      supabase
        .from('contact_messages')
        .select('id, name, email, created_at, status')
        .eq('status', false)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('pdf_requests')
        .select('id, name, email, status, created_at')
        .eq('status', 'reviewing')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const messageItems: NotificationItem[] = (messagesRes.data ?? []).map((row) => ({
      id: `message-${row.id}`,
      type: 'message',
      title: `Message from ${row.name}`,
      subtitle: row.email,
      createdAt: row.created_at,
      href: '/data-imports#messages',
    }))

    const requestItems: NotificationItem[] = (requestsRes.data ?? []).map((row) => ({
      id: `request-${row.id}`,
      type: 'request',
      title: `Request from ${row.name}`,
      subtitle: row.email,
      createdAt: row.created_at,
      href: '/data-imports#requests',
    }))

    const merged = [...messageItems, ...requestItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)

    setItems(merged)
    setLoadingNotifications(false)
  }, [])

  useEffect(() => {
    void refreshCounts()
    const timer = setInterval(() => void refreshCounts(), 60000)
    return () => clearInterval(timer)
  }, [refreshCounts])

  useEffect(() => {
    const channel = supabase
      .channel('top-navbar-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_messages',
        },
        () => {
          void refreshCounts()
          if (notificationsOpen) {
            void refreshItems()
          }
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
          void refreshCounts()
          if (notificationsOpen) {
            void refreshItems()
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [notificationsOpen, refreshCounts, refreshItems])

  useEffect(() => {
    if (!notificationsOpen) {
      return
    }

    void refreshItems()
  }, [notificationsOpen, refreshItems])

  useEffect(() => {
    setNotificationsOpen(false)
  }, [pathname])

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
    const { error } = await supabase
      .from('contact_messages')
      .update({ status: true })
      .eq('status', false)

    if (error) {
      toast.error('Failed to mark messages as read')
      return
    }

    await refreshCounts()
    await refreshItems()
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
                  disabled={unreadMessages === 0}
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
                        {item.type === 'request' ? 'Request' : 'Message'} - {formatDate(item.createdAt, 'relative')}
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
