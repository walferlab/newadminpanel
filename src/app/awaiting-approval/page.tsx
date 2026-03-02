'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Clock3 } from 'lucide-react'

export default function AwaitingApprovalPage() {
  const router = useRouter()
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [syncMessage, setSyncMessage] = useState('')

  useEffect(() => {
    let active = true

    async function syncRequest() {
      setSyncState('syncing')

      try {
        const response = await fetch('/api/admins/sync', { method: 'POST' })
        if (!active) {
          return
        }

        if (response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { approved?: boolean }
          if (payload.approved === true) {
            router.replace('/dashboard')
            router.refresh()
            return
          }
          setSyncState('done')
          setSyncMessage('Your approval request has been synced.')
          return
        }

        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        setSyncState('error')
        setSyncMessage(payload.error || 'Could not sync approval request yet.')
      } catch {
        if (!active) {
          return
        }
        setSyncState('error')
        setSyncMessage('Network error while syncing request.')
      }
    }

    void syncRequest()

    return () => {
      active = false
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg border border-border-subtle bg-bg-secondary p-8 text-center">
        <Image src="/logo.png" alt="PDF Lovers" width={42} height={42} className="mx-auto" />
        <div className="mx-auto mb-4 mt-4 flex h-10 w-10 items-center justify-center border border-accent-amber/40 bg-accent-amber/10">
          <Clock3 size={20} className="text-accent-amber" />
        </div>
        <h1 className="font-display text-2xl text-text-primary">Awaiting Approval</h1>
        <p className="mt-2 text-sm text-text-muted">
          Your account is created but not yet approved by a super admin.
        </p>
        <p className="mt-4 text-xs text-text-muted">
          {syncState === 'syncing' ? 'Syncing your request...' : syncMessage}
        </p>
      </div>
    </div>
  )
}
