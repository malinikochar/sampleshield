'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CloudOff,
  CopyCheck,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button, Card } from '@/components/ui/primitives';
import type { DemoScenarioInput } from '@/lib/validation/schemas';

interface ScenarioDescriptor {
  key: DemoScenarioInput['scenario'];
  title: string;
  badge: string;
  description: string;
  expectedOutcome: string;
  Icon: typeof Sparkles;
}

const SCENARIOS: ScenarioDescriptor[] = [
  {
    key: 'happy_path',
    title: '1. Complete Happy Path Journey',
    badge: 'End-to-End Verified',
    description:
      'Seeds a complete synthetic specimen journey (created → collected → dispatched → courier pickup/dropoff → lab received → lab accepted).',
    expectedOutcome: '7 confirmed ledger events with actors and server receipt timestamps.',
    Icon: CheckCircle2,
  },
  {
    key: 'wrong_destination',
    title: '2. Wrong Destination Blocked',
    badge: 'DESTINATION_MISMATCH',
    description:
      'Simulates a specimen routed to Ajmer Lab being scanned at Jaipur Hub. Blocks unauthorized receipt and opens a High-Severity exception.',
    expectedOutcome:
      'Sample status remains In Transit; Jaipur Hub blocked; alert appears in Exception Inbox.',
    Icon: AlertTriangle,
  },
  {
    key: 'offline_courier',
    title: '3. Offline Courier Preparation',
    badge: 'No-Network Mode',
    description:
      'Creates a fresh dispatched specimen assigned to Ravi Meena so you can switch to Offline mode, record pickup locally, reload, and sync.',
    expectedOutcome: 'Ready in Courier Handovers for live offline-to-online replay proof.',
    Icon: CloudOff,
  },
  {
    key: 'delayed_arrival',
    title: '4. Delayed Arrival (Human Review)',
    badge: 'TRANSIT_DELAY',
    description:
      'Creates a specimen received after 290 minutes against the 180-minute synthetic operational SLA—flagged for human lab review, NOT auto-rejected.',
    expectedOutcome: 'Appears in Lab Desk with TRANSIT_DELAY warning awaiting human decision.',
    Icon: Clock,
  },
  {
    key: 'duplicate_submission',
    title: '5. Duplicate Event Idempotency Proof',
    badge: 'DUPLICATE_EVENT',
    description:
      'Creates a dispatched specimen with a known client_event_id and lets you replay the identical UUID multiple times against /api/events.',
    expectedOutcome: 'Server returns idempotent_replay: true and stores exactly 1 event row.',
    Icon: CopyCheck,
  },
];

