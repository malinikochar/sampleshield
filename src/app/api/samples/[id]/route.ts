import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return apiError('UNAUTHORIZED', 'Authentication required to inspect Sample Passport.');
  }

  const { id: rawIdentifier } = await context.params;
  const identifier = decodeURIComponent(rawIdentifier).trim();
  const supabase = await createClient();

  let sampleQuery = supabase
    .from('samples')
    .select(
      `
      id,
      organization_id,
      public_code,
      source_facility_id,
      destination_facility_id,
      specimen_type,
      case_alias,
      order_reference,
      status,
      custody_holder_user_id,
      disposition_reason,
      created_by,
      created_at,
      updated_at,
      is_demo,
      source_facility:facilities!samples_source_facility_fkey (
        id, name, code, facility_type, location_label
      ),
      destination_facility:facilities!samples_destination_facility_fkey (
        id, name, code, facility_type, location_label
      )
    `
    )
    .eq('organization_id', actor.organization.id);

  if (UUID_REGEX.test(identifier)) {
    sampleQuery = sampleQuery.eq('id', identifier);
  } else {
    sampleQuery = sampleQuery.eq('public_code', identifier.toUpperCase());
  }

  const { data: sample, error: sampleError } = await sampleQuery.maybeSingle();

  if (sampleError) {
    return apiError('SERVER_ERROR', 'Unable to load Sample Passport.');
  }

  if (!sample) {
    return apiError(
      'NOT_FOUND',
      'Sample was not found or your role is not authorized to view this specimen.'
    );
  }

  const [{ data: events }, { data: exceptions }, { data: assignments }] = await Promise.all([
    supabase
      .from('sample_events')
      .select('*')
      .eq('sample_id', sample.id)
      .order('server_recorded_at', { ascending: true }),
    supabase
      .from('exceptions')
      .select('*')
      .eq('sample_id', sample.id)
      .order('detected_at', { ascending: false }),
    supabase
      .from('sample_assignments')
      .select('*')
      .eq('sample_id', sample.id)
      .eq('is_active', true),
  ]);

  return NextResponse.json(
    {
      ok: true,
      data: {
        sample,
        events: events ?? [],
        exceptions: exceptions ?? [],
        assignments: assignments ?? [],
      },
    },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
  );
}
