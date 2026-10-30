export const MEMBERSHIP_ROLES = ['collector', 'courier', 'lab', 'admin'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const FACILITY_TYPES = ['clinic', 'lab'] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const SAMPLE_STATUSES = [
  'created',
  'collected',
  'dispatched',
  'received',
  'accepted',
  'rejected',
] as const;
export type SampleStatus = (typeof SAMPLE_STATUSES)[number];

export const SAMPLE_EVENT_TYPES = [
  'sample_created',
  'sample_collected',
  'sample_dispatched',
  'courier_pickup',
  'courier_dropoff',
  'lab_received',
  'lab_accepted',
  'lab_rejected',
  'admin_correction',
] as const;
export type SampleEventType = (typeof SAMPLE_EVENT_TYPES)[number];

export const EXCEPTION_RULE_CODES = [
  'MISSING_REQUIRED_FIELD',
  'DESTINATION_MISMATCH',
  'HANDOVER_GAP',
  'TRANSIT_DELAY',
  'DUPLICATE_EVENT',
  'INVALID_TRANSITION',
  'OFFLINE_CONFLICT',
] as const;
export type ExceptionRuleCode = (typeof EXCEPTION_RULE_CODES)[number];

export const EXCEPTION_SEVERITIES = ['blocker', 'high', 'medium', 'info'] as const;
export type ExceptionSeverity = (typeof EXCEPTION_SEVERITIES)[number];

export const EXCEPTION_STATUSES = ['open', 'acknowledged', 'resolved'] as const;
export type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number];

export const EXCEPTION_ACTIONS = ['acknowledge', 'resolve', 'reopen'] as const;
export type ExceptionActionType = (typeof EXCEPTION_ACTIONS)[number];

export const LOCAL_SYNC_STATES = [
  'queued',
  'syncing',
  'synced',
  'conflict',
  'failed_retriable',
] as const;
export type LocalSyncState = (typeof LOCAL_SYNC_STATES)[number];

export const API_ERROR_CODES = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INVALID_STATE',
  'CONFLICT',
  'BAD_REQUEST',
  'DESTINATION_MISMATCH',
  'NOT_FOUND',
  'OFFLINE_PENDING',
  'SERVER_ERROR',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const SPECIMEN_TYPES = [
  'Whole Blood (EDTA Tube)',
  'Serum Separator Tube (SST)',
  'Sputum Sterile Container',
  'Viral Transport Medium Swab',
  'Urine Sterile Cup',
  'Dried Blood Spot Card',
] as const;

export interface Organization {
  id: string;
  name: string;
  slug: string;
  is_demo: boolean;
  created_at: string;
}

export interface Facility {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  facility_type: FacilityType;
  location_label: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Membership {
  id: string;
  organization_id: string;
  user_id: string;
  display_name: string;
  email: string;
  facility_id: string | null;
  role: MembershipRole;
  is_active: boolean;
  created_at: string;
  organization?: Organization;
  facility?: Facility | null;
}

export interface CustodyEventMetadata {
  handover_note?: string;
  package_seal_intact?: boolean;
  transport_observation?: string;
  assigned_courier_id?: string;
  assigned_courier_name?: string;
  disposition_reason?: string;
  scanned_facility_id?: string;
  correction_note?: string;
}

export interface SampleRecord {
  id: string;
  organization_id: string;
  public_code: string;
  source_facility_id: string;
  destination_facility_id: string;
  specimen_type: string;
  case_alias: string | null;
  order_reference: string | null;
  status: SampleStatus;
  custody_holder_user_id: string | null;
  disposition_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_demo: boolean;
  source_facility?: Pick<Facility, 'id' | 'name' | 'code' | 'facility_type' | 'location_label'>;
  destination_facility?: Pick<Facility, 'id' | 'name' | 'code' | 'facility_type' | 'location_label'>;
  open_exceptions_count?: number;
}

export interface SampleEventRecord {
  id: string;
  organization_id: string;
  sample_id: string;
  client_event_id: string;
  event_type: SampleEventType;
  previous_status: SampleStatus | null;
  resulting_status: SampleStatus;
  actor_user_id: string;
  actor_role: MembershipRole;
  actor_name: string;
  actor_facility_id: string | null;
  client_occurred_at: string | null;
  server_recorded_at: string;
  was_queued_offline: boolean;
  metadata: CustodyEventMetadata;
  created_at: string;
}

export interface SampleAssignmentRecord {
  id: string;
  organization_id: string;
  sample_id: string;
  courier_user_id: string;
  assigned_by: string;
  assigned_at: string;
  is_active: boolean;
}

export interface ExceptionRecord {
  id: string;
  organization_id: string;
  sample_id: string;
  causal_event_id: string | null;
  rule_code: ExceptionRuleCode;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  title: string;
  details: Record<string, unknown>;
  detected_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_reason: string | null;
  sample?: Pick<SampleRecord, 'id' | 'public_code' | 'specimen_type' | 'status' | 'is_demo'>;
}

export interface ExceptionActionRecord {
  id: string;
  organization_id: string;
  exception_id: string;
  actor_user_id: string;
  actor_name: string;
  action: ExceptionActionType;
  reason: string;
  created_at: string;
}

export interface FacilityPolicyRecord {
  id: string;
  organization_id: string;
  facility_id: string;
  policy_name: string;
  operational_delay_minutes: number;
  require_courier_pickup_before_receipt: boolean;
  is_demo_policy: boolean;
  scope_note: string;
  updated_by: string | null;
  updated_at: string;
}

export interface OfflineQueuedEvent {
  client_event_id: string;
  organization_id: string;
  actor_user_id: string;
  sample_id?: string;
  sample_public_code: string;
  specimen_type?: string;
  destination_label?: string;
  event_type: SampleEventType;
  client_occurred_at: string;
  metadata: CustodyEventMetadata;
  sync_state: LocalSyncState;
  retry_count: number;
  next_retry_at: number | null;
  last_error_code: ApiErrorCode | null;
  last_error_message: string | null;
  server_event_id: string | null;
  server_recorded_at: string | null;
  created_at_ms: number;
  updated_at_ms: number;
}

export interface CachedCourierAssignment {
  sample_id: string;
  organization_id: string;
  courier_user_id: string;
  public_code: string;
  specimen_type: string;
  source_facility_name: string;
  source_facility_code: string;
  destination_facility_id: string;
  destination_facility_name: string;
  destination_facility_code: string;
  last_known_status: SampleStatus;
  has_courier_pickup: boolean;
  has_courier_dropoff: boolean;
  is_demo: boolean;
  cached_at: string;
}

export interface RpcMutationResult<T = unknown> {
  ok: boolean;
  error_code?: ApiErrorCode;
  message?: string;
  idempotent_replay?: boolean;
  exception_id?: string | null;
  current_status?: SampleStatus | null;
  data?: T;
}
