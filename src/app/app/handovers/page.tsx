import { requireAuthenticatedPageActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { HandoversClient } from '@/app/app/handovers/handovers-client';
import type { CachedCourierAssignment, SampleStatus } from '@/types/domain';

export default async function HandoversPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const actor = await requireAuthenticatedPageActor(['courier', 'collector', 'admin']);
  const params = await searchParams;
  const supabase = await createClient();

  const { data: dispatchedSamples } = await supabase
    .from('samples')
    .select(
      `
      id,
      organization_id,
      public_code,
      specimen_type,
      status,
      destination_facility_id,
      is_demo,
      source_facility:facilities!samples_source_facility_fkey ( name, code ),
      destination_facility:facilities!samples_destination_facility_fkey ( name, code )
    `
    )
    .eq('organization_id', actor.organization.id)
    .eq('status', 'dispatched')
    .order('updated_at', { ascending: false });

  const sampleIds = (dispatchedSamples ?? []).map((s) => s.id);
  const { data: custodyEvents } =
    sampleIds.length > 0
      ? await supabase
          .from('sample_events')
          .select('sample_id, event_type')
          .in('sample_id', sampleIds)
          .in('event_type', ['courier_pickup', 'courier_dropoff'])
      : { data: [] };

  const pickupSet = new Set(
    (custodyEvents ?? [])
      .filter((e) => e.event_type === 'courier_pickup')
      .map((e) => e.sample_id)
  );
  const dropoffSet = new Set(
    (custodyEvents ?? [])
      .filter((e) => e.event_type === 'courier_dropoff')
      .map((e) => e.sample_id)
  );

  const serverAssignments: CachedCourierAssignment[] = (dispatchedSamples ?? []).map((s) => {
    const src = Array.isArray(s.source_facility) ? s.source_facility[0] : s.source_facility;
    const dst = Array.isArray(s.destination_facility)
      ? s.destination_facility[0]
      : s.destination_facility;

    return {
      sample_id: s.id,
      organization_id: s.organization_id,
      courier_user_id: actor.userId,
      public_code: s.public_code,
      specimen_type: s.specimen_type,
      source_facility_name: src?.name ?? 'Clinic',
      source_facility_code: src?.code ?? 'CLINIC',
      destination_facility_id: s.destination_facility_id,
      destination_facility_name: dst?.name ?? 'Laboratory',
      destination_facility_code: dst?.code ?? 'LAB',
      last_known_status: s.status as SampleStatus,
      has_courier_pickup: pickupSet.has(s.id),
      has_courier_dropoff: dropoffSet.has(s.id),
      is_demo: Boolean(s.is_demo),
      cached_at: new Date().toISOString(),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#142437]">
          Courier Custody Queue & Offline Sync
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Capture specimen pickups and laboratory drop-offs reliably across intermittent networks.
        </p>
      </div>

      <HandoversClient
        organizationId={actor.organization.id}
        actorUserId={actor.userId}
        actorRole={actor.membership.role}
        isDemoOrg={actor.organization.is_demo}
        serverAssignments={serverAssignments}
        highlightCode={params.code?.trim().toUpperCase()}
      />
    </div>
  );
}
