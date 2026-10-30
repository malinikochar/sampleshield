import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudOff,
  FileCheck2,
  FlaskConical,
  Info,
  Loader2,
  PackageCheck,
  ShieldAlert,
  ShieldCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  ExceptionSeverity,
  ExceptionStatus,
  LocalSyncState,
  MembershipRole,
  SampleStatus,
} from '@/types/domain';

export function StatusBadge({
  status,
  className,
}: {
  status: SampleStatus;
  className?: string;
}) {
  const config: Record<
    SampleStatus,
    { label: string; classes: string; Icon: typeof CheckCircle2 }
  > = {
    created: {
      label: 'Created',
      classes: 'bg-slate-100 text-slate-800 border-slate-300',
      Icon: FileCheck2,
    },
    collected: {
      label: 'Collected at Clinic',
      classes: 'bg-sky-50 text-sky-900 border-sky-200',
      Icon: PackageCheck,
    },
    dispatched: {
      label: 'In Transit',
      classes: 'bg-[#FEF6E7] text-[#7C4A0A] border-[#E8A23C]/50',
      Icon: Truck,
    },
    received: {
      label: 'At Lab Desk (Review)',
      classes: 'bg-indigo-50 text-indigo-900 border-indigo-200',
      Icon: FlaskConical,
    },
    accepted: {
      label: 'Accepted by Lab',
      classes: 'bg-[#E5F7F3] text-[#0B5D56] border-[#0E9488]/40',
      Icon: CheckCircle2,
    },
    rejected: {
      label: 'Rejected by Lab',
      classes: 'bg-[#FDF1F0] text-[#8A1F1C] border-[#D85A56]/50',
      Icon: XCircle,
    },
  };

  const { label, classes, Icon } = config[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-tight',
        classes,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

/**
 * Explicitly distinguishes unconfirmed device-queued events from server-confirmed events.
 * Dashed border + caution icon ensures `Pending on this device` never mimics `Confirmed by server`.
 */
export function SyncBadge({
  state,
  className,
}: {
  state: LocalSyncState;
  className?: string;
}) {
  const config: Record<
    LocalSyncState,
    { label: string; classes: string; Icon: typeof ShieldCheck; spin?: boolean }
  > = {
    queued: {
      label: 'Pending on this device',
      classes: 'border-dashed border-2 border-[#D97706] bg-amber-50 text-[#78350F]',
      Icon: CloudOff,
    },
    syncing: {
      label: 'Syncing with server…',
      classes: 'border-dashed border-2 border-sky-500 bg-sky-50 text-sky-900',
      Icon: Loader2,
      spin: true,
    },
    synced: {
      label: 'Confirmed by server',
      classes: 'border border-[#0E9488]/40 bg-[#E5F7F3] text-[#0B5D56]',
      Icon: ShieldCheck,
    },
    conflict: {
      label: 'Needs review (Conflict)',
      classes: 'border-2 border-[#D85A56] bg-[#FDF1F0] text-[#8A1F1C]',
      Icon: AlertOctagon,
    },
    failed_retriable: {
      label: 'Saved on device · Retry pending',
      classes: 'border-dashed border-2 border-[#D97706] bg-amber-50 text-[#78350F]',
      Icon: Clock,
    },
  };

  const { label, classes, Icon, spin } = config[state];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        classes,
        className
      )}
    >
      <Icon
        className={cn('h-3.5 w-3.5 shrink-0', spin && 'animate-spin')}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: ExceptionSeverity }) {
  const map: Record<
    ExceptionSeverity,
    { label: string; classes: string; Icon: typeof AlertTriangle }
  > = {
    blocker: {
      label: 'Blocker',
      classes: 'bg-[#FDF1F0] text-[#8A1F1C] border-[#D85A56]/60',
      Icon: AlertOctagon,
    },
    high: {
      label: 'High Severity',
      classes: 'bg-[#FDF1F0] text-[#8A1F1C] border-[#D85A56]/50',
      Icon: ShieldAlert,
    },
    medium: {
      label: 'Operational Review',
      classes: 'bg-[#FEF6E7] text-[#7C4A0A] border-[#E8A23C]/60',
      Icon: AlertTriangle,
    },
    info: {
      label: 'Informational',
      classes: 'bg-slate-100 text-slate-700 border-slate-300',
      Icon: Info,
    },
  };

  const { label, classes, Icon } = map[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        classes
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function ExceptionStatusBadge({ status }: { status: ExceptionStatus }) {
  const map: Record<ExceptionStatus, { label: string; classes: string }> = {
    open: {
      label: 'Open · Action Required',
      classes: 'bg-[#FDF1F0] text-[#8A1F1C] border-[#D85A56]/40',
    },
    acknowledged: {
      label: 'Acknowledged · Under Review',
      classes: 'bg-[#FEF6E7] text-[#7C4A0A] border-[#E8A23C]/50',
    },
    resolved: {
      label: 'Resolved & Audited',
      classes: 'bg-[#E5F7F3] text-[#0B5D56] border-[#0E9488]/40',
    },
  };

  const { label, classes } = map[status];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', classes)}>
      {label}
    </span>
  );
}

export function RoleBadge({ role }: { role: MembershipRole }) {
  const labels: Record<MembershipRole, string> = {
    collector: 'Clinic Collector',
    courier: 'Transport Courier',
    lab: 'Laboratory Staff',
    admin: 'Operations Admin',
  };
  return (
    <span className="inline-flex items-center rounded-md bg-[#183B56]/10 px-2 py-0.5 text-xs font-semibold text-[#183B56]">
      {labels[role]}
    </span>
  );
}

export function DemoDatasetBanner({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null;
  return (
    <div
      role="status"
      data-testid="demo-dataset-banner"
      aria-label="Synthetic demonstration dataset notice"
      className="no-print bg-[#142437] text-slate-100 px-4 py-1.5 text-xs font-medium flex flex-wrap items-center justify-between gap-2 border-b border-slate-700"
    >
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[#0E9488]" aria-hidden="true" />
        <span className="font-mono font-semibold tracking-wider text-[#5EEAD4]">
          DEMO DATA — NOT REAL PATIENT RECORDS
        </span>
      </div>
      <span className="text-slate-300">
        Operational custody prototype · Laboratory staff retain sole specimen acceptability authority
      </span>
    </div>
  );
}
