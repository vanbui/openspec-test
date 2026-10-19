---
phase: 03-strapi-scim-2-0-service
plan: "18"
status: complete
executed_by: orchestrator
requirements: ["MODEL-02","PROV-01","PROV-02","PROV-03","PROV-04","PROV-08","LIFE-01","LIFE-03"]
requirements-completed: ["MODEL-02","PROV-01","PROV-02","PROV-03","PROV-04","PROV-08","LIFE-01","LIFE-03"]
---

# Plan 03-18 summary: final regression and evidence gate

Written on 2026-10-19 at close-out. The gate ran on 2026-10-16 between 04:27Z and 05:06Z and was committed in `f87f2924`, but this SUMMARY was never written then. The facts below come from [03-GATE-EVIDENCE.md](03-GATE-EVIDENCE.md). Nothing was re-run when this summary was written.

## Outcome

Passed on final source `78794187`. All mandatory checks are green, the five roadmap criteria map to the eight requirements with live and automated evidence, and T-03-18 is closed.

## Checks

| Check | Result |
| --- | --- |
| Full backend suite (maintenance-switch guard, `tsc`, `node --test` serial, 10-min per-test bound), committed defaults only | 2012/2012 pass, 0 skipped, 2152 s |
| `pnpm --dir apps/backend test` unfiltered | Stops at compiling the two csrm red-phase files (WINDOWS.md entry 11, owner csrm). That is the only exclusion in the run above |
| `pnpm --dir apps/csrm api:check` | pass |
| `pnpm --dir apps/csrm typecheck` | pass |
| `pnpm --dir apps/csrm test` | 222 files, 5412 pass |
| `node docker/midpoint/e2e/capture-scim.mjs --verify-evidence` | pass |
| `node docker/midpoint/e2e/refusal-scim.mjs --verify-evidence` | pass |
| Content-type schemas, generated declarations, JDL since `c0d48b8b` | no change |
| Role-function catalogue copies | byte-identical |
| `IDAMBOX_KEYCLOAK_PROVISIONING`, `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION`, `CSRM_AUTH_OIDC_ENABLED` (and `IDAMBOX_SEED_IAM`) | false in committed config |
| 21 served SCIM operations | each grant-catalogued; existing CSRM operations unchanged |
| Secrets, binaries, attribution in the 79 Phase 3 commits | none |

## Criterion mapping

| # | Requirements | Evidence |
| --- | --- | --- |
| 1 token lifecycle and dev delivery | MODEL-02 | live token proof in 03-CONNECTOR-CAPTURE-EVIDENCE.md; token unit/integration tests |
| 2 discovery and connection test | PROV-04 | live capture `connection` scenario, 03-LIVE-PROBE.md; Group 501 tests |
| 3 CRUD, search, paging, PUT/PATCH, 409, 503 | PROV-01, PROV-02, PROV-03 | live capture; lifecycle, query, patch and security integration tests |
| 4 deactivation refusal and DELETE | LIFE-01, LIFE-03 | 03-REFUSAL-EVIDENCE.md, 03-BROWSER-REFUSAL-EVIDENCE.md; lifecycle tests |
| 5 replay, throttling, log, catalogue, regression | PROV-08 | 47-envelope replay, limiter and boundary tests, `scim.request` log event, 2012-test suite |

Effective rate-limit defaults (P3-32) are 1200 requests per IP and 600 per source per 60 seconds (`apps/backend/src/iam/scim/config.ts:13`, `IDAMBOX_SCIM_IP_LIMIT` / `IDAMBOX_SCIM_SOURCE_LIMIT`). 03-GATE-EVIDENCE.md does not state these values itself; this summary takes them from the source during close-out. Enforcing an aggregate limit across instances remains a deployment requirement.

## Files

- `03-GATE-EVIDENCE.md` (new); `03-VALIDATION.md`, `COVERAGE.md`, `03-SECURITY.md` (T-03-18 row) updated in `f87f2924`
- `apps/backend/tests/authorization-matrix.integration.test.ts`: SCIM rows added (`78794187`)

## Deviations

- **First full run failed and was fixed.** The authorization matrix needs one row per served operation and had no rows for the 21 SCIM operations added in 03-11. `78794187` added a row for each, asserting 401 for every CSRM caller. The full rerun above is green.
- The gate commit also updated ROADMAP.md, STATE.md and REQUIREMENTS.md, although the plan defers those to the orchestrator. The orchestrator ran the gate itself, so this does not conflict with ownership.
- No VERIFICATION.md was produced at the time. The phase verifier writes it during this close-out.

## Carried to Phase 4

- P3-36: reconciliation above 100 users (midPoint sends no paging).
- IN-03: a remote Keycloak conflict is reported as 503 under P3-19.
- If Phase 4 changes the connector's requests, recapture the replay fixture then.
