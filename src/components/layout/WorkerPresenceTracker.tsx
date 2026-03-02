'use client'

import { useEffect, useMemo, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { resolveWorkerIdentity, upsertWorkerPresence } from '@/lib/workerActivity'
import type { AdminRole } from '@/types'

interface WorkerPresenceTrackerProps {
  role: AdminRole | null
}

const HEARTBEAT_MS = 60_000
const MAX_DELTA_MS = 3 * HEARTBEAT_MS

function getTodayKey(nowMs = Date.now()): string {
  const now = new Date(nowMs)
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function WorkerPresenceTracker({ role }: WorkerPresenceTrackerProps) {
  const pathname = usePathname()
  const { user } = useUser()

  const sessionRef = useRef({
    activeDate: getTodayKey(),
    activeMsToday: 0,
    lastTickMs: Date.now(),
  })

  const worker = useMemo(
    () =>
      resolveWorkerIdentity({
        clerkId: user?.id ?? null,
        name: user?.fullName ?? user?.firstName ?? null,
        email: user?.primaryEmailAddress?.emailAddress ?? null,
        role,
      }),
    [role, user],
  )

  useEffect(() => {
    if (!worker || typeof window === 'undefined') {
      return
    }

    let stopped = false

    const flushPresence = async (isOnline: boolean, includeActiveDelta: boolean) => {
      if (stopped) {
        return
      }

      const nowMs = Date.now()
      const todayKey = getTodayKey(nowMs)

      if (sessionRef.current.activeDate !== todayKey) {
        sessionRef.current.activeDate = todayKey
        sessionRef.current.activeMsToday = 0
        sessionRef.current.lastTickMs = nowMs
      }

      if (includeActiveDelta) {
        const delta = nowMs - sessionRef.current.lastTickMs
        if (delta > 0 && delta <= MAX_DELTA_MS) {
          sessionRef.current.activeMsToday += delta
        }
      }

      sessionRef.current.lastTickMs = nowMs

      await upsertWorkerPresence({
        worker,
        currentPage: pathname,
        isOnline,
        activeMsToday: sessionRef.current.activeMsToday,
        activeDate: sessionRef.current.activeDate,
        lastSeenIso: new Date(nowMs).toISOString(),
      })
    }

    const tick = () => {
      const isVisible = document.visibilityState === 'visible' && document.hasFocus()
      void flushPresence(isVisible, isVisible)
    }

    tick()

    const timer = window.setInterval(tick, HEARTBEAT_MS)

    const handleVisibility = () => {
      const isVisible = document.visibilityState === 'visible' && document.hasFocus()
      void flushPresence(isVisible, isVisible)
    }

    const handleFocus = () => {
      void flushPresence(true, false)
    }

    const handleBlur = () => {
      void flushPresence(false, false)
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopped = true
      window.clearInterval(timer)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibility)
      void upsertWorkerPresence({
        worker,
        currentPage: pathname,
        isOnline: false,
        activeMsToday: sessionRef.current.activeMsToday,
        activeDate: sessionRef.current.activeDate,
        lastSeenIso: new Date().toISOString(),
      })
    }
  }, [pathname, worker])

  return null
}
