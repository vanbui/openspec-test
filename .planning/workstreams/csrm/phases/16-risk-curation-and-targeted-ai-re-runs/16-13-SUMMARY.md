---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 13
subsystem: web-risk-ai-proposals-interface
tags: [risk-curation, ai-proposals, suggest-more-risks, rewrite-this-risk, decisions, undo, field-comparison, run-sheet, ai-inputs-signal, x-24, x-25, x-28, tdd]
status: complete
requirements: [ASSESS-10]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "16-11's typed layer (startRiskSuggestionsAction, startRiskRewriteAction, readRiskProposalJobAction, retryRiskProposalJobAction, readRiskAiProposalsAction, decideRiskProposalsAction), the domain rules (proposalsStatusLine, leftOutLines, similarityNote, decidedNote, changeUnitLabel, confirmableCount, acceptPreCheck, assessmentStateLine, aiInputsChangedHeadingFor, the toast builders) and family R; 16-12's FieldComparison with groups, columns, showSame and emphasis, and RiskCardActions' rewrite slot"
  - phase: 15-steerable-questionnaire-ai
    provides: "InstructionField and ShortcutHint (X-25), the AI proposals panel, proposal cards, decided list, job and hand-off patterns"
  - phase: 12-ai-context-suggestions-and-provenance
    provides: "AiRunSheetBody and its trigger, AiCitations, AiUncitedClaims, AiPolicyGate, the X-14 success toast, treatmentActionNote"
provides:
  - "ai-proposals-section.tsx (server): AiProposalsSection, AI_PROPOSALS_REGION_ID, AI_PROPOSALS_DESCRIPTION"
  - "ai-proposals-section-loader.tsx: AiProposalsSectionLoader (next/dynamic, skeleton after 300 ms), ProposalsReadError, PROPOSALS_LOAD_FAILED, SECTION_SKELETON_DELAY_MS"
  - "ai-proposals-section-client.tsx: AiProposalsSectionClient, AiProposalsSectionClientProps, ProposalRiskRef, ProposalsStartForm, OpenRewritesIndex, RiskDecidedProposals, decidedEntries, ProposalsPhoneSummary"
  - "proposed-risk-card.tsx: ProposedRiskGroup, ProposedRiskCard, SimilarRiskCompare, ReasonRow, LeftOutList, ProposalSources, RejectRemainingButton, RiskValue, useInstant, proposedRiskSubject, proposedRiskFacts, proposedRunHeading, runFactsLine, treatmentNoteFor, CompareTarget"
  - "rewrite-form.tsx: RewriteForm (controlled or not), RewriteFormProps; rewrite-form-body.tsx: RewriteFormBody, supersedeCaption"
  - "risk-rewrite.tsx: RiskRewriteSection, RewriteRisk, RiskRewriteSectionProps, rewriteRunHeading, focusLine"
  - "risk-proposal-job.tsx: RiskProposalJob, DEFAULT_JOB_TIMING, isActiveJob, jobStartedBy"
  - "use-risk-proposal-decisions.ts: useRiskProposalDecisions, useRiskProposalDensity, useIsWide, proposalKey, toastAction, ProposalDensity"
  - "suggest-more-risks-button.tsx: SuggestMoreRisksButton; risk-proposal-job-handoff.ts: handoffRiskSuggestionJob, takeRiskSuggestionJob, subscribeToRiskSuggestionHandoff"
  - "ai-assistance-domain.ts: sheetAssessmentRows; ai-run-sheet.tsx: the Assessment group, the risk Instruction rows and What to rewrite; AiRunSheetBody and AiRunSheetTrigger take riskNumber, the trigger takes name"
  - "ai-inputs-changed.tsx: AiInputsChangedBlock and aiInputsChangedSlot take heading and caption; assessmentSignalProps, suggestMoreRisksCaption, requestingAnalystSignalCaption"
  - "field-comparison.tsx: FieldComparison takes afterValue"
  - "risk-curation-domain.ts: ASK_AI_RETRY_LINE (family R reads it)"
affects: [16-14, 16-15]

actuals:
  tokens: 51800  # chars/4 over the added lines of the realized diff (207,210 characters)
  tasks: 3
  commits: 6  # git rev-list --count 58dca4dd..HEAD before the docs commit

