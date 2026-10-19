---
phase: 05-sign-in-and-end-to-end-journey
plan: "12"
status: passed
observed: 2026-10-19
run: iam-journey-35607205-a771-477b-a22b-3f83895cc83a
head: 72aeb261
---

# Phase 5 live journey evidence

**PASSED.** The official fresh-stack run at `72aeb261` passed all 30 stages through the committed `journey.mjs --run` runtime. The final `evidence` stage passed too: it disposed the owned stack, then ran the unfiltered regressions. The runner published the bundle, and `journey.mjs --verify-evidence` accepted it:

- [`evidence/iam-journey-35607205-a771-477b-a22b-3f83895cc83a/journey.json`](evidence/iam-journey-35607205-a771-477b-a22b-3f83895cc83a/journey.json)
- screenshots `csrm-1440-requestor.png`, `csrm-1440-refusal.png` (1440×900), `csrm-375-requestor.png` and `csrm-375-refusal.png` (375×812) in the same directory's `screenshots/`

The orchestrator reviewed the bundle and the screenshots. The bundle holds no token, password, mail body or action link. The Requestor screenshots show only the My work navigation on the sourced person's own request. The refusal screenshots show the CSRM "You don't have access to this area" page after the leaver sync.

## Official run (2026-10-19, HEAD `72aeb261`)

Launched like the earlier runs: a private owner-only run directory under `apps/backend/.tmp`, freshly generated compose and backend credentials, and the committed realm-seed client fixtures. No developer `docker/.env` or database was used. Preflight found no `idp` containers, volumes, networks or listeners.

| Stage group | Outcome | Start (s) | Duration (s) |
| --- | --- | --- | --- |
| setup (`preflight` → `connection`, 8 stages) | passed | 0.0 | 142.3 |
| 1440×900 lifecycle (10 stages) | passed | 142.3 | 44.6 |
| 375×812 lifecycle (10 stages) | passed | 186.9 | 23.3 |
| `in03-conflict` | passed | 210.2 | 524.5 |
| `evidence` (cleanup, then unfiltered regressions) | passed | 734.7 | 2743.2 |

The live stages ended at 734.7 s against the 3600 s overall budget. The evidence stage took 2743 s against its own 7200 s budget. Bundle facts: six on-demand lifecycle tasks (joiner POST 201; mover and leaver PUT 200), the IN-03 conflict PATCH 503 `retry-later` and the native-retry-scanner recovery PATCH 200. Each width's same-session API refusal (403 for list, detail and write) came before access-token expiry and before remote logout. IN-03 retry was scheduled 300 s after the failed run and recovered through the scanner. Regressions inside the run: `pnpm --dir apps/backend test` unfiltered, `pnpm --dir apps/csrm typecheck`, `pnpm --dir apps/csrm test`, the journey tests and `journey.mjs --check`, plus the frozen-contract hash comparison.

Cleanup afterwards: no `idp` container, volume or network, no run directory, no lock.

### What it took to publish (2026-10-19)

B1 closed when csrm's modules reached `main` (PR #9) and `main` was merged here (PR #10). The unfiltered backend suite then passed standalone: 2576/2576, exit 0, 51 min. Three more defects stood between the passing live stages and a published bundle. Each was found by running for real:

1. **Evidence budget** (`1f47da95`). The evidence stage had the ordinary 180 s budget, capped by the 3600 s overall budget. The unfiltered backend suite alone needs about 45–51 minutes, so publication could never succeed. The 05-12 run hid this because it failed at compilation. The evidence stage now has its own 7200 s budget outside the overall budget, which still bounds every live stage. The runner and the verifier share one `stageBudget` rule.
2. **Stale CSRM dev types** (local state, no commit). The first post-fix run (`1f47da95`) failed in the evidence stage after 44 min. Reproducing the regression sequence with the runner's minimal environment showed backend 2576/2576 and CSRM unit 248 files passing, but `pnpm --dir apps/csrm typecheck` failing. A git-ignored `apps/csrm/.next/dev/types/validator.ts`, left by a 6 October dev server, still referenced routes the csrm merge removed. `tsconfig.json` includes `.next/dev/types`, and `next typegen` does not rewrite that directory. Removing the ignored `.next/dev` fixed it. Handoff for csrm: stale dev output can break `typecheck` after route moves.
3. **IN-03 receipt method** (`72aeb261`). The next run (`iam-journey-eb72649d-…`) passed all 30 stages, regressions included, and then refused its own bundle. The verifier required PUT for every non-joiner task, but the connector sends IN-03's email change as PATCH (P3-35, `eaa437f6`). The synthetic fixtures and the default-publication test used the same wrong PUT. A diagnostic live run with stubbed regressions and a private copy of the bundle verified the real bundle and its four screenshots before the official run.

