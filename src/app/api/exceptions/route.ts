import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return apiError('UNAUTHORIZED', 'Authentication required to inspect exceptions.');
  }

  if (actor.membership.role === 'courier') {
    return apiError('FORBIDDEN', 'Exception review inbox is restricted to clinic, laboratory, and admin staff.');
  }

  const statusFilter = request.nextUrl.searchParams.get('status');
  const supabase = await createClient();

  let query = supabase
    .from('exceptions')
    .select(
      `
      *,
      sample:samples!exceptions_sample_org_fkey (
        id,
        public_code,
        specimen_type,
        status,
        is_demo,
        source_facility_id,
        destination_facility_id
      ),
      actions:exception_actions (
        id,
        actor_user_id,
        actor_name,
        action,
        reason,
        created_at
      )
    `
    )
    .eq('organization_id', actor.organization.id)
    .order('detected_at', { ascending: false })
    .limit(100);

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    return apiError('SERVER_ERROR', 'Unable to fetch operational exceptions.');
  }

  return NextResponse.json(
    { ok: true, data: data ?? [] },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
  );
}
