---
name: sampleshield-architecture
description: "Designs SampleShield system architecture, project structure, state boundaries, backend APIs and phased implementation. Use when planning technical work, making architectural decisions or reviewing coupling."
---

# SampleShield Architecture Skill

## When to activate
Use for project planning, architecture changes, API contracts, feature slicing, review of trade-offs and keeping the hackathon scope realistic.

## Workflow
1. Read `docs/PRD.md` and identify P0 acceptance requirements, roles, data flows and safety boundaries.
2. Write `docs/IMPLEMENTATION_PLAN.md`: small vertical slices, dependencies, checkboxes, verification commands and blockers.
3. Establish Next.js App Router, typed domain models, reusable UI components, shared validation and server-side persistence boundaries.
4. Keep **one authority for business transitions**: server-side validated atomic custody events. Treat UI, QR codes and offline records as untrusted inputs.
5. Separate server-confirmed state from locally queued intent; model each explicitly in types and copy.
6. Map every screen to user role, source of data, server API, empty/error state and critical acceptance test.
7. Document design decisions (ADR entries) only when trade-offs are significant.

## Scope decisions
- Build the smallest *functional* create→dispatch→courier→lab slice first.
- Prefer Next.js route handlers + Supabase SQL RPC over a separate long-lived backend.
- Integrations to LIS, IoT, drone networks, third-party maps and actual medical records are out of MVP.
- Run auth, SQL migration and RLS tests before exposing private records.

## Acceptance gate
An engineer can identify the owner of every state transition, where authority is checked, what happens offline and how to test failure modes. No feature is described only as visual UI if it requires actual backend behavior.
