# Phase 13 — UI Review

**Audited:** 2026-10-10 (HEAD of `csrm`, `3e23ad0`, after the stage B review and walk fixes; scope `git diff ab000f6..HEAD -- apps/csrm/src`, 148 files)
**Baseline:** 13-UI-SPEC.md (approved, with its 2026-10-09 stage B and execution amendments), `docs/design/csrm-design-direction.md` (ADR 0001; X-15 to X-18 are recorded there), AGENTS.md
**Screenshots:** none taken. This was a code-only audit, as the constraints required (no dev server, browser or Playwright). The pilot's walk screenshots in `scratchpad/walk13/*.png` (375 and 1440, taken 2026-10-09 before stage B) were read as historical evidence and checked against the code at HEAD. D1 to D5 and O1 are fixed (13-REVIEW-DISPOSITION.md rows D1 to D5 and O1), O2 is fixed in the spec, and O3 is accepted under Phase 10 D-19. None of them is raised again here. The D4 clipped search ring that `walk13-picker-sheet-375.png` shows is fixed at HEAD (`components/ui/command.tsx`, disposition D4).
**Interaction captures:** off (`workflow.ui_interaction_capture` is false). Every interaction finding below comes from the code or from the pilot's walk.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | The §5 to §13 strings match the contract word for word. Three fallbacks that are not in the contract (`a Security Analyst`) can reach a toast or caption (UI-06) |
| 2. Visuals | 3/4 | The block, thread, signal and Home row follow X-15 to X-18. In the picker, the highlighted option looks chosen while the error says "Choose a Security Analyst first." (UI-01). The run sheet's `Notes` group breaks the sheet's label and value structure (UI-07) |
| 3. Color | 3/4 | Feature code has no hex, rgb or oklch values, and unread is ink. The copy-failed toast uses the danger hue for a recoverable outcome (UI-04). Two utilities name the same values under different tokens from the contract's (UI-08) |
| 4. Typography | 3/4 | Sizes are `text-xs`, `text-sm` and `text-heading-sm`, with weight 500 only in Phase 13 code. The new hub rows `Assigned to` and `Notes` use a hand-built uppercase sans label rather than `micro-label` (UI-05) |
| 5. Spacing | 3/4 | Most values are on the §3.9 scale. Off scale: the picker's 6 px offset and `gap-1.5` on the new filter labels. The status-to-actions gap at 375 is 16 px where the contract sets 8 px (UI-03) |
| 6. Experience Design | 3/4 | State coverage is complete: optimistic apply, rollback, Undo, the kept reason and text, the unsent well, hash landing and focus. The picker skips the shared `Popover` and `Sheet` and, with them, the §5 motion (UI-02). NVDA is still pending (UI-09) |

**Overall: 18/24**

---

## Top 3 Priority Fixes

1. **UI-01: in the picker, the option cmdk highlights looks chosen, but `Assign to a Security Analyst` refuses it.** `walk13-picker-1440.png` and `walk13-picker-sheet-375.png` show "Sam Analyst" filled with `bg-surface-muted` above "Choose a Security Analyst first." A person who believes they chose someone gets an error, and the only difference between highlighted and chosen is a 16 px check. **Fix:** give the chosen row a second cue (`font-medium` plus the check, with `aria-selected` kept for the active row), or have the action read `Assign to {highlighted name}`. Keep UI-D5's rule that choosing never applies on its own. The smallest version: with exactly one option and nothing chosen, choose it when the action is pressed.
2. **UI-02: the picker uses raw Radix `Popover` and `Dialog` with fade-only motion** (`assign-picker.tsx:343`, `:370`). This drops the shared primitives' slide and scale, and the direction's 180/120 ms popover timing and 260 ms drawer timing (§5). The phone sheet is a full-screen fade, not a drawer. **Fix:** compose `@/components/ui/popover`'s `PopoverContent` and `@/components/ui/sheet`'s `SheetContent` (shadcn first, per AGENTS.md), or add the §5 `slide-in-from-bottom` and `translate-y-1` classes and the duration tokens, with fade only under reduced motion.
3. **UI-03: spacing off the §3.9 scale, and a gap the contract does not set.** `sideOffset={6}` (`assign-picker.tsx:379`) and the new filter labels' `gap-1.5` (`request-table.tsx:243`, `assessment-list.tsx:207`) are 6 px. At 375, the assignment caption-to-actions gap is 16 px (`assignment-block.tsx:211`, `gap-4`), where 13-UI-SPEC Spacing sets 8 px. **Fix:** use `sideOffset={4}` (the shared Popover default) or 8. Use `gap-2` on filter labels in a shared-UI pass, since the pattern predates this phase. Use `gap-2` on the block's stacked row below `md`.

