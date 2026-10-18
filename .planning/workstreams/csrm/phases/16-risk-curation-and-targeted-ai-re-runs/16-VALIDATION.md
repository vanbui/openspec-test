---
phase: "16"
slug: "risk-curation-and-targeted-ai-re-runs"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: "2026-10-01"
updated: "2026-10-16"
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source and scope.** Seeded on 2026-10-01 from `16-RESEARCH.md`, "Validation Architecture", and rebuilt the same day for the fifteen final plans (`16-01` to `16-15`). It maps every requirement, finding, success criterion and decision to an automated proof:
- the two requirements: ASSESS-09 and ASSESS-10;
- the two findings: UAT-027 and UAT-028;
- the four ROADMAP success criteria;
- the locked decisions D-01 to D-52 in `16-CONTEXT.md`, its Orchestrator Confirmations, and the negative authorisation cases in its `<authorization>` section.

**How the maps are filled.**
- **Per-task map:** one row per task, taken from each task's `<automated>` verify block (Dimension 8). The gate plan is 16-15.
- **Plan numbering** (research → final): research 16-01 → 16-01 (now also records X-27 to X-29); 16-02 → 16-02; 16-03 → 16-03 (now also the four closed reasons); 16-04 → 16-04 (now also the request-deletion refusal and the static no-delete guard); 16-05 → 16-05; 16-06 → 16-06; 16-07 → 16-07 (now also the static reader guard); 16-08 → 16-08; 16-09 → 16-09 (now also the proposals read); 16-10 → 16-10; research 16-11 (UI pieces) → 16-11 (the web data layer, refusal family R), 16-12 (withdrawal and history pieces, X-24 extended) and 16-13 (AI proposals pieces, run sheet, signal); research 16-12 → 16-14 (editor integration) and 16-15 Task 1 (Risk Register); research 16-13 → 16-15 Tasks 2 and 3 (the journey and the gate).
- **Orchestrator Confirmations applied:** one proposal model (Phase 15's `proposal-items.ts` fold; no stored `itemStates` and no `openProposals` counter; the open count is derived), `AI_PROPOSAL_ALREADY_DECIDED` as the one "no longer open" code, Phase 12's `AI_ACCEPT_WITH_PLANNED_CONTROL` and `riskHasPlannedControl`, the `undo: true` flag on both curation operations, `OWN_REQUEST` for the requesting analyst's targeted AI actions, and Strapi refusing to delete a request that has an assessment.
- **Markers:** "❌ W0" marks a test file that the owning plan's first RED task creates (the project convention).
- **Status:** seeded ⬜ pending; set by the validation audit of 2026-10-16 (below).
- **Written ahead:** Phases 10 to 15 execute first. Rows that name earlier-phase files (`ai-proposal-decisions.integration.test.ts`, `proposal-items.unit.test.ts`, `ai-provider-guardrails.unit.test.ts`, the fake-server helper) depend on those phases' plans creating them.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **Web:** vitest 4.1.11 (jsdom) with Testing Library.<br>**Strapi:** `node:test`, compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, one process and one SQLite database per test file. Provider adapters are tested through `apps/backend/tests/helpers/fake-openai-compatible-server.ts` with model-facing wire bodies.<br>**E2E:** Playwright 1.58.2 with @axe-core/playwright, Chromium, on the production build. |
| **Config file** | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` (`desktop` 1440×900; `mobile` 375, `@journey` tests only, with `risk-curation.spec.ts` in its `testMatch` from 16-15; `workers: 1`) |
| **Node** | Prefix every command in Git Bash with `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && pnpm() { /c/ProgramData/nvm/v24.19.0/node /c/ProgramData/nvm/v24.19.0/node_modules/corepack/dist/pnpm.js "$@"; } &&` (Node 24.19.0). |
| **Quick run command** | **Web:** `pnpm --dir apps/csrm exec vitest run <path> [<path> …]`, paths under `apps/csrm`.<br>**Strapi file** (dev servers stopped): `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js)`.<br>**E2E** (dev servers stopped): `pnpm --dir apps/csrm test:e2e e2e/<spec>.spec.ts [--project desktop\|mobile]`. |
| **Contract commands** | `pnpm --dir apps/csrm api:generate`, then `pnpm --dir apps/csrm api:check`. After a new or changed route or grant: `SERVED_OPERATIONS_WRITE=1 pnpm --dir apps/backend served-operations:write` (dev servers stopped). |
| **Full suite command** | `pnpm --dir apps/csrm api:check`; `pnpm --dir apps/csrm typecheck`; `pnpm --dir apps/csrm lint`; `pnpm --dir apps/csrm test`; `pnpm --dir apps/backend test` |
| **Phase gate** (16-15 Task 3) | The full suite, then `pnpm --dir apps/csrm test:e2e` (both projects, production build).<br>**Before:** ports 1337 and 3000 are free; in Git Bash, `netstat -ano \| grep -E ':(1337\|3000) .*LISTENING'` prints nothing.<br>**Afterwards:**<br>- `git status --short` shows only the brief's three operator items (a dirty tree is a harness defect, Phase 8 D-12, G-6);<br>- the content-type freeze `git diff --name-only <PHASE_16_BASE>..HEAD -- 'apps/backend/src/api/*/content-types/*' ':!apps/backend/src/api/idambox-user' ':!apps/backend/src/api/identity-source' ':!apps/backend/src/api/keycloak-sync-outbox'` lists exactly `csrm-risk/content-types/csrm-risk/schema.json` and `csrm-risk-history-event/content-types/csrm-risk-history-event/schema.json` (D-01; `PHASE_16_BASE` from 16-01's summary; the exclusions are the IAM workstream's content types merged at `d1518c5f`, pilot ruling 2026-10-15, 16-PLAN-CHECK iteration 5; if a later fast-forward brings more of another workstream's shared-backend commits, the pilot extends the exclusion list with that workstream's owned paths and records it, and Phase 16's own content-type changes stay limited to `csrm-risk` and `csrm-risk-history-event`);<br>- `cmp` of the two catalogue copies is silent;<br>- no Keycloak file changed since `PHASE_16_BASE`;<br>- no dependency changed in Phase 16's own ranges: `git diff --name-only 01dc4118 f2a39dbe -- apps/backend/package.json apps/csrm/package.json pnpm-lock.yaml` and `git diff --name-only d1518c5f HEAD -- …` (`PHASE_16_IAM_SYNC=d1518c5f`) both print nothing; IAM's `pg` addition is IAM-owned and recorded in `COVERAGE.md`;<br>- `CONTEXT.md` holds "Withdrawn (Risk)"; `COVERAGE.md` holds the decided API coverage. |
| **Estimated runtime** | A web file under 20 s; a Strapi file 10–90 s, the authorisation matrix 2–4 min. The full web suite about 20 s, the full Strapi suite about 10–15 min, the full Playwright suite about 15–19 min plus Phase 16's journey at both widths. |

**Known infrastructure facts.**
1. **Shared `dist`.** Everything that compiles Strapi shares `apps/backend/dist`: the Strapi suite, a single Strapi file, `served-operations:write` and Playwright. All wait until the orchestrator's dev servers are stopped. Plans run one per wave (D-51).
2. **No live AI.** Every suite pins `CSRM_AI_PROVIDER=deterministic` and Phase 12's empty `CSRM_AI_DATA_CLASSIFICATION_CEILING` in both harnesses. No proof calls a model.
3. **Jobs are process-local** (R-08-36). No E2E relies on a job outliving a restart. The "released while the job ran" lapse is proved in Strapi integration with `setDeterministicRiskProposalHold` (16-08, 16-09).
4. **Fixtures (the 06.9 lesson).** The new journey creates its own UAT-A-like request and does not touch the records other specs use.
5. **Windows vitest** can fail with `EPERM: rename`. Rerun that file alone before treating it as a real failure.
6. **The base changes first.** Phases 10 to 15 execute before Phase 16 and rewrite its hot files. Re-run the plan check before executing.
7. **Hangs mean deadlock.** A Strapi integration test that runs to the 600,000 ms timeout in a decision or curation path is the nested-serialisation pitfall (research Pitfall 1), not slowness.

---

## Sampling Rate

- **After every task commit:** the task's `<automated>` command: the touched web test files by path; the touched Strapi files by path (dev servers stopped); `typecheck` after type changes; `api:check` after any spec change.
- **After every plan (each plan is its own wave):** the plan's last task runs the full Strapi suite (Strapi-editing plans 16-02 to 16-10) or the full web suite with typecheck and lint (web plans 16-11 to 16-14); 16-14 also runs its four deliberate Playwright specs.
- **Before `/gsd-verify-work`:** the full suite must be green: the phase gate above (16-15 Task 3), recorded with counts against the baseline (web 2,048, Strapi 578, Playwright 84 at `678b117`, plus every phase executed since), duration, the flaky count and the clean `git status`.
- **Max feedback latency:** 90 seconds for every task-level file run; only each plan's final task runs a full suite (the per-plan sampling point), and only 16-14 and 16-15 run Playwright.

---

## Requirement, Finding, Criterion and Decision Map

Strapi files are named by their compiled `.js` form for the quick run; web paths are under `apps/csrm`. `quick run` abbreviates the Strapi single-file run, `vitest run` the web run, `test:e2e` the Playwright run.

| Req / Finding / Criterion / Decision | Behaviour to verify | Test type | Automated command / proof | Plans | File exists? | Status |
|--------------------------------------|--------------------|-----------|---------------------------|-------|--------------|--------|
| D-01 · D-03 · D-04 · D-46 (records) | X-27 to X-29 recorded; the record and both amendments exist and carry the pilot's dated approval before any schema, catalogue or spec change | static + checkpoint | the greps in 16-01 Tasks 1 and 3 | 16-01 | ✅ (docs) | ✅ green |
| D-01 (schema) | Exactly two schema files change; a fresh database boots with `withdrawn_at`, `withdrawal_reason`, the `withdrawn_by` link and `csrm_risk_history_events`; legacy risks read as active with no history and no readiness change | Strapi integration + static | quick run `risk-curation.integration.test.js`; the freeze check | 16-03, 16-15 | ✅ | ✅ green |
| ASSESS-09 (1) · SC-1 · UAT-027 · D-05 · D-06 · D-09 | Withdraw a batch with a reason: facts set, number and fields kept; reason 1–500; 1–200 unique ids; an id of another assessment fails the whole batch with 404 deep-equal; an already withdrawn risk is `unchanged` with no new row | Strapi unit + integration | quick run `risk-curation-rules.unit.test.js`, `risk-curation.integration.test.js` | 16-02, 16-05 | ✅ | ✅ green |
| ASSESS-09 (1) · SC-1 · D-13 · D-14 | The active rule in every reader: readiness and release; the analyst detail; the risk list; control implementations (Requestor 404); relationship counts; both assessment lists; the register default and `Withdrawn` filter; the register detail; dashboard, alerts, reports, exposure; a static guard that fails when a reader skips the rule | Strapi integration + static | quick run `assessment-workflow.integration.test.js`, `request-workflow.integration.test.js`, `risk-curation.integration.test.js`, `risk-register.integration.test.js`, `analyst-dashboard.integration.test.js`, `analyst-alerts.integration.test.js`, `analyst-reports.integration.test.js`, `active-risk-readers.unit.test.js` | 16-06, 16-07 | ✅ | ✅ green |
| D-07 | A withdrawn risk refuses PATCH (editor and register), control implementation create, update and delete, Phase 12 decisions and rewrite with `RISK_WITHDRAWN`, deep-equal | Strapi integration | quick run `risk-curation.integration.test.js`, `ai-proposal-decisions.integration.test.js`, `risk-proposals.integration.test.js` | 16-04, 16-09 | ✅ | ✅ green |
| D-08 · auth cases 2 and 3 | The Requestor and an unrelated Requestor never see a withdrawn risk or learn it exists; direct reads are 404 with identical bodies | Strapi integration + E2E | quick run `risk-curation.integration.test.js`; `test:e2e e2e/risk-curation.spec.ts` (`PH16_REQUESTOR_EXCLUDES_WITHDRAWN`, `PH16_NEG_UNRELATED_REQUESTOR`) | 16-06, 16-15 | ✅ | ✅ green |
| D-10 · D-11 | Reinstate with a reason clears the facts and keeps both rows; reinstating active risks is `RISK_NOT_WITHDRAWN`; Undo both ways through the closed `undo: true` flag | Strapi integration + web | quick run `risk-curation.integration.test.js`; `vitest run src/features/risk-curation` | 16-05, 16-11, 16-12 | ✅ | ✅ green |
| D-12 · D-23 | Content changes take the accepted-edit transition; rejections, restores of rejections, dismissals and run completion take none; an all-unchanged batch takes none; withdrawing the last active risk makes "At least one Risk" outstanding | Strapi unit + integration | quick run `assessment-workflow.unit.test.js`, `risk-curation.integration.test.js`, `ai-proposal-decisions.integration.test.js`, `risk-proposal-decisions.integration.test.js` | 16-04, 16-05, 16-06, 16-10 | ✅ | ✅ green |
| ASSESS-09 (2) · D-16 | No route serves a risk delete for any actor; no source deletes a risk or a history row; Strapi refuses deleting a request that has an assessment (`REQUEST_HAS_ASSESSMENT`), deep-equal; no web service offers a request delete | Strapi unit + integration + matrix + web | quick run `risk-no-delete.unit.test.js`, `request-workflow.integration.test.js`, `authorization-matrix.integration.test.js`, `served-operations.integration.test.js`; `vitest run src/features/risk-curation/risk-curation-service.test.ts` | 16-04, 16-05, 16-11 | ✅ | ✅ green |
| ASSESS-09 (2) · D-17 | Discard new risk with Undo restoring typed values; nothing sent; the navigation guard warns | web unit | `vitest run src/features/assessments/risk-editor.test.tsx` | 16-14 | ✅ | ✅ green (the navigation guard: red at `8b13b1c2`, green at `cc1c8f25`; see audit) |
| ASSESS-09 (2) · decision 6 | A rejected AI proposal is recorded as rejected in the run's decisions | Strapi integration | quick run `risk-proposal-decisions.integration.test.js` | 16-10 | ✅ | ✅ green |
| ASSESS-09 (3) · SC-4 · D-22 · D-29 | Withdraw, reinstate, both starts and every decision refused on a released or not editable assessment (`ASSESSMENT_NOT_MUTABLE`), deep-equal; no control after release; the API refuses each in the browser journey | Strapi integration + web + E2E | quick run `risk-curation.integration.test.js`, `risk-proposals.integration.test.js`, `risk-proposal-decisions.integration.test.js`; `vitest run src/features/assessments`; `test:e2e e2e/risk-curation.spec.ts` (`PH16_SC4_RELEASED_NO_CONTROLS`) | 16-05, 16-09, 16-10, 16-14, 16-15 | ✅ | ✅ green |
| D-18 · D-19 · D-20 | History rows in the same transaction for created (analyst, draft, added suggestion), updated (changed fields only; none for no change), withdrawn, reinstated and control-implementation added, updated and removed; rollback leaves no row; append-only | Strapi unit + integration | quick run `risk-history-changes.unit.test.js`, `risk-curation.integration.test.js`, `risk-proposal-decisions.integration.test.js` | 16-02, 16-03, 16-04, 16-10 | ✅ | ✅ green |
| D-21 | The history read is human analyst only, paginated newest first, serves a withdrawn risk, 404 for unknown, malformed rows safe, honest start | Strapi integration + matrix + web | quick run `risk-curation.integration.test.js`, `authorization-matrix.integration.test.js`; `vitest run src/features/risk-curation/risk-history-sheet.test.tsx` | 16-03, 16-05, 16-12 | ✅ | ✅ green |
| ASSESS-10 (1) · SC-2 · UAT-028 · D-30 · D-31 | Suggest more risks on a UAT-A-like context proposes the payment-file risk (no Risk Type), never repeats an existing, withdrawn or rejected risk, caps at 8; the captured prompt carries the escaped blocks with short keys and no numbers, owners or dates; over 200 entries fails `CONTEXT_TOO_LARGE` with no run | Strapi unit (wire) + integration + E2E | quick run `risk-proposal-context.unit.test.js`, `ai-provider-risk-proposals.unit.test.js`, `risk-proposals.integration.test.js`; `test:e2e e2e/risk-curation.spec.ts` (`PH16_SC2_SUGGEST_PAYMENT_FILE`) | 16-08, 16-09, 16-15 | ✅ | ✅ green |
| D-32 | Near-identical proposals dropped with an adjustment; similar ones flagged; thresholds pinned on fixtures | Strapi unit | quick run `risk-duplicates.unit.test.js`, `ai-provider-risk-proposals.unit.test.js` | 16-02, 16-08 | ✅ | ✅ green |
| D-33 | Adding a suggestion creates the risk with its `created` row, provenance naming the run and the decision event in one transaction; its fields then need Phase 12's review | Strapi integration + web | quick run `risk-proposal-decisions.integration.test.js`; `vitest run src/features/risk-curation/proposed-risk-card.test.tsx` | 16-10, 16-13 | ✅ | ✅ green |
| ASSESS-10 (2) · SC-3 · D-34 · D-35 · D-36 | Rewrite proposes only changed AI-writable fields grouped into units; focus limits them; first- and second-line facts never proposed; the comparison shows per-change decisions | Strapi unit + integration + web + E2E | quick run `risk-field-units.unit.test.js`, `ai-provider-risk-proposals.unit.test.js`, `risk-proposals.integration.test.js`; `vitest run src/features/risk-curation/risk-rewrite.test.tsx`; `test:e2e e2e/risk-curation.spec.ts` (`PH16_SC3_REWRITE_DIFF`) | 16-02, 16-08, 16-09, 16-13, 16-15 | ✅ | ✅ green |
| D-37 | A stale change is `AI_PROPOSAL_STALE` deep-equal; Undo of a confirmed change only while it holds (`AI_PROPOSAL_UNDO_UNAVAILABLE`); a newer rewrite supersedes older open changes with the cause | Strapi unit + integration | quick run `risk-field-units.unit.test.js`, `risk-proposal-decisions.integration.test.js`, `risk-proposals.integration.test.js` | 16-02, 16-09, 16-10 | ✅ | ✅ green |
| D-38 · G-14 | Adapter downgrades an AI Accept (High or Critical residual, no rationale, planned control); at confirmation `AI_ACCEPT_NOT_PERMITTED` in either order and across batches, and Phase 12's `AI_ACCEPT_WITH_PLANNED_CONTROL` | Strapi unit + integration | quick run `risk-field-units.unit.test.js`, `ai-provider-risk-proposals.unit.test.js`, `risk-proposal-decisions.integration.test.js` | 16-02, 16-08, 16-10 | ✅ | ✅ green |
| ASSESS-10 (3) · D-25 · D-26 | One run per call with operation, analyst, instruction, provider and summary; single flight only while active; any analyst reads and retries, the retrier names the new run; policy at enqueue and execution | Strapi integration + matrix | quick run `risk-proposals.integration.test.js`, `authorization-matrix.integration.test.js` | 16-09 | ✅ | ✅ green |
| D-27 | The instruction travels in its own slot, bounded, logged in the run, never with Requestor text, and cannot loosen a rule | Strapi unit (wire) + integration | quick run `ai-provider-guardrails.unit.test.js`, `ai-provider-risk-proposals.unit.test.js`, `risk-proposals.integration.test.js` | 16-08, 16-09 | ✅ | ✅ green |
| D-28 | Marked notes and opted-in files enter both contexts; the signal's baseline includes `risk-suggestions` | Strapi unit + web | quick run `ai-provider-risk-proposals.unit.test.js`, `ai-inputs-signal.unit.test.js`; `vitest run src/features/ai-assistance/ai-provenance-header.test.tsx` | 16-08, 16-10, 16-13 | ✅ | ✅ green |
| D-39 · D-40 · D-41 | Decisions on run-scoped items (accept, reject with reason, restore); repeats no-op; closed items `AI_PROPOSAL_ALREADY_DECIDED`; another assessment's run 404; lapse and supersession with causes; the folded read with the derived open count | Strapi integration | quick run `risk-proposal-decisions.integration.test.js`, `risk-proposals.integration.test.js`, `proposal-items.unit.test.js` | 16-02, 16-09, 16-10 | ✅ | ✅ green |
| D-42 | "Decisions on AI proposals" outstanding while any item is open; release refused until met; a damaged run fails open | Strapi integration + web + E2E | quick run `risk-proposal-decisions.integration.test.js`, `assessment-workflow.integration.test.js`; `vitest run src/features/assessments/assessment-editor.test.tsx`; E2E `PH16_READINESS_WAITS_FOR_DECISIONS` | 16-10, 16-14, 16-15 | ✅ | ✅ green |
| D-43 · D-44 · auth cases 1, 4, 5 · confirmation | Every Phase 16 operation human analyst only; the Requestor, an unrelated Requestor, the service agent, no identity refused per the matrix; the agent's PATCH with withdrawal facts is 400; the requesting analyst refused every targeted AI action with `OWN_REQUEST` and still allowed to curate | Strapi integration + matrix + catalogue + E2E | quick run `authorization-matrix.integration.test.js`, `contract-catalogue.integration.test.js`, `risk-curation.integration.test.js`, `risk-proposals.integration.test.js`, `risk-proposal-decisions.integration.test.js`; E2E `PH16_NEG_REQUESTING_ANALYST`; `cmp` of the catalogue copies | 16-03, 16-05, 16-09, 16-10, 16-15 | ✅ | ✅ green |
| D-02 · D-03 (chain) | Every change runs the chain: spec, `api:generate`, clean `api:check`, closed parsers in the parity guard, the operation chain, the served inventory with web callers and `regenerate_draft`'s reason, identical catalogue copies | web unit + Strapi integration + static | `vitest run src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; `api:check`; quick run `served-operations.integration.test.js`, `contract-catalogue.integration.test.js` | 16-03 to 16-11 | ✅ | ✅ green |
| D-15 | The overall-rating hint without blocking; `Use {rating}` sets the field without saving | web unit | `vitest run src/features/risk-curation/risk-curation-domain.test.ts src/features/assessments/assessment-editor.test.tsx` | 16-11, 16-14 | ✅ | ✅ green |
| D-45 · D-46 · D-47 · D-49 | Surfaces and the premium bar: the `Show` filter, withdrawn cards, card actions and menu, keyboard paths, optimistic feedback with rollback and Undo, skeletons, empty states, phone sheets and stacked comparisons, refusal copy, no `Accept`, `Delete`, `Remove` or `Not applicable` controls | web unit + E2E | `vitest run src/features/risk-curation src/features/assessments src/features/risks src/lib/performance/interface-copy-guard.test.ts`; `test:e2e e2e/accessibility.spec.ts e2e/risk-curation.spec.ts` | 16-11 to 16-15 | ✅ | ✅ green |
| D-46 (extensions) | X-27 to X-29 recorded before the implementing tasks | static | `grep -q "Withdrawn records (CSRM extension, 2026-10-01)" docs/design/csrm-design-direction.md` (and the X-28, X-29 labels) | 16-01 | ✅ (file) | ✅ green |
| D-48 | The editor route within its budget; on-demand parts lazy; client modules zod-free | E2E + static | `test:e2e e2e/performance.spec.ts`; `vitest run src/lib/performance/zod-client-boundary.test.ts` | 16-11 to 16-14 | ✅ | ✅ green |
| D-50 (journey) · SC-1 to SC-4 | The journey at 1440 and 375 with axe and every negative case, on the deterministic provider, leaving the tree clean | E2E | `pnpm --dir apps/csrm test:e2e e2e/risk-curation.spec.ts` | 16-15 | ✅ | ✅ green |
| D-51 · D-52 | One plan per wave, one owner per shared file; the full gate | static + suites | the 16-15 Task 3 gate | 16-15 | ✅ | ✅ green |
| Non-negotiables | Keycloak untouched; AI never decides or releases; suites deterministic; no new dependency; the glossary's "Withdrawn (Risk)" matches | static + suites | the Keycloak grep, dependency diff and glossary grep in 16-15 Task 3 | 16-15 | ✅ | ✅ green |

