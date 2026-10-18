---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 11
subsystem: web-risk-curation-typed-layer
tags: [risk-curation, withdrawal, reinstatement, undo, history, ai-proposals, decisions, refusal-copy, session-drafts, parity, served-operations, tdd]
status: complete
requirements: [ASSESS-09, ASSESS-10]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "16-03 to 16-10's published contract: RiskCurationRequest/Response, RiskHistoryResponse (envelope v1, changes nullable), RiskProposalJobResponse, RiskAiProposalsResponse, AiProposalRunDecision on Phase 12's decision operation, the Phase 16 conflict reasons"
  - phase: 15-steerable-questionnaire-ai
    provides: "the questionnaire AI schema/service/actions/domain analog, family Q (Q1's instruction and OWN_REQUEST sentences reused), the B-1 placement of analyst-only refusal copy"
  - phase: 12-ai-context-suggestions-and-provenance
    provides: "aiProposalDecisionResponseSchema, family J, aiPolicyRefusalCopy, aiJobFailureCopy"
  - phase: 13-request-assignment-and-notes
    provides: "session-drafts.ts (SessionDraftKind), the transport's 403 reason"
provides:
  - "risk-curation-schema.ts: riskCurationResponseSchema, riskHistoryEventSchema, riskHistoryResponseSchema, parseRiskHistoryPage, riskProposalJobSchema, riskProposalJobResponseSchema, riskAiProposalItemSchema, riskAiProposalsSchema, riskAiProposalsResponseSchema, riskProposalItemKeySchema, riskProposalDecisionSchema, riskProposalDecisionsSchema; type re-exports RiskHistoryEvent, RiskProposalJob, RiskAiProposals, RiskAiProposalItem"
  - "risk-curation-service.ts: withdrawRisks, reinstateRisks, getRiskHistory, startRiskSuggestions, startRiskRewrite, getRiskProposalJob, retryRiskProposalJob, listRiskAiProposals, decideRiskProposals, contractResponseParsers, responseParserModule; types RiskCurationBody, RiskHistoryQuery"
  - "risk-curation-actions.ts ('use server'): withdrawRisksAction, reinstateRisksAction, undoWithdrawalAction, undoReinstatementAction, readRiskHistoryAction, startRiskSuggestionsAction, startRiskRewriteAction, readRiskProposalJobAction, retryRiskProposalJobAction, readRiskAiProposalsAction, decideRiskProposalsAction; type RiskCurationActionResult<T>"
  - "risk-curation-domain.ts (zod-free): the view types; showCounts, partitionByWithdrawal, overallRatingHint, wordDiff, WORD_DIFF_MAX_LENGTH, RISK_FIELD_LABELS, CONTROL_IMPLEMENTATION_FIELD_LABELS, RISK_UNIT_FIELDS, fieldLabel, changeUnitLabel, confirmableCount, acceptPreCheck, ACCEPT_NOT_ALLOWED_LINE, leftOutLines, leftOutCount, similarityNote, decidedNote, rewriteDecidedSummary, assessmentStateLine, proposalsStatusLine, latestSuggestionsAskedAt, aiInputsChangedHeadingFor, historyEntryPresentation, historyCountLine, honestStartLine, showsHonestStart, withdrawToast, reinstateToast, undoneToast, discardToast, decisionToast, decisionFailureTitle, curationReasonError, reasonTooLong, CURATION_REASON_MAX_LENGTH, RISK_RATINGS"
  - "risk-curation-refusal-copy.ts (zod-free, no directive): riskCurationRefusal (R1), riskAiStartRefusal (R2), riskDecisionRefusal (R3), riskProposalJobFailureCopy (R4), requestDeletionRefusal, RISK_WITHDRAWN_EDIT"
  - "session-drafts.ts: SessionDraftKind gains risk-withdraw-reason, risk-reinstate-reason, risk-suggest-instruction, risk-rewrite-instruction, risk-reject-reason"
  - "Registrations: the parity guard (nine parsers), parser-free-modules (the actions module), the interface copy guard (actions, domain, refusal copy), the served inventory's web callers for the nine Phase 16 calls"
affects: [16-12, 16-13, 16-14, 16-15]

actuals:
  tokens: 43100  # chars/4 over the added lines of the realized diff (172,429 characters, served inventory excluded)
  tasks: 3
  commits: 6  # git rev-list --count fe0163c7..HEAD before the docs commit

plan_head_before: fe0163c77e0335722b68bddbc105268528941556
plan_head_after: ff9d5dbc3d7e59e7ed4984829c7f627cc817153a

tech-stack:
  added: []
  patterns:
    - "One typed service function per operation with a closed parser, one Server Action per user act, a zod-free domain module for every rule and string"
    - "Analyst-only refusal copy in a feature module that refusal-copy.ts never imports, so the Requestor's request page does not grow (B-1)"
    - "Word-level LCS over words and spaces, after the common start and end, in one flat Uint16Array, bounded at 2,000 characters"

