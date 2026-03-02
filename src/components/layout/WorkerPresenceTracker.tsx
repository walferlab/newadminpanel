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
  const workerRef = useRef<ReturnType<typeof resolveWorkerIdentity>>(null)
  const stoppedRef = useRef(false)

  const sessionRef = useRef({
    activeDate: getTodayKey(),
    activeMsToday: 0,
    lastFlushMs: Date.now(),
    lastInteractionMs: Date.now(),
  })

  const clerkId = user?.id ?? null
  const workerName = user?.fullName ?? user?.firstName ?? null
  const workerEmail = user?.primaryEmailAddress?.emailAddress ?? null

  const worker = useMemo(
    () =>
      resolveWorkerIdentity({
        clerkId,
        name: workerName,
        email: workerEmail,
        role,
      }),
    [clerkId, role, workerEmail, workerName],
  )

  useEffect(() => {
    workerRef.current = worker
  }, [worker])

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

    stoppedRef.current = false
    const interactionOptions: AddEventListenerOptions = { passive: true }

    const flushPresence = async () => {
      const currentWorker = workerRef.current
      if (!currentWorker) {
        return
      }

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
        worker: currentWorker,
        currentPage: pathnameRef.current,
        isOnline: isVisible(),
        activeMsToday: sessionRef.current.activeMsToday,
        activeDate: sessionRef.current.activeDate,
        lastSeenIso: new Date(nowMs).toISOString(),
        heartbeatMs: nowMs,
      })

      if (!ok && !stoppedRef.current) {
        console.warn('Worker presence heartbeat failed')
      }
    }

    const markInteraction = () => {
      sessionRef.current.lastInteractionMs = Date.now()
    }

    const tick = () => {
      if (stoppedRef.current) {
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

    const setOffline = () => {
      const currentWorker = workerRef.current
      if (!currentWorker) {
        return
      }

      stoppedRef.current = true
      void upsertWorkerPresence({
        worker: currentWorker,
        currentPage: pathnameRef.current,
        isOnline: false,
        activeMsToday: sessionRef.current.activeMsToday,
        activeDate: sessionRef.current.activeDate,
        lastSeenIso: new Date().toISOString(),
        heartbeatMs: Date.now(),
      })
    }

    const handlePageHide = () => {
      setOffline()
    }

    const handleBeforeUnload = () => {
      setOffline()
    }

    window.addEventListener('mousemove', markInteraction, interactionOptions)
    window.addEventListener('keydown', markInteraction)
    window.addEventListener('scroll', markInteraction, interactionOptions)
    window.addEventListener('touchstart', markInteraction, interactionOptions)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stoppedRef.current = true
      window.clearInterval(timer)
      window.removeEventListener('mousemove', markInteraction)
      window.removeEventListener('keydown', markInteraction)
      window.removeEventListener('scroll', markInteraction)
      window.removeEventListener('touchstart', markInteraction)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [worker?.id])

  useEffect(() => {
    if (!worker || typeof window === 'undefined') {
      return
    }

    const nowMs = Date.now()
    void upsertWorkerPresence({
      worker,
      currentPage: pathname,
      isOnline: document.visibilityState !== 'hidden',
      activeMsToday: sessionRef.current.activeMsToday,
      activeDate: sessionRef.current.activeDate,
      lastSeenIso: new Date(nowMs).toISOString(),
      heartbeatMs: nowMs,
    })
  }, [pathname, worker?.id])

  return null
}
