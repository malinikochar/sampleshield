---
name: sampleshield-nextjs-frontend
description: "Implements the SampleShield Next.js TypeScript frontend, App Router pages, shadcn components, validated forms and QR scanning. Use when coding UI, routing and interactive browser behavior."
---

# SampleShield Next.js Frontend Skill

## Use cases
New pages, layouts, shared components, typed data hooks, forms, QR scan/print, error/loading boundaries and progressive-web-app wiring.

## Implementation protocol
1. Verify versions and follow current Next.js App Router docs; use strict TypeScript and server/client components deliberately.
2. Keep authenticated pages under `/app/*` and centralize identity/session checks.
3. Use server components or secure server fetching for initial authorized data; browser clients for camera and IndexedDB only.
4. Validate user input with Zod, show field-level messages and avoid stateful fake data after Supabase is wired.
5. Use shadcn/ui controls, Tailwind design tokens and Lucide icons. Build semantic landmarks, labels, keyboard support and error boundaries.
6. QR code content must be an **opaque random sample code**, no patient information. Support scanner permission rejection and manual entry.
7. Use clear loading, empty, forbidden, offline pending, retry and sync confirmation states.
8. Ensure every visible button and link performs a real function or is explicitly disabled with an explanation.

## Technical checks
- Avoid placing secrets in client components.
- Avoid disabling eslint/TypeScript rules just to make the build pass.
- Add test IDs only where useful for E2E; prefer accessible roles and names in tests.
- PWA static asset caching is not a license to cache authenticated data.

## Acceptance
Responsive at 375px and 1440px; no hydration warnings, browser console errors or dead controls. Forms and dialogs usable by keyboard. All domain mutations route through validated server operations.
