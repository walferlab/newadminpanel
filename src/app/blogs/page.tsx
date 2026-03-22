'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Edit2, Eye, EyeOff, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'
import { useAdminRole } from '@/lib/useAdminRole'
import { ROLE_PERMISSIONS } from '@/types'

interface Blog {
  id: number
  title: string
  slug: string
  category: string | null
  is_published: boolean
  published_at: string | null
  created_at: string
}

export default function BlogsPage() {
  const role = useAdminRole()
  const canEdit = role ? ROLE_PERMISSIONS[role].canManagePosts : false
  const canDelete = role ? ROLE_PERMISSIONS[role].canDeleteBooks : false

  const [blogs, setBlogs]       = useState<Blog[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<'all' | 'published' | 'draft'>('all')

  const fetchBlogs = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('blogs')
      .select('id, title, slug, category, is_published, published_at, created_at')
      .order('created_at', { ascending: false })

    if (search) query = query.ilike('title', `%${search}%`)
    if (filter === 'published') query = query.eq('is_published', true)
    if (filter === 'draft') query = query.eq('is_published', false)

    const { data, error } = await query
    if (error) toast.error('Failed to load blogs')
    else setBlogs((data ?? []) as Blog[])
    setLoading(false)
  }, [search, filter])

  useEffect(() => { void fetchBlogs() }, [fetchBlogs])

  async function togglePublish(id: number, current: boolean) {
    const { error } = await supabase
      .from('blogs')
      .update({ is_published: !current, published_at: !current ? new Date().toISOString() : null })
      .eq('id', id)
    if (error) return toast.error('Failed to update')
    setBlogs((prev) => prev.map((b) => b.id === id ? { ...b, is_published: !current } : b))
    toast.success(!current ? 'Published!' : 'Unpublished')
  }

  async function deleteBlog(id: number, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    const { error } = await supabase.from('blogs').delete().eq('id', id)
    if (error) return toast.error('Failed to delete')
    setBlogs((prev) => prev.filter((b) => b.id !== id))
    toast.success('Blog deleted')
  }

  const card = { background: 'rgba(14,14,14,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }

  return (
    <div className="animate-fade-in">
      <Header
        title="Blogs"
        subtitle={`${blogs.length} posts`}
        actions={
          canEdit ? (
            <Link href="/blogs/new" className="btn-primary">
              <Plus size={14} /> New Blog
            </Link>
          ) : undefined
        }
      />
      <div className="space-y-4 p-4 md:p-5">

        {/* Filters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#444' }} />
            <input
              className="admin-input pl-9"
              placeholder="Search blogs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 3 }}>
            {(['all', 'published', 'draft'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 text-xs font-medium capitalize rounded-lg transition-all"
                style={{
                  background: filter === f ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: filter === f ? '#fff' : '#555',
                  border: filter === f ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={card} className="overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><div className="spinner" /></div>
          ) : blogs.length === 0 ? (
            <p className="py-12 text-center" style={{ color: '#444', fontSize: 14 }}>No blogs found.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {blogs.map((b) => (
                  <tr key={b.id}>
                    <td style={{ color: '#fff', fontWeight: 500, maxWidth: 300 }}>
                      <span className="line-clamp-1">{b.title}</span>
                      <span style={{ fontSize: 11, color: '#444' }}>/{b.slug}</span>
                    </td>
                    <td>
                      {b.category ? (
                        <span className="badge badge-blue">{b.category}</span>
                      ) : (
                        <span style={{ color: '#444' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={b.is_published ? 'badge badge-green' : 'badge badge-gray'}>
                        {b.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        {canEdit && (
                          <>
                            <Link href={`/blogs/${b.id}`} title="Edit">
                              <Edit2 size={13} style={{ color: '#555' }} className="hover:text-white transition-colors" />
                            </Link>
                            <button onClick={() => togglePublish(b.id, b.is_published)} title={b.is_published ? 'Unpublish' : 'Publish'}>
                              {b.is_published
                                ? <EyeOff size={13} style={{ color: '#555' }} className="hover:text-amber-400 transition-colors" />
                                : <Eye size={13} style={{ color: '#555' }} className="hover:text-green-400 transition-colors" />
                              }
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button onClick={() => deleteBlog(b.id, b.title)} title="Delete">
                            <Trash2 size={13} style={{ color: '#555' }} className="hover:text-red-400 transition-colors" />
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
