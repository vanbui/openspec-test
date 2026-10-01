---
phase: "12"
slug: "ai-context-suggestions-and-provenance"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-28"
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source and scope.** Seeded on 2026-09-28 from `12-RESEARCH.md`, "Validation Architecture", before any plan exists. It maps every requirement, finding and decision to an automated proof:
- the four requirements: INT-05, INT-06, ASSESS-08 and QUES-10;
- the seven findings: UAT-029, UAT-030, UAT-031, UAT-032, UAT-042, UAT-043 and UAT-044;
- the locked decisions D-01 to D-39 in `12-CONTEXT.md`.

**How the maps are filled.**
- **Per-task map:** the rows below are seeded from the research's proposed plans (`12-01` to `12-16`). The planner replaces them with one row per task, taken from each task's `<automated>` verify block, and the plan check verifies them (Dimension 8).
- **Plan numbering:** if the planner merges or splits plans, it records the mapping from the research's numbering here.
- **Markers:** "❌ W0" marks a test file that the owning plan's first RED task creates (the project convention).
- **Status:** every status starts as ⬜ pending.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **Web:** vitest 4.1.11 (jsdom) with @testing-library/react 16.3.0 and user-event 14.6.1.<br>**Strapi:** `node:test`, compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, one process and one SQLite database per test file. Provider adapters are tested through `apps/backend/tests/helpers/fake-openai-compatible-server.ts` with model-facing wire bodies.<br>**E2E:** Playwright 1.58.2 with @axe-core/playwright 4.11.0, Chromium, on the production build. |
| **Config file** | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` (`desktop` 1440×900; `mobile` 375×812, `@journey` tests only; `workers: 1`) |
| **Node** | Prefix every command in Git Bash with `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" &&` (Node 24.19.0, pnpm 11.24.0). |
| **Quick run command** | **Web:** `pnpm --filter @csrm/web exec vitest run <path> [<path> …]`, with paths under `apps/csrm`. Never put a pattern after `--`.<br>**Strapi file** (dev servers stopped): `pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js`.<br>**E2E** (dev servers stopped): `pnpm --filter @csrm/web test:e2e e2e/<spec>.spec.ts [--project desktop\|mobile]`. |
| **Contract commands** | `pnpm --prefix apps/csrm api:generate`, then `pnpm --prefix apps/csrm api:check`. After a new or changed route or grant: `SERVED_OPERATIONS_WRITE=1 pnpm --filter @csrm/strapi served-operations:write` (dev servers stopped). |
| **Full suite command** | `pnpm --filter @csrm/web test`; `pnpm --filter @csrm/web typecheck`; `pnpm --prefix apps/csrm api:check`; `pnpm --filter @csrm/strapi test` |
| **Phase gate** | The four full-suite commands, then `pnpm --filter @csrm/web test:e2e` (both projects, production build).<br>**Before:** ports 1337 and 3000 are free; in Git Bash, `netstat -ano \| grep -E ':(1337\|3000) .*LISTENING'` prints nothing.<br>**Afterwards:**<br>- `git status --porcelain` is empty (Phase 8 D-12; a dirty tree is a harness defect);<br>- the content-type freeze check `git diff --name-only <phase-12-context-commit>..HEAD -- 'apps/backend/src/api/*/content-types/*'` lists exactly `csrm-ai-run/content-types/csrm-ai-run/schema.json`, `csrm-assessment/content-types/csrm-assessment/schema.json` and `csrm-risk/content-types/csrm-risk/schema.json` (D-01);<br>- `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` is silent;<br>- `git diff --name-only <phase-12-context-commit>..HEAD \| grep -i keycloak` prints nothing. |
| **Estimated runtime** | A web file takes under 20 s; a Strapi file 10–90 s, and the authorization matrix 2–4 min. The full web suite takes about 20 s, the full Strapi suite about 10–15 min, and the full Playwright suite about 13–17 min (Phase 12 adds one journey). |

