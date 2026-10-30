# SampleShield — 3-Minute Hackathon Judge Demo & Fallback Script

> **Safety & Synthetic Data Guardrail:** Every demonstration step runs inside the isolated fictional tenant **Sahyog Rural Health Network** (`is_demo = true`) with synthetic identifiers only (`DEMO DATA — NOT REAL PATIENT RECORDS`). SampleShield is an operational chain-of-custody accountability platform — **never** a medical device, LIS, or autonomous specimen acceptability judge.

---

## Pre-Demo 30-Second Reset Checklist

1. Sign in at `/login` using **One-Tap Judge Role Switcher → Meera Nair (Operations Admin)** (`meera.admin@sahyog-demo.example` / `SampleShieldDemo!2026`).
2. Navigate to **Judge Failure Sim (`/app/demo`)** and click **Reset Demo Baseline** (`reset_clean`).
3. Confirm header pill shows **Online · Server connected** and top banner displays `DEMO DATA — NOT REAL PATIENT RECORDS`.

---

## Timed 3-Minute Live Judge Walkthrough (`180 seconds`)

| Time | Persona & Route | Live Action on Screen | Key Engineering Proof to Highlight |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:25** | **Public `/` → Collector (`Asha Verma`)** | Show landing page problem framing: rural diagnostic specimens cross clinics, couriers, and district labs over paper logs—when handovers go unrecorded or reach the wrong facility, patients bear painful repeat collections. Sign in as **Asha Verma** (`PHC-KISH`). | Real Supabase Auth + PostgreSQL Row Level Security (`FORCE ROW LEVEL SECURITY` on all 10 tables; zero `anon` grants). |
| **0:25 – 1:05** | **Collector (`Asha Verma`) · `/app/samples/new`** | Register a new `Whole Blood (EDTA Tube)` routed from **Kishangarh PHC (`PHC-KISH`)** to **Ajmer District Reference Lab (`LAB-AJMR`)** with `collect_immediately` checked. Show the generated **Sample Passport** & printable **Opaque QR (`SS-XXXX-XXXX-XXXX`)**. Dispatch to **Ravi Meena**. | **Zero PHI in QR:** QR encodes only a random Crockford identifier (`SS-XXXX-XXXX-XXXX`). Form schema actively blocks accidental emails or 10–12 digit phone/ID strings. |
| **1:05 – 1:50** | **Courier (`Ravi Meena`) · `/app/handovers`** | Switch to **Ravi Meena**. Click **Go Offline (Demo Mode)**. Click **Save Pickup Offline**. Point out the amber dashed badge: **`Pending on this device`** (explicitly NOT confirmed!). **Hard-reload the browser (`F5`)**—queue survives in IndexedDB. Click **Reconnect Demo Network** → watch status flip to **`Confirmed by server`** with server receipt timestamp. | **Honest Offline Architecture:** Dexie IndexedDB persists stable `client_event_id` UUIDs across reloads; UI never fakes backend confirmation while offline. |
| **1:50 – 2:30** | **Secondary Lab (`Kabir Joshi`) → Authorized Lab (`Dr. Priya Sharma`)** | Switch to **Kabir Joshi** at **Jaipur Hub (`LAB-JAIP`)**—the *wrong* laboratory. Scan/open the Ajmer-bound sample and click **Record Laboratory Receipt**. Server **blocks** receipt (`422 DESTINATION_MISMATCH`) and opens a High-Severity exception. Switch to **Dr. Priya Sharma** (`LAB-AJMR`), receive the specimen, inspect operational alerts, and click **Accept Specimen** with documented human rationale. | **Atomic Server Guardrails + Human Authority:** Wrong-facility redirection is blocked inside Postgres (`submit_custody_event`). Operational delays (`TRANSIT_DELAY`) inform review—**only human lab staff** can accept or reject. |
| **2:30 – 3:00** | **Admin (`Meera Nair`) · `/app/demo` & `/app/analytics`** | Open `/app/demo`, trigger **5. Duplicate Event Idempotency Proof**, and click **Replay Same UUID Now** → prove `idempotent_replay=true` with zero duplicate DB rows. Show **Verified Analytics (`/app/analytics`)**: server-confirmed median transit time + clearly separated **Illustrative Scenario Simulator**. | **Production Discipline:** Database-enforced idempotency (`UNIQUE (organization_id, client_event_id)`), append-only ledger triggers, and transparent separation of observed vs. hypothetical metrics. |

---

## 60-Second Rapid Fallback Storyboard (No Wi-Fi / Camera Denied)

If venue camera permissions are blocked or venue Wi-Fi drops mid-pitch:

1. **Camera Blocked (`0:00 – 0:15`):** On `/app/scan`, point directly to the **Manual Opaque Code Entry** card—type or paste `SS-7K3M-9P2X-Q4WN` (low-light / damaged-camera first-class fallback) to open the Sample Passport immediately.
2. **Venue Network Unstable (`0:15 – 0:40`):** Lean into SampleShield's core strength! On `/app/handovers`, show the courier saving handovers locally into **IndexedDB (`Pending on this device`)**, surviving browser refresh without losing custody timestamps or actor attribution.
3. **Pre-Seeded Failure Cases (`0:40 – 1:00`):** If running against local Docker Supabase (`localhost:3000`), open `/app/exceptions` and `/app/lab`—`supabase/seed.sql` pre-populates an open `DESTINATION_MISMATCH` (`SS-9R4T-6B8V-L2YC`) and a `TRANSIT_DELAY` specimen (`SS-4D2H-8N5K-P9WR`) ready for instant inspection with zero setup clicks.

---

## Judge Technical Q&A Quick Defense

- **"Does SampleShield decide if a delayed blood sample is spoiled?"**
  - **No.** SampleShield is strictly an operational logistics accountability tool—not a medical device or clinical thermometer. `TRANSIT_DELAY` compares server-recorded dispatch-to-receipt elapsed minutes against a facility's configurable operational SLA and flags the specimen for **human laboratory review**. Only authorized `lab` or `admin` personnel can record `lab_accepted` or `lab_rejected` (with mandatory documented rationale).
- **"What happens if someone photographs a QR sticker in transit?"**
  - The QR payload contains **only** a random opaque token (`SS-XXXX-XXXX-XXXX`)—zero patient name, diagnosis, clinic, or test type. Resolving that token requires an authenticated Supabase session whose organization and role pass PostgreSQL Row Level Security.
- **"What if a courier taps 'Retry Sync' five times in a flaky cellular zone?"**
  - Every queued handover generates a UUID (`client_event_id`) *before* touching the network. PostgreSQL enforces `UNIQUE (organization_id, client_event_id)` inside `public.submit_custody_event`, returning the original confirmed event (`idempotent_replay: true`) without inserting duplicate custody events or corrupting state.
- **"Can demo reset accidentally wipe real pilot clinics?"**
  - Impossible at the database layer: `public.trigger_demo_scenario` checks `organizations.is_demo = true` inside a `SECURITY DEFINER` guard and rejects non-demo tenants with `FORBIDDEN` (verified by pgTAP test #14).
