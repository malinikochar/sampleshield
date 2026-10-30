import Dexie, { type EntityTable } from 'dexie';
import type {
  CachedCourierAssignment,
  CustodyEventMetadata,
  OfflineQueuedEvent,
  SampleEventType,
} from '@/types/domain';

export class SampleShieldOfflineDB extends Dexie {
  queued_events!: EntityTable<OfflineQueuedEvent, 'client_event_id'>;
  cached_assignments!: EntityTable<CachedCourierAssignment, 'sample_id'>;

  constructor(name = 'SampleShieldOfflineDB') {
    super(name);
    this.version(1).stores({
      queued_events:
        'client_event_id, [organization_id+actor_user_id], sync_state, sample_public_code, created_at_ms',
      cached_assignments:
        'sample_id, [organization_id+courier_user_id], public_code',
    });
  }
}

let dbInstance: SampleShieldOfflineDB | null = null;

export function getOfflineDB(): SampleShieldOfflineDB {
  if (!dbInstance) {
    dbInstance = new SampleShieldOfflineDB();
  }
  return dbInstance;
}

export async function resetOfflineDBInstance(): Promise<void> {
  if (dbInstance) {
    await dbInstance.delete();
    dbInstance = null;
  }
}

export interface EnqueueCustodyEventParams {
  clientEventId?: string;
  organizationId: string;
  actorUserId: string;
  sampleId?: string;
  samplePublicCode: string;
  specimenType?: string;
  destinationLabel?: string;
  eventType: SampleEventType;
  clientOccurredAt?: string;
  metadata?: CustodyEventMetadata;
}

/**
 * Stores a custody handover intent locally in IndexedDB BEFORE attempting network sync.
 * Uses a stable UUID (`client_event_id`) so retries can never create duplicate server rows.
 */
export async function enqueueOfflineCustodyEvent(
  params: EnqueueCustodyEventParams
): Promise<OfflineQueuedEvent> {
  const db = getOfflineDB();
  const nowMs = Date.now();
  const clientEventId = params.clientEventId ?? crypto.randomUUID();

  const existing = await db.queued_events.get(clientEventId);
  if (existing) {
    return existing;
  }

  const record: OfflineQueuedEvent = {
    client_event_id: clientEventId,
    organization_id: params.organizationId,
    actor_user_id: params.actorUserId,
    sample_id: params.sampleId,
    sample_public_code: params.samplePublicCode.trim().toUpperCase(),
    specimen_type: params.specimenType,
    destination_label: params.destinationLabel,
    event_type: params.eventType,
    client_occurred_at: params.clientOccurredAt ?? new Date(nowMs).toISOString(),
    metadata: params.metadata ?? {},
    sync_state: 'queued',
    retry_count: 0,
    next_retry_at: null,
    last_error_code: null,
    last_error_message: null,
    server_event_id: null,
    server_recorded_at: null,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  };

  await db.queued_events.put(record);
  return record;
}

/**
 * Replaces cached courier assignments for an online authenticated courier with minimal non-PHI metadata.
 */
export async function cacheAuthorizedCourierAssignments(
  organizationId: string,
  courierUserId: string,
  assignments: CachedCourierAssignment[]
): Promise<void> {
  const db = getOfflineDB();
  await db.transaction('rw', db.cached_assignments, async () => {
    await db.cached_assignments
      .where('[organization_id+courier_user_id]')
      .equals([organizationId, courierUserId])
      .delete();

    if (assignments.length > 0) {
      await db.cached_assignments.bulkPut(assignments);
    }
  });
}

export async function getUnsyncedEventCount(
  organizationId: string,
  actorUserId: string
): Promise<number> {
  const db = getOfflineDB();
  const items = await db.queued_events
    .where('[organization_id+actor_user_id]')
    .equals([organizationId, actorUserId])
    .toArray();

  return items.filter(
    (e) =>
      e.sync_state === 'queued' ||
      e.sync_state === 'syncing' ||
      e.sync_state === 'failed_retriable'
  ).length;
}

export async function dismissConflictOrSyncedEvent(clientEventId: string): Promise<void> {
  const db = getOfflineDB();
  const item = await db.queued_events.get(clientEventId);
  if (!item) return;
  if (item.sync_state === 'synced' || item.sync_state === 'conflict') {
    await db.queued_events.delete(clientEventId);
  }
}

export async function clearOfflineSessionStorage(options: {
  organizationId?: string;
  actorUserId?: string;
  discardUnsynced?: boolean;
}): Promise<void> {
  const db = getOfflineDB();
  await db.transaction('rw', db.cached_assignments, db.queued_events, async () => {
    if (options.organizationId && options.actorUserId) {
      await db.cached_assignments
        .where('[organization_id+courier_user_id]')
        .equals([options.organizationId, options.actorUserId])
        .delete()
        .catch(async () => {
          await db.cached_assignments.clear();
        });

      const userEvents = await db.queued_events
        .where('[organization_id+actor_user_id]')
        .equals([options.organizationId, options.actorUserId])
        .toArray();

      for (const evt of userEvents) {
        if (options.discardUnsynced || evt.sync_state === 'synced') {
          await db.queued_events.delete(evt.client_event_id);
        }
      }
    } else {
      await db.cached_assignments.clear();
      if (options.discardUnsynced) {
        await db.queued_events.clear();
      }
    }
  });
}
