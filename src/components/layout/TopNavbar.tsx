'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import { Bell, LogOut, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { getNavLabel } from '@/config/navigation'
import { getRoleLabel } from '@/lib/utils'
import type { AdminRole } from '@/types'

interface TopNavbarProps {
  compactSidebar?: boolean
  role: AdminRole | null
}

export function TopNavbar({ compactSidebar = false, role }: TopNavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [search, setSearch] = useState('')
  const [notifCount, setNotifCount] = useState(0)

  // Fetch notification count
  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setNotifCount(data.counts?.total ?? 0)
    } catch {}
  }, [])

  useEffect(() => {
    void fetchCount()
    const t = setInterval(() => void fetchCount(), 30000)
    return () => clearInterval(t)
  }, [fetchCount])

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = search.trim()
    router.push(q ? `/books?q=${encodeURIComponent(q)}` : '/books')
  }

  const ml = compactSidebar ? 'md:ml-[68px]' : 'md:ml-[210px]'

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-40 ${ml} transition-all duration-300`}
      style={{
        background: 'rgba(8,8,8,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        height: '56px',
      }}
    >
      <div className="flex h-full items-center gap-4 px-4 md:px-5">
        {/* Mobile logo */}
        <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
          <Image src="/logo.png" alt="PDF Lovers" width={24} height={24} style={{ borderRadius: 5 }} />
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.025em', color: '#fff' }}>
            PDF Lovers
          </span>
        </Link>

        {/* Desktop page title */}
        <div className="hidden md:block">
          <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#444', marginBottom: 1 }}>
            {getRoleLabel(role ?? 'uploader')}
          </p>
          <h1 style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: '#fff' }}>
            {getNavLabel(pathname)}
          </h1>
        </div>

        {/* Search */}
        <form className="relative ml-auto hidden w-full max-w-xs md:block" onSubmit={handleSearch}>
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#444' }} />
          <input
            className="admin-input h-9 pl-9"
            placeholder="Search books…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        {/* Notifications */}
        <Link
          href="/data-imports"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-full transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#888' }}
          title="Notifications"
        >
          <Bell size={14} />
          {notifCount > 0 && (
            <span
              className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ background: '#ef4444', fontSize: 9 }}
            >
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </Link>

        {/* User / sign out */}
        <button
          className="hidden md:inline-flex h-8 items-center gap-2 rounded-xl px-3 text-xs transition-all hover:opacity-80"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.07)' }}
          type="button"
          onClick={() => signOut()}
          title="Sign out"
        >
          <span className="max-w-[100px] truncate">{user?.firstName ?? 'Account'}</span>
          <LogOut size={12} />
        </button>
      </div>
    </header>
  )
}
