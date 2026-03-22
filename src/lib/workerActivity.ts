import type { AdminRole } from '@/types'

interface WorkerIdentityInput {
  clerkId: string | null
  name: string | null
  email: string | null
  role: AdminRole | null
}

export interface WorkerIdentity {
  workerId: string
  workerName: string
  workerEmail: string
  workerRole: AdminRole | null
}

export function resolveWorkerIdentity(input: WorkerIdentityInput): WorkerIdentity {
  return {
    workerId: input.clerkId ?? 'unknown',
    workerName: input.name ?? 'Unknown',
    workerEmail: input.email ?? '',
    workerRole: input.role,
  }
}

// Stub — accepts any shape, does nothing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recordWorkerAction(_input: Record<string, any>): Promise<void> {
  // no-op
}
