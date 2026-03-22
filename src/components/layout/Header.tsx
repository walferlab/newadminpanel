import type { ReactNode } from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  // legacy alias
  rightSlot?: ReactNode
}

export function Header({ title, subtitle, actions, rightSlot }: HeaderProps) {
  const slot = actions ?? rightSlot
  return (
    <div
      className="flex items-start justify-between px-4 pb-0 pt-2 md:px-5"
      style={{ marginBottom: 2 }}
    >
      <div>
        <h1
          style={{
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: '-0.025em',
            color: '#fff',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13, color: '#555', marginTop: 3 }}>{subtitle}</p>
        )}
      </div>
      {slot && <div className="flex items-center gap-2 shrink-0">{slot}</div>}
    </div>
  )
}