## Earlier official run (2026-10-18, HEAD `e5964724`, not passing)


Launched with a private owner-only run directory under `apps/backend/.tmp`, freshly generated compose and backend credentials, and the committed realm-seed client fixtures. No developer `docker/.env` or database was used. Preflight found no `idp` containers, volumes, networks, listeners or compilers.

| Stage | Outcome | Start (s) | Duration (s) |
| --- | --- | --- | --- |
| `preflight` | passed | 0.0 | 0.3 |
| `reset` | passed | 0.3 | 1.2 |
| `readiness` | passed | 1.5 | 28.4 |
| `source-registration` | passed | 29.9 | 19.3 |
| `source-token` | passed | 49.2 | 23.3 |
| `render` | passed | 72.6 | 17.6 |
| `reload` | passed | 90.2 | 47.3 |
| `connection` | passed | 137.4 | 3.8 |
| `csv-joiner-1440` | passed | 141.2 | 4.8 |
| `linkage-1440` | passed | 146.1 | 0.0 |
| `mail-1440` | passed | 146.1 | 0.0 |
| `password-setup-1440` | passed | 146.1 | 13.2 |
| `requestor-sign-in-1440` | passed | 159.3 | 5.5 |
| `requestor-access-1440` | passed | 164.7 | 6.8 |
| `csv-mover-1440` | passed | 171.5 | 4.4 |
| `csv-leaver-1440` | passed | 175.9 | 2.6 |
| `immediate-refusal-1440` | passed | 178.5 | 3.2 |
| `remote-completion-1440` | passed | 181.7 | 6.4 |
| `csv-joiner-375` | passed | 188.1 | 3.2 |
| `linkage-375` | passed | 191.3 | 0.0 |
| `mail-375` | passed | 191.3 | 0.0 |
| `password-setup-375` | passed | 191.3 | 0.7 |
| `requestor-sign-in-375` | passed | 192.1 | 1.4 |
| `requestor-access-375` | passed | 193.5 | 3.3 |
| `csv-mover-375` | passed | 196.8 | 3.7 |
| `csv-leaver-375` | passed | 200.5 | 1.8 |
| `immediate-refusal-375` | passed | 202.3 | 1.6 |
| `remote-completion-375` | passed | 204.0 | 6.6 |
| `in03-conflict` | passed | 210.5 | 519.3 |
| `evidence` | **failed** | 729.8 | 16.6 |

Setup took 137 s against a 300 s budget, and each viewport took under 50 s against 600 s. Each stage's pass means the runtime's own checks held. Those are the stage contract in [05-OPERATIONS.md](05-OPERATIONS.md): native task runs, source-authenticated SCIM receipts correlated with native audit records, stored linkage, the fresh Mailpit invitation and its actual action link, the real Auth.js/OIDC sign-in, catalogue-equal Requestor capabilities, refusal of restricted routes, APIs and the foreign record, a mover without a new invitation in the same session, pre-expiry same-session API 403 and UI refusal before remote logout, then outbox disable, zero sessions and refusal of a fresh sign-in. IN-03 covered the remote-only collision, the connector's 503 with `Retry-After: 30`, rollback, unchanged ownership, no invitation, native `retryLater` triggers and recovery through the trigger scanner after correction.

Cleanup: the evidence stage disposed the owned stack, private files and lock before regressions. Afterwards no `idp` container, volume or network, no run directory and no lock remained. Nothing was written below `evidence/` for this run.

