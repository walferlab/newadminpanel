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
        'fixed left-0 top-0 z-40 hidden h-screen md:flex md:flex-col transition-all duration-300',
        compact ? 'w-[68px]' : 'w-[210px]',
      )}
      style={{
        background: 'rgba(8,8,8,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex h-14 items-center shrink-0',
          compact ? 'justify-center px-2' : 'gap-2.5 px-4',
        )}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <Link
          href="/dashboard"
          className={cn('inline-flex items-center', compact ? 'justify-center' : 'gap-2.5')}
          aria-label="Dashboard"
        >
          <Image
            src="/logo.png"
            alt="PDF Lovers"
            width={28}
            height={28}
            priority
            style={{ borderRadius: 6 }}
          />
          {!compact && (
            <span
              style={{
                fontFamily: "'Satoshi', ui-sans-serif",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: '-0.025em',
                color: '#fff',
              }}
            >
              PDF Lovers
            </span>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              title={compact ? item.label : undefined}
              className={cn(
                'flex h-9 items-center rounded-xl transition-all duration-150',
                compact ? 'justify-center px-2' : 'gap-3 px-3',
              )}
              style={{
                color: active ? '#fff' : '#666',
                background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = '#ccc'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = '#666'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
              {!compact && (
                <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em' }}>
                  {item.label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Toggle */}
      <div className="p-2 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          type="button"
          onClick={onToggleCompact}
          className={cn(
            'flex h-9 w-full items-center rounded-xl transition-all duration-150',
            compact ? 'justify-center' : 'gap-2 px-3',
          )}
          style={{ color: '#444' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#888'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#444'; e.currentTarget.style.background = 'transparent' }}
          title={compact ? 'Expand' : 'Compact'}
        >
          {compact ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          {!compact && <span style={{ fontSize: 12, fontWeight: 500 }}>Compact</span>}
        </button>
      </div>
    </aside>
  )
}
