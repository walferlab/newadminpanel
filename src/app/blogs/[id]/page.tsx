'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff, Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'

const CATEGORIES = ['Technology', 'Fiction', 'Non-Fiction', 'Science', 'Philosophy', 'History', 'Finance', 'Health', 'Education', 'Other']

export default function BlogEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [preview, setPreview]   = useState(false)
  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content_html: '',
    category: '',
    tags: '',
    is_published: false,
    cover_image_url: '',
  })

  const fetchBlog = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('blogs').select('*').eq('id', id).single()
    if (error || !data) { toast.error('Blog not found'); router.push('/blogs'); return }
    setForm({
      title: data.title ?? '',
      slug: data.slug ?? '',
      excerpt: data.excerpt ?? '',
      content_html: data.content_html ?? '',
      category: data.category ?? '',
      tags: (data.tags ?? []).join(', '),
      is_published: data.is_published ?? false,
      cover_image_url: data.cover_image_url ?? '',
    })
    setLoading(false)
  }, [id, router])

  useEffect(() => { void fetchBlog() }, [fetchBlog])

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function autoSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
  }

  async function handleSave() {
    if (!form.title.trim() || !form.slug.trim()) return toast.error('Title and slug are required')
    setSaving(true)
    const { error } = await supabase.from('blogs').update({
      title: form.title.trim(),
      slug: form.slug.trim(),
      excerpt: form.excerpt.trim() || null,
      content_html: form.content_html,
      category: form.category || null,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      is_published: form.is_published,
      published_at: form.is_published ? new Date().toISOString() : null,
      cover_image_url: form.cover_image_url.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    setSaving(false)
    if (error) return toast.error('Failed to save: ' + error.message)
    toast.success('Blog saved!')
  }

  const card = { background: 'rgba(14,14,14,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }
  const label = { fontSize: 12, color: '#555', display: 'block', marginBottom: 6 }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="spinner" />
    </div>
  )

  return (
    <div className="animate-fade-in">
      <Header
        title="Edit Blog"
        subtitle={form.title || 'Untitled'}
        actions={
          <div className="flex gap-2">
            <button onClick={() => router.push('/blogs')} className="btn-secondary">
              <ArrowLeft size={14} /> Back
            </button>
            <button onClick={() => setPreview(!preview)} className="btn-secondary">
              {preview ? <EyeOff size={14} /> : <Eye size={14} />}
              {preview ? 'Edit' : 'Preview'}
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3 md:p-5">

        {/* Main editor */}
        <div className="md:col-span-2 space-y-4">
          <div style={card}>
            <label style={label}>Title *</label>
            <input
              className="admin-input"
              value={form.title}
              onChange={(e) => { set('title', e.target.value); set('slug', autoSlug(e.target.value)) }}
              placeholder="Blog title"
            />
          </div>

          <div style={card}>
            <div className="flex items-center justify-between mb-2">
              <label style={{ ...label, marginBottom: 0 }}>Content (HTML) *</label>
              <span style={{ fontSize: 11, color: '#444' }}>{form.content_html.length} chars</span>
            </div>
            {preview ? (
              <div
                style={{ minHeight: 400, padding: 16, background: '#111', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}
                dangerouslySetInnerHTML={{ __html: form.content_html }}
              />
            ) : (
              <textarea
                className="admin-textarea"
                rows={18}
                style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 }}
                value={form.content_html}
                onChange={(e) => set('content_html', e.target.value)}
                placeholder="Write HTML content here..."
              />
            )}
          </div>

          <div style={card}>
            <label style={label}>Excerpt</label>
            <textarea
              className="admin-textarea"
              rows={3}
              value={form.excerpt}
              onChange={(e) => set('excerpt', e.target.value)}
              placeholder="Short description shown in blog list..."
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Publish */}
          <div style={card} className="space-y-3">
            <label style={label}>Publish status</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => set('is_published', !form.is_published)}
                className="flex items-center gap-2 transition-all"
                style={{
                  background: form.is_published ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                  border: form.is_published ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 8, padding: '6px 12px',
                  color: form.is_published ? '#4ade80' : '#555', fontSize: 13, fontWeight: 500,
                }}
              >
                {form.is_published ? <Eye size={13} /> : <EyeOff size={13} />}
                {form.is_published ? 'Published' : 'Draft'}
              </button>
            </div>
          </div>

          {/* Slug */}
          <div style={card}>
            <label style={label}>URL Slug</label>
            <input
              className="admin-input"
              value={form.slug}
              onChange={(e) => set('slug', e.target.value)}
              placeholder="my-blog-post"
            />
            <p style={{ fontSize: 11, color: '#444', marginTop: 6 }}>pdflovers.app/blogs/{form.slug || '...'}</p>
          </div>

          {/* Category */}
          <div style={card}>
            <label style={label}>Category</label>
            <select
              className="admin-input"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              style={{ appearance: 'none' }}
            >
              <option value="" style={{ background: '#111' }}>No category</option>
              {CATEGORIES.map((c) => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div style={card}>
            <label style={label}>Tags (comma separated)</label>
            <input
              className="admin-input"
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="book, fiction, classic"
            />
          </div>

          {/* Cover image */}
          <div style={card}>
            <label style={label}>Cover Image URL</label>
            <input
              className="admin-input"
              value={form.cover_image_url}
              onChange={(e) => set('cover_image_url', e.target.value)}
              placeholder="https://..."
            />
            {form.cover_image_url && (
              <img src={form.cover_image_url} alt="Cover" className="mt-2 w-full rounded-lg object-cover" style={{ height: 100 }} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
