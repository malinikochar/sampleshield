'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { createSampleSchema, type CreateSampleInput } from '@/lib/validation/schemas';
import { Button, Card, FieldLabel, Input } from '@/components/ui/primitives';
import { QrPanel } from '@/components/domain/qr-panel';
import { StatusBadge } from '@/components/domain/badges';
import { SPECIMEN_TYPES, type Facility, type SampleRecord } from '@/types/domain';

export function CreateSampleWizard({
  clinics,
  labs,
  defaultClinicId,
  lockedClinic,
  isDemoOrg,
}: {
  clinics: Facility[];
  labs: Facility[];
  defaultClinicId: string;
  lockedClinic: boolean;
  isDemoOrg: boolean;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdSample, setCreatedSample] = useState<SampleRecord | null>(null);

  const [defaultDemoDefaults] = useState(() => ({
    caseAlias: isDemoOrg ? `SYNTH-CASE-${Math.floor(100 + Math.random() * 899)}` : '',
    orderRef: isDemoOrg ? `ORD-DEMO-${Math.floor(1000 + Math.random() * 8999)}` : '',
  }));

  const {
    register,
    control,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<CreateSampleInput>({
    resolver: zodResolver(createSampleSchema),
    defaultValues: {
      source_facility_id: defaultClinicId || clinics[0]?.id || '',
      destination_facility_id: labs[0]?.id || '',
      specimen_type: SPECIMEN_TYPES[0],
      case_alias: defaultDemoDefaults.caseAlias,
      order_reference: defaultDemoDefaults.orderRef,
      collect_immediately: true,
    },
  });

  const watched = useWatch({ control });
  const selectedClinic = clinics.find((c) => c.id === watched.source_facility_id);
  const selectedLab = labs.find((l) => l.id === watched.destination_facility_id);

  const advanceToStep2 = async () => {
    const valid = await trigger(['source_facility_id', 'destination_facility_id']);
    if (valid) setStep(2);
  };

  const advanceToStep3 = async () => {
    const valid = await trigger(['specimen_type', 'case_alias', 'order_reference']);
    if (valid) setStep(3);
  };

  const onSubmit = async (values: CreateSampleInput) => {
    setServerError(null);
    const res = await fetch('/api/samples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      message?: string;
      data?: { sample?: SampleRecord };
    } | null;

    if (!res.ok || !json?.ok || !json.data?.sample) {
      setServerError(json?.message ?? 'Unable to register sample. Check your role and network.');
      return;
    }

    setCreatedSample(json.data.sample);
    setStep(4);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Stepper Indicator */}
      <ol aria-label="Sample creation steps" className="grid grid-cols-4 gap-2 text-xs font-semibold">
        {[
          [1, '1. Route'],
          [2, '2. Specimen'],
          [3, '3. Verify'],
          [4, '4. QR Passport'],
        ].map(([num, label]) => {
          const active = step === num;
          const completed = step > Number(num);
          return (
            <li
              key={label}
              className={`rounded-xl border px-3 py-2 text-center ${
                active
                  ? 'border-[#0E9488] bg-[#E5F7F3] text-[#0B5D56]'
                  : completed
                  ? 'border-[#183B56]/30 bg-white text-[#183B56]'
                  : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              {label}
            </li>
          );
        })}
      </ol>

      {serverError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-[#D85A56] bg-[#FDF1F0] p-4 text-sm font-medium text-[#8A1F1C]"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      ) : null}

      {step < 4 ? (
        <Card className="p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {step === 1 ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-[#142437]">
                    Step 1 — Select Collection Clinic & Receiving Laboratory
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Destination is locked into the Sample Passport so wrong-facility receipts are
                    detected immediately.
                  </p>
                </div>

                <div>
                  <FieldLabel htmlFor="source_facility_id" required>
                    Origin Collection Clinic
                  </FieldLabel>
                  <select
                    id="source_facility_id"
                    disabled={lockedClinic}
                    {...register('source_facility_id')}
                    className="w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#142437] disabled:bg-slate-100"
                  >
                    {clinics.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                  {errors.source_facility_id ? (
                    <p className="mt-1 text-xs font-medium text-[#C63F3B]">
                      {errors.source_facility_id.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <FieldLabel htmlFor="destination_facility_id" required>
                    Authorized Receiving Laboratory
                  </FieldLabel>
                  <select
                    id="destination_facility_id"
                    {...register('destination_facility_id')}
                    className="w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#142437]"
                  >
                    {labs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.code})
                      </option>
                    ))}
                  </select>
                  {errors.destination_facility_id ? (
                    <p className="mt-1 text-xs font-medium text-[#C63F3B]">
                      {errors.destination_facility_id.message}
                    </p>
                  ) : null}
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="button" onClick={() => void advanceToStep2()}>
                    <span>Continue to Specimen Details</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-[#142437]">
                    Step 2 — Specimen Container & Non-Identifying Alias
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Do not enter real patient names, phone numbers, diagnoses, or national IDs.
                  </p>
                </div>

                <div>
                  <FieldLabel htmlFor="specimen_type" required>
                    Specimen Container Type
                  </FieldLabel>
                  <select
                    id="specimen_type"
                    {...register('specimen_type')}
                    className="w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#142437]"
                  >
                    {SPECIMEN_TYPES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  {errors.specimen_type ? (
                    <p className="mt-1 text-xs font-medium text-[#C63F3B]">
                      {errors.specimen_type.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="case_alias">
                      Synthetic Case Alias (Optional, No PHI)
                    </FieldLabel>
                    <Input
                      id="case_alias"
                      placeholder="e.g. SYNTH-CASE-204"
                      {...register('case_alias')}
                    />
                    {errors.case_alias ? (
                      <p className="mt-1 text-xs font-medium text-[#C63F3B]">
                        {errors.case_alias.message}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <FieldLabel htmlFor="order_reference">
                      Fictional Order Reference (Optional)
                    </FieldLabel>
                    <Input
                      id="order_reference"
                      placeholder="e.g. ORD-DEMO-4410"
                      {...register('order_reference')}
                    />
                    {errors.order_reference ? (
                      <p className="mt-1 text-xs font-medium text-[#C63F3B]">
                        {errors.order_reference.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 flex items-start gap-2.5 text-xs text-[#78350F]">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Privacy guardrail: Form validation blocks email addresses and 10–12 digit phone
                    or national ID strings. Only opaque random identifiers are encoded in QR labels.
                  </span>
                </div>

                <div className="flex justify-between pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button type="button" onClick={() => void advanceToStep3()}>
                    <span>Review Validation Summary</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-[#142437]">
                    Step 3 — Confirm Pre-Registration Check
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Verify route and container before generating the immutable creation record.
                  </p>
                </div>

                <dl className="rounded-xl border border-slate-200 bg-[#F7FAFC] p-4 grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Origin Clinic</dt>
                    <dd className="font-semibold text-[#142437] mt-0.5">
                      {selectedClinic
                        ? `${selectedClinic.name} (${selectedClinic.code})`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Destination Laboratory</dt>
                    <dd className="font-semibold text-[#142437] mt-0.5">
                      {selectedLab ? `${selectedLab.name} (${selectedLab.code})` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Specimen Container</dt>
                    <dd className="font-semibold text-[#142437] mt-0.5">
                      {watched.specimen_type}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Synthetic Alias / Order</dt>
                    <dd className="font-mono text-xs font-semibold text-[#142437] mt-0.5">
                      {watched.case_alias || 'None'} · {watched.order_reference || 'None'}
                    </dd>
                  </div>
                </dl>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    {...register('collect_immediately')}
                    className="mt-1 h-4 w-4 accent-[#0E9488]"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-[#142437] block">
                      Mark specimen physically collected & sealed now
                    </span>
                    <span className="text-slate-600">
                      Appends both <code>sample_created</code> and <code>sample_collected</code>{' '}
                      events atomically so the specimen is ready for courier dispatch.
                    </span>
                  </div>
                </label>

                <div className="flex justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(2)}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting}
                    data-testid="confirm-create-sample"
                  >
                    {isSubmitting ? 'Registering in Supabase…' : 'Generate Sample Passport & QR'}
                  </Button>
                </div>
              </div>
            ) : null}
          </form>
        </Card>
      ) : createdSample ? (
        <div className="grid md:grid-cols-12 gap-6 items-start">
          <Card className="md:col-span-7 p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#0B5D56]">
              <CheckCircle2 className="h-5 w-5 text-[#0E9488]" aria-hidden="true" />
              <span className="text-sm font-bold">Sample Passport Persisted in Supabase</span>
            </div>

            <div>
              <p className="text-xs text-slate-500">Opaque Specimen Code</p>
              <p className="font-mono text-2xl font-extrabold text-[#142437] mt-0.5">
                {createdSample.public_code}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={createdSample.status} />
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Attach the printed opaque QR label to the sealed transport pouch, then open the Sample
              Passport to assign an authorized courier for dispatch.
            </p>

            <div className="pt-2 flex flex-wrap gap-3">
              <Link
                href={`/app/samples/${createdSample.id}`}
                data-testid="open-created-passport"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0E9488] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B7A70]"
              >
                <span>Open Sample Passport & Dispatch</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/app/samples"
                className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#142437] hover:bg-slate-50"
              >
                All Samples
              </Link>
            </div>
          </Card>

          <div className="md:col-span-5">
            <QrPanel
              publicCode={createdSample.public_code}
              specimenType={createdSample.specimen_type}
              sourceCode={selectedClinic?.code}
              destinationCode={selectedLab?.code}
              isDemo={createdSample.is_demo}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
