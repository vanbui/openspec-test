---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 14
subsystem: web-assessment-editor-risk-curation
tags: [risk-curation, withdrawal, show-filter, ai-proposals, rewrite, discard-new-risk, overall-rating-hint, release-readiness, requesting-analyst, copy-guard, playwright, tdd]
status: complete
requirements: [ASSESS-09, ASSESS-10]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "16-11's typed layer and domain (listRiskAiProposals, showCounts, partitionByWithdrawal, overallRatingHint, discardToast, family R); 16-12's RiskCardActions, WithdrawRiskForm, useRiskWithdrawal, WithdrawnRiskCard, RiskHistoryDialog/RiskHistoryTrigger; 16-13's AiProposalsSection, AiProposalsSectionLoader, ProposalsReadError, RewriteForm, RiskRewriteSection, SuggestMoreRisksButton, assessmentSignalProps"
  - phase: 12-ai-context-suggestions-and-provenance
    provides: "AiProvenanceHeader with openProposals, the editor's review bars and Risk badge"
  - phase: 10-assessment-editor
    provides: "AssessmentEditor, RiskEditor, the readiness card, Add Risk"
provides:
  - "page.tsx: searchParams (`?risks=withdrawn`), listRiskAiProposals beside the assessment read, viewerRaisedRequest (403 OWN_REQUEST), proposalsError, ownerKey, viewer, the signal's heading and Suggest more risks"
  - "assessment-editor.tsx: props riskFilter, proposals, proposalsError, viewerRaisedRequest, ownerKey, viewer; RiskFilter, RISK_FILTER_PARAM; the Show filter, the Active and Withdrawn lists, card actions, the AI rewrite slot, the AI proposals section before Identified Risks, Discard new risk with Undo, the overall-rating hint, the page's next read adopted"
  - "risk-editor.tsx: EditableRisk gains withdrawal; props onUnsavedChange, onDiscard, draft, focusFirstField; type NewRiskDraft; Discard new risk; a newer Risk's values taken into untouched fields (§5.2)"
  - "release-readiness-summary.ts: summarizeReleaseReadiness(readiness, { openCount, viewerRaisedRequest }); AI_PROPOSALS_DECIDED_KEY, REQUESTING_ANALYST_DECISIONS_CAPTION, ReleaseReadinessProposals; item href nullable, caption"
  - "assessment-actions.ts: a 409 RISK_WITHDRAWN on a Risk or control change reads riskCurationRefusal(…, 'edit')"
  - "interface-copy-guard.test.ts: src/features/risk-curation scanned; reservedControlNames (Accept, Accept all, Approve, Delete, Remove)"
affects: [16-15]

actuals:
  tokens: 20300  # chars/4 over the added lines of the realized diff (81,118 characters)
  tasks: 3
  commits: 5  # git rev-list --count 9bbe789f..HEAD before the docs commit

plan_head_before: 9bbe789f15b2d51597ffb21b50806bd0d537594e
plan_head_after: 0386a89fc78f392f3fc4f848da40c6fc90fd2a8c

tech-stack:
  added: []
  patterns:
    - "Address state without a navigation: window.history.replaceState keeps `?risks=withdrawn`, so the page is not read again and focus stays on the option chosen"
    - "A client view adopts the page's next read (router.refresh after an AI decision or job) by comparing served props, while keyed forms keep their unsaved input"
    - "A form takes a newer record's values only into fields the analyst has not changed, so a confirmed AI change shows at once and is never saved back over"

key-files:
  created:
    - apps/csrm/src/features/assessments/risk-editor.test.tsx
  modified:
    - apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx
    - apps/csrm/src/features/assessments/assessment-editor.tsx
    - apps/csrm/src/features/assessments/assessment-editor.test.tsx
    - apps/csrm/src/features/assessments/risk-editor.tsx
    - apps/csrm/src/features/assessments/release-readiness-summary.ts
    - apps/csrm/src/features/assessments/assessment-actions.ts
    - apps/csrm/src/features/assessments/assessment-actions.test.ts
    - apps/csrm/src/features/assessments/analyst-assessment-route.test.tsx
    - apps/csrm/src/features/assessments/analyst-route-gate.test.tsx
    - apps/csrm/src/features/risk-curation/use-risk-withdrawal.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts

key-decisions:
  - "The AI proposals section renders inside the editor's client tree, not as a server slot: its body needs the live Risk references the editor holds, and the frame is a few hundred bytes. It renders only when the page supplied the read's outcome (the read, its failure, or OWN_REQUEST)"
  - "The Show filter writes the address with window.history.replaceState, not router.replace: the choice is display only, so the page and its per-Risk control reads are not repeated and focus stays on the option (§6.3)"
  - "The editor adopts the page's next read: an added proposed risk, a confirmed change and a finished job refresh the page, and without this the new Risk card would never appear (D-41)"
  - "Rewrite this risk is offered only while the proposals read is available and allows it, so a rewrite's result always has a section to land in; Strapi decides every rewrite"
  - "The requesting analyst's readiness item is plain text with §9.1's sentence and no count; the header shows no open-proposal line for them or once released"
  - "The Show control's focus fallback lands on its checked option, not the group container, as a keyboard reaches it"

patterns-established:
  - "Active Risk cards carry data-risk-card inside [data-risk-list=\"active\"], withdrawn cards inside [data-risk-list=\"withdrawn\"], and the Show control's wrapper carries data-risk-show"

duration: 33min
completed: 2026-10-16
---

# Phase 16 Plan 14: Risk Curation in the Assessment Editor Summary

**The analyst assessment editor now holds all of Phase 16:**

- the page reads the AI proposals beside the assessment and shows the requesting analyst's state on OWN_REQUEST;
- the AI proposals section sits before Identified Risks, and the header's open proposals link to it;
- a `Show` filter (`?risks=withdrawn`) splits Active and Withdrawn cards;
- each card carries its actions, `AI rewrite` and change link;
- `Discard new risk` offers Undo;
- readiness lists `Decisions on AI proposals` with its open count;
- the overall-rating hint offers `Use {rating}`;
- once released, no curation or AI control remains.

## Performance

- **Duration:** about 33 minutes
- **Started:** 2026-10-15T17:12Z
- **Completed:** 2026-10-15T17:46Z
- **Tasks:** 3 (Task 1 a tracer; Tasks 1 and 2 each RED then GREEN; Task 3 one commit)
- **Files:** 1 created, 11 modified

## Accomplishments

- **Page.**
  - It receives `searchParams` and passes `riskFilter`.
  - It calls `listRiskAiProposals(documentId)` beside the Risk Types, Risk list and request reads, with the session for `ownerKey` and `viewer`.
  - A 403 with `OWN_REQUEST` sets `viewerRaisedRequest` and passes no proposals (T-16-39). Any other failure sets `proposalsError`.
  - It hands the signal §10.2's heading and, where a start is allowed, `Suggest more risks`. The requesting analyst gets the caption instead.
  - The control implementation reads stay as they were, so a withdrawn Risk's controls are read.
- **Editor.** `AssessmentEditor` is now a thin state switch over `PopulatedAssessmentEditor`, so every hook runs unconditionally.
  - **Section and header.** `AiProposalsSection`, with `AiProposalsSectionLoader` or `ProposalsReadError`, sits directly before `Identified Risks`. The header's `openProposals` comes from the read. It is null for the requesting analyst and once released.
  - **Show filter.** `Show` is a `SegmentedControl` with `Active ({n})` and `Withdrawn ({w})` in tabular numbers, taken from `showCounts` over `useRiskWithdrawal`'s optimistic list.
  - **Active cards.** Each card has:
    - the number, the rating, Phase 12's badge and the `{k} AI changes to review` link to `#risk-{id}-rewrite`;
    - `RiskCardActions`, with `RewriteForm` as its rewrite trigger;
    - the withdraw form directly under the header;
    - the `AI rewrite` section first in the content, loaded through `next/dynamic`;
    - then the Risk form.

    A released card offers `History` only.
  - **Withdrawn cards and empty lists.** Withdrawn cards are `WithdrawnRiskCard`s with the shared read-only Risk at h4. They show only under `Withdrawn`, so they print only there. Each of §6.3's four empty cases has its own copy.
  - **History.** One `RiskHistoryDialog` serves the card actions.
