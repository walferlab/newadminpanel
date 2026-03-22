'use client'

import { useCallback, useEffect, useState } from 'react'
import { Edit2, Loader2, Plus, Save, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'
import { useAdminRole } from '@/lib/useAdminRole'

interface Ad {
  id: string
  title: string | null
  description: string | null
  image_url: string
  link_url: string
  position: string
  is_active: boolean
  display_order: number
  impressions: number
  clicks: number
  expires_at: string | null
  created_at: string
}

const POSITIONS = ['top', 'sidebar', 'inline', 'bottom', 'popup']

const EMPTY: Omit<Ad, 'id' | 'impressions' | 'clicks' | 'created_at'> = {
  title: '', description: '', image_url: '', link_url: '',
  position: 'top', is_active: true, display_order: 0, expires_at: null,
}

export default function AdsPage() {
  const role = useAdminRole()
  const canEdit = role === 'super_admin' || role === 'admin'

  const [ads, setAds]           = useState<Ad[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<'new' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Ad | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState<typeof EMPTY>({ ...EMPTY })

  const fetchAds = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('advertisements')
      .select('*')
      .order('display_order', { ascending: true })
    if (error) toast.error('Failed to load ads')
    else setAds((data ?? []) as Ad[])
    setLoading(false)
  }, [])

  useEffect(() => { void fetchAds() }, [fetchAds])

  function openNew() {
    setForm({ ...EMPTY })
    setSelected(null)
    setModal('new')
  }

  function openEdit(ad: Ad) {
    setSelected(ad)
    setForm({
      title: ad.title ?? '',
      description: ad.description ?? '',
      image_url: ad.image_url,
      link_url: ad.link_url,
      position: ad.position,
      is_active: ad.is_active,
      display_order: ad.display_order,
      expires_at: ad.expires_at,
    })
    setModal('edit')
  }

  function set(field: string, value: string | boolean | number | null) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.image_url.trim() || !form.link_url.trim()) return toast.error('Image URL and Link URL are required')
    setSaving(true)
    let error
    if (modal === 'new') {
      const res = await supabase.from('advertisements').insert({
        title: (form.title as string)?.trim() || null,
        description: (form.description as string)?.trim() || null,
        image_url: form.image_url,
        link_url: form.link_url,
        position: form.position,
        is_active: form.is_active,
        display_order: form.display_order,
        expires_at: form.expires_at,
      })
      error = res.error
    } else if (selected) {
      const res = await supabase.from('advertisements').update({
        title: (form.title as string)?.trim() || null,
        description: (form.description as string)?.trim() || null,
        image_url: form.image_url,
        link_url: form.link_url,
        position: form.position,
        is_active: form.is_active,
        display_order: form.display_order,
        expires_at: form.expires_at,
      }).eq('id', selected.id)
      error = res.error
    }
    setSaving(false)
    if (error) return toast.error('Failed to save: ' + error.message)
    toast.success(modal === 'new' ? 'Ad created!' : 'Ad updated!')
    setModal(null)
    void fetchAds()
  }

  async function toggleActive(id: string, current: boolean) {
    const { error } = await supabase.from('advertisements').update({ is_active: !current }).eq('id', id)
    if (error) return toast.error('Failed to update')
    setAds((prev) => prev.map((a) => a.id === id ? { ...a, is_active: !current } : a))
    toast.success(!current ? 'Ad activated' : 'Ad deactivated')
  }

  async function deleteAd(id: string) {
    if (!confirm('Delete this ad permanently?')) return
    const { error } = await supabase.from('advertisements').delete().eq('id', id)
    if (error) return toast.error('Failed to delete')
    setAds((prev) => prev.filter((a) => a.id !== id))
    toast.success('Ad deleted')
  }

  const card = { background: 'rgba(14,14,14,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }
  const inputStyle = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, color: '#fff', width: '100%', padding: '8px 12px', fontSize: 13, outline: 'none',
  }
  const labelStyle = { fontSize: 12, color: '#555', display: 'block', marginBottom: 6 }

  return (
    <div className="animate-fade-in">
      <Header
        title="Advertisements"
        subtitle={`${ads.length} ads · ${ads.filter((a) => a.is_active).length} active`}
        actions={canEdit ? (
          <button onClick={openNew} className="btn-primary"><Plus size={14} /> New Ad</button>
        ) : undefined}
      />
      <div className="p-4 md:p-5">
        <div style={card} className="overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><div className="spinner" /></div>
          ) : ads.length === 0 ? (
            <p className="py-12 text-center" style={{ color: '#444', fontSize: 14 }}>No ads yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Position</th>
                  <th>Order</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => (
                  <tr key={ad.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {ad.image_url && (
                          <img src={ad.image_url} alt="" className="h-9 w-14 rounded object-cover shrink-0"
                            style={{ border: '1px solid rgba(255,255,255,0.07)' }} />
                        )}
                        <div>
                          <p style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{ad.title ?? 'Untitled'}</p>
                          <p style={{ color: '#444', fontSize: 11 }} className="truncate max-w-[180px]">{ad.link_url}</p>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-blue capitalize">{ad.position}</span></td>
                    <td style={{ color: '#888' }}>{ad.display_order}</td>
                    <td style={{ color: '#888' }}>{ad.impressions.toLocaleString()}</td>
                    <td style={{ color: '#888' }}>{ad.clicks.toLocaleString()}</td>
                    <td>
                      <button onClick={() => toggleActive(ad.id, ad.is_active)}>
                        <span className={ad.is_active ? 'badge badge-green' : 'badge badge-gray'}>
                          {ad.is_active ? 'Active' : 'Paused'}
                        </span>
                      </button>
                    </td>
                    <td style={{ fontSize: 12, color: '#555' }}>
                      {ad.expires_at ? new Date(ad.expires_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td>
                      {canEdit && (
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEdit(ad)}><Edit2 size={13} style={{ color: '#555' }} className="hover:text-white transition-colors" /></button>
                          <button onClick={() => deleteAd(ad.id)}><Trash2 size={13} style={{ color: '#555' }} className="hover:text-red-400 transition-colors" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div style={{ ...card, padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{modal === 'new' ? 'New Ad' : 'Edit Ad'}</h2>
              <button onClick={() => setModal(null)} style={{ color: '#555' }}><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div><label style={labelStyle}>Title</label><input style={inputStyle} value={form.title as string} onChange={(e) => set('title', e.target.value)} placeholder="Ad title" /></div>
              <div><label style={labelStyle}>Image URL *</label><input style={inputStyle} value={form.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://..." />
                {form.image_url && <img src={form.image_url} alt="" className="mt-2 h-20 w-full rounded-lg object-cover" />}
              </div>
              <div><label style={labelStyle}>Link URL *</label><input style={inputStyle} value={form.link_url} onChange={(e) => set('link_url', e.target.value)} placeholder="https://..." /></div>
              <div><label style={labelStyle}>Description</label><textarea style={{ ...inputStyle, resize: 'none', padding: '8px 12px' } as React.CSSProperties} rows={2} value={form.description as string} onChange={(e) => set('description', e.target.value)} placeholder="Optional description" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label style={labelStyle}>Position</label>
                  <select style={{ ...inputStyle, appearance: 'none' } as React.CSSProperties} value={form.position} onChange={(e) => set('position', e.target.value)}>
                    {POSITIONS.map((p) => <option key={p} value={p} style={{ background: '#111' }} className="capitalize">{p}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Display Order</label><input type="number" style={inputStyle} value={form.display_order} onChange={(e) => set('display_order', parseInt(e.target.value) || 0)} /></div>
              </div>
              <div><label style={labelStyle}>Expires At (optional)</label><input type="date" style={inputStyle} value={form.expires_at ?? ''} onChange={(e) => set('expires_at', e.target.value || null)} /></div>
              <div className="flex items-center gap-3">
                <button onClick={() => set('is_active', !form.is_active)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: form.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                    border: form.is_active ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.07)',
                    color: form.is_active ? '#4ade80' : '#555',
                  }}>
                  {form.is_active ? '● Active' : '○ Paused'}
                </button>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
