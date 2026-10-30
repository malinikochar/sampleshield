# SampleShield — Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Hackathon MVP specification  
**Updated:** 30 October 2026  
**Product:** SampleShield  
**Tagline:** *Every sample has a journey. Every handoff should be accountable.*  
**Primary stack:** Next.js + TypeScript + Tailwind/shadcn + Supabase + IndexedDB + GitHub + Vercel

> **Product safety boundary:** SampleShield is a prototype for operational sample-chain-of-custody visibility, not a medical device, clinical diagnostic system, laboratory information system (LIS), or substitute for accredited sample handling protocols. Sample accept/reject decisions belong to authorized laboratory staff. All demo patient and sample data MUST be fictional. Never claim clinical validation or guaranteed error reduction.

---

## 1. Executive summary

SampleShield is an offline-first progressive web app (PWA) that helps primary health centers, couriers, and receiving laboratories trace diagnostic specimens as they move between facilities. It reduces *preventable operational blind spots* by checking identity fields at collection, recording each chain-of-custody handover, warning about incomplete or delayed transfers, and requiring laboratory staff to acknowledge exceptions.

The product addresses a narrow, compelling workflow: **a diagnostic sample changes hands, and no one knows exactly where the handover broke down.** It is designed for intermittent connectivity and mobile-first workflows. The hackathon differentiator is not mere QR tracking: it is a *controlled event ledger + offline sync + exception review + operational impact demonstration*.

## 2. Problem statement

In low-resource and distributed healthcare environments, specimens collected at clinics may move through several people before reaching a receiving laboratory. Paper-based records, intermittent internet access, missing labels, incomplete handovers, and delays make it difficult to investigate what happened and decide which next action is required. An avoidable repeat collection can increase patient burden and cost. The prototype must never assume that a time delay alone determines specimen viability.

### 2.1 Target users

| Persona | Typical environment | Needs | Authorized actions |
|---|---|---|---|
| Collector | Primary healthcare clinic | Create and label samples quickly; confirm IDs; dispatch | Register sample, collect, dispatch, review own facility's records |
| Courier | Transport route / low-connectivity area | Confirm pickup, custody and drop-off even offline | Scan, record permitted custody handovers, review assigned deliveries |
| Lab technician | Receiving laboratory | Acknowledge receipt; see discrepancies; make documented disposition decisions | Receive, accept/reject with reason, review exceptions |
| Organization admin | Clinic / lab operations | Configure facilities, roles and demonstration policies | Manage memberships, sample-policy configuration, view authorized analytics |

### 2.2 Jobs to be done

- When I collect a sample, help me verify that its identifier and destination are correct so it is not misrouted.
- When I hand over a sample, give both sides a traceable, timestamped event—even when my device is offline.
- When I work in the laboratory, show which inbound samples have unresolved transport issues and require human review.
- When I operate a facility, show how many handovers were delayed, incomplete, or unresolved and where intervention is needed.

## 3. Goals, non-goals and success criteria

### 3.1 MVP goals (P0)

1. Register a specimen with an **opaque, non-PII QR code** and required identifying fields.
2. Capture chain-of-custody events from collection through laboratory disposition.
3. Support offline creation/queuing of allowed handover events and visible synchronization on reconnection.
4. Flag missing required fields, invalid handover sequences, mismatched destinations, and delays against **demo/organization-defined operational policies**.
5. Let an authorized lab user review discrepancies, record acceptance or rejection, and acknowledge exceptions.
6. Provide role-based screens, tenant isolation, audit visibility and a convincing synthetic demo.
7. Run on mobile and desktop and deploy from GitHub to Vercel with Supabase as hosted backend.

### 3.2 Non-goals (not in hackathon MVP)