- **Discard new risk (D-17).**
  - A form holding input closes and toasts `New risk discarded.` with `Undo`. Undo reopens the form with the typed values, including chosen owners and relations, and focus in its first field.
  - An untouched form closes silently.
  - Either way, focus returns to `Add Risk` and nothing is sent.
- **Readiness (D-42).** `Decisions on AI proposals`, when outstanding, links to `#ai-proposals` with `{n} open` under it. The requesting analyst sees §9.1's sentence, with no link and no count. Withdrawn Risks contribute no rows, because the server leaves them out.
- **Overall-rating hint (D-15).**
  - The hint is named by the select's `aria-describedby`.
  - `Use {rating}` sets the field without saving and focuses it.
  - There is no hint when the ratings match, when no active Risk is rated, or after release.
  - A withdrawn Critical never raises it.
- **Released and requesting analyst (D-29, §12.3).**
  - Once released, no `Withdraw risk`, `Reinstate risk`, `Rewrite this risk`, `Suggest more risks`, decision or `Discard new risk` control remains. `Show`, the withdrawn cards and `History` stay.
  - The requesting analyst keeps editing, `Withdraw risk`, `Reinstate risk`, `History`, `Discard new risk` and the hint. They see no rewrite control, `AI rewrite` section or change link.
- **Copy guard (D-49).** `src/features/risk-curation` is a scanned folder. `reservedControlNames` fails on any button or menu item there whose text or `aria-label` begins with `Accept`, `Accept all`, `Approve`, `Delete` or `Remove`.

## Task Commits

1. **Task 1 (tracer): the editor end to end.** RED `90b1f088`, GREEN `6d6f684e`. The tracer gate re-ran the verify and it passed, so the plan expanded.
2. **Task 2: Discard new risk, the rewrite slot, the hint and the locked states.** RED `7bf1c3de`, GREEN `eff1674d`.
3. **Task 3: the copy guard and the deliberate end-to-end checks.** `0386a89f`.

## Verification

| Command | Result |
|---|---|
| Task 1 RED: vitest `assessment-editor.test.tsx` | 6 failed, 83 passed (expected) |
| Task 1 GREEN: `assessment-editor.test.tsx` | 89 of 89 |
| Task 1 verify: vitest `features/assessments`, `features/ai-assistance`, `features/risk-curation`, then `typecheck` | 44 files, 969 of 969; typecheck clean |
| `src/lib/performance`, `parser-free-modules`, `src/test` (Task 1) | 5 files, 306 of 306 |
| `analyst-assessment-route.test.tsx` (4 new cases) | 13 of 13 |
| Task 2 RED: `assessment-editor.test.tsx` and `risk-editor.test.tsx` | 4 failed, 96 passed (expected; see notes) |
| Task 2 verify: vitest `src/features/assessments`, then `typecheck` | 18 files, 574 of 574; typecheck clean |
| `assessment-actions.test.ts` | 47 of 47 |
| Task 2 broader run: assessments, `lib/performance`, risk-curation, ai-assistance, `lib/api` | 52 files, 1,680 of 1,680 |
| Task 3 RED: `interface-copy-guard.test.ts` | the new cases failed (no `reservedControlNames`, folder not scanned) |
| Task 3 GREEN: `interface-copy-guard.test.ts` | 262 of 262 |
| `pnpm --dir apps/csrm test` (full web suite) | 234 files, 5,781 of 5,781 |
| `pnpm --dir apps/csrm typecheck` / `lint` (the same script) | clean |
| Ports 1337 and 3000 | free before Playwright |
| `pnpm --dir apps/csrm test:e2e` with `assessment-release-workflow`, `performance`, `accessibility` and `design-contract` | 27 of 27 passed (6.9 min) |
| The verify's `git status` filter | passed |

