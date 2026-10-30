# MASTER BUILD PROMPT — SampleShield for Google Antigravity 2.0

> **Usage:** Open the extracted `SampleShield_Antigravity_Kit` folder as your Antigravity 2.0 workspace. Copy **everything under `PROMPT TO ANTIGRAVITY`** into an Antigravity agent conversation. The agent should read `AGENTS.md`, `docs/PRD.md` and relevant workspace skills. Ask it to start with Phase 0 and continue implementation in tested vertical slices. Connect your own Supabase, GitHub and Vercel accounts yourself where authorization is needed.

---

## PROMPT TO ANTIGRAVITY

You are the **lead software architect, principal full-stack engineer, senior healthcare UX designer, security reviewer, and hackathon demo director** for a product called **SampleShield**.

Build an actual, beautiful, usable, secure-by-default, mobile-first **offline-capable Progressive Web App (PWA)**. The purpose is operational visibility and error prevention for diagnostic specimens travelling from remote collection clinics to receiving laboratories. It is **not** a diagnostic device, not a replacement for laboratory SOPs, and must never decide specimen acceptability automatically.

### SOURCE OF TRUTH AND WORKFLOW

1. First, **read the entire `docs/PRD.md`**, then `AGENTS.md` and `SKILLS_GUIDE.md`.
2. Discover and use all relevant `.agents/skills/*/SKILL.md` as tasks arise, particularly `sampleshield-architecture`, `sampleshield-design-system`, `sampleshield-supabase-security`, `sampleshield-offline-sync`, `sampleshield-chain-of-custody`, `sampleshield-quality-assurance`, and `sampleshield-github-vercel`.
3. Write `docs/IMPLEMENTATION_PLAN.md` with a checklist, dependencies and acceptance checks. Follow it, updating progress as you complete each task. Do not stop at planning or scaffolding.
4. Check the current official documentation for libraries/SDKs before using version-specific APIs. Prefer stable compatible package versions and record any compatibility choices.
5. **Implement one tested end-to-end workflow before adding optional features.** Use real Supabase persistence with secure authorization; do not fake integration using local state after the backend is available.
6. After each milestone, run relevant tests; report what ran, what passed, what is blocked and what must be configured by the human owner. Never claim a successful deployment, integration, or test without evidence.

### PRODUCT / DEMO IDENTITY

- Name: **SampleShield**
- Tagline: **Every sample has a journey. Every handoff should be accountable.**
- Positioning: the accountability layer between remote clinics, couriers and receiving laboratories.
- Audience: collectors, couriers, lab staff, administrators.
- Primary story: create sample → print/scan QR → dispatch → courier handover recorded offline → reconnect and sync → lab receipt → exception review → authorized lab acceptance/rejection → analytics.
- Competitive hook: **Sample Passport**, **Proof-of-Handoff**, **No-Network Mode**, **Exception Inbox**, and a deliberate **Failure Simulation** showing wrong-destination and delayed-handover detection.

### TECH STACK (DO NOT SUBSTITUTE WITHOUT GOOD REASON)

- Framework: **Next.js App Router** with **TypeScript strict mode**.
- Styling: **Tailwind CSS**, **shadcn/ui**, **Lucide React** icons.
- Forms: React Hook Form + Zod where appropriate.
- Database: **Supabase PostgreSQL**, SQL migrations, typed client, **Row Level Security**.
- Authentication: **Supabase Auth** with appropriate supported SSR helpers.
- Offline: PWA manifest + static-asset service worker + **IndexedDB** event queue (Dexie or similarly maintained library allowed).
- QR: generate/print an opaque QR with a supported library and scan via browser camera with manual fallback.
- Charts: Recharts with server-confirmed aggregated data.
- Tests: Vitest, React Testing Library where useful, Playwright E2E, Supabase pgTAP/RLS tests.
- Source: GitHub, using small meaningful commits and CI.
- Hosting: **Vercel frontend** connected to GitHub and **Supabase hosted backend**. No extra paid service required for core MVP.

### VISUAL DESIGN DIRECTIVE

This must look like a **premium production-quality healthcare operations app**, not a generic AI-generated SaaS template.

