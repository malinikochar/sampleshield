import { requireAuthenticatedPageActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { LabDeskClient, type LabSampleItem } from '@/app/app/lab/lab-desk-client';
import type { ExceptionSeverity, SampleStatus } from '@/types/domain';

export default async function ReceivingLabPage() {
  const actor = await requireAuthenticatedPageActor(['lab', 'admin']);
  const supabase = await createClient();

  const [{ data: samples }, { data: exceptions }] = await Promise.all([
    supabase
      .from('samples')
      .select(
        `
        id,
        public_code,
        specimen_type,
        case_alias,
        order_reference,
        status,
        destination_facility_id,
        updated_at,
        source_facility:facilities!samples_source_facility_fkey ( name, code ),
        destination_facility:facilities!samples_destination_facility_fkey ( name, code )
      `
      )
      .eq('organization_id', actor.organization.id)
      .in('status', ['dispatched', 'received'])
      .order('updated_at', { ascending: false }),
    supabase
      .from('exceptions')
      .select('id, sample_id, rule_code, severity, status, title')
      .eq('organization_id', actor.organization.id)
      .in('status', ['open', 'acknowledged']),
  ]);

  const excBySample = new Map<
    string,
    Array<{
      id: string;
      rule_code: string;
      severity: ExceptionSeverity;
      status: string;
      title: string;
    }>
  >();

  for (const exc of exceptions ?? []) {
    const arr = excBySample.get(exc.sample_id) ?? [];
    arr.push({
      id: exc.id,
      rule_code: exc.rule_code,
      severity: exc.severity as ExceptionSeverity,
      status: exc.status,
      title: exc.title,
    });
    excBySample.set(exc.sample_id, arr);
  }

  const mapped: LabSampleItem[] = (samples ?? []).map((s) => {
    const src = Array.isArray(s.source_facility) ? s.source_facility[0] : s.source_facility;
    const dst = Array.isArray(s.destination_facility)
      ? s.destination_facility[0]
      : s.destination_facility;

    return {
      id: s.id,
      public_code: s.public_code,
      specimen_type: s.specimen_type,
      case_alias: s.case_alias,
      order_reference: s.order_reference,
      status: s.status as SampleStatus,
      destination_facility_id: s.destination_facility_id,
      source_name: src?.name ?? 'Clinic',
      source_code: src?.code ?? 'CLINIC',
      destination_name: dst?.name ?? 'Lab',
      destination_code: dst?.code ?? 'LAB',
      updated_at: s.updated_at,
      exceptions: excBySample.get(s.id) ?? [],
    };
  });

  const receivedSamples = mapped.filter(
    (s) =>
      s.status === 'received' &&
      (actor.membership.role === 'admin' ||
        !actor.facility ||
        s.destination_facility_id === actor.facility.id)
  );
  const inboundSamples = mapped.filter((s) => s.status === 'dispatched');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#142437]">
          Receiving Laboratory Desk
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Verify inbound specimen arrivals, inspect custody alerts, and record documented human
          disposition.
        </p>
      </div>

      <LabDeskClient
        inboundSamples={inboundSamples}
        receivedSamples={receivedSamples}
        actorFacilityId={actor.facility?.id ?? null}
        actorFacilityName={actor.facility?.name ?? null}
        isAdmin={actor.membership.role === 'admin'}
      />
    </div>
  );
}
