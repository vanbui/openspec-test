---
phase: "19"
slug: "csv-export-and-import-hardening"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-10-01"
reviewed_at: "2026-10-01"
---

# Phase 19 — UI Design Contract

> Visual and interaction contract for CSV export and import hardening. It covers:
> - the `Export` action on every list and on the released assessment, and its export dialog (D-04, D-06, D-17, D-20 to D-22);
> - what a file shows people: header labels, values, the `About this export` sheet and file names (D-07 to D-10);
> - the print-ready A4 report of a released assessment (D-23, D-24);
> - the Administration import flow's new states: XLSX files, header matching, ignored columns, file refusals with fix-it steps, `Matched by similar name` with its decisions, templates and error reports served by Strapi (D-25 to D-33);
> - every refusal's words (new family S) and the toasts.
>
> It introduces no colour, type size, weight, family, radius, shadow, spacing step or duration of its own. Three patterns the direction does not yet name are proposed as CSRM extensions X-30 to X-32. X-31 carries the only new values, the A4 page box and its margin, which D-24 assigns to this contract.

---

## Binding inputs and value authority

- **Locked decisions.** D-01 to D-41 and the Orchestrator Confirmations in `19-CONTEXT.md`. This contract fixes the copy, layout, slugs and extension wording the context leaves to it ("Planner's Discretion", last item). Open points are settled under "Decisions recorded" (UI-D1 to UI-D24).
- **Value authority.** `docs/design/csrm-design-direction.md` (ADR 0001) only, cited by section (§). No colour, size, radius, shadow or duration is restated.
- **Extensions reused** (recorded by Phases 10 to 16 before this phase executes): X-3 (dates and times), X-4 (separators), X-10 (figure links), X-13 (side sheet, for its phone form), X-14 (Undo toast), X-19 (file field), X-23 (file names and sizes). New: X-30 to X-32, recorded by a Phase 19 plan task before any implementing task.
- **Earlier contracts this one builds on, by section, never restated:** Phase 10 §10.2 (refusal copy families and format), §15 (the released view, its labels and `Not recorded`), §17.1 (the CSV strings it rewrote, which §5.7 here supersedes where named); Phase 11 "Voice, formats and shared copy rules", §2.1 (page headings, which name each export), §7 (each list's columns), §9.5 (register markers), §10 (the Released label), §12 (five-state format); Phase 12 §10.1 (the Requestor's AI notice); Phase 14 "Design system", "Component inventory" and §1.1 (X-19 in use), `lib/files` (the file-response validator and save helper, 14-CONTEXT D-24); Phase 16 §15 (G-4 table format).
- **Requirements.** CSV-01, CSV-02, CSV-03; ROADMAP Phase 19 success criteria 1 to 6. Findings closed: UAT-049, UAT-051, UAT-052.
- **Reserved words.** `Accept` stays the risk owner's decision (G-14); no Phase 19 string uses it ("accepted types" reads "allowed"). `Release` names the assessment's state only.

### Decision coverage

