---
name: sampleshield-demo-pitch
description: "Creates a winning three-minute SampleShield hackathon demo, synthetic failure scenarios, visual storytelling and proof of engineering work. Use when planning judge presentation or demo-day resilience."
---

# SampleShield Hackathon Demo and Pitch Skill

## Storyline (3 minutes)
- **0:00–0:30 Problem:** a collected sample travels between rural clinic and lab, and one failed handoff can make the process hard to trust.
- **0:30–1:00 Collection:** clinic creates a synthetic Sample Passport and QR; destination is visible.
- **1:00–2:00 Technical proof:** courier scans offline; UI says `Pending on this device`; reconnect; same event confirmed only once. Show a deliberately mismatched destination or delay alert.
- **2:00–2:45 Review:** lab user receives, reviews exception and records decision with reason. Show traceable event timeline and operational KPI.
- **2:45–3:00 Close:** explain potential benefits and how they would be measured in a real pilot—not already achieved.

## Build judge-ready scenarios
1. Normal synthetic sample journey.
2. Wrong destination blocked.
3. Offline courier event queued, then server-confirmed.
4. Delayed arrival flagged against a clearly labelled **demo operational threshold**.
5. Duplicate replay resulting in one confirmed event.

## Demonstration craft
- Make the first screen immediately legible at presentation distance.
- Use seeded synthetic identities and one-click demo reset accessible only to demo admin.
- Show a QR and actual event creation, not a static prototype.
- Present one architectural diagram: browser + IndexedDB → authenticated atomic Supabase event API → lab review + charts.
- Make permission denial, camera denial and offline retry demonstrably robust.
- Prepare a backup recording/storyboard, but do not imply footage proves a live deployment.
- Label all synthetic metrics. No diagnostic or patient-impact efficacy claims.

## Judge Q&A prep
Be able to answer: What's novel beyond tracking? How do you prevent data leaks? Why offline? How do you ensure duplicate events cannot corrupt the timeline? Who decides whether a delayed specimen is accepted? How would you validate impact and integrate with LIS?

## Definition of done
The demo can be repeated from a clean synthetic state in 3 minutes, with a backup path if camera/internet fails, and the team can defend both technical choices and medical safety limits.
