---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 09
subsystem: backend-ai-risk-proposals
tags: [ai-proposals, risk-suggestions, risk-rewrite, jobs, registry, lapse, supersession, authorization, contract, tdd]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "16-02's item core and Risk envelope (foldItemStates, isUnitStale, aiAcceptCheck, residualRatingAfter, isActiveRisk); 16-04's editable guard and lock core (assertAssessmentEditable, isAssessmentEditable, withAssessmentLock, assessmentReleasePopulate); 16-05's withdrawal route; 16-08's context, adapters, providers (buildAssessmentContextFor, toRiskSuggestionsProposal, toRiskRewriteProposal, selectRiskProposalProvider, setDeterministicRiskProposalHold) and the run record's dispatch"
  - phase: 15-steerable-questionnaire-ai
    provides: "createProposalJobRegistry, ProposalJobFailure, parseAnalystInstruction, repeatsRequestorText, loadRequestorTextCorpus"
  - phase: 12-ai-context-suggestions-and-provenance
    provides: "the run record (createRunningAiRun, completeAiRun, failAiRun, appendAiRunDecisions, parseRunProposalFor, parseRunDecisionsFor), evaluateAiDataPolicy, sourceCatalogueFromContextSummary"
provides:
  - "proposal-job-registry.ts: ProposalJobTarget (QuestionnaireProposalJobTarget | AssessmentProposalJobTarget); ProposalJob, ProposalJobStart, ProposalJobRegistryOptions and ProposalJobRegistry generic over the target with the questionnaire kind as the default; a target-aware enqueue and activeFor; failedFor"
  - "risk-proposal-workflow.ts: startRiskSuggestions, startRiskRewrite, getRiskProposalJob, retryRiskProposalJob, projectRiskProposalJob, projectedRiskProposalJobs, activeRiskProposalJobs, settledRiskProposalJob, riskProposalPolicyRefusal, RiskProposalWorkflowError, RISK_PROPOSAL_RUN_LIMIT, types RiskProposalJob, RiskProposalJobInput, RiskProposalViewer, RiskProposalStrapi"
  - "risk-proposals-read.ts: loadRiskProposalRuns, openRiskProposalSummary, readRiskAiProposals, DECIDED_RISK_ITEMS_LISTED, RISK_PROPOSAL_RUNS_READ_LIMIT, types OpenRiskProposalSummary, LoadedRiskProposalRun"
  - "Routes (routes/risk-proposals.ts) and handlers (controllers/risk-proposals.ts): startSuggestions, startRewrite, getJob, retryJob, listProposals; CSRM_ASSESSMENT_OPERATIONS.startRiskSuggestions, .startRiskRewrite, .getRiskProposalJob, .retryRiskProposalJob, .listRiskAiProposals"
  - "Catalogue: function.risk_ai_proposals.propose_api (.api.01, .api.02), .job_read_api, .retry_api, .proposals_read_api, granted to role.security_analyst alone; the Phase 16 design note extended"
  - "Spec: tag risk-ai-proposals, five operations, RiskSuggestionsRequest, RiskRewriteRequest, RiskProposalJobResponse, RiskProposalJob, RiskAiProposalsResponse, RiskAiProposals, RiskAiAction, RiskAiOpenByRisk, RiskAiRunFacts, RiskAiSimilarity, RiskAiDecisionFacts, RiskAiProposalItem"
affects: [16-10, 16-11, 16-12, 16-15, phase-17]

actuals:
  tokens: 43500  # chars/4 over the added lines of the realized diff (173,885 characters, generated client and inventory excluded)
  tasks: 3
  commits: 5  # git rev-list --count 2ec2f371..HEAD before the docs commit

plan_head_before: 2ec2f3714ab03bba08db2b8cf82f087f4d4a2f7f
plan_head_after: 7e7d2a133be4d9ce107aa602661151e39aab3d7c