| Decisions | Where |
|---|---|
| D-04, D-05 | §1 (placement per view), §2.2 (scope sentence: the whole list, every page) |
| D-06 | §2.4 (columns, default visible, other columns offered, reference lists), UI-D5 |
| D-07, D-08, D-09, D-10 | §3 (cell values, formats, About sheet, file names and slugs) |
| D-11 | §3.3 (the About sheet's formula line), §5.3 (Guidance), D-28 mark stripping needs no UI |
| D-13 to D-16 | §1 (no control where the list is gated or the assessment is unreleased), §6 S1 (each refusal's words) |
| D-17 | §2.5 (the cap warning before the request), S1 `EXPORT_ROW_LIMIT` |
| D-18 | No UI: the log is not shown in the app |
| D-19 | §2.6 (pending, success, server's file name) |
| D-20 | §2 entire, X-30 |
| D-21, D-22 | §2.3 (CSV table choice), §3.3 (sheet names) |
| D-23, D-24 | §4, X-31 |
| D-25, D-26 | §5.4 (accepted files), §6 S2 (fix-it copy) |
| D-27, D-28 | §5.5 (ignored columns warning, notes), §5.3 (Guidance), §6 S2 (header refusals) |
| D-29 | No UI beyond §5.3's value rules |
| D-30 | §5.6, X-32 |
| D-31, D-32, D-33 | §5.3 (templates), §5.8 (error reports), §2.4 (reference-list columns), §3.4 (Notes sheet) |
| D-37 | No journey slice; §11 lists the E2E assertions |

---

## Design system

As Phase 14 "Design system" (shadcn/ui new-york, source-owned; Radix through `radix-ui` 1.6.7; `sonner` under the local `Toaster`; `lucide-react` 1.30.0; Plus Jakarta Sans, Instrument Serif, IBM Plex Mono; semantic tokens in `apps/csrm/app/globals.css`). Every icon named here was confirmed in the installed `lucide-react` on 2026-10-01: `Download`, `Printer`, `ArrowLeft`, `FileWarning`, `Info`, `CaseSensitive`, `TriangleAlert`.

**New dependencies:** none in the web. The XLSX libraries live in Strapi only (D-12). No PDF library: the report prints through the browser (D-23).

---

## Component inventory

### Source-owned shadcn/ui components

Enumerated by `ls apps/csrm/src/components/ui/*.tsx | grep -v '\.test\.tsx$' | wc -l` — 30 components — radix-ui@1.6.7 (shadcn/ui new-york, source-owned; version from `node -p "require('radix-ui/package.json').version"` in `apps/csrm`) — 2026-10-01.

A non-exhaustive list of known-good components this phase uses, never a closed allowlist.

| Component | Import path | Phase 19 use |
|---|---|---|
| `Dialog` | `@/components/ui/dialog` | The export dialog from 768px (X-30) |
| `Sheet` | `@/components/ui/sheet` | The export dialog's full-screen phone form (X-30, as X-13's phone form) |
| `Checkbox`, `Label` | `@/components/ui/checkbox`, `@/components/ui/label` | The column checklist; the import confirmation checkbox (unchanged) |
| `RadioGroup` | `@/components/ui/radio-group` | The CSV `Table` choice; each similar row's decision (X-32) |
| `Alert` | `@/components/ui/alert` | Cap warning, export refusals, file refusals, ignored-columns warning, the similar-rows panel |
| `Button` | `@/components/ui/button` | `Export`, `Export file`, `Print report`, `Print or save as PDF`, template and error-report downloads, bulk decisions |
| `Table` | `@/components/ui/table` | The report's risks overview; the Guidance column table (unchanged frame) |
| `Skeleton` | `@/components/ui/skeleton` | The report route's `loading.tsx` |
| `Toaster` (sonner `toast`) | `@/components/ui/sonner` | Export and download success; the bulk-decision Undo (X-14) |

### CSRM shared primitives

Enumerated by `ls apps/csrm/src/components/csrm/*.tsx apps/csrm/src/components/csrm/*.ts | grep -v '\.test\.' | wc -l` — 15 modules — @csrm/web@0.1.0 (source-owned) — 2026-10-01.

A non-exhaustive list; the executor may use any exported primitive.

| Primitive | Path | Phase 19 change |
|---|---|---|
| `PageHeader` | `components/csrm/page-header.tsx` | Gains `Export` (and `Print report` on released views) in its action slot; the report route's header is `data-print="hidden"` |
| `SegmentedControl` | `components/csrm/segmented-control.tsx` | The `Format` choice (§4 Forms segmented control) |
| `StatusBadge`, `statusPresentation` | `components/csrm/status-badge.tsx` | The import row states move, with the sixth state `similar` (X-32: `Matched by similar name`, warning, `CaseSensitive`, unchanged), to the import-only `features/administration/import-row-status.tsx` (`ImportRowBadge`), which only the import route loads; the shared mapping keeps every other family and does not grow (B4, pilot ruling 2026-10-16; plan 19-13) |
| `RiskRatingBadge` | `components/csrm/risk-rating-badge.tsx` | The report's ratings, unchanged |
| `DataTable`, `HorizontalScrollRegion` | as shipped | The import review and results tables, unchanged frame |
| Phase 10 `LocalInstant`, `refusal-copy.ts`; Phase 14 `lib/files` | as those phases plan them | X-3 times; family S; the file-response validator and save helper (D-19) |
| **New:** export | recommended `components/csrm/export/` (`export-button.tsx`, `export-dialog.tsx` lazy, `column-choice.tsx`, the primitive Phase 18 adopts, D-06) and one `*-export-action.ts` `'use server'` per feature | §1, §2 |
| **New:** report | recommended `features/assessments/assessment-report.tsx` (Server Component) and `report-toolbar.tsx` (the one Client Component, `window.print()`) | §4 |

Names and paths are the planner's. Client modules stay zod-free (`zod-client-boundary.test.ts`).

---

## Token names used in this contract

As Phase 11's table. Additionally or more heavily used:

| Direction token | Phase 19 use |
|---|---|
| `--color-warning-*` | The cap alert, file refusals, ignored-columns warning, the similar-rows panel and badge |
| `--color-bg-inset` | None new; the checklist sits on the dialog surface |
| `--text-heading-lg`, `--text-heading-md`, `--text-heading-sm` | The report's title, section headings and per-Risk headings (§4.3) |
| `--font-mono` with `--text-micro` | The report's `IdamBox CSRM` eyebrow; identifiers in the report header |

---

## Voice, formats and shared copy rules

Phase 11's rules apply unchanged (Australian English, sentence case, spaced hyphen, X-4 middle dot, typographic apostrophes and quotes, written-out plurals with `tabular-nums`, X-3 times). In addition:

- **Formats** are named `Excel workbook (.xlsx)` and `CSV (.csv)` in controls, and `Excel` and `CSV` in running text. A legacy workbook is `Excel 97-2003 workbook (.xls)`.
- **Export** is the verb for a list or record leaving CSRM; **download** is the verb for a template or error report; **print** for the report. Copy never says "dump", "extract" or "generate a file".
- **Files** follow X-23 (names verbatim, sizes in 1,024-byte units: the limit reads `5 MB`).
- **Excel menu paths** are written `File > Save As`, with the menu choice quoted exactly as Excel shows it: `“CSV UTF-8 (Comma delimited) (*.csv)”`, `“Excel Workbook (*.xlsx)”`.
- **Counts of rows** use `row` and `rows`; counts of records use the view's noun (§2.2).

---

## 1. The Export action (D-04, D-13, D-20; X-30)

`Export` is an outline pill with a 16px `Download` icon, accessible name `Export {page heading}` (2.5.3: begins with the visible label). It is the last item in the page header's action slot in DOM order, so it follows the page's existing actions in the keyboard path; below 768px header actions stack full width (§4 Page header).

| Surface (route) | Header actions after this phase | Export title (`Export {page heading}`) |
|---|---|---|
| Requests (`/app/review/requests`) | `Export` | `Export Requests` |
| Questionnaires (`/app/review/questionnaires`) | `Export` | `Export Questionnaires` |
| Risk assessments (`/app/review/assessments`) | `Export` | `Export Risk assessments` |
| Risk register (`/app/risks`) | `Export` | `Export Risk register` |
| Alerts (`/app/alerts`) | `Export` | `Export Alerts` |
| Each report (`/app/reports/{reportKey}`) | `Export` | `Export {report title}` (for example `Export Risk exposure`) |
| Reference data (`/app/admin/{collection}`) | `Create {singular}` (primary), `Import` (renamed from `Import CSV`), `Export` | `Export {plural}` (for example `Export Controls`) |
| My requests, My questionnaires, My risk assessments | existing actions (`New request` on My requests), then `Export` | `Export My requests` and so on |
| Released assessment, Requestor (`/app/assessments/{id}`) and analyst (`/app/review/assessments/{id}`, once released) | `Print report` (outline link, `Printer`, §4.1), then `Export` | `Export {assessment number}` |

- **Where it does not render.** Either Home; a single request or questionnaire; an analyst assessment page before release (D-15: the analyst exports an unreleased assessment's risks from Phase 18's table); any route the viewer is refused (the gate or the in-shell not-found renders, so no control exists, D-16). Navigation visibility is not authorisation: the server refuses every one of these (§6 S1).
- **Always enabled.** `Export` is never disabled in the header, so its reason is always reachable; the dialog explains an empty list or a list over the limit (§2.5, UI-D3).
- **Prints:** never (an interaction-only header action, §4 Print).

---

## 2. The export dialog (X-30; D-20 to D-22)

### 2.1 Frame

The form dialog (640px, §4 Dialogs). Below 768px a full-screen sheet with a visible title row and `Close`, as X-13's phone form. Title (h2, `--text-heading-sm`): `Export {page heading}`. The body is one `form`; its groups are 24px apart; within a group, label, hint and control are 8px apart (§3.9). Order: scope (§2.2), `Format` (§2.3), `Table` when shown (§2.3), `Columns` when offered (§2.4), the state line or alert (§2.5), then the actions row: `Export file` (primary, `Download` icon) and `Cancel` (outline), right-aligned from 768px, full width and stacked with `Export file` first below 768px.

The dialog's code loads on first open (`next/dynamic`); everything it needs (the list's total, active filters, visible columns, the view's column labels) comes from the page, so it opens without a loading state. If its code has not loaded within 300ms of activation, `Export` shows the inline 16px spinner until the dialog opens.

### 2.2 Scope sentence (`--text-body`; counts `tabular-nums`)

| Case | Copy |
|---|---|
| Search or filters active, more than one page | `{n} {records} that match the current search and filters, in the current order: every page, not just this one.` |
| Search or filters active, one page | `{n} {records} that match the current search and filters, in the current order.` |
| None active, more than one page | `All {n} {records}, in the current order: every page, not just this one.` |
| None active, one page | `All {n} {records}, in the current order.` |
| Then, when active (`--text-caption`, `--color-text-secondary`) | `Search: “{term}”` and `Filters: {chip label}: {value} · {chip label}: {value}`, each on its own line, using the filter chips' own labels (§4 DataTable) |
| A report | `The {report title} report as at {as-at date}{, for {period}}, with its {t} tables.` |
| A released assessment | `{assessment number} as released: its summary, {r} {risk|risks} and {c} mitigation {control|controls}.` |

`{records}` is the view's noun in running-text case: `requests`, `questionnaires`, `risk assessments`, `risks` (Risk register), `alerts`, `Risk Types`, `controls`, `Information Systems`, `Information Assets`. The count is plain text, not a link (the person is already on the list, X-10 does not apply).

### 2.3 Format and table

- **`Format`**: the segmented control (§4 Forms), visible label `Format`, options `Excel workbook (.xlsx)` (default) and `CSV (.csv)`. Hint below (`--text-caption`, `--color-text-secondary`), for the checked option:
  - XLSX, one table: `Opens in Excel with numbers, dates and leading zeros kept. Includes an “About this export” sheet.`
  - XLSX, several tables: `Each table is its own sheet, followed by an “About this export” sheet.`
  - CSV: `Plain text for any tool. Excel may remove leading zeros (0042) and change date-like text when it opens a CSV.`
- **The last format chosen is remembered** per person in browser storage (guarded by try/catch; a failure falls back to XLSX). Columns are never remembered (UI-D6).
- **`Table`** (reports and the released assessment, CSV only): a radio group labelled `Table`, one option per table, named by its heading on the page; the first is checked. Released assessment: `Risks`, `Mitigation controls`. Hidden while XLSX is checked, and its choice is kept if the person switches back.

### 2.4 Columns (the column-choice primitive, D-06)

- **Offered** on every single-table view. A fieldset with legend `Columns`, the count `{k} of {n} columns`, `Select all` (ghost small pill; hidden when every column is checked) and `Reset to visible` (ghost small pill; shown only while the choice differs from the default). Below: one checkbox per column, labelled with the on-screen header in sentence case, in the view's column order, one column below 640px and two from 640px.
- **Default:** the columns the desktop table shows (Phase 11 §7, §9.5), checked; the view's other columns (D-06: Stage, Accepted, due state, holder, next step, Request title, Assessment type and the register's detail fields) unchecked below them in the same order.
- **Reference lists** (D-33): every import-template column and every read-only list column is checked by default, and a hint under the legend reads `To edit this file and import it again, keep {key label} and every required column.` (`{key label}` is `Control number` for Controls, else `Name`).
- **None checked:** the line `Choose at least one column.` under the checklist (`--color-danger-fg`, `CircleAlert` 14px, §4 Forms validation), and `Export file` is disabled and described by it.
- **Fixed-table views** (reports, released assessment) have no column choice. In its place a `--text-caption` line: `Every column of each table is included, as on the page.` (UI-D5)

### 2.5 States before the request

| State | What shows (above the actions row) | `Export file` |
|---|---|---|
| Ready | nothing | enabled |
| Empty, search or filters active | `--text-body` line, `--color-text-secondary`, `Info` 16px: `Nothing matches the current search and filters, so there’s nothing to export.` | disabled, described by the line |
| Empty, none active | same anatomy: `There are no {records} to export yet.` | disabled, described |
| Over the limit (n > 10,000) | Warning alert, `TriangleAlert`: title `Too many rows to export`; body `{n} {records} match, and one export holds at most 10,000 rows. Narrow the search or filters, then export again.` | disabled, described |
| No column checked | §2.4 | disabled, described |

### 2.6 Request, success and refusal

- **Pending:** `Export file` reads `Exporting…` with the inline 16px spinner (§4 Skeletons rule for blocking submits); the form's controls stay in place and become read-only; `Cancel` stays enabled and closing discards the result: no file is saved and no toast shows.
- **Success:** the dialog closes, the browser saves the bytes under the server's file name (D-10, D-19), focus returns to `Export`, and a success toast reads title `Exported {file name}`, body `{n} {row|rows}.` (the server's count, UI-D8). No Undo and no confirmation: an export changes nothing (D-20).
- **Refusal:** an alert above the actions row with family S1's copy (§6); warning tone for a fixable reason, danger tone for an unexpected failure with `Try again` (re-submits the same choices). Every choice is kept; focus moves to the alert's title.
- **Keyboard:** `Export` opens the dialog; focus starts on the checked `Format` segment; arrows move within the segmented control and radio groups; `Tab` reaches the checklist, its two actions and the buttons in DOM order; `Enter` in the form exports; `Escape` and `Cancel` close and return focus to `Export`.

---

## 3. What a file shows (D-07 to D-10)

### 3.1 Headers and values

