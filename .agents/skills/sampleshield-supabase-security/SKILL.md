---
name: sampleshield-supabase-security
description: "Designs Supabase PostgreSQL schema, SQL migrations, RLS permissions, tenant isolation, secure RPC functions and database tests. Use for any database change, query or server-side authorization."
---

# SampleShield Supabase Schema and RLS Security Skill

## Mission
Make the Supabase backend genuinely multi-tenant, auditable and least-privilege. The demo must not obtain correctness by turning security off.

## Workflow
1. Read `docs/PRD.md` schema and role matrix before writing migrations.
2. Use Supabase CLI and versioned SQL files in `supabase/migrations/`, seeded synthetic data in `supabase/seed.sql`, tests in `supabase/tests/`.
3. Enforce foreign keys and organization consistency; index `organization_id`, membership `user_id`, event `client_event_id`, sample status and other filtered columns.
4. Enable RLS on **every exposed table** and grant minimum needed operations. Scope SELECT/INSERT/UPDATE/DELETE separately. Never use blanket `USING (true)` on sample records.
5. Build server-authoritative event submission in transaction/RPC: derive identity from authenticated context, validate active membership and assignments, validate legal transition, ensure unique event id, append event and project status atomically.
6. Restrict mutation of audit event rows; prevent client-authorized updates/deletes. Log corrections as new events.
7. Test anonymous, same-tenant other-role, different-tenant and revoked membership cases with `supabase test db`.
8. Generate TypeScript types from live local schema and keep client/server access functions explicit.

## Security constraints
- Never ship service-role/secret keys to the frontend or Git.
- No patient-identifiable data stored for the hackathon; fixtures always synthetic.
- Avoid exposed `SECURITY DEFINER` functions; if needed, place in non-exposed schema, fix `search_path`, schema-qualify objects and explicitly restrict EXECUTE.
- Views must respect underlying RLS (security-invoker where supported).
- `public_code` must be random and opaque; possession must NOT bypass authentication.

## Proof requirement
Show SQL tests or reproducible queries proving a user from organization A cannot read/update organization B, a courier cannot perform lab disposition, and duplicate event submissions never create duplicate records.
