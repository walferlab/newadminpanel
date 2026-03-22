'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopNavbar } from '@/components/layout/TopNavbar'
import { useAdminRole } from '@/lib/useAdminRole'

const SIDEBAR_KEY = 'pdflovers.sidebar.compact'

function isPublicRoute(pathname: string) {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/awaiting-approval')
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const role = useAdminRole()
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_KEY)
    setCompact(saved === '1')
  }, [])

  function toggleCompact() {
    setCompact((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
      return next
    })
  }

  if (isPublicRoute(pathname)) return <>{children}</>

  const ml = compact ? 'md:ml-[68px]' : 'md:ml-[210px]'

  return (
    <div className="min-h-screen" style={{ background: '#080808' }}>
      <Sidebar compact={compact} onToggleCompact={toggleCompact} role={role} />
      <div className={`${ml} transition-all duration-300`}>
        <TopNavbar compactSidebar={compact} role={role} />
        <main className="min-h-screen px-3 pb-20 pt-[70px] md:px-5 md:pb-6">
          {children}
        </main>
      </div>
      <MobileBottomNav role={role} />
    </div>
  )
}
