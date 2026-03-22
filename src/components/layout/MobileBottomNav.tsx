'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getNavItemsForRole } from '@/config/navigation'
import type { AdminRole } from '@/types'

export function MobileBottomNav({ role }: { role: AdminRole | null }) {
  const pathname = usePathname()
  const navItems = getNavItemsForRole(role).slice(0, 5) // max 5 on mobile

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-14"
      style={{
        background: 'rgba(8,8,8,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {navItems.map(({ icon: Icon, label, href }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-0.5 px-4 py-1 transition-all"
            style={{ color: active ? '#fff' : '#444' }}
          >
            <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '-0.01em' }}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
