'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  FieldLabel,
  Textarea,
} from '@/components/ui/primitives';
import { SeverityBadge, StatusBadge } from '@/components/domain/badges';
import { formatDateTime } from '@/lib/utils';
import type { ExceptionSeverity, SampleStatus } from '@/types/domain';

export interface LabSampleItem {
  id: string;
  public_code: string;
  specimen_type: string;
  case_alias: string | null;
  order_reference: string | null;
  status: SampleStatus;
  destination_facility_id: string;
  source_name: string;
  source_code: string;
  destination_name: string;
  destination_code: string;
  updated_at: string;
  exceptions: Array<{
    id: string;
    rule_code: string;
    severity: ExceptionSeverity;
    status: string;
    title: string;
  }>;
}

export function LabDeskClient({
  inboundSamples,
  receivedSamples,
  actorFacilityId,
  actorFacilityName,
  isAdmin,
}: {
  inboundSamples: LabSampleItem[];
  receivedSamples: LabSampleItem[];
  actorFacilityId: string | null;
  actorFacilityName: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'received' | 'inbound'>(
    receivedSamples.length > 0 ? 'received' : 'inbound'
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const [dispositionModal, setDispositionModal] = useState<{
    sample: LabSampleItem;
    decision: 'lab_accepted' | 'lab_rejected';
  } | null>(null);
  const [rationale, setRationale] = useState('');

  const handleReceive = async (sample: LabSampleItem) => {
    setBusyId(sample.id);
    setFeedback(null);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_event_id: crypto.randomUUID(),
          sample_public_code: sample.public_code,
          event_type: 'lab_received',
          client_occurred_at: new Date().toISOString(),
          was_queued_offline: false,
          metadata: {
            package_seal_intact: true,
            handover_note: 'Logged at receiving laboratory intake desk',
            ...(actorFacilityId ? { scanned_facility_id: actorFacilityId } : {}),
          },
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        setFeedback({
          tone: 'error',
          message: json?.message ?? 'Receipt blocked by server validation.',
        });
        router.refresh();
        return;
      }

      setFeedback({
        tone: 'success',
        message: `Specimen ${sample.public_code} received and moved to Disposition Review.`,
      });
      setTab('received');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const submitDisposition = async () => {
    if (!dispositionModal) return;
    setBusyId(dispositionModal.sample.id);
    setFeedback(null);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_event_id: crypto.randomUUID(),
          sample_public_code: dispositionModal.sample.public_code,
          event_type: dispositionModal.decision,
          client_occurred_at: new Date().toISOString(),
          was_queued_offline: false,
          metadata: {
            disposition_reason: rationale.trim(),
            ...(actorFacilityId ? { scanned_facility_id: actorFacilityId } : {}),
          },
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        setFeedback({
          tone: 'error',
          message: json?.message ?? 'Disposition could not be recorded.',
        });
        return;
      }

      setFeedback({
        tone: 'success',
        message: `Recorded human-reviewed ${
          dispositionModal.decision === 'lab_accepted' ? 'Acceptance' : 'Rejection'
        } for ${dispositionModal.sample.public_code}.`,
      });
      setDispositionModal(null);
      setRationale('');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Safety Authority Notice */}
      <div className="rounded-2xl border border-[#0E9488]/30 bg-[#E5F7F3]/60 p-4 flex items-start gap-3 text-xs text-[#0B5D56]">
        <ShieldCheck className="h-5 w-5 shrink-0 text-[#0E9488]" aria-hidden="true" />
        <div>
          <p className="font-bold">
            Human-Reviewed Laboratory Authority{' '}
            {actorFacilityName ? `· ${actorFacilityName}` : isAdmin ? '· Admin View' : ''}
          </p>
          <p className="mt-0.5">
            SampleShield flags transit delays, handover gaps, and destination mismatches as
            operational alerts only. Specimen acceptability is decided exclusively by authorized
            laboratory personnel.
          </p>
        </div>
      </div>

      {feedback ? (
        <div
          role="alert"
          data-testid="lab-desk-feedback"
          className={`flex items-start gap-2.5 rounded-xl border p-4 text-sm font-medium ${
            feedback.tone === 'success'
              ? 'border-[#0E9488]/40 bg-[#E5F7F3] text-[#0B5D56]'
              : 'border-[#D85A56] bg-[#FDF1F0] text-[#8A1F1C]'
          }`}
        >
          {feedback.tone === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      ) : null}

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Laboratory workflow queues"
        className="inline-flex rounded-xl bg-slate-200/80 p-1 text-sm font-semibold"
      >
        <button
          role="tab"
          aria-selected={tab === 'received'}
          type="button"
          onClick={() => setTab('received')}
          className={`rounded-lg px-4 py-2 transition-colors cursor-pointer ${
            tab === 'received'
              ? 'bg-white text-[#142437] shadow-xs'
              : 'text-slate-600 hover:text-[#142437]'
          }`}
        >
          Awaiting Human Disposition ({receivedSamples.length})
        </button>
        <button
          role="tab"
          aria-selected={tab === 'inbound'}
          type="button"
          onClick={() => setTab('inbound')}
          className={`rounded-lg px-4 py-2 transition-colors cursor-pointer ${
            tab === 'inbound'
              ? 'bg-white text-[#142437] shadow-xs'
              : 'text-slate-600 hover:text-[#142437]'
          }`}
        >
          Inbound Dispatches ({inboundSamples.length})
        </button>
      </div>

      {tab === 'received' ? (
        receivedSamples.length === 0 ? (
          <Card className="p-10 text-center text-sm text-slate-500">
            No received specimens are currently awaiting disposition review.
          </Card>
        ) : (
          <div className="grid gap-4">
            {receivedSamples.map((sample) => (
              <Card
                key={sample.id}
                data-testid={`lab-received-card-${sample.public_code}`}
                className="p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/app/samples/${sample.id}`}
                        className="font-mono text-lg font-extrabold text-[#142437] hover:text-[#0E9488]"
                      >
                        {sample.public_code}
                      </Link>
                      <StatusBadge status={sample.status} />
                    </div>
                    <p className="text-sm font-medium text-slate-700 mt-1">
                      {sample.specimen_type}
                      {sample.case_alias ? ` · Alias: ${sample.case_alias}` : ''}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Origin: {sample.source_name} ({sample.source_code}) → Destination:{' '}
                      {sample.destination_name} ({sample.destination_code}) · Updated{' '}
                      {formatDateTime(sample.updated_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busyId === sample.id}
                      data-testid={`lab-accept-${sample.public_code}`}
                      onClick={() => {
                        setRationale(
                          'Container seal intact, identifier verified, accepted per receiving SOP.'
                        );
                        setDispositionModal({ sample, decision: 'lab_accepted' });
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Accept</span>
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busyId === sample.id}
                      data-testid={`lab-reject-${sample.public_code}`}
                      onClick={() => {
                        setRationale('');
                        setDispositionModal({ sample, decision: 'lab_rejected' });
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Reject</span>
                    </Button>
                  </div>
                </div>

                {sample.exceptions.length > 0 ? (
                  <div className="rounded-xl border border-[#E8A23C] bg-[#FEF6E7] p-3.5 space-y-2">
                    <p className="text-xs font-bold text-[#78350F] flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Operational Discrepancies Flagged for Lab Review:</span>
                    </p>
                    {sample.exceptions.map((exc) => (
                      <div
                        key={exc.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#78350F] bg-white/80 rounded-lg px-3 py-2 border border-amber-200"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <SeverityBadge severity={exc.severity} />
                          <span className="font-semibold">{exc.title}</span>
                        </div>
                        <Link
                          href="/app/exceptions"
                          className="font-semibold text-[#0E9488] hover:underline"
                        >
                          Acknowledge / Resolve →
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )
      ) : inboundSamples.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">
          No dispatched specimens are currently inbound.
        </Card>
      ) : (
        <div className="grid gap-4">
          {inboundSamples.map((sample) => {
            const wrongFacility =
              !isAdmin &&
              Boolean(actorFacilityId) &&
              actorFacilityId !== sample.destination_facility_id;

            return (
              <Card
                key={sample.id}
                data-testid={`lab-inbound-card-${sample.public_code}`}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/app/samples/${sample.id}`}
                      className="font-mono text-base font-extrabold text-[#142437] hover:text-[#0E9488]"
                    >
                      {sample.public_code}
                    </Link>
                    <StatusBadge status={sample.status} />
                    {wrongFacility ? (
                      <span className="rounded-full bg-[#FDF1F0] border border-[#D85A56] px-2.5 py-0.5 text-xs font-semibold text-[#8A1F1C]">
                        Routed to {sample.destination_code} (Different Lab)
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-700">{sample.specimen_type}</p>
                  <p className="text-xs text-slate-500">
                    {sample.source_name} ({sample.source_code}) →{' '}
                    <strong className="text-[#142437]">
                      {sample.destination_name} ({sample.destination_code})
                    </strong>
                  </p>
                </div>

                <Button
                  variant={wrongFacility ? 'outline' : 'primary'}
                  size="sm"
                  disabled={busyId === sample.id}
                  data-testid={`lab-receive-${sample.public_code}`}
                  onClick={() => void handleReceive(sample)}
                >
                  <FlaskConical className="h-4 w-4" />
                  <span>
                    {wrongFacility ? 'Attempt Receipt (Test Guard)' : 'Record Lab Receipt'}
                  </span>
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Disposition Modal */}
      <Dialog
        open={dispositionModal !== null}
        onOpenChange={(open) => {
          if (!open) setDispositionModal(null);
        }}
      >
        <DialogContent
          title={
            dispositionModal?.decision === 'lab_accepted'
              ? `Accept Specimen ${dispositionModal.sample.public_code}`
              : `Reject Specimen ${dispositionModal?.sample.public_code ?? ''}`
          }
          description="This decision is terminal in the MVP workflow and recorded under your authenticated laboratory identity."
        >
          <div className="space-y-4">
            <div>
              <FieldLabel
                htmlFor="lab-desk-rationale"
                required={dispositionModal?.decision === 'lab_rejected'}
              >
                {dispositionModal?.decision === 'lab_rejected'
                  ? 'Mandatory Rejection Rationale (Min 5 characters)'
                  : 'Operational Acceptance Note'}
              </FieldLabel>
              <Textarea
                id="lab-desk-rationale"
                rows={3}
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder={
                  dispositionModal?.decision === 'lab_rejected'
                    ? 'Document physical container or labelling discrepancy per SOP…'
                    : 'Document intake verification note…'
                }
              />
            </div>

            <div className="flex justify-end gap-2.5">
              <Button variant="outline" onClick={() => setDispositionModal(null)}>
                Cancel
              </Button>
              <Button
                variant={dispositionModal?.decision === 'lab_rejected' ? 'danger' : 'primary'}
                disabled={
                  busyId !== null ||
                  (dispositionModal?.decision === 'lab_rejected' &&
                    rationale.trim().length < 5)
                }
                data-testid="lab-desk-confirm-disposition"
                onClick={() => void submitDisposition()}
              >
                {dispositionModal?.decision === 'lab_rejected'
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