---

## Detailed Findings

Each finding has a stable ID for the disposition file. BLOCKER means a defect that breaks task completion. WARNING means a defect that degrades quality. **No BLOCKERs were found.** Every surface the walk exercised passed axe with no serious or critical violations and showed no horizontal overflow at 375 or 1440 (13-PILOT-RULINGS.md, "How it ran").

### UI-01: the picker's highlighted option reads as chosen
- **Pillar:** Visuals / Experience. **Severity:** WARNING. **needs_human_review:** true (the choice of cue)
- **Where:** `apps/csrm/src/features/request-assignment/assign-picker.tsx:298` (`data-[selected=true]:bg-surface-muted` with the `Check` at `opacity-0` until chosen), `:311` (the error), `:333` (the action label).
- **Contract:** 13-UI-SPEC §6, List and Action (the active option uses `--color-bg-inset`; choosing marks it with `Check`); X-2.
- **Evidence:** both walk screenshots show the first option filled while nothing is chosen. The 1440 capture shows "Choose a Security Analyst first." under it at the same time.
- **Fix:** see Top fix 1. Add a component test that the chosen and active states differ in more than the icon.

### UI-02: the picker skips the shared overlay primitives and the §5 motion
- **Pillar:** Experience (Motion). **Severity:** WARNING. **needs_human_review:** false
- **Where:** `assign-picker.tsx:340-347` (the sheet: overlay and content `fade-in-0`/`fade-out-0` only, full screen) and `:370-379` (the popover: fade only, no `zoom`/`slide`, no duration token).
- **Contract:** 13-UI-SPEC Motion ("Picker popover: §5 Dropdown / popover / menu; the phone sheet as §5 Drawer / side panel; fade only under reduced motion"); direction §5 lines 488 and 491; AGENTS.md "Use shadcn/ui before creating custom primitives". `components/ui/popover.tsx:33` already carries the slide and zoom.
- **Fix:** see Top fix 2. Keep the `virtualRef` anchor, which `PopoverAnchor` supports.

### UI-03: spacing off the §3.9 scale
- **Pillar:** Spacing. **Severity:** WARNING. **needs_human_review:** false
- **Where:**
  - `assign-picker.tsx:379` `sideOffset={6}`.
  - The new `Assigned to` and `Notes` filter labels, `request-table.tsx:243` and `assessment-list.tsx:194`/`:207`, use `gap-1.5`. They copy the pattern of 7 labels that were already there at `ab000f6`.
  - `assignment-block.tsx:211`: the outer `gap-4` gives 16 px between the caption and the stacked actions at 375.
- **Contract:** direction §3.9 (2, 4, 8, 12, 16 … px, no 6); 13-UI-SPEC Spacing, the 8px row ("between the assignment status line, caption and actions").
- **Fix:** see Top fix 3. The filter-label `gap-1.5` belongs to a shared-UI pass, because changing only Phase 13's labels would make them inconsistent with their siblings.