Regression facts at `e5964724`:

| Command | Result |
| --- | --- |
| `pnpm --dir apps/backend test` (unfiltered) | exit 1: test compilation stops at the six B1 diagnostics in `tests/risk-curation-rules.unit.test.ts` and `tests/risk-history-changes.unit.test.ts` (modules exist only on `origin/csrm`, not on `main`) |
| `node --test docker/midpoint/e2e/journey*.test.mjs` | 224/224 |
| `node docker/midpoint/e2e/journey.mjs --check` | passes |
| `pnpm --dir apps/csrm typecheck` | passes |
| `pnpm --dir apps/csrm test` | first run 5411/5412 (one csrm timing flake, see 05-12-SUMMARY.md); rerun 5412/5412, 222 files |

No backend source, schema, grant, catalogue, OpenAPI or committed default changed in this session, so the 2070/2070 backend diagnostic result at `6b88f91b`, which excludes only the two B1 files, still describes the backend code.

## What closed acceptance (historical plan, done 2026-10-19)

1. The csrm workstream lands `src/csrm/risk-curation-rules.ts` and `src/csrm/risk-history-changes.ts` on `main`, and `main` is merged into this branch.
2. Rerun the official journey on a fresh private run directory (no flags, no exclusions). On success it publishes `evidence/<run>/journey.json` and the four screenshots, which `journey.mjs --verify-evidence` must accept.
3. Only then are SIGN-01, SIGN-02 and Phase 5 closed.

## Defects the live runs found and fixed

Both checkpoints ran repeatedly until clean. Every finding was a mismatch between offline seams and live Keycloak 26.6.1, midPoint 4.8.14, Mailpit or the CSRM UI. All fixes are in the runner or the journey spec, each with a regression test. No product behaviour, schema, grant or default changed. 05-11's fixes are listed in [05-KEYCLOAK-CONTRACT.md](05-KEYCLOAK-CONTRACT.md).

| Commit | Live finding → change |
| --- | --- |
| `0ad8ab43` | A normal midPoint resource read contacts the resource; before the listener starts it answered 250 → configuration checks use `options=raw`. |
| `298ee87b`, `e5964724` | midPoint wraps REST objects under their type name (`objectTemplate`, `archetype`, `user`, `shadow`) → one shared generic unwrap helper. |
| `edb41bce` | midPoint ignores run-now for a suspended task, and the result needs `include=result` → one helper resumes a held task for the run, then suspends it again. Success comes from `resultStatus`. |
| `7a9acc46` | A Requestor lacks `risk:manage`, so `/app/risks` correctly refuses → sign-in lands on My requests. The 256 KiB output cap killed long-running servers → it now bounds only retained output. |
| `25a29684` | `csrmAppIsEnabled` defaults off, so every CSRM route answered 403 in the owned listener → the listener enables CSRM routes. Administration children stay off. |
| `d1510d91` | The 1 px Next.js route announcer (`role=alert`) failed the overflow check → screen-reader-only regions are skipped. |
| `8ca14f35` | The foreign request used status `Draft`; the schema enumerates `draft`. |
| `e5b94f31` | "New request" appears in the navigation and on the page → the check is scoped to `main`. |
| `2f26f105` | Keycloak 26 reports a disabled account as page-level feedback → the spec asserts that exact message. |
| `811543fd`, `43bb65a9` → `113b2a29` | Retries that only masked a defect were reverted. The real cause: task reads with `include=result` grow every run (266 545 bytes) and were truncated → polls omit the result tree, and native reads carry an explicit 16 MiB bound. |
| `eaa437f6` | The connector sends the email change as PATCH (P3-35), so IN-03's 503 is a PATCH receipt. |
| `661b80e0` | midPoint writes no REQUEST audit event for a modification that fails at the resource → that event is optional only for a failed outcome of the expected task. |
| `5fdc2138` | With `retryLater` the run's result stays `success` → the failure comes from the run's own item-processing statistics. |
| `5245c105` | A `docker exec` hung for 8 minutes after midPoint was recreated → each container-local REST call is bounded at 45 s. |
