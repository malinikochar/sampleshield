---
name: sampleshield-offline-sync
description: "Builds SampleShield IndexedDB offline custody event queue, manual retry, conflict resolution and idempotent server synchronization. Use for PWA connectivity handling, offline tests or duplicate replay bugs."
---

# SampleShield Offline Synchronization Skill

## Goal
Capture *intent to hand over a sample* on a previously authorized device without pretending that an offline write is a server-confirmed custody event.

## Design
- Use IndexedDB (Dexie acceptable) for a **minimal, non-PHI** queue with `client_event_id`, sample opaque code, event type, client timestamp, safe metadata, local state and retry counters.
- Keep event states `queued`, `syncing`, `synced`, `conflict`, `failed_retriable`. UI copy: `Pending on this device`, `Syncing`, `Confirmed by server`, `Needs review`.
- Pre-cache only assignments the user was authorized to see while online; never download bulk patient data.
- Service worker caches static app-shell assets, not Supabase Auth token responses, private API payloads or health data.

## Algorithm
1. On user action, validate required local fields and create a stable UUID; store transactionally in IndexedDB before showing pending state.
2. On reconnect, foreground resume or `Retry sync`, read queue in defined order and submit with same UUID.
3. Server checks authenticated role, assignment, legal state and deduplicates by client event ID in a transaction.
4. Mark `synced` only after confirmed server event ID and receipt time returned.
5. On revoked role or stale state, mark conflict and show guidance; do not silently overwrite or drop queued events.
6. Back off on transient errors and allow manual retry. Avoid infinite retry of permanent failures.
7. Handle logout and local storage wipe with a warning for pending events. Never claim guaranteed persistence on a shared/unreliable device.

## Mandatory tests
- Offline action survives reload.
- Offline→online sync stores one event.
- Retry same UUID 2+ times stores exactly one confirmed event.
- Expired auth pauses and resumes only after sign in.
- Revoked role and conflicting lab status are not silently accepted.

## Browser realism
Do not assume Background Sync API or online/offline signals are universally reliable. Provide explicit user-driven retry and report status truthfully.
