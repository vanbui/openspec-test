# Phase 16 Plan Check: Iteration 1

**Phase:** 16, Risk curation and targeted AI re-runs
**Plans checked:** 15 (16-01 to 16-15, waves 1 to 15, a linear chain)
**Result:** ISSUES FOUND: 0 blockers, 2 warnings, 0 info

## Deterministic probes
- verify-command-paths: 45 commands checked, 0 blockers, 0 warnings.
- verify-failure-directions: 45 checked, 0 blockers, 0 warnings.

## Requirement coverage
| Requirement | Plans | Status |
|---|---|---|
| ASSESS-09 (withdraw and curate risks) | 01-07, 10-12, 14, 15 | Covered |
| ASSESS-10 (targeted AI rewrite and suggest) | 01, 02, 08-11, 13-15 | Covered |

ROADMAP success criteria 1 to 4 are proven in 16-15's `risk-curation.spec.ts` (1440 and 375, axe) and in the Strapi integration tests of 16-04 to 16-10. The UAT-A-like payment-file case appears in 16-02, 08-11, 13 and 15.

## Confirmations and stage-2 section 3 rules
- The contract-gap record `phase-16-risk-withdrawal-and-history.md` names `undo: true`. It is followed by a blocking `checkpoint:decision` in 16-01 (autonomous: false) before any schema change: PASS.
- There is one proposal model (Phase 15's `proposal-items`). `itemStates` and `openProposals` appear only as negations or as the existing header prop, and `AI_PROPOSAL_NOT_OPEN` is grep-forbidden in 16-03: PASS.
- Phase 12's `AI_ACCEPT_WITH_PLANNED_CONTROL` and `riskHasPlannedControl` are reused, not duplicated. `AI_ACCEPT_NOT_PERMITTED` is the separate decision-8 rating rule: PASS.
- One editable guard and one active-risk rule (with a static test) run through the plans: PASS.
- No delete operation is served, and `REQUEST_HAS_ASSESSMENT` refuses deleting a request that has an assessment (16-04, API test and UI state): PASS.
- An analyst who raised the request gets `OWN_REQUEST`, enforced in the API (16-10) and in the UI (16-13, 16-14): PASS.
- Released risks are refused for withdraw and re-run: PASS.
- The deterministic provider is used in every suite that invokes AI. Playwright leaves a clean tree (16-15): PASS.
- No pre-rename app paths appear. `type="tracer"` is accepted. The journey spec is untouched (Phase 17 creates it): PASS.

## Warnings (section 3a: handled with recorded notes in the plans, no re-split)
1. [scope_sanity] Each plan stays within the per-plan task budget. 16-02 has 4 tasks (tracer plus 3 auto): borderline.
2. [scope_sanity] Same property. 16-04 has 4 tasks (tracer plus 3 auto): borderline.

## Structured Issues
```yaml
issues:
  - plan: "16-02"
    dimension: scope_sanity
    severity: warning
    required_property: "Each plan stays within the per-plan context budget (2-3 tasks target)"
    description: "16-02 has 4 tasks (tracer + 3 auto)"
    fix_hint: "Record a scope note in the plan per stage-2 section 3a; no re-split required"
  - plan: "16-04"
    dimension: scope_sanity
    severity: warning
    required_property: "Each plan stays within the per-plan context budget (2-3 tasks target)"
    description: "16-04 has 4 tasks (tracer + 3 auto)"
    fix_hint: "Record a scope note in the plan per stage-2 section 3a; no re-split required"
```

## Recommendation
0 blockers. The 2 warnings need only recorded notes in 16-02 and 16-04 (section 3a). Execution may proceed after the notes are added.

---

## Orchestrator disposition (2026-10-01)

Both warnings (plans 16-02 and 16-04, four tasks each, at the border) are settled the way this report prescribes: a scope note is recorded at the top of each plan's objective. Under the pilot's economy rule (warnings are handled with recorded notes, and blockers are fixed), no re-check runs. **Verdict: PASSED, iteration 1, with the two warnings settled by recorded notes.**

---

## Fresh pre-execution check (2026-10-15)

**Iteration:** 2 (fresh check against HEAD `90a91942`, with Phases 12 to 15 built)
**Verdict:** ISSUES: 5 blockers, 6 warnings, 4 info
**Plans checked:** 15 (16-01 to 16-15). `verify.plan-structure` passes for all 15. Task counts are unchanged (16-02 and 16-04 have 4 tasks, settled by notes in iteration 1).

### What still holds today
- X-27, X-28 and X-29 are free and next in sequence. Phase 15 recorded X-24 to X-26 (15-01-SUMMARY:62), and nothing outside the old pre-migration copies uses X-27 or higher. The anchors 16-01 names exist: `### Status & risk badges` with the `AI proposal items (CSRM extension, 2026-10-01)` bullet at design-direction:373, and `### Dialogs` with the `Side sheet` bullet at :427.
- Every backend and web identifier the plans read from Phases 12 to 15 exists, with the exceptions listed below. Every path a plan expects to exist does exist; the others are new files the plans create.
- The catalogue copies are byte-identical, and none of the new Function names collides with an existing one. Phase 12’s `function.ai_proposals.decide_api` exists.
- The matrix plans state no literal count. The count assertion stays relative (`23 + insightOperations.size`, authorization-matrix.integration.test.ts:224), and the six `MatrixActor`s and the `humanAnalystOnly` and `unmountedRoute` helpers exist. `/api/csrm-risks/{id}` DELETE is already listed as unserved (served-operations.json:3195).
- Context summary v4 is the current version (assessment-context.ts:71), so the planned “next version (v5)” is correct.
- The editor route `/app/review/assessments/{documentId}` has its own 460,000-byte budget (performance.spec.ts:77). It measured 318,814 bytes on 2026-10-11. 16-14 relies on `performance.spec.ts` to enforce the budget, which is enough.
- No plan changes a Keycloak file, and `PHASE_16_BASE` is recorded by 16-01 before its first commit.

### Blockers

**B1. [verify_format, P-1] Verify commands are host-neutral.** All 15 plans.
- Evidence: every `<automated>` command, and each plan’s “Hard rules”, hard-codes the `/c/ProgramData/nvm/v24.19.0` PATH export and the `pnpm()` shim. That is 60 occurrences, for example 16-02:194, 16-03:173 and 16-15:212. POST-DEMO-BRIEF.md:55-67 now gives that path only as an example, and Phase 15’s plans use none (`grep -c ProgramData` returns 0 for every 15-*-PLAN.md).
- Minimal fix: replace the preamble with Phase 15’s Node 24.19 version check followed by `pnpm --version >/dev/null &&`, copied verbatim from 15-10-PLAN.md:187. Restate the Hard-rules bullet to match.

**B2. [context_compliance, R-1] Every Phase 16 contract-gap record and amendment has an “Affected Workstreams” section, because the backend is shared and changes stay backward compatible.** Plan 16-01, Task 1.
- Evidence: 16-01:151’s section list for the new record, and its two amendment specifications (16-01:188 and :190), have no Affected Workstreams section. Precedent: phase-12 record :104 and :306, phase-13-request-assignment.md:124, phase-14-request-attachments.md:355.
- These changes to existing endpoints need to be listed:
  - the request DELETE gains 409 `REQUEST_HAS_ASSESSMENT` and changes which reason a request holding notes and an assessment reports (today `REQUEST_HAS_NOTES`, csrm-assessment-request.ts:338-346);
  - the analyst, released and Requestor reads, the list counts and the request relationship counts drop withdrawn risks;
  - `AnalystRiskDetail.withdrawal` and `RiskDetail.withdrawal` are new required keys;
  - the `/v1/risks` state filter enum gains `withdrawn`;
  - the new readiness item `aiProposalsDecided`;
  - `AiProposalDecision` gains a `proposal` target and the `reject` action;
  - `AiRun.operation` gains two values, and the context summary gains v5;
  - the four new reasons in both conflict enums;
  - the assessment AI-inputs baseline (see B5).
- Minimal fix: add `## Affected Workstreams` to the record’s section list, and `### Affected Workstreams` to each amendment, naming each change and its backward-compatibility position. Add matching acceptance greps.

**B3. [context_compliance, R-1 / G-6] The plan stops at a G-6 checkpoint where the pilot writes the dated approval lines in the pilot’s format, and later tasks check those lines without fixing the date.** Plans 16-01 (must_haves :26 and :34-45, :108, Task 3 :241-264), 16-02:171 and 16-03:149.
- Evidence: Task 3 has the executor write “Approved by the pilot on {date} (G-6). Recorded by the 16-01 executor …” and “Phase 16 amendment approved by the pilot on {date} (G-6).”, and 16-02 and 16-03 check that wording. The format in force is the one the pilot writes:
  - `Status: **approved by the pilot on 2026-10-10** (G-6)` (phase-14-request-attachments.md:410; phase-13 records :165 and :259);
  - `Phase 15 amendment status: **approved by the pilot on 2026-10-11** (G-6)` (phase-12 record :335; 06.8 record :250).
- With that bold formatting, the plan’s regex (date followed by a space and `(G-6)`) cannot match, because the closing `**` sits between the date and the space.
- Minimal fix:
  - Task 2 (the checkpoint) has the pilot write `Status: **approved by the pilot on YYYY-MM-DD** (G-6)` in the record, and `Phase 16 amendment status: **approved by the pilot on YYYY-MM-DD** (G-6)` in each amendment (and in the Phase 13 notes amendment from B5).
  - Task 3 becomes check-only. It runs `grep -E` with `approved by the pilot on [0-9]{4}-[0-9]{2}-[0-9]{2}\*\* \(G-6\)`, prefixed by `Status: \*\*` on the record and by `Phase 16 amendment status: \*\*` on each amended file. No awaiting line may remain.
  - The must_haves `contains`/`pattern` entries and the preconditions in 16-02 and 16-03 use the same strings.

**B4. [dependency_correctness] 16-01 Task 1’s precondition matches the Phase 15 approval line as it is written today.** Plan 16-01, Task 1 (:160).
- Evidence: the precondition requires “Phase 15 amendment approved by the pilot on”. The record actually says `Phase 15 amendment status: **approved by the pilot on 2026-10-11** (G-6)` (phase-12-ai-run-record-and-provenance.md:335), so the precondition is false and the executor stops before any work.
- Minimal fix: require `Phase 15 amendment status: **approved by the pilot on` instead.

**B5. [requirement_coverage / context_compliance] “Suggest more risks” moves the assessment’s AI-inputs baseline only through the approved route: a code change at the site that computes it, and a G-6 amendment to the Phase 13 notes record.** Plans 16-10, Task 3 (:117, :229, :242, :255), and 16-01.
- Evidence (code): 16-10 only adds `risk-suggestions` to `CONTEXT_WIDE_AI_OPERATIONS` in `ai-inputs-signal.ts` (:41). For the assessment, however, the baseline is `parseAssessmentAiProvenance(document.aiProvenance)?.runId`, the draft run (assessment-scope.ts:369-384, `assessmentAiInputsChanged`, also used by the request controller :71-73). That is not “the newest completed context-wide run”. The list change alone therefore never moves the assessment’s baseline, and 16-10’s own unit case (“uses the latest completed assessment-draft or risk-suggestions run”) cannot be met within its listed files.
- Evidence (record): docs/contract-gaps/phase-13-request-notes.md:194 says “The assessment’s baseline is unchanged”. That is approved meaning, and Phase 15 changed the questionnaire’s baseline only by a dated, approved amendment.
- Minimal fix:
  - 16-10: add `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts` to the files, and derive the assessment baseline from its newest completed `assessment-draft` or `risk-suggestions` run on that assessment (the questionnaire-scope.ts:565 pattern), with a mounted test.
  - 16-01: add a dated Phase 16 amendment note to `phase-13-request-notes.md` under the same G-6 checkpoint, and list it in files_modified.

### Warnings

**W1. [key_links] The item-core generalisation in 16-02 Task 2 matches the executed `proposal-items.ts`.**
- `DecisionPayloadParsers` already has a required `editFields` (proposal-items.ts:58-62). The plan’s optional `edits` list at :124 is stale; use `editFields`.
- `parseEvent` hard-codes `isProposalItemKey` (`i-1` to `i-30`, :35, :124). The new `itemKey` hook has to replace that call.
- `parseCause` ties each cause to an action (:98-108). The plan should state that `risk-withdrawn` is accepted only with `superseded`, and `assessment-not-editable` only with `lapsed`.
- Minimal fix: restate “Item core generalisation” accordingly.

**W2. [key_links] 16-04 keeps one transition mechanism.**
- `withMutableAssessmentMutation` already takes `transition` as a function of the result (assessment-workflow.ts:490 and :518). The plan adds a separate `appliesEdit` option (:91 and artifacts :145).
- Minimal fix: pass a `transition` function that returns `accepted-edit` when `result.changed` is true and `none` otherwise, and drop `appliesEdit` from the artifacts and acceptance criteria.

**W3. [key_links] 16-09 says how risk jobs fit Phase 15’s registry.**
- `ProposalJobStart` requires `questionnaireId` and `questionId`, and `enqueue` validates them (proposal-job-registry.ts:19-36 and the enqueue guard). 16-09 says to use one instance unchanged and does not list the registry file. The Pitfall 8 wrapper is not needed, because `activeByKey` holds only active jobs.
- Minimal fix: either generalise the two fields to a target id (adding the file to files_modified and running Phase 15’s registry tests), or record the mapping (assessmentId into `questionnaireId`, riskId into `questionId`) and project them under their own names.

**W4. [key_links] Web names follow the executed code.**
- `AiRunSheet` is `AiRunSheetBody` (ai-run-sheet.tsx:37); it appears at 16-13:98, :120, :125 and :237.
- `releaseReadinessSummary` is `summarizeReleaseReadiness` (release-readiness-summary.ts:31); it appears at 16-14:104, :106, :115 and :140.
- `FieldComparison`’s props are `caption`, `density`, `renderEmphasis` and `rows` (field-comparison.tsx:29). 16-12:115 and :143 should describe its new props as additions to these.
- Minimal fix: rename in place.

**W5. [verify_format] The 16-15 gate’s static checks cover only Phase 16 changes and today’s tree.**
- (a) The Keycloak check greps every path in `git diff --name-only $BASE..HEAD`. An `iam` merge landing during Phase 16 would trip it: the last one touched `scripts/verify-keycloak-idp.mjs`.
- (b) The clean-status filter allows only the three operator items, but `.planning/workstreams/csrm/.verification-ledger.json` is modified today.
- (c) T-16-01 says the gate re-checks the approval lines, but the verify command does not.
- Minimal fix: scope the Keycloak grep to `-- apps/` (or to the non-merge Phase 16 commits), allow the ledger path or require it committed, and add the B3 approval greps to the gate.

**W6. [scope_sanity, smart zone] Thirteen of the 15 plan estimates exceed the 100,000-token smart-zone budget** (120,000 to 145,000; 16-08, 16-09 and 16-10 at 140,000 to 145,000). `estimate-check --calibrated` reports confidence low with no calibration samples. This is advisory: no re-slice is required, but note it when pacing the run.

### Info
- I1. 16-15:209’s baseline counts (web 2,048, Strapi 578, Playwright 84 at `678b117`) are stale. They are recorded only for comparison and assert nothing.
- I2. 16-08 says “planned v5”. It is v5, because v4 is current and BE-06 added no version.
- I3. Phase 14’s `REQUEST_HAS_ATTACHMENTS` and Phase 13’s `REQUEST_HAS_NOTES` exist under the request lock. 16-04’s “before 13-06’s and 14-08’s checks” ordering is implementable inside `withRequestLock`.
- I4. The catalogue and matrix need no literal-count change. The plans say “the count” and let the executor update `23 + insightOperations.size`.

### Recommendation
5 blockers and 6 warnings require a planner revision (iteration 3). B1, B3 and B4 are mechanical text fixes. B2 and B5 add record content, including one new file in 16-01 and one in 16-10, and B5’s amendment goes through the same G-6 checkpoint. No re-slice is needed.

---

## Revision (iteration 3, 2026-10-15)

**Mode:** minimal in-place revision of the fresh check’s findings. No re-slice, no scope change, no task added or removed: task counts are unchanged (16-02 and 16-04 still have 4 tasks), and so are wave numbers and `depends_on`. `verify.plan-structure` and `frontmatter.validate --schema plan` pass for all 15 plans with no errors or warnings, and every `<automated>` command passes `bash -n`. The ROADMAP one-liners are unchanged, because no objective changed materially. Nothing is committed: the pilot reviews and commits.

### Blockers

- **B1 (P-1), all 15 plans.** I replaced each of the 43 verify preambles with Phase 15’s host-neutral form, copied verbatim from 15-10-PLAN.md:187: the `node -e` Node 24.19 version check, then `pnpm --version >/dev/null &&`. I also restated each plan’s “Hard rules” bullet in Phase 15’s wording, which points to POST-DEMO-BRIEF §4 and `NODE24_DIR`. `grep -c ProgramData` now returns 0 for every 16-*-PLAN.md.
- **B2 (R-1), 16-01 Task 1.**
  - **The record.** Its section list gains `## Affected Workstreams`. The section must name `csrm` as the only reader and record that `iam` reads none of the changed types or endpoints. I checked this on 2026-10-15: `grep -rlE "csrm-risk|CsrmRisk|risk_assessments|assessment_requests|csrm-assessment-request|AiRun|ai_runs|ai_proposal|/v1/risks|REQUEST_HAS|aiInputsChanged|contextSummary" .planning/workstreams/iam/` printed nothing; `iam` references only `/api/v1/info` and the `idambox-user` schema. Task 1 re-runs the grep and records it. The section then lists the ten changes with their backward-compatibility positions:
    - 409 `REQUEST_HAS_ASSESSMENT` on the request delete, and the reason that moves from `REQUEST_HAS_NOTES`;
    - the reads, list counts, relationship counts, register default and dashboard figures that drop withdrawn risks;
    - `AnalystRiskDetail.withdrawal` and `RiskDetail.withdrawal`;
    - the `withdrawn` state filter value;
    - `aiProposalsDecided` and the release refusal;
    - the `proposal` target and `reject` on the decision operation;
    - `AiRun.operation`’s two values and the context summary v5;
    - the four reasons in `AssessmentWorkflowErrorResponse` and `QuestionnaireWorkflowErrorResponse`;
    - the assessment AI-inputs baseline;
    - the eight new operations, marked “new, not changes”.
  - **The amendments.** Each of the three amendments gains a `### Affected Workstreams` subsection with its own list: the Phase 12, the Phase 04 and the new Phase 13 notes amendment.
  - **Checks.** Task 1’s verify now fails when any of these is missing. It checks that the record’s section exists and holds 15 required literals (scoped with `sed -n '/^## Affected Workstreams/,/^## /p'`), and that each amendment’s Phase 16 section has the subsection and names `iam`. The acceptance criteria list the same items. I added threat T-16-42 for existing callers of the shared backend.
- **B3 (G-6), 16-01, 16-02 and 16-03.**
  - **16-01.** The “Record status flow” decision now states that the pilot writes the approval lines, in the formats in force: `Status: **approved by the pilot on YYYY-MM-DD** (G-6)` in the record, and `Phase 16 amendment status: **approved by the pilot on YYYY-MM-DD** (G-6)` in each of the three amendments. The executor never writes one. Every check strips `*` with `tr -d '*'`, then matches `^Status: approved by the pilot on [0-9]{4}-[0-9]{2}-[0-9]{2} \(G-6\)` or `^Phase 16 amendment status: approved by the pilot on [0-9]{4}-[0-9]{2}-[0-9]{2} \(G-6\)`. Both are date-agnostic and tolerate the bold markers. I tested them on a simulated pilot-written record: they pass, and they fail on a missing line or an awaiting line.
  - **16-01 Task 2 (the checkpoint).** It now says: STOP, and report the record and the three amendments to the pilot; the pilot writes the four lines. Its resume signal asks the pilot for the lines.
  - **16-01 Task 3.** It is now check-only: it changes nothing and makes no commit. If a line is missing, it stops and reports to the pilot. Its verify checks all four lines and that no awaiting line remains, case-insensitively.
  - **16-01 must_haves.** The truth, the `contains` entries (`Status: **approved by the pilot on` and `Phase 16 amendment status: **approved by the pilot on`) and the key-link `pattern` use the same strings.
  - **16-02 and 16-03.** 16-02 Task 1’s precondition checks the record and the Phase 12 amendment; 16-03 Task 1’s checks the record. Both use the same bold-tolerant greps.
- **B4, 16-01 Task 1 precondition.** It now matches the real text, `Phase 15 amendment status: **approved by the pilot on 2026-10-11** (G-6)`, read date-agnostically with `*` stripped: `tr -d '*' < docs/contract-gaps/phase-12-ai-run-record-and-provenance.md | grep -Eq '^Phase 15 amendment status: approved by the pilot on [0-9]{4}-[0-9]{2}-[0-9]{2} \(G-6\)'`. Today it matches one line.
- **B5, 16-10 Task 3 and 16-01.**
  - **The pilot’s ruling.** I recorded it as a decision in 16-01 (“Assessment AI-inputs baseline”) and in the D-28 row of 16-10: a completed “Suggest more risks” run consumed the current notes and attachments, so it resets the signal, the rule Phase 15 applied to questionnaires; a “Rewrite this risk” run does not move the baseline.
  - **16-01.** Task 1 appends `## Phase 16 amendment (2026-10-15): the assessment's AI-inputs baseline` to `docs/contract-gaps/phase-13-request-notes.md`. It has its own `### Affected Workstreams`: the analyst assessment read’s `generation.aiInputsChanged` and the request read’s `RequestAiInputs`. These stay compatible: the shape is unchanged, and the value is identical for every assessment without a suggestions run. Task 1 also adds one pointer sub-bullet under “The baseline run”, leaving the approved Phase 15 sub-bullet verbatim. The amendment goes through the same G-6 checkpoint, and the file is added to `files_modified`, the must_haves and Tasks 1 to 3.
  - **16-10.** I added `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts`, the actual path, to `files_modified`, to Task 3’s files and to the artifacts. A new `latestCompletedAssessmentContextRun` follows `latestCompletedQuestionnaireContextRun` (questionnaire-scope.ts:514-523): it selects the newest completed `assessment-draft` or `risk-suggestions` run by the run’s `assessment` relation. It falls back to the `aiProvenance` run and then to `generatedDate`, so every assessment without a suggestions run reads as today. `assessmentAiInputsChanged` uses it, and the request controller follows unchanged. `generation.runId` keeps naming the draft run. `CONTEXT_WIDE_AI_OPERATIONS` gains `risk-suggestions`, which is still needed because the loader accepts only context-wide runs (ai-inputs-signal.ts:192).
  - **16-10 tests.** The infeasible unit case is replaced: the unit case now covers only the operation list, and a mounted case in `risk-proposal-decisions.integration.test.ts`, already in Task 3’s files, covers the signal clearing after a suggestions run and not after a rewrite. Task 3 gains a precondition on the Phase 13 amendment’s approval line.

### Warnings

- **W1, 16-02 Task 2.** “Item core generalisation” now follows the executed `proposal-items.ts`:
  - it reuses the required `editFields` (risk payloads pass `[]`) and drops the separate edits list;
  - it adds an optional `itemKey` hook, and `parseEvent` calls `parsers.itemKey ?? isProposalItemKey` instead of the hard-coded `isProposalItemKey`;
  - it states the pairings in `parseCause`: `risk-withdrawn` only with `superseded`, and `assessment-not-editable` only with `lapsed`.

  I updated the artifacts line, added the pairing and an edits refusal to the behaviour, and added an acceptance criterion.
- **W2, 16-04.** I dropped `appliesEdit`. The wrapper keeps its executed `transition` option, a value or a function of the result. HTTP paths pass `transition: (result) => result.changed ? "accepted-edit" : "none"`, and `decideAiProposals` keeps the `result.contentChanged` function it already has. These sections changed: the D-23 row, “Mutation wrapper”, the HTTP-facing bullet, the artifacts, the Task 1 behaviour, and the Task 3 RED and GREEN steps. A new acceptance criterion pins the wrapper’s five input members.

  For consistency I updated the two consumers of the dropped option: 16-05 (the key link, Written ahead, the D-12/D-23 row and the `withdrawRisks` call) and 16-10 (the D-23 row and the `withMutableAssessmentMutation` call in “Order”). No plan names `appliesEdit` any more, except 16-04’s note that it is not added.
- **W3, 16-09.** I added `apps/backend/src/csrm/ai/proposal-job-registry.ts` and `apps/backend/tests/proposal-job-registry.unit.test.ts` to `files_modified`, to Task 1’s files and to the artifacts. “Registry” now applies the pilot’s ruling: a discriminated `ProposalJobTarget` with a questionnaire kind and an assessment kind. A start without `target` behaves exactly as Phase 15’s does, and questionnaire jobs keep `questionnaireId` and `questionId`. `activeFor` matches the scope id. `questionnaire-proposals-workflow.ts` must stay unedited: Task 1’s verify checks it with a diff since PHASE_16_BASE and runs the registry unit test. I removed the retained-terminal-jobs wrapper, because `activeByKey` holds only active jobs. I also updated the truth, the key link, the interfaces and the output line.
- **W4, 16-12 to 16-14.** I renamed `AiRunSheet` to `AiRunSheetBody`: four places in 16-13, plus the pattern mention at 16-12:95. In 16-13’s interfaces I also corrected where `sheetInstructionRows` lives (ai-run-sheet.tsx) and where `pluralise` lives (questionnaire-ai-domain.ts). I renamed `releaseReadinessSummary` to `summarizeReleaseReadiness` in four places in 16-14. In 16-12, `FieldComparison`’s new props are now described as additions to its existing `caption`, `density`, `renderEmphasis` and `rows`: `rows` or `groups`, and `renderEmphasis` still wins over `emphasis`. This changed the decision, the interfaces, the artifacts and the acceptance criteria.
- **W5, 16-15.**
  - (a) The Keycloak check is now `CHANGED="$(git diff --name-only "$BASE" -- apps/)"` followed by the keycloak grep.
  - (b) Both clean-tree filters, in Tasks 2 and 3, also accept ` M .planning/workstreams/csrm/.verification-ledger.json`.
  - (c) Task 3’s verify re-checks the four approval lines from B3 and that no awaiting line remains.

  The action, `fails_when`, acceptance criteria and must_haves truth match these changes.
- **W6 (estimates).** Advisory; left as it is, as instructed.

### Not changed, for the pilot’s attention
- 16-15 Task 3’s content-type freeze (`git diff --name-only "$BASE"..HEAD -- 'apps/backend/src/api/*/content-types/*'`) and its dependency diff (`apps/backend/package.json`, `pnpm-lock.yaml`) span every workstream’s commits since PHASE_16_BASE, as the Keycloak check did before W5(a). An `iam` merge that changes the `idambox-user` schema (SCIM) or a backend dependency during Phase 16 would trip them. The findings did not cover this, so I left it.

---

## Re-check (iteration 4, 2026-10-15)

**Verdict:** PASS (0 blockers, 0 warnings). W6 (estimates) stays advisory. The pilot's ruling on the full `PHASE_16_BASE..HEAD` scope of 16-15's content-type freeze and dependency diff is accepted as deliberate, so it is not flagged.

- **B1:** `grep -c ProgramData` returns 0 for all 15 plans. 16-15:212 uses the Phase 15 host-neutral preamble.
- **B2:** 16-01 has `## Affected Workstreams` in the record, a `### Affected Workstreams` subsection in each of the three amendments, the iam grep and the list of changes with their compatibility positions (:28, :69, :117, :123).
- **B3:** the approval regexes were tested against the real pilot lines. `tr -d '*'` plus `^Status: approved by the pilot on [0-9]{4}-[0-9]{2}-[0-9]{2} \(G-6\)` matches phase-14-request-attachments.md:410. The must_haves raw `pattern` (`...\*\* \(G-6\)`) also matches the bold format. 16-01 Task 3 only checks the lines. The preconditions in 16-02:171, 16-03:149 and 16-10:240 use the same strings, and so does the 16-15 gate. No amended file holds a `status: awaiting` line today, so the negative grep can only fail on Phase 16's own pending lines.
- **B4:** the 16-01:177 precondition matches phase-12-ai-run-record-and-provenance.md:335 today.
- **B5:** 16-10 lists `assessment-scope.ts` in files_modified, Task 3 and the artifacts. Its target is the right code: `assessmentAiInputsChanged` takes its baseline from `aiProvenance` (assessment-scope.ts:375-382), and it models the new function on `latestCompletedQuestionnaireContextRun` (questionnaire-scope.ts:514). 16-01 adds the Phase 13 notes amendment and lists it in files_modified. The Task 3 precondition on 16-10 is consistent with it.
- **W1:** 16-02:124, :161 and :232 reuse `editFields`, add the `itemKey` hook and pair the causes with their actions.
- **W2:** `appliesEdit` appears only in 16-04's own notes. 16-05 and 16-10 no longer name it.
- **W3:** 16-09 lists the registry file and its unit test, and adds the discriminated `ProposalJobTarget`.
- **W4:** 16-12 to 16-14 contain no `AiRunSheet` (as a whole word) and no `releaseReadinessSummary`.
- **W5:** the Keycloak check is scoped to `-- apps/`, the ledger path is allowed, and the gate re-checks the four approval lines.
- **depends_on and waves:** a linear chain from 16-01 to 16-15 (waves 1 to 15). There is no drift, cycle or forward reference.

No new blockers. Plans are ready for `/gsd-execute-phase 16 --ws csrm`.

---

## Iteration 5 (2026-10-15, IAM backend sync)

**Trigger.** The working branch fast-forwarded to `d1518c5f`, the merge of the IAM workstream's shared-backend work. Phase 16's own pre-merge commits are `01dc4118..f2a39dbe` (16-01 and the 16-02 WIP). The merge brought the IAM content types `apps/backend/src/api/idambox-user`, `apps/backend/src/api/identity-source` and `apps/backend/src/api/keycloak-sync-outbox`, and the `pg` dependency in `apps/backend/package.json` and `pnpm-lock.yaml`. A targeted re-check found the two blockers below.

**Pilot's ruling (applied exactly).** `PHASE_16_BASE` stays `01dc4118`. Phase 16's freeze checks cover Phase 16's own change, not other workstreams' merged work:
- Every content-type freeze diff appends `':!apps/backend/src/api/idambox-user' ':!apps/backend/src/api/identity-source' ':!apps/backend/src/api/keycloak-sync-outbox'`.
- The dependency freeze defines `PHASE_16_IAM_SYNC=d1518c5f` (the merge that brought IAM's work) and requires both `git diff --name-only 01dc4118 f2a39dbe -- <dep files>` and `git diff --name-only d1518c5f HEAD -- <dep files>` to be empty. The `pg` addition is IAM-owned and is recorded as such in the phase's coverage notes (`COVERAGE.md`, 16-15).
- If a later fast-forward brings more of another workstream's shared-backend commits, the pilot extends the exclusion list with that workstream's owned paths and records it. Phase 16's own content-type changes stay limited to `csrm-risk` and `csrm-risk-history-event`.

### Blockers (resolved)
- **B1, the content-type freeze saw IAM's three schemas.** At `d1518c5f`, `git diff --name-only 01dc4118 HEAD -- 'apps/backend/src/api/*/content-types/*'` lists the `idambox-user`, `identity-source` and `keycloak-sync-outbox` schemas. With the three exclusions it prints nothing, which is the expected state before 16-03 runs. Changed occurrences:
  - 16-02: the "Freeze scope" hard-rule bullet (:149), Task 4's acceptance (:300) and the verification line.
  - 16-03: the must_haves truth (:33), the "Freeze scope" hard-rule bullet (:130), Task 1's GREEN step (:171), Task 1's acceptance (:181) and the verification line.
  - 16-15: the must_haves truth (:33), the D-01 row, the "Freeze scope" bullet (:105), Task 3's action (:210), verify `FROZEN=` (:213), `fails_when` (:214) and acceptance (:220).
  - 16-VALIDATION.md: the phase-gate row (:43), the same freeze in the phase directory.
  - No plan from 16-04 to 16-14 carries a content-type freeze diff; their hard rule ("Only plan 16-03 changes content-type schema files") stays true and unchanged.
- **B2, 16-15's dependency freeze saw IAM's `pg`.** Task 3's verify now runs `PHASE_16_IAM_SYNC=d1518c5f && test -z "$(git diff --name-only 01dc4118 f2a39dbe -- apps/backend/package.json apps/csrm/package.json pnpm-lock.yaml)" && test -z "$(git diff --name-only "$PHASE_16_IAM_SYNC" HEAD -- …)"`, and also greps `COVERAGE.md` for `IAM-owned`. The "Coverage record" decision adds a `## Notes` line recording `pg` as IAM-owned. The truth, action, `fails_when`, acceptance, T-16-SC row and the 16-VALIDATION.md gate row match. Measured at `d1518c5f`, both ranges print nothing.

### Warnings (recorded as executor notes and acceptance lines)
- **W1 (16-04, 16-06).** IAM's guards in `risk-workflow.ts` stay in place:
  - `resolveRelations` refuses a registered source service user as `riskOwner` or `treatmentOwner` (`isRegisteredSourceServiceUser`).
  - `searchActiveUserDocuments` excludes service ids with `documentId.$notIn`.

  Each plan has an "IAM backend sync" note (16-04:91, 16-06:88). 16-04 Task 1 adds the acceptance line "a source-service owner is still refused with 400 "CSRM Risk reference is invalid."" (:188). Task 1 and Task 2 add `iam-human-selectors.integration.test.js` to their verify, because that file proves the POST and PATCH refusals with the persisted owners unchanged.
- **W2 (16-04, 16-06, 16-10).** A hand-rolled Strapi double answers `api::identity-source.identity-source` with `findMany: async () => []`, as `tests/fixtures/authorization.ts` does. This is in the notes at 16-04:91, 16-06:88 and 16-10:106.
- **W3 (16-05, 16-09).** The notes at 16-05:93 and 16-09:94 cover four points:
  - the `served-operations.integration.test.ts` assertions ("Identity Provisioning" is the only non-`idambox-csrm` Function, no role holds `function.identity_provisioning.api`, and a repeated `seedCsrmData` leaves the snapshot unchanged);
  - new Functions go under `idambox-csrm` and are granted only to Security Analyst roles;
  - `UNSERVED_REASONS` edits merge after the `IAM_SCIM_RESERVATIONS` spread;
  - count assertions are re-measured against today's catalogue.

  Acceptance lines were added at 16-05:249 and 16-09:247.
- **W4 (16-05, 16-09, 16-10).** Human Security Analyst eligibility goes only through `isHumanSecurityAnalyst`, `csrmAuthorization` or `isEligiblePerson`, never a role-name test. This is in the notes at 16-05:93, 16-09:94 and 16-10:106.

### Open, for the pilot's ruling (not covered by the ruling above)
- **B3, 16-15's Keycloak check now trips on IAM's merged paths.** `CHANGED="$(git diff --name-only "$BASE" -- apps/)"` followed by the case-insensitive `keycloak` grep matches 16 IAM paths at `d1518c5f`, for example `apps/backend/src/api/keycloak-sync-outbox/content-types/keycloak-sync-outbox/schema.json`, `apps/backend/src/iam/keycloak-sync/outbox.ts`, `apps/backend/src/keycloak/admin-client.ts` and `apps/backend/tests/iam-keycloak-sync.integration.test.ts`. Scoping to `apps/` (iteration 3, W5(a)) does not help, because IAM's paths are under `apps/`.
  - Where it appears: 16-15's must_haves truth, Task 3's verify, `fails_when` and acceptance, and the 16-VALIDATION.md gate row.
  - Not changed, because Keycloak path exceptions need the pilot's reviewed ruling.
  - One option, measured: run the grep over Phase 16's own ranges, `{ git diff --name-only 01dc4118 f2a39dbe -- apps/; git diff --name-only d1518c5f HEAD -- apps/; } | grep -i keycloak`. Today it prints nothing (count 0).
  - This blocks only 16-15 Task 3. Plans 16-02 to 16-14 are unaffected.

### Info
- 16-01 is complete (16-01-SUMMARY). Two of its acceptance lines would now list IAM paths if re-run: `git diff --name-only PHASE_16_BASE -- apps/backend/src` (:237) and `-- apps/backend/src docs/references` (:269). So would the 16-VALIDATION.md 16-01-02 row. No later plan re-runs them, so they were left.
- 16-09's `questionnaire-proposals-workflow.ts` diff is unaffected, because IAM did not touch that file. At `d1518c5f`, `cmp` of the two catalogue copies is silent.
- Frontmatter (`frontmatter validate --schema plan`) and `verify plan-structure` are valid for 16-02, 16-03, 16-04, 16-05, 16-06, 16-09, 16-10 and 16-15. `bash -n` passes on the edited verify commands in 16-04 and 16-15.

**Verdict:** B1 and B2 are resolved per the pilot's ruling, and W1 to W4 are recorded. B3 is open for the pilot. It gates 16-15 Task 3 only, so execution can resume at 16-02.

**Pilot ruling on B3 (2026-10-15).** Adopted the two-range form: 16-15's Keycloak check greps `{ git diff --name-only 01dc4118 f2a39dbe -- apps/; git diff --name-only d1518c5f HEAD -- apps/; }` for `keycloak`, case-insensitively. The 16 matching paths at `d1518c5f` are the IAM workstream's own Keycloak sync and provisioning work, merged by the operator. Phase 16 still must not touch any Keycloak path, and a Phase 16 commit that does still fails the check. Measured at `d1518c5f`: it prints nothing. 16-15's verify, `fails_when`, acceptance and must_haves truth now match. 16-01's completed acceptance lines (:237, :269) and VALIDATION's 16-01-02 row are historical and are not re-run. With B1 to B3 resolved and W1 to W4 recorded in the plans, iteration 5 passes; execution resumes at 16-02.
