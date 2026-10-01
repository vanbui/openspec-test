---
phase: "17"
slug: "mitigation-response-and-residual-reassessment"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-01"
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source and scope.** Seeded on 2026-10-01 from `17-RESEARCH.md` ("Validation Architecture" and "Plan grouping and wave order"), before any plan exists. It maps every requirement, finding and decision to an automated proof:
- the six requirements: ASSESS-11, ASSESS-12, ASSESS-13, ASSESS-21, ASSESS-22 and ASSESS-23;
- success criterion 5's notification part (NOTIFY-01 itself moved to Phase 19.1, G-19);
- the findings UAT-025 and UAT-026;
- the locked decisions in `17-CONTEXT.md`, as its Orchestrator Confirmations amend them.

**How the maps are filled.**
- **Per-task map:** the rows below are seeded from the research's proposed plans (`17-01` to `17-15`). The planner replaces them with one row per task, taken from each task's `<automated>` verify block, and the plan check verifies them (Dimension 8).
- **Plan numbering:** if the planner merges or splits plans, it records the mapping from the research's numbering here.
- **Markers:** "❌ W0" marks a test file that the owning plan's first RED task creates (the project convention).
- **Status:** every status starts as ⬜ pending.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **Web:** vitest 4.1.11 (jsdom) with Testing Library.<br>**Strapi:** `node:test`, compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, one process and one SQLite database per test file. Provider adapters are tested through `apps/backend/tests/helpers/fake-openai-compatible-server.ts` with model-facing wire bodies.<br>**E2E:** Playwright 1.58.2 with axe, Chromium, on the production build. |
| **Config file** | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` (`desktop` 1440×900; `mobile` 375×812, `@journey` tests only and only the specs in its explicit `testMatch` list; `workers: 1`) |
| **Node** | Prefix every command in Git Bash with `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && pnpm() { /c/ProgramData/nvm/v24.19.0/node /c/ProgramData/nvm/v24.19.0/node_modules/corepack/dist/pnpm.js "$@"; } &&` (Node 24.19.0, pnpm 11.24.0; the default `node` on this host is v22.19.0). |
| **Quick run command** | **Web:** `pnpm --dir apps/csrm exec vitest run <path> [<path> …]`, with paths under `apps/csrm`. Never put a pattern after `--`.<br>**Strapi file** (dev servers stopped): `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js)`.<br>**E2E** (dev servers stopped): `pnpm --dir apps/csrm test:e2e e2e/<spec>.spec.ts [--project desktop\|mobile]`. |
| **Contract commands** | Edit `docs/references/specification.json` by hand, then `pnpm --dir apps/csrm api:generate`, then `pnpm --dir apps/csrm api:check`. After a new or changed route or grant, with the dev servers stopped: `SERVED_OPERATIONS_WRITE=1 pnpm --dir apps/backend served-operations:write`. `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` is silent. |
| **Full suite command** | `pnpm --dir apps/csrm api:check && pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm lint && pnpm --dir apps/csrm test && pnpm --dir apps/backend test` |
| **Phase gate** | The full suite, then `pnpm --dir apps/csrm test:e2e` (both projects, production build), then `git status --short`.<br>**Before:** ports 1337 and 3000 are free; in Git Bash, `netstat -ano \| grep -E ':(1337\|3000) .*LISTENING'` prints nothing.<br>**Afterwards:**<br>- `git status --short` shows only POST-DEMO-BRIEF §2's three operator items (Phase 8 D-12, G-6; a dirty tree is a harness defect);<br>- the content-type freeze check, `git diff --name-only <phase-17-base>..HEAD -- 'apps/backend/src/api/*/content-types/*'`, lists exactly `csrm-assessment/content-types/csrm-assessment/schema.json` and the three new types' `schema.json` files (D-01);<br>- the two catalogue copies are byte-identical (`cmp`);<br>- no Keycloak flag changed: `git diff <phase-17-base>..HEAD -- '*.env*.example'` adds no `CSRM_AUTH_OIDC_ENABLED`, `CSRM_DEV_IDENTITY`, `IDAMBOX_KEYCLOAK_PROVISIONING` or `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION` change. The only Keycloak-file change is the persona's entry in `development-fixture-subjects.ts` and `idambox-realm.json` (D-67). |
| **Estimated runtime** | Under 20 s per web file; 10–90 s per Strapi file, and the authorization matrix 3–5 min (seven callers). The full web suite takes about 25 s, the full Strapi suite about 15–20 min, and the full Playwright suite about 18–25 min (this phase adds two specs, one of them an `@journey` run in both projects). |

**Known infrastructure facts.**
1. **Shared `dist`.** Everything that compiles Strapi shares `apps/backend/dist` and `.tmp/tests-dist`: the Strapi suite, a single Strapi file, `served-operations:write` and Playwright. A dev server running at the same time corrupts `dist` (`playwright.config.ts` header). All of these wait until the orchestrator's servers are stopped.
2. **No live AI.** Every suite runs the deterministic provider with the AI data classification ceiling pinned empty (Phase 12 D-31). The reassessment's hosted adapter is tested only through the fake OpenAI-compatible server.
3. **No Keycloak.** Keycloak is never started. The persona's fixed id is proved by `keycloak-identity.unit.test.ts` ("the fixture ids match the local realm import") reading the realm JSON. The OIDC suites stay green unchanged.
4. **Mobile runs a list.** The `mobile` project's `testMatch` must name `risk-owner-journey.spec.ts` (and the second spec, if `@journey`), or nothing runs at 375px. The verify block fails if the mobile project reports zero tests for a new journey spec.
5. **Jobs are process-local** (R-08-36). No E2E relies on a reassessment job outliving a restart.
6. **Seeds change.** The plan that adds G-11's owner rule changes the seeds that name Bob as a risk owner and the tests and spec that assert it (`risk-register-seed.integration.test.ts`, `risk-register-workflow.spec.ts`). Their failures before that change are expected RED, not regressions.
7. **Windows vitest** can fail with `EPERM: rename`. Rerun that file alone before treating it as a real failure.
8. **The base changes first.** Phases 10 to 16, 19 and 19.1 execute before Phase 17 and change the files this phase edits (the guard, the matrix, the predicate, the notification service, the event log). Re-run the plan check before executing.

---

## Sampling Rate

- **After every task commit:**
  - run the touched web test files by path;
  - run `typecheck` when types change, and `api:check` after any spec change;
  - run the touched Strapi files by path, dev servers stopped;
  - after any catalogue edit, `cmp` the two copies.
- **After every plan wave:**
  - run the full web suite, `typecheck` and `api:check`;
  - run the full Strapi suite after every plan that edits Strapi (17-02 to 17-10), including `authorization-matrix.integration.test.js` with seven callers;
  - run each UI plan's targeted Playwright specs once at its end (17-12, 17-13).
- **Before `/gsd-verify-work`:** the full suite must be green. That is the phase gate above (plan 17-15), recorded with counts, duration, the flaky count, the 375px and 1440px checks for Jane, the risk owner persona, Maya and Bob, and the clean `git status --short`.
- **Max feedback latency:** 90 seconds at task level (the matrix excepted). The production-build E2E runs only at plan level.

---

## Requirement, Finding and Decision Map

Each row names the proof, whether its file exists, and its state. Strapi files are named by their compiled `.js` form for the quick run; web paths are under `apps/csrm`. "quick run" abbreviates the Strapi single-file command, `vitest run` abbreviates `pnpm --dir apps/csrm exec vitest run`, and `test:e2e` abbreviates `pnpm --dir apps/csrm test:e2e`.

| Req / Finding / Decision | Behaviour to verify | Test type | Automated command / proof | File exists? | Status |
|--------------------------|--------------------|-----------|---------------------------|--------------|--------|
| ASSESS-22 · D-22 · D-23 | `participationOf` and its SQL fragments agree for: the Requestor, an owner, both, a former owner, a withdrawn-only owner, before the gate, legacy released, legacy unreleased, an analyst named owner, and Maya | Strapi unit + integration oracle | quick run `assessment-participation.unit.test.js`, `assessment-participation.integration.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-22 (1)(2)(4) · UAT-025 · D-24 · D-25 · D-26 | Detail, risks and control implementations:<br>- participants get 200 with the participant projection at every stage after the gate;<br>- an unconfirmed AI risk is masked as being prepared;<br>- withdrawn risks are absent;<br>- everyone else gets 404 with persistence unchanged (Maya before the gate, during a round, between rounds, after release; a former owner; an owner before the gate) | Strapi integration + matrix | quick run `participant-read.integration.test.js`, `authorization-matrix.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| ASSESS-22 (3) | A participant who is not the Requestor keeps 403 on the request read, 404 on notes and attachments, and 403 by grant on questionnaire and generation routes | Strapi integration + matrix | quick run `authorization-matrix.integration.test.js` (the `riskOwner` column), `participant-read.integration.test.js` | ✅ / ❌ W0 | ⬜ pending |
| ASSESS-22 (5) · D-28 | "My risk assessments" lists every participation with parts, stage, round number and the awaited flag:<br>- the `part`, `stage` and `awaiting` filters, with exact totals;<br>- the rating summary counts released ones only;<br>- analysts see only their own participations | Strapi integration | quick run `participant-read.integration.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-22 (5) · D-29 | The released export and A4 report:<br>- a participant gets 200 after release and 409 `ASSESSMENT_NOT_RELEASED` before;<br>- a non-participant gets 404;<br>- the agent gets 403 | Strapi integration + E2E | quick run of Phase 19's export test file (extended); `test:e2e e2e/response-stage.spec.ts` | ✅ / ❌ W0 | ⬜ pending |
| ASSESS-21 (1) · D-17 · D-19 | Nomination batch:<br>- applied and unchanged counts;<br>- one step for every risk, then one risk;<br>- history rows with source `nomination` and a batch id;<br>- Undo by pairs;<br>- the single path via `PATCH /risks/{id}` validated the same way | Strapi integration | quick run `risk-owner-nomination.integration.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-21 (2)(4) · D-16 · D-20 | Refused as owner:<br>- an inactive user, the service identity → `OWNER_NOT_ELIGIBLE`;<br>- the assigned analyst → `OWNER_IS_ASSIGNED_ANALYST`;<br>- a withdrawn risk → `RISK_WITHDRAWN`;<br>- a foreign risk → 404 for the whole batch.<br>Control and proposed owners are refused the same way | Strapi integration | quick run `risk-owner-nomination.integration.test.js`, `responses.integration.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-21 (4) · D-18 · D-45 | The guard's order (not editable → round open → actor is owner). A named owner holding the analyst role is refused every analyst act, persistence unchanged: edits, nomination, AI enqueue and decisions, round open and close, response decisions, v1 release, assignment actions and the AI-input mark. The assignee eligibility excludes owners, and the reassign/nominate race lets exactly one through | Strapi unit + integration | quick run `assessment-guard.unit.test.js`, `risk-owner-nomination.integration.test.js`, Phase 13's `request-assignment.integration.test.js` (extended) | ❌ W0 / ✅ | ⬜ pending |
| ASSESS-21 (3) · D-21 · D-38 | A proposed owner in a response is decided only by an analyst; accepting it renominates, with history source `response` | Strapi integration | quick run `response-decisions.integration.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-11 (1) · D-09 · D-10 · D-11 | Release-for-response readiness:<br>- the keys and destinations; `RELEASE_FOR_RESPONSE_NOT_READY` with the outstanding keys;<br>- open by the assignee only (`REQUEST_UNASSIGNED`, `NOT_ASSIGNED_ANALYST`);<br>- the gate is written once and never cleared;<br>- one `requested` response per participant; the round limit | Strapi unit + integration | quick run `response-rounds.unit.test.js`, `response-rounds.integration.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-11 (2) · D-12 · D-13 · D-43 · D-44 | While a round is open:<br>- every analyst content mutation is refused `RESPONSE_ROUND_OPEN`;<br>- reads, notes, reassignment and close are allowed;<br>- an AI job completing during the round lapses its items.<br>Closing:<br>- assignee only;<br>- unsubmitted responses become `not-submitted`;<br>- round n+1 opens with undecided items counted | Strapi integration | quick run `response-rounds.integration.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-11 · D-14 · D-41 | v1 release is refused while a round is open, and readiness shows "Responses decided" while items are undecided | Strapi integration | quick run `assessment-workflow.integration.test.js` (extended) | ✅ | ⬜ pending |
| ASSESS-11 · D-15 | From the gate on, unassignment is refused `ASSIGNMENT_REQUIRED`; reassignment passes round control | Strapi integration | Phase 13's `request-assignment.integration.test.js` (extended) | ✅ | ⬜ pending |
| ASSESS-12 (1)(3) · D-31 · D-32 · D-33 · D-35 | Draft save:<br>- partial input is kept;<br>- `RESPONSE_CHANGED` on a stale `expectedSavedAt`;<br>- risks the caller may not respond on → 403 `RESPONSE_NOT_PERMITTED`.<br>Submit:<br>- validates completeness (`RESPONSE_INCOMPLETE`), "Nothing to add" required when empty;<br>- materialises immutable items; `RESPONSE_ALREADY_SUBMITTED`; `RESPONSE_ROUND_NOT_OPEN` after close.<br>Callers:<br>- an analyst who is not a participant → 403 `NOT_A_PARTICIPANT`;<br>- the agent → 403;<br>- Maya → 404 | Strapi unit + integration | quick run `response-drafts.unit.test.js`, `responses.integration.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-12 · D-34 · D-36 | Carry-forward seeds the next round's draft, filtered to permitted risks. Submitted responses are visible to every participant and analyst; drafts only to their author; a former participant's response stays, attributed | Strapi integration | quick run `responses.integration.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-12 (2) · D-38 · D-39 · D-40 · D-42 | Decisions:<br>- accept creates a control implementation (library control required; a reason when values change; effectiveness defaults to Not Assessed; history source `response`);<br>- `CONTROL_ALREADY_ON_RISK`; reject needs a reason;<br>- restore under the Undo rules, else `RESPONSE_DECISION_UNDO_UNAVAILABLE`;<br>- items lapse on withdrawal;<br>- only content-changing batches take the edit transition;<br>- an unknown item is 404 for the whole batch | Strapi integration | quick run `response-decisions.integration.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-13 (1) · UAT-026 · D-48 · D-49 · D-51 | Adapter and deterministic provider:<br>- ratings derived by `risk-scale.ts`;<br>- a score above inherent is dropped with the adjustment;<br>- an uncited rationale is flagged; planned controls are named;<br>- Internet Exposure reassessed to `Unlikely × Major` (Moderate) citing the accepted control;<br>- the prompt holds the data block and the instruction slot, and no names | Strapi unit (wire) | quick run `residual-reassessment.unit.test.js`, `ai-provider-residual.unit.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-13 (2) · D-46 · D-47 · D-50 | Enqueue:<br>- only on an editable assessment with no round open, by a human analyst; an ineligible risk is refused;<br>- the policy is checked at enqueue and execution; single flight per assessment.<br>Run and decisions:<br>- one run per call with `residual-reassessment`;<br>- units confirmed one at a time and "Confirm all"; reject; restore;<br>- stale units refused;<br>- supersession across reassessment and rewrite;<br>- "AI proposals decided" readiness | Strapi integration | quick run `residual-reassessment.integration.test.js` | ❌ W0 | ⬜ pending |
| ASSESS-23 (1)(2) · D-52 · D-53 | Search terms:<br>- a 1-character term → 400; 2 characters are accepted; over 100 → 400; any other key → 400.<br>Results:<br>- at most 20, sorted;<br>- never an inactive user or the service identity;<br>- `documentId` and `displayName` only.<br>Callers:<br>- the agent → 403;<br>- Requestor, analyst and risk owner → 200 | Strapi unit + integration + matrix | quick run `people-search.unit.test.js`, `assessment-workflow.integration.test.js` (updated: the term `a` becomes `al`), `authorization-matrix.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| ASSESS-23 (3) · D-54 | One `csrm.people.search` line per search (actor, UTC time, term, result count, outcome), never a result; refusals logged with their reason | Strapi unit + integration | quick run `people-search.unit.test.js` (injected sink), `security-event-log.unit.test.js` (extended) | ❌ W0 / ✅ | ⬜ pending |
| ASSESS-23 (4) · D-55 | The picker:<br>- sends nothing below two characters and says so;<br>- shows display names only;<br>- applies in the response form and the analyst pickers | web unit | `vitest run src/features/assessments/owner-combobox.test.tsx src/features/responses` | ✅ / ❌ W0 | ⬜ pending |
| SC5 · D-57 (19.1 D-12) | `response-requested` (each participant asked) and `response-submitted` (the assignee):<br>- written in the event's transaction, one per person;<br>- never to the actor, the agent or an inactive user;<br>- readable through the participant predicate, not the released one;<br>- a former owner's disappear;<br>- read by acting (submit) and by reversal (close);<br>- counts equal 19.1's oracle;<br>- `assessment-released` reaches every participant when the gate is open | Strapi integration | quick run of 19.1's notification test file (extended), `responses.integration.test.js` | ✅ / ❌ W0 | ⬜ pending |
| D-05 · D-06 · D-07 · D-08 | Stage (four values). Lifecycle step states (current while open, completed after close, skipped when passed without a round, future otherwise), with one current step. Holder `participants`. Queue buckets against `selectReviewQueueBucket`. The My requests holder SQL and `byHolder.participants` | Strapi unit + integration | quick run `request-lifecycle.unit.test.js`, `request-workflow.integration.test.js`, the 11-10 list test file | ✅ (extended) | ⬜ pending |
| D-01 · D-02 | Four schema files change after the approved records; no core routes for the new types (inventory and matrix); legacy assessments read `not-shared` after boot; the contract chain (spec, `api:generate`, `api:check`, parity and chain guards, served inventory, `cmp`) | static + Strapi integration + web | the freeze check above; quick run `served-operations.integration.test.js`, `contract-catalogue.integration.test.js`; `vitest run src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; `api:check` | ✅ | ⬜ pending |
| D-64 · D-65 · D-75 | The matrix has seven callers on every row:<br>- `riskOwner` gets 200 on the participant variants, 404 on the legacy record and the withdrawn risk, and 403 on every analyst operation;<br>- provenance accepts `identities.riskOwner`;<br>- the human-only rows deny `riskOwner` | Strapi integration + unit | quick run `authorization-matrix.integration.test.js`, `authorization-matrix-provenance.unit.test.js` | ✅ (extended) | ⬜ pending |
| D-67 · D-68 | The persona:<br>- its fixture id matches the realm import;<br>- seeded with no role, and with the fixed `externalSubject` only in development with provisioning off;<br>- offered by the development sign-in with the Requestor capabilities;<br>- the production build contains none of the fixture emails | Strapi unit + integration + web + E2E | quick run `keycloak-identity.unit.test.js`, `risk-owner-persona-seed.integration.test.js`; `vitest run src/lib/auth src/lib/capabilities`; `test:e2e e2e/production-hardening.spec.ts` | ✅ / ❌ W0 | ⬜ pending |
| Pitfall 1 (G-11 versus seeds) | No seed names a Security Analyst as a risk owner on a mutable assessment; the Risk Register journey edits its mutable risk as Bob without `ACTOR_IS_RISK_OWNER` | Strapi integration + E2E | quick run `risk-register-seed.integration.test.js`, `analyst-insights-seed.integration.test.js`; `test:e2e e2e/risk-register-workflow.spec.ts` | ✅ (updated) | ⬜ pending |
| D-69 · D-70 · D-72 | UI:<br>- the participant page by stage;<br>- no response control on another owner's risk;<br>- no response panel for a non-participant analyst;<br>- the not-found page for Maya;<br>- the editing-paused state; the analyst controls withheld with the reason;<br>- confirmations for release for response, submit, and close with outstanding participants;<br>- Undo and rollback; autosave status; skeletons; empty states;<br>- the route budget | web unit + E2E | `vitest run src/features/responses src/features/assessments`; `test:e2e e2e/performance.spec.ts e2e/accessibility.spec.ts` | ❌ W0 / ✅ | ⬜ pending |
| SC6 · D-76 | The journey's first slice at 1440px and 375px on its own records, with the negatives at each step:<br>- Maya: the not-found page and API 404s for the assessment, risks, control implementations, rounds and responses, before and after release for response;<br>- the persona: no control on Jane's risks, and a 403 from the API;<br>- Bob: no response control, and a 403 `NOT_A_PARTICIPANT` from the API.<br>The tree stays clean | E2E | `test:e2e e2e/risk-owner-journey.spec.ts`, then `git status --short` | ❌ W0 | ⬜ pending |
| SC1 to SC4 (tails) | The SC1 refusals (unowned risk, naming the assignee); the two-character search; round 2 with carry-forward; the editing pause; a v1 release followed by the persona's print and export | E2E | `test:e2e e2e/response-stage.spec.ts` | ❌ W0 | ⬜ pending |
| Non-negotiables | Keycloak never started and its four flags unchanged; AI never applies a value or releases; suites deterministic; no new dependency | static + suites | the Keycloak and `.env*.example` checks above; `git diff <phase-17-base>..HEAD -- apps/backend/package.json apps/csrm/package.json pnpm-lock.yaml` shows no dependency change | ✅ | ⬜ pending |

---

## Per-Task Verification Map

Seed rows, one per proposed plan. The planner replaces them with one row per task (`17-NN-MM`), each citing its plan's threat register (`T-17-NN`; every plan also accepts `T-17-SC`, since no package is added).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | ASSESS-11, ASSESS-21, ASSESS-22 (records) | T-17-01 | The schema waits for the approved records (G-6); the pure predicate, derivations, readiness, guard order and draft parser fail closed | static + checkpoint + Strapi unit | `test -f docs/contract-gaps/phase-17-response-rounds.md && test -f docs/contract-gaps/phase-17-participant-read.md`; quick run `assessment-participation.unit.test.js`, `response-rounds.unit.test.js`, `response-drafts.unit.test.js`, `assessment-guard.unit.test.js` | ❌ W0 | ⬜ pending |
| 17-02-01 | 02 | 2 | D-01 | T-17-02 | Additive schema only; no core routes; legacy reads unchanged | static + Strapi integration | the freeze check; quick run `served-operations.integration.test.js`, `participant-read.integration.test.js` (boot case) | ❌ W0 / ✅ | ⬜ pending |
| 17-03-01 | 03 | 2 | D-67, D-68 | T-17-03 | The persona exists only in development; its id is written only with provisioning off; Keycloak files agree; no flag changes | Strapi unit + integration + web | quick run `keycloak-identity.unit.test.js`, `risk-owner-persona-seed.integration.test.js`; `vitest run src/lib/auth src/lib/capabilities src/components/shell/role-switcher.test.tsx` | ✅ / ❌ W0 | ⬜ pending |
| 17-04-01 | 04 | 3 | ASSESS-23 | T-17-04 | Least-privilege directory; agent refused; every search logged without results | Strapi unit + integration + matrix + web | quick run `people-search.unit.test.js`, `assessment-workflow.integration.test.js`, `authorization-matrix.integration.test.js`; `vitest run src/features/assessments/owner-combobox.test.tsx`; `api:check` | ❌ W0 / ✅ | ⬜ pending |
| 17-05-01 | 05 | 4 | ASSESS-21 | T-17-05 | G-11 both ways in Strapi; the lock order prevents the assignee/owner race; seeds stop contradicting G-11 | Strapi integration + E2E | quick run `risk-owner-nomination.integration.test.js`, `request-assignment.integration.test.js`, `risk-register-seed.integration.test.js`; `test:e2e e2e/risk-register-workflow.spec.ts` | ❌ W0 / ✅ | ⬜ pending |
| 17-06-01 | 06 | 5 | ASSESS-22 | T-17-06 | One predicate on every reader; 404 for unreadable records; seven matrix callers; no export widening beyond participants | Strapi integration + matrix + web | quick run `assessment-participation.integration.test.js`, `participant-read.integration.test.js`, `authorization-matrix.integration.test.js`, `authorization-matrix-provenance.unit.test.js`; `vitest run src/features/assessments src/features/contract-response-parity.test.ts`; `api:check` | ❌ W0 / ✅ | ⬜ pending |
| 17-07-01 | 07 | 6 | ASSESS-11 | T-17-07 | Assignee-only round control; the gate is written once; editing pauses; v1 release refused while a round is open | Strapi unit + integration | quick run `response-rounds.integration.test.js`, `assessment-workflow.integration.test.js`, `request-lifecycle.unit.test.js`, `request-workflow.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| 17-08-01 | 08 | 7 | ASSESS-12, SC5 | T-17-08 | Authors write only their own drafts; immutability after submit; agent refused; notifications only to readers | Strapi integration | quick run `responses.integration.test.js` and the 19.1 notification test file | ❌ W0 / ✅ | ⬜ pending |
| 17-09-01 | 09 | 8 | ASSESS-12 (2), ASSESS-21 (3) | T-17-09 | Only analysts apply proposals; reasons recorded; Undo bounded; persistence deep-equal on refusal | Strapi integration | quick run `response-decisions.integration.test.js` | ❌ W0 | ⬜ pending |
| 17-10-01 | 10 | 9 | ASSESS-13 | T-17-10 | Untrusted data block; server-derived ratings; human confirmation per unit; no name in the prompt | Strapi unit (wire) + integration | quick run `residual-reassessment.unit.test.js`, `ai-provider-residual.unit.test.js`, `residual-reassessment.integration.test.js` | ❌ W0 | ⬜ pending |
| 17-11-01 | 11 | 10 | all (web layer) | T-17-11 | Typed API layer only; closed parsers; no client zod | web unit | `vitest run src/features/responses src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; `pnpm --dir apps/csrm typecheck` | ❌ W0 / ✅ | ⬜ pending |
| 17-12-01 | 12 | 11 | ASSESS-11, ASSESS-12, ASSESS-13, ASSESS-21 (UI) | T-17-12 | Hidden controls are also refused by Strapi; withheld controls name the reason | web unit + E2E | `vitest run src/features/assessments src/features/responses`; `test:e2e e2e/assessment-release-workflow.spec.ts e2e/performance.spec.ts` | ❌ W0 / ✅ | ⬜ pending |
| 17-13-01 | 13 | 12 | ASSESS-22 (UI) | T-17-13 | The not-found page for non-participants; actions only in stage and on own risks | web unit + E2E | `vitest run src/features/responses src/features/assessments/released-assessment.test.tsx`; `test:e2e e2e/accessibility.spec.ts e2e/assessment-navigation-lifecycle.spec.ts` | ❌ W0 / ✅ | ⬜ pending |
| 17-14-01 | 14 | 13 | SC6 | T-17-14 | Negatives at every step, in the UI and the API; tree clean | E2E | `test:e2e e2e/risk-owner-journey.spec.ts --project desktop && test:e2e e2e/risk-owner-journey.spec.ts --project mobile && git status --short` | ❌ W0 | ⬜ pending |
| 17-15-01 | 15 | 14 | SC1 to SC5, gate | T-17-15 | Full gate green; glossary updated; clean tree | full suite + E2E | the phase gate above | ❌ W0 / ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/tests/assessment-participation.unit.test.ts` and `assessment-participation.integration.test.ts` (the oracle): ASSESS-22
- [ ] `apps/backend/tests/participant-read.integration.test.ts`: ASSESS-22 routes, lists, export and report
- [ ] `apps/backend/tests/assessment-guard.unit.test.ts` and `risk-owner-nomination.integration.test.ts`: ASSESS-21
- [ ] `apps/backend/tests/response-rounds.unit.test.ts` and `response-rounds.integration.test.ts`: ASSESS-11
- [ ] `apps/backend/tests/response-drafts.unit.test.ts`, `responses.integration.test.ts` and `response-decisions.integration.test.ts`: ASSESS-12
- [ ] `apps/backend/tests/residual-reassessment.unit.test.ts`, `ai-provider-residual.unit.test.ts`, `residual-reassessment.integration.test.ts`, and wire fixtures under `apps/backend/tests/fixtures/ai-wire/`: ASSESS-13
- [ ] `apps/backend/tests/people-search.unit.test.ts`: ASSESS-23
- [ ] `apps/backend/tests/risk-owner-persona-seed.integration.test.ts`: D-67
- [ ] Harness (`apps/backend/tests/helpers/strapi-http-harness.ts`): the identity `risk-owner` (`identities.riskOwner`, `users.riskOwner`), `seedParticipantFixtures()`, and fixture helpers to open and close rounds and submit responses
- [ ] Matrix: `MatrixActor`, `MATRIX_ACTORS`, `MatrixExpectation`, `callerOf`, the helpers and `matrix-provenance.ts` gain `riskOwner`
- [ ] Web: `apps/csrm/src/features/responses/*.test.ts(x)`
- [ ] E2E: `apps/csrm/e2e/risk-owner-journey.spec.ts`, `apps/csrm/e2e/response-stage.spec.ts`, `apps/csrm/e2e/helpers/strapi-api.ts` and `apps/csrm/e2e/helpers/journey-guards.ts`, with both specs in the `mobile` project's `testMatch`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A local Keycloak sign-in as the risk owner persona walks the participant flow | D-67 | Keycloak is never started in this programme (POST-DEMO-BRIEF §2). The automated proof is the realm-import unit test | Operator only, later: `docker compose down -v` in `idp/`, start Keycloak, sign in as `riley.chen` (password from the realm import), open "My risk assessments" |
| The operator's development database shows the new tables and the persona | D-01, D-68 | Changes reach it only when the orchestrator restarts Strapi | After the restart, run 06.8-01's PRAGMA check for `csrm_assessment_rounds`, `csrm_round_responses`, `csrm_response_items` and the gate columns; sign in as the persona with the development identity |
| The hosted model's residual write-up reads well on a UAT-A re-run | ASSESS-13 | No live model runs in any suite (Phase 12 D-31) | The operator re-runs "Reassess residual risk" on UAT-A with the hosted provider and reviews citations and wording |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s (the authorization matrix and E2E excepted, run at plan level)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
