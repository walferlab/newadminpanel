import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'
import type { ActivityHeatmapCell, AdminRole } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function parseDateLike(value: unknown): Date {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'number') {
    return new Date(value)
  }

  if (typeof value === 'string') {
    const iso = parseISO(value)
    if (isValid(iso)) {
      return iso
    }
    const raw = new Date(value)
    if (isValid(raw)) {
      return raw
    }
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    typeof (value as { seconds: unknown }).seconds === 'number'
  ) {
    return new Date((value as { seconds: number }).seconds * 1000)
  }

  return new Date()
}

export function formatDate(
  value: unknown,
  mode: 'short' | 'long' | 'relative' = 'short',
): string {
  const date = parseDateLike(value)

  if (!isValid(date)) {
    return '-'
  }

  if (mode === 'relative') {
    return `${formatDistanceToNowStrict(date, { addSuffix: true })}`
  }

  if (mode === 'long') {
    return format(date, 'dd MMM yyyy, hh:mm a')
  }

  return format(date, 'dd MMM yyyy')
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toString()
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function getRoleBadgeColor(role: AdminRole): string {
  const map: Record<AdminRole, string> = {
    super_admin: 'bg-accent-purple/20 text-accent-purple border-accent-purple/30',
    admin: 'bg-accent-blue/20 text-accent-blue border-accent-blue/30',
    senior_editor: 'bg-accent-emerald/20 text-accent-emerald border-accent-emerald/30',
    junior_editor: 'bg-accent-amber/20 text-accent-amber border-accent-amber/30',
    uploader: 'bg-bg-elevated text-text-secondary border-border-default',
  }

  return map[role]
}

export function getRoleLabel(role: AdminRole): string {
  const map: Record<AdminRole, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    senior_editor: 'Senior Editor',
    junior_editor: 'Junior Editor',
    uploader: 'Uploader',
  }

  return map[role]
}

export function generateActivityHeatmap(
  events: Array<{ created_at: unknown }>,
): ActivityHeatmapCell[] {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 364)

  const countMap = new Map<string, number>()
  for (const event of events) {
    const d = parseDateLike(event.created_at)
    if (!isValid(d)) {
      continue
    }
    const key = format(d, 'yyyy-MM-dd')
    countMap.set(key, (countMap.get(key) ?? 0) + 1)
  }

  const maxCount = Math.max(0, ...Array.from(countMap.values()))

  const levels = (count: number): 0 | 1 | 2 | 3 | 4 => {
    if (count <= 0) {
      return 0
    }
    if (maxCount <= 1) {
      return 4
    }

    const ratio = count / maxCount
    if (ratio <= 0.25) {
      return 1
    }
    if (ratio <= 0.5) {
      return 2
    }
    if (ratio <= 0.75) {
      return 3
    }
    return 4
  }

  return Array.from({ length: 365 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = format(d, 'yyyy-MM-dd')
    const count = countMap.get(key) ?? 0

    return {
      date: key,
      count,
      level: levels(count),
    }
  })
}