- Diagnosing disease, interpreting test results, giving medical advice or deciding specimen suitability autonomously.
- Laboratory analyzer integration, actual IoT temperature/GPS sensing, drone dispatch, SMS/WhatsApp services, national patient identity integration or insurance claims.
- Storing real patient names, phone numbers, diagnoses, photographs of prescriptions or laboratory reports.
- Complex supply-chain route optimization, billing, payments or hospital appointments.
- A native mobile app. The prototype is a PWA.

### 3.3 Testable success metrics

| Metric | Definition | MVP target or demonstration |
|---|---|---|
| Event delivery reliability | Unique queued events accepted by the server after reconnection / valid queued events | 100% across defined local test scenarios; not a real-world guarantee |
| Duplicate handling | Replayed event IDs recorded at most once | 0 duplicate persisted events in automated replay test |
| Unauthorized access | Cross-organization reads/writes in negative tests | 0 successful unauthorized operations |
| Exception detection | Expected alerts triggered in seeded failure scenarios | 100% for specified deterministic test cases |
| Task completion | Staff can create → dispatch → receive → review a synthetic sample | End-to-end completion in a live demo |
| App readiness | Build, type check, lint, unit tests and critical E2E tests | All green before demonstration |
| Impact hypothesis | Potential repeat trips avoided and turnaround improvements | Display labelled *simulation only*; measure in any future real pilot |

**Do not present invented real-world effectiveness percentages.** Demo metrics must be explicitly labelled `Synthetic demo data`.

## 4. Positioning and originality

**Positioning:** “The missing accountability layer between the collection clinic and the receiving laboratory.”

**Distinctive capabilities:**

1. **Sample Passport:** a compact QR-linked summary of destination, specimen type, current custody and event history; no patient-sensitive information in the code.
2. **Proof-of-Handoff:** immutable-ish append-only operational event ledger with actor identity, server receipt timestamp and idempotent event IDs; not claimed as cryptographically tamper-proof.
3. **No-Network Mode:** queued custody actions with truthful `Pending on this device` status until server confirmation.
4. **Exception Inbox:** role-directed review of missing identity, custody gaps, destination mismatch and delays.
5. **Failure-injection demo:** one-click synthetic cases for a wrong destination, duplicate scan, offline courier, and delayed receipt.
6. **Patient-Burden Lens:** cautious, explicitly hypothetical estimates of additional trips and costs that might be avoided if process failures are reduced.

## 5. Product experience and information architecture

### 5.1 Navigation

| Route | Screen | Role(s) |
|---|---|---|
| `/` | Public product landing, value proposition, demo preview | Public (no sample data) |
| `/login` | Sign in / sign out | Public |
| `/app/dashboard` | KPI cards, pending work, alerts, recent events | All authenticated roles, filtered |
| `/app/samples` | Search/list of authorized samples | Collector, lab, admin; courier assigned only |
| `/app/samples/new` | Guided create-sample wizard | Collector, admin |
| `/app/samples/[id]` | Sample passport, printable QR, event timeline, exceptions | Authorized users only |
| `/app/scan` | Camera QR scanner and manual opaque-code fallback | Collector, courier, lab |
| `/app/handovers` | Pickup/drop-off queue and offline pending tray | Courier, collector |
| `/app/lab` | Receiving lab inbox and disposition workflow | Lab, admin |
| `/app/exceptions` | Open/acknowledged/resolved exceptions | Lab, admin; limited collector read |
| `/app/analytics` | Trends, breakdowns, simulated impact (demo only) | Admin, lab aggregated as permitted |
| `/app/settings` | Facilities, roles, organization policy settings | Admin |
| `/app/demo` | Reset/trigger synthetic demo scenarios | Demo organization admin only |

### 5.2 Design direction

Aim for an exceptionally polished, accessible healthcare operations product—not a generic dashboard template.

