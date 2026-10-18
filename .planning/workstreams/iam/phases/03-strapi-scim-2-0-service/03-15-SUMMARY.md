---
phase: 03-strapi-scim-2-0-service
plan: "15"
subsystem: testing
tags: [scim, refusal, oidc, outbox, browser]
status: complete
requires:
  - phase: 03-14
    provides: Genuine connector capture replay and source isolation
provides:
  - Same-credential mounted HTTP refusal for PUT, PATCH and DELETE during remote outage
  - Isolated live gate orchestration with offline checks and closed evidence validation
  - Existing-session typed transport, protected layout and responsive browser assertions
requirements-covered: [LIFE-01, LIFE-03, PROV-03]
affects: [03-16, 03-18]
tech-stack:
  added: []
  patterns: [same-credential refusal, independent cleanup budgets, staged evidence publication]
key-files:
  created:
    - apps/backend/tests/iam-scim-refusal.integration.test.ts
    - apps/backend/tests/helpers/iam-live-scim-gate.ts
    - docker/midpoint/e2e/refusal-scim.mjs
    - apps/backend/tests/iam-scim-refusal-tooling.unit.test.ts
    - apps/csrm/e2e/iam-scim-refusal.spec.ts
  modified:
    - apps/csrm/src/lib/auth/oidc-session-adapter.test.ts
    - apps/csrm/src/lib/api/transport/server-client-oidc.test.ts
    - apps/csrm/src/components/shell/protected-layout.test.tsx
actuals:
  tasks: 2
  files: 8
  implementation_commits: 4
completed: "2026-10-16"
---

# Phase 3 Plan 15: Same-session refusal preparation

Both preparation tasks are complete. Automated refusal checks pass; actual live outage and browser acceptance remain pending 03-16. No later plan was executed.

## Delivered behavior

- Each mounted HTTP scenario creates a separate sourced human through SCIM with real provisioning middleware and a linked subject. A signed, unexpired human token and the same CSRM API credential prove successful current-access, data, direct-detail and write requests before PUT, PATCH or DELETE. A local HTTP outage boundary then makes the remote unavailable, including its key endpoint. Deactivation still commits inactivity and pending durable work, and every subsequent human operation returns ordinary 403 before recovery. Source discovery and Group reads continue to succeed.
- PUT/PATCH include an HR title change. DELETE retains the source tuple, roles, subject, requestor, risk owner and treatment owner references. The real worker observes unavailability and retains retry state, then completes after restoration; refusal remains in place. No direct account-status edit or reactivation is used as proof.
- The shared authorization fixture legitimately queues its pre-existing inactive baseline user's linkage update. The helper drains that setup work before measuring each scenario, so worker observations concern the scenario's own durable row. This preserves provisioning-off queue semantics.
- The live adapter reuses the prior PKCE/session configuration and gate deadline, isolated environment, cleanup and fixed compose-service utilities. It uses an ephemeral backend listener/database, a separate loopback web port in 3307–3399, and an authenticated ephemeral control listener. It refuses to adopt an existing web listener. Fixture credentials stay in memory; remote cleanup matches only exact randomly named gate users and their email addresses.
- The live control observes the browser's existing identity token at the ordinary typed current-access request. Baseline and refused API probes retain that token and the web's original API credential. The runner covers four PUT/PATCH width combinations plus DELETE API proof, bounds stages to 180 seconds and reserves cleanup time within a 30-minute execution budget. Outage restoration is attempted even if the stop itself fails. Browser traces, videos, cookie files and automatic failure screenshots are disabled. Only closed outcome rows and explicitly captured refusal screenshots can be published, after successful cleanup; prior published proof is preserved.
- Frontend regressions preserve the existing session/token while current backend capabilities collapse, exercise the real typed client across a 200-to-403 transition, and keep protected children absent while access resolution is pending. The live spec uses ordinary OIDC sign-in, reload and direct-detail navigation at 1440/375, an actual held backend access request, complete refusal copy, keyboard focus, wrapping, readable CTA and overflow assertions. No production screen, theme, dependency or authentication implementation changed.

## Commits

