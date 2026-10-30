# SampleShield — Implementation Plan & Progress Tracker

**Product:** SampleShield  
**Tagline:** *Every sample has a journey. Every handoff should be accountable.*  
**Source of Truth:** [`docs/PRD.md`](./PRD.md), [`AGENTS.md`](../AGENTS.md), [`MASTER_BUILD_PROMPT.md`](../MASTER_BUILD_PROMPT.md)

> **Safety & Scope Non-Negotiables**
> - Operational chain-of-custody visibility prototype — **never** a diagnostic device, LIS, or autonomous specimen acceptability judge.
> - Only authorized `lab` / `admin` personnel may record `accepted` or `rejected` disposition (with mandatory rationale for rejection and any override).
> - Zero real PHI anywhere in database, QR codes, URLs, logs, IndexedDB, or tests. Persistent `DEMO DATA — NOT REAL PATIENT RECORDS` indicator on synthetic datasets.
> - Server-authoritative atomic state transitions, strict multi-tenant RLS, idempotent `client_event_id` deduplication, and explicit visual separation between `Pending on this device` and `Confirmed by server`.

---

## Compatibility & Stack Decisions

| Layer | Package / Tool | Choice & Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript strict | Uses current App Router conventions (`src/proxy.ts` for `@supabase/ssr` session refresh, `src/app/manifest.ts` for PWA manifest). |
| Styling & UI | Tailwind CSS + shadcn/ui primitives + Lucide React | Custom SampleShield clinical-operations palette (`#F7FAFC` porcelain, `#142437` deep ink, `#183B56` navy, `#0E9488` medical teal, `#E8A23C` amber, `#D85A56` red) with accessible text+icon badges. |
| Forms & Validation | React Hook Form + Zod | Shared client/server schemas in `src/lib/validation/` ensuring field-level UX errors and strict server allowlists. |
| Backend & Auth | Supabase PostgreSQL 17 + Supabase Auth + `@supabase/ssr` | Publishable key + user JWT cookies only (no `service_role` in app runtime). Atomic RPC functions in Postgres with `SET search_path = ''`, least-privilege table grants, and RLS enabled + forced on all tables. |
| Offline Queue | Dexie (IndexedDB) + Static-Shell Service Worker (`public/sw.js`) | Minimal non-PHI event queue (`client_event_id`, `sample_public_code`, `event_type`, `client_occurred_at`, allowlisted metadata, retry state) + authorized courier assignment cache cleared on logout. Service worker caches static shell assets only, never `/api/*` or Supabase responses. |
| QR Generation & Scan | `qrcode` (SVG/Canvas print-ready opaque code) + `jsqr` camera stream | Browser camera viewport with clean permission/error handling and first-class manual opaque code fallback. |
| Analytics | Recharts | Server-confirmed tenant aggregates + transparently labelled illustrative patient-burden scenario model. |
| Quality Gates | Vitest + Testing Library + Playwright + Supabase pgTAP (`supabase test db`) | Unit tests for state machine/rules/validation, SQL RLS & idempotency tests, and E2E browser + offline sync tests. |

---

## Phase Checklist & Acceptance Gates

### Phase 0 — Foundations, Design System & Database Security
- [x] **P0.1** Initialize Git repository and strict `.gitignore` (protecting `.env.local`, `.env.*.local`, `.vercel`, `.cache`, build artifacts, and temp files before any commit).
- [x] **P0.2** Scaffold Next.js App Router TypeScript strict project in workspace root while preserving `AGENTS.md`, `MASTER_BUILD_PROMPT.md`, `SKILLS_GUIDE.md`, `.agents/skills/*`, and `docs/PRD.md`.
- [x] **P0.3** Configure Tailwind design tokens, typography (`Inter` / `JetBrains Mono` for codes & timestamps), and core accessible UI + domain primitives (`StatusBadge`, `SyncBadge`, `DemoDatasetBanner`, `Timeline`, `QrPanel`).
- [x] **P0.4** Initialize Supabase CLI (`supabase/`), author normalized SQL migrations (`organizations`, `facilities`, `memberships`, `samples`, `sample_assignments`, `sample_events`, `rejected_event_attempts`, `exceptions`, `exception_actions`, `facility_policies`), composite tenant foreign keys, indexes, append-only audit triggers, strict grants, RLS policies, and atomic RPC operations.
- [x] **P0.5** Author synthetic seed data (`supabase/seed.sql`) for fictional **Sahyog Rural Health Network** (`is_demo = true`) with clinics (`Kishangarh PHC`, `Bassi CHC`), labs (`District Reference Lab — Ajmer`, `Regional Diagnostic Hub — Jaipur`), demo users (`collector`, `courier`, `lab`, `admin`), and an isolated second tenant (**Vindhya District Diagnostics**, `is_demo = false`) for cross-tenant negative security tests.
- [x] **P0.6** Set up `@supabase/ssr` browser/server/proxy clients, typed database definitions, `.env.example`, and GitHub Actions CI (`.github/workflows/ci.yml`).
- **Acceptance check:** Verified — `supabase start` applied schema & seed cleanly; `supabase test db` passed `14/14`; `npm run typecheck` and `npm run lint` passed with `0` errors/warnings.

