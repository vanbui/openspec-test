---
phase: 10-existing-flow-gap-closure
plan: 11
subsystem: api
tags: [questionnaire-generation, governance-log, regenerated-event, release-guard, change-count, revision-timeline, contract-amendment, d-01, d-02, d-09, d-10, d-16, d-39, ques-08, uat-019]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-06 the closed conflict reasons (QUESTIONNAIRE_RELEASED already in all three lists) and log-first governance writes; 10-07 the generation refusal copy family; 10-10 the question text snapshot, the generatedDate-bounded resolution rule and part one of the 06.8 amendment"
provides:
  - "questionnaire-governance-log.ts: the regenerated kind in GOVERNANCE_EVENT_KINDS and countAnalystChangesSinceGeneration(log, generatedDate)"
  - "persistGeneratedQuestionnaire: every replacement appends exactly one regenerated event (initiating analyst, new generation time, replaced and discarded counts in the UI-SPEC §3.4 wording) in memory before any write, stored with the new generation in the same transaction; generatedDate still moves on every replacement"
  - "D-09: generateQuestionnaire answers 409 QUESTIONNAIRE_RELEASED before queueing a job; the job re-checks under the request row lock and fails with QUESTIONNAIRE_RELEASED, writing nothing"
  - "projectAnalystRevision (questionnaire-scope.ts): revision.analystChangesSinceGeneration on the analyst questionnaire read and every governance result; the Requestor read never carries it"
  - "The Requestor projection of regenerated keeps only kind and at"
  - "Spec: regenerated in both event kind enums and the optional analystChangesSinceGeneration (integer, minimum 0) on QuestionnaireRevision; schema.d.ts regenerated; both closed web enums and the revision schema mirror them"
  - "Timelines: Questionnaire replaced with Sparkles and Detail for the analyst; for the Requestor only after the first release, without detail, restarting the round count"
  - "06.8 contract-gap record: 'Phase 10 amendment (2026-09-27), part two: the regenerated event and the change count'"
  - "Harness: withHeldQuestionnaireGeneration can queue an acknowledged replacement, passes the job id and accepts a failed ending"
affects: [10-12 the Replace confirmation reads revision.analystChangesSinceGeneration and the released hint; its generation journey changes names, 10-23 pilot walkthrough, any later plan that writes or projects governance events or replaces questionnaires]

actuals:
  tokens: 18491
  tasks: 3
  commits: 6
plan_head_before: a41108b1938ce02c5c76e1a05523c9d7ded77b5f
plan_head_after: 074c63d14d0ee61a0ec8a318707f43f93a5d4753

tech-stack:
  added: []
  patterns:
    - "Log-first replacement: the job builds the appended governance log before deleting a question, so a log that cannot take the event fails the job with nothing written"
    - "Synchronous refusal plus an in-transaction re-check under the request row lock for any precondition a queued job can lose while it waits"
    - "Analyst-only facts on a shared projection: projectQuestionnaire serves both actors unchanged and analyst paths overlay revision through projectAnalystRevision"

key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-workflow.ts
    - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
    - apps/backend/tests/questionnaire-generation.integration.test.ts
    - apps/backend/tests/questionnaire-generation.unit.test.ts
    - apps/backend/tests/questionnaire-governance.unit.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/questionnaires/questionnaire-service.ts
    - apps/csrm/src/features/questionnaires/questionnaire-service.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.test.tsx
    - docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md

key-decisions:
  - "10-11: the regenerated event is appended in memory before the replaced questions are deleted (10-06's log-first rule), not only inside the update call; a full or unparseable log fails the job with the registry's generic QUESTIONNAIRE_GENERATION_FAILED and changes nothing (mounted proof)"
  - "10-11: n counts the replaced questionnaire's questions not already removed (falling back to rows without a deletion marker when the definition cannot be parsed); m counts question-added, -edited and -deleted events at or after generatedDate, counted before the append; cleared answers and replacements are not changes"
  - "10-11: countAnalystChangesSinceGeneration counts every change when generatedDate is absent or unreadable (a confirmation that undercounts discarded work is the worse error) and 0 for an unparseable log (a read never throws)"
  - "10-11: D-09 refuses generation for a released questionnaire with or without the replacement acknowledgement; the release fact (releasedAt), never the log, decides"
  - "10-11: the count is served on the analyst questionnaire read and every governance result (projectAnalystRevision); the release result, list reads and Requestor reads keep the plain summary, since a released questionnaire cannot be replaced"
  - "10-11: the Requestor summary shows an explanation only for answer-cleared, so a regenerated event's detail cannot reach it even if a projection served one; a replacement after the first release resets that round's change count"

