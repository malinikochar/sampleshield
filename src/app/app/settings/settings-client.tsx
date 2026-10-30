'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Building2, CheckCircle2, ShieldAlert, Users } from 'lucide-react';
import { Button, Card, FieldLabel, Input } from '@/components/ui/primitives';
import { RoleBadge } from '@/components/domain/badges';
import { formatDateTime } from '@/lib/utils';
import type {
  Facility,
  FacilityPolicyRecord,
  FacilityType,
  Membership,
} from '@/types/domain';

export function SettingsClient({
  facilities,
  policies,
  memberships,
  isDemoOrg,
}: {
  facilities: Facility[];
  policies: FacilityPolicyRecord[];
  memberships: Membership[];
  isDemoOrg: boolean;
}) {
  const router = useRouter();
  const [facName, setFacName] = useState('');
  const [facCode, setFacCode] = useState('');
  const [facType, setFacType] = useState<FacilityType>('clinic');
  const [facLocation, setFacLocation] = useState('');

  const [policyDrafts, setPolicyDrafts] = useState<
    Record<string, { policyName: string; delayMinutes: number; requirePickup: boolean }>
  >(() => {
    const initial: Record<
      string,
      { policyName: string; delayMinutes: number; requirePickup: boolean }
    > = {};
    for (const f of facilities.filter((f) => f.facility_type === 'lab')) {
      const existing = policies.find((p) => p.facility_id === f.id);
      initial[f.id] = {
        policyName: existing?.policy_name ?? `${f.name} Operational Transit SLA`,
        delayMinutes: existing?.operational_delay_minutes ?? 180,
        requirePickup: existing?.require_courier_pickup_before_receipt ?? true,
      };
    }
    return initial;
  });

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleCreateFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: facName.trim(),
          code: facCode.trim().toUpperCase(),
          facility_type: facType,
          location_label: facLocation.trim(),
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        setFeedback({
          tone: 'error',
          text: json?.message ?? 'Could not create facility.',
        });
        return;
      }

      setFacName('');
      setFacCode('');
      setFacLocation('');
      setFeedback({
        tone: 'success',
        text: 'Facility added to organization.',
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleSavePolicy = async (facilityId: string) => {
    const draft = policyDrafts[facilityId];
    if (!draft) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id: facilityId,
          policy_name: draft.policyName,
          operational_delay_minutes: Number(draft.delayMinutes),
          require_courier_pickup_before_receipt: draft.requirePickup,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        setFeedback({
          tone: 'error',
          text: json?.message ?? 'Policy update failed.',
        });
        return;
      }
      setFeedback({
        tone: 'success',
        text: 'Operational SLA policy updated and audited.',
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const labs = facilities.filter((f) => f.facility_type === 'lab');

  return (
    <div className="space-y-6">
      {feedback ? (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-xl border p-4 text-sm font-medium ${
            feedback.tone === 'success'
              ? 'border-[#0E9488]/40 bg-[#E5F7F3] text-[#0B5D56]'
              : 'border-[#D85A56] bg-[#FDF1F0] text-[#8A1F1C]'
          }`}
        >
          {feedback.tone === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      ) : null}

      {/* Operational Transit Policies */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-[#E8A23C] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-base font-bold text-[#142437]">
              Laboratory Operational Transit Policies ({isDemoOrg ? 'Demo SLA' : 'Operational SLA'})
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Thresholds below trigger <code>TRANSIT_DELAY</code> or <code>HANDOVER_GAP</code>{' '}
              review items only—they are <strong>not clinical specimen stability limits</strong> and
              never auto-reject samples.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {labs.map((lab) => {
            const existing = policies.find((p) => p.facility_id === lab.id);
            const draft = policyDrafts[lab.id] ?? {
              policyName: `${lab.name} Operational SLA`,
              delayMinutes: 180,
              requirePickup: true,
            };

            return (
              <div
                key={lab.id}
                className="rounded-xl border border-slate-200 bg-[#F7FAFC] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[#142437]">
                      {lab.name} ({lab.code})
                    </p>
                    <p className="text-[11px] font-mono text-slate-500">
                      Source: Organization Admin Policy · Updated:{' '}
                      {existing ? formatDateTime(existing.updated_at) : 'Default'}
                    </p>
                  </div>
                  {existing?.is_demo_policy || isDemoOrg ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-[#78350F]">
                      Synthetic Demo Operational Policy
                    </span>
                  ) : null}
                </div>

                <div className="grid sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5">
                    <FieldLabel htmlFor={`pol-name-${lab.id}`}>Policy Label</FieldLabel>
                    <Input
                      id={`pol-name-${lab.id}`}
                      value={draft.policyName}
                      onChange={(e) =>
                        setPolicyDrafts((prev) => ({
                          ...prev,
                          [lab.id]: { ...draft, policyName: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <FieldLabel htmlFor={`pol-min-${lab.id}`}>
                      Review Threshold (Minutes)
                    </FieldLabel>
                    <Input
                      id={`pol-min-${lab.id}`}
                      type="number"
                      min={5}
                      max={10080}
                      value={draft.delayMinutes}
                      onChange={(e) =>
                        setPolicyDrafts((prev) => ({
                          ...prev,
                          [lab.id]: {
                            ...draft,
                            delayMinutes: Number(e.target.value) || 5,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-4 flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.requirePickup}
                        onChange={(e) =>
                          setPolicyDrafts((prev) => ({
                            ...prev,
                            [lab.id]: { ...draft, requirePickup: e.target.checked },
                          }))
                        }
                        className="h-4 w-4 accent-[#0E9488]"
                      />
                      <span>Require courier pickup</span>
                    </label>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleSavePolicy(lab.id)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Facilities Directory + Add Facility */}
      <div className="grid lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#183B56]" aria-hidden="true" />
            <h2 className="text-base font-bold text-[#142437]">
              Authorized Network Facilities ({facilities.length})
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {facilities.map((fac) => (
              <div
                key={fac.id}
                className="py-3 flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[#142437]">{fac.name}</p>
                  <p className="text-xs text-slate-500">
                    {fac.location_label || 'Facility in tenant'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs font-bold text-[#183B56] bg-slate-100 px-2 py-1 rounded">
                    {fac.code}
                  </span>
                  <span className="rounded-full bg-[#E5F7F3] px-2.5 py-0.5 text-xs font-semibold text-[#0B5D56] capitalize">
                    {fac.facility_type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-5 p-6 space-y-4">
          <h2 className="text-base font-bold text-[#142437]">Add Facility to Organization</h2>
          <form onSubmit={handleCreateFacility} className="space-y-3">
            <div>
              <FieldLabel htmlFor="fac-name" required>
                Facility Name
              </FieldLabel>
              <Input
                id="fac-name"
                required
                value={facName}
                onChange={(e) => setFacName(e.target.value)}
                placeholder="e.g. Pushkar Sub-Health Clinic"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="fac-code" required>
                  Code
                </FieldLabel>
                <Input
                  id="fac-code"
                  required
                  value={facCode}
                  onChange={(e) => setFacCode(e.target.value.toUpperCase())}
                  placeholder="PHC-PUSH"
                  className="font-mono uppercase"
                />
              </div>
              <div>
                <FieldLabel htmlFor="fac-type" required>
                  Type
                </FieldLabel>
                <select
                  id="fac-type"
                  value={facType}
                  onChange={(e) => setFacType(e.target.value as FacilityType)}
                  className="w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-[#142437]"
                >
                  <option value="clinic">Clinic</option>
                  <option value="lab">Receiving Lab</option>
                </select>
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="fac-loc">Location Label (Synthetic)</FieldLabel>
              <Input
                id="fac-loc"
                value={facLocation}
                onChange={(e) => setFacLocation(e.target.value)}
                placeholder="e.g. Pushkar Block (Synthetic)"
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              Add Facility
            </Button>
          </form>
        </Card>
      </div>

      {/* Organization Memberships Directory */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#0E9488]" aria-hidden="true" />
          <h2 className="text-base font-bold text-[#142437]">
            Organization Role Memberships ({memberships.length})
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          {memberships.map((m) => {
            const fac = facilities.find((f) => f.id === m.facility_id);
            return (
              <div
                key={m.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
              >
                <div>
                  <span className="font-semibold text-[#142437]">{m.display_name}</span>
                  <span className="ml-2 font-mono text-xs text-slate-500">{m.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">
                    {fac ? `${fac.name} (${fac.code})` : 'All Organization Facilities'}
                  </span>
                  <RoleBadge role={m.role} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
