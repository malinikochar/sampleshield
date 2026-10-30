import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { requireAuthenticatedPageActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/primitives';
import { SamplePassportClient } from '@/app/app/samples/[id]/sample-passport-client';
import type {
  ExceptionRecord,
  Facility,
  Membership,
  SampleEventRecord,
  SampleRecord,
} from '@/types/domain';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SampleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAuthenticatedPageActor();
  const { id: rawIdentifier } = await params;
  const identifier = decodeURIComponent(rawIdentifier).trim();
  const supabase = await createClient();

  let sampleQuery = supabase
    .from('samples')
    .select(
      `
      *,
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

  const { data: sampleRow } = await sampleQuery.maybeSingle();

  if (!sampleRow) {
    return (
      <div className="max-w-xl mx-auto py-12 space-y-4">
        <Card className="p-8 text-center space-y-3 border-[#D85A56]/40">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDF1F0] text-[#8A1F1C]">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-[#142437]">
            Specimen Not Found or Unauthorized
          </h1>
          <p className="text-sm text-slate-600">
            Identifier <code className="font-mono font-semibold">{identifier}</code> either does not
            exist in your organization or is outside your assigned role scope.
          </p>
          <div className="pt-2">
            <Link
              href="/app/samples"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#183B56] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#142437]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Authorized Samples</span>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const [{ data: events }, { data: exceptions }, { data: couriers }, { data: assignmentRow }] =
    await Promise.all([
      supabase
        .from('sample_events')
        .select('*')
        .eq('sample_id', sampleRow.id)
        .order('server_recorded_at', { ascending: true }),
      actor.membership.role !== 'courier'
        ? supabase
            .from('exceptions')
            .select('*')
            .eq('sample_id', sampleRow.id)
            .order('detected_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      actor.membership.role === 'collector' || actor.membership.role === 'admin'
        ? supabase
            .from('memberships')
            .select('user_id, display_name, email')
            .eq('organization_id', actor.organization.id)
            .eq('role', 'courier')
            .eq('is_active', true)
            .order('display_name', { ascending: true })
        : Promise.resolve({ data: [] }),
      supabase
        .from('sample_assignments')
        .select('id')
        .eq('sample_id', sampleRow.id)
        .eq('courier_user_id', actor.userId)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

  const src = Array.isArray(sampleRow.source_facility)
    ? sampleRow.source_facility[0]
    : sampleRow.source_facility;
  const dst = Array.isArray(sampleRow.destination_facility)
    ? sampleRow.destination_facility[0]
    : sampleRow.destination_facility;

  return (
    <div className="space-y-4">
      <div className="no-print">
        <Link
          href="/app/samples"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#142437]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Specimen Registry</span>
        </Link>
      </div>

      <SamplePassportClient
        sample={sampleRow as SampleRecord}
        events={(events ?? []) as SampleEventRecord[]}
        exceptions={(exceptions ?? []) as ExceptionRecord[]}
        couriers={(couriers ?? []) as Pick<Membership, 'user_id' | 'display_name' | 'email'>[]}
        actorMembership={actor.membership}
        actorFacility={actor.facility}
        isDemoOrg={actor.organization.is_demo}
        isAssignedCourier={Boolean(assignmentRow)}
        sourceFacility={(src ?? null) as Pick<Facility, 'id' | 'name' | 'code' | 'location_label'> | null}
        destinationFacility={
          (dst ?? null) as Pick<Facility, 'id' | 'name' | 'code' | 'location_label'> | null
        }
      />
    </div>
  );
}