key-files:
  created:
    - apps/csrm/src/features/risk-curation/risk-curation-schema.ts
    - apps/csrm/src/features/risk-curation/risk-curation-service.ts
    - apps/csrm/src/features/risk-curation/risk-curation-service.test.ts
    - apps/csrm/src/features/risk-curation/risk-curation-actions.ts
    - apps/csrm/src/features/risk-curation/risk-curation-actions.test.ts
    - apps/csrm/src/features/risk-curation/risk-curation-domain.ts
    - apps/csrm/src/features/risk-curation/risk-curation-domain.test.ts
    - apps/csrm/src/features/risk-curation/risk-curation-refusal-copy.ts
    - apps/csrm/src/features/risk-curation/risk-curation-refusal-copy.test.ts
    - apps/csrm/src/features/risk-curation/test-fixtures.ts
  modified:
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/features/parser-free-modules.ts
    - apps/csrm/src/lib/session-drafts/session-drafts.ts
    - apps/csrm/src/lib/session-drafts/session-drafts.test.ts
    - apps/csrm/src/lib/api/refusal-copy.test.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - docs/references/served-operations.json

key-decisions:
  - "Family R lives in features/risk-curation/risk-curation-refusal-copy.ts, not refusal-copy.ts (B-1): refusal-copy.ts ships on /app/requests/{documentId}, which had about 1,973 bytes of headroom; refusal-copy.ts is unchanged and a test proves it neither imports nor repeats family R"
  - "R2 and R3 were built with Task 2, because the AI and decision actions return their sentences; Task 3 added R4 and the request-deletion line"
  - "The actions module, not the domain module, is the parser-free registration (the 15-10 analog); the domain's zod-freedom is proved by its own test and the verify grep"
  - "The decision response is read with 12-12's aiProposalDecisionResponseSchema; no second parser"
  - "The instruction's 500-character rule is checked in the action as the server checks it, returning INSTRUCTION_TOO_LONG with Q1's sentence and the count, so nothing is sent"
  - "A curation act also revalidates /app/review/assessments (16-06: list counts drop withdrawn risks); a decision revalidates the assessment page, the review list and /app/risks"
  - "aiInputsChangedHeadingFor reads the latest completed risk-suggestions run (latestSuggestionsAskedAt), not lastAskedAt, because only suggestions move the signal's baseline (16-10: CONTEXT_WIDE_AI_OPERATIONS)"

patterns-established:
  - "RiskCurationActionResult<T> = { ok: true, data } | { ok: false, kind: 'field' | 'blocked' | 'retryable', status?, reason?, message, detail? }"

duration: 26min
completed: 2026-10-16
---

# Phase 16 Plan 11: The Web's Typed Risk Curation Layer Summary

**One typed path from the interface to Strapi for every Phase 16 act: nine closed-parser service calls, eleven validated Server Actions (Undo both ways sends `undo: true`), a zod-free domain module with every rule and string the UI-SPEC fixes, and refusal family R in an analyst-only module.**

## Performance

- **Duration:** about 26 minutes
- **Started:** 2026-10-15T15:33Z
- **Completed:** 2026-10-15T15:59Z
- **Tasks:** 3 (one tracer, two TDD)
- **Files:** 10 created, 7 modified

## Accomplishments

- **Services.** `withdrawRisks` and `reinstateRisks` send `{ riskIds, reason }` or `{ riskIds, undo: true }`, never both. `getRiskHistory` closes its query to `page` and `pageSize`. The two AI starts send an empty body or the instruction. The job follow and retry, the proposals read, and `decideRiskProposals` send one request per act on Phase 12's decision operation, as `{ target: { kind: 'proposal', runId, item }, action, reason? }` entries. Every response passes a closed parser registered in the parity guard, in all of its modes.
- **Actions.** All eleven take `.strict()` inputs:
  - `riskIds` is 1 to 200 distinct ids.
  - A reason is 1 to 500 characters after trimming, with §6.1 and §6.2's field errors.
  - An instruction is blank or at most 500 characters.
  - `focus` must be a non-empty unique subset (`[]` reads `Choose at least one part to rewrite.`).
  - `decisions` is 1 to 200 entries.

  A refusal returns its closed reason, kind and family R sentence. Reads revalidate nothing.
- **Domain.** It covers:
  - the `Show` counts and the overall-rating hint, which reads active risks only and never writes;
  - the bounded word diff;
  - the change labels and the Accept pre-check, which mirrors 16-02's `aiAcceptCheck` (derived residual, a plan with text, no planned control);
  - the left-out lines and count;
  - the similarity, decided and state lines;
  - the history entry for every §8.3 row, an unknown kind and a malformed entry;
  - the honest start, the status line and the UI-D26 heading;
  - every toast and failure title.
