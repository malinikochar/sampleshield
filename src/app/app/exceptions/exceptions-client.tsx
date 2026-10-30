'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  FieldLabel,
  Textarea,
} from '@/components/ui/primitives';
import {
  ExceptionStatusBadge,
  SeverityBadge,
  StatusBadge,
} from '@/components/domain/badges';
import { formatDateTime } from '@/lib/utils';
import type {
  ExceptionActionRecord,
  ExceptionActionType,
  ExceptionSeverity,
  ExceptionStatus,
  SampleStatus,
} from '@/types/domain';

export interface ExceptionInboxItem {
  id: string;
  sample_id: string;
  rule_code: string;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  title: string;
  details: Record<string, unknown>;
  detected_at: string;
  resolution_reason: string | null;
  sample: {
    id: string;
    public_code: string;
    specimen_type: string;
    status: SampleStatus;
  } | null;
  actions: ExceptionActionRecord[];
}

export function ExceptionsClient({
  items,
  canMutate,
}: {
  items: ExceptionInboxItem[];
  canMutate: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | ExceptionStatus>('open');
  const [modalState, setModalState] = useState<{
    exception: ExceptionInboxItem;
    action: ExceptionActionType;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const filtered = items.filter((item) => (filter === 'all' ? true : item.status === filter));

  const submitAction = async () => {
    if (!modalState) return;
    setSubmitting(true);
    setBanner(null);

    try {
      const res = await fetch(`/api/exceptions/${modalState.exception.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: modalState.action,
          reason: reason.trim(),
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        setBanner({
          tone: 'error',
          text: json?.message ?? 'Unable to record exception review action.',
        });
        return;
      }

      setBanner({
        tone: 'success',
        text: `Exception ${modalState.action}d with permanent audit record.`,
      });
      setModalState(null);
      setReason('');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {banner ? (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-xl border p-4 text-sm font-medium ${
            banner.tone === 'success'
              ? 'border-[#0E9488]/40 bg-[#E5F7F3] text-[#0B5D56]'
              : 'border-[#D85A56] bg-[#FDF1F0] text-[#8A1F1C]'
          }`}
        >
          {banner.tone === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <span>{banner.text}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter exceptions by status"
          className="inline-flex rounded-xl bg-slate-200/80 p-1 text-xs font-semibold"
        >
          {(
            [
              ['open', `Open (${items.filter((i) => i.status === 'open').length})`],
              [
                'acknowledged',
                `Acknowledged (${items.filter((i) => i.status === 'acknowledged').length})`,
              ],
              ['resolved', `Resolved (${items.filter((i) => i.status === 'resolved').length})`],
              ['all', `All (${items.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-2 transition-colors cursor-pointer ${
                filter === key
                  ? 'bg-white text-[#142437] shadow-xs'
                  : 'text-slate-600 hover:text-[#142437]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {!canMutate ? (
          <span className="text-xs text-slate-500">
            Read-only collector view · Lab & admin staff acknowledge/resolve alerts
          </span>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">
          No operational exceptions match this status filter.
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((exc) => (
            <Card
              key={exc.id}
              data-testid={`exception-card-${exc.rule_code}`}
              className="p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={exc.severity} />
                    <ExceptionStatusBadge status={exc.status} />
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-[#142437]">
                      {exc.rule_code}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-[#142437]">{exc.title}</h2>
                  <p className="text-xs text-slate-500 font-mono">
                    Detected: {formatDateTime(exc.detected_at)}
                  </p>
                </div>

                {exc.sample ? (
                  <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                    <Link
                      href={`/app/samples/${exc.sample.id}`}
                      className="font-mono text-sm font-bold text-[#0E9488] hover:underline"
                    >
                      {exc.sample.public_code} →
                    </Link>
                    <StatusBadge status={exc.sample.status} />
                  </div>
                ) : null}
              </div>

              {/* Non-PHI Evidence Summary */}
              {Object.keys(exc.details ?? {}).length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-[#F7FAFC] p-3.5 text-xs space-y-1">
                  <span className="font-bold text-slate-700 block">
                    Recorded Operational Context:
                  </span>
                  <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
                    {Object.entries(exc.details).map(([k, v]) => (
                      <div key={k} className="truncate">
                        <span className="font-mono text-[11px] text-slate-500">{k}: </span>
                        <span className="font-medium text-[#142437]">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Audit Trail of Prior Review Actions */}
              {exc.actions.length > 0 ? (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">
                    Exception Review Audit Log:
                  </span>
                  {exc.actions.map((act) => (
                    <div
                      key={act.id}
                      className="rounded-lg bg-slate-50 border border-slate-200/70 px-3 py-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                    >
                      <span>
                        <strong className="uppercase text-[#183B56]">{act.action}</strong> by{' '}
                        <strong>{act.actor_name}</strong>: {act.reason}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {formatDateTime(act.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Authorized Lab / Admin Actions */}
              {canMutate ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {exc.status === 'open' ? (
                    <Button
                      variant="amber"
                      size="sm"
                      data-testid={`ack-exception-${exc.id}`}
                      onClick={() => {
                        setReason('Investigating custody discrepancy with route courier and clinic.');
                        setModalState({ exception: exc, action: 'acknowledge' });
                      }}
                    >
                      Acknowledge & Investigate
                    </Button>
                  ) : null}

                  {exc.status !== 'resolved' ? (
                    <Button
                      variant="primary"
                      size="sm"
                      data-testid={`resolve-exception-${exc.id}`}
                      onClick={() => {
                        setReason('');
                        setModalState({ exception: exc, action: 'resolve' });
                      }}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Resolve with Rationale</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReason('');
                        setModalState({ exception: exc, action: 'reopen' });
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reopen Review</span>
                    </Button>
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={modalState !== null}
        onOpenChange={(open) => {
          if (!open) setModalState(null);
        }}
      >
        <DialogContent
          title={
            modalState
              ? `${modalState.action.charAt(0).toUpperCase() + modalState.action.slice(1)} Exception (${modalState.exception.rule_code})`
              : 'Review Exception'
          }
          description="Every exception action appends an attributed audit row in PostgreSQL."
        >
          <div className="space-y-4">
            <div>
              <FieldLabel htmlFor="exception-reason" required>
                Review Rationale (Minimum 4 characters)
              </FieldLabel>
              <Textarea
                id="exception-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Document findings, counterparty verification, or corrective operational step…"
              />
            </div>

            <div className="flex justify-end gap-2.5">
              <Button variant="outline" onClick={() => setModalState(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={submitting || reason.trim().length < 4}
                data-testid="confirm-exception-action"
                onClick={() => void submitAction()}
              >
                {submitting ? 'Saving audit log…' : 'Confirm & Record'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
