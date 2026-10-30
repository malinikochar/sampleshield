'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  FlaskConical,
  PackageCheck,
  Send,
  Truck,
  XCircle,
} from 'lucide-react';
import { enqueueOfflineCustodyEvent } from '@/lib/offline/db';
import { useNetworkAndOfflineQueue } from '@/lib/offline/hooks';
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  FieldLabel,
  Input,
  Textarea,
} from '@/components/ui/primitives';
import {
  ExceptionStatusBadge,
  SeverityBadge,
  StatusBadge,
} from '@/components/domain/badges';
import { QrPanel } from '@/components/domain/qr-panel';
import { CustodyTimeline } from '@/components/domain/timeline';
import type {
  ExceptionRecord,
  Facility,
  Membership,
  SampleEventRecord,
  SampleEventType,
  SampleRecord,
} from '@/types/domain';

export function SamplePassportClient({
  sample,
  events,
  exceptions,
  couriers,
  actorMembership,
  actorFacility,
  isDemoOrg,
  isAssignedCourier,
  sourceFacility,
  destinationFacility,
}: {
  sample: SampleRecord;
  events: SampleEventRecord[];
  exceptions: ExceptionRecord[];
  couriers: Pick<Membership, 'user_id' | 'display_name' | 'email'>[];
  actorMembership: Membership;
  actorFacility: Facility | null;
  isDemoOrg: boolean;
  isAssignedCourier: boolean;
  sourceFacility: Pick<Facility, 'id' | 'name' | 'code' | 'location_label'> | null;
  destinationFacility: Pick<Facility, 'id' | 'name' | 'code' | 'location_label'> | null;
}) {
  const router = useRouter();
  const [selectedCourierId, setSelectedCourierId] = useState<string>(
    couriers[0]?.user_id ?? ''
  );
  const [handoverNote, setHandoverNote] = useState<string>('');
  const [transportObservation, setTransportObservation] = useState<string>('');
  const [sealIntact, setSealIntact] = useState<boolean>(true);
  const [dispositionDialog, setDispositionDialog] = useState<'lab_accepted' | 'lab_rejected' | null>(
    null
  );
  const [dispositionReason, setDispositionReason] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const { effectiveOnline, queuedEvents } = useNetworkAndOfflineQueue({
    organizationId: sample.organization_id,
    actorUserId: actorMembership.user_id,
    isDemoOrg,
    onSynced: () => router.refresh(),
  });

  const sampleLocalQueue = queuedEvents.filter(
    (q) => q.sample_public_code === sample.public_code
  );

  const hasConfirmedPickup = events.some((e) => e.event_type === 'courier_pickup');
  const hasQueuedPickup = sampleLocalQueue.some(
    (q) =>
      q.event_type === 'courier_pickup' &&
      (q.sync_state === 'queued' ||
        q.sync_state === 'syncing' ||
        q.sync_state === 'failed_retriable')
  );

  const submitEvent = async (
    eventType: SampleEventType,
    extraMeta?: Record<string, unknown>,
    allowOfflineQueue = false
  ) => {
    setBusy(true);
    setFeedback(null);
    const clientEventId = crypto.randomUUID();
    const clientOccurredAt = new Date().toISOString();

    const metadata = {
      package_seal_intact: sealIntact,
      ...(handoverNote.trim() ? { handover_note: handoverNote.trim() } : {}),
      ...(transportObservation.trim()
        ? { transport_observation: transportObservation.trim() }
        : {}),
      ...extraMeta,
    };

    try {
      // Offline queue path for permitted courier custody actions
      if (allowOfflineQueue && !effectiveOnline) {
        await enqueueOfflineCustodyEvent({
          clientEventId,
          organizationId: sample.organization_id,
          actorUserId: actorMembership.user_id,
          sampleId: sample.id,
          samplePublicCode: sample.public_code,
          specimenType: sample.specimen_type,
          destinationLabel: destinationFacility
            ? `${destinationFacility.name} (${destinationFacility.code})`
            : undefined,
          eventType,
          clientOccurredAt,
          metadata,
        });
        setHandoverNote('');
        setTransportObservation('');
        setFeedback({
          tone: 'warning',
          message:
            'Saved as Pending on this device (offline). It is NOT yet confirmed by the server and will sync automatically when connectivity returns.',
        });
        return;
      }

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_event_id: clientEventId,
          sample_public_code: sample.public_code,
          event_type: eventType,
          client_occurred_at: clientOccurredAt,
          was_queued_offline: false,
          metadata,
        }),
      });

      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error_code?: string;
        message?: string;
      } | null;

      if (!res.ok || !payload?.ok) {
        setFeedback({
          tone: 'error',
          message:
            payload?.message ?? `Server rejected ${eventType} (HTTP ${res.status}).`,
        });
        router.refresh();
        return;
      }

      setHandoverNote('');
      setTransportObservation('');
      setDispositionReason('');
      setDispositionDialog(null);
      setFeedback({
        tone: 'success',
        message: 'Custody event verified and appended to server audit ledger.',
      });
      router.refresh();
    } catch {
      if (allowOfflineQueue) {
        await enqueueOfflineCustodyEvent({
          clientEventId,
          organizationId: sample.organization_id,
          actorUserId: actorMembership.user_id,
          sampleId: sample.id,
          samplePublicCode: sample.public_code,
          specimenType: sample.specimen_type,
          eventType,
          clientOccurredAt,
          metadata,
        });
        setFeedback({
          tone: 'warning',
          message:
            'Network request timed out; handover queued locally as Pending on this device with the same idempotent UUID.',
        });
      } else {
        setFeedback({
          tone: 'error',
          message: 'Network unreachable. Online connection is required for this role action.',
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const canCollect =
    sample.status === 'created' &&
    (actorMembership.role === 'admin' ||
      (actorMembership.role === 'collector' &&
        (!actorMembership.facility_id ||
          actorMembership.facility_id === sample.source_facility_id)));

  const canDispatch =
    sample.status === 'collected' &&
    (actorMembership.role === 'admin' ||
      (actorMembership.role === 'collector' &&
        (!actorMembership.facility_id ||
          actorMembership.facility_id === sample.source_facility_id)));

  const canCourierAct =
    sample.status === 'dispatched' &&
    (actorMembership.role === 'admin' ||
      (actorMembership.role === 'courier' && isAssignedCourier));

  // Show Lab Receipt button to any lab user (including wrong destination lab so mismatch protection is verifiable!)
  const canAttemptLabReceive =
    sample.status === 'dispatched' &&
    (actorMembership.role === 'lab' || actorMembership.role === 'admin');

  const canLabDispose =
    sample.status === 'received' &&
    (actorMembership.role === 'admin' ||
      (actorMembership.role === 'lab' &&
        actorMembership.facility_id === sample.destination_facility_id));

  const openExceptions = exceptions.filter((e) => e.status !== 'resolved');

  return (
    <div className="space-y-6">
      {/* Header Summary Card */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0E9488]">
                Sample Passport
              </span>
              <StatusBadge status={sample.status} />
              {openExceptions.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF1F0] border border-[#D85A56] px-2.5 py-1 text-xs font-semibold text-[#8A1F1C]">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  {openExceptions.length} Active Exception(s)
                </span>
              ) : null}
            </div>
            <h1 className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-[#142437]">
              {sample.public_code}
            </h1>
            <p className="text-sm text-slate-600">
              <strong>{sample.specimen_type}</strong>
              {sample.case_alias ? ` · Synthetic Alias: ${sample.case_alias}` : ''}
              {sample.order_reference ? ` · Order Ref: ${sample.order_reference}` : ''}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-xs lg:min-w-[420px]">
            <div className="rounded-xl bg-[#F7FAFC] border border-slate-200 p-3.5">
              <span className="text-slate-500 font-medium">Origin Collection Clinic</span>
              <p className="font-bold text-[#142437] mt-0.5">
                {sourceFacility ? `${sourceFacility.name}` : 'Origin Clinic'}
              </p>
              <p className="font-mono text-[11px] text-slate-500">
                {sourceFacility?.code ?? ''}
              </p>
            </div>
            <div className="rounded-xl bg-[#F7FAFC] border border-slate-200 p-3.5">
              <span className="text-slate-500 font-medium">Authorized Receiving Lab</span>
              <p className="font-bold text-[#142437] mt-0.5">
                {destinationFacility ? `${destinationFacility.name}` : 'Receiving Lab'}
              </p>
              <p className="font-mono text-[11px] text-slate-500">
                {destinationFacility?.code ?? ''}
              </p>
            </div>
          </div>
        </div>

        {sample.disposition_reason ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-[#F7FAFC] px-4 py-3 text-xs text-slate-700">
            <strong className="text-[#142437]">Recorded Laboratory Disposition Rationale:</strong>{' '}
            {sample.disposition_reason}
          </div>
        ) : null}
      </Card>

      {/* Feedback Banner */}
      {feedback ? (
        <div
          role="alert"
          data-testid="passport-action-feedback"
          className={`flex items-start gap-2.5 rounded-xl border p-4 text-sm font-medium ${
            feedback.tone === 'success'
              ? 'border-[#0E9488]/50 bg-[#E5F7F3] text-[#0B5D56]'
              : feedback.tone === 'warning'
              ? 'border-2 border-dashed border-[#D97706] bg-amber-50 text-[#78350F]'
              : 'border-[#D85A56] bg-[#FDF1F0] text-[#8A1F1C]'
          }`}
        >
          {feedback.tone === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
          ) : feedback.tone === 'warning' ? (
            <CloudOff className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </div>
      ) : null}

      {/* Linked Operational Exceptions */}
      {exceptions.length > 0 ? (
        <Card className="p-5 border-[#E8A23C]/60 bg-[#FEF6E7]/30 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-[#142437] flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#D85A56]" aria-hidden="true" />
              <span>Linked Operational Exceptions ({exceptions.length})</span>
            </h2>
            {actorMembership.role !== 'courier' ? (
              <Link
                href="/app/exceptions"
                className="text-xs font-semibold text-[#0E9488] hover:underline"
              >
                Manage in Exception Inbox →
              </Link>
            ) : null}
          </div>

          <div className="grid gap-2.5">
            {exceptions.map((exc) => (
              <div
                key={exc.id}
                className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={exc.severity} />
                    <ExceptionStatusBadge status={exc.status} />
                    <span className="font-mono text-xs font-semibold text-slate-600">
                      {exc.rule_code}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#142437]">{exc.title}</p>
                  {exc.resolution_reason ? (
                    <p className="text-xs text-slate-600">
                      Resolution note: {exc.resolution_reason}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Operational flag only — authorized laboratory staff determine specimen
                      disposition.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Main Split: Left Timeline + Action Controls | Right Printable Opaque QR */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Role-Permitted Custody Action Panel */}
          {(canCollect ||
            canDispatch ||
            canCourierAct ||
            canAttemptLabReceive ||
            canLabDispose) && (
            <Card className="no-print p-5 sm:p-6 space-y-4 border-[#0E9488]/30">
              <div>
                <h2 className="text-base font-bold text-[#142437]">
                  Authorized Next Custody Action
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Server validates your role ({actorMembership.role}), facility membership, and
                  state transition atomically.
                </p>
              </div>

              {canDispatch ? (
                <div>
                  <FieldLabel htmlFor="courier-select" required>
                    Assign Authorized Transport Courier
                  </FieldLabel>
                  <select
                    id="courier-select"
                    value={selectedCourierId}
                    onChange={(e) => setSelectedCourierId(e.target.value)}
                    className="w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#142437]"
                  >
                    {couriers.map((c) => (
                      <option key={c.user_id} value={c.user_id}>
                        {c.display_name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="handover-note">Handover Note (Optional, No PHI)</FieldLabel>
                  <Input
                    id="handover-note"
                    value={handoverNote}
                    onChange={(e) => setHandoverNote(e.target.value)}
                    placeholder="e.g. Insulated carrier pouch sealed & checked"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="transport-obs">
                    Reported Transport Observation (Optional)
                  </FieldLabel>
                  <Input
                    id="transport-obs"
                    value={transportObservation}
                    onChange={(e) => setTransportObservation(e.target.value)}
                    placeholder="Manual note (never treated as IoT sensor data)"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sealIntact}
                  onChange={(e) => setSealIntact(e.target.checked)}
                  className="h-4 w-4 accent-[#0E9488]"
                />
                <span>Outer specimen pouch seal inspected and intact</span>
              </label>

              {actorFacility &&
              actorMembership.role === 'lab' &&
              actorFacility.id !== sample.destination_facility_id &&
              sample.status === 'dispatched' ? (
                <div className="rounded-xl border border-[#D85A56] bg-[#FDF1F0] p-3.5 text-xs text-[#8A1F1C]">
                  <strong>Facility Mismatch Warning:</strong> Your lab ({actorFacility.name}) is not
                  the designated destination ({destinationFacility?.name}). Attempting receipt will
                  be blocked by the server and logged as a <code>DESTINATION_MISMATCH</code>{' '}
                  exception.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2.5 pt-1">
                {canCollect ? (
                  <Button
                    onClick={() => void submitEvent('sample_collected')}
                    disabled={busy}
                    data-testid="btn-collect-sample"
                  >
                    <PackageCheck className="h-4 w-4" />
                    <span>Confirm Specimen Collection</span>
                  </Button>
                ) : null}

                {canDispatch ? (
                  <Button
                    onClick={() =>
                      void submitEvent('sample_dispatched', {
                        assigned_courier_id: selectedCourierId,
                      })
                    }
                    disabled={busy || !selectedCourierId}
                    data-testid="btn-dispatch-sample"
                  >
                    <Send className="h-4 w-4" />
                    <span>Dispatch to Assigned Courier</span>
                  </Button>
                ) : null}

                {canCourierAct && !hasConfirmedPickup && !hasQueuedPickup ? (
                  <Button
                    onClick={() => void submitEvent('courier_pickup', {}, true)}
                    disabled={busy}
                    data-testid="btn-courier-pickup"
                  >
                    <Truck className="h-4 w-4" />
                    <span>
                      {effectiveOnline
                        ? 'Record Courier Pickup'
                        : 'Queue Courier Pickup Offline'}
                    </span>
                  </Button>
                ) : null}

                {canCourierAct && (hasConfirmedPickup || hasQueuedPickup) ? (
                  <Button
                    variant="secondary"
                    onClick={() => void submitEvent('courier_dropoff', {}, true)}
                    disabled={busy}
                    data-testid="btn-courier-dropoff"
                  >
                    <Truck className="h-4 w-4" />
                    <span>
                      {effectiveOnline
                        ? 'Record Lab Drop-off'
                        : 'Queue Lab Drop-off Offline'}
                    </span>
                  </Button>
                ) : null}

                {canAttemptLabReceive ? (
                  <Button
                    onClick={() =>
                      void submitEvent('lab_received', {
                        ...(actorFacility ? { scanned_facility_id: actorFacility.id } : {}),
                      })
                    }
                    disabled={busy}
                    data-testid="btn-lab-receive"
                  >
                    <FlaskConical className="h-4 w-4" />
                    <span>Record Laboratory Receipt</span>
                  </Button>
                ) : null}

                {canLabDispose ? (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => {
                        setDispositionReason(
                          'Container seal verified, custody chain reviewed, accepted for testing.'
                        );
                        setDispositionDialog('lab_accepted');
                      }}
                      disabled={busy}
                      data-testid="btn-open-accept-dialog"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Accept Specimen</span>
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        setDispositionReason('');
                        setDispositionDialog('lab_rejected');
                      }}
                      disabled={busy}
                      data-testid="btn-open-reject-dialog"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Reject Specimen</span>
                    </Button>
                  </>
                ) : null}
              </div>
            </Card>
          )}

          {/* Custody Audit Timeline */}
          <CustodyTimeline
            confirmedEvents={events}
            localPendingEvents={sampleLocalQueue}
          />
        </div>

        {/* Right Column: Printable Opaque QR */}
        <div className="lg:col-span-4 space-y-4">
          <QrPanel
            publicCode={sample.public_code}
            specimenType={sample.specimen_type}
            sourceCode={sourceFacility?.code}
            destinationCode={destinationFacility?.code}
            isDemo={sample.is_demo}
          />
        </div>
      </div>

      {/* Human-Controlled Lab Disposition Dialog */}
      <Dialog
        open={dispositionDialog !== null}
        onOpenChange={(open) => {
          if (!open) setDispositionDialog(null);
        }}
      >
        <DialogContent
          title={
            dispositionDialog === 'lab_accepted'
              ? 'Confirm Laboratory Acceptance'
              : 'Confirm Laboratory Rejection (Reason Required)'
          }
          description="SampleShield never makes autonomous clinical decisions. Your authenticated identity and rationale will be permanently recorded in the custody ledger."
        >
          <div className="space-y-4">
            {openExceptions.length > 0 ? (
              <div className="rounded-xl border border-[#E8A23C] bg-[#FEF6E7] p-3 text-xs text-[#78350F]">
                <strong>Notice:</strong> This specimen has {openExceptions.length} unresolved
                operational exception(s). Confirm that you have inspected the physical specimen
                according to laboratory SOPs.
              </div>
            ) : null}

            <div>
              <FieldLabel
                htmlFor="disposition-reason"
                required={dispositionDialog === 'lab_rejected'}
              >
                {dispositionDialog === 'lab_rejected'
                  ? 'Documented Rejection Reason'
                  : 'Operational Acceptance Rationale'}
              </FieldLabel>
              <Textarea
                id="disposition-reason"
                rows={3}
                value={dispositionReason}
                onChange={(e) => setDispositionReason(e.target.value)}
                placeholder={
                  dispositionDialog === 'lab_rejected'
                    ? 'e.g. Primary tube cracked / seal broken on arrival per Lab SOP-04'
                    : 'e.g. Seal intact, identifier matched, accepted into assay bench'
                }
              />
            </div>

            <div className="flex justify-end gap-2.5">
              <Button
                variant="outline"
                onClick={() => setDispositionDialog(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                variant={dispositionDialog === 'lab_rejected' ? 'danger' : 'primary'}
                disabled={
                  busy ||
                  (dispositionDialog === 'lab_rejected' &&
                    dispositionReason.trim().length < 5)
                }
                data-testid="confirm-disposition-submit"
                onClick={() => {
                  if (!dispositionDialog) return;
                  void submitEvent(dispositionDialog, {
                    disposition_reason: dispositionReason.trim(),
                    ...(actorFacility ? { scanned_facility_id: actorFacility.id } : {}),
                  });
                }}
              >
                {busy
                  ? 'Recording decision…'
                  : dispositionDialog === 'lab_rejected'
                  ? 'Confirm Rejection'
                  : 'Confirm Acceptance'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