- **Copy guard.** It now reads the actions, domain and refusal-copy modules.

## Task Commits

1. **Task 1 (tracer): withdraw one risk end to end.** RED `76870a60`, GREEN `4841455b`. The tracer gate re-ran the verify end to end and it passed, so the plan expanded.
2. **Task 2: every other service and action, the registrations, the session-draft kinds and the served inventory.** RED `91e26e71`, GREEN `7eaee655`.
3. **Task 3: the domain rules and families R2 to R4.** RED `974f6397`, GREEN `ff9d5dbc`.

## Verification

| Command | Result |
|---|---|
| Task 1 RED: vitest risk-curation, refusal-copy, parity | 4 files failed to import (expected) |
| Task 1 verify: vitest risk-curation, `refusal-copy.test.ts`, parity, then `typecheck` | 5 files, 427 of 427 passed; typecheck clean |
| `SERVED_OPERATIONS_WRITE=1 served-operations:write` (Task 1), then the check | 11 passed, 1 skipped (written); then 12 of 12 |
| Task 2 RED | 39 failed, 230 passed; typecheck 28 errors (expected) |
| `SERVED_OPERATIONS_WRITE=1 served-operations:write` (Task 2) | 11 passed, 1 skipped (written) |
| Task 2 verify: vitest risk-curation, parity, operation chain, zod boundary, then `typecheck`, the backend test tsc and `served-operations.integration` | 6 files, 311 of 311 passed; typecheck clean; tsc clean; served operations 12 of 12, 0 fail |
| Task 3 RED | 36 failed (the domain and R4 cases) |
| Task 3 verify: `pnpm --dir apps/csrm test` (full web suite) | 226 files, 5,549 of 5,549 passed |
| `pnpm --dir apps/csrm typecheck` / `lint` (the same script) | 0 errors, exit 0 |
| The domain module's zod grep | 0 |
| `interface-copy-guard.test.ts` | 225 of 225 passed |

The plan's verify did not require the full Strapi suite, so it was not run. No Strapi source, spec or schema changed, so `api:check` was not needed.

**Page budget.** No module that `/app/requests/{documentId}` loads changed in a way that ships. `refusal-copy.ts` is byte-identical. `session-drafts.ts` gained only type members and a comment, which compile away. So the route's 1,973 bytes of headroom are untouched and no performance run was needed.

## Served inventory diff

Each of these rows gained `webCallers: ["src/features/risk-curation/risk-curation-service.ts"]`:

- `POST /v1/risk_assessments/{assessmentId}/risk_withdrawals`
- `POST …/risk_reinstatements`
- `GET /v1/risks/{riskId}/history`
- `POST …/risk_suggestions`
- `POST /v1/risks/{riskId}/rewrite`
- `GET /v1/risk_proposal_jobs/{jobId}`
- `POST …/{jobId}/retry`
- `GET /v1/risk_assessments/{assessmentId}/ai_proposals`

`POST /v1/risk_assessments/{assessmentId}/ai_proposal_decisions` added the risk-curation service beside `ai-assistance-service.ts`. The only other change is `generatedAt`.

## Decisions Made

See `key-decisions`. What 16-12 to 16-15 need:

- **Refusal copy.** Import family R from `features/risk-curation/risk-curation-refusal-copy.ts`, never from `refusal-copy.ts`.
  - An edit, control change or Phase 12 decision refused with `RISK_WITHDRAWN` reads `riskCurationRefusal(failure, 'edit')`, or `RISK_WITHDRAWN_EDIT`.
  - The plan that wires the editor's 409 path in `assessment-actions.ts` (16-14) uses it there. That is a server module, so this costs no client bytes.
- **`decideRiskProposalsAction`.**
  - It takes optional `intent`, `riskNumber` and `label`, so R3 can name the Risk and the change and tell a refused Undo of a confirmation from one of a rejection.
  - Without `intent`, it reads the first decision: `accept` means confirm, `reject` means reject, `restore` means undo-confirmation. An Undo of a rejection must pass `intent: 'undo-rejection'`.
- **`historyEntryPresentation`.** It returns icon names (lucide) as strings. The component maps them to icons and formats `{instant}` with X-3.
- **`honestStartLine(date)`.** It takes a date that is already formatted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Undo's 400 is not the reason field's error**
- **Found during:** Task 1 GREEN
- **Issue:** R1 maps a 400 to the reason field's error. An Undo sends no reason, and the server answers a 400 when a withdrawal has no earlier reason to restore. "Give a reason…" would be untrue there.
- **Fix:** `riskCurationRefusal(..., { undo: true })` reads a 400 as R1's blocked unknown-state sentence. A test covers it.
- **Commits:** `4841455b`, `7eaee655`

