---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 04
subsystem: backend-mutation-seam
tags: [editable-guard, lock-core, risk-history, risk-withdrawal, no-hard-delete, request-deletion, tdd]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "16-02's active-risk.ts (isActiveRisk) and risk-history-changes.ts (riskChanges, controlImplementationChanges, RISK_HISTORY_FIELDS); 16-03's risk-history.ts (recordRiskHistory), the withdrawal facts and the four Phase 16 reasons"
  - phase: 12-ai-assisted-assessment
    provides: "12-11's AssessmentWorkflowError.reason and transition option, 12-06's persistAssessmentDraft, 12-07's AI field edit marking, 12-12/12-13's ai-proposal-decisions.ts and the control implementation inner functions"
  - phase: 13-request-collaboration
    provides: "13-06/14-08's request delete override (REQUEST_HAS_NOTES, REQUEST_HAS_ATTACHMENTS) under withRequestLock"
provides:
  - "assessment-workflow.ts: type AssessmentActor, assertAssessmentEditable, isAssessmentEditable, withAssessmentLock; withMutableAssessmentMutation and releaseAssessment rebuilt on withAssessmentLock; created history rows in persistAssessmentDraft"
  - "risk-workflow.ts: type HistorySource, historySourceFields, assertRiskActive, createRiskWithinMutation, updateRiskWithinMutation; createAssessmentRisk and updateRisk are the wrapper plus one inner call"
  - "control-implementation-workflow.ts: updateControlImplementationWithinMutation; the three inner functions take actorDocumentId and source, refuse a withdrawn risk and record control-implementation-added/-updated/-removed; the HTTP functions are the wrapper plus one inner call"
  - "ai-proposal-decisions.ts: RISK_WITHDRAWN refusal of the whole batch before any write; an added suggestion records an ai-run row with the suggestion key as proposalItem"
  - "csrm-assessment-request controller delete: 409 REQUEST_HAS_ASSESSMENT first"
  - "harness setRiskWithdrawalFactsFixture; apps/backend/tests/risk-no-delete.unit.test.ts (the static no-delete guard, exporting scanForRiskDeletes)"
affects: [16-05, 16-06, 16-07, 16-08, 16-09, 16-10, 17, 17.1, 18]

actuals:
  tokens: 20000
  tasks: 4
  commits: 7

plan_head_before: a97eec92d58dff5d5b461a48d0c7efcc255c9394
plan_head_after: b270e96dc7c71fce9e4342b8a80d4c0c6e6828ad

tech-stack:
  added: []
  patterns:
    - "One guard (assertAssessmentEditable) inside one lock core (withAssessmentLock); HTTP paths are the wrapper plus one transaction-scoped inner call returning { ...record, changed }"
    - "The transition is a function of the inner result: (result) => result.changed ? 'accepted-edit' : 'none'"
    - "An inner update decides whether to write by comparing documentIds before reading labels, writes nothing for a no-op, and records the history row from a post-write re-read"

key-files:
  created:
    - apps/backend/tests/risk-no-delete.unit.test.ts
  modified:
    - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
    - apps/backend/src/api/csrm-risk/services/risk-workflow.ts
    - apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts
    - apps/backend/src/api/csrm-assessment/services/ai-proposal-decisions.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/backend/tests/assessment-workflow.unit.test.ts
    - apps/backend/tests/risk-curation.integration.test.ts
    - apps/backend/tests/ai-proposal-decisions.integration.test.ts
    - apps/backend/tests/request-workflow.integration.test.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts

