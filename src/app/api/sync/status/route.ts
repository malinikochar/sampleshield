import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return apiError('UNAUTHORIZED', 'Authentication required to verify sync status.');
  }

  const rawParam = request.nextUrl.searchParams.get('event_ids') ?? '';
  const eventIds = rawParam
    .split(',')
    .map((s) => s.trim())
    .filter((id) => UUID_REGEX.test(id))
    .slice(0, 50);

  if (eventIds.length === 0) {
    return NextResponse.json(
      { ok: true, data: { confirmed: [], rejected: [] } },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
    );
  }

  const supabase = await createClient();

  const [{ data: confirmed }, { data: rejected }] = await Promise.all([
    supabase
      .from('sample_events')
      .select('id, client_event_id, sample_id, event_type, server_recorded_at, resulting_status')
      .eq('organization_id', actor.organization.id)
      .in('client_event_id', eventIds),
    supabase
      .from('rejected_event_attempts')
      .select('id, client_event_id, attempted_event_type, error_code, reason, created_at')
      .eq('organization_id', actor.organization.id)
      .in('client_event_id', eventIds),
  ]);

  return NextResponse.json(
    {
      ok: true,
      data: {
        confirmed: confirmed ?? [],
        rejected: rejected ?? [],
      },
    },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
  );
}
