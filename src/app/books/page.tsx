'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { BookOpen, Download, Edit2, Plus, Search, Star, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { calculateQualityScore } from '@/lib/revenue'
import { supabase } from '@/lib/supabase'
import { useAdminRole } from '@/lib/useAdminRole'
import { cn, formatDate, formatNumber } from '@/lib/utils'
import { recordWorkerAction, resolveWorkerIdentity } from '@/lib/workerActivity'
import type { PDF } from '@/types'

function BooksPageContent() {
  const { user } = useUser()
  const role = useAdminRole()
  const searchParams = useSearchParams()
  const querySearch = (searchParams.get('q') ?? '').trim()
  const [books, setBooks] = useState<PDF[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(querySearch)
  const [searchInput, setSearchInput] = useState(querySearch)
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

  const fetchBooks = useCallback(async () => {
    setLoading(true)

    let query = supabase.from('pdfs').select('*').order('created_at', { ascending: false })

    if (search) {
      query = query.ilike('title', `%${search}%`)
    }

    const { data, error } = await query
    if (error) {
      toast.error('Failed to load books')
      setBooks([])
    } else {
      setBooks((data ?? []) as PDF[])
    }

    setLoading(false)
  }, [search])

  useEffect(() => {
    void fetchBooks()
  }, [fetchBooks])

  useEffect(() => {
    setSearchInput(querySearch)
    setSearch(querySearch)
  }, [querySearch])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
    }, 280)

    return () => clearTimeout(timer)
  }, [searchInput])

  async function handleDelete(book: PDF) {
    if (!window.confirm('Delete this book permanently?')) {
      return
    }

    const { error } = await supabase.from('pdfs').delete().eq('id', book.id)

    if (error) {
      toast.error('Delete failed')
      return
    }

    if (worker) {
      void recordWorkerAction({
        worker,
        action: 'delete',
        resourceType: 'pdf',
        resourceId: String(book.id),
        resourceTitle: book.title,
        details: 'Deleted from books table',
      })
    }

    toast.success('Book deleted')
    void fetchBooks()
  }

  async function handleToggleFeatured(book: PDF) {
    const { error } = await supabase
      .from('pdfs')
      .update({ is_featured: !book.is_featured })
      .eq('id', book.id)

    if (error) {
      toast.error('Update failed')
      return
    }

    if (worker) {
      void recordWorkerAction({
        worker,
        action: 'edit',
        resourceType: 'pdf',
        resourceId: String(book.id),
        resourceTitle: book.title,
        details: `Set featured to ${!book.is_featured}`,
      })
    }

    void fetchBooks()
  }

  const columns: Column<PDF>[] = [
    {
      key: 'title',
      header: 'Book',
      sortable: true,
      render: (book) => (
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-9 flex-shrink-0 items-center justify-center border border-border-subtle bg-[#21262f]">
            {book.cover_image_url ? (
              <Image
                src={book.cover_image_url}
                alt={book.title}
                width={36}
                height={44}
                className="h-full w-full object-cover"
              />
            ) : (
              <BookOpen size={12} className="text-accent-purple" />
            )}
          </div>
          <div>
            <p className="max-w-[240px] truncate text-sm font-medium text-text-primary">
              {book.title}
            </p>
            <p className="text-xs text-text-muted">{book.author ?? '-'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (book) => (
        <span className="badge border-border-default bg-bg-elevated text-text-secondary">
          {book.category ?? '-'}
        </span>
      ),
    },
    {
      key: 'download_count',
      header: 'Downloads',
      sortable: true,
      render: (book) => (
        <div className="flex items-center gap-1.5 text-sm">
          <Download size={12} className="text-text-muted" />
          {formatNumber(book.download_count)}
        </div>
      ),
    },
    {
      key: 'quality',
      header: 'Quality',
      render: (book) => {
        const score = Math.round(calculateQualityScore(book) * 100)

        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 bg-bg-elevated">
              <div
                className={cn(
                  'h-full',
                  score >= 80
                    ? 'bg-accent-emerald'
                    : score >= 50
                      ? 'bg-accent-amber'
                      : 'bg-accent-red',
                )}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="w-8 text-xs text-text-muted">{score}%</span>
          </div>
        )
      },
    },
    {
      key: 'is_featured',
      header: 'Featured',
      render: (book) => (
        <button onClick={() => void handleToggleFeatured(book)} type="button">
          <Star
            size={15}
            className={
              book.is_featured ? 'fill-accent-amber text-accent-amber' : 'text-text-muted'
            }
          />
        </button>
      ),
    },
    {
      key: 'created_at',
      header: 'Added',
      sortable: true,
      render: (book) => (
        <span className="text-xs text-text-muted">{formatDate(book.created_at, 'relative')}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (book) => (
        <div className="flex items-center gap-1">
          <Link
            href={`/pdfs/${book.id}`}
            className="inline-flex h-8 w-8 items-center justify-center border border-border-subtle text-text-muted transition-colors hover:text-text-primary"
            aria-label="Edit"
          >
            <Edit2 size={13} />
          </Link>
          <button
            onClick={() => void handleDelete(book)}
            className="inline-flex h-8 w-8 items-center justify-center border border-border-subtle text-text-muted transition-colors hover:border-accent-red/50 hover:text-accent-red"
            type="button"
            aria-label="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      <Header title="Books" subtitle="Manage your PDF library" />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              className="admin-input pl-9"
              placeholder="Search books..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <Link href="/pdfs/new" className="btn-primary inline-flex items-center gap-2">
            <Plus size={14} />
            Upload PDF
          </Link>
        </div>

        <div className="glass-card overflow-hidden p-0">
          <DataTable
            data={books}
            columns={columns}
            loading={loading}
            emptyMessage="No books found"
          />
        </div>
      </div>
    </div>
  )
}

export default function BooksPage() {
  return <Suspense fallback={null}><BooksPageContent /></Suspense>
}