patterns-established:
  - "A job that loses a precondition while queued re-checks it under the request row lock and fails with the same reason code the synchronous route uses"

requirements-completed: []

coverage:
  - id: D1
    description: "Every replacement appends exactly one regenerated event naming the initiating analyst, dated by the new generation (generatedDate keeps moving), with the replaced and discarded counts; the analyst read shows its explanation and the Requestor read only kind and at (D-10, T-10-28, T-10-29)"
    requirement: QUES-08
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-generation.integration.test.ts#mounted replacement records one regenerated event naming the analyst and what it discarded"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/questionnaire-generation.integration.test.ts#mounted replacement with a full governance log fails and changes nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "Replacing a released questionnaire is refused with 409 QUESTIONNAIRE_RELEASED before a job is queued, and a release landing while a job waits fails the job with QUESTIONNAIRE_RELEASED, with deep-equal state both times (D-09, T-10-27)"
    requirement: QUES-08
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-generation.integration.test.ts#mounted generation refuses to replace a released questionnaire before queueing a job"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/questionnaire-generation.integration.test.ts#mounted replacement job fails when the questionnaire is released while it runs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Analyst reads and governance results carry revision.analystChangesSinceGeneration, restarting after a replacement; Requestor reads never do (D-16, T-10-29)"
    requirement: QUES-08
    verification:
      - kind: unit
        ref: "apps/backend/tests/questionnaire-governance.unit.test.ts#countAnalystChangesSinceGeneration counts question changes at or after the latest generation (D-16)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/questionnaire-generation.integration.test.ts#mounted analyst reads count question changes since the latest generation and Requestor reads never do"
        status: pass
    human_judgment: false
  - id: D4
    description: "Contract: regenerated in both spec enums and both closed web enums; optional analystChangesSinceGeneration on QuestionnaireRevision; regenerated schema.d.ts; clean api:check and parity guard (D-02)"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-service.test.ts#accepts a regenerated event on the timeline and in a governance result (D-10)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-service.test.ts#accepts the optional analyst change count on a questionnaire revision (D-16)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --dir apps/csrm api:check"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both timelines read regenerated as Questionnaire replaced (Sparkles); the analyst sees Detail, the Requestor sees it only after the first release, without detail, with the round count restarting (UI-SPEC §3.4, §4.3)"
    requirement: QUES-08
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.test.tsx#shows a replacement to the analyst as Questionnaire replaced with its detail (UI-SPEC §3.4)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.test.tsx#shows the Requestor a replacement only after the first release, without detail, and restarts the round count (UI-SPEC §4.3)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The 06.8 contract-gap record's Phase 10 amendment, part two, records the regenerated kind, the refusals and the change count, with no content-type change (D-01)"
    verification:
      - kind: other
        ref: "git diff --name-only 5ea2b77..HEAD -- 'apps/backend/src/api/*/content-types/*' (empty)"
        status: pass
    human_judgment: true
    rationale: "The amendment is a contract-gap record that the orchestrator approves after review (G-6); its wording is a governance judgement no test asserts"

duration: 40min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 11: Regeneration safeguards Summary

**Replacing a questionnaire now leaves a dated `regenerated` record of what it replaced and how many analyst changes it discarded. A released questionnaire is refused before a job is queued and again inside the job. Analyst reads carry `revision.analystChangesSinceGeneration` for plan 10-12's Replace confirmation, and Requestor reads never do.**

## Performance

- **Duration:** about 40 min
- **Started:** 2026-10-02T06:37:45Z
- **Completed:** 2026-10-02T07:17:00Z
- **Tasks:** 3 (Task 1 a tracer; its gate re-ran the full verify and passed before expansion)
- **Files modified:** 17

## Accomplishments

- **The `regenerated` event (D-10).**
  - `GOVERNANCE_EVENT_KINDS` gains `regenerated`. In the replacing branch, `persistGeneratedQuestionnaire` builds the appended log before deleting any question, then stores it with the new generation.
  - The event names the initiating analyst and is dated by the new `generatedDate`, so 10-10's resolution window and the new count both restart. Its explanation is the UI-SPEC §3.4 sentence.
  - A full log fails the job and leaves the questionnaire and request deep-equal.
