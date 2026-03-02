'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Circle, Clock3, RefreshCw, Upload, Users } from 'lucide-react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { ActivityHeatmap } from '@/components/ui/ActivityHeatmap'
import { db, ensureFirebaseClientAuth, getFirebaseErrorMessage } from '@/lib/firebase'
import { isPresenceHeartbeatLog } from '@/lib/workerActivity'
import {
  cn,
  formatDate,
  generateActivityHeatmap,
  getRoleBadgeColor,
  getRoleLabel,
} from '@/lib/utils'
import type { Admin, AdminRole, ChangeLog } from '@/types'

interface WorkerStats {
  admin: Admin
  totalActions: number
  totalUploads: number
  totalEdits: number
  totalDeletes: number
  actionsToday: number
  uploadsToday: number
  recentActions24h: number
  activeHoursToday: number
  lastSeen: string | null
  isOnline: boolean
  currentPage: string | null
  activityEvents: Array<{ created_at: unknown }>
  recentLogs: ChangeLog[]
}

interface WorkerPresenceRow {
  id: string
  worker_id?: string
  worker_name?: string
  worker_email?: string
  worker_role?: string
  is_online?: boolean
  last_seen?: unknown
  last_seen_epoch_ms?: number
  heartbeat_epoch_ms?: number
  updated_at?: unknown
  current_page?: string
  active_ms_today?: number
  active_date?: string
}

type StatusFilter = 'all' | 'online' | 'offline'
type SortBy = 'latest' | 'actions_today' | 'uploads' | 'name'

// consider someone online for a few minutes after their last heartbeat
// this value was 2 minutes originally but bumped in case clients fall
// out of sync briefly or the heartbeat/clockTick lagged
const ONLINE_THRESHOLD_MS = 5 * 60_000
const DAY_MS = 24 * 60 * 60 * 1000
const WORKER_CLOCK_TICK_MS = 15_000

function normalize(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.toLowerCase()
}

function getTime(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (value instanceof Date) {
    const direct = value.getTime()
    return Number.isNaN(direct) ? null : direct
  }

  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
      const date = (value as { toDate: () => Date }).toDate()
      const direct = date.getTime()
      return Number.isNaN(direct) ? null : direct
    }

    if ('seconds' in value && typeof (value as { seconds?: unknown }).seconds === 'number') {
      const seconds = (value as { seconds: number }).seconds
      const nanosecondsValue = (value as { nanoseconds?: unknown }).nanoseconds
      const nanoseconds = typeof nanosecondsValue === 'number' ? nanosecondsValue : 0
      return seconds * 1000 + Math.floor(nanoseconds / 1_000_000)
    }
  }

  const date = new Date(typeof value === 'string' ? value : String(value))
  const timestamp = date.getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function getPresenceHeartbeatTime(row: WorkerPresenceRow | undefined): number | null {
  if (!row) {
    return null
  }

  const epochCandidates = [row.heartbeat_epoch_ms, row.last_seen_epoch_ms].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )

  if (epochCandidates.length > 0) {
    return Math.max(...epochCandidates)
  }

  const parsedCandidates = [getTime(row.last_seen), getTime(row.updated_at)].filter(
    (value): value is number => typeof value === 'number',
  )

  if (parsedCandidates.length > 0) {
    return Math.max(...parsedCandidates)
  }

  return null
}