**2. [Rule 2 - Missing critical] The copy guard reads the new modules**
- **Found during:** Task 3 GREEN
- **Issue:** `interface-copy-guard.test.ts` lists files explicitly. Without an entry, the new copy would go unguarded, as Phase 15's would have (15-10 added its own).
- **Fix:** The guard now lists the actions, domain and refusal-copy modules.
- **Commit:** `ff9d5dbc`

### Plan-shape notes

- **Family R's home (B-1).**
  - The plan places family R in `refusal-copy.ts` and its acceptance criterion greps that file for the `RISK_WITHDRAWN` sentence. The pilot flagged that `/app/requests/{documentId}` had about 1,973 bytes of headroom, and `refusal-copy.ts` ships on that route.
  - Following 15-10's B-1 precedent for family Q, family R went into an analyst-only feature module. `refusal-copy.ts` is unchanged. `refusal-copy.test.ts` gained a guard proving it neither imports family R nor repeats the `RISK_WITHDRAWN` sentence.
  - The sentence is exported as `RISK_WITHDRAWN_EDIT` from the new module. This deliberately departs from that one acceptance criterion's file, to keep the route budget.
- **R2 and R3 moved to Task 2.** The AI and decision actions return their sentences. Task 2's RED tested them word for word. Task 3 added R4 and the request-deletion line.
- **Parser-free registration.** The plan names `risk-curation-domain.ts`. The registry holds transport-adjacent modules that parse no response, and 15-10 registered its actions module. So `risk-curation-actions.ts` is registered there. The domain's zod-freedom is tested in `risk-curation-domain.test.ts` and by the verify grep.
- **The decision response** uses 12-12's `aiProposalDecisionResponseSchema` from the service, as the plan says. The schema module adds no second parser.
- **Signatures following the executed contract.**
  - `riskDecisionRefusal` takes an optional `intent` (Undo copy) beside `riskNumber` and `label`.
  - `riskAiStartRefusal` takes `{ instructionLength?, operation? }`. A 400 with no reason is the focus error only for a rewrite.
  - `riskProposalJobFailureCopy(job, riskNumber, { interrupted? })`.
  - `requestDeletionRefusal` returns null for any reason other than `REQUEST_HAS_ASSESSMENT`.
  - `aiInputsChangedHeadingFor({ askedAt, generatedAt })` is paired with `latestSuggestionsAskedAt(runs)`.
  - The domain also exports `leftOutCount`, `rewriteDecidedSummary`, `showsHonestStart`, `decisionFailureTitle`, `fieldLabel`, the label maps and `curationReasonError`, which the components need.
- **`acceptPreCheck(…, riskNow)`** takes the Risk's current values (or the form's). It derives the residual from likelihood and consequence as the server does. A proposed risk passes `riskNow: null`.
- **Left out.** `accept-not-permitted`, `accept-with-planned-control`, `sources-dropped`, `suggestions-dropped` and `suggestions-capped` have no left-out line. The first two show on the item (§3.1). The others concern a kept item. An unknown code reads `A proposal CSRM couldn’t use.`
- **Fallback names.** These follow existing analogs and have no UI-SPEC string of their own:
  - An unreadable actor reads `a Security Analyst` (15's decided proposals).
  - An added risk with no number reads `Added to the assessment`.
  - A withdrawal-closed change with no Risk number reads `the risk`.
  - R4's `RISK_WITHDRAWN` with no number reads `The risk`.
  - An unknown unit reads `AI change` (Voice's noun).
  - An `edit` refusal that is a failure reads Phase 10's `The assessment service is unavailable. Please try again later.`
- **The served inventory** was regenerated in Task 1 as well as Task 2, so every commit keeps the operation-chain test green.

**Total deviations:** 2 auto-fixed (both Rule 2), 9 plan-shape notes. The family R placement is the one that departs from an acceptance criterion's file; the reason is above.

## Issues Encountered

None. Every RED failed as expected, and every GREEN passed on its first run.

## Known Stubs

None. `requestDeletionRefusal` has no caller, because the web offers no request deletion (UI-D34). It is the tested line for any later surface. The service test proves no feature service calls `DELETE` on an assessment request path.

## Threat Flags

None. No endpoint, auth path or schema changed. Every input is closed by a `.strict()` schema with the server's bounds (T-16-32). Every response is closed and in the parity guard (T-16-33). No package was added (T-16-SC).

## Next Phase Readiness

16-12 to 16-15 can render and send every Phase 16 act through these actions, and show every string from the domain and family R modules.

## Self-Check: PASSED

- All 10 created files exist.
- All 6 commits exist: `76870a60`, `4841455b`, `91e26e71`, `7eaee655`, `974f6397`, `ff9d5dbc`.