- **Visual tone:** reassuring, precise, contemporary, trustworthy; strong hierarchy, generous spacing, minimal decoration.
- **Palette:** porcelain `#F7FAFC`, white `#FFFFFF`, ink `#142437`, deep navy `#183B56`, medical teal `#0E9488`, light teal `#E5F7F3`, amber `#E8A23C`, red `#D85A56`, muted blue-gray `#64748B`.
- **Typography:** Inter or Geist for UI; clear numeric typography for metrics and timestamps.
- **Spacing:** 8px scale, rounded 12–16px surfaces, subtle shadow, high-contrast text.
- **Layout:** mobile bottom navigation for priority tasks, desktop left sidebar and contextual right rail when useful.
- **Interactions:** restrained microanimations, skeleton states, toasts, confirmations for high-impact actions; use accessible dialogs and focus management.
- **Accessibility:** WCAG 2.2 AA target, keyboard navigation, labels, visible focus states, no color-only status indicators, 44px touch targets where practical, reduced-motion preference.
- **Critical UX:** persistent connectivity indicator; per-event status `Saved on this device` / `Syncing` / `Synced` / `Needs attention`; pending events must not look like confirmed records.

### 5.3 Key screens in detail

**Dashboard:** hero KPI band (`Samples in transit`, `Awaiting lab receipt`, `Open exceptions`, `Pending device sync`); status trend; role-based action panel; recent chain-of-custody timeline. Small `Demo dataset` label if applicable.

**Create sample:** a short stepper: (1) source/destination, (2) specimen type and optional fictional case alias, (3) validation summary, (4) QR preview and print/download. Prevent missing required fields before creation. Capture no medical diagnosis.

**Sample Passport:** top status, opaque QR, source/destination, timestamped custody steps, actor and sync verification, timeline filters, open alerts, permitted action button. Scan result must not expose confidential details to an unauthenticated viewer.

**Scanner:** live camera scanner with manual entry fallback, flashlight option only if browser supports it, clear permission instructions, and error states for invalid/unknown QR codes.

**Courier queue:** assigned pickup/drop-off items, `Go offline` guided demonstration button (demo mode only; real offline uses browser network), event composer, local pending tray with retry.

**Lab Inbox:** incoming and received sample tabs, required checks, exception details, accept/reject action with rationale and confirmation, no automatic disposition.

**Exceptions:** severity labels, rule violated, evidence/counterparty and review state, acknowledge and resolve actions; administrative overrides require rationale and leave a trace.

**Analytics:** counts, median observed duration, exception types, sync lag distribution, synthetic cost scenarios with transparent assumptions. Exclude unverified queued events from confirmed metrics.

## 6. Core workflows

### 6.1 Happy path

1. Collector signs in and creates a sample for a known source clinic and receiving lab.
2. The server validates membership and returns a high-entropy opaque sample code, printable as QR.
3. Collector scans/validates identifier, records collection, and dispatches to an authorized courier.
4. Courier records pickup; app may be offline and queues an event with `Pending` badge.
5. The courier reconnects; client retries safely and the server validates then confirms the event.
6. Lab technician scans on arrival and records receipt.
7. Laboratory staff reviews any operational alerts and records final `Accepted` or `Rejected` disposition with reason.
8. Timeline and analytics update from **server-confirmed** records.

### 6.2 Incident path: wrong destination

- A collector chooses/attempts to submit a destination that conflicts with the authorized order or scans an identifier linked to a different destination.
- The app blocks an invalid transition, provides a specific explanatory message, and writes an exception for authorized review if appropriate.
- The issue must be corrected by an authorized user; never silently redirect a sample.

### 6.3 Incident path: delayed handover

- Server flags a sample whose acknowledged transit/receipt time exceeds a configurable **operational/demo threshold**.
- Show who is accountable for the next review and what information was logged.
- Do **not** state that the sample has spoiled or must be rejected. Only authorized lab staff decide disposition.

### 6.4 Incident path: offline courier