plan_head_before: 58dca4dd3c48bb966fba1d5e2f2ac69c93c93953
plan_head_after: 566cb780e0113fda9b5ee3790c35f01189c7df03

tech-stack:
  added: []
  patterns:
    - "Frame on the server, loader in its own small client module, body through next/dynamic: the loader never sits in the module it loads"
    - "A control that ships with every card keeps a body that loads on first open (rewrite-form, rewrite-form-body)"
    - "Optimistic decisions over a memoised served list: settled changes hold until the next read replaces that list"
    - "Focus targets in a two-layout comparison are read from the layout the breakpoint shows"
    - "One density per person shared same-tab through a module store over localStorage (UI-D29)"

key-files:
  created:
    - apps/csrm/src/features/risk-curation/ai-proposals-section.tsx
    - apps/csrm/src/features/risk-curation/ai-proposals-section-loader.tsx
    - apps/csrm/src/features/risk-curation/ai-proposals-section-client.tsx
    - apps/csrm/src/features/risk-curation/ai-proposals-section.test.tsx
    - apps/csrm/src/features/risk-curation/proposed-risk-card.tsx
    - apps/csrm/src/features/risk-curation/proposed-risk-card.test.tsx
    - apps/csrm/src/features/risk-curation/rewrite-form.tsx
    - apps/csrm/src/features/risk-curation/rewrite-form-body.tsx
    - apps/csrm/src/features/risk-curation/risk-rewrite.tsx
    - apps/csrm/src/features/risk-curation/risk-rewrite.test.tsx
    - apps/csrm/src/features/risk-curation/risk-proposal-job.tsx
    - apps/csrm/src/features/risk-curation/risk-proposal-job-handoff.ts
    - apps/csrm/src/features/risk-curation/suggest-more-risks-button.tsx
    - apps/csrm/src/features/risk-curation/use-risk-proposal-decisions.ts
  modified:
    - apps/csrm/src/features/ai-assistance/ai-assistance-domain.ts
    - apps/csrm/src/features/ai-assistance/ai-inputs-changed.tsx
    - apps/csrm/src/features/ai-assistance/ai-provenance-header.test.tsx
    - apps/csrm/src/features/ai-assistance/ai-run-sheet.tsx
    - apps/csrm/src/features/ai-assistance/ai-run-sheet.test.tsx
    - apps/csrm/src/features/ai-assistance/ai-run-sheet-trigger.tsx
    - apps/csrm/src/features/ai-assistance/field-comparison.tsx
    - apps/csrm/src/features/risk-curation/risk-curation-domain.ts
    - apps/csrm/src/features/risk-curation/risk-curation-refusal-copy.ts
    - apps/csrm/src/features/risk-curation/test-fixtures.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/src/lib/performance/zod-client-boundary.test.ts

key-decisions:
  - "AiProposalsSectionLoader lives in its own module (ai-proposals-section-loader.tsx), not in the client module it loads: a loader exported from the module it lazily imports would put the whole body in the editor's first load (D-48). The zod-boundary test proves the body loads only through import()"
  - "The section takes the page's proposals read as `proposals` and reads it itself when absent (D-41); after each act and job it reads again, and the page's next read wins. A failed read keeps what is shown and, with nothing shown, offers the compact error with Try again"
  - "The status line is rendered by the client, not the server frame, so it moves at once with each decision and always equals the listed open proposals plus Open AI rewrites (X-10)"
  - "The frame follows Phase 15's panel (Card, region #ai-proposals, tabIndex -1, h2 at --text-heading-sm), not DetailSection, which takes no region id or tabIndex and sets the h2 at heading-md"
  - "Add to assessment waits for the server, then reads the proposals again to name the new Risk: the decision response carries only counts. The toast offers Open {risk number}, which lands on #risk-{id}; no Undo (D-33)"
  - "The rewrite form's body loads on first open (rewrite-form-body.tsx), so a page of Risk cards carries only the control; the control keeps its own breakpoint hook, because the decisions module reads family R"
  - "A change's Reject row renders under the comparison, not in its decision cell: the cell renders in both layouts, so a row there would mount two focused fields"
  - "The Accept pre-check combines the served acceptBlocked with acceptPreCheck over the Risk's values (the form's, when 16-14 passes them), so Confirm all counts only changes Strapi would accept (UI-D19); Strapi still decides"
  - "Suggest more risks from the signal is its own small client module that hands the job to the section (risk-proposal-job-handoff.ts), which follows it and lands focus on its job status line; it reads ASK_AI_RETRY_LINE from the domain so it reaches no family R on first load"
  - "AiRunSheetBody takes riskNumber, because the run names its Risk only by id; the sheet reuses the questionnaire-proposals kind, whose description is §10.3's word for word"