- Header labels equal the on-screen column headers in their source sentence case (not the `--text-micro` uppercase rendering).
- Status, stage, due state, holder, alert kind and urgency labels come from the one label vocabulary (D-07), so a file reads `Released`, never `approved`.
- Flags read `Yes` and `No`; an absent value is an empty cell; people by display name; records by number.
- **Calendar dates and instants** (instants as the viewer's local calendar date, X-3): XLSX date cells with the `d mmm yyyy` display format; CSV `YYYY-MM-DD` (ISO), confirming research assumption A7, because ISO sorts and re-imports unambiguously (UI-D9).

### 3.2 File names (D-10)

`{slug}-{local date YYYY-MM-DD}.{csv|xlsx}`:

| View | Slug |
|---|---|
| Requests, Questionnaires, Risk assessments | `requests`, `questionnaires`, `risk-assessments` |
| Risk register, Alerts | `risk-register`, `alerts` |
| My requests, My questionnaires, My risk assessments | `my-requests`, `my-questionnaires`, `my-risk-assessments` |
| A report, XLSX | `{reportKey}-report` (`risk-exposure-report-2026-10-01.xlsx`) |
| A report, CSV | `{reportKey}-{table slug}` (the table heading, lower case, hyphenated) |
| Reference data | `risk-types`, `controls`, `information-systems`, `information-assets` |
| A released assessment, XLSX | `{assessment number}-risk-assessment` |
| A released assessment, CSV | `{assessment number}-risks` or `{assessment number}-mitigation-controls` |
| An import template (no date) | `{collection slug}-import-template.{csv|xlsx}` |
| An error report | `{collection slug}-import-issues-{local date}.{format of the uploaded file}` |

### 3.3 Sheets (XLSX)

- **Sheet names:** the page heading for a single table (`Risk register`); `Summary`, `Risks`, `Mitigation controls` for a released assessment; each table's heading for a report (cut to 31 characters, Excel's limit); then `About this export`.
- **`About this export`** is two columns, `Item` and `Detail`, in this order (rows that do not apply are omitted):

| Item | Detail |
|---|---|
| `View` | The page heading (`Risk register`, `{assessment number} · {request title}`) |
| `Search` | `“{term}”` |
| `Filters` | `{chip label}: {value}`, one per line in the cell |
| `Sorted by` | `{column label}, {ascending|descending}` |
| `Columns` | The chosen column labels, comma-separated |
| `Rows` | `{n}` |
| `As at`, `Period` | Reports only (D-22) |
| `Exported` | `{date and time} ({IANA zone})`, en-AU per X-3; with the UTC fallback: `{date and time} (UTC, because your time zone wasn’t known; dates in this file use UTC)` |
| `Exported by` | Display name |
| `Values that look like formulas` | `Values that begin with =, +, -, @, a tab or a line break start with an apostrophe (') so they open as text. CSRM removes it when the file is imported.` |
| `AI assistance` | Released assessment, only when AI assisted: Phase 12 §10.1's notice text |

### 3.4 Template `Notes` sheet (D-31)

Columns `Column`, `Also accepted as` (the API field name), `Required` (`Required`, `Optional`), `Format and allowed values`, `A blank cell`. Then, after one empty row, one rule per row:
1. `Yes/No columns accept Yes, No, Y, N, TRUE or FALSE.`
2. `#CLEAR on its own empties an optional value when a row updates an existing {singular}.`
3. `Row 2 is an example. CSRM skips it, so you can keep it or delete it.`
4. `Columns CSRM doesn’t recognise are ignored, and the import tells you which.`
5. `A cell showing an Excel error, such as #DIV/0!, imports as blank.`
6. `Keep this file as an Excel workbook (.xlsx). Excel removes leading zeros (0042) and changes date-like text when it opens a CSV.`

The example row's natural key is `Example (CSRM skips this row)` (`EXAMPLE` for a Control number), reserved by the import (D-28). Allowed values are listed comma-separated in their display labels.

---

## 4. The print-ready report (X-31; D-23, D-24)

### 4.1 Entry

`Print report`, an outline pill link with a 16px `Printer` icon, before `Export` in both released views' headers (§1). It navigates in the same tab to `/app/assessments/{id}/report` (Requestor) or `/app/review/assessments/{id}/report` (analyst). An unreleased assessment, or one the viewer cannot read, renders the in-shell not-found (D-14, D-16).

### 4.2 The screen toolbar

The route's `PageHeader` is the toolbar and carries `data-print="hidden"` as a whole: eyebrow `{assessment number}`, title `Print report`, description `This is the released assessment as an A4 report. Print it, or save it as a PDF from your browser’s print dialog.` Actions: `Print or save as PDF` (primary, `Printer`, calls `window.print()`) and `Back to the risk assessment` (outline link, `ArrowLeft`). Focus starts on the h1 on navigation, as every route.

### 4.3 The document

On screen the document is one card (`--color-bg-surface`, 1px `--color-border-default`, `--radius-lg`, 40px padding from 768px and 16px below) at most `--spacing-container-max` wide. In print it is the page itself (X-31). Contents in order:

| Part | Contract |
|---|---|
| Header | Eyebrow `IdamBox CSRM` (`--text-micro`); h1 `Cyber security risk assessment` (`--text-heading-lg`); a `--text-heading-sm` line `{assessment number} · {request number} · {request title}`; then a definition list in one row from 640px: `Release date`, `Released by`, `Overall rating` (`RiskRatingBadge`). A 1px `--color-border-default` rule below |
| h2 `Summary` | The summary text |
| h2 `Overall rating and rationale` | The rating badge, then the rationale |
| h2 `Recommendations` | The recommendations |
| h2 `Control effectiveness and next review` | Definition list: `Overall control effectiveness`, `Next review date` (calendar date, X-3) |
| h2 `Risks overview` | A table: `Risk` (number, `--font-mono`), `Risk statement` (whole, never clamped), `Inherent rating`, `Residual rating`, `Treatment` (treatment action label). `--text-table`, the DataTable's typography without its interaction (no sort, density or scroll region) |
| h2 `Risks in detail` | Per Risk: h3 `{risk number}` with its statement, then Phase 10 §15.2's shared read-only Risk at heading level h4 (ratings, ownership and treatment, mitigation control implementations) |
| h2 `Notes` | Phase 12 §10.1's AI notice when AI assisted; then `This report shows the risk assessment as released. Generated {date and time} ({IANA zone}).` |

Section headings are `--text-heading-md`; text is `--text-body`; long text wraps and is never clamped (§4 Print refinements). Absent values read `Not recorded` (Phase 10 §15.2). Withdrawn risks are absent because the read excludes them (Phase 16).

### 4.4 States

| State | Contract |
|---|---|
| Loading | `loading.tsx`: the toolbar, then a skeleton card mirroring the header block, three text sections and a five-column table (§4 Skeletons) |
| Error | The route's `error.tsx`: `We couldn’t load this report` · `Try again` (Phase 11 §2.4 anatomy) |
| Not found or unreleased | The in-shell not-found (unchanged) |
| No risks (cannot occur for a released assessment) | `Risks overview` reads `No risks were recorded in this assessment.` defensively |

---

## 5. The import flow (D-25 to D-33)

The five steps stay (`Guidance`, `Select file`, `Review rows`, `Confirm import`, `Results`), with their step indicator, focus and announcements unchanged. Only what changes is listed.

### 5.1 Route and entry

| Element | Copy |
|---|---|
| Admin list header action | `Import` (was `Import CSV`) |
| Page title (`h1`) and route title | `Import {plural}` (was `Import {plural} from CSV`) |
| Description | `Import a CSV or Excel file. You review every row before anything is created or updated.` |

### 5.2 Accepted files

`.csv` (UTF-8, with or without a BOM, comma-separated) and `.xlsx` (first sheet). The browser checks only extension and size; everything else is Strapi's (D-25).

### 5.3 Guidance step

- Paragraph 1: Phase 10 §17.1's CSV guidance string, with `Matched by similar name` added: `A row whose {key label, lowercase} matches an existing {singular} updates it. Other valid rows create new {plural}. A row whose name matches an existing one only by capitals or spacing waits for your choice. Unchanged, rejected and ambiguous rows are never written.`
- The column table gains columns: `Column` (display label), `Also accepted as` (API name), `Required`, `Format and allowed values`.
- A `How values are read` list (`--text-body`, `ul`): `Headers match whatever their capitals and spacing, by the column name or the name in the template.` · `Yes/No columns accept Yes, No, Y, N, TRUE or FALSE.` · `A blank cell leaves an existing value unchanged. To empty an optional value, type #CLEAR.` · `Columns that aren’t listed here are ignored, and you’ll see which.` · `If you edit in Excel, use the Excel template or an Excel export: Excel removes leading zeros (0042) and changes date-like text when it opens a CSV.`
- Actions: `Choose file` (primary), `Download Excel template`, `Download CSV template` (outline, `Download`), `Return to {plural}` (outline link). Downloads show `Downloading…` with the inline spinner, then the toast `Downloaded {file name}`; a failure is an alert above the actions with S3's copy.

### 5.4 Select file step

The X-19 file field for one file: `Choose file` (singular), line `Drag a file here, or`, hint `A CSV (UTF-8) or Excel workbook (.xlsx), up to 5 MB and 5,000 rows.` The chosen file shows `{name} · {size}` (X-23). The browser refuses a wrong extension or an oversized file under the field with S2's copy. `Validate and preview` (primary) reads `Checking file…` while pending.

**A file-level refusal** from Strapi is a warning alert above the field (`FileWarning`): title and body from S2, the body naming what was found and the fix as numbered steps where there is more than one. The chosen file stays listed; focus moves to the alert title; `Choose another file` (outline) sits in the alert.

### 5.5 Review rows: warnings and notes

Above the summary, in this order:
1. **Ignored columns** (warning alert, `TriangleAlert`, persists): title `Some columns will be ignored`; body `These columns aren’t part of the {singular} import: “{header}”, “{header}”. Their values won’t be imported.` Headers are shown as typed, in file order.
2. **Notes** (neutral lines, `Info` 16px, `--text-body` in `--color-text-secondary`), one per case: `The Issues column from an error report is ignored.` · `Columns from a {plural} export that can’t be imported are ignored: {labels}.` · `Row 2 is the template’s example row, so it’s skipped.`
3. **Similar rows** (§5.6).