- After a prior successful sign-in, courier goes offline.
- Courier records an allowed pickup event linked to a previously cached, authorized assignment; no creation of new broad-access records while offline.
- IndexedDB stores only minimal event data needed for sync, not patient names or full health records.
- Client displays explicit pending status. On reconnect, reauthenticate if necessary, submit idempotent events, show server confirmation or actionable conflict.
- If role/assignment has changed, server refuses submission and leaves item visibly `Needs review`; no silent success.

### 6.5 Incident path: duplicate scan or conflict

- Replaying an identical `client_event_id` must not create a second custody record.
- Conflicting event sequences are rejected for review; client/server clocks may differ; server receipt time is authoritative for confirmation.
- Never overwrite the audit timeline to conceal duplicate or rejected attempts.

## 7. Detailed functional requirements

| ID | Priority | Requirement | Acceptance check |
|---|---|---|---|
| FR-01 | P0 | Supabase Auth sign-in, session expiry and sign-out | Unauthorized user cannot access `/app/*` |
| FR-02 | P0 | Organization-scoped membership and roles | Cross-tenant access denied in RLS tests |
| FR-03 | P0 | Admin-managed demo organization, clinic and lab | New sample references valid facilities in same tenant |
| FR-04 | P0 | Create sample with required validation | Incomplete fields cannot be submitted |
| FR-05 | P0 | Generate and scan opaque QR | No patient name or diagnosis in QR payload |
| FR-06 | P0 | Validated custody event transitions | Invalid role or state transition rejected server-side |
| FR-07 | P0 | Offline queue for eligible custody events | Offline item visibly pending; survives reload |
| FR-08 | P0 | Idempotent server sync | Replayed event not duplicated |
| FR-09 | P0 | Rules-based operational exceptions | Deterministic seeded scenario produces expected alert |
| FR-10 | P0 | Authorized lab disposition with reason | Only permitted lab/admin role can complete disposition |
| FR-11 | P0 | Sample passport and audit timeline | Accurate actor, client timestamp, server timestamp shown |
| FR-12 | P0 | Responsive role-based dashboard | Works at 375px and desktop widths |
| FR-13 | P0 | Synthetic demonstration data and reset | Reset works only for demo tenant, never production data |
| FR-14 | P0 | GitHub CI, Vercel build, env setup docs | Lint/type/build/test all pass |
| FR-15 | P1 | CSV export of allowed operational aggregates | Unauthorized or sensitive fields excluded |
| FR-16 | P1 | Admin facility management UI | Permission checks and validations pass |
| FR-17 | P1 | Impact simulation panel with assumptions | Metrics labelled hypothetical, not real effect claims |
| FR-18 | P2 | Multilingual UI strings | English core, Hindi optional after validated translation |
| FR-19 | P2 | Instrument/sensor integration | Not included; only future architecture notes |

## 8. State machine and exception rules

### 8.1 Sample status

**States:** `created`, `collected`, `dispatched`, `received`, `accepted`, `rejected`.

- `created → collected`: collector/admin at source facility.
- `collected → dispatched`: collector/admin assigns custody/transport destination.
- `dispatched → received`: authorized receiving lab after courier custody event(s).
- `received → accepted` or `received → rejected`: authorized lab/admin, reason required for rejection.
- Final dispositions are terminal in MVP. A reversal is an audited administrative correction, not a silent update.
- `flagged` is **not** a status transition; an exception can be open at any state.
- Courier pickup/drop-off are custody events and do not on their own grant authority to mark the sample `accepted`.

### 8.2 Rules (deterministic, never clinical diagnostic)

| Code | Trigger | Severity | Action |
|---|---|---|---|
| `MISSING_REQUIRED_FIELD` | Required administrative field missing | Blocker | Block submission and explain |
| `DESTINATION_MISMATCH` | Scanned sample destination differs from authorized target | High | Block unauthorized receipt; alert lab/admin |
| `HANDOVER_GAP` | Expected custody acknowledgment absent according to configured operational workflow | Medium | Create review item |
| `TRANSIT_DELAY` | Confirmed event timestamps exceed an admin-configured demo/operational SLA | Medium | Notify lab review queue; no automatic specimen rejection |
| `DUPLICATE_EVENT` | Same client event ID submitted more than once | Info | Idempotently return prior result |
| `INVALID_TRANSITION` | Attempted state or role change not allowed | High | Reject event with actionable error; log attempted action |
| `OFFLINE_CONFLICT` | Locally queued event contradicts confirmed server state | Medium | Leave queued item in conflict tray for resolution |

