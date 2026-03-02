'use client'

import Image from 'next/image'
import Link from 'next/link'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { getNavItemsForRole } from '@/config/navigation'
import { cn } from '@/lib/utils'
import type { AdminRole } from '@/types'

interface SidebarProps {
  compact: boolean
  onToggleCompact: () => void
  role: AdminRole | null
}

export function Sidebar({ compact, onToggleCompact, role }: SidebarProps) {
  const pathname = usePathname()
  const navItems = getNavItemsForRole(role)

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 hidden h-screen border-r border-border-subtle bg-bg-primary md:flex md:flex-col',
        compact ? 'w-[76px]' : 'w-[220px]',
      )}
    >
      <div className={cn('flex h-16 items-center border-b border-border-subtle', compact ? 'justify-center px-2' : 'gap-2 px-4')}>
        <Link
          href="/dashboard"
          aria-label="Go to dashboard"
          className={cn('inline-flex items-center', compact ? 'justify-center' : 'gap-2')}
        >
          <Image src="/logo.png" alt="PDF Lovers" width={28} height={28} priority />
          {!compact ? <span className="font-display text-base text-text-primary">PDF Lovers</span> : null}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex h-10 items-center text-text-muted transition-colors',
                compact ? 'justify-center px-2' : 'gap-3 px-3',
                'hover:bg-bg-elevated/60 hover:text-text-primary',
                active && 'bg-bg-elevated/70 text-text-primary',
              )}
              title={item.label}
              aria-label={item.label}
            >
              <Icon size={17} />
              {!compact ? <span className="truncate text-sm">{item.label}</span> : null}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border-subtle p-2">
        <button
          type="button"
          onClick={onToggleCompact}
          className={cn(
            'flex h-10 w-full items-center text-text-muted transition-colors hover:bg-bg-elevated/70 hover:text-text-primary',
            compact ? 'justify-center' : 'gap-2 px-3',
          )}
          aria-label={compact ? 'Expand sidebar' : 'Compact sidebar'}
          title={compact ? 'Expand sidebar' : 'Compact sidebar'}
        >
          {compact ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!compact ? <span className="text-sm">Compact</span> : null}
        </button>
      </div>
    </aside>
  )
}