---

## Per-Task Verification Map

One row per task. Every plan also accepts `T-16-SC` (no package is added). `quick run` is the Strapi single-file run; `full Strapi` is `pnpm --dir apps/backend test`; `full web` is `pnpm --dir apps/csrm test` with `typecheck` (and `lint` where the task runs it).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behaviour | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|------------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | ASSESS-09, ASSESS-10 | T-16-01 | Extensions and records written, awaiting approval | static | greps for the three direction labels, the record (`undo: true`, `REQUEST_HAS_ASSESSMENT`, `csrm_risk_history_events`) and both amendment headings | ✅ (docs) | ✅ green |
| 16-01-02 | 01 | 1 | ASSESS-09, ASSESS-10 | T-16-01 | The pilot approves before any schema or contract change (G-6) | checkpoint (blocking-human) | — (`git diff --name-only PHASE_16_BASE -- apps/backend/src docs/references` prints nothing) | — | ✅ green |
| 16-01-03 | 01 | 1 | ASSESS-09, ASSESS-10 | T-16-02 | Dated approvals recorded | static | greps for the three dated approval lines and no awaiting line | ✅ (docs) | ✅ green |
| 16-02-01 | 02 | 2 | ASSESS-09 | T-16-03 | Closed curation body; active predicate; history envelope | Strapi unit | quick run `risk-curation-rules.unit.test.js`, `risk-history-changes.unit.test.js`, `questionnaire-workflow.unit.test.js` | ✅ | ✅ green |
| 16-02-02 | 02 | 2 | ASSESS-10 | T-16-04 | One item core; closed risk envelope | Strapi unit | quick run `proposal-items.unit.test.js`, `risk-proposal-envelope.unit.test.js`, `questionnaire-proposal-envelope.unit.test.js` | ✅ | ✅ green |
| 16-02-03 | 02 | 2 | ASSESS-10 | T-16-05 | Units, staleness, the Accept rule | Strapi unit | quick run `risk-field-units.unit.test.js` and the no-rewrite-reference grep | ✅ | ✅ green |
| 16-02-04 | 02 | 2 | ASSESS-10 | T-16-05 | Duplicate tiers pinned | Strapi unit + suite | `tsc` and full Strapi | ✅ | ✅ green |
| 16-03-01 | 03 | 3 | ASSESS-09 | T-16-06 | Approved schema; append-only writer; rollback leaves no row | Strapi integration | quick run `risk-curation.integration.test.js` | ✅ | ✅ green |
| 16-03-02 | 03 | 3 | ASSESS-09 | T-16-06 | Closed reasons in one contract change | Strapi unit + web + contract | quick run `conflict-reasons.unit.test.js`; `vitest run src/lib/api/conflict-reasons.test.ts`; `api:check` | ✅ | ✅ green |
| 16-03-03 | 03 | 3 | ASSESS-09 | T-16-07 | Withdrawal facts not writable; legacy readiness unchanged | Strapi suite | `tsc` and full Strapi | ✅ | ✅ green |
| 16-04-01 | 04 | 4 | ASSESS-09 | T-16-08 | One guard; no nested serialisation; history on update | Strapi unit + integration | quick run `assessment-workflow.unit.test.js`, `risk-curation.integration.test.js`, `assessment-workflow.integration.test.js` | ✅ | ✅ green |
| 16-04-02 | 04 | 4 | ASSESS-09 | T-16-09, T-16-10 | History on every path; `RISK_WITHDRAWN` on every mutation | Strapi integration | quick run `risk-curation.integration.test.js`, `ai-proposal-decisions.integration.test.js`, `risk-register.integration.test.js` | ✅ | ✅ green |
| 16-04-03 | 04 | 4 | ASSESS-09 | T-16-08 | No review withdrawn by a no-op or a dismissal | Strapi integration | quick run `ai-proposal-decisions.integration.test.js`, `risk-curation.integration.test.js` | ✅ | ✅ green |
| 16-04-04 | 04 | 4 | ASSESS-09 | T-16-11 | Static no-delete guard; `REQUEST_HAS_ASSESSMENT` | Strapi unit + integration + suite | `tsc` and full Strapi (`risk-no-delete.unit.test.js`, `request-workflow.integration.test.js`) | ✅ | ✅ green |
| 16-05-01 | 05 | 5 | ASSESS-09 | T-16-12 | Human-only withdrawal | Strapi integration + contract | quick run `risk-curation.integration.test.js`, `contract-catalogue.integration.test.js`; `api:check`; `cmp` | ✅ | ✅ green |
| 16-05-02 | 05 | 5 | ASSESS-09 | T-16-13, T-16-14, T-16-15 | Batch 404; released refusal; closed Undo flag | Strapi integration + contract | same as 16-05-01 | ✅ | ✅ green |
| 16-05-03 | 05 | 5 | ASSESS-09 | T-16-12 | History read; six-actor matrix; unmounted delete probes | Strapi suite + contract | `tsc`, full Strapi, `api:check`, `cmp` | ✅ | ✅ green |
| 16-06-01 | 06 | 6 | ASSESS-09 | T-16-17 | Readiness over active risks; analyst withdrawal block | Strapi unit + integration + web | quick run `assessment-workflow.unit.test.js`, `assessment-workflow.integration.test.js`, `risk-curation.integration.test.js`; `api:check`; `vitest run src/features/contract-response-parity.test.ts src/features/assessments` | ✅ | ✅ green |
| 16-06-02 | 06 | 6 | ASSESS-09 | T-16-16 | Requestor reads and counts exclude withdrawn risks | Strapi suite + web | `tsc`, full Strapi, full web, `typecheck` | ✅ | ✅ green |
| 16-07-01 | 07 | 7 | ASSESS-09 | T-16-19 | Register default and `Withdrawn` filter; detail block | Strapi unit + integration + web | quick run `risk-register.unit.test.js`, `risk-register.integration.test.js`; `api:check`; `vitest run src/features/contract-response-parity.test.ts src/features/risks` | ✅ | ✅ green |
| 16-07-02 | 07 | 7 | ASSESS-09 | T-16-18 | Figures exclude withdrawn risks | Strapi integration | quick run `analyst-dashboard.integration.test.js`, `analyst-alerts.integration.test.js`, `analyst-reports.integration.test.js` | ✅ | ✅ green |
| 16-07-03 | 07 | 7 | ASSESS-09 | T-16-18 | Static reader guard | Strapi unit + suites | `tsc`, full Strapi (`active-risk-readers.unit.test.js`), full web, `typecheck` | ✅ | ✅ green |
| 16-08-01 | 08 | 8 | ASSESS-10 | T-16-20, T-16-21, T-16-22 | Minimised, bounded suggestion context; deterministic wire through the adapter | Strapi unit | quick run `risk-proposal-context.unit.test.js`, `ai-provider-risk-proposals.unit.test.js`, `assessment-context.unit.test.js` | ✅ | ✅ green |
| 16-08-02 | 08 | 8 | ASSESS-10 | T-16-23 | Rewrite units; Accept downgrades | Strapi unit | quick run `risk-proposal-context.unit.test.js`, `ai-provider-risk-proposals.unit.test.js` | ✅ | ✅ green |
| 16-08-03 | 08 | 8 | ASSESS-10 | T-16-20 | Hosted wire through the fake server; guardrails; run record | Strapi suite + web + contract | `tsc`, full Strapi, `api:check`, `vitest run src/features/ai-assistance src/features/contract-response-parity.test.ts` | ✅ | ✅ green |
| 16-09-01 | 09 | 9 | ASSESS-10 | T-16-24 | Human-only start, job and read; `OWN_REQUEST` | Strapi integration + contract | quick run `risk-proposals.integration.test.js`, `contract-catalogue.integration.test.js`; `api:check`; `cmp` | ✅ | ✅ green |
| 16-09-02 | 09 | 9 | ASSESS-10 | T-16-25, T-16-26, T-16-27 | No re-run after release or on a withdrawn risk; policy; bounds; lapse; supersession | Strapi integration + contract | same as 16-09-01 | ✅ | ✅ green |
| 16-09-03 | 09 | 9 | ASSESS-10 | T-16-24 | Six-actor matrix | Strapi suite | `tsc` and full Strapi | ✅ | ✅ green |
| 16-10-01 | 10 | 10 | ASSESS-09, ASSESS-10 | T-16-28 | Run ancestry; add through the create path; readiness gate | Strapi integration + contract | quick run `risk-proposal-decisions.integration.test.js`, `assessment-workflow.integration.test.js`, `ai-proposal-decisions.integration.test.js`; `api:check` | ✅ | ✅ green |
| 16-10-02 | 10 | 10 | ASSESS-10 | T-16-29, T-16-30 | Stale check; Accept rule after the batch; per-field run | Strapi unit + integration | quick run `ai-provenance.unit.test.js`, `risk-proposal-decisions.integration.test.js` | ✅ | ✅ green |
| 16-10-03 | 10 | 10 | ASSESS-09, ASSESS-10 | T-16-31 | `OWN_REQUEST`; closed parser; supersession on withdrawal; signal baseline | Strapi suite | `tsc` and full Strapi | ✅ | ✅ green |
| 16-11-01 | 11 | 11 | ASSESS-09 | T-16-32 | Closed action input; R1 copy | web unit | `vitest run src/features/risk-curation src/lib/api/refusal-copy.test.ts src/features/contract-response-parity.test.ts`; `typecheck` | ✅ | ✅ green |
| 16-11-02 | 11 | 11 | ASSESS-09, ASSESS-10 | T-16-33 | Every service and action; Undo flags; served web callers | web unit + Strapi integration | `vitest run src/features/risk-curation src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts src/lib/performance/zod-client-boundary.test.ts`; `typecheck`; quick run `served-operations.integration.test.js` | ✅ | ✅ green |
| 16-11-03 | 11 | 11 | ASSESS-09, ASSESS-10 | T-16-32 | Domain rules and R2 to R4 | web suite | full web, `typecheck`, `lint`, the zod grep | ✅ | ✅ green |
| 16-12-01 | 12 | 12 | ASSESS-09 | T-16-35 | Withdraw from the card with Undo and rollback | web unit | `vitest run src/features/risk-curation/risk-card-actions.test.tsx src/features/risk-curation/withdraw-risk-form.test.tsx`; `typecheck` | ✅ | ✅ green |
| 16-12-02 | 12 | 12 | ASSESS-09 | T-16-34 | Reinstatement; withdrawn card; badge | web unit | `vitest run src/components/csrm/status-badge.test.tsx src/features/risk-curation/withdrawn-risk-card.test.tsx src/features/risk-curation/withdraw-risk-form.test.tsx`; `typecheck` | ✅ | ✅ green |
| 16-12-03 | 12 | 12 | ASSESS-09 | T-16-34 | Comparison extension; history sheet | web suite | full web, `typecheck`, `lint` | ✅ | ✅ green |
| 16-13-01 | 13 | 13 | ASSESS-10 | T-16-36 | Suggest more risks and proposed-risk decisions | web unit | `vitest run src/features/risk-curation/ai-proposals-section.test.tsx src/features/risk-curation/proposed-risk-card.test.tsx`; `typecheck` | ✅ | ✅ green |
| 16-13-02 | 13 | 13 | ASSESS-10 | T-16-37 | Rewrite and per-change decisions | web unit | `vitest run src/features/risk-curation/risk-rewrite.test.tsx src/features/risk-curation/ai-proposals-section.test.tsx`; `typecheck` | ✅ | ✅ green |
| 16-13-03 | 13 | 13 | ASSESS-10 | T-16-36 | States, requesting analyst, phones, run sheet, signal | web suite | full web, `typecheck`, `lint` | ✅ | ✅ green |
| 16-14-01 | 14 | 14 | ASSESS-09, ASSESS-10 | T-16-39 | Editor integration; proposals withheld on `OWN_REQUEST` | web unit | `vitest run src/features/assessments/assessment-editor.test.tsx src/features/ai-assistance`; `typecheck` | ✅ | ✅ green |
| 16-14-02 | 14 | 14 | ASSESS-09, ASSESS-10 | T-16-38 | Discard, rewrite slot, hint, locked states | web unit | `vitest run src/features/assessments`; `typecheck` | ✅ | ✅ green (D-17 guard fixed in `cc1c8f25`) |
| 16-14-03 | 14 | 14 | ASSESS-09, ASSESS-10 | T-16-38 | Copy guard; release journey, budget and accessibility green; clean tree | web suite + E2E | full web, `typecheck`, `lint`; `test:e2e e2e/assessment-release-workflow.spec.ts e2e/performance.spec.ts e2e/accessibility.spec.ts e2e/design-contract.spec.ts`; clean `git status` | ✅ | ✅ green |
| 16-15-01 | 15 | 15 | ASSESS-09 | T-16-40 | Register `Withdrawn` filter; read-only detail | web unit | `vitest run src/features/risks`; `typecheck` | ✅ | ✅ green |
| 16-15-02 | 15 | 15 | ASSESS-09, ASSESS-10 | T-16-40, T-16-41 | The journey at both widths with every negative case | E2E | `test:e2e e2e/risk-curation.spec.ts e2e/risk-register-workflow.spec.ts`; clean `git status` | ✅ | ✅ green |
| 16-15-03 | 15 | 15 | All | T-16-41 | The phase gate and static checks | E2E + suites + static | the full suite, `test:e2e` (both projects), clean `git status`, the freeze, `cmp`, Keycloak, dependency, glossary and coverage checks | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each file is created by the owning plan's first RED task (the project convention).