key-decisions:
  - "The inner risk functions take the plan's object input { strapi, assessment, actorDocumentId, source, ... } plus humanAnalyst on the update (Phase 12's W-3 edit marking needs it); the control implementation inner functions keep 12-13's executed (strapi, input) signature, with actorDocumentId and source added to input"
  - "A no-op update writes nothing at all (no update call, no updatedAt bump, no history row, no transition), so a repeated PATCH leaves the risk, its assessment and its history deep-equal"
  - "Relation labels in an updated row come from a post-write re-read with the relations populated (owner displayName, type/system/asset name); the control label is the control's name, and every control row names { documentId, controlNumber, name }"
  - "An added Phase 12 suggestion records source ai-run with the risk's provenance run and the suggestion key as proposalItem (when 1 to 64 characters); its Undo (restore of an added suggestion) records control-implementation-removed with source analyst: the AI proposed adding, never removing"
  - "decideAiProposals checks every named risk (exists, same assessment, active) in one pre-pass before any write; a withdrawn risk refuses the whole batch, a dismissal included"
  - "releaseAssessment also runs on withAssessmentLock and assertAssessmentEditable (same 409 as before), so every assessment mutation passes the one guard"
  - "The request deletion refusal sits inside withRequestLock as its first check; a missing request still gets the core delete's answer"
  - "The static guard also refuses entityService-style delete(uid, id), knex del() on the two tables and any core router for either UID that is not limited by only: [...] without delete"

patterns-established:
  - "Later mutations (16-05 withdraw/reinstate, 16-10 decisions, Phases 17, 17.1, 18) call withMutableAssessmentMutation once and the inner functions as often as needed"

requirements: [ASSESS-09]
requirements-completed: []  # shared ID: marked complete by the phase's last plan (shared-ID gate)

duration: 75min
completed: 2026-10-15
status: complete
---

# Phase 16 Plan 04: The Mutation Seam, Risk History on Every Path and No Hard Delete Summary

**One editable guard inside one lock core, transaction-scoped risk and control implementation inner functions that record their history rows, withdrawn risks read-only on every path (409 RISK_WITHDRAWN), the edit transition only on content change, a static proof that nothing deletes a risk or a history row, and requests with an assessment refused deletion (409 REQUEST_HAS_ASSESSMENT).**

## Performance

- Started: 2026-10-15T05:53Z (after 16-03, `a97eec92`)
- Tasks: 4 of 4 (Task 1 a tracer: its verify re-ran green end to end before expanding)
- Commits: 7 task commits plus this summary

## Accomplishments

- `assertAssessmentEditable({ assessment, actor })` is the one guard (400 blank actor, 409 `ASSESSMENT_NOT_MUTABLE`); its comment names G-11 (Phase 17) and ASSESS-24 (Phase 17.1) as the two extensions. `isAssessmentEditable` is its non-throwing form.
- `withAssessmentLock(strapi, id, work)` is the serialise, transaction, lock and load core; `withMutableAssessmentMutation` keeps its executed signature (`strapi`, `assessmentDocumentId`, `analystDocumentId`, `transition`, `mutate`) and becomes the core + guard + captured pre-edit state + mutate + transition.
- Every analyst path writes its history row in the change's transaction: Add risk and the draft (`created`, analyst / ai-run with the draft run), PATCH from the editor, the register and the service agent (`updated`, only the changed fields, nothing for a no-op), control implementation add, edit and removal (`control-implementation-added/-updated/-removed` with the control named and the removed values kept), and a Phase 12 suggestion added as planned (ai-run).
- `assertRiskActive` refuses every mutation of a withdrawn risk with 409 `RISK_WITHDRAWN` (editor and register PATCH, service agent PATCH, control create/update/delete, Phase 12 decisions), always after the editable guard, so a released assessment still answers `ASSESSMENT_NOT_MUTABLE`.
- The request delete refuses a request with an assessment before the notes and files checks.

## Task Commits

