-- ============================================================================
-- SampleShield — Initial Multi-Tenant Schema, Strict RLS & Atomic Custody RPCs
-- Operational chain-of-custody visibility only. Zero real PHI.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

-- ----------------------------------------------------------------------------
-- 1. Domain Enums
-- ----------------------------------------------------------------------------

CREATE TYPE public.facility_type AS ENUM ('clinic', 'lab');
CREATE TYPE public.membership_role AS ENUM ('collector', 'courier', 'lab', 'admin');
CREATE TYPE public.sample_status AS ENUM (
  'created',
  'collected',
  'dispatched',
  'received',
  'accepted',
  'rejected'
);
CREATE TYPE public.sample_event_type AS ENUM (
  'sample_created',
  'sample_collected',
  'sample_dispatched',
  'courier_pickup',
  'courier_dropoff',
  'lab_received',
  'lab_accepted',
  'lab_rejected',
  'admin_correction'
);
CREATE TYPE public.exception_rule_code AS ENUM (
  'MISSING_REQUIRED_FIELD',
  'DESTINATION_MISMATCH',
  'HANDOVER_GAP',
  'TRANSIT_DELAY',
  'DUPLICATE_EVENT',
  'INVALID_TRANSITION',
  'OFFLINE_CONFLICT'
);
CREATE TYPE public.exception_severity AS ENUM ('blocker', 'high', 'medium', 'info');
CREATE TYPE public.exception_status AS ENUM ('open', 'acknowledged', 'resolved');
CREATE TYPE public.exception_action_type AS ENUM ('acknowledge', 'resolve', 'reopen');

-- ----------------------------------------------------------------------------
-- 2. Core Normalized Multi-Tenant Tables
-- ----------------------------------------------------------------------------

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    CONSTRAINT facilities_organization_id_fkey
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  code text NOT NULL CHECK (code ~ '^[A-Z0-9-]{3,20}$'),
  facility_type public.facility_type NOT NULL,
  location_label text CHECK (location_label IS NULL OR char_length(location_label) <= 120),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facilities_org_code_unique UNIQUE (organization_id, code),
  CONSTRAINT facilities_id_org_unique UNIQUE (id, organization_id)
);

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    CONSTRAINT memberships_organization_id_fkey
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 100),
  email text NOT NULL CHECK (char_length(btrim(email)) BETWEEN 3 AND 160),
  facility_id uuid,
  role public.membership_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_org_user_unique UNIQUE (organization_id, user_id),
  CONSTRAINT memberships_facility_org_fkey
    FOREIGN KEY (facility_id, organization_id)
    REFERENCES public.facilities(id, organization_id)
);

CREATE TABLE public.samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    CONSTRAINT samples_organization_id_fkey
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_code text NOT NULL UNIQUE
    CHECK (public_code ~ '^SS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$'),
  source_facility_id uuid NOT NULL,
  destination_facility_id uuid NOT NULL,
  specimen_type text NOT NULL CHECK (char_length(btrim(specimen_type)) BETWEEN 2 AND 100),
  case_alias text CHECK (case_alias IS NULL OR char_length(case_alias) <= 64),
  order_reference text CHECK (order_reference IS NULL OR char_length(order_reference) <= 64),
  status public.sample_status NOT NULL DEFAULT 'created',
  custody_holder_user_id uuid REFERENCES auth.users(id),
  disposition_reason text CHECK (disposition_reason IS NULL OR char_length(disposition_reason) <= 320),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_demo boolean NOT NULL DEFAULT false,
  CONSTRAINT samples_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT samples_distinct_facilities CHECK (source_facility_id <> destination_facility_id),
  CONSTRAINT samples_source_facility_fkey
    FOREIGN KEY (source_facility_id, organization_id)
    REFERENCES public.facilities(id, organization_id),
  CONSTRAINT samples_destination_facility_fkey
    FOREIGN KEY (destination_facility_id, organization_id)
    REFERENCES public.facilities(id, organization_id)
);

CREATE TABLE public.sample_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sample_id uuid NOT NULL,
  courier_user_id uuid NOT NULL REFERENCES auth.users(id),
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT sample_assignments_sample_org_fkey
    FOREIGN KEY (sample_id, organization_id)
    REFERENCES public.samples(id, organization_id) ON DELETE CASCADE
);

CREATE TABLE public.sample_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sample_id uuid NOT NULL,
  client_event_id uuid NOT NULL,
  event_type public.sample_event_type NOT NULL,
  previous_status public.sample_status,
  resulting_status public.sample_status NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  actor_role public.membership_role NOT NULL,
  actor_name text NOT NULL,
  actor_facility_id uuid,
  client_occurred_at timestamptz,
  server_recorded_at timestamptz NOT NULL DEFAULT now(),
  was_queued_offline boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sample_events_org_client_event_unique UNIQUE (organization_id, client_event_id),
  CONSTRAINT sample_events_sample_org_fkey
    FOREIGN KEY (sample_id, organization_id)
    REFERENCES public.samples(id, organization_id) ON DELETE CASCADE
);

CREATE TABLE public.rejected_event_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sample_id uuid,
  client_event_id uuid,
  attempted_event_type text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  error_code text NOT NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sample_id uuid NOT NULL,
  causal_event_id uuid REFERENCES public.sample_events(id) ON DELETE SET NULL,
  rule_code public.exception_rule_code NOT NULL,
  severity public.exception_severity NOT NULL,
  status public.exception_status NOT NULL DEFAULT 'open',
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 240),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  resolution_reason text,
  CONSTRAINT exceptions_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT exceptions_sample_org_fkey
    FOREIGN KEY (sample_id, organization_id)
    REFERENCES public.samples(id, organization_id) ON DELETE CASCADE
);

CREATE TABLE public.exception_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  exception_id uuid NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  actor_name text NOT NULL,
  action public.exception_action_type NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 320),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exception_actions_exception_org_fkey
    FOREIGN KEY (exception_id, organization_id)
    REFERENCES public.exceptions(id, organization_id) ON DELETE CASCADE
);

