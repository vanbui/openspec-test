---
phase: 15-steerable-questionnaire-ai
plan: 11
subsystem: web
tags: [nextjs, ai-proposals-panel, x-24, x-25, optimistic-ui, session-drafts, next-dynamic, one-open-form, tdd]
requires:
  - phase: 15-steerable-questionnaire-ai
    provides: 15-10's service, actions, domain, refusal copy and ContextTooLargeFailure
provides:
  - apps/csrm/src/features/questionnaire-ai/ai-proposals-panel.tsx (AiProposalsPanel, the server-safe frame; AiProposalsOutcome)
  - apps/csrm/src/features/questionnaire-ai/ai-proposals-panel-loader.tsx (AiProposalsPanelLoader with next/dynamic and the 300 ms skeleton; RetryProposalsRead)
  - apps/csrm/src/features/questionnaire-ai/ai-proposals-panel-client.tsx (AiProposalsPanelClient, useProposalDecisions, the start form, the job state)
  - apps/csrm/src/features/questionnaire-ai/proposal-item-card.tsx (ProposalRunGroup, ProposalItemCard, RejectRow, Eyebrow, QuestionValues, useInstant)
  - apps/csrm/src/features/questionnaire-ai/decided-proposals.tsx (DecidedProposals, loaded on demand)
  - apps/csrm/src/features/questionnaire-ai/proposal-edit-form.tsx (ProposalEditForm, draftOfProposal, editsFromDraft)
  - apps/csrm/src/features/questionnaire-ai/instruction-field.tsx (InstructionField, ShortcutHint)
  - apps/csrm/src/features/ai-assistance/field-comparison.tsx and field-comparison-domain.ts (FieldComparison, compareFields; X-24)
  - questionnaire-governance.tsx exports QuestionForm (with label, section and change options), QuestionFormScope, useOpenQuestionForm, DraftQuestion, NEW_SECTION, parseChoices, isChoiceType
  - status-badge aiReview value `stale`; session-drafts' six Phase 15 kinds; proposalAnchorsOf in the domain
affects: [15-12, 15-13, 15-14]
actuals:
  tasks: 4
  commits: 9
plan_head_before: 635557e
plan_head_after: 7710864
requirements-completed: []
completed: 2026-10-12
status: complete
closes: [UAT-017]
---

# Phase 15 Plan 11: The AI Proposals Panel Summary

**The analyst's questionnaire page has an AI proposals panel directly after the provenance header in every state before the draft (read-only after it). The analyst asks the AI with or without an instruction, follows the job, and decides each proposal on its own: Confirm and Reject apply at once and roll back with Q2's copy, Undo restores, Edit, then confirm opens Phase 10's question form in the card and waits for the server, Reject takes an optional reason, and Reject remaining rejects a request's open proposals in one call. Nothing typed is lost, and one question form is open at a time across the editor and the panel.**

## What was built

