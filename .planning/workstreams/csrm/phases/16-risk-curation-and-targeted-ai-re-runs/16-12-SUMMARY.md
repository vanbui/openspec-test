---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 12
subsystem: web-risk-curation-interface
tags: [risk-curation, withdrawal, reinstatement, undo, history, field-comparison, status-badge, x-27, x-28, x-29, tdd]
status: complete
requirements: [ASSESS-09]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "16-11's typed layer: withdrawRisksAction, reinstateRisksAction, undoWithdrawalAction, undoReinstatementAction, readRiskHistoryAction, the domain rules (historyEntryPresentation, historyCountLine, honestStartLine, showsHonestStart, wordDiff, the toast builders, curationReasonError) and family R"
  - phase: 15-steerable-questionnaire-ai
    provides: "FieldComparison, compareFields, unchangedToggleLabel; the phone-sheet and density-per-person patterns"
  - phase: 12-ai-context-suggestions-and-provenance
    provides: "the X-13 side-sheet frame pattern (frame ships, body on demand), the X-14 Undo toast (successToast, toastAction)"
  - phase: 13-request-assignment-and-notes
    provides: "session-drafts.ts and useUnloadWarning"
provides:
  - "risk-card-actions.tsx: RiskCardActions, RiskCardActionsProps, RiskCardRewrite"
  - "withdraw-risk-form.tsx: WithdrawRiskForm, WithdrawRiskFormProps"
  - "use-risk-withdrawal.ts: useRiskWithdrawal, UseRiskWithdrawalInput, WithdrawalCandidate, WithdrawalRefusal, RiskWithdrawalFacts"
  - "withdrawn-risk-card.tsx: WithdrawnRiskCard, WithdrawnRiskCardProps, WithdrawnRisk"
  - "risk-history-trigger.tsx: RiskHistoryTrigger, RiskHistoryDialog (controlled), their props"
  - "risk-history-frame.tsx: RiskHistoryFrame, RiskHistorySkeleton, RiskHistoryMessage, useSkeletonDelay, RiskHistorySheetProps"
  - "risk-history-sheet.tsx: RiskHistorySheet (the on-demand body)"
  - "status-badge.tsx: statusPresentation.risk = { withdrawn: Withdrawn, neutral, ArchiveIcon }"
  - "field-comparison.tsx: FieldComparison gains columns, groups, showSame, emphasis; type ComparisonGroup"
  - "field-comparison-domain.ts: wordDiff, WORD_DIFF_MAX_LENGTH, WordDiffSegment (moved), emphasisPieces, EmphasisPiece, changedFieldsToggleLabel"
  - "risk-curation-domain.ts: curationRetryLine; re-exports wordDiff, WORD_DIFF_MAX_LENGTH, WordDiffSegment"
affects: [16-13, 16-14, 16-15]

actuals:
  tokens: 35700  # chars/4 over the added lines of the realized diff (142,988 characters)
  tasks: 3
  commits: 6  # git rev-list --count c9066375..HEAD before the docs commit

plan_head_before: c9066375fdd829e07fd358db41a7ed262d1b1c7d
plan_head_after: 041b5178d9ed8af17e063b48d36bd96137d72ef9

tech-stack:
  added: []
  patterns:
    - "Optimistic list placement with useOptimistic over the served Risks: a card is pending while the list it shows in differs from the last read, so a refusal rolls back by ending the transition"
    - "Both breakpoint layouts in the markup (card actions, comparison) so a phone never paints the desktop pills before hydration; only interaction-opened surfaces (the withdraw sheet) branch on matchMedia"
    - "Frame ships with the page, body through next/dynamic whose failed load resolves to an in-frame Try again (12-15 WR-307, the quick-find loader)"

