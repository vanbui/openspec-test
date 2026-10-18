# Phase 3 browser refusal evidence (plan 03-16, task 2)

**Status:** Passed, and the screenshots were inspected by the orchestrator.
**Run:** the same gate run as [03-REFUSAL-EVIDENCE.md](03-REFUSAL-EVIDENCE.md), 2026-10-16 14:06 to 14:08 AEDT
**Spec:** `apps/csrm/e2e/iam-scim-refusal.spec.ts`, four tests (PUT and PATCH at 1440 and 375 px), all passed

## What each test does

1. Sets the viewport (1440×900 or 375×812) and asks the gate for a new sourced person.
2. Signs in through the real CSRM sign-in page and the Keycloak login form; lands on `/app/risks` and sees the Risk register; opens the person's request detail and sees it.
3. Records the Auth.js session cookie, then has the gate stop Keycloak and deactivate the person through real SCIM `PUT` or `PATCH`.
4. Reloads: the existing permission state is shown (checks below).
5. Holds the backend's current-access response and opens `/app/risks` in a new tab of the same session: while access is held, no protected document content is shown. After release the new tab shows the refusal.
6. Opens the request detail directly: refused.
7. Confirms the session cookie is unchanged, so the refusal comes from current backend access and not from a new or ended session. Saves the screenshot; the gate then repeats the API checks (access, data, detail and write 403 with the same token) before restarting Keycloak.

## Checks on every refused page

- Alert with the exact heading "You don’t have access to this area" and the exact description "Your access is unavailable. Return to sign in and try again. If the problem continues, contact your administrator."
- "Return to sign in" link to `/sign-in`, reached by keyboard Tab, with a visible focus outline
- No Risk register heading, no table, no save, submit or create button
- No horizontal scrolling; heading, description and link fit the viewport without truncation

## Screenshots

| Scenario | File | Orchestrator inspection |
| --- | --- | --- |
| PUT, 1440 | [put-1440.png](evidence/browser-refusal/put-1440.png) | Shell with sidebar; centred permission card with lock icon, heading, two-line description, focused CTA; no protected content |
| PUT, 375 | [put-375.png](evidence/browser-refusal/put-375.png) | Mobile header with Menu; card fills the width with a 16 px gutter; description wraps over three lines; focused CTA readable |
| PATCH, 1440 | [patch-1440.png](evidence/browser-refusal/patch-1440.png) | Same as PUT 1440 |
| PATCH, 375 | [patch-375.png](evidence/browser-refusal/patch-375.png) | Same as PUT 375 |

The round "N" badge in the lower-left corner is the Next.js development indicator, present because the gate uses `next dev`; it is not product UI. The avatar shows the fictitious person's initials. The screenshots contain no username, token or cookie.

No browser storage state, cookies, traces or videos were kept: Playwright tracing, video and screenshot capture were off, and the run directory was deleted after publication.

## Requirement coverage

- LIFE-01 / P3-30: an existing OIDC session is refused on the next page request after a SCIM deactivation, at both widths, using the existing permission state, copy and typed transport. No new screen.
- P3-29: refusal happens while Keycloak is down and the outbox row is still pending.
