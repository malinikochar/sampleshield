---
name: sampleshield-design-system
description: "Creates a polished, responsive and accessible SampleShield healthcare design system, landing page, mobile scanner and dashboards. Use for UX design, component styling, visual QA and form accessibility."
---

# SampleShield Design System Skill

## Visual language
Create a clinical-quality, human and trustworthy operations interface—not an AI dashboard clone. Colors: background `#F7FAFC`; surface `#FFFFFF`; primary ink `#142437`; deep navy `#183B56`; action teal `#0E9488`; pale teal `#E5F7F3`; caution `#E8A23C`; danger `#D85A56`; muted `#64748B`.

Use Inter/Geist, 8px spacing system, 12–16px radii, restrained shadows, strong hierarchy and consistent iconography through Lucide. Use shadcn primitives for accessible controls.

## Workflow
1. Define tokens, typography and layout in one global theme location.
2. Design role-specific navigation: desktop sidebar, mobile thumb-friendly menu and quick-scan action.
3. Create reusable `StatusBadge`, `SyncBadge`, `Timeline`, `SamplePassportCard`, `KpiCard`, `EmptyState`, `ActionDialog`, `ExceptionCard`, `QrPanel`, `OfflineBanner`.
4. Build each page through realistic synthetic examples and the actual domain schema.
5. Show error, empty, loading, permission-denied, conflict and success states; display informative microcopy.
6. For QR scanning, offer explicit camera-permission explanation and manual code fallback.
7. Check 375px mobile and 1440px desktop, WCAG 2.2 AA contrast aim, keyboard/focus handling, screen-reader text and reduced motion.

## Critical UX guardrails
- `Pending on this device` is visually **different** from `Synced to server`.
- Flagged is an exception overlay, not a fake sample state.
- No color-only warnings; pair color with text/icon.
- Laboratory reject actions require clear confirmation and reason.
- No prominent fabricated charts on a fresh/empty organization.

## Definition of done
A first-time collector can create and print a QR in a few taps; a courier can operate offline without mistaking local actions for confirmed events; a lab technician can find and review the correct inbound sample.