- Clean airy layout on soft porcelain `#F7FAFC`, white cards, deep ink `#142437` and teal primary `#0E9488`. Amber for caution, red for critical action, with text labels alongside all colors.
- Modern, editorial visual hierarchy, detailed microcopy, elegant iconography, generous 8px-grid spacing, rounded cards, crisp typography (Inter/Geist), purposeful motion.
- Landing page: restrained hero with high-quality product mockup built with HTML/CSS components, a clear call to action and a 3-step explanation. Do not need stock imagery.
- Desktop: collapsible navigation sidebar; mobile: practical bottom navigation and thumb-friendly scanner/courier actions.
- Dashboard: summary KPIs, chain-of-custody status visualization, recent sample events, exception queue and one clear primary action tailored to the role.
- Sample detail: beautifully designed **Sample Passport** showing QR, source/destination, timeline, custody checkpoints, sync status and linked exceptions.
- Scanner: focused camera viewport with useful empty/error/permission states and manual code entry.
- Lab desk: actionable inbox and **human-controlled** disposition confirmation with reason.
- Offline: *never* confuse pending device data with server-confirmed records; make status obvious and accessible.
- Ensure responsive designs at 375px and 1440px, dark-on-light contrast, keyboard access, loading/empty/error states, accessible dialogs and toasts.
- No broken links, dead buttons, dummy counters masquerading as live data or excessive gradients.

### CORE FEATURES TO IMPLEMENT IN ORDER

**Phase 0 — Foundations**
- Scaffold Next.js application, Tailwind and shadcn; establish component patterns, routing and shared design tokens.
- Create Supabase local setup, SQL migration files, `.env.example`, typed database client, auth helpers and comprehensive `README.md`.
- Set up GitHub Actions workflow for lint, typecheck, test and build.
- Make a realistic demo organization (fictional `Sahyog Rural Health Network`) with a sample collection clinic and receiving lab; synthetic seed data only.
- Set up roles: collector, courier, lab, admin. No client-side assumption of admin privileges.

**Phase 1 — Working vertical slice**
- Build authenticated dashboard, list, new sample form, Sample Passport, QR print/scan, clinic dispatch, courier pickup, laboratory receipt and lab-only disposition.
- Implement server-authoritative event submissions via an atomic Postgres RPC / secure handler with a validated state machine and idempotency.
- Create user-level and tenant-level Row Level Security; write negative tests for cross-tenant sample access and forbidden role transitions.
- Make the journey work using the actual database before styling every optional page.

**Phase 2 — Offline that really works**
- Installable PWA with manifest and service worker caching static assets only.
- Previously authorized courier assignments available in minimal local storage for offline actions.
- Offline event queue with stable `client_event_id`, `Pending on device`, retry, server confirmation and visible conflicts.
- Sync on reconnect/app foreground/manual retry. Re-authenticate when needed. Do not depend only on Background Sync.
- Prevent double-write on retries. Keep server receipt time distinct from device-recorded time.

**Phase 3 — Exceptions, operations and demo**
- Rules: missing required field, destination mismatch, custody handover gap, delayed receipt using organization-configured *demo operational threshold*, invalid transition and offline conflict.
- Lab/admin review queue with acknowledge/resolve reason and audit record.
- Analytics from confirmed events: sample status counts, delays, incident categories and carefully labelled simulated patient-burden estimate.
- `/app/demo` for demo tenant admin: seed `Happy Path`, `Wrong Destination`, `Offline Courier`, `Delayed Arrival`, `Duplicate Submission` and reset synthetic examples. Demo controls must never mutate real tenant data.

**Phase 4 — Finish and prove**
- Polish transitions, responsive layout, accessibility, empty/loading/success/failure states, data integrity and error handling.
- Provide functioning Playwright tests for critical path and offline reconnect (using browser network emulation where viable).
- Run build/lint/typecheck/tests and fix errors. Add example screenshots or textual walkthrough artifacts only if produced from the real app.
- Produce a `docs/DEMO_SCRIPT.md` with a 3-minute presentation (problem, event chain, offline proof, exception review, potential measurable impact).
- Provide GitHub push and Vercel setup instructions. If access/credentials are available via authorized integrations, assist with deployments; otherwise do not claim they happened.

### DATA MODEL AND SECURITY CONTRACT