CREATE TABLE public.facility_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL,
  policy_name text NOT NULL CHECK (char_length(btrim(policy_name)) BETWEEN 3 AND 120),
  operational_delay_minutes integer NOT NULL DEFAULT 180
    CHECK (operational_delay_minutes BETWEEN 5 AND 10080),
  require_courier_pickup_before_receipt boolean NOT NULL DEFAULT true,
  is_demo_policy boolean NOT NULL DEFAULT true,
  scope_note text NOT NULL DEFAULT 'Operational workflow threshold only — never a clinical specimen stability limit.',
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facility_policies_org_facility_unique UNIQUE (organization_id, facility_id),
  CONSTRAINT facility_policies_facility_org_fkey
    FOREIGN KEY (facility_id, organization_id)
    REFERENCES public.facilities(id, organization_id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 3. Indexes for RLS & Query Performance
-- ----------------------------------------------------------------------------

CREATE INDEX facilities_org_idx ON public.facilities (organization_id, facility_type);
CREATE INDEX memberships_user_active_idx ON public.memberships (user_id, is_active);
CREATE INDEX memberships_org_role_idx ON public.memberships (organization_id, role, is_active);
CREATE INDEX samples_org_status_created_idx ON public.samples (organization_id, status, created_at DESC);
CREATE INDEX samples_dest_status_idx ON public.samples (destination_facility_id, status);
CREATE INDEX samples_source_status_idx ON public.samples (source_facility_id, status);
CREATE UNIQUE INDEX sample_assignments_active_unique
  ON public.sample_assignments (sample_id, courier_user_id)
  WHERE is_active = true;
CREATE INDEX sample_assignments_courier_active_idx
  ON public.sample_assignments (courier_user_id, is_active, sample_id);
CREATE INDEX sample_events_sample_recorded_idx
  ON public.sample_events (sample_id, server_recorded_at ASC);
CREATE INDEX sample_events_org_recorded_idx
  ON public.sample_events (organization_id, server_recorded_at DESC);
CREATE UNIQUE INDEX exceptions_active_sample_rule_unique
  ON public.exceptions (sample_id, rule_code)
  WHERE status IN ('open', 'acknowledged');
CREATE INDEX exceptions_org_status_detected_idx
  ON public.exceptions (organization_id, status, detected_at DESC);
CREATE INDEX exception_actions_exception_idx
  ON public.exception_actions (exception_id, created_at ASC);

-- ----------------------------------------------------------------------------
-- 4. Append-Only Audit Ledger Enforcement
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('sampleshield.allow_demo_reset', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Audit ledger records (%) are append-only and cannot be modified or deleted.', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_audit_mutation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sample_events_append_only
  BEFORE UPDATE OR DELETE ON public.sample_events
  FOR EACH ROW EXECUTE FUNCTION private.prevent_audit_mutation();

CREATE TRIGGER trg_exception_actions_append_only
  BEFORE UPDATE OR DELETE ON public.exception_actions
  FOR EACH ROW EXECUTE FUNCTION private.prevent_audit_mutation();

-- ----------------------------------------------------------------------------
-- 5. Private RLS Helper Functions (Non-Exposed Schema, Indexed Lookups)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.organization_id = p_org_id
      AND m.user_id = (SELECT auth.uid())
      AND m.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION private.has_org_role(
  p_org_id uuid,
  p_roles public.membership_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.organization_id = p_org_id
      AND m.user_id = (SELECT auth.uid())
      AND m.is_active = true
      AND m.role = ANY(p_roles)
  );
$$;

CREATE OR REPLACE FUNCTION private.is_assigned_courier(p_sample_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sample_assignments sa
    JOIN public.memberships m
      ON m.organization_id = sa.organization_id
     AND m.user_id = sa.courier_user_id
    WHERE sa.sample_id = p_sample_id
      AND sa.courier_user_id = (SELECT auth.uid())
      AND sa.is_active = true
      AND m.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION private.can_read_sample(p_org_id uuid, p_sample_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    private.has_org_role(
      p_org_id,
      ARRAY['collector', 'lab', 'admin']::public.membership_role[]
    )
    OR (
      private.has_org_role(p_org_id, ARRAY['courier']::public.membership_role[])
      AND private.is_assigned_courier(p_sample_id)
    );
$$;

REVOKE ALL ON FUNCTION private.is_org_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_org_role(uuid, public.membership_role[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_assigned_courier(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_read_sample(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_org_role(uuid, public.membership_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_assigned_courier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_sample(uuid, uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. Strict Least-Privilege Grants & Row Level Security
-- ----------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Authenticated clients receive SELECT ONLY; all writes MUST flow through validated atomic RPCs.
GRANT SELECT ON
  public.organizations,
  public.facilities,
  public.memberships,
  public.samples,
  public.sample_assignments,
  public.sample_events,
  public.rejected_event_attempts,
  public.exceptions,
  public.exception_actions,
  public.facility_policies
TO authenticated;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities FORCE ROW LEVEL SECURITY;

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.samples FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sample_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sample_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.rejected_event_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rejected_event_attempts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exceptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.exception_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exception_actions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.facility_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_policies FORCE ROW LEVEL SECURITY;

CREATE POLICY organizations_select_member
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING ((SELECT private.is_org_member(id)));

CREATE POLICY facilities_select_member
  ON public.facilities
  FOR SELECT
  TO authenticated
  USING ((SELECT private.is_org_member(organization_id)));

CREATE POLICY memberships_select_member
  ON public.memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT private.is_org_member(organization_id))
  );

CREATE POLICY samples_select_scoped
  ON public.samples
  FOR SELECT
  TO authenticated
  USING ((SELECT private.can_read_sample(organization_id, id)));

CREATE POLICY sample_assignments_select_scoped
  ON public.sample_assignments
  FOR SELECT
  TO authenticated
  USING (
    (SELECT private.has_org_role(
      organization_id,
      ARRAY['collector', 'lab', 'admin']::public.membership_role[]
    ))
    OR (
      courier_user_id = (SELECT auth.uid())
      AND is_active = true
      AND (SELECT private.is_org_member(organization_id))
    )
  );

CREATE POLICY sample_events_select_scoped
  ON public.sample_events
  FOR SELECT
  TO authenticated
  USING ((SELECT private.can_read_sample(organization_id, sample_id)));

CREATE POLICY rejected_event_attempts_select_scoped
  ON public.rejected_event_attempts
  FOR SELECT
  TO authenticated
  USING (
    actor_user_id = (SELECT auth.uid())
    OR (SELECT private.has_org_role(
      organization_id,
      ARRAY['lab', 'admin']::public.membership_role[]
    ))
  );

CREATE POLICY exceptions_select_scoped
  ON public.exceptions
  FOR SELECT
  TO authenticated
  USING (
    (SELECT private.has_org_role(
      organization_id,
      ARRAY['collector', 'lab', 'admin']::public.membership_role[]
    ))
  );

CREATE POLICY exception_actions_select_scoped
  ON public.exception_actions
  FOR SELECT
  TO authenticated
  USING (
    (SELECT private.has_org_role(
      organization_id,
      ARRAY['collector', 'lab', 'admin']::public.membership_role[]
    ))
  );

CREATE POLICY facility_policies_select_member
  ON public.facility_policies
  FOR SELECT
  TO authenticated
  USING ((SELECT private.is_org_member(organization_id)));

-- ----------------------------------------------------------------------------
-- 7. Internal Helpers for Opaque Code & Sanitized Metadata
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.generate_unique_public_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes bytea;
  v_chars text;
  v_code text;
  i integer;
BEGIN
  LOOP
    v_bytes := extensions.gen_random_bytes(12);
    v_chars := '';
    FOR i IN 0..11 LOOP
      v_chars := v_chars || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    END LOOP;
    v_code := 'SS-' || substr(v_chars, 1, 4) || '-' || substr(v_chars, 5, 4) || '-' || substr(v_chars, 9, 4);

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.samples s WHERE s.public_code = v_code
    );
  END LOOP;

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION private.sanitize_event_metadata(p_raw jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_object_agg(key, value)
      FROM jsonb_each(COALESCE(p_raw, '{}'::jsonb))
      WHERE key = ANY(ARRAY[
        'handover_note',
        'package_seal_intact',
        'transport_observation',
        'assigned_courier_id',
        'assigned_courier_name',
        'disposition_reason',
        'scanned_facility_id',
        'correction_note'
      ])
    ),
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION private.ensure_open_exception(
  p_org_id uuid,
  p_sample_id uuid,
  p_causal_event_id uuid,
  p_rule_code public.exception_rule_code,
  p_severity public.exception_severity,
  p_title text,
  p_details jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT e.id
    INTO v_existing_id
  FROM public.exceptions e
  WHERE e.sample_id = p_sample_id
    AND e.rule_code = p_rule_code
    AND e.status IN ('open', 'acknowledged')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO public.exceptions (
    organization_id,
    sample_id,
    causal_event_id,
    rule_code,
    severity,
    status,
    title,
    details
  )
  VALUES (
    p_org_id,
    p_sample_id,
    p_causal_event_id,
    p_rule_code,
    p_severity,
    'open',
    p_title,
    COALESCE(p_details, '{}'::jsonb)
  )
  RETURNING id INTO v_existing_id;

  RETURN v_existing_id;
END;
$$;

REVOKE ALL ON FUNCTION private.generate_unique_public_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sanitize_event_metadata(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.ensure_open_exception(uuid, uuid, uuid, public.exception_rule_code, public.exception_severity, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. Authoritative Server RPCs
-- ----------------------------------------------------------------------------

-- 8A. Create Sample Atomically (Collector / Admin)
CREATE OR REPLACE FUNCTION public.create_sample_atomic(
  p_source_facility_id uuid,
  p_destination_facility_id uuid,
  p_specimen_type text,
  p_case_alias text DEFAULT NULL,
  p_order_reference text DEFAULT NULL,
  p_collect_immediately boolean DEFAULT false,
  p_client_event_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_membership public.memberships%ROWTYPE;
  v_org public.organizations%ROWTYPE;
  v_source public.facilities%ROWTYPE;
  v_dest public.facilities%ROWTYPE;
  v_existing_event public.sample_events%ROWTYPE;
  v_existing_sample public.samples%ROWTYPE;
  v_sample public.samples%ROWTYPE;
  v_created_event public.sample_events%ROWTYPE;
  v_collected_event public.sample_events%ROWTYPE;
  v_public_code text;
  v_event_id uuid := COALESCE(p_client_event_id, gen_random_uuid());
  v_collect_event_id uuid;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'UNAUTHORIZED',
      'message', 'Authentication required to register a sample.'
    );
  END IF;

  SELECT m.* INTO v_membership
  FROM public.memberships m
  WHERE m.user_id = v_user_id
    AND m.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'FORBIDDEN',
      'message', 'No active organization membership found for current account.'
    );
  END IF;

  IF v_membership.role NOT IN ('collector', 'admin') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'FORBIDDEN',
      'message', 'Only authorized clinic collectors or administrators may create samples.'
    );
  END IF;

  -- Idempotency check
  SELECT se.* INTO v_existing_event
  FROM public.sample_events se
  WHERE se.organization_id = v_membership.organization_id
    AND se.client_event_id = v_event_id
  LIMIT 1;

  IF FOUND THEN
    SELECT s.* INTO v_existing_sample
    FROM public.samples s
    WHERE s.id = v_existing_event.sample_id;

    RETURN jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'data', jsonb_build_object(
        'sample', to_jsonb(v_existing_sample),
        'event', to_jsonb(v_existing_event)
      )
    );
  END IF;

  IF p_specimen_type IS NULL OR char_length(btrim(p_specimen_type)) < 2 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'BAD_REQUEST',
      'message', 'Required field specimen_type is missing.'
    );
  END IF;

  IF p_source_facility_id IS NULL OR p_destination_facility_id IS NULL OR p_source_facility_id = p_destination_facility_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'BAD_REQUEST',
      'message', 'Valid distinct source clinic and destination laboratory are required.'
    );
  END IF;

  SELECT o.* INTO v_org
  FROM public.organizations o
  WHERE o.id = v_membership.organization_id;

  SELECT f.* INTO v_source
  FROM public.facilities f
  WHERE f.id = p_source_facility_id
    AND f.organization_id = v_membership.organization_id
    AND f.is_active = true;

  IF NOT FOUND OR v_source.facility_type <> 'clinic' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'BAD_REQUEST',
      'message', 'Selected source facility is not an active collection clinic in your organization.'
    );
  END IF;

  IF v_membership.role = 'collector' AND v_membership.facility_id IS NOT NULL AND v_membership.facility_id <> v_source.id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'FORBIDDEN',
      'message', 'Collectors may only register samples for their assigned collection clinic.'
    );
  END IF;

  SELECT f.* INTO v_dest
  FROM public.facilities f
  WHERE f.id = p_destination_facility_id
    AND f.organization_id = v_membership.organization_id
    AND f.is_active = true;

  IF NOT FOUND OR v_dest.facility_type <> 'lab' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'BAD_REQUEST',
      'message', 'Selected destination facility is not an active receiving laboratory in your organization.'
    );
  END IF;

  v_public_code := private.generate_unique_public_code();

  INSERT INTO public.samples (
    organization_id,
    public_code,
    source_facility_id,
    destination_facility_id,
    specimen_type,
    case_alias,
    order_reference,
    status,
    custody_holder_user_id,
    created_by,
    is_demo
  )
  VALUES (
    v_membership.organization_id,
    v_public_code,
    v_source.id,
    v_dest.id,
    btrim(p_specimen_type),
    NULLIF(btrim(COALESCE(p_case_alias, '')), ''),
    NULLIF(btrim(COALESCE(p_order_reference, '')), ''),
    CASE WHEN p_collect_immediately THEN 'collected'::public.sample_status ELSE 'created'::public.sample_status END,
    v_user_id,
    v_user_id,
    v_org.is_demo
  )
  RETURNING * INTO v_sample;

  INSERT INTO public.sample_events (
    organization_id,
    sample_id,
    client_event_id,
    event_type,
    previous_status,
    resulting_status,
    actor_user_id,
    actor_role,
    actor_name,
    actor_facility_id,
    client_occurred_at,
    was_queued_offline,
    metadata
  )
  VALUES (
    v_membership.organization_id,
    v_sample.id,
    v_event_id,
    'sample_created',
    NULL,
    'created',
    v_user_id,
    v_membership.role,
    v_membership.display_name,
    v_source.id,
    now(),
    false,
    jsonb_build_object('handover_note', 'Sample registered with opaque QR passport')
  )
  RETURNING * INTO v_created_event;

  IF p_collect_immediately THEN
    v_collect_event_id := extensions.gen_random_uuid();
    INSERT INTO public.sample_events (
      organization_id,
      sample_id,
      client_event_id,
      event_type,
      previous_status,
      resulting_status,
      actor_user_id,
      actor_role,
      actor_name,
      actor_facility_id,
      client_occurred_at,
      was_queued_offline,
      metadata
    )
    VALUES (
      v_membership.organization_id,
      v_sample.id,
      v_collect_event_id,
      'sample_collected',
      'created',
      'collected',
      v_user_id,
      v_membership.role,
      v_membership.display_name,
      v_source.id,
      now(),
      false,
      jsonb_build_object('handover_note', 'Specimen container verified and collected at clinic')
    )
    RETURNING * INTO v_collected_event;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent_replay', false,
    'data', jsonb_build_object(
      'sample', to_jsonb(v_sample),
      'event', to_jsonb(COALESCE(v_collected_event, v_created_event))
    )
  );
END;
$$;

-- 8B. Submit Custody Event Atomically with Idempotency, RBAC & Deterministic Exception Detection
CREATE OR REPLACE FUNCTION public.submit_custody_event(
  p_client_event_id uuid,
  p_sample_public_code text,
  p_event_type public.sample_event_type,
  p_client_occurred_at timestamptz DEFAULT NULL,
  p_was_queued_offline boolean DEFAULT false,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_membership public.memberships%ROWTYPE;
  v_sample public.samples%ROWTYPE;
  v_existing_event public.sample_events%ROWTYPE;
  v_inserted_event public.sample_events%ROWTYPE;
  v_courier_membership public.memberships%ROWTYPE;
  v_policy public.facility_policies%ROWTYPE;
  v_clean_meta jsonb;
  v_scanned_facility_id uuid;
  v_assigned_courier_id uuid;
  v_disposition_reason text;
  v_correction_note text;
  v_is_assigned_courier boolean := false;
  v_has_courier_pickup boolean := false;
  v_dispatched_at timestamptz;
  v_elapsed_minutes integer;
  v_resulting_status public.sample_status;
  v_exception_id uuid;
  v_triggered_exceptions jsonb := '[]'::jsonb;
  v_gap_exc_id uuid;
  v_delay_exc_id uuid;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'UNAUTHORIZED',
      'message', 'Session expired or unauthenticated. Sign in to submit custody events.'
    );
  END IF;

  IF p_client_event_id IS NULL OR p_sample_public_code IS NULL OR p_event_type IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'BAD_REQUEST',
      'message', 'client_event_id, sample_public_code, and event_type are required.'
    );
  END IF;

  SELECT m.* INTO v_membership
  FROM public.memberships m
  WHERE m.user_id = v_user_id
    AND m.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'FORBIDDEN',
      'message', 'Your organization membership is inactive or missing.'
    );
  END IF;

  v_clean_meta := private.sanitize_event_metadata(p_metadata);

  -- Lock sample strictly within caller's organization (prevents cross-tenant access or oracle leak)
  SELECT s.* INTO v_sample
  FROM public.samples s
  WHERE s.organization_id = v_membership.organization_id
    AND s.public_code = upper(btrim(p_sample_public_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'NOT_FOUND',
      'message', 'Sample code was not found in your organization.'
    );
  END IF;

  -- Idempotency check FIRST
  SELECT se.* INTO v_existing_event
  FROM public.sample_events se
  WHERE se.organization_id = v_membership.organization_id
    AND se.client_event_id = p_client_event_id
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_event.sample_id <> v_sample.id THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'CONFLICT',
        'message', 'client_event_id was already used for a different sample.'
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'current_status', v_sample.status,
      'data', jsonb_build_object(
        'event', to_jsonb(v_existing_event),
        'sample', to_jsonb(v_sample),
        'triggered_exceptions', '[]'::jsonb
      )
    );
  END IF;

  -- Check courier assignment
  SELECT EXISTS (
    SELECT 1
    FROM public.sample_assignments sa
    WHERE sa.sample_id = v_sample.id
      AND sa.courier_user_id = v_user_id
      AND sa.is_active = true
  ) INTO v_is_assigned_courier;

  -- 1. Role permissions per event_type
  IF (p_event_type IN ('sample_collected', 'sample_dispatched') AND v_membership.role NOT IN ('collector', 'admin'))
     OR (p_event_type IN ('courier_pickup', 'courier_dropoff') AND v_membership.role NOT IN ('courier', 'admin'))
     OR (p_event_type IN ('lab_received', 'lab_accepted', 'lab_rejected') AND v_membership.role NOT IN ('lab', 'admin'))
     OR (p_event_type = 'admin_correction' AND v_membership.role <> 'admin')
     OR (p_event_type = 'sample_created')
  THEN
    INSERT INTO public.rejected_event_attempts (
      organization_id, sample_id, client_event_id, attempted_event_type, actor_user_id, error_code, reason, metadata
    ) VALUES (
      v_membership.organization_id, v_sample.id, p_client_event_id, p_event_type::text, v_user_id,
      'FORBIDDEN',
      format('Role %s is not authorized to perform %s.', v_membership.role, p_event_type),
      v_clean_meta
    );

    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'FORBIDDEN',
      'current_status', v_sample.status,
      'message', format('Role ''%s'' is not permitted to record ''%s''.', v_membership.role, p_event_type)
    );
  END IF;

  -- 2. Collector source clinic check
  IF p_event_type IN ('sample_collected', 'sample_dispatched')
     AND v_membership.role = 'collector'
     AND v_membership.facility_id IS NOT NULL
     AND v_membership.facility_id <> v_sample.source_facility_id
  THEN
    INSERT INTO public.rejected_event_attempts (
      organization_id, sample_id, client_event_id, attempted_event_type, actor_user_id, error_code, reason, metadata
    ) VALUES (
      v_membership.organization_id, v_sample.id, p_client_event_id, p_event_type::text, v_user_id,
      'FORBIDDEN', 'Collector facility does not match sample source clinic.', v_clean_meta
    );

    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'FORBIDDEN',
      'current_status', v_sample.status,
      'message', 'You can only collect or dispatch samples originating at your assigned clinic.'
    );
  END IF;

  -- 3. Courier assignment check
  IF p_event_type IN ('courier_pickup', 'courier_dropoff')
     AND v_membership.role = 'courier'
     AND NOT v_is_assigned_courier
  THEN
    INSERT INTO public.rejected_event_attempts (
      organization_id, sample_id, client_event_id, attempted_event_type, actor_user_id, error_code, reason, metadata
    ) VALUES (
      v_membership.organization_id, v_sample.id, p_client_event_id, p_event_type::text, v_user_id,
      CASE WHEN p_was_queued_offline THEN 'CONFLICT' ELSE 'FORBIDDEN' END,
      'Courier is not actively assigned to this sample.',
      v_clean_meta
    );

    IF p_was_queued_offline THEN
      v_exception_id := private.ensure_open_exception(
        v_membership.organization_id,
        v_sample.id,
        NULL,
        'OFFLINE_CONFLICT',
        'medium',
        'Queued offline courier handover rejected: courier assignment no longer active',
        jsonb_build_object(
          'attempted_event_type', p_event_type,
          'actor_name', v_membership.display_name,
          'client_event_id', p_client_event_id
        )
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', false,
      'error_code', CASE WHEN p_was_queued_offline THEN 'CONFLICT' ELSE 'FORBIDDEN' END,
      'exception_id', v_exception_id,
      'current_status', v_sample.status,
      'message', CASE
        WHEN p_was_queued_offline THEN 'Courier assignment changed while offline. Event marked Needs review.'
        ELSE 'You are not assigned as the active courier for this sample.'
      END
    );
  END IF;

  -- 4. Destination facility check for Lab actions (DESTINATION_MISMATCH)
  IF p_event_type IN ('lab_received', 'lab_accepted', 'lab_rejected') THEN
    BEGIN
      v_scanned_facility_id := NULLIF(v_clean_meta->>'scanned_facility_id', '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_scanned_facility_id := NULL;
    END;

    IF v_scanned_facility_id IS NULL THEN
      v_scanned_facility_id := v_membership.facility_id;
    END IF;

    IF (v_membership.role = 'lab' AND (v_scanned_facility_id IS NULL OR v_scanned_facility_id <> v_sample.destination_facility_id))
       OR (v_membership.role = 'admin' AND v_scanned_facility_id IS NOT NULL AND v_scanned_facility_id <> v_sample.destination_facility_id)
    THEN
      INSERT INTO public.rejected_event_attempts (
        organization_id, sample_id, client_event_id, attempted_event_type, actor_user_id, error_code, reason, metadata
      ) VALUES (
        v_membership.organization_id, v_sample.id, p_client_event_id, p_event_type::text, v_user_id,
        'DESTINATION_MISMATCH',
        'Attempted laboratory action at a facility different from designated sample destination.',
        v_clean_meta
      );

      v_exception_id := private.ensure_open_exception(
        v_membership.organization_id,
        v_sample.id,
        NULL,
        'DESTINATION_MISMATCH',
        'high',
        'Destination mismatch: sample scanned at wrong receiving laboratory',
        jsonb_build_object(
          'expected_destination_facility_id', v_sample.destination_facility_id,
          'attempted_facility_id', v_scanned_facility_id,
          'attempted_by', v_membership.display_name,
          'attempted_event_type', p_event_type
        )
      );

      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'DESTINATION_MISMATCH',
        'exception_id', v_exception_id,
        'current_status', v_sample.status,
        'message', 'Wrong destination laboratory: this sample is routed to a different receiving lab. Receipt was blocked and an operational exception was logged.'
      );
    END IF;
  END IF;

  -- 5. State machine legality check
  IF (p_event_type = 'sample_collected' AND v_sample.status <> 'created')
     OR (p_event_type = 'sample_dispatched' AND v_sample.status <> 'collected')
     OR (p_event_type IN ('courier_pickup', 'courier_dropoff', 'lab_received') AND v_sample.status <> 'dispatched')
     OR (p_event_type IN ('lab_accepted', 'lab_rejected') AND v_sample.status <> 'received')
  THEN
    INSERT INTO public.rejected_event_attempts (
      organization_id, sample_id, client_event_id, attempted_event_type, actor_user_id, error_code, reason, metadata
    ) VALUES (
      v_membership.organization_id, v_sample.id, p_client_event_id, p_event_type::text, v_user_id,
      CASE WHEN p_was_queued_offline THEN 'CONFLICT' ELSE 'INVALID_STATE' END,
      format('Illegal transition %s from current status %s.', p_event_type, v_sample.status),
      v_clean_meta
    );

    v_exception_id := private.ensure_open_exception(
      v_membership.organization_id,
      v_sample.id,
      NULL,
      CASE WHEN p_was_queued_offline THEN 'OFFLINE_CONFLICT'::public.exception_rule_code ELSE 'INVALID_TRANSITION'::public.exception_rule_code END,
      CASE WHEN p_was_queued_offline THEN 'medium'::public.exception_severity ELSE 'high'::public.exception_severity END,
      CASE
        WHEN p_was_queued_offline THEN format('Offline %s conflicted with server status (%s)', p_event_type, v_sample.status)
        ELSE format('Invalid transition %s attempted while sample status is %s', p_event_type, v_sample.status)
      END,
      jsonb_build_object(
        'attempted_event_type', p_event_type,
        'current_server_status', v_sample.status,
        'was_queued_offline', p_was_queued_offline,
        'actor_name', v_membership.display_name,
        'client_occurred_at', p_client_occurred_at
      )
    );

    RETURN jsonb_build_object(
      'ok', false,
      'error_code', CASE WHEN p_was_queued_offline THEN 'CONFLICT' ELSE 'INVALID_STATE' END,
      'exception_id', v_exception_id,
      'current_status', v_sample.status,
      'message', CASE
        WHEN p_was_queued_offline THEN format('Queued offline event (%s) conflicts with current server status (%s). Marked Needs review.', p_event_type, v_sample.status)
        ELSE format('Cannot record %s because sample is currently in %s status.', p_event_type, v_sample.status)
      END
    );
  END IF;

  -- 6. Event-specific required field checks & side effects
  IF p_event_type = 'sample_dispatched' THEN
    BEGIN
      v_assigned_courier_id := NULLIF(v_clean_meta->>'assigned_courier_id', '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_assigned_courier_id := NULL;
    END;

    IF v_assigned_courier_id IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'BAD_REQUEST',
        'current_status', v_sample.status,
        'message', 'An authorized courier must be selected before dispatching a sample.'
      );
    END IF;

    SELECT m.* INTO v_courier_membership
    FROM public.memberships m
    WHERE m.organization_id = v_membership.organization_id
      AND m.user_id = v_assigned_courier_id
      AND m.role = 'courier'
      AND m.is_active = true
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'BAD_REQUEST',
        'current_status', v_sample.status,
        'message', 'Selected courier is not an active courier in your organization.'
      );
    END IF;

    v_clean_meta := v_clean_meta || jsonb_build_object('assigned_courier_name', v_courier_membership.display_name);

    UPDATE public.sample_assignments
       SET is_active = false
     WHERE sample_id = v_sample.id
       AND is_active = true;

    INSERT INTO public.sample_assignments (
      organization_id, sample_id, courier_user_id, assigned_by, is_active
    ) VALUES (
      v_membership.organization_id, v_sample.id, v_assigned_courier_id, v_user_id, true
    );
  END IF;

  IF p_event_type = 'lab_rejected' THEN
    v_disposition_reason := btrim(COALESCE(v_clean_meta->>'disposition_reason', ''));
    IF char_length(v_disposition_reason) < 5 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'BAD_REQUEST',
        'current_status', v_sample.status,
        'message', 'Laboratory rejection requires a documented operational reason (at least 5 characters).'
      );
    END IF;
  ELSIF p_event_type = 'lab_accepted' THEN
    v_disposition_reason := NULLIF(btrim(COALESCE(v_clean_meta->>'disposition_reason', '')), '');
  ELSIF p_event_type = 'admin_correction' THEN
    v_correction_note := btrim(COALESCE(v_clean_meta->>'correction_note', ''));
    IF char_length(v_correction_note) < 5 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'BAD_REQUEST',
        'current_status', v_sample.status,
        'message', 'Administrative correction requires a documented audit note.'
      );
    END IF;
  END IF;

  -- Determine resulting sample status
  v_resulting_status := CASE p_event_type
    WHEN 'sample_collected' THEN 'collected'::public.sample_status
    WHEN 'sample_dispatched' THEN 'dispatched'::public.sample_status
    WHEN 'courier_pickup' THEN 'dispatched'::public.sample_status
    WHEN 'courier_dropoff' THEN 'dispatched'::public.sample_status
    WHEN 'lab_received' THEN 'received'::public.sample_status
    WHEN 'lab_accepted' THEN 'accepted'::public.sample_status
    WHEN 'lab_rejected' THEN 'rejected'::public.sample_status
    ELSE v_sample.status
  END;

  -- Check prior courier pickup BEFORE inserting current event (for HANDOVER_GAP rule)
  SELECT EXISTS (
    SELECT 1
    FROM public.sample_events se
    WHERE se.sample_id = v_sample.id
      AND se.event_type = 'courier_pickup'
  ) INTO v_has_courier_pickup;

  SELECT se.server_recorded_at
    INTO v_dispatched_at
  FROM public.sample_events se
  WHERE se.sample_id = v_sample.id
    AND se.event_type = 'sample_dispatched'
  ORDER BY se.server_recorded_at DESC
  LIMIT 1;

  -- Append immutable custody event
  INSERT INTO public.sample_events (
    organization_id,
    sample_id,
    client_event_id,
    event_type,
    previous_status,
    resulting_status,
    actor_user_id,
    actor_role,
    actor_name,
    actor_facility_id,
    client_occurred_at,
    server_recorded_at,
    was_queued_offline,
    metadata
  )
  VALUES (
    v_membership.organization_id,
    v_sample.id,
    p_client_event_id,
    p_event_type,
    v_sample.status,
    v_resulting_status,
    v_user_id,
    v_membership.role,
    v_membership.display_name,
    COALESCE(v_membership.facility_id, v_scanned_facility_id),
    p_client_occurred_at,
    now(),
    COALESCE(p_was_queued_offline, false),
    v_clean_meta
  )
  RETURNING * INTO v_inserted_event;

  -- Update sample projection atomically
  UPDATE public.samples
     SET status = v_resulting_status,
         custody_holder_user_id = CASE
           WHEN p_event_type = 'sample_dispatched' THEN v_assigned_courier_id
           WHEN p_event_type IN ('courier_pickup', 'courier_dropoff', 'lab_received', 'lab_accepted', 'lab_rejected') THEN v_user_id
           ELSE custody_holder_user_id
         END,
         disposition_reason = CASE
           WHEN p_event_type IN ('lab_accepted', 'lab_rejected') THEN COALESCE(v_disposition_reason, disposition_reason)
           ELSE disposition_reason
         END,
         updated_at = now()
   WHERE id = v_sample.id
   RETURNING * INTO v_sample;

  -- Deactivate courier assignment once laboratory receives specimen
  IF p_event_type = 'lab_received' THEN
    UPDATE public.sample_assignments
       SET is_active = false
     WHERE sample_id = v_sample.id
       AND is_active = true;
  END IF;

  -- 7. Deterministic Post-Event Operational Exception Evaluation (non-clinical)
  SELECT fp.* INTO v_policy
  FROM public.facility_policies fp
  WHERE fp.organization_id = v_membership.organization_id
    AND fp.facility_id = v_sample.destination_facility_id
  LIMIT 1;

  IF p_event_type = 'lab_received'
     AND COALESCE(v_policy.require_courier_pickup_before_receipt, true)
     AND NOT v_has_courier_pickup
  THEN
    v_gap_exc_id := private.ensure_open_exception(
      v_membership.organization_id,
      v_sample.id,
      v_inserted_event.id,
      'HANDOVER_GAP',
      'medium',
      'Custody handover gap: laboratory received sample without prior courier pickup confirmation',
      jsonb_build_object(
        'expected_prior_event', 'courier_pickup',
        'received_by', v_membership.display_name,
        'guidance', 'Confirm courier custody chain with collection clinic before completing disposition.'
      )
    );
    v_triggered_exceptions := v_triggered_exceptions || jsonb_build_array(
      jsonb_build_object('id', v_gap_exc_id, 'rule_code', 'HANDOVER_GAP')
    );
  END IF;

  IF p_event_type IN ('lab_received', 'courier_dropoff')
     AND v_dispatched_at IS NOT NULL
     AND COALESCE(v_policy.operational_delay_minutes, 180) > 0
  THEN
    v_elapsed_minutes := FLOOR(EXTRACT(EPOCH FROM (v_inserted_event.server_recorded_at - v_dispatched_at)) / 60)::integer;
    IF v_elapsed_minutes > COALESCE(v_policy.operational_delay_minutes, 180) THEN
      v_delay_exc_id := private.ensure_open_exception(
        v_membership.organization_id,
        v_sample.id,
        v_inserted_event.id,
        'TRANSIT_DELAY',
        'medium',
        format(
          'Transit duration (%s min) exceeded operational review threshold (%s min)',
          v_elapsed_minutes,
          COALESCE(v_policy.operational_delay_minutes, 180)
        ),
        jsonb_build_object(
          'elapsed_minutes', v_elapsed_minutes,
          'operational_delay_minutes', COALESCE(v_policy.operational_delay_minutes, 180),
          'is_demo_policy', COALESCE(v_policy.is_demo_policy, true),
          'medical_safety_note', 'Operational SLA alert only — does NOT automatically reject or diagnose specimen viability. Authorized laboratory staff must review.'
        )
      );
      v_triggered_exceptions := v_triggered_exceptions || jsonb_build_array(
        jsonb_build_object('id', v_delay_exc_id, 'rule_code', 'TRANSIT_DELAY')
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent_replay', false,
    'current_status', v_sample.status,
    'data', jsonb_build_object(
      'event', to_jsonb(v_inserted_event),
      'sample', to_jsonb(v_sample),
      'triggered_exceptions', v_triggered_exceptions
    )
  );
