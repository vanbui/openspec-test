---
phase: "21"
slug: "management-dashboards-and-metrics"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-10-01"
reviewed_at: "2026-10-01"
---

# Phase 21 — UI Design Contract

> Visual and interaction contract for management dashboards and metrics (DASH-04, DASH-05; closes UAT-059). It covers:
> - the leadership view at the top of the Reports index, and its print (D-19);
> - three new report pages, `Risk trend`, `Cycle times` and `AI assistance`, their drill-down pages, and additions to the four existing reports (D-03, D-09 to D-16, D-20 to D-23, D-26);
> - the register's `Heat map` display and position filters, the review queue's `In stage` column and filters (D-12, D-15);
> - the analyst Home additions and the Requestor's time with the Security Analyst (D-17, D-18).
>
> It adds no colour, type size, weight, family, radius, shadow or duration. Six patterns are proposed as CSRM extensions X-68 to X-73. Refusal copy is family Z. Every surface is read-only: nothing here needs a confirmation or an Undo (D-27).

---

## Binding inputs and value authority

- **Locked decisions:** D-01 to D-29 in `21-CONTEXT.md`. No RESEARCH exists yet. Routes, query keys, reason codes, caps and the slowest-N follow CONTEXT D-03's proposals. Research and the planner fix them (Planner's Discretion).
- **Value authority:** `docs/design/csrm-design-direction.md` (ADR 0001) only, cited by section (§). Nothing here restates a value.
- **Direction entries reused:** §3.6 (severity), §3.14 (chart tokens and chart geometry), §4 Cards / KPI tiles (including the delta and the 32px sparkline), DataTable, Record links, Skeletons, Empty states, Print, §5, §6.
- **Extensions reused:** X-3 (dates and instants), X-4 (separators), X-9 (segmented control), X-10 (figure links), X-12 (block links), X-27 (withdrawn records), X-30 (export), X-31 (print report page and `@page`), X-57 (matrix picker axes and cell naming), X-59 (saved views), X-63 (`Closed`, review values).
- **Earlier contracts, cited by section and never restated:**
  - **Phase 7:** §4.1 to §4.6 (Reports index, report frame, section anatomy, period control, layout), §5.1 and §5.2 (`KpiTile`, `BarChart`), §6 (five states, partial failure, permission on direct URLs, the E2E harness), §7.4 and §7.5 (report and state copy).
  - **Phase 11:** "Voice, formats and shared copy rules"; §5.2 to §5.4 (Homes); §7.1 and §7.3 (Requests queue, My requests); §8 (figure links and inventory); §9.1 to §9.5 (exposure scope, register filters); §12 (five-state format).
  - **Phase 12:** §2.2 (`Run` group and its outcome wording).
  - **Phase 13:** §2.2 (shared queue controls, `Assigned to: Me`, `All open`), §3 (analyst Home).
  - **Phase 18:** §2.2 (register toolbar), §4.1 and §4.3 (matrix axes, how ratings read, `Not on the scale`), §5.1 to §5.3 (filters, views, columns), §11 (phone filter sheet).
  - **Phase 19:** §1 and §2 (report export).
  - **Phase 20:** §6 (register views and filters, `Accepted risks`, `Decision review`), §9.3 (analyst Home), §10 (report filter row), and Orchestrator amendment 2 (report tables become card lists below 768px).

### Decision coverage

| Decisions | Where |
|---|---|
| D-06, D-08 | §1 (stage values, `Not recorded`), §2.3 (history lines) |
| D-09 to D-12 | §4.2 (cycle times), §5.2 (episode drill-down), §7 (queue), §8 (Home ageing) |
| D-13, D-14 | §2.1 (trend), §4.1 (risk trend), §5.1 (point drill-down) |
| D-15, D-16 | §2.2 (risk matrix), §3 (leadership), §4.4 (exposure), §6 (register) |
| D-17 | §9 (Requestor) |
| D-18 | §8 (analyst Home) |
| D-19 | §3 (leadership view, print) |
| D-20 | §4.4 (existing reports) |
| D-21 to D-23 | §1 (run outcomes), §4.3 (AI assistance), §5.3 (runs drill-down), §8 |
| D-25 | §12 (permission), family Z |
| D-26 | §2.3, §2.4, §10 (figure links and scope strings) |
| D-27 | everything; §12 (G-4) |
| D-28 | §13 (test assertions) |

---

## Design System

| Property | Value |
|---|---|
| Tool | shadcn (source-owned, unchanged) |
| Preset | new-york / neutral / CSS variables / lucide |
| Component library | radix (`radix-ui`) |
| Icon library | `lucide-react` 1.30.0 |
| Font | §3.10 families, unchanged |

Every icon named here was confirmed in the installed `lucide-react` 1.30.0 on 2026-10-01 (`node -e` over its exports in `apps/csrm`): `Inbox`, `ClipboardList`, `PenLine`, `MessageSquareReply`, `Repeat2`, `Stamp`, `Undo2`, `CircleCheck`, `ServerCrash`, `Unplug`, `RotateCw`, `ArrowUp`, `ArrowDown`, `Equal`, `Printer`, `ArrowLeft`, `Table2`, `Grid3x3`, `Timer`, `CalendarClock`, `ChevronRight`, `CircleSlash`.

**New dependencies:** none. Charts reuse `BarChart` and the matrix is a native table (D-16, decision 13).

---

## Component Inventory

### Source-owned shadcn/ui components

Enumerated by `ls apps/csrm/src/components/ui/*.tsx | grep -v '\.test\.tsx$' | wc -l` — 30 components — radix-ui@1.6.7 (shadcn/ui new-york, source-owned; version from `node -p "require('radix-ui/package.json').version"` in `apps/csrm`) — 2026-10-01.

Non-exhaustive: known-good components this phase uses, never a closed allowlist.

| Component | Phase 21 use |
|---|---|
| `Card`, `Table`, `Skeleton`, `Badge`, `Button`, `Separator`, `Breadcrumb` | Sections, matrices, tables, states, drill-down frames |
| `Select`, `Pagination` | Queue and register filters, drill-down lists |
| `Sheet` | The phone filter sheet (18 §11) |

### CSRM shared primitives

Enumerated by `ls apps/csrm/src/components/csrm/*.tsx apps/csrm/src/components/csrm/*.ts | grep -v '\.test\.' | wc -l` — 15 modules — @csrm/web@0.1.0 (source-owned) — 2026-10-01.

Non-exhaustive.

| Primitive | Phase 21 use |
|---|---|
| `BarChart` | Trend panels (column form, §2.1), stage-time bars, runs per month, proposal outcomes |
| `KpiTile` | Summary strips, the trend's phone tiles (gains the direction's delta and sparkline, §2.1) |
| `DataTable`, `HorizontalScrollRegion`, `RecordLink`, `StatusBadge`, `RiskRatingBadge`, `SegmentedControl`, `PageHeader` | Drill-downs, queue, tables, stage and outcome badges, `Show` and `Show as` controls |
| Earlier phases' planned modules: 18's views menu and filters, 19's export dialog, 20's register views | as those phases plan them |
| **New** (recommended): `components/csrm/risk-trend-chart.tsx` (§2.1), `components/csrm/risk-matrix.tsx` (§2.2), `features/reports/leadership-view.tsx`, `features/reports/{risk-trend,cycle-times,ai-assistance}-report.tsx`, `features/reports/report-drill-down.tsx`, `features/reports/queue-ageing.tsx`, and zod-free `features/reports/metrics-format.ts` (durations, rates, bands) | Planner's choice |

