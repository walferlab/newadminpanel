import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, ensureFirebaseClientAuth } from '@/lib/firebase'
import type { AdminRole, ChangeLog } from '@/types'

interface ResolveWorkerIdentityInput {
  clerkId?: string | null
  name?: string | null
  email?: string | null
  role?: AdminRole | null
}

export interface WorkerIdentity {
  id: string
  name: string
  email: string
  role: AdminRole
}

interface RecordWorkerActionInput {
  worker: WorkerIdentity
  action: ChangeLog['action']
  resourceType: ChangeLog['resource_type']
  resourceId: string
  resourceTitle: string
  details?: string
}

interface WorkerPresenceInput {
  worker: WorkerIdentity
  currentPage: string
  isOnline: boolean
  activeMsToday: number
  activeDate: string
  lastSeenIso?: string
  heartbeatMs?: number
}

export const PRESENCE_HEARTBEAT_RESOURCE_ID = '__presence__'
export const PRESENCE_HEARTBEAT_DETAILS = 'presence_heartbeat'
const HEARTBEAT_FALLBACK_THROTTLE_MS = 55_000

const fallbackHeartbeatByWorker = new Map<string, number>()

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function resolveWorkerIdentity({
  clerkId,
  name,
  email,
  role,
}: ResolveWorkerIdentityInput): WorkerIdentity | null {
  const normalizedEmail = normalizeEmail(email)
  const normalizedId = (clerkId ?? '').trim() || normalizedEmail

  if (!normalizedId) {
    return null
  }

  const normalizedName = (name ?? '').trim() || normalizedEmail || 'Unknown Worker'

  return {
    id: normalizedId,
    name: normalizedName,
    email: normalizedEmail,
    role: role ?? 'uploader',
  }
}

export async function recordWorkerAction({
  worker,
  action,
  resourceType,
  resourceId,
  resourceTitle,
  details,
}: RecordWorkerActionInput): Promise<boolean> {
  try {
    await ensureFirebaseClientAuth()
    await addDoc(collection(db, 'change_logs'), {
      worker_id: worker.id,
      worker_name: worker.name,
      worker_email: worker.email,
      worker_role: worker.role,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      resource_title: resourceTitle,
      details: details ?? '',
      timestamp: serverTimestamp(),
    })

    return true
  } catch {
    return false
  }
}

export function isPresenceHeartbeatLog(
  log:
    | Pick<ChangeLog, 'resource_type' | 'resource_id' | 'details'>
    | { resource_type?: unknown; resource_id?: unknown; details?: unknown },
): boolean {
  return (
    log.resource_type === 'user' &&
    log.resource_id === PRESENCE_HEARTBEAT_RESOURCE_ID &&
    log.details === PRESENCE_HEARTBEAT_DETAILS
  )
}

export async function upsertWorkerPresence({
  worker,
  currentPage,
  isOnline,
  activeMsToday,
  activeDate,
  lastSeenIso,
  heartbeatMs,
}: WorkerPresenceInput): Promise<boolean> {
  try {
    const nowMs = heartbeatMs ?? Date.now()
    await ensureFirebaseClientAuth()
    await setDoc(
      doc(db, 'worker_presence', worker.id),
      {
        worker_id: worker.id,
        worker_name: worker.name,
        worker_email: worker.email,
        worker_role: worker.role,
        current_page: currentPage,
        is_online: isOnline,
        active_ms_today: Math.max(0, Math.round(activeMsToday)),
        active_date: activeDate,
        last_seen: lastSeenIso ?? new Date(nowMs).toISOString(),
        last_seen_epoch_ms: nowMs,
        heartbeat_epoch_ms: nowMs,
        updated_at: serverTimestamp(),
      },
      { merge: true },
    )

    return true
  } catch {
    const nowMs = heartbeatMs ?? Date.now()
    const lastHeartbeat = fallbackHeartbeatByWorker.get(worker.id) ?? 0
    if (!isOnline || nowMs - lastHeartbeat < HEARTBEAT_FALLBACK_THROTTLE_MS) {
      return true
    }

    try {
      await ensureFirebaseClientAuth()
      await addDoc(collection(db, 'change_logs'), {
        worker_id: worker.id,
        worker_name: worker.name,
        worker_email: worker.email,
        worker_role: worker.role,
        action: 'edit',
        resource_type: 'user',
        resource_id: PRESENCE_HEARTBEAT_RESOURCE_ID,
        resource_title: 'Presence heartbeat',
        details: PRESENCE_HEARTBEAT_DETAILS,
        timestamp: serverTimestamp(),
      })
      fallbackHeartbeatByWorker.set(worker.id, nowMs)
      return true
    } catch {
      return false
    }
  }
}