### Phase 1 — Working End-to-End Vertical Slice
- [x] **P1.1** Build public marketing landing page (`/`) with interactive HTML/CSS Sample Passport preview, 3-step custody explanation, safety disclaimer, and role sign-in CTA.
- [x] **P1.2** Build authentication flow (`/login`, sign-out guard, demo quick-fill credentials helper for seeded synthetic personas) and `/app/*` protected shell (desktop collapsible sidebar + mobile thumb-friendly bottom bar + persistent connectivity/sync bar).
- [x] **P1.3** Implement server API route handlers (`/api/samples`, `/api/samples/[id]`, `/api/events`, `/api/exceptions`, `/api/exceptions/[id]/action`, `/api/analytics`, `/api/demo/reset`, `/api/sync/status`, `/api/settings/*`) backed by Supabase RLS & atomic RPCs.
- [x] **P1.4** Build Collector workflow: guided Create Sample stepper (`/app/samples/new`), printable opaque QR label, collection & courier dispatch actions.
- [x] **P1.5** Build Sample List (`/app/samples`), Sample Passport detail (`/app/samples/[id]`), and Camera + Manual QR Scanner (`/app/scan`).
- [x] **P1.6** Build Courier Handovers screen (`/app/handovers`) and Receiving Lab Desk (`/app/lab`) with mandatory human-reviewed disposition (`Accept` / `Reject` with reason confirmation dialog).
- [x] **P1.7** Write and run pgTAP RLS & state-machine negative tests (cross-tenant denial, anonymous denial, courier forbidden from lab disposition, idempotent event replay).
- **Acceptance check:** Verified end-to-end via Playwright (`executes full Collector -> Courier -> Wrong-Lab Block -> Authorized Lab Acceptance workflow`).

### Phase 2 — Offline Queue, Sync & Conflict Resolution
- [x] **P2.1** Configure installable PWA (`src/app/manifest.ts`, icons, and static-asset-only `public/sw.js` that explicitly bypasses `/api/*` and Supabase Auth/REST requests).
- [x] **P2.2** Implement Dexie IndexedDB queue (`src/lib/offline/db.ts`) storing minimal non-PHI custody events (`queued`, `syncing`, `synced`, `conflict`, `failed_retriable`) and minimal pre-authorized courier assignments.
- [x] **P2.3** Build sync coordinator (`src/lib/offline/sync-manager.ts`) triggering on `online` event, document visibility/focus, and explicit `Retry sync` action with exponential backoff, auth-expiry pause, and strict idempotent `client_event_id` replay.
- [x] **P2.4** Surface truthful `Pending on this device`, `Syncing with server…`, `Confirmed by server`, and `Needs review (Conflict)` badges across `/app/handovers`, `/app/samples/[id]`, `/app/dashboard`, and logout confirmation dialog.
- **Acceptance check:** Verified in Vitest (`tests/unit/offline-sync.test.ts`) and Playwright E2E (`proves offline IndexedDB persistence across reload, reconnect sync, and idempotent UUID replay`).

### Phase 3 — Deterministic Exceptions, Analytics & Judge Failure Simulation
- [x] **P3.1** Verify all deterministic operational exception rules: `MISSING_REQUIRED_FIELD`, `DESTINATION_MISMATCH`, `HANDOVER_GAP`, `TRANSIT_DELAY` (against configurable non-clinical demo SLA), `DUPLICATE_EVENT`, `INVALID_TRANSITION`, and `OFFLINE_CONFLICT`.
- [x] **P3.2** Build Exception Inbox (`/app/exceptions`) with severity & status filters, evidence inspection, and `Acknowledge` / `Resolve` / `Reopen` audit trail actions.
- [x] **P3.3** Build Operational Analytics (`/app/analytics`) with server-confirmed KPIs, Recharts custody/exception visualizations, CSV aggregate export (`FR-15`), and interactive `Patient-Burden Lens` simulation clearly labelled `Illustrative scenario — not observed outcome`.
- [x] **P3.4** Build Admin Settings (`/app/settings`) for facility & demo SLA policy configuration (`FR-16`) and Demo Control Center (`/app/demo`) restricted to demo org admins to trigger `Happy Path`, `Wrong Destination`, `Offline Courier`, `Delayed Arrival`, `Duplicate Submission`, and safe demo-tenant-only reset.
- **Acceptance check:** Verified in pgTAP (`01_rls_and_custody_tests.sql`), Vitest (`state-machine.test.ts`, `validation-and-analytics.test.ts`), and Playwright E2E.

### Phase 4 — Hardening, Automated QA, Demo Script & Deployment
- [x] **P4.1** Accessibility & responsive polish audit (375×812 mobile & 1440×900 desktop verified with zero horizontal overflow, keyboard/dialog accessibility, ARIA roles, and zero ESLint/React Compiler warnings).
- [x] **P4.2** Comprehensive Vitest unit suite (`19/19` passing) and Playwright E2E suite (`5/5` passing across desktop + mobile).
- [x] **P4.3** Author [`docs/DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) (3-minute live judge script + 60-second fallback storyboard + Q&A defense) and update [`README.md`](../README.md) with architecture, local setup, migration, and deployment runbooks.
- [x] **P4.4** Run full verification suite (`npm run lint`, `npm run typecheck`, `npm run test`, `npx supabase test db`, `npm run build`, `npm run test:e2e`) and push to GitHub + deploy preview/production build on Vercel safely.

---

## Progress Log

- **2026-10-30:** Read `docs/PRD.md`, `AGENTS.md`, `MASTER_BUILD_PROMPT.md`, `SKILLS_GUIDE.md`, and all 11 workspace skills. Scaffolded Next.js 16 + Supabase PostgreSQL schema/RLS/RPCs + Dexie offline queue + full UI screens.
- **2026-10-31:** Verified all quality gates:
  - `npm run typecheck` — `0` errors
  - `npm run lint` — `0` errors, `0` warnings
  - `npm run test` — `19/19` Vitest tests passed
  - `npx supabase test db` — `14/14` pgTAP RLS & custody assertions passed
  - `npm run build` — `26/26` Next.js 16 routes + Proxy compiled cleanly (`0` secret leaks in `.next/static`)
  - `npm run test:e2e` — `5/5` Playwright desktop (`1440×900`) & mobile (`375×812`) E2E suites passed against live local Supabase.