END;
$$;

-- 8C. Acknowledge / Resolve / Reopen Operational Exception (Lab / Admin)
CREATE OR REPLACE FUNCTION public.act_on_exception(
  p_exception_id uuid,
  p_action public.exception_action_type,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_membership public.memberships%ROWTYPE;
  v_exc public.exceptions%ROWTYPE;
  v_action_row public.exception_actions%ROWTYPE;
  v_new_status public.exception_status;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT m.* INTO v_membership
  FROM public.memberships m
  WHERE m.user_id = v_user_id
    AND m.is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_membership.role NOT IN ('lab', 'admin') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'FORBIDDEN',
      'message', 'Only authorized laboratory staff or administrators may update exception review status.'
    );
  END IF;

  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 4 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'BAD_REQUEST',
      'message', 'A documented review reason (minimum 4 characters) is required.'
    );
  END IF;

  SELECT e.* INTO v_exc
  FROM public.exceptions e
  WHERE e.id = p_exception_id
    AND e.organization_id = v_membership.organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'NOT_FOUND',
      'message', 'Exception not found in your organization.'
    );
  END IF;

  v_new_status := CASE p_action
    WHEN 'acknowledge' THEN 'acknowledged'::public.exception_status
    WHEN 'resolve' THEN 'resolved'::public.exception_status
    WHEN 'reopen' THEN 'open'::public.exception_status
  END;

  INSERT INTO public.exception_actions (
    organization_id,
    exception_id,
    actor_user_id,
    actor_name,
    action,
    reason
  )
  VALUES (
    v_membership.organization_id,
    v_exc.id,
    v_user_id,
    v_membership.display_name,
    p_action,
    btrim(p_reason)
  )
  RETURNING * INTO v_action_row;

  UPDATE public.exceptions
     SET status = v_new_status,
         acknowledged_at = CASE WHEN p_action = 'acknowledge' THEN now() ELSE acknowledged_at END,
         acknowledged_by = CASE WHEN p_action = 'acknowledge' THEN v_user_id ELSE acknowledged_by END,
         resolved_at = CASE
           WHEN p_action = 'resolve' THEN now()
           WHEN p_action = 'reopen' THEN NULL
           ELSE resolved_at
         END,
         resolved_by = CASE
           WHEN p_action = 'resolve' THEN v_user_id
           WHEN p_action = 'reopen' THEN NULL
           ELSE resolved_by
         END,
         resolution_reason = CASE
           WHEN p_action = 'resolve' THEN btrim(p_reason)
           WHEN p_action = 'reopen' THEN NULL
           ELSE resolution_reason
         END
   WHERE id = v_exc.id
   RETURNING * INTO v_exc;

  RETURN jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'exception', to_jsonb(v_exc),
      'action', to_jsonb(v_action_row)
    )
  );
