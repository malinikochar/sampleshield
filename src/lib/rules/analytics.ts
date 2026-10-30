import type {
  ExceptionRecord,
  SampleEventRecord,
  SampleRecord,
  SampleStatus,
} from '@/types/domain';

export interface OperationalKpiSummary {
  totalSamples: number;
  inTransitCount: number;
  awaitingLabReceiptCount: number;
  awaitingLabDispositionCount: number;
  acceptedCount: number;
  rejectedCount: number;
  openExceptionsCount: number;
  acknowledgedExceptionsCount: number;
  resolvedExceptionsCount: number;
  medianTransitMinutes: number | null;
  transitSampleSize: number;
  exceptionRatePercent: number | null;
  statusDistribution: Array<{ status: SampleStatus; label: string; count: number }>;
  exceptionsByRule: Array<{ rule_code: string; count: number }>;
  offlineSyncedEventsCount: number;
  medianOfflineSyncLagMinutes: number | null;
}

const STATUS_LABELS: Record<SampleStatus, string> = {
  created: 'Created',
  collected: 'Collected',
  dispatched: 'In Transit',
  received: 'At Lab Desk',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? null;
  }
  const left = sorted[mid - 1] ?? 0;
  const right = sorted[mid] ?? 0;
  return Math.round(((left + right) / 2) * 10) / 10;
}

/**
 * Computes verified operational analytics strictly from server-confirmed records.
 * Unverified device-queued events MUST NEVER be passed here.
 */
export function computeOperationalAnalytics(params: {
  samples: Pick<SampleRecord, 'id' | 'status'>[];
  events: Pick<
    SampleEventRecord,
    'sample_id' | 'event_type' | 'client_occurred_at' | 'server_recorded_at' | 'was_queued_offline'
  >[];
  exceptions: Pick<ExceptionRecord, 'sample_id' | 'rule_code' | 'status'>[];
}): OperationalKpiSummary {
  const { samples, events, exceptions } = params;

  const statusCounts: Record<SampleStatus, number> = {
    created: 0,
    collected: 0,
    dispatched: 0,
    received: 0,
    accepted: 0,
    rejected: 0,
  };

  for (const s of samples) {
    statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
  }

  const openExceptionsCount = exceptions.filter((e) => e.status === 'open').length;
  const acknowledgedExceptionsCount = exceptions.filter((e) => e.status === 'acknowledged').length;
  const resolvedExceptionsCount = exceptions.filter((e) => e.status === 'resolved').length;

  // Dispatch-to-receipt duration (server_recorded_at)
  const dispatchTimeBySample = new Map<string, number>();
  const receiptTimeBySample = new Map<string, number>();
  const offlineSyncLags: number[] = [];
  let offlineSyncedEventsCount = 0;

  for (const evt of events) {
    const serverMs = Date.parse(evt.server_recorded_at);
    if (!Number.isNaN(serverMs)) {
      if (evt.event_type === 'sample_dispatched' && !dispatchTimeBySample.has(evt.sample_id)) {
        dispatchTimeBySample.set(evt.sample_id, serverMs);
      }
      if (evt.event_type === 'lab_received' && !receiptTimeBySample.has(evt.sample_id)) {
        receiptTimeBySample.set(evt.sample_id, serverMs);
      }
    }

    if (evt.was_queued_offline) {
      offlineSyncedEventsCount += 1;
      if (evt.client_occurred_at && !Number.isNaN(serverMs)) {
        const clientMs = Date.parse(evt.client_occurred_at);
        if (!Number.isNaN(clientMs) && serverMs >= clientMs) {
          offlineSyncLags.push(Math.round((serverMs - clientMs) / 60000));
        }
      }
    }
  }

  const transitDurationsMinutes: number[] = [];
  for (const [sampleId, dispatchMs] of dispatchTimeBySample.entries()) {
    const receiptMs = receiptTimeBySample.get(sampleId);
    if (receiptMs !== undefined && receiptMs >= dispatchMs) {
      transitDurationsMinutes.push(Math.round((receiptMs - dispatchMs) / 60000));
    }
  }

  const samplesWithExceptions = new Set(exceptions.map((e) => e.sample_id));
  const exceptionRatePercent =
    samples.length > 0
      ? Math.round((samplesWithExceptions.size / samples.length) * 1000) / 10
      : null;

  const ruleMap = new Map<string, number>();
  for (const exc of exceptions) {
    ruleMap.set(exc.rule_code, (ruleMap.get(exc.rule_code) ?? 0) + 1);
  }

  const exceptionsByRule = Array.from(ruleMap.entries())
    .map(([rule_code, count]) => ({ rule_code, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalSamples: samples.length,
    inTransitCount: statusCounts.dispatched,
    awaitingLabReceiptCount: statusCounts.dispatched,
    awaitingLabDispositionCount: statusCounts.received,
    acceptedCount: statusCounts.accepted,
    rejectedCount: statusCounts.rejected,
    openExceptionsCount,
    acknowledgedExceptionsCount,
    resolvedExceptionsCount,
    medianTransitMinutes: computeMedian(transitDurationsMinutes),
    transitSampleSize: transitDurationsMinutes.length,
    exceptionRatePercent,
    statusDistribution: (Object.keys(STATUS_LABELS) as SampleStatus[]).map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: statusCounts[status],
    })),
    exceptionsByRule,
    offlineSyncedEventsCount,
    medianOfflineSyncLagMinutes: computeMedian(offlineSyncLags),
  };
}

export interface PatientBurdenSimulationInput {
  monthlySampleVolume: number;
  baselineUnresolvedHandoverRatePct: number;
  hypotheticalPreventableSharePct: number;
  estimatedPatientRoundTripCostInr: number;
  estimatedPatientHoursPerRepeatVisit: number;
}

export interface PatientBurdenSimulationOutput {
  illustrativePreventedRepeatVisitsPerMonth: number;
  illustrativePatientTravelSavingsInrPerMonth: number;
  illustrativePatientHoursSavedPerMonth: number;
  disclaimer: string;
}

/**
 * Transparently hypothetical scenario calculator (`FR-17`).
 * Never presents output as measured clinical or pilot efficacy.
 */
export function simulateIllustrativePatientBurden(
  input: PatientBurdenSimulationInput
): PatientBurdenSimulationOutput {
  const safeVol = Math.max(0, Math.min(100_000, input.monthlySampleVolume));
  const safeRate = Math.max(0, Math.min(100, input.baselineUnresolvedHandoverRatePct)) / 100;
  const safeShare = Math.max(0, Math.min(100, input.hypotheticalPreventableSharePct)) / 100;
  const safeCost = Math.max(0, input.estimatedPatientRoundTripCostInr);
  const safeHours = Math.max(0, input.estimatedPatientHoursPerRepeatVisit);

  const prevented = Math.round(safeVol * safeRate * safeShare * 10) / 10;

  return {
    illustrativePreventedRepeatVisitsPerMonth: prevented,
    illustrativePatientTravelSavingsInrPerMonth: Math.round(prevented * safeCost),
    illustrativePatientHoursSavedPerMonth: Math.round(prevented * safeHours * 10) / 10,
    disclaimer:
      'Illustrative scenario — not observed outcome. Real-world operational impact requires prospective pilot evaluation with accredited laboratories.',
  };
}
