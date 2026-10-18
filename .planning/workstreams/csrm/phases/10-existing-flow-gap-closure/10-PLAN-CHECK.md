## ISSUES FOUND

**Phase:** 10 - Existing-flow gap closure
**Plans checked:** 22 (10-01 to 10-22): 60 tasks in 20 waves
**Issues:** 1 blocker, 7 warnings, 5 info
**Checked:** 2026-09-27, in the gsd-plan-checker role (GSD Core 1.15.0), read-only on `uat-trial` at `a693fe5`

**Summary.** The plan set is well grounded:
- Every requirement (7), finding (23) and locked decision (40) is claimed by at least one plan.
- Every file and line reference I spot-checked matches the code (about 60 checked; see "References spot-checked" below).
- The one new route goes through the whole contract chain.
- Every UI-SPEC §19 test row changes in the plan that changes its copy.
- No two plans that share a file run in the same wave.

Execution should wait for one orchestrator decision (Blocker 1). The warnings can be fixed without restructuring the plans.

### Blockers: these properties must hold ("must fix" is the property, never the example)

**1. [context_compliance / scope_reduction] No plan departs from a locked decision, or writes an unaccepted extension into the binding design direction, without the orchestrator's recorded acceptance**
- **Plans:** 10-01 (Task 1), 10-04 (Task 3), 10-15 (Task 1), 10-17 (Tasks 1-2) and 10-21 (Task 2). The label rule is then consumed by 10-18 and 10-19.
- **D-36 (theme):**
  - D-36 is locked: untitled controls show "the framework instead, and the theme where the catalogue has one".
  - 10-15 and 10-17 label them `{number} · {framework}` only, marked "Provisional readings (orchestrator to confirm)".
  - The theme exists only in the control's unprojected `sourceData`. I checked: `administration-config.ts` projects no theme, and `seed-csrm-data.ts` stores the catalogue entry under `sourceData`.
  - Serving the theme would be an eighth API change, which D-03 ("these seven, and no others") excludes.
  - The two locked decisions conflict, so only a recorded decision can settle it. This is also research Open Question 3.
- **D-38 (em dash):**
  - D-38 is locked: "a spaced hyphen instead of an em dash".
  - 10-01 records X-4 (a spaced middle dot joins an identifier to a name). 10-04 and 10-15 then write `{requestNumber} · {title}` and `APP-11 · …` where today's copy uses an em dash.
  - This is a defensible reading, but it differs from the decision's text, and the plans mark it provisional.
- **Design direction extensions:**
  - The UI-SPEC is approved "pending the orchestrator's acceptance of X-1 to X-5 and of the readings flagged in Notes carried".
  - Yet 10-01 Task 1's first commit writes X-1 to X-5 into `docs/design/csrm-design-direction.md`. `AGENTS.md` makes that file the only source of UI values.
- **Other provisional items:**
  - 10-17 sentence-cases all 13 APP titles and trims nine `legalText` values (UI-D22). This goes wider than D-36's "nine truncated titles are corrected".
  - 10-21 adds a Risk detail safe-state header that the UI-SPEC does not list.
- **No acceptance is recorded** in STATE.md, CONTEXT.md or the plans.
- **Example fix (non-binding; any route that reaches the property counts):**
  - Before 10-01 executes, the orchestrator records its decision on X-1 to X-5 and on the four readings: the D-36 theme, the X-4 middle dot, the APP sentence case with the `legalText` trim, and the Risk detail header. A dated amendment to D-36 and D-38 in CONTEXT.md, or an entry in STATE.md Decisions, would do.
  - Any reading it rejects is then revised in 10-01, 10-04, 10-15, 10-17 or 10-21.

### Warnings: these properties should hold

**1. [context_compliance] An autosave response does not re-render the questionnaire page being edited (D-11 revalidation clause, research Pitfall 8)**
- **Plan:** 10-08, Task 1.
- **What the plan does:** `autosaveQuestionnaireDraftAction` "revalidates only `/app` and `/app/questionnaires`".
- **What Next 16.3.6 does with that:**
  - `revalidatePath` on any path marks the action as revalidated. See `node_modules/next/dist/server/web/spec-extension/revalidate.js:221`: "TODO: only revalidate if the path matches".
  - A revalidated action renders the current page into its response (`server/app-render/action-handler.js:990`).
- **Effect:**
  - Every autosave re-renders `/app/questionnaires/{id}` on the server: the questionnaire and question reads, the timeline and the metadata. That happens about every 1.5 seconds while the Requestor types.
  - D-11 and Pitfall 8 exist to prevent exactly this.
  - The planned unit test and the acceptance grep only check which paths are named, so neither can catch it.
  - The list revalidation also gains nothing, because the app layout is `force-dynamic`.
