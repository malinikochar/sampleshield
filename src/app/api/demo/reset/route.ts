import { type NextRequest } from 'next/server';
import { getAuthenticatedActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { demoScenarioSchema } from '@/lib/validation/schemas';
import { apiError, apiFromRpc } from '@/lib/api-response';
import type { RpcMutationResult } from '@/types/domain';

export async function POST(request: NextRequest) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return apiError('UNAUTHORIZED', 'Authentication required.');
  }

  if (actor.membership.role !== 'admin') {
    return apiError('FORBIDDEN', 'Only demo organization administrators may run demo controls.');
  }

  if (!actor.organization.is_demo) {
    return apiError(
      'FORBIDDEN',
      'Demo scenarios and synthetic resets are permanently disabled for non-demo organizations.'
    );
  }

  const body = await request.json().catch(() => ({ scenario: 'reset_clean' }));
  const parsed = demoScenarioSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'Select a valid synthetic demo scenario.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('trigger_demo_scenario', {
    p_scenario: parsed.data.scenario,
  });

  if (error) {
    return apiError('SERVER_ERROR', error.message || 'Demo scenario failed.');
  }

  return apiFromRpc(data as RpcMutationResult, 'Demo scenario failed.');
}
