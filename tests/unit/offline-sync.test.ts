import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cacheAuthorizedCourierAssignments,
  enqueueOfflineCustodyEvent,
  getOfflineDB,
  getUnsyncedEventCount,
  resetOfflineDBInstance,
} from '@/lib/offline/db';
import { syncPendingOfflineEvents } from '@/lib/offline/sync-manager';

const ORG_ID = '11111111-1111-4111-8111-111111111000';
const COURIER_ID = '11111111-1111-4111-8111-111111111301';

describe('Offline IndexedDB Queue & Idempotent Sync Manager', () => {
  beforeEach(async () => {
    await resetOfflineDBInstance();
  });

  it('enqueues events with stable client_event_id and deduplicates local double-taps', async () => {
    const fixedUuid = '33333333-3333-4333-8333-333333333301';

    const first = await enqueueOfflineCustodyEvent({
      clientEventId: fixedUuid,
      organizationId: ORG_ID,
      actorUserId: COURIER_ID,
      samplePublicCode: ' ss-7k3m-9p2x-q4wn ',
      eventType: 'courier_pickup',
      metadata: { handover_note: 'Cold pack verified' },
    });

    const duplicate = await enqueueOfflineCustodyEvent({
      clientEventId: fixedUuid,
      organizationId: ORG_ID,
      actorUserId: COURIER_ID,
      samplePublicCode: 'SS-7K3M-9P2X-Q4WN',
      eventType: 'courier_pickup',
    });

    expect(first.client_event_id).toBe(fixedUuid);
    expect(duplicate.client_event_id).toBe(fixedUuid);
    expect(first.sample_public_code).toBe('SS-7K3M-9P2X-Q4WN');
    expect(first.sync_state).toBe('queued');
    expect(await getUnsyncedEventCount(ORG_ID, COURIER_ID)).toBe(1);
  });

  it('syncs queued events in FIFO order and preserves exact client_event_id across retries', async () => {
    const evt1 = await enqueueOfflineCustodyEvent({
      clientEventId: '33333333-3333-4333-8333-333333333311',
      organizationId: ORG_ID,
      actorUserId: COURIER_ID,
      samplePublicCode: 'SS-7K3M-9P2X-Q4WN',
      eventType: 'courier_pickup',
    });

    // Ensure distinct created_at_ms for deterministic FIFO check
    await getOfflineDB().queued_events.update(evt1.client_event_id, {
      created_at_ms: 1000,
    });

    const evt2 = await enqueueOfflineCustodyEvent({
      clientEventId: '33333333-3333-4333-8333-333333333312',
      organizationId: ORG_ID,
      actorUserId: COURIER_ID,
      samplePublicCode: 'SS-7K3M-9P2X-Q4WN',
      eventType: 'courier_dropoff',
    });
    await getOfflineDB().queued_events.update(evt2.client_event_id, {
      created_at_ms: 2000,
    });

    // Simulate transient network failure on first sync attempt
    const failingFetch = vi.fn().mockRejectedValue(new Error('Network offline'));
    const failedRun = await syncPendingOfflineEvents({
      organizationId: ORG_ID,
      actorUserId: COURIER_ID,
      forceManualRetry: true,
      fetchImpl: failingFetch as unknown as typeof fetch,
    });

    expect(failedRun.retriableFailures).toBe(2);
    expect(failedRun.synced).toBe(0);
    expect(await getUnsyncedEventCount(ORG_ID, COURIER_ID)).toBe(2);

    // Reconnect and manual retry: verify same UUIDs sent in FIFO order
    const submittedUuids: string[] = [];
    const succeedingFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { client_event_id: string };
      submittedUuids.push(body.client_event_id);
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            event: {
              id: `srv-${body.client_event_id}`,
              server_recorded_at: '2026-10-30T11:00:00.000Z',
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const successRun = await syncPendingOfflineEvents({
      organizationId: ORG_ID,
      actorUserId: COURIER_ID,
      forceManualRetry: true,
      fetchImpl: succeedingFetch as unknown as typeof fetch,
    });

    expect(submittedUuids).toEqual([evt1.client_event_id, evt2.client_event_id]);
    expect(successRun.synced).toBe(2);
    expect(await getUnsyncedEventCount(ORG_ID, COURIER_ID)).toBe(0);

    const updated1 = await getOfflineDB().queued_events.get(evt1.client_event_id);
    expect(updated1?.sync_state).toBe('synced');
    expect(updated1?.server_event_id).toBe(`srv-${evt1.client_event_id}`);
  });

  it('pauses queue without losing events on 401 UNAUTHORIZED and marks server rejections as conflict', async () => {
    const evtAuth = await enqueueOfflineCustodyEvent({
      clientEventId: '33333333-3333-4333-8333-333333333321',
      organizationId: ORG_ID,
      actorUserId: COURIER_ID,
      samplePublicCode: 'SS-7K3M-9P2X-Q4WN',
      eventType: 'courier_pickup',
    });

    const unauthorizedFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error_code: 'UNAUTHORIZED' }), { status: 401 })
    );

    const paused = await syncPendingOfflineEvents({
      organizationId: ORG_ID,
      actorUserId: COURIER_ID,
      forceManualRetry: true,
      fetchImpl: unauthorizedFetch as unknown as typeof fetch,
    });

    expect(paused.authPaused).toBe(true);
    const after401 = await getOfflineDB().queued_events.get(evtAuth.client_event_id);
    expect(after401?.sync_state).toBe('failed_retriable');
    expect(after401?.last_error_code).toBe('UNAUTHORIZED');

    // Now simulate server CONFLICT (e.g. lab already received sample)
    const conflictFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error_code: 'CONFLICT',
          message: 'Sample already received at destination lab.',
        }),
        { status: 409 }
      )
    );

    const conflicted = await syncPendingOfflineEvents({
      organizationId: ORG_ID,
      actorUserId: COURIER_ID,
      forceManualRetry: true,
      fetchImpl: conflictFetch as unknown as typeof fetch,
    });

    expect(conflicted.conflicts).toBe(1);
    const afterConflict = await getOfflineDB().queued_events.get(evtAuth.client_event_id);
    expect(afterConflict?.sync_state).toBe('conflict');
  });

  it('stores minimal non-PHI cached courier assignments scoped to organization and courier', async () => {
    await cacheAuthorizedCourierAssignments(ORG_ID, COURIER_ID, [
      {
        sample_id: 'sample-1',
        organization_id: ORG_ID,
        courier_user_id: COURIER_ID,
        public_code: 'SS-7K3M-9P2X-Q4WN',
        specimen_type: 'Whole Blood (EDTA Tube)',
        source_facility_name: 'Kishangarh PHC',
        source_facility_code: 'PHC-KISH',
        destination_facility_id: 'lab-1',
        destination_facility_name: 'Ajmer District Lab',
        destination_facility_code: 'LAB-AJMR',
        last_known_status: 'dispatched',
        has_courier_pickup: false,
        has_courier_dropoff: false,
        is_demo: true,
        cached_at: new Date().toISOString(),
      },
    ]);

    const rows = await getOfflineDB().cached_assignments.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.public_code).toBe('SS-7K3M-9P2X-Q4WN');
  });
});