- [x] `apps/backend/tests/risk-curation-rules.unit.test.ts`: active forms, `parseReasonText`, the curation body, the partitions (16-02 Task 1)
- [x] `apps/backend/tests/risk-history-changes.unit.test.ts`: changed-field detection, relation labels, empty diff, envelope parsing (16-02 Task 1)
- [x] `apps/backend/tests/risk-proposal-envelope.unit.test.ts`: risk proposal envelope v1 and decision payloads (16-02 Task 2)
- [x] `apps/backend/tests/risk-field-units.unit.test.ts`: units, normalisation, staleness, focus, the Accept rule (16-02 Task 3)
- [x] `apps/backend/tests/risk-duplicates.unit.test.ts`: the two tiers on UAT-A-like fixtures (16-02 Task 4)
- [x] `apps/backend/tests/risk-curation.integration.test.ts`: schema, history, guard, withdrawn refusals, withdrawal, reinstatement, Undo, history read, Requestor exclusion (16-03 Task 1; extended by 16-04 to 16-06)
- [x] `apps/backend/tests/risk-no-delete.unit.test.ts`: the static delete guard (16-04 Task 4)
- [x] `apps/backend/tests/active-risk-readers.unit.test.ts`: the static reader guard (16-07 Task 3)
- [x] `apps/backend/tests/risk-proposal-context.unit.test.ts`, `apps/backend/tests/ai-provider-risk-proposals.unit.test.ts`, `apps/backend/tests/fixtures/ai-wire/risk-proposals-wire.json` (16-08 Tasks 1 and 3)
- [x] `apps/backend/tests/risk-proposals.integration.test.ts`: jobs, runs, lapse, supersession, refusals, the read (16-09 Task 1)
- [x] `apps/backend/tests/risk-proposal-decisions.integration.test.ts`: decisions, stale, Accept rule, readiness, transitions (16-10 Task 1)
- [x] `apps/csrm/src/features/risk-curation/*.test.ts(x)`: service, actions, domain (16-11); card actions, withdraw form, withdrawn card, history sheet (16-12); proposals section, proposed-risk card, rewrite (16-13)
- [x] `apps/csrm/src/features/assessments/risk-editor.test.tsx` (16-14 Task 2)
- [x] `apps/csrm/e2e/risk-curation.spec.ts`: the journey at 375 and 1440 (16-15 Task 2)

