import { getOfflineDB } from '@/lib/offline/db';
import type { ApiErrorCode } from '@/types/domain';

export interface SyncBatchSummary {
  attempted: number;
  synced: number;
  conflicts: number;
  retriableFailures: number;
  authPaused: boolean;
}

const PERMANENT_CONFLICT_CODES: readonly ApiErrorCode[] = [
  'CONFLICT',
  'INVALID_STATE',
  'DESTINATION_MISMATCH',
  'FORBIDDEN',
  'BAD_REQUEST',
  'NOT_FOUND',
];

let activeSyncPromise: Promise<SyncBatchSummary> | null = null;

export function calculateBackoffMs(retryCount: number): number {
  const base = 1500 * Math.pow(2, Math.min(retryCount, 5));
  return Math.min(60_000, base);
}

/**
 * Synchronizes queued offline custody events in FIFO order with stable `client_event_id`.
 * Never marks an item `synced` until the server returns a confirmed event ID & server receipt timestamp.
 */
export async function syncPendingOfflineEvents(options: {
  organizationId: string;
  actorUserId: string;
  forceManualRetry?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<SyncBatchSummary> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = runSyncInternal(options).finally(() => {
    activeSyncPromise = null;
  });

  return activeSyncPromise;
}

async function runSyncInternal(options: {
  organizationId: string;
  actorUserId: string;
  forceManualRetry?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<SyncBatchSummary> {
  const summary: SyncBatchSummary = {
    attempted: 0,
    synced: 0,
    conflicts: 0,
    retriableFailures: 0,
    authPaused: false,
  };

  if (typeof navigator !== 'undefined' && navigator.onLine === false && !options.forceManualRetry) {
    return summary;
  }

  const db = getOfflineDB();
  const fetcher = options.fetchImpl ?? fetch;
  const now = Date.now();

  const allUserItems = await db.queued_events
    .where('[organization_id+actor_user_id]')
    .equals([options.organizationId, options.actorUserId])
    .sortBy('created_at_ms');

  const eligible = allUserItems.filter((item) => {
    if (item.sync_state === 'queued' || item.sync_state === 'syncing') {
      return true;
    }
    if (item.sync_state === 'failed_retriable') {
      if (options.forceManualRetry) return true;
      return item.next_retry_at === null || item.next_retry_at <= now;
    }
    return false;
  });

  for (const item of eligible) {
    summary.attempted += 1;

    await db.queued_events.update(item.client_event_id, {
      sync_state: 'syncing',
      updated_at_ms: Date.now(),
    });

    try {
      const response = await fetcher('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_event_id: item.client_event_id,
          sample_public_code: item.sample_public_code,
          event_type: item.event_type,
          client_occurred_at: item.client_occurred_at,
          was_queued_offline: true,
          metadata: item.metadata,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error_code?: ApiErrorCode;
        message?: string;
        data?: {
          event?: {
            id?: string;
            server_recorded_at?: string;
          };
        };
      } | null;

      if (response.status === 401 || payload?.error_code === 'UNAUTHORIZED') {
        await db.queued_events.update(item.client_event_id, {
          sync_state: 'failed_retriable',
          last_error_code: 'UNAUTHORIZED',
          last_error_message:
            'Session expired while offline. Sign in again to confirm pending handovers.',
          next_retry_at: null,
          updated_at_ms: Date.now(),
        });
        summary.authPaused = true;
        break;
      }

      if (response.ok && payload?.ok && payload.data?.event?.id) {
        await db.queued_events.update(item.client_event_id, {
          sync_state: 'synced',
          server_event_id: payload.data.event.id,
          server_recorded_at: payload.data.event.server_recorded_at ?? new Date().toISOString(),
          last_error_code: null,
          last_error_message: null,
          next_retry_at: null,
          updated_at_ms: Date.now(),
        });
        summary.synced += 1;
        continue;
      }

      const errorCode: ApiErrorCode = payload?.error_code ?? 'SERVER_ERROR';
      const errorMessage =
        payload?.message ?? `Server rejected submission (HTTP ${response.status}).`;

      if (PERMANENT_CONFLICT_CODES.includes(errorCode)) {
        await db.queued_events.update(item.client_event_id, {
          sync_state: 'conflict',
          last_error_code: errorCode,
          last_error_message: errorMessage,
          next_retry_at: null,
          updated_at_ms: Date.now(),
        });
        summary.conflicts += 1;
      } else {
        const nextRetryCount = item.retry_count + 1;
        await db.queued_events.update(item.client_event_id, {
          sync_state: 'failed_retriable',
          retry_count: nextRetryCount,
          next_retry_at: Date.now() + calculateBackoffMs(nextRetryCount),
          last_error_code: errorCode,
          last_error_message: errorMessage,
          updated_at_ms: Date.now(),
        });
        summary.retriableFailures += 1;
      }
    } catch {
      const nextRetryCount = item.retry_count + 1;
      await db.queued_events.update(item.client_event_id, {
        sync_state: 'failed_retriable',
        retry_count: nextRetryCount,
        next_retry_at: Date.now() + calculateBackoffMs(nextRetryCount),
        last_error_code: 'OFFLINE_PENDING',
        last_error_message:
          'Network unreachable. Saved on this device and queued for retry on reconnect.',
        updated_at_ms: Date.now(),
      });
      summary.retriableFailures += 1;
    }
  }

  return summary;
}