For the demonstration, admin-configured `TRANSIT_DELAY` values are synthetic exercise settings, **not medical specimen stability limits**. Policies must visibly identify their source, scope and update date.

## 9. Technical architecture

```text
                    ┌──────────────────────────────┐
                    │  Next.js PWA on Vercel       │
                    │  React + TypeScript + UI     │
                    └──────────────┬───────────────┘
                                   │
                 ┌─────────────────┴─────────────────┐
                 │                                   │
       Online authenticated                  Offline after prior
       requests / queries                      authorization
                 │                                   │
    ┌────────────▼────────────┐            ┌─────────▼──────────┐
    │ Supabase Auth + RLS     │            │ IndexedDB minimal  │
    │ PostgreSQL & RPC       │◄───────────│ pending event queue│
    │ authoritative events   │  validated │ SW: static assets  │
    └────────────┬────────────┘  replay    └────────────────────┘
                 │
        ┌────────▼───────────┐
        │ Exceptions +       │
        │ operational charts │
        └────────────────────┘
```

### 9.1 Architecture standards

- Next.js **App Router**, strict TypeScript, responsive components.
- Supabase Auth with supported SSR setup (`@supabase/ssr` where appropriate); use currently documented APIs rather than deprecated helpers.
- Store SQL migrations in `supabase/migrations/`, local-only fixtures in `supabase/seed.sql`, and RLS tests in `supabase/tests/`.
- Use Postgres transaction/RPC or secure server handlers to validate custody events, append confirmed event and update projection **atomically**.
- Client never directly changes sensitive status fields or inserts arbitrary audit events in a permissive table.
- Use a unique `client_event_id` for retries and an idempotent submission API. Do not treat a client timestamp as authoritative.
- Basic offline capability with IndexedDB queue. Service worker should cache the app shell/static assets, **not** private API responses or authenticated health data.
- Do not depend solely on Background Sync API support: offer an explicit `Retry sync` button and retry when app resumes/comes online.
- Prefer server-side filtered aggregates and tenant-scoped queries for charts.
- Strictly separate `demo` tenancy and synthetic data from any hypothetical real deployment.

### 9.2 Proposed relational schema

> This is a design contract, not a ready-to-run migration. Antigravity must implement normalized SQL migrations, foreign keys, indexes, constraints, restricted grants and explicit RLS policies.

**`organizations`**  
`id uuid PK`, `name text`, `is_demo boolean`, `created_at timestamptz`.

**`facilities`**  
`id uuid PK`, `organization_id uuid FK`, `name text`, `facility_type enum(clinic,lab)`, `is_active boolean`, `created_at`. Enforce cross-table tenant consistency.

**`memberships`**  
`id uuid PK`, `organization_id uuid FK`, `user_id uuid FK auth.users`, `facility_id uuid FK nullable`, `role enum(collector,courier,lab,admin)`, `is_active boolean`, `created_at`, unique membership business rule. Role/facility managed only by privileged paths.

**`samples`**  
`id uuid PK`, `organization_id uuid FK`, `public_code text UNIQUE` (cryptographically random opaque code), `source_facility_id FK`, `destination_facility_id FK`, `specimen_type text`, `case_alias text nullable` (synthetic/non-identifying in MVP), `order_reference text nullable` (fictional), `status enum`, `created_by uuid`, `created_at timestamptz`, `updated_at timestamptz`, `is_demo boolean`. No real identifiable patient field.