END;
$$;

-- 8D. Admin Policy & Facility Configuration
CREATE OR REPLACE FUNCTION public.upsert_facility_policy(
  p_facility_id uuid,
  p_policy_name text,
  p_operational_delay_minutes integer,
  p_require_courier_pickup_before_receipt boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_membership public.memberships%ROWTYPE;
  v_org public.organizations%ROWTYPE;
  v_facility public.facilities%ROWTYPE;
  v_policy public.facility_policies%ROWTYPE;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT m.* INTO v_membership
  FROM public.memberships m
  WHERE m.user_id = v_user_id
    AND m.is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_membership.role <> 'admin' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'FORBIDDEN',
      'message', 'Only organization administrators may configure operational policies.'
    );
  END IF;

  SELECT o.* INTO v_org FROM public.organizations o WHERE o.id = v_membership.organization_id;

  SELECT f.* INTO v_facility
  FROM public.facilities f
  WHERE f.id = p_facility_id
    AND f.organization_id = v_membership.organization_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND', 'message', 'Facility not found in organization.');
  END IF;

  INSERT INTO public.facility_policies (
    organization_id,
    facility_id,
    policy_name,
    operational_delay_minutes,
    require_courier_pickup_before_receipt,
    is_demo_policy,
    updated_by,
    updated_at
  )
  VALUES (
    v_membership.organization_id,
    v_facility.id,
    btrim(p_policy_name),
    p_operational_delay_minutes,
    p_require_courier_pickup_before_receipt,
    v_org.is_demo,
    v_user_id,
    now()
  )
  ON CONFLICT (organization_id, facility_id)
  DO UPDATE SET
    policy_name = EXCLUDED.policy_name,
    operational_delay_minutes = EXCLUDED.operational_delay_minutes,
    require_courier_pickup_before_receipt = EXCLUDED.require_courier_pickup_before_receipt,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  RETURNING * INTO v_policy;

  RETURN jsonb_build_object('ok', true, 'data', to_jsonb(v_policy));