---

## Voice, formats and shared copy rules

Phase 11's and Phase 20's rules apply unchanged. In addition:

- **Terms:** `Leadership view`, `Risk trend`, `Cycle times`, `AI assistance`, `Risk matrix`, `Stage`, `In stage`, `Time to release`, `Median`, `90th percentile`, `Episodes`, `Queue ageing`, `Working days`, `Not recorded`, `Not on the scale`, `Failed`, `Interrupted`, `Completed on retry`. Never `SLA`, `KPI` or `heat map` in visible copy, except the register's `Heat map` option.
- **Durations** (one formatter in `metrics-format.ts`, never computed in JSX): statistics `{d} days` to one decimal (`24.0 days`; table cells show the number under a `(days)` header); queue time `{n} working {day|days}`; the Requestor's time `{n} {day|days}`, whole days.
- **Rates:** `{p}%` to one decimal (`4.2%`).
- **Months:** X-3 calendar forms: table cells `Sept 2026`, descriptions `September 2026`; the partial month `{Month Year} (to date)` (07 §4.4).
- **Counts:** `tabular-nums` and written plurals.

---

## 1. Values in the one status mapping (D-06, D-21; X-70)

**Stages** (G-13: one mapping, Phase 19's label vocabulary and its parity test):

| Stage key | Label | Tone | Icon | Held by (caption where shown) |
|---|---|---|---|---|
| `intake` | `Intake` | warning | `Inbox` | `With the Security Analyst` |
| `questionnaire` | `Questionnaire` | info | `ClipboardList` | `With the Requestor` |
| `drafting` | `Drafting` | warning | `PenLine` | `With the Security Analyst` |
| `response` | `Response round` | info | `MessageSquareReply` | `With the Requestor and risk owners` |
| `rework` | `Rework` | warning | `Repeat2` | `With the Security Analyst` |
| `acceptance` | `Acceptance round` | info | `Stamp` | `With risk owners and executive approvers` |
| `returned-to-draft` | `Returned to draft` | info | `Undo2` | `With the Requestor` |
| `released` | `Released` | success | `CircleCheck` | none |

**Ageing bands** (`insight-constants.ts` holds the bounds): `0 to 2 days`, `3 to 5 days`, `6 to 10 days`, `Over 10 days`, `Not recorded`. Every ageing table caption says `working days`.

**AI run outcomes** (12 §2.2's wording kept in the detail): `Failed` (warning, `ServerCrash`), `Interrupted` (warning, `Unplug`), and `Completed on retry` (success, `RotateCw`) added beside a failed attempt whose job later completed. Warning, because a failed run waits on the Security Analyst (§4 tone vocabulary).

---

## 2. Shared patterns

### 2.1 The trend chart (X-68; D-13, D-14, D-16)

| Part | Contract |
|---|---|
| Form | Small multiples, one panel per rating, `Critical`, `High`, `Moderate`, `Low`, then `Not rated` only when above zero at some point. Never stacked (UI-D1) |
| Panel header | h3 holding the `RiskRatingBadge`; then the current figure as a text link `{n} now` (→ register live filters, §10) named `{n} {Rating} {Risk\|Risks} now: released and open`; then the delta in `--text-caption` / `--color-text-secondary`: `ArrowDown` and `−{k} since {first month}`, `ArrowUp` and `+{k} since {first month}`, or `Equal` and `No change since {first month}` (UI-D5) |
| Plot | `BarChart` column form, `figure-with-table`, `aria-hidden`: fills the rating's `fg` (§3.14 rule), value labels above, month micro-labels below, the current month the partial mark with 07 §4.4's legend `Current month to date` once per chart. One shared scale from zero across panels (UI-D2) |
| Pointer targets | Each column is also an `<a tabindex="-1">` opening what its table cell opens, with the `--color-bg-hover` tint on its slot on hover and no recolour of the mark; it stays out of the tab order and the accessibility tree because the cell is the keyboard path (UI-D4) |
| Grid | Two panels per row from the `@3xl` container size, one below it, 24px apart |
| Table | One table after the panels: caption `{scope}: open released Risks by residual rating at the end of each month`; `Month` \| ratings in panel order \| `Total`; months oldest first; the partial row `{Month Year} (to date)`. Non-zero cells link (§10); `Total` is a sum and stays plain (X-10). Sticky `Month` column while it overflows |
| Phone (below `@md`) | Each panel becomes a `KpiTile` link to the register's live filters: caption the rating's 12px icon and label, value the current count, the delta, and the 32px sparkline of square columns in the rating's `fg`, the last the partial mark, `aria-hidden`. Tiles stack one per row. The table follows and scrolls inside its named region |

### 2.2 The risk matrix (X-69; D-15, D-16)

| Part | Contract |
|---|---|
| Structure | A native `<table>`: caption `{Inherent\|Residual} risk matrix: {scope}`; header row 1 a `Likelihood` `th` spanning the row-header column and a `Consequence` `th` (`scope="colgroup"`) spanning five; header row 2 the consequence labels `{label} ({score})`; row headers `{label} ({score})`, highest likelihood first; axes from the served scale (18 D-20, 17.1 D-58) |
| Cell (full form) | Cells 2px apart on `--color-bg-surface`, no rules, each in its band's §3.6 `bg`, 8px padding, equal widths (`table-layout: fixed`), row-header column `8rem`. Line 1 the count, `--text-body` 500, `tabular-nums`, `--color-text-primary`; line 2 the band's 12px icon and label, `--text-caption` 500 in the band's `fg` |
| Links | A count above zero is a figure link whose hit area stretches over the cell (07 §4.1's overlay), one tab stop, `--focus-ring` on the cell, named `{n} {Risk\|Risks}: likelihood {label}, consequence {label}, {band}`. Zero is plain text and no tab stop |
| Arrangement | Inherent first, then residual; side by side from the `@5xl` container size, 24px apart, stacked below it (UI-D7) |
| Compact form (matrix container below `@md`) | 44px cells holding the count and the band icon; row-header column `5rem`, labels wrapping; column headers the score only, with `Consequence: 1 {label} · 2 {label} · 3 {label} · 4 {label} · 5 {label}` in `--text-caption` below the table, and a `Bands` key of the four `RiskRatingBadge`s. Where 44px cells cannot fit (320px), the table scrolls inside a region named `{caption}, scrolls horizontally` |
| Off the scale | Below each matrix, `{n} {Risk\|Risks} not on the scale` (plain: a sum), then `Likelihood: {a}` and `Consequence: {b}` as figure links to the register's position filter `Not on the scale`, named `{a} {Risk\|Risks} with the {side} likelihood not on the scale`. Absent at zero (UI-D8) |
| Values | Read through 18 D-21's function; withdrawn Risks never count (D-15) |

### 2.3 Statistics, scope and history lines (X-71; D-08, D-09, D-11, D-26)

| Case | Contract |
|---|---|
| Median, 90th percentile, rate | The supporting line or a `Episodes` / `Sample` column names the sample: `Across {k} {episodes\|releases\|runs}` |
| 90th percentile under ten values | `Not available` (`--text-body` / `--color-text-secondary`), supporting `{k} of 10 needed`; never a link |
| Capped sample (`truncated`) | Adds `Newest {cap} only.` |
| Time-to-release fallback (D-11) | `{j} of these use the submission date, because their stage history starts later.` |
| History line | Under the description, `--text-caption` / `--color-text-secondary`: `Stage history recorded from {date}. {n} open {request\|requests} began {its\|their} stage earlier and {isn’t\|aren’t} timed.` (the count clause only above zero) |
| Scope strings (each widget's description ends with one) | `Released open Risks.` · `Released open Risks at each month end, last {p} months.` · `Stages completed in the last {p} months.` · `Open requests now, by working days in their current stage.` · `AI runs started in the last 7 days.` · `AI runs started in the last {p} months.` · `Accepted risks and exceptions on released open Risks.` · register: `Risks matching: {chip labels joined by ·}.` or `All Risks in the register.` |

### 2.4 Drill-down pages (X-72; D-12, D-14, D-22, D-26)

Route proposal `/app/reports/{reportKey}/records?{closed parameters}`.

| Part | Contract |
|---|---|
| Breadcrumb | `Reports` › `{report title}` › `{drill-down title}` |
| Page header | Title names the figure (§5); description states population and window; action `Back to {report title}` (outline pill link, `ArrowLeft`), returning to the report with its period and filters |
| Total line | `{n} {records} make up this figure.` in `--text-body`, `tabular-nums`; `{n}` equals the figure as read |
| Table | `DataTable`, both densities, the order shown in its sorted header's cue, pagination with total and rows per page, sticky identifier column while it overflows, mobile cards below 768px (§5 names each). No selection, export or bulk bar (D-26; export deferred) |
| Cleared | `No {records}` · `The figure has changed since you opened it.` |
| Width | `--spacing-grid-max` (a data page) |

---

## 3. The leadership view (Reports index, `/app/reports`; D-19)

### 3.1 Page

- `PageHeader`: title `Reports`; description `Where risk and the assessment process stand, then every report. Read-only, from recorded history in your authorised scope.`; action `Print` (X-73).
- As-at line (07 §4.2 item 3): `Computed from recorded history as at {date}.`
- h2 `Leadership view` (`--text-heading-md`), description `For risk committees and leaders. Released Risks only, unless a section says otherwise.`
- The sections below, each 07 §4.3's card with an h3 micro-label caption, a description ending in its scope string (§2.3), and a footer text link `Open the {report title} report` (→ its report page with the same period).
- h2 `All reports`: 07 §4.1's card grid, now seven cards (h3 titles; UI-D19), the three new ones after the existing four (copy in "Copywriting Contract"). Does not print.
- **Focal point:** the trend section.

### 3.2 Sections, in DOM order (UI-D9)

| # | Caption | Contents | Links (§10) |
|---|---|---|---|
| 1 | Summary (visually hidden h3) | Four tiles: `Released open Risks` (supporting `Released Risks only`), `Critical residual` and `High residual` (supporting `Released open Risks`), `Reviews overdue` (supporting `Accepted risks and exceptions`) | Register with 11 §9.3's filters; `Reviews overdue` → 20 §6.1's `Accepted risks` view with `Decision review: Overdue` |
| 2 | `Open released risks by residual rating` | §2.1 over 12 months | Points, `now` figures |
| 3 | `Risk matrix` | §2.2 for released open Risks; after the matrices, the 11 §9.2 under-assessment link row: `Under assessment` {n}, caption `Not yet released, so not shown in the matrix.` | Cells; under assessment → register `stage=under-assessment&state=open&display=heat-map` |
| 4 | `Time to release and stage times` | Tiles `Median days to release` and `90th percentile days to release` (12 months, §2.3 lines); §4.2's stage table; §8's ageing table (team only, no `Show` control); the history line | §4.2 and §8 |
| 5 | `Accepted risks and exceptions` | Table `Review state` \| `Accepted risks` \| `Exceptions`; rows `Overdue`, `Due soon`, `Not confirmed`, `Reviewer needed` (X-63, X-12 badges as row headers) | Cells → `Accepted risks` view with the review state (and `exception=yes` for the second column) |
| 6 | `AI assistance` | Tiles `Failed in the last 7 days` (supporting `AI runs, failed or interrupted`), `Failure rate` (supporting `{f} of {r} runs in the last 12 months. View the failed runs`), `Edited before confirming` (supporting `Of the newest {k} AI-written fields confirmed`, plain, UI-D15) | Runs drill-down (§5.3) |

Each section is its own failure unit (07 §6.2, D-34): a failed section shows its compact error and the rest render.

### 3.3 Layout

| Viewport | Contract |
|---|---|
| 1440 | Body capped at `--spacing-container-max` (07 UI-D15). Tiles four in a row; sections 2 to 4 full width (trend panels two per row, matrices side by side); sections 5 and 6 side by side; `All reports` two columns |
| 375 | One column in DOM order: header, `Print` full width, as-at, tiles two by two, trend phone tiles and table, compact matrices (inherent then residual), stage tiles and table, ageing cards (20 amendment 2), accepted table (three columns fit), AI tiles, report cards |

### 3.4 Print (X-73)

`Print` prints this page: X-31's A4 portrait page and margins; the shell, `Print`, `All reports`, chevrons and the period-free footer links do not print; the trend and matrices print at the forms their printed width selects; the closing print-only note reads `Printed from CSRM on {instant with time zone}. Figures count the records the printing Security Analyst can read, as at {date}.` Each report page offers the same `Print` before its `Export` (19 §1).

---

## 4. Report pages (`/app/reports/{reportKey}`; D-03, D-20)

07 §4.2's frame, with 20 §10's filter row (`Assessment type`, `Division`, `Business unit`) on every new report except `AI assistance`, the period control (07 §4.5) with the defaults below, and `Print` then `Export` (19 §1) in the header actions.

### 4.1 `risk-trend` (D-13, D-14)

| Element | Contract |
|---|---|
| Period | `6 months`, `12 months`; default 12 (UI-D10) |
| Tiles | `Released open Risks`, `Critical residual`, `High residual`, each with §2.1's delta in the reserved delta position, linking as §3.2 |
| Section `Open released risks by residual rating` | §2.1 |
| Empty | None: zero months are data (07 §4.3) |

### 4.2 `cycle-times` (D-09 to D-12)

| Element | Contract |
|---|---|
| Period | `6 months` (default), `12 months` |
| Tiles | `Median days to release`, `90th percentile days to release` (each → the throughput's released list for the period, 11 §8.2, supporting `Across {k} releases` and §2.3's fallback line); `Over 10 working days in stage` → queue `stage` any, `ageBand=over-10` (supporting `Open requests now`) |
| Section `Time in each stage` | Small multiples of two `BarChart` bar charts, `Median` and `90th percentile`, ink, one shared scale, stages in §1's order (released excluded). Table `Stage` \| `Median (days)` \| `90th percentile (days)` \| `Episodes`. Median and 90th percentile cells link to the stage's drill-down, slowest first, named `{d} days median in {stage}: view {k} {episode\|episodes}, slowest first` (and `90th percentile`); `Episodes` is plain (UI-D14). History line under the description |
| Section `Slowest items` | Per stage with episodes, an h4 micro-label `{stage}`, then up to five rows: line 1 `{request number} · {title}` (`RecordLink`; for a round stage the assessment), line 2 caption `{d} days · {Round label if any} · Ended {date}`; footer link `View all {k} in {stage}` → drill-down. Stages without episodes are omitted |
| Section `Rounds` | Table `Measure` \| `Median` \| `90th percentile` \| `Sample` with rows `Response rounds per assessment`, `Days to each response`, `Acceptance rounds per release`, `Contest points per acceptance round`, `Days to a contest point’s first answer`, `Days from a round opening to each decision`; median and percentile cells link to the measure's drill-down. Then the line `Acceptance rounds in the period: {a} · recalled {r} · returned {t}`, each figure a link to the rounds drill-down with that outcome |
| Section `Queue ageing` | §8's widget body with its `Show` control |
| Empty | First-use `No stage times yet` · `Stage times appear once requests move between stages. Stage history is recorded from {date}.` in the first three sections when no episode exists |

### 4.3 `ai-assistance` (D-21 to D-23)

| Element | Contract |
|---|---|
| Period | `6 months` (default), `12 months` |
| Tiles | `Failed in the last 7 days`, `Runs in period`, `Failure rate`, `Edited before confirming` (as §3.2, with the period's words) |
| Section `Failed in the last 7 days` | Up to five rows as §5.3's mobile card, newest first; footer `View all {n} failed runs` → drill-down. Cleared `No failed AI runs` · `No AI run failed or was interrupted in the last 7 days.` |
| Section `Runs per month` | `BarChart` column form, ink, the partial month (07 §4.4). Table `Month` \| `Runs` \| `Failed or interrupted` \| `Failure rate`; `Runs` and `Failed or interrupted` cells link to the runs drill-down for that month |
| Section `Runs by operation and provider` | Table `Operation` \| `Provider` \| `Completed` \| `Failed` \| `Interrupted` \| `Failure rate`; counts link with operation and status |
| Section `Proposal outcomes` | Ink bars in order `Confirmed`, `Edited`, `Dismissed or rejected`, `Lapsed`, `Still proposed`; table `Outcome` \| `Proposals`; counts link to the runs drill-down with `Outcome` (UI-D15) |
| Section `Edited before confirming` | One sentence: `Analysts edited {p}% of AI-written fields before confirming them.` and §2.3's sample lines; plain |

### 4.4 Existing reports (D-20)

| Report | Change |
|---|---|
| `risk-exposure` | After `Inherent and residual rating`: section `Risk matrix` (§2.2, released open, with the under-assessment row as §3.2 item 3), description `Released open Risks by likelihood and consequence, before and after treatment.` After `Most exposed Information Systems`: section `Most exposed Information Assets` in the systems' anatomy (11 §9.3) with `Information Asset`; section `Risk Types` table `Risk Type` \| `Critical` \| `High` \| `All ratings`, top 10 by count then severity, note `Showing the top {n} of {total} Risk Types.`, cells → register with `riskType`; section `Accepted risks and exceptions` as §3.2 item 5 |
| `treatment-performance` | Section `Overdue and due soon by treatment owner`: description `Tracked treatments past their resolve date or due within 14 days, by treatment owner. Released Risks only.`; table `Treatment owner` \| `Overdue` \| `Due soon` \| `Total`, most overdue first, top 10 with `Showing the top {n} of {total} treatment owners.`; cells → register `treatmentOwner` with `dueState`; `Total` plain. Due state from the one rule (G-16) |
| `assessment-throughput` | Tile `90th percentile days to release` after the median, sharing §4.2's definition and lines |
| `control-effectiveness` | Description and every section read `Released Risks only.`; new last section `Under assessment`: `Mitigation controls on open Risks not yet released, by implementation status.` with 11 §8.2's row-header links plus `stage=under-assessment` (settles 11 D-43 for controls) |

---

## 5. Drill-downs (§2.4)

### 5.1 Trend point (D-14)

- Title `{Rating} at the end of {Month Year}`; description `Released Risks that were open and rated {Rating} at the end of {Month Year}, with their rating now.`
- Columns: `Risk` (risk number, `RecordLink` → register detail) · `Risk statement` (long text) · `Risk assessment` (number, `RecordLink`) · `Rating then` (badge) · `Rating now` (badge; `Closed` per X-63; X-27's withdrawn form) · `Released` (date). Sort `Risk` ascending.
- Mobile card: number and `Rating now` badge; statement (three lines); `Then {Rating} · Released {date}`.

### 5.2 Stage episodes and round measures (D-10, D-12)

- Stage: title `{Stage}: time in stage`; description `Times in {stage} that ended in the last {p} months, slowest first.` Columns `Request` (or `Risk assessment` for a round stage) · `Title` · `Round` (`Response round {n}`, `Acceptance round {n}`, else not shown for non-round stages) · `Entered` · `Left` (X-3 instants, date shown) · `Days` (one decimal). Sort `Days` descending.
- Measure: title the measure label; columns `Risk assessment` · `Title` · `Round` · `Opened` · `Closed` · the measure's value (`Days` or `Count`). Sort the value descending.
- Mobile card: number and `{d} days`; title; `{stage or round} · Left {date}`.

### 5.3 AI runs (D-21, D-22)

- Title `AI runs`; description `AI runs in your scope, newest first. Retry from the record while CSRM still holds the job.`
- Filters (chips, `Clear filters`): `Outcome` (`Failed or interrupted` default, `Failed`, `Interrupted`, `Completed`, and the proposal outcomes), `Operation` (operation labels), `Window` (`Last 7 days` default, `Last {p} months`, a month from a cell link, chip `Month: Sept 2026`).
- Columns `Started` (instant) · `Operation` · `Record` (`{number} · {title}`, `RecordLink`) · `Started by` · `Attempt` (`{n}`, numeric) · `Outcome` (§1 badges) · `Failure` (12 §2.2's outcome text: `Failed: {safe message}` or `Interrupted by a restart`). Never the instruction, context summary, proposal or Requestor text (G-3).
- Mobile card: operation and outcome badges; record link; `{started by} · Attempt {n} · {instant}`; failure text.

---

## 6. The Risk register heat map (`/app/risks`; D-15)

- **Switch:** 18 §2.2's toolbar gains, first, the segmented control `Show as` with `Table` (`Table2`) and `Heat map` (`Grid3x3`) (X-9), URL `display=heat-map`; default `Table`. Not part of a saved view (deferred).
- **Heat map display:** filters, chips, search and `Export` stay; `View:`, `Columns`, density and pagination are not drawn. A scope line (§2.3 register strings) with the matched total, then §2.2's two matrices with off-scale lines. Cells open `display=table` with the same filters plus the side's likelihood and consequence.
- **Position filters** (11 §9.5's `More filters`, 18 §11's phone sheet): `Inherent likelihood`, `Inherent consequence`, `Residual likelihood`, `Residual consequence`, each `All`, the served labels, `Not on the scale`. Chips `Residual likelihood: Likely`. An `Exception` filter (`All`, `With an exception`) only if Phase 20's plans add none (D-03.5).
- **Filtered empty:** the locked `No Risks match these filters` with `Clear filters`, in place of the matrices.

---

## 7. The review queue (`/app/review/requests`, `/app/review/assigned`; D-12)

- **Column `In stage`**, after `Age` (11 §7.1): line 1 `{n} working {day|days}` (right-aligned, `tabular-nums`), line 2 caption the stage label; `Not recorded` in `--color-text-secondary`. Sortable, longest first when chosen.
- **Filters** (13 §2.2's controls): `Stage` (`All stages`, then §1's open stages), chip `Stage: Rework`; `Time in stage` (`Any time`, the five bands), chip `Time in stage: Over 10 working days`. `Clear filters` resets both.
- **Mobile card:** adds `{stage} · {n} working {day|days} in stage`.

---

## 8. Analyst Home additions (D-18; 11 §5.3, 13 §3, 20 §9.3)

| Unit | Contract |
|---|---|
| `Review queue` | After `Generation in progress`, row `Failed in the last 7 days` {n} → runs drill-down, named `Failed in the last 7 days: {n} AI {run\|runs}`; zero renders |
| `Queue ageing` (new, `Timer`, after `Review queue`) | Description `Open requests by stage and working days in it. Drafts aren’t counted.` and the history line. `Show` segmented control `Team` (default) and `Yours`, switching between two server-rendered tables without a request (UI-D12). Table (from the widget's `@xl` size) `Stage` \| the five bands \| `Total`, caption `Open requests by working days in their current stage`; non-zero cells → queue `queue=open&stage=&ageBand=` (plus `Assigned to: Me` for `Yours`), `Total` plain. Below `@xl`: one card per stage (title the stage badge, then `{band}: {n}` links joined by the middle dot). Cleared `No open requests` · `Submitted requests appear here by stage.` Footer `Open cycle times` |
| `Reviews due` (new, `CalendarClock`, after `Treatments due`) | Description `Accepted risks and exceptions whose review is overdue, due soon or not confirmed. Released Risks only.` Link rows `Overdue`, `Due soon`, `Not confirmed`, `Reviewer needed` → `Accepted risks` view with that review state, named `{state}: {n} {review\|reviews}`. Cleared `No reviews due` · `Accepted risks appear here as their review date nears.` |

1440 pairs: `Review queue` | `Queue ageing`; `Treatments due` | `Reviews due`; then 11 §5.3's remaining pairs. 375: full width in order.

---

## 9. The Requestor's time with the Security Analyst (D-17; 11 §5.2, §7.3)

- Home `With the Security Analyst` item line 2: `{request number} · With the Security Analyst for {n} {day|days}`, or `… since today`; with no stage history, 11 §5.2's `Submitted {n} days ago` (UI-D13).
- My requests `Next step` cell and mobile card add a caption line: `For {n} {day|days}, since {date}` from the stage history, else nothing.
- Nothing else changes for first-line people: no report, matrix, ageing or AI figure.

---

## 10. Figure links (X-10, 11 §8.1)

| Figure | Opens |
|---|---|
| Trend `now`, current-month cells, phone tiles | `/app/risks?state=open&stage=released&residualRating={rating}` (+ report filters) |
| Past trend cells, columns | §5.1 `?point={YYYY-MM}&rating={rating}&period={p}` |
| Matrix cells | `/app/risks?state=open&stage=released&{side}Likelihood=&{side}Consequence=` (register: its current filters) |
| Off-scale axis links | the same with `not-on-scale` |
| Stage median, 90th percentile, slowest-items footer | §5.2 `?stage=&period=` |
| Round measures and outcomes | §5.2 `?measure=&period=` |
| Ageing cells, `Over 10` tile | queue with `stage`, `ageBand` (and `Assigned to: Me`) |
| Review-state cells and rows | 20 §6.1 `Accepted risks` view with `decisionReview` (and `exception`) |
| Runs, failures, outcomes, `Failed in the last 7 days` | §5.3 with `outcome`, `operation`, `window` |
| Owner, Risk Type, Information Asset cells | register with `treatmentOwner` and `dueState`, `riskType`, `asset` |

Every list's total equals its figure; every link carries the page's report filters and period; names begin with the visible figure (11 §8.1 rule 7).

---

## 11. Refusal copy (new family Z, added to Phase 10 §10.2 and `refusal-copy.ts`)

No write exists, so every Z refusal is a read refusal. Kinds as 10 §10.2.

### Z1. Reports, drill-downs and filters

| Reason | Copy | Kind |
|---|---|---|
| 403 grant (Requestor, risk owner, executive approver, treatment owner, Admin) | 07 §7.5's `You don’t have access to reports`; on the queue and register their shipped permission states. No analyst read is issued (07 §6.3) | blocked |
| `INSIGHT_SCOPE_MISSING` (an analyst lacking an underlying read) | The permission state, area `reports`, description `These figures count records your role can’t read. Ask an administrator to check your Security Analyst role.` | blocked |
| 400 drill-down parameter (unknown point, stage, measure, outcome, window, period) | Under the page header: `This link doesn’t match a figure any more. Go back to {report title} and choose the figure again.` with `Back to {report title}` | blocked |
| 400 queue or register filter value (`stage`, `ageBand`, a position) | Filtered error: `One of these filters isn’t recognised.` with `Clear filters` | blocked |
| Network, timeout or 5xx | The locked `We couldn’t load {noun}` with `Try again`, per section | retryable |

### Z2. Requestor

| Reason | Copy | Kind |
|---|---|---|
| 404 on another person's request | The not-found page (unchanged) | blocked |

---

## 12. Five-state contract and the premium bar

| Surface | Loading | Empty | Error | Permission | Populated states added |
|---|---|---|---|---|---|
| Leadership view | Tile skeletons, a trend skeleton (panel headers, column blocks at plot height, table rows), matrix skeletons (5 × 5 inset blocks at cell size), table rows; `Loading reports` | Per section (§3.2, §4) | Per section (07 §6.2); page error only when every read fails | 07 §6.3 | Partial month, `Not available`, history line, off-scale, truncated |
| Report pages | 07 §6.1 plus the trend and matrix skeletons | §4 | Per section | 07 §6.3 | as above |
| Drill-downs | DataTable skeleton under the real header; `Loading records` | §2.4 cleared | Z1, `We couldn’t load these records` | Z1 | Rows, paging |
| Register heat map | Matrix skeletons | §6 filtered empty | 18 §13 | unchanged | Off-scale |
| Queue column and filters | 13 §2 | filtered empty | unchanged | unchanged | `Not recorded` |
| Home units | 11 §5.4, with the new widgets in order | §8 cleared | compact error per unit | count rows absent on failure | Team and Yours |

| G-4 item | Phase 21 contract |
|---|---|
| Keyboard path | Every figure, filter, segmented control and `Print` in DOM order; matrix zeros are not tab stops; chart columns mirror table cells that are |
| Optimistic feedback | None needed: no write. The `Show` and `Show as` controls switch at once; period changes keep focus on the segment with `aria-busy` (07 §4.5) |
| Skeletons | §12 table, after 300ms, matching final layout |
| Undo and confirmations | None: read-only (D-27) |
| Empty states that say what to do next | §4, §8, §2.4; zero months and zero matrices are data |
| No lost input | Filters and periods live in the address; `Back to {report}` restores them |
| Density | Comfortable and compact on drill-downs and the queue; report tables are static |
| Motion | None on data (§6 item 8); reduced motion honoured |
| Phone layouts | Trend tiles, compact matrices, ageing cards, card lists |
| Every figure opens its records | §10 |

---

## 13. Test assertions this contract changes

- **Phase spec (1440 and 375):** SC1 the four trend panels and a past cell opening §5.1 with an equal total, the `now` link opening the register; SC2 both matrices with count, icon and band label in each cell (the compact form at 375 with its keys), a cell opening an equal register list, axe clean; SC3 a median link opening §5.2 slowest first, a slowest item opening its request, an ageing cell opening an equal queue; SC4 `Failed in the last 7 days: 2` on Home opening §5.3 with `Completed on retry`. Negatives: Maya and the risk owner persona see `You don’t have access to reports` at the index, each report and a drill-down URL, and only personal figures on Home.
- **Existing specs changed deliberately:** `analyst-insights.spec.ts` (index headings `Leadership view`, `All reports`, h3 cards; new tiles and sections), queue columns, Home order, Requestor line 2.
- **Unit (Vitest):** `metrics-format.ts`; the trend chart's table equivalence, pointer targets out of the tab order, shared scale and phone tiles; the matrix's header structure, cell names, zero cells, compact keys and off-scale lines; §1's mapping and parity; family Z; the `Show` toggle.

---

## Copywriting Contract

| Element | Copy |
|---|---|
| Primary CTAs | None: no write. Actions: `Print`, `Export`, `Back to {report title}`, `Clear filters`, `Try again` |
| Report titles and descriptions (`report-copy.json`) | `Risk trend` · `Released open Risks by residual rating at the end of each month, with the Risks behind each point.` · `Cycle times` · `How long requests spend in each stage, the slowest items, rounds and queue ageing.` · `AI assistance` · `AI runs by outcome, failed runs, and how analysts used what the AI proposed.` Metadata `Risk Trend Report \| IdamBox CSRM`, `Cycle Times Report \| IdamBox CSRM`, `AI Assistance Report \| IdamBox CSRM` |
| As-at line | `Computed from recorded history as at {date}.` (all reports) |
| Headings and labels | §1 to §9 |
| Empty state headings | `No stage times yet`; `No open requests`; `No failed AI runs`; `No reviews due`; `No {records}`; `No Risks match these filters` |
| Empty state bodies | §4.2, §4.3, §8, §2.4 |
| Error state | Family Z and the locked section errors: what happened and `Try again` |
| Destructive confirmation | None |
| Print note | §3.4 |

---

## Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| 1.1.1, 1.3.1 | Charts `aria-hidden` with a visible table; matrices are native tables with `scope` headers and a caption; tiles are `<ul>` |
| 1.4.1 | Bands carry icon and label (compact form: icon and the band key); stages and outcomes icon and words; deltas icon and sign |
| 1.4.10 | No page scroll at 320px; tables and the compact matrix scroll inside named regions |
| 1.4.11 | Marks fill with `fg` tokens; cells separated by surface gaps, meaning in text |
| 2.1.1 | Every drill-down reachable through a table cell or tile |
| 2.4.6 | Section h3 captions; drill-down titles name the figure |
| 2.5.3 | Link names begin with the visible figure |
| 2.5.8 | Targets at least 24px; compact matrix cells and phone tiles 44px |
| 4.1.3 | Period and `Show` changes announce through `aria-busy` only; no live data |
| Automated | Zero serious or critical axe violations on the leadership view, the three report pages, each drill-down, the register heat map and Home, at 1440 and 375 |

---

## Spacing Scale

The §3.9 scale, unchanged. 24px between trend panels and between matrices; 2px between matrix cells; 8px cell padding; sections 24 to 32px apart (§3.9 rhythm); 16px card padding below 640px, 20px above. Matrix widths `8rem`, `5rem` and 44px cells are part of X-69.

| Token | Value | Usage |
|---|---|---|
| xs | 4px | Icon to label in cells and badges |
| sm | 8px | Cell padding, band key gaps |
| md | 16px | Card padding on phones, table to note |
| lg | 24px | Panels, matrices, sections |
| xl | 32px | Section rhythm upper bound |
| 2xl | 48px | Not used |
| 3xl | 64px | Not used |

Exceptions: the 2px matrix gap (a §3.9 step) and the 44px compact cell (the touch-target height).

---

## Typography

The §3.10 scale, unchanged.

| Role | Size | Weight | Line Height |
|---|---|---|---|
| Body (counts in cells, sentences) | 14px (`--text-body`) | 400 / 500 | 20px |
| Label (captions, band labels, deltas, history lines) | 12px (`--text-caption`) | 400 / 500 | 16px |
| Heading (`Leadership view`, `All reports`) | 20px (`--text-heading-md`) | 600 | 28px |
| Display (KPI values) | 30px (`--text-display`) | 600 | 36px |

Page titles `--text-heading-lg`; section captions, axis and table headers `--text-micro`; table bodies `--text-table`. `tabular-nums` on every figure. Weights 400, 500 and 600 only.

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | Canvas; cards, tables, matrix gaps |
| Secondary (30%) | `--color-bg-inset`, `--color-border-default`, `--color-text-secondary` | Skeletons, hairlines, captions, deltas |
| Accent (10%): ink | `--color-primary`, `--color-text-link`, `--focus-ring`, `--chart-1` | Reserved, below |
| Severity (§3.6) | four risk sets | Matrix cell `bg` with `fg` icon and label; trend fills and sparklines in `fg`; rating badges |
| Status (§3.5) | warning, info, success | §1 stage and outcome badges, review-state badges; never a data mark |
| Destructive | `--color-danger-solid` | Not used |

Ink is reserved for: figure and record links, checked segments, `--chart-1` ink marks and the partial outline, and focus rings. No new hue.

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| Charts, matrices, tables, tiles | None: render at final size (§6 item 8) |
| Link tiles, report cards | §5 link-card hover |
| Segmented controls | §5 button state |
| Phone filter sheet | §5 drawer; fade under reduced motion |

---

## Proposed CSRM extensions

For the orchestrator to accept. A Phase 21 plan task records them in `docs/design/csrm-design-direction.md` before the implementing tasks run. Numbering continues after Phase 20's X-67. None adds a colour, type step, radius, shadow or duration.

| # | Where | Proposal | Exact wording to record | Rationale |
|---|---|---|---|---|
| X-68 | §3.14, after "Chart geometry and marks" | Trends split by a severity | "**Trends by rating (CSRM extension, 2026-10-01).** A count over time split by a severity is drawn as small multiples, never stacked: one panel per rating, Critical to Low, with `Not rated` only when it is above zero at some point. Each panel is headed by the rating's badge, the current figure as a link reading `{n} now`, and a delta in `--text-caption` / `--color-text-secondary` (`ArrowUp`, `ArrowDown` or `Equal` with the signed change `since {first month}`), never coloured, because more of one rating is neither good nor bad. Its plot is the column chart, filled with the rating's `fg` token, value labels above and month micro-labels below, the current month the partial mark. Panels share one scale from zero and sit two to a row from the `@3xl` container size, one below it, 24px apart. One table follows the panels: months as rows, oldest first, ratings as columns, then `Total`. Each column is also a pointer target opening what its table cell opens, kept out of the tab order and the accessibility tree because the cell is the keyboard path. Below the `@md` container size each panel becomes a KPI tile with the rating's icon and label as its caption, the current figure, the delta and a 32px sparkline of square columns in the rating's `fg`, and the table scrolls inside its named region." | D-13, D-16, decision 13; stacked severity hues would rely on colour, and §3.14 caps series without a form for more |
| X-69 | §4 Forms, after "Matrix picker" | Counts on the risk matrix | "**Risk matrix (CSRM extension, 2026-10-01; extends Matrix picker).** Counts of Risks by likelihood and consequence are a native table that is its own data table: a caption naming the side and the population, a `Likelihood` header over the row headers and a `Consequence` header spanning five columns, likelihood rising up the rows and consequence along the columns, labelled `{label} ({score})` from the served scale. Cells sit 2px apart on `--color-bg-surface` with no rules, each in its band's §3.6 `bg` with 8px padding and a `8rem` row-header column: the count in `--text-body` 500 `tabular-nums` `--color-text-primary`, then the band's 12px icon and label in `--text-caption` 500 in the band's `fg`. A count above zero is a figure link whose hit area is the whole cell, named `{n} {Risk|Risks}: likelihood {label}, consequence {label}, {band}`; zero is plain text. Inherent and residual matrices sit side by side, inherent first, from the `@5xl` container size and stack below it. Below the `@md` container size a matrix takes its compact form: 44px cells holding the count and the icon, a `5rem` row-header column, column headers showing the score with a `Consequence:` key below and the four rating badges as a band key; where 44px cells cannot fit, it scrolls inside its named region. Risks whose position is missing or off the scale are counted below as `{n} not on the scale`, plain, followed by a link per axis that opens its exact list." | D-15, D-16, SC2; X-57 picks one cell but does not count |
| X-70 | §4 Status & risk badges, after "Tracking and review values" | Stage, ageing and AI run values | "**Stages and run outcomes (CSRM extension, 2026-10-01).** A request's process stage is a value in the one mapping: `Intake` (warning, `Inbox`), `Questionnaire` (info, `ClipboardList`), `Drafting` (warning, `PenLine`), `Response round` (info, `MessageSquareReply`), `Rework` (warning, `Repeat2`), `Acceptance round` (info, `Stamp`), `Returned to draft` (info, `Undo2`) and `Released` (success, `CircleCheck`). Time in a stage reads `{n} working {day|days}` in queues and ageing and `{d} days` to one decimal in statistics; a stage that began before its history was recorded reads `Not recorded`, never zero. Ageing bands read `0 to 2 days`, `3 to 5 days`, `6 to 10 days`, `Over 10 days` and `Not recorded`, with `working days` in their table's caption. An AI run's outcome reads `Failed` (warning, `ServerCrash`) or `Interrupted` (warning, `Unplug`); a failed attempt whose job later completed adds `Completed on retry` (success, `RotateCw`)." | D-06, D-08, D-12, D-21; G-13's one mapping |
| X-71 | §4 Cards / KPI tiles, after the 2026-09-24 extension | Statistics, samples and scope lines | "**Statistics and scope (CSRM extension, 2026-10-01).** A median, percentile or rate names its sample in its supporting line or a sample column (`Across {k} {items}`); a 90th percentile shows only from ten values, otherwise `Not available` with `{k} of 10 needed`, and a capped sample adds `Newest {cap} only.` Every widget's description ends with its population and window (`Released open Risks.`, `Stages completed in the last {p} months.`, `AI runs started in the last 7 days.`), and a figure read from a history that starts on a date adds a `--text-caption` / `--color-text-secondary` line `{History} recorded from {date}.` with what it leaves out. Durations show one decimal and rates one decimal with `%`, all `tabular-nums`." | D-08, D-09, D-11, D-26; the direction defines `Not available` but not samples or scope |
| X-72 | §4 Record links, after "Used in" | The page behind a figure no list can reproduce | "**Figure drill-down (CSRM extension, 2026-10-01; extends Figure links).** A figure that no canonical list can reproduce opens its report's drill-down page: a breadcrumb `Reports › {report} › {title}`; a page header whose title names the figure, whose description states its population and window, and whose action is `Back to {report}`, an outline pill link with `ArrowLeft` that restores the report's period and filters; the line `{n} {records} make up this figure.` with `tabular-nums`, `{n}` equal to the figure; then a DataTable with both densities, its order shown by the sorted header, its total and rows per page in the pagination, and mobile cards below 768px. Each row opens its record through one `RecordLink`. It has no selection, export or bulk action. When nothing remains, it shows the cleared state `No {records}` with `The figure has changed since you opened it.`" | D-12, D-14, D-22, D-26; X-10 assumes a canonical list exists |
| X-73 | §4 Print, after "Print report" | Printing a dashboard page as it stands | "**Printed dashboards (CSRM extension, 2026-10-01; extends Print report).** A dashboard or report page that prints as it stands offers `Print`, an outline pill with `Printer`, before its `Export`, which opens the browser's print dialog. It prints on the Print report's A4 portrait page and margins, with page numbers where supported. Sections avoid breaking inside, and a section taller than a page breaks between its chart and its table. Chevrons, catalogues of other pages and interaction-only controls do not print. A print-only closing note in `--text-caption` reads `Printed from CSRM on {instant with time zone}. Figures count the records the printing Security Analyst can read, as at {date}.`" | D-19, decision 12; X-31 covers a record's own report page, not a dashboard |

---

## Decisions recorded

Made without asking (auto mode), from the locked context, `AGENTS.md` and the direction.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | The trend is small multiples, not stacked columns. | Critical, High and Moderate `fg` hues sit close; stacked segments would be told apart by colour (§6 item 1). |
| UI-D2 | Trend panels share one scale. | Honest comparison across ratings (07 §4.4's precedent); direct labels carry small changes. |
| UI-D3 | The trend reuses `BarChart`'s column form (HTML marks), and the sparkline is drawn the same way. | 07 §5.2 chose HTML for type, zoom and reflow; it satisfies decision 13's custom accessible chart with a table. D-16 says "SVG". |
| UI-D4 | Chart columns are pointer targets mirroring their table cells, out of the tab order. | Clicking a point is expected; the table stays the single keyboard and assistive path. |
| UI-D5 | Deltas are never coloured. | Whether fewer Low or more Moderate Risks is good is not knowable from the count. |
| UI-D6 | Matrix cells are tinted by band, not by count. | The matrix shape is the organisation's appetite (decision 8); counts are text. |
| UI-D7 | Inherent before residual; stacked below `@5xl`; compact below `@md`. | Before-then-after reading order; 81px cells fit the band label at 1440. |
| UI-D8 | `Not on the scale` is a plain sum with a link per axis. | The register's filters combine with AND, so only per-axis lists equal their figures (X-10 rule 4). |
| UI-D9 | Leadership order: tiles, trend, matrix, stage times, then accepted risks beside AI assistance. | Pairs the two half-width sections at 1440 while keeping D-19's content. |
| UI-D10 | Leadership view fixed at 12 months; report defaults: trend 12, cycle times 6, AI assistance 6. | SC1 asks 12 months; the others follow the throughput control (D-09). |
| UI-D11 | Stage labels as §1. | Product words that name the work, not the internal keys. |
| UI-D12 | `Show: Team / Yours` switches two server-rendered tables in a small client island. | No refetch of Home; R-08-34 budgets. |
| UI-D13 | The Requestor reads `With the Security Analyst for {n} days`. | Holders alternate between stages, so the stage time is the time with the analyst; whole days for first-line readers. |
| UI-D14 | Median and 90th percentile link; `Episodes` stays plain. | SC3 names the statistics as the links; a third link to the same list adds tab stops. |
| UI-D15 | Proposal outcomes link to the runs drill-down through an `Outcome` filter; `Edited before confirming` stays plain. | Every figure opens its records; a share of a capped field sample has no record list. |
| UI-D16 | Failed and interrupted runs are warning. | The tone vocabulary keeps danger for a recorded overdue state. |
| UI-D17 | `Heat map` is a `Show as` display, not a saved view. | D-15; saving it is deferred. |
| UI-D18 | Refusals are family Z. | The spawn prompt. |
| UI-D19 | Report cards on the index become h3 under h2 `All reports`. | The leadership view introduces a second h2 level. |
| UI-D20 | Failed AI runs on Home are a row in `Review queue`, after `Generation in progress`. | D-18 places them beside it. |

---

## Notes carried

- **For the orchestrator to settle:**
  - **UI-D3:** D-16 says the trend is "a custom SVG chart"; this contract reuses Phase 7's HTML `BarChart`, meeting decision 13's intent. Confirm, or require SVG marks.
  - **UI-D15:** the runs drill-down's `Outcome` filter widens D-22's closed filters (status, operation, window) with proposal outcomes. Confirm, or leave proposal outcomes plain with a recorded exception to "every figure opens its records".
  - **Routes** `/app/reports/{reportKey}/records` and the query names in §10 are proposals.
- **For research and the planner:** the slowest-N (5), the top-N for owners and Risk Types (10), the minimum sample (10) and the field sample cap sit in `insight-constants.ts`; reason codes for family Z; `display=heat-map`, `stage`, `ageBand` and the four position keys within the closed parsers.
- **Earlier contracts this one amends (their plans have not executed):** 07 §4.1 (index headings and h3 cards, seven cards), 07 §7.4 (as-at wording for all reports), 11 §5.2 (line 2), 11 §5.3 and 13 §3 (Home order and the queue widget row), 11 §7.1 and 13 §2.2 (column and filters), 11 §7.3 (Next step caption), 11 §9.3 (exposure sections), 11 §9.4 (control effectiveness descriptions), 18 §2.2 (`Show as`), 20 §6.2 (position and exception filters).
- **Shared-file changes needed:** the direction records X-68 to X-73 through a Phase 21 plan task; `refusal-copy.ts` gains family Z; `report-copy.json` gains the three reports' copy.

---

## UI Considerations

Written inline from the contract. The ui-phase probe replaces them when it runs.

State considerations: 16 covered, 2 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|---|---|---|---|
| empty | Stage times, ageing, failed runs, reviews, drill-downs | ✅ covered | §4.2, §4.3, §8, §2.4 |
| empty | Trend and matrices with zeros | ✅ covered | Zeros are data (07 §4.3) |
| loading | Every surface | ✅ covered | §12 skeletons |
| error | Sections fail alone | ✅ covered | 07 §6.2, family Z |
| permission | First-line people, Admin, analyst without a read | ✅ covered | Z1, 07 §6.3 |
| partial | History before deployment | ✅ covered | `Not recorded`, history line (§2.3) |
| partial | Percentile under ten values; capped samples | ✅ covered | §2.3 |
| partial | Off-scale positions | ✅ covered | §2.2 |
| interaction | Figure changed before the drill-down opens | ✅ covered | §2.4 cleared |
| interaction | Stale or edited drill-down URL | ✅ covered | Z1 |
| zero-one-many | Plurals, counts | ✅ covered | Written-out forms |
| overflow | Long scale labels, titles | ✅ covered | Headers wrap; long-text columns |
| phone | Trend, matrix, ageing, tables | ✅ covered | §2.1, §2.2, §8, 20 amendment 2 |
| figures | Every figure opens an equal list | ✅ covered | §10 |
| print | Leadership view on A4 | ✅ covered | §3.4 |
| privacy | Run rows hold no content | ✅ covered | §5.3 |
| print fidelity | Severity tints and dashed partial marks survive a real printer | 🧪 backstop | `{ statement: "The pilot prints the leadership view to A4 PDF and paper; tints, icons, labels and the partial mark read", verification: backstop }` |
| screen reader | The matrix reads as a table with both headers per cell | 🧪 backstop | `{ statement: "With NVDA, a residual cell announces its likelihood and consequence headers, count and band", verification: backstop }` |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|---|---|---|
| shadcn official (local source-owned components) | None new | Not required: no block added and no registry fetched (2026-10-01) |
| Third-party | none | Not applicable |

---

## Verification contract

- **Unit and component (Vitest):** §13's unit list and every surface in its five states.
- **E2E** (1440 and 375): §13's phase spec with the axe scope; each run leaves the tree clean.
- **Manual (pilot):** the two UI Considerations backstops.

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

The UI checker approved this contract with flags. These amendments bind the plans:

1. **Proposal-outcome figures count runs**, by each run's outcome, so every total equals the drill-down list it opens (X-10). The `Outcome` filter on the AI runs list takes the outcome values that Phase 12's run record already stores, which the plan lists from the contract. No figure counts proposals while its list shows runs.
2. **Bar charts on phones:** below 768px, each bar chart becomes a list of labelled rows, each with its value and a proportional bar, and its data table stays available. The trend's sparkline tiles stay as the contract has them.
3. **One wording for the band:** `Over 10 working days`, in the band and its chip alike.
4. **Typography** follows the direction's scale (ADR 0001 gap 8).
