# Phase 14 — UI Review

**Audited:** 2026-10-11 (HEAD of `csrm`, `598bca87`, after the stage B review and walk fixes; scope `git diff e50053f..HEAD -- apps/csrm/src apps/csrm/app`, 121 files)
**Baseline:** 14-UI-SPEC.md (approved, with its 2026-10-11 stage B amendments and clarifications), `docs/design/csrm-design-direction.md` (ADR 0001; X-19 to X-23 are recorded there), 14-CONTEXT.md (D-01 to D-40), AGENTS.md
**Screenshots:** none taken. This was a code-only audit, as the constraints required (no dev server, browser, Playwright or test run). The pilot's walk screenshots in `scratchpad/walk14/` predate stage B and are not cited: every walk item (D1 to D7, O1 to O9) and every `14-REVIEW.md` finding is disposed of in 14-REVIEW-DISPOSITION.md and is not raised again here. The findings below are new, and each was checked against the code at HEAD.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false). Every interaction finding below comes from the code.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | None found. The §1 to §10 strings match the contract word for word: field, hint, lines in place of the field, queue stages, intake alert, empty states, hub row and the family N, O and P refusals. No user-facing string says "upload", "attachment", "quarantine" or "scan" (the one "scanned document" is the contract's own §8.3 wording) |
| 2. Visuals | 3/4 | At 375 a note's file chip that carries a state badge squeezes the file name to a few characters (UI-01). A restored file's table row dims only its `Name` cell (UI-04). The `Reading the file’s text…` spinner is 12 px where X-22 sets 16 px (UI-05) |
| 3. Color | 4/4 | None found. There are no hex, rgb or oklch values in feature code. Every attachment state is neutral, `Added` uses success fg and `Not added` uses danger fg, always with an icon and words. Ink is limited to the listed uses, and the drag-over state is solid `border-foreground` on `bg-surface-hover` |
| 4. Typography | 4/4 | None found. The code uses `text-xs` (caption), `text-sm` (body and table), `text-heading-sm` (sheet titles) and `.micro-label` (type label), with weight 500 only on the field label and file names, as the contract sets. `tabular-nums` is on every size and count |
| 5. Spacing | 3/4 | Most values are on the §3.9 scale, with the field's 16/24 px padding and the chip's 8 × 12 px. The queue row's block padding is 12 px, where the contract's Spacing table sets 16 px (UI-06) |
| 6. Experience Design | 3/4 | State coverage is complete: optimistic remove and restore with Undo, the kept rows, leave guards, the intake alert, focus after each change, and hash landing. Both sheets miss the §5 drawer motion (UI-02). Two chip icon buttons stay 24 px below 768 px, while their queue sibling was raised to 44 px (UI-03) |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **UI-01: at 375, a note's chip with a state badge leaves almost no room for the file's name.** `FileChip` lays out icon, name, size and badge in one non-wrapping row, and both the size and the badge are `shrink-0`. The badge `Waiting for malware check` is about 190 px wide, so on a 375 px screen the truncated name gets roughly its first letter and an ellipsis. Every file just added with a note is in this state until its check passes, so this is the usual case, not an edge case. **Fix:** in `FileChip`, below 768 px, let the badge slot wrap to its own line (`flex-wrap` with `max-md:basis-full` on the children slot, or a two-row grid), so the name keeps the chip's full width. Add a component assertion that the name's box is wider than the badge at 375.
2. **UI-03: 24 px icon-only chip controls below 768 px.** The composer chip's `Remove {name} from the list` (`note-composer.tsx:304`) and the note chip's `Download {name}` (`file-chip.tsx:94-101`) are `size="icon-xs"` at every width. Stage B (WR-405) raised the queue row's identical `Remove {name} from the list` to full width at the touch-target height on phones, so the same action is now 44 px in one place and 24 px in the other. **Fix:** add `max-md:size-11` to both, or, for the composer chip, give it the queue row's phone treatment with a visible `Remove`.
3. **UI-02: neither sheet uses the §5 drawer motion.** The text preview (`file-text-sheet.tsx:116-123`) is a full-screen fade below 768 px, and from 768 px a slide with no duration or easing token. The phone actions sheet (`files-list.tsx:722`) inherits the shared `SheetContent`'s 500 ms open and 300 ms close with `ease-in-out` (`components/ui/sheet.tsx:77`), where the direction sets 260 ms expo. **Fix:** give both `duration-(--duration-slower) ease-out-expo`, with `slide-in-from-bottom` / `slide-out-to-bottom` for the preview below 768 px (`motion-safe:` so reduced motion keeps the fade). Correct the shared Sheet's durations in a shared-UI pass.