key-files:
  created:
    - apps/csrm/src/features/risk-curation/risk-card-actions.tsx
    - apps/csrm/src/features/risk-curation/risk-card-actions.test.tsx
    - apps/csrm/src/features/risk-curation/withdraw-risk-form.tsx
    - apps/csrm/src/features/risk-curation/withdraw-risk-form.test.tsx
    - apps/csrm/src/features/risk-curation/use-risk-withdrawal.ts
    - apps/csrm/src/features/risk-curation/withdrawn-risk-card.tsx
    - apps/csrm/src/features/risk-curation/withdrawn-risk-card.test.tsx
    - apps/csrm/src/features/risk-curation/risk-history-trigger.tsx
    - apps/csrm/src/features/risk-curation/risk-history-frame.tsx
    - apps/csrm/src/features/risk-curation/risk-history-sheet.tsx
    - apps/csrm/src/features/risk-curation/risk-history-sheet.test.tsx
  modified:
    - apps/csrm/src/components/csrm/status-badge.tsx
    - apps/csrm/src/components/csrm/status-badge.test.tsx
    - apps/csrm/src/features/ai-assistance/field-comparison.tsx
    - apps/csrm/src/features/ai-assistance/field-comparison-domain.ts
    - apps/csrm/src/features/ai-assistance/field-comparison.test.tsx
    - apps/csrm/src/features/risk-curation/risk-curation-domain.ts
    - apps/csrm/src/features/risk-curation/risk-curation-refusal-copy.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/src/lib/performance/zod-client-boundary.test.ts

key-decisions:
  - "RiskHistoryTrigger lives in its own module (risk-history-trigger.tsx), not in risk-history-sheet.tsx: a trigger exported from the module it lazily loads would put the sheet in every page's first load (D-48). The frame is a third module both share"
  - "The card actions render both layouts in the markup, chosen by the md breakpoint, rather than branching on matchMedia: SSR-safe, so a phone never flashes three pills before hydration. The withdraw form, opened only by interaction, does branch on matchMedia for its bottom sheet"
  - "useRiskWithdrawal takes the served Risks and returns them with the acts on their way applied (useOptimistic), plus pending, refusal and clearRefusal; it also takes viewer, draftOwnerKey, onChanged and focusAfter. The plan's `{ assessmentId }` signature could not move a card it does not hold"
  - "A refused withdrawal or reinstatement reopens the form with the reason and R1's line, except when the card moved meanwhile (404, RISK_NOT_WITHDRAWN, RISK_WITHDRAWN): then a danger toast with R1's line and a re-read. A refused Undo reads 'Couldn’t undo' (§5.1's title) with R1's line"
  - "An act the server reports as unchanged (another analyst got there first) offers no Undo, so Undo never reverses someone else's act"
  - "wordDiff moved beside X-24's comparison (field-comparison-domain.ts) and is re-exported by the risk curation domain, so the comparison does not pull the 800-line Risk domain into Phase 15's questionnaire panel"
  - "Changed-word marks sit on words: a space between two marked runs joins them and a run's edge spaces are unmarked (emphasisPieces), so 'by hand' reads as one deletion"
  - "In the compact history, the expanded toggle reads 'Hide changed fields', following Phase 15's 'Hide unchanged fields'; the UI-SPEC names only the collapsed label"
  - "A history value with no label (a relation whose label was not recorded) and a null value read 'Not recorded', the editor's empty value (§4.3)"
  - "curationRetryLine joins the risk curation domain, and family R reads it, so the hook (first load) can say R1's retry line without shipping family R"

patterns-established:
  - "Risk cards carry data-risk-card inside a [data-risk-list] container and the Show control carries data-risk-show: useRiskWithdrawal's default focus order reads them (16-14 places them)"

duration: 22min
completed: 2026-10-16
---

# Phase 16 Plan 12: Withdrawal and History Interface Summary

**The X-27 and X-29 pieces, built for reuse: card actions (pills from 768px, one `Actions for {risk number}` menu below), the withdraw and reinstate form with an optimistic move, Undo and rollback, the collapsed withdrawn card, the `risk` status family, the lazily loaded history sheet, and X-24's comparison extended with column labels, decision cells, `Same` rows and bounded changed-word marks.**