The summary tiles and the state filter gain the sixth state (`Matched by similar name`). Each tile's figure selects its state's filter (X-10 applied to the in-page list); a zero figure is plain text.

### 5.6 Matched by similar name (X-32; D-30)

- **The row:** the `Matched by similar name` badge (warning, `CaseSensitive`); `Details` reads `Similar to the existing {singular} “{existing name}”.`; then a radio group named `Decision for row {n}`, no option checked: `Update “{existing name}”` with hint `Uses this row’s other values and keeps the existing name.`, and `Skip this row` with hint `Leaves “{existing name}” as it is.` Once chosen, the badge is followed by `Your choice: Update` or `Your choice: Skip` (`--text-caption`).
- **The panel** (warning alert, first in the rows area while any similar row exists): title `{k} {row matches|rows match} an existing name only by capitals or spacing`; body `Choose to update the existing {singular} or skip the row. No new {plural} are created for these rows.`; the count `{d} of {k} decided` (`tabular-nums`, `aria-live="polite"`); actions `Update all {k}`, `Skip all {k}` (outline small) and `Show these rows` (ghost small; selects the state filter).
- **Bulk choices** set every similar row. When that replaces at least one different individual choice, an X-14 Undo toast reads `Set {k} rows to {Update|Skip}` and `Undo` restores the previous choices; otherwise no toast.
- **The gate:** `Continue to confirmation` stays enabled. With undecided rows, pressing it shows `Choose Update or Skip for {u} more {row|rows}.` under the panel (`--color-danger-fg`, `CircleAlert`), selects the similar filter and moves focus to the first undecided row's radio group.
- **No lost input:** choices persist while moving between `Review rows` and `Confirm import`. Choosing a file again starts a new review, and `Back to file selection` with any choice made says so first: `Choosing another file clears your {d} {choice|choices}.` with `Choose another file` and `Keep reviewing` (UI-D15).
- **Phones:** the card gains the radio group, full width, options at the touch-target height.

### 5.7 Confirm import and Results

| Element | Copy |
|---|---|
| Confirm summary | `This import will create {c} and update {u} {plural}{, including {s} matched by similar name}. {k} {row|rows} will be skipped: {r} rejected, {a} ambiguous, {n} unchanged{ and {x} you chose to skip}.` (zero parts omitted) |
| Confirm checkbox | `I have reviewed the rows to create and update.` |
| Results tiles | `Created`, `Updated`, `Unchanged`, `Rejected`, `Ambiguous`, `Skipped by you` |
| Results row for a skipped similar row | The `Matched by similar name` badge with `Skipped by your choice.` |
| Results action | `Import another file` (was `Import another CSV`); `Download result report CSV` is replaced by the error report (§5.8) |

### 5.8 Error reports (D-32)

- **Offered** at `Review rows` when any row is `Rejected`, `Ambiguous` or `Matched by similar name`, and at `Results` when any row was not imported other than by the person's own skip (UI-D13). Outline button `Download error report` (`Download` icon), in the uploaded file's format, with the line `The rows that weren’t imported, exactly as in your file, with an Issues column. Correct them and import the file again.` (`--text-caption`).
- **Pending** `Preparing error report…`; success toast `Downloaded {file name}` with body `{n} {row|rows} to correct.`; refusal inline under the button (S3).
- **Row issue copy added** (family S4, written into the `Issues` column and the row details): see §6.

---

## 6. Refusal copy (new family S)

Added to Phase 10 §10.2's module (`refusal-copy.ts`) and Strapi's closed reason list (D-03 item 4). Codes are recommended; the planner fixes the names in `conflict-reasons.ts` and both mirrors.

### S1. Export