---

## Detailed Findings

Each finding has a stable ID for the disposition file. BLOCKER means a defect that breaks task completion. WARNING means a defect that degrades quality. **No BLOCKERs were found.**

### UI-01: a note's chip with a state badge truncates the file name to nothing at 375
- **Pillar:** Visuals. **Severity:** WARNING. **needs_human_review:** false
- **Where:** `apps/csrm/src/features/attachments/file-chip.tsx:41-47` (one `flex items-center` row; the name is `min-w-0 max-w-md truncate`; the size and children slot are `shrink-0`). `apps/csrm/src/features/request-notes/note-item.tsx` `NoteFile` puts `AttachmentStatusBadge` in that slot for every pending, blocked, unavailable or removed file.
- **Contract:** X-21 (a chip holds "the icon, the name on one line, the size and an icon-only `Download {name}` or the file's badge"); X-23 (a one-line name ends in an ellipsis "beyond 28rem"); 14-UI-SPEC §4.3 viewport row (375: "Chips stack at full width"); §3.2 focal point (the file's name).
- **Evidence:** at 375 the chip is about 290 px wide inside the note. Padding (24 px), icon (16 px), gaps, size (about 45 px) and the badge (about 190 px) leave the name almost no room. The X-23 ellipsis is meant to start at 28rem, not at about 2rem.
- **Fix:** see Top fix 1. From 768 px the one-row chip can stay.

### UI-02: the text preview and the actions sheet miss the §5 drawer motion
- **Pillar:** Experience (Motion). **Severity:** WARNING. **needs_human_review:** false
- **Where:** `file-text-sheet.tsx:116-123` (raw `SheetPrimitive`: below 768 px `fade-in-0`/`fade-out-0` only, full screen; from 768 px `slide-in-from-right` with no duration or easing token). `files-list.tsx:722` uses `SheetContent side="bottom"`, whose classes at `components/ui/sheet.tsx:77` are `ease-in-out`, `duration-500` open and `duration-300` close.
- **Contract:** 14-UI-SPEC Motion ("Sheets: §5 'Drawer / side panel'; fade only under reduced motion"); direction §3.11 `--duration-slower` 260 ms ("Drawer/side-panel slide") and §5 ("Drawer / side panel / route swap | 260ms | expo | Fade + short slide"). The direction's own summary says motion stays within 80 to 260 ms, and 500 ms is outside that.
- **Fix:** see Top fix 3. The shared Sheet's durations predate Phase 14, but Phase 14 is the first phase to ship a bottom sheet through it. Record the shared-primitive part as its own item if it is deferred.

### UI-03: chip icon buttons stay 24 px below 768 px
- **Pillar:** Experience (Accessibility). **Severity:** WARNING. **needs_human_review:** true (the contract's 2.5.8 row permits 24 px for "chip icon buttons", and the direction requires 44 px below 768 px. Someone has to choose which wins)
- **Where:** `apps/csrm/src/features/request-notes/note-composer.tsx:304` (`Remove {name} from the list` on each chosen-file chip, `size="icon-xs"`). `apps/csrm/src/features/attachments/file-chip.tsx:94-101` (`Download {name}` on a note's chip, `size="icon-xs"`).
- **Contract:** direction §4 Buttons ("touch targets ≥44px below 768px"). 14-UI-SPEC §1.4's stage B amendment (WR-405, walk O2) applied that rule to the queue row's `Remove {name} from the list`. 14-UI-SPEC Accessibility 2.5.8 ("phone actions meet the touch-target height"). O6's 24 px ruling covered the `Note · {instant}` link as a fact, not an action, so it does not cover these buttons.
- **Fix:** see Top fix 2.

### UI-04: a restored file's table row is dimmed only in its `Name` cell
- **Pillar:** Visuals. **Severity:** WARNING. **needs_human_review:** false
- **Where:** `files-list.tsx:353-354`. `pendingOpacity` and `data-pending` are on the `Name` cell's wrapper only (and on the `AI inputs` cell at `:334`, which renders nothing while pending, `:565`). `Size`, `Added by`, `Added`, `Note` and the actions cell, which shows the state badge of a file restored as waiting (IN-408), stay at full opacity. The card (`:693`) and the removed row (`:643`) dim the whole item correctly.
- **Contract:** 14-UI-SPEC §3.5 ("Restoring returns the file at the pending opacity"); Motion ("Optimistic pending (remove, restore …): the §5 Optimistic UI pending opacity"); direction §5 Optimistic UI (opacity 0.6).
- **Evidence:** from 768 px, while a `Restore` or `Undo` waits for Strapi, the row reads as part dimmed and part settled. The badge in the actions cell looks confirmed before the server has answered.
- **Fix:** add a row-level hook to `DataTable` (a `getRowProps` or `rowDataAttributes` that sets `data-pending` on the `tr`) and apply `pendingOpacity` to the row. Otherwise, wrap every cell's content in the same `pendingOpacity` div. Extend the existing optimistic-restore test to assert that every cell is dimmed.

### UI-05: the `Reading the file’s text…` spinner is 12 px
- **Pillar:** Visuals. **Severity:** WARNING (minor). **needs_human_review:** false
- **Where:** `apps/csrm/src/features/attachments/file-ai-control.tsx:214` (`Loader2 … size-3`).
- **Contract:** X-22 ("the switch waits for the server with `Reading the file’s text…` and the 16px inline spinner"); direction §5 Optimistic UI ("inline 16px spinner"). The queue's `Adding…` spinner already follows this (`upload-queue.tsx:402`, `size-4`).
- **Fix:** `size-4`, keeping `motion-reduce:animate-none`.

### UI-06: the queue row's block padding is 12 px
- **Pillar:** Spacing. **Severity:** WARNING (minor). **needs_human_review:** false
- **Where:** `apps/csrm/src/features/attachments/upload-queue.tsx:466` (`px-4 py-3`). The removed group's rows use `p-3` too (`files-list.tsx:643`), which the contract does not set explicitly.
- **Contract:** 14-UI-SPEC Spacing ("16px | … queue and card row padding"); X-20 ("at least the 44px row height", which `min-h-11` meets).
- **Fix:** `py-4` on the queue row, or record in the spec that the 16 px is inline only. If the removed rows should match, use `p-4` there too.

### Pillars with nothing to raise
- **Copywriting:** none found. Checked: `attachments-domain.ts` (field, hint, §1.2 and §3.6 lines, empty states, the removed toggle, intake copy), `notes-domain.ts` (`Attach files`, `Write a note to say what these files are.`, the hand-off caption), `refusal-copy.ts` families N to P, the hub row (`{n} file|files`, `Add files`, `No files`) and `file-text-sheet.tsx`.
- **Color:** none found. All status colours come through `text-success`, `text-destructive` and `text-foreground-secondary`. Feature code contains no BProton literal.
- **Typography:** none found. Phase 14 code introduces no size, weight or family outside §3.10.

---

## Files Audited
- `apps/csrm/src/features/attachments/`: `file-field.tsx`, `upload-queue.tsx`, `files-list.tsx`, `files-section.tsx`, `files-skeleton.tsx`, `file-chip.tsx`, `file-type-icon.tsx`, `file-ai-control.tsx`, `file-text-sheet.tsx`, `attachments-domain.ts`
- `apps/csrm/src/features/request-notes/`: `note-composer.tsx`, `note-item.tsx`, `notes-domain.ts`
- `apps/csrm/src/features/requests/`: `request-form.tsx`, `request-hub.tsx`, `request-workflow-actions.tsx`
- `apps/csrm/src/components/ui/sheet.tsx`, `sonner.tsx`; `apps/csrm/src/lib/api/refusal-copy.ts`; `apps/csrm/app/globals.css` (duration tokens)
- Baseline: `14-UI-SPEC.md`, `14-REVIEW-DISPOSITION.md`, `docs/design/csrm-design-direction.md`, `13-UI-REVIEW.md` (format)

Registry audit: skipped. 14-UI-SPEC's Registry safety lists no third-party registry.
