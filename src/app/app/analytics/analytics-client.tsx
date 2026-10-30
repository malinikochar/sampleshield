'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calculator, Download, Info } from 'lucide-react';
import {
  simulateIllustrativePatientBurden,
  type OperationalKpiSummary,
} from '@/lib/rules/analytics';
import { Card, FieldLabel, Input } from '@/components/ui/primitives';

const STATUS_BAR_COLORS = ['#64748B', '#0284C7', '#E8A23C', '#183B56', '#0E9488', '#D85A56'];

export function AnalyticsClient({
  summary,
  isDemoOrg,
  organizationName,
}: {
  summary: OperationalKpiSummary;
  isDemoOrg: boolean;
  organizationName: string;
}) {
  const [monthlyVol, setMonthlyVol] = useState(600);
  const [baselineGapPct, setBaselineGapPct] = useState(6);
  const [preventableSharePct, setPreventableSharePct] = useState(50);
  const [tripCostInr, setTripCostInr] = useState(280);
  const [hoursPerVisit, setHoursPerVisit] = useState(4.5);

  const sim = simulateIllustrativePatientBurden({
    monthlySampleVolume: monthlyVol,
    baselineUnresolvedHandoverRatePct: baselineGapPct,
    hypotheticalPreventableSharePct: preventableSharePct,
    estimatedPatientRoundTripCostInr: tripCostInr,
    estimatedPatientHoursPerRepeatVisit: hoursPerVisit,
  });

  return (
    <div className="space-y-6">
      {/* Header Banner + CSV Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-600">{organizationName}</span>
          {isDemoOrg ? (
            <span
              data-testid="analytics-synthetic-badge"
              className="rounded-full bg-[#142437] px-3 py-1 font-mono text-xs font-semibold text-[#5EEAD4]"
            >
              Synthetic demo data
            </span>
          ) : null}
        </div>

        <a
          href="/api/analytics?format=csv"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142437] hover:bg-slate-50"
        >
          <Download className="h-4 w-4 text-[#0E9488]" aria-hidden="true" />
          <span>Export Verified CSV Aggregates</span>
        </a>
      </div>

      {/* Confirmed KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Confirmed Samples
          </span>
          <p className="mt-2 font-mono text-3xl font-extrabold text-[#142437]">
            {summary.totalSamples}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {summary.acceptedCount} accepted · {summary.rejectedCount} rejected
          </p>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Median Dispatch → Receipt
          </span>
          <p className="mt-2 font-mono text-3xl font-extrabold text-[#142437]">
            {summary.medianTransitMinutes !== null ? `${summary.medianTransitMinutes}m` : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Based on n={summary.transitSampleSize} server-confirmed arrivals
          </p>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Exception Rate
          </span>
          <p className="mt-2 font-mono text-3xl font-extrabold text-[#142437]">
            {summary.exceptionRatePercent !== null ? `${summary.exceptionRatePercent}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {summary.openExceptionsCount} open · {summary.resolvedExceptionsCount} resolved
          </p>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Offline-Synced Events
          </span>
          <p className="mt-2 font-mono text-3xl font-extrabold text-[#142437]">
            {summary.offlineSyncedEventsCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Median sync lag:{' '}
            {summary.medianOfflineSyncLagMinutes !== null
              ? `${summary.medianOfflineSyncLagMinutes}m`
              : '—'}{' '}
            (excludes unverified local items)
          </p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-base font-bold text-[#142437]">
                Confirmed Specimen Status Distribution (n={summary.totalSamples})
              </h2>
              <p className="text-xs text-slate-600">
                Excludes unconfirmed local device queue entries
              </p>
            </div>
            {isDemoOrg ? (
              <span className="text-[11px] font-mono font-semibold text-slate-500">
                Synthetic demo data
              </span>
            ) : null}
          </div>

          {summary.totalSamples === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">
              No confirmed samples recorded in this organization yet.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.statusDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip
                    formatter={(val) => [`${String(val)} sample(s)`, 'Confirmed count']}
                    contentStyle={{
                      borderRadius: '12px',
                      borderColor: '#CBD5E1',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {summary.statusDistribution.map((entry, idx) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_BAR_COLORS[idx % STATUS_BAR_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-5 p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#142437]">
                Exceptions by Operational Rule
              </h2>
              <p className="text-xs text-slate-600">Deterministic rule triggers</p>
            </div>
            {isDemoOrg ? (
              <span className="text-[11px] font-mono font-semibold text-slate-500">
                Synthetic demo data
              </span>
            ) : null}
          </div>

          {summary.exceptionsByRule.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">
              Zero operational exceptions recorded.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.exceptionsByRule} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="rule_code"
                    width={145}
                    tick={{ fontSize: 11, fill: '#142437' }}
                  />
                  <Tooltip
                    formatter={(val) => [`${String(val)} alert(s)`, 'Triggered']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" fill="#D85A56" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Patient-Burden Lens — Transparently Hypothetical Simulation */}
      <Card className="p-6 space-y-5 border-2 border-slate-200 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-2.5">
            <Calculator className="h-5 w-5 text-[#0E9488] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-[#142437]">
                Patient-Burden Lens (What-If Operational Scenario Model)
              </h2>
              <p className="text-xs text-slate-600">
                Explore how reducing unresolved transport handovers <em>could</em> affect avoidable
                patient return trips under user-chosen assumptions.
              </p>
            </div>
          </div>
          <span
            data-testid="illustrative-scenario-badge"
            className="rounded-full border border-amber-400 bg-amber-50 px-3 py-1 text-xs font-bold text-[#78350F] shrink-0"
          >
            Illustrative scenario — not observed outcome
          </span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <FieldLabel htmlFor="sim-vol">Monthly Route Samples</FieldLabel>
            <Input
              id="sim-vol"
              type="number"
              min={0}
              max={100000}
              value={monthlyVol}
              onChange={(e) => setMonthlyVol(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="sim-gap">Assumed Baseline Gap (%)</FieldLabel>
            <Input
              id="sim-gap"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={baselineGapPct}
              onChange={(e) => setBaselineGapPct(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="sim-share">Hypothetical Preventable (%)</FieldLabel>
            <Input
              id="sim-share"
              type="number"
              min={0}
              max={100}
              value={preventableSharePct}
              onChange={(e) => setPreventableSharePct(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="sim-cost">Est. Patient Trip Cost (INR)</FieldLabel>
            <Input
              id="sim-cost"
              type="number"
              min={0}
              value={tripCostInr}
              onChange={(e) => setTripCostInr(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="sim-hrs">Est. Hours / Repeat Visit</FieldLabel>
            <Input
              id="sim-hrs"
              type="number"
              min={0}
              step={0.5}
              value={hoursPerVisit}
              onChange={(e) => setHoursPerVisit(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-[#F7FAFC] border border-slate-200 p-4">
            <span className="text-xs text-slate-500">Hypothetical Repeat Trips Avoided / Mo</span>
            <p className="mt-1 font-mono text-2xl font-bold text-[#142437]">
              {sim.illustrativePreventedRepeatVisitsPerMonth}
            </p>
          </div>
          <div className="rounded-xl bg-[#F7FAFC] border border-slate-200 p-4">
            <span className="text-xs text-slate-500">
              Hypothetical Patient Travel Outlay / Mo
            </span>
            <p className="mt-1 font-mono text-2xl font-bold text-[#142437]">
              INR {sim.illustrativePatientTravelSavingsInrPerMonth.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="rounded-xl bg-[#F7FAFC] border border-slate-200 p-4">
            <span className="text-xs text-slate-500">Hypothetical Patient Time / Mo</span>
            <p className="mt-1 font-mono text-2xl font-bold text-[#142437]">
              {sim.illustrativePatientHoursSavedPerMonth} hrs
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-start gap-2 text-xs text-slate-600">
          <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{sim.disclaimer}</span>
        </div>
      </Card>
    </div>
  );
}
