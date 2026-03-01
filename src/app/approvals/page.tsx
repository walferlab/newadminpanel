'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle,
  Clock,
  Shield,
  UserCheck,
  UserX,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { cn, formatDate, getRoleLabel } from '@/lib/utils'
import type { Admin, AdminRole } from '@/types'

interface PendingUser extends Admin {
  approved: boolean
  role: AdminRole
}

export default function ApprovalsPage() {
  const [users, setUsers] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending')

  async function fetchUsers() {
    setLoading(true)

    const response = await fetch('/api/admins', { method: 'GET', cache: 'no-store' })
    if (!response.ok) {
      toast.error('Failed to load users')
      setUsers([])
      setLoading(false)
      return
    }

    const payload = (await response.json()) as { users?: Admin[] }
    const normalized = ((payload.users ?? []) as Admin[]).map((user) => ({
        ...user,
        approved: Boolean(user.approved),
        role: (user.role ?? 'uploader') as AdminRole,
    }))
    setUsers(normalized)

    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  async function handleApprove(id: string) {
    const response = await fetch('/api/admins', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved: true }),
    })

    if (!response.ok) {
      toast.error('Failed to approve user')
      return
    }

    toast.success('User approved')
    fetchUsers()
  }

  async function handleReject(id: string) {
    const response = await fetch('/api/admins', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved: false }),
    })

    if (!response.ok) {
      toast.error('Failed to update user')
      return
    }

    toast.success('User updated')
    fetchUsers()
  }

  async function handleRoleChange(id: string, role: AdminRole) {
    const response = await fetch('/api/admins', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role }),
    })

    if (!response.ok) {
      toast.error('Failed to change role')
      return
    }

    toast.success('Role changed')
    fetchUsers()
  }

  const filtered = users.filter((user) => {
    if (filter === 'pending') {
      return !user.approved
    }
    if (filter === 'approved') {
      return user.approved
    }
    return true
  })

  const pendingCount = users.filter((user) => !user.approved).length
  const approvedCount = users.filter((user) => user.approved).length

  return (
    <div className="animate-fade-in">
      <Header title="User Approvals" subtitle="Manage admin access and roles" />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="stat-card flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-amber/20 bg-accent-amber/10">
              <Clock size={18} className="text-accent-amber" />
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-text-primary">{pendingCount}</p>
              <p className="text-xs text-text-muted">Awaiting Approval</p>
            </div>
          </div>

          <div className="stat-card flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-emerald/20 bg-accent-emerald/10">
              <CheckCircle size={18} className="text-accent-emerald" />
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-text-primary">{approvedCount}</p>
              <p className="text-xs text-text-muted">Approved Users</p>
            </div>
          </div>

          <div className="stat-card flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-purple/20 bg-accent-purple/10">
              <Shield size={18} className="text-accent-purple" />
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-text-primary">{users.length}</p>
              <p className="text-xs text-text-muted">Total Users</p>
            </div>
          </div>
        </div>

        <div className="w-fit rounded-xl border border-border-subtle bg-bg-secondary p-1">
          {[
            { key: 'all' as const, label: 'All', count: users.length },
            { key: 'pending' as const, label: 'Pending', count: pendingCount },
            { key: 'approved' as const, label: 'Approved', count: approvedCount },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-all',
                filter === item.key
                  ? 'bg-bg-elevated text-text-primary'
                  : 'text-text-muted hover:text-text-secondary',
              )}
              type="button"
            >
              {item.label}
              <span className="rounded-full bg-bg-primary px-1.5 text-[10px]">{item.count}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div key={`approval-loading-${index}`} className="skeleton h-20 rounded-2xl" />
              ))
            : filtered.map((user) => (
                <div key={user.id} className="glass-card p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border-default bg-gradient-to-br from-accent-purple/30 to-accent-blue/20 text-sm font-bold text-text-primary">
                      {user.name?.[0] ?? 'U'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-2">
                        <p className="text-sm font-medium text-text-primary">{user.name}</p>
                        <span
                          className={cn(
                            'badge text-[10px]',
                            user.approved
                              ? 'border-accent-emerald/20 bg-accent-emerald/10 text-accent-emerald'
                              : 'border-accent-amber/20 bg-accent-amber/10 text-accent-amber',
                          )}
                        >
                          {user.approved ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted">{user.email}</p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        Joined {formatDate(user.created_at, 'relative')} | Role:{' '}
                        {getRoleLabel(user.role ?? 'uploader')}
                      </p>
                    </div>

                    <select
                      value={user.role ?? 'uploader'}
                      onChange={(event) =>
                        handleRoleChange(user.id, event.target.value as AdminRole)
                      }
                      className="rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1.5 text-xs text-text-primary outline-none"
                    >
                      {(
                        [
                          'super_admin',
                          'admin',
                          'senior_editor',
                          'junior_editor',
                          'uploader',
                        ] as AdminRole[]
                      ).map((role) => (
                        <option key={role} value={role}>
                          {getRoleLabel(role)}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2">
                      {!user.approved && (
                        <button
                          onClick={() => handleApprove(user.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-accent-emerald/20 bg-accent-emerald/10 px-3 py-1.5 text-xs text-accent-emerald transition-colors hover:bg-accent-emerald/20"
                          type="button"
                        >
                          <UserCheck size={13} />
                          Approve
                        </button>
                      )}

                      <button
                        onClick={() => handleReject(user.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-accent-red/20 bg-accent-red/10 px-3 py-1.5 text-xs text-accent-red transition-colors hover:bg-accent-red/20"
                        type="button"
                      >
                        <UserX size={13} />
                        {user.approved ? 'Revoke' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

          {!loading && filtered.length === 0 && (
            <div className="py-16 text-center text-text-muted">
              <UserCheck size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No users in this category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
