import { type NextRequest } from 'next/server';
import { getAuthenticatedActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { facilityPolicySchema } from '@/lib/validation/schemas';
import { apiError, apiFromRpc } from '@/lib/api-response';
import type { RpcMutationResult } from '@/types/domain';

export async function POST(request: NextRequest) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return apiError('UNAUTHORIZED', 'Authentication required.');
  }

  if (actor.membership.role !== 'admin') {
    return apiError('FORBIDDEN', 'Only organization administrators may update operational policies.');
  }

  const body = await request.json().catch(() => null);
  const parsed = facilityPolicySchema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return apiError('BAD_REQUEST', firstIssue?.message ?? 'Invalid policy configuration.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('upsert_facility_policy', {
    p_facility_id: parsed.data.facility_id,
    p_policy_name: parsed.data.policy_name,
    p_operational_delay_minutes: parsed.data.operational_delay_minutes,
    p_require_courier_pickup_before_receipt: parsed.data.require_courier_pickup_before_receipt,
  });

  if (error) {
    return apiError('SERVER_ERROR', error.message || 'Failed to update policy.');
  }

  return apiFromRpc(data as RpcMutationResult, 'Failed to update policy.');
}
