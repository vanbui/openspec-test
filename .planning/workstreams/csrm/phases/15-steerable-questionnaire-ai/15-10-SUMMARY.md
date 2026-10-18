---
phase: 15-steerable-questionnaire-ai
plan: 10
subsystem: web
tags: [nextjs, typed-api-layer, server-actions, zod, refusal-copy, context-too-large, presentation-rules, route-budget, tdd]
requires:
  - phase: 15-steerable-questionnaire-ai
    provides: 15-09's six operations, components and generated client; 15-04's pinned notes phrase; 15-06's job projection
provides:
  - apps/csrm/src/features/questionnaire-ai/questionnaire-ai-service.ts (listQuestionnaireAiProposals, startQuestionnaireAiProposals, startQuestionRewrite, getQuestionnaireProposalJob, retryQuestionnaireProposalJob, decideQuestionnaireAiProposals, responseParserModule)
  - apps/csrm/src/features/questionnaire-ai/questionnaire-ai-actions.ts (the six actions, one batch decision action, QuestionnaireAiActionResult<T>)
  - apps/csrm/src/features/questionnaire-ai/questionnaire-ai-schema.ts (closed parsers typed against the domain views)
  - apps/csrm/src/features/questionnaire-ai/questionnaire-ai-domain.ts (view types and every Phase 15 label, line and rule)
  - apps/csrm/src/features/questionnaire-ai/questionnaire-ai-refusal-copy.ts (families Q1 to Q3)
  - refusal-copy.ts additions (C, D, E, I, J, the draft card, questionnaireJobFailureCopy, assessmentDraftJobFailureCopy)
  - context-too-large-files.tsx (contextTooLargeNamesMarkedNotes, ContextTooLargeFailure, ContextTooLargeFiles withSentence)
  - apps/csrm/src/features/questionnaire-ai/test-fixtures.ts (shared fixtures for 15-11 to 15-13)
affects: [15-11, 15-12, 15-13, 15-14]
actuals:
  tasks: 3
  commits: 6
plan_head_before: 4b113b4
plan_head_after: f77cc14
requirements-completed: []
completed: 2026-10-12
status: complete
---

# Phase 15 Plan 10: The Web's Questionnaire AI Layer Summary

**The web reaches the six questionnaire AI operations only through a server-only service with closed parsers registered in the parity guard, and through strict Server Actions with one batch decision action; an instruction refusal comes back as a field error with its closed reason and sentence. Every Phase 15 refusal, label and line is written once, in a zod-free module, and one `CONTEXT_TOO_LARGE` rule now serves every job surface.**

## What was built

