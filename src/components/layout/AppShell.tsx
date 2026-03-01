'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopNavbar } from '@/components/layout/TopNavbar'

interface AppShellProps {
  children: ReactNode
}

const SIDEBAR_PREF_KEY = 'pdflovers.sidebar.compact'

function isPublicRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/awaiting-approval')
  )
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [compactSidebar, setCompactSidebar] = useState(false)
  const isChatRoute = pathname.startsWith('/chat')

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_PREF_KEY)
    setCompactSidebar(saved === '1')
  }, [])

  useEffect(() => {
    if (compactSidebar) {
      document.body.classList.add('sidebar-compact')
    } else {
      document.body.classList.remove('sidebar-compact')
    }
  }, [compactSidebar])

  function handleToggleCompactSidebar() {
    setCompactSidebar((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_PREF_KEY, next ? '1' : '0')
      return next
    })
  }

  if (isPublicRoute(pathname)) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-bg-primary">
      <Sidebar compact={compactSidebar} onToggleCompact={handleToggleCompactSidebar} />
      <div className={compactSidebar ? 'md:ml-[76px]' : 'md:ml-[220px]'}>
        <TopNavbar compactSidebar={compactSidebar} />
        <main
          className={
            isChatRoute
              ? 'h-[calc(100vh-4rem)] overflow-hidden px-3 pb-20 pt-[4.75rem] md:px-6 md:pb-6'
              : 'min-h-[calc(100vh-4rem)] px-3 pb-20 pt-[4.75rem] md:px-6 md:pb-6'
          }
        >
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
