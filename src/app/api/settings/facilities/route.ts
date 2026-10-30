import { type NextRequest } from 'next/server';
import { getAuthenticatedActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createFacilitySchema } from '@/lib/validation/schemas';
import { apiError, apiFromRpc } from '@/lib/api-response';
import type { RpcMutationResult } from '@/types/domain';

export async function POST(request: NextRequest) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return apiError('UNAUTHORIZED', 'Authentication required.');
  }

  if (actor.membership.role !== 'admin') {
    return apiError('FORBIDDEN', 'Only organization administrators may create facilities.');
  }

  const body = await request.json().catch(() => null);
  const parsed = createFacilitySchema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return apiError('BAD_REQUEST', firstIssue?.message ?? 'Invalid facility details.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_org_facility', {
    p_name: parsed.data.name,
    p_code: parsed.data.code,
    p_facility_type: parsed.data.facility_type,
    p_location_label: parsed.data.location_label || null,
  });

  if (error) {
    return apiError('SERVER_ERROR', error.message || 'Failed to add facility.');
  }

  return apiFromRpc(data as RpcMutationResult, 'Failed to add facility.');
}
