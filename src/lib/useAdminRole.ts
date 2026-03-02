'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { supabase } from '@/lib/supabase'
import { isAdminRole, type AdminRole } from '@/types'

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

export function useAdminRole() {
  const { user, isLoaded } = useUser()
  const [role, setRole] = useState<AdminRole | null>(null)
  const clerkId = user?.id ?? null
  const email = normalizeEmail(user?.primaryEmailAddress?.emailAddress ?? null)
  const metadataRole = isAdminRole(user?.publicMetadata?.role) ? user.publicMetadata.role : null

  const resolveRoleFromRows = useCallback(
    (rows: Array<{ role?: string | null }> | null | undefined): AdminRole | null => {
      if (!rows?.length) {
        return null
      }

      for (const row of rows) {
        if (isAdminRole(row.role)) {
          return row.role
        }
      }

      return null
    },
    [],
  )

  const fetchRoleByColumn = useCallback(
    async (column: 'clerk_id' | 'email', value: string): Promise<AdminRole | null> => {
      const { data, error } = await supabase
        .from('admins')
        .select('role, created_at')
        .eq(column, value)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        return null
      }

      return resolveRoleFromRows((data ?? []) as Array<{ role?: string | null }>)
    },
    [resolveRoleFromRows],
  )

  const loadRole = useCallback(async () => {
    if (!isLoaded) {
      return
    }

    if (!user) {
      setRole(null)
      return
    }

    if (!clerkId && !email) {
      setRole(metadataRole ?? 'uploader')
      return
    }

    if (clerkId) {
      const clerkRole = await fetchRoleByColumn('clerk_id', clerkId)
      if (clerkRole) {
        setRole(clerkRole)
        return
      }
    }

    if (email) {
      const emailRole = await fetchRoleByColumn('email', email)
      if (emailRole) {
        setRole(emailRole)
        return
      }
    }
    setRole(metadataRole ?? 'uploader')
  }, [clerkId, email, fetchRoleByColumn, isLoaded, metadataRole, user])

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

  useEffect(() => {
    if (!isLoaded || !user || (!clerkId && !email)) {
      return
    }

    const channel = supabase
      .channel(`admin-role-sync-${clerkId ?? email}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admins',
        },
        (payload) => {
          const next = payload.new as { clerk_id?: string | null; email?: string | null } | null
          const prev = payload.old as { clerk_id?: string | null; email?: string | null } | null

          const affectedByClerkId =
            Boolean(clerkId) && (next?.clerk_id === clerkId || prev?.clerk_id === clerkId)

          const nextEmail = normalizeEmail(next?.email ?? null)
          const prevEmail = normalizeEmail(prev?.email ?? null)
          const affectedByEmail = Boolean(email) && (nextEmail === email || prevEmail === email)

          if (affectedByClerkId || affectedByEmail) {
            void loadRole()
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [clerkId, email, isLoaded, loadRole, user])

  return role
}