**`sample_events`**  
`id uuid PK`, `organization_id uuid FK`, `sample_id uuid FK`, `client_event_id uuid`, `event_type enum`, `actor_user_id uuid`, `actor_facility_id uuid nullable`, `client_occurred_at timestamptz nullable`, `server_recorded_at timestamptz DEFAULT now()`, `was_queued_offline boolean`, `metadata jsonb` (strictly validated allowlist), `created_at`; unique `(organization_id, client_event_id)`. Server-only append, no user update/delete. For rejected attempts use a separate security audit mechanism that doesn't spoof confirmed custody events.

**`exceptions`**  
`id uuid PK`, `organization_id uuid FK`, `sample_id uuid FK`, `rule_code text`, `severity enum`, `status enum(open,acknowledged,resolved)`, `details jsonb` (no PHI), `detected_at timestamptz`, `resolved_at nullable`, `resolved_by nullable`. Avoid duplicate open exceptions for the same causal event/rule.

**`exception_actions`**  
`id uuid PK`, `organization_id uuid FK`, `exception_id uuid FK`, `actor_user_id uuid`, `action enum(acknowledge,resolve,reopen)`, `reason text nullable`, `created_at timestamptz`. Append-only actions; project current exception status from actions or update exception within same transaction.

**`facility_policies`**  
`id uuid PK`, `organization_id uuid FK`, `facility_id uuid FK`, `policy_name text`, `operational_delay_minutes integer nullable`, `is_demo_policy boolean`, `updated_by uuid`, `updated_at timestamptz`. Never label a time threshold medically safe unless a competent lab professional has validated it for that specimen and handling context.

**`sample_assignments`**  
`id uuid PK`, `organization_id uuid FK`, `sample_id uuid FK`, `courier_user_id uuid FK auth.users`, `assigned_by uuid`, `assigned_at`, `is_active boolean`. Used to scope courier access. Explicitly test unauthorized access.

### 9.3 Server API operations

```text
POST /api/samples                  Create sample, authorized collector/admin only
GET  /api/samples                  Tenant- and role-scoped list
GET  /api/samples/:id              Scoped Sample Passport
POST /api/events                   Atomic, idempotent, validated custody event
GET  /api/sync/status?event_ids=…   Check confirmed/rejected event IDs
GET  /api/exceptions               Scoped review queue
POST /api/exceptions/:id/action    Acknowledge/resolve with audit
GET  /api/analytics                Tenant-scoped aggregates only
POST /api/demo/reset               Demo admin only; guarded environment
```

These endpoints may use Next.js route handlers and Postgres RPC; do not duplicate authorization logic between conflicting paths. Return consistent errors: `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_STATE`, `CONFLICT`, `BAD_REQUEST`, `OFFLINE_PENDING`, `SERVER_ERROR`.

### 9.4 Example event envelope

```json
{
  "client_event_id": "uuid-generated-on-device",
  "sample_public_code": "SS-OPAQUE-RANDOM-CODE",
  "event_type": "courier_pickup",
  "client_occurred_at": "2026-10-30T07:00:00.000Z",
  "metadata": { "handover_note": "Sealed package checked" }
}
```

The server MUST determine the authenticated actor, organization, authorized assignment, legal transition and authoritative receipt timestamp; it must NOT accept `actor_user_id` or arbitrary `organization_id` as trusted from the client.

## 10. Offline sync contract (critical)

