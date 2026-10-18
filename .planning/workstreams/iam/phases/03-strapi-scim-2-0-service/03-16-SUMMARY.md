---
phase: 03-strapi-scim-2-0-service
plan: "16"
status: complete
executed_by: orchestrator
requirements: ["LIFE-01","LIFE-03","PROV-03"]
---

# Plan 03-16 summary: live API and browser refusal during a Keycloak outage

## Outcome

The orchestrator ran `node docker/midpoint/e2e/refusal-scim.mjs --run` against the live Keycloak container, an isolated backend with the real SCIM routes, an isolated CSRM web server with OIDC on, and Playwright Chromium. All five scenarios (PUT and PATCH at 1440 and 375 px, DELETE through the API) passed all ten stages. In each one a signed-in sourced person was deactivated through real SCIM while Keycloak was stopped, and the same unexpired credentials were refused (403) on the next request, before the outbox row was processed. `--verify-evidence` passes.

- API and outage evidence: [03-REFUSAL-EVIDENCE.md](03-REFUSAL-EVIDENCE.md)
- Browser evidence and screenshots: [03-BROWSER-REFUSAL-EVIDENCE.md](03-BROWSER-REFUSAL-EVIDENCE.md), `evidence/browser-refusal/`

## Files

- `docker/midpoint/e2e/refusal-scim.mjs` and `apps/csrm/e2e/iam-scim-refusal.spec.ts`: gate fixes (commit `ba9d48d0`)
- `03-REFUSAL-EVIDENCE.md`, `03-BROWSER-REFUSAL-EVIDENCE.md` (new)
- `evidence/browser-refusal/outcomes.json` and four PNG screenshots (published by the runner)

## Checks

| Check | Result |
| --- | --- |
| `node docker/midpoint/e2e/refusal-scim.mjs --check` (after the fixes) | pass |
| `pnpm --dir apps/csrm typecheck` (after the spec fix) | pass |
| `node docker/midpoint/e2e/refusal-scim.mjs --run` | pass, 130 s, 50/50 stage rows |
| `node docker/midpoint/e2e/refusal-scim.mjs --verify-evidence` | pass |
| Screenshot inspection at 1440 and 375 | heading, copy, focused CTA, no protected content, no overflow |
| Evidence secret scan | no token, cookie or password |

## Deviations

- **Gate runner and spec fixes** (three failed attempts first; details in the API evidence): the Playwright configuration import, run-directory removal, a localhost origin for the gate web server (the dev server builds the Auth.js callback from `localhost`), telemetry off, and a held-page check that does not wait on an unanswered navigation. No production code changed.
- **Gate-only Keycloak callback:** the realm seed allows only `localhost:3000`, so `http://localhost:3307/api/auth/callback/keycloak` was added to the running client for each run and removed afterwards. The realm seed is unchanged.
- **The Next.js development indicator** appears in the screenshots because the gate runs `next dev`.

## For later plans

- 03-17: the review notes in STATE.md Pending Todos still apply.
- Housekeeping done: fictitious Keycloak users from 03-13 were deleted.
