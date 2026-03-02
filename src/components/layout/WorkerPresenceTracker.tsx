'use client'

import { useEffect, useMemo, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { resolveWorkerIdentity, upsertWorkerPresence } from '@/lib/workerActivity'
import type { AdminRole } from '@/types'

interface WorkerPresenceTrackerProps {
  role: AdminRole | null
}

const HEARTBEAT_MS = 20_000
const ACTIVE_IDLE_MS = 2 * 60_000
const MAX_DELTA_MS = 3 * 60_000

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
  const pathnameRef = useRef(pathname)

  const sessionRef = useRef({
    activeDate: getTodayKey(),
    activeMsToday: 0,
    lastFlushMs: Date.now(),
    lastInteractionMs: Date.now(),
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
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    if (!worker || typeof window === 'undefined') {
      return
    }

    function isVisible() {
      return document.visibilityState !== 'hidden'
    }

    let stopped = false
    const interactionOptions: AddEventListenerOptions = { passive: true }

    const flushPresence = async () => {
      const nowMs = Date.now()
      const todayKey = getTodayKey(nowMs)

      if (sessionRef.current.activeDate !== todayKey) {
        sessionRef.current.activeDate = todayKey
        sessionRef.current.activeMsToday = 0
        sessionRef.current.lastFlushMs = nowMs
        sessionRef.current.lastInteractionMs = nowMs
      }

      const delta = nowMs - sessionRef.current.lastFlushMs
      const recentlyActive = nowMs - sessionRef.current.lastInteractionMs <= ACTIVE_IDLE_MS
      const shouldCountActive = isVisible() && recentlyActive

      if (shouldCountActive && delta > 0 && delta <= MAX_DELTA_MS) {
        sessionRef.current.activeMsToday += delta
      }

      sessionRef.current.lastFlushMs = nowMs

      const ok = await upsertWorkerPresence({
        worker,
        currentPage: pathnameRef.current,
        isOnline: isVisible(),
        activeMsToday: sessionRef.current.activeMsToday,
        activeDate: sessionRef.current.activeDate,
        lastSeenIso: new Date(nowMs).toISOString(),
        heartbeatMs: nowMs,
      })

      if (!ok && !stopped) {
        console.warn('Worker presence heartbeat failed')
      }
    }

    const markInteraction = () => {
      sessionRef.current.lastInteractionMs = Date.now()
    }

    const tick = () => {
      if (stopped) {
        return
      }
      void flushPresence()
    }

    markInteraction()
    tick()

    const timer = window.setInterval(tick, HEARTBEAT_MS)

    const handleVisibility = () => {
      if (isVisible()) {
        markInteraction()
      }
      tick()
    }

    const handleFocus = () => {
      markInteraction()
      tick()
    }

    const handleBlur = () => {
      tick()
    }

    const handlePageHide = () => {
      stopped = true
      void upsertWorkerPresence({
        worker,
        currentPage: pathnameRef.current,
        isOnline: false,
        activeMsToday: sessionRef.current.activeMsToday,
        activeDate: sessionRef.current.activeDate,
        lastSeenIso: new Date().toISOString(),
        heartbeatMs: Date.now(),
      })
    }

    window.addEventListener('mousemove', markInteraction, interactionOptions)
    window.addEventListener('keydown', markInteraction)
    window.addEventListener('scroll', markInteraction, interactionOptions)
    window.addEventListener('touchstart', markInteraction, interactionOptions)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopped = true
      window.clearInterval(timer)
      window.removeEventListener('mousemove', markInteraction)
      window.removeEventListener('keydown', markInteraction)
      window.removeEventListener('scroll', markInteraction)
      window.removeEventListener('touchstart', markInteraction)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibility)
      void upsertWorkerPresence({
        worker,
        currentPage: pathnameRef.current,
        isOnline: false,
        activeMsToday: sessionRef.current.activeMsToday,
        activeDate: sessionRef.current.activeDate,
        lastSeenIso: new Date().toISOString(),
        heartbeatMs: Date.now(),
      })
    }
  }, [worker])

  return null
}
