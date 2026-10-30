---
name: sampleshield-quality-assurance
description: "Tests SampleShield app quality, role authorization, offline reliability, QR errors, lab decisions and accessibility with Vitest, Playwright and Supabase RLS tests. Use before merging or deploying."
---

# SampleShield Quality Assurance Skill

## Test pyramid
- **SQL/pgTAP:** RLS grants and org isolation, membership checks, append-only event security, forbidden state transitions.
- **Unit/Vitest:** Zod forms, domain state machine, event idempotency helpers, exception rules, analytics calculations.
- **Integration:** Server event submission and conflict handling with local Supabase.
- **E2E/Playwright:** happy path, QR manual fallback, offline→online retry, role denial, exception acknowledgment and mobile viewport.
- **UX/accessibility:** keyboard navigation, visible focus, forms, dialogs, ARIA, WCAG 2.2 AA target.

## Required scenarios
1. Complete specimen path: collector→courier→lab.
2. Same `client_event_id` replayed twice persists once.
3. Cross-tenant access and courier lab-disposition request fail.
4. Offline queued event survives reload and requires explicit server confirmation.
5. Offline role revocation or invalid state surfaces conflict.
6. Destination mismatch does not mutate sample into a wrong facility.
7. Camera access denied uses manual code entry.
8. Demo reset never touches non-demo organization.
9. Build renders at 375px and 1440px without overflow or broken actions.

## Quality commands
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
- `npx supabase test db` after local stack setup

Do not report tests as passing if they weren't executed. If infrastructure is missing, report exactly which tests were blocked and why. Fix failures, do not remove tests or disable TypeScript/ESLint to get green.

## Definition of done
A judge can repeat failure scenarios and see honest, stable behavior without relying on a carefully faked screenshot or hidden data manipulation.
