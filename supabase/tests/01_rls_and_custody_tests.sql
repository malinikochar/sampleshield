-- ============================================================================
-- SampleShield — pgTAP Security, RLS, Multi-Tenant Isolation & Custody Tests
-- Run with: npx supabase test db
-- ============================================================================

BEGIN;

SELECT plan(14);

-- Helper: switch to anon
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$SELECT count(*) FROM public.samples$$,
  '42501',
  NULL,
  '1. Anonymous role is strictly denied SELECT on public.samples'
);

SELECT throws_ok(
  $$SELECT public.submit_custody_event(gen_random_uuid(), 'SS-7K4M-9P2X-Q8RN', 'courier_pickup', now(), false, '{}'::jsonb)$$,
  '42501',
  NULL,
  '2. Anonymous role cannot execute submit_custody_event RPC'
);

-- Switch to authenticated Sahyog Collector (Org A)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"aaaa1111-1111-4111-8111-111111111101","role":"authenticated","email":"asha.collector@sahyog-demo.example"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.samples WHERE organization_id = '22222222-2222-4222-8222-222222222222'),
  0,
  '3. Org A collector sees 0 samples from Org B (strict cross-tenant RLS isolation)'
);

SELECT is(
  (SELECT count(*)::int FROM public.samples WHERE organization_id = '11111111-1111-4111-8111-111111111111'),
  4,
  '4. Org A collector can view all 4 samples belonging to Org A'
);

SELECT throws_ok(
  $$INSERT INTO public.sample_events (organization_id, sample_id, client_event_id, event_type, resulting_status, actor_user_id, actor_role, actor_name)
    VALUES ('11111111-1111-4111-8111-111111111111', 'cccc1111-1111-4111-8111-111111111002', gen_random_uuid(), 'courier_pickup', 'dispatched', 'aaaa1111-1111-4111-8111-111111111101', 'collector', 'Asha')$$,
  '42501',
  NULL,
  '5. Authenticated users cannot directly INSERT into append-only sample_events table'
);

-- Switch to Sahyog Courier (Ravi Meena)
SELECT set_config('request.jwt.claims', '{"sub":"aaaa1111-1111-4111-8111-111111111102","role":"authenticated","email":"ravi.courier@sahyog-demo.example"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.samples),
  2,
  '6. Courier RLS restricts SELECT on public.samples strictly to actively assigned samples (2 of 4)'
);

SELECT is(
  (public.submit_custody_event(
    gen_random_uuid(),
    'SS-6B9F-2N4D-L7YV',
    'lab_accepted',
    now(),
    false,
    '{"disposition_reason":"Courier trying to accept sample"}'::jsonb
  )->>'error_code'),
  'FORBIDDEN',
  '7. Courier is forbidden from recording lab_accepted disposition'
);

SELECT is(
  (public.submit_custody_event(
    gen_random_uuid(),
    'SS-8V4N-2K9P-M7QX',
    'courier_pickup',
    now(),
    false,
    '{}'::jsonb
  )->>'error_code'),
  'NOT_FOUND',
  '8. Courier guessing Org B opaque sample code receives NOT_FOUND without cross-tenant leak'
);

-- Test idempotent replay: submit same client_event_id twice as Courier on assigned sample SS-3H8W-5T6J-C4ZP
SELECT is(
  (public.submit_custody_event(
    '99999999-1111-4111-8111-999999999901'::uuid,
    'SS-3H8W-5T6J-C4ZP',
    'courier_pickup',
    now(),
    true,
    '{"package_seal_intact":true,"handover_note":"First offline pickup submission"}'::jsonb
  )->>'ok')::boolean,
  true,
  '9. Authorized courier records pickup event via atomic RPC'
);

SELECT is(
  (public.submit_custody_event(
    '99999999-1111-4111-8111-999999999901'::uuid,
    'SS-3H8W-5T6J-C4ZP',
    'courier_pickup',
    now(),
    true,
    '{"package_seal_intact":true,"handover_note":"Duplicate replay of same client_event_id"}'::jsonb
  )->>'idempotent_replay')::boolean,
  true,
  '10. Replaying identical client_event_id returns idempotent_replay = true'
);

SELECT is(
  (SELECT count(*)::int FROM public.sample_events WHERE client_event_id = '99999999-1111-4111-8111-999999999901'::uuid),
  1,
  '11. Exactly 1 sample_events row is persisted after duplicate replay'
);

-- Switch to Jaipur Lab Technician (wrong destination for SS-3H8W-5T6J-C4ZP which is destined for Ajmer Lab)
SELECT set_config('request.jwt.claims', '{"sub":"aaaa1111-1111-4111-8111-111111111104","role":"authenticated","email":"kabir.jaipur@sahyog-demo.example"}', true);

SELECT is(
  (public.submit_custody_event(
    gen_random_uuid(),
    'SS-3H8W-5T6J-C4ZP',
    'lab_received',
    now(),
    false,
    '{}'::jsonb
  )->>'error_code'),
  'DESTINATION_MISMATCH',
  '12. Wrong receiving lab cannot silently receive sample; receives DESTINATION_MISMATCH'
);

SELECT is(
  (SELECT status::text FROM public.samples WHERE public_code = 'SS-3H8W-5T6J-C4ZP'),
  'dispatched',
  '13. Sample status remains dispatched after blocked wrong-destination scan'
);

-- Switch to Non-Demo Org B Admin (Anita Rao) and verify demo reset is blocked on non-demo tenant
SELECT set_config('request.jwt.claims', '{"sub":"bbbb2222-2222-4222-8222-222222222201","role":"authenticated","email":"anita.external@vindhya-test.example"}', true);

SELECT is(
  (public.trigger_demo_scenario('reset_clean')->>'error_code'),
  'FORBIDDEN',
  '14. Non-demo organization admin is strictly forbidden from invoking demo reset'
);

SELECT * FROM finish();

ROLLBACK;
