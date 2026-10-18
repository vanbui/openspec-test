---
quick_id: 260911-k9r
status: complete
date: 2026-09-11
commits: [bc131fc, f29ae7b]
---

# Quick Task 260911-k9r Summary

**Administration search now waits long enough to finish typing, Enter searches immediately, and the Administration filters and selects match the other list screens.**

## Changes

- **Search delay.** The Administration list search, the Controls framework filter and the Risk Type form's applicable-control picker searched 300 ms after the last keystroke. All three now wait 700 ms through one constant (`administrationSearchDelayMs`). Pressing Enter in the list search applies it at once and cancels the pending timer.
- **Label spacing.** The Administration filters now use the same label markup as My Requests and the analyst questionnaire review list (`<label className="space-y-1 text-sm font-medium text-foreground">` around the label text and its field), keeping each `htmlFor`/`id` association. The previous `Label` primitive used a tighter line box, which is why the spacing differed.
- **Select styling.** A shared `nativeSelectClassName` (`apps/web/src/components/csrm/native-select.ts`) carries the 36px, radius-sm, surface-coloured select treatment used on the other list screens. Every Administration native select, in the list filters and the create and edit forms, uses it instead of the taller, differently rounded style.
- **Column width (follow-up, f29ae7b).** In the Administration filter grid the selects kept a 208px minimum width and stopped short of the search input beside them. They now fill their grid column.

## Verification

- `pnpm --filter @csrm/web test -- src/features/administration`: 3 files, 32 tests pass. The debounce test now asserts nothing fires at 699 ms, the search fires at 700 ms, Enter applies immediately, and no second call follows. The select assertions check the shared classes.
- `pnpm --filter @csrm/web test`: 45 files, 402 tests pass. Typecheck, lint and the list-state guard pass.
- `administration-workflow.spec.ts`: 4/4 pass in the full E2E run (after correcting its Requestor denial proof for the shared permission state; see STATE.md).
- Browser, Security Analyst, development stack:
  - Controls, Information Systems and My Requests at 1440px: every filter field sits 20px below its label top, 36px tall, radius 6px, white surface, strong input border — identical across the three screens.
  - Information Assets at 375px: all five filters 20px below their labels, 36px tall and the same full column width as the search input; no horizontal overflow.
  - Search timing on Controls: unchanged 450 ms after typing, filtered by 2.5 s; Enter applied the search by 600 ms, before the delay could have fired.

## Handling

An earlier execution attempt was stopped part-way; its partial change was reviewed, kept, completed and verified here. Commits were made from the controlling workspace.
