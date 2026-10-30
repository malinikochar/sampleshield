import { requireAuthenticatedPageActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  ExceptionsClient,
  type ExceptionInboxItem,
} from '@/app/app/exceptions/exceptions-client';
import type {
  ExceptionActionRecord,
  ExceptionSeverity,
  ExceptionStatus,
  SampleStatus,
} from '@/types/domain';

export default async function ExceptionsPage() {
  const actor = await requireAuthenticatedPageActor(['collector', 'lab', 'admin']);
  const supabase = await createClient();

  const { data } = await supabase
    .from('exceptions')
    .select(
      `
      id,
      sample_id,
      rule_code,
      severity,
      status,
      title,
      details,
      detected_at,
      resolution_reason,
      sample:samples!exceptions_sample_org_fkey (
        id, public_code, specimen_type, status
      ),
      actions:exception_actions (
        id, organization_id, exception_id, actor_user_id, actor_name, action, reason, created_at
      )
    `
    )
    .eq('organization_id', actor.organization.id)
    .order('detected_at', { ascending: false })
    .limit(100);

  const items: ExceptionInboxItem[] = (data ?? []).map((row) => {
    const sampleRef = Array.isArray(row.sample) ? row.sample[0] : row.sample;
    const actionList = ((row.actions ?? []) as ExceptionActionRecord[]).sort(
      (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
    );

    return {
      id: row.id,
      sample_id: row.sample_id,
      rule_code: row.rule_code,
      severity: row.severity as ExceptionSeverity,
      status: row.status as ExceptionStatus,
      title: row.title,
      details: (row.details ?? {}) as Record<string, unknown>,
      detected_at: row.detected_at,
      resolution_reason: row.resolution_reason,
      sample: sampleRef
        ? {
            id: sampleRef.id,
            public_code: sampleRef.public_code,
            specimen_type: sampleRef.specimen_type,
            status: sampleRef.status as SampleStatus,
          }
        : null,
      actions: actionList,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#142437]">
          Operational Exception Inbox
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Deterministic custody alerts for destination mismatches, transit SLA delays, handover
          gaps, and offline conflicts.
        </p>
      </div>

      <ExceptionsClient
        items={items}
        canMutate={actor.membership.role === 'lab' || actor.membership.role === 'admin'}
      />
    </div>
  );
}