tech-stack:
  added: []
  patterns:
    - "One proposal job registry, generic over a discriminated target; Phase 15's questionnaire jobs keep their top-level fields as the default kind"
    - "Start checks under the assessment's lock (read only) so reservations meet the run cap one at a time; the provider call outside any lock; completion under the lock without the guard or the edit transition"
    - "Item state, open count and per-risk open counts folded on read from the immutable proposal and the append-only decisions; nothing else stored"

key-files:
  created:
    - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-workflow.ts
    - apps/backend/src/csrm/ai/risk-proposals/risk-proposals-read.ts
    - apps/backend/src/api/csrm-assessment/routes/risk-proposals.ts
    - apps/backend/src/api/csrm-assessment/controllers/risk-proposals.ts
    - apps/backend/tests/risk-proposals.integration.test.ts
  modified:
    - apps/backend/src/csrm/ai/proposal-job-registry.ts
    - apps/backend/src/api/csrm-assessment/operations.ts
    - apps/backend/src/policies/csrm-authorization.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - docs/references/served-operations.json
    - apps/backend/tests/proposal-job-registry.unit.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts

key-decisions:
  - "The registry is generic over the target: ProposalJob<TInput, TTarget = QuestionnaireProposalJobTarget> adds questionnaireId and questionId beside `target` only for the questionnaire kind, and a start without a target is Phase 15's questionnaire start, so questionnaire-proposals-workflow.ts compiled and passed with no edit"
  - "The start's checks after OWN_REQUEST run inside withAssessmentLock (read only: no guard transition, no write) so concurrent starts meet the run cap one at a time, as Phase 15's BE01 made the questionnaire starts do; OWN_REQUEST is checked before the lock and again inside it"
  - "The job projection keeps Phase 15's initiatedByViewer and the optional failureAttachments (a CONTEXT_TOO_LARGE failure that counted included files) beside the plan's fields"
  - "The read lists the active job per target and the latest retained failed job of each target with none active (the registry's new failedFor)"
  - "Display values name a Risk Type, system or asset by its record's name, and No longer available when the record is gone; an open change against a withdrawn or missing Risk reads stale"
  - "canUndo is true only for a rejected item on an editable assessment: an accepted item's Undo is AI_PROPOSAL_UNDO_UNAVAILABLE (16-01)"
  - "A lapse is by system with cause assessment-not-editable; a supersession on withdrawal is by the Risk's withdrawnBy (system when unreadable) with cause risk-withdrawn; a newer rewrite's supersession is by its initiator with cause newer-rewrite and its run"
  - "A retry re-checks, under the lock, failed-and-idle (409) before the guard, then the Risk, the instruction against the Requestor's text now, the cap and the policy"
  - "The one Phase 16 design note is extended (the catalogue test requires exactly one note starting Phase 16), naming the five Functions and the requesting-analyst refusal by record"

requirements: [ASSESS-10]
requirements-completed: []  # shared ID: marked complete by the phase's last plan

duration: 78min
completed: 2026-10-15
status: complete
---

# Phase 16 Plan 09: Targeted AI Re-runs as Recorded Jobs Summary

**"Suggest more risks" and "Rewrite this risk" served to human Security Analysts who did not raise the request: each start is a job on Phase 15's registry (now generic over a questionnaire or assessment target), each job records one run naming the analyst, instruction, provider and context summary, completion writes immutable proposals under the assessment's lock with lapse and supersession as decision events, and one read folds every item's state; nothing reaches a Risk.**

## Performance

- **Duration:** about 78 minutes, 47 of them the full Strapi suite
- **Started:** 2026-10-15T11:13:18Z
- **Completed:** 2026-10-15T12:31:33Z
- **Tasks:** 3 (Task 1 tracer and Task 2 RED then GREEN, Task 3 one commit)
- **Files:** 5 created, 12 modified

## Accomplishments