1. **Precondition:** The user authenticated online previously; the device retains only authorized, minimal assignments needed for the chosen operation. Offline mode is not fresh login.
2. **Queue:** Generate a UUID for each action and store payload and local state in IndexedDB. Avoid PHI and encrypt-at-rest claims without actually implementing them.
3. **Display:** Mark each action `Pending on device`. Never display it as `Synced`, `Received`, or authoritative before server acknowledgment.
4. **Sync:** Trigger on connection return, app focus, or manual retry; process carefully with stable client IDs. Exponential backoff for transient errors and explicit retry UI.
5. **Server:** Validate auth, membership, assignment, event schema, expected state and idempotency within a transaction.
6. **Conflict:** Invalid role, revoked assignment or illegal state => conflict status, human-readable reason and manual review path. Do not force overwrite.
7. **Confirmation:** Mark `Synced` only after server returns confirmed event identifier/timestamp.
8. **Integrity:** Do not rely on client clocks, online indicators, browser storage durability, or GPS coordinates as proof of custody.
9. **Logout and privacy:** Clear cached assignment data and queued operational payloads safely on logout, with explicit user warning before discarding unsynced events.
10. **Test:** airplane mode / DevTools offline; refresh; capture; reconnect; duplicate requests; simultaneous lab action; session expiration; different organization account.

## 11. Security, privacy and governance

- **Synthetic data only** for hackathon. Add persistent `DEMO DATA — NOT REAL PATIENT RECORDS` indicator on demo datasets.
- **No real PHI in QR**, URLs, browser analytics, console logs, client errors, screenshots or seeded fixtures.
- Enforce **Supabase RLS** on all exposed tables and test grants/policies for anonymous, authenticated and cross-tenant users. Consider security-invoker views where relevant.
- Service role/secret credentials must **never** be available in browser bundles, `NEXT_PUBLIC_*` variables, Git history or client-side logs.
- Use a publishable key for public Supabase client; production-only secrets go into server-side Vercel environment variables if strictly required.
- Authorization MUST occur server-side for state transitions, not only by hiding buttons in UI.
- Audit events are append-only from clients; administrative corrections are new traceable records. Do not claim immutability against database administrators.
- Require authentication for private pages, session refresh protections, secure headers where practical, input validation (e.g., Zod), rate limits for write endpoints where practical.
- Avoid training AI models on operational data; optional AI feature is limited to non-diagnostic admin assistance and disabled by default.
- Before any real clinical pilot: perform privacy/security/legal assessment and consult relevant clinicians, laboratory management and applicable laws; do not claim compliance solely due to Supabase usage.

## 12. QA and acceptance scenarios

### Critical end-to-end tests

**E2E-01 — Happy path:** collector creates, collects, dispatches; courier picks up; lab receives and accepts. Timeline lists confirmed events in order with correct authorized actors.

**E2E-02 — Wrong destination:** mismatched lab scan is rejected and creates an actionable exception (when authorized and appropriate); no silent redirection.

**E2E-03 — Offline round-trip:** valid courier saves pickup offline, refreshes app, reconnects, resubmits; one confirmed event appears and pending UI clears.

**E2E-04 — Duplicate event:** send identical `client_event_id` twice. Server returns the same effective result, one persisted event only.

**E2E-05 — Collision:** lab receives while courier has stale offline event. Server detects stale state; courier sees `Needs review` and no false confirmation.

**E2E-06 — Security:** Organization A collector cannot read Organization B's sample, even with guessed identifier or API call. Courier cannot accept/reject. Anonymous users cannot query sample tables.

**E2E-07 — Bad connectivity:** no camera permission triggers manual code fallback; network timeout leaves visible pending event; hard refresh preserves queue.

**E2E-08 — Demo safety:** seeded records and analytics labelled synthetic; demo reset cannot delete other organizations.

**E2E-09 — Accessibility:** key workflows usable without mouse; dialogs focus correctly; error messages are described; statuses have textual labels.

**E2E-10 — Deployment:** clean Vercel preview loads, Supabase credentials configured, auth redirect works, migrations documented, no service role in client output.

