---
phase: "16"
slug: "risk-curation-and-targeted-ai-re-runs"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-01"
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source and scope.** Seeded on 2026-10-01 from `16-RESEARCH.md`, "Validation Architecture", before any plan exists. It maps every requirement, finding, success criterion and decision to an automated proof:
- the two requirements: ASSESS-09 and ASSESS-10;
- the two findings: UAT-027 and UAT-028;
- the four ROADMAP success criteria;
- the locked decisions D-01 to D-52 in `16-CONTEXT.md` and the negative authorisation cases in its `<authorization>` section.

**How the maps are filled.**
- **Per-task map:** the rows below are seeded from the research's proposed plans (`16-01` to `16-13`). The planner replaces them with one row per task, taken from each task's `<automated>` verify block, and the plan check verifies them (Dimension 8).
- **Plan numbering:** if the planner merges or splits plans, it records the mapping from the research's numbering here.
- **Markers:** "❌ W0" marks a test file that the owning plan's first RED task creates (the project convention).
- **Status:** every status starts as ⬜ pending.
- **Written ahead:** Phases 10 to 15 execute first. Rows that name Phase 12 files (`ai-run.integration.test.ts`, `ai-proposal-decisions.integration.test.ts`, the fake-server wire fixtures) depend on Phase 12's plans creating them.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **Web:** vitest 4.1.11 (jsdom) with Testing Library.<br>**Strapi:** `node:test`, compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, one process and one SQLite database per test file. Provider adapters are tested through `apps/backend/tests/helpers/fake-openai-compatible-server.ts` with model-facing wire bodies.<br>**E2E:** Playwright 1.58.2 with @axe-core/playwright, Chromium, on the production build. |
| **Config file** | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` (`desktop` 1440×900; `mobile` 375, `@journey` tests only; `workers: 1`) |
| **Node** | Prefix every command in Git Bash with `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" &&` (Node 24.19.0). |
| **Quick run command** | **Web:** `pnpm --filter @csrm/web exec vitest run <path> [<path> …]`, with paths under `apps/csrm`. Never put a pattern after `--`.<br>**Strapi file** (dev servers stopped): `pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js`.<br>**E2E** (dev servers stopped): `pnpm --filter @csrm/web test:e2e e2e/<spec>.spec.ts [--project desktop\|mobile]`. |
| **Contract commands** | `pnpm --dir apps/csrm api:generate`, then `pnpm --dir apps/csrm api:check`. After a new or changed route or grant: `SERVED_OPERATIONS_WRITE=1 pnpm --filter @csrm/strapi served-operations:write` (dev servers stopped). |
| **Full suite command** | `pnpm --dir apps/csrm api:check`; `pnpm --dir apps/csrm typecheck`; `pnpm --dir apps/csrm lint`; `pnpm --dir apps/csrm test`; `pnpm --dir apps/backend test` |
| **Phase gate** | The full suite, then `pnpm --dir apps/csrm test:e2e` (both projects, production build).<br>**Before:** ports 1337 and 3000 are free; in Git Bash, `netstat -ano \| grep -E ':(1337\|3000) .*LISTENING'` prints nothing.<br>**Afterwards:**<br>- `git status --short` shows only the brief's three operator items (a dirty tree is a harness defect, Phase 8 D-12, G-6);<br>- the content-type freeze check `git diff --name-only <phase-16-context-commit>..HEAD -- 'apps/backend/src/api/*/content-types/*'` lists exactly `csrm-risk/content-types/csrm-risk/schema.json` and `csrm-risk-history-event/content-types/csrm-risk-history-event/schema.json` (D-01);<br>- `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` is silent;<br>- `git diff --name-only <phase-16-context-commit>..HEAD \| grep -i keycloak` prints nothing;<br>- `git diff <phase-16-context-commit>..HEAD -- apps/backend/package.json apps/csrm/package.json pnpm-lock.yaml` shows no dependency change. |
| **Estimated runtime** | A web file takes under 20 s; a Strapi file 10–90 s, the authorization matrix 2–4 min. The full web suite about 20 s, the full Strapi suite about 10–15 min, the full Playwright suite about 15–19 min (Phase 16 adds one journey). |

**Known infrastructure facts.**
1. **Shared `dist`.** Everything that compiles Strapi shares `apps/backend/dist`: the Strapi suite, a single Strapi file, `served-operations:write` and Playwright. All wait until the orchestrator's dev servers are stopped. A task executed while they run records those proofs as pending for the plan's end.
2. **No live AI.** Every suite pins `CSRM_AI_PROVIDER=deterministic` and Phase 12's empty `CSRM_AI_DATA_CLASSIFICATION_CEILING` in both harnesses. No proof calls a model.
3. **Jobs are process-local** (R-08-36). No E2E relies on a job outliving a restart. The "released while the job ran" lapse is proved in Strapi integration with a deterministic provider that waits on an injected promise.
4. **Fixtures (the 06.9 lesson).** The new journey creates its own UAT-A-like request (payroll SaaS; unsigned payment files reconciled by hand; partial segregation of duties) and does not touch the records other specs use.
5. **Windows vitest** can fail with `EPERM: rename`. Rerun that file alone before treating it as a real failure.
6. **The base changes first.** Phases 10 to 15 execute before Phase 16 and rewrite its hot files. Re-run the plan check before executing.
7. **Hangs mean deadlock.** A Strapi integration test that runs to the 600,000 ms timeout in a decision or curation path is the nested-serialisation pitfall (research Pitfall 1), not slowness.

---

## Sampling Rate

- **After every task commit:**
  - run the touched web test files by path;
  - run `typecheck` when types change, and `api:check` after any spec change;
  - run the touched Strapi files by path, dev servers stopped.
- **After every plan wave:**
  - run the full web suite, `typecheck`, `lint` and `api:check`;
  - run the full Strapi suite after every plan that edits Strapi: 16-02 to 16-10;
  - run each UI plan's targeted Playwright specs once at its end (16-12).
- **Before `/gsd-verify-work`:** the full suite must be green. That is the phase gate above (plan 16-13), recorded with counts against the baseline (web 2,048, Strapi 578, Playwright 84 at `678b117`, plus every phase executed since), duration, the flaky count and the clean `git status`.
- **Max feedback latency:** 90 seconds at task level. The production-build E2E runs only at plan level.

---

## Requirement, Finding, Criterion and Decision Map

Strapi files are named by their compiled `.js` form for the quick run; web paths are under `apps/csrm`. `quick run` abbreviates the Strapi single-file run, `vitest run` the web run, `test:e2e` the Playwright run.

| Req / Finding / Criterion / Decision | Behaviour to verify | Test type | Automated command / proof | File exists? | Status |
|--------------------------------------|--------------------|-----------|---------------------------|--------------|--------|
| D-01 · D-03 (contract) | The contract-gap record exists with the approval recorded before any schema, catalogue or spec change for these facts; the Phase 12 and Phase 04 records carry dated amendments | static + checkpoint | `test -f docs/contract-gaps/phase-16-risk-withdrawal-and-history.md && grep -n "Approved" docs/contract-gaps/phase-16-risk-withdrawal-and-history.md`; `grep -n "2026-" docs/contract-gaps/phase-12-ai-run-record-and-provenance.md docs/contract-gaps/phase-04-deterministic-draft-jobs.md` | ❌ W0 | ⬜ pending |
| D-01 (schema) | Exactly two schema files change; a fresh database boots with `withdrawn_at`, `withdrawal_reason`, the `withdrawn_by` link and `csrm_risk_history_events`; legacy risks read as active with no history and no readiness change | static + Strapi integration + dev database check | the freeze check; quick run `risk-curation.integration.test.js` (legacy rows) | ❌ W0 | ⬜ pending |
| ASSESS-09 (1) · SC-1 · UAT-027 · D-05 · D-06 · D-09 | Withdraw a batch with a reason: facts set, number and fields kept; reason trimmed, 1–500; 1–200 unique ids; an id of another assessment fails the whole batch with 404 and leaves persistence deep-equal; an already withdrawn risk is `unchanged` with no new history row | Strapi unit + integration | quick run `active-risk.unit.test.js`, `risk-curation.integration.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-09 (1) · SC-1 · D-13 · D-14 | The active rule in every reader: readiness and the release path; the analyst detail (withdrawn marked, readiness over active); the assessment risk list; control implementations (Requestor 404 for a withdrawn risk); the request relationship counts; the assessment list counts and highest residual; `my_risk_assessments`; the Risk Register default and its "Withdrawn" filter; the register detail's `withdrawal`; the dashboard, alerts and reports; exposure | Strapi integration + static | quick run `risk-curation.integration.test.js`, `assessment-workflow.integration.test.js`, `request-workflow.integration.test.js`, `risk-register.integration.test.js`, `analyst-dashboard.integration.test.js`, `analyst-alerts.integration.test.js`, `analyst-reports.integration.test.js`; the static reader guard in `risk-no-delete.unit.test.js` (or its own file) | ❌ W0 / ✅ | ⬜ pending |
| D-07 | A withdrawn risk refuses `PATCH /api/v1/risks/{riskId}` (editor and register paths), control implementation create, update and delete, Phase 12 decisions on its fields or suggestions, and rewrite, each `RISK_WITHDRAWN` with persistence deep-equal | Strapi integration | quick run `risk-curation.integration.test.js`, `ai-proposal-decisions.integration.test.js` | ❌ W0 | ⬜ pending |
| D-08 · auth case 2 and 3 | The Requestor and an unrelated Requestor never see a withdrawn risk or learn it exists: every Requestor read excludes it; direct reads are 404; nothing differs from a missing record | Strapi integration + web | quick run `risk-curation.integration.test.js`; `vitest run src/features/assessments/released-assessment.test.tsx` | ❌ W0 / ✅ | ⬜ pending |
| D-10 · D-11 | Reinstate with a reason clears the facts and keeps both history events; reinstating an active risk is `RISK_NOT_WITHDRAWN`; Undo (the closed undo flag) records "Withdrawal undone" as an undo | Strapi integration + web | quick run `risk-curation.integration.test.js`; `vitest run src/features/risk-curation` | ❌ W0 | ⬜ pending |
| D-12 · D-23 | Withdraw, reinstate, accepting a suggestion and accepting or restoring a unit take the accepted-edit transition (a release-ready in-review assessment regresses to draft); rejecting, restoring a rejection, Phase 12's dismissal and run completion take none; an all-unchanged batch takes none; withdrawing the last active risk makes "At least one Risk" outstanding | Strapi integration | quick run `risk-curation.integration.test.js`, `risk-proposal-decisions.integration.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-09 (2) · D-16 | No route serves a risk delete for any actor (`DELETE /api/v1/risks/{riskId}` unmounted; `/api/csrm-risks/{id}` spec-only); no source deletes a risk or a history row; deleting a request with an assessment leaves every risk and history row | Strapi unit + integration + matrix | quick run `risk-no-delete.unit.test.js`, `risk-curation.integration.test.js`, `authorization-matrix.integration.test.js`, `served-operations.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| ASSESS-09 (2) · D-17 | "Discard" removes an unsaved new risk with an Undo that restores the typed values; nothing is sent; the navigation guard warns with unsaved input | web unit | `vitest run src/features/assessments/risk-editor.test.tsx src/features/assessments/assessment-editor.test.tsx` | ❌ W0 / ✅ | ⬜ pending |
| ASSESS-09 (3) · SC-4 · D-22 · D-29 | Withdraw, reinstate, both enqueues and every decision are refused on a released or otherwise not editable assessment with `ASSESSMENT_NOT_MUTABLE`, persistence deep-equal; the guard takes the actor | Strapi integration + matrix | quick run `risk-curation.integration.test.js`, `risk-proposals.integration.test.js`, `risk-proposal-decisions.integration.test.js` | ❌ W0 | ⬜ pending |
| D-18 · D-19 · D-20 | History rows in the same transaction for created (analyst, draft run, accepted suggestion), updated (only changed fields, old and new values; none when nothing changed), withdrawn, reinstated and control-implementation added, updated and removed (removal keeps the values); a forced failure after the write leaves no row; rows are never updated or deleted | Strapi unit + integration | quick run `risk-history-changes.unit.test.js`, `risk-curation.integration.test.js`, `assessment-workflow.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| D-21 | The history read is human analyst only, paginated newest first, serves a withdrawn risk's history, returns 404 for an unknown risk, projects a malformed row safely, and shows the honest start for older risks | Strapi integration + matrix + web | quick run `risk-curation.integration.test.js`, `authorization-matrix.integration.test.js`; `vitest run src/features/risk-curation` | ❌ W0 | ⬜ pending |
| ASSESS-10 (1) · SC-2 · UAT-028 · D-30 · D-31 | "Suggest more risks" on a UAT-A-like context proposes the payment-file integrity risk (null Risk Type where none fits), never repeats an existing, withdrawn or rejected risk, caps at 8; the captured prompt carries the existing, withdrawn and decided blocks as escaped data with short keys and no numbers, owners or dates; over 200 entries fails with `CONTEXT_TOO_LARGE` and no run | Strapi unit (wire) + integration + E2E | quick run `ai-provider-risk-proposals.unit.test.js`, `risk-proposals.integration.test.js`; `test:e2e e2e/risk-curation.spec.ts` | ❌ W0 | ⬜ pending |
| D-32 | Near-identical proposals (same type, score ≥ the threshold) against active, withdrawn, rejected, open and same-run sets are dropped with an adjustment and a count; similar ones are flagged with their target; the fixtures pin the thresholds | Strapi unit | quick run `risk-duplicate-scorer.unit.test.js`, `ai-provider-risk-proposals.unit.test.js` | ❌ W0 | ⬜ pending |
| D-33 | Accepting a suggestion creates the risk through the create path, with its `created` history row (source run and item), Phase 12 per-field provenance naming the run, and the decision event, in one transaction; its fields then need Phase 12's per-field review | Strapi integration + web | quick run `risk-proposal-decisions.integration.test.js`; `vitest run src/features/risk-curation` | ❌ W0 | ⬜ pending |
| ASSESS-10 (2) · SC-3 · D-34 · D-35 · D-36 | "Rewrite this risk" proposes only changed AI-writable fields, grouped into units (ratings with their derivation, asset with classification, Accept with its rationale); text units carry citations and uncited flags; focus limits the units; owners, dates, statuses and the other first- and second-line facts are never proposed | Strapi unit (wire) + integration + web + E2E | quick run `risk-field-units.unit.test.js`, `ai-provider-risk-proposals.unit.test.js`, `risk-proposals.integration.test.js`; `vitest run src/features/risk-curation`; `test:e2e e2e/risk-curation.spec.ts` | ❌ W0 | ⬜ pending |
| D-37 | Accepting a unit whose base no longer matches is `AI_PROPOSAL_STALE` with persistence deep-equal; restore of an accepted unit works only while the accepted value holds; a newer rewrite supersedes the older open items with the cause recorded | Strapi unit + integration | quick run `risk-field-units.unit.test.js`, `risk-proposal-decisions.integration.test.js` | ❌ W0 | ⬜ pending |
| D-38 | The adapter downgrades an AI Accept to Treat for a High or Critical residual, a missing rationale or a planned control implementation, recording the adjustment; at acceptance an Accept unit is refused with `AI_ACCEPT_NOT_PERMITTED` when the batch's resulting residual is High or Critical, in either order and across batches; the deterministic suggestion proposes Accept for a Moderate residual | Strapi unit + integration | quick run `ai-provider-risk-proposals.unit.test.js`, `risk-proposal-decisions.integration.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-10 (3) · D-25 · D-26 | One run per provider call with operation, initiating analyst, instruction, context summary, provider and outcome; single flight per target only while queued or running; a completed job does not block a new run; any analyst reads a job, the initiator retries; a retry is a new run; the policy is checked at enqueue (409) and execution (job failed, no run, no call) | Strapi unit + integration | quick run `risk-proposal-registry.unit.test.js`, `risk-proposals.integration.test.js`, `ai-run.integration.test.js` | ❌ W0 / Phase 12 | ⬜ pending |
| D-27 | The instruction travels in its own slot, bounded, logged in the run, never with Requestor text; it cannot loosen the Accept rule, the allowed values or the bounds | Strapi unit (wire) | quick run `ai-provider-risk-proposals.unit.test.js`, `ai-provider-guardrails.unit.test.js` | ❌ W0 / ✅ | ⬜ pending |
| D-28 | Notes marked "changes the AI inputs" (Phase 13) and opted-in attachment text (Phase 14) enter both contexts inside the data block and the context summary; the analyst detail's "new information" fact counts those created after the latest completed run, and is null before Phases 13 and 14 | Strapi unit + integration | quick run `ai-provider-risk-proposals.unit.test.js`, `risk-proposals.integration.test.js` | ❌ W0 | ⬜ pending |
| D-39 · D-40 · D-41 | Decisions on run-scoped items: accept, reject (reason ≤ 500), restore; repeats are no-ops; a closed item is refused with the closed "not open" reason; a run of another assessment fails the batch with 404; items lapse when the assessment stopped being editable while the job ran; withdrawing a risk supersedes its open rewrite items; the open-item count is consistent after every path; the proposals read returns open and recent items with run facts | Strapi integration | quick run `risk-proposal-decisions.integration.test.js`, `risk-proposals.integration.test.js` | ❌ W0 | ⬜ pending |
| D-42 | Release readiness shows "AI proposals decided" outstanding while any item is open, with the proposals destination; "Reject remaining" clears it in one batch; release is refused until it is met; withdrawn risks contribute no readiness items | Strapi integration + web + E2E | quick run `risk-proposal-decisions.integration.test.js`, `assessment-workflow.integration.test.js`; `vitest run src/features/assessments`; E2E | ❌ W0 / ✅ | ⬜ pending |
| D-43 · D-44 · auth cases 1, 4, 5 | Every Phase 16 operation is human analyst only (catalogue Functions on `role.security_analyst` and `HUMAN_ANALYST_ONLY_OPERATIONS`); the Requestor, an unrelated Requestor, the service agent, no identity and no token are refused per the six-actor matrix; the agent's PATCH with withdrawal facts is a 400 and its edits of a withdrawn risk are refused | Strapi integration + matrix + catalogue | quick run `authorization-matrix.integration.test.js`, `contract-catalogue.integration.test.js`, `authorization-policy.unit.test.js`; `cmp` of the catalogue copies | ✅ | ⬜ pending |
| D-02 · D-03 (chain) | Every API change runs through the chain: the spec, `api:generate`, a clean `api:check`, closed parsers in the parity guard, the operation chain, the served inventory (with `regenerate_draft`'s updated reason) and byte-identical catalogue copies | web unit + Strapi integration + static | `vitest run src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; `api:check`; quick run `served-operations.integration.test.js`, `contract-catalogue.integration.test.js` | ✅ | ⬜ pending |
| D-15 | The overall-rating hint appears without blocking when the overall rating differs from the highest residual of the active risks, and "Use {rating}" sends a normal update | web unit | `vitest run src/features/risk-curation src/features/assessments/assessment-editor.test.tsx` | ❌ W0 / ✅ | ⬜ pending |
| D-45 · D-46 · D-47 · D-49 | Surfaces and the premium bar: the active/withdrawn segmented filter with counts; withdrawn cards read-only with reason, who and when; keyboard paths; optimistic withdraw, reinstate, reject and unit confirm with rollback and Undo toasts; skeletons; empty states; phone sheets and stacked diff cards; no control for released or withdrawn records; the 409 reasons mapped to copy; the copy guard rejects "Delete", "Remove" and "Not applicable" for a withdrawal | web unit + E2E | `vitest run src/features/risk-curation src/features/assessments src/features/risks`; `accessibility.spec.ts`; `risk-curation.spec.ts` at 375 and 1440 | ❌ W0 / ✅ | ⬜ pending |
| D-46 (extensions) | The field-comparison and withdrawn-record extensions are recorded in the direction before the implementing tasks | static | `grep -n "CSRM extension, 2026-" docs/design/csrm-design-direction.md` names both | ✅ (file) | ⬜ pending |
| D-48 | The editor route stays within its JavaScript budget; the panel, diff, sheet and form load on demand; client modules stay zod-free | E2E + static | `test:e2e e2e/performance.spec.ts`; the parser-free module guard in `src/features/parser-free-modules.ts` tests | ✅ | ⬜ pending |
| D-50 (journey) · SC-1 to SC-4 | A UAT-A-like request through questionnaire and draft; withdraw a risk with a reason, see it leave readiness and appear under "Withdrawn" with reason and history; Undo, withdraw again, reinstate; "Suggest more risks" proposes the payment-file risk with no duplicate, add it and confirm its fields; rewrite, confirm one unit and reject another; readiness waits for every proposal; release; no curation or AI control remains and the API refuses each; the Requestor's released view excludes the withdrawn risk; an unrelated Requestor is refused. Both widths, axe | E2E | `pnpm --filter @csrm/web test:e2e e2e/risk-curation.spec.ts` | ❌ W0 | ⬜ pending |
| Non-negotiables | Keycloak untouched; AI never decides or releases; suites deterministic; no new dependency; the root glossary's "Withdrawn (Risk)" entry still matches the behaviour | static + suites | the keycloak grep and dependency diff above; `grep -n "Withdrawn (Risk)" CONTEXT.md` | ✅ | ⬜ pending |

---

## Per-Task Verification Map

Seed rows, one per proposed plan. The planner replaces them with one row per task (`16-NN-MM`), each citing its plan's threat register (`T-16-NN`; every plan also accepts `T-16-SC`, since no package is added).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | ASSESS-09, ASSESS-10 (records) | T-16-01 | The schema change waits for the approved record (G-6) | static + checkpoint | `test -f docs/contract-gaps/phase-16-risk-withdrawal-and-history.md && grep -n "Approved" docs/contract-gaps/phase-16-risk-withdrawal-and-history.md` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | ASSESS-09, ASSESS-10 | T-16-02 | Pure rules are deterministic and closed: active predicate, change diff, reason bounds, duplicate scorer, field units, envelopes | Strapi unit | quick run `active-risk.unit.test.js`, `risk-history-changes.unit.test.js`, `risk-duplicate-scorer.unit.test.js`, `risk-field-units.unit.test.js` | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 2 | ASSESS-09 | T-16-03 | Exactly the approved schema; append-only writer; legacy rows active | Strapi integration + static | quick run `risk-curation.integration.test.js` (boot, legacy); the freeze check | ❌ W0 | ⬜ pending |
| 16-04-01 | 04 | 3 | ASSESS-09 | T-16-04 | One guard with the actor; no nested serialisation; history in the transaction; withdrawn risks refuse every mutation | Strapi integration | quick run `risk-curation.integration.test.js`, `assessment-workflow.integration.test.js`, `risk-register.integration.test.js`; the full Strapi suite | ❌ W0 / ✅ | ⬜ pending |
| 16-05-01 | 05 | 4 | ASSESS-09 | T-16-05 | Human-only withdraw, reinstate and history read; batch 404; closed reasons; deep-equal refusals | Strapi integration + matrix + web | quick run `risk-curation.integration.test.js`, `authorization-matrix.integration.test.js`, `served-operations.integration.test.js`, `contract-catalogue.integration.test.js`; `vitest run src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts src/features/risk-curation`; `api:check` | ❌ W0 / ✅ | ⬜ pending |
| 16-06-01 | 06 | 5 | ASSESS-09 | T-16-06 | Readiness and every assessment-side and Requestor read apply the active rule; Requestor 404 for withdrawn | Strapi integration + web | quick run `assessment-workflow.integration.test.js`, `request-workflow.integration.test.js`, `risk-curation.integration.test.js`; `vitest run src/features/assessments`; `api:check` | ✅ | ⬜ pending |
| 16-07-01 | 07 | 6 | ASSESS-09 | T-16-07 | The register default and filter, the detail block, the insights and exposure apply the rule; the static reader guard passes | Strapi unit + integration + web | quick run `risk-register.integration.test.js`, `analyst-dashboard.integration.test.js`, `analyst-alerts.integration.test.js`, `analyst-reports.integration.test.js`, the reader guard; `vitest run src/features/risks`; `api:check` | ✅ / ❌ W0 | ⬜ pending |
| 16-08-01 | 08 | 7 | ASSESS-10 | T-16-08 | Minimised, escaped contexts; server-owned ids, ratings, Accept rule; dedupe and diff in the adapter; portable schema | Strapi unit (wire) | quick run `ai-provider-risk-proposals.unit.test.js`, `ai-provider-guardrails.unit.test.js` | ❌ W0 / ✅ | ⬜ pending |
| 16-09-01 | 09 | 8 | ASSESS-10 | T-16-09 | Human-only enqueue, job read and retry; policy at enqueue and execution; no run on refusal; lapse and supersession recorded | Strapi unit + integration + matrix | quick run `risk-proposal-registry.unit.test.js`, `risk-proposals.integration.test.js`, `authorization-matrix.integration.test.js`, `served-operations.integration.test.js`, `contract-catalogue.integration.test.js`; `api:check` | ❌ W0 / ✅ | ⬜ pending |
| 16-10-01 | 10 | 9 | ASSESS-09, ASSESS-10 | T-16-10 | Decisions stale-checked and Accept-ruled inside the transaction; run matched to the path; rejections are not edits; readiness waits for decisions | Strapi integration + web | quick run `risk-proposal-decisions.integration.test.js`, `ai-proposal-decisions.integration.test.js`; `vitest run src/features/contract-response-parity.test.ts`; `api:check` | ❌ W0 / Phase 12 | ⬜ pending |
| 16-11-01 | 11 | 10 | ASSESS-09, ASSESS-10 | T-16-11 | No value outside the direction; refusal states shown; never colour alone; zod-free client modules | web unit + static | `vitest run src/features/risk-curation`; `grep -n "CSRM extension, 2026-" docs/design/csrm-design-direction.md` | ❌ W0 | ⬜ pending |
| 16-12-01 | 12 | 11 | ASSESS-09, ASSESS-10 | T-16-12 | No control for released or withdrawn records; optimistic rollback; the Requestor view free of withdrawn risks | web unit + E2E | `vitest run src/features/assessments src/features/risks src/features/risk-curation`; `test:e2e e2e/assessment-release-workflow.spec.ts e2e/risk-register-workflow.spec.ts e2e/performance.spec.ts e2e/accessibility.spec.ts` | ✅ | ⬜ pending |
| 16-13-01 | 13 | 12 | All | T-16-13 | The full gate; no tracked file modified by any run | E2E + full suites | `test:e2e` (both projects); the full suite; `git status --short`; the freeze, `cmp`, keycloak and dependency checks | ❌ W0 (new spec) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each file is created by the owning plan's first RED task (the project convention).

- [ ] `apps/backend/tests/active-risk.unit.test.ts`: the predicate, the filter constant, the SQL fragment (16-02)
- [ ] `apps/backend/tests/risk-history-changes.unit.test.ts`: changed-field detection after trimming, relation labels, empty diff, envelope parsing (16-02)
- [ ] `apps/backend/tests/risk-duplicate-scorer.unit.test.ts`: Jaccard, thresholds, the four fixtures (16-02)
- [ ] `apps/backend/tests/risk-field-units.unit.test.ts`: unit grouping, base normalisation, staleness, focus, the Accept unit (16-02)
- [ ] `apps/backend/tests/risk-curation.integration.test.ts`: withdrawal, reinstatement, guards, history, the active rule on assessment-side and Requestor reads, the cascade proof (16-03 to 16-06)
- [ ] `apps/backend/tests/risk-no-delete.unit.test.ts`: the static delete guard and the static reader guard (16-04, 16-07)
- [ ] `apps/backend/tests/ai-provider-risk-proposals.unit.test.ts` and `apps/backend/tests/fixtures/ai-wire/risk-proposals/*.json`: UAT-A-like suggestion and rewrite wire bodies through the fake server (16-08)
- [ ] `apps/backend/tests/risk-proposal-registry.unit.test.ts`: single flight while active, reads, retry (16-09)
- [ ] `apps/backend/tests/risk-proposals.integration.test.ts`: job and run lifecycle, policy, lapse, supersession, contexts captured (16-09)
- [ ] `apps/backend/tests/risk-proposal-decisions.integration.test.ts`: accept, reject, restore, stale, Accept rule, batch 404, readiness, transitions (16-10)
- [ ] `apps/csrm/src/features/risk-curation/*.test.ts(x)`: domain (hint, word diff, states), parsers, components, actions and refusal states (16-05, 16-11)
- [ ] `apps/csrm/e2e/risk-curation.spec.ts`: the journey at 375 and 1440 (16-13)

No framework install is needed: vitest, `node:test`, Playwright and the fake OpenAI-compatible server already exist.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live model quality: "Suggest more risks" on UAT-A proposes payment-file integrity and segregation of duties without repeating the three drafted risks; "Rewrite this risk" sharpens a generic risk with citations | ASSESS-10 | Suites pin the deterministic provider; running the hosted provider sends request data off the machine, which is the operator's call | The operator, with the provider they approve, on a fresh copy of the development database: UAT-A from `.planning/uat/product-gaps/JOURNEYS.md`; compare with the AI job log and record the duplicate flags the live output produced |
| The development database gains the withdrawal columns and `csrm_risk_history_events`, and the new Functions | D-01, D-43 | The operator's database changes only when the orchestrator restarts Strapi | After the restart: the 06.8-01 PRAGMA check (`PRAGMA table_info(csrm_risks)` includes `withdrawn_at` and `withdrawal_reason`; `csrm_risk_history_events` exists); open UAT-A's assessment and confirm its risks read as active with "History recorded from" shown |
| The premium bar, at a glance, on real screens | D-45 to D-47 | Visual judgement beyond axe and unit tests | The orchestrator's browser checks at 375 and 1440: the editor's Identified Risks with both filters, a withdrawn card, the history sheet, the proposals panel, a rewrite diff, and the Risk Register's "Withdrawn" filter and detail |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s at task level
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
