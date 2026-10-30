import { requireAuthenticatedPageActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CreateSampleWizard } from '@/app/app/samples/new/create-sample-wizard';
import type { Facility } from '@/types/domain';

export default async function CreateSamplePage() {
  const actor = await requireAuthenticatedPageActor(['collector', 'admin']);
  const supabase = await createClient();

  const { data: facilitiesRow } = await supabase
    .from('facilities')
    .select('*')
    .eq('organization_id', actor.organization.id)
    .eq('is_active', true)
    .order('name', { ascending: true });

  const facilities = (facilitiesRow ?? []) as Facility[];
  const clinics = facilities.filter((f) => f.facility_type === 'clinic');
  const labs = facilities.filter((f) => f.facility_type === 'lab');

  const lockedClinic =
    actor.membership.role === 'collector' && Boolean(actor.membership.facility_id);
  const defaultClinicId = actor.membership.facility_id ?? clinics[0]?.id ?? '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#142437]">
          Register Specimen & Generate QR Passport
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Verify origin clinic, destination laboratory, and container before generating a zero-PII
          opaque QR identifier.
        </p>
      </div>

      <CreateSampleWizard
        clinics={clinics}
        labs={labs}
        defaultClinicId={defaultClinicId}
        lockedClinic={lockedClinic}
        isDemoOrg={actor.organization.is_demo}
      />
    </div>
  );
}
