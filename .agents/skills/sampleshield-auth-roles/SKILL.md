---
name: sampleshield-auth-roles
description: "Implements Supabase Auth, session handling, collector/courier/lab/admin permissions and facility membership guards. Use for login, account onboarding, route protection and authorization UX."
---

# SampleShield Authentication and Roles Skill

## Roles
- **Collector:** register and collect/dispatch samples associated with an authorized clinic.
- **Courier:** read only assigned sample transport details and submit permitted custody events.
- **Lab:** receive and make documented acceptance/rejection decisions at the authorized destination.
- **Admin:** manage own organization's memberships/facilities/policies and see scoped analytics; no cross-tenant superuser UI.

## Workflow
1. Configure Supabase Auth and documented Next.js SSR client/session model, with correct callback/redirect handling for localhost and Vercel.
2. Build protected page layout and server authorization helpers; session presence alone is insufficient—check active membership, role and facility.
3. Include signed-out, expired-session, disabled-user and not-assigned error screens.
4. Separate route UX checks from server authorization and database RLS; enforce both server-side and RLS.
5. Use admin-only invitation or seeded demo members; never allow user-selected roles in public sign-up.
6. Offline behavior: **only** use cached permitted assignment metadata after prior successful authorization; require revalidation after connection returns.
7. On logout, warn if events remain pending and offer safe resolution; clear cached authorization/assignment data appropriately.

## Abuse cases to test
- An unauthorized user guesses `/app/samples/<id>`.
- Courier for Org A guesses Org B sample code.
- Courier attempts lab `accepted` state through API.
- Role is revoked while event is queued offline.
- Expired session tries to sync and must reauthenticate.

## Definition of done
Permissions are enforced by real server and RLS checks, not merely hidden UI buttons. No sample private data leaks to anonymous requests or a different organization.
