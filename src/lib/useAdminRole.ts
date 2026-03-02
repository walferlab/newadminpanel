'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { isAdminRole, type AdminRole } from '@/types'

export function useAdminRole() {
  const { user, isLoaded } = useUser()
  const [role, setRole] = useState<AdminRole | null>(null)
  const metadataRole = isAdminRole(user?.publicMetadata?.role) ? user.publicMetadata.role : null

  const loadRole = useCallback(async () => {
    if (!isLoaded) {
      return
    }

    if (!user) {
      setRole(null)
      return
    }

    try {
      const response = await fetch('/api/admins/me', {
        method: 'GET',
        cache: 'no-store',
      })

      if (response.ok) {
        const payload = (await response.json()) as { role?: unknown }
        if (isAdminRole(payload.role)) {
          setRole(payload.role)
          return
        }
      }
    } catch {
      // Ignore and fall back to Clerk metadata role.
    }

    setRole(metadataRole ?? 'uploader')
  }, [isLoaded, metadataRole, user])

  useEffect(() => {
    void loadRole()
  }, [loadRole])

  useEffect(() => {
    if (!isLoaded || !user) {
      return
    }

    function handleFocus() {
      void loadRole()
    }

    const timer = window.setInterval(() => {
      void loadRole()
    }, 15_000)

    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', handleFocus)
    }
  }, [isLoaded, loadRole, user])

  return role
}
