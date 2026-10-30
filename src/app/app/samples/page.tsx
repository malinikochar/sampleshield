import Link from 'next/link';
import { AlertTriangle, PlusCircle, QrCode, Search } from 'lucide-react';
import { requireAuthenticatedPageActor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Button, Card, Input } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/domain/badges';
import { formatDateTime } from '@/lib/utils';
import { SAMPLE_STATUSES, type SampleStatus } from '@/types/domain';

export default async function SamplesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const actor = await requireAuthenticatedPageActor();
  const params = await searchParams;
  const activeStatus = params.status ?? 'all';
  const searchQuery = params.q?.trim() ?? '';

  const supabase = await createClient();

  let query = supabase
    .from('samples')
    .select(
      `
      id,
      public_code,
      specimen_type,
      case_alias,
      order_reference,
      status,
      updated_at,
      is_demo,
      source_facility:facilities!samples_source_facility_fkey ( id, name, code ),
      destination_facility:facilities!samples_destination_facility_fkey ( id, name, code )
    `
    )
    .eq('organization_id', actor.organization.id)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (activeStatus !== 'all' && (SAMPLE_STATUSES as readonly string[]).includes(activeStatus)) {
    query = query.eq('status', activeStatus);
  }

  if (searchQuery) {
    const clean = searchQuery.replace(/[,()]/g, '');
    query = query.or(
      `public_code.ilike.%${clean}%,case_alias.ilike.%${clean}%,order_reference.ilike.%${clean}%`
    );
  }

  const [{ data: samples }, { data: activeExceptions }] = await Promise.all([
    query,
    actor.membership.role !== 'courier'
      ? supabase
          .from('exceptions')
          .select('sample_id')
          .eq('organization_id', actor.organization.id)
          .in('status', ['open', 'acknowledged'])
      : Promise.resolve({ data: [] }),
  ]);

  const flaggedSampleIds = new Set((activeExceptions ?? []).map((e) => e.sample_id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#142437]">
            Specimen Registry
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {actor.membership.role === 'courier'
              ? 'Scoped strictly to samples actively assigned to you for transport'
              : `Authorized specimens within ${actor.organization.name}`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/app/scan"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#142437] hover:bg-slate-50"
          >
            <QrCode className="h-4 w-4 text-[#0E9488]" aria-hidden="true" />
            <span>Scan QR</span>
          </Link>
          {(actor.membership.role === 'collector' || actor.membership.role === 'admin') && (
            <Link
              href="/app/samples/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0E9488] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B7A70]"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              <span>Register Sample</span>
            </Link>
          )}
        </div>
      </div>

      {/* Search & Status Filter Bar */}
      <Card className="p-4 space-y-3">
        <form method="GET" action="/app/samples" className="flex flex-col sm:flex-row gap-2.5">
          {activeStatus !== 'all' ? (
            <input type="hidden" name="status" value={activeStatus} />
          ) : null}
          <div className="relative flex-1">
            <Search
              className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              name="q"
              defaultValue={searchQuery}
              placeholder="Search opaque code (SS-...), synthetic case alias, or order ref"
              aria-label="Search samples"
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {(searchQuery || activeStatus !== 'all') && (
            <Link
              href="/app/samples"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear
            </Link>
          )}
        </form>

        <div className="flex flex-wrap gap-1.5">
          {(['all', ...SAMPLE_STATUSES] as const).map((st) => {
            const selected = activeStatus === st;
            return (
              <Link
                key={st}
                href={
                  st === 'all'
                    ? searchQuery
                      ? `/app/samples?q=${encodeURIComponent(searchQuery)}`
                      : '/app/samples'
                    : `/app/samples?status=${st}${
                        searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''
                      }`
                }
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selected
                    ? 'bg-[#142437] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {st === 'all' ? 'All Statuses' : st.charAt(0).toUpperCase() + st.slice(1)}
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Sample Cards / Table */}
      {(samples ?? []).length === 0 ? (
        <Card className="p-10 text-center space-y-2">
          <p className="text-base font-bold text-[#142437]">No matching specimens found</p>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {actor.membership.role === 'courier'
              ? 'You have no active courier assignments matching this filter.'
              : 'Register a new specimen passport or adjust your status filter.'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {(samples ?? []).map((sample) => {
            const src = Array.isArray(sample.source_facility)
              ? sample.source_facility[0]
              : sample.source_facility;
            const dst = Array.isArray(sample.destination_facility)
              ? sample.destination_facility[0]
              : sample.destination_facility;
            const hasAlert = flaggedSampleIds.has(sample.id);

            return (
              <Link
                key={sample.id}
                href={`/app/samples/${sample.id}`}
                data-testid={`sample-row-${sample.public_code}`}
                className="block rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 hover:border-[#0E9488] transition-all shadow-[0_1px_2px_rgba(20,36,55,0.03)]"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold text-[#142437]">
                        {sample.public_code}
                      </span>
                      <StatusBadge status={sample.status as SampleStatus} />
                      {hasAlert ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF1F0] border border-[#D85A56]/50 px-2.5 py-0.5 text-xs font-semibold text-[#8A1F1C]">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          Open Exception
                        </span>
                      ) : null}
                      {sample.is_demo ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                          DEMO
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      {sample.specimen_type}
                      {sample.case_alias ? (
                        <span className="text-slate-500"> · Alias: {sample.case_alias}</span>
                      ) : null}
                      {sample.order_reference ? (
                        <span className="text-slate-500"> · Order: {sample.order_reference}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500">
                      Route:{' '}
                      <strong className="font-semibold text-slate-700">
                        {src ? `${src.name} (${src.code})` : 'Clinic'}
                      </strong>{' '}
                      →{' '}
                      <strong className="font-semibold text-slate-700">
                        {dst ? `${dst.name} (${dst.code})` : 'Lab'}
                      </strong>
                    </p>
                  </div>

                  <div className="text-left sm:text-right text-xs font-mono text-slate-500 shrink-0">
                    <div>Updated {formatDateTime(sample.updated_at)}</div>
                    <div className="mt-1 font-sans font-semibold text-[#0E9488]">
                      Open Passport →
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
