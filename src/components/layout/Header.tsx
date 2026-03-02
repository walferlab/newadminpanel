import type { ReactNode } from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
  rightSlot?: ReactNode
}

export function Header({ rightSlot }: HeaderProps) {
  if (!rightSlot) {
    return null
  }

  return <header className="mb-4 flex justify-end">{rightSlot}</header>
}
