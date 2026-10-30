---
name: sampleshield-analytics
description: "Builds role-safe SampleShield operational dashboards, verified metrics and transparently simulated patient-burden charts. Use for KPI calculation, Recharts visualization or judging-impact evidence."
---

# SampleShield Operational Analytics Skill

## Principles
Measure confirmed operational events, distinguish measured observations from simulations, and do not present hackathon mock numbers as real clinical improvements.

## KPI definitions
- `In transit`: server-confirmed dispatched but not received samples.
- `Awaiting lab review`: server-confirmed receipt with open exception or outstanding disposition.
- `Open exceptions`: unresolved operational exceptions across authorized tenant facilities.
- `Pending sync`: local-only unsynced events on **this device**; never merge them into global server totals.
- `Transport duration`: server-confirmed dispatch-to-receipt time; report median and sample count.
- `Exception rate`: samples with 1+ confirmed exception / eligible confirmed samples, with time range and count.

## Workflow
1. Define SQL-backed tenant/role-filtered aggregations; never fetch all tenants to filter in browser.
2. Use Recharts for readable trends and issue breakdowns; tooltips include definitions and sample sizes.
3. Show sensible zero/empty states for new accounts.
4. Add a `Synthetic demo data` indicator to all charts seeded for judges.
5. Optional cost model uses visible user-adjustable assumptions (e.g., sample count, estimated travel cost and prevented return trips) and clearly labels output `Illustrative scenario — not observed outcome`.
6. Never claim a reduction percentage until a proper real pilot has measured it.

## Verification
Test calculations on known fixtures, timezone handling, role restrictions, zero denominators and client/server reconciliation. Ensure pending offline actions do not inflate observed metrics.