1. `faede0b3` — `test(iam): define same-credential SCIM refusal and gate ordering`
2. `08773deb` — `test(iam): pin current-session transport and responsive refusal assertions`
3. `8eda5918` — `feat(iam): prepare isolated SCIM outage and browser refusal gate`
4. `c9acf6b0` — `feat(iam): publish refusal evidence after resource cleanup`

The initial backend test commit records the missing-helper compilation failure before implementation. Documentation commits follow these task commits.

## Verification

All commands used the installed Node/pnpm directory prepended to PATH.

- Reconciled the clean starting checkout at `7abbe418`, existing shared-backend helpers, completed 03-14 and locked P3-33 through P3-36. Selected-plan structure validation passed before implementation; the final phase-wide structure check passed 18/18 with no invalid plan.
- `pnpm --dir apps/backend exec tsc -p .tmp/tsconfig.iam-03-15.json --pretty false` — PASS. The ignored config extends `../tests/tsconfig.json` and excludes exactly `../tests/risk-curation-rules.unit.test.ts` and `../tests/risk-history-changes.unit.test.ts`, as authorized for WINDOWS.md entry 11. Both named refusal outputs exist. This replaces the plan's unfiltered compilation command under the explicit execution instruction and is not a deviation.
- `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-scim-refusal.integration.test.js .tmp/tests-dist/tests/iam-scim-refusal-tooling.unit.test.js` — PASS, 9/9 behavior cases on the final compiled implementation: three HTTP scenarios and six orchestration/validation cases, no skips. They also passed within the broader regression invocation.
- `node docker/midpoint/e2e/refusal-scim.mjs --check` — PASS, including offline order/failure cleanup, evidence shape and installed helper/runner resolution. Final tooling-only rerun passed 6/6 after the evidence-publication refinement.
- `pnpm --dir apps/csrm test -- src/lib/auth/oidc-session-adapter.test.ts src/lib/api/transport/server-client-oidc.test.ts src/components/shell/protected-layout.test.tsx` — PASS. This package invocation ran all 222 frontend test files: 5,412 passed. The direct focused invocation through `pnpm --dir apps/csrm exec vitest run` also passed all 36 cases in the three named files.
- `pnpm --dir apps/csrm typecheck` — PASS on the final browser spec.
- Additional existing backend regressions — PASS: wire 12/12, PATCH reduction 8/8, genuine replay 3/3 (all 47 envelopes, including background requests and the real unpaged list), lifecycle 9/9. The combined invocation initially failed lifecycle fixture boot with `Cannot find module './iam/scim/routes'` in shared compiled output; subsequent refusal/replay boots succeeded. An unchanged, separate lifecycle rerun passed 9/9. No test assertion was weakened or existing test edited.
- `git diff --check` — PASS. No schema, generated content-type, index, JDL, contract, catalogue or committed configuration changes. Published connector capture/manifest remain untouched. The full backend suite was not run.

## Deviations and execution notes

- The ownership inventory calls `iam-live-scim-gate.ts` existing, but it was absent. Task 1 explicitly requests creating four files, so it was created using the named prior infrastructure and the locked context.
- The plan's output paragraph says not to update STATE/ROADMAP. The explicit execution instruction takes precedence: update the workstream state and only the 03-15 plan checkbox/count, leaving the phase in progress.
- No production repair was necessary. The temporary missing compiled module during the optional regression run was resolved by rerunning the unchanged lifecycle fixture, not by changing its tests or the production service.

## Pending live checkpoint

03-16 must run `node docker/midpoint/e2e/refusal-scim.mjs --run` with the existing live-gate environment requirements from `readLiveGateConfig`, a registered loopback callback for the chosen isolated web origin, and available installed browser binaries. `IAM_SCIM_WEB_ORIGIN` defaults to `http://127.0.0.1:3307`; the browser uses the ordinary `/api/auth/callback/keycloak` callback. No realm/client settings are changed by the helper. Supply credentials through the process environment; do not read the compose environment file or publish credentials.

After a successful run, `--verify-evidence` checks all 50 closed stage outcomes and four PNGs under `evidence/browser-refusal/`. A rerun refuses to overwrite existing published proof. The checkpoint must record actual observations and visual inspection in `03-REFUSAL-EVIDENCE.md` and `03-BROWSER-REFUSAL-EVIDENCE.md`. No live proof, screenshots or acceptance report was created here. The developer SCIM server and idp stack were left running and were never stopped by this plan.
