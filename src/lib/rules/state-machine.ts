import type {
  ApiErrorCode,
  CustodyEventMetadata,
  ExceptionRuleCode,
  ExceptionSeverity,
  MembershipRole,
  SampleEventType,
  SampleStatus,
} from '@/types/domain';

const CROCKFORD_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a high-entropy opaque SampleShield QR identifier (`SS-XXXX-XXXX-XXXX`).
 * Contains zero patient, facility, or medical data.
 */
export function generateOpaquePublicCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => CROCKFORD_ALPHABET[b % CROCKFORD_ALPHABET.length]);
  return `SS-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}

export interface TransitionRule {
  allowedFrom: readonly SampleStatus[];
  resultingStatus: SampleStatus | 'preserve';
  allowedRoles: readonly MembershipRole[];
  requiresSourceFacilityMatch?: boolean;
  requiresDestinationFacilityMatch?: boolean;
  requiresCourierAssignment?: boolean;
  requiresReasonField?: keyof CustodyEventMetadata;
}

export const CUSTODY_TRANSITION_RULES: Record<SampleEventType, TransitionRule> = {
  sample_created: {
    allowedFrom: [],
    resultingStatus: 'created',
    allowedRoles: ['collector', 'admin'],
    requiresSourceFacilityMatch: true,
  },
  sample_collected: {
    allowedFrom: ['created'],
    resultingStatus: 'collected',
    allowedRoles: ['collector', 'admin'],
    requiresSourceFacilityMatch: true,
  },
  sample_dispatched: {
    allowedFrom: ['collected'],
    resultingStatus: 'dispatched',
    allowedRoles: ['collector', 'admin'],
    requiresSourceFacilityMatch: true,
    requiresReasonField: 'assigned_courier_id',
  },
  courier_pickup: {
    allowedFrom: ['dispatched'],
    resultingStatus: 'dispatched',
    allowedRoles: ['courier', 'admin'],
    requiresCourierAssignment: true,
  },
  courier_dropoff: {
    allowedFrom: ['dispatched'],
    resultingStatus: 'dispatched',
    allowedRoles: ['courier', 'admin'],
    requiresCourierAssignment: true,
  },
  lab_received: {
    allowedFrom: ['dispatched'],
    resultingStatus: 'received',
    allowedRoles: ['lab', 'admin'],
    requiresDestinationFacilityMatch: true,
  },
  lab_accepted: {
    allowedFrom: ['received'],
    resultingStatus: 'accepted',
    allowedRoles: ['lab', 'admin'],
    requiresDestinationFacilityMatch: true,
  },
  lab_rejected: {
    allowedFrom: ['received'],
    resultingStatus: 'rejected',
    allowedRoles: ['lab', 'admin'],
    requiresDestinationFacilityMatch: true,
    requiresReasonField: 'disposition_reason',
  },
  admin_correction: {
    allowedFrom: ['created', 'collected', 'dispatched', 'received', 'accepted', 'rejected'],
    resultingStatus: 'preserve',
    allowedRoles: ['admin'],
    requiresReasonField: 'correction_note',
  },
};

export interface TransitionValidationContext {
  currentStatus: SampleStatus;
  eventType: SampleEventType;
  actorRole: MembershipRole;
  actorFacilityId: string | null;
  sourceFacilityId: string;
  destinationFacilityId: string;
  isAssignedCourier: boolean;
  wasQueuedOffline?: boolean;
  metadata?: CustodyEventMetadata;
}

export interface TransitionValidationOutcome {
  allowed: boolean;
  resultingStatus?: SampleStatus;
  errorCode?: ApiErrorCode;
  ruleCode?: ExceptionRuleCode;
  severity?: ExceptionSeverity;
  message?: string;
}

/**
 * Pure deterministic validation of custody transitions, mirroring the authoritative Postgres RPC.
 * Never performs autonomous clinical rejection.
 */
export function validateCustodyTransition(
  ctx: TransitionValidationContext
): TransitionValidationOutcome {
  const rule = CUSTODY_TRANSITION_RULES[ctx.eventType];
  if (!rule) {
    return {
      allowed: false,
      errorCode: 'BAD_REQUEST',
      ruleCode: 'INVALID_TRANSITION',
      severity: 'high',
      message: `Unsupported custody event type: ${ctx.eventType}`,
    };
  }

  // 1. Role check
  if (!rule.allowedRoles.includes(ctx.actorRole)) {
    return {
      allowed: false,
      errorCode: 'FORBIDDEN',
      ruleCode: 'INVALID_TRANSITION',
      severity: 'high',
      message: `Role '${ctx.actorRole}' is not permitted to record '${ctx.eventType}'. Only ${rule.allowedRoles.join(' or ')} may perform this action.`,
    };
  }

  // 2. Destination mismatch check (specifically for receiving laboratory actions)
  const effectiveScannedFacility = ctx.metadata?.scanned_facility_id ?? ctx.actorFacilityId;
  if (
    rule.requiresDestinationFacilityMatch &&
    ctx.actorRole !== 'admin' &&
    effectiveScannedFacility !== ctx.destinationFacilityId
  ) {
    return {
      allowed: false,
      errorCode: 'DESTINATION_MISMATCH',
      ruleCode: 'DESTINATION_MISMATCH',
      severity: 'high',
      message:
        'Sample destination laboratory does not match your authorized receiving laboratory. Receipt blocked and logged for operational review.',
    };
  }
  if (
    rule.requiresDestinationFacilityMatch &&
    ctx.actorRole === 'admin' &&
    ctx.metadata?.scanned_facility_id &&
    ctx.metadata.scanned_facility_id !== ctx.destinationFacilityId
  ) {
    return {
      allowed: false,
      errorCode: 'DESTINATION_MISMATCH',
      ruleCode: 'DESTINATION_MISMATCH',
      severity: 'high',
      message:
        'Scanned facility does not match designated destination laboratory. Silent redirection is prohibited.',
    };
  }

  // 3. Source facility check for collectors
  if (
    rule.requiresSourceFacilityMatch &&
    ctx.actorRole === 'collector' &&
    ctx.actorFacilityId &&
    ctx.actorFacilityId !== ctx.sourceFacilityId
  ) {
    return {
      allowed: false,
      errorCode: 'FORBIDDEN',
      ruleCode: 'INVALID_TRANSITION',
      severity: 'high',
      message: 'Collector belongs to a different clinic than the sample source facility.',
    };
  }

  // 4. Courier assignment check
  if (rule.requiresCourierAssignment && ctx.actorRole === 'courier' && !ctx.isAssignedCourier) {
    return {
      allowed: false,
      errorCode: ctx.wasQueuedOffline ? 'CONFLICT' : 'FORBIDDEN',
      ruleCode: ctx.wasQueuedOffline ? 'OFFLINE_CONFLICT' : 'INVALID_TRANSITION',
      severity: ctx.wasQueuedOffline ? 'medium' : 'high',
      message: ctx.wasQueuedOffline
        ? 'Courier assignment is no longer active for this queued offline handover. Marked Needs review.'
        : 'Courier is not actively assigned to transport this sample.',
    };
  }

  // 5. Required metadata field check
  if (rule.requiresReasonField) {
    const val = ctx.metadata?.[rule.requiresReasonField];
    if (typeof val !== 'string' || val.trim().length === 0) {
      return {
        allowed: false,
        errorCode: 'BAD_REQUEST',
        ruleCode: 'MISSING_REQUIRED_FIELD',
        severity: 'blocker',
        message: `Required operational field '${rule.requiresReasonField}' is missing.`,
      };
    }
  }

  // 6. State machine check
  if (!rule.allowedFrom.includes(ctx.currentStatus)) {
    const isOfflineConflict = Boolean(ctx.wasQueuedOffline);
    return {
      allowed: false,
      errorCode: isOfflineConflict ? 'CONFLICT' : 'INVALID_STATE',
      ruleCode: isOfflineConflict ? 'OFFLINE_CONFLICT' : 'INVALID_TRANSITION',
      severity: isOfflineConflict ? 'medium' : 'high',
      message: isOfflineConflict
        ? `Queued offline '${ctx.eventType}' conflicts with confirmed server status '${ctx.currentStatus}'. Needs human review.`
        : `Cannot record '${ctx.eventType}' when sample status is '${ctx.currentStatus}'.`,
    };
  }

  const resultingStatus =
    rule.resultingStatus === 'preserve' ? ctx.currentStatus : rule.resultingStatus;

  return {
    allowed: true,
    resultingStatus,
  };
}

export interface PostEventRuleInput {
  eventType: SampleEventType;
  dispatchedAtIso: string | null;
  serverRecordedAtIso: string;
  hasConfirmedCourierPickup: boolean;
  requireCourierPickupBeforeReceipt: boolean;
  operationalDelayMinutes: number | null;
}

export interface DetectedOperationalAlert {
  rule_code: ExceptionRuleCode;
  severity: ExceptionSeverity;
  title: string;
  details: Record<string, unknown>;
}

/**
 * Evaluates post-event operational alerts (HANDOVER_GAP, TRANSIT_DELAY).
 * Explicitly operational-only — never makes a clinical specimen viability claim.
 */
export function evaluatePostEventOperationalRules(
  input: PostEventRuleInput
): DetectedOperationalAlert[] {
  const alerts: DetectedOperationalAlert[] = [];

  if (
    input.eventType === 'lab_received' &&
    input.requireCourierPickupBeforeReceipt &&
    !input.hasConfirmedCourierPickup
  ) {
    alerts.push({
      rule_code: 'HANDOVER_GAP',
      severity: 'medium',
      title: 'Missing courier pickup acknowledgment before laboratory receipt',
      details: {
        expected_step: 'courier_pickup',
        observed_event: 'lab_received',
        guidance:
          'Verify physical transport chain with courier and collection clinic before disposition.',
      },
    });
  }

  if (
    (input.eventType === 'lab_received' || input.eventType === 'courier_dropoff') &&
    input.dispatchedAtIso &&
    input.operationalDelayMinutes &&
    input.operationalDelayMinutes > 0
  ) {
    const dispatchedMs = Date.parse(input.dispatchedAtIso);
    const recordedMs = Date.parse(input.serverRecordedAtIso);
    if (!Number.isNaN(dispatchedMs) && !Number.isNaN(recordedMs)) {
      const elapsedMinutes = Math.round((recordedMs - dispatchedMs) / 60000);
      if (elapsedMinutes > input.operationalDelayMinutes) {
        alerts.push({
          rule_code: 'TRANSIT_DELAY',
          severity: 'medium',
          title: `Transit duration (${elapsedMinutes} min) exceeded operational SLA (${input.operationalDelayMinutes} min)`,
          details: {
            elapsed_minutes: elapsedMinutes,
            operational_delay_minutes: input.operationalDelayMinutes,
            policy_type: 'synthetic_operational_sla',
            medical_disclaimer:
              'Operational review threshold only — does NOT indicate specimen spoilage. Authorized laboratory staff must determine disposition.',
          },
        });
      }
    }
  }

  return alerts;
}

export function getAllowedNextActions(
  status: SampleStatus,
  role: MembershipRole,
  options: {
    isSourceFacility: boolean;
    isDestinationFacility: boolean;
    isAssignedCourier: boolean;
    hasCourierPickup: boolean;
  }
): SampleEventType[] {
  const actions: SampleEventType[] = [];

  if (status === 'created' && (role === 'admin' || (role === 'collector' && options.isSourceFacility))) {
    actions.push('sample_collected');
  }
  if (
    status === 'collected' &&
    (role === 'admin' || (role === 'collector' && options.isSourceFacility))
  ) {
    actions.push('sample_dispatched');
  }
  if (status === 'dispatched') {
    if (role === 'admin' || (role === 'courier' && options.isAssignedCourier)) {
      if (!options.hasCourierPickup) {
        actions.push('courier_pickup');
      } else {
        actions.push('courier_dropoff');
      }
    }
    if (role === 'admin' || (role === 'lab' && options.isDestinationFacility)) {
      actions.push('lab_received');
    }
  }
  if (status === 'received' && (role === 'admin' || (role === 'lab' && options.isDestinationFacility))) {
    actions.push('lab_accepted', 'lab_rejected');
  }

  return actions;
}