- **Released questionnaires (D-09).**
  - `generateQuestionnaire` reads the request with its questionnaire. When `releasedAt` is set, it answers 409 with `error.details.reason` `QUESTIONNAIRE_RELEASED`, with or without the acknowledgement.
  - The job re-checks after the answered check, under the request row lock, and fails with `QUESTIONNAIRE_RELEASED` if a release landed while it waited.
- **The change count (D-16).** `countAnalystChangesSinceGeneration` counts additions, edits and removals at or after `generatedDate`.
  - `projectAnalystRevision` adds the count on the analyst branch of the questionnaire read and in `resultForGovernance`.
  - `projectQuestionnaire` and the Requestor read are unchanged.
- **Contract.** The spec has `regenerated` in both kind enums and the optional `analystChangesSinceGeneration` (integer, minimum 0). The regenerated `schema.d.ts` was committed with the spec each time. The web's two closed enums and the revision schema match, and `api:check` and the parity guard are clean.
- **Timelines.** The analyst sees `Questionnaire replaced` with `Sparkles` and `Detail: {explanation}`. The Requestor's summary lists it only after the first release, without detail. A replacement after the first release restarts that round's change count. The Requestor projection drops the explanation.
- **Record.** The 06.8 record has "Phase 10 amendment (2026-09-27), part two: the `regenerated` event and the change count".

## Task Commits

1. **Task 1 (tracer): a replacement writes a regenerated event that both timelines show**
   - RED `77d2166` (test): expect a replacement to record a regenerated event that both timelines show
   - GREEN `d9d1ec5` (feat): record every questionnaire replacement as a regenerated event (spec and `schema.d.ts` together)
2. **Task 2: refuse to replace a released questionnaire, before the job and inside it**
   - RED `9290d25` (test): expect a released questionnaire to be refused for replacement
   - GREEN `4416d6a` (fix): refuse to replace a questionnaire that has been released to the Requestor
3. **Task 3: the analyst change count on analyst reads, then the full Strapi suite**
   - RED `d82f514` (test): expect analyst reads to count question changes since the latest generation
   - GREEN `074c63d` (feat): count analyst question changes since the latest generation on analyst reads (spec and `schema.d.ts` together)

No REFACTOR commits were needed.

**Plan metadata:** recorded in the docs commit that adds this SUMMARY with STATE.md and ROADMAP.md.

## Tests run

| Run | Scope | Result |
| --- | --- | --- |
| Task 1 RED, web | timeline and service tests | 3 failed (the three new cases), 18 passed. The two timeline cases failed with `TypeError: Cannot read properties of undefined (reading 'icon')`, the component having no presentation for the kind; the parser case failed on its assertion |
| Task 1 RED, Strapi | generation integration file (TAP) | 2 failed (`REPLACEMENT_DID_NOT_APPEND_EXACTLY_ONE_EVENT` 0 !== 1; `FULL_LOG_REPLACEMENT_COMPLETED`), 2 passed; `RED_EVIDENCE_OK` |
| Task 1 GREEN | web timeline, service and `contract-response-parity.test.ts` | 159/159 |
| Task 1 GREEN | `api:check` (then `git update-index --refresh`), web typecheck | clean, exit 0 |
| Task 1 GREEN | Strapi generation integration file | 4/4 |
| Task 1 GREEN | Strapi governance unit, generation unit, contract catalogue integration | 39/39 |
| Task 2 RED | Strapi generation integration and unit files (TAP) | 2 failed (`RELEASED_REPLACEMENT_NOT_REFUSED_ACKNOWLEDGED` 202 !== 409; `HELD_QUESTIONNAIRE_GENERATION_DID_NOT_FAIL`), 10 passed; `RED_EVIDENCE_OK` |
| Task 2 GREEN | same files | 12/12 (after the unit-mock fix, see Deviations) |
| Task 3 RED, web | service test | 1 failed (the count case), 9 passed |
| Task 3 RED, Strapi | generation integration and governance unit files (TAP) | 1 failed (`FRESH_QUESTIONNAIRE_COUNT` undefined !== 0), 24 passed; `RED_EVIDENCE_OK` |
| Task 3 GREEN | web `contract-response-parity.test.ts` and `src/features/questionnaires` (12 files) | 398/398 |
| Task 3 GREEN | `api:check`, web typecheck | clean, exit 0 |
| Task 3 GREEN | Strapi generation integration, governance unit and governance integration files | 36/36 |
| Full Strapi suite | `pnpm --dir apps/backend test` (background, no dev servers) | 593 passed, 0 failed, 0 cancelled, 0 skipped; 735 s test time, 741 s wall |
| Full web suite | `pnpm --dir apps/csrm test` | 2,521/2,521 in 125 files, 31.5 s |
| Web gates | `typecheck`, `lint`, `api:check` | exit 0, exit 0, clean |
| Static guard | `git diff --name-only 5ea2b77..HEAD -- 'apps/backend/src/api/*/content-types/*'` | empty |

