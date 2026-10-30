import { describe, expect, it } from 'vitest';
import {
  evaluatePostEventOperationalRules,
  generateOpaquePublicCode,
  getAllowedNextActions,
  validateCustodyTransition,
} from '@/lib/rules/state-machine';
import { OPAQUE_PUBLIC_CODE_REGEX } from '@/lib/validation/schemas';

const CLINIC_A = '11111111-1111-4111-8111-111111111101';
const CLINIC_B = '11111111-1111-4111-8111-111111111102';
const LAB_AJMER = '11111111-1111-4111-8111-111111111201';
const LAB_JAIPUR = '11111111-1111-4111-8111-111111111202';
const COURIER_RAVI = '11111111-1111-4111-8111-111111111301';

describe('generateOpaquePublicCode', () => {
  it('generates opaque Crockford codes matching SS-XXXX-XXXX-XXXX with high uniqueness', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const code = generateOpaquePublicCode();
      expect(code).toMatch(OPAQUE_PUBLIC_CODE_REGEX);
      expect(code).not.toMatch(/[01IO]/);
      seen.add(code);
    }
    expect(seen.size).toBe(50);
  });
});

describe('validateCustodyTransition', () => {
  it('allows full authorized collector -> courier -> receiving lab -> acceptance happy path', () => {
    const collected = validateCustodyTransition({
      currentStatus: 'created',
      eventType: 'sample_collected',
      actorRole: 'collector',
      actorFacilityId: CLINIC_A,
      sourceFacilityId: CLINIC_A,
      destinationFacilityId: LAB_AJMER,
      isAssignedCourier: false,
    });
    expect(collected).toEqual({ allowed: true, resultingStatus: 'collected' });

    const dispatched = validateCustodyTransition({
      currentStatus: 'collected',
      eventType: 'sample_dispatched',
      actorRole: 'collector',
      actorFacilityId: CLINIC_A,
      sourceFacilityId: CLINIC_A,
      destinationFacilityId: LAB_AJMER,
      isAssignedCourier: false,
      metadata: { assigned_courier_id: COURIER_RAVI },
    });
    expect(dispatched).toEqual({ allowed: true, resultingStatus: 'dispatched' });

    const pickup = validateCustodyTransition({
      currentStatus: 'dispatched',
      eventType: 'courier_pickup',
      actorRole: 'courier',
      actorFacilityId: null,
      sourceFacilityId: CLINIC_A,
      destinationFacilityId: LAB_AJMER,
      isAssignedCourier: true,
    });
    expect(pickup).toEqual({ allowed: true, resultingStatus: 'dispatched' });

    const received = validateCustodyTransition({
      currentStatus: 'dispatched',
      eventType: 'lab_received',
      actorRole: 'lab',
      actorFacilityId: LAB_AJMER,
      sourceFacilityId: CLINIC_A,
      destinationFacilityId: LAB_AJMER,
      isAssignedCourier: false,
    });
    expect(received).toEqual({ allowed: true, resultingStatus: 'received' });

    const accepted = validateCustodyTransition({
      currentStatus: 'received',
      eventType: 'lab_accepted',
      actorRole: 'lab',
      actorFacilityId: LAB_AJMER,
      sourceFacilityId: CLINIC_A,
      destinationFacilityId: LAB_AJMER,
      isAssignedCourier: false,
      metadata: { disposition_reason: 'Seal intact, identity label verified at desk' },
    });
    expect(accepted).toEqual({ allowed: true, resultingStatus: 'accepted' });
  });

  it('blocks couriers and collectors from laboratory acceptance or rejection', () => {
    const courierAttempt = validateCustodyTransition({
      currentStatus: 'received',
      eventType: 'lab_accepted',
      actorRole: 'courier',
      actorFacilityId: null,
      sourceFacilityId: CLINIC_A,
      destinationFacilityId: LAB_AJMER,
      isAssignedCourier: true,
    });
    expect(courierAttempt.allowed).toBe(false);
    expect(courierAttempt.errorCode).toBe('FORBIDDEN');

    const collectorAttempt = validateCustodyTransition({
      currentStatus: 'received',
      eventType: 'lab_rejected',
      actorRole: 'collector',
      actorFacilityId: CLINIC_A,
      sourceFacilityId: CLINIC_A,
      destinationFacilityId: LAB_AJMER,
      isAssignedCourier: false,
      metadata: { disposition_reason: 'Attempted unauthorized rejection' },
    });
    expect(collectorAttempt.allowed).toBe(false);
    expect(collectorAttempt.errorCode).toBe('FORBIDDEN');
  });

  it('blocks wrong-destination laboratory receipt with DESTINATION_MISMATCH', () => {
    const mismatch = validateCustodyTransition({
      currentStatus: 'dispatched',
      eventType: 'lab_received',
      actorRole: 'lab',
      actorFacilityId: LAB_JAIPUR,
      sourceFacilityId: CLINIC_A,
      destinationFacilityId: LAB_AJMER,
      isAssignedCourier: false,
    });

    expect(mismatch.allowed).toBe(false);
    expect(mismatch.errorCode).toBe('DESTINATION_MISMATCH');
    expect(mismatch.ruleCode).toBe('DESTINATION_MISMATCH');
    expect(mismatch.severity).toBe('high');
  });

  it('requires documented operational reason when rejecting a sample at the lab', () => {
    const missingReason = validateCustodyTransition({
      currentStatus: 'received',
      eventType: 'lab_rejected',
      actorRole: 'lab',
      actorFacilityId: LAB_AJMER,
      sourceFacilityId: CLINIC_A,
      destinationFacilityId: LAB_AJMER,
      isAssignedCourier: false,
      metadata: { disposition_reason: '   ' },
    });

    expect(missingReason.allowed).toBe(false);
    expect(missingReason.errorCode).toBe('BAD_REQUEST');
    expect(missingReason.ruleCode).toBe('MISSING_REQUIRED_FIELD');
  });

  it('blocks collector from another clinic acting on sample', () => {
    const wrongClinic = validateCustodyTransition({
      currentStatus: 'created',
      eventType: 'sample_collected',
      actorRole: 'collector',
      actorFacilityId: CLINIC_B,
      sourceFacilityId: CLINIC_A,
      destinationFacilityId: LAB_AJMER,
      isAssignedCourier: false,
    });

    expect(wrongClinic.allowed).toBe(false);
    expect(wrongClinic.errorCode).toBe('FORBIDDEN');
  });

  it('flags stale offline transitions as CONFLICT / OFFLINE_CONFLICT for human review', () => {
    const offlineStale = validateCustodyTransition({
      currentStatus: 'received',
      eventType: 'courier_pickup',
      actorRole: 'courier',
      actorFacilityId: null,
      sourceFacilityId: CLINIC_A,
      destinationFacilityId: LAB_AJMER,
      isAssignedCourier: true,
      wasQueuedOffline: true,
    });

    expect(offlineStale.allowed).toBe(false);
    expect(offlineStale.errorCode).toBe('CONFLICT');
    expect(offlineStale.ruleCode).toBe('OFFLINE_CONFLICT');
  });

  it('preserves sample status during admin_correction with mandatory audit note', () => {
    const correction = validateCustodyTransition({
      currentStatus: 'dispatched',
      eventType: 'admin_correction',
      actorRole: 'admin',
      actorFacilityId: null,
      sourceFacilityId: CLINIC_A,
      destinationFacilityId: LAB_AJMER,
      isAssignedCourier: false,
      metadata: { correction_note: 'Clarified courier pouch tag number after phone check' },
    });

    expect(correction).toEqual({
      allowed: true,
      resultingStatus: 'dispatched',
    });
  });
});