- **Service** (`import 'server-only'`): six functions, each naming its literal contract path through the generated client; a local `call` helper normalises refusals through the transport and turns a parser failure into `normalizeResponseParserError(<operation>)`. A start with no instruction sends `{}` so the server applies its default task. Ids are checked before any call (1 to 255, trimmed); decisions are parsed against the contract's request shape (1 to 200).
- **Parsers** (`questionnaire-ai-schema.ts`): `questionnaireAiProposalsResponseSchema`, `questionnaireProposalJobResponseSchema` (with S-3's optional `failureAttachments`, at most 20, `fileName` nullable) and `questionnaireAiDecisionResponseSchema`, every bound the contract's. The item key's pattern (`i-1` to `i-30`) is registered as `narrowedPaths: ['data.items.0.itemKey']`, as the digest precedent does, because the sample generator ignores patterns. Six parity rows.
- **Actions** (`'use server'`): `listQuestionnaireAiProposalsAction`, `startQuestionnaireAiProposalsAction`, `startQuestionRewriteAction`, `getQuestionnaireProposalJobAction`, `retryQuestionnaireProposalJobAction`, `decideQuestionnaireAiProposalsAction`. Results are `{ ok: true, data }` or `{ ok: false, failure: 'field' | 'blocked' | 'retryable', status?, reason?, message }`. Starts, retry and decisions revalidate `/app/review/questionnaires/{documentId}` once on success; reads revalidate nothing. Registered in `parser-free-modules.ts`.
- **Copy:** families Q1 to Q3 in `questionnaire-ai-refusal-copy.ts` (no directive, no zod; imports `refusal-copy.ts` and `ai-assistance-domain.ts`, never the reverse). In `refusal-copy.ts`: C and D's `QUESTIONNAIRE_NOT_ANSWERABLE` (§11.2), E, I (four reasons), the draft card's `AI_PROPOSALS_OPEN`, J's neutral `AI_PROPOSAL_ALREADY_DECIDED`, and `questionnaireJobFailureCopy` / `assessmentDraftJobFailureCopy` for 10 §12.4's two codes and the draft job's code. The copy guard lists the actions, domain and refusal-copy modules.
- **`CONTEXT_TOO_LARGE`:** `contextTooLargeNamesMarkedNotes(message)` tests the pinned phrase `marked as changing the AI inputs`; `ContextTooLargeFailure({ failure, requestId, fallback })` renders the amendment's three cases (a: served notes sentence as text, then the files list without 14-16's sentence; b: `ContextTooLargeFiles` unchanged; c: the surface's fallback). `ContextTooLargeFiles` gains `withSentence` (default true, so existing callers are unchanged). Still no directive and no zod.
- **Domain:** the view types plus `pluralise`, `panelStatusLine`, `startActionLabel`, `panelGuidance`, `itemActionsFor`, `runGroupHeading`, `runFactsLine`, `leftOutLines`, `leftOutCount`, `leftOutLabel`, `unmatchedSourcesCaption`, `itemEyebrow`, `itemSubject`, `placementLine`, `visibilityLine`, `citationLabel`, `staleLine`, `REMOVAL_NOTE`, `decidedNote`, `proposedCaption`, `decisionToast`, `decisionFailureTitle`, `instructionCountLine`, `instructionTooLongLine`, `fixedQuestionsToggle`, `emptyState`, `releaseGateLine`, `draftGateLine`, `replaceOffer`, `hubProposalsLine`, `PROPOSALS_LOAD_FAILED`.

## Task commits

1. Task 1 (tracer): `c998212` (test, RED: the module did not exist) and `5e7ec58` (feat; served inventory regenerated).
2. Task 2: `a187d40` (test, RED: 18 failures; the transport's 400 case passed already, as planned) and `4e6f3d1` (feat; inventory regenerated).
3. Task 3: `64eb67d` (test, RED: 50 failures) and `f77cc14` (feat).

## Verification

- Task 1: questionnaire-ai, parity, chain, zod boundary and fixture-isolation tests 238/238; typecheck clean; `served-operations.integration` 10/10.
- Task 2: the same set plus the transport tests 353/353; typecheck clean; `served-operations.integration` 10/10; `git diff --name-only 15eb830b -- apps/csrm/src/lib/api/transport/server-client.ts` empty.
- Task 3: focused 863/863; full web unit suite 218 files, **5,211/5,211**; typecheck and lint clean; desktop `performance.spec.ts` **11/11**; `git status --short` empty after the run; `git diff --name-only 15eb830b -- apps/csrm/e2e/performance.spec.ts` empty (no `ROUTE_BUDGET_OVERRIDES` entry).

## Budget

Desktop run of 2026-10-12, 14:07:31 to 14:08:33 UTC, `apps/csrm/.tmp/performance/baseline-desktop.json`. This is Phase 15's first measurement, so each change against Phase 14's final gate includes 15-01 to 15-09's web changes as well as this plan's.

| Route | Actor | Delivered JS bytes | Phase 14 final gate | Change | Budget | Headroom | Fallback if grown |
|---|---|---|---|---|---|---|---|
| `/app/requests/{documentId}` | Requestor | **296,181** | 295,891 | +290 | 300,000 | 3,819 | Move the reason-keyed additions only the analyst hub reads (family I's four, the draft card's line, `questionnaireJobFailureCopy` and `assessmentDraftJobFailureCopy`) out of `refusal-copy.ts` into a hub-only module |
| `/app/risks/{documentId}` | Security Analyst | 293,738 | 293,710 | +28 | 300,000 | 6,262 | The same move (the risk route reaches `refusal-copy.ts` through `ai-assistance-domain.ts`) |
| `/app/questionnaires/{documentId}` | Requestor | 359,982 | 358,507 | +1,475 | 500,000 (override) | 140,018 | The same move; then load the analyst-only copy on demand |

Every other route moved by 28 to 608 bytes (the shared chunks; `/app` 229,669, `/app/review/assessments/{documentId}` 319,422 of 460,000). Every time to first byte was under 43 ms and every largest contentful paint 532 ms or less. `/app/requests/{documentId}` is the route to watch: 3,819 bytes left for 15-11 to 15-13, which import the Phase 15 modules only on analyst routes.

## Deviations and decisions

- **Q1 to Q3 moved from Task 3 to Task 2** (their tests in Task 2's RED commit): the Server Actions return the sentence to show, so the copy had to exist when they did. Task 3 kept the `refusal-copy.ts` additions, the `CONTEXT_TOO_LARGE` rule and the domain.
- **No `read` helper reuse:** `questionnaire-service.ts`'s `read` is module-private and turns a parser failure into a generic transport failure; the new service has its own `call` with `ai-assistance-service.ts`'s operation-named contract mismatch.
- **`pluralise` did not exist** in `ai-assistance-domain.ts` (the plan assumed 12-15 added it); the domain defines it, with en-AU digit grouping.
- **Q2's 400** reads as "no longer on the questionnaire" (blocked): Strapi's decision 400 carries no reason, and Edit, then confirm checks Phase 10 §1.2's field rules in the form before sending (15-12), so a field-kind 400 never reaches the action.
- **A decision's intent:** the batch action takes an optional `intent` (`confirm`, `reject`, `undo-confirmation`, `undo-rejection`) so a refused Undo names what it would have undone; absent, it reads from the first decision (`restore` defaults to undoing a confirmation).
- **The job read and the proposals read** share §14's `We couldn’t load the AI proposals` on failure; a refused retry reads Q1, as asking again would.
- **Q3's interruption** takes `{ interrupted: true }` from the caller: jobs are process-local, so after a restart the panel sees the run's `interrupted` status, not a job.
- **`fixedQuestionsToggle(1)`** reads `1 answered question stays as it is`: §7.2's pattern pluralises only the noun, which would leave "1 answered question stay as they are" (G-4 bar).
- **A visibility rule whose controlling question has no text** reads `An earlier question is “{value}”`; a boolean value reads `Yes` or `No`.
- **`replaceOffer`** reads the served `actions.replace.reason`, so the hub never re-derives 15-08's order; a released questionnaire returns no line (Phase 10 §3.3 stands).
- **`releaseGateLine`** with `countServed: false` always returns the requesting analyst's line; the caller passes it only when the questionnaire has open proposals.
- **Six component tests' mocked copy** follows the reworded J and C sentences (they pass either way; changed so no test shows a retired sentence). `questionnaire-actions.test.ts` changed because it reads the real copy.
- **Host (Linux) harness:** this host has no `apps/backend/.env`, so the harness's Strapi stopped at `App keys are required`. The run exported throwaway, run-only Strapi secrets (`APP_KEYS`, salts, JWT and encryption keys) from a scratch script; Playwright's web servers inherit them. Nothing committed; no Keycloak flag changed. A stray `apps/backend/tmp/` from a manual debug start was removed; the tree was clean after Playwright.
- **Shallow clone:** `PHASE_15_BASE=15eb830b` was beyond this clone's depth; `git fetch --deepen=200 origin csrm` reached it (no working-tree change).

## Next Phase Readiness

- **15-11 (the panel):** compose from `questionnaire-ai-domain.ts` (`panelGuidance`, `itemActionsFor`, `runGroupHeading`, `runFactsLine`, `leftOutLines`, `itemEyebrow`, `emptyState`, `startActionLabel`, `instructionCountLine`); refusals from `questionnaire-ai-refusal-copy.ts`; the job state's `CONTEXT_TOO_LARGE` through `ContextTooLargeFailure` with Q1's sentence as `fallback` (`aiProposalJobFailureCopy('CONTEXT_TOO_LARGE', null)`); decisions through `decideQuestionnaireAiProposalsAction` with `intent`. `test-fixtures.ts` holds a proposals read and two jobs.
- **15-12 (rows, provenance):** `decisionToast`, `decisionFailureTitle`, `citationLabel`, `placementLine`, `visibilityLine`, `staleLine`, `decidedNote`, `REMOVAL_NOTE`.
- **15-13 (the hub, the Requestor):** `releaseGateLine`, `draftGateLine`, `replaceOffer`, `hubProposalsLine`; `ContextTooLargeFailure` on both hub cards with 12 §11.2's sentence as `fallback`; `questionnaireJobFailureCopy` and `assessmentDraftJobFailureCopy` for the job cards; C and D's new `QUESTIONNAIRE_NOT_ANSWERABLE` sentences promise kept answers, which 15-13's session store must deliver.
- **Budget:** keep the Phase 15 modules off the Requestor's request page; if `/app/requests/{documentId}` grows past its 3,819 bytes, apply the named fallback.
- **Playwright on this host:** source a throwaway Strapi secrets script before `test:e2e` (no `.env` here).

## Self-Check: PASSED

- FOUND: the five new modules and `test-fixtures.ts`; commits `c998212`, `5e7ec58`, `a187d40`, `4e6f3d1`, `64eb67d`, `f77cc14`.
- Acceptance: the service starts with `import 'server-only'` and holds `/v1/questionnaires/{questionnaireId}/ai_proposals`; the domain imports nothing from zod; `served-operations.json` names `src/features/questionnaire-ai/questionnaire-ai-service.ts` as the web caller of all six operations; exactly one decision action; the transport and `performance.spec.ts` unchanged since `15eb830b`; `refusal-copy.ts` holds both required sentences and no `questionnaire-ai` import; the copy guard lists the refusal-copy module; `context-too-large-files.tsx` exports both, holds the phrase and has no directive; the domain holds the three start labels.

---
*Phase: 15-steerable-questionnaire-ai*
*Completed: 2026-10-12*
