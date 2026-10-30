# SampleShield — Project-Wide Agent Instructions

These instructions are persistent project guidance for Google Antigravity and other compatible coding agents.

## Required reading and authority

1. `docs/PRD.md` is the source of truth for product behavior, roles, data and safety.
2. `MASTER_BUILD_PROMPT.md` contains the implementation orchestration instructions.
3. `SKILLS_GUIDE.md` describes available `.agents/skills/*/SKILL.md` bundles.
4. `docs/IMPLEMENTATION_PLAN.md` tracks actual progress once created.

If instructions conflict: prioritize safety/security, then the explicit user request, then PRD, then build prompt, then convenience. Never silently weaken an access-control requirement to make a demo work.

## Engineering non-negotiables

- Next.js App Router, TypeScript strict, Supabase Postgres/Auth/RLS, PWA offline queue, GitHub and Vercel.
- No fake backend success states; distinguish confirmed events from pending device events.
- No real PHI in demo or QR. All fixtures synthetic and labelled.
- Server validates identity, authorization, transitions and idempotency, atomically.
- Never auto-diagnose or auto-accept/reject samples; laboratory staff have final operational review authority.
- No privileged database secrets in browser or Git. Use `.env.example` and documented configuration.
- Avoid caching private server responses or medical data in service workers.
- Every critical feature has at least one test and meaningful failure handling.
- Do not delete agent skills, instructions, migrations or tests while scaffolding.

## Development protocol

1. Read PRD and relevant skill(s).
2. Write/update a small implementation checklist.
3. Build smallest real vertical slice using current dependencies and documented APIs.
4. Run lint/typecheck/tests and fix failures before proceeding.
5. Document any missing credentials/permissions or unverified behavior honestly.
6. Use Git in short coherent changes; make deployment instructions reproducible.

## Definition of complete

The collector-to-lab workflow, offline retry, role controls, exceptions, and polished UI all work against a real Supabase database, with demonstrable tests. If something is still mock-only, label it explicitly as unimplemented.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
