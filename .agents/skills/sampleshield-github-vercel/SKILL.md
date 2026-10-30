---
name: sampleshield-github-vercel
description: "Sets up SampleShield GitHub version control, GitHub Actions CI, Supabase migrations and Vercel deployment with secure environment variables. Use for repository setup, deployment debugging or production checklist."
---

# SampleShield GitHub and Vercel Delivery Skill

## Delivery model
GitHub is the source of truth for application and migration files. Vercel deploys the Next.js frontend from GitHub. Supabase runs Auth/Postgres and must be migrated deliberately, not assumed to deploy automatically with Vercel.

## Workflow
1. Add `.gitignore` for `.env.local`, `.env.*.local`, `node_modules`, build output, temporary credentials and local Supabase internal files.
2. Keep `.env.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, no real tokens. Use server-only secrets only if absolutely required.
3. Check `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` locally.
4. Create `.github/workflows/ci.yml` to run checks on pull requests and main branch. Test database RLS in a supported CI/local database environment if configured.
5. Manage DB migrations with Supabase CLI and document `supabase link --project-ref ...`, `supabase db push --dry-run` and `supabase db push` after authorization; don't reset production.
6. Push to GitHub, connect repo to Vercel. Configure Preview and Production environment variables deliberately.
7. Configure Supabase Auth redirect allow-list to include local and appropriate Vercel domains. Check cookies/auth sessions after deployment.
8. Verify final deployment against real hosted Supabase with authorized demo accounts and synthetic data; don't claim live status if unavailable.
9. Provide rollback steps and document which migration version matches deployment.

## Security checks
- Never put service-role, PAT, API key or admin passwords into Git, client JS or logs.
- Do not accept a Vercel build as proof RLS is configured correctly.
- Ensure PWA service worker serves current static assets and doesn't cache private API payloads.
- If any action requires user account authorization, describe exact step; never fabricate a successful GitHub push or Vercel deploy.

## Final artifacts
A reproducible README, `.env.example`, CI workflow, migration sequence, deploy checklist and tested production/preview URL only if legitimately obtained.
