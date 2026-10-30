# SampleShield — Google Antigravity 2.0 Skills Guide

This kit includes **11 custom workspace skills**, one for each discipline the agent needs to build SampleShield. These are **project instructions**, not downloadable software packages, secret API integrations, or assurances that external services are already connected.

## Where to place them

Keep each `SKILL.md` under `./.agents/skills/<skill-name>/SKILL.md` in your Antigravity project root. Antigravity 2.0 discovers workspace skills from this folder. It reads each skill's YAML `description` and activates relevant skills as needed; you can explicitly call one by typing `/skill-name` in supported Antigravity surfaces.

Reference: https://antigravity.google/docs/skills

## Skills included

| Skill | Trigger it for |
|---|---|
| `sampleshield-architecture` | Planning, app structure, state boundaries, endpoint design |
| `sampleshield-design-system` | Visual direction, dashboard, forms, mobile responsiveness, accessible UX |
| `sampleshield-nextjs-frontend` | Next.js App Router, TypeScript, UI components, forms, PWA routing |
| `sampleshield-supabase-security` | Migrations, database, RLS, organization isolation, typed queries |
| `sampleshield-auth-roles` | Supabase login, sessions, role- and facility-based access |
| `sampleshield-offline-sync` | IndexedDB queues, retry, idempotency, offline conflicts |
| `sampleshield-chain-of-custody` | Specimen statuses, QR checks, legal transitions, exceptions |
| `sampleshield-analytics` | Server-verified metrics, charts, simulated impact calculations |
| `sampleshield-quality-assurance` | Vitest, Playwright, RLS tests, performance and accessibility checks |
| `sampleshield-github-vercel` | GitHub Actions, environment variables, Vercel deployment |
| `sampleshield-demo-pitch` | Seeded judge scenarios, demo script, fallback and presentation |

## Recommended invocation sequence

- **Beginning:** `/sampleshield-architecture`, `/sampleshield-supabase-security`, `/sampleshield-design-system`.
- **Core feature implementation:** `/sampleshield-nextjs-frontend`, `/sampleshield-auth-roles`, `/sampleshield-chain-of-custody`.
- **Offline phase:** `/sampleshield-offline-sync`.
- **Final polish:** `/sampleshield-analytics`, `/sampleshield-quality-assurance`, `/sampleshield-github-vercel`, `/sampleshield-demo-pitch`.

Do not instruct the agent to read all skill bodies on every turn: Antigravity's on-demand discovery is designed to conserve context. The `MASTER_BUILD_PROMPT.md` references the right skills for the right phases.

## Skills vs libraries vs external accounts

- **Agent skills** are instruction files in `.agents/skills/`.
- **Libraries** (Next.js, shadcn/ui, Supabase SDK, Dexie, Playwright, etc.) must be installed by the coding agent in the generated app.
- **Supabase, GitHub, Vercel accounts** must be created/connected or authorized by you. Do not paste service-role keys into agent conversations or commit them to a repository.
