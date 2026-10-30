import { requireAuthenticatedPageActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { computeOperationalAnalytics } from '@/lib/rules/analytics';
import { AnalyticsClient } from '@/app/app/analytics/analytics-client';
import type { ExceptionRecord, SampleEventRecord, SampleRecord } from '@/types/domain';

export default async function AnalyticsPage() {
  const actor = await requireAuthenticatedPageActor(['lab', 'admin']);
  const supabase = await createClient();

  const [{ data: samples }, { data: events }, { data: exceptions }] = await Promise.all([
    supabase
      .from('samples')
      .select('id, status')
      .eq('organization_id', actor.organization.id),
    supabase
      .from('sample_events')
      .select('sample_id, event_type, client_occurred_at, server_recorded_at, was_queued_offline')
      .eq('organization_id', actor.organization.id),
    supabase
      .from('exceptions')
      .select('sample_id, rule_code, status')
      .eq('organization_id', actor.organization.id),
  ]);

  const summary = computeOperationalAnalytics({
    samples: (samples ?? []) as Pick<SampleRecord, 'id' | 'status'>[],
    events: (events ?? []) as Pick<
      SampleEventRecord,
      'sample_id' | 'event_type' | 'client_occurred_at' | 'server_recorded_at' | 'was_queued_offline'
    >[],
    exceptions: (exceptions ?? []) as Pick<ExceptionRecord, 'sample_id' | 'rule_code' | 'status'>[],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#142437]">
          Verified Operational Analytics
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Tenant-scoped metrics computed strictly from server-confirmed custody events.
        </p>
      </div>

      <AnalyticsClient
        summary={summary}
        isDemoOrg={actor.organization.is_demo}
        organizationName={actor.organization.name}
      />
    </div>
  );
}