### Quality gates

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e` for the critical path, including offline scenario where supported
- `supabase test db` for RLS after local stack setup
- Mobile viewport 375×812 and desktop viewport 1440×900 checks

## 13. Delivery plan

### Phase 0 — Product contract and project scaffolding

Read this PRD, build task board, configure Next.js, components, Supabase local migrations, seeded demo roles and a polished design shell. Confirm scripts run.

### Phase 1 — Vertical slice (highest priority)

Authentication → create sample → QR → scan → append custody event → lab receipt/disposition → sample passport. Prove cross-tenant isolation.

### Phase 2 — Offline safety

Persist assigned courier events in IndexedDB, visible pending tray, reliable idempotent retries, conflict handling, manual sync.

### Phase 3 — Exceptions and dashboards

Deterministic rules, exception inbox, role-based KPIs, synthetic scenario triggers and incident timeline.

### Phase 4 — Hardening and demonstration

RLS tests, E2E tests, accessible/mobile polish, seeded demo storyline, GitHub Actions and Vercel preview/production checklist. Remove console errors and dead buttons.

### Must-have definition of done

A live demonstration can produce **one real server-confirmed sample journey and one correctly handled offline exception**, both with honest timestamps, correct role restrictions and no fake backend writes.

## 14. Suggested GitHub repository structure

```text
sampleshield/
├── AGENTS.md
├── MASTER_BUILD_PROMPT.md
├── README.md
├── .env.example
├── .github/workflows/ci.yml
├── .agents/skills/*/SKILL.md
├── docs/PRD.md
├── docs/IMPLEMENTATION_PLAN.md
├── src/
│   ├── app/(marketing)/
│   ├── app/(auth)/
│   ├── app/app/
│   ├── app/api/
│   ├── components/ui/
│   ├── components/domain/
│   ├── lib/supabase/
│   ├── lib/auth/
│   ├── lib/offline/
│   ├── lib/rules/
│   ├── lib/validation/
│   └── types/
├── supabase/
│   ├── migrations/
│   ├── tests/
│   └── seed.sql
├── tests/
└── public/
```

## 15. Constraints, assumptions, dependencies and risks

| Risk | Consequence | Mitigation |
|---|---|---|
| No medical professional available for review | Unsafe assumptions about specimen handling | Do not hardcode clinical sample stability rules; show operational demo thresholds only |
| No external lab integration | Operational workflow is simulated | Clearly state stand-alone prototype; keep interoperability as future direction |
| Browser storage cleared | Pending events lost | Explain limitation; allow sync verification; do not claim guaranteed offline durability |
| Service worker caches sensitive data | Privacy leak | Cache static app shell only; explicitly exclude authenticated API payloads |
| Agent creates placeholder buttons | Weak hackathon credibility | Define done as complete end-to-end path and remove nonfunctional UI |
| Vercel/Supabase credentials unavailable | Deployment blocked | Provide `.env.example` and exact dashboard steps; never fake deployment success |
| Complexity of multi-tenant RLS | Data exposure | Build and test RLS early; no permissive `USING (true)` for sample data |
| Overclaims about medical impact | Credibility and safety risk | Label every metric as measured, tested, or hypothetical, separately |

## 16. Hackathon judging narrative

**Hook:** “A specimen may travel from a village clinic to a distant laboratory. Its data should not disappear along the way.”

**Demonstrate:** collect → scan → offline handover → retry and verify → flag delay → lab review → traceable resolution.

**Explain technical moat:** client queue with idempotency, server-side state machine and per-organization RLS; not simply a chatbot attached to a dashboard.

**Explain potential impact:** fewer unresolved handovers, faster escalation, and a possible reduction in avoidable repeat collections—**hypotheses pending pilot evaluation**.

**Conclude:** start with one clinic-to-lab transport route, validate workflow with lab staff, measure operational outcomes, then integrate with existing systems where appropriate.

## 17. Reference documentation

- Antigravity workspace skills: https://antigravity.google/docs/skills
- Supabase Auth SSR: https://supabase.com/docs/guides/auth/server-side
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase CLI development: https://supabase.com/docs/guides/local-development
- Next.js PWA guide: https://nextjs.org/docs/app/guides/progressive-web-apps
- Vercel Git deployments: https://vercel.com/docs/git

These are engineering references, not proof of product clinical effectiveness.