describe('evaluatePostEventOperationalRules & getAllowedNextActions', () => {
  it('flags HANDOVER_GAP and TRANSIT_DELAY with operational-only guidance (no auto-rejection)', () => {
    const alerts = evaluatePostEventOperationalRules({
      eventType: 'lab_received',
      dispatchedAtIso: '2026-10-30T08:00:00.000Z',
      serverRecordedAtIso: '2026-10-30T13:30:00.000Z', // 330 min > 180 min SLA
      hasConfirmedCourierPickup: false,
      requireCourierPickupBeforeReceipt: true,
      operationalDelayMinutes: 180,
    });

    expect(alerts.map((a) => a.rule_code)).toEqual(['HANDOVER_GAP', 'TRANSIT_DELAY']);
    expect(String(alerts[1]?.details.medical_disclaimer)).toContain(
      'does NOT indicate specimen spoilage'
    );
  });

  it('computes role-aware next actions accurately', () => {
    expect(
      getAllowedNextActions('dispatched', 'courier', {
        isSourceFacility: false,
        isDestinationFacility: false,
        isAssignedCourier: true,
        hasCourierPickup: false,
      })
    ).toEqual(['courier_pickup']);

    expect(
      getAllowedNextActions('received', 'lab', {
        isSourceFacility: false,
        isDestinationFacility: true,
        isAssignedCourier: false,
        hasCourierPickup: true,
      })
    ).toEqual(['lab_accepted', 'lab_rejected']);
  });
});