## Performance

- **Duration:** about 22 minutes
- **Started:** 2026-10-15T16:06Z
- **Completed:** 2026-10-15T16:28Z
- **Tasks:** 3 (one tracer, two TDD), each a RED and a GREEN commit
- **Files:** 11 created, 9 modified

## Components and their props

- **`RiskCardActions({ riskId, riskNumber, rewrite, onHistory, onWithdraw, requestingAnalyst?, withdrawOpen? })`.** `rewrite` is `{ trigger, open } | null`. `onHistory` and `onWithdraw` receive the control that opened them (the pill, or the menu button on phones). The pills are ghost small with `data-print="hidden"`, named `History of {n}` and `Withdraw risk {n}`. The menu items are `min-h-11`, named as UI-SPEC 2.5.3 names them.
- **`WithdrawRiskForm({ mode, riskId, riskNumber, openChanges, hasUnsavedChanges?, draftOwnerKey, initialReason?, error?, onSubmit, onKeep, returnFocusTo? })`.**
  - From 768px it is an X-5 well (h4 title). Below 768px it is a bottom `Sheet` (h2 title, `Close`).
  - The reason uses `curationReasonError` on submit and shows `{n} of 500 characters` once typed.
  - The reason is kept in `risk-withdraw-reason` or `risk-reinstate-reason`, restored with the caption, and guarded on unload.
  - `hasUnsavedChanges` shows the UI-D8 line with `Keep risk` only.
  - `Enter` submits. `Escape`, `Keep risk`, `Keep withdrawn` and `Close` call `onKeep` and return focus to `returnFocusTo`.
- **`useRiskWithdrawal({ assessmentId, risks, viewer?, draftOwnerKey?, onChanged?, focusAfter? })`.**
  - It returns `{ risks, pending, refusal, clearRefusal, withdraw(risk, reason), reinstate(risk, reason) }`.
  - Success shows `withdrawToast` or `reinstateToast` with `Undo`, which sends `undoWithdrawalAction` or `undoReinstatementAction` with no reason. An Undo that succeeds shows `undoneToast` and focuses `#risk-{id}`.
  - Undoing a reinstatement shows the earlier withdrawal facts while it is pending (UI-D7).
- **`WithdrawnRiskCard({ risk, editable, onReinstate, onHistory, details, form?, reinstateOpen?, pending?, headingLevel? })`.**
  - The card is `article#risk-{id}`, `tabIndex=-1`, `data-risk-card`, styled `bg-surface`, `border-border`, `rounded-lg` and `p-4`.
  - It shows the `Withdrawn` badge, the residual `RiskRatingBadge`, the statement in `line-clamp-2`, `Reason: “…”` and `Withdrawn by {name} · <LocalInstant>`.
  - Its actions are `Reinstate risk` (only when editable), `History`, and `Show details` / `Hide details` (`aria-expanded`, `aria-controls`). The toggle reveals `details`, which is the caller's shared read-only Risk.
- **`RiskHistoryTrigger({ riskId, riskNumber, ownerKey, variant?: 'card' | 'header', proposalHref? })`.** The `card` variant is `History` (ghost). The `header` variant is `Show history` (outline). `RiskHistoryDialog({ open, onOpenChange, riskId, riskNumber, ownerKey, returnFocusTo, openedAt?, proposalHref? })` is the same sheet, opened by a control elsewhere (the card actions).
- **`RiskHistorySheet`** (the on-demand body) shows:
  - the count line, and the density control from 768px (`csrm:risk-history-density:{ownerKey}`);
  - an `ol` of entries, each an X-29 `li`;
  - Before/After `FieldComparison`, with rating badges through `renderEmphasis` and marks on the UI-SPEC §4.3 long-text fields;
  - `Values when taken off` as a `dl`;
  - `Show older changes` (25 per page), which focuses the first new entry;
  - the honest start, and the §8.5 states.

