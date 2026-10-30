-- ============================================================================
-- SampleShield — Synthetic Demo Seed Data (LOCAL / DEMO ONLY — NO REAL PHI)
-- Demo password for local seeded accounts: SampleShieldDemo!2026
-- ============================================================================

DO $$
DECLARE
  v_pw_hash text := extensions.crypt('SampleShieldDemo!2026', extensions.gen_salt('bf'));

  -- Fixed deterministic UUIDs for reproducible E2E & pgTAP tests
  v_org_demo uuid := '11111111-1111-4111-8111-111111111111';
  v_org_other uuid := '22222222-2222-4222-8222-222222222222';

  v_fac_kish uuid := '11111111-aaaa-4111-8111-111111111101';
  v_fac_bass uuid := '11111111-aaaa-4111-8111-111111111102';
  v_fac_ajmr uuid := '11111111-bbbb-4111-8111-111111111103';
  v_fac_jaip uuid := '11111111-bbbb-4111-8111-111111111104';

  v_fac_rewa uuid := '22222222-aaaa-4222-8222-222222222201';
  v_fac_vind uuid := '22222222-bbbb-4222-8222-222222222202';

  v_user_collector uuid := 'aaaa1111-1111-4111-8111-111111111101';
  v_user_courier   uuid := 'aaaa1111-1111-4111-8111-111111111102';
  v_user_lab_ajmr  uuid := 'aaaa1111-1111-4111-8111-111111111103';
  v_user_lab_jaip  uuid := 'aaaa1111-1111-4111-8111-111111111104';
  v_user_admin     uuid := 'aaaa1111-1111-4111-8111-111111111105';
  v_user_external  uuid := 'bbbb2222-2222-4222-8222-222222222201';

  v_sample_happy   uuid := 'cccc1111-1111-4111-8111-111111111001';
  v_sample_transit uuid := 'cccc1111-1111-4111-8111-111111111002';
  v_sample_delayed uuid := 'cccc1111-1111-4111-8111-111111111003';
  v_sample_misrt   uuid := 'cccc1111-1111-4111-8111-111111111004';
  v_sample_other   uuid := 'dddd2222-2222-4222-8222-222222222001';

  v_evt_delayed_rx uuid := 'eeee1111-1111-4111-8111-111111111035';
  u record;
