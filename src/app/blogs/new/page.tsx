'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'

const CATEGORIES = ['Technology', 'Fiction', 'Non-Fiction', 'Science', 'Philosophy', 'History', 'Finance', 'Health', 'Education', 'Other']

export default function NewBlogPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', content_html: '', category: '', tags: '', cover_image_url: '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function autoSlug(t: string) {
    return t.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.content_html.trim()) return toast.error('Title and content are required')
    setSaving(true)
    const { data, error } = await supabase.from('blogs').insert({
      title: form.title.trim(),
      slug: form.slug.trim() || autoSlug(form.title),
      excerpt: form.excerpt.trim() || null,
      content_html: form.content_html,
      category: form.category || null,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      is_published: false,
      cover_image_url: form.cover_image_url.trim() || null,
    }).select('id').single()
    setSaving(false)
    if (error) return toast.error('Failed to create: ' + error.message)
    toast.success('Blog created!')
    router.push(`/blogs/${data.id}`)
  }

  const card = { background: 'rgba(14,14,14,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }
  const label = { fontSize: 12, color: '#555', display: 'block', marginBottom: 6 }

  return (
    <div className="animate-fade-in">
      <Header
        title="New Blog"
        subtitle="Create a new blog post"
        actions={
          <div className="flex gap-2">
            <button onClick={() => router.push('/blogs')} className="btn-secondary"><ArrowLeft size={14} /> Back</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Create
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3 md:p-5">
        <div className="md:col-span-2 space-y-4">
          <div style={card}>
            <label style={label}>Title *</label>
            <input className="admin-input" value={form.title} onChange={(e) => { set('title', e.target.value); set('slug', autoSlug(e.target.value)) }} placeholder="Blog title" />
          </div>
          <div style={card}>
            <label style={label}>Content (HTML) *</label>
            <textarea className="admin-textarea" rows={18} style={{ fontFamily: 'monospace', fontSize: 13 }} value={form.content_html} onChange={(e) => set('content_html', e.target.value)} placeholder="Write HTML content here..." />
          </div>
          <div style={card}>
            <label style={label}>Excerpt</label>
            <textarea className="admin-textarea" rows={3} value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} placeholder="Short summary..." />
          </div>
        </div>
        <div className="space-y-4">
          <div style={card}><label style={label}>URL Slug</label><input className="admin-input" value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="auto-generated" /></div>
          <div style={card}><label style={label}>Category</label><select className="admin-input" value={form.category} onChange={(e) => set('category', e.target.value)} style={{ appearance: 'none' }}><option value="" style={{ background: '#111' }}>No category</option>{CATEGORIES.map((c) => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}</select></div>
          <div style={card}><label style={label}>Tags (comma separated)</label><input className="admin-input" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="book, fiction" /></div>
          <div style={card}><label style={label}>Cover Image URL</label><input className="admin-input" value={form.cover_image_url} onChange={(e) => set('cover_image_url', e.target.value)} placeholder="https://..." />{form.cover_image_url && <img src={form.cover_image_url} alt="" className="mt-2 w-full rounded-lg object-cover" style={{ height: 100 }} />}</div>
        </div>
      </div>
    </div>
  )
}
