'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, CloudOff, ShieldCheck, Smartphone } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { RoleBadge, SyncBadge } from '@/components/domain/badges';
import { EVENT_TYPE_LABELS, formatDateTime } from '@/lib/utils';
import type { OfflineQueuedEvent, SampleEventRecord } from '@/types/domain';

export function CustodyTimeline({
  confirmedEvents,
  localPendingEvents = [],
}: {
  confirmedEvents: SampleEventRecord[];
  localPendingEvents?: OfflineQueuedEvent[];
}) {
  const [filter, setFilter] = useState<'all' | 'handovers' | 'offline'>('all');

  const filteredEvents = confirmedEvents.filter((evt) => {
    if (filter === 'handovers') {
      return [
        'sample_dispatched',
        'courier_pickup',
        'courier_dropoff',
        'lab_received',
      ].includes(evt.event_type);
    }
    if (filter === 'offline') {
      return evt.was_queued_offline;
    }
    return true;
  });

  const activeLocalPending = localPendingEvents.filter((e) => e.sync_state !== 'synced');

  return (
    <div className="space-y-4">
      {activeLocalPending.length > 0 ? (
        <div
          role="region"
          aria-label="Unconfirmed events queued on this device"
          className="rounded-2xl border-2 border-dashed border-[#D97706] bg-amber-50/80 p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-bold text-[#78350F]">
              <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Unconfirmed Local Queue (This Device Only)</span>
            </div>
            <span className="text-xs text-[#92400E]">
              Not yet recorded in authoritative laboratory ledger
            </span>
          </div>

          <div className="space-y-2.5">
            {activeLocalPending.map((item) => (
              <div
                key={item.client_event_id}
                className="rounded-xl border border-amber-300 bg-white p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#142437]">
                      {EVENT_TYPE_LABELS[item.event_type]}
                    </span>
                    <SyncBadge state={item.sync_state} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-600">
                    Device time: {formatDateTime(item.client_occurred_at)} · Event ID:{' '}
                    {item.client_event_id.slice(0, 8)}…
                  </p>
                  {item.last_error_message ? (
                    <p className="mt-1.5 text-xs font-medium text-[#8A1F1C]">
                      {item.last_error_message}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-[#142437]">
              Server-Confirmed Chain-of-Custody Ledger
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Append-only operational audit events verified by Supabase PostgreSQL
            </p>
          </div>
          <div
            role="group"
            aria-label="Filter custody timeline"
            className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold"
          >
            {(
              [
                ['all', 'All Events'],
                ['handovers', 'Handovers'],
                ['offline', 'Offline Synced'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer ${
                  filter === key
                    ? 'bg-white text-[#142437] shadow-xs'
                    : 'text-slate-600 hover:text-[#142437]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No confirmed custody events match the selected filter.
          </div>
        ) : (
          <ol className="mt-5 relative border-s-2 border-slate-200 ms-3 space-y-6">
            {filteredEvents.map((evt, idx) => {
              const isLatest = idx === filteredEvents.length - 1;
              return (
                <li key={evt.id} className="ms-6">
                  <span
                    className={`absolute -start-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${
                      isLatest ? 'bg-[#0E9488] text-white' : 'bg-[#183B56] text-white'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>

                  <div className="rounded-xl border border-slate-200/80 bg-[#F7FAFC]/70 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#142437]">
                          {EVENT_TYPE_LABELS[evt.event_type]}
                        </span>
                        <RoleBadge role={evt.actor_role} />
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E5F7F3] px-2.5 py-0.5 text-[11px] font-semibold text-[#0B5D56]">
                        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                        Confirmed by server
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-medium text-slate-700">
                      Actor: <span className="font-semibold text-[#142437]">{evt.actor_name}</span>
                      {evt.metadata?.assigned_courier_name ? (
                        <span>
                          {' '}
                          → Assigned courier:{' '}
                          <strong className="text-[#142437]">
                            {evt.metadata.assigned_courier_name}
                          </strong>
                        </span>
                      ) : null}
                    </p>

                    {evt.metadata?.handover_note ? (
                      <p className="mt-1.5 text-xs text-slate-700 bg-white rounded-lg border border-slate-200/70 px-2.5 py-1.5">
                        Note: {evt.metadata.handover_note}
                      </p>
                    ) : null}

                    {evt.metadata?.transport_observation ? (
                      <p className="mt-1.5 text-xs text-[#7C4A0A] bg-[#FEF6E7] rounded-lg border border-[#E8A23C]/40 px-2.5 py-1.5">
                        Reported observation (manual, non-sensor):{' '}
                        {evt.metadata.transport_observation}
                      </p>
                    ) : null}

                    {evt.metadata?.disposition_reason ? (
                      <p className="mt-1.5 text-xs font-medium text-[#142437] bg-white rounded-lg border border-slate-300 px-2.5 py-1.5">
                        Laboratory disposition rationale: {evt.metadata.disposition_reason}
                      </p>
                    ) : null}

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        Server receipt: {formatDateTime(evt.server_recorded_at)}
                      </span>
                      {evt.client_occurred_at ? (
                        <span className="inline-flex items-center gap-1">
                          <Smartphone className="h-3 w-3" aria-hidden="true" />
                          Device recorded: {formatDateTime(evt.client_occurred_at)}
                        </span>
                      ) : null}
                      {evt.was_queued_offline ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-sans font-semibold text-amber-900">
                          Replayed from offline queue
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}