patterns-established:
  - "Proposal controls carry data-proposal-primary (Add to assessment, or Confirm, or Reject when only Reject shows) and data-proposal-reject; the job status lines carry data-ai-proposals-job-status and data-risk-rewrite-status={riskId}"

duration: 27min
completed: 2026-10-16
---

# Phase 16 Plan 13: AI Proposals and Rewrite Interface Summary

**The AI proposals section (frame on the server, body on demand), proposed-risk cards with similarity compare and Reject as duplicate, Rewrite this risk with X-24's per-change comparison and X-28's decision cells, one batch decision hook with optimistic Undo, rollback and §5.5 focus, the phone summary and full-screen sheet with one density per person, and the run sheet's and the signal's Phase 16 additions.**

## Performance

- **Duration:** about 27 minutes
- **Tasks:** 3 (Task 1 a tracer), each RED then GREEN
- **Files:** 14 created, 12 modified

## Components and their props

- **`AiProposalsSection({ assessmentId, state, viewerRaisedRequest?, children })`** (server). Region `#ai-proposals` (`tabIndex={-1}`), h2 `AI proposals`, the description (from 768px; absent for the requesting analyst), the §2.4 line with `Lock`. With `viewerRaisedRequest` it renders the h2 and the requesting-analyst line only, and never its children; once released the released line applies.
- **`AiProposalsSectionLoader(props)`** loads **`AiProposalsSectionClient({ assessmentId, state, proposals?, ownerKey, requestId, viewer?, policy?, risks?, timing? })`**.
  - `risks` is `ProposalRiskRef[]` (`{ id, riskNumber, values? }`): numbers for `Open AI rewrites` and the decided rewrites, values for `Compare with …` (offered only when the other record is loaded).
  - `policy` (12 §11.1) replaces the start form with the warning alert while decisions stay.
  - In order: status line and `Density` (from 768px, when anything is listed), the job (`RiskProposalJob`), the live announcement, the start form, the first-use or cleared empty state, the groups newest first, `Open AI rewrites`, `Decided proposals`.
  - Below 768px: the status line, the job line, `Review AI proposals` and `Suggest more risks` opening the full-screen sheet `AI proposals` (`Close AI proposals`), focus on its title or in the instruction, back to the opener on close.
- **`ProposedRiskCard`** (`li#ai-proposal-{runId}-{itemKey}`): eyebrow `Proposed risk`, subject, facts (`No Risk Type`, absent parts omitted), `Inherent` / `Residual` badges or `Not rated`, `Treatment: …`, the similarity note and compare, the treatment note, `Show proposed details` (four h4 groups, sources or `No source cited`, `Claims to check`, `Suggested controls` or `None suggested`, `Not proposed`), `Add to assessment` / `Reject` / `Reject as duplicate`. Compact: 12px padding, facts and note move into the details, badges without labels.
- **`RewriteForm({ assessmentId, riskId, riskNumber, openChanges, ownerKey, onStarted, open?, onOpenChange? })`**. The trigger is `Rewrite this risk: {n}` with `aria-haspopup="dialog"`. Pass `open`/`onOpenChange` and use `{ trigger: <RewriteForm …/>, open: () => setOpen(true) }` as `RiskCardActions`' `rewrite`.
- **`RiskRewriteSection({ assessmentId, risk, items, run, job, formHasUnsavedChanges, ownerKey, requestId, viewer?, decide?, timing?, focusFirstField? })`**. `risk` is `{ id, riskNumber, values?, controlImplementations? }`; pass the form's current values as `values` so the Accept pre-check reads what the analyst sees. It renders only while a rewrite is queued, running, failed, finished with nothing this view, or has open changes.
- **`useRiskProposalDecisions({ assessmentId, items, containerRef, fallbackFocus, viewer?, onChanged? })`** returns `{ items, pending, adding, add, confirm, confirmAll, reject, undo }`. Each act sends one `decideRiskProposalsAction`; a change's decisions pass `riskNumber` and `label`, so R3 names them.
- **Signal.** `aiInputsChangedSlot({ …, ...assessmentSignalProps({ askedAt: latestSuggestionsAskedAt(runs), generatedAt, viewerRaisedRequest, action: <SuggestMoreRisksButton assessmentId=… /> }) })`. Pass `action` only where the read allows a start.