- **Registry (the pilot's ruling).** `ProposalJobTarget` is `{ kind: "questionnaire"; questionnaireId; questionId }` or `{ kind: "assessment"; assessmentId; riskId }`. Every job carries `target`. The executed form is generic over the target kind with the questionnaire kind as the default: `ProposalJob<TInput, TTarget = QuestionnaireProposalJobTarget>` keeps the top-level `questionnaireId` and `questionId` only for a questionnaire job, and `ProposalJobStart` without a `target` is Phase 15's start, validated as before. An assessment start is validated by kind (ids non-blank, at most 255 characters, `riskId` null or non-blank). `activeFor(scopeId)` matches the target's questionnaire or assessment. Single flight still holds only while a job is queued or running (`activeByKey`), so no wrapper was added. **`questionnaire-proposals-workflow.ts` needed no edit** (the verify's freeze diff against `01dc4118` is empty), and the existing registry cases pass unchanged.
- **Starts (D-22, D-25 to D-27, D-29).** In order: the closed body (400) → the human analyst fact (403) → the assessment, or the Risk and its assessment, exists (404) → OWN_REQUEST (403). Then, under the assessment's lock with no write:
  - the editable guard (409 ASSESSMENT_NOT_MUTABLE);
  - for a rewrite, the Risk is active (409 RISK_WITHDRAWN);
  - the instruction is valid (400 with its reason) and repeats no Requestor text (400);
  - the run cap of 100, counting reservations (409 AI_PROPOSAL_RUN_LIMIT);
  - the AI data policy (409 with its reason).
  The job is then reserved under `suggestions:{assessmentId}` or `rewrite:{riskId}`, or the active job is returned (202 either way).
- **Execution.** The job re-checks the guard, the Risk, the cap and the policy before anything is built. A context over its bound fails with CONTEXT_TOO_LARGE and no run. The run (with `risk` for a rewrite, `jobId`, `attempt`, the instruction and the v5 summary) is created just before the provider call, which runs outside any lock. The output then passes through 16-08's adapter.
- **Completion (D-24, D-40).** Completion runs under `withAssessmentLock`, with no guard and no edit transition:
  - an assessment that is no longer editable makes every item `lapsed` (by `system`, cause `assessment-not-editable`);
  - a Risk withdrawn meanwhile makes every unit `superseded` (by the analyst who withdrew it, cause `risk-withdrawn`);
  - otherwise a rewrite with at least one unit supersedes the older open units of the same Risk (by its initiator, cause `newer-rewrite` with its run).
  Any failure after the run exists closes it as failed with a safe code.
- **Job read and retry (Phase 13 D-18).** Any human analyst who did not raise the request reads a job (an unknown or expired one is 404). A retry is allowed only for a failed job whose target is idle (409 otherwise). It meets the start's checks again under the lock, and the retrier is the new run's `initiatedBy`.
- **Read (D-41).** One bounded run read (101 rows), folded per operation, with the open items first (runs newest first) and then the 50 most recently decided. It returns:
  - `openCount` and `openByRisk`, derived on read;
  - `lastAskedAt`;
  - the actions: `suggest` and `rewrite` need the guard, the cap and the policy; `decide` needs the guard only;
  - the run facts: initiator, times, provider, instruction, focus, Risk, outcome, counts and adjustments by code;
  - the items: state, `stale` for an open change, `current` and `proposed` with relation names, `similarTo` with the resolved risk number, `aiAccept` and `acceptBlocked`, sources as Phase 12's citations, `uncited`, suggested control labels, `decision`, `addedRisk` and `canUndo`;
  - the jobs.
  People resolve in one batched read, as do Risks, relation names and controls.
- **Grants and contract (D-43).** Each of the five operations has an API-only Function on `role.security_analyst` alone, a literal in `HUMAN_ANALYST_ONLY_OPERATIONS` and the denial sentence `CSRM risk AI proposals are limited to human Security Analysts.`. The spec gains the five operations and 12 components, and the served inventory serves all five with no web caller yet (16-11 adds them).