BEGIN
  -- 1. Seed Auth Users (GoTrue-compatible non-null token strings)
  FOR u IN
    SELECT * FROM (VALUES
      (v_user_collector, 'asha.collector@sahyog-demo.example', 'Asha Verma (Collector)'),
      (v_user_courier,   'ravi.courier@sahyog-demo.example',   'Ravi Meena (Route Courier)'),
      (v_user_lab_ajmr,  'priya.lab@sahyog-demo.example',      'Dr. Priya Sharma (Ajmer Lab)'),
      (v_user_lab_jaip,  'kabir.jaipur@sahyog-demo.example',   'Kabir Joshi (Jaipur Hub Lab)'),
      (v_user_admin,     'meera.admin@sahyog-demo.example',    'Meera Nair (Operations Admin)'),
      (v_user_external,  'anita.external@vindhya-test.example','Anita Rao (External Tenant)')
    ) AS t(uid, email, full_name)
  LOOP
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    )
    VALUES (
      u.uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      u.email,
      v_pw_hash,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', u.full_name, 'synthetic_demo_account', true),
      now(),
      now(),
      '', '', '', ''
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      u.uid,
      u.uid::text,
      jsonb_build_object('sub', u.uid::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
      'email',
      now(),
      now(),
      now()
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- 2. Organizations
  INSERT INTO public.organizations (id, name, slug, is_demo)
  VALUES
    (v_org_demo,  'Sahyog Rural Health Network',  'sahyog-rural-demo', true),
    (v_org_other, 'Vindhya District Diagnostics', 'vindhya-isolated-org', false)
  ON CONFLICT (id) DO NOTHING;

  -- 3. Facilities
  INSERT INTO public.facilities (id, organization_id, name, code, facility_type, location_label, is_active)
  VALUES
    (v_fac_kish, v_org_demo,  'Kishangarh Primary Health Centre',       'PHC-KISH', 'clinic', 'Ajmer Rural Block (Synthetic)', true),
    (v_fac_bass, v_org_demo,  'Bassi Community Health Clinic',          'CHC-BASS', 'clinic', 'Jaipur East Block (Synthetic)', true),
    (v_fac_ajmr, v_org_demo,  'District Reference Laboratory — Ajmer',  'LAB-AJMR', 'lab',    'Ajmer District HQ (Synthetic)', true),
    (v_fac_jaip, v_org_demo,  'Regional Microbiology Hub — Jaipur',     'LAB-JAIP', 'lab',    'Jaipur Regional Hub (Synthetic)', true),
    (v_fac_rewa, v_org_other, 'Rewa Block Primary Clinic',              'PHC-REWA', 'clinic', 'Rewa Block (Isolated Tenant)', true),
    (v_fac_vind, v_org_other, 'Vindhya Central Reference Lab',          'LAB-VIND', 'lab',    'Satna Road (Isolated Tenant)', true)
  ON CONFLICT (id) DO NOTHING;

  -- 4. Memberships
  INSERT INTO public.memberships (organization_id, user_id, display_name, email, facility_id, role, is_active)
  VALUES
    (v_org_demo,  v_user_collector, 'Asha Verma',       'asha.collector@sahyog-demo.example',  v_fac_kish, 'collector', true),
    (v_org_demo,  v_user_courier,   'Ravi Meena',       'ravi.courier@sahyog-demo.example',    NULL,       'courier',   true),
    (v_org_demo,  v_user_lab_ajmr,  'Dr. Priya Sharma', 'priya.lab@sahyog-demo.example',       v_fac_ajmr, 'lab',       true),
    (v_org_demo,  v_user_lab_jaip,  'Kabir Joshi',      'kabir.jaipur@sahyog-demo.example',    v_fac_jaip, 'lab',       true),
    (v_org_demo,  v_user_admin,     'Meera Nair',       'meera.admin@sahyog-demo.example',     NULL,       'admin',     true),
    (v_org_other, v_user_external,  'Anita Rao',        'anita.external@vindhya-test.example', v_fac_rewa, 'admin',     true)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- 5. Facility Operational Policies (explicitly labelled synthetic operational SLA)
  INSERT INTO public.facility_policies (
    organization_id, facility_id, policy_name, operational_delay_minutes,
    require_courier_pickup_before_receipt, is_demo_policy, scope_note, updated_by
  )
  VALUES
    (
      v_org_demo, v_fac_ajmr,
      'Ajmer Rural Route Operational SLA (Demo)',
      180, true, true,
      'Synthetic demo operational threshold (180 min) — triggers lab review only, never automatic specimen rejection.',
      v_user_admin
    ),
    (
      v_org_demo, v_fac_jaip,
      'Jaipur Regional Hub Operational SLA (Demo)',
      240, true, true,
      'Synthetic demo operational threshold (240 min) — triggers lab review only, never automatic specimen rejection.',
      v_user_admin
    ),
    (
      v_org_other, v_fac_vind,
      'Vindhya Operational Transit Policy',
      180, true, false,
      'Operational review threshold only.',
      v_user_external
    )
  ON CONFLICT (organization_id, facility_id) DO NOTHING;

  -- 6. Synthetic Demo Samples in Sahyog Rural Health Network
  INSERT INTO public.samples (
    id, organization_id, public_code, source_facility_id, destination_facility_id,
    specimen_type, case_alias, order_reference, status, custody_holder_user_id,
    disposition_reason, created_by, created_at, updated_at, is_demo
  )
  VALUES
    -- Sample 1: Completed & accepted happy path
    (
      v_sample_happy, v_org_demo, 'SS-7K4M-9P2X-Q8RN', v_fac_kish, v_fac_ajmr,
      'Whole Blood (EDTA Tube)', 'SYNTH-CASE-101', 'ORD-DEMO-901',
      'accepted', v_user_lab_ajmr,
      'Container seal intact, opaque code matched manifest, accepted into bench workflow.',
      v_user_collector, now() - interval '4 hours', now() - interval '2 hours 20 minutes', true
    ),
    -- Sample 2: Dispatched & assigned to Ravi Meena (ready for Courier pickup / offline demo!)
    (
      v_sample_transit, v_org_demo, 'SS-3H8W-5T6J-C4ZP', v_fac_kish, v_fac_ajmr,
      'Viral Transport Medium Swab', 'SYNTH-CASE-102', 'ORD-DEMO-902',
      'dispatched', v_user_courier,
      NULL,
      v_user_collector, now() - interval '42 minutes', now() - interval '28 minutes', true
    ),
    -- Sample 3: Received at Ajmer Lab after 265 min delay -> open TRANSIT_DELAY exception, awaiting human lab decision!
    (
      v_sample_delayed, v_org_demo, 'SS-6B9F-2N4D-L7YV', v_fac_bass, v_fac_ajmr,
      'Sputum Sterile Container', 'SYNTH-CASE-103', 'ORD-DEMO-903',
      'received', v_user_lab_ajmr,
      NULL,
      v_user_admin, now() - interval '5 hours', now() - interval '15 minutes', true
    ),
    -- Sample 4: Dispatched to Ajmer Lab, courier picked up, scanned mistakenly at Jaipur Lab -> open DESTINATION_MISMATCH
    (
      v_sample_misrt, v_org_demo, 'SS-9R3G-8V5K-W2MX', v_fac_kish, v_fac_ajmr,
      'Serum Separator Tube (SST)', 'SYNTH-CASE-104', 'ORD-DEMO-904',
      'dispatched', v_user_courier,
      NULL,
      v_user_collector, now() - interval '85 minutes', now() - interval '35 minutes', true
    ),
    -- Isolated Tenant B sample (must NEVER be visible to Sahyog users or deleted by demo reset)
    (
      v_sample_other, v_org_other, 'SS-8V4N-2K9P-M7QX', v_fac_rewa, v_fac_vind,
      'Whole Blood (EDTA Tube)', 'VINDHYA-ISOLATED-01', 'ORD-VIND-001',
      'collected', v_user_external,
      NULL,
      v_user_external, now() - interval '1 hour', now() - interval '50 minutes', false
    )
  ON CONFLICT (id) DO NOTHING;

  -- 7. Active Courier Assignments
  INSERT INTO public.sample_assignments (organization_id, sample_id, courier_user_id, assigned_by, is_active)
  VALUES
    (v_org_demo, v_sample_transit, v_user_courier, v_user_collector, true),
    (v_org_demo, v_sample_misrt,   v_user_courier, v_user_collector, true)
  ON CONFLICT DO NOTHING;

  -- 8. Seeded Append-Only Custody Events
  INSERT INTO public.sample_events (
    id, organization_id, sample_id, client_event_id, event_type, previous_status, resulting_status,
    actor_user_id, actor_role, actor_name, actor_facility_id, client_occurred_at, server_recorded_at, was_queued_offline, metadata
  )
  VALUES
    -- Sample 1 events
    (gen_random_uuid(), v_org_demo, v_sample_happy, '10000000-0000-4000-8000-000000000001', 'sample_created', NULL, 'created',
     v_user_collector, 'collector', 'Asha Verma', v_fac_kish, now() - interval '240 minutes', now() - interval '240 minutes', false,
     '{"handover_note":"Sample registered at Kishangarh PHC"}'::jsonb),
    (gen_random_uuid(), v_org_demo, v_sample_happy, '10000000-0000-4000-8000-000000000002', 'sample_collected', 'created', 'collected',
     v_user_collector, 'collector', 'Asha Verma', v_fac_kish, now() - interval '232 minutes', now() - interval '232 minutes', false,
     '{"package_seal_intact":true,"handover_note":"EDTA tube labelled and sealed"}'::jsonb),
    (gen_random_uuid(), v_org_demo, v_sample_happy, '10000000-0000-4000-8000-000000000003', 'sample_dispatched', 'collected', 'dispatched',
     v_user_collector, 'collector', 'Asha Verma', v_fac_kish, now() - interval '220 minutes', now() - interval '220 minutes', false,
     jsonb_build_object('assigned_courier_id', v_user_courier, 'assigned_courier_name', 'Ravi Meena', 'handover_note', 'Dispatched via morning rural courier run')),
    (gen_random_uuid(), v_org_demo, v_sample_happy, '10000000-0000-4000-8000-000000000004', 'courier_pickup', 'dispatched', 'dispatched',
     v_user_courier, 'courier', 'Ravi Meena', NULL, now() - interval '212 minutes', now() - interval '205 minutes', true,
     '{"package_seal_intact":true,"handover_note":"Recorded offline at clinic gate; synced on highway tower"}'::jsonb),
    (gen_random_uuid(), v_org_demo, v_sample_happy, '10000000-0000-4000-8000-000000000005', 'lab_received', 'dispatched', 'received',
     v_user_lab_ajmr, 'lab', 'Dr. Priya Sharma', v_fac_ajmr, now() - interval '150 minutes', now() - interval '150 minutes', false,
     '{"package_seal_intact":true,"handover_note":"Received at Ajmer intake desk"}'::jsonb),
    (gen_random_uuid(), v_org_demo, v_sample_happy, '10000000-0000-4000-8000-000000000006', 'lab_accepted', 'received', 'accepted',
     v_user_lab_ajmr, 'lab', 'Dr. Priya Sharma', v_fac_ajmr, now() - interval '140 minutes', now() - interval '140 minutes', false,
     '{"disposition_reason":"Container seal intact, opaque code matched manifest, accepted into bench workflow."}'::jsonb),

    -- Sample 2 events (awaiting courier pickup)
    (gen_random_uuid(), v_org_demo, v_sample_transit, '10000000-0000-4000-8000-000000000011', 'sample_created', NULL, 'created',
     v_user_collector, 'collector', 'Asha Verma', v_fac_kish, now() - interval '42 minutes', now() - interval '42 minutes', false, '{}'::jsonb),
    (gen_random_uuid(), v_org_demo, v_sample_transit, '10000000-0000-4000-8000-000000000012', 'sample_collected', 'created', 'collected',
     v_user_collector, 'collector', 'Asha Verma', v_fac_kish, now() - interval '36 minutes', now() - interval '36 minutes', false, '{"package_seal_intact":true}'::jsonb),
    (gen_random_uuid(), v_org_demo, v_sample_transit, '10000000-0000-4000-8000-000000000013', 'sample_dispatched', 'collected', 'dispatched',
     v_user_collector, 'collector', 'Asha Verma', v_fac_kish, now() - interval '28 minutes', now() - interval '28 minutes', false,
     jsonb_build_object('assigned_courier_id', v_user_courier, 'assigned_courier_name', 'Ravi Meena', 'handover_note', 'Ready at clinic dispatch counter')),

    -- Sample 3 events (delayed arrival)
    (gen_random_uuid(), v_org_demo, v_sample_delayed, '10000000-0000-4000-8000-000000000021', 'sample_created', NULL, 'created',
     v_user_admin, 'admin', 'Meera Nair', v_fac_bass, now() - interval '300 minutes', now() - interval '300 minutes', false, '{}'::jsonb),
    (gen_random_uuid(), v_org_demo, v_sample_delayed, '10000000-0000-4000-8000-000000000022', 'sample_collected', 'created', 'collected',
     v_user_admin, 'admin', 'Meera Nair', v_fac_bass, now() - interval '290 minutes', now() - interval '290 minutes', false, '{"package_seal_intact":true}'::jsonb),
    (gen_random_uuid(), v_org_demo, v_sample_delayed, '10000000-0000-4000-8000-000000000023', 'sample_dispatched', 'collected', 'dispatched',
     v_user_admin, 'admin', 'Meera Nair', v_fac_bass, now() - interval '280 minutes', now() - interval '280 minutes', false,
     jsonb_build_object('assigned_courier_id', v_user_courier, 'assigned_courier_name', 'Ravi Meena')),
    (gen_random_uuid(), v_org_demo, v_sample_delayed, '10000000-0000-4000-8000-000000000024', 'courier_pickup', 'dispatched', 'dispatched',
     v_user_courier, 'courier', 'Ravi Meena', NULL, now() - interval '270 minutes', now() - interval '245 minutes', true,
     '{"package_seal_intact":true,"transport_observation":"Rail crossing closure added transit delay"}'::jsonb),
    (v_evt_delayed_rx, v_org_demo, v_sample_delayed, '10000000-0000-4000-8000-000000000025', 'lab_received', 'dispatched', 'received',
     v_user_lab_ajmr, 'lab', 'Dr. Priya Sharma', v_fac_ajmr, now() - interval '15 minutes', now() - interval '15 minutes', false,
     '{"package_seal_intact":true,"handover_note":"Received after transit delay — queued for human lab review"}'::jsonb),

    -- Sample 4 events (dispatched + courier pickup, then wrong destination attempt)
    (gen_random_uuid(), v_org_demo, v_sample_misrt, '10000000-0000-4000-8000-000000000031', 'sample_created', NULL, 'created',
     v_user_collector, 'collector', 'Asha Verma', v_fac_kish, now() - interval '85 minutes', now() - interval '85 minutes', false, '{}'::jsonb),
    (gen_random_uuid(), v_org_demo, v_sample_misrt, '10000000-0000-4000-8000-000000000032', 'sample_collected', 'created', 'collected',
     v_user_collector, 'collector', 'Asha Verma', v_fac_kish, now() - interval '80 minutes', now() - interval '80 minutes', false, '{"package_seal_intact":true}'::jsonb),
    (gen_random_uuid(), v_org_demo, v_sample_misrt, '10000000-0000-4000-8000-000000000033', 'sample_dispatched', 'collected', 'dispatched',
     v_user_collector, 'collector', 'Asha Verma', v_fac_kish, now() - interval '70 minutes', now() - interval '70 minutes', false,
     jsonb_build_object('assigned_courier_id', v_user_courier, 'assigned_courier_name', 'Ravi Meena')),
    (gen_random_uuid(), v_org_demo, v_sample_misrt, '10000000-0000-4000-8000-000000000034', 'courier_pickup', 'dispatched', 'dispatched',
     v_user_courier, 'courier', 'Ravi Meena', NULL, now() - interval '62 minutes', now() - interval '62 minutes', false, '{"package_seal_intact":true}'::jsonb),

    -- Isolated Organization B events
    (gen_random_uuid(), v_org_other, v_sample_other, '20000000-0000-4000-8000-000000000001', 'sample_created', NULL, 'created',
     v_user_external, 'admin', 'Anita Rao', v_fac_rewa, now() - interval '60 minutes', now() - interval '60 minutes', false, '{}'::jsonb),
    (gen_random_uuid(), v_org_other, v_sample_other, '20000000-0000-4000-8000-000000000002', 'sample_collected', 'created', 'collected',
     v_user_external, 'admin', 'Anita Rao', v_fac_rewa, now() - interval '50 minutes', now() - interval '50 minutes', false, '{}'::jsonb)
  ON CONFLICT (organization_id, client_event_id) DO NOTHING;

  -- 9. Seeded Open Operational Exceptions
  INSERT INTO public.exceptions (
    organization_id, sample_id, causal_event_id, rule_code, severity, status, title, details, detected_at
  )
  VALUES
    (
      v_org_demo, v_sample_delayed, v_evt_delayed_rx, 'TRANSIT_DELAY', 'medium', 'open',
      'Transit duration (265 min) exceeded operational review threshold (180 min)',
      jsonb_build_object(
        'elapsed_minutes', 265,
        'operational_delay_minutes', 180,
        'is_demo_policy', true,
        'medical_safety_note', 'Operational SLA alert only — does NOT automatically reject specimen. Authorized lab staff must review.'
      ),
      now() - interval '15 minutes'
    ),
    (
      v_org_demo, v_sample_misrt, NULL, 'DESTINATION_MISMATCH', 'high', 'open',
      'Destination mismatch: sample routed to Ajmer Lab was scanned at Jaipur Hub',
      jsonb_build_object(
        'expected_destination_facility_id', v_fac_ajmr,
        'attempted_facility_id', v_fac_jaip,
        'attempted_by', 'Kabir Joshi',
        'guidance', 'Receipt blocked at Jaipur Hub. Reroute sealed carrier to District Reference Laboratory — Ajmer.'
      ),
      now() - interval '35 minutes'
    )
  ON CONFLICT DO NOTHING;
END;
$$;
