'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { isAdminRole, type AdminRole } from '@/types'

const ROLE_CACHE_KEY = 'pdflovers.admin.role'
const ROLE_REFRESH_MS = 60_000

export function useAdminRole() {
  const { user, isLoaded } = useUser()
  const [role, setRole] = useState<AdminRole | null>(null)
  const metadataRole = isAdminRole(user?.publicMetadata?.role) ? user.publicMetadata.role : null

  const persistRole = useCallback((nextRole: AdminRole | null) => {
    if (typeof window === 'undefined') {
      return
    }

    if (!nextRole) {
      sessionStorage.removeItem(ROLE_CACHE_KEY)
      return
    }

    sessionStorage.setItem(ROLE_CACHE_KEY, nextRole)
  }, [])

  const loadRole = useCallback(async () => {
    if (!isLoaded) {
      return
    }

    if (!user) {
      setRole(null)
      persistRole(null)
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
          persistRole(payload.role)
          return
        }
      }
    } catch {
      // Ignore and fall back to Clerk metadata role.
    }

    const fallbackRole = metadataRole ?? 'uploader'
    setRole(fallbackRole)
    persistRole(fallbackRole)
  }, [isLoaded, metadataRole, persistRole, user])

  useEffect(() => {
    if (!isLoaded || !user || role) {
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    const cachedRole = sessionStorage.getItem(ROLE_CACHE_KEY)
    if (isAdminRole(cachedRole)) {
      setRole(cachedRole)
    }
  }, [isLoaded, role, user])

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
      if (document.visibilityState !== 'visible') {
        return
      }
      void loadRole()
    }, ROLE_REFRESH_MS)

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [isLoaded, loadRole, user])

  return role
}
