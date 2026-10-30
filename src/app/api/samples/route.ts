import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createSampleSchema } from '@/lib/validation/schemas';
import { apiError, apiFromRpc } from '@/lib/api-response';
import type { RpcMutationResult } from '@/types/domain';

export async function GET(request: NextRequest) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return apiError('UNAUTHORIZED', 'Sign in with an active organization membership to view samples.');
  }

  const supabase = await createClient();
  const statusFilter = request.nextUrl.searchParams.get('status');
  const queryText = request.nextUrl.searchParams.get('q')?.trim().toUpperCase();

  let query = supabase
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
    .eq('organization_id', actor.organization.id)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  if (queryText) {
    query = query.or(
      `public_code.ilike.%${queryText}%,case_alias.ilike.%${queryText}%,order_reference.ilike.%${queryText}%`
    );
  }

  const { data: samples, error } = await query;

  if (error) {
    return apiError('SERVER_ERROR', 'Unable to load authorized samples.');
  }

  return NextResponse.json(
    { ok: true, data: samples ?? [] },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
  );
}

export async function POST(request: NextRequest) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return apiError('UNAUTHORIZED', 'Sign in required to create a sample.');
  }

  if (actor.membership.role !== 'collector' && actor.membership.role !== 'admin') {
    return apiError(
      'FORBIDDEN',
      'Only authorized clinic collectors or administrators may register new samples.'
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createSampleSchema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return apiError(
      'BAD_REQUEST',
      firstIssue?.message ?? 'Invalid sample registration input.',
      { issues: parsed.error.issues }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_sample_atomic', {
    p_source_facility_id: parsed.data.source_facility_id,
    p_destination_facility_id: parsed.data.destination_facility_id,
    p_specimen_type: parsed.data.specimen_type,
    p_case_alias: parsed.data.case_alias || null,
    p_order_reference: parsed.data.order_reference || null,
    p_collect_immediately: parsed.data.collect_immediately ?? false,
    p_client_event_id: crypto.randomUUID(),
  });

  if (error) {
    return apiError('SERVER_ERROR', error.message || 'Failed to register sample.');
  }

  return apiFromRpc(data as RpcMutationResult, 'Sample registration failed.');
}
