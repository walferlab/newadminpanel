'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, UserCheck, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { getRoleLabel, formatDate } from '@/lib/utils'
import type { Admin, AdminRole } from '@/types'

const ROLES: AdminRole[] = ['super_admin', 'admin', 'senior_editor', 'junior_editor', 'uploader']

export default function ApprovalsPage() {
  const [users, setUsers]     = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | 'pending' | 'approved'>('pending')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admins', { cache: 'no-store' })
    if (!res.ok) { toast.error('Failed to load users'); setLoading(false); return }
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void fetchUsers() }, [fetchUsers])

  async function handleApprove(id: string) {
    const res = await fetch('/api/admins', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved: true }),
    })
    if (!res.ok) return toast.error('Failed to approve')
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, approved: true } : u))
    toast.success('User approved')
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke access for this user?')) return
    const res = await fetch('/api/admins', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved: false }),
    })
    if (!res.ok) return toast.error('Failed to revoke')
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, approved: false } : u))
    toast.success('Access revoked')
  }

  async function handleRoleChange(id: string, role: AdminRole) {
    const res = await fetch('/api/admins', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role }),
    })
    if (!res.ok) return toast.error('Failed to update role')
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u))
    toast.success('Role updated')
  }

  const filtered = users.filter((u) => {
    if (filter === 'pending') return !u.approved
    if (filter === 'approved') return u.approved
    return true
  })

  const card = { background: 'rgba(14,14,14,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }
  const pendingCount = users.filter((u) => !u.approved).length

  return (
    <div className="animate-fade-in">
      <Header title="Approvals" subtitle={`${pendingCount} pending · ${users.length} total users`} />
      <div className="space-y-4 p-4 md:p-5">
        <div className="flex gap-1" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 4 }}>
          {(['all', 'pending', 'approved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex-1 py-2 text-xs font-medium capitalize rounded-lg transition-all"
              style={{
                background: filter === f ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: filter === f ? '#fff' : '#555',
                border: filter === f ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
              }}
            >
              {f} {f === 'pending' && pendingCount > 0 ? `(${pendingCount})` : ''}
            </button>
          ))}
        </div>

        <div style={card} className="overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center" style={{ color: '#444', fontSize: 14 }}>No users found.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <p style={{ color: '#fff', fontWeight: 500, fontSize: 13 }}>{u.name ?? 'Unknown'}</p>
                      <p style={{ fontSize: 11, color: '#444' }}>{u.email}</p>
                    </td>
                    <td>
                      <select
                        value={u.role ?? 'uploader'}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as AdminRole)}
                        className="text-xs rounded-lg px-2 py-1 outline-none transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#aaa', appearance: 'none' }}
                      >
                        {ROLES.map((r) => <option key={r} value={r} style={{ background: '#111' }}>{getRoleLabel(r)}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className={u.approved ? 'badge badge-green' : 'badge badge-amber'}>
                        {u.approved ? <><CheckCircle size={10} /> Approved</> : 'Pending'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{formatDate(u.created_at, 'short')}</td>
                    <td>
                      <div className="flex gap-2">
                        {!u.approved ? (
                          <button onClick={() => handleApprove(u.id)} className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70" style={{ color: '#4ade80' }}>
                            <UserCheck size={13} /> Approve
                          </button>
                        ) : (
                          <button onClick={() => handleRevoke(u.id)} className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70" style={{ color: '#f87171' }}>
                            <UserX size={13} /> Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