### UI-04: a recoverable clipboard refusal uses the danger toast
- **Pillar:** Color. **Severity:** WARNING. **needs_human_review:** true
- **Where:** `apps/csrm/src/features/request-notes/unsent-note-well.tsx:60` (`toast.error`).
- **Contract:** 13-UI-SPEC §9.4 amendment (2026-10-09, plan 13-11) gives the toast's title and description but no kind. 13-UI-SPEC Color reserves danger for rollback toasts ("Status: danger (rollback toasts)").
- **Why it matters:** the text is selected and nothing failed that the person must recover from. A danger edge and icon overstate it.
- **Fix:** use the neutral `toast()` (or `toast.info`) with the same title and description. Otherwise, record the danger kind in the §9.4 amendment.

### UI-05: the new hub rows use a hand-built label rather than the micro-label
- **Pillar:** Typography. **Severity:** WARNING. **needs_human_review:** true (which phase owns it)
- **Where:** `apps/csrm/src/features/requests/request-hub.tsx:105-107` (`text-xs font-medium uppercase tracking-wide text-muted-foreground` on the `Requestor`, `Assigned to` / `Security Analyst` and `Notes` terms).
- **Contract:** 13-UI-SPEC Typography level 4 (`--text-micro` for micro-labels); direction §3.10 (IBM Plex Mono for micro-labels). The `Request context` section directly below uses the `micro-label` class (`DESCRIPTION` in `walk13-picker-1440.png`), so the same page shows two label styles.
- **Scope:** the hub's other rows already used this form at `ab000f6`. Phase 13 extended an existing inconsistency rather than introducing it.
- **Fix:** replace the classes on every hub `dt` with `micro-label text-foreground-secondary`. Do it in one change so the hub stays consistent. Check the request-hub tests that read these terms.

### UI-06: copy fallbacks the contract does not name
- **Pillar:** Copywriting. **Severity:** WARNING (low). **needs_human_review:** true
- **Where:** `apps/csrm/src/features/request-assignment/assignment-domain.ts:65`, `:154`, `:170` (`'a Security Analyst'` when a display name is absent).
- **Contract:** 13-UI-SPEC "People are names" (D-04), §7.1.
- **Why it matters:** "Undone. RAR-… is assigned to a Security Analyst again." reads as though the request is unassigned. The fallback is defensible when a projection lacks a name, but the contract does not record it.
- **Fix:** add the fallback to 13-UI-SPEC §7.1 as a dated amendment, or use the copy the hub uses for a missing person (`Not recorded`).
- **Not raised:** the `{n} new {note|notes}` helpers duplicated in `assessment-list.tsx:254` and `request-table.tsx:96` are IN-404, which is Accepted in 13-REVIEW-DISPOSITION.md.

### UI-07: the run sheet's `Notes` group breaks the sheet's structure
- **Pillar:** Visuals. **Severity:** WARNING (low). **needs_human_review:** false
- **Where:** `apps/csrm/src/features/ai-assistance/ai-run-sheet.tsx:131-153`. A hand-built `section` with a plain count paragraph and a `ul`, where every other group is `Group` (`:85`) with `Row`'s `dt.micro-label` / `dd` pairs.
- **Contract:** 13-UI-SPEC §10.3 ("A group after `Request`"); 12-UI-SPEC §2.2's group layout.
- **Fix:** render it as `<Group title="Notes"><Row label="Included">…</Row></Group>`, with the per-note rows in the `dd`. The WR-607 browser assertion pins the text, so keep the words.

### UI-08: token names drift from the contract's
- **Pillar:** Color. **Severity:** WARNING (low). **needs_human_review:** false
- **Where:** `unsent-note-well.tsx:81` `bg-muted` (the contract names `--color-bg-inset` → `bg-surface-muted`, which is the same value through `--surface-muted: var(--muted)`). `requestor-home.tsx:71`, `:202` and `assessment-list.tsx:61-62`, `:590` use `text-muted-foreground` where the new Phase 13 lines use `text-foreground-secondary`.
- **Contract:** 13-UI-SPEC "Token names used in this contract" (`bg-surface-muted`); AGENTS.md semantic tokens.
- **Effect:** none visible today, because the values match. A future retheme of `--surface-muted` would leave the well behind.
- **Fix:** use `bg-surface-muted` in the well and `text-foreground-secondary` in the new lines.