No framework install is needed: vitest, `node:test`, Playwright and the fake OpenAI-compatible server already exist.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live model quality: "Suggest more risks" on UAT-A proposes payment-file integrity and segregation of duties without repeating the three drafted risks; "Rewrite this risk" sharpens a generic risk with citations | ASSESS-10 | Suites pin the deterministic provider; running the hosted provider sends request data off the machine, which is the operator's call | The operator, with the provider they approve, on a fresh copy of the development database: UAT-A from `.planning/workstreams/csrm/uat/product-gaps/JOURNEYS.md`; compare with the AI job log and record the duplicate flags the live output produced |
| The development database gains the withdrawal columns and `csrm_risk_history_events`, and the new Functions | D-01, D-43 | The operator's database changes only when the orchestrator restarts Strapi | After the restart: `PRAGMA table_info(csrm_risks)` includes `withdrawn_at` and `withdrawal_reason`; `csrm_risk_history_events` exists; UAT-A's risks read as active with "History recorded from" shown |
| The premium bar, at a glance, on real screens, and the three UI-SPEC backstops | D-45 to D-47 | Visual judgement beyond axe and unit tests | The orchestrator's browser checks at 375 and 1440: the editor's Identified Risks with both filters, a withdrawn card, the history sheet, the proposals section and phone sheet, a rewrite comparison, the Risk Register's `Withdrawn` filter and detail; the card header wrap at 1440, the rewrite popover at the viewport edge, and a long toast at 375 |