| Reason | Copy | Kind |
|---|---|---|
| `EXPORT_ROW_LIMIT` | `This export would hold {count} rows, more than the 10,000 limit. Narrow the search or filters, then export again.` | warning |
| `ASSESSMENT_NOT_RELEASED` (409; the pilot's stop A ruling 1, 2026-10-16, applied by plan 19-02) | `This risk assessment can be exported once it’s released. Refresh the page to see its current state.` | warning |
| `EXPORT_CELL_TOO_LONG` (422, xlsx only, served with `column` and `cellLimit`; approved by the pilot on 2026-10-17 in `docs/contract-gaps/phase-19-exports-and-export-log.md`, the code review amendment, `3b5c66fa`) | Title `A value is too long for Excel`. A list or report: `{Column label} holds text longer than Excel’s 32,767-character cell limit, so the workbook would cut it. Export as CSV instead, or shorten the text in CSRM.` The released assessment: `{Column label} holds text longer than Excel’s 32,767-character cell limit, so the workbook would cut it. Export the Risks or Mitigation controls table as CSV, or use the print-ready report for the whole record.` `{Column label}` is the export vocabulary’s label for the closed `column` key; without a label the view holds, the last row applies. The apostrophe in “Excel’s” is typographic, per §6’s voice rules; the record writes it straight. | warning (no `Try again`) |
| 400 invalid query, column or format | `The current search or filters can’t be exported. Clear the filters, then export again.` | warning |
| 403 | `You don’t have access to export this list.` | danger |
| 404 (released assessment) | `We couldn’t find this risk assessment. It may no longer be available to you.` | danger |
| Network, 5xx, or a response the file validator rejects | `We couldn’t create the file.` with `Try again` | danger |

### S2. Import file refusals

| Reason | Title | Body |
|---|---|---|
| `IMPORT_ENCODING_WINDOWS_1252` | `Save the file as CSV UTF-8` | `This file is in Excel’s older “CSV (Comma delimited)” format, which can garble names with accents or symbols.` Steps: `1. In Excel, choose File > Save As.` `2. Choose “CSV UTF-8 (Comma delimited) (*.csv)” and save.` `3. Choose the new file here. Or upload the Excel workbook (.xlsx) itself.` |
| `IMPORT_ENCODING_UTF16` | `Save the file as CSV UTF-8` | `This file is saved as “Unicode Text”.` then the same three steps |
| `IMPORT_ENCODING_UNKNOWN` | `Save the file as CSV UTF-8` | `This file isn’t UTF-8 text.` then the same three steps |
| `IMPORT_DELIMITER` | `Separate the columns with commas` | `This file separates columns with {semicolons|tabs}.` then the same three steps |
| `IMPORT_LEGACY_XLS` | `Save the workbook as .xlsx` | `This is an Excel 97-2003 workbook (.xls). In Excel, choose File > Save As, choose “Excel Workbook (*.xlsx)”, then choose the new file.` |
| `IMPORT_MACRO_WORKBOOK` | `Save the workbook without macros` | `This workbook contains macros. In Excel, choose File > Save As and “Excel Workbook (*.xlsx)”, which removes them, then choose the copy.` |
| `IMPORT_ENCRYPTED_WORKBOOK` | `Remove the workbook’s password` | `This workbook is protected with a password, so it can’t be read. Open it in Excel, remove the password, save it, then choose it again.` |
| `IMPORT_FILE_TYPE` (browser or Strapi) | `Choose a CSV or Excel file` | `“{file name}” isn’t a CSV or Excel workbook (.xlsx).` |
| `IMPORT_FILE_TOO_LARGE` (browser or Strapi) | `This file is too large` | `“{file name}” is {size}. The limit is 5 MB. Split the rows into smaller files and import each.` |
| `IMPORT_TOO_MANY_ROWS` | `This file has too many rows` | `It has {n} rows. The limit is 5,000. Split the rows into smaller files and import each.` |
| `IMPORT_WORKBOOK_TOO_LARGE` | `This workbook is too large to open` | `Delete unused sheets and formatting, or save the rows as CSV UTF-8, then choose the file again.` |
| `IMPORT_NO_HEADER` | `Add a header row` | `The first row must hold the column names. Copy them from the template.` |
| `IMPORT_NO_ROWS` | `There are no rows to import` | `The file has column names but no rows below them.` |
| `IMPORT_DUPLICATE_HEADER` | `Two columns mean the same thing` | `“{header}” and “{header}” both match {label}. Delete one of them, then choose the file again.` |
| `IMPORT_MISSING_COLUMN` | `A required column is missing` | `Add {a column named {label}|columns named {label} and {label}} (they’re in the template), then choose the file again.` |

### S3. Templates, error reports and decisions

| Reason | Copy |
|---|---|
| Template download failure | `We couldn’t download the template.` with `Try again` |
| Preview record expired (error report or commit) | `This review has expired. Choose the file again to check it.` with `Choose file again` |
| Error report failure | `We couldn’t prepare the error report.` with `Try again` |
| `IMPORT_DECISION_MISSING` (commit) | `Choose Update or Skip for every row matched by similar name, then confirm again.` (returns to `Review rows` with the similar filter) |

### S4. Row issues added (cell `Issues` and row details)

| Case | Copy |
|---|---|
| `#CLEAR` on a required field | `{label} is required, so #CLEAR can’t empty it.` |
| A flag value not recognised | `{label} must be Yes or No. Y, N, TRUE and FALSE also work.` |
| A similar row (error report) | `Matches the existing name “{existing name}” except for capitals or spacing. Type the existing name exactly to update it.` |
| Every issue in the `Issues` cell | Prefixed `Row {original row number}:` and separated by `; ` |

---

## 7. Toasts

| Trigger | Tone | Title | Body | Action |
|---|---|---|---|---|
| Export saved | success | `Exported {file name}` | `{n} {row|rows}.` | none |
| Template saved | success | `Downloaded {file name}` | none | none |
| Error report saved | success | `Downloaded {file name}` | `{n} {row|rows} to correct.` | none |
| Bulk similar decision replaced choices | success | `Set {k} rows to {Update|Skip}` | none | `Undo` (X-14) |

Failures never toast here: they stay in the dialog or step that caused them (§2.6, §5).

---

## 8. Five-state contract

| Surface | Loading | Empty | Error | Permission | Populated states added |
|---|---|---|---|---|---|
| Export dialog | None (data from the page); spinner on `Export` only past 300ms of code load | §2.5 two empty lines | S1 in the dialog, choices kept | No control where gated (§1); S1 403/404 | Ready, over the limit, no column, pending, CSV table, reference-list hint |
| Report route | Skeleton card (§4.4) | Defensive `No risks…` | `We couldn’t load this report` · `Try again` | In-shell not-found | Every §4.3 part, AI note or none |
| Import: Guidance | Template `Downloading…` | — | S3 alert | Admin route gate (unchanged) | Two templates, value rules |
| Import: Select file | `Checking file…` | X-19 field | S2 alert with the file kept | unchanged | CSV, XLSX |
| Import: Review | unchanged | `No rows are ready to import` (unchanged) when nothing eligible and no similar rows | Preview expired (S3) | unchanged | Ignored columns, notes, six states, similar panel and decisions |
| Import: Results | unchanged | — | unchanged | unchanged | `Skipped by you`, error report |

---

## 9. The premium experience bar (G-4), item by item

| G-4 item | Phase 19 contract |
|---|---|
| Keyboard path for every primary action | `Export` → dialog (§2.6) → `Enter`; `Print report` → `Print or save as PDF`; import steps in DOM order; each similar decision is a radio group with arrows; the gate moves focus to the first undecided row; `Alt+T` reaches the Undo toast |
| Optimistic feedback with rollback | No server mutation is optimistic here: exports and downloads wait for their file, and imports keep their two-step commit (§5 Optimistic UI: irreversible writes wait). Bulk decisions apply instantly to the form with Undo |
| Skeletons while loading | The report route; the dialog needs none; spinners only inline in blocking submits |
| Undo and confirmations | Exports, prints and downloads change nothing, so no confirmation and no Undo (D-20). The import keeps its confirmation step (a write). Bulk decisions carry Undo |
| Empty states that say what to do next | §2.5 (narrow or clear filters); the import's `No rows are ready to import` with the error report beside it |
| No lost input | Dialog choices survive refusals and the pending state; the format is remembered; similar choices persist between steps and are guarded on a new file; a refused file stays chosen |
| Comfortable and compact density | The import review and results tables keep the DataTable density toggle; the column checklist is not dense data |
| Motion | The Motion section; reduced motion honoured |
| Purpose-built phone layouts | The dialog as a full-screen sheet with stacked full-width actions; decision radio groups in the import cards; the report card at 16px padding; header actions stacked |
| Every figure opens its records | The import summary figures select their rows (§5.5); the export count is the list's own total on the list itself |

---

## 10. Strings that change (supersedes Phase 10 §17.1 where named)

| Surface | Current (after Phase 10) | New |
|---|---|---|
| Admin header action | `Import CSV` | `Import` |
| Import title | `Import {plural} from CSV` | `Import {plural}` |
| Import description | `Review and validate every row before any records are created or updated.` | §5.1 |
| Guidance paragraph | Phase 10 §17.1 | §5.3 |
| Guidance actions | `Choose CSV file`, `Download CSV template` | `Choose file`, `Download Excel template`, `Download CSV template` |
| Select file help | `Choose one UTF-8 .csv file no larger than 5 MiB and 5,000 data rows.` | §5.4 hint |
| File input label | `CSV file` | `File to import` |
| Parse error prefix | `This file can’t be imported: {message}` | Retired: S2 titles and bodies |
| Review download | `Download error report CSV` | `Download error report` |
| Results actions | `Import another CSV`, `Download result report CSV` | `Import another file`, `Download error report` |
| Confirm checkbox | `I have reviewed the create and update rows.` | §5.7 |

---

## 11. Test assertions this contract changes

- **Web unit:** the dialog's states and copy per §2 (default columns per view, `Select all`, `Reset to visible`, none checked, empty, over the limit, pending, success toast with the server's name and count, refusal kept choices, CSV `Table`, remembered format with storage failure, focus start and return); the report's parts and headings per §4.3 and its `data-print` toolbar; the `importRow` family's sixth value (label, warning tone, `CaseSensitive`, never a severity icon); §5.5 to §5.8 (warnings, notes, decisions per row and bulk, the gate's count and focus, the new-file guard, Undo); families S1 to S4; the copy guard gains `components/csrm/export` and the report files, with no `Accept`.
- **E2E (D-39):** the download's `suggestedFilename()` equals §3.2's pattern; the import journey's deliberate changes are the §10 strings, the sixth tile and the X-19 field; the report under print emulation shows no shell or toolbar, and its Chromium A4 PDF has at least one page.
- **Conformance:** `design-contract.spec.ts` and `performance.spec.ts` stay green (the dialog and the import's decision components load lazily).

---

## Copywriting contract

| Element | Copy |
|---|---|
| Primary CTA | `Export file` (dialog); `Print or save as PDF` (report); `Choose file`, `Validate and preview`, `Continue to confirmation`, `Confirm import` (import) |
| Other calls to action | `Export`, `Print report`, `Back to the risk assessment`, `Select all`, `Reset to visible`, `Cancel`, `Download Excel template`, `Download CSV template`, `Download error report`, `Choose another file`, `Update all {k}`, `Skip all {k}`, `Show these rows`, `Keep reviewing`, `Import another file`, `Try again`, `Undo` |
| Headings and labels | `Export {page heading}`, `Format`, `Table`, `Columns`, `{k} of {n} columns`, `Excel workbook (.xlsx)`, `CSV (.csv)`, `Print report`, `Cyber security risk assessment`, the §4.3 section headings, `Import {plural}`, `How values are read`, `Matched by similar name`, `Decision for row {n}`, `Your choice: Update`, `Your choice: Skip`, `Skipped by you` |
| Empty state heading | `Nothing matches the current search and filters, so there’s nothing to export.`; `There are no {records} to export yet.` (lines in the dialog; the lists keep Phase 11's empty states) |
| Empty state body | The list's own filtered-empty state offers `Clear filters` (§4 Empty states); the dialog line points back to it |
| Error states | §6 S1 to S4, each saying what happened and what to do; `We couldn’t load this report` · `Try again` |
| Permission states | No control where the list or record is refused; S1's 403 and 404 copy |
| Toasts | §7, word for word |
| Destructive confirmation | None. Nothing in this phase deletes or overwrites without the import's existing confirmation step, which is unchanged in kind |

---

## Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| 1.3.1 Info and relationships | The dialog body is a `form`; `Format` and `Table` are named radio groups; `Columns` is a `fieldset` with a `legend`; the report uses h1 to h4 in order, `dl` for facts and a captioned `table` (`Risks overview`) with column headers |
| 1.4.1 Use of colour | The cap and refusal alerts, the similar badge and every validation line carry an icon and words |
| 2.1.1 Keyboard | §9, first row |
| 2.4.3 Focus order | Dialog focus starts on the checked format and returns to `Export`; refusals move focus to the alert title; the import gate moves focus to the first undecided row |
| 2.5.3 Label in name | `Export {page heading}`, `Decision for row {n}`, `Download error report`, each option label beginning with its visible text |
| 2.5.8 Target size | Checkboxes and radios at 24px with their labels as targets; touch-target height below 768px |
| 3.3.1, 3.3.3 Errors | `Choose at least one column.` and the gate line say what is wrong and how to fix it; S2 gives steps |
| 4.1.3 Status messages | `{d} of {k} decided` (polite); toasts (polite); the pending button's label change; a refusal alert is not a live region because focus moves to it |
| 1.4.10 Reflow | No horizontal page scroll from 320 to 1440; the dialog becomes a sheet; the report's overview table wraps cells and, below 640px on screen, scrolls inside a named region (§4 DataTable) |
| Automated | Zero serious or critical axe violations at 375 and 1440 on: a list with the dialog open (ready, over the limit, refusal), the released view's header, the report route, and the import's Select file refusal, Review with ignored columns and similar rows, and Results |

---

## Spacing

The §3.9 scale, unchanged. Uses:

| §3.9 step | Use |
|---|---|
| 8px | Label, hint and control in a dialog group; checklist rows and columns; between alert actions |
| 16px | Report card padding below 768px; between a similar row's details and its decision |
| 24px | Between dialog groups; between import warnings; between report blocks inside a section |
| 32px | Between report sections (§3.9 section rhythm) |
| 40px | Report card padding from 768px |

Exceptions: the print page margin of X-31 (millimetres, the paper's own unit), proposed there.

---

## Typography

The §3.10 scale, unchanged.

| Level | Token | Weight | Use |
|---|---|---|---|
| Page and report title | `--text-heading-lg` (Instrument Serif) | 400 | Route titles; the report's `Cyber security risk assessment` |
| Section heading | `--text-heading-md` | 600 | Report h2 |
| Panel title | `--text-heading-sm` | 600 | Dialog title, report h3 and the identifier line, alert titles |
| Body | `--text-body` | 400; 500 for labels | Scope sentence, report text, import lines |
| Caption | `--text-caption` | 400; 500 in badges | Hints, filters, counts, `Your choice`, Notes |
| Micro-label | `--text-micro` | 400 | `IdamBox CSRM` eyebrow; the report table header |

Weights 400, 500 and 600 only (ADR 0001 gap 8, as Phases 06.5 to 16). `tabular-nums` on every count.

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | Canvas; dialog, sheet, report card, print page |
| Secondary (30%) | `--color-bg-inset`, `--color-border-default`, `--color-border-strong`, `--color-text-secondary` | Skeleton base, hairlines, checkbox and radio boundaries, hints |
| Accent (10%): ink | `--color-primary`, `--color-text-link`, `--focus-ring` | Only as listed below |
| Status (§3.5) | warning (cap, file refusals, ignored columns, similar panel and badge); danger (unexpected failures, validation lines); success (toasts) | Always with an icon and words |
| Severity (§3.6) | `--color-risk-*` | `RiskRatingBadge` in the report, unchanged |
| Destructive | `--color-danger-solid` | None used |

Ink is reserved for: the primary pills `Export file`, `Print or save as PDF`, `Choose file`, `Validate and preview`, `Continue to confirmation`, `Confirm import` and the admin `Create {singular}`; the checked `Format` segment, checked checkboxes and radios; record links; focus rings. `Export`, `Print report`, `Cancel`, the downloads, `Choose another file` and the bulk decisions are outline; `Select all`, `Reset to visible` and `Show these rows` are ghost. No new hue.

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| Dialog | §5 "Dialog / toast" |
| Phone sheet | §5 "Drawer / side panel"; fade only under reduced motion |
| Toasts | §5 "Dialog / toast" |
| Checkbox, radio, segment | §5 control state (80ms) |
| Rows changing filter, choices applied | None: in place (§6 do-not 8) |
| Inline spinners; skeleton shimmer | Static under reduced motion |
| Print | No motion |

---

## Proposed CSRM extensions

For the orchestrator to accept and a Phase 19 plan task to record in `docs/design/csrm-design-direction.md` before the implementing tasks run. Numbering continues after Phase 16's X-29. X-30 and X-32 introduce no value; X-31 introduces the A4 page box and its margin.

| # | Where | Proposal | Exact wording to record | Rationale |
|---|---|---|---|---|
| X-30 | §4 Dialogs, new "Export" entry after "Record history" | The Export action, dialog, column choice and download confirmation | "**Export (CSRM extension, 2026-10-01).** A list or record that can leave CSRM as a file offers `Export`, an outline pill with a 16px `Download` icon, last among its page header's actions and never disabled there. It opens an export dialog at the form size (640px); below 768px it is a full-screen sheet with a visible title row and a `Close` control, as the side sheet's phone form is. Its title is `Export {page heading}`. In order it holds: a `--text-body` sentence stating how many rows the file will hold, with `tabular-nums`, that every page is included, and the active search and filters in `--text-caption` using the filter chips' labels, joined by the middle dot; a `Format` segmented control, `Excel workbook (.xlsx)` first and the default, then `CSV (.csv)`, with a `--text-caption` hint for the checked format; for a file of several tables, a `Table` radio group shown only for CSV; then a column choice, or for fixed tables a line saying every column is included. A column choice is a fieldset with the legend `Columns`, the count `{k} of {n} columns`, a `Select all` ghost small pill hidden when all are checked and a `Reset to visible` ghost small pill shown only while the choice differs from the visible columns, over checkboxes labelled with each column's on-screen header in the view's column order, one column below 640px and two from 640px, 8px apart; it opens with the visible columns checked, and with none checked it says `Choose at least one column.` as a field error. When nothing matches, or the rows exceed the export limit, a line or a warning alert says so and how to fix it, and the submit is disabled and described by it. The submit is the primary pill `Export file`, pending as `Exporting…` with the inline spinner while every choice stays in place. On success the dialog closes, the browser saves the file under the server's name, focus returns to `Export`, and a success toast reads `Exported {file name}` with the row count. A refusal shows in the dialog above its actions, says what happened and how to fix it, and keeps every choice. An export changes nothing, so it asks for no confirmation and offers no Undo. Focus starts on the checked format; `Enter` exports and `Escape` closes. A template or other file a person downloads confirms with the success toast `Downloaded {file name}`." | D-20 requires the pattern; one wording serves every list, the released record, Phase 18's risk table and Phase 20's and 22's exports, and fixes the column-choice primitive Phase 18 adopts (D-06) |
| X-31 | §4 Print, new "Print report" paragraph after "Print refinements" | The A4 report page and its document layout | "**Print report (CSRM extension, 2026-10-01).** A record that prints as a document has its own report page, opened by a `Print report` outline pill link with a 16px `Printer` icon placed before its `Export`. The page header is its screen-only toolbar: the record identifier as eyebrow, the title `Print report`, a description, a primary `Print or save as PDF` pill with `Printer` and a `Back to {record}` outline pill link with `ArrowLeft`; it never prints. On screen the document is one `--color-bg-surface` card with a 1px `--color-border-default` edge and `--radius-lg`, 40px padding from 768px and 16px below, at most `--spacing-container-max` wide. In print it is the page: `@page { size: A4 portrait; margin: 16mm }`, with no card edge, padding or shadow, and, where the browser supports page-margin boxes, `Page {n} of {m}` in the bottom-right margin box in `--text-caption` and `--color-text-secondary`, with `tabular-nums`; browsers without margin boxes print no number. The document opens with a header block: an `--text-micro` product eyebrow, the document title in `--text-heading-lg`, the record's identifiers joined by the middle dot in `--text-heading-sm`, then its key facts as a definition list and its overall rating badge, closed by a 1px `--color-border-default` rule. Sections are h2 in `--text-heading-md`, 32px apart; an overview table precedes the per-item detail, and the detail section starts on a new page. Each item avoids breaking inside where it fits on one page, table headers repeat, nothing is clamped, and badges keep their icon and text. The last section, `Notes`, states what the document is and when it was generated, with the time zone named, because the paper leaves the system." | D-23 and D-24 ask this contract to fix A4, margins, the header and page numbering; 16mm keeps a 13px table legible at about 680px of width; numbering only where `@page` margin boxes are supported (Chromium 131 onwards, research Pattern 10) |
| X-32 | §4 Status & risk badges, after "CSV import rows" | The sixth import row state and its decision | "**Matched by similar name (CSRM extension, 2026-10-01; extends CSV import rows).** An import row whose name equals an existing record's only when capitals, spacing and character width are ignored is a sixth import row state, `Matched by similar name`, in the one shared mapping: warning tone, because it waits on the Security Analyst, with the `CaseSensitive` icon, never a severity shape. The row names the existing record and asks for a decision in a radio group named `Decision for row {n}`, with nothing chosen: `Update “{existing name}”`, which uses the row's other values and keeps the existing name, and `Skip this row`, which leaves the record as it is; creating a record is never offered. The chosen decision follows the badge as `Your choice: Update` or `Your choice: Skip` in `--text-caption`. While any similar row exists, a warning alert above the rows counts them and `{d} of {k} decided` (a polite live region), and offers `Update all {k}` and `Skip all {k}` as outline small pills and `Show these rows`; a bulk choice that replaces individual choices confirms with an Undo toast. Continuing with an undecided row is refused beside the action with the number left, and focus moves to the first one. Choices last while the person moves between review and confirmation, and choosing another file warns before clearing them. In results, a skipped row keeps the badge with `Skipped by your choice.`" | D-30 makes the row state published vocabulary and asks this contract to propose it; the decision pattern is new to the direction |

---

## Decisions recorded

Made without asking (auto mode), following the locked context, `AGENTS.md`, the glossary and the direction.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | `Export` is the last header action in DOM order; admin `Import CSV` becomes `Import`. | Primary actions keep their place; the import now takes XLSX too. |
| UI-D2 | The released views put `Print report` before `Export`. | Printing is the Requestor's commoner need (decision 12); both stay one tab stop apart. |
| UI-D3 | `Export` is never disabled in the header; the dialog explains empty and over-limit lists and disables `Export file`. | A disabled header button hides its reason from keyboard and screen-reader users. D-20's "Export is disabled" is honoured at the dialog's submit. |
| UI-D4 | The dialog title is `Export {page heading}` and the submit `Export file`. | Verb-first, distinct from the header's `Export`, and names the page per Phase 11 UI-D1. |
| UI-D5 | Reports and the released assessment have no column choice; the dialog says every column is included. | Their tables are fixed record content (D-21, D-22); a partial released record would misrepresent it. The planner omits `columns` for these operations. |
| UI-D6 | The last format is remembered per person; columns are not. | Planner's discretion item, settled: format is a stable preference; the visible-column default is the contract (D-06). |
| UI-D7 | No file-name preview in the dialog; the toast names the saved file. | The server's name is authoritative (D-10); a client copy of the slug table could drift at midnight or across zones. |
| UI-D8 | The toast's row count is the server's. | Research open question 3 recommends the `X-CSRM-Row-Count` header; the UI needs only "the server's count". |
| UI-D9 | CSV dates are ISO `YYYY-MM-DD`; XLSX dates are typed with `d mmm yyyy`. | Confirms research A7: ISO is unambiguous on re-import and in any tool. |
| UI-D10 | Closing the dialog while exporting discards the result. | Dialogs close on `Escape` (§4 Dialogs); saving a file after the person left would surprise them. |
| UI-D11 | The report page is in the shell on screen, with its header as a hidden-in-print toolbar, and the document as one card. | D-23's screen-only toolbar; Playwright asserts the shell absent in print through the shipped print block. |
| UI-D12 | `Risks in detail` starts on a new page; page numbers only, no running header. | A clean break between overview and detail; dynamic margin-box text would need injected CSS strings. |
| UI-D13 | The error report is offered at Review for Rejected, Ambiguous and similar rows, and at Results for any row not imported except the person's own skips. | D-32: the server's preview does not know choices before commit; a similar row in the report carries a fix-it issue (S4). |
| UI-D14 | Similar decisions are radio groups with nothing preselected. | D-30 requires an explicit choice; a preselected option would be a silent default. |
| UI-D15 | Choosing another file after decisions warns first. | No lost input (G-4). |
| UI-D16 | The similar badge uses `CaseSensitive` in warning tone. | Not used by any status or severity; warning matches `Rejected` and `Ambiguous` (§4 CSV import rows). |
| UI-D17 | File refusals are warning alerts with numbered steps, never danger. | The person corrects the file, as with rejected rows (§4 CSV import rows). |
| UI-D18 | Ignored columns warn; recognised non-imported columns (`Issues`, export read-only columns, the example row) are neutral notes. | D-27's warning-versus-note split. |
| UI-D19 | The import summary figures select their row filter. | G-4 "every figure opens its records", within the page. |
| UI-D20 | Template downloads offer both formats as two buttons. | D-31; XLSX first because of `0042` (D-33). |
| UI-D21 | Size limits read `5 MB` (X-23), replacing `5 MiB`. | One unit rule for files across the product. |
| UI-D22 | The report's generation note names its IANA zone. | Paper leaves the system (D-09's provenance reasoning). |
| UI-D23 | Extensions are X-30 to X-32. | They continue Phase 16's X-29 (the spawn prompt). |
| UI-D24 | Phase 19's refusals are family S (S1 to S4). | Families A to R are taken (Phases 10 to 16). |

---

## Notes carried

- **For the orchestrator to settle.**
  - UI-D3 reads D-20's "Export is disabled" as the dialog's submit, not the header button. Confirm.
  - UI-D5: reports and the released assessment take no `columns` parameter. Confirm against D-03's list-export parameter family.
- **For the planner.**
  - The web needs each view's column vocabulary (key, on-screen label, visible by default) before the dialog opens: a parity-tested copy beside the server's, as `report-copy.json` is, or a read; the dialog does not load it on open.
  - The released export's `{r}` and `{c}` counts come from the released read the page already holds.
  - `IMPORT_DECISION_MISSING` and the S2 codes are recommended names.
- **Shared-file changes needed.**
  - `docs/design/csrm-design-direction.md` records X-30 to X-32, by a Phase 19 plan task.
  - The root `CONTEXT.md` glossary could add "Matched by similar name (import row)". Optional.

---

## UI Considerations

Written inline from the contract; the ui-phase probe replaces these rows when it runs.

Applicable state considerations resolved: 22 covered, 3 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution |
|---|---|---|---|
| empty | Export of an empty list | covered | §2.5 lines; `Export file` disabled and described |
| empty | Report with no risks | covered | Defensive line (§4.4) |
| empty | Import with nothing eligible | covered | Existing alert plus the error report |
| loading | Dialog | covered | Data from the page; spinner on `Export` only past 300ms |
| loading | Report route | covered | Skeleton mirroring the document (§4.4) |
| loading | Exports and downloads | covered | Inline pending labels |
| error | Export refusals | covered | S1 in the dialog, choices kept |
| error | File refusals | covered | S2 with fix-it steps, file kept |
| error | Templates, error reports, expiry, missing decisions | covered | S3 |
| permission | Gated lists and unreadable assessments | covered | No control; S1 403/404 if reached |
| permission | Analyst before release | covered | No `Export` or `Print report`; S1 409 |
| populated | Every surface | covered | §1 to §5 |
| partial | Similar rows partly decided | covered | `{d} of {k} decided`, the gate line and focus |
| partial | Released assessment without AI | covered | No AI line in About or Notes |
| partial | Unknown viewer zone | covered | About sheet and report note say UTC |
| overflow | Over 10,000 rows | covered | Warning before the request; server refusal |
| overflow | Many columns (register detail fields) | covered | Two-column checklist, dialog body scrolls |
| overflow | Long statements in print | covered | Never clamped; tables wrap (§4 Print refinements) |
| overflow | Many ignored columns | covered | Listed in one wrapping sentence |
| zero-one-many | Counts | covered | `{row|rows}`, `{risk|risks}`, `{choice|choices}`, one-page wording (§2.2) |
| zero-one-many | Missing columns | covered | One or several named (S2) |
| zero-one-many | Report tables in CSV | covered | `Table` group only with several tables |
| long-text | Filter line with many filters at 375px | backstop | `{ statement: "At 375px an export dialog with five active filters and a long search term wraps its filter and search lines without horizontal scroll and keeps Export file visible after scrolling", verification: backstop }` |
| long-text | Existing names in decision labels | backstop | `{ statement: "A similar row whose existing name is 200 characters wraps its Update label at 375px and 1440px, and the radio stays aligned with the first line", verification: backstop }` |
| overflow | Report overview table on A4 | backstop | `{ statement: "A released assessment with 25 risks prints its overview on A4 portrait with repeated headers, no clipped column and Risks in detail starting on a new page", verification: backstop }` |

---

## Registry safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| shadcn official (local source-owned components) | None new: `Dialog`, `Sheet`, `Checkbox`, `RadioGroup`, `Label`, `Alert`, `Button`, `Table`, `Skeleton`, `sonner` `Toaster` | Not required: no block added and no registry fetched (2026-10-01) |
| Third-party | none | Not applicable |

No new web dependency.

---

## Verification contract

- **Unit and component (Vitest):** §11's web unit list; the label parity test (D-07) and the column vocabulary parity test (Notes carried).
- **Contract parity:** the file-response mode for every export, template and error-report operation (D-02, D-19).
- **E2E** (dev servers stopped; 1440 and 375): D-39's journeys with §11's assertions and the Accessibility contract's axe scope. The run leaves the tree clean.
- **Browser backstops** (orchestrator): the three UI Considerations backstops; a keyboard-only export and similar-row decision; NVDA announcing `{d} of {k} decided` and the dialog's disabled-submit reason; the manual Excel checks (the mark survives save-and-reopen, the Windows-1252 message matches Excel's menu wording) where Excel exists.

---

## Checker sign-off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS
- [ ] Dimension 7 Inventory Provenance: PASS

**Approval:** pending

---

## Review amendment R1 (2026-10-17)

Phase 19's code review (lane 4, `19-REVIEW-lane-4.md`) found copy in the code that this contract does not hold, fallbacks that may say something untrue, and two sentences that read wrongly for some views. This amendment proposes each for the pilot. **No proposed string is in the code.** The code keeps today's strings until the pilot approves; then the web fixer implements the approved rows, each with its test. The one exception is part 5's toast, which uses only approved copy: the review's fix already shows it, and the pilot is asked to confirm or decline it.

The review's code fixes that used only approved copy are already in the code, and are listed in part 6, so the pilot can see where approved strings now appear. Part 5 asks for one exception to §7, with no new string.

### 1. Strings in the code that this contract lacks (FE4-06)

Each is proposed **kept as written**, except the dialog's visually hidden description, which is proposed per view. On approval, each row joins §10 (or §2, §4 and §5 where it belongs).

| # | Where | String | Proposal |
|---|---|---|---|
| 1 | `administration-actions.ts` (no file in the upload) | `Choose one CSV or Excel file, up to 5 MB.` | Keep as written |
| 2 | `administration-actions.ts` (a preview that failed with no S2 reason; replaces Phase 10's 413 and parse copy) | `We couldn’t check this file. Choose it again to retry.` | Keep as written |
| 3 | `administration-actions.ts` (the commit's file differs from the reviewed one) | `The reviewed file no longer matches this import. Select the file again.` | Keep as written |
| 4 | `administration-actions.ts` (a 409 at the commit) | `The selected file no longer matches the reviewed preview.` | Keep as written |
| 5 | `csv-import-flow.tsx` (a refusal without a message of its own) | `We couldn’t import this file. Review the file and try again.` | Keep as written |
| 6 | `csv-import-flow.tsx` (`Validate and preview` with no file chosen) | `Choose one file to check.` | Keep as written |
| 7 | `csv-import-flow.tsx` (the preview could not be checked) | `We couldn’t check this file. Choose a different file.` | Keep as written |
| 8 | `csv-import-flow.tsx` | `The selected file is unavailable.` | None: the review removed it as dead code (FE4-11). It was never shown. |
| 9 | `export-dialog.tsx`, the dialog's visually hidden description, for a list view (with a column choice) | `Choose the file’s format and columns, then export the file.` | Keep as written, for list views only |
| 10 | `export-dialog.tsx`, the same description, for a fixed-table view (a report or a released assessment: no column choice, and a `Table` choice for CSV) | `Choose the file’s format and columns, then export the file.` (wrong here: these views have no columns to choose) | `Choose the file’s format and, for a CSV, its table, then export the file.` |
| 11 | `assessment-report.tsx`, the Risks overview's scroll region name | `Risks overview, scrolls horizontally` | Keep as written |
| 12 | `assessment-report.tsx`, the report skeleton's status name and its visually hidden text | `Loading report` and `Loading report…` | Keep as written |
| 13 | Both report routes, the document title | `Print report {assessment number} \| IdamBox CSRM`, or `Print report \| IdamBox CSRM` before the read resolves | Keep as written |

The review's suggested guard (`interface-copy-guard.test.ts` failing on any export, report or import literal outside an allow-list drawn from this contract) is proposed to follow once these rows are approved, so the allow-list has one source.

### 2. Fallbacks when the server omits a detail (execution item (a))

19-02 wrote a fallback for each S1 and S2 row whose detail the transport may drop. The review lists nine. The pilot is asked to approve these as S1 and S2 rows. Where a detail is absent, the bracketed form is shown. Every string keeps §6's voice rules.

**§6 S1, an added row:**

| Reason | Copy | Kind |
|---|---|---|
| `EXPORT_ROW_LIMIT`, when the server sends no count | `This export would hold more rows than the 10,000 limit. Narrow the search or filters, then export again.` | warning (no `Try again`) |

For now, the code shows §2.5's approved title, `Too many rows to export`, as this warning's message, with no `Try again` (FE4-07, already fixed). This row would replace it.

**§6 S2, amended and added rows:**

| Reason | Title | Body |
|---|---|---|
| `IMPORT_FILE_TYPE`, `IMPORT_FILE_TOO_LARGE` | as now | `“{file name}”` reads `This file` when the file has no name. |
| `IMPORT_TOO_MANY_ROWS` | as now | `It has {n} rows. The limit is 5,000.` [without a count: `It has more than 5,000 rows.`] `Split the rows into smaller files and import each.` |
| `IMPORT_DELIMITER` | as now | `This file separates columns with {semicolons\|tabs}.` [without the separator: `This file doesn’t separate its columns with commas.`] then the same three steps |
| `IMPORT_DUPLICATE_HEADER` | as now | `“{header}” and “{header}” both match {label}.` [without them: `Two of the column names match the same column.`] `Delete one of them, then choose the file again.` |
| `IMPORT_MISSING_COLUMN` | as now | `Add {a column named {label}\|columns named {label} and {label}\|columns named {label}, {label} and {label}} (they’re in the template), then choose the file again.` [without labels: `Add the required columns (they’re in the template), then choose the file again.`] The third form writes out three or more labels (the contract allows up to 20). |

- **The `IMPORT_DELIMITER` rewrite.** Today, when the separator is absent, the code says `This file separates columns with semicolons.` That is untrue for a tab-separated file, and for any other separator. The proposed sentence, `This file doesn’t separate its columns with commas.`, is true for every separator, and it leads straight into the title's fix. Until the pilot approves it, the code keeps today's default.
- **`IMPORT_FILE_TOO_LARGE` always names its size,** because the browser always knows it. The `“{file name}” is larger than 5 MB.` form is retired. The code now requires the size (FE4-07, already fixed), so S2's own sentence is the only one shown.

**§6 S2, the `IMPORT_CSV_MALFORMED` row: already approved, and recorded here so the contract has one source.**

| Reason | Title | Body |
|---|---|---|
| `IMPORT_CSV_MALFORMED` (422) | `Fix the CSV file` | `Line {line} can’t be read. A quote may be missing, or the row has a different number of columns from the header.` [without a line: `A row can’t be read. A quote may be missing, or a row has a different number of columns from the header.`] Steps: `Open the file in Excel, check that row, then:` and the three `CSV UTF-8` steps |

The pilot approved this copy, with and without `line`, on 2026-10-17 (G-6), in the import record's execution amendment: `docs/contract-gaps/phase-19-import-tolerance.md`, the "Proposed fix-it copy" (lines 228-231 as the review cites them) and the approval line ("the fix-it copy, approved as written"). S2 above lists only the 15 reasons that came before it. **No pilot decision is needed for this row.** It is recorded here only so S2 is complete.

### 3. S1's 403 and 404 sentences per view (FE4-09)

Today, S1's 403 says `…export this list.` on every view, including a report and a released assessment. Its 404 says `We couldn’t find this risk assessment…` on every view, although S1 scopes that row to the released assessment. The proposal:

| View | 403 | 404 |
|---|---|---|
| A list (the registers, queues, reference lists and alerts) | `You don’t have access to export this list.` (as now) | S1's last row, `We couldn’t create the file.` with `Try again` |
| A report (`/app/reports/{report}`) | `You don’t have access to export this report.` | S1's last row, `We couldn’t create the file.` with `Try again` |
| The released assessment | `You don’t have access to export this risk assessment.` | `We couldn’t find this risk assessment. It may no longer be available to you.` (as now) |

On approval, `exportRefusal` takes the view's kind, which the dialog already knows.

### 4. A paper-neutral AI notice (FE4-16)

The report's `Notes` carry Phase 12 §10.1's sentence, which is addressed to the Requestor: `AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before releasing it to you.` On the analyst's route, `/app/review/assessments/{id}/report`, it addresses the analyst, who is often the person who released it. Phase 12 IN-302 removed that sentence from the analyst's screen for this reason. On paper, the sentence speaks to whoever later reads the page, which is defensible. But a printed report can reach people who are not the Requestor.

The proposal: on the analyst route's paper, the notice reads `AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before it was released.`

The pilot may also choose this sentence for every printed report, so that one assessment always prints the same notice, whichever route printed it. Until the pilot decides, every paper carries §10.1's sentence whenever AI assisted. That now includes an analyst printing their own request's assessment from the My route (FE4-01, already fixed).

### 5. A dialog whose code cannot load (FE4-12): an exception to §7, for the pilot

The review found that the export dialog loaded through next/dynamic. If its code failed to load (a flaky network, or a deploy that replaced the page's chunks), the failure went to the route's error boundary, which replaced the whole list. The fix keeps the failure with the button. The page stays as it was, the button stops its spinner and keeps focus, and S1's last row, `We couldn’t create the file.` with `Try again`, says so in a danger toast. The danger toast stays until it is dismissed. Its `Try again` loads the code again.

That toast departs from §7, which says “Failures never toast here: they stay in the dialog or step that caused them”. The dialog cannot hold this failure, because it never loaded. The proposal: §7 gains one exception, **a dialog whose code can't load**, shown as a danger toast with S1's last row and `Try again`. No string is new. If the pilot declines, the button contains the failure and says nothing: it stops its spinner and keeps focus, and pressing `Export` tries again.

### 6. Approved strings in new places (for the pilot's information; no decision asked)

The review's other fixes added no string. Three of them show an approved string, or text already on screen, in a new place:

- **FE4-04:** while a `Try again` in the export dialog runs, it reads §2.6's `Exporting…` with the inline spinner, and it keeps focus.
- **FE4-05:** a summary tile's figure above zero is a button that selects its state's rows. Its accessible name is the figure, then the tile's visible label, for example `2 Rejected`.
- **FE4-07:** a row limit without its count reads §2.5's title, `Too many rows to export`, as a warning with no `Try again`. Part 2 proposes the sentence that replaces it.

Review amendment R1 status: **approved by the pilot on 2026-10-17**.

The pilot's decisions (2026-10-17):

1. **Part 1:** rows 1 to 7 and 9 to 13 are approved as proposed, row 10 in its fixed-table form. Row 8 stays removed. The copy guard follows in this review, not later: `interface-copy-guard.test.ts` fails on any export, report or import literal outside an allow-list drawn from this contract.
2. **Part 2:** every fallback is approved, including the `IMPORT_DELIMITER` rewrite (`This file doesn’t separate its columns with commas.`) and the retirement of `“{file name}” is larger than 5 MB.`. Recording `IMPORT_CSV_MALFORMED` here is noted.
3. **Part 3:** the per-view 403 and 404 sentences are approved as tabled.
4. **Part 4:** the paper-neutral notice, `AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before it was released.`, is approved for **every printed report**, whichever route prints it. One assessment always prints the same notice, and paper that reaches people other than the Requestor never addresses "you". The on-screen sentence (§10.1) and IN-302 are unchanged. The notice stays advisory disclosure: it never implies the AI released anything.
5. **Part 5:** the exception to §7 is approved. A dialog whose code can't load shows S1's last row, `We couldn’t create the file.` with `Try again`, in a danger toast. The dialog can't hold a failure it never loaded, and a silent button would hide one.
6. **Part 6:** noted.

## Review amendment R2 (2026-10-17, the pilot): import-flow strings no contract wrote

The copy guard (`dee88182`) found 21 literals in shipping import-flow code that no UI-SPEC writes, and listed them in its `awaitingThePilot` list. The pilot rules on each one here. On implementation, the guard's allow-list reads this section, and its `awaitingThePilot` list becomes empty.

**Approved as written** (each joins §10, and keeps §6's voice rules and typographic quotes):

- `Import {} | IdamBox CSRM` (the import page title)
- `Correct the listed issues in your file, then choose the updated file.` (replaces 06-UI-SPEC's "your CSV": the import takes CSV and Excel)
- `Importing file` (the progress bar's name)
- `No existing match found.`, `No changes.`, `View record`, `Skipped without changes.`
- `Import progress`, `Import outcome unknown`, `Import needs attention`
- `{} import preview`, `Previous rows`, `Next rows`, `Result status`
- `Import results are ready.`, `{} import results`, `Final result`

**Reworded,** because the import now takes `.xlsx` files as well as CSV (the import-tolerance record), so CSV-only wording is untrue for a workbook, or because the old wording doesn't say what it means:

| In the code | Approved wording | Why |
| --- | --- | --- |
| `{} CSV columns` | `{} columns in the file` | True for CSV and Excel |
| `CSV row` | `File row` | The row number in the uploaded file, whatever its format |
| `Future step` | `Not started` | A step indicator's state, read by assistive technology. "Future step" names no state. |

The S1 `EXPORT_CELL_TOO_LONG` row keeps the typographic apostrophe (`Excel’s`), per §6. The record's straight apostrophe is a typing difference, not a wording one.

Review amendment R2 status: **approved by the pilot on 2026-10-17**.