Playwright was not run, as the plan says: the generation journey changes in plan 10-12.

## Files Created/Modified

- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts`: the `regenerated` kind and `countAnalystChangesSinceGeneration`.
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts`:
  - the log-first `regenerated` append and `replacementExplanation`;
  - `isReleased` and both `QUESTIONNAIRE_RELEASED` refusals.
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts`: the Requestor projection without a replacement's explanation, and `projectAnalystRevision`.
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-workflow.ts`: `resultForGovernance` carries the count.
- `apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts`: the analyst branch of `findWorkflowOne` carries the count.
- `apps/backend/tests/questionnaire-generation.integration.test.ts`: five mounted cases (replacement, full log, released refusal, release race, change count).
- `apps/backend/tests/questionnaire-governance.unit.test.ts`: the count unit case and the kind pin.
- `apps/backend/tests/questionnaire-generation.unit.test.ts`: the mock holds only the job's nested read.
- `apps/backend/tests/contract-catalogue.integration.test.ts`: the spec kind pin.
- `apps/backend/tests/helpers/strapi-http-harness.ts`: `withHeldQuestionnaireGeneration` options.
- `docs/references/specification.json` and `apps/csrm/src/lib/api/generated/schema.d.ts`: both enums and the optional count.
- `apps/csrm/src/features/questionnaires/questionnaire-service.ts` and its test: both closed enums, the revision schema, and the parser cases.
- `apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.tsx` and its test: `Questionnaire replaced` at both depths.
- `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`: amendment part two.

## Decisions Made

See `key-decisions` in the frontmatter. In short:
- the log is appended before any write;
- how `n` and `m` are counted;
- a missing or unreadable generation date counts everything;
- D-09 refuses with or without the acknowledgement;
- the count goes on the analyst read and governance results only;
- the Requestor summary shows explanations only for cleared answers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's existing replacement case did not exist**
- **Found during:** Task 1 RED
- **Issue:** the plan pointed at "the replacement case with `replaceUnansweredQuestionnaire: true`" in `questionnaire-generation.integration.test.ts`. The file had none, which is drift since the plan was written.
- **Fix:** the mounted replacement case was written from scratch on a fresh submitted request fixture, with `terminalJob`, `generate` and `submittedRequest` helpers.
- **Commit:** `77d2166`

**2. [Rule 2 - Missing critical] Mounted proofs of the log-first property and the Requestor projection**
- **Found during:** Task 1 RED
- **Issue:** the orchestrator required the `regenerated` event to keep 10-06's log-first property, and the plan had no mounted proof that the Requestor read drops the replacement's detail (T-10-29).
- **Fix:** added the full-log mounted case. The replacement case continues through release, return to review, replacement and release, then asserts that the owner's `regenerated` events carry only `kind` and `at`.
- **Commit:** `77d2166` (test), `d9d1ec5` (implementation)

**3. [Rule 3 - Blocking] Two pins of the closed kind list**
- **Found during:** Task 1 GREEN
- **Issue:** `questionnaire-governance.unit.test.ts` (the frozen-vocabulary test) and `contract-catalogue.integration.test.ts` (`PHASE68_GOVERNANCE_EVENT_KINDS`) pin the exact list.
- **Fix:** both lists now include `regenerated`. Both files are outside the plan's list.
- **Commit:** `d9d1ec5`

**4. [Rule 3 - Blocking] The held-generation harness could not queue a replacement or end in failure**
- **Found during:** Task 2 RED
- **Issue:** `withHeldQuestionnaireGeneration` posted without a body and asserted completion, so it could not drive the D-09 race.
- **Fix:** an optional third argument (`replaceUnansweredQuestionnaire`, `expectedStatus`), and the action receives the job id. The one existing caller is unchanged.
- **Commit:** `9290d25`