---

## Validation Audit 2026-10-16

Retroactive Nyquist audit at `14bd22a8` (after stage A review). I checked every named file on disk and grepped its test names against each row's behaviour. No file was renamed or is missing: all 14 Wave 0 files exist, including `fixtures/ai-wire/risk-proposals-wire.json`.

| Metric | Count |
|--------|-------|
| Map rows (requirement / finding / criterion / decision) | 34: 34 green (33 at the audit, 1 partial until `cc1c8f25`) |
| Per-task rows | 46: 46 green (16-14-02 partial until `cc1c8f25`) |
| Gaps found | 1 (D-17: "the navigation guard warns" had no automated proof) |
| Gaps filled green | 1 (after the escalation was fixed test-first) |
| Escalations | 1, closed by `8b13b1c2` (RED) and `cc1c8f25` (GREEN) |

**Proof by row (main tests):**
- **Schema, history, withdrawal, reinstatement, Undo, released refusals, Requestor exclusion (D-01, D-05 to D-11, D-18 to D-22, D-43, D-44).** `risk-curation.integration.test.ts`: "a fresh database boots with the withdrawal columns…", "a human Security Analyst withdraws a Risk with a reason…", "undo both ways…", "reinstating only active Risks is refused 409 RISK_NOT_WITHDRAWN…", "a batch naming a Risk of another assessment… is 404…", "on a released assessment withdrawal and reinstatement answer 409 ASSESSMENT_NOT_MUTABLE…", "the Secondary Requestor gets the missing-record refusal… with identical bodies (D-08)", "withdrawing the last active Risk leaves 'At least one Risk' outstanding…".
- **No delete (D-16).**
  - `risk-no-delete.unit.test.ts`: "no Strapi source deletes a Risk or a Risk history row, and no DELETE route serves /v1/risks".
  - `request-workflow.integration.test.ts`: "a request that has a risk assessment is never deleted: 409 REQUEST_HAS_ASSESSMENT…".
  - The matrix's unmounted DELETE rows in `fixtures/authorization-matrix.ts`.
  - `risk-curation-service.test.ts`: "has no service under src/features that calls DELETE on an assessment request path".
