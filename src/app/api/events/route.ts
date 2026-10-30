import { type NextRequest } from 'next/server';
import { getAuthenticatedActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { submitCustodyEventSchema } from '@/lib/validation/schemas';
import { apiError, apiFromRpc } from '@/lib/api-response';
import type { RpcMutationResult } from '@/types/domain';

export async function POST(request: NextRequest) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return apiError(
      'UNAUTHORIZED',
      'Session expired or not authenticated. Sign in to confirm custody events.'
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = submitCustodyEventSchema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return apiError(
      'BAD_REQUEST',
      firstIssue?.message ?? 'Invalid custody event submission.',
      { issues: parsed.error.issues }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_custody_event', {
    p_client_event_id: parsed.data.client_event_id,
    p_sample_public_code: parsed.data.sample_public_code,
    p_event_type: parsed.data.event_type,
    p_client_occurred_at: parsed.data.client_occurred_at ?? new Date().toISOString(),
    p_was_queued_offline: parsed.data.was_queued_offline ?? false,
    p_metadata: parsed.data.metadata ?? {},
  });

  if (error) {
    return apiError('SERVER_ERROR', error.message || 'Custody event submission failed.');
  }

  return apiFromRpc(data as RpcMutationResult, 'Custody event submission failed.');
}
