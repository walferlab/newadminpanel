'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { DEFAULT_REVENUE_CONFIG } from '@/lib/revenue'
import { supabase } from '@/lib/supabase'
import type { RevenueConfig } from '@/types'

const PREFS_KEY = 'pdflovers.settings.preferences'
const PROFILE_DRAFT_KEY = 'pdflovers.settings.profile'
const REVENUE_DEFAULTS_KEY = 'pdflovers.revenue.defaults'

interface UserPreferences {
  compactTables: boolean
  smoothAnimations: boolean
  defaultPage: '/dashboard' | '/books' | '/data-imports'
}

interface ProfileFormState {
  name: string
  email: string
}

const DEFAULT_PREFERENCES: UserPreferences = {
  compactTables: false,
  smoothAnimations: true,
  defaultPage: '/dashboard',
}

export default function SettingsPage() {
  const { user } = useUser()

  const [profileId, setProfileId] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [savingRevenue, setSavingRevenue] = useState(false)

  const [profile, setProfile] = useState<ProfileFormState>({
    name: '',
    email: '',
  })

  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [revenueDefaults, setRevenueDefaults] =
    useState<RevenueConfig>(DEFAULT_REVENUE_CONFIG)

  useEffect(() => {
    const draftRaw = localStorage.getItem(PROFILE_DRAFT_KEY)
    if (draftRaw) {
      try {
        const parsed = JSON.parse(draftRaw) as Partial<ProfileFormState>
        setProfile((prev) => ({
          name: parsed.name ?? prev.name,
          email: parsed.email ?? prev.email,
        }))
      } catch {}
    }

    const prefsRaw = localStorage.getItem(PREFS_KEY)
    if (prefsRaw) {
      try {
        const parsed = JSON.parse(prefsRaw) as Partial<UserPreferences>
        setPreferences((prev) => ({ ...prev, ...parsed }))
      } catch {}
    }

    const revenueRaw = localStorage.getItem(REVENUE_DEFAULTS_KEY)
    if (revenueRaw) {
      try {
        const parsed = JSON.parse(revenueRaw) as Partial<RevenueConfig>
        setRevenueDefaults((prev) => ({ ...prev, ...parsed }))
      } catch {}
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('compact-ui', preferences.compactTables)
    document.body.classList.toggle('reduce-motion', !preferences.smoothAnimations)
  }, [preferences])

  useEffect(() => {
    async function loadProfile() {
      const email = user?.primaryEmailAddress?.emailAddress ?? ''
      const clerkId = user?.id ?? ''
      const defaultName = user?.fullName || user?.firstName || ''

      if (!email && !clerkId) {
        setProfileLoading(false)
        return
      }

      setProfile((prev) => ({
        ...prev,
        email: prev.email || email,
        name: prev.name || defaultName,
      }))

      let query = supabase.from('admins').select('id, name, email, clerk_id')
      if (clerkId) {
        query = query.eq('clerk_id', clerkId)
      } else {
        query = query.eq('email', email)
      }

      const { data, error } = await query.maybeSingle()

      if (error && error.code !== 'PGRST116') {
        toast.error('Could not load profile from database')
        setProfileLoading(false)
        return
      }

      if (data) {
        setProfileId(String(data.id))
        setProfile({
          name: data.name ?? defaultName,
          email: data.email ?? email,
        })
      }

      setProfileLoading(false)
    }

    void loadProfile()
  }, [user])

  async function saveProfile() {
    const name = profile.name.trim()
    const email = profile.email.trim().toLowerCase()
    const clerkId = user?.id ?? ''

    if (!name || !email) {
      toast.error('Name and email are required')
      return
    }

    setSavingProfile(true)
    localStorage.setItem(PROFILE_DRAFT_KEY, JSON.stringify({ name, email }))

    if (profileId) {
      const { error } = await supabase
        .from('admins')
        .update({ name, email })
        .eq('id', profileId)

      if (error) {
        toast.error('Failed to save profile')
      } else {
        toast.success('Profile updated')
      }
      setSavingProfile(false)
      return
    }

    if (!clerkId) {
      toast.error('Missing Clerk user id for profile creation')
      setSavingProfile(false)
      return
    }

    const { data, error } = await supabase
      .from('admins')
      .upsert(
        {
          clerk_id: clerkId,
          name,
          email,
          approved: false,
          role: 'uploader',
        },
        { onConflict: 'clerk_id' },
      )
      .select('id')
      .maybeSingle()

    if (error) {
      toast.error('Failed to save profile')
      setSavingProfile(false)
      return
    }

    if (data?.id) {
      setProfileId(String(data.id))
    }

    toast.success('Profile saved')
    setSavingProfile(false)
  }

  function savePreferences() {
    setSavingPreferences(true)
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences))
    document.cookie = `pdflovers_default_page=${preferences.defaultPage}; path=/; max-age=31536000; samesite=lax`
    setSavingPreferences(false)
    toast.success('Preferences saved')
  }

  function saveRevenueDefaults() {
    setSavingRevenue(true)
    localStorage.setItem(REVENUE_DEFAULTS_KEY, JSON.stringify(revenueDefaults))
    setSavingRevenue(false)
    toast.success('Revenue defaults saved')
  }

  return (
    <div className="animate-fade-in">
      <Header title="Settings" subtitle="Manage profile, preferences, and app defaults" />

      <div className="mx-auto max-w-5xl space-y-8 pb-8">
        <section className="border-b border-border-subtle pb-6">
          <h2 className="font-display text-xl text-text-primary">Profile</h2>
          <p className="mt-1 text-sm text-text-muted">
            Update your admin information stored in Supabase.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-muted">
                Name
              </label>
              <input
                className="admin-input"
                value={profile.name}
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, name: event.target.value }))
                }
                disabled={profileLoading}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-muted">
                Email
              </label>
              <input
                className="admin-input"
                value={profile.email}
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, email: event.target.value }))
                }
                disabled={profileLoading}
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              className="btn-primary"
              onClick={saveProfile}
              disabled={savingProfile || profileLoading}
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </section>

        <section className="border-b border-border-subtle pb-6">
          <h2 className="font-display text-xl text-text-primary">Preferences</h2>
          <p className="mt-1 text-sm text-text-muted">
            Control compact table layout, animations, and your default landing page.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={preferences.compactTables}
                onChange={(event) =>
                  setPreferences((prev) => ({
                    ...prev,
                    compactTables: event.target.checked,
                  }))
                }
              />
              Compact table spacing
            </label>

            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={preferences.smoothAnimations}
                onChange={(event) =>
                  setPreferences((prev) => ({
                    ...prev,
                    smoothAnimations: event.target.checked,
                  }))
                }
              />
              Smooth animations
            </label>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-muted">
                Default Page
              </label>
              <select
                className="admin-input"
                value={preferences.defaultPage}
                onChange={(event) =>
                  setPreferences((prev) => ({
                    ...prev,
                    defaultPage: event.target.value as UserPreferences['defaultPage'],
                  }))
                }
              >
                <option value="/dashboard">Dashboard</option>
                <option value="/books">Books</option>
                <option value="/data-imports">Inbox</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              className="btn-primary"
              onClick={savePreferences}
              disabled={savingPreferences}
            >
              {savingPreferences ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </section>

        <section className="border-b border-border-subtle pb-6">
          <h2 className="font-display text-xl text-text-primary">Revenue Defaults</h2>
          <p className="mt-1 text-sm text-text-muted">
            These values are used as the default calculator input on the Revenue page.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { key: 'base_pay' as const, label: 'Base Pay' },
              { key: 'click_pay' as const, label: 'Click Pay' },
              { key: 'pv_rate' as const, label: 'PV Rate' },
              { key: 'cap_pv' as const, label: 'PV Cap' },
              { key: 'min_pv_threshold' as const, label: 'Min PV Threshold' },
              { key: 'min_click_threshold' as const, label: 'Min Click Threshold' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-muted">
                  {label}
                </label>
                <input
                  type="number"
                  className="admin-input"
                  value={revenueDefaults[key]}
                  onChange={(event) =>
                    setRevenueDefaults((prev) => ({
                      ...prev,
                      [key]: Number(event.target.value) || 0,
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={saveRevenueDefaults}
              disabled={savingRevenue}
            >
              {savingRevenue ? 'Saving...' : 'Save Revenue Defaults'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setRevenueDefaults(DEFAULT_REVENUE_CONFIG)}
            >
              Reset
            </button>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl text-text-primary">Integrations</h2>
          <p className="mt-1 text-sm text-text-muted">
            Environment-backed values are read-only in the running app.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="border border-border-subtle p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Supabase URL</p>
              <p className="mt-1 truncate text-sm text-text-secondary">
                {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not configured'}
              </p>
            </div>
            <div className="border border-border-subtle p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-text-muted">
                Firebase Project ID
              </p>
              <p className="mt-1 truncate text-sm text-text-secondary">
                {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Not configured'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