**Known infrastructure facts.**
1. **Shared `dist`.** The orchestrator's dev Strapi (1337) and Next (3000) run during planning. Everything that compiles Strapi shares `apps/backend/dist`: the Strapi suite, a single Strapi file, `served-operations:write` and Playwright. All of these wait until the servers are stopped. A task executed while they run records those proofs as pending for the plan's end.
2. **No live AI.** Every suite pins `CSRM_AI_PROVIDER=deterministic`. From plan 12-05, both harnesses (`apps/backend/tests/helpers/strapi-http-harness.ts` and Playwright's Strapi `webServer` env) also pin `CSRM_AI_DATA_CLASSIFICATION_CEILING=''` (D-31). No proof calls a model. The hosted provider is exercised only by the operator's manual check.
3. **Environment for the policy.** Both harnesses run Strapi with `NODE_ENV=development` and `CSRM_ENVIRONMENT=development`, so an unset ceiling means no ceiling. Refusal proofs set the ceiling in their own harness boot, or test the pure policy module with injected configuration.
4. **Jobs are process-local** (R-08-36). No E2E relies on a job outliving a restart. Interrupted-run reconciliation is proved in Strapi integration by booting with a `running` run seeded in the database.
5. **Generated files.** `apps/csrm/next-env.d.ts` is untracked and ignored.
6. **Windows vitest** can fail with `EPERM: rename`. Rerun that file alone before treating it as a real failure.
7. **Fixtures (the 06.9 lesson).** The new journey creates its own UAT-A-like request, systems and assets through the UI or its own seed. The one-shot release fixture ("Customer portal security assessment") keeps serving the existing release journey.
8. **The base changes first.** Phase 10 (plans 10-05 to 10-23) and Phase 11 execute before Phase 12 and change the files this phase edits. Re-run the plan check before executing.

---

## Sampling Rate

- **After every task commit:**
  - run the touched web test files by path;
  - run `typecheck` when types change, and `api:check` after any spec change;
  - run the touched Strapi files by path, dev servers stopped.
- **After every plan wave:**
  - run the full web suite, `typecheck` and `api:check`;
  - run the full Strapi suite after every plan that edits Strapi: 12-02 to 12-12;
  - run each UI plan's targeted Playwright specs once at its end (12-14, 12-15).
- **Before `/gsd-verify-work`:** the full suite must be green. That is the phase gate above (plan 12-16), recorded with counts, duration, the flaky count and the empty `git status`.
- **Max feedback latency:** 90 seconds at task level. The production-build E2E runs only at plan level.

---

## Requirement, Finding and Decision Map

Each row names the proof, whether its file exists, and its state. Strapi files are named by their compiled `.js` form for the quick run; web paths are under `apps/csrm`.

| Req / Finding / Decision | Behaviour to verify | Test type | Automated command / proof | File exists? | Status |
|--------------------------|--------------------|-----------|---------------------------|--------------|--------|
| INT-05 · UAT-030 · D-04 | The context holds the request fields (regulatory and third-party included), the selected systems and assets with classifications, and, for the draft, each active visible question's text with its rendered answer; excluded fields (identity, numbers, dates, revert facts, owners, comments) are absent | Strapi unit | quick run `assessment-context.unit.test.js` (UAT-A-like fixture) | ❌ W0 | ⬜ pending |
| INT-05 · D-05 | Every Requestor value sits inside the delimited data block, escaped; tag names are constants; the instruction slot is empty; no tools are sent | Strapi unit (wire) | quick run `ai-provider-guardrails.unit.test.js` (hostile `</answer>`, `</businessPurpose>` and `&` payloads in every Requestor field), `ai-provider-assessment.unit.test.js`, `ai-provider-questionnaire.unit.test.js` | ✅ (extended) | ⬜ pending |
| INT-05 · D-06 | Libraries are bounded and ranked, with offered and total counts in the summary; more than 100 systems or assets, or an over-budget context, gives `CONTEXT_TOO_LARGE` before any call and creates no run; Requestor text is never truncated | Strapi unit + integration | quick run `assessment-context.unit.test.js`, `library-ranking.unit.test.js`; the mounted refusal case in `assessment-workflow.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| D-06 (schema subset) | Both wire schemas sent contain no `minLength`, `maxLength`, `pattern`, `format`, `minItems`, `maxItems`, `uniqueItems` or `const`; object properties ≤ 100; nesting ≤ 5 | Strapi unit | the schema guard in `ai-provider-assessment.unit.test.js` and `ai-provider-questionnaire.unit.test.js` | ✅ (extended) | ⬜ pending |
| INT-05 · D-07 · D-25 | The run read returns facts, context summary and source catalogue, without the proposal or Requestor text; human analyst only; an unknown id is 404; the web disclosure renders all five states | Strapi integration + matrix + web | quick run `ai-run.integration.test.js`, `authorization-matrix.integration.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/ai-assistance` | ❌ W0 | ⬜ pending |
| INT-05 · UAT-030 · D-13 | Draft risks carry the request's own system and asset, and the asset's recorded classification; the model cannot name another record; each pre-filled value is AI-proposed | Strapi unit (wire) + integration + E2E | quick run `ai-provider-assessment.unit.test.js` (an unknown system key is refused), `assessment-workflow.integration.test.js`; `ai-context-provenance.spec.ts` | ✅ / ❌ W0 | ⬜ pending |
| INT-05 · G-3 · D-26 · D-27 · D-28 | Classification is the highest asset classification, with the Internal default stated. Development with no ceiling allows; production with no ceiling refuses with `AI_POLICY_NOT_CONFIGURED`; above the ceiling refuses with `AI_CLASSIFICATION_ABOVE_CEILING`, both at enqueue (409, persistence deep-equal, no run, no job) and at execution (job failed, no provider call); an invalid ceiling fails boot | Strapi unit + integration | quick run `ai-data-policy.unit.test.js`, `ai-provider-boot.unit.test.js`, `questionnaire-generation.integration.test.js`, `assessment-workflow.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| G-7 · D-30 | The transcript flag logs only when `NODE_ENV` and `CSRM_ENVIRONMENT` are both `development`, and warns at boot otherwise | Strapi unit | quick run `ai-provider-questionnaire.unit.test.js` (the transcript case under both environments), `ai-provider-boot.unit.test.js` | ✅ (extended) | ⬜ pending |
| UX-06 · D-29 | Phase 10's generation-jobs read carries `aiPolicy`; the hub shows the refusal in place of Generate, with plain copy naming the classification and the ceiling | Strapi integration + web | quick run `questionnaire-generation.integration.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/assessments/questionnaire-generation-job.test.tsx src/features/assessments/assessment-review-workflow.test.tsx` | ✅ | ⬜ pending |
| INT-06 · UAT-032 · D-19 · D-20 | A run per provider call: `running` before the call, `completed` in the persisting transaction with the proposal, `failed` with a safe code otherwise; a retry is a new run; a refusal creates none; `running` runs become `interrupted` at boot | Strapi integration | quick run `ai-run.integration.test.js`, `questionnaire-generation.integration.test.js`, `assessment-workflow.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| INT-06 · D-21 | Every AI-written field starts `proposed`; an update that changes it marks it `edited` (actor, time) in the same transaction, from both the assessment editor path and the Risk Register path; decisions log the event; release readiness is outstanding while any field is `proposed` | Strapi integration | quick run `assessment-workflow.integration.test.js`, `risk-register.integration.test.js`, `ai-proposal-decisions.integration.test.js` | ✅ / ❌ W0 | ⬜ pending |
| INT-06 · D-24 | Decisions: accept (fields, all remaining, a suggestion creating a Planned implementation), dismiss, restore; idempotent repeats; 400 for an unknown item; 409 `ASSESSMENT_NOT_MUTABLE` on a released assessment and `AI_PROPOSAL_ALREADY_DECIDED` on a conflicting decision; persistence deep-equal on refusal; the edit transition applies (draft → in-review; restore on a release-ready assessment regresses it) | Strapi integration + matrix | quick run `ai-proposal-decisions.integration.test.js`, `authorization-matrix.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| INT-06 · UAT-042 · D-14 | Statement fields carry validated sources; unknown ids are dropped (count recorded); an empty source list is flagged; up to five uncited claims per risk; the web shows citations that open their source, and flags | Strapi unit (wire) + web + E2E | quick run `ai-provider-assessment.unit.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/ai-assistance src/features/assessments/assessment-editor.test.tsx`; E2E | ✅ / ❌ W0 | ⬜ pending |
| INT-06 · UAT-032 · D-22 · D-23 | Analyst reads carry `generation` (provider, model, time, initiating analyst, run id) on the questionnaire and assessment, and `aiOrigin` per question; Requestor reads carry `aiAssisted` only (no `generation`, run id or provenance); the released view has no "Generated by"; pre-Phase 12 records project null provenance and no readiness item | Strapi integration + web + E2E | quick run `questionnaire-workflow.integration.test.js`, `assessment-workflow.integration.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/assessments/released-assessment.test.tsx src/features/contract-response-parity.test.ts`; `api:check`; E2E | ✅ | ⬜ pending |
| ASSESS-08 · UAT-029 · D-09 | The library reaches the prompt (a fourth type appears); two risks of one type and a null-type risk pass the parser in the shared order; the deterministic draft proposes two Personal Information Handling risks when regulatory requirements exist | Strapi unit + integration | quick run `ai-provider-assessment.unit.test.js`, `assessment-workflow.unit.test.js`, `assessment-workflow.integration.test.js` | ✅ | ⬜ pending |
| ASSESS-08 · UAT-031 · D-12 | Candidates are the offered types' applicable controls plus the ranked library shortlist (at most 150); the ranker is deterministic; an unknown candidate is dropped; at most five per risk; add creates a Planned implementation and marks it `added`; dismiss and restore are recorded; a control already on the risk shows as added | Strapi unit + integration + web + E2E | quick run `library-ranking.unit.test.js`, `ai-provider-assessment.unit.test.js`, `ai-proposal-decisions.integration.test.js`; the web suggestions test; E2E | ❌ W0 / ✅ | ⬜ pending |
| ASSESS-08 · UAT-044 · D-10 · D-11 | Ratings derive from the 5 × 5 scales (all 25 cells); the model sends no rating (an extra key is refused); an internal rating mismatch is refused; Accept on a High or Critical residual, or without a rationale, becomes Treat with the adjustment recorded; the deterministic draft proposes Accept for a Moderate residual; the overall rating is the highest residual | Strapi unit + integration | quick run `risk-scale.unit.test.js`, `ai-provider-assessment.unit.test.js`, `assessment-workflow.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| QUES-10 · UAT-043 · D-16 | Wire v2: 6–20 questions (5 and 21 refused); no Boolean; "Not sure" appended to selects lacking it (not duplicated when present in any listed form); help text passes through, is null when blank and refused over 2,000; the guidance names plain language, one question each and optional-where-appropriate; the deterministic questionnaire has help text, a "Not sure" choice, an optional question, and echoes the regulatory requirements and a selected asset | Strapi unit (wire) + integration | quick run `ai-provider-questionnaire.unit.test.js`, `questionnaire-generation.unit.test.js`, `questionnaire-generation.integration.test.js` | ✅ | ⬜ pending |
| QUES-10 · D-17 | Help text persists on generation, projects for both actors, shows as the Requestor's field hint (`aria-describedby`) and in the analyst views, and is editable in the governance form | Strapi integration + web + E2E | quick run `questionnaire-generation.integration.test.js`, `questionnaire-governance.integration.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/questionnaires/questionnaire-renderer.test.tsx src/features/questionnaires/questionnaire-governance.test.tsx`; the changed `questionnaire-generation-workflow.spec.ts` | ✅ | ⬜ pending |
| D-01 | Exactly three schema files change after the approved record; `aiProvenance` is optional JSON; legacy rows read as null; the table and columns exist after boot | static + Strapi integration + dev database check | the freeze check above; quick run `ai-run.integration.test.js` (legacy rows); after the orchestrator's restart, the 06.8-01 PRAGMA check for `csrm_ai_runs` and the `ai_provenance` columns | ❌ W0 | ⬜ pending |
| D-02 · D-03 | Every API change runs through the chain: the spec, `api:generate`, a clean `api:check`, closed parsers registered in the parity guard, the operation chain, the served inventory and byte-identical catalogue copies | web unit + Strapi integration + static | `pnpm --filter @csrm/web exec vitest run src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; `api:check`; quick run `served-operations.integration.test.js`, `contract-catalogue.integration.test.js`; `cmp` of the catalogue copies | ✅ | ⬜ pending |
| D-32 · D-33 · R-08-42 · G-1 | Draft generation, job read and retry are human-analyst-only (catalogue and guard); the new operations are human-only; the agent holds no request create, update, delete or reference-data grant; the matrix states each actor's outcome; residual rows R-08-12 and R-08-42 are closed | Strapi integration + matrix + static | quick run `authorization-matrix.integration.test.js`, `contract-catalogue.integration.test.js`, `authorization-policy.unit.test.js`; `grep -n "R-08-42\|R-08-12" docs/security/phase-08-residual-risks.md` shows them closed | ✅ | ⬜ pending |
| D-35 · D-36 · D-37 | Markers are an icon plus text with accessible names, never colour alone; Accept and Dismiss are optimistic with rollback and an Undo toast; the disclosure has five states; phone layouts stack; axe passes; the editor route stays within its JavaScript budget | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/ai-assistance`; `accessibility.spec.ts`, `performance.spec.ts` and `ai-context-provenance.spec.ts` at 375 and 1440 | ❌ W0 / ✅ | ⬜ pending |
| D-38 (UAT-A-like journey) | Request with systems, assets and regulatory requirements; the generated questionnaire shows help text and "Not sure"; the Requestor answers; the draft shows pre-fill, citations and suggestions; add a suggestion; accept the remaining proposals; release; the Requestor sees the disclosure. Both widths | E2E | `pnpm --filter @csrm/web test:e2e e2e/ai-context-provenance.spec.ts` | ❌ W0 | ⬜ pending |
| D-38 (release journey) | After the deterministic draft, the analyst accepts the AI proposals before readiness is met; the released overview shows the disclosure and no "Generated by" | E2E | the changed `assessment-release-workflow.spec.ts` | ✅ | ⬜ pending |
| Non-negotiables | Keycloak stays disabled; AI output never releases; suites stay deterministic; no new dependency | static + suites | the keycloak grep above; `git diff <phase-12-context-commit>..HEAD -- apps/backend/package.json apps/csrm/package.json pnpm-lock.yaml` shows no dependency change; the existing release proofs stay green | ✅ | ⬜ pending |

---

## Per-Task Verification Map

Seed rows, one per proposed plan. The planner replaces them with one row per task (`12-NN-MM`), each citing its plan's threat register (`T-12-NN`; every plan also accepts `T-12-SC`, since no package is added). Commands abbreviate `pnpm --filter @csrm/web exec vitest run` as `vitest run`, the Strapi single-file run as `quick run` and `pnpm --filter @csrm/web test:e2e` as `test:e2e`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | INT-06 (record) | T-12-01 | The schema change waits for the approved contract-gap record (G-6) | static + checkpoint | `test -f docs/contract-gaps/phase-12-ai-run-record-and-provenance.md && grep -n "Approved" docs/contract-gaps/phase-12-ai-run-record-and-provenance.md` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | ASSESS-08, INT-05 | T-12-02 | Ratings and the Accept rule are server-owned; the policy fails closed outside development; the transcript flag works only in development | Strapi unit | quick run `risk-scale.unit.test.js`, `ai-data-policy.unit.test.js`, `ai-provider-boot.unit.test.js` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 2 | INT-05, QUES-10 | T-12-03 | Minimisation; the Requestor data block is escaped; bounds fail loudly | Strapi unit | quick run `assessment-context.unit.test.js`, `library-ranking.unit.test.js` | ❌ W0 | ⬜ pending |
| 12-04-01 | 04 | 2 | INT-06 | T-12-04 | Envelopes are closed and fail safe; the decisions log is append-only; legacy rows are null; runs are reconciled at boot | Strapi unit + integration | quick run `ai-run.integration.test.js` plus the envelope unit file; the full Strapi suite | ❌ W0 | ⬜ pending |
| 12-05-01 | 05 | 3 | QUES-10, INT-05 | T-12-05 | No run or call on refusal; help text is bounded; reasons are closed | Strapi unit + integration + web | quick run `ai-provider-questionnaire.unit.test.js`, `questionnaire-generation.integration.test.js`; `vitest run src/lib/api`; `api:check` | ✅ | ⬜ pending |
| 12-06-01 | 06 | 3 | ASSESS-08, INT-06 | T-12-06 | Server-owned ids, ratings, classification and Accept; citations filtered; portable schema | Strapi unit (wire) | quick run `ai-provider-assessment.unit.test.js`, `ai-provider-guardrails.unit.test.js`, `assessment-workflow.unit.test.js` | ✅ | ⬜ pending |
| 12-07-01 | 07 | 4 | ASSESS-08, INT-05, INT-06 | T-12-07 | Pre-fill only from the request's records; readiness gates AI values; edits are attributed | Strapi integration | quick run `assessment-workflow.integration.test.js`, `risk-register.integration.test.js`; the full Strapi suite | ✅ | ⬜ pending |
| 12-08-01 | 08 | 5 | QUES-10, INT-06 | T-12-08 | The Requestor never receives `generation` or `aiOrigin` | Strapi integration + web | quick run `questionnaire-workflow.integration.test.js`; `vitest run src/features/contract-response-parity.test.ts src/features/questionnaires`; `api:check` | ✅ | ⬜ pending |
| 12-09-01 | 09 | 6 | INT-06 | T-12-09 | Provenance is analyst-only; the Requestor gets `aiAssisted` only | Strapi integration + web | quick run `assessment-workflow.integration.test.js`; `vitest run src/features/contract-response-parity.test.ts src/features/assessments`; `api:check` | ✅ | ⬜ pending |
| 12-10-01 | 10 | 7 | INT-05, INT-06, ASSESS-08 | T-12-10 | Human-only operations; record-level checks; no enumeration; deep-equal refusals | Strapi integration + matrix + web | quick run `ai-run.integration.test.js`, `ai-proposal-decisions.integration.test.js`, `authorization-matrix.integration.test.js`, `served-operations.integration.test.js`, `contract-catalogue.integration.test.js`; `vitest run src/features/contract-operation-chain.test.ts src/features/ai-assistance` | ❌ W0 / ✅ | ⬜ pending |
| 12-11-01 | 11 | 8 | INT-05 (G-3 initiator) | T-12-11 | The agent can neither start generation nor create, update or delete requests | Strapi integration + matrix | quick run `authorization-matrix.integration.test.js`, `contract-catalogue.integration.test.js`, `authorization-policy.unit.test.js`; `cmp` of the catalogue copies | ✅ | ⬜ pending |
| 12-12-01 | 12 | 9 | INT-05 (4), UX-06 | T-12-12 | The hub never offers a refused generation | Strapi integration + web | quick run `questionnaire-generation.integration.test.js`; `vitest run src/features/assessments/questionnaire-generation-job.test.tsx src/features/assessments/assessment-review-workflow.test.tsx`; `api:check` | ✅ | ⬜ pending |
| 12-13-01 | 13 | 10 | INT-06 | T-12-13 | No value outside the direction; markers are never colour alone | web unit + static | `vitest run src/features/ai-assistance`; `grep -n "CSRM extension, 2026-" docs/design/csrm-design-direction.md` names the recorded marker and citation extensions | ❌ W0 | ⬜ pending |
| 12-14-01 | 14 | 11 | INT-06, ASSESS-08 | T-12-14 | Optimistic rollback; Requestor view free of AI internals | web unit + E2E | `vitest run src/features/assessments`; `test:e2e e2e/assessment-release-workflow.spec.ts`; `performance.spec.ts` | ✅ | ⬜ pending |
| 12-15-01 | 15 | 12 | QUES-10, INT-06 | T-12-15 | Help text renders as text, never HTML | web unit + E2E | `vitest run src/features/questionnaires`; `test:e2e e2e/questionnaire-generation-workflow.spec.ts e2e/questionnaire-workflow.spec.ts` | ✅ | ⬜ pending |
| 12-16-01 | 16 | 13 | All | T-12-16 | The full gate; no tracked file modified by any run | E2E + full suites | `test:e2e` (both projects); the four full-suite commands; `git status --porcelain` empty; the freeze, `cmp` and keycloak checks | ❌ W0 (new spec) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each file is created by the owning plan's first RED task (the project convention).

- [ ] `apps/backend/tests/risk-scale.unit.test.ts`: the 25 cells, the bands, the overall roll-up and the Accept rule (12-02)
- [ ] `apps/backend/tests/ai-data-policy.unit.test.ts`: environment by ceiling by classification by default; invalid ceiling; transcript gate (12-02)
- [ ] `apps/backend/tests/assessment-context.unit.test.ts`: inclusion, exclusion, escaping, bounds, digest stability, `CONTEXT_TOO_LARGE` (12-03)
- [ ] `apps/backend/tests/library-ranking.unit.test.ts`: determinism, ties, the shortlist size (12-03)
- [ ] `apps/backend/tests/fixtures/ai-wire/`: model-facing UAT-A-like draft bodies (two risks of one type, an Accept on High, an unknown source, an out-of-set control, an unknown system key) and questionnaire bodies (missing "Not sure", Boolean, 5 and 21 questions, blank help text) (12-05, 12-06)
- [ ] `apps/backend/tests/ai-run.integration.test.ts`: the run lifecycle, bootstrap reconciliation, the run read, legacy null provenance (12-04, 12-10)
- [ ] `apps/backend/tests/ai-proposal-decisions.integration.test.ts`: accept, dismiss, restore, idempotence, refusals, readiness and edit transition (12-10)
- [ ] `apps/csrm/src/features/ai-assistance/*.test.ts(x)`: domain, parsers, header, markers, citations, suggestions, disclosure states, Requestor notice, actions (12-10, 12-13)
- [ ] `apps/csrm/e2e/ai-context-provenance.spec.ts`: the UAT-A-like journey at 375 and 1440 (12-16)

No framework install is needed: vitest, `node:test`, Playwright and the fake OpenAI-compatible server already exist.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live model quality on the UAT scenarios: several risks per type where warranted, correct system and asset pre-fill, useful citations, no uncited invention, sensible suggestions, plain-language questions with help text and "Not sure" | ASSESS-08, INT-05, INT-06, QUES-10 | Suites pin the deterministic provider; the dev provider is a hosted API, and running it sends request data off the machine, which is the operator's call | The operator, with the provider they approve: re-run UAT-A, UAT-B and UAT-C (`.planning/uat/product-gaps/JOURNEYS.md`) on a fresh copy of the development database, and compare with the AI job log |
| The production target accepts the portable wire schemas | D-06 | Needs the deployment's Azure OpenAI (or chosen) endpoint | At deployment, run one questionnaire and one draft generation against the configured endpoint in a non-production environment, with a ceiling set, and confirm no `provider_rejected_request` |
| The development database gains `csrm_ai_runs` and the `ai_provenance` columns, and the catalogue changes reach it | D-01, D-33 | The operator's database changes only when the orchestrator restarts Strapi | After the restart: the 06.8-01 PRAGMA check (`PRAGMA table_info(csrm_risks)` includes `ai_provenance`; `csrm_ai_runs` exists), and the matrix's agent outcome observed once |
| The premium bar, at a glance, on real screens | D-36, D-37 | Visual judgement beyond axe and unit tests | The orchestrator's browser checks at 375 and 1440 for the analyst (hub, questionnaire governance, assessment editor, released view) and the Requestor (questionnaire, released assessment) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s at task level
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