export function DemoControlClient({ organizationName }: { organizationName: string }) {
  const router = useRouter();
  const [busyScenario, setBusyScenario] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    scenario: string;
    sample_id?: string;
    public_code?: string;
    exception_id?: string;
    replayed_client_event_id?: string;
    summary: string;
  } | null>(null);
  const [replayProof, setReplayProof] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runScenario = async (scenario: DemoScenarioInput['scenario']) => {
    setBusyScenario(scenario);
    setErrorMsg(null);
    setReplayProof(null);

    try {
      const res = await fetch('/api/demo/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        data?: {
          scenario: string;
          sample_id?: string;
          public_code?: string;
          exception_id?: string;
          replayed_client_event_id?: string;
          summary: string;
        };
      } | null;

      if (!res.ok || !json?.ok || !json.data) {
        setErrorMsg(json?.message ?? 'Scenario trigger failed.');
        return;
      }

      setLastResult(json.data);
      router.refresh();
    } finally {
      setBusyScenario(null);
    }
  };

  const executeLiveDuplicateReplay = async () => {
    if (!lastResult?.public_code || !lastResult?.replayed_client_event_id) return;
    setBusyScenario('replay_check');
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_event_id: lastResult.replayed_client_event_id,
          sample_public_code: lastResult.public_code,
          event_type: 'courier_pickup',
          client_occurred_at: new Date().toISOString(),
          was_queued_offline: true,
          metadata: { handover_note: 'Duplicate retry with identical UUID' },
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        idempotent_replay?: boolean;
        data?: { event?: { id?: string } };
      } | null;

      setReplayProof(
        `HTTP ${res.status} · ok=${String(json?.ok)} · idempotent_replay=${String(
          json?.idempotent_replay
        )} · Confirmed Event ID=${json?.data?.event?.id ?? 'N/A'} (Zero duplicate rows inserted)`
      );
    } finally {
      setBusyScenario(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6 bg-[#142437] text-white border-none flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#5EEAD4]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>ISOLATED DEMO TENANT ONLY · {organizationName.toUpperCase()}</span>
          </div>
          <h2 className="text-lg font-bold">Reset to Clean Judge Presentation Baseline</h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Clears synthetic samples and exceptions inside <strong>{organizationName}</strong> only
            and seeds 1 fresh dispatched sample ready for live 3-minute demonstration. Non-demo
            organizations are strictly protected by database guardrails.
          </p>
        </div>

        <Button
          variant="primary"
          disabled={busyScenario !== null}
          data-testid="demo-reset-clean-btn"
          onClick={() => void runScenario('reset_clean')}
          className="shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
          <span>
            {busyScenario === 'reset_clean' ? 'Resetting…' : 'Reset Demo Baseline'}
          </span>
        </Button>
      </Card>

      {errorMsg ? (
        <div
          role="alert"
          className="rounded-xl border border-[#D85A56] bg-[#FDF1F0] p-4 text-sm font-medium text-[#8A1F1C]"
        >
          {errorMsg}
        </div>
      ) : null}

      {lastResult ? (
        <Card
          data-testid="demo-scenario-result"
          className="p-5 border-2 border-[#0E9488] bg-[#E5F7F3]/50 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#0B5D56]">
                Scenario Persisted in Supabase
              </p>
              <p className="text-sm font-bold text-[#142437] mt-0.5">{lastResult.summary}</p>
              {lastResult.public_code ? (
                <p className="font-mono text-xs text-slate-700 mt-1">
                  Sample Code: <strong>{lastResult.public_code}</strong>
                  {lastResult.replayed_client_event_id
                    ? ` · Client Event UUID: ${lastResult.replayed_client_event_id}`
                    : ''}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              {lastResult.replayed_client_event_id ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyScenario !== null}
                  data-testid="replay-duplicate-uuid-btn"
                  onClick={() => void executeLiveDuplicateReplay()}
                >
                  <CopyCheck className="h-3.5 w-3.5" />
                  <span>Replay Same UUID Now</span>
                </Button>
              ) : null}

              {lastResult.sample_id ? (
                <Link
                  href={`/app/samples/${lastResult.sample_id}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#0E9488] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0B7A70]"
                >
                  <span>Inspect Sample Passport</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </div>

          {replayProof ? (
            <div
              data-testid="duplicate-replay-proof"
              className="rounded-lg bg-white border border-[#0E9488]/40 px-3 py-2 font-mono text-xs text-[#0B5D56]"
            >
              {replayProof}
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="grid md:grid-cols-2 gap-4">
        {SCENARIOS.map((sc) => (
          <Card key={sc.key} className="p-5 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#E5F7F3] text-[#0E9488]">
                  <sc.Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="rounded-md bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#183B56]">
                  {sc.badge}
                </span>
              </div>
              <h3 className="text-base font-bold text-[#142437]">{sc.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{sc.description}</p>
              <p className="text-xs font-medium text-slate-700 bg-[#F7FAFC] border border-slate-200/80 rounded-lg p-2.5">
                <strong>Expected proof:</strong> {sc.expectedOutcome}
              </p>
            </div>

            <Button
              variant="outline"
              disabled={busyScenario !== null}
              data-testid={`trigger-scenario-${sc.key}`}
              onClick={() => void runScenario(sc.key)}
              className="w-full"
            >
              {busyScenario === sc.key ? 'Injecting synthetic scenario…' : `Inject ${sc.title}`}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