- **Page and slot.** The page reads `listQuestionnaireAiProposals` beside the questions and the session, renders `AiProposalsPanel` on the server and hands it to `QuestionnaireReview` as the `aiProposals` slot (the existing slot pattern), with the section choices for an addition's edit form. A 403 `OWN_REQUEST` renders §12's line; any other failure the compact `We couldn’t load the AI proposals` with `Try again`. `proposalAnchors` (runs with an open proposal, and their card anchors) reach the revision timeline as arrays and become sets in the review.
- **Frame and loader.** The frame is a `section` with `id="ai-proposals"` and `tabIndex={-1}`, h2 `AI proposals` and the description. `AiProposalsPanelLoader` loads the body with `next/dynamic` and a skeleton (a field and two cards) shown only after 300 ms.
- **Client.** The status line (focus target, tracks optimistic decisions), the density control from 768px (`csrm:ai-proposals-density:{ownerKey}` in local storage; comfortable below 768px), the §2.4 guidance with Phase 10's Return to analyst review dialog where it applies, the job state, the start form, the answered list, the empty states, the open groups and the decided list.
- **Decisions** (`useProposalDecisions`): `useOptimistic` over the served items plus a settled layer, so an accepted decision holds until the revalidated read replaces it; one `decideQuestionnaireAiProposalsAction` call per act with its `intent`; a refusal's danger toast carries Q2's sentence and `Try again` (retryable) or `Refresh page` (blocked), and `AI_PROPOSAL_STALE` and `AI_PROPOSAL_ALREADY_DECIDED` refresh; success toasts and Undo per §5.1; focus per §5.5 (the next open card's Confirm, or Reject on a stale card, else the status line; the reopened card's Confirm after Undo).
- **Cards.** Eyebrow by kind (a rewrite without an instruction is `Plain-language rewrite`), subject, the `Changed since proposed` badge and line with Reject only, content by kind (the X-24 comparison for a change; the proposed values, `Where it goes` and `Shown when` for an addition; the current values and the removal sentence for a removal), `Reason` and citations (request fields through `AiCitations`, notes as record links to `#note-{id}`, files, answered questions and the instruction as plain text), actions named by subject. Compact density uses 12px padding and hides the reason and sources behind `Show reason and sources`.
- **Group.** h3, facts line, `{a} left out` figure link with its list, the unmatched-sources caption, `Show what the AI used` (Phase 12's trigger) and `Reject remaining ({k})` with its row.
- **Comparison** (X-24, shared): `compareFields` (zod- and React-free) and `FieldComparison` (a table with a hidden caption, `scope="col"` headers and `Changed` row notes from 768px; stacked pairs below; unchanged rows behind `Show {n} unchanged {field|fields}`; `renderEmphasis` for Phase 16).
- **Instruction field** (X-25): no `maxLength`, count once it holds text, the over-500 line on submit, Q1's instruction refusals beside it, kept in the session store and restored with its caption, `beforeunload` while it holds text, cleared once the AI has been asked; `Ctrl`/`⌘` `Enter` submits.
- **Job state.** `The AI is preparing proposals`, the caption, `Started by {name}.`, `Attempt {n}`, `Check again` after 30 seconds; completion refreshes and the live region announces `{n} AI proposals are ready to review.` once the run is listed (focus unmoved), or `The AI proposed nothing new for this questionnaire.`; a failed job shows `The AI request didn’t finish` with Q3's sentence or 15-10's `ContextTooLargeFailure` (Q1's sentence as the fallback) and `Retry AI proposals`, with the start form below.
- **One open form** (UI-D10): `QuestionFormScope` wraps the review's three populated states; the editor reports its form and the panel its Edit, then confirm form; an open editor form disables the panel's Confirm, Edit then confirm and start with the caption (Reject stays), and an open Edit, then confirm disables the editor's Add, Edit, Delete and Release.

## Task commits

1. Task 1 (tracer): `5db89b0` (test, RED: no module) and `161013b` (feat).
2. Task 2: `eed892a` (test, RED: 15 failures) and `e48a3cb` (feat).
3. Task 3: `cb31018` (test, RED: 13 failures; the session-draft case fails the typecheck) and `27e1459` (feat).
4. Task 4: `4f86f96` (test, RED: 9 failures), `c49152f` (feat) and `7710864` (the governance journey's scoped locator).

## Verification

- Task 1: questionnaire-ai and zod boundary 121/121; questionnaires, guards and app 558/558; typecheck clean.
- Task 2: comparison, cards and badge, with neighbours, 546/546; no hex colour literal in the Phase 15 components or the comparison.
- Task 3: questionnaire-ai and session drafts 131/131.
- Task 4: questionnaire-ai and questionnaires 431/431; full web unit suite 221 files, **5,282/5,282**; typecheck and lint clean. Desktop Playwright: `performance.spec.ts` **11/11**; `questionnaire-governance-workflow.spec.ts` **1/1** after the locator change (first run: a strict-mode violation, below). `git status --short` empty after each run; `git diff --name-only 15eb830b -- apps/csrm/e2e/performance.spec.ts` empty. No claim is made for 375 here (15-14's journey).

## Budget

Desktop run of 2026-10-12, 14:39:44 to 14:40:44 UTC.

| Route | Actor | Delivered JS bytes | 15-10's figure | Change | Budget | Headroom | Fallback if grown |
|---|---|---|---|---|---|---|---|
| `/app/requests/{documentId}` | Requestor | **297,992** | 296,181 | +1,811 | 300,000 | 2,008 | Render the proposal card's `Changed since proposed` badge from a panel-local presentation instead of the shared `aiReview` family (the `stale` value and `HistoryIcon` ship wherever `StatusBadge` does); then 15-10's move of the hub-only copy out of `refusal-copy.ts` |
| `/app/risks/{documentId}` | Security Analyst | 293,906 | 293,738 | +168 | 300,000 | 6,094 | The same badge move |
| `/app/questionnaires/{documentId}` | Requestor | 360,197 | 359,982 | +215 | 500,000 (override) | 139,803 | The same badge move |

The panel itself ships on none of these routes (it loads on demand on the analyst's questionnaire page). The Requestor's request page grew with the shared status badge and a shared-chunk regrouping: its decoded bytes rose by 2,180 while its delivered bytes rose by 1,811, the signature of a newly split small chunk rather than new code. Every time to first byte was under 40 ms and every largest contentful paint 560 ms or less. 15-12 and 15-13 measure against this table; `/app/requests/{documentId}` has 2,008 bytes left.

## Deviations and decisions

- **The loader is its own module** (`ai-proposals-panel-loader.tsx`): `next/dynamic` inside the client module it loads would split nothing. The client module uses `next/dynamic` for the decided list (`decided-proposals.tsx`, its own module so it can load on demand). The Edit, then confirm form is a static import: it opens on a click and must be there at once.
- **The panel is a server-rendered slot**, not a component of `QuestionnaireReview`: the review is a client component, and the slot keeps the panel's code off its first load, as the provenance and request-context slots do. Client components inside the slot read the review's `QuestionFormScope`.
- **The status line lives in the client body**, so it follows optimistic decisions and is the focus target of §5.5.
- **`beforeunload` only**, through `useUnloadWarning`, not `useLeaveGuard`: §3.2 says in-app navigation keeps the text, so no dialog (Phase 13's composer does the same).
- **Density key** uses the draft owner key (opaque, per person), as no user id reaches this page.
- **Rewrite jobs** are not listed in the panel's job state: the job read carries no question text; 15-12's row line shows a rewrite's state.
- **`Show what the AI used`** keeps Phase 12's trigger (outline, named `Show what the AI used`); §4.1's longer name `…for the request at {time}` needs a name prop on the shared trigger, left to 15-12 if the walk asks for it.
- **Confirm with edits and no change** sends a plain `accept` (the contract's `edits` needs at least one field) and its toast has no `with your edits`.
- **The governance journey changed one locator**: the panel's §2.4 guidance offers the same Return to analyst review dialog, so the page-wide `getByRole('button', { name: 'Return to analyst review' })` matched two buttons; the criterion now opens the governance panel's (`getByLabel('Questionnaire governance')`). The plan said "unchanged"; the UI-SPEC requires the second control, so the assertion changed deliberately.
- **The badge test's value count** rises from 31 to 32 with `stale`; the governance test's one-open-form case names the start `Suggest follow-up questions` (the fixture has answered questions).
- **Focus after closing a row or form** moves in an effect in the closing render (the governance editor's pattern), not in an animation frame.

## Next Phase Readiness

- **15-12 (rows and provenance):** the rewrite control reuses `InstructionField` with kind `question-rewrite-instruction` and the question's id; its toasts and lines are in the domain. The open-proposal link targets `ai-proposal-{runId}-{itemKey}` (cards hold `tabIndex={-1}`). `QuestionForm` now takes `submitLabel`, `pendingLabel`, `discardLabel`, `showSection` and `onDraftChange`.
- **15-13 (hub, Requestor):** `InstructionField` with kinds `generation-instruction` and `replacement-instruction` (record: the request) and `unsaved-answers` (record: the questionnaire, JSON); `ContextTooLargeFailure` for the hub cards; the budget table above.
- **15-14:** the panel's journey at 375 and 1440; the Requestor's request page has 2,008 bytes of headroom.

## Self-Check: PASSED

- FOUND: every listed module; commits `5db89b0` to `7710864`.
- Acceptance: `ai-proposals-panel.tsx` has no directive; `ai-proposals-panel-client.tsx` starts with `'use client'` and uses `next/dynamic`; the page calls `listQuestionnaireAiProposals(`; `field-comparison-domain.ts` imports neither zod nor React; `field-comparison.tsx` holds `scope="col"` and `renderEmphasis`; no hex colour literal; `instruction-field.tsx` sets no `maxLength` and calls `writeSessionDraft`; `SessionDraftKind` lists the six kinds beside `note` and `assign` with a test; the client renders `ContextTooLargeFailure`; the panel test names include `requesting analyst`, `Requestor is answering` and `CONTEXT_TOO_LARGE`; the card test names include `Edit, then confirm`, `Reject remaining` and `Escape`; the governance module exports `QuestionForm`, `QuestionFormScope` and `useOpenQuestionForm`.

---
*Phase: 15-steerable-questionnaire-ai*
*Completed: 2026-10-12*