- **Suggest and rewrite (ASSESS-10, SC-2, SC-3, D-24 to D-41).**
  - `risk-proposals.integration.test.ts`: the "Suggest more risks: Bob's start…", "Rewrite this risk…", "superseded…", "lapsed…", "CONTEXT_TOO_LARGE…" and "an instruction over 500 characters…" tests.
  - `ai-provider-risk-proposals.unit.test.ts`:
    - "a UAT-A-like context yields the payment-file integrity risk…";
    - "a near-duplicate restatement… is dropped with near-duplicate-active";
    - "the payment-file risk is not proposed again when a rejected suggestion already names it";
    - "the UAT-A reply of ten risks keeps eight…";
    - "an AI Accept on a High resulting residual becomes Treat…".
  - `risk-duplicates.unit.test.ts`: "the thresholds are pinned…".
- **Decisions (decision 6, D-33, D-37 to D-42).** `risk-proposal-decisions.integration.test.ts`: "Add to assessment…", "readiness lists Decisions on AI proposals outstanding…", "…AI_PROPOSAL_STALE…", "the Accept rule holds at confirmation in either order…", "deciding a superseded or lapsed item is refused with AI_PROPOSAL_ALREADY_DECIDED", "a run whose stored decisions do not read counts no open item… (fail open, D-42)". Line 388 asserts the rejected change is recorded as `rejected` in the run's decisions.
- **Signal baseline (D-28).** `ai-inputs-signal.unit.test.ts`: `CONTEXT_WIDE_AI_OPERATIONS` includes `risk-suggestions`.
- **Hint (D-15).** `assessment-editor.test.tsx`: "hints the highest active residual rating under Overall rating, and Use High sets the field without saving".
- **Journey (D-50, SC-1 to SC-4).** `e2e/risk-curation.spec.ts` carries every planned marker: `PH16_SC1_WITHDRAW_LEAVES_READINESS`, `PH16_SC1_HISTORY`, `PH16_SC2_SUGGEST_PAYMENT_FILE`, `PH16_SC3_REWRITE_DIFF`, `PH16_SC4_RELEASED_NO_CONTROLS`, `PH16_READINESS_WAITS_FOR_DECISIONS`, `PH16_REQUESTOR_EXCLUDES_WITHDRAWN`, `PH16_NEG_UNRELATED_REQUESTOR`, `PH16_NEG_REQUESTING_ANALYST`, `PH16_UNDO_AND_REINSTATE`, `PH16_UNDO_KEEPS_PLACE` and `PH16_REGISTER_WITHDRAWN_FILTER`. The last green gate (Playwright 248/248) ran it at both widths. This audit did not re-run it.