**Playwright projects.** All 27 tests ran on the `desktop` project. The `mobile` project's `testMatch` includes none of these four specs, so "both projects" here means the one project that runs them. The release journey's 375 and 1440 checks run inside the desktop project by setting the viewport.

**`assessment-release-workflow.spec.ts` is unchanged.** It asserts the outstanding list's contents with `toContainText('Review of AI proposals')` and Risk-row patterns, never an exact list. The new met item `Decisions on AI proposals` only adds to the met list, which the spec checks with `toContainText('Met')`. E2 holds: no new `form` element renders inside `Identified Risks` at rest, and the unit test counts them.

## Route budgets (measured, `performance.spec.ts`, 5 samples, desktop)

| Route | Delivered JS | Budget | Note |
|---|---|---|---|
| `/app/review/assessments/{documentId}` | 394,238 | 460,000 | 14-16 recorded 318,157. The editor now ships the card actions, withdraw form, withdrawn card, history frame, rewrite control, section loader and the risk curation domain. The section body, rewrite form body, `AI rewrite` section and history sheet all load on demand |
| `/app/requests/{documentId}` | 299,243 | 300,000 | Not changed by this plan; nothing it loads was touched. 757 bytes of headroom remain after 16-12's `Archive` icon |

There was no overrun, so no budget exception is recorded.

## Layout backstops for the orchestrator's browser check

1. At 1440px, a Risk card header holding the number, rating, `AI proposed` badge, the open-change link and the three action pills wraps without overlapping. Each target stays at least 24px. The header is `flex flex-wrap items-center gap-3`, with the actions in an `ml-auto` group.
2. At 1440px, the rewrite popover opened from the last Risk card stays within the viewport. Its field, checkboxes and actions are fully visible. The popover is 16-13's `PopoverContent`, with `collisionPadding={16}`, `max-h-(--radix-popover-content-available-height)` and `overflow-y-auto`.

## Decisions Made

See `key-decisions`. 16-15 can rely on the following:
- `AssessmentEditor` is unchanged for callers that pass no proposals. The section renders only when the page supplies a read outcome.
- `RiskHistoryTrigger variant="header"` is untouched.
- The register can reuse `summarizeReleaseReadiness`'s second argument the same way.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A confirmed AI change would be saved back over**
- **Found during:** Task 1 GREEN
- **Issue:** `RiskEditor` kept its form values when a newer Risk arrived. After `Confirm` on a rewrite change, the form still showed the old value, and the next `Save risk` would have sent it, reverting the confirmed change. §5.2 requires the form to update in place.
- **Fix:** When a newer Risk arrives, the form takes its value into each field whose value still equals the previous baseline. Fields the analyst changed keep their unsaved value (D-36). A save's own refresh changes nothing, so the save confirmation stays.
- **Commit:** `6d6f684e`

**2. [Rule 1 - Bug] The editor ignored the page's refreshed read**
- **Found during:** Task 1 GREEN
- **Issue:** The section, the decisions and the rewrite jobs refresh the page with `router.refresh()`. The editor held its first props in state, so a Risk added from a proposed risk would never have appeared.
- **Fix:** The editor compares the served `assessment`, `risks` and `controlImplementations` with what it last took, and adopts a new read. Defaults are module constants, so an omitted prop never reads as new.
- **Commit:** `6d6f684e`

**3. [Rule 2 - Missing critical] R1's sentence on a stale edit (carried from 16-11)**
- **Found during:** Task 2
- **Issue:** §6.5 requires an edit or control change refused with `RISK_WITHDRAWN` to read R1's sentence. The control-implementation create and update actions did not pass the reason.
- **Fix:** `serviceFailure` reads `riskCurationRefusal({ status, reason }, 'edit')` for that refusal. This is server-only and costs no client bytes. Both control actions now pass `reason`. A test covers the Risk and control paths.
- **Commit:** `eff1674d`

