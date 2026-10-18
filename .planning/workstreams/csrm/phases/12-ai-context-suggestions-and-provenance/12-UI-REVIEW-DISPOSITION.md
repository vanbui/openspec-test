---
phase: "12"
status: complete
implementation_blockers: 0
verification_warnings: 0
ui_review: 12-UI-REVIEW.md
---

# Phase 12 UI review disposition

The independent UI audit (`12-UI-REVIEW.md`, gsd-ui-auditor, 2026-10-08) scored 19/24 against `12-UI-SPEC.md` and the design direction, with no blocker. It was a bounded code audit at HEAD after the stage B review fixes; the pilot's walk screenshots, taken before those fixes, served as historical evidence only. Each finding is disposed of below. The fixes were made test-first in a web unit (the new or corrected test failed on the code before the fix and passes after it), and two dated UI-SPEC amendments record the changed values.

| Finding | Disposition | Evidence and next action |
|---|---|---|
| UI-01 | Fixed, 17d3535 and 3061ad6 | The shared `DialogContent` and `AlertDialogContent` now default to the direction's 480 px confirm size. `dialog-size.test.tsx` failed before on `sm:max-w-lg` and passes after; it also pins `ConfirmDialog`'s own 480 px and quick find's 640 px. Nothing rendered the 512 px default before the change, so no current screen moves. This closes stage B observation S3. |
| UI-02 | Deferred to Phase 18 (ASSESS-15 criterion 3) | The phone editing layout (a form column of about 229 of 360 px at 375, the Risk card nested in a card) belongs to Phase 18's stacked card list with a detail sheet below 768 px. Recorded in `deferred-items.md` (stage B row) and in `12-REVIEW-DISPOSITION.md` (pilot walk, routed). |
| UI-03 | Deferred to Phase 18 (ASSESS-15 criterion 3) | The editor's length (18,376 px and 457 Tab stops at 1440) belongs to Phase 18's risk table and density work. The audit's interim idea, a "Next to review" jump from the review bar, is passed to Phase 18's planning with this row. Recorded in `deferred-items.md`. |
| UI-04 | Fixed, 49bb951 and dfa5d16 | The source title in the popover and the bottom sheet is now `--text-heading-sm`, the panel-title style of the run sheet. The test failed before on `text-sm font-medium` and passes after. The audit's human-review flag is resolved by the direction's panel-title rule; `12-UI-SPEC.md` §4.2 and its Typography table carry the dated amendment (2026-10-08, UI-04). |
| UI-05 | Fixed, 49bb951 and dfa5d16 | The `· k without a source` caption is its own caption line beside the count, with no `font-normal` override inside the 500-weight line, and keeps tabular figures. The test failed before (the status line contained the caption) and passes after. `12-UI-SPEC.md` §3.2 carries the dated amendment (UI-05). |
| UI-06 | Fixed, 49bb951 and dfa5d16 | The citations use `max-w-md` (the codebase's utility for 28rem) with `w-full` on the citation button, replacing the arbitrary `max-w-[min(28rem,100%)]`. The test failed before on the arbitrary width and passes after. Measured in Chromium: unchanged at 375; at 1440 each citation keeps its 448 px cap and ellipsis, and a following citation that fits now sits beside a cut-off one, as §4.1's wrapping list describes. |
| UI-07 | Fixed, 49bb951 and dfa5d16 | The review bar takes its count wording from `outstandingProposalsLabel` in the zod-free provenance domain module instead of a plural built in JSX. A spy test failed before (never called) and passes after; the domain test covers 0, 1 and 2. |
| UI-08 | Accepted, with browser evidence | Tab moving through a live toast is not a keyboard trap under WCAG 2.1.2. Stage B unit W1a1 checked it in the browser in both projects, before and after its fixes: the Tab path is Add Risk, the toast, Close, Undo, then Add Risk again, and Shift+Tab leaves; focus is never held in the toast. This is the walk's D8, accepted in `12-REVIEW-DISPOSITION.md`. The audit's human-review flag is answered by that evidence. |
| UI-09 | Accepted | No post-fix screenshot capture exists for this audit. The pilot's stage B rulings accept the browser tests that prove D1 to D4 in the final gate as their re-verification, and the premium-bar verdict in `12-UAT.md` is the pilot's "pass after the walk fixes". |

The NVDA reading of a field marker's description remains the operator's manual check in `12-UAT.md`; it is not a UI review finding.