## Difference from 15-11's `FieldComparison` signature

The props are now `FieldComparisonBase & ({ rows; groups?: never } | { groups; rows?: never })`. `caption`, `density`, `renderEmphasis` and `rows` are unchanged in type and behaviour, and Phase 15's call site and its four tests are untouched.

The additions:

- `columns?: { before, after }`, which defaults to `Current` and `Proposed`.
- `groups?: readonly ComparisonGroup[]`, where `ComparisonGroup` is `{ key, label, rows, decision?: ReactNode }`.
- `showSame?: boolean`.
- `emphasis?: boolean | ((row) => boolean)`.

`renderEmphasis` now falls through to `emphasis` or the plain value when it returns null or undefined. For Phase 15, which passes no `emphasis`, that is the same plain value as before.

Both layouts render a group's `decision` node, and the md breakpoint shows one. 16-13 should therefore read focus targets from the visible layout.

## Task Commits

1. **Task 1 (tracer): withdraw from the card end to end.** RED `766efaa3`, GREEN `6d155385`. The tracer gate re-ran the verify and it passed, so the plan expanded.
2. **Task 2: reinstatement, the withdrawn card and the `risk` family.** RED `25816dca`, GREEN `fe76e8d2`.
3. **Task 3: the comparison extension and the history sheet.** RED `6750e5fb`, GREEN `041b5178`.

## Verification

| Command | Result |
|---|---|
| Task 1 RED: vitest on `risk-card-actions` and `withdraw-risk-form` | 2 files failed to import (expected) |
| Task 1 verify: the same two files, then `typecheck` | 24 of 24 passed; typecheck clean |
| Task 2 RED: vitest on `status-badge`, `withdrawn-risk-card` and `withdraw-risk-form` | 6 badge tests failed and the card file failed to import; the 3 reinstate cases already passed (see deviations) |
| Task 2 verify: the same three files, then `typecheck` | 111 of 111 passed; typecheck clean |
| `attachment-status-badge` plus `lib/performance` (Task 2) | 265 of 265 passed |
| Task 3 RED: vitest on `field-comparison` and `risk-history-sheet` | 11 failed, and the sheet file failed to import; Phase 15's cases passed |
| `field-comparison`, the risk curation domain and `questionnaire-ai` (Task 3) | 9 files, 199 of 199 passed |
| `risk-history-sheet.test.tsx` | 18 of 18 passed |
| `zod-client-boundary.test.ts` | 42 of 42 passed |
| `interface-copy-guard.test.ts` | 232 of 232 passed |
| Task 3 verify: `pnpm --dir apps/csrm test` (full web suite) | 230 files, 5,645 of 5,645 passed |
| `pnpm --dir apps/csrm typecheck` / `lint` | 0 errors, exit 0 |

No Strapi source, spec or schema changed, so neither `api:check` nor a Strapi suite was needed. Playwright was not run, as the plan says.

**Page budget.** No route budget was measured, because the plan asks for none. One change does ship on first loads: `status-badge.tsx` now holds lucide's `Archive` icon (273 bytes gzipped as a standalone module, less inside a chunk) on every route whose client graph renders `StatusBadge`. That includes `/app/requests/{documentId}`, which had about 1,973 bytes of headroom. The new risk curation modules are not imported by any route yet: 16-14 and 16-15 place them. The new zod-boundary test proves that none of the first-load modules reaches family R or `refusal-copy.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The copy guard and the zod boundary read the new modules**
- **Found during:** Task 3 GREEN
- **Issue:** `interface-copy-guard.test.ts` and `zod-client-boundary.test.ts` list modules explicitly, so without entries the new copy and client modules would go unguarded. This is the same gap 16-11 closed for its own modules.
- **Fix:** The copy guard now lists the seven new shipped modules. A new zod-boundary block walks them and the lazy sheet for zod. It proves the sheet loads only through `import()`, and that no first-load module reaches family R or `refusal-copy.ts`.
- **Commit:** `041b5178`