**5. [Rule 3 - Blocking] The generation unit mock keyed on the synchronous read having no `populate`**
- **Found during:** Task 2 GREEN
- **Issue:** `the workflow exposes the active generation request ids…` held every read with a `populate`. D-09's synchronous read now populates the questionnaire, so that call hung until the test timeout (cancelled, not failed).
- **Fix:** the mock now holds only the job's nested read (`questionnaire.populate`).
- **Commit:** `4416d6a`

**6. [Scope] The release result does not carry the count**
- **Found during:** Task 3 RED
- **Issue:** the release response is projected in the controller with `projectQuestionnaire`, outside the plan's two analyst paths.
- **Fix:** kept out of scope, because a released questionnaire cannot be replaced. The mounted case checks the analyst read after release instead, and the amendment states which paths carry the count.
- **Commit:** `d82f514`

---

**Total deviations:** 6 (4 blocking, 1 missing critical, 1 scope decision).
**Impact on plan:** every task, acceptance criterion and verification ran as planned. The added proofs and test-harness changes keep the refusals and projections honest. There is no content-type change and no scope creep.

## TDD Gate Compliance

Each task committed RED before GREEN: `77d2166` then `d9d1ec5`, `9290d25` then `4416d6a`, and `d82f514` then `074c63d`. Every Strapi RED failed on its target assertion, with `RED_EVIDENCE_OK` from TAP output.

Two notes:
- Task 1's two web timeline REDs failed with a `TypeError`, because the component had no presentation for the kind. That is the missing behaviour, not a fixture fault.
- Task 3's unit case for `countAnalystChangesSinceGeneration` passed at RED, because Task 1 introduced the function to build the explanation, as the plan directs. Task 3's RED gate rests on the mounted and web cases, which failed.

No refactor was needed.

## Issues Encountered

- The first Task 2 GREEN run hung on the unit mock (deviation 5). It was diagnosed from the TAP output, the mock was fixed, and the rerun passed.
- Editing `specification.json` with `sed` left the working copy with LF line endings. The diff was the two intended lines, and git stores LF, so the commit is unaffected. Later edits used the Edit tool.

## Known Stubs

None.

## Threat Flags

None. The plan's threat register covers everything this plan touched:
- T-10-27: the synchronous 409 and the in-transaction re-check, both with deep-equal mounted proofs;
- T-10-28: the `regenerated` event in the replacing transaction;
- T-10-29: the count only on analyst paths, and no replacement detail in the Requestor projection or summary, proved mounted and in the web summary.

## Deferred

Nothing is deferred. Plan 10-12 builds the hub's Replace confirmation on `revision.analystChangesSinceGeneration`. It also adds the released hint and the `QUESTIONNAIRE_RELEASED` job-failure copy (UI-SPEC §12.4), and renames the generation journey's labels.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Ready for 10-12. The analyst questionnaire read serves `revision.analystChangesSinceGeneration`, which is 0 for a fresh or just-replaced questionnaire. The hub must read the questionnaire summary through the analyst path to get it.
- A released questionnaire now refuses generation with 409 `QUESTIONNAIRE_RELEASED`, which the generation family of refusal copy (10-07) already maps. A job that loses the race reports `failureCode` `QUESTIONNAIRE_RELEASED`, which needs the §12.4 sentence.
- Amendment part two awaits orchestrator approval as a contract-gap record (G-6).

## Self-Check: PASSED

- Files: all 17 modified files exist, including `questionnaire-generation-workflow.ts`, `questionnaire-governance-log.ts` and `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`.
- Commits: `77d2166`, `d9d1ec5`, `9290d25`, `4416d6a`, `d82f514` and `074c63d` are on `post-demo` (`git rev-list --count a41108b..HEAD` = 6 before this docs commit).
- Acceptance criteria:
  - `kind: "regenerated"` is appended inside the transaction and stored by its questionnaire update;
  - both enums in the spec and the web include `regenerated`;
  - the timeline contains `Questionnaire replaced`;
  - `QUESTIONNAIRE_RELEASED` is in `generateQuestionnaire` and in the transaction;
  - both D-09 cases assert deep-equal snapshots;
  - the spec declares `analystChangesSinceGeneration` as an optional integer with minimum 0;
  - the amendment names `regenerated` and `analystChangesSinceGeneration`;
  - the full Strapi suite, the web tests and `api:check` pass.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