- **Why a warning, not a blocker:** typed answers are not lost. The renderer re-seeds only when `mode` changes (`questionnaire-renderer.tsx:245-250`).
- **Example fix (non-binding):** the autosave variant calls no `revalidatePath` (Pitfall 8's first option), and `questionnaire-actions.test.ts` asserts that.

**2. [ui_contract] A blocked navigation from the mobile navigation sheet leaves the sheet open and returns focus to the activated link (UI-SPEC §6.3)**
- **Plan:** 10-08, Task 2.
- **Evidence:**
  - Task 2 keeps `CapabilityNavigation`'s existing `onClick`, which is `closeNavigation`: it closes the sheet and schedules focus back to the Menu button.
  - Next's `Link` calls `onClick` (`client/app-dir/link.js:328`) before `linkClicked` runs `onNavigate` (`:339`, then `:71`).
  - So the sheet has already closed by the time the guard blocks.
  - UI-SPEC §6.3 requires that "in the mobile sheet, the sheet stays open", with focus returning to the activated link.
  - The plan's behaviour covers only the fallback (the page heading), and no test renders `MobileNavigation` with a blocking guard.
- **Example fix (non-binding):** close the sheet from the guard once navigation is allowed, not from `onClick`; add a blocked `MobileNavigation` case to `navigation-guard.test.tsx`.

**3. [verification] Every phase-gate check can pass on a correct tree, and browser must-haves are not reported met without a browser walk**
- **Plan:** 10-22, Tasks 1 and 2.
- **Evidence:**
  - **(a)** The static check `git diff 98fe99c..HEAD | grep -n "^[+-].*CSRM_AI_"` already prints 19 lines (measured today). The Phase 10 planning files committed after `98fe99c` mention `CSRM_AI_*`, so "prints nothing" can never hold.
  - **(b)** Task 1's `<automated>` ends with `test -z "$(git status --porcelain)"`. But Task 1 writes `10-22-SUMMARY.md`, and only Task 2 commits it.
  - **(c)** Task 2 needs you to restart the dev servers in the middle of an `autonomous: true` plan. Its verify only greps the summary for `375` and `1440`, so a summary that says the walk is pending also passes. Must-haves 3 and 4 can then be reported met without any browser walk.
  - **(d)** Task 1 is `type="tracer"`. In auto mode, the executor's tracer feedback gate re-runs its roughly 30-minute five-command verify before Task 2.
- **Example fix (non-binding):**
  - exclude `.planning/` from the `CSRM_AI_` check;
  - stage or commit the summary before the clean-tree check;
  - make the restart a checkpoint or a `<precondition>`, and make Task 2's verify fail while the browser table is pending;
  - type Task 1 `auto`.

**4. [requirement_coverage] Each phase requirement is delivered in full at the gate, or its undelivered criterion is recorded against a named later owner**
- **Plans:** 10-16, 10-17 and 10-22.
- **Evidence:**
  - ADMIN-05 criterion 1 ("system and asset owners show by name") loses its asset half (D-01, D-37).
  - ADMIN-05 criterion 2 ("controls carry meaningful names") leaves 386 untitled controls as number plus framework until operator decision 15 (D-36): ISO 93, CPS 230 51, CPS 234 24 and PSPF 218.
  - Both deferrals are locked, but no plan records the leftover work in REQUIREMENTS.md or ROADMAP.md or gives it an owner. CONTEXT only says the asset owner is "a candidate for Phase 20 or 22".
  - Meanwhile 10-22 lists ADMIN-05 among the requirements it closes, so the requirement cannot close at verify-work.
  - UX-06 criterion 4's dashboard and report copy is likewise sent to Phase 11 only by CONTEXT.
- **Example fix (non-binding):** 10-22, or you, mark ADMIN-05 as partial in REQUIREMENTS.md and give the leftovers owners: the asset owner to a contract-gap record and a Phase 20 or 22 criterion, the titles to decision 15.

**5. [scope_sanity] Each plan and task stays within the per-plan context budget**
- **Plans:** all except 10-03 and 10-22; the worst are 10-13, 10-15 and 10-18.
- **Evidence:**
  - `estimate-check --calibrated` puts 20 of 22 plans over the 100,000-token budget, at 1.1x to 2.3x:
    - 10-13, 10-15 and 10-18 are estimated at 230,000 tokens;
    - 10-06 is at 2.2x;
    - 10-09 and 10-19 are at 2.1x.
  - Confidence is low: there are no calibrated samples yet.
  - 11 plans list 15 or more files (10-13: 22; 10-18: 21; 10-02 and 10-15: 20).
  - 11 tasks each touch 10 or more files.
  - 10-18 Task 1 touches 16 files. In one tracer task it:
    - builds the new `RelationPicker`;
    - changes a Strapi projection, the spec and two parsers;
    - rewires the editor.
  - 10-15 Task 2 touches 15 files.
- **Why a warning, not a blocker:** Phases 07 and 08 executed plans of 18 to 30 files with this executor. D-02 also keeps each server change and its client parser in one plan, so any split has to stay inside the plan.
- **Example fix (non-binding):**
  - in 10-18, build and test `RelationPicker` as its own task before the contract-and-editor task;
  - in 10-15, separate the projection, spec and parser change from rendering `ReleasedRiskDetails` on both surfaces.

**6. [nyquist_compliance, check 8b] Task-level automated verification stays within the VALIDATION.md feedback ceiling**
- **Plans:** 10-01, 10-03, 10-06, 10-08, 10-10, 10-11, 10-13, 10-15, 10-16, 10-17, 10-18 and 10-22.
- **Evidence:**
  - VALIDATION.md says: "Max feedback latency: 90 seconds at task level. The production-build E2E runs only at plan level."
  - Four task verifies run the full Playwright suite, about 15 minutes each: 10-01 T3, 10-03 T2, 10-08 T3 and 10-22 T1.
  - Nine run the full Strapi suite, 9 to 13 minutes each: 10-06 T3, 10-10 T2, 10-11 T3, 10-13 T3, 10-15 T3, 10-16 T2, 10-17 T3, 10-18 T3 and 10-22 T1.
  - 18 plans put a production-build Playwright run inside a task verify.
- **Example fix (non-binding):** move these runs into each plan's `<verification>`, or record in VALIDATION.md that each plan's last task is its plan-level gate and that the latency is accepted.

**7. [research_resolution] RESEARCH.md carries no unresolved open question**
- **File:** `10-RESEARCH.md:1216`.
- **Evidence:**
  - The `## Open Questions` heading has no `(RESOLVED)` suffix, and the items carry no resolution markers.
  - Five of the six are in fact settled elsewhere:
    - Q1 in 10-18 (`maxItems: 1000`);
    - Q2 in 10-19;
    - Q4 by the approved UI-SPEC;
    - Q5 in 10-14;
    - Q6 by scope (out of Phase 10).
  - Q3, the ISO theme, is still open and is part of Blocker 1.
- **Example fix (non-binding):** once Blocker 1 is decided, mark the section resolved, with each answer and the plan that carries it.

### Advisories (info)

**1. [dependency_correctness, check 3b] Ordering between same-wave plans is declared, not implied**
- **Plans:** 10-01 and 10-02 (wave 1); 10-03 and 10-04 (wave 2).
- **Shared test harness:**
  - `.planning/config.json` sets `parallelization: true` and `use_worktrees: false`.
  - Every plan in these two waves runs Playwright; 10-01 and 10-03 run the full suite.
  - The E2E harness uses one port pair, one SQLite file, one isolated Next build and the shared `apps/backend/dist` (`playwright.config.ts:14-38`). Two concurrent runs would collide.
- **Wave 1 file coupling:**
  - 10-01 Task 1 runs `server-only-boundary.test.ts` while 10-02 Task 1 edits its gate list.
  - 10-02's copy guard reads `revert-audit-summary.tsx` and `questionnaire-revision-timeline.tsx`, which 10-01 edits.
- **Example fix (non-binding):** run these two waves one plan at a time, as research's "Plan grouping and wave order" assumes, or declare the edges.

**2. [verification] `api:check` is run where it can pass**
- **Plans:** 10-06, 10-10, 10-11, 10-13, 10-15, 10-16 and 10-18.
- **Evidence:**
  - `api:check` runs `api:generate && git diff --exit-code -- src/lib/api/generated/schema.d.ts` (`apps/csrm/package.json:13`). That compares the regenerated file against the git index.
  - Each contract task runs it before the task's commit, so it fails until the regenerated file is staged.
- **Example fix (non-binding):** stage the spec and the regenerated `schema.d.ts` before running the verify.

**3. [D-39] Existing assertions that a plan's change breaks are named in that plan**
- **Plans:** 10-02, 10-09 and 10-14.
- **The assertions:**
  - `questionnaire-workflow.test.tsx:558` expects the analyst questionnaire page to contain `can('assessment:review', granted)`. 10-02 makes `analystRequestHref` reuse the new gate instead.
  - `questionnaire-workflow.test.tsx:547` expects `getQuestionnaireQuestions`. 10-09 switches the page to `getQuestionnaireGovernanceQuestions`.
  - `questionnaire-generation-workflow.spec.ts:140-141` expects "Questionnaire generation is ready for review" after the replacement.
    - 10-14 inserts a "navigate away and back" step right after the replacement is confirmed.
    - A completed job is not seeded (D-26), so that text will not reappear.
  - `assessment-review-workflow.test.tsx:413` asserts the draft card's queued text, which 10-14 rewrites.
- **Why only info:** each file is already in its plan's `files_modified` and verify, so each failure surfaces within the plan. Naming them keeps an executor from loosening them.

**4. [nyquist] UAT-041's only browser proof may never observe a running job**
- **Plan:** 10-14, Task 1.
- **Evidence:**
  - `UX06_JOB_STATUS_ON_RETURN` tolerates the job completing before the page loads.
  - Deterministic jobs finish in 1 to 2 seconds, so the step can pass without ever showing a queued or running card.
  - The running state is proven only by the unit tests and the mounted Strapi tests.
- **Status:** accepted by research Open Question 5. The plan's summary records which case the run observed.

**5. [verification] Budgeted routes are re-measured by the plan that changes them**
- **Plans:** 10-18 and 10-19.
- **Evidence:**
  - Both add client JavaScript (`RelationPicker`) to `/app/review/assessments/{documentId}` and `/app/risks/{documentId}`.
  - `performance.spec.ts` budgets both routes, but neither plan runs it, so a breach would first appear in 10-22's gate.
- **Example fix (non-binding):** add `e2e/performance.spec.ts` to their journey runs.

### Structured Issues

```yaml
issues:
  - plans: ["10-01", "10-04", "10-15", "10-17", "10-21"]
    dimension: context_compliance
    severity: blocker
    required_property: "No plan departs from a locked CONTEXT decision, or writes an unaccepted extension into the binding design direction, without the orchestrator's recorded acceptance"
    description: "D-36 (locked) requires the theme for untitled controls; 10-15/10-17 omit it as a provisional reading because serving it would be an eighth API change that D-03 excludes. D-38 (locked) says spaced hyphen; 10-01 records X-4 (middle dot) and 10-04/10-15 use it for identifier joins. The UI-SPEC approval is pending acceptance of X-1..X-5 and the flagged readings, yet 10-01 Task 1 writes X-1..X-5 into docs/design/csrm-design-direction.md. 10-17's sentence-casing of all 13 APP titles with the legalText trim (UI-D22), and 10-21's safe-state header, are also provisional. No acceptance is recorded in STATE.md or CONTEXT.md."
    task: "10-01 T1; 10-04 T3; 10-15 T1; 10-17 T1-T2; 10-21 T2"
    fix_hint: "Record the orchestrator's decision on X-1..X-5 and the four readings (dated CONTEXT amendment or STATE.md Decisions) before 10-01 runs; revise any rejected reading in the named plans."
  - plan: "10-08"
    dimension: context_compliance
    severity: warning
    required_property: "An autosave response does not re-render the questionnaire page being edited (D-11, research Pitfall 8)"
    description: "The autosave action revalidates /app and /app/questionnaires. In Next 16.3.6, any revalidatePath marks the action revalidated (revalidate.js:221, 'TODO: only revalidate if the path matches'), and the action response renders the current page (action-handler.js:990). So every autosave re-renders /app/questionnaires/{id}. The unit test and the acceptance grep cannot detect this."
    task: 1
    fix_hint: "Have the autosave variant call no revalidatePath and assert that in questionnaire-actions.test.ts."
  - plan: "10-08"
    dimension: key_links_planned
    severity: warning
    required_property: "A blocked navigation from the mobile navigation sheet leaves the sheet open and returns focus to the activated link (UI-SPEC §6.3)"
    description: "Task 2 keeps CapabilityNavigation's onClick (closeNavigation). Next's Link runs onClick (link.js:328) before onNavigate (link.js:339, then :71), so the sheet closes before the guard blocks. No test covers MobileNavigation with a blocking guard."
    task: 2
    fix_hint: "Close the sheet from the guard's allow path rather than onClick; add a blocked MobileNavigation test."
  - plan: "10-22"
    dimension: verification_derivation
    severity: warning
    required_property: "Every phase-gate check can pass on a correct tree, and browser must-haves are not reported met without a browser walk"
    description: "The CSRM_AI_ diff check already prints 19 lines from planning docs (measured). Task 1's verify requires a clean tree while its summary is uncommitted. Task 2 depends on an orchestrator restart inside an autonomous plan, and its grep verify passes when the walk is pending. Task 1 is a tracer, so its ~30-minute gate re-runs in auto mode."
    task: "1-2"
    fix_hint: "Exclude .planning/ from the CSRM_AI_ check; stage or commit the summary before the clean-tree check; make the restart a checkpoint or precondition and fail Task 2 while pending; type Task 1 auto."
  - plans: ["10-16", "10-17", "10-22"]
    dimension: requirement_coverage
    severity: warning
    required_property: "Each phase requirement is delivered in full at the gate, or its undelivered criterion is recorded against a named later owner"
    description: "ADMIN-05 criterion 1 (asset owner) and criterion 2 (meaningful names for 386 untitled controls) are deferred by locked decisions D-01, D-36 and D-37. The leftover work is not recorded in REQUIREMENTS.md or ROADMAP.md, yet 10-22 claims ADMIN-05. UX-06 criterion 4's dashboard copy is left to Phase 11 by CONTEXT only."
    fix_hint: "Mark ADMIN-05 partial in REQUIREMENTS.md and name owners for the leftovers: the asset owner to a contract-gap record plus Phase 20 or 22; the titles to decision 15."
  - plans: ["10-13", "10-15", "10-18"]
    dimension: scope_sanity
    severity: warning
    required_property: "Each plan and task stays within the per-plan context budget"
    description: "20 of 22 plans exceed the 100k smart-zone estimate (1.1x-2.3x; confidence low, 0 samples). 11 plans list 15 or more files (max 22) and 11 tasks touch 10 or more files (max 16: 10-18 T1)."
    metrics: { plans_over_budget: 20, plans_15_plus_files: 11, tasks_10_plus_files: 11 }
    fix_hint: "Split 10-18 T1 (RelationPicker first) and 10-15 T2 (contract versus rendering) within their plans."
  - plans: ["10-01", "10-03", "10-06", "10-08", "10-10", "10-11", "10-13", "10-15", "10-16", "10-17", "10-18", "10-22"]
    dimension: nyquist_compliance
    severity: warning
    required_property: "Task-level automated verification stays within the VALIDATION.md 90-second ceiling"
    description: "4 task verifies run the full Playwright suite and 9 run the full Strapi suite. VALIDATION.md caps task-level latency at 90 s and places production-build E2E at plan level."
    fix_hint: "Move full-suite runs into <verification>, or record in VALIDATION.md that each plan's last task is its plan-level gate."
  - plan: null
    file: "10-RESEARCH.md"
    dimension: research_resolution
    severity: warning
    required_property: "RESEARCH.md carries no unresolved open question"
    description: "'## Open Questions' (line 1216) has no RESOLVED markers. Q1, Q2, Q4, Q5 and Q6 are resolved in 10-18, 10-19, the UI-SPEC, 10-14 and scope; Q3 is Blocker 1."
    fix_hint: "Mark the section resolved with each answer and its plan once Blocker 1 is decided."
  - plans: ["10-01", "10-02", "10-03", "10-04"]
    dimension: dependency_correctness
    severity: info
    required_property: "Ordering between same-wave plans is declared, not implied"
    description: "config.json has parallelization: true and use_worktrees: false. Both plans in waves 1 and 2 run Playwright against one E2E port pair, SQLite file, Next build and apps/backend/dist. 10-01 T1 runs server-only-boundary.test.ts while 10-02 T1 edits it."
    fix_hint: "Run waves 1 and 2 one plan at a time, or declare the edges."
  - plans: ["10-06", "10-10", "10-11", "10-13", "10-15", "10-16", "10-18"]
    dimension: verify_command_format
    severity: info
    required_property: "api:check is run where it can pass"
    description: "api:check diffs the regenerated schema.d.ts against the git index, and the tasks run it before committing."
    fix_hint: "Stage the spec and the regenerated schema.d.ts before the verify."
  - plans: ["10-02", "10-09", "10-14"]
    dimension: context_compliance
    severity: info
    required_property: "Existing assertions that a plan's change breaks are named in that plan (D-39)"
    description: "questionnaire-workflow.test.tsx:558 and :547, questionnaire-generation-workflow.spec.ts:140-141 and assessment-review-workflow.test.tsx:413 will fail under the planned changes but are not named. Each is already in the plan's files and verify."
    fix_hint: "Name each assertion and its new expectation in the plan."
  - plan: "10-14"
    dimension: nyquist_compliance
    severity: info
    required_property: "The browser proof of UAT-041 observes a queued or running job"
    description: "UX06_JOB_STATUS_ON_RETURN tolerates completion. Deterministic jobs finish in 1-2 s, so the step may never see a running card; unit and mounted tests carry that proof (research Open Question 5)."
    task: 1
    fix_hint: "Accepted as designed; keep the summary note on which case the run observed."
  - plans: ["10-18", "10-19"]
    dimension: verification_derivation
    severity: info
    required_property: "Budgeted routes are re-measured by the plan that changes them"
    description: "RelationPicker adds client JS to /app/review/assessments/{documentId} and /app/risks/{documentId}, which performance.spec.ts budgets; neither plan runs that spec."
    fix_hint: "Add e2e/performance.spec.ts to their journey runs."
```

### Recommendation

**1 blocker and 7 warnings require revision. Returning to the planner with this feedback.**
- **Blocker 1** needs your decision rather than a replan. Once it is recorded, the plans stand as written unless a reading is rejected.
- **Warnings 1 to 4** are small edits to 10-08 and 10-22, plus one traceability note.
- **Warnings 5 and 6** can also be closed by recording acceptance instead of restructuring.

### Coverage

| Requirement | Plans | Status |
|---|---|---|
| REQ-07 | 10-04 | Covered: both acceptance criteria (UAT-015, UAT-037) |
| QUES-08 | 10-06, 10-07, 10-09, 10-10, 10-11, 10-12 | Covered; adding a question to a questionnaire from the hosted AI provider stays a manual check (VALIDATION) |
| QUES-09 | 10-03, 10-05, 10-08 | Covered (Warnings 1 and 2 concern how, not whether) |
| ASSESS-06 | 10-18, 10-19, 10-20, 10-21 | Covered |
| ASSESS-07 | 10-15 | Covered |
| ADMIN-05 | 10-15, 10-16, 10-17 | Partial by locked deferral (Warning 4) |
| UX-06 | 10-01, 10-02, 10-04 to 10-07, 10-09, 10-10, 10-12 to 10-15, 10-17 to 10-19, 10-21 | Covered on Phase 10 surfaces |

| ROADMAP success criterion | Delivered by |
|---|---|
| 1. Add to a new and an existing section of a generated questionnaire; the form opens in place, with focus | 10-09 (placement, forms), with 10-06 and 10-07 for the clash reason |
| 2. Analyst sees the third-party and regulatory fields; actions refresh after return to draft | 10-04 |
| 3. Autosave or leave warning; radio arrow keys | 10-08, 10-03 |
| 4. Pickers search as you type; date input; save confirmation | 10-18, 10-19, 10-20 |
| 5. Released view names controls, treatment, owners and dates | 10-15 |
| 6. Refusals hidden or truthful; local times and question text | Refusals: 10-02, 10-04, 10-05, 10-06, 10-07, 10-09, 10-12. Timelines: 10-01, 10-10 |

**Findings:** all 23 are claimed in `closes`, and 10-22 claims all of them.

| Finding | Plans |
|---|---|
| UAT-005 | 10-09 |
| UAT-006 | 10-18, 10-19 |
| UAT-007 | 10-15, 10-17 |
| UAT-009 | 10-20 |
| UAT-010 | 10-19 |
| UAT-011 | 10-21 |
| UAT-015 | 10-04 |
| UAT-016 | 10-06, 10-09 |
| UAT-019 | 10-11, 10-12 |
| UAT-020 | 10-09 |
| UAT-021 | 10-08 |
| UAT-022 | 10-04, 10-05 |
| UAT-023 | 10-05 |
| UAT-024 | 10-01, 10-04, 10-05, 10-09, 10-10, 10-15 |
| UAT-033 | 10-15 |
| UAT-034 | 10-20 |
| UAT-036 | 10-04 to 10-07, 10-09, 10-12 |
| UAT-037 | 10-04 |
| UAT-041 | 10-13, 10-14 |
| UAT-053 | 10-16 |
| UAT-054 | 10-02, 10-04, 10-14, 10-15, 10-17, 10-18, 10-19, 10-21 |
| UAT-062 | 10-02 |
| UAT-064 | 10-03 |

**Decisions:**
- All of D-01 to D-40 are cited and implemented.
- D-36 and D-38 are the subject of Blocker 1.
- D-11's revalidation clause is Warning 1.
- No deferred idea is planned. Section rename, help text, column choice, by-id job access, asset owner, licensed titles and the dashboard copy all stay out.

### Plan summary

| Plan | Wave | Depends on | Tasks | Files | Estimate (x budget) | Strapi | Playwright |
|---|---|---|---|---|---|---|---|
| 10-01 | 1 | - | 3 | 15 | 150k (1.5) | - | governance spec, then the full suite |
| 10-02 | 1 | - | 3 | 20 | 140k (1.4) | - | 2 journeys |
| 10-03 | 2 | 02 | 2 | 4 | 70k (0.7) | - | full suite |
| 10-04 | 2 | 01, 02 | 3 | 15 | 160k (1.6) | - | 2 journeys |
| 10-05 | 3 | 01-04 | 3 | 15 | 170k (1.7) | - | 3 journeys |
| 10-06 | 4 | 05 | 3 | 18 | 220k (2.2) | suite | - |
| 10-07 | 5 | 06 | 2 | 9 | 110k (1.1) | - | - |
| 10-08 | 6 | 01, 05, 07 | 3 | 18 | 200k (2.0) | - | full suite |
| 10-09 | 7 | 05-08 | 3 | 14 | 210k (2.1) | one test file | 3 journeys |
| 10-10 | 8 | 06, 09 | 2 | 12 | 170k (1.7) | suite | 1 journey |
| 10-11 | 9 | 06, 10 | 3 | 13 | 180k (1.8) | suite | - |
| 10-12 | 10 | 04, 07, 09, 11 | 2 | 7 | 110k (1.1) | - | 1 journey |
| 10-13 | 11 | 11, 12 | 3 | 22 | 230k (2.3) | suite, matrix, served-operations | - |
| 10-14 | 12 | 12, 13 | 3 | 9 | 150k (1.5) | - | 1 journey |
| 10-15 | 13 | 02, 05, 13, 14 | 3 | 20 | 230k (2.3) | suite | 1 journey |
| 10-16 | 14 | 02, 15 | 2 | 9 | 110k (1.1) | suite | 1 journey |
| 10-17 | 15 | 15, 16 | 3 | 16 | 190k (1.9) | suite | 1 journey |
| 10-18 | 16 | 15, 16, 17 | 3 | 21 | 230k (2.3) | suite | 2 journeys |
| 10-19 | 17 | 15, 18 | 3 | 10 | 210k (2.1) | - | 1 journey |
| 10-20 | 18 | 01, 08, 18, 19 | 3 | 15 | 190k (1.9) | - | 1 journey |
| 10-21 | 19 | 02, 20 | 3 | 10 | 150k (1.5) | - | 1 journey |
| 10-22 | 20 | all | 2 | 1 | 90k (0.9) | gate | full suite, then browser walk |

The dependency graph is acyclic and each wave is the maximum of its dependencies' waves plus one. No plan references another plan's output before it exists. From wave 3 onward each wave holds one plan, and each depends on the one before it.

### Dimension results

| Dimension | Result |
|---|---|
| 1 Requirement coverage | Pass, with Warning 4 (ADMIN-05 partial) |
| 2 Task completeness | Pass: 60/60 tasks have files, action, verify, done, `read_first` and `acceptance_criteria`; `verify.plan-structure` is valid for all 22 plans; no code fences |
| 3 Dependency correctness | Pass |
| 3b Undeclared same-wave ordering | Info 1 |
| 4 Key links | Pass; every must_haves key link is carried by a task action |
| 5 Scope | Warning 5 |
| 6 must_haves derivation | Pass; the contract-plan truths are implementation-shaped but tied to observable proofs |
| 7 Context compliance | Blocker 1; Warning 1 |
| 7b Scope reduction | Blocker 1 (D-36 theme) |
| 7c Architectural tier | Pass: presentation gates in the web, rules and facts in Strapi, placement validated by the Strapi definition parser |
| 8 Nyquist | 8a pass (60/60 automated); 8b Warning 6; 8c pass; 8d pass (no `MISSING` placeholders; every new test file is created by the step that first runs it); 8e pass (VALIDATION.md has 60 per-task rows whose waves match the plans); 8f pass (probe: 60/60 failing directions stated, none vacuous) |
| 9 Cross-plan data contracts | Pass: every change to a shared shape is serialised (the governance log, `TransportError.reason`, `controlSummary`, `applicableControls`, the risk list items, `SaveStatus`, `LocalInstant`) |
| 10 Project instructions | Pass. `AGENTS.md` and `apps/csrm/AGENTS.md` were applied: typed layer only, server-side authorization, semantic tokens, zod kept out of client modules, no new dependency, tests with every workflow |
| 11 Research resolution | Fails on the marker; Warning 7 |
| 12 Pattern compliance | Pass: plans cite the PATTERNS.md analogs; the rejected sign-in sync is justified in 10-01 |
| Verify command format | Pass, except the 10-22 static check (Warning 3) |
| Verify command paths | Pass (see the note below) |

**How the verify commands were checked.**
- The prompt did not include the two step-10 probe results, so I ran both probes as that step does: `check verify-command-paths 10` and `check verify-failure-directions 10`.
- Each covered 60 commands and found 0 blockers and 0 warnings.
- 48 commands use `pnpm --filter`, which the path probe does not parse. I resolved every vitest, `node --test` and Playwright target in them by hand: each exists or is created earlier in the same or an earlier plan.

### Project rules checked

- **No content-type change (D-01):** no plan lists a file under `apps/backend/src/api/*/content-types`. 10-22 re-checks against `98fe99c`.
- **Full endpoint chain (D-02):**
  - **The one new route (10-13)** gets every link in the chain:
    - the exact Function and FunctionAPI in both catalogue copies, checked with `cmp`, granted to `role.security_analyst` only;
    - the operation in `HUMAN_ANALYST_ONLY_OPERATIONS`;
    - a 404 for an unknown request (the record-level check);
    - `specification.json`, `api:generate` and `api:check`;
    - a closed, registered parser with `narrowedPaths` instead of grandfathering;
    - a `humanAnalystOnly(200)` matrix row that meets the provenance guard;
    - the `contract-catalogue` route list;
    - `served-operations.json` regenerated with `SERVED_OPERATIONS_WRITE=1` after the web caller exists, with the dev servers stopped.
  - **Changed schemas:**
    - 10-06, 10-10, 10-11, 10-15, 10-16 and 10-18 each edit the spec, regenerate the client and run `api:check`.
    - Each parser mirrors the spec's bounds exactly.
    - The grandfather count goes from 43 to 42 in 10-15; I measured 43 today.
    - 10-06's reason code is carried by type guards plus a Strapi/spec/web equality test. No registered parser reads error bodies, so this is acceptable.
  - **No other route changes,** so the catalogues, matrix and served-operations inventory are correctly left alone elsewhere.
- **Shared files never in the same wave (D-40):** waves 1 and 2 have no `files_modified` overlap, and waves 3 to 20 are one plan each. The spec, the generated client, both catalogues, the served-operations inventory, the matrix, the parity guard and the research's hot files therefore have one owner per wave.
- **UI-SPEC §19 rows:** all 16 end-to-end rows (E1 to E16) and all 15 unit rows are claimed by the plan that changes the copy (research-to-final numbering as listed in VALIDATION.md). I checked every cited line against the tests.
- **Test commands:**
  - Web runs use `pnpm --filter @csrm/web exec vitest run <paths>`.
  - The Strapi suite is `pnpm --filter @csrm/strapi test`. Single Strapi files use the VALIDATION.md quick run: `tsc -p tests/tsconfig.json`, then `node --test` in `apps/backend`.
  - Playwright runs only after confirming ports 1337 and 3000 are free; `test:e2e` is `playwright test`.
- **AI and Keycloak:** no plan touches Keycloak or `CSRM_AI_*`, and the suites pin the deterministic provider. 10-22's browser walk forbids Generate, Replace, Retry, Submit, Release and Confirm import.

### References spot-checked against the code

Every reference below matched, except two harmless one-line offsets: the dashboard gate is at lines 26-30, not 25-29, and 10-03 says line 212 for the Yes check, which is at line 210.

- **Strapi throw sites (10-06):**
  - `request-workflow.ts:104-105`;
  - `questionnaire-workflow.ts:102, 107, 122, 131, 251, 278-279, 348-349`;
  - `questionnaire-governance-workflow.ts:210, 218, 223, 227, 241, 272, 289, 292, 299, 322, 369, 394-400, 445, 455, 458, 461, 464, 529, 531, 544, 551, 562-563`.

  Governance mutations run inside `db.transaction` (the `runGovernanceMutation` header), so a `HISTORY_UNAVAILABLE` on add rolls back the created question.
- **Strapi controllers and policy:**
  - `csrm-assessment-request.ts:49-53` (`denyConflict`) and `:201-202`;
  - `csrm-questionnaire.ts:103-114` (`safeError`) and `:357-371` (`findWorkflowOne`);
  - `csrm-authorization.ts:41-49` and `:398-419`;
  - `operations.ts:15-17`; `routes/csrm-questionnaire.ts:35-38, 61-78`;
  - `authorization-matrix.ts:176-178, 881-902`;
  - the catalogue at `:59, 133-148, 2222-2232`; both copies are byte-identical.
- **Web transport:** `server-client.ts:11-16, 94-96`, and the `server-only-boundary.test.ts` gate list.
- **Routes and gate:**
  - the three review route pages at the lines 10-02 cites;
  - the dashboard gate at `(analyst-dashboard)/page.tsx:26-30`;
  - `assessment-detail.tsx:47, 49, 54-56, 78, 79-86`;
  - `questionnaire-review.tsx:32-44, 81-103, 124-128`;
  - `states.tsx:119-136`; the permission copy lines in `released-assessment.tsx:109`, `risk-details.tsx:157` and `administration-workspace.tsx:100`.
- **Parity guard and schemas:**
  - `contract-response-parity.test.ts:56-151, 683` (count 43);
  - `questionnaire-service.ts:28-35, 49, 88-109, 112-115`.
- **Session and shell:** `development-session-adapter.ts:51-54, 68, 76-88`; `app/(app)/layout.tsx:8-33` (both `AppShell` renders); `app-shell.tsx:8-37`.
- **End-to-end lines the plans change:**
  - `questionnaire-workflow.spec.ts:181-196, 210-212, 228-230, 254, 305, 308`;
  - `assessment-release-workflow.spec.ts:81, 181-192, 205-229, 241-245, 270, 278, 315-320`;
  - `requestor-request-workflow.spec.ts:171, 219, 225-226, 237-266`;
  - `questionnaire-generation-workflow.spec.ts:39, 94, 110, 127-141`;
  - `questionnaire-governance-workflow.spec.ts:117, 140, 179-180`.

  `accessibility.spec.ts:270` is the analyst's view and stays green under the gate.
- **Unit lines the plans change:**
  - `request-actions.test.ts:119`, `questionnaire-actions.test.ts:78`, `states.test.tsx:36`;
  - `request-hub.test.tsx:47, 51`, `request-form.test.tsx:230`, `questionnaire-revision-timeline.test.tsx:50`;
  - `questionnaire-generation-job.test.tsx:157-158`, `administration-workflow.test.tsx:612`, `released-assessment.test.tsx:173, 220`;
  - `assessment-actions.test.ts:256, 266`;
  - `assessment-editor.test.tsx:163, 237, 260, 358, 458, 474, 531`;
  - `risk-details.test.tsx:104, 125, 145, 223, 226, 243`;
  - `questionnaire-renderer.test.tsx:142, 218`, `questionnaire-workflow.test.tsx:504, 519`.
- **Reference data and pickers:**
  - `seed-assessment-workflow.ts:16, 20, 24`; the reconciliation updates existing Risk Types, and `seed-csrm-data.ts` updates existing controls whose fields differ;
  - `csv-import.ts:95, 229, 232`;
  - `administration-query.ts:251, 257`, `administration-form.tsx:87`;
  - `request-service.ts:70, 121, 177-178`;
  - `assessment-schema.ts:251`, `assessment-domain.ts:50, 100`;
  - `risk-workflow.ts:229`, `assessment-scope.ts:320`, `assessment-workflow.integration.test.ts:643`, `csrm-risk.ts:200`;
  - `questionnaire-generation-job.tsx:47-58, 73-80, 176, 185, 190, 199`;
  - `assessment-draft-job.tsx:63, 80-100, 116-120, 239-240`.
- **Framework behaviour behind Warnings 1 and 2 (installed Next 16.3.6):**
  - `server/web/spec-extension/revalidate.js:221` and `server/app-render/action-handler.js:990`;
  - `client/app-dir/link.js:328`, `:339` and `:71` (`onClick` runs before `onNavigate`).

---

## Orchestrator Resolution (2026-09-27)

- **Blocker 1:** resolved by recorded decisions D-41 to D-45 in `10-CONTEXT.md`, which accept X-1 to X-5 and the four readings. No plan changes for it.
- **Warnings 1 to 4:** go back to the planner as a targeted revision:
  - the autosave revalidation (10-08);
  - the mobile sheet with a blocked link (10-08);
  - 10-22's gate checks: scope the `CSRM_AI_` check to source files, commit the summary before the clean-tree check, and make the browser walk after the dev-server restart an orchestrator checkpoint that the plan cannot pass while it is pending;
  - ADMIN-05's deferred remainder, which is not claimed as closed. The Information Asset owner needs a content-type change, so it moves to Phase 22 with a contract-gap record. Licensed or descriptive control titles wait for operator decision 15.
- **The four unnamed assertions** the check lists are added to the plans that change their copy.
- **Warnings 5 and 6** (plan size and feedback latency) are accepted: Phases 07 and 08 ran plans of this size with this executor.
- **Warning 7:** the planner marks the research's Open Questions resolved, citing D-42 for the sixth.
- **Execution note:** waves 1 and 2 run one plan at a time, because every plan in them runs Playwright on the same ports and build output.
- **After the revision:** run a fresh plan check before execution.

---

## Fresh check before execution (2026-10-02, post-demo at 72e53a6)

## ISSUES FOUND
Plans checked: 23. Issues: 1 blocker, 1 warning, 0 info.

### Spot-checks
- 230 apps/csrm|apps/backend paths extracted from plans: no apps/strapi or apps/web paths remain; every non-existent path is a file the plans create (save-status, relation-picker, local-time, navigation-guard, control-label, conflict-reasons, etc.) or a parsing artefact (`</files>` suffix); the existing ones (e.g. e2e/administration-workflow.spec.ts, backend tests/administration.integration.test.ts, assessment-schema.ts) exist.
- Requirements: REQ-07, QUES-08, QUES-09, ASSESS-06, ASSESS-07, ADMIN-05, UX-06 all claimed (10-23 claims all seven).
- Waves 1..23 serial, depends_on acyclic, all backward.
- No plan edits content-type schemas; no plan touches fonts.ts/globals.css; 10-09 only asserts design-system-conformance.spec.ts:455-461 stays green.
- X-1..X-5 acceptance recorded in 10-CONTEXT.md D-41 and STATE.md line 87.
- Not done: line-by-line reading of every plan's symbol/line anchors (depth limited).

### Blockers
1. [verification_derivation] The baseline in every guard command resolves at HEAD and separates Phase 10 changes from earlier work.
- Plans: 10-01 (l.281), 10-06 (l.283), 10-10 (l.232), 10-11 (l.249), 10-22 (l.191), 10-23 (l.68,127,129,130)
- Evidence: `git cat-file -t 98fe99c` gives "Not a valid object name" on post-demo; each `git diff 98fe99c..HEAD` fails with "bad revision". Also, after re-basing, any baseline before d161fce would list every content-type file (the rename) and the 10-23 `grep -i keycloak` would match the OIDC/ADR-0004 work (260929-u0w, 260930-iei, b6000d0). Those checks would fail for reasons unrelated to Phase 10.
- Example fix (non-binding): use the post-demo commit at which Phase 10 execution starts (for example 72e53a6 or the Stage-0 commit) and record it in CONTEXT/STATE.

### Warnings
1. [scope_sanity] Line anchors written against uat-trial still point at the same code.
- Evidence: line-numbered anchors such as 10-09's design-system-conformance.spec.ts:455-461 were not re-checked here. That spec was edited by 261002-2y8 and is being edited by the concurrent typography task.
- Example fix: cite anchors by test name rather than line number.

### Pilot drift cross-reference (2026-10-02)

The checker spot-checked rather than reading every plan line by line, so the pilot cross-referenced the code that changed after the plans were written. Every application file changed from the v1.0 overlay `130f34f` to HEAD was matched against the files the Phase 10 plans cite, and each match was sized (`git diff --stat 130f34f HEAD`):

| Changed after planning (commit) | Plans that cite it | Size | Disposition |
|---|---|---|---|
| `assessment-detail.tsx`, analyst request detail (261001-kxa, 261001-le4) | 10-02, 10-04, 10-12, 10-14 | 16 lines | Executors re-read the live page; layout-only change |
| `app-shell.tsx`, `(app)/layout.tsx`, `session-adapter.ts`, `development-session-adapter.ts` (260929-u0w, 260930-iei) | 10-01, 10-08 | 8–37 lines each | Flag-gated OIDC; dev-identity behaviour unchanged |
| `server-client.ts` (b6000d0) | 10-06, 10-07 | 26 lines | Locate by symbol, not line |
| Catalogue JSON, `csrm-authorization.ts`, `csrm-current-user/operations.ts`, authorization matrix, served-operations and harness tests (b6000d0) | 10-13 | 6–41 lines each | 10-13's new route merges into today's catalogue and matrix |
| `seed-csrm-data.ts` (5ed5301) | 10-17, 10-22 | 5 lines | No conflict |
| e2e specs repaired in `d161fce`; `design-system-conformance.spec.ts` (261002-2y8, 261002-drq) | 10-02, 10-04, 10-05, 10-08, 10-09, 10-10, 10-15, 10-18, 10-20 to 10-22 | 2–8 lines; conformance +189 and more | 10-09 finds its test by name, not by the `uat-trial` line anchor |

No plan duplicates work that has already landed. No plan changes a content type. No plan touches the Keycloak code paths.

### Resolution (pilot, 2026-10-02)

- **Blocker (baseline):** resolved by a mechanical revision. Every guard that used `98fe99c` now uses `5ea2b77`, the last `post-demo` commit before any Phase 10 code. This covers plans 10-01, 10-06, 10-10, 10-11, 10-22 and 10-23, `10-RESEARCH.md` and `10-VALIDATION.md`. The baseline is recorded as D-49 in `10-CONTEXT.md` and in STATE.md. 10-23's walkthrough now runs on `post-demo`. A full planner pass was not needed: the change is one literal per guard, with no task, wave or scope change.
- **Warning (line anchors):** executors locate code by symbol or test name. The worker brief names the drift hotspots above.
- **Verdict:** the plans are ready to execute.
