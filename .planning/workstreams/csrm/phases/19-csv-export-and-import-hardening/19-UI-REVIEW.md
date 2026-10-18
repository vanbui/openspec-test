# Phase 19 — UI Review

**Audited:** 2026-10-17  
**Baseline:** Approved `19-UI-SPEC.md` (with review amendments R1 and R2, approved 2026-10-17) and `docs/design/csrm-design-direction.md` (X-30 to X-32)  
**Scope:** `git diff --name-only bdd0f698 f673dcb7 -- apps/csrm/src` plus the route files and `globals.css` it wires (the export controls on every list, report and released assessment; the export dialog and column choice; the print-ready report and its print styles; the import flow)  
**Screenshots:** Not captured. This was a code-only audit: no dev server or Playwright was started, so ports 1337 and 3000 stayed free.  
**Interaction captures:** off (`workflow.ui_interaction_capture=false`; code-only audit). Every interaction finding below comes from the code.

Settled and not raised: the header action order (Export last in DOM order inside the reversed wrapper, the pilot's ruling of 2026-10-16, FE4-14), every stage A finding in `19-REVIEW-DISPOSITION.md`, and the app-wide patterns in `.planning/WINDOWS.md`. Phase 10 markup and copy that Phase 19 did not change are not raised either.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every §1–§10 string, S1–S4, and the R1/R2 rows checked are in source word for word, and the copy guard pins them. |
| 2. Visuals | 3/4 | The hierarchy and phone branches are in code, but the report route has two `h1`s on screen, and nothing was rendered. |
| 3. Color | 4/4 | No raw colours or palette utilities in scope. Ink appears only on the listed primaries, checked controls and links. Every status pairs an icon with words. |
| 4. Typography | 3/4 | The FE4-05 figure button keeps the off-scale `text-2xl` (24px). The phone row cards use `<strong>`, which renders at 700. |
| 5. Spacing | 3/4 | Import warnings sit 20px apart where §Spacing says 24px, a similar row's decision sits 8px below its details where it says 16px, and the column error uses 6px. |
| 6. Experience Design | 3/4 | State coverage is complete, but there are aria and focus gaps: pending buttons are disabled under the focus, the similar panel is an assertive `alert`, the gate line and the column error are not linked to their controls, and the error report refusal is silent. |

**Overall: 20/24.** 0 BLOCKER, 12 WARNING.

---

## Top 3 Priority Fixes

1. **UI-01: pending submits disable the control that has focus.** `Export file`, the two template downloads and `Download error report` become `disabled` when pressed, so keyboard focus can drop to `body`, even inside the modal dialog. §2.6 asks for read-only controls, and 2.4.3 asks that focus stay put. Use `aria-disabled` and ignore the click while pending, as `Try again` already does (`export-dialog.tsx:291`).
2. **UI-02: the similar-rows panel is an `alert`.** The panel stays on screen, but the default `role="alert"` makes it an assertive, atomic live region around the polite `{d} of {k} decided` count. Each choice can then re-read the whole panel. Pass `role={undefined}` on that `Alert`, the FE4-03 pattern, and keep the count's own `aria-live="polite"`.
3. **UI-03 / UI-04: the gate line and the column error are not linked to the controls that are marked invalid or receive focus.** Focus lands on a radio, or on checkboxes marked `aria-invalid`, without the sentence that says why. Add the line's id to `aria-describedby` on the radio group and on the `Columns` fieldset.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- **PASS:** §1 titles: `Export {page heading}` on every list (`list-export-button.tsx:36` → `export-button.tsx:103`), on `Export {report title}` (`reports/[reportKey]/page.tsx:79`) and on `Export {assessment number}` (`released-assessment-actions.tsx:30`). Admin `Import` (renamed) is at `administration-workspace.tsx`. `Print report` is at `released-assessment-actions.tsx:23`.
- **PASS:** §2.2–§2.6: scope, filter lines, format hints, empty lines, over-limit title and body (`export-scope.ts:39-89`), `Choose at least one column.`, `{k} of {n} columns`, `Select all`, `Reset to visible` (`column-choice.tsx`), `Exporting…`, `Export file`, `Cancel`, the `Every column of each table is included, as on the page.` line, and R1 row 10's fixed-table description (`export-dialog.tsx:117`). The §7 success toast `Exported {file name}` / `{n} {row|rows}.` is at `export-dialog.tsx:196`.
- **PASS:** §4: `Print or save as PDF`, `Back to the risk assessment`, the toolbar description, the §4.3 headings, `Not recorded`, the defensive `No risks were recorded in this assessment.`, the generation line, R1 part 4's paper-neutral AI notice (`assessment-report.tsx:185`), and R1 rows 11–13.
- **PASS:** §5 and R2: the description (`csv-import-flow.tsx:547`), the guidance sentence and `How values are read` list (`import-flow-rules.ts:22,40-44`), `File to import`, `Drag a file here, or`, the hint (`import-flow-rules.ts:48`), the similar copy, the gate, the guard, the confirm summary and checkbox, the result tiles, `Skipped by your choice.`, `ERROR_REPORT_LINE`, and R2's three rewordings (`… columns in the file` :258, `File row` :608-609, `Not started` :554).
- Note (not scored): the scope sentence uses `matches` for a single record (`export-scope.ts:40`), where §2.2 writes only the plural form. This is a grammatical extension, not a departure.

### Pillar 2: Visuals (3/4)

- **PASS:** Export is an outline pill with a 16px `Download` icon (`export-button.tsx:101-111`). Below 768px, `.page-header-actions > *` spans the header (`globals.css:1209`). The dialog becomes a full-screen sheet with a title row and `Close` (`export-dialog.tsx:87-111`). Its actions stack with `Export file` first and are right-aligned from 768px (:308).
- **PASS:** The report card is `bg-surface border-border rounded-lg p-4 md:p-10 max-w-container-max` (`assessment-report.tsx:136`). The header block, the `dl` in one row from 640px, h2 to h4 inside the document, the captioned `table` with `scope="col"`, and the named, focusable scroll region all match §4.3.
- **UI-05 WARNING:** The report route renders two `h1`s on screen: `PageHeader`'s `Print report` (`page-header.tsx:21`, via `assessment-report.tsx:206`) and the document's `Cyber security risk assessment` (`assessment-report.tsx:141`). The §Accessibility row 1.3.1 asks for "h1 to h4 in order". Only the paper (toolbar hidden) has one `h1`. §4.2 and §4.3 together cause this, so record the decision. Either keep the toolbar's `h1` and render the document title as `h1` only in print (`<h2 className="print:…">`, which changes nothing on paper), or record the two-`h1` screen as an accepted exception in 19-UI-SPEC §4. No new copy is needed.
- **UI-06 WARNING:** Nothing was rendered, so these remain unverified: §Accessibility 1.4.10 reflow at 375/768/1440 for the phone export sheet (`h-dvh`, scrollable body at `export-dialog.tsx:226`), the two-column checklist at 640px, the released header wrapper, the report's `min-w-48` statement column at 375 (`assessment-report.tsx:93`), the import decision radios at 375, the A4 print output, and the `@page csrm-report` margin box (`globals.css`). Capture the git-ignored screenshots and a print-emulation PDF at 375 and 1440, or cite the e2e runs that cover them (`exports-and-imports.spec.ts`).

### Pillar 3: Color (4/4)

- **PASS:** In scope (`components/csrm/export/*`, `features/exports/*`, `csv-import-flow.tsx`, `import-row-status.tsx`, the report files) there are 0 hex, `rgb(` or `oklch(` values and 0 palette utilities (`red-`, `amber-`, `slate-` and so on). The print margin box uses `var(--foreground-secondary)`.
- **PASS:** Ink is used on the listed primaries (`Export file`, `Print or save as PDF`, `Choose file`, `Validate and preview`, `Continue to confirmation`, `Confirm import`), checked controls, record links and focus rings. `Export`, `Print report`, the downloads, `Choose another file` and the bulk decisions are `outline`. `Select all`, `Reset to visible` and `Show these rows` are `ghost` (§Color). Warning tone is on the cap alert, file refusals, ignored columns, the similar panel and badge. Danger is on validation lines and unexpected failures (`text-destructive`, ×7 in the import flow and column choice). `Matched by similar name` is warning with `CaseSensitive` (`import-row-status.tsx:141`), never a severity icon.
- Pre-existing and not raised: the step indicator's `border-primary bg-primary/10`, the active filter pill's `default` variant and the Results `FileCheck2 text-primary` were all present at `bdd0f698`.

### Pillar 4: Typography (3/4)

- **PASS:** In scope, the sizes are `text-sm` (body), `text-xs` (caption: hints, filter lines, counts, `Your choice`), `text-heading-sm` (dialog title and the report's identifier line and h3), `text-heading-md` (report h2, token weight 600), `text-heading-lg font-display` (report h1, weight 400), `micro-label` (eyebrow and table header) and `--text-table-size` (13px) for the overview table. `tabular-nums` is on every count (the scope, `{k} of {n} columns`, `{d} of {k} decided`, tiles and the file size).
- **UI-07 WARNING:** The FE4-05 figure button is `text-2xl font-semibold` (`csv-import-flow.tsx:247`, and the zero form at :248). 24px is not a §3.10 step (12/13/14/16/20/28), and §Typography says "the §3.10 scale, unchanged". Phase 19 rewrote this element. Use `text-heading-md` (20px, weight 600 from the token) on both forms.
- **UI-08 WARNING:** The phone row cards write `<strong>File row {n}</strong>` (`csv-import-flow.tsx:609`, `:629`). In R2 Phase 19 changed this text from `CSV row`. `<strong>` computes to weight 700, outside the 400/500/600 set. Use `<span className="font-medium">`.

### Pillar 5: Spacing (3/4)

- **PASS:** The dialog groups are 24px apart (`gap-6`, `export-dialog.tsx:226`) and label, hint and control 8px apart (`gap-2`). The checklist rows and columns are 8px apart (`column-choice.tsx:408`). Report sections are 32px apart (`gap-8`), blocks within a section 24px (`gap-6`), and the card padding is 16/40px. These match the §Spacing table.
- **UI-09 WARNING:** The import step body is `CardContent className="grid gap-5"` (`csv-import-flow.tsx:566`), so the ignored-columns alert, the notes and the similar panel (all new in Phase 19) sit 20px apart. §Spacing says "24px between import warnings", and 20px is off the §3.9 scale. Change it to `gap-6`, or wrap the three Phase 19 warnings in a `grid gap-6` group if the other steps must keep their rhythm.
- **UI-10 WARNING:** A similar row's decision sits `mt-2` (8px) below its `Similar to the existing …` line (`csv-import-flow.tsx:218`). §Spacing says "16px between a similar row's details and its decision". Use `mt-4`. The column error's icon gap is `gap-1.5` (6px, `column-choice.tsx:427`), which is off-scale and is the same pattern as Phase 16 UI-04. Use `gap-1`, or `gap-2` to match the import gate line (:604).

### Pillar 6: Experience Design (3/4)

- **PASS:** The §8 five-state contract is present. The dialog covers ready, both empty lines, over the limit, no column, pending, CSV `Table`, the reference-list hint, refusal with choices kept, and the remembered format with a storage fallback. The 300ms spinner on `Export` (`export-button.tsx:82-86`) and the FE4-12 toast are in place. The report route has `loading.tsx`, `error.tsx` (`ErrorState noun="this report"`), not-found and the defensive empty line. The import covers `Downloading…`, `Checking file…`, the S2 alert with the file kept, the ignored and notes lines, six states, the similar panel, the gate, the new-file guard, bulk Undo and the error report at Review and Results.
- **PASS (stage A fixes present):** FE4-03 `role={undefined}` on both focus-taking refusals (`export-dialog.tsx:282`, `csv-import-flow.tsx:579`). FE4-04 focus hand-offs (`column-choice.tsx:362-384`, `csv-import-flow.tsx:309-314`). FE4-05 figures as buttons. FE4-08 Undo scoped to its review. FE4-12 load failure. FE4-16 notice. R2 rewordings. Focus starts on the checked format and returns to `Export` (`export-dialog.tsx:92-102`). The gate focuses the first undecided radio (:319-324).
- **UI-01 WARNING:** A pending submit disables the control that holds focus. These include `Export file` (`export-dialog.tsx:309`, `disabled={pending || …}`) and the whole `fieldset disabled={pending}` (:235, so a radio or checkbox that pressed `Enter` loses focus too). They also include both template buttons (`csv-import-flow.tsx:506`, `disabled={templatePending !== null}`) and `Download error report` (:514). §2.6 says the controls "stay in place and become read-only", and 2.4.3 requires focus to stay put. The code's own FE4-04 fix uses `aria-disabled` for this reason (:291). Apply the same pattern: `aria-disabled={pending || undefined}` with a guarded handler on the submit and the download buttons, and `readOnly`/`aria-readonly` semantics (or a `pending` guard in each `onValueChange`/`onCheckedChange`) in place of `fieldset disabled`. Then the 4.1.3 "pending button's label change" (`Exporting…`, `Downloading…`, `Preparing error report…`) is announced on the button that still has focus.
- **UI-02 WARNING:** The similar-rows panel is `<Alert variant="warning">` with the default `role="alert"` (`csv-import-flow.tsx:591`, `alert.tsx:32`). It is a persistent panel, not an event. It also wraps the `aria-live="polite"` count (:596), so each decision can re-read the whole panel assertively, against §Accessibility 4.1.3 (count polite). Pass `role={undefined}` to this `Alert`. The ignored-columns alert (:588) is announced once on arrival, which is acceptable, but `role={undefined}` there too stops the step heading's focus announcement from competing with it.
- **UI-03 WARNING:** The gate line `Choose Update or Skip for {u} more {row|rows}.` (`csv-import-flow.tsx:604`) has no id. Focus moves to the first undecided radio (:322), so a screen reader user hears `Update “…”` without the reason (3.3.1). Give the line an id and add it to `aria-describedby` on each undecided `RadioGroup` while `gateShown` (`DecisionGroup`, :216).
- **UI-04 WARNING:** With no column checked, every checkbox gets `aria-invalid` (`column-choice.tsx:414`). The `Choose at least one column.` line (:426-430) is referenced only by `Export file`. The fieldset's `aria-describedby` (:400) lists the hint and count, not the error. Add `errorId` to the fieldset's `aria-describedby` while `checked.size === 0`. The `Format` hint (`export-dialog.tsx:238`) is not linked to its segmented control either. Give it an id and pass it as the control's description.
- **UI-11 WARNING:** Two import messages appear without being announced. (a) The error report refusal (`csv-import-flow.tsx:520`) is a plain `div` that neither takes focus nor is a live region. It follows a button press, so nothing is heard. Add `role="alert"` (it does not take focus, so this is no FE4-03 double announcement). The template refusal next to it (:574) already is an `Alert`. (b) `Choose one file to check.` (:582, R1 row 6) is a validation line with no icon, against §Accessibility 1.4.1 ("every validation line carry an icon and words"), and with no live region. Render it as the browser refusal is rendered (:581): `AlertCircle` 16px, `flex items-center gap-2`, `role="alert"`.
- **UI-12 WARNING:** `File to import` (§10, `csv-import-flow.tsx:154`) labels only the visually hidden `tabIndex={-1}` input. The control a person reaches, `Choose file` (:171), is named `Choose file` and described only by the hint, so the field's label is never spoken. Wrap the field in `role="group"` with `aria-labelledby` on the label's id, or add the label's id first in the button's `aria-describedby`. No new copy is needed: 2.5.3 is kept because the button's name stays `Choose file`.

---

## Registry Safety

`components.json` confirms the source-owned shadcn/ui setup. `19-UI-SPEC.md` (Registry safety) lists only official shadcn components and no third-party registry blocks. Registry audit: 0 third-party blocks checked, no flags.

## Files Audited

- `AGENTS.md`; `19-UI-SPEC.md` (§1–§11, Copywriting, Accessibility, Spacing, Typography, Color, Motion, R1, R2); `19-REVIEW-DISPOSITION.md`; `16-UI-REVIEW.md` (format)
- `apps/csrm/src/components/csrm/export/export-button.tsx`, `export-dialog.tsx`, `column-choice.tsx`; `components/csrm/status-badge.tsx`, `page-header.tsx`; `components/ui/alert.tsx`, `card.tsx`, `button.tsx`
- `apps/csrm/src/features/exports/list-export-button.tsx`, `export-scope.ts`
- `apps/csrm/src/features/assessments/assessment-report.tsx`, `report-toolbar.tsx`, `released-assessment-actions.tsx`, `assessment-list.tsx`, `released-assessment.tsx`, `assessment-editor.tsx`
- `apps/csrm/src/features/administration/csv-import-flow.tsx`, `import-flow-rules.ts`, `import-row-status.tsx`, `administration-workspace.tsx`
- `apps/csrm/src/features/alerts/alerts-page-header.tsx`, `features/risks/risk-register.tsx`, `risk-register-filters.tsx`
- `apps/csrm/app/(app)/app/{requests,questionnaires,assessments,alerts,risks}/page.tsx`, `review/{requests,assigned,questionnaires,assessments}/page.tsx`, `reports/[reportKey]/page.tsx`, `admin/[collection]/page.tsx`, `assessments/[documentId]/report/{page,loading,error}.tsx`
- `apps/csrm/app/globals.css` (`@page csrm-report`, print rules, `.page-header` phone stacking, type tokens)