export default function WorkersPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [recentLogs, setRecentLogs] = useState<ChangeLog[]>([])
  const [presenceRows, setPresenceRows] = useState<WorkerPresenceRow[]>([])
  const [loadingAdmins, setLoadingAdmins] = useState(true)
  const [adminsError, setAdminsError] = useState<string | null>(null)
  const [firebaseError, setFirebaseError] = useState<string | null>(null)
  const [queryText, setQueryText] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | AdminRole>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('latest')
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [showSelectedLogsOnly, setShowSelectedLogsOnly] = useState(false)
  const [clockTick, setClockTick] = useState(() => Date.now())

  const loadAdmins = useCallback(async () => {
    setLoadingAdmins(true)
    setAdminsError(null)

    try {
      const response = await fetch('/api/admins', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        const message = payload.error ?? 'Failed to load workers.'
        setAdmins([])
        setLoadingAdmins(false)
        setAdminsError(message)
        toast.error(message)
        return
      }

      const payload = (await response.json()) as { users?: Admin[] }
      const approvedAdmins = (payload.users ?? []).filter((row) => Boolean(row.approved))
      setAdmins(approvedAdmins)
      setLoadingAdmins(false)
    } catch {
      setAdmins([])
      setLoadingAdmins(false)
      setAdminsError('Failed to load workers.')
      toast.error('Failed to load workers')
    }
  }, [])

  useEffect(() => {
    void loadAdmins()
  }, [loadAdmins])

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}

    async function subscribeLogs() {
      try {
        await ensureFirebaseClientAuth()
      } catch (error) {
        if (!active) {
          return
        }
        const message = getFirebaseErrorMessage(error)
        setFirebaseError(message)
        setRecentLogs([])
        toast.error(message)
        return
      }

      const logsQuery = query(
        collection(db, 'change_logs'),
        orderBy('timestamp', 'desc'),
        limit(500),
      )

      unsubscribe = onSnapshot(
        logsQuery,
        (snapshot) => {
          if (!active) {
            return
          }

          const logs = snapshot.docs.map((doc) => {
            const data = doc.data() as Omit<ChangeLog, 'id'>
            return {
              id: doc.id,
              ...data,
            }
          })

          setFirebaseError(null)
          setRecentLogs(logs)
        },
        (error) => {
          if (!active) {
            return
          }
          const message = getFirebaseErrorMessage(error)
          setFirebaseError(message)
          setRecentLogs([])
          toast.error(message)
        },
      )
    }

    void subscribeLogs()

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick(Date.now())
    }, WORKER_CLOCK_TICK_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}

    async function subscribePresence() {
      try {
        await ensureFirebaseClientAuth()
      } catch (error) {
        if (!active) {
          return
        }
        const message = getFirebaseErrorMessage(error)
        setFirebaseError(message)
        setPresenceRows([])
        return
      }

      const presenceQuery = query(collection(db, 'worker_presence'), limit(500))

      unsubscribe = onSnapshot(
        presenceQuery,
        (snapshot) => {
          if (!active) {
            return
          }

          const rows = snapshot.docs.map((doc) => {
            const data = doc.data() as Omit<WorkerPresenceRow, 'id'>
            return {
              id: doc.id,
              ...data,
            }
          })

          setPresenceRows(rows)
        },
        (error) => {
          if (!active) {
            return
          }
          const message = getFirebaseErrorMessage(error)
          setFirebaseError(message)
          setPresenceRows([])
        },
      )
    }

    void subscribePresence()

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const workers = useMemo<WorkerStats[]>(() => {
    const now = clockTick
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTodayMs = startOfToday.getTime()
    const since24h = now - DAY_MS
    const todayKey = startOfToday.toISOString().slice(0, 10)

    const logBuckets = new Map<string, ChangeLog[]>()
    const presenceByAdminId = new Map<string, WorkerPresenceRow>()
    const keyToAdminId = new Map<string, string>()

    // we'll also collect any rows/logs that couldn't be matched so we
    // can debug mapping issues later (and optionally emit them)
    const unmappedLogs: ChangeLog[] = []
    const unmappedPresence: WorkerPresenceRow[] = []

    for (const admin of admins) {
      const keys = [
        normalize(admin.id),
        normalize(admin.clerk_id),
        normalize(admin.email),
        normalize(admin.name),
      ].filter((key): key is string => Boolean(key))

      for (const key of keys) {
        if (!keyToAdminId.has(key)) {
          keyToAdminId.set(key, admin.id)
        }
      }
    }

    for (const log of recentLogs) {
      const possibleKeys = [
        normalize(log.worker_id),
        normalize(log.worker_name),
        normalize(log.worker_email),
      ].filter((key): key is string => Boolean(key))

      const matchedAdminId = possibleKeys
        .map((key) => keyToAdminId.get(key))
        .find((value): value is string => Boolean(value))

      if (!matchedAdminId) {
        unmappedLogs.push(log)
        continue
      }

      const bucket = logBuckets.get(matchedAdminId) ?? []
      bucket.push(log)
      logBuckets.set(matchedAdminId, bucket)
    }

    for (const row of presenceRows) {
      const possibleKeys = [
        normalize(row.id),
        normalize(row.worker_id),
        normalize(row.worker_email),
        normalize(row.worker_name),
      ].filter((key): key is string => Boolean(key))

      const matchedAdminId = possibleKeys
        .map((key) => keyToAdminId.get(key))
        .find((value): value is string => Boolean(value))

      if (!matchedAdminId) {
        unmappedPresence.push(row)
        continue
      }

      const prev = presenceByAdminId.get(matchedAdminId)
      const prevTime = getPresenceHeartbeatTime(prev) ?? 0
      const nextTime = getPresenceHeartbeatTime(row) ?? 0
      if (!prev || nextTime >= prevTime) {
        presenceByAdminId.set(matchedAdminId, row)
      }
    }

    if (unmappedLogs.length > 0 || unmappedPresence.length > 0) {
      console.debug('Workers page - unmapped logs', unmappedLogs)
      console.debug('Workers page - unmapped presence rows', unmappedPresence)
    }

    return admins.map((admin) => {
      const allLogs = (logBuckets.get(admin.id) ?? []).slice().sort((a, b) => {
        const left = getTime(a.timestamp) ?? 0
        const right = getTime(b.timestamp) ?? 0
        return right - left
      })
      const heartbeatLogs = allLogs.filter((log) => isPresenceHeartbeatLog(log))
      const logs = allLogs.filter((log) => !isPresenceHeartbeatLog(log))
      const presence = presenceByAdminId.get(admin.id)

      const times = logs
        .map((log) => getTime(log.timestamp))
        .filter((time): time is number => typeof time === 'number')
      const heartbeatTimes = heartbeatLogs
        .map((log) => getTime(log.timestamp))
        .filter((time): time is number => typeof time === 'number')
      const onlineSignalTimes = [...times, ...heartbeatTimes]

      const todayTimes = times.filter((time) => time >= startOfTodayMs)
      const totalUploads = logs.filter((log) => log.action === 'upload').length
      const totalEdits = logs.filter((log) => log.action === 'edit').length
      const totalDeletes = logs.filter((log) => log.action === 'delete').length
      const uploadsToday = logs.filter((log) => {
        if (log.action !== 'upload') {
          return false
        }
        const time = getTime(log.timestamp)
        return typeof time === 'number' && time >= startOfTodayMs
      }).length

      let logActiveHoursToday = 0
      if (todayTimes.length === 1) {
        logActiveHoursToday = 0.2
      } else if (todayTimes.length > 1) {
        const max = Math.max(...todayTimes)
        const min = Math.min(...todayTimes)
        logActiveHoursToday = (max - min) / (60 * 60 * 1000)
      }

      const activeMsToday =
        typeof presence?.active_ms_today === 'number' &&
        presence.active_ms_today >= 0 &&
        presence.active_date === todayKey
          ? presence.active_ms_today
          : 0
      const presenceActiveHours = activeMsToday / (60 * 60 * 1000)

      const logLastSeenTime = onlineSignalTimes.length ? Math.max(...onlineSignalTimes) : null
      const presenceLastSeenTime = getPresenceHeartbeatTime(presence)
      const lastSeenTime = Math.max(logLastSeenTime ?? 0, presenceLastSeenTime ?? 0) || null

      // make the online check more forgiving by trusting the explicit flag
      const presenceOnline =
        (presence?.is_online === true) ||
        (typeof presenceLastSeenTime === 'number' && now - presenceLastSeenTime <= ONLINE_THRESHOLD_MS)
      const logOnline =
        typeof logLastSeenTime === 'number' && now - logLastSeenTime <= ONLINE_THRESHOLD_MS

      return {
        admin,
        totalActions: logs.length,
        totalUploads,
        totalEdits,
        totalDeletes,
        actionsToday: todayTimes.length,
        uploadsToday,
        recentActions24h: times.filter((time) => time >= since24h).length,
        activeHoursToday: Math.round(Math.max(logActiveHoursToday, presenceActiveHours) * 10) / 10,
        lastSeen: lastSeenTime ? new Date(lastSeenTime).toISOString() : null,
        isOnline: presenceOnline || logOnline,
        currentPage: presence?.current_page ?? null,
        activityEvents: logs.map((log) => ({ created_at: log.timestamp })),
        recentLogs: logs.slice(0, 30),
      }
    })
  }, [admins, clockTick, presenceRows, recentLogs])

  const filteredWorkers = useMemo(() => {
    const normalizedQuery = queryText.trim().toLowerCase()

    const next = workers.filter((worker) => {
      const role = (worker.admin.role ?? 'uploader') as AdminRole
      const matchesQuery =
        normalizedQuery.length === 0 ||
        worker.admin.name?.toLowerCase().includes(normalizedQuery) ||
        worker.admin.email.toLowerCase().includes(normalizedQuery)

      if (!matchesQuery) {
        return false
      }

      if (roleFilter !== 'all' && role !== roleFilter) {
        return false
      }

      if (statusFilter === 'online' && !worker.isOnline) {
        return false
      }

      if (statusFilter === 'offline' && worker.isOnline) {
        return false
      }

      return true
    })

    next.sort((left, right) => {
      if (sortBy === 'name') {
        return (left.admin.name ?? '').localeCompare(right.admin.name ?? '')
      }

      if (sortBy === 'actions_today') {
        return right.actionsToday - left.actionsToday
      }

      if (sortBy === 'uploads') {
        return right.totalUploads - left.totalUploads
      }

      const leftLast = getTime(left.lastSeen) ?? 0
      const rightLast = getTime(right.lastSeen) ?? 0
      return rightLast - leftLast
    })

    return next
  }, [queryText, roleFilter, statusFilter, sortBy, workers])

  useEffect(() => {
    if (filteredWorkers.length === 0) {
      setSelectedWorkerId(null)
      return
    }

    const exists = filteredWorkers.some((worker) => worker.admin.id === selectedWorkerId)
    if (!exists) {
      setSelectedWorkerId(filteredWorkers[0].admin.id)
    }
  }, [filteredWorkers, selectedWorkerId])

  const selectedWorker =
    filteredWorkers.find((worker) => worker.admin.id === selectedWorkerId) ?? null

  // debug toggle state for displaying raw firebase/admin data
  const [showRaw, setShowRaw] = useState(false)

  const totalOnline = workers.filter((worker) => worker.isOnline).length
  const totalUploadsToday = workers.reduce((sum, worker) => sum + worker.uploadsToday, 0)
  const totalActionsToday = workers.reduce((sum, worker) => sum + worker.actionsToday, 0)
  const activeWorkers24h = workers.filter((worker) => worker.recentActions24h > 0).length

  const selectedHeatmapData = selectedWorker
    ? generateActivityHeatmap(selectedWorker.activityEvents)
    : []

  const displayedLogs = showSelectedLogsOnly && selectedWorker
    ? selectedWorker.recentLogs
    : recentLogs.filter((log) => !isPresenceHeartbeatLog(log)).slice(0, 40)

  return (
    <div className="animate-fade-in">
      <Header
        title="Workers"
        subtitle="Monitor worker activity and performance"
        rightSlot={
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={() => void loadAdmins()}>
              <RefreshCw size={13} className="mr-1" />
              Refresh Workers
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => {
                const blob = new Blob([JSON.stringify(workers, null, 2)], {
                  type: 'application/json',
                })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'workers.json'
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn-tertiary text-xs"
              onClick={() => setShowRaw((prev) => !prev)}
            >
              {showRaw ? 'Hide raw data' : 'Show raw data'}
            </button>
          </div>
        }
      />

      {adminsError ? (
        <div className="mx-6 mb-3 border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          {adminsError}
        </div>
      ) : null}

      {firebaseError ? (
        <div className="mx-6 mb-3 border border-accent-amber/40 bg-accent-amber/10 px-3 py-2 text-xs text-accent-amber">
          {firebaseError}
        </div>
      ) : null}

      {showRaw && (
        <div className="mx-6 mb-3 space-y-4 rounded border border-border-subtle bg-bg-elevated p-3 text-xs">
          <p className="font-medium">Raw data (admins / presence / recent logs):</p>
          <pre className="max-h-64 overflow-auto">
            {JSON.stringify({ admins, presenceRows, recentLogs, workers }, null, 2)}
          </pre>
        </div>
      )}

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Workers"
            value={workers.length}
            icon={Users}
            iconColor="text-accent-purple"
          />
          <StatCard
            title="Online Now"
            value={totalOnline}
            icon={Circle}
            iconColor="text-accent-emerald"
          />
          <StatCard
            title="Uploads Today"
            value={totalUploadsToday}
            icon={Upload}
            iconColor="text-accent-blue"
          />
          <StatCard
            title="Actions (24h Active)"
            value={activeWorkers24h}
            suffix={`/ ${workers.length}`}
            icon={Activity}
            iconColor="text-accent-amber"
          />
        </div>

        <div className="glass-card p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              className="admin-input"
              placeholder="Search by name or email"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
            />

            <select
              className="admin-input"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as 'all' | AdminRole)}
            >
              <option value="all">All Roles</option>
              {(['super_admin', 'admin', 'senior_editor', 'junior_editor', 'uploader'] as AdminRole[]).map(
                (role) => (
                  <option key={role} value={role}>
                    {getRoleLabel(role)}
                  </option>
                ),
              )}
            </select>

            <select
              className="admin-input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>

            <select
              className="admin-input"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortBy)}
            >
              <option value="latest">Sort: Latest Activity</option>
              <option value="actions_today">Sort: Actions Today</option>
              <option value="uploads">Sort: Total Uploads</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-2 xl:col-span-2">
            {loadingAdmins
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div key={`worker-skeleton-${index}`} className="skeleton h-24 rounded-2xl" />
                ))
              : filteredWorkers.map((worker) => {
                  const role = (worker.admin.role ?? 'uploader') as AdminRole

                  return (
                    <button
                      key={worker.admin.id}
                      type="button"
                      onClick={() => setSelectedWorkerId(worker.admin.id)}
                      className={cn(
                        'glass-card w-full p-4 text-left transition-all hover:border-border-default',
                        selectedWorkerId === worker.admin.id &&
                          'border-accent-purple/40 shadow-glow-purple',
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-default bg-gradient-to-br from-accent-purple/30 to-accent-blue/20 text-sm font-bold text-text-primary">
                            {worker.admin.name?.[0] ?? 'W'}
                          </div>
                          <span
                            className={cn(
                              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-secondary',
                              worker.isOnline ? 'bg-accent-emerald' : 'bg-text-muted',
                            )}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-text-primary">
                              {worker.admin.name}
                            </p>
                            <span className={cn('badge text-[10px]', getRoleBadgeColor(role))}>
                              {getRoleLabel(role)}
                            </span>
                          </div>
                          <p className="truncate text-xs text-text-muted">{worker.admin.email}</p>
                          <p className="mt-0.5 text-[11px] text-text-muted">
                            Last seen:{' '}
                            {worker.lastSeen ? formatDate(worker.lastSeen, 'relative') : 'No activity yet'}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-right">
                          {[
                            { label: 'Actions', value: worker.totalActions.toLocaleString() },
                            { label: 'Uploads', value: worker.totalUploads.toLocaleString() },
                            { label: 'Today', value: worker.actionsToday.toLocaleString() },
                          ].map((item) => (
                            <div key={`${worker.admin.id}-${item.label}`}>
                              <p className="text-sm font-medium text-text-primary">{item.value}</p>
                              <p className="text-xs text-text-muted">{item.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </button>
                  )
                })}

            {!loadingAdmins && filteredWorkers.length === 0 ? (
              <div className="glass-card py-12 text-center text-sm text-text-muted">
                No workers match current filters.
              </div>
            ) : null}
          </div>

          <div className="glass-card p-5">
            {selectedWorker ? (
              <>
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-text-primary">{selectedWorker.admin.name}</h3>
                  <p className="text-xs text-text-muted">{selectedWorker.admin.email}</p>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-3">
                  {[
                    {
                      label: 'Online',
                      value: selectedWorker.isOnline ? 'Yes' : 'No',
                    },
                    {
                      label: 'Actions Today',
                      value: selectedWorker.actionsToday,
                    },
                    {
                      label: 'Uploads',
                      value: selectedWorker.totalUploads,
                    },
                    {
                      label: 'Active Today',
                      value: `${selectedWorker.activeHoursToday.toFixed(1)}h`,
                    },
                    {
                      label: 'Edits',
                      value: selectedWorker.totalEdits,
                    },
                    {
                      label: 'Deletes',
                      value: selectedWorker.totalDeletes,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-border-subtle bg-bg-elevated p-3"
                    >
                      <p className="text-xs text-text-muted">{item.label}</p>
                      <p className="mt-0.5 font-display text-base font-bold text-text-primary">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mb-4 rounded-xl border border-border-subtle bg-bg-elevated p-3">
                  <p className="text-xs text-text-muted">Current Page</p>
                  <p className="mt-0.5 truncate font-medium text-text-primary">
                    {selectedWorker.currentPage ?? 'Not reported yet'}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs text-text-muted">Worker Activity (52 weeks)</p>
                  <ActivityHeatmap data={selectedHeatmapData} />
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                <Users size={32} className="mb-3 text-text-muted" />
                <p className="text-sm text-text-muted">Select a worker to view details</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-text-primary">Recent Activity Logs</h2>
            <label className="inline-flex items-center gap-2 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={showSelectedLogsOnly}
                onChange={(event) => setShowSelectedLogsOnly(event.target.checked)}
              />
              Show selected worker only
            </label>
          </div>

          {displayedLogs.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-muted">
              No activity logs found for current selection.
            </p>
          ) : (
            <div className="space-y-2">
              {displayedLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 py-2 text-xs">
                  <span className="inline-flex w-32 flex-shrink-0 items-center gap-1 text-text-muted">
                    <Clock3 size={11} />
                    {formatDate(log.timestamp, 'relative')}
                  </span>
                  <span className="max-w-[180px] truncate font-medium text-text-primary">
                    {log.worker_name}
                  </span>
                  <span
                    className={cn(
                      'badge',
                      log.action === 'upload'
                        ? 'border-accent-blue/20 bg-accent-blue/10 text-accent-blue'
                        : log.action === 'delete'
                          ? 'border-accent-red/20 bg-accent-red/10 text-accent-red'
                          : 'border-border-default bg-bg-elevated text-text-secondary',
                    )}
                  >
                    {log.action}
                  </span>
                  <span className="truncate text-text-muted">{log.resource_title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-[11px] text-text-muted">
          Today total actions: {totalActionsToday.toLocaleString()}
        </div>
      </div>
    </div>
  )
}