**Phase 15's `InstructionField` is unchanged.** It already takes a session-draft `draft: { kind, recordId, ownerKey }`, so the plan's optional sixteenth-file change was not needed.

## Task Commits

1. **Task 1 (tracer): Suggest more risks and deciding proposed risks.** RED `4250f002`, GREEN `79073e5e`. The tracer gate re-ran the verify (20 of 20, typecheck clean), so the plan expanded.
2. **Task 2: Rewrite this risk and the per-change comparison.** RED `4d93149a`, GREEN `3f313a5e`.
3. **Task 3: states, the requesting analyst, phones and density, the run sheet and the signal.** RED `40ee1a8f`, GREEN `566cb780`.

## Verification

| Command | Result |
|---|---|
| Task 1 RED: vitest on `ai-proposals-section` and `proposed-risk-card` | 2 files failed to import (expected) |
| Task 1 verify (and the tracer gate's re-run) | 20 of 20 passed; typecheck clean |
| Task 2 RED: vitest on `risk-rewrite` and `ai-proposals-section` | rewrite file failed to import; the 2 index cases already passed (see notes) |
| Task 2 verify, with `field-comparison`, `risk-history-sheet` and `questionnaire-ai` | 12 files, 221 of 221 passed; typecheck clean |
| Task 3 RED: section, run sheet and header tests | 3 failed and the header file failed to import; the section-state cases already passed (see notes) |
| `src/lib/performance`, `features/risk-curation`, `features/ai-assistance` | 29 files, 697 of 697 passed |
| Task 3 verify: `pnpm --dir apps/csrm test` (full web suite) | 233 files, 5,739 of 5,739 passed |
| `pnpm --dir apps/csrm typecheck` / `lint` | 0 errors, exit 0 |

No Strapi source, spec or schema changed, so neither `api:check` nor a Strapi suite was needed. Playwright was not run, as the plan says.

**Page budget.** No route budget was measured, because the plan asks for none. Nothing in this plan reaches `/app/requests/{documentId}`: a static import walk from that page finds none of the changed modules. The new modules are not imported by any route yet (16-14 places them). The modules that will ship with the editor's first load are the loader, `rewrite-form.tsx`, `suggest-more-risks-button.tsx` and the hand-off. The zod-boundary test proves none of them reaches zod or a refusal copy module.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The loader in its own module**
- **Found during:** Task 1 GREEN
- **Issue:** The plan exports `AiProposalsSectionLoader` from `ai-proposals-section-client.tsx`. Its acceptance criterion says the loader loads that module through `next/dynamic`. A loader exported from the module it loads would ship the whole body on the editor's first load.
- **Fix:** The loader is in `ai-proposals-section-loader.tsx`, as Phase 15's panel loader is. The section test imports it from there.
- **Commit:** `79073e5e`

**2. [Rule 1 - Bug] Optimistic rewrite decisions undone on the next render**
- **Found during:** Task 2 GREEN
- **Issue:** The section filtered its Risk's changes into a new array on every render. As a result, the hook's settled changes never matched their source, and a confirmed change reopened once the transition ended.
- **Fix:** The filtered list is memoised on the served list, the Risk and the run.
- **Commit:** `3f313a5e`

**3. [Rule 2 - Missing critical] The copy guard and the zod boundary read the new modules**
- **Found during:** Task 3 GREEN
- **Issue:** Both guards list modules explicitly; this is the gap 16-11 and 16-12 closed for theirs.
- **Fix:** The copy guard lists the ten new shipped modules. A new zod-boundary block covers four things:
  - no zod in any of the new modules;
  - the section body and the rewrite form body load only through `import()`;
  - none of the four first-load modules reaches family R or `refusal-copy.ts`.
- **Commit:** `566cb780`

**4. [Rule 3 - Blocking] The rewrite control reached family R**
- **Found during:** Task 3 GREEN, through the new boundary test
- **Issue:** `rewrite-form.tsx` imported `useIsWide` from the decisions hook, which reads family R.
- **Fix:** The control keeps its own six-line breakpoint hook.
- **Commit:** `566cb780`

**5. [Rule 1 - Bug] Read paths assumed an action result**
- **Found during:** Task 3 GREEN
- **Issue:** Reset mocks resolving `undefined` logged TypeErrors from the proposals read, the job poll and the decision send.
- **Fix:** Each path treats a missing result as a failed one.
- **Commit:** `566cb780`

### Plan-shape notes

- **Files beyond the plan's fifteen:**
  - `ai-proposals-section-loader.tsx` (deviation 1);
  - `rewrite-form-body.tsx`, so the form's body loads on first open (D-48);
  - `suggest-more-risks-button.tsx` and `risk-proposal-job-handoff.ts`: the signal's `Suggest more risks` needs a client action, and the job must reach the section's on-demand body;
  - `field-comparison.tsx` (`afterValue`, so sources sit under each proposed statement in both layouts);
  - `ai-run-sheet-trigger.tsx` (`name` for §3.1's trigger names, and `riskNumber`);
  - `risk-curation-domain.ts` and `risk-curation-refusal-copy.ts` (`ASK_AI_RETRY_LINE`, one home for R2's retry line);
  - `test-fixtures.ts` and the two guard tests.
- **Built ahead of its task.** The `Open AI rewrites` index and the §2.4 / §2.6 / §2.7 states were built with Task 1's client. As a result, Task 2's two index cases and most of Task 3's section-state cases passed at RED. Only the read-error case (whose first failure was in the test itself), the run sheet and the signal failed.
- **Frame signature.** `AiProposalsSection` keeps the plan's props. It renders a Card frame, not `DetailSection` (see key decisions), and the client renders the status line.
- **`sheetAssessmentRows(section, { riskNumber })`** takes the summary's `riskProposals` section, not the run, and the risk number the page holds. It lives in `ai-assistance-domain.ts` as the acceptance criterion asks. That module ships with the editor; the function adds about 600 characters there.
- **Copy with no UI-SPEC string,** following existing analogs:
  - the compare columns for a rejected or open proposal read `Rejected proposal` / `Open proposal`;
  - compact sources toggle `Show sources` / `Hide sources`;
  - an added risk whose number the read cannot name toasts `Proposed risk added to the assessment. Review its AI-proposed fields.`;
  - a Risk number the page did not pass reads `Risk` in the index and `a risk` in a decided rewrite.
- **Treatment notes.** A proposed risk or change whose Accept the server blocks shows §4.4's Accept-not-allowed line. An AI Accept that may stand shows 12 §3.5's note.
- **Decided proposals** are not loaded through a second `next/dynamic`, unlike Phase 15's. They are part of the section's on-demand body.
- **The `What the AI used` sheet** for risk groups uses the `questionnaire-proposals` kind. Its description is §10.3's sentence word for word.

**Total deviations:** 5 auto-fixed (two Rule 1, one Rule 2, two Rule 3), plus 8 plan-shape notes.

## Issues Encountered

- Radix's popover needs `ResizeObserver`, which jsdom lacks. The rewrite form's tests install the shared `installTestResizeObserver` stub.
- One test passed `undefined` to a helper whose default argument then applied. The test now renders without a served read.

## Known Stubs

None. The components are not yet placed on a page; 16-14 places them in the editor, as planned.

## Threat Flags

None. No endpoint, auth path or schema changed.

- **T-16-36:** proposed values, instructions, reasons, citations and diff marks render as React text. A test proves injected markup never renders in a card, and another that the run sheet shows a risk instruction as text.
- **T-16-37:** each decision is one explicit act with a toast naming it, and Undo where §5.1 allows. Nothing applies automatically, and Add to assessment waits for the server.
- **T-16-SC:** no package was added.

## Next Phase Readiness

16-14 can place the following in the editor:

- `AiProposalsSection` with `AiProposalsSectionLoader` before `Identified Risks`, passing the page's `proposals`, `risks`, `policy`, `viewer` and `state`;
- `RewriteForm` as `RiskCardActions`' `rewrite`;
- `RiskRewriteSection` first in each card, loaded through `next/dynamic` when the read shows a rewrite for that Risk, with the form's unsaved state and values;
- the signal's `assessmentSignalProps` and `SuggestMoreRisksButton`.

16-14 should measure the editor's route budget once these are placed.

## Self-Check: PASSED
