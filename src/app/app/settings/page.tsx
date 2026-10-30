import { requireAuthenticatedPageActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { SettingsClient } from '@/app/app/settings/settings-client';
import type { Facility, FacilityPolicyRecord, Membership } from '@/types/domain';

export default async function SettingsPage() {
  const actor = await requireAuthenticatedPageActor(['admin']);
  const supabase = await createClient();

  const [{ data: facilities }, { data: policies }, { data: memberships }] = await Promise.all([
    supabase
      .from('facilities')
      .select('*')
      .eq('organization_id', actor.organization.id)
      .order('name', { ascending: true }),
    supabase
      .from('facility_policies')
      .select('*')
      .eq('organization_id', actor.organization.id),
    supabase
      .from('memberships')
      .select('*')
      .eq('organization_id', actor.organization.id)
      .order('role', { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#142437]">
          Organization Facilities, Roles & Operational Policies
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure facility directory and non-clinical operational SLA review thresholds for{' '}
          {actor.organization.name}.
        </p>
      </div>

      <SettingsClient
        facilities={(facilities ?? []) as Facility[]}
        policies={(policies ?? []) as FacilityPolicyRecord[]}
        memberships={(memberships ?? []) as Membership[]}
        isDemoOrg={actor.organization.is_demo}
      />
    </div>
  );
}
