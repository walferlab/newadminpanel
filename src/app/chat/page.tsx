'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useUser } from '@clerk/nextjs'
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { AtSign, Hash, Reply, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { db, ensureFirebaseClientAuth, getFirebaseErrorMessage } from '@/lib/firebase'
import { cn, formatDate, getRoleBadgeColor, getRoleLabel } from '@/lib/utils'
import type { AdminRole, ChatMessage } from '@/types'

const CHANNELS = ['general', 'uploads', 'review', 'alerts']

const DEMO_USER = {
  id: 'demo-user',
  name: 'Admin',
  role: 'admin' as AdminRole,
}

export default function ChatPage() {
  const { user } = useUser()
  const [channel, setChannel] = useState('general')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [firebaseError, setFirebaseError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messageListRef = useRef<HTMLDivElement>(null)
  const hasInitialScrollRef = useRef(false)

  function isNearBottom() {
    const el = messageListRef.current
    if (!el) {
      return true
    }
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  function scrollToBottom(behavior: ScrollBehavior = 'auto') {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
  }

  useEffect(() => {
    setLoading(true)
    setFirebaseError(null)
    hasInitialScrollRef.current = false

    let active = true
    let unsubscribe = () => {}

    async function setupChannelListener() {
      try {
        await ensureFirebaseClientAuth()
      } catch (error) {
        if (!active) {
          return
        }

        const message = getFirebaseErrorMessage(error)
        setFirebaseError(message)
        setMessages([
          {
            id: 'auth-error-message',
            channel,
            sender_id: 'system',
            sender_name: 'System',
            sender_role: 'admin',
            content: message,
            mentions: [],
            parent_id: null,
            read_by: [],
            timestamp: new Date().toISOString(),
          },
        ])
        setLoading(false)
        toast.error(message)
        return
      }

      const messagesQuery = query(
        collection(db, 'chat', channel, 'messages'),
        orderBy('timestamp', 'asc'),
      )

      unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          if (!active) {
            return
          }

          const shouldStickToBottom = !hasInitialScrollRef.current || isNearBottom()
          const rows = snapshot.docs.map((doc) => {
            const data = doc.data() as Omit<ChatMessage, 'id'>
            return {
              id: doc.id,
              ...data,
            }
          })

          setMessages(rows)
          setLoading(false)

          requestAnimationFrame(() => {
            if (shouldStickToBottom) {
              scrollToBottom(hasInitialScrollRef.current ? 'smooth' : 'auto')
            }
            hasInitialScrollRef.current = true
          })
        },
        (error) => {
          if (!active) {
            return
          }

          const message = getFirebaseErrorMessage(error)
          setFirebaseError(message)
          setMessages([
            {
              id: 'offline-message',
              channel,
              sender_id: 'system',
              sender_name: 'System',
              sender_role: 'admin',
              content: message,
              mentions: [],
              parent_id: null,
              read_by: [],
              timestamp: new Date().toISOString(),
            },
          ])
          setLoading(false)
          toast.error(message)
        },
      )
    }

    void setupChannelListener()

    return () => {
      active = false
      unsubscribe()
    }
  }, [channel])

  async function sendMessage(event: FormEvent) {
    event.preventDefault()

    if (!input.trim()) {
      return
    }

    const senderId = user?.id ?? DEMO_USER.id
    const senderName =
      user?.fullName ??
      user?.firstName ??
      user?.primaryEmailAddress?.emailAddress ??
      DEMO_USER.name
    const senderRole = (user?.publicMetadata?.role as AdminRole | undefined) ?? DEMO_USER.role
    const mentions = Array.from(input.matchAll(/@(\w+)/g)).map((match) => match[1])

    try {
      await ensureFirebaseClientAuth()
      await addDoc(collection(db, 'chat', channel, 'messages'), {
        channel,
        sender_id: senderId,
        sender_name: senderName,
        sender_role: senderRole,
        content: input.trim(),
        mentions,
        parent_id: replyTo?.id ?? null,
        read_by: [senderId],
        timestamp: serverTimestamp(),
      })

      setInput('')
      setReplyTo(null)
      requestAnimationFrame(() => {
        scrollToBottom('smooth')
      })
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error))
    }
  }

  return (
    <div className="animate-fade-in flex h-full min-h-0 flex-col overflow-hidden">
      <Header title="Chat" subtitle="Real-time team communication" />

      {firebaseError ? (
        <div className="mb-3 border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          {firebaseError}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[220px_1fr]">
        <aside className="border-b border-border-subtle pb-3 md:border-b-0 md:border-r md:pr-3">
          <p className="mb-2 text-xs uppercase tracking-wider text-text-muted">Channels</p>
          <div className="space-y-1">
            {CHANNELS.map((item) => (
              <button
                key={item}
                onClick={() => setChannel(item)}
                className={cn(
                  'flex w-full items-center gap-2 border-l-2 px-2 py-1.5 text-left text-sm transition-colors',
                  channel === item
                    ? 'border-accent-purple text-text-primary'
                    : 'border-transparent text-text-muted hover:border-border-default hover:text-text-secondary',
                )}
                type="button"
              >
                <Hash size={13} />
                {item}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:pl-4">
          <div ref={messageListRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto py-2 pr-1">
            {loading ? (
              <p className="py-8 text-center text-sm text-text-muted">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-muted">No messages in this channel yet.</p>
            ) : (
              messages.map((message, index) => {
                const showHeader = index === 0 || messages[index - 1].sender_id !== message.sender_id

                return (
                  <div key={message.id} className={cn('group py-1', showHeader ? 'mt-2' : '')}>
                    {showHeader ? (
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-medium text-text-primary">{message.sender_name}</span>
                        <span className={cn('badge text-[9px]', getRoleBadgeColor(message.sender_role))}>
                          {getRoleLabel(message.sender_role)}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {formatDate(message.timestamp, 'relative')}
                        </span>
                      </div>
                    ) : null}

                    {message.parent_id ? (
                      <div className="mb-1 flex items-center gap-2 border-l border-border-default pl-2 text-xs text-text-muted">
                        <Reply size={10} />
                        Replying to a message
                      </div>
                    ) : null}

                    <div className="flex items-start gap-2">
                      <p className="max-w-[85%] border-l border-border-default px-2 py-1 text-sm leading-relaxed text-text-primary">
                        {message.content.split(/(@\w+)/).map((part, idx) =>
                          part.startsWith('@') ? (
                            <span key={`${message.id}-part-${idx}`} className="font-medium text-accent-purple">
                              {part}
                            </span>
                          ) : (
                            <span key={`${message.id}-part-${idx}`}>{part}</span>
                          ),
                        )}
                      </p>
                      <button
                        onClick={() => setReplyTo(message)}
                        className="text-text-muted opacity-0 transition-opacity hover:text-text-secondary group-hover:opacity-100"
                        type="button"
                        aria-label="Reply"
                      >
                        <Reply size={12} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}

            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border-subtle pt-3">
            {replyTo ? (
              <div className="mb-2 flex items-center gap-2 border border-border-subtle px-3 py-1.5 text-xs text-text-muted">
                <Reply size={11} />
                <span>
                  Replying to <strong>{replyTo.sender_name}</strong>
                </span>
                <button
                  onClick={() => setReplyTo(null)}
                  className="ml-auto text-text-muted hover:text-text-primary"
                  type="button"
                >
                  Close
                </button>
              </div>
            ) : null}

            <form onSubmit={sendMessage} className="flex gap-2">
              <div className="relative flex-1">
                <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  className="admin-input pl-9"
                  placeholder={`Message #${channel}...`}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                />
              </div>
              <button type="submit" disabled={!input.trim()} className="btn-primary flex items-center gap-2 px-4">
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