### UI-09: still unverified by a person
- **Pillar:** Experience. **Severity:** WARNING. **needs_human_review:** true
- NVDA reading the Undo toast through Alt+T, the switch state and one "Note added." is **pending, the operator's** (13-PILOT-RULINGS.md, Manual-Only results). The accessible facts pass.
- No post-fix capture exists for D1 (hash landing), D3 or D5. The pilot accepted the browser assertions in the final gate (dispositions D1, D3, D5 browser rows). **Fix:** in `13-UAT.md`, take one 375 capture of a `#notes` landing and of the composer at twelve rows.

### Pillar 1: Copywriting (3/4)
- **Checked against the contract:**
  - The §5.2 captions and lines and the §5.3 history sentences (`assignment-domain.ts:84-139`).
  - The §7.1 toasts and failure titles (`:156-178`), with the released suffix "Reassign it if someone else should hold it."
  - The §8.1 descriptions, §8.3 hints and all three validation messages, the §8.4 closed lines and the §8.5 empty states (`notes-domain.ts:72-213`).
  - The §9.4 well copy and the §10.4 toasts.
  - The §2.1 empty copy (`assessment-list.tsx:235`), the IN-405 error description (`app/(app)/app/review/assigned/error.tsx:10`), the queue labels (`Requires attention`, `All open`) and the `Assigned to` filter values.
