---
name: sampleshield-chain-of-custody
description: "Implements specimen Sample Passport, QR handover workflows, server-validated state transitions and human-reviewed operational exceptions. Use for sample event rules, receipt/disposition and custody audit trails."
---

# SampleShield Chain-of-Custody and Patient Safety Skill

## Domain state machine
States: `created → collected → dispatched → received → accepted|rejected`. Courier pickup/dropoff are **custody events**, not permission to accept/reject. `flagged` is exception state, not a sample status.

## Implementation sequence
1. Define legal event types, transitions, actor roles and destination/facility constraints in typed code plus server-side checks.
2. Create random opaque QR identifiers. Scanning is only lookup, not authorization; authorized login and membership still required.
3. Use a validated, atomic server operation to append the event, record server timestamp and update current state.
4. Make QR printing compact and legible; include readable opaque code fallback, not patient name or diagnosis.
5. Detect operational exceptions: missing required admin field, destination mismatch, custody gap, nonclinical demo SLA delay, invalid transition, offline conflict.
6. Route exceptions into lab/admin queue with ack/resolve reasons. Retain action history.
7. Show transparent Sample Passport timeline with actor, event, client recorded time, server confirmation time and pending state if applicable.

## Medical safety hard limits
- An elapsed period never automatically means a specimen is spoiled. Only authorized lab staff may record disposition.
- Do not encode specimen-specific temperature or stability thresholds unless provided and approved by qualified lab stakeholders; keep hackathon demo thresholds clearly labelled as synthetic operational SLA.
- Manually entered transport condition is a *reported observation*, not evidence from a sensor. Never fabricate IoT verification or lab analyzer results.
- No real patient data in pilot demonstration.

## Acceptance gate
A wrong-destination scan cannot silently change destination. Same event replay produces one confirmation. Lab-only disposition is guarded server-side. Any admin correction is auditable and attributable.
