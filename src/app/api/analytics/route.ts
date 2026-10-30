import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { computeOperationalAnalytics } from '@/lib/rules/analytics';
import { apiError } from '@/lib/api-response';
import type { ExceptionRecord, SampleEventRecord, SampleRecord } from '@/types/domain';

export async function GET(request: NextRequest) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return apiError('UNAUTHORIZED', 'Authentication required to view operational analytics.');
  }

  if (actor.membership.role !== 'admin' && actor.membership.role !== 'lab') {
    return apiError(
      'FORBIDDEN',
      'Operational analytics aggregates are restricted to laboratory and organization admin roles.'
    );
  }

  const supabase = await createClient();

  const [{ data: samples, error: sErr }, { data: events, error: eErr }, { data: exceptions, error: xErr }] =
    await Promise.all([
      supabase
        .from('samples')
        .select('id, status, is_demo, created_at')
        .eq('organization_id', actor.organization.id),
      supabase
        .from('sample_events')
        .select('sample_id, event_type, client_occurred_at, server_recorded_at, was_queued_offline')
        .eq('organization_id', actor.organization.id),
      supabase
        .from('exceptions')
        .select('sample_id, rule_code, status, severity, detected_at')
        .eq('organization_id', actor.organization.id),
    ]);

  if (sErr || eErr || xErr) {
    return apiError('SERVER_ERROR', 'Unable to compute tenant operational aggregates.');
  }

  const summary = computeOperationalAnalytics({
    samples: (samples ?? []) as Pick<SampleRecord, 'id' | 'status'>[],
    events: (events ?? []) as Pick<
      SampleEventRecord,
      'sample_id' | 'event_type' | 'client_occurred_at' | 'server_recorded_at' | 'was_queued_offline'
    >[],
    exceptions: (exceptions ?? []) as Pick<ExceptionRecord, 'sample_id' | 'rule_code' | 'status'>[],
  });

  if (request.nextUrl.searchParams.get('format') === 'csv') {
    const rows = [
      ['metric', 'value', 'organization_name', 'is_synthetic_demo_data', 'generated_at_utc'],
      ['total_confirmed_samples', String(summary.totalSamples), actor.organization.name, String(actor.organization.is_demo), new Date().toISOString()],
      ['in_transit_samples', String(summary.inTransitCount), actor.organization.name, String(actor.organization.is_demo), new Date().toISOString()],
      ['awaiting_lab_disposition', String(summary.awaitingLabDispositionCount), actor.organization.name, String(actor.organization.is_demo), new Date().toISOString()],
      ['accepted_samples', String(summary.acceptedCount), actor.organization.name, String(actor.organization.is_demo), new Date().toISOString()],
      ['rejected_samples', String(summary.rejectedCount), actor.organization.name, String(actor.organization.is_demo), new Date().toISOString()],
      ['open_exceptions', String(summary.openExceptionsCount), actor.organization.name, String(actor.organization.is_demo), new Date().toISOString()],
      ['median_transit_minutes', summary.medianTransitMinutes === null ? 'N/A' : String(summary.medianTransitMinutes), actor.organization.name, String(actor.organization.is_demo), new Date().toISOString()],
      ['exception_rate_percent', summary.exceptionRatePercent === null ? 'N/A' : String(summary.exceptionRatePercent), actor.organization.name, String(actor.organization.is_demo), new Date().toISOString()],
      ['offline_synced_events', String(summary.offlineSyncedEventsCount), actor.organization.name, String(actor.organization.is_demo), new Date().toISOString()],
    ];

    const csv = rows
      .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sampleshield-aggregates-${actor.organization.slug}.csv"`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        organization: {
          id: actor.organization.id,
          name: actor.organization.name,
          is_demo: actor.organization.is_demo,
        },
        summary,
      },
    },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
  );
}
