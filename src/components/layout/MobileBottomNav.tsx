'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getNavItemsForRole } from '@/config/navigation'
import { cn } from '@/lib/utils'
import type { AdminRole } from '@/types'

interface MobileBottomNavProps {
  role: AdminRole | null
}

export function MobileBottomNav({ role }: MobileBottomNavProps) {
  const pathname = usePathname()
  const navItems = getNavItemsForRole(role)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-subtle bg-bg-primary/98 backdrop-blur-sm md:hidden">
      <div className="flex h-16 items-center gap-1 overflow-x-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex h-11 min-w-[84px] flex-col items-center justify-center gap-1 rounded-md px-2 text-[11px] transition-colors',
                active ? 'bg-bg-elevated/70 text-text-primary' : 'text-text-muted',
              )}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