**2. [Rule 3 - Blocking] R1's retry line for the hook**
- **Found during:** Task 1 GREEN
- **Issue:** The hook must say R1's retryable line when an action throws, for example on a network failure. Importing family R for that one line would ship about 23 KB of refusal source with the editor's first load.
- **Fix:** `curationRetryLine(act)` now lives in the domain, and family R reads it from there, so the string has one home.
- **Commit:** `6d155385`

### Plan-shape notes

- **Trigger module.** The plan exports `RiskHistoryTrigger` from `risk-history-sheet.tsx`. It lives in `risk-history-trigger.tsx` instead, with the frame in `risk-history-frame.tsx`, so the sheet's body is actually code-split (D-48). `risk-history-sheet.tsx` exports `RiskHistorySheet` and renders `FieldComparison`, which is what the acceptance criterion requires.
- **matchMedia in the card-action tests.** The plan says to mock matchMedia per width. The card actions use the md breakpoint instead (see key decisions), so their tests read each layout by its container and breakpoint class. The withdraw form's 375 test does stub matchMedia.
- **Hook signature.** The hook takes more than the plan's `{ assessmentId }` and returns more than `{ pending, withdraw, reinstate }`. The added inputs and return values are listed under the components above. 16-14 holds the list and renders the form from `refusal`.
- **Reinstate path built with Task 1.** The hook and form were written for both acts in Task 1. As a result, Task 2's three reinstate cases passed at RED; only the badge and card cases failed.
- **`wordDiff` moved** from `risk-curation-domain.ts` to `field-comparison-domain.ts`, with a re-export, so every existing import still works. `risk-curation-domain.ts` and `risk-curation-refusal-copy.ts` were not in the plan's file list.
- **Family R placement (16-11).** No family R copy was added. The history sheet reads `riskCurationRefusal(…, 'history')` from `risk-curation-refusal-copy.ts` for a thrown read, and `refusal-copy.ts` is unchanged.
- **Printing withdrawn cards only under `Withdrawn`** belongs to the editor (16-14). The card's own actions carry `data-print="hidden"`.
- **Task 3 GREEN** also carried a one-line ordering fix in `risk-history-sheet.test.tsx`: the read is asserted after the first entry renders, because the body arrives through `import()`.

**Total deviations:** 2 auto-fixed (one Rule 2, one Rule 3), plus 8 plan-shape notes.

## Issues Encountered

- The phone sheet's field mounts after Radix's portal, so focus moved through `onOpenAutoFocus`.
- A reopened form's focus could lose to the card move that its refused act had scheduled. The well now takes focus again after a frame.

Both were fixed within their task.

## Known Stubs

None. The components are not yet placed on a page; 16-14 places them in the editor and 16-15 in the register, as planned.

## Threat Flags

None. No endpoint, auth path or schema changed.

- **T-16-34:** reasons, values and word-diff pieces render as React text only, and a test proves injected markup never renders.
- **T-16-35:** the controls are a courtesy, and every act goes through 16-11's actions, which Strapi authorises.
- **T-16-SC:** no package was added.

## Next Phase Readiness

16-13 can place `FieldComparison` with `groups` and decision cells, and `RiskCardActions` with the rewrite trigger.

16-14 can render the lists from `useRiskWithdrawal(...).risks`, using:
- `partitionByWithdrawal`;
- `data-risk-card` and `data-risk-list` on the lists, and `data-risk-show` on the `Show` control;
- `WithdrawRiskForm` reopened from `refusal`;
- `WithdrawnRiskCard`;
- `RiskHistoryDialog` for the card actions' `History`.

16-15 can use `RiskHistoryTrigger variant="header"` for `Show history`.

## Self-Check: PASSED

- All 7 created component and hook modules and 4 test files exist.
- All 6 commits exist: `766efaa3`, `6d155385`, `25816dca`, `fe76e8d2`, `6750e5fb`, `041b5178`.
