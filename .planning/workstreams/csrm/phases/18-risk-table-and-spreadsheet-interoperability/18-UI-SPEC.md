---
phase: "18"
slug: "risk-table-and-spreadsheet-interoperability"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-10-01"
reviewed_at: "2026-10-01"
---

# Phase 18 — UI Design Contract

> Visual and interaction contract for the risk table and spreadsheet interoperability (ASSESS-15 to ASSESS-19). It covers:
> - the analyst's record as two routes, Overview and Risks, with local navigation (D-06);
> - the editable grid, its cell states, the keymap and the announcements (D-11, D-17);
> - the unsaved-changes bar, one batch save, Undo, and conflicts (D-12 to D-16);
> - copy, and paste with its preview (D-18, D-19);
> - the 5 × 5 matrix picker, the derived rating and its override (D-20 to D-22);
> - columns, filters, saved views and the column chooser the review lists adopt (D-07 to D-10);
> - the risk detail sheet, the read-only modes, the acceptance-round lock, import, export and the phone card list (D-05, D-23, D-24, D-26).
>
> It adds no colour, type size, weight, family, radius, shadow or duration. Nine patterns are proposed as CSRM extensions X-53 to X-61; two of them record new widths (§10).

---

## Binding inputs and value authority

- **Locked decisions:** D-01 to D-30 in `18-CONTEXT.md`. No RESEARCH exists yet. Decision 7's spike picks the grid, so this contract fixes behaviour, anatomy and copy, never a library API. Operation names, reason codes, bounds and the lag threshold are research's; this contract names them as CONTEXT D-03 proposes.
- **Value authority:** `docs/design/csrm-design-direction.md` (ADR 0001) only, cited by section (§). This contract restates no value.
- **Extensions reused:** X-2 and X-40 (record and person pickers), X-3 (dates), X-4 (separators), X-7 (shortcut hints), X-10 (figure links), X-11 (AI markers), X-13 (side sheet), X-14 (Undo toast), X-19 and X-32 (import file field and row state), X-24 (comparison table anatomy), X-27 (withdrawn records), X-29 (record history), X-30 (export and column choice), X-39 (`Your risk`), X-42 and X-47 (decision values and change markers), X-48 (contest markers).
- **Earlier contracts, cited by section and never restated:**
  - **Phase 10:** §6.3 (leave warning), §10.2 (refusal format), §13.1 (record picker), §14 (readiness anatomy), §15.2 (shared read-only Risk).
  - **Phase 11:** "Voice, formats and shared copy rules"; §7 (lists, density, mobile cards); §8 (figure links); §12 (five-state format).
  - **Phase 12:** §3.1 (field markers), §6 (decisions and Undo), family J.
  - **Phase 15:** §4.2 and §4.3 (comparison by kind).
  - **Phase 16:** §1 (editor order), §2 (`AI proposals`), §6.1 to §6.5 (withdraw, reinstate, `Show`, withdrawn card), §8 (history sheet), family R.
  - **Phase 17:** §5.1 and §5.2 (editing pause, analyst owner), §6.1 and §6.2 (participant page, `Show`), §7 and §8 (responses), §11 (people picker), family U; amendments 1 and 2.
  - **Phase 17.1:** §1 (mapping), §2.1 and §2.2 (review, change markers), §2.6 (Risk form labels before release), §5.2 (paused editor), §6.4 (participant risk cards), §7 and §8 (decisions, trail), family V.
  - **Phase 17.2:** §2 (contest markers), §4 and §5 (points panel and sheet), family W.
  - **Phase 19:** §1 and §2 (Export action and dialog), §3 (file contents), §5 (the five-step import), §6 (family S), §7 (toasts).

### Decision coverage

