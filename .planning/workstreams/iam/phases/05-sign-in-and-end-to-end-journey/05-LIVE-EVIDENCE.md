---
phase: 05-sign-in-and-end-to-end-journey
plan: "12"
status: blocked
observed: 2026-10-18
run: iam-journey-3a51c9e6-c0eb-474b-9dfd-59beb2a3a959
head: e5964724
---

# Phase 5 live journey evidence

**NOT PASSING: acceptance blocked by B1.** In the official fresh-stack run, every live stage passed through the committed `journey.mjs --run` runtime. That covers setup, the complete joiner → password → Requestor sign-in → access → mover → leaver → immediate refusal → remote completion lifecycle at 1440×900 and 375×812, and the IN-03 conflict with native recovery. The final `evidence` stage then failed exactly as designed. After disposing the stack it runs the **unfiltered** `pnpm --dir apps/backend test`, which still stops at compilation on the six inherited csrm diagnostics (B1, WINDOWS.md entry 11). The runner therefore published **no** journey bundle and no screenshots. No passing evidence exists, and none is claimed here.

## Official run (2026-10-18, HEAD `e5964724`)

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

## What closes acceptance

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