1. Task 1 RED `c2cd767f` test(16-04): expect one guard, a lock core and history on every risk update
2. Task 1 GREEN `1e9323dd` feat(16-04): route risk updates through the editable guard with history
3. Task 2 RED `2954bcfa` test(16-04): expect history on every risk path and RISK_WITHDRAWN on withdrawn risks
4. Task 2 GREEN `0c080003` feat(16-04): record every risk change and refuse changes to withdrawn risks
5. Task 3 `35fa4a1b` test(16-04): expect no review withdrawn by a decision or edit that changes nothing
6. Task 4 RED `f420725a` test(16-04): prove no risk is ever deleted and refuse deleting a request with an assessment
7. Task 4 GREEN `b270e96d` feat(16-04): refuse deleting a request that has a risk assessment

## Verification

- Task 1 RED: `assessment-workflow.unit` + `risk-curation.integration` 44/48 (4 assertion failures: guard not exported, no PATCH row twice, inner update not exported). GREEN verify (backend tsc, tests tsc, `assessment-workflow.unit`, `risk-curation.integration`, `assessment-workflow.integration`, `iam-human-selectors.integration`): exit 0, 97/97.
- Task 2 RED: `risk-curation` + `ai-proposal-decisions` 30/35 (5 assertion failures). GREEN verify (both tsc, those two files, `risk-register.integration`, `iam-human-selectors.integration`): exit 0, 60/60.
- Task 3 verify (tests tsc, `ai-proposal-decisions`, `risk-curation`): exit 0, 37/37.
- Task 4 RED: `risk-no-delete.unit` + `request-workflow.integration` 11/13 (the request with an assessment was deleted, 204; the request with everything reported `REQUEST_HAS_NOTES`). GREEN: those two plus `request-notes` and `request-attachments`: 81/81.
- Full Strapi suite (`pnpm --dir apps/backend test`, after backend tsc): exit 0; 1890 tests, 1889 pass, 0 fail, 1 skipped (the pre-existing Windows POSIX-mode skip, IN-209), about 27 minutes.

No test reached the 600,000 ms timeout; the mounted batch case (two inner updates in one mutation) ran under its 30-second limit.

**Whether 12-12 and 12-13 already took no transition for dismissals:** yes. `decideAiProposals` already passed `transition: (result) => result.contentChanged ? "accepted-edit" : "none"`, and `contentChanged` was already true only when a control implementation was created or removed or a field's review state changed (D-23 counts a review-state change as content). No source change was needed in Task 3.

**Files the static guard scanned:** every `.ts` file under `apps/backend/src`, 259 at this commit: `admin` (1), `index.ts` (1), `api/application` (3), `api/csrm-administration` (9), `api/csrm-ai-run` (6), `api/csrm-analyst-insight` (15), `api/csrm-assessment` (13), `api/csrm-assessment-request` (26), `api/csrm-control` (3), `api/csrm-control-implementation` (5), `api/csrm-current-user` (4), `api/csrm-information-asset` (5), `api/csrm-information-system` (5), `api/csrm-question` (4), `api/csrm-questionnaire` (29), `api/csrm-request-attachment` (8), `api/csrm-request-note` (6), `api/csrm-risk` (8), `api/csrm-risk-history-event` (4), `api/csrm-risk-type` (3), `api/function` (3), `api/function-api` (3), `api/idambox-user` (3), `api/role` (3), `bootstrap` (13), `csrm` (49), `iam` (12), `keycloak` (7), `middlewares` (3), `policies` (2), `utils` (3). The test asserts more than 100 files and that `risk-workflow.ts`, the risk router, `risk-history.ts`, the history router and `control-implementation-workflow.ts` are among them; it found nothing.

## Decisions Made

See `key-decisions`. What later plans need to know:

- Call shapes: `createRiskWithinMutation({ strapi, assessment, actorDocumentId, source, fields })`, `updateRiskWithinMutation({ strapi, assessment, actorDocumentId, source, riskDocumentId, fields, humanAnalyst })`; `createControlImplementationWithinMutation(strapi, { riskDocumentId, assessmentDocumentId, body, actorDocumentId, source })`, `updateControlImplementationWithinMutation(strapi, { implementationDocumentId, riskDocumentId, assessmentDocumentId, body, actorDocumentId, source })`, `removeControlImplementationWithinMutation(strapi, { implementationDocumentId, riskDocumentId, assessmentDocumentId, actorDocumentId, source })`. Each returns `{ ...record, changed }` (removal: `{ documentId, changed: true }`). `fields`/`body` are parsed inside (closed parsers), so a batch may pass raw values.
- `HistorySource` is `{ kind: "analyst" } | { kind: "ai-run", runDocumentId, proposalItem? }`; `historySourceFields(source)` maps it onto the writer's entry. 16-03's writer was not extended: no `batchId` was needed here.
- `withAssessmentLock`'s `work` receives `{ assessment, trx }` (the plan's name); `withMutableAssessmentMutation`'s `mutate` keeps its executed `{ assessment, assessmentRequest, transaction }`.
- The risk and control implementation controllers already mapped `AssessmentWorkflowError.reason` into `error.details.reason` (12-11, CR-02), so no controller change was needed; both now carry `RISK_WITHDRAWN`.

## Deviations from Plan

**1. [Plan detail] No controller change for the reason mapping**
- Both controllers' `safeError(ctx, status, message, reason?)` already forwarded `AssessmentWorkflowError.reason` (executed 12-11 and CR-02). The plan listed them in `files_modified`; the mounted tests prove `RISK_WITHDRAWN` reaches `error.details.reason` on every route.

**2. [Plan detail] Task 3 has no GREEN commit**
- Both Task 3 cases passed at RED: dismissals already took no transition (12-12/12-13), and Task 1/2 had wired `result.changed` through `updateRisk` and the control routes. Task 3 is one `test(...)` commit, as 16-03's Task 3 was.

**3. [Rule 1 - Test kept true] The 16-03 legacy-row case changed**
- 16-03's "a Risk drafted before Phase 16 reads as active with no history rows" used drafted risks as the legacy rows. From this plan a draft records `created` rows (D-19), so the case now asserts the drafted risks are active and uses a directly written risk (no workflow, no history) as the pre-Phase 16 row. Commit `2954bcfa`.

**4. [Plan detail] Inner control implementation signature**
- The plan's uniform `{ strapi, assessment, actorDocumentId, source }` object input was applied to the new risk functions; the control implementation functions keep 12-13's executed `(strapi, input)` signature with `actorDocumentId` and `source` added, so 12-13's caller changed by two properties only.

**5. [Plan detail] Task 3's no-op cases live in `ai-proposal-decisions.integration.test.ts`**
- They need a release-ready in-review assessment, which that file's `makeReleaseReady` already builds; `risk-curation.integration.test.ts` holds the Task 1 identical-PATCH case (deep-equal risk, assessment and history).

**6. [Plan detail] Acceptance grep "each of its three inner functions calls recordRiskHistory"**
- The three control functions call `recordImplementationHistory`, one local helper that calls `recordRiskHistory` with the control named; each calls `assertRiskActive` directly.

**Total deviations:** none affecting behaviour beyond the plan; one test kept true to the new behaviour and five plan-shape notes.

## Issues Encountered

- A Python heredoc with nested quotes failed in Bash once; the edit was redone through a script file. No effect on the result.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register: the request delete gains a refusal (narrower surface); no route or schema is added.

## Next Phase Readiness

- 16-05 can build withdraw and reinstate as `withMutableAssessmentMutation` + `assertRiskActive`/its inverse + `recordRiskHistory` kinds `withdrawn`/`reinstated`, and mount `GET /api/v1/risks/{riskId}/history` over `readRiskHistory`.
- 16-10 can call `createRiskWithinMutation` and `updateRiskWithinMutation` with `source: { kind: "ai-run", runDocumentId, proposalItem }` from inside one decision batch.

## Self-Check: PASSED

All created files exist; commits c2cd767f, 1e9323dd, 2954bcfa, 0c080003, 35fa4a1b, f420725a and b270e96d are in history.
