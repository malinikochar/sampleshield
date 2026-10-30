import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  PlusCircle,
  QrCode,
  Sparkles,
  Truck,
} from 'lucide-react';
import { requireAuthenticatedPageActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/primitives';
import {
  ExceptionStatusBadge,
  RoleBadge,
  SeverityBadge,
  StatusBadge,
} from '@/components/domain/badges';
import { LocalSyncKpiCard } from '@/app/app/dashboard/local-sync-kpi-card';
import { EVENT_TYPE_LABELS, formatDateTime, formatRelativeMinutes } from '@/lib/utils';
import type {
  ExceptionSeverity,
  ExceptionStatus,
  MembershipRole,
  SampleEventType,
  SampleStatus,
} from '@/types/domain';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const actor = await requireAuthenticatedPageActor();
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: samples }, { data: recentEvents }, { data: openExceptions }] = await Promise.all([
    supabase
      .from('samples')
      .select(
        `
        id,
        public_code,
        specimen_type,
        case_alias,
        status,
        updated_at,
        is_demo,
        source_facility:facilities!samples_source_facility_fkey ( name, code ),
        destination_facility:facilities!samples_destination_facility_fkey ( name, code )
      `
      )
      .eq('organization_id', actor.organization.id)
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase
      .from('sample_events')
      .select(
        `
        id,
        sample_id,
        event_type,
        actor_name,
        actor_role,
        server_recorded_at,
        was_queued_offline,
        sample:samples!sample_events_sample_org_fkey ( id, public_code, specimen_type )
      `
      )
      .eq('organization_id', actor.organization.id)
      .order('server_recorded_at', { ascending: false })
      .limit(8),
    actor.membership.role !== 'courier'
      ? supabase
          .from('exceptions')
          .select(
            `
            id,
            sample_id,
            rule_code,
            severity,
            status,
            title,
            detected_at,
            sample:samples!exceptions_sample_org_fkey ( id, public_code, specimen_type )
          `
          )
          .eq('organization_id', actor.organization.id)
          .in('status', ['open', 'acknowledged'])
          .order('detected_at', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] }),
  ]);

  const sampleList = samples ?? [];
  const inTransitCount = sampleList.filter((s) => s.status === 'dispatched').length;
  const awaitingLabReviewCount = sampleList.filter((s) => s.status === 'received').length;
  const openExceptionCount = (openExceptions ?? []).filter((e) => e.status === 'open').length;

  const statusBreakdown: Array<{ status: SampleStatus; label: string; count: number }> = [
    { status: 'created', label: 'Created', count: sampleList.filter((s) => s.status === 'created').length },
    { status: 'collected', label: 'Collected', count: sampleList.filter((s) => s.status === 'collected').length },
    { status: 'dispatched', label: 'In Transit', count: inTransitCount },
    { status: 'received', label: 'At Lab Desk', count: awaitingLabReviewCount },
    { status: 'accepted', label: 'Accepted', count: sampleList.filter((s) => s.status === 'accepted').length },
    { status: 'rejected', label: 'Rejected', count: sampleList.filter((s) => s.status === 'rejected').length },
  ];

  const primaryCtaByRole: Record<
    MembershipRole,
    { title: string; subtitle: string; href: string; buttonLabel: string; Icon: typeof PlusCircle }
  > = {
    collector: {
      title: 'Register & Label Specimen',
      subtitle:
        'Create a new Sample Passport with a non-PII opaque QR code, confirm collection, and assign an authorized courier.',
      href: '/app/samples/new',
      buttonLabel: 'Create Sample Passport',
      Icon: PlusCircle,
    },
    courier: {
      title: 'Courier Custody & Offline Queue',
      subtitle:
        'Scan or confirm assigned specimen pickups and laboratory drop-offs—works online and queues safely when offline.',
      href: '/app/handovers',
      buttonLabel: 'Open Courier Queue',
      Icon: Truck,
    },
    lab: {
      title: 'Receiving Laboratory Desk',
      subtitle:
        'Verify inbound dispatches, inspect any transit exceptions, and record human-reviewed acceptance or rejection.',
      href: '/app/lab',
      buttonLabel: 'Open Lab Inbox',
      Icon: FlaskConical,
    },
    admin: {
      title: actor.organization.is_demo
        ? 'Judge Failure Simulation & Network Oversight'
        : 'Organization Operations & Exception Oversight',
      subtitle: actor.organization.is_demo
        ? 'Trigger deterministic wrong-destination, delayed-arrival, offline-courier, or duplicate-replay scenarios.'
        : 'Configure operational transit thresholds, manage facilities, and audit unresolved custody exceptions.',
      href: actor.organization.is_demo ? '/app/demo' : '/app/exceptions',
      buttonLabel: actor.organization.is_demo ? 'Open Failure Simulator' : 'Review Exceptions',
      Icon: actor.organization.is_demo ? Sparkles : AlertTriangle,
    },
  };

  const heroAction = primaryCtaByRole[actor.membership.role];

  return (
    <div className="space-y-6">
      {params.denied === 'role' ? (
        <div
          role="alert"
          className="rounded-xl border border-[#D85A56]/50 bg-[#FDF1F0] px-4 py-3 text-sm font-medium text-[#8A1F1C]"
        >
          Access restricted: your current role ({actor.membership.role}) is not authorized for that
          screen.
        </div>
      ) : null}

      {/* Top Welcome + Role-Specific Primary Action */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#142437]">
              Chain-of-Custody Operations
            </h1>
            <RoleBadge role={actor.membership.role} />
            {actor.organization.is_demo ? (
              <span className="rounded-md bg-slate-200/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                Synthetic Demo Dataset
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {actor.facility
              ? `${actor.facility.name} (${actor.facility.code})`
              : `${actor.organization.name} · Authorized operational view`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/app/scan"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#142437] hover:bg-slate-50"
          >
            <QrCode className="h-4 w-4 text-[#0E9488]" aria-hidden="true" />
            <span>Scan QR</span>
          </Link>
          <Link
            href={heroAction.href}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0E9488] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B7A70]"
          >
            <heroAction.Icon className="h-4 w-4" aria-hidden="true" />
            <span>{heroAction.buttonLabel}</span>
          </Link>
        </div>
      </div>

      {/* Hero KPI Band */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Samples In Transit
            </span>
            <Truck className="h-4 w-4 text-[#E8A23C]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-[#142437]">{inTransitCount}</p>
          <p className="mt-1 text-xs text-slate-600">
            Confirmed dispatched ·{' '}
            {actor.membership.role === 'courier' ? 'assigned to you' : 'across active routes'}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Awaiting Lab Review
            </span>
            <FlaskConical className="h-4 w-4 text-[#183B56]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-[#142437]">
            {awaitingLabReviewCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Received at lab · pending human disposition
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Open Exceptions
            </span>
            <AlertTriangle className="h-4 w-4 text-[#D85A56]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-[#142437]">
            {actor.membership.role === 'courier' ? '—' : openExceptionCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {actor.membership.role === 'courier'
              ? 'Reviewed by lab & clinic staff'
              : 'Unresolved operational discrepancies'}
          </p>
        </Card>

        <LocalSyncKpiCard
          organizationId={actor.organization.id}
          actorUserId={actor.userId}
          isDemoOrg={actor.organization.is_demo}
        />
      </div>

      {/* Role-Specific Primary Action Banner + Custody Pipeline */}
      <div className="grid lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5 p-6 bg-gradient-to-br from-[#142437] to-[#183B56] text-white border-none flex flex-col justify-between">
          <div>
            <span className="inline-block rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#5EEAD4]">
              Primary {actor.membership.role} workflow
            </span>
            <h2 className="mt-3 text-lg font-bold">{heroAction.title}</h2>
            <p className="mt-1.5 text-sm text-slate-200 leading-relaxed">{heroAction.subtitle}</p>
          </div>
          <div className="mt-5">
            <Link
              href={heroAction.href}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0E9488] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B7A70] transition-colors"
            >
              <span>{heroAction.buttonLabel}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Card>

        <Card className="lg:col-span-7 p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#142437]">
                Server-Confirmed Custody Pipeline
              </h2>
              <p className="text-xs text-slate-600">
                Live sample status counts from verified PostgreSQL records
              </p>
            </div>
            <Link
              href="/app/samples"
              className="text-xs font-semibold text-[#0E9488] hover:underline"
            >
              View all samples →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {statusBreakdown.map((item) => (
              <Link
                key={item.status}
                href={`/app/samples?status=${item.status}`}
                className="rounded-xl border border-slate-200/80 bg-[#F7FAFC] p-3.5 hover:border-[#0E9488]/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-[#142437]">{item.count}</span>
                </div>
                <div className="mt-2">
                  <StatusBadge status={item.status} />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom Split: Recent Custody Events & Active Exceptions */}
      <div className="grid lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[#142437]">Recent Custody Ledger Events</h2>
              <p className="text-xs text-slate-600">
                Confirmed handovers ordered by authoritative server receipt time
              </p>
            </div>
          </div>

          {(recentEvents ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No custody events recorded yet for your scope.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(recentEvents ?? []).map((evt) => {
                const sampleRef = Array.isArray(evt.sample) ? evt.sample[0] : evt.sample;
                return (
                  <div
                    key={evt.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CheckCircle2 className="h-4 w-4 text-[#0E9488]" aria-hidden="true" />
                        <span className="text-sm font-semibold text-[#142437]">
                          {EVENT_TYPE_LABELS[evt.event_type as SampleEventType]}
                        </span>
                        {sampleRef ? (
                          <Link
                            href={`/app/samples/${sampleRef.id}`}
                            className="font-mono text-xs font-bold text-[#0E9488] hover:underline"
                          >
                            {sampleRef.public_code}
                          </Link>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-600">
                        {evt.actor_name} ({evt.actor_role})
                        {evt.was_queued_offline ? ' · Synced from offline queue' : ''}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-slate-500 shrink-0">
                      {formatRelativeMinutes(evt.server_recorded_at)} ·{' '}
                      {formatDateTime(evt.server_recorded_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-5 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[#142437]">Operational Exception Queue</h2>
              <p className="text-xs text-slate-600">
                Discrepancies requiring human operational review
              </p>
            </div>
            {actor.membership.role !== 'courier' ? (
              <Link
                href="/app/exceptions"
                className="text-xs font-semibold text-[#0E9488] hover:underline"
              >
                Open Inbox →
              </Link>
            ) : null}
          </div>

          {actor.membership.role === 'courier' ? (
            <div className="rounded-xl bg-[#F7FAFC] border border-slate-200 p-4 text-xs text-slate-600">
              Operational exception triage is managed by receiving laboratory and clinic staff.
              Check <Link href="/app/handovers" className="font-semibold text-[#0E9488] underline">Courier Handovers</Link> for any local sync conflicts.
            </div>
          ) : (openExceptions ?? []).length === 0 ? (
            <div className="rounded-xl bg-[#E5F7F3]/50 border border-[#0E9488]/30 p-5 text-center text-xs text-[#0B5D56]">
              No open operational exceptions across authorized facilities.
            </div>
          ) : (
            <div className="space-y-3">
              {(openExceptions ?? []).map((exc) => {
                const sampleRef = Array.isArray(exc.sample) ? exc.sample[0] : exc.sample;
                return (
                  <div
                    key={exc.id}
                    className="rounded-xl border border-slate-200 bg-[#F7FAFC] p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <SeverityBadge severity={exc.severity as ExceptionSeverity} />
                      <ExceptionStatusBadge status={exc.status as ExceptionStatus} />
                    </div>
                    <p className="text-xs font-bold text-[#142437]">{exc.title}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span className="font-mono font-semibold text-slate-700">
                        {exc.rule_code}
                      </span>
                      {sampleRef ? (
                        <Link
                          href={`/app/samples/${sampleRef.id}`}
                          className="font-mono font-bold text-[#0E9488] hover:underline"
                        >
                          {sampleRef.public_code} →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
