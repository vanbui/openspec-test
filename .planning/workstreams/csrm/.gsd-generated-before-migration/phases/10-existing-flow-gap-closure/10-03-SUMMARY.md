---
phase: 10-existing-flow-gap-closure
plan: 03
subsystem: ui
tags: [radix-ui, radio-group, segmented-control, keyboard, accessibility, vitest, user-event, playwright]

requires:
  - phase: 10-02
    provides: "the questionnaire journey (questionnaire-workflow.spec.ts) as 10-02 left it; wave ordering on the shared E2E ports"
provides:
  - "selectAdjacentRadio(event), exported from apps/csrm/src/components/ui/radio-group.tsx: an unmodified arrow moves focus to the next or previous enabled radio in the same radiogroup (wrapping) and checks it, one value change per press"
  - "RadioGroupItem runs a caller's onKeyDown first, then selectAdjacentRadio unless the caller prevented default"
  - "SegmentedControl passes selectAdjacentRadio as each segment's onKeyDown"
  - "apps/csrm/src/components/ui/radio-group.test.tsx: quick-press, wrap, disabled, modifier, held-key, auto-repeat, Tab, Home/Space and caller-handler cases for the wrapper, and quick-press plus wrap for the segmented control"
  - "QUES09_ARROW_KEYS_SELECT in the questionnaire journey: ArrowDown then ArrowUp on the controller question"
affects: [10-05, 10-23, reports, questionnaires, any-future-radio-group]

actuals:
  tokens: 4100
  tasks: 2
  commits: 4
plan_head_before: 559776c035b1e8cc94fe0284665fecd8df80bff8
plan_head_after: 90b07f9272f88768bcaf44ae505388f6e1ac7aa2

tech-stack:
  added: []
  patterns:
    - "Radio arrow keys: prevent default in the item's keydown, then move focus and check in a microtask through the radio's own click; skip the click when Radix's focus handler already clicked"
    - "Any component that renders RadioGroupPrimitive.Item directly passes onKeyDown={selectAdjacentRadio}"

key-files:
  created:
    - apps/csrm/src/components/ui/radio-group.test.tsx
  modified:
    - apps/csrm/src/components/ui/radio-group.tsx
    - apps/csrm/src/components/csrm/segmented-control.tsx
    - apps/csrm/e2e/questionnaire-workflow.spec.ts

key-decisions:
  - "selectAdjacentRadio prevents default at once but moves focus and checks in a microtask: a click nested inside the keydown left the report period transition suspended inside testing-library's synchronous act, so report-views.test.tsx stayed busy for ever. The microtask still runs before keyup (a later task), so the quick-release race stays closed"
  - "Each press clicks only when Radix's own focus handler did not (a one-shot click listener around focus()): with a repeating key the Radix arrow flag is still set and its onFocus clicks, and a second click before re-render would report the value twice"
  - "ArrowRight is always next and ArrowLeft previous; the app is left-to-right only, so the handler does not mirror Radix's dir-aware keys"
  - "Enabled means no disabled and no data-disabled attribute; radios of a nested radiogroup are excluded"
  - "The segmented-control unchanged check diffs from 5ea2b77 (D-49): the plan's fd5866c is not in this repository"

patterns-established:
  - "Keyboard selection tests press without holding (user.keyboard('{ArrowDown}')), which is what reproduces UAT-064; held and auto-repeated presses assert one change per press"

requirements-completed: [QUES-09]

coverage:
  - id: D1
    description: "In a shared RadioGroup, one quick ArrowDown/ArrowRight press moves focus to the next enabled option and checks it, wrapping and skipping a disabled option; ArrowUp/ArrowLeft go backwards; each reports exactly one value change"
    requirement: QUES-09
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/ui/radio-group.test.tsx#RadioGroup arrow keys"
        status: pass
    human_judgment: false
  - id: D2
    description: "Held and auto-repeated arrow keys check one option per press; arrows with Shift, Control, Alt or Meta, Home, Tab and Space behave as before; the group stays one tab stop; a caller's onKeyDown runs first and can prevent the move"
    requirement: QUES-09
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/ui/radio-group.test.tsx#RadioGroup arrow keys (held, auto-repeat, modifiers, Tab, Home/Space, caller handler)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/components/csrm/segmented-control.test.tsx (unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The segmented control checks the next segment on one quick ArrowRight and wraps; the report period control still keeps the old report busy until the new one arrives and keeps focus on the checked segment"
    requirement: QUES-09
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/ui/radio-group.test.tsx#SegmentedControl arrow keys"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/reports/report-views.test.tsx#report period control"
        status: pass
    human_judgment: false
  - id: D4
    description: "In the running app, the Requestor's quick ArrowDown on the controller question checks No and focuses it, and ArrowUp checks Yes again"
    requirement: QUES-09
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-workflow.spec.ts#QUES09_ARROW_KEYS_SELECT"
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 03: Arrow keys select in radio groups and the segmented control Summary