END;
$$;

CREATE OR REPLACE FUNCTION public.create_org_facility(
  p_name text,
  p_code text,
  p_facility_type public.facility_type,
  p_location_label text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_membership public.memberships%ROWTYPE;
  v_org public.organizations%ROWTYPE;
  v_facility public.facilities%ROWTYPE;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT m.* INTO v_membership
  FROM public.memberships m
  WHERE m.user_id = v_user_id
    AND m.is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_membership.role <> 'admin' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'FORBIDDEN',
      'message', 'Only organization administrators may add facilities.'
    );
  END IF;

  SELECT o.* INTO v_org FROM public.organizations o WHERE o.id = v_membership.organization_id;

  INSERT INTO public.facilities (
    organization_id,
    name,
    code,
    facility_type,
    location_label,
    is_active
  )
  VALUES (
    v_membership.organization_id,
    btrim(p_name),
    upper(btrim(p_code)),
    p_facility_type,
    NULLIF(btrim(COALESCE(p_location_label, '')), ''),
    true
  )
  RETURNING * INTO v_facility;

  IF p_facility_type = 'lab' THEN
    INSERT INTO public.facility_policies (
      organization_id,
      facility_id,
      policy_name,
      operational_delay_minutes,
      require_courier_pickup_before_receipt,
      is_demo_policy,
      updated_by
    )
    VALUES (
      v_membership.organization_id,
      v_facility.id,
      v_facility.name || ' Operational Transit SLA',
      180,
      true,
      v_org.is_demo,
      v_user_id
    )
    ON CONFLICT (organization_id, facility_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok', true, 'data', to_jsonb(v_facility));
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'CONFLICT',
      'message', 'A facility with this code already exists in your organization.'
    );