**New test.** `apps/csrm/src/features/assessments/risk-editor.test.tsx`: "warns on leaving while the Add Risk form holds input, and not once it is discarded (D-17, validation audit 2026-10-16)". It renders the editor under the shell's `NavigationGuardProvider`, types into the Add Risk form and dispatches a cancelable `beforeunload`, the same probe `navigation-guard.test.tsx` uses.

**Escalation (BLOCKER, implementation gap), closed by the stage B worker.**
- **What fails.** D-17 and 16-14's truth say "Phase 10's navigation guard still warns on leaving with input". The new test fails with `NO_LEAVE_WARNING_WITH_INPUT: expected false to be true`.
- **Why.** Neither `apps/csrm/src/features/assessments/risk-editor.tsx` nor `assessment-editor.tsx` calls `useLeaveGuard` or `useUnloadWarning`, so leaving the page with typed input is never warned.
- **How the test is marked.** It is `it.fails` with an ESCALATED comment, so the suite stays green and the defect stays recorded. Focused run: 8 passed, 1 expected fail.
- **When fixed.** Change it to `it` once the editor arms the guard for a dirty Add Risk form.
- **Fixed (2026-10-16, stage B worker).** The test became a plain `it` that also proves the in-app path: it leaves through the guard's programmatic entry point (`useNavigationGuard().navigate`, as a link's `onNavigate` does) and expects the dialog `Leave with a new risk not added?` with `Keep editing` keeping the typed values; an untouched form and a discarded one do not block. RED at `8b13b1c2` (`NO_LEAVE_WARNING_WITH_INPUT`). GREEN at `cc1c8f25`: `RiskEditor` registers `useLeaveGuard` in create mode while the form holds input, with `newRiskLeaveCopy` (`risk-curation-domain.ts`); 16-UI-SPEC §7 carries the dated amendment with the copy. Focused: `risk-editor.test.tsx` 9/9; `src/features/assessments`, `src/features/risk-curation` and `src/components` 69 files, 1,255/1,255.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the one checkpoint, 16-01-02, is blocking-human by design)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s at task level (full suites run only in each plan's final task)
- [x] `nyquist_compliant: true` set in frontmatter (false at the 2026-10-16 audit until the D-17 guard was fixed in `cc1c8f25`)

**Approval:** validated 2026-10-16; the one escalation (D-17 navigation guard) is fixed test-first in `8b13b1c2`/`cc1c8f25`, so nyquist_compliant is true