**4. [Rule 3 - Blocking] Test doubles for the new reads**
- **Found during:** Tasks 1 and 2
- **Issue:** The editor now imports the risk curation actions, and the page reads the proposals and the session.
- **Fix:**
  - `assessment-editor.test.tsx` mocks the curation actions and `next/navigation`.
  - The route tests mock `listRiskAiProposals` and the session adapter.
  - `analyst-assessment-route.test.tsx` gained four cases: the read, OWN_REQUEST, the failure, and `?risks=withdrawn`.
- **Commits:** `90b1f088`, `6d6f684e`

**5. [Rule 1 - Bug] A pre-Phase-16 assertion read `Withdraw risk` as withdrawing the review**
- **Found during:** Task 1 GREEN
- **Issue:** One existing test asserted no button matching `/withdraw/i` for a superseded review, and `Withdraw risk RSK-0042` now matches it.
- **Fix:** The assertion now names the review (`/withdraw (the )?(completed )?review/i`). Its intent is unchanged.
- **Commit:** `6d6f684e`

### Plan-shape notes

- **`RiskEditor`'s props.** The plan names `actions`, `rewrite` and `openChanges`. The card header (number, badges, link, actions) and the card content belong to the editor's `Card`, so the editor places the actions in the header and the `AI rewrite` section first in the content. `RiskEditor` gained what only the form knows: `onUnsavedChange`, plus `onDiscard`, `draft` and `focusFirstField` for create mode. The visible order is §1's and §4.2's. The rewrite section is a sibling before the `form`, not nested in it, so its reject row is never inside the Risk's form.
- **`ai-provenance-header.tsx` is unchanged.** It already links `openProposals` to `#ai-proposals` (15-12). The editor passes the assessment's count, or null.
- **The section's placement in the client tree.** See key decisions. 16-13's server frame keeps no hooks and is used as is.
- **`viewer`.** The session carries no Strapi `documentId`, so the page passes `{ documentId: '', displayName }`. The hooks show only the name, on a card whose act is on its way.
- **AI policy.** The section's `policy` prop is not passed. This route reads no AI policy status, so 12 §11.1's alert does not replace the start form here. Strapi still refuses a start the policy forbids, and R2 says why.
- **Built ahead of its task.** Task 1 built the card actions, the `AI rewrite` slot, the unsaved reporting and the released state, because the tracer needed whole cards. As a result, Task 2's actions, rewrite, unsaved and released cases passed at RED. The four that failed were Discard new risk (twice), the requesting analyst's Discard, and the hint.
- **`use-risk-withdrawal.ts`.** This file is outside the plan's list. The `Show` focus fallback now lands on the checked option.
- **Copy guard scope.** The reserved-name check reads the `.tsx` modules of `features/risk-curation`, where the controls are. The folder scan reads every shipped module, the schema and service included.

**Total deviations:** 5 auto-fixed (three Rule 1, one Rule 2, one Rule 3), plus 7 plan-shape notes.

## Issues Encountered

- **A file the Playwright run changed (harness note, not staged or reverted).** `strapi develop` regenerated `apps/backend/types/generated/contentTypes.d.ts`, adding 71 lines: the `csrm-risk-history-event` type from 16-03, which was never committed to the generated types. This is the operator's item. The verify's status filter allows it.
- **Shell escapes.** Two Python heredoc edits mangled a regex (`\b`) and a `'\n'` join. Both were fixed with the Edit tool before commit.

## Known Stubs

None.

## Threat Flags

None. No endpoint, auth path or schema changed.

- **T-16-39:** on OWN_REQUEST the page passes `proposals={null}`. The section renders its line only, and no card offers a rewrite.
- **T-16-38:** controls follow the served `editable` and OWN_REQUEST, and Strapi refuses every disallowed act.
- **T-16-SC:** no package was added.

## Next Phase Readiness

16-15 can place the register's withdrawn rows and filter. `RiskHistoryTrigger variant="header"` and family R are ready. ASSESS-09 and ASSESS-10 stay open until 16-15, the phase's last plan (the shared-ID gate).

## Self-Check: PASSED

- `apps/csrm/src/features/assessments/risk-editor.test.tsx` exists.
- All 5 commits exist: `90b1f088`, `6d6f684e`, `7bf1c3de`, `eff1674d`, `0386a89f`.