| Decisions | Where |
|---|---|
| D-05 | §7 (modes and banners) |
| D-06 | §1 (routes, Overview), §6 (detail sheet), §8 (participant page) |
| D-07 to D-10 | §2.3 (columns), §5 (finding, views, column chooser, review lists) |
| D-11, D-20 to D-22 | §2.4 (editors), §4 (matrix picker, derived rating, override, off-scale values) |
| D-12 to D-16 | §3 (change set, save, conflicts, Undo, rows and bulk actions) |
| D-17 to D-19 | §2.5 (keymap, announcements), §3.6 (copy and paste, preview) |
| D-23, D-24 | §9 (import and export) |
| D-26 | §11 (phones) |
| D-27, D-28 | §2.1 (layout), §13 (G-4), Copywriting, extensions |
| D-29 | §14 (test assertions, SC1's keystroke bound) |

---

## Design System

| Property | Value |
|---|---|
| Tool | shadcn (source-owned, unchanged) |
| Preset | new-york / neutral / CSS variables / lucide |
| Component library | radix (`radix-ui`) |
| Icon library | `lucide-react` 1.30.0 |
| Font | §3.10 families, unchanged |
| Table engine | `@tanstack/react-table` 9.2.4, already a dependency (D-04's lean); the spike may replace it with react-data-grid (MIT). This contract holds for either. |

Every icon named here was confirmed in the installed `lucide-react` 1.30.0 on 2026-10-01 (`node -p` over its exports in `apps/csrm`): `Table2`, `Columns3`, `Undo2`, `Redo2`, `ClipboardPaste`, `Copy`, `CopyPlus`, `Upload`, `Download`, `GitMerge`, `TriangleAlert`, `CircleAlert`, `CirclePause`, `Lock`, `Bookmark`, `BookmarkPlus`, `Share2`, `Users`, `Save`, `Search`, `SlidersHorizontal`, `ListFilter`, `ArrowUp`, `ArrowDown`, `ArrowUpDown`, `GripVertical`, `PanelRight`, `Plus`, `Archive`, `ArchiveRestore`, `Grid3x3`, `Scale`, `CircleSlash`, `Eraser`, `Check`, `X`, `PenLine`, `Info`, `Keyboard`, `ChevronDown`, `ChevronRight`, `Ellipsis`, `History`, `FileSpreadsheet`.

**New dependencies:** none from this contract. TanStack Virtual (MIT) is added only if D-04's measurement fails at 1,000 risks, justified in that plan.

---

## Component Inventory

### Source-owned shadcn/ui components

Enumerated by `ls apps/csrm/src/components/ui/*.tsx | grep -v '\.test\.tsx$' | wc -l` — 30 components — radix-ui@1.6.7 (shadcn/ui new-york, source-owned; version from `node -p "require('radix-ui/package.json').version"` in `apps/csrm`) — 2026-10-01.

This list is non-exhaustive: it names known-good components this phase uses and is never a closed allowlist.

| Component | Import path | Phase 18 use |
|---|---|---|
| `Table` | `@/components/ui/table` | The grid's table elements (grid roles added by the risk table) |
| `Popover` | `@/components/ui/popover` | Cell editors, the matrix picker, column filters, the column chooser |
| `DropdownMenu` | `@/components/ui/dropdown-menu` | Views menu, column menu, cell menu, `More risk actions` |
| `Command` | `@/components/ui/command` | Pick-list editors, person and control pickers (X-2, X-40) |
| `Sheet` | `@/components/ui/sheet` | Detail sheet (X-13), phone sheets |
| `Dialog` | `@/components/ui/dialog` | Paste preview, keyboard shortcuts, save view |
| `Calendar`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Label`, `RadioGroup` | `@/components/ui/*` | Editors, filters, forms |
| `Alert` | `@/components/ui/alert` | Mode banners, conflict and error summaries, refusals |
| `Tooltip` | `@/components/ui/tooltip` | Icon-only bar controls |
| `Button`, `Badge`, `Skeleton`, `Separator`, `ScrollArea` | `@/components/ui/*` | Actions, tags, skeletons, preview list |
| `sonner` `Toaster` | `@/components/ui/sonner` | Undo, success and failure toasts (X-14) |

### CSRM shared primitives

Enumerated by `ls apps/csrm/src/components/csrm/*.tsx apps/csrm/src/components/csrm/*.ts | grep -v '\.test\.' | wc -l` — 15 modules — @csrm/web@0.1.0 (source-owned) — 2026-10-01.

This list is non-exhaustive.

| Primitive | Path | Phase 18 use |
|---|---|---|
| `DataTable` | `components/csrm/data-table.tsx` | Extended, never forked (06.6 D-02): grid mode, no-pagination mode, column choice (D-10) |
| `RiskRatingBadge`, `StatusBadge` (`statusPresentation`) | `components/csrm/*` | Ratings (dense form in cells), every state label (G-13) |
| `SegmentedControl` | `components/csrm/segmented-control.tsx` | `Show`, density, the preview's filter |
| `HorizontalScrollRegion` | `components/csrm/horizontal-scroll-region.tsx` | Review lists only; the grid is its own scroller (X-53) |
| `PageHeader`, `RecordLink`, `DetailSection`, `ConfirmDialog`, `KpiTile` | `components/csrm/*` | Headers, links, Overview's `Risks` section, the leave warning |
| Earlier phases' planned modules: 10's navigation guard and `refusal-copy.ts`; 12's markers; 16's withdraw forms and history sheet; 17's people picker; 17.1's decision area and markers; 17.2's contest marker and sheet; 19's `components/csrm/export/` (`export-dialog.tsx`, `column-choice.tsx`) and import steps | as those phases plan them | §3 to §9 |
| **New** (recommended): `features/risk-table/` with `risk-table-domain.ts` (zod-free: keymap, selection, change set, undo stack, clipboard formats, paste mapping), `risk-table.tsx`, `risk-grid-cell.tsx`, `unsaved-changes-bar.tsx`, and on demand `cell-editors/*`, `matrix-picker.tsx`, `paste-preview-dialog.tsx`, `column-chooser.tsx`, `views-menu.tsx`, `risk-detail-sheet.tsx`, `keyboard-shortcuts-dialog.tsx`; `components/csrm/record-local-nav.tsx` | Planner's choice | §1 to §11 |

---

## Voice, formats and shared copy rules

Phase 11's, 17's and 17.1's rules apply unchanged. In addition:

- **Terms:** `Risks`, `Overview`, `Risk table` (in prose only), `Save changes`, `Discard`, `Unsaved changes`, `Paste`, `Keep mine`, `Take theirs`, `View`, `Columns`, `Derived rating`, `Override`, `Reason for the override`, `Not on the scale`, `Mitigation controls`. Never `Delete` for a risk (decision 6; X-27), never `Spreadsheet`, `Sheet` or `Excel mode` for the table, never `Lock` in copy for the round pause (17 §5.1's `Editing is paused`).
- **Cell references** read `{risk number} · {column header}` (X-4), never A1 notation.
- **Values in cells are display values:** names, X-3 calendar dates (`30 Nov 2026`), scale and rating labels, controls as `{control number} · {title}`. Ids never show.
- **Counts** use `tabular-nums` and written plurals: `{n} {risk|risks}`, `{n} unsaved {change|changes}`, `{k} selected`.

---

## 1. The analyst's record: Overview and Risks (D-06; X-58)

### 1.1 Local navigation

Both routes share one layout: the page header (unchanged from today, 16 §1 item 1), then the local navigation (X-58), then the route.

| Item | Route | Label |
|---|---|---|
| 1 | `/app/review/assessments/{documentId}` | `Overview` |
| 2 | `/app/review/assessments/{documentId}/risks` | `Risks ({n})`, `{n}` the active risks |

Each route has its own route title (`{assessment number} overview`, `{assessment number} risks`) and its own h1 (the page header's, unchanged). Moving between them keeps the unsaved change set (§3.1): it is stored for the record, so no leave warning shows. Leaving the record arms 10 §6.3's warning, with the title `Leave this assessment?`, descriptions `You have {n} unsaved {change|changes} to risks. If you leave now, they’ll be lost.` (the change set's session copy survives only this browser tab), confirm `Leave assessment` and dismiss `Keep editing`.

### 1.2 Overview

16 §1's order with Phase 17 to 17.2's panels, except item 5: `Identified Risks` and its cards leave the Overview. In their place, a `DetailSection` h2 `Risks` (region id `risks-summary`):

- One line while the change set holds changes: `PenLine` 16px, `{n} unsaved {change|changes} in the risk table.` and the link `Review changes` (opens Risks with the changed-rows filter).
- A row of figure links (X-10, `KpiTile` link form from 768px, a definition list of links below): `Active risks`; residual `Critical`, `High`, `Moderate`, `Low` (each with its §3.6 badge as the label); `Not rated`; `Not on the scale` (D-21); `Without a risk owner`; `AI values to confirm`; `Open contest points` (17.2's figure); `Withdrawn`. Each opens Risks filtered so its total equals the figure (`?residual=high`, `?show=withdrawn` and so on); a zero is plain text.
- `Open risks` (outline pill, `Table2`), the section's one action.
- First use: `No risks yet` · `Add a row, paste from Excel or import a file.` · `Open risks`.

Release readiness rows (10 §14, 16 §9.1, 17.1 §2.1) that name a risk or a field link to Risks with that cell active (`?cell={risk number}.{field key}`); rows that name a set of risks open Risks filtered to them. The `AI proposals` section stays on the Overview (16 §2); Risks shows `{n} open AI {proposal|proposals}` as a figure link to `#ai-proposals` while any are open.

### 1.3 Risks

The route is a data page at `--spacing-grid-max`. Order:

1. Page header and local navigation.
2. The mode banner when the table is read-only (§7.1).
3. The toolbar (§2.2).
4. The filter chip row (§4 DataTable), only while a filter is active.
5. The conflict or error summary (§3.4, §3.5), only while one exists.
6. The cell line (§2.1).
7. The grid (§2), or the phone card list below 768px (§11).
8. The unsaved-changes bar (§3.2), sticky at the bottom while it has content.

A skip link `Skip to risks` is the first item in the shell's skip-link list on this route and moves focus to the grid's active cell (UAT-063).

---

## 2. The grid (D-05, D-07, D-11, D-17; X-53, X-60)

### 2.1 Layout

| Viewport | Contract |
|---|---|
| 1440 | The grid is its own scroll container in both directions, filling the viewport height below the cell line and above the unsaved-changes bar, at least `20rem` tall (X-53). The header row and the selection and `Risk number` columns stay sticky. The end-edge fade (§4 DataTable scroll cues) applies. No pagination: the footer shows the counts only (X-60) |
| 768 to 1023 | The same, with `--spacing-gutter-sm` page padding |
| Below 768 | The card list (§11). No grid, range, fill or paste |

**Rows and cells:** §4 DataTable unchanged: 44px comfortable and 36px compact rows through the existing density toggle (`Use compact density` / `Use default density`), 16px horizontal padding, hairline row dividers, no zebra and no vertical rules, `--text-table` body, `--text-micro` headers. Long-text columns follow §4's long-text rule. The `Risk number` cell is the row header (`--font-mono` 13px).

**The cell line (X-53):** one line above the grid, `--text-body`, showing the active cell: `{risk number} · {column header}` at weight 500, then its full value, or its error, conflict or read-only reason in place of the value, wrapping up to three lines. It is an `output` described by the grid, so a screen reader hears the same text through the cell's `aria-describedby`.

**Footer:** `{n} {risk|risks}` and, when any are selected, `{k} selected`, in `--text-caption` `tabular-nums` at the grid's end edge; the same counts sit in the toolbar.

### 2.2 Toolbar

From 768px, one row that wraps, in this order:

| Control | Contract |
|---|---|
| Search | `Search risks`, matching number, statement, cause and people (D-08); 36px input with a 16px `Search` icon |
| `Show` | X-27's segmented control: `Active ({n})` and `Withdrawn ({w})`, in the address (`?show=withdrawn`); analysts only |
| View | The views menu (§5.2): `View: {name}` |
| `Columns` | Outline small pill, `Columns3` (§5.3) |
| Density | The DataTable toggle, unchanged |
| `Keyboard shortcuts` | Ghost small pill, `Keyboard`; opens the shortcuts dialog (§2.5); shows `?` as its X-7 hint |
| Counts | `{n} {risk|risks}` · `{k} selected` (`output`) |
| Edit actions (editable mode only) | `Add row` (outline small, `Plus`); `More risk actions` (outline small, `Ellipsis`): `Suggest more risks`, `Set one risk owner`, `Set one executive approver`, `Reassess residual risk for all`, each opening its earlier sheet or form unchanged (16 §2.2, 17 §2.2, 17.1 §2.6, 17 §10) |
| Page header actions | `Import` (outline, `Upload`; analysts in editable mode), then `Export` (X-30, last) |

### 2.3 Columns (D-07)

- **The default view's columns**, in order, with headers from the Risk form's labels (10 §13, 16, 17 and 17.1 §2.6, so before release the treatment columns carry 17.1 §2.6's recommendation labels): `Risk number` (frozen), `Risk statement`, `Risk Type`, `Category`, `Inherent likelihood`, `Inherent consequence`, `Inherent rating`, `Residual likelihood`, `Residual consequence`, `Residual rating`, the treatment action, the treatment plan, `Risk owner`, the treatment owner, `Target date`, the treatment resolve date, `Treatment status`, `Mitigation controls`, `Impacted system`, `Impacted asset`, `Data classification`.
- **Every other readable field** is in the column chooser, plus these computed columns: `Decision` (17.1 §1's decision state with X-47's `Will be decided again` between rounds), `Contest points` (17.2 §2's marker count), `Responses awaiting a decision` (17 §8's figure), `Status` (`Withdrawn` with reason, by and when, under the Withdrawn filter only).
- **Before release** the exception fields are not offered (17.1 §2.6). **No due state** shows from any date (G-16).
- **Mitigation controls** shows `{n} {control|controls}` as a figure link that opens the detail sheet at its controls group; the cell line lists `{control number} · {title} · {status}` for each.
- **Participants** get exactly their projection's columns (17 D-25, 17.1 D-47), never an AI value awaiting confirmation, and the `Your risk` tag (X-39) after their risk numbers.

**Markers in cells (dense form):** a cell's markers sit after its value, 12px icons, each named for assistive technology and spelled out in the cell line: X-11's `AI proposed` marker until confirmed or edited; X-48's contest marker (icon and count, a link to 17.2's point); the override note and the off-scale note (§4.3). A marker never replaces a value.

### 2.4 Cell states and editors (D-11; X-53)

| State | Treatment |
|---|---|
| Active | `--focus-ring` drawn inside the cell (X-53), on the grid's single focus |
| Range | Every cell in the range has `--color-selection`; the active cell keeps its ring |
| Selected row | §4 DataTable selection (`--color-bg-selected`, 2px ink start edge) |
| Editing | The editor fills the cell on `--color-bg-surface` with a 1px `--color-border-strong` boundary and `--radius-md`; popover editors anchor below the cell (§4 Dialogs popover motion) |
| Changed, unsaved | 12px `PenLine` before the value in `--color-text-secondary`; cell line `Unsaved change. Was: {old value}.` |
| Error | 12px `CircleAlert` in `--color-danger-fg` before the value, `aria-invalid`; cell line shows the reason (§12 X1) |
| Conflict | 12px `GitMerge` in `--color-warning-fg` before the value; cell line per §3.5 |
| Read-only (in editable mode) | No cell treatment. The header carries a 12px `Lock` in `--color-text-muted` named `read-only`; `Enter` on the cell shows the reason in the cell line |
| Empty | `Not set` in `--color-text-secondary`; a field submission needs reads `Needed to submit` (D-11: flagged, not blocked) |
| Pending save | Changed cells at opacity 0.6 (§5 Optimistic UI) until the save answers |

The row header (`Risk number`) repeats the row's worst state as one 12px icon after the number, in the order conflict, error, changed, with the accessible name `{k} conflicts`, `{k} errors` or `{k} unsaved changes`.

| Field type | Editor |
|---|---|
| Closed vocabularies (Risk Type, Category, treatment action, treatment status, data classification) | A pick list (`Command` in a popover): type to filter, arrows, `Enter` to choose |
| Likelihood, consequence, rating | The matrix picker (§4) |
| People (risk owner, treatment owner, executive approver) | X-40's person picker, 17 §11 unchanged |
| Systems, assets | X-2's record picker, 10 §13.1 unchanged |
| Dates | A date input that accepts `30/11/2026`, `30/1/2026` and `2026-11-30`, with a `Calendar` popover on `Alt+ArrowDown` |
| Long text (statement, plan, cause and the rest) | An expanding editor: a popover textarea at the column's width, at most `28rem`, growing to ten lines then scrolling |
| `Mitigation controls` | The control picker (X-2 over the control library) that adds planned controls; removing one is the detail sheet's (D-11) |

### 2.5 Keymap and announcements (D-17)

The grid is one tab stop with roving focus (`role="grid"`, `aria-rowcount`, `aria-colcount`, `columnheader` with `aria-sort`, `rowheader` for the number). Read-only modes keep every navigation, selection and copy key.

| Keys | Not editing | Editing |
|---|---|---|
| Arrows | Move one cell | Move the caret, or the editor's list |
| `Home`, `End` | First or last cell of the row | Caret to start or end |
| `Ctrl+Home`, `Ctrl+End` | First or last cell of the grid | — |
| `Page Up`, `Page Down` | Up or down by the visible rows | — |
| `Enter`, `F2` | Edit; on `Risk number`, open the detail sheet; on a header, sort | `Enter` commits and moves down (in long text, `Shift+Enter` is a line break) |
| Any printable character | Edit, replacing the value with what is typed | — |
| `Escape` | Clear the range to the active cell | Cancel the edit, keeping the old value |
| `Tab`, `Shift+Tab` | Leave the grid (APG) | Commit and move right or left |
| `Ctrl+Enter` | — | Commit and fill every selected editable cell of that column (D-16) |
| `Shift+Arrow`, `Shift+click` | Extend the range | — |
| `Shift+Space`, `Ctrl+Space`, `Ctrl+A` | Select the row, the column, everything | — |
| `Ctrl+C`, `Ctrl+X`, `Ctrl+V` | Copy, cut, paste (§3.6) | Native text editing |
| `Delete`, `Backspace` | Clear the editable cells in the range | Native |
| `Ctrl+Z`, `Ctrl+Y` (and `Ctrl+Shift+Z`) | Undo, redo (§3.3) | Native inside the editor |
| `Ctrl+S` | Save changes (in the grid and the bar only) | Commit, then save |
| `Shift+F10`, the context-menu key, right-click | The cell menu: `Copy`, `Cut`, `Paste`, `Clear`, `Open {risk number}`, and when they apply `Confirm AI value`, `Keep mine`, `Take theirs` | — |
| `Alt+ArrowDown` on a header | The column menu: `Sort ascending`, `Sort descending`, `Add to sort` (also `Shift+Enter`), `Filter`, `Hide column` | — |
| `?` | The `Keyboard shortcuts` dialog (480px), listing this table | — |

`⌘` replaces `Ctrl` on Apple devices (X-7). `Paste` in the cell menu needs clipboard permission; without it the item reads `Paste (press Ctrl+V)` and only announces.

**Announcements** (one polite live region; selection changes are debounced):

| Event | Text |
|---|---|
| Edit committed | `{column} for {risk number} set to {value}. {n} unsaved {change|changes}.` |
| Fill | `Filled {k} cells in {column}.` |
| Clear | `Cleared {k} cells.` and, when any were read-only, `{s} read-only cells skipped.` |
| Range | `{r} rows by {c} columns selected.` |
| Copy, cut | `Copied {r} rows by {c} columns.` · `Cut {k} cells.` |
| Undo, redo | `Undid {what}.` · `Redid {what}.` |
| Save | `Saving {n} changes…`, then `Saved {n} changes.` or the refusal's first sentence |
| Errors, conflicts | `{k} {cell needs|cells need} attention.` · `{k} {change conflicts|changes conflict} with newer saves.` |
| Read-only paste or edit | `These risks are read-only, so nothing changed.` |

---

## 3. Changes, saving and Undo (D-12 to D-16, D-18, D-19; X-54 to X-56)

### 3.1 The change set

Every commit, fill, clear and applied paste joins the change set held for the record in session storage (guarded); it survives a failed save, a reload and a move to the Overview. There is no autosave. A batch whose values all equal the current values is not a change: reverting a cell by hand removes its marker.

### 3.2 The unsaved-changes bar (X-54)

A sticky footer bar that slides up as §4 DataTable's bulk-action bar does, holding two groups:

- **Selection group** (while rows are selected): `{k} selected`, then `Withdraw {k} {risk|risks}` (outline small, `Archive`; Active), `Reinstate {k} {risk|risks}` (outline small, `ArchiveRestore`; Withdrawn), `Confirm AI values ({a})` (outline small, `Check`; when the selection holds AI-proposed cells and the actor may confirm), `Duplicate` (outline small, `CopyPlus`; one row), `Clear selection` (ghost small).
- **Changes group** (while the change set holds changes): `PenLine` 16px and `{n} unsaved {change|changes} to {r} {risk|risks}` (`tabular-nums`); then `Undo` and `Redo` (icon-only 32px circles, `Undo2`, `Redo2`, with X-7 hints and tooltips); `Discard` (ghost); `Save changes` (primary, X-7 hint `Ctrl S`), pending as `Saving…` with the inline spinner.
- **The review line** (17.1 D-07), above the group while a review stands: `Saving withdraws {name}’s review of {assessment number}.` in `--text-caption`, `Info` 14px.

`Discard` asks nothing and offers Undo: toast `Discarded {n} unsaved {change|changes}.`, `Undo` restores them. Withdrawing selected rows with unsaved changes is not offered; the group shows `Save or discard the changes to {risk numbers} first.`

### 3.3 Undo and redo

The undo stack covers every commit, fill, clear, cut and applied paste since the last save or discard, each as one step named for the announcements (`the fill of Treatment owner`, `the paste of 12 cells`). Saving or discarding empties it; the save's toast then offers Undo (§3.4).

### 3.4 Save (D-13, D-15)

`Save changes` sends one bulk request. The table shows the saved values at once, pending as §2.4 states.

- **Success:** markers clear; rows show 17.1 §2.2's `Changed since review` where it applies and, between rounds, the `Decision` column's `Will be decided again` (X-47). X-14 toast: `Saved {n} {change|changes} to {r} {risk|risks}.` with `Undo`; when the batch created risks, a second line: `{c} new {risk stays|risks stay} if you undo. Withdraw {it|them} from {its|their} detail sheet if needed.` `Undo` saves the inverse with the saved values as bases; if newer saves intervene, it returns conflicts (§3.5) rather than overwrite, and its toast reads `Some changes were saved by someone else since. Choose what to keep.`
- **Invalid cells** (400 or 409 with a cell list): nothing applied; every change returns to unsaved; each invalid cell takes the error state; a danger alert above the grid (§1.3 item 5): title `{k} {cell needs|cells need} attention, so nothing was saved`, body `Fix the marked cells, then save again.`, actions `Show cells that need attention` (filters to those rows) and `Go to first` (moves the active cell). Focus moves to the alert title.
- **Refusals for the whole batch:** §12 X1, in a danger toast with the change set kept.

### 3.5 Conflicts (D-14; X-56)

A save refused with `RISK_CHANGES_CONFLICT` keeps every change unsaved and marks each conflicting cell.

- **The summary:** a warning alert above the grid: title `{k} {change conflicts|changes conflict} with newer saves`, body `Someone saved these cells after you started editing, so nothing was saved. For each one, keep yours or take theirs.`, actions `Keep all mine`, `Take all theirs` (outline small) and `Show conflicts` (ghost small; filters to those rows). Focus moves to the title.
- **The cell line** for a conflicting cell: `Yours: {your value} · Theirs: {current value}, saved by {name} {instant}` (X-3), then `Keep mine` and `Take theirs` (outline small pills, reachable by `Tab` from the grid's cell menu or the line itself).
- `Keep mine` rebases the edit on the current value and keeps it unsaved; `Take theirs` drops the edit and shows the current value. Each is one undo step. When none remain, the alert reads `All conflicts resolved. Save changes when ready.` and stays until the next save.
- An override cleared by a change of inputs (D-22) is never a silent loss: the cell line of the rating reads `Changing likelihood or consequence clears the override “{reason}”.` before saving.

### 3.6 Copy and paste (D-18, D-19; X-55)

**Copy** works in every mode with no request. The range goes on the clipboard as tab-separated text and an HTML table, with a header row when whole columns are selected. Dates are written `30/11/2026`, people as display names, ratings and scale levels as labels, mitigation controls as `{number} · {title}` joined by `; `. Markers and pending states are not copied.

**Paste** (editable mode, from 768px) never changes a cell directly: it opens the paste preview dialog (X-55) at the complex size (800px).

| Part | Contract |
|---|---|
| Title | `Paste {r} rows by {c} columns` |
| Mapping line (`--text-body`) | `Matched by column headers.` or `Placed from {risk number} · {column}, by position.` or `Matched rows by risk number.`; then, when any, `{s} read-only {cell is|cells are} skipped: {headers}.` and `{x} new {risk|risks} will be added for the rows past the end.` |
| Summary | `{c} {change|changes} to {r} {risk|risks}` · `{e} {cell needs|cells need} attention` (`tabular-nums`, `aria-live="polite"`) |
| Filter | `SegmentedControl` `Show`: `All ({c})`, `Needs attention ({e})` |
| Table | X-24's comparison anatomy, one row per changed cell: `Cell` (`{risk number} · {column}`, or `New risk {i}`), `Current`, `New`. A converted value shows `Pasted as “{raw}”` under it in `--text-caption`. An error row shows `CircleAlert` and its §12 X1 reason in place of `New`. A rating that differs from the derived rating has a `Reason for the override` field in its row (1 to 500 characters), and is an error until filled |
| Actions, no errors | `Apply {c} {change|changes}` (primary), `Cancel` (ghost) |
| Actions, with errors | `Apply the {k} valid {change|changes}` (outline) and `Cancel` (ghost); no primary. A line above them: `Nothing is applied until you choose.` |

Applying adds the changes to the change set as one undo step and closes the dialog with focus on the first changed cell; nothing saves until `Save changes`. `Escape` and `Cancel` apply nothing. People convert through the hardened search one name at a time (G-17), so the dialog shows `Matching names…` with a skeleton row per pending name after 300ms. A paste larger than the cap shows the refusal in the dialog and no table (§12 X2).

### 3.7 Rows (D-16)

- `Add row` adds an empty row at the end, active on its statement cell, marked `New` in its number cell (the number arrives on save). An unsaved new row has `Remove new row` in the cell menu; nothing else removes a row.
- `Duplicate` copies the fields of one row into a new row, never its number, controls or AI provenance.
- `Withdraw` and `Reinstate` take X-27's required reason in a popover anchored to the bar (a bottom sheet below 768px), apply through Phase 16's batch operation with Undo, and ask for no confirmation (16 §6.1, §6.2).
- `Delete` clears cells. The table has no action that deletes a risk.

---

## 4. Scales, the matrix picker and the derived rating (D-20 to D-22; X-57)

### 4.1 The matrix picker

Opened from any likelihood, consequence or rating cell of the same assessment stage (inherent or residual), in a popover anchored to the cell from 768px and in the detail sheet's form at every width.

- **Title:** `{Inherent|Residual} rating for {risk number}`.
- **The matrix:** a 5 × 5 radio group named by the title, likelihood on the vertical axis (highest at the top), consequence on the horizontal, axis labels from the served scale (`{label} ({score})`, `--text-caption`). Each cell is a 40px square (§3.9) filled with its band's §3.6 `bg` and showing the score in its `fg` with the band's 12px icon; its accessible name is `Likelihood {label}, consequence {label}: {score}, {band}`. The checked cell carries the focus ring and a `Check`. Arrow keys move in two dimensions and check; `Enter` applies.
- **Descriptions:** under the matrix, the focused cell's likelihood description and consequence description (each impact area as a definition list), from the served scale (D-20).
- **The rating:** `Derived rating` with its badge. Below it, `Override the rating` (ghost small) reveals `Rating` (a pick list of the four bands) and `Reason for the override` (textarea, required, 1 to 500 characters, hint `Say why this rating differs from the matrix. Analysts and the people taking part see it.`).
- **Actions:** `Apply` (primary small) and `Cancel` (ghost small). `Apply` writes all three cells into the change set as one undo step.

### 4.2 Typing and pasting into these cells

Likelihood and consequence cells accept a level label in any case or its score 1 to 5, converted on commit and shown converted; anything else is an error (`Choose a level from the scale.`). Changing either recomputes the rating cell at once as `Derived` (§4.3). Typing a rating that differs from the derived one opens the picker with the override revealed.

### 4.3 How ratings read

| Case | Cell | Cell line |
|---|---|---|
| Derived | The rating badge (dense form allowed) | `Derived from {likelihood} × {consequence} = {score}.` |
| Overridden | The badge, then a 12px `Scale` note named `Overridden` | `Overridden from {derived}: “{reason}”` |
| Missing an input | `Set likelihood and consequence` in `--color-text-secondary` | the same |
| Stored value not on the scale (D-21) | The stored text verbatim, then a 12px `CircleSlash` note named `Not on the scale` | `“{value}” isn’t on the scale. Choose a level.` with `Use {rating}` (outline small) when a derivation exists |
| Released | The stored value as recorded, no derivation shown | `As released.` |

The override reason also shows beside its rating in the detail sheet, the participant table and cards, the released record, its export and its report (D-22). Readiness gains 10 §14's outstanding item `Ratings follow the scale`, listing each risk as a link to its cell, with the line `{k} {risk has|risks have} a value off the scale or an override without a reason.`

---

## 5. Finding, views and columns (D-08 to D-10; X-59 to X-61)

### 5.1 Sort, filter, search

- **Sort:** a header's sort button (reserved-space chevrons, §4 DataTable); `Shift`+click or `Shift+Enter` adds a secondary sort, numbered `1`, `2` beside the chevrons. Ratings and scale levels sort by score, not alphabetically; empty values last.
- **Filter:** the column menu's `Filter` opens a popover by type: `Contains` (text), a checklist (closed vocabularies, people, ratings), `From` and `To` (dates), and `Is empty` for every column. Chips read `{column header}: {value}`, removable, with `Clear filters` (§4 DataTable).
- **Address:** search, filters, sort, `show` and `view` live in the address, so figure links and readiness links open exact sets (X-10).

### 5.2 Views (D-09; X-59)

`View: {name}` is an outline pill with `ChevronDown`, followed by the neutral tag `Modified` while the columns, sort or filters differ from the view. Its menu:

| Group | Items |
|---|---|
| `Built-in` | `Standard`, `Treatment plan`, `Ratings review`, `Owners and dates`, `Acceptance` |
| `Your views` | The owner's views, `Share2` 12px after shared ones |
| `Shared by analysts` | Others' shared views with `{owner}` in `--text-caption` |
| Actions | `Update view` (own view, while modified), `Save as new view` (`BookmarkPlus`), `Reset view` (while modified), `Rename view`, `Share with analysts` or `Stop sharing`, `Delete view` (own views only) |

Built-in views (read-only):

| View | Columns after `Risk number` | Sort |
|---|---|---|
| `Standard` | §2.3's default set | `Risk number` |
| `Treatment plan` | `Risk statement`, `Residual rating`, treatment action, treatment plan, treatment owner, `Target date`, treatment resolve date, `Treatment status`, `Mitigation controls` | `Residual rating` high to low, then number |
| `Ratings review` | `Risk statement`, the four likelihood and consequence columns, both ratings, the rating rationale fields the analyst read serves | `Residual rating` high to low |
| `Owners and dates` | `Risk statement`, `Risk owner`, `Executive approver`, treatment owner, `Target date`, treatment resolve date, `Treatment status` | `Target date`, empty last |
| `Acceptance` | `Risk statement`, `Residual rating`, `Risk owner`, `Executive approver`, the recommendation, `Decision` | `Decision`, then number |

`Save as new view` and `Rename view` open a 480px dialog: `View name` (required, unique among the owner's views), the switch `Share with analysts` (off by default), and `Save view` (primary). `Delete view` applies with the toast `Deleted view “{name}”.` and `Undo`. A shared view opened by someone else offers `Save as new view` only. The last view used is remembered per browser; a view whose columns are no longer offered drops them silently and keeps the rest. Participants have no views menu: their columns and sort are remembered per browser (D-09).

### 5.3 Column chooser (X-61)

`Columns` opens a popover from 768px (a full-screen sheet below) titled `Columns`: X-30's column-choice checklist (legend, `{k} of {n} columns`, `Select all`, `Reset to view`), one column, in display order, each row with `Move up` and `Move down` icon buttons (`ArrowUp`, `ArrowDown`, 24px, named `Move {header} up`) and a drag handle (`GripVertical`) as the pointer alternative. `Risk number` is listed first, checked and fixed. Resizing: each header's end edge is a separator (`role="separator"`, named `Resize {header}`) that shows a 2px ink line on hover and focus; `ArrowLeft` and `ArrowRight` change the width by 1rem, `Shift` with them by 4rem, between `6rem` and `28rem`; double-click or `Enter` fits the content. Changes apply live and mark the view `Modified`.

### 5.4 The review lists (D-10)

Requests, Questionnaires and Risk assessments (11 §7.1, §7.2) gain `Columns` (outline small, `Columns3`) beside the density toggle, with §5.3's popover (reorder by buttons and handle; no resize), remembered per browser per list like density, and `Reset to default` in place of `Reset to view`. Phase 13's assignee column is offered there, unchecked by default. Each list's Export dialog opens with the visible columns checked (19 §2.4, which already says so). This supersedes 11 §7's line "No list gains a column chooser".

---

## 6. The risk detail sheet (D-06, D-16; X-13)

Opened by `Enter` on a `Risk number`, a click on it (a `RecordLink`), `Open {risk number}` in the cell menu, a card on phones, or the address `?risk={risk number}`.

- **Frame:** X-13's side sheet. From 768px it is 640px wide, bounded by the viewport.
- **Title row:** h2 `{risk number}`, the risk statement clamped to two lines, both rating badges, then `Previous risk` and `Next risk` (icon-only circles, `ChevronUp` and `ChevronDown` (confirmed in 1.30.0), in the table's current order, with `Alt+ArrowUp` and `Alt+ArrowDown`), `History` (ghost small, 16 §8) and `Close`.
- **Body:** the Risk card's content in today's order, with every per-risk surface unchanged in behaviour: Phase 12's markers and review bar, 16's `AI rewrite` and withdraw, 17's responses and owner controls, 17.1's `Decision` and trail, 17.2's contest markers and points, and the controls group. The form keeps its own `Save` (single-risk PATCH with bases, so a stale field returns §3.5's conflict in the field, with `Keep mine` and `Take theirs`).
- **When the table holds unsaved changes to this risk,** the form is read-only under an info alert: title `{n} unsaved table {change|changes} to {risk number}`, body `Save or discard them to edit this risk here.`, actions `Save changes` (saves the whole change set) and `Discard changes to {risk number}`. Nothing is merged silently.
- **Closing with unsaved form input** shows, inside the sheet, 10 §6.3's choice with `Leave {risk number} without saving?`, `Discard` and `Keep editing`; `Keep editing` has initial focus.
- Saving in the sheet updates the row at once; focus returns to the row's number cell on close.

---

## 7. Read-only modes and the round lock (D-05)

### 7.1 Banners

The mode comes from the server's allowed actions. One banner (`Alert`, info) above the toolbar, its first line from the earlier contract and a second line added here:

| Reason | Banner |
|---|---|
| Released | `{assessment number} is released, so its risks are read-only.` |
| Response round open | 17 §5.1's line (`CirclePause`) |
| Acceptance round open | 17.1 §5.2's line (`CirclePause`), with `Go to round {n}` linking to the Overview's round panel |
| Analyst named as a risk owner or executive approver | 17 §5.2's line |
| Every read-only banner, second line | `You can still select, copy and export the risks.` |

In read-only modes the toolbar drops `Add row`, `More risk actions` and `Import`; the bar has no changes group; the selection group keeps only `Clear selection`; editing keys announce §2.5's read-only line. While a round is open the `Decision` column is in the default columns.

### 7.2 Between rounds

After recall (17.1) or a return (17.2) the table is editable; the bar's review line and the `Decision` column's `Will be decided again` show what a save means for decisions (17.1 D-40). No special void control exists.

### 7.3 Withdrawn rows

Under `Withdrawn ({w})` the grid is read-only with the `Status` column, reason and who withdrew (X-27's facts as columns); `Reinstate` is the only edit act. First use of the filter: cleared `No withdrawn risks`.

---

## 8. Participants and the released record (D-05, D-06, D-18, D-24)

- **The participant page** (17 §6.1) keeps its order. From 768px, item 6 `Identified risks` opens, after the `Show` filter (17 §6.2), with the read-only grid of the participant's columns (§2.3), in a region `{n} risks` at most 60% of the viewport tall, sticky header and number column, with copy, search, sort, per-column filters, the column chooser and the keymap. Each `Risk number` is a link to that risk's card below (`#risk-{number}`), focusing its h3. The cards, with 17's response areas and 17.1's decision areas, follow unchanged. Below 768px the page is unchanged (cards only).
- **The released analyst record:** Risks is read-only (§7.1); Overview shows the released content as today.
- **Export:** before release, participants have no export; the grid's copy is the way out (D-18). After release, the page header's `Export` is 19 §1 unchanged.

---

## 9. Import and export (D-23, D-24)

### 9.1 Import

Route `/app/review/assessments/{documentId}/risks/import`, from the page header's `Import`. 19 §5's five steps unchanged, with:

- **Title** `Import risks into {assessment number}`; description `Import a CSV or Excel file of risks or mitigation controls. You review every row before anything is created or updated.`
- **Guidance** opens with a `Table` radio group: `Risks` (hint `Matched by risk number. A blank risk number creates a risk.`) and `Mitigation controls` (hint `Matched by risk number and control number. Rows add or update controls and never remove one.`). Templates are per table; the XLSX template's `Notes` sheet holds the scale (19 §3.4).
- **Review rows** shows each update's field changes as `{field}: {old} → {new}`; rejected rows give §12 X3's reasons.
- **Confirm** uses 19 §5.7's sentence with `risks` or `mitigation controls`, then `Imported rows save together and withdraw any current review.` when a review stands.
- **Results** gains `Open risks` (primary) before `Import another file`.
- A `RISK_IMPORT_DRIFTED` refusal returns to Review rows with §12 X3's alert and `Preview again`.

### 9.2 Export

X-30 unchanged, titled `Export {assessment number} risks`. The scope sentence names the view: `{n} {risk|risks} in the view “{view name}”{, with your changes to it}`. The column choice opens with the visible columns in their order. Unsaved changes are never exported; while any exist the dialog adds `Your {n} unsaved {change|changes} aren’t in the file. Save them first to include them.` (`Info`, `--text-caption`). Withdrawn risks are exported only from the Withdrawn filter.

---

## 10. Proposed widths

Two values not in §3.9: the minimum resized column width `6rem`, and the grid's minimum height `20rem`. Both are recorded in X-61 and X-53. The maximum width reuses §4's long-text `28rem`.

---

## 11. Phones (below 768px; D-26)

- **Risks:** the toolbar becomes `Search risks`, then a row of `Filters and sort` (outline small, `SlidersHorizontal`, opening a full-screen sheet with the view choice as a radio list, `Show`, sort and every filter, and `Show {n} risks` as its primary), `Export` and, for analysts in editable mode, a `More` menu holding `Add risk` and `Import`. No grid, range, fill, paste or views editing.
- **Card** (DataTable mobile card, block link with `ChevronRight`): line 1, the risk number with the residual rating badge at the end; line 2, the statement clamped to three lines; line 3 (`--text-caption`, secondary), `Owner: {name or Not set} · {treatment status}`; line 4 when present, the markers' roll-ups (`AI values to confirm`, X-48's count, `Unsaved` never: phones hold no change set). Withdrawn cards are X-27's.
- **The card opens the detail sheet** full-screen; an analyst edits that one risk with its form and `Save`, with bases.
- **Overview** stacks; its figures are a list of block links.
- **UAT-039's other half:** the questionnaire's in-place question form (10 §1.2) at 375px has no horizontal scroll (re-checked, §14).

---

## 12. Refusal copy (new family X, added to Phase 10 §10.2 and `refusal-copy.ts`)

Kinds as 10 §10.2. Every refusal keeps the change set, the paste and the typed reasons.

### X1. Saving changes (and cell reasons)

| Reason | Copy | Kind |
|---|---|---|
| `RISK_CHANGES_CONFLICT` | §3.5 | conflict |
| `SCALE_VALUE_INVALID` | `Choose a level from the scale.` | field |
| `RATING_SCALE_VALUES_REQUIRED` | `Set likelihood and consequence first.` | field |
| `RATING_OVERRIDE_REASON_REQUIRED` | `Give a reason for overriding the derived rating ({derived}).` | field |
| Bad date | `Enter a date as dd/mm/yyyy, for example 30/11/2026.` | field |
| Empty statement | `Enter the risk statement.` | field |
| Ineligible owner or approver (17 D-17, 17.1 D-16, D-17) | U1's and V2's field reasons, unchanged | field |
| `RISK_WITHDRAWN` | `{risk number} was withdrawn, so its changes can’t be saved. Discard them, or reinstate it first.` | blocked |
| `ASSESSMENT_NOT_MUTABLE` | `{assessment number} was released, so nothing was saved. Your changes are kept in this tab until you discard them.` | blocked, `Refresh page` |
| `RESPONSE_ROUND_OPEN`, `ACCEPTANCE_ROUND_OPEN` | `A round opened for {assessment number}, so nothing was saved. Your changes are kept; save them once the round is closed or recalled.` | blocked |
| `ACTOR_IS_RISK_OWNER`, `ACTOR_IS_EXECUTIVE_APPROVER` | `You’re named on a risk in this assessment, so you can’t edit it. Another Security Analyst can.` | blocked |
| `ASSESSMENT_RISK_LIMIT` | `An assessment holds at most 1,000 risks. Remove {k} new {row|rows} to save.` | blocked |
| 404 (assessment) | `{assessment number} is no longer available to you.` | blocked, `Refresh page` |
| 403 | 10 §10.2's permission sentence | blocked |
| Network, timeout or 5xx | `We couldn’t save your changes. They’re kept. Try again.` | retryable |

### X2. Paste and copy

| Case | Copy |
|---|---|
| Nothing tabular on the clipboard | `The clipboard holds no cells to paste.` |
| More rows than the cap allows | `This paste would make {t} risks, more than the 1,000 an assessment holds.` |
| Unknown risk number | `{value} isn’t a risk in this assessment.` |
| Name matches no one, or several | `No one eligible is called “{value}”.` · `More than one person is called “{value}”. Choose in the cell after pasting.` |
| Unknown control number | `{value} isn’t a control in the library.` |
| Clipboard blocked by the browser | `Your browser blocked the clipboard. Use Ctrl+C or Ctrl+V.` |

### X3. Import (additions to family S)

| Reason | Copy | Kind |
|---|---|---|
| Unknown, withdrawn or other assessment's risk number | `{value} isn’t an active risk in {assessment number}.` | row |
| `RISK_IMPORT_DRIFTED` | Alert title `Risks changed since your preview`; body `{k} {risk was|risks were} saved by someone else after you previewed. Nothing was imported.` | blocked, `Preview again` |
| Editing paused or released | X1's round and release copy, with `imported` for `saved` | blocked |

### X4. Views

| Reason | Copy | Kind |
|---|---|---|
| Name taken | `You already have a view called “{name}”.` | field |
| `NOT_VIEW_OWNER` | `Only {owner} can change this view. Save it as your own view instead.` | blocked |
| 404 | `That view is no longer available. Showing Standard.` | blocked |
| Network | `We couldn’t save the view. Try again.` | retryable |

---

## 13. Five-state contract and the premium bar

| Surface | Loading | Empty | Error | Permission | Populated states added |
|---|---|---|---|---|---|
| Grid | After 300ms, a skeleton with the active view's columns, widths and density, rows filling the viewport | First use `No risks yet` · `Add a row, paste from Excel or import a file.` · `Add row` (read-only: no action). Filtered `No risks match these filters` · `Clear filters`. Withdrawn: cleared `No withdrawn risks` | `We couldn’t load the risks` · `Try again` | Maya: in-shell not-found; participants: read-only grid | Changed, error, conflict, pending, read-only |
| Overview `Risks` | With the page | §1.2 | With the page | Same as the page | Unsaved line |
| Editors, matrix, chooser, views, preview, sheet | Loaded on demand; a skeleton of the surface after 300ms | — | X1 to X4 | Not offered when the mode forbids | Conflict, override |
| Import | 19 §8 | 19 §8 | S, X3 | Analysts in editable mode | Table choice, drift |
| Phone cards | Card skeletons | As the grid | As the grid | As the grid | Markers |

| G-4 item | Phase 18 contract |
|---|---|
| Keyboard path for every primary action | §2.5's keymap; `Ctrl+S` saves; the bar, chooser, views, preview and sheet in DOM order; `Alt+T` reaches Undo (X-14) |
| Optimistic feedback with rollback | Saves, view changes, withdrawals and AI confirmations apply at once and roll back with the reason |
| Skeletons | Grid, editors, sheet, chooser, preview's names, import |
| Undo and confirmations | Undo: every edit, fill and paste (stack), save, discard, withdraw, reinstate, view delete, AI confirmation (toasts). No confirmation dialog: nothing here is irreversible or governance-significant (D-28); import keeps its confirm step |
| Empty states that say what to do next | §13 table |
| No lost input | The change set in the session, the leave warning, kept on every refusal; the sheet's own guard (§6) |
| Density | Comfortable 44px and compact 36px in the grid and review lists |
| Motion | Motion section; reduced motion honoured |
| Phone layouts | §11 cards and full-screen sheets |
| Every figure opens its records | §1.2 figures, readiness rows, `Mitigation controls` counts, open AI proposals, contest counts |

---

## 14. Test assertions this contract changes

- **SC1 (Playwright, 1440):** on ten UAT-C-like risks, keyboard only, setting treatment owner, target date (`30/11/2026`) and status and saving takes at most **80 key presses** (a chord counts once) and exactly **one** bulk save request; the toast reads `Saved 30 changes to 10 risks.`
- **SC2:** copying 10 rows reads tab-separated text and an HTML table with names, `30/11/2026` dates and labels; a 3 × 4 Excel-shaped paste shows `Paste 3 rows by 4 columns`, `Pasted as “high”`, an override reason field where the rating differs, and `New risk 1` for a row past the end.
- **SC3:** one invalid cell shows `Apply the 11 valid changes` and no `Apply` primary; Bob's second save shows `1 change conflicts with newer saves` and `saved by {second analyst}`; a different field of the same risk saves without conflict.
- **SC4:** released and participant grids have no edit, `Import` or bar, and `Ctrl+C` copies; Maya reads not-found; CSV and XLSX round trip through §9.
- **SC5:** 150 risks within research's lag threshold at 1440; the card list at 375; 10 §1.2's form at 375 without horizontal scroll.
- **Existing specs:** the journey's analyst steps open `Risks` and the detail sheet; `assessment-release-workflow.spec.ts` and the Phase 12, 16, 17, 17.1 and 17.2 specs that drive Risk cards reach them through the sheet; `performance.spec.ts` adds the Risks route.
- **Unit (Vitest):** the keymap per mode; range, fill, clear and cut; the change set and undo stack; clipboard formats; paste mapping (position, headers, risk number) and conversion parity; the preview's apply rules; conflict actions; matrix accessible names and derivation parity on the served scale; §4.3's cases; views menu per owner and visibility; the column chooser's reorder and resize keys; X1 to X4; the copy guard (no `Delete` for a risk).

---

## Copywriting Contract

| Element | Copy |
|---|---|
| Primary CTAs | `Save changes`, `Apply {c} changes`, `Apply` (matrix), `Save view`, `Export file`, `Open risks` (import results) |
| Other calls to action | `Discard`, `Undo`, `Redo`, `Add row`, `Duplicate`, `Withdraw {k} risks`, `Reinstate {k} risks`, `Confirm AI values ({a})`, `Keep mine`, `Take theirs`, `Keep all mine`, `Take all theirs`, `Show conflicts`, `Apply the {k} valid changes`, `Override the rating`, `Use {rating}`, `Update view`, `Save as new view`, `Reset view`, `Share with analysts`, `Stop sharing`, `Delete view`, `Columns`, `Keyboard shortcuts`, `Open risks`, `Review changes`, `Filters and sort`, `Preview again` |
| Headings and labels | `Overview`, `Risks ({n})`, `Risks`, `View: {name}`, `Columns`, `Paste {r} rows by {c} columns`, `Current`, `New`, `{Inherent|Residual} rating for {risk number}`, `Derived rating`, `Reason for the override`, `Not on the scale`, `Overridden`, `Needed to submit`, `Not set`, `Keyboard shortcuts` |
| Empty state heading | `No risks yet`; `No risks match these filters`; `No withdrawn risks` |
| Empty state body | `Add a row, paste from Excel or import a file.` |
| Error state | Family X (§12) and §3.4's alert: what happened and what to do, changes kept |
| Destructive confirmation | None. Nothing deletes a risk; `Discard`, withdrawal and view deletion are reversible through Undo |

---

## Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| 1.3.1 | `role="grid"` with column headers and row headers; `aria-rowcount`, `aria-colcount` (and `aria-rowindex` if virtualised); `aria-selected` on range cells; `aria-readonly` on a read-only grid or cell; the matrix a labelled radio group; the preview a table with row headers |
| 1.4.1 | Cell states, ratings and markers carry icon shapes and words (cell line, accessible names), never colour alone |
| 1.4.10 | Below 768px no grid; from 768px the grid scrolls inside itself as a data table, and nothing else scrolls horizontally |
| 2.1.1, 2.1.2 | §2.5; `Tab` always leaves the grid when not editing; popovers and dialogs leave on `Escape` |
| 2.4.1 | `Skip to risks` |
| 2.4.3, 2.4.11 | Focus moves as §3.4, §3.5, §3.6 and §6 state; `scroll-padding` keeps the active cell clear of the sticky header, column and bar |
| 2.4.7 | The active cell's inset ring (X-53) |
| 2.5.7 | Reorder and resize have button and key alternatives; ranges extend by `Shift`+click |
| 2.5.8 | Header menus, markers, sort and resize targets at least 24px; the touch-target height below 768px |
| 3.3.1, 3.3.3 | Cell errors in the cell line and `aria-describedby`, each saying how to fix it |
| 4.1.3 | §2.5's polite announcements; toasts polite |
| Automated | Zero serious or critical axe violations on Risks (editable, read-only, with conflicts), the paste preview, the matrix picker, the detail sheet, the chooser and the participant page, at 1440 and 375 |

---

## Spacing Scale

The §3.9 scale and §4 DataTable's cell padding, unchanged. Additions: 8px between toolbar controls and between a value and its markers; 12px between the cell line and the grid; 16px between the toolbar, chips and alerts; 40px matrix cells (a §3.9 step). Exceptions: the two widths in §10.

| Token | Value | Usage |
|---|---|---|
| xs | 4px | Icon to text in cells and notes |
| sm | 8px | Toolbar gaps, marker gaps |
| md | 16px | Cell padding, block gaps above the grid |
| lg | 24px | Detail sheet groups |
| xl | 32px | Overview sections (§3.9 rhythm) |
| 2xl | 48px | Not used |
| 3xl | 64px | Not used |

---

## Typography

The §3.10 scale, unchanged. The grid uses §4 DataTable's roles: body `--text-table` (13px/18px, 400) and headers `--text-micro`. Everything else:

| Role | Size | Weight | Line Height |
|---|---|---|---|
| Body (cell line, toolbar, bar, sentences) | 14px (`--text-body`) | 400 / 500 | 20px |
| Label (captions, footer counts, hints) | 12px (`--text-caption`) | 400 / 500 | 16px |
| Heading (sheet title, dialog titles, Overview `Risks`) | 16px (`--text-heading-sm`) | 600 | 24px |
| Display (page title, unchanged) | 28px (`--text-heading-lg`) | 400 | 32px |

`tabular-nums` on every count, score and risk number. Weights 400, 500 and 600 only (ADR 0001 gap 8 precedent).

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | Canvas; grid, bar, popovers, sheet, dialogs |
| Secondary (30%) | `--color-bg-inset`, `--color-border-default`, `--color-text-secondary`, `--color-selection`, `--color-bg-selected` | Skeletons, hairlines, notes, range cells, selected rows |
| Accent (10%): ink | `--color-primary`, `--color-on-primary`, `--color-text-link`, `--focus-ring` | Reserved, below |
| Severity (§3.6) | the four risk sets | Rating badges and matrix cells, always with icon and words |
| Status (§3.5) | danger (cell errors, error alert, failure toasts), warning (conflicts), info (mode banners, the sheet's held line), success (success toasts) | Always with an icon and words |
| Destructive | `--color-danger-solid` | None used |

Ink is reserved for: the primary pills `Save changes`, `Apply {c} changes`, matrix `Apply`, `Save view`, `Export file`; the active cell ring and the matrix's checked cell; the selected-row edge; record links and figure links; checked segments and checkboxes; the resize line. No new hue.

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| Unsaved-changes bar in and out | §4 DataTable bulk-action bar (220ms expo) |
| Detail sheet, phone sheets | §5 "Drawer / side panel"; fade under reduced motion |
| Editors, matrix, menus, chooser | §5 "Dropdown / popover / menu" |
| Paste preview, dialogs, toasts | §5 "Dialog / toast" |
| Cell commit, fill, paste apply, markers, active cell movement | None: instant (rows and cells never animate, §6 item 8) |
| Save rollback | §5 Optimistic UI rollback |

---

## Proposed CSRM extensions

For the orchestrator to accept. A Phase 18 plan task records them in `docs/design/csrm-design-direction.md` before the implementing tasks run. Numbering continues after Phase 17.2's X-52. Only X-53 and X-61 add values (§10).

| # | Where | Proposal | Exact wording to record | Rationale |
|---|---|---|---|---|
| X-53 | §4 DataTable, new "Editable grid" paragraph | The grid mode, its cell states and the cell line | "**Editable grid (CSRM extension, 2026-10-01).** A table whose cells a person navigates, selects, copies or edits is a grid: one tab stop with roving focus over cells, following the WAI-ARIA data grid pattern, in an editable or a read-only mode that the server's allowed actions decide. It is its own scroll container in both directions, filling the viewport below its toolbar, at least `20rem` tall, with the header row and identifier column sticky; it replaces the scroll region, so it adds no second tab stop. The active cell draws `--focus-ring` inside the cell (offset −2px) so neighbours and sticky cells never clip it; cells in a range take `--color-selection`; selected rows keep the selection treatment. Rows keep the DataTable's heights, padding and hairlines, with no vertical rules. An editor fills its cell as a field (`--color-bg-surface`, 1px `--color-border-strong`, `--radius-md`) or opens in a popover anchored to it. Cell states are 12px icons before the value, never colour alone and never tints: unsaved (`PenLine`, `--color-text-secondary`), error (`CircleAlert`, `--color-danger-fg`) and conflict (`GitMerge`, `--color-warning-fg`); the row header repeats the row's worst state. A read-only column carries a 12px `Lock` in its header. A cell line above the grid, in `--text-body`, names the active cell as `{row identifier} · {column header}` and shows its full value, or its error, conflict or read-only reason, and is the cell's description for assistive technology. Changes, errors and conflicts are announced politely." | D-05, D-11, D-17; the direction's DataTable has no editing, range or cell-state pattern |
| X-54 | §4 DataTable, after the selection bullet | The unsaved-changes bar | "**Unsaved changes bar (CSRM extension, 2026-10-01).** Edits held for one explicit save are counted in the sticky footer bar that carries bulk actions, which slides up whenever it has content: a selection group, then a changes group with a 16px `PenLine`, `{n} unsaved changes to {r} records` in `tabular-nums`, icon-only `Undo` and `Redo`, a ghost `Discard` and the primary `Save changes`, with keyboard hints. A caption above the group states any consequence of saving, such as a review it withdraws. Discarding offers Undo; saving confirms with an Undo toast. The changes survive a failed save, a reload and moving between a record's routes, and leaving the record warns." | D-12, D-15; the direction's bulk-action bar has no pending-change state |
| X-55 | §4 Dialogs, after "Export" | The paste preview | "**Paste preview (CSRM extension, 2026-10-01).** Cells pasted into a grid never change it directly. A dialog at the complex size titled `Paste {r} rows by {c} columns` says how the paste was placed (by headers, by position from a named cell, or by identifier), which read-only cells it skips and how many records it adds, then lists every change in the comparison table's anatomy with the columns `Cell`, `Current` and `New`, a converted value captioned `Pasted as “{raw}”` and each invalid cell's reason in place of its new value, filterable by a `Show` segmented control. With no errors the primary is `Apply {c} changes`; with any, there is no primary: `Apply the {k} valid changes` (outline) and `Cancel` sit under the line `Nothing is applied until you choose.` Applying adds the changes to the unsaved changes as one undo step." | D-19, SC2, SC3; X-24 compares AI proposals, not pasted values |
| X-56 | §4 DataTable, after "Unsaved changes bar" | Edit conflicts | "**Edit conflicts (CSRM extension, 2026-10-01).** When a save meets values someone else saved since the editor loaded them, nothing saves. A warning alert above the grid titled `{k} changes conflict with newer saves` offers `Keep all mine`, `Take all theirs` and `Show conflicts`; each conflicting cell carries the conflict icon, and its cell line reads `Yours: {value} · Theirs: {value}, saved by {name} {instant}` with `Keep mine` and `Take theirs` as outline small pills. Choosing keeps the change unsaved or drops it, as one undo step; the person saves again knowingly. A single-record form shows the same choice under the conflicting field." | D-14, SC3; the direction has no concurrent-edit pattern |
| X-57 | §4 Forms, after "Person picker" | The matrix picker and how ratings read | "**Matrix picker (CSRM extension, 2026-10-01).** Likelihood and consequence are chosen together on a 5 × 5 radio group, likelihood rising up the vertical axis and consequence along the horizontal, labelled from the served scale. Each cell is a 40px square in its band's severity tint with the score in the band's `fg` and the band's 12px icon, named `Likelihood {label}, consequence {label}: {score}, {band}`; arrow keys move in two dimensions. The focused cell's level descriptions show below, then `Derived rating` with its badge and `Override the rating`, which reveals a rating pick list and a required `Reason for the override`. In cells and records, an overridden rating carries a 12px `Scale` note `Overridden` with the reason in its description, and a stored value off the scale shows verbatim with a 12px `CircleSlash` note `Not on the scale`; neither replaces the value." | D-20 to D-22, UAT-008; the direction has severity tokens but no matrix |
| X-58 | §4 Page header, new "Record local navigation" paragraph | Overview and Risks | "**Record local navigation (CSRM extension, 2026-10-01).** A record split across routes shows, under its page header, a navigation landmark named for the record with one link per route (`Overview`, `Risks ({n})`), `--text-button` in `--color-text-secondary`, the current one in `--color-text-primary` with `aria-current="page"` and the 2px ink indicator of §5's tab row; the indicator slides between routes and appears without motion under reduced motion. The links share one page header and keep the record's unsaved work. Below 768px the links fill the width in equal parts at the touch-target height." | D-06; tabs exist for in-page panels, not routes |
| X-59 | §4 DataTable, after "Edit conflicts" | Saved views | "**Saved views (CSRM extension, 2026-10-01).** A table with saved views names the current one in an outline pill `View: {name}` with `ChevronDown`, followed by the neutral tag `Modified` while the columns, sort or filters differ. Its menu groups `Built-in`, `Your views` and `Shared by analysts` (with each owner's name), then `Update view`, `Save as new view`, `Reset view`, `Rename view`, `Share with analysts` or `Stop sharing`, and `Delete view`, offered only to the owner where they change a view. Saving asks for a unique `View name` and offers `Share with analysts`, off by default. Deleting applies at once with an Undo toast. Views never grant data; a column no longer offered drops from the view silently." | D-09; the direction has no saved-view control |
| X-60 | §4 DataTable, amends the pagination sentence | Tables without pagination | "**Unpaginated tables (CSRM extension, 2026-10-01; amends Pagination).** A grid whose ranges, fills and pastes span rows shows every row its read returns, up to the record's cap, with no pagination; its total and selected counts stay visible in its toolbar and footer, and it virtualises only past the direction's row threshold." | D-08; §4 says "Pagination always shows total count + rows-per-page" |
| X-61 | §4 DataTable, after "Saved views" | Column chooser, reorder and resize | "**Column chooser (CSRM extension, 2026-10-01; extends Export's column choice).** A table whose columns a person chooses offers `Columns`, an outline small pill with `Columns3`, opening a popover (a full-screen sheet below 768px) with the Export column-choice checklist in display order, `Reset to view` or `Reset to default`, and per column `Move up` and `Move down` 24px icon buttons beside a `GripVertical` drag handle; the identifier column is first and fixed. Where columns resize, each header's end edge is a separator named `Resize {header}` that shows a 2px ink line on hover and focus; arrow keys change the width by `1rem`, with `Shift` by `4rem`, between `6rem` and `28rem`. Choices persist with the view, or per browser per list where there are no views." | D-07, D-10; X-30 chooses export columns only; 2.5.7 needs non-drag alternatives |

---

## Decisions recorded

Made without asking (auto mode), from the locked context, `AGENTS.md`, the glossary and the direction.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | The grid is its own two-axis scroll container with sticky header and number column, at least `20rem` tall. | A sticky header cannot stick to the page inside a horizontally scrolling box; one container keeps both sticky. |
| UI-D2 | Cell states are leading 12px icons, never tints or borders. | §6 forbids grid lines and colour alone; icons differ by shape. |
| UI-D3 | A cell line above the grid carries the active cell's full value and reasons. | Long text clamps, dense markers are icons, and errors need words without tooltips. |
| UI-D4 | `Tab` leaves the grid when not editing; inside an edit it commits and moves across. | APG's single tab stop with D-17's Tab-commit. |
| UI-D5 | Typing a printable character starts an edit that replaces the value. | Excel parity for SC1's keyboard path. |
| UI-D6 | `Ctrl+S` saves from the grid and bar only. | A keyboard path for the primary action; no global capture. |
| UI-D7 | The changes group shares the bulk-action bar. | One sticky footer, never two stacked bars. |
| UI-D8 | Withdrawing rows with unsaved changes is not offered until they are saved or discarded. | No silent loss, no mixed batch. |
| UI-D9 | With errors, the paste preview has no primary pill. | SC3: the analyst chooses; no default to a partial apply. |
| UI-D10 | Copied dates are `30/11/2026`. | The users' typed format, which en-AU Excel reads as a date; research may confirm. |
| UI-D11 | The matrix picker edits likelihood, consequence and rating of one stage together. | Decision 8's derivation, and one undo step. |
| UI-D12 | Changing an input clears the override and the cell line says so before saving. | D-22, without a confirmation dialog. |
| UI-D13 | The default built-in view is named `Standard`. | A name distinct from "default" settings and Phase 20's `Project` and `BAU`. |
| UI-D14 | The detail sheet keeps the card's own `Save` (PATCH with bases) and is held read-only while the table has unsaved changes to that risk. | D-06's "behaviour unchanged" and D-16's "never silently drops or overwrites", without merging two change stores. |
| UI-D15 | Overview keeps `AI proposals`; Risks links to it. | 16 §2's section is assessment-wide and its specs index it there. |
| UI-D16 | Readiness rows open Risks at the cell (`?cell=`). | Phase 10 D-35's links into the table; every figure opens its records. |
| UI-D17 | Participants get the read-only grid above their unchanged cards from 768px, numbers linking to cards. | D-06 asks that 17's and 17.1's views keep working unchanged. |
| UI-D18 | No export of unsaved changes; the dialog says so. | Exports carry saved records only (19 D-07). |
| UI-D19 | Phones hold no change set; the sheet saves one risk. | D-26: no grid editing on phones. |
| UI-D20 | Ratings and levels sort by score. | Alphabetical order would misorder severity. |
| UI-D21 | SC1's proxy is at most 80 key presses and one save request. | A measured path of about 60 presses, with margin. |
| UI-D22 | Refusals are family X. | The spawn prompt. |

---

## Notes carried

- **For the orchestrator to settle:**
  - **UI-D17:** the participant page shows the grid above unchanged cards (some repetition) instead of moving 17's response and 17.1's decision areas into the sheet; confirm, or choose the sheet.
  - **UI-D14:** the detail sheet is held read-only while the table has unsaved changes to its risk; confirm, or have the sheet's fields join the change set.
  - **§10:** two new widths (`6rem`, `20rem`) recorded in X-61 and X-53.
- **For research and the planner:** the spike may change the engine but not this contract; the lag threshold (D-27) sets SC5's assertion; reason codes and bounds as research fixes them; the payload bound shows as X1's `ASSESSMENT_RISK_LIMIT` family if exceeded; editors, matrix, preview, chooser, views and sheet load with `next/dynamic`.
- **Earlier contracts this one amends (their plans have not executed):** 11 §7 ("No list gains a column chooser"); 16 §1 item 5 (`Identified Risks` moves to Risks and the sheet); 17 §6.1 item 6 (the read-only grid); 17.1 §5.2 and 17 §5.1 (their lines become the Risks banner); 19 §1 (the analyst's unreleased export now renders on Risks).
- **Shared-file changes needed:** the direction records X-53 to X-61 through a Phase 18 plan task; `refusal-copy.ts` gains family X; the root `CONTEXT.md` glossary may gain, proposed: "**Derived rating**: The rating the organisation's matrix gives a risk's likelihood and consequence. _Avoid_: Calculated rating." · "**Override (rating)**: A rating that departs from the derived rating, with a recorded reason. _Avoid_: Manual rating." · "**Saved view**: A named set of columns, sort and filters on the risk table, personal or shared with analysts. _Avoid_: Filter preset."

---

## UI Considerations

Written inline from the contract. The ui-phase probe replaces them when it runs.

State considerations: 18 covered, 3 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|---|---|---|---|
| empty | Grid first use, filtered, withdrawn | ✅ covered | §13 |
| empty | Overview `Risks` | ✅ covered | §1.2 |
| loading | Grid, editors, sheet, preview names | ✅ covered | §13, §3.6 |
| error | Save refusals, invalid cells | ✅ covered | §3.4, X1 |
| error | Paste, import, views | ✅ covered | X2 to X4 |
| permission | Participants, released, round open, named analyst | ✅ covered | §7.1, §8 |
| permission | Maya | ✅ covered | §13 not-found |
| partial | Paste with invalid cells | ✅ covered | §3.6 |
| partial | Values off the scale | ✅ covered | §4.3 |
| interaction | Two analysts on one risk | ✅ covered | §3.5 |
| interaction | Sheet with pending table changes | ✅ covered | §6 |
| interaction | Leaving with unsaved changes | ✅ covered | §1.1 |
| interaction | Undo after newer saves | ✅ covered | §3.4 |
| interaction | Import drift | ✅ covered | §9.1, X3 |
| zero-one-many | Plurals and counts | ✅ covered | Written-out forms |
| overflow | 21 default columns at 1024px | ✅ covered | §2.1 two-axis scroll, sticky number |
| overflow | Long statements | ✅ covered | §4 long-text clamp, cell line |
| phone | Card list, sheet | ✅ covered | §11 |
| performance | 1,000 risks in compact density | 🧪 backstop | `{ statement: "With 1,000 risks at 1440px compact, scrolling and a cell commit stay within research's lag threshold", verification: backstop }` |
| long-text | A 4,000-character statement in the expanding editor and cell line | 🧪 backstop | `{ statement: "The editor scrolls after ten lines and the cell line wraps to three lines with the full text available to a screen reader", verification: backstop }` |
| interaction | Paste from desktop Excel and SharePoint, and copy back | 🧪 backstop | `{ statement: "The pilot pastes a 3 × 4 range from desktop Excel and SharePoint and copies ten rows back into Excel as rows and columns with dates read as dates", verification: backstop }` |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|---|---|---|
| shadcn official (local source-owned components) | None new: `Table`, `Popover`, `DropdownMenu`, `Command`, `Sheet`, `Dialog`, `Calendar`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Label`, `RadioGroup`, `Alert`, `Tooltip`, `Button`, `Badge`, `Skeleton`, `Separator`, `ScrollArea`, `sonner` | Not required: no block added and no registry fetched (2026-10-01) |
| Third-party | none | Not applicable |

No new web dependency from this contract (D-04 governs any grid dependency).

---

## Verification contract

- **Unit and component (Vitest):** §14's unit list, the closed parsers for the new reads, the parity and chain guards, and the copy guard.
- **E2E** (dev servers stopped; 1440 and 375): §14's SC1 to SC5 and existing-spec updates, with the axe scope; each run leaves the tree clean.
- **Manual (pilot):** the screen-reader pass of D-04 over the grid, matrix and preview; the three UI Considerations backstops.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS
- [ ] Dimension 7 Inventory Provenance: PASS

**Approval:** pending

---

## Orchestrator amendments (2026-10-01, after the UI check)

The UI checker approved this contract with five flags. These amendments bind the plans. Where the body differs, the amendments win.

1. **X-53's inset focus ring** is recorded with its offset: the ring is drawn inside the cell with a −2px offset, and X-53's wording in the design direction includes that value.
2. **Risk Type uses the record picker**, per 18-CONTEXT D-11. §2.4's pick-list mention follows D-11.
3. **Specific labels:** the paste preview's actions read `Apply paste` and `Cancel paste`. The unsaved-changes bar's discard reads `Discard changes` and shows an Undo toast (G-4: reversible, so no confirmation). No plain `Cancel`, `Apply` or `Discard` remains.
4. **The Risks route's focal point** is the grid. On arrival, focus lands on the grid's caption, and the first arrow key enters the first row.
5. **Type sizes and spacing** come from the direction's scale (ADR 0001 gap 8). No change.