Follow `docs/PRD.md` schema: organizations, facilities, memberships, samples, sample_assignments, sample_events, exceptions, exception_actions and facility_policies. Derive canonical table shape from migrations.

- Every resource is organization-scoped. Role and facility assignment matter, not just whether someone is signed in.
- Every exposed table has appropriate RLS, grants and negative tests. No broad `USING (true)` for sensitive tables.
- **QR payload** contains only a random opaque identifier, not patient name, diagnosis, report, DOB, phone, hospital ID or personal medical data.
- **No real patient information** in MVP. Use synthetic aliases and labels. Put a persistent demo indicator on synthetic datasets.
- Do not put `service_role`, private secret keys or privileged database credentials into browser code, `NEXT_PUBLIC_*` env vars, commits, logs or screenshots.
- Event submissions: server validates current user/role/assignment/sample/state; determines actor and organization, appends accepted custody event and updates sample projection atomically; unique client event ID prevents duplicates.
- `sample_events` are append-only; later corrections appear as new traceable events, not overwrites.
- Do not assume client timestamps are trustworthy; store both client time and server receipt time.
- No autonomous medical decision. **Only lab-authorized staff can accept/reject a sample, with reason and traceability.** A demo delay flag means *review required*, not automatically spoiled.
- For offline: avoid cache of private API responses; do not pretend IndexedDB is secure medical record storage; on logout clearly handle unsynced events and clear cached assignments.
- If building an optional AI feature, restrict it to non-diagnostic help and keep it out of the essential demo path.

### ACCEPTANCE TESTS — MUST BE REAL

1. **Happy path:** collector → courier → lab disposition, persisted in Supabase and reflected in Sample Passport.
2. **Offline:** valid courier saves pickup offline, refreshes, reconnects and syncs; server stores event once.
3. **Wrong destination:** incorrect receiving lab cannot silently receive it; actionable alert shown.
4. **Idempotency:** replay same `client_event_id` returns original outcome with one persisted custody event.
5. **RBAC:** courier cannot accept/reject, unauthorized user cannot open another tenant's sample.
6. **Conflict:** stale offline event is not silently written; user sees `Needs review`.
7. **Build:** TypeScript, lint, unit/E2E tests, Supabase RLS tests and production build pass (document blockers honestly).
8. **Demo:** a judge can experience the end-to-end story without external paid APIs or unavailable hardware.

### WORKING STYLE AND DELIVERABLES

- Work in small milestones, but actually write the files and implement each feature.
- If this workspace initially contains only instructions, initialize the application **in the same root** without deleting `AGENTS.md`, `.agents/skills`, `docs/PRD.md` or this prompt.
- Choose clear folder structure, reusable typed components, accessible UX, explicit Zod validation and maintainable SQL migrations.
- Do not invent business metrics or claim clinical outcomes. Label demo figures synthetic.
- Do not add non-essential features until the working vertical slice and tests pass.
- Do not ask me basic decisions resolved in the PRD. If blocked by credentials/permissions, proceed using local Supabase setup and provide exact next steps.
- At each checkpoint summarize: implemented files, tested flows, commands executed, test results, outstanding risks, next tasks.
- In the final completion report include: local run instructions, demo accounts or safe setup steps, environment variable requirements, test results, GitHub instructions and Vercel deployment configuration.

**Start now by reviewing the documents, creating `docs/IMPLEMENTATION_PLAN.md`, and implementing Phase 0 followed immediately by the Phase 1 vertical slice.**

---

## OPTIONAL FOLLOW-UP PROMPTS (WHEN NEEDED)

**After scaffolding:**

> Implement and verify the complete Phase 1 sample journey against `docs/PRD.md`. Do not substitute mocked data for persisted Supabase records. Run negative authorization tests.

**Before offline implementation:**

> Activate the `sampleshield-offline-sync` and `sampleshield-chain-of-custody` skills. Implement the offline courier handover and the retry/conflict UI. Show a real Playwright test proving exactly one persisted event after duplicate replay.

**Before presenting to judges:**

> Activate `sampleshield-demo-pitch` and `sampleshield-quality-assurance`. Harden the demo against permission denial, server delay, offline refresh, invalid QR, expired auth and a conflicting handover. Prepare a 3-minute judge walkthrough and a 60-second backup recording storyboard.
