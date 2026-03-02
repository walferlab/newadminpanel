'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useUser } from '@clerk/nextjs'
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { AtSign, ChevronLeft, Hash, Reply, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { db, ensureFirebaseClientAuth, getFirebaseErrorMessage } from '@/lib/firebase'
import { useAdminRole } from '@/lib/useAdminRole'
import { cn, formatDate, getRoleBadgeColor, getRoleLabel } from '@/lib/utils'
import { isAdminRole, type AdminRole, type ChatMessage } from '@/types'

const CHANNELS = ['general', 'uploads', 'review', 'alerts']

const DEMO_USER = {
  id: 'demo-user',
  name: 'Guest',
  role: 'uploader' as AdminRole,
}

function getPreview(content: string, maxLength = 72): string {
  const trimmed = content.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength)}...`
}

export default function ChatPage() {
  const { user } = useUser()
  const role = useAdminRole()
  const [channel, setChannel] = useState(CHANNELS[0])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [senderRoles, setSenderRoles] = useState<Record<string, AdminRole>>({})
  const [input, setInput] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [firebaseError, setFirebaseError] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'channels' | 'chat'>('channels')
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const messageListRef = useRef<HTMLDivElement>(null)
  const composerInputRef = useRef<HTMLInputElement>(null)

  const messagesById = useMemo(
    () => new Map(messages.map((message) => [message.id, message] as const)),
    [messages],
  )

  const repliedTargetIds = useMemo(() => {
    const ids = new Set<string>()

    for (const message of messages) {
      if (!message.parent_id) {
        continue
      }

      const parent = messagesById.get(message.parent_id)
      if (parent && parent.sender_id !== message.sender_id) {
        ids.add(parent.id)
      }
    }

    return ids
  }, [messages, messagesById])

  function scrollToBottom(behavior: ScrollBehavior = 'auto') {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
  }

  function focusComposer() {
    requestAnimationFrame(() => {
      composerInputRef.current?.focus()
    })
  }

  function focusMessage(messageId: string) {
    const target = document.getElementById(`chat-message-${messageId}`)
    if (!target) {
      return
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedMessageId(messageId)

    window.setTimeout(() => {
      setHighlightedMessageId((current) => (current === messageId ? null : current))
    }, 1800)
  }

function selectChannel(nextChannel: string) {
    setChannel(nextChannel)
    setMobileView('chat')
    focusComposer()
  }

  useEffect(() => {
    setLoading(true)
    setFirebaseError(null)
    setReplyTo(null)

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
        orderBy('timestamp', 'desc'),
        limit(300),
      )

      unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          if (!active) {
            return
          }

          const rows = snapshot.docs.map((doc) => {
            const data = doc.data() as Omit<ChatMessage, 'id'>
            return {
              id: doc.id,
              ...data,
            }
          }).reverse()

          setMessages(rows)
          setLoading(false)

          requestAnimationFrame(() => {
            scrollToBottom('auto')
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

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}

    async function setupPresenceRoleListener() {
      try {
        await ensureFirebaseClientAuth()
      } catch {
        if (!active) {
          return
        }
        setSenderRoles({})
        return
      }

      const presenceQuery = query(collection(db, 'worker_presence'), limit(500))

      unsubscribe = onSnapshot(
        presenceQuery,
        (snapshot) => {
          if (!active) {
            return
          }

          const nextRoles: Record<string, AdminRole> = {}
          for (const doc of snapshot.docs) {
            const data = doc.data() as { worker_id?: unknown; worker_role?: unknown }
            if (!isAdminRole(data.worker_role)) {
              continue
            }

            const workerId = typeof data.worker_id === 'string' ? data.worker_id.trim() : ''
            if (!workerId) {
              continue
            }

            nextRoles[workerId] = data.worker_role
          }

          setSenderRoles(nextRoles)
        },
        () => {
          if (!active) {
            return
          }
          setSenderRoles({})
        },
      )
    }

    void setupPresenceRoleListener()

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

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
    const metadataRole = isAdminRole(user?.publicMetadata?.role) ? user.publicMetadata.role : null
    const senderRole = role ?? metadataRole ?? DEMO_USER.role
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
      focusComposer()
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error))
    }
  }

  function renderChannelList() {
    return (
      <div className="h-full overflow-y-auto px-3 py-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-text-muted">Channels</p>
        <div className="space-y-1">
          {CHANNELS.map((item) => (
            <button
              key={item}
              onClick={() => selectChannel(item)}
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
      </div>
    )
  }

  function renderMessagePane() {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div ref={messageListRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-text-muted">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">No messages in this channel yet.</p>
          ) : (
            messages.map((message, index) => {
              const showHeader = index === 0 || messages[index - 1].sender_id !== message.sender_id
              const parentMessage = message.parent_id ? messagesById.get(message.parent_id) : null
              const isHighlighted =
                highlightedMessageId === message.id || replyTo?.id === message.id
              const gotReplyFromOtherUser = repliedTargetIds.has(message.id)
              const messageRole =
                senderRoles[message.sender_id] ??
                (isAdminRole(message.sender_role) ? message.sender_role : 'uploader')

              return (
                <div
                  key={message.id}
                  id={`chat-message-${message.id}`}
                  className={cn(
                    'group rounded-sm py-1 transition-colors',
                    showHeader ? 'mt-2' : '',
                    isHighlighted && 'bg-accent-blue/10',
                    gotReplyFromOtherUser && 'border-l-2 border-accent-amber/40 pl-1',
                  )}
                >
                  {showHeader ? (
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-medium text-text-primary">
                        {message.sender_name}
                      </span>
                      <span className={cn('badge text-[9px]', getRoleBadgeColor(messageRole))}>
                        {getRoleLabel(messageRole)}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {formatDate(message.timestamp, 'relative')}
                      </span>
                    </div>
                  ) : null}

                  {message.parent_id ? (
                    parentMessage ? (
                      <button
                        type="button"
                        onClick={() => focusMessage(parentMessage.id)}
                        className="mb-1 flex w-full max-w-[88%] items-center gap-2 border-l border-border-default pl-2 text-left text-xs text-text-muted transition-colors hover:text-text-secondary"
                      >
                        <Reply size={10} />
                        <span className="truncate">
                          Replying to {parentMessage.sender_name}:{' '}
                          {getPreview(parentMessage.content, 56)}
                        </span>
                      </button>
                    ) : (
                      <div className="mb-1 flex w-full max-w-[88%] items-center gap-2 border-l border-border-default pl-2 text-xs text-text-muted">
                        <Reply size={10} />
                        Replying to a message
                      </div>
                    )
                  ) : null}

                  <div className="flex items-start gap-2">
                    <p className="max-w-[88%] border-l border-border-default px-2 py-1 text-sm leading-relaxed text-text-primary">
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
                      onClick={() => {
                        setReplyTo(message)
                        focusComposer()
                      }}
                      className="text-text-muted transition-colors hover:text-text-secondary md:opacity-0 md:transition-opacity md:group-hover:opacity-100"
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

        <div className="flex-shrink-0 border-t border-border-subtle p-3">
          {replyTo ? (
            <div className="mb-2 border border-border-subtle bg-bg-elevated/40 px-3 py-2 text-xs text-text-muted">
              <div className="flex items-center gap-2">
                <Reply size={11} />
                <span>
                  Replying to <strong>{replyTo.sender_name}</strong>
                </span>
                <button
                  onClick={() => {
                    setReplyTo(null)
                    focusComposer()
                  }}
                  className="ml-auto text-text-muted hover:text-text-primary"
                  type="button"
                >
                  Close
                </button>
              </div>
              <p className="mt-1 truncate text-text-secondary">{getPreview(replyTo.content, 110)}</p>
            </div>
          ) : null}

          <form onSubmit={sendMessage} className="flex items-center gap-2">
            <div className="relative flex-1">
              <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                ref={composerInputRef}
                className="admin-input h-10 pl-9"
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
    )
  }

  return (
    <div className="animate-fade-in flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      {firebaseError ? (
        <div className="m-3 flex-shrink-0 border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          {firebaseError}
        </div>
      ) : null}

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden border-y border-border-subtle bg-bg-secondary/20 md:border">
        <div className="hidden h-full min-h-0 md:grid md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="min-h-0 border-r border-border-subtle">
            {renderChannelList()}
          </aside>
          {renderMessagePane()}
        </div>

        <div className="h-full min-h-0 md:hidden">
          {mobileView === 'channels' ? (
            renderChannelList()
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
                <button
                  type="button"
                  onClick={() => setMobileView('channels')}
                  className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
                >
                  <ChevronLeft size={14} />
                  Channels
                </button>
                <p className="ml-auto truncate text-sm font-medium text-text-primary">#{channel}</p>
              </div>
              {renderMessagePane()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
