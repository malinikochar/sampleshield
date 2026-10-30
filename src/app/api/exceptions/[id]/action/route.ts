import { type NextRequest } from 'next/server';
import { getAuthenticatedActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { exceptionActionSchema } from '@/lib/validation/schemas';
import { apiError, apiFromRpc } from '@/lib/api-response';
import type { RpcMutationResult } from '@/types/domain';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return apiError('UNAUTHORIZED', 'Authentication required.');
  }

  if (actor.membership.role !== 'lab' && actor.membership.role !== 'admin') {
    return apiError(
      'FORBIDDEN',
      'Only authorized laboratory staff or administrators may acknowledge or resolve exceptions.'
    );
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = exceptionActionSchema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return apiError(
      'BAD_REQUEST',
      firstIssue?.message ?? 'Invalid exception review action.',
      { issues: parsed.error.issues }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('act_on_exception', {
    p_exception_id: id,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return apiError('SERVER_ERROR', error.message || 'Failed to record exception action.');
  }

  return apiFromRpc(data as RpcMutationResult, 'Failed to record exception action.');
}