**One exported `selectAdjacentRadio` handler makes an arrow press move focus and check the next enabled radio in the shared shadcn wrapper and the segmented control, however quickly the key is released, with exactly one value change per press (UAT-064 closed).**

## Performance

- **Duration:** 23 min
- **Started:** 2026-10-02T02:39:20Z
- **Completed:** 2026-10-02T03:02:05Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Confirmed the installed sources first: `@radix-ui/react-radio-group` 1.4.7 (through `radix-ui` 1.6.7), `@radix-ui/react-roving-focus` 1.1.19. The race is as the research describes: the item checks on focus only while its document-level arrow flag is set, and roving focus moves in a `setTimeout`.
- `selectAdjacentRadio` acts on unmodified ArrowDown/ArrowRight/ArrowUp/ArrowLeft, prevents default (so the roving handler skips), finds the next enabled `[role="radio"]` of the same `radiogroup` in DOM order with wrap, then in a microtask focuses it and checks it through its own `click()`.
- `RadioGroupItem` composes it after a caller's `onKeyDown`; classes and the indicator are unchanged. `SegmentedControl` passes it to each `RadioGroupPrimitive.Item`; nothing else changed there.
- `radio-group.test.tsx` (14 tests): RED for the five quick-press cases before the fix (focus moved, nothing checked), and for the segmented-control case before Task 2.
- The questionnaire journey presses ArrowDown and ArrowUp on "Will the service handle personal information?" (`QUES09_ARROW_KEYS_SELECT`).

## Task Commits

1. **Task 1 RED: expect one quick arrow press to check the next radio** - `4e98796` (test)
2. **Task 1 GREEN: check the next radio on an arrow press however quickly the key is released** - `66fe869` (fix)
3. **Task 2: check the next segment on an arrow press however quickly the key is released** - `6eac5ea` (fix)
4. **Rule 1 fix: move and check the radio after the key event's dispatch** - `90b07f9` (fix)

**Plan metadata:** the docs commit that adds this SUMMARY.

## Tests run

| Run | Result |
|---|---|
| RED, Task 1: `vitest run src/components/ui/radio-group.test.tsx` | 5 failed / 8 passed (13); target "checks the next option on one quick ArrowDown press" failed on `toBeChecked`; `check tdd-red-evidence`: RED_EVIDENCE_OK |
| GREEN, Task 1: radio-group, segmented-control, questionnaire-renderer tests | 28/28; typecheck clean |
| Mutation check: the dedupe removed | the auto-repeat case failed (value reported twice); restored |
| Questionnaire journey after Task 1 | 1/1 desktop (58.1 s) |
| RED, Task 2: radio-group.test.tsx with the segmented-control case | 1 failed / 13 passed (14); RED_EVIDENCE_OK |
| Task 2: radio-group, segmented-control, reports-pages, questionnaire-renderer | 69/69; typecheck clean |
| Full web suite after Task 2 | 2,138/2,139: `report-views.test.tsx` "replaces the URL with ?period=12 from the keyboard ..." failed (three solo reruns failed the same way; passed with the previous segmented control) |
| Targeted after the microtask fix: radio-group, segmented-control, all of `src/features/reports/`, questionnaire-renderer | 131/131, no act warnings |
| Full web suite (`pnpm --dir apps/csrm test`) | 2,139/2,139, 117 files, 26.7 s |
| Typecheck (`pnpm --filter @csrm/web typecheck`; `lint` is the same script) | clean |
| Questionnaire journey after the final change | 1/1 desktop (56.8 s) |
| Full Playwright (`pnpm --dir apps/csrm test:e2e`) | 86/86 passed: desktop 82, mobile 4; 0 failed, 0 flaky, 0 skipped; 11.5 min; EXIT=0 |

The tree after both Playwright runs showed only the three operator items (D-48). No Strapi source changed, so the Strapi suite was not run.

## Files Created/Modified

- `apps/csrm/src/components/ui/radio-group.tsx` - `selectAdjacentRadio`, its use on `RadioGroupItem`, and the export.
- `apps/csrm/src/components/ui/radio-group.test.tsx` - new: the wrapper and segmented-control keyboard cases.
- `apps/csrm/src/components/csrm/segmented-control.tsx` - imports the handler and passes it as each segment's `onKeyDown`.
- `apps/csrm/e2e/questionnaire-workflow.spec.ts` - the `QUES09_ARROW_KEYS_SELECT` step after the controller question's `Yes`.

## Decisions Made