END;
$$;

-- 8E. Demo Scenario Controller — Strictly Guarded to Demo Organizations Only
CREATE OR REPLACE FUNCTION public.trigger_demo_scenario(p_scenario text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_membership public.memberships%ROWTYPE;
  v_org public.organizations%ROWTYPE;
  v_clinic_id uuid;
  v_primary_lab_id uuid;
  v_wrong_lab_id uuid;
  v_collector public.memberships%ROWTYPE;
  v_courier public.memberships%ROWTYPE;
  v_lab_primary public.memberships%ROWTYPE;
  v_lab_secondary public.memberships%ROWTYPE;
  v_sample_id uuid;
  v_public_code text;
  v_dispatched_event_id uuid;
  v_received_event_id uuid;
  v_exc_id uuid;
  v_shared_event_uuid uuid;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT m.* INTO v_membership
  FROM public.memberships m
  WHERE m.user_id = v_user_id
    AND m.is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_membership.role <> 'admin' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'FORBIDDEN',
      'message', 'Only demo organization administrators can run failure-injection or reset scenarios.'
    );
  END IF;

  SELECT o.* INTO v_org
  FROM public.organizations o
  WHERE o.id = v_membership.organization_id;

  IF NOT FOUND OR v_org.is_demo IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'FORBIDDEN',
      'message', 'Safety block: Demo scenarios and resets are permanently disabled for non-demo organizations.'
    );
  END IF;

  -- Lookup demo facilities & personas inside THIS demo organization only
  SELECT id INTO v_clinic_id
  FROM public.facilities
  WHERE organization_id = v_org.id AND facility_type = 'clinic' AND is_active = true
  ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO v_primary_lab_id
  FROM public.facilities
  WHERE organization_id = v_org.id AND facility_type = 'lab' AND is_active = true
  ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO v_wrong_lab_id
  FROM public.facilities
  WHERE organization_id = v_org.id AND facility_type = 'lab' AND is_active = true AND id <> v_primary_lab_id
  ORDER BY created_at ASC LIMIT 1;

  SELECT m.* INTO v_collector
  FROM public.memberships m
  WHERE m.organization_id = v_org.id AND m.role = 'collector' AND m.is_active = true
  ORDER BY m.created_at ASC LIMIT 1;

  SELECT m.* INTO v_courier
  FROM public.memberships m
  WHERE m.organization_id = v_org.id AND m.role = 'courier' AND m.is_active = true
  ORDER BY m.created_at ASC LIMIT 1;

  SELECT m.* INTO v_lab_primary
  FROM public.memberships m
  WHERE m.organization_id = v_org.id AND m.role = 'lab' AND m.facility_id = v_primary_lab_id AND m.is_active = true
  ORDER BY m.created_at ASC LIMIT 1;

  SELECT m.* INTO v_lab_secondary
  FROM public.memberships m
  WHERE m.organization_id = v_org.id AND m.role = 'lab' AND m.id <> COALESCE(v_lab_primary.id, gen_random_uuid()) AND m.is_active = true
  ORDER BY m.created_at ASC LIMIT 1;

  IF v_collector.id IS NULL THEN v_collector := v_membership; END IF;
  IF v_courier.id IS NULL THEN v_courier := v_membership; END IF;
  IF v_lab_primary.id IS NULL THEN v_lab_primary := v_membership; END IF;

  IF p_scenario = 'reset_clean' THEN
    PERFORM set_config('sampleshield.allow_demo_reset', 'on', true);

    DELETE FROM public.rejected_event_attempts WHERE organization_id = v_org.id;
    DELETE FROM public.exception_actions WHERE organization_id = v_org.id;
    DELETE FROM public.exceptions WHERE organization_id = v_org.id;
    DELETE FROM public.sample_events WHERE organization_id = v_org.id;
    DELETE FROM public.sample_assignments WHERE organization_id = v_org.id;
    DELETE FROM public.samples WHERE organization_id = v_org.id AND is_demo = true;

    -- Seed 1 clean baseline sample in transit so dashboard is immediately legible
    v_public_code := private.generate_unique_public_code();
    INSERT INTO public.samples (
      organization_id, public_code, source_facility_id, destination_facility_id,
      specimen_type, case_alias, order_reference, status, custody_holder_user_id, created_by, is_demo
    ) VALUES (
      v_org.id, v_public_code, v_clinic_id, v_primary_lab_id,
      'Whole Blood (EDTA Tube)', 'SYNTH-BASELINE-01', 'ORD-DEMO-1001',
      'dispatched', v_courier.user_id, v_collector.user_id, true
    ) RETURNING id INTO v_sample_id;

    INSERT INTO public.sample_assignments (organization_id, sample_id, courier_user_id, assigned_by, is_active)
    VALUES (v_org.id, v_sample_id, v_courier.user_id, v_collector.user_id, true);

    INSERT INTO public.sample_events (
      organization_id, sample_id, client_event_id, event_type, previous_status, resulting_status,
      actor_user_id, actor_role, actor_name, actor_facility_id, client_occurred_at, server_recorded_at, metadata
    ) VALUES
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_created', NULL, 'created',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id, now() - interval '35 minutes', now() - interval '35 minutes',
       '{"handover_note":"Synthetic baseline specimen registered"}'::jsonb),
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_collected', 'created', 'collected',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id, now() - interval '30 minutes', now() - interval '30 minutes',
       '{"package_seal_intact":true,"handover_note":"Primary EDTA tube labelled with opaque QR"}'::jsonb),
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_dispatched', 'collected', 'dispatched',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id, now() - interval '20 minutes', now() - interval '20 minutes',
       jsonb_build_object('assigned_courier_id', v_courier.user_id, 'assigned_courier_name', v_courier.display_name, 'handover_note', 'Handed to route courier in insulated carrier'));

    PERFORM set_config('sampleshield.allow_demo_reset', 'off', true);

    RETURN jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'scenario', p_scenario,
        'sample_id', v_sample_id,
        'public_code', v_public_code,
        'summary', 'Demo tenant reset to clean synthetic baseline (1 dispatched sample ready for courier pickup).'
      )
    );
  END IF;

  IF p_scenario = 'happy_path' THEN
    v_public_code := private.generate_unique_public_code();
    INSERT INTO public.samples (
      organization_id, public_code, source_facility_id, destination_facility_id,
      specimen_type, case_alias, order_reference, status, custody_holder_user_id,
      disposition_reason, created_by, created_at, updated_at, is_demo
    ) VALUES (
      v_org.id, v_public_code, v_clinic_id, v_primary_lab_id,
      'Serum Separator Tube (SST)', 'SYNTH-HAPPY-104', 'ORD-DEMO-2040',
      'accepted', v_lab_primary.user_id,
      'Seal intact, custody chain complete, label verified at receiving bench.',
      v_collector.user_id, now() - interval '95 minutes', now() - interval '10 minutes', true
    ) RETURNING id INTO v_sample_id;

    INSERT INTO public.sample_events (
      organization_id, sample_id, client_event_id, event_type, previous_status, resulting_status,
      actor_user_id, actor_role, actor_name, actor_facility_id, client_occurred_at, server_recorded_at, metadata
    ) VALUES
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_created', NULL, 'created',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
       now() - interval '95 minutes', now() - interval '95 minutes', '{"handover_note":"Registered at clinic"}'::jsonb),
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_collected', 'created', 'collected',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
       now() - interval '90 minutes', now() - interval '90 minutes', '{"package_seal_intact":true}'::jsonb),
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_dispatched', 'collected', 'dispatched',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
       now() - interval '80 minutes', now() - interval '80 minutes',
       jsonb_build_object('assigned_courier_id', v_courier.user_id, 'assigned_courier_name', v_courier.display_name)),
      (v_org.id, v_sample_id, gen_random_uuid(), 'courier_pickup', 'dispatched', 'dispatched',
       v_courier.user_id, v_courier.role, v_courier.display_name, NULL,
       now() - interval '74 minutes', now() - interval '73 minutes',
       '{"package_seal_intact":true,"handover_note":"Picked up sealed cold carrier box"}'::jsonb),
      (v_org.id, v_sample_id, gen_random_uuid(), 'courier_dropoff', 'dispatched', 'dispatched',
       v_courier.user_id, v_courier.role, v_courier.display_name, v_primary_lab_id,
       now() - interval '22 minutes', now() - interval '22 minutes',
       '{"package_seal_intact":true,"handover_note":"Delivered to Ajmer receiving window"}'::jsonb),
      (v_org.id, v_sample_id, gen_random_uuid(), 'lab_received', 'dispatched', 'received',
       v_lab_primary.user_id, v_lab_primary.role, v_lab_primary.display_name, v_primary_lab_id,
       now() - interval '18 minutes', now() - interval '18 minutes',
       '{"package_seal_intact":true,"handover_note":"Logged into receiving bench"}'::jsonb),
      (v_org.id, v_sample_id, gen_random_uuid(), 'lab_accepted', 'received', 'accepted',
       v_lab_primary.user_id, v_lab_primary.role, v_lab_primary.display_name, v_primary_lab_id,
       now() - interval '10 minutes', now() - interval '10 minutes',
       '{"disposition_reason":"Seal intact, custody chain complete, label verified at receiving bench."}'::jsonb);

    RETURN jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'scenario', p_scenario,
        'sample_id', v_sample_id,
        'public_code', v_public_code,
        'summary', 'Created complete verified Happy Path sample journey (created → accepted).'
      )
    );
  END IF;

  IF p_scenario = 'wrong_destination' THEN
    v_public_code := private.generate_unique_public_code();
    INSERT INTO public.samples (
      organization_id, public_code, source_facility_id, destination_facility_id,
      specimen_type, case_alias, order_reference, status, custody_holder_user_id,
      created_by, created_at, updated_at, is_demo
    ) VALUES (
      v_org.id, v_public_code, v_clinic_id, v_primary_lab_id,
      'Sputum Sterile Container', 'SYNTH-MISROUTE-209', 'ORD-DEMO-3092',
      'dispatched', v_courier.user_id, v_collector.user_id,
      now() - interval '65 minutes', now() - interval '12 minutes', true
    ) RETURNING id INTO v_sample_id;

    INSERT INTO public.sample_assignments (organization_id, sample_id, courier_user_id, assigned_by, is_active)
    VALUES (v_org.id, v_sample_id, v_courier.user_id, v_collector.user_id, true);

    INSERT INTO public.sample_events (
      organization_id, sample_id, client_event_id, event_type, previous_status, resulting_status,
      actor_user_id, actor_role, actor_name, actor_facility_id, client_occurred_at, server_recorded_at, metadata
    ) VALUES
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_created', NULL, 'created',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
       now() - interval '65 minutes', now() - interval '65 minutes', '{}'::jsonb),
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_collected', 'created', 'collected',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
       now() - interval '60 minutes', now() - interval '60 minutes', '{"package_seal_intact":true}'::jsonb),
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_dispatched', 'collected', 'dispatched',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
       now() - interval '50 minutes', now() - interval '50 minutes',
       jsonb_build_object('assigned_courier_id', v_courier.user_id, 'assigned_courier_name', v_courier.display_name)),
      (v_org.id, v_sample_id, gen_random_uuid(), 'courier_pickup', 'dispatched', 'dispatched',
       v_courier.user_id, v_courier.role, v_courier.display_name, NULL,
       now() - interval '44 minutes', now() - interval '44 minutes', '{"package_seal_intact":true}'::jsonb);

    INSERT INTO public.rejected_event_attempts (
      organization_id, sample_id, client_event_id, attempted_event_type, actor_user_id, error_code, reason, metadata
    ) VALUES (
      v_org.id, v_sample_id, gen_random_uuid(), 'lab_received',
      COALESCE(v_lab_secondary.user_id, v_lab_primary.user_id),
      'DESTINATION_MISMATCH',
      'Attempted laboratory receipt at Regional Microbiology Hub — Jaipur instead of District Reference Laboratory — Ajmer.',
      jsonb_build_object('scanned_facility_id', COALESCE(v_wrong_lab_id, v_clinic_id))
    );

    v_exc_id := private.ensure_open_exception(
      v_org.id,
      v_sample_id,
      NULL,
      'DESTINATION_MISMATCH',
      'high',
      'Destination mismatch: sample routed to Ajmer Lab was scanned at Jaipur Hub',
      jsonb_build_object(
        'expected_destination_facility_id', v_primary_lab_id,
        'attempted_facility_id', COALESCE(v_wrong_lab_id, v_clinic_id),
        'attempted_by', COALESCE(v_lab_secondary.display_name, 'Jaipur Receiving Desk'),
        'guidance', 'Sample remains in dispatched state; reroute sealed carrier to authorized destination lab.'
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'scenario', p_scenario,
        'sample_id', v_sample_id,
        'public_code', v_public_code,
        'exception_id', v_exc_id,
        'summary', 'Simulated Wrong Destination scan: receipt blocked and high-severity DESTINATION_MISMATCH exception opened.'
      )
    );
  END IF;

  IF p_scenario = 'offline_courier' THEN
    v_public_code := private.generate_unique_public_code();
    INSERT INTO public.samples (
      organization_id, public_code, source_facility_id, destination_facility_id,
      specimen_type, case_alias, order_reference, status, custody_holder_user_id,
      created_by, created_at, updated_at, is_demo
    ) VALUES (
      v_org.id, v_public_code, v_clinic_id, v_primary_lab_id,
      'Viral Transport Medium Swab', 'SYNTH-OFFLINE-315', 'ORD-DEMO-4110',
      'dispatched', v_courier.user_id, v_collector.user_id,
      now() - interval '25 minutes', now() - interval '15 minutes', true
    ) RETURNING id INTO v_sample_id;

    INSERT INTO public.sample_assignments (organization_id, sample_id, courier_user_id, assigned_by, is_active)
    VALUES (v_org.id, v_sample_id, v_courier.user_id, v_collector.user_id, true);

    INSERT INTO public.sample_events (
      organization_id, sample_id, client_event_id, event_type, previous_status, resulting_status,
      actor_user_id, actor_role, actor_name, actor_facility_id, client_occurred_at, server_recorded_at, metadata
    ) VALUES
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_created', NULL, 'created',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
       now() - interval '25 minutes', now() - interval '25 minutes', '{}'::jsonb),
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_collected', 'created', 'collected',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
       now() - interval '20 minutes', now() - interval '20 minutes', '{"package_seal_intact":true}'::jsonb),
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_dispatched', 'collected', 'dispatched',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
       now() - interval '15 minutes', now() - interval '15 minutes',
       jsonb_build_object('assigned_courier_id', v_courier.user_id, 'assigned_courier_name', v_courier.display_name, 'handover_note', 'Ready for offline courier pickup test'));

    RETURN jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'scenario', p_scenario,
        'sample_id', v_sample_id,
        'public_code', v_public_code,
        'summary', 'Prepared dispatched sample assigned to courier for live offline pickup & reconnect demonstration.'
      )
    );
  END IF;

  IF p_scenario = 'delayed_arrival' THEN
    v_public_code := private.generate_unique_public_code();
    INSERT INTO public.samples (
      organization_id, public_code, source_facility_id, destination_facility_id,
      specimen_type, case_alias, order_reference, status, custody_holder_user_id,
      created_by, created_at, updated_at, is_demo
    ) VALUES (
      v_org.id, v_public_code, v_clinic_id, v_primary_lab_id,
      'Whole Blood (EDTA Tube)', 'SYNTH-DELAY-422', 'ORD-DEMO-5220',
      'received', v_lab_primary.user_id, v_collector.user_id,
      now() - interval '310 minutes', now() - interval '5 minutes', true
    ) RETURNING id INTO v_sample_id;

    INSERT INTO public.sample_events (
      organization_id, sample_id, client_event_id, event_type, previous_status, resulting_status,
      actor_user_id, actor_role, actor_name, actor_facility_id, client_occurred_at, server_recorded_at, metadata
    ) VALUES
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_created', NULL, 'created',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
       now() - interval '310 minutes', now() - interval '310 minutes', '{}'::jsonb),
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_collected', 'created', 'collected',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
       now() - interval '305 minutes', now() - interval '305 minutes', '{"package_seal_intact":true}'::jsonb);

    INSERT INTO public.sample_events (
      organization_id, sample_id, client_event_id, event_type, previous_status, resulting_status,
      actor_user_id, actor_role, actor_name, actor_facility_id, client_occurred_at, server_recorded_at, metadata
    ) VALUES (
      v_org.id, v_sample_id, gen_random_uuid(), 'sample_dispatched', 'collected', 'dispatched',
      v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
      now() - interval '295 minutes', now() - interval '295 minutes',
      jsonb_build_object('assigned_courier_id', v_courier.user_id, 'assigned_courier_name', v_courier.display_name)
    ) RETURNING id INTO v_dispatched_event_id;

    INSERT INTO public.sample_events (
      organization_id, sample_id, client_event_id, event_type, previous_status, resulting_status,
      actor_user_id, actor_role, actor_name, actor_facility_id, client_occurred_at, server_recorded_at, was_queued_offline, metadata
    ) VALUES (
      v_org.id, v_sample_id, gen_random_uuid(), 'courier_pickup', 'dispatched', 'dispatched',
      v_courier.user_id, v_courier.role, v_courier.display_name, NULL,
      now() - interval '280 minutes', now() - interval '260 minutes', true,
      '{"package_seal_intact":true,"transport_observation":"Monsoon road diversion delayed transit"}'::jsonb
    );

    INSERT INTO public.sample_events (
      organization_id, sample_id, client_event_id, event_type, previous_status, resulting_status,
      actor_user_id, actor_role, actor_name, actor_facility_id, client_occurred_at, server_recorded_at, metadata
    ) VALUES (
      v_org.id, v_sample_id, gen_random_uuid(), 'lab_received', 'dispatched', 'received',
      v_lab_primary.user_id, v_lab_primary.role, v_lab_primary.display_name, v_primary_lab_id,
      now() - interval '5 minutes', now() - interval '5 minutes',
      '{"package_seal_intact":true,"handover_note":"Received after route delay — pending human lab review"}'::jsonb
    ) RETURNING id INTO v_received_event_id;

    v_exc_id := private.ensure_open_exception(
      v_org.id,
      v_sample_id,
      v_received_event_id,
      'TRANSIT_DELAY',
      'medium',
      'Transit duration (290 min) exceeded operational review threshold (180 min)',
      jsonb_build_object(
        'elapsed_minutes', 290,
        'operational_delay_minutes', 180,
        'is_demo_policy', true,
        'medical_safety_note', 'Operational SLA alert only — does NOT automatically reject specimen. Authorized lab staff must inspect and record disposition.'
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'scenario', p_scenario,
        'sample_id', v_sample_id,
        'public_code', v_public_code,
        'exception_id', v_exc_id,
        'summary', 'Seeded Delayed Arrival sample (290m vs 180m demo SLA) awaiting human lab review — not auto-rejected.'
      )
    );
  END IF;

  IF p_scenario = 'duplicate_submission' THEN
    v_public_code := private.generate_unique_public_code();
    v_shared_event_uuid := gen_random_uuid();

    INSERT INTO public.samples (
      organization_id, public_code, source_facility_id, destination_facility_id,
      specimen_type, case_alias, order_reference, status, custody_holder_user_id,
      created_by, created_at, updated_at, is_demo
    ) VALUES (
      v_org.id, v_public_code, v_clinic_id, v_primary_lab_id,
      'Urine Sterile Cup', 'SYNTH-IDEMPOTENT-508', 'ORD-DEMO-6105',
      'dispatched', v_courier.user_id, v_collector.user_id,
      now() - interval '40 minutes', now() - interval '10 minutes', true
    ) RETURNING id INTO v_sample_id;

    INSERT INTO public.sample_assignments (organization_id, sample_id, courier_user_id, assigned_by, is_active)
    VALUES (v_org.id, v_sample_id, v_courier.user_id, v_collector.user_id, true);

    INSERT INTO public.sample_events (
      organization_id, sample_id, client_event_id, event_type, previous_status, resulting_status,
      actor_user_id, actor_role, actor_name, actor_facility_id, client_occurred_at, server_recorded_at, was_queued_offline, metadata
    ) VALUES
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_created', NULL, 'created',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
       now() - interval '40 minutes', now() - interval '40 minutes', false, '{}'::jsonb),
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_collected', 'created', 'collected',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
       now() - interval '35 minutes', now() - interval '35 minutes', false, '{"package_seal_intact":true}'::jsonb),
      (v_org.id, v_sample_id, gen_random_uuid(), 'sample_dispatched', 'collected', 'dispatched',
       v_collector.user_id, v_collector.role, v_collector.display_name, v_clinic_id,
       now() - interval '25 minutes', now() - interval '25 minutes', false,
       jsonb_build_object('assigned_courier_id', v_courier.user_id, 'assigned_courier_name', v_courier.display_name)),
      (v_org.id, v_sample_id, v_shared_event_uuid, 'courier_pickup', 'dispatched', 'dispatched',
       v_courier.user_id, v_courier.role, v_courier.display_name, NULL,
       now() - interval '12 minutes', now() - interval '10 minutes', true,
       '{"package_seal_intact":true,"handover_note":"Initial offline pickup synced; replay with identical client_event_id returns this single record"}'::jsonb);

    RETURN jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'scenario', p_scenario,
        'sample_id', v_sample_id,
        'public_code', v_public_code,
        'replayed_client_event_id', v_shared_event_uuid,
        'summary', 'Created sample with recorded client_event_id ready for live duplicate-submission idempotency proof.'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', false,
    'error_code', 'BAD_REQUEST',
    'message', format('Unsupported demo scenario: %s', p_scenario)
  );
END;
$$;

-- Restrict RPC execution strictly to authenticated users (never PUBLIC or anon)
REVOKE ALL ON FUNCTION public.create_sample_atomic(uuid, uuid, text, text, text, boolean, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_custody_event(uuid, text, public.sample_event_type, timestamptz, boolean, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.act_on_exception(uuid, public.exception_action_type, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_facility_policy(uuid, text, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_org_facility(text, text, public.facility_type, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trigger_demo_scenario(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_sample_atomic(uuid, uuid, text, text, text, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_custody_event(uuid, text, public.sample_event_type, timestamptz, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.act_on_exception(uuid, public.exception_action_type, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_facility_policy(uuid, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_org_facility(text, text, public.facility_type, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_demo_scenario(text) TO authenticated;