## Measured counts (W3, against today's catalogue)

| Measure | Before 16-09 | After 16-09 |
| --- | --- | --- |
| Catalogue Functions | 65 | 69 |
| Catalogue FunctionApis | 167 | 172 |
| `role.security_analyst` functionIds | 58 | 62 |
| Served operations in `served-operations.json` (matrix served rows) | 102 | 107 |
| Plugin routes (matrix plugin rows) | 32 | 32 |
| Human-analyst-only literals in the matrix fixture (non-insight + insight) | 26 + 5 | 31 + 5 |

The new Functions carry no `applicationId`, so they seed under `idambox-csrm` (the default). No role holds `function.identity_provisioning.api`. `UNSERVED_REASONS` and its `IAM_SCIM_RESERVATIONS` spread were not touched. `served-operations.integration.test.ts` passed in both inventory regenerations (11 passed, 1 skipped) and in the full suite.

## Task Commits

1. Task 1 RED: `61e29a59` test(16-09): expect Suggest more risks as a recorded human-analyst job with a folded read
2. Task 1 GREEN: `9da3890c` feat(16-09): serve Suggest more risks and the risk AI proposals read
3. Task 2 RED: `814d5a98` test(16-09): expect Rewrite this risk, retry and every run refusal
4. Task 2 GREEN: `05860d23` feat(16-09): serve Rewrite this risk and retries with lapse and supersession
5. Task 3: `7e7d2a13` test(16-09): prove the risk AI proposal operations across the six actors

**Plan metadata:** the `docs(16-09)` commit adding this summary with STATE.md, state.json and ROADMAP.md.

## Verification

| Command | Result |
| --- | --- |
| Task 1 RED: `tsc -p tests/tsconfig.json` | fails: `ProposalJobStart`/`ProposalJob` have no `target` and take one type argument (RED) |
| Task 1 verify: both `tsc`; `proposal-job-registry` unit, `risk-proposals` and `contract-catalogue` integration | 41/41 pass |
| Task 1 served inventory (`SERVED_OPERATIONS_WRITE=1 … served-operations:write`) | 11 pass, 0 fail, 1 skipped |
| Task 2 RED: `risk-proposals`, `contract-catalogue` | 32 pass, 11 fail (every new case: 405 for the unmounted routes, open instead of lapsed, the catalogue rows) |
| Task 2 verify: `risk-proposals`, `contract-catalogue` | 43/43 pass |
| Task 2 served inventory | 11 pass, 0 fail, 1 skipped |
| `pnpm --dir apps/csrm api:check` + `git update-index --refresh` (after Tasks 1 and 2) | exit 0, exit 0 |
| `cmp` of the two catalogue copies (after Tasks 1 and 2) | identical |
| Freeze diff `git diff --name-only 01dc4118 -- …/questionnaire-proposals-workflow.ts` | empty |
| Task 3: `authorization-matrix` integration + `authorization-matrix-provenance` unit | 157/157 pass |
| Task 3 verify: `tsc`; the FULL Strapi suite (`pnpm --dir apps/backend test`) | 1,984 passed, 0 failed, 1 skipped of 1,985 (exit 0, 2,806 s), including `active-risk-readers.unit.test.ts` and `served-operations.integration.test.ts` |
| `pnpm --dir apps/csrm typecheck`; `vitest run src/features/contract-response-parity.test.ts` | exit 0; 197/197 |
| No test ran to the 600,000 ms timeout (Pitfall 1): the longest case was the 201-risk and 100-run case at about 6 s | pass |

## Decisions Made

See `key-decisions` above. What 16-10 and 16-11 need:

- `readRiskAiProposals({ strapi, assessmentDocumentId, viewer: { documentId, humanAnalyst } })` and `openRiskProposalSummary(strapi, assessmentDocumentId)` → `{ openCount, openByRisk }` (fails open on a damaged run, logged once).
- An item's `itemKey` is `s-1`…`s-8` for a suggestion and the unit key (`u-…`) for a change; `decision.cause` is `{ kind, runId, riskId }` with nulls for the kinds that do not carry them.
- `canUndo` covers rejections only. 16-10 decides whether a restored item reads `open` (the fold already does) and adds accepted-item Undo facts if the contract changes.
- The deterministic provider's hold (`setDeterministicRiskProposalHold`) and a patch of `deterministicRiskProposalProvider.suggest`/`rewrite` (a counter and a one-shot failure) are the mounted test seams. The matrix fixture uses the same patch to leave one failed job.

## Deviations from Plan

### Auto-fixed Issues

None. No failure needed a fix outside the planned work.

### Plan-shape notes

**1. [Plan detail] Followed the executed code where the written-ahead plan differs**
- The run cap and the start's other checks run inside `withAssessmentLock`, not on a lock-free read-only load. The lock adds no write, but concurrent starts then cannot pass the cap together (Phase 15 BE01).
- The registry gained `failedFor(scopeId)` (the latest retained failed job per key), which the read needs for "the latest failed one still retained". The plan named only `enqueue` and `activeFor`.
- The job projection also carries `initiatedByViewer` and the optional `failureAttachments`, as Phase 15's proposal job does.
- `assertAnalystAssessmentScope` runs in each handler first, as the curation handlers do, before the service's 404 and OWN_REQUEST checks.
- `riskProposalPolicyRefusal` is exported so the read's `suggest` and `rewrite` actions use the start's own policy check.

**2. [Plan detail] Requestor text corpus without a questionnaire**
- Phase 15's `loadRequestorTextCorpus` takes a questionnaire id. A request with no questionnaire passes an id that names no questionnaire, so the corpus reads the request, its notes and its files, and no answers.

**3. [Plan detail] The design note**
- The catalogue test requires exactly one note starting `Phase 16 `. The existing note was extended with the five Functions and the OWN_REQUEST sentence rather than adding a second note. Task 1's commit already names `retry_api`, which Task 2 adds.

**4. [Plan detail] Test fixtures**
- The released assessment and the lapse case set the release facts directly (`assessmentStatus: approved`, `approvedBy`, `approvalDate`), because the release route also needs readiness. The withdrawal-meanwhile case uses the real withdrawal route, so `withdrawnBy` is Bob.
- The INSTRUCTION_REPEATS_REQUESTOR_TEXT case stores a longer submitted answer on the UAT-A-like questionnaire. Its seeded answers are under 60 characters.

**Total deviations:** none auto-fixed; 4 plan-shape notes. No scope creep.

## Issues Encountered

- Bash heredocs holding template literals failed in this shell (as 16-08 found), so script edits were written as files in the scratchpad and run from there.

## Known Stubs

None. The five operations have no web caller yet: 16-11 builds their services and regenerates the served inventory's callers (planned).

## Threat Flags

None beyond the plan's register:
- **T-16-24:** API-only Functions, five human-only literals and OWN_REQUEST in every service entry, proven by mounted 403s and five matrix rows.
- **T-16-25:** the guard and the Risk check at enqueue, again at execution, and the lapse at completion.
- **T-16-26:** the policy at enqueue and execution, and the refusal test records no provider call and no run.
- **T-16-27:** single flight, the 100-run cap with reservations, the 200-entry bound and the 101-row read.

## Next Phase Readiness

- 16-10 decides proposals on the folded state this read serves. Undo of a rejection is offered when the guard allows it, and the decision path must run inside `withMutableAssessmentMutation`, never around `withAssessmentLock` again (Pitfall 1).
- 16-11 adds the web services and parsers for `RiskProposalJob` and `RiskAiProposals`.
- ASSESS-10 is not marked complete: it is a shared ID gated to the phase's last plan.

## Self-Check: PASSED
