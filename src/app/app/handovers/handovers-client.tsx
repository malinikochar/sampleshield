'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertOctagon,
  CheckCircle2,
  CloudOff,
  RefreshCw,
  Trash2,
  Truck,
  WifiOff,
} from 'lucide-react';
import {
  cacheAuthorizedCourierAssignments,
  dismissConflictOrSyncedEvent,
  enqueueOfflineCustodyEvent,
} from '@/lib/offline/db';
import { useNetworkAndOfflineQueue } from '@/lib/offline/hooks';
import { Button, Card, Input } from '@/components/ui/primitives';
import { StatusBadge, SyncBadge } from '@/components/domain/badges';
import { EVENT_TYPE_LABELS, formatDateTime } from '@/lib/utils';
import type {
  CachedCourierAssignment,
  MembershipRole,
  SampleEventType,
} from '@/types/domain';

export function HandoversClient({
  organizationId,
  actorUserId,
  actorRole,
  isDemoOrg,
  serverAssignments,
  highlightCode,
}: {
  organizationId: string;
  actorUserId: string;
  actorRole: MembershipRole;
  isDemoOrg: boolean;
  serverAssignments: CachedCourierAssignment[];
  highlightCode?: string;
}) {
  const router = useRouter();
  const [notesBySample, setNotesBySample] = useState<Record<string, string>>({});
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [banner, setBanner] = useState<{
    tone: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const {
    effectiveOnline,
    simulatedOffline,
    setSimulatedOffline,
    queuedEvents,
    cachedAssignments,
    pendingOnDeviceCount,
    conflictCount,
    isSyncingNow,
    triggerSync,
  } = useNetworkAndOfflineQueue({
    organizationId,
    actorUserId,
    isDemoOrg,
    onSynced: (res) => {
      if (res.synced > 0) {
        setBanner({
          tone: 'success',
          text: `Confirmed ${res.synced} queued event(s) with Supabase PostgreSQL.`,
        });
      } else if (res.conflicts > 0) {
        setBanner({
          tone: 'error',
          text: `${res.conflicts} queued event(s) conflicted with server state and need human review.`,
        });
      }
      router.refresh();
    },
  });

  // Sync minimal authorized courier assignments to IndexedDB while online
  useEffect(() => {
    if (effectiveOnline && actorRole === 'courier') {
      void cacheAuthorizedCourierAssignments(organizationId, actorUserId, serverAssignments);
    }
  }, [effectiveOnline, actorRole, organizationId, actorUserId, serverAssignments]);

  const activeAssignments =
    effectiveOnline || serverAssignments.length > 0 ? serverAssignments : cachedAssignments;

  const recordHandover = async (
    assignment: CachedCourierAssignment,
    eventType: SampleEventType
  ) => {
    setBusyCode(assignment.public_code);
    setBanner(null);

    const clientEventId = crypto.randomUUID();
    const clientOccurredAt = new Date().toISOString();
    const note = notesBySample[assignment.public_code]?.trim();
    const metadata = {
      package_seal_intact: true,
      ...(note ? { handover_note: note } : {}),
    };

    try {
      // Always persist intent in IndexedDB first so reload never loses an in-flight handover!
      await enqueueOfflineCustodyEvent({
        clientEventId,
        organizationId,
        actorUserId,
        sampleId: assignment.sample_id,
        samplePublicCode: assignment.public_code,
        specimenType: assignment.specimen_type,
        destinationLabel: `${assignment.destination_facility_name} (${assignment.destination_facility_code})`,
        eventType,
        clientOccurredAt,
        metadata,
      });

      setNotesBySample((prev) => ({ ...prev, [assignment.public_code]: '' }));

      if (!effectiveOnline) {
        setBanner({
          tone: 'warning',
          text: `Saved ${EVENT_TYPE_LABELS[eventType]} for ${assignment.public_code} as Pending on this device. Reconnect or click Retry sync to confirm with server.`,
        });
        return;
      }

      await triggerSync(true);
    } finally {
      setBusyCode(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Guided Offline Controls for Demo & Real Field Connectivity */}
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-[#142437]">
              Connectivity & Local Event Queue
            </h2>
            {!effectiveOnline ? (
              <span className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-[#D97706] bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-[#78350F]">
                <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                Offline Queue Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E5F7F3] px-2.5 py-0.5 text-xs font-semibold text-[#0B5D56]">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Online · Live Server Sync
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600">
            Local queue stores minimal non-PHI custody UUIDs in IndexedDB. Items never appear
            confirmed until PostgreSQL returns a server receipt timestamp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isDemoOrg ? (
            <Button
              variant={simulatedOffline ? 'primary' : 'amber'}
              size="sm"
              data-testid="handovers-simulate-offline-btn"
              onClick={() => setSimulatedOffline(!simulatedOffline)}
            >
              <CloudOff className="h-3.5 w-3.5" />
              <span>{simulatedOffline ? 'Reconnect Demo Network' : 'Go Offline (Demo Mode)'}</span>
            </Button>
          ) : null}

          <Button
            variant="secondary"
            size="sm"
            disabled={isSyncingNow || !effectiveOnline || pendingOnDeviceCount === 0}
            onClick={() => void triggerSync(true)}
            data-testid="manual-retry-sync-btn"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
            <span>Retry Sync ({pendingOnDeviceCount})</span>
          </Button>
        </div>
      </Card>

      {banner ? (
        <div
          role="status"
          data-testid="handover-banner"
          className={`rounded-xl border p-4 text-sm font-medium ${
            banner.tone === 'success'
              ? 'border-[#0E9488]/40 bg-[#E5F7F3] text-[#0B5D56]'
              : banner.tone === 'warning'
              ? 'border-2 border-dashed border-[#D97706] bg-amber-50 text-[#78350F]'
              : 'border-[#D85A56] bg-[#FDF1F0] text-[#8A1F1C]'
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      {/* Local IndexedDB Queue Tray */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-[#142437]">
              This Device&apos;s Pending & Recent Sync Tray ({queuedEvents.length})
            </h2>
            <p className="text-xs text-slate-600">
              Survives browser reload · Deduplicated server-side by{' '}
              <code className="font-mono">client_event_id</code>
            </p>
          </div>
          {conflictCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF1F0] border border-[#D85A56] px-3 py-1 text-xs font-bold text-[#8A1F1C]">
              <AlertOctagon className="h-3.5 w-3.5" aria-hidden="true" />
              {conflictCount} Conflict(s) Need Review
            </span>
          ) : null}
        </div>

        {queuedEvents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-[#F7FAFC] p-6 text-center text-xs text-slate-500">
            No queued or recently replayed events stored on this device.
          </div>
        ) : (
          <div className="space-y-3" data-testid="offline-queue-list">
            {queuedEvents.map((evt) => (
              <div
                key={evt.client_event_id}
                data-testid={`queued-item-${evt.sample_public_code}-${evt.event_type}`}
                className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  evt.sync_state === 'conflict'
                    ? 'border-2 border-[#D85A56] bg-[#FDF1F0]/60'
                    : evt.sync_state === 'synced'
                    ? 'border-slate-200 bg-[#F7FAFC]'
                    : 'border-2 border-dashed border-[#D97706] bg-amber-50/50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#142437]">
                      {evt.sample_public_code}
                    </span>
                    <span className="text-sm font-semibold text-[#142437]">
                      · {EVENT_TYPE_LABELS[evt.event_type]}
                    </span>
                    <SyncBadge state={evt.sync_state} />
                  </div>

                  <p className="font-mono text-[11px] text-slate-600">
                    Client UUID: {evt.client_event_id} · Device time:{' '}
                    {formatDateTime(evt.client_occurred_at)}
                    {evt.server_recorded_at
                      ? ` · Server receipt: ${formatDateTime(evt.server_recorded_at)}`
                      : ''}
                  </p>

                  {evt.last_error_message ? (
                    <p
                      data-testid="conflict-error-reason"
                      className="text-xs font-semibold text-[#8A1F1C] mt-1"
                    >
                      {evt.last_error_message}
                    </p>
                  ) : null}
                </div>

                {(evt.sync_state === 'synced' || evt.sync_state === 'conflict') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void dismissConflictOrSyncedEvent(evt.client_event_id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear from tray</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Active Assigned Courier Deliveries */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-[#142437]">
            Authorized Dispatched Specimens ({activeAssignments.length})
          </h2>
          <p className="text-xs text-slate-600">
            {actorRole === 'courier'
              ? 'Pre-authorized assignments available for online or offline custody capture'
              : 'Dispatched specimens currently in courier custody workflow'}
          </p>
        </div>

        {activeAssignments.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-500">
            No dispatched specimens are currently assigned for courier handover.
          </Card>
        ) : (
          <div className="grid gap-4">
            {activeAssignments.map((item) => {
              const queuedForSample = queuedEvents.filter(
                (q) =>
                  q.sample_public_code === item.public_code &&
                  (q.sync_state === 'queued' ||
                    q.sync_state === 'syncing' ||
                    q.sync_state === 'failed_retriable')
              );
              const localHasPickup = queuedForSample.some(
                (q) => q.event_type === 'courier_pickup'
              );
              const localHasDropoff = queuedForSample.some(
                (q) => q.event_type === 'courier_dropoff'
              );

              const highlighted = highlightCode === item.public_code;

              return (
                <Card
                  key={item.sample_id}
                  data-testid={`assignment-card-${item.public_code}`}
                  className={`p-5 space-y-4 ${
                    highlighted ? 'ring-2 ring-[#0E9488]' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/app/samples/${item.sample_id}`}
                          className="font-mono text-lg font-extrabold text-[#142437] hover:text-[#0E9488]"
                        >
                          {item.public_code}
                        </Link>
                        <StatusBadge status={item.last_known_status} />
                        {queuedForSample.length > 0 ? <SyncBadge state="queued" /> : null}
                      </div>
                      <p className="text-sm text-slate-700 mt-0.5">{item.specimen_type}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.source_facility_name} ({item.source_facility_code}) →{' '}
                        <strong className="text-[#142437]">
                          {item.destination_facility_name} ({item.destination_facility_code})
                        </strong>
                      </p>
                    </div>
                  </div>

                  {(actorRole === 'courier' || actorRole === 'admin') && (
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-100">
                      <Input
                        value={notesBySample[item.public_code] ?? ''}
                        onChange={(e) =>
                          setNotesBySample((prev) => ({
                            ...prev,
                            [item.public_code]: e.target.value,
                          }))
                        }
                        placeholder="Optional handover note (e.g. cold box seal verified)"
                        aria-label={`Handover note for ${item.public_code}`}
                        className="flex-1"
                      />

                      {!item.has_courier_pickup && !localHasPickup ? (
                        <Button
                          onClick={() => void recordHandover(item, 'courier_pickup')}
                          disabled={busyCode === item.public_code}
                          data-testid={`pickup-btn-${item.public_code}`}
                        >
                          <Truck className="h-4 w-4" />
                          <span>
                            {effectiveOnline
                              ? 'Confirm Pickup'
                              : 'Save Pickup Offline'}
                          </span>
                        </Button>
                      ) : !item.has_courier_dropoff && !localHasDropoff ? (
                        <Button
                          variant="secondary"
                          onClick={() => void recordHandover(item, 'courier_dropoff')}
                          disabled={busyCode === item.public_code}
                          data-testid={`dropoff-btn-${item.public_code}`}
                        >
                          <Truck className="h-4 w-4" />
                          <span>
                            {effectiveOnline
                              ? 'Confirm Lab Drop-off'
                              : 'Save Drop-off Offline'}
                          </span>
                        </Button>
                      ) : (
                        <span className="inline-flex items-center px-3 py-2 text-xs font-semibold text-[#0B5D56] bg-[#E5F7F3] rounded-xl">
                          Courier custody steps recorded
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