- Microtask deferral of the move and check (see Deviations 1).
- One click per press: a one-shot click listener around `focus()` notes whether Radix's `onFocus` already clicked (repeating key, flag still set), and the handler clicks only when it did not. Research Pitfall 4 called a double set harmless; the must-have asks for exactly one change, and the auto-repeat test now enforces it.
- No right-to-left mirroring: the app is left-to-right only, so ArrowRight is always next.
- Extra test cases beyond the plan's list: each modifier (Shift, Control, Alt, Meta), auto-repeat (`{ArrowDown>2/}`), Home then Space, and a caller handler that prevents default. They cover UI-SPEC §7's "unchanged" rows and the composition rule.
- `segmented-control.test.tsx` is unchanged, checked from `5ea2b77` (D-49) because `fd5866c` is not in this repository.
- The plan's two journey runs: the questionnaire journey ran after Task 1 and again after the final change; the full suite ran once at the end.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The report period transition stayed busy after a keyboard change**
- **Found during:** Task 2 (full web suite)
- **Issue:** with the plan's synchronous focus-then-click inside the keydown handler, `report-views.test.tsx` "replaces the URL with ?period=12 from the keyboard, keeps the report busy until it arrives, and keeps focus on the checked segment" never showed the 12-month report: the body stayed `aria-busy`. The click ran inside testing-library's synchronous `act` around the key event, so the period transition suspended inside `act` ("A component suspended inside an `act` scope, but the `act` call was not awaited") and its retry was never flushed. Before the change, the click came from Radix's deferred focus, outside `act`. A scratch reproduction (deleted) showed the same stall for a plain `user.click` on a transition that suspends, so this is a test-harness interaction rather than a production defect, but the established test is right to expect the new report.
- **Fix:** keep `preventDefault()` synchronous and run the focus and click in `queueMicrotask`. In a browser the microtask runs when React's root listener returns, still before keyup, so the quick-release race stays closed; in jsdom it runs after the dispatch, where Radix's flag is set and its `onFocus` clicks, and the dedupe skips the second click.
- **Files modified:** `apps/csrm/src/components/ui/radio-group.tsx`
- **Verification:** targeted 131/131 with no act warnings; full web 2,139/2,139; questionnaire journey and the full Playwright suite green.
- **Committed in:** `90b07f9`

**2. [Plan reference] The unchanged-test baseline**
- **Found during:** Task 2 acceptance
- **Issue:** the plan diffs `segmented-control.test.tsx` from `fd5866c`, which is not in this repository.
- **Fix:** used `5ea2b77`, the Phase 10 baseline (D-49); the diff is empty.
- **Committed in:** none (a check only)

---

**Total deviations:** 2 (1 Rule 1 bug fix, 1 plan reference correction)
**Impact on plan:** the handler's behaviour matches D-14 and UI-SPEC §7; only the moment of the move changed. No scope creep.

## TDD Gate Compliance

- RED: `4e98796` `test(10-03): ...`; RED evidence was verified for both tasks (`RED_EVIDENCE_OK`; records in the session scratchpad, `p10-03-red-t1.json`, `p10-03-red-t2.json`). Vitest's TAP output has no node:test summary lines, so the `# tests/pass/fail` lines in the records were counted from the same run's `ok` / `not ok` lines.
- GREEN: the plan names the GREEN commits `fix(10-03): ...` (a defect fix), not `feat(...)`: `66fe869`, `6eac5ea`, `90b07f9`. The Task 2 RED case was committed with its fix in `6eac5ea`, as the plan's single Task 2 commit specifies.

## Issues Encountered

- The Playwright web server logged a Next.js "failed-to-find-server-action" error (a Server Reference ID of all zeros) during the full run. No test failed; it is noise from an existing spec, not from this plan's change.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Every radio group the questionnaire renders and the report period control select with the arrow keys. Plan 10-05 (questionnaire autosave and guidance) can rely on the controller question's arrow keys in the journey.
- QUES-09 is shared with later Phase 10 plans, so `requirements.ready-ids` held it open (0 of 1 ready); it is marked complete when the last plan declaring it finishes.
- Ready for 10-04.

## Self-Check: PASSED

- FOUND: apps/csrm/src/components/ui/radio-group.tsx, apps/csrm/src/components/ui/radio-group.test.tsx, apps/csrm/src/components/csrm/segmented-control.tsx, apps/csrm/e2e/questionnaire-workflow.spec.ts
- FOUND commits: 4e98796, 66fe869, 6eac5ea, 90b07f9 (`git rev-list --count 559776c..HEAD` = 4)
- Acceptance: `selectAdjacentRadio` exported and used by `RadioGroupItem`; a `user.keyboard('{ArrowDown}')` case without a held key; `QUES09_ARROW_KEYS_SELECT` present (4 assertions); `segmented-control.tsx` uses the handler; `segmented-control.test.tsx` unchanged; full Playwright 86/86 with no failure.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
