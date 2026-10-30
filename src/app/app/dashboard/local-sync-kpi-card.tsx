'use client';

import Link from 'next/link';
import { CloudOff, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { useNetworkAndOfflineQueue } from '@/lib/offline/hooks';

export function LocalSyncKpiCard({
  organizationId,
  actorUserId,
  isDemoOrg,
}: {
  organizationId: string;
  actorUserId: string;
  isDemoOrg: boolean;
}) {
  const { pendingOnDeviceCount, conflictCount } = useNetworkAndOfflineQueue({
    organizationId,
    actorUserId,
    isDemoOrg,
  });

  const totalAttention = pendingOnDeviceCount + conflictCount;

  return (
    <Card
      className={
        totalAttention > 0
          ? 'p-5 border-2 border-dashed border-[#D97706] bg-amber-50/40'
          : 'p-5'
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Pending Device Sync
        </span>
        {totalAttention > 0 ? (
          <CloudOff className="h-4 w-4 text-[#D97706]" aria-hidden="true" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-[#0E9488]" aria-hidden="true" />
        )}
      </div>
      <p
        data-testid="kpi-pending-device-sync"
        className="mt-2 font-mono text-3xl font-extrabold text-[#142437]"
      >
        {pendingOnDeviceCount}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {conflictCount > 0 ? (
          <Link href="/app/handovers" className="font-semibold text-[#8A1F1C] underline">
            {conflictCount} conflict(s) need review on this device
          </Link>
        ) : pendingOnDeviceCount > 0 ? (
          <Link href="/app/handovers" className="font-semibold text-[#78350F] underline">
            Local queue only · excluded from server totals
          </Link>
        ) : (
          '0 local items · all device actions synced'
        )}
      </p>
    </Card>
  );
}