- No string uses "Accept", "claim", "assignee" or "unassigned" in the interface copy (IN-503's guard).
- UI-06 is the one gap.

### Pillar 2: Visuals (3/4)
- The focal points hold. The status line is `text-sm font-medium` with `tabIndex={-1}` (`assignment-block.tsx:214`). The newest note sits above the composer. Tile 1 leads the analyst Home.
- Icons are `aria-hidden` and sit beside words. Icon-bearing buttons carry names that begin with the visible label (`assignmentActionName`, `Close assign`).
- Notes follow X-16: hairlines, no bubbles, the part in words, the ten-line clamp (`note-item.tsx:65-85`).
- The signal stacks at 375 and joins with ` · ` from `md` (`ai-inputs-changed.tsx:72-81`), as `walk13-signal-card-375.png` shows.
- UI-01 and UI-07.

### Pillar 3: Color (3/4)
- There are no `#hex`, `rgb(` or `oklch(` values in the Phase 13 feature files.
- Unread is ink: `text-foreground` with a `bg-foreground` dot (`unread-marker.tsx:15-16`), never a status hue (X-17, UI-D12).
- Ink appears only on the contract's list:
  - `Add note`, the only primary in the phase;
  - figure and record links, with `text-text-link` on the hub figure;
  - the checked switch and checkbox;
  - focus rings.
- Every `Pick up`, block action, `Assign to {name}` and toggle is `variant="outline"`. `Show full note`, `Copy text` and `Discard text` are ghost.
- Errors use `text-destructive` under the field (§4 Forms).
- UI-04 and UI-08.

### Pillar 4: Typography (3/4)

| Class (Phase 13 feature files) | Uses | Role |
|---|---|---|
| `text-xs` | 55 | captions, times, unread marker |
| `text-sm` | 51 | body, status line, note authors |
| `text-heading-sm` | 1 (+ `DetailSection` titles) | picker sheet title, run sheet group |
| `font-medium` | 36 | status line, authors, signal heading, unread |
| `font-semibold`, `text-base` | 1 each | `request-hub.tsx:37`, unchanged since `ab000f6` (not Phase 13) |

- This is the §3.10 scale, as 13-UI-SPEC Typography requires, and every count carries `tabular-nums`.
- UI-05 is the one Phase 13 departure.

### Pillar 5: Spacing (3/4)

| Class | Uses |
|---|---|
| `gap-2` | 25 |
| `gap-1` | 15 |
| `gap-1.5` | 10 (UI-03) |
| `gap-4` | 9 |
| `gap-3`, `mt-1` | 7 each |
| `p-4`, `py-4` | 5 each |

- Notes take 16 px block padding (`py-4`), with 4 px between the header and the body (`gap-1`) and 16 px between the thread and the composer (`gap-4`). The history events take 16 px. All of this matches 13-UI-SPEC Spacing.
- The arbitrary values are justified:
  - `min-h-[calc(3lh+1rem+2px)]` / `max-h-[calc(12lh+1rem+2px)]` is the D5 fix (`note-composer.tsx:190`);
  - `w-[min(480px,calc(100vw-2rem))]` is the direction's confirm width (`assign-picker.tsx:373`);
  - `scroll-mt-24` is the hash-landing offset.
- UI-03.

### Pillar 6: Experience Design (3/4)
- **All five states are covered**, per 13-UI-SPEC §14:
  - The picker shows a skeleton after 300 ms, then the no-one-eligible, no-match and error states with `Try again`.
  - The notes show the page-skeleton block (`notes-skeleton.tsx`, used by both request `loading.tsx` routes), the compact read error with the composer kept (`notes-thread.tsx:321`), the open and closed empty states (`:330`) and the closed line with `Lock`.
  - `Show earlier notes` shows a spinner and a failed state.
- **Optimistic changes and rollback:**
  - The block, the row `Pick up` and the switch use `data-pending` at opacity 0.6 with no transition, and ease back at `--duration-base` (`assignment-block.tsx:213`, `queue-pick-up-button.tsx:157`, `note-ai-input-switch.tsx:86`).
  - A pending note shows `Adding…` and fades out on failure (`note-item.tsx:66`).
  - WR-301 rolls back in place with the danger toast. WR-303/502 keep text typed during a pending post.
- **Undo** is offered only where the reverse is allowed (`undoAllowed`, UI-D4).
- **No lost input:** the session-kept composer text and picker reason, the `beforeunload` guard (IN-303, IN-304), the unsent well with undoable Discard, and the sign-out prompt (WR-401).
- **Focus:** §7.3 holds, including D2's empty-queue case. Hash landing after streaming is D1's `useHashLanding`, and D3 moves focus to the note.
- **Not-found for another Requestor:** fixed under O1.
- UI-02 and UI-09.

---

## Registry Safety

Registry audit: 0 third-party blocks checked, no flags. The 13-UI-SPEC Registry safety table lists only the source-owned shadcn components, and no block was added (2026-10-01).

---

## Files Audited
- `apps/csrm/src/features/request-assignment/`: assignment-block.tsx, assign-picker.tsx, assignment-history.tsx, queue-pick-up-button.tsx, assignment-domain.ts
- `apps/csrm/src/features/request-notes/`: notes-section.tsx, notes-thread.tsx, note-item.tsx, note-composer.tsx, note-ai-input-switch.tsx, unread-marker.tsx, unsent-note-well.tsx, notes-skeleton.tsx, notes-domain.ts
- `apps/csrm/src/features/assessments/`: assessment-list.tsx (Requests, Assigned to me, the cards and the unread line), request-context-lines.tsx
- `apps/csrm/src/features/requests/`: request-hub.tsx, request-table.tsx (My requests)
- `apps/csrm/src/features/home/requestor-home.tsx`; `apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.ts`
- `apps/csrm/src/features/ai-assistance/`: ai-inputs-changed.tsx, ai-run-sheet.tsx
- `apps/csrm/src/components/ui/popover.tsx`, `sheet.tsx`; `apps/csrm/app/globals.css` (token mapping); `apps/csrm/app/(app)/app/review/assigned/error.tsx`
- 13-UI-SPEC.md, 13-REVIEW-DISPOSITION.md, 13-PILOT-RULINGS.md, 12-UI-REVIEW.md (format), `docs/design/csrm-design-direction.md` (§3.9, §5, X-15 to X-18)
- Walk screenshots: walk13-picker-1440, walk13-picker-sheet-375, walk13-B3-notes-375, walk13-B2-history-375, walk13-signal-card-375, walk13-jane-home-375
