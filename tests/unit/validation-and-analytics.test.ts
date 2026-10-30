import { describe, expect, it } from 'vitest';
import {
  createSampleSchema,
  submitCustodyEventSchema,
} from '@/lib/validation/schemas';
import {
  computeMedian,
  computeOperationalAnalytics,
  simulateIllustrativePatientBurden,
} from '@/lib/rules/analytics';

const CLINIC_ID = '11111111-1111-4111-8111-111111111101';
const LAB_ID = '11111111-1111-4111-8111-111111111201';
const COURIER_ID = '11111111-1111-4111-8111-111111111301';

describe('Anti-PHI & Operational Zod Validation Schemas', () => {
  it('accepts synthetic sample registration and rejects accidental PHI (emails / phone numbers)', () => {
    const valid = createSampleSchema.safeParse({
      source_facility_id: CLINIC_ID,
      destination_facility_id: LAB_ID,
      specimen_type: 'EDTA Whole Blood Tube',
      case_alias: 'SYNTH-CASE-402',
      order_reference: 'ORD-DEMO-8821',
      collect_immediately: true,
    });
    expect(valid.success).toBe(true);

    const withEmail = createSampleSchema.safeParse({
      source_facility_id: CLINIC_ID,
      destination_facility_id: LAB_ID,
      specimen_type: 'EDTA Whole Blood Tube',
      case_alias: 'patient.name@gmail.com',
    });
    expect(withEmail.success).toBe(false);

    const withPhone = createSampleSchema.safeParse({
      source_facility_id: CLINIC_ID,
      destination_facility_id: LAB_ID,
      specimen_type: 'EDTA Whole Blood Tube',
      case_alias: '98765-43210',
    });
    expect(withPhone.success).toBe(false);

    const sameFacility = createSampleSchema.safeParse({
      source_facility_id: CLINIC_ID,
      destination_facility_id: CLINIC_ID,
      specimen_type: 'EDTA Whole Blood Tube',
    });
    expect(sameFacility.success).toBe(false);
  });

  it('normalizes lowercase QR codes and enforces dispatch courier & rejection reason rules', () => {
    const parsedPickup = submitCustodyEventSchema.safeParse({
      client_event_id: '22222222-2222-4222-8222-222222222201',
      sample_public_code: '  ss-7k3m-9p2x-q4wn ',
      event_type: 'courier_pickup',
    });
    expect(parsedPickup.success).toBe(true);
    if (parsedPickup.success) {
      expect(parsedPickup.data.sample_public_code).toBe('SS-7K3M-9P2X-Q4WN');
    }

    const dispatchWithoutCourier = submitCustodyEventSchema.safeParse({
      client_event_id: '22222222-2222-4222-8222-222222222202',
      sample_public_code: 'SS-7K3M-9P2X-Q4WN',
      event_type: 'sample_dispatched',
      metadata: {},
    });
    expect(dispatchWithoutCourier.success).toBe(false);

    const dispatchWithCourier = submitCustodyEventSchema.safeParse({
      client_event_id: '22222222-2222-4222-8222-222222222203',
      sample_public_code: 'SS-7K3M-9P2X-Q4WN',
      event_type: 'sample_dispatched',
      metadata: { assigned_courier_id: COURIER_ID },
    });
    expect(dispatchWithCourier.success).toBe(true);

    const rejectWithoutReason = submitCustodyEventSchema.safeParse({
      client_event_id: '22222222-2222-4222-8222-222222222204',
      sample_public_code: 'SS-7K3M-9P2X-Q4WN',
      event_type: 'lab_rejected',
      metadata: { disposition_reason: 'no' },
    });
    expect(rejectWithoutReason.success).toBe(false);
  });
});

describe('Operational Analytics & Illustrative Patient Burden Simulator', () => {
  it('computes medians accurately for empty, odd, and even arrays', () => {
    expect(computeMedian([])).toBeNull();
    expect(computeMedian([90, 30, 60])).toBe(60);
    expect(computeMedian([30, 50, 70, 90])).toBe(60);
  });

  it('derives verified operational KPIs strictly from server-confirmed events', () => {
    const kpis = computeOperationalAnalytics({
      samples: [
        { id: 's1', status: 'accepted' },
        { id: 's2', status: 'dispatched' },
        { id: 's3', status: 'received' },
      ],
      events: [
        {
          sample_id: 's1',
          event_type: 'sample_dispatched',
          client_occurred_at: '2026-10-30T08:00:00.000Z',
          server_recorded_at: '2026-10-30T08:00:00.000Z',
          was_queued_offline: false,
        },
        {
          sample_id: 's1',
          event_type: 'lab_received',
          client_occurred_at: '2026-10-30T09:15:00.000Z',
          server_recorded_at: '2026-10-30T09:15:00.000Z', // 75 min transit
          was_queued_offline: false,
        },
        {
          sample_id: 's3',
          event_type: 'sample_dispatched',
          client_occurred_at: '2026-10-30T10:00:00.000Z',
          server_recorded_at: '2026-10-30T10:00:00.000Z',
          was_queued_offline: false,
        },
        {
          sample_id: 's3',
          event_type: 'courier_pickup',
          client_occurred_at: '2026-10-30T10:05:00.000Z',
          server_recorded_at: '2026-10-30T10:35:00.000Z', // 30 min offline sync lag
          was_queued_offline: true,
        },
        {
          sample_id: 's3',
          event_type: 'lab_received',
          client_occurred_at: '2026-10-30T12:05:00.000Z',
          server_recorded_at: '2026-10-30T12:05:00.000Z', // 125 min transit
          was_queued_offline: false,
        },
      ],
      exceptions: [
        { sample_id: 's2', rule_code: 'DESTINATION_MISMATCH', status: 'open' },
      ],
    });

    expect(kpis.totalSamples).toBe(3);
    expect(kpis.acceptedCount).toBe(1);
    expect(kpis.inTransitCount).toBe(1);
    expect(kpis.awaitingLabDispositionCount).toBe(1);
    expect(kpis.openExceptionsCount).toBe(1);
    expect(kpis.medianTransitMinutes).toBe(100); // median of [75, 125]
    expect(kpis.offlineSyncedEventsCount).toBe(1);
    expect(kpis.medianOfflineSyncLagMinutes).toBe(30);
    expect(kpis.exceptionRatePercent).toBe(33.3);
  });

  it('labels hypothetical patient-burden simulation transparently as non-observed', () => {
    const sim = simulateIllustrativePatientBurden({
      monthlySampleVolume: 1000,
      baselineUnresolvedHandoverRatePct: 5,
      hypotheticalPreventableSharePct: 60,
      estimatedPatientRoundTripCostInr: 250,
      estimatedPatientHoursPerRepeatVisit: 4,
    });

    expect(sim.illustrativePreventedRepeatVisitsPerMonth).toBe(30);
    expect(sim.illustrativePatientTravelSavingsInrPerMonth).toBe(7500);
    expect(sim.illustrativePatientHoursSavedPerMonth).toBe(120);
    expect(sim.disclaimer).toContain('Illustrative scenario — not observed outcome');
  });
});
