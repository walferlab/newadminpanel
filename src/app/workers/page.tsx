'use client'

import { useEffect, useState } from 'react'
import { Circle, TrendingUp, Upload, Users } from 'lucide-react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { ActivityHeatmap } from '@/components/ui/ActivityHeatmap'
import { db, ensureFirebaseClientAuth, getFirebaseErrorMessage } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'
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
  totalUploads: number
  totalDownloads: number
  activeHoursToday: number
  estimatedRevenue: number
  isOnline: boolean
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerStats[]>([])
  const [recentLogs, setRecentLogs] = useState<ChangeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [firebaseError, setFirebaseError] = useState<string | null>(null)
  const [selected, setSelected] = useState<WorkerStats | null>(null)

  useEffect(() => {
    async function fetchWorkers() {
      const { data: admins } = await supabase.from('admins').select('*')

      if (!admins) {
        setWorkers([])
        setLoading(false)
        return
      }

      const stats: WorkerStats[] = (admins as Admin[]).map((admin) => ({
        admin,
        totalUploads: Math.floor(Math.random() * 80) + 5,
        totalDownloads: Math.floor(Math.random() * 5000) + 100,
        activeHoursToday: Math.round(Math.random() * 8 * 10) / 10,
        estimatedRevenue: Math.round((Math.random() * 2000 + 200) * 100) / 100,
        isOnline: Math.random() > 0.5,
      }))

      setWorkers(stats)
      setLoading(false)
    }

    void fetchWorkers()

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
        limit(20),
      )

      unsubscribe = onSnapshot(
        logsQuery,
        (snapshot) => {
          if (!active) {
            return
          }
          setFirebaseError(null)
          const logs = snapshot.docs.map((doc) => {
            const data = doc.data() as Omit<ChangeLog, 'id'>
            return {
              id: doc.id,
              ...data,
            }
          })
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

  const totalOnline = workers.filter((worker) => worker.isOnline).length

  const heatmapData = generateActivityHeatmap(
    Array.from({ length: 300 }, (_, index) => ({
      created_at: new Date(
        Date.now() - index * 3_600_000 * (Math.random() * 8),
      ).toISOString(),
    })),
  )

  return (
    <div className="animate-fade-in">
      <Header title="Workers" subtitle="Monitor worker activity and performance" />

      {firebaseError ? (
        <div className="mb-3 border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          {firebaseError}
        </div>
      ) : null}

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
            value={workers.reduce((sum, worker) => sum + worker.totalUploads, 0)}
            icon={Upload}
            iconColor="text-accent-blue"
          />
          <StatCard
            title="Estimated Revenue"
            value={`INR ${workers
              .reduce((sum, worker) => sum + worker.estimatedRevenue, 0)
              .toFixed(0)}`}
            icon={TrendingUp}
            iconColor="text-accent-amber"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-2 xl:col-span-2">
            {loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div key={`worker-skeleton-${index}`} className="skeleton h-20 rounded-2xl" />
                ))
              : workers.map((worker) => {
                  const role = (worker.admin.role ?? 'uploader') as AdminRole

                  return (
                    <div
                      key={worker.admin.id}
                      onClick={() => setSelected(worker)}
                      className={cn(
                        'glass-card cursor-pointer p-4 transition-all hover:border-border-default',
                        selected?.admin.id === worker.admin.id &&
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
                            <p className="text-sm font-medium text-text-primary">{worker.admin.name}</p>
                            <span className={cn('badge text-[10px]', getRoleBadgeColor(role))}>
                              {getRoleLabel(role)}
                            </span>
                          </div>
                          <p className="truncate text-xs text-text-muted">{worker.admin.email}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-right">
                          {[
                            { label: 'Uploads', value: worker.totalUploads },
                            {
                              label: 'Downloads',
                              value: worker.totalDownloads.toLocaleString(),
                            },
                            {
                              label: 'Revenue',
                              value: `INR ${worker.estimatedRevenue.toFixed(0)}`,
                            },
                          ].map((item) => (
                            <div key={`${worker.admin.id}-${item.label}`}>
                              <p className="text-sm font-medium text-text-primary">{item.value}</p>
                              <p className="text-xs text-text-muted">{item.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
          </div>

          <div className="glass-card p-5">
            {selected ? (
              <>
                <h3 className="mb-4 text-sm font-medium text-text-primary">
                  {selected.admin.name} Activity
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs text-text-muted">Upload Activity (52 weeks)</p>
                    <ActivityHeatmap data={heatmapData} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        label: 'Active Today',
                        value: `${selected.activeHoursToday.toFixed(1)}h`,
                      },
                      { label: 'Uploads', value: selected.totalUploads },
                      {
                        label: 'Downloads',
                        value: selected.totalDownloads.toLocaleString(),
                      },
                      {
                        label: 'Est. Revenue',
                        value: `INR ${selected.estimatedRevenue.toFixed(2)}`,
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
          <h2 className="mb-4 text-sm font-medium text-text-primary">Recent Activity Logs</h2>

          {recentLogs.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-muted">
              No recent activity. Firebase change logs will appear here in real time.
            </p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 py-2 text-xs">
                  <span className="w-32 flex-shrink-0 text-text-muted">
                    {formatDate(log.timestamp, 'relative')}
                  </span>
                  <span className="font-medium text-text-primary">{log.worker_name}</span>
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
      </div>
    </div>
  )
}
