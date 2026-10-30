import { z } from 'zod';
import {
  EXCEPTION_ACTIONS,
  FACILITY_TYPES,
  SAMPLE_EVENT_TYPES,
  SPECIMEN_TYPES,
} from '@/types/domain';

export const OPAQUE_PUBLIC_CODE_REGEX = /^SS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;

/**
 * Guard against accidental entry of real phone numbers, emails, or Aadhaar/national ID patterns
 * in synthetic alias fields.
 */
const safeSyntheticText = (maxLen: number, label: string) =>
  z
    .string()
    .trim()
    .max(maxLen, `${label} must be ${maxLen} characters or fewer`)
    .refine((val) => !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(val), {
      message: `${label} cannot contain email addresses (no PHI allowed)`,
    })
    .refine((val) => !/\b\d{10,12}\b/.test(val.replace(/[\s-]/g, '')), {
      message: `${label} cannot contain phone or national ID numbers (synthetic codes only)`,
    });

export const createSampleSchema = z
  .object({
    source_facility_id: z.string().uuid('Select a valid collection clinic'),
    destination_facility_id: z.string().uuid('Select a valid receiving laboratory'),
    specimen_type: z
      .string()
      .trim()
      .min(2, 'Specimen type is required')
      .max(100, 'Specimen type is too long')
      .refine(
        (val) => (SPECIMEN_TYPES as readonly string[]).includes(val) || val.length >= 3,
        'Choose a valid specimen container type'
      ),
    case_alias: safeSyntheticText(48, 'Synthetic case alias').optional().or(z.literal('')),
    order_reference: safeSyntheticText(48, 'Synthetic order reference')
      .optional()
      .or(z.literal('')),
    collect_immediately: z.boolean().optional(),
  })
  .refine((data) => data.source_facility_id !== data.destination_facility_id, {
    message: 'Source clinic and destination laboratory must be different facilities',
    path: ['destination_facility_id'],
  });

export type CreateSampleInput = z.infer<typeof createSampleSchema>;

export const custodyEventMetadataSchema = z
  .object({
    handover_note: safeSyntheticText(280, 'Handover note').optional(),
    package_seal_intact: z.boolean().optional(),
    transport_observation: safeSyntheticText(180, 'Transport observation').optional(),
    assigned_courier_id: z.string().uuid().optional(),
    assigned_courier_name: safeSyntheticText(80, 'Assigned courier label').optional(),
    disposition_reason: safeSyntheticText(280, 'Disposition rationale').optional(),
    scanned_facility_id: z.string().uuid().optional(),
    correction_note: safeSyntheticText(280, 'Administrative correction note').optional(),
  })
  .strict();

export const submitCustodyEventSchema = z
  .object({
    client_event_id: z.string().uuid('client_event_id must be a valid UUID'),
    sample_public_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        OPAQUE_PUBLIC_CODE_REGEX,
        'Invalid SampleShield code format (expected SS-XXXX-XXXX-XXXX)'
      ),
    event_type: z.enum(SAMPLE_EVENT_TYPES),
    client_occurred_at: z.string().datetime({ offset: true }).optional(),
    was_queued_offline: z.boolean().optional().default(false),
    metadata: custodyEventMetadataSchema.optional().default({}),
  })
  .superRefine((val, ctx) => {
    if (val.event_type === 'sample_dispatched' && !val.metadata.assigned_courier_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Assigning an authorized courier is required before dispatch',
        path: ['metadata', 'assigned_courier_id'],
      });
    }
    if (
      val.event_type === 'lab_rejected' &&
      (!val.metadata.disposition_reason || val.metadata.disposition_reason.trim().length < 5)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Laboratory rejection requires a documented operational reason (min 5 characters)',
        path: ['metadata', 'disposition_reason'],
      });
    }
    if (
      val.event_type === 'admin_correction' &&
      (!val.metadata.correction_note || val.metadata.correction_note.trim().length < 5)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Administrative correction requires a documented audit note',
        path: ['metadata', 'correction_note'],
      });
    }
  });

export type SubmitCustodyEventInput = z.infer<typeof submitCustodyEventSchema>;

export const exceptionActionSchema = z.object({
  action: z.enum(EXCEPTION_ACTIONS),
  reason: safeSyntheticText(280, 'Review rationale').refine((v) => v.trim().length >= 4, {
    message: 'Provide at least 4 characters explaining this review action',
  }),
});

export type ExceptionActionInput = z.infer<typeof exceptionActionSchema>;

export const facilityPolicySchema = z.object({
  facility_id: z.string().uuid(),
  policy_name: safeSyntheticText(80, 'Policy name').refine((v) => v.trim().length >= 3, {
    message: 'Policy name is required',
  }),
  operational_delay_minutes: z
    .number()
    .int()
    .min(5, 'Minimum operational threshold is 5 minutes')
    .max(10080, 'Maximum threshold is 7 days (10080 minutes)'),
  require_courier_pickup_before_receipt: z.boolean(),
});

export type FacilityPolicyInput = z.infer<typeof facilityPolicySchema>;

export const createFacilitySchema = z.object({
  name: safeSyntheticText(80, 'Facility name').refine((v) => v.trim().length >= 3, {
    message: 'Facility name must be at least 3 characters',
  }),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,16}$/, 'Code must be 3-16 uppercase letters, numbers, or hyphens'),
  facility_type: z.enum(FACILITY_TYPES),
  location_label: safeSyntheticText(80, 'Location label').optional().or(z.literal('')),
});

export type CreateFacilityInput = z.infer<typeof createFacilitySchema>;

export const demoScenarioSchema = z.object({
  scenario: z.enum([
    'reset_clean',
    'happy_path',
    'wrong_destination',
    'offline_courier',
    'delayed_arrival',
    'duplicate_submission',
  ]),
});

export type DemoScenarioInput = z.infer<typeof demoScenarioSchema>;
