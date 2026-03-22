'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'
import { useAdminRole } from '@/lib/useAdminRole'
import { calculateQualityScore } from '@/lib/revenue'
import { recordWorkerAction, resolveWorkerIdentity } from '@/lib/workerActivity'
import type { PDF } from '@/types'

interface PdfEditorPageProps {
  params: Promise<{ id: string }>
}

const EMPTY_FORM = {
  title: '',
  author: '',
  category: '',
  tags: '',
  summary: '',
  cover_image_url: '',
  download_url: '',
  smart_link: '',
  published_at: '',
  rating: '',
  page_count: '',
  is_featured: false,
}

export default function PdfEditorPage({ params }: PdfEditorPageProps) {
  const { user } = useUser()
  const role = useAdminRole()
  const [id, setId] = useState<string>('new')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const router = useRouter()

  const isCreate = id === 'new'
  const worker = useMemo(
    () =>
      resolveWorkerIdentity({
        clerkId: user?.id ?? null,
        name: user?.fullName ?? user?.firstName ?? null,
        email: user?.primaryEmailAddress?.emailAddress ?? null,
        role,
      }),
    [role, user],
  )

  useEffect(() => {
    async function init() {
      const resolved = await params
      setId(resolved.id)

      if (resolved.id === 'new') {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('pdfs')
        .select('*')
        .eq('id', Number(resolved.id))
        .single()

      if (error || !data) {
        toast.error('Failed to load PDF')
        setLoading(false)
        return
      }

      const pdf = data as PDF
      setForm({
        title: pdf.title ?? '',
        author: pdf.author ?? '',
        category: pdf.category ?? '',
        tags: (pdf.tags ?? []).join(', '),
        summary: pdf.summary ?? '',
        cover_image_url: pdf.cover_image_url ?? '',
        download_url: pdf.download_url ?? '',
        smart_link: pdf.smart_link ?? '',
        published_at: pdf.published_at ?? '',
        rating: pdf.rating?.toString() ?? '',
        page_count: pdf.page_count?.toString() ?? '',
        is_featured: Boolean(pdf.is_featured),
      })

      setLoading(false)
    }

    init()
  }, [params])

  const quality = useMemo(
    () =>
      Math.round(
        calculateQualityScore({
          title: form.title,
          author: form.author,
          category: form.category,
          tags: form.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          summary: form.summary,
          cover_image_url: form.cover_image_url,
          download_url: form.download_url,
        }) * 100,
      ),
    [form],
  )

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()

    setSaving(true)

    const payload = {
      title: form.title.trim() || 'Untitled PDF',
      author: form.author.trim() || null,
      category: form.category.trim() || null,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      summary: form.summary.trim() || null,
      cover_image_url: form.cover_image_url.trim() || null,
      download_url: form.download_url.trim() || null,
      smart_link: form.smart_link.trim() || null,
      published_at: form.published_at || null,
      rating: form.rating ? Number(form.rating) : null,
      page_count: form.page_count ? Number(form.page_count) : null,
      is_featured: form.is_featured,
      updated_at: new Date().toISOString(),
    }

    const mutation = isCreate
      ? supabase.from('pdfs').insert(payload).select('id, title').single()
      : supabase.from('pdfs').update(payload).eq('id', Number(id)).select('id, title').single()

    const { data: savedRow, error } = await mutation

    if (error) {
      toast.error(error.message)
      setSaving(false)
      return
    }

    if (worker) {
      const resourceId = savedRow?.id ? String(savedRow.id) : id
      const resourceTitle = savedRow?.title ?? payload.title
      void recordWorkerAction({
        worker,
        action: isCreate ? 'upload' : 'edit',
        resourceType: 'pdf',
        resourceId,
        resourceTitle,
        details: isCreate ? 'Created via PDF editor' : 'Updated via PDF editor',
      })
    }

    toast.success(isCreate ? 'PDF uploaded' : 'PDF updated')
    router.push('/books')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <div className="spinner" />
          Loading PDF editor...
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <Header
        title={isCreate ? 'Upload PDF' : 'Edit PDF'}
        subtitle="Create or update PDF metadata and links"
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs text-gray-500">Title</label>
            <input
              className="admin-input"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Book title"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Author</label>
            <input
              className="admin-input"
              value={form.author}
              onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
              placeholder="Author name"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Category</label>
            <input
              className="admin-input"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              placeholder="Category"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs text-gray-500">Tags (comma-separated)</label>
            <input
              className="admin-input"
              value={form.tags}
              onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
              placeholder="education, exam, 2026"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Cover Image URL</label>
            <input
              className="admin-input"
              value={form.cover_image_url}
              onChange={(e) => setForm((p) => ({ ...p, cover_image_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Download URL</label>
            <input
              className="admin-input"
              value={form.download_url}
              onChange={(e) => setForm((p) => ({ ...p, download_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Smart Link</label>
            <input
              className="admin-input"
              value={form.smart_link}
              onChange={(e) => setForm((p) => ({ ...p, smart_link: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Page Count</label>
            <input
              type="number"
              className="admin-input"
              value={form.page_count}
              onChange={(e) => setForm((p) => ({ ...p, page_count: e.target.value }))}
              placeholder="0"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Rating</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              className="admin-input"
              value={form.rating}
              onChange={(e) => setForm((p) => ({ ...p, rating: e.target.value }))}
              placeholder="0.0"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Published Date</label>
            <input
              type="date"
              className="admin-input"
              value={form.published_at}
              onChange={(e) => setForm((p) => ({ ...p, published_at: e.target.value }))}
            />
          </div>

          <div className="flex items-center gap-3 pt-6">
            <input
              id="featured"
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) => setForm((p) => ({ ...p, is_featured: e.target.checked }))}
            />
            <label htmlFor="featured" className="text-sm text-gray-300">
              Mark as featured
            </label>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs text-gray-500">Summary</label>
            <textarea
              className="admin-input h-28 resize-none"
              value={form.summary}
              onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
              placeholder="Write a useful description..."
            />
          </div>
        </div>

        <div className="border border-white/6 rgba(14,14,14,0.95) p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-500">Metadata quality</span>
            <span className="font-medium text-white">{quality}%</span>
          </div>
          <div className="h-1.5 rgba(255,255,255,0.04)">
            <div className="h-full bg-accent-amber" style={{ width: `${quality}%` }} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
            <Save size={14} />
            {saving ? 'Saving...' : isCreate ? 'Upload PDF' : 'Save Changes'}
          </button>
          <Link href="/books" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft size={14} />
            Back to books
          </Link>
        </div>
      </form>
    </div>
  )
}
