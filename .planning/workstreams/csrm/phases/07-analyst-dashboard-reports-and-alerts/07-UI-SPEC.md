---
phase: "07"
slug: "analyst-dashboard-reports-and-alerts"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-09-24"
---

# Phase 07 — UI Design Contract

> Visual and interaction contract for the Security Analyst dashboard (`/app/review`), Alerts (`/app/alerts`) and Reports (`/app/reports`, `/app/reports/[reportKey]`), plus the navigation, shared primitives and existing-surface alignments they need. It extends the shipped BProton-based CSRM interface. It introduces no colour, type size, weight, family, radius, shadow, spacing step or duration of its own.

---

## Binding inputs and value authority

- Locked decisions D-01 to D-25 in `07-CONTEXT.md` govern this contract: routes (D-15), capability gating (D-16), five states (D-17), KPI tiles (D-18), charts (D-19), reuse (D-20), alerts (D-10 to D-12), reports (D-13), Requestor dashboard data source (D-22). Where the context leaves a choice open, this contract makes it and records the reason under "Decisions recorded" (UI-D1 to UI-D21).
- `docs/design/csrm-design-direction.md`, adopted by `docs/adr/0001-adopt-bproton-design-system.md`, is the only value-bearing authority (Phase 06.5 decision, reaffirmed in `.planning/STATE.md` on 2026-09-24). This file names semantic tokens and cites the direction document by section (§). It never restates a colour, size, spacing, radius or duration.
- Values the new surfaces need but the direction document does not define are listed under "Proposed CSRM extensions" (X-1 to X-13). They carry proposed values and rationale for the orchestrator to add to the direction document. Until then no executor hard-codes them.
- Requirements: DASH-01 and DASH-02. Acceptance bar: ROADMAP Phase 7 success criteria 1 to 3.
- Domain vocabulary is the JDL's: Security Analyst, Requestor, Assessment Request (`CsrmAssessmentRequest`), Questionnaire, Risk Assessment (`CsrmAssessment`), Risk and contextual Risk (`CsrmRisk`), Risk Type, Control and Control Implementation (`CsrmControlImplementation`, shown on the Risk page as "Mitigation controls"), Information System. No competing entity is introduced. There is no Alert, Report or Activity entity (D-01): every figure, alert, report row and activity item is computed on read by Strapi.

---

## Design system

| Property | Value |
|----------|-------|
| Tool | shadcn/ui, source-owned local components (`apps/web/components.json`: style `new-york`, RSC, CSS variables, neutral base, `iconLibrary: lucide`) |
| Preset | new-york; neutral base; CSS variables; RSC; Lucide icons |
| Component library | Radix primitives through the existing `radix-ui` package, composed by the local shadcn/ui components |
| Icon library | `lucide-react` 1.30.0, per §4 Iconography |
| Font | Plus Jakarta Sans for UI text, data and numbers; Instrument Serif for page titles only; IBM Plex Mono for micro-labels and machine identifiers (§3.10, ADR 0001 gap 8) |
| Tokens | Semantic tokens in `apps/web/app/globals.css`, whose values are the direction document's; feature code consumes the mapped utilities only |
| Charting | No charting dependency (D-19). One HTML bar primitive in `components/csrm` (§5.2 below) |
| Container queries | Tailwind v4.3.3 built-in `@container` variants; no plugin, no dependency |

---

## Component inventory

Enumerated by `ls apps/web/src/components/ui/*.tsx | wc -l`: 30 components, local shadcn/ui set, 2026-09-24. `npx shadcn info` was not run because it downloads a package; the local source files are the inventory of record, as in 06.4. This is a non-exhaustive list of known-good components, not a closed allowlist.

| Component | Import path | Phase 7 use |
|-----------|-------------|-------------|
| `Card` family | `@/components/ui/card` | Dashboard widgets, KPI tile frame, report sections, report index cards (in the shipped Requestor `ActionWidget` frame) |
| `Badge` (`danger`, `warning`, `info` variants) | `@/components/ui/badge` | `AlertUrgencyBadge` (§5.4); existing variants already map to §3.5 status tokens |
| `Button` (`link`, `outline` variants) | `@/components/ui/button` | Widget footer links, "Try again", "Clear filters", "View reports" |
| `Skeleton` | `@/components/ui/skeleton` | Every loading layout (carries `data-slot="skeleton"`, which the accessibility spec waits on) |
| `Table` family | `@/components/ui/table` | Report count tables and the risk-exposure cross-tab |
| `Breadcrumb` family | `@/components/ui/breadcrumb` | Report detail ("Reports" › report title), as on administration detail pages |
| `RadioGroup` primitive | `radix-ui` (`RadioGroup`) | `SegmentedControl` (§5.3); the local `radio-group.tsx` item is a circular radio and is not used for segments |

Shared CSRM components reused unchanged: `DataTable` (`components/csrm/data-table.tsx`, including `tableHeaderMicroClassName`), `PageHeader`, `RecordLink`, `RiskRatingBadge`, `StatusBadge`, `nativeSelectClassName`, and the state primitives `EmptyState`, `ErrorState` and `PermissionDeniedState` (`components/states/states.tsx`). `LoadingState` (a spinner frame) is not used on Phase 7 surfaces: every Phase 7 layout is known, so loading is a skeleton (§4 Skeletons).

New shared primitives, each in `apps/web/src/components/csrm/` with its own tests: `KpiTile`, `BarChart`, `SegmentedControl`, `AlertUrgencyBadge` (§5).

---

## Token names used in this contract

The direction document and `globals.css` use different names for several tokens. This table is naming only; every value lives in the direction document.

| Direction document token | Utility or class in the shipped code |
|---|---|
| `--color-bg-page` / `--color-bg-surface` / `--color-bg-inset` | `bg-background` / `bg-surface` (`bg-card`) / `bg-surface-muted` |
| `--color-bg-hover` | `bg-surface-hover` |
| `--color-text-primary` / `--color-text-secondary` / `--color-text-muted` | `text-foreground` / `text-foreground-secondary` / `text-muted-foreground` |
| `--color-text-link` + `--text-link-decoration` | `.record-link` via `RecordLink`; `Button variant="link"` for non-record links |
| `--color-border-default` / `--color-border-strong` / `--color-border-ink` | `border-border` / `border-border-strong` (`border-input`) / `border-line-ink-20` |
| `--color-primary` / `--color-on-primary` | `bg-primary` / `text-primary-foreground` |
| `--color-danger-*` | `text-destructive`, `bg-destructive-subtle`, `border-destructive-border`; `Badge variant="danger"` |
| `--color-warning-*` | `text-warning`, `bg-warning-subtle`, `border-warning-border`; `Badge variant="warning"` |
| `--color-info-*` | `text-info`, `bg-info-subtle`, `border-info-border`; `Badge variant="info"` |
| `--color-risk-low-*` / `--color-risk-moderate-*` / `--color-risk-high-*` / `--color-risk-critical-*` | `risk-low` / `risk-medium` (implementation name for Moderate) / `risk-high` / `risk-critical`, each with a `-subtle` tint |
| `--chart-1` / `--chart-2` / `--chart-grid` | `bg-chart-1` / `bg-chart-2` / `border-chart-grid` |
| `--focus-ring` | global `:focus-visible` outline; `ring-ring` |
| `--radius-sm` / `--radius-lg` / `--radius-full` | `rounded-sm` / `rounded-lg` / `rounded-full` |
| `--text-heading-lg` | `text-heading-lg font-display` (inside `PageHeader`) |
| `--text-display` | `text-display` |
| `--text-heading-sm` | `text-heading-sm` |
| `--text-micro` | `.micro-label`; `tableHeaderMicroClassName` for table headers |
| `--text-table` | `text-[length:var(--text-table-size)]` (as `DataTable` applies it) |
| `--text-body` / `--text-caption` / `--text-button` | `text-sm` / `text-xs` / `text-button` |
| `--spacing-grid-max` / `--spacing-container-max` | `.page` width / `max-w-container-max` |
| `--spacing-gutter-xs` / `--spacing-gutter-sm` | `gap-gutter-xs` / `gap-gutter-sm` |
| `--spacing-header-h-sm` / `--spacing-header-h-md` | `var(--header-h-sm)` / `var(--header-h-md)` |
| `--duration-micro` + `--ease-standard`, `--duration-fast` + `--ease-out-expo` | as the shipped `DataTable` rows and `Button` apply them |

---

## 1. Information architecture and navigation

### 1.1 Routes

| Route | Purpose | Gate (presentation only, D-16) | Page width | Metadata title |
|---|---|---|---|---|
| `/app` | Personal dashboard for every actor. **Unchanged** (D-15). | `assessment-request:read` (layout) | `--spacing-grid-max` | `Dashboard \| IdamBox CSRM` (unchanged) |
| `/app/review` | Analyst dashboard, the parent of the three review queues | `assessment:review` | `--spacing-grid-max` | `Analyst Dashboard \| IdamBox CSRM` |
| `/app/alerts` | Derived alerts, most urgent first | `assessment:review` | `--spacing-grid-max` | `Alerts \| IdamBox CSRM` |
| `/app/reports` | Report index, data-driven from `GET /api/v1/reports` | `assessment:review` | `--spacing-grid-max` | `Reports \| IdamBox CSRM` |
| `/app/reports/[reportKey]` | One report per closed key | `assessment:review` | page content additionally capped at `--spacing-container-max` (§2 Layout width: reading page; UI-D15) | `Risk Exposure Report \| IdamBox CSRM`, `Treatment Performance Report \| IdamBox CSRM`, `Assessment Throughput Report \| IdamBox CSRM`, `Control Effectiveness Report \| IdamBox CSRM` |

Each Phase 7 page checks `can('assessment:review', granted)` before any service call and renders the permission state without issuing an analyst read, exactly as `/app/risks` does with `risk:manage`. Strapi stays authoritative; a Strapi 403 on any analyst read renders the same page-level permission state.

### 1.2 Sidebar and mobile sheet

The navigation keeps its current items and order and gains three analyst items. The two report items form a new "Reports" group that mirrors the catalogue menu paths `Reports:Reports` and `Reports:Alerts`, the same way the existing "Administration" group mirrors `Administration:*`.

| Order | Label | Route | Lucide icon | Capability | Group |
|---|---|---|---|---|---|
| 1 | Workspace | `/app` | `LayoutDashboardIcon` | `assessment-request:read` | primary (unchanged) |
| 2 | My Requests | `/app/requests` | `FileTextIcon` | `assessment-request:read` | primary (unchanged) |
| 3 | My Questionnaires | `/app/questionnaires` | `ClipboardListIcon` | `assessment-request:read` | primary (unchanged) |
| 4 | My Risk Assessments | `/app/assessments` | `ShieldCheckIcon` | `assessment-request:read` | primary (unchanged) |
| 5 | New request | `/app/requests/new` | `FilePlus2Icon` | `assessment-request:create` | primary (unchanged) |
| **6** | **Analyst dashboard** | **`/app/review`** | **`ActivityIcon`** | **`assessment:review`** | **primary (new)** |
| 7 | Assessment Requests | `/app/review/requests` | `InboxIcon` | `assessment:review` | primary (unchanged) |
| 8 | Questionnaires | `/app/review/questionnaires` | `ClipboardCheckIcon` | `assessment:review` | primary (unchanged) |
| 9 | Risk Assessments | `/app/review/assessments` | `ShieldAlertIcon` | `assessment:review` | primary (unchanged) |
| 10 | Risk register | `/app/risks` | `Table2Icon` | `risk:manage` | primary (unchanged) |
| **11** | **Alerts** | **`/app/alerts`** | **`BellIcon`** | **`assessment:review`** | **Reports (new)** |
| **12** | **Reports** | **`/app/reports`** | **`FileChartColumnIcon`** | **`assessment:review`** | **Reports (new)** |
| 13–16 | Risk Types, Controls, Information Systems, Information Assets | `/app/admin/*` | unchanged | `administration:manage` | Administration (unchanged) |

- "Analyst dashboard" sits directly above the three review queues it is the parent of. It uses `ActivityIcon` because `LayoutDashboardIcon` already marks Workspace; two identical icons would make the two dashboards indistinguishable when scanning.
- Alerts precede Reports inside the group: alerts are actionable, reports are read-only.
- The "Reports" group renders exactly like "Administration": `role="group"`, `aria-label="Reports"`, a `.micro-label` heading in `--color-text-inverse-muted`, and the same top divider in `--color-border-on-dark` (§4 AppShell). A group renders only when at least one of its items is visible, so Requestors and Secondary Requestors see no group label and no analyst item.
- Group order: primary, Reports, Administration. `NavigationItem.group` widens from `'Administration'` to `'Reports' | 'Administration'`, and `CapabilityNavigation` renders groups generically instead of hard-coding one.
- No count badges on navigation items: counts would add an analyst read to every page render, and alerts hold no unread state (D-06).
- Icons stay `aria-hidden` beside visible labels (§4 Iconography). Item metrics, colours and the active bar are the shipped `.nav-link` treatment (§4 AppShell), unchanged.

### 1.3 Active state

Exactly one navigation link carries `aria-current="page"`: the visible item whose `href` is the longest match of the current pathname at a path-segment boundary. `/app` matches only itself, as today.

| Pathname | Current item |
|---|---|
| `/app/review` | Analyst dashboard |
| `/app/review/requests/{id}` | Assessment Requests (not Analyst dashboard; the existing prefix rule would mark both) |
| `/app/alerts?urgency=overdue` | Alerts |
| `/app/reports/risk-exposure` | Reports |
| `/app/requests/new` | New request only (the same rule removes the existing double-current state with My Requests) |

### 1.4 Mobile navigation sheet

- The sheet renders the same `CapabilityNavigation`, groups included, and closes on navigation with focus restored to the trigger (unchanged behaviour and tests).
- The three new items and one group label push the analyst's sheet taller than a 375 × 667 viewport. `.sheet-content` currently has no overflow rule, so its lower items and the role switcher would be unreachable. The sheet content therefore scrolls vertically within the sheet (`overflow-y: auto`, `overscroll-behavior: contain`), keeps `--focus-ring-inverse`, and every item and the role switcher stay reachable by touch and keyboard at 375 × 667.

### 1.5 Route boundaries

`app/(app)/app/loading.tsx` and `error.tsx` render the Requestor dashboard's "Dashboard" header and skeleton. Next.js wraps every child segment without its own boundary in the nearest parent's `loading.js` (see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`). Every Phase 7 route (`/app/review`, `/app/alerts`, `/app/reports`, `/app/reports/[reportKey]`) therefore ships its own `loading.tsx` and `error.tsx`, so no Phase 7 page ever flashes the Requestor dashboard. The existing review children keep their own boundaries.

---

## 2. Analyst dashboard (`/app/review`)

### 2.1 Page header

`PageHeader` with title `Analyst dashboard` and description `Review queues, Risk exposure, due dates and alerts across your authorised scope.` No header action: the tiles are the entry points, and a header button would compete with them.

### 2.2 Composition and focal point

The page answers "what needs me now?" within three seconds, in the order `07-CONTEXT.md` (Specific Ideas) sets: action counts, then Risk exposure, then time-bound work, then alerts and activity.

1. **KPI strip "Needs action"**: four tiles. This is the focal point. The first tile, "Requires my attention", is the primary anchor (§4 KPI tiles: top-left is most important).
2. **Widget grid** of seven cards, in this DOM and reading order:
   1. Review queue
   2. Risk exposure
   3. High and Critical residual Risks
   4. Treatments due
   5. Upcoming due dates
   6. Top alerts
   7. Recent activity (spans the full grid width from `lg`)

Visual hierarchy: serif page title, then the `--text-display` tile values, then `--text-heading-sm` widget titles, then row content. Nothing else on the page uses display-size type, so the four tile values are what the eye reads first. Widget headers carry no display-size count (the Requestor widgets do; here the strip owns the counts).

```
1440                                                          375
┌ Analyst dashboard ─────────────────────────────────────┐    ┌ Analyst dashboard ──┐
│ description                                            │    │ description         │
├─────────────┬─────────────┬─────────────┬──────────────┤    ├─────────────────────┤
│ REQUIRES MY │ OVERDUE     │ DUE WITHIN  │ NEEDS        │    │ REQUIRES MY ATTENT… │
│ ATTENTION  >│            >│ 14 DAYS    >│ ATTENTION   >│    │ 7                 > │
│ 7           │ 3           │ 5           │ 2            │    ├─────────────────────┤
├─────────────┴──────┬──────┴─────────────┴──────────────┤    │ OVERDUE  3        > │
│ Review queue       │ Risk exposure                     │    │ … (1 column)        │
├────────────────────┼───────────────────────────────────┤    ├─────────────────────┤
│ High and Critical  │ Treatments due                    │    │ Review queue        │
│ residual Risks     │                                   │    │ Risk exposure       │
├────────────────────┼───────────────────────────────────┤    │ High and Critical…  │
│ Upcoming due dates │ Top alerts                        │    │ Treatments due      │
├────────────────────┴───────────────────────────────────┤    │ Upcoming due dates  │
│ Recent activity (full width)                           │    │ Top alerts          │
└────────────────────────────────────────────────────────┘    │ Recent activity     │
                                                              └─────────────────────┘
```

### 2.3 KPI strip "Needs action"

A `<section>` labelled by a visually hidden `h2` "Needs action", containing a `<ul>` of four `KpiTile`s (§5.1). Every tile links to a list whose total is computed with exactly the tile's predicate (D-18, D-24).

| # | Caption (sentence case; rendered uppercase by `.micro-label`) | Caption icon | Value | Supporting line | Link target |
|---|---|---|---|---|---|
| 1 | `Requires my attention` | `InboxIcon`, `--color-text-muted` | Assessment Requests in the `requires-attention` bucket (D-21 shared definition) | `Assessment Requests in your review queue` | `/app/review/requests` |
| 2 | `Overdue` | `CalendarX2Icon`, danger fg | Alerts with urgency `overdue` (D-12 predicate) | `Past a due, target or review date` | `/app/alerts?urgency=overdue` |
| 3 | `Due within {N} days` | `CalendarClockIcon`, warning fg | Alerts with urgency `due-soon` | `Upcoming due, target or review dates` | `/app/alerts?urgency=due-soon` |
| 4 | `Needs attention` | `FlagIcon`, info fg | Alerts with urgency `attention` | `Untreated Critical Risks and ineffective Control Implementations` | `/app/alerts?urgency=attention` |

- `{N}` is the due-soon window the server sends (D-04 default 14). The web never hard-codes it.
- Caption icons use the urgency icon set (§5.4), so each tile visibly matches the badges on the list it opens. Icon and caption text both carry the meaning; the icon colour only reinforces it.
- No tile shows a delta or sparkline (UI-D6).
- Zero renders as `0` and the tile still links; the list then shows its empty state, and the tile and list totals still agree.

### 2.4 Widget anatomy (all seven widgets)

- **Frame:** the shipped Requestor `ActionWidget` frame: `Card` on `--color-bg-surface`, a `--color-border-default` hairline, `--radius-lg`, §4 Cards padding at the value those widgets use, no shadow. The card is an `@container`, so its rows adapt to their own width (UI-D14).
- **Header:** a Lucide icon at §4 Iconography control size in `--color-text-muted` (`aria-hidden`), an `h2` in `--text-heading-sm`, then a one-line description in `--text-body` / `--color-text-secondary`. No count in the header.
- **Body:** rows separated by `--color-border-default` hairlines (the shipped `DashboardItem` rhythm), or a bar list (§5.2), or a compact state primitive.
- **Footer (only when present):** a truncation note in `--text-caption` / `--color-text-secondary` with tabular numerals, `Showing {n} of {total}`, rendered only when the server marks the list truncated (D-03). Then one or two destination links as `Button variant="link"` text links. A footer link opens the list with exactly the widget's predicate, so `{total}` equals that list's total.
- **Link rows** (queue rows, exposure bars): the whole row is one `<a>` with a trailing `ChevronRightIcon` in `--color-text-muted` (`aria-hidden`) as the at-rest link cue (X-13). Minimum row height is the §4 DataTable default row height. Hover is `--color-bg-hover` at `--duration-micro` / `--ease-standard`. Rows never lift.
- **Record rows:** the record identifier is the row's single link, via `RecordLink` (06.4 rule: one keyboard target per record surface). Titles and statements are plain text, clamped to two lines, and remain whole in the DOM.
- **Row layout by container width:** below the `@md` container size, a row stacks its lines and badges wrap beneath the text. From `@md`, badges and dates align to the end of the first line.
- **Row caps** are named server constants (D-03). Recommended: 5 rows per widget and 8 for Recent activity.

### 2.5 Widgets

| # | Heading | Icon | Description | Body | Footer |
|---|---|---|---|---|---|
| 1 | `Review queue` | `InboxIcon` | `Assessment Requests by queue, and Questionnaires and Risk Assessments by status.` | Three groups, each an `h3` `.micro-label` followed by a `<ul>` of link rows (label, count): **Assessment Requests**: `Requires my attention` → `/app/review/requests`; `Awaiting Requestor` → `/app/review/requests?queue=awaiting-requestor`; `Generation in progress` → `/app/review/requests?queue=generation-in-progress`. **Questionnaires**: `Submitted` → `/app/review/questionnaires?status=submitted`. This row counts every Questionnaire with a submitted answer, finished work included, so it is a count of that list and never labelled as work awaiting review (UI-D21). **Risk Assessments**: `Draft` → `/app/review/assessments?status=draft`; `In review` → `/app/review/assessments?status=in-review`. Every row always renders, including zero. | none (every row is a link) |
| 2 | `Risk exposure` | `ChartBarIcon` | `Open contextual Risks by residual rating.` | `BarChart` in `labelled-values` presentation (§5.2), one link row per rating, ordered Critical, High, Moderate, Low (UI-D5). Labels are `RiskRatingBadge`s; bars use the rating's severity fill (X-6). Each row → `/app/risks?residualRating={Rating}&state=open` (UI-D1). A `Not rated` row (plain text label, ink bar, not a link) appears only when its count is above zero. | none (rows are links) |
| 3 | `High and Critical residual Risks` | `Table2Icon` | `Open Risks rated High or Critical after treatment, highest first.` | Record rows: `RecordLink` riskNumber; statement; `RiskRatingBadge` (residual); target-date line (`Target date {date}` or `No target date`, plus the overdue marker of §9 item 4 when D-04 says overdue). Order: Critical before High, then target date ascending (none last), then riskNumber. | `Showing {n} of {total}`; link `Open Risk Register` → `/app/risks?state=open&sort=residualRating:desc` (UI-D1) |
| 4 | `Treatments due` | `TimerIcon` | `Risk treatments past their target date or due within {N} days, most overdue first.` | Shared alert rows (§3.5) for kinds `risk-treatment-overdue` and `risk-treatment-due-soon`, in alert order (§3.3). | `Showing {n} of {total}`; links `View overdue treatments` → `/app/alerts?kind=risk-treatment-overdue` and `View treatments due soon` → `/app/alerts?kind=risk-treatment-due-soon` |
| 5 | `Upcoming due dates` | `CalendarDaysIcon` | `Due, target and review dates in the next {N} days, soonest first.` | Shared alert rows in the agenda variant (§3.5): all urgency `due-soon` alerts, date ascending. | `Showing {n} of {total}`; link `View everything due soon` → `/app/alerts?urgency=due-soon` |
| 6 | `Top alerts` | `BellIcon` | `The most urgent alerts across your scope.` | Shared alert rows (§3.5), any kind, in alert order. | `Showing {n} of {total}`; link `View all alerts` → `/app/alerts` |
| 7 | `Recent activity` | `HistoryIcon` | `Workflow events across your review scope, newest first.` | Activity rows (§2.5.1). | `Showing the {n} most recent events` when truncated; no link (there is no activity page) |

Widgets 4, 5 and 6 overlap by design (UI-D3): each widget's description states its predicate, and each footer opens exactly that predicate.

#### 2.5.1 Activity rows

Each row reads `{identifier link} {event phrase}`, then the date aligned to the end from `@md`, then a secondary line `{record type} · {title}` in `--text-caption`, clamped to one line. Dates are absolute, en-AU, UTC (`24 Sept 2026`), never relative (UI-D18). The identifier links to the analyst route for its record.

| Activity kind | Event phrase after the identifier | Governing fact |
|---|---|---|
| `request-submitted` | `submitted by {requestor}` | request `submittedDate` |
| `request-returned-to-draft` | `returned to draft by {revertedBy}` | request `revertedAt` |
| `questionnaire-generated` | `draft generated for Security Analyst review` | questionnaire `generatedDate` |
| `questionnaire-released` | `released to the Requestor by {releasedBy}` | questionnaire `releasedAt` |
| `questionnaire-returned-to-draft` | `returned to draft by {revertedBy}` | questionnaire `revertedAt` |
| `assessment-draft-generated` | `draft generated for Security Analyst review` | assessment `generatedDate` |
| `assessment-released` | `released by {approvedBy}` | assessment `approvalDate` |

When the actor is unknown, ` by {name}` is omitted. The planner may drop a kind whose facts do not exist; it may not invent an actor, verb or date. Generated drafts are never described as approved, released or final: AI output is advisory, and "released" always names the Security Analyst who released it.

### 2.6 Layout

The shell hides the sidebar below the `lg` breakpoint. Content is therefore narrower at 1024 than at 768, and page grids follow the viewport while widget internals follow their own container (UI-D14).

| Viewport | Shell | KPI strip | Widget grid | Widget rows |
|---|---|---|---|---|
| 375 | drawer, `--spacing-gutter-xs` | 1 column | 1 column | stacked (below `@md`) |
| 768 | drawer, `--spacing-gutter-sm` | 2 columns | 1 column, full width | end-aligned badges (`@md` and up) |
| 1024 | sidebar, `--spacing-gutter-md` | 2 columns | 2 columns (as the Requestor dashboard's `lg:grid-cols-2`) | stacked (each column is narrower than `@md`) |
| 1440 | sidebar, `--spacing-gutter-md`, `--spacing-grid-max` | 4 columns | 2 columns; Recent activity spans both | end-aligned badges |

- KPI grid: 1 column below `sm`, 2 columns from `sm`, 4 columns from `xl`.
- Within a row of tiles, captions, values and supporting lines align on shared lines, so a wrapped caption never pushes one tile's value below its neighbours'. Use CSS subgrid on the tile list, or an equivalent.
- Grid gaps are `--spacing-gutter-xs` below `sm` and `--spacing-gutter-sm` from `sm` (§3.9 grid gap). The strip and the widget grid are separated by the §3.9 section rhythm at its upper bound.
- There is no horizontal page scroll at any width from 320 to 1440.

### 2.7 Data the dashboard needs

Field names are the planner's (D-02, Discretion). The UI requires these facts, each computed server-side with the predicate of the list it opens:

| UI element | Facts required |
|---|---|
| KPI strip | requires-attention bucket count; alert counts by urgency; due-soon window in days |
| Review queue | the three non-released bucket counts; Questionnaires count matching the review list's `status=submitted` predicate; Risk Assessment counts matching `status=draft` and `status=in-review` |
| Risk exposure | open contextual Risk counts by residual rating, plus not-rated |
| High and Critical residual Risks | top rows (riskNumber, documentId, statement, residual rating, target date, overdue flag from the D-04 rule) plus the exact total and a truncated flag |
| Treatments due, Upcoming due dates, Top alerts | alert rows (§3.2) plus exact total and truncated flag, each over its stated predicate |
| Recent activity | activity rows (kind, record type, documentId, identifier, title, actor display name or null, date) plus a truncated flag |

Each section may independently be unavailable (§6.2).

---

## 3. Alerts (`/app/alerts`)

### 3.1 Page header

`PageHeader` with title `Alerts` and description `Overdue work, approaching dates and Risks that need attention, most urgent first. Alerts clear when the underlying record changes.` The second sentence explains why there is no dismiss or acknowledge action (D-06). No header action.

**Focal point:** the Urgency column of the first rows. The list is sorted most urgent first, so the leftmost coloured badges read top-down as a triage order, and the condition sentence beside them says what is wrong in words.

### 3.2 Alert vocabulary

**Urgency** (closed, D-11). Presentation lives in `AlertUrgencyBadge` (§5.4).

| Value | Label | Status tokens | Icon |
|---|---|---|---|
| `overdue` | `Overdue` | §3.5 danger (`Badge variant="danger"`) | `CalendarX2Icon` |
| `due-soon` | `Due soon` | §3.5 warning (`Badge variant="warning"`) | `CalendarClockIcon` |
| `attention` | `Needs attention` | §3.5 info (`Badge variant="info"`) | `FlagIcon` |

**Kinds** (closed, D-10). The filter label, the condition sentence and the governing-date label. `{n}` is the whole-day distance between the governing date and the server's `today`, carried in the DTO (D-02) and never computed in the browser. Singular form when `{n}` is 1: `1 day`.

| Kind | Alert type label (filter and chip) | Urgency | Condition sentence | Date label |
|---|---|---|---|---|
| `risk-treatment-overdue` | `Treatment overdue` | overdue | `Treatment overdue by {n} days` | `Target date` |
| `risk-treatment-due-soon` | `Treatment due soon` | due-soon | `Treatment due today` when `{n}` is 0; otherwise `Treatment due in {n} days` | `Target date` |
| `request-overdue` | `Request overdue` | overdue | `Request overdue by {n} days` | `Due date` |
| `request-due-soon` | `Request due soon` | due-soon | `Request due today` / `Request due in {n} days` | `Due date` |
| `control-implementation-overdue` | `Control Implementation overdue` | overdue | `Control Implementation overdue by {n} days` | `Implementation due` |
| `assessment-review-due` | `Risk Assessment review due` | overdue when past, due-soon within the window | `Review overdue by {n} days`; `Review due today` / `Review due in {n} days` | `Next review` |
| `critical-residual-risk-untreated` | `Critical Risk not treated` | attention | `Critical residual Risk with treatment not started` | `Identified` |
| `ineffective-control` | `Ineffective Control Implementation` | attention | `Control Implementation rated Ineffective` | `Last reviewed` |

- A null governing date renders `No date recorded`.
- The attention kinds' date labels assume the plan governs them by the Risk's `identifiedDate` and the Control Implementation's `reviewDate`. If the plan picks other fields, it updates this map in the same change.
- Sentences and labels are produced by a pure, unit-tested presentation module (for example `features/alerts/alert-presentation.ts`), never assembled in JSX.

**Source record presentation.** The link is always actor-correct for a Security Analyst.

| Source type | Link text | Link target | Secondary text |
|---|---|---|---|
| Risk | `riskNumber` | `/app/risks/{documentId}` | `Risk · {riskStatement}` |
| Assessment Request | `requestNumber` | `assessmentRequestHref('analyst', documentId)` → `/app/review/requests/{documentId}` | `Assessment Request · {title}` |
| Risk Assessment | `assessmentNumber` | `/app/review/assessments/{documentId}` | `Risk Assessment · {title}`, or `Risk Assessment` alone when there is no title |
| Control Implementation | parent Risk's `riskNumber` | `/app/risks/{riskDocumentId}#mitigation-controls` (§9 item 5) | `Control Implementation · {controlNumber} {controlName}` |

For Risk and Control Implementation sources the DTO carries the (parent) Risk's residual rating, which renders as `RiskRatingBadge` beside the urgency badge, or `Not rated` when null (D-11). Other sources render `Not applicable`. Urgency and severity are separate columns with separate headers, badge shapes, icons and token families, and are never merged.

### 3.3 Filters, sort and pagination

- **Filters** use the house list pattern: labelled native selects with `nativeSelectClassName`, plus `DataTable` filter chips and `Clear filters`.
  - `Alert type` (`aria-label="Filter by alert type"`): `All alert types`, then the eight labels in the table order above.
  - `Urgency` (`aria-label="Filter by urgency"`): `All urgencies`, `Overdue`, `Due soon`, `Needs attention`.
  - A change resets to page 1 and replaces the URL (`?kind=`, `?urgency=`, `?page=`, `?pageSize=`), as the review lists do. Unknown values parse to "all", as the register's enum filters do.
  - Chips read `Alert type: {label}` and `Urgency: {label}`, each removable, with `Clear filters` shown only while a filter is active.
  - These stay selects rather than a segmented control: every list filter in the product is a select, including the four-option Queue select. The ≤4 rule is a preference in §4 Forms (UI-D10).
- **Sort** is server-owned and fixed (D-12): urgency (`overdue`, `due-soon`, `attention`), then governing date ascending, so the most overdue or soonest due comes first. Undated alerts come last within their urgency, and ties break on the source identifier. There are no sortable headers, because `DataTable` receives no `onSortingChange`. The description says "most urgent first".
- **Pagination:** the `DataTable` footer with rows per page `10`, `25` (default) and `50`. The result count is the server total. An out-of-range page navigates to the last page, as the register does.

### 3.4 Desktop table (`md` and up)

`DataTable` with `ariaLabel="Alerts"`, `loadingLabel="Loading alerts"`, and density toggle and pagination unchanged.

| Column header | Cell | Alignment |
|---|---|---|
| `Urgency` | `AlertUrgencyBadge` | start |
| `Residual rating` | `RiskRatingBadge`, `Not rated`, or `Not applicable` (`--color-text-secondary`) | start |
| `Condition` | condition sentence, `--text-table` | start; wraps |
| `Record` | `RecordLink` identifier, then the secondary text in `--text-caption` / `--color-text-secondary`, clamped to one line | start (identity numerals); wraps |
| `Date` | the date (`--text-table`, tabular, `<time dateTime>`), then the date label in `--text-caption` | start |

The shared `TableCell` sets `white-space: nowrap`, so the Condition and Record cell content opts back into wrapping (`whitespace-normal`). The table then fits the content column at 768 and at 1024 (the narrowest desktop widths, §2.6) without horizontal scrolling. Urgency, rating and date stay unwrapped.

### 3.5 Mobile cards and the shared alert row

Below `md`, `DataTable` renders one card per alert. Its content is the **shared alert row**, which is also used by dashboard widgets 4, 5 and 6 and the treatment-performance list:

```
[Urgency badge] [Residual rating badge]          (wraps; beside each other)
Condition sentence                               --text-body, 500
RSK-2026-B2QDZ6                                  RecordLink; standalone tap height below md
Risk · Third-party dependency may reduce…        --text-caption, secondary, clamp 2
Target date · 30 Oct 2026                        --text-caption, secondary, tabular
```

- From the `@md` container size the row becomes two lines: condition sentence with the badges end-aligned, then identifier and secondary text with the date end-aligned.
- **Agenda variant** (widget 5): the date replaces the urgency badge as the first element (`--text-body` 500, tabular), because every row in that widget is due soon. The residual rating badge stays for Risk sources.

### 3.6 Layout

| Viewport | Filters | List |
|---|---|---|
| 375 | stacked, full width, labels above | cards (`DataTable` mobile) |
| 768 | side by side, labels above, each at the house select minimum width | desktop table, wrapping Condition and Record |
| 1024 | as 768 | as 768 |
| 1440 | as 768 | desktop table across `--spacing-grid-max` |

---

## 4. Reports

### 4.1 Reports index (`/app/reports`)

- `PageHeader` with title `Reports` and description `Read-only reports computed from current records in your authorised scope.`
- **Focal point (index):** the report titles, the only `--text-heading-sm` text on the page. **Focal point (detail):** the KPI strip, then the first section's chart.
- Body: a `<ul>` of report cards, one per definition returned by `GET /api/v1/reports`, in server order. It is data-driven (D-13) and renders only the four known keys.
- Card anatomy, in the widget frame: an `h2` in `--text-heading-sm` containing a link whose text is the report title and whose `href` is `/app/reports/{key}`; a trailing `ChevronRightIcon` in `--color-text-muted` (`aria-hidden`, X-13); the description below in `--text-body` / `--color-text-secondary`.
  - The link's pseudo-element stretches over the card, so the whole card is the hit area with one tab stop (06.4 overlay pattern).
  - Hover moves the card border to `--color-border-ink` and applies the §4 Cards link-card lift at `--duration-fast` / `--ease-out-expo`.
  - The card shows `--focus-ring` when its link has keyboard focus (`:has(:focus-visible)`).
  - The title link is not a `RecordLink`: a report is not a record, and `RecordLink`'s fixed weight is not a §3.10 pair at heading size.
- Grid: 1 column below `md`, 2 columns from `md`, gaps as §2.6.

### 4.2 Report detail frame (`/app/reports/[reportKey]`)

Top to bottom:

1. `Breadcrumb`: `Reports` (link to `/app/reports`) › report title (current page), as on administration detail pages.
2. `PageHeader`: the report title and description (§7.4). Its action slot holds the period control, for `assessment-throughput` only (§4.5).
3. As-at line: `Computed from current records as at {date}.` in `--text-caption` / `--color-text-secondary`, with `<time dateTime>`. `{date}` is the server's `today` (D-02), formatted en-AU in UTC.
4. KPI strip (`KpiTile`s, §5.1), a `<section>` labelled by a visually hidden `h2` "Summary". 1 column below `sm`; from `sm`, one column per tile (2 or 3).
5. Report sections (§4.3), separated by the §3.9 section rhythm at its upper bound.

- The page header and the body share the `--spacing-container-max` cap (UI-D15).
- A closed key-to-copy map in the web layer (§7.4) supplies titles, descriptions and metadata titles, so the header renders before data resolves. The server's report definitions must return identical strings, enforced by a contract test.
- Unknown keys call `notFound()`, rendered by the route's own `not-found.tsx` (§7.5). The capability check runs first, so a Requestor sees the permission state for any key, valid or not. Valid keys are never disclosed.

### 4.3 Report section anatomy

- The same `Card` frame as a widget, because severity must render on a white surface and never on the canvas (§3 rule 1, §3.6). The card is an `@container`.
- Header: an `h2` in `.micro-label` (`--text-micro`, in `--color-text-muted`; the "micro-label section captions" the operator asked for), then a one-line description in `--text-body` / `--color-text-secondary` stating the measure and population.
- Body: the chart (`BarChart`, `figure-with-table` presentation, `aria-hidden`), then its visible text equivalent: a semantic `<table>`.
  - The table has a visually hidden `<caption>` repeating the section caption, `<th scope="col">` headers in `tableHeaderMicroClassName`, category cells as `<th scope="row">` (`--text-table` 500), numbers right-aligned and tabular, and hairline row dividers. There is no hover, because rows are static.
  - Below the `@4xl` container size, the table sits below the chart. From `@4xl`, the chart and the table sit side by side (chart first), separated by `--spacing-gutter-sm`.
- Bounded record lists (the most overdue treatments) use the shared alert row (§3.5), not a table, in both reports and the dashboard (UI-D11).
- A section whose population is zero shows a compact empty state (§6.1) in place of the chart and table. A time series never collapses to an empty state: zero months are data.

### 4.4 The four reports

`{M}` is the report's due window (server constant, D-13 says 30). `{period}` is the throughput period (§4.5).

**`risk-exposure`**. The population is open contextual Risks: no `closureDate` (UI-D1).

| Element | Contract |
|---|---|
| KPI tiles | `Open contextual Risks` (total) → `/app/risks?state=open`; `Critical residual` → `/app/risks?residualRating=Critical&state=open`; `High residual` → `/app/risks?residualRating=High&state=open`. All three links depend on UI-D1; under its fallback they drop `state=open` and the captions drop "Open". |
| Section `Inherent and residual rating` | Small multiples: two `BarChart`s captioned `Inherent` and `Residual` (`.micro-label`), side by side from the `@xl` container size and stacked below it. They share one scale (`scaleMax` is the larger maximum), use horizontal bars with `RiskRatingBadge` labels and severity fills, and are ordered Critical to Low, with `Not rated` last when above zero. One table: `Rating` \| `Inherent` \| `Residual`. |
| Section `Residual rating by treatment status` | Table only, because a rating-by-status matrix needs more than two series (§3.14). Rows: Critical to Low, then `Not rated`. Columns: `Residual rating` \| `Not Started` \| `In Progress` \| `Overdue` \| `Complete` \| `Not provided` \| `Total`. Status headers are the stored enum values, as the register shows them. The description adds `Treatment status is the value recorded on each Risk. Overdue by target date is in the Treatment performance report.` When the table is wider than its container it scrolls inside a labelled, keyboard-focusable region with a sticky first column (§4 DataTable horizontal scroll rule). The page never scrolls. |
| Section `Most exposed Information Systems` | Horizontal ink bars of each system's open High plus Critical residual Risk total, top `N` (named constant, recommended 10), highest first, with plain-text system names. Table: `Information System` \| `Critical` \| `High` \| `Total`. Notes, when they apply: `Showing the top {n} of {total} Information Systems.` and `{n} High or Critical residual Risks have no impacted Information System.` System names are plain text (UI-D17). |

**`treatment-performance`**. The population is open contextual Risks whose treatment is not `Complete`; due state follows D-04.

| Element | Contract |
|---|---|
| KPI tiles | `Overdue` → `/app/alerts?kind=risk-treatment-overdue` (same D-04 predicate); `Due within {M} days` (not linked: no list has this window); `No target date` (not linked) |
| Section `Due state` | Ink horizontal bars in fixed order: `Overdue`, `Due within {M} days`, `Due later`, `No target date`. Table: `Due state` \| `Risks`. |
| Section `Treatment status` | Ink horizontal bars: `Not Started`, `In Progress`, `Overdue`, `Complete`, `Not provided`. The population for this section is all open contextual Risks, and the description says so. Table: `Treatment status` \| `Risks`. |
| Section `Most overdue treatments` | Shared alert rows, kind `risk-treatment-overdue`, oldest target date first, top `N`. Footer: `Showing {n} of {total}` and link `View overdue treatments` → `/app/alerts?kind=risk-treatment-overdue`. |

**`assessment-throughput`**

| Element | Contract |
|---|---|
| Period control | §4.5, in the header action slot |
| KPI tiles | `Released in period` with supporting line `{start month} to {end month}` (for example `April 2026 to September 2026`), not linked. `Median days to release` with supporting line `Across {k} releases with a submission date`, not linked. When the median is null the value renders `Not available` and the supporting line reads `No release in this period has a submission date.` |
| Section `Released per month` | Column chart from the `@md` container size, horizontal bars below it (months as rows, oldest first). Ink columns. The current month is the last column, marked partial (X-7). Month labels are `.micro-label` en-AU short months (`Sept`). Value labels sit above the columns in `--text-caption` 500. The baseline is a `--chart-grid` hairline. A legend appears only when a partial month exists: a dashed swatch at badge-icon size plus `Current month to date` in `--text-caption`. Table: `Month` \| `Released`, with full month names and years; the partial row reads `{Month Year} (to date)`. The description names the range: `Risk Assessments released by a Security Analyst in each calendar month, {start month} to {end month}.` |
| Section `Assessment Requests by lifecycle state` | Ink horizontal bars, one per request status in `requestStatuses` order, using `requestStatusPresentation` labels (`Draft` … `Closed`), zeros included. Statuses outside the analyst's scope are not returned and so not rendered. Description: `Current state of every Assessment Request in your review scope. Not limited to the period.` Table: `Lifecycle state` \| `Assessment Requests`. |

**`control-effectiveness`**. The population is Control Implementations on open contextual Risks, the same scope as the `ineffective-control` alert.

| Element | Contract |
|---|---|
| KPI tiles | `Control Implementations` (total, not linked: no list exists); `Rated Ineffective` → `/app/alerts?kind=ineffective-control` |
| Section `Implementation status` | Ink horizontal bars: `Existing`, `Planned`, `Implemented`, `Retired`, `Not provided`. Table: `Implementation status` \| `Control Implementations`. |
| Section `Effectiveness rating` | Ink horizontal bars: `Effective`, `Partially Effective`, `Ineffective`, `Not Assessed`, `Not provided`. Effectiveness is not the §3.6 severity ladder, so these bars are ink. Table: `Effectiveness rating` \| `Control Implementations`. |

**Chart choice summary**

| Report · section | Chart | Why |
|---|---|---|
| risk-exposure · inherent and residual | horizontal bars, severity fills, small multiples | categorical ladder with badge labels; shared scale compares honestly |
| risk-exposure · by treatment status | none (table) | a matrix would need more than two series |
| risk-exposure · Information Systems | horizontal bars, ink | ranked categories with long names |
| treatment-performance · due state, status | horizontal bars, ink | categorical |
| assessment-throughput · per month | columns from `@md`, bars below | a time series reads left to right; twelve labelled columns cannot fit the phone-width content column |
| assessment-throughput · lifecycle | horizontal bars, ink | categorical, process order |
| control-effectiveness · both | horizontal bars, ink | categorical |

Status hues never fill a chart mark. Charts are ink, or severity where the category is a Risk rating (§2 Stripe: "charts are ink + severity only"; X-8). No Phase 7 chart has more than one series, so no dash or pattern series is needed. Only the partial month uses a dash (X-7).

### 4.5 Period control (`assessment-throughput`)

- A `SegmentedControl` (§5.3) labelled `Period`, with options `6 months` (default) and `12 months`. URL state is `?period=6|12`; an absent or invalid value means 6 (UI-D8).
- The period applies to `Released in period`, `Median days to release` and `Released per month`. `Assessment Requests by lifecycle state` is a current snapshot and says so.
- A change replaces the URL and the page re-renders server-side. Focus stays on the checked segment. While the transition is pending, the report body has `aria-busy="true"`. No spinner.
- Placement: the `PageHeader` action slot, at the end on desktop. Below `md` it stacks under the description at full width, and the segments share the width equally.

### 4.6 Layout

| Viewport | Index | Detail |
|---|---|---|
| 375 | 1 column of cards | breadcrumb wraps; period control full width; tiles 1 column; chart above table; months as bars; cross-tab scrolls inside its region |
| 768 | 2 columns | tiles in one row; chart above table; month columns; small multiples side by side (section wider than `@xl`) |
| 1024 | 2 columns | as 768 (the sidebar makes content narrower than at 768) |
| 1440 | 2 columns | tiles in one row; chart beside table (section wider than `@4xl`) |

---

## 5. Shared primitives (`apps/web/src/components/csrm/`)

### 5.1 `KpiTile`

**Consumers:** the analyst dashboard (4 tiles) and all four reports (D-20).

| Aspect | Contract |
|---|---|
| Props (names indicative) | `caption: string` (sentence case), `value: number \| null`, `supportingText?: string`, `href?: string`, `icon?: LucideIcon`, `iconTone?: 'muted' \| 'danger' \| 'warning' \| 'info'` |
| Anatomy (§4 Cards / KPI tiles) | 1. Caption row: optional icon at badge-icon size, then the caption in `.micro-label` / `--color-text-muted`, and for link tiles a trailing `ChevronRightIcon` at the end. 2. Value in `text-display`, tabular, `--color-text-primary`, formatted with `Intl.NumberFormat('en-AU')`. 3. Reserved delta position, not rendered in Phase 7 (UI-D6). 4. Optional supporting line in `--text-caption` / `--color-text-secondary` (X-10). |
| Surface | `--color-bg-surface`, a `--color-border-default` hairline, `--radius-lg`, §4 Cards padding, no shadow |
| Link tile | The whole tile is one `<a>`; its accessible name comes from content in DOM order (caption, value, supporting line). No `aria-label` on inner spans. Hover: border to `--color-border-ink` and the §4 Cards link-card lift at `--duration-fast` / `--ease-out-expo`. Focus: `--focus-ring` around the tile. |
| Plain tile | A `<div>` with no hover, lift or chevron, so linked and unlinked tiles are distinguishable at rest. |
| Unavailable | A `null` value renders `Not available` in `--text-body` / `--color-text-secondary`, never at display size, a dash or a zero. |
| Zero | Renders `0`; never hidden. |
| Loading | `KpiTileSkeleton`: the same frame with `Skeleton` blocks sized to the caption line, the display line and the supporting line. |
| List semantics | A strip is a `<ul>` of `<li>` tiles, so assistive technology announces the count. |

### 5.2 `BarChart`

**Consumers:** the dashboard (Risk exposure) and all four reports (D-20). It is HTML, not SVG: real text keeps §3.10 typography, zoom and reflow, and the conformance scan can read it.

| Aspect | Contract |
|---|---|
| Props (names indicative) | `data: { key; label: ReactNode; labelText: string; value: number; tone?: 'ink' \| 'risk-low' \| 'risk-moderate' \| 'risk-high' \| 'risk-critical'; partial?: boolean; href?: string }[]`, `orientation: 'bar' \| 'column'`, `scaleMax?: number`, `unit: { one; other }`, `labelledBy` or `ariaLabel`, `presentation: 'labelled-values' \| 'figure-with-table'` |
| Bar row (`orientation="bar"`) | Two lines at every width: the label (text or `RiskRatingBadge`) and the value (`--text-body` 500, tabular, end-aligned) on the first line; the bar beneath, spanning the row. Bar thickness is X-1. Marks have square ends (X-5). There is no track and no gridlines: the direct label replaces the axis. |
| Column (`orientation="column"`) | Plot height X-2; column width is its slot less a 4px-scale gap, capped at X-3; value label above in `--text-caption` 500; category label below in `.micro-label`; a `--chart-grid` hairline baseline. Below the `@md` container size a column request renders as bars. |
| Scale | Linear from zero to `scaleMax` (default: the largest value). A non-zero value never renders shorter than X-4. Zero renders no mark; its direct label reads `0`. Every category renders, in the order given. |
| Fills | `ink` → `--chart-1`; `risk-*` → the rating's §3.6 `fg` token (X-6: the `bg` tints fail WCAG 1.4.11 on white). `partial` → no fill, dashed `--chart-1` hairline outline (X-7). No other hue. |
| `labelled-values` (dashboard) | A `<ul>` named by `labelledBy` or `ariaLabel`. Each `<li>` exposes its label and value as text; the mark is `aria-hidden`. With `href`, the row is one `<a>` named `{labelText}: {value} {unit}` (for example `Critical residual rating: 2 open Risks`), which contains the visible label and value (SC 2.5.3). It has a trailing chevron and the link-row hover of §2.4. **Amended 2026-09-26 (Phase 8 UI review, verdict 2):** the exposure rows ship named `{Rating}: {n} open {Risk|Risks} by residual rating`, for example `Critical: 2 open Risks by residual rating`. The name as first written put `residual rating` between the visible rating and its count, so it did not begin with the link's visible words, which axe `label-content-name-mismatch` reports (Phase 8 plan 08-12); the residual qualifier now follows the count. |
| `figure-with-table` (reports) | The chart container is `aria-hidden="true"` and may contain no focusable element (`href` is rejected by type). The section's visible `<table>` is the text alternative (D-19). |
| Motion | None. Marks render at their final size, with no entrance, stagger or transition (§5, §6 item 8). |
| Legend | Only for the partial-month marker (§4.4). Series are identified by direct labels. |

### 5.3 `SegmentedControl`

**Consumer:** the `assessment-throughput` period (§4.5). It lives in `components/csrm` because §4 Forms names segmented controls as a house pattern (X-9).

| Aspect | Contract |
|---|---|
| Semantics | Radix `RadioGroup` root (`role="radiogroup"`) named by a visible label via `aria-labelledby`; each segment is a Radix radio item. Arrow keys move and check (WAI-ARIA radio pattern), and Tab enters and leaves the group once. |
| Shape | A pill group (`--radius-full`) on `--color-bg-surface` with a `--color-border-strong` boundary, because a radio boundary must carry meaning (§4 Forms, WCAG 1.4.11). Segments are pills, separated from the boundary by one small 4px-scale step. |
| States | Checked: `--color-primary` fill, `--color-on-primary` text (§3.4 checked controls). Unchecked: transparent, `--color-text-primary`, hover `--color-bg-hover`. Focus: `--focus-ring`. The state change animates at `--duration-micro` / `--ease-standard`. |
| Size | Segment label in `--text-button`. Height is the §4 Buttons small height from `md`, and the §4 Buttons touch-target height below `md`. |
| Behaviour | Controlled by URL state; a change calls the route's navigate function (`router.replace`). |

### 5.4 `AlertUrgencyBadge`

**Consumers:** Alerts (table and cards) and dashboard widgets 4 and 6.

| Aspect | Contract |
|---|---|
| Recipe | The existing `Badge` variants `danger`, `warning`, `info`: the §4 Status & risk badges rounded rectangle at `--radius-sm`, never a pill, with tinted background, same-hue `fg` text, soft border, a leading icon at badge-icon size and a sentence-case label. |
| Icons | `CalendarX2Icon` (overdue), `CalendarClockIcon` (due soon), `FlagIcon` (needs attention), all `aria-hidden`. None reuses a severity icon (`CircleCheck`, `CircleGauge`, `TriangleAlert`, `OctagonAlert`) or a status icon, so urgency never reads as severity (D-11). |
| Accessible text | A visually hidden prefix `Urgency: ` inside the badge, so cards and rows announce `Urgency: Overdue`. No `aria-label` on the generic element. |
| Dense form | For dense table cells: icon plus label in the urgency `fg` token, with no chip (§4 badges, Linear alternative). Used by the Risk Register overdue marker (§9 item 4). |

---

## 6. Five-state contract

### 6.1 Matrix

Every state renders under the page's real `PageHeader`, and every state is legible at 375 and 1440 (D-17). Error and permission states use the shared primitives, which own `role="alert"` and the locked copy (§4 Empty states).

| Surface | Loading | Empty | Populated | Error | Permission |
|---|---|---|---|---|---|
| Analyst dashboard (page) | `role="status"` region labelled `Loading analyst dashboard` (visually hidden text): 4 `KpiTileSkeleton`s plus 7 widget skeletons (header icon, title and description bars, then 3 row blocks in the row rhythm) | none at page level; widgets own emptiness | §2 | `ErrorState` noun `the analyst dashboard`, `Try again`. No tiles or widgets render. | `PermissionDeniedState` area `the analyst dashboard`, default `Return to workspace` link |
| KPI strip | part of the page skeleton | never empty (zeros are data) | §2.3 | compact `ErrorState` noun `the summary counts`, `Try again`, in place of the four tiles | page-level only |
| Dashboard widget | part of the page skeleton | compact cleared state (X-11), no CTA (§4 "no wall of competing CTAs"); copy in §7.2. Review queue has no empty state (zero rows are data). | §2.5 | compact `ErrorState` with the widget noun (§7.2), `Try again`; header stays, siblings unaffected | page-level only |
| Alerts | the `DataTable` loading layout (`Loading alerts`) under the real header and filters (disabled while loading) | unfiltered: cleared `No alerts`; filtered: `EmptyState filtered noun="alerts"` with `Clear filters` | §3 | `ErrorState` noun `alerts`, `Try again` | `PermissionDeniedState` area `alerts` |
| Reports index | 4 card skeletons (title bar, two description bars), `Loading reports` | cleared `No reports` | §4.1 | `ErrorState` noun `reports`, `Try again` | `PermissionDeniedState` area `reports` |
| Report detail | breadcrumb and header render; `KpiTileSkeleton`s plus a section skeleton per section (caption bar, bar-row blocks, table rows), `Loading report` | per section, compact cleared or first-use state (§7.4) | §4.4 | `ErrorState` noun `this report`, `Try again` | `PermissionDeniedState` area `reports` |
| Report not found | not applicable | not applicable | not applicable | `not-found.tsx` (§7.5) | permission wins for Requestors (§4.2) |
| Requestor dashboard `/app` | unchanged | unchanged | unchanged | unchanged (`View My Requests`) | unchanged (`Return to sign in`) |

- "Try again" calls `router.refresh()` from a client boundary through the shared `ErrorState` `retry` prop, as the review lists do. Route `error.tsx` files use `reset()`.
- Loading waits before showing, and skeletons match the final layout (§4 Skeletons). They use the shared `Skeleton`, whose reduced-motion behaviour is the global rule.

### 6.2 Partial failure

- The dashboard has eight failure units: the KPI strip and each of the seven widgets. A unit whose data is unavailable renders its compact `ErrorState` in place of its body. Its heading and card stay, every other unit renders normally, and no unit fabricates, zeroes or hides data.
- A failed unit exposes no record link and no count.
- The whole page shows the page-level error only when no unit can render (for example, the summary read fails).
- A report is one read. If a plan splits it, each section follows this same rule.

### 6.3 Permission denial and direct URLs

- Requestors and Secondary Requestors see no analyst navigation (§1.2).
- On a direct URL to `/app/review`, `/app/alerts`, `/app/reports` or `/app/reports/{anything}` they see the page header and `PermissionDeniedState`, and the page issues no analyst read.
- They are never shown a table, count, record link or fixture boundary.
- Strapi remains authoritative. Unauthorised assessment reads still answer 404 by design, so no test asserts a permission state on that path.

### 6.4 E2E state harness

- Each new route honours the guarded `__e2eState` fixture (`populated`, `loading`, `empty`, `error`, `permission`) through `resolveE2eUiState` and `E2eUiStateBoundary`, as `/app/risks` does. Fixtures render only when the real read succeeded and render safe empty data.
- The analyst dashboard gains one closed partial selector, recommended `__e2ePartial=analyst-top-alerts-error`, which fails the Top alerts widget while its siblings render. It is resolved by a new function beside `resolveE2eDashboardPartial` and is never accepted without the attested runtime.

---

## 7. Copywriting contract

**Voice:** Australian English, sentence case for headings, labels, buttons and links (§2 Voice). No em dashes: use a spaced hyphen or a middle dot `·` separator, as shipped copy does. Typographic apostrophes as in the state primitives (`couldn’t`, `don’t`).

**Micro-label copy** is authored in sentence case and rendered uppercase by CSS, per the ROADMAP 06.5 decision. Screen readers read the sentence-case text.

**Numbers:** `Intl.NumberFormat('en-AU')`, tabular.

**Dates:** `Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' })` (`30 Oct 2026`, `4 Sept 2026`). Months as `{ month: 'long', year: 'numeric' }`, and `{ month: 'short' }` for chart labels.

### 7.1 Pages

| Page | Title (h1) | Description |
|---|---|---|
| `/app/review` | `Analyst dashboard` | `Review queues, Risk exposure, due dates and alerts across your authorised scope.` |
| `/app/alerts` | `Alerts` | `Overdue work, approaching dates and Risks that need attention, most urgent first. Alerts clear when the underlying record changes.` |
| `/app/reports` | `Reports` | `Read-only reports computed from current records in your authorised scope.` |
| Report detail | §7.4 | §7.4 |
| Navigation | `Analyst dashboard`, `Alerts`, `Reports`; group label `Reports` | none |

### 7.2 Dashboard

KPI captions, supporting lines, widget headings, descriptions, row labels and footers are fixed in §2.3 and §2.5. Widget empty and error copy:

| Widget | Empty heading (cleared, X-11) | Empty description | Error noun (`We couldn’t load {noun}`) |
|---|---|---|---|
| Review queue | none: zero rows render | none | `the review queue` |
| Risk exposure | `No open contextual Risks` | `Risks appear here when a Risk Assessment identifies them.` | `Risk exposure` |
| High and Critical residual Risks | `No High or Critical residual Risks` | `Open Risks rated High or Critical after treatment appear here.` | `High and Critical residual Risks` |
| Treatments due | `No treatments due` | `Treatments past their target date, or due within {N} days, appear here.` | `treatments due` |
| Upcoming due dates | `No upcoming due dates` | `Due, target and review dates in the next {N} days appear here.` | `upcoming due dates` |
| Top alerts | `No alerts` | `Nothing is overdue, due within {N} days, or flagged for attention.` | `alerts` |
| Recent activity | `No recent activity` | `Submissions, generated drafts, releases and returns to draft appear here.` | `recent activity` |
| KPI strip | not applicable | not applicable | `the summary counts` |

Accessible names for link rows: queue rows `{label}: {n} {Assessment Request|Assessment Requests}` (`Questionnaire|Questionnaires`, `Risk Assessment|Risk Assessments` for the other groups), so the Questionnaires row reads `Submitted: {n} {Questionnaire|Questionnaires}` and never says the Questionnaires await review (UI-D21); exposure rows `{Rating} residual rating: {n} open {Risk|Risks}`.

**Amended 2026-09-26 (Phase 8 UI review, verdict 2):** exposure rows are named `{Rating}: {n} open {Risk|Risks} by residual rating` (for example `Critical: 2 open Risks by residual rating`), as shipped by Phase 8 plan 08-12. The name begins with the row's visible words, the rating and its count (SC 2.5.3 Label in Name), and keeps the residual qualifier after the count. The queue-row names above are unchanged.

### 7.3 Alerts

Filter labels and options, chips, the vocabulary, condition sentences, date labels, record secondary text, `Not rated`, `Not applicable` and `No date recorded` are fixed in §3.2 and §3.3.

| State | Copy |
|---|---|
| Unfiltered empty (cleared) | Heading `No alerts`; description `Nothing is overdue, due within {N} days, or flagged for attention.`; no CTA |
| Filtered empty | `No alerts match these filters`, action `Clear filters` (locked) |
| Error | `We couldn’t load alerts`, `Please try again. If the problem continues, contact your administrator.`, `Try again` (locked) |
| Permission | `You don’t have access to alerts`, locked body, `Return to workspace` |

### 7.4 Reports

| Key | Title | Description | Metadata title |
|---|---|---|---|
| `risk-exposure` | `Risk exposure` | `Open contextual Risks by rating and treatment status, and the Information Systems carrying the most High and Critical residual Risks.` | `Risk Exposure Report \| IdamBox CSRM` |
| `treatment-performance` | `Treatment performance` | `Risk treatments by due state and treatment status, and the most overdue treatments.` | `Treatment Performance Report \| IdamBox CSRM` |
| `assessment-throughput` | `Assessment throughput` | `Assessment Requests by lifecycle state, Risk Assessments released each month, and time from submission to release.` | `Assessment Throughput Report \| IdamBox CSRM` |
| `control-effectiveness` | `Control effectiveness` | `Control Implementations on open contextual Risks by implementation status and effectiveness rating.` | `Control Effectiveness Report \| IdamBox CSRM` |

Section captions, section descriptions, tile captions, table headers, notes and legend copy are fixed in §4.4. Other report copy:

| Element | Copy |
|---|---|
| As-at line | `Computed from current records as at {date}.` |
| Period control | label `Period`; options `6 months`, `12 months` |
| Section empty: exposure and treatment populations | `No open contextual Risks` (cleared), description `Risks appear here when a Risk Assessment identifies them.` |
| Section empty: Most exposed Information Systems | `No High or Critical residual Risks` (cleared) |
| Section empty: Most overdue treatments | `No overdue treatments` (cleared), `Treatments past their target date appear here.` |
| Section empty: lifecycle state | `No Assessment Requests yet` (first-use, locked pattern) |
| Section empty: control sections | `No Control Implementations` (cleared), `Control Implementations appear here when mitigation controls are added to open Risks.` |
| Index empty | `No reports` (cleared), `Reports available to your role appear here.` |

### 7.5 State copy

| State | Copy |
|---|---|
| Dashboard error | `We couldn’t load the analyst dashboard` + locked body + `Try again` |
| Dashboard permission | `You don’t have access to the analyst dashboard` + locked body + `Return to workspace` |
| Reports error | `We couldn’t load reports` / report detail: `We couldn’t load this report` |
| Reports permission (index and detail) | `You don’t have access to reports` |
| Report not found | h1 `Report not found`; description `Choose a report from the Reports list.`; outline link `View reports` → `/app/reports` |
| Loading labels (visually hidden) | `Loading analyst dashboard`, `Loading alerts`, `Loading reports`, `Loading report` |

### 7.6 Requestor dashboard (frozen by D-22)

D-22 changes only where the lifecycle counts come from: one `GET /api/v1/my_requests/status_summary` read replaces seven list reads. Every string, layout, link, `aria-label` and state stays byte-identical:

- `Dashboard`; `Your authorised requests, questionnaires, and released assessment activity.`; `Create request`
- `My Assessment Requests`; `Your requests by lifecycle state.`; list label `My Assessment Requests by lifecycle state`; the seven status labels; `There are none in this state.`; count label `{n} request` / `{n} requests`; links `/app/requests?status={status}`
- Summary read failure: `These counts are unavailable right now. Your requests are still listed in My Requests.` Other widgets still render. A 403 on it still yields the dashboard permission state.
- `Draft requests` / `Draft requests that you can resume and edit.` / `No draft requests yet`
- `Questionnaires in progress` / `Questionnaires linked to requests that need your input.` / `No active questionnaires yet`
- `Recently released assessments` / `Assessments made available to you after release.` / `No released risk assessments yet` / `Assessments appear here after an authorised Security Analyst releases them.`
- `You don’t have access to your dashboard` + `Return to sign in`; `We couldn’t load your dashboard` + `View My Requests`
- The page keeps exactly one heading containing "Dashboard". Seven E2E specs assert it with Playwright's default substring match.

### 7.7 Terminology rules

- `Security Analyst` and `Requestor` in full.
- `Risk` capitalised when it means the entity (`contextual Risks`, `Risk Register`).
- `Risk Assessment`, `Assessment Request`, `Questionnaire`, `Control Implementation`, `Information System` and `Risk Type` are the JDL names. A Control Implementation is never called a "control" or "Control".
- Stored enum values display verbatim (`Not Started`, `Partially Effective`), as the Risk Register does.
- AI-related copy says `draft generated for Security Analyst review`, never approved, released or final.
- No destructive action exists in this phase.

---

## 8. Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| Landmarks | The shell's banner, `Primary navigation`, `main#main-content` and skip link are unchanged. Every widget, the KPI strip and every report section is a `<section aria-labelledby>` region. The breadcrumb is `nav` (shadcn). |
| Headings | `/app/review`: h1 page; h2 `Needs action` (visually hidden); h2 per widget; h3 group captions in Review queue. `/app/alerts`: h1 only, as the review lists. `/app/reports`: h1; h2 per report card. Report detail: h1 title; h2 `Summary` (visually hidden); h2 per section. No skipped levels. |
| Tiles | A `<ul>` of tiles; a link tile is one `<a>` named by its content in DOM order. Linked and unlinked tiles differ at rest by the chevron. |
| Charts | Dashboard: `labelled-values` lists with visible direct labels. Reports: the graphic is `aria-hidden` and the visible `<table>` (caption, `th scope`) is the text alternative. Meaning never depends on colour: severity has badge icon and text; urgency has icon and text; the partial month has a dash plus `(to date)`; overdue markers have an icon and the word. |
| Focus order | DOM order equals visual order in every layout (§2.2 grid order). No positive `tabindex`. One tab stop per record row, tile, card, bar row and queue row. |
| Focus visibility | `--focus-ring` on every control (`--focus-ring-inverse` on the sidebar and sheet). Focus is never hidden under the sticky header (SC 2.4.11): `html` gets `scroll-padding-top` equal to the header height tokens (§9 item 3). |
| Targets (SC 2.5.8) | Every target meets the §4 DataTable minimum. Below `md`, every standalone link or control (tiles, rows, footer links, record identifiers in cards, segments) meets the §4 Buttons touch-target height, as the register's mobile cards do. |
| Keyboard | Native selects; radio-group arrow keys; no hover-only content; no tooltips needed. |
| Live regions | The `DataTable` result `<output>`; loading `role="status"`; error and permission `role="alert"` (owned by the primitives, never doubled by the fixture boundary). |
| Reflow and zoom | No horizontal page scroll from 320 to 1440. The only horizontal scroller is the labelled, focusable cross-tab region. Text containers have no fixed heights; only the chart plot area does (X-2). |
| Contrast | Only direction-document tokens, all AA per §3. Severity and ink marks meet SC 1.4.11 against the surface (X-6). `--chart-grid` is decorative. |
| Motion | The Motion section below; reduced motion by the global rule. |
| Language | `en-AU` numbers and dates. |
| Automated | Zero axe violations (all impacts) at 375 and 1440 for every new route, and for the Requestor's permission render of each (Verification contract). |

---

## 9. Existing-surface changes (bounded)

1. **Navigation** (`config/navigation/navigation.ts`, `components/shell/capability-navigation.tsx`): three items, the `Reports` group, and the longest-match active rule (§1.2, §1.3), with unit tests for single `aria-current` on `/app/review`, `/app/review/requests/{id}`, `/app/requests/new` and `/app/reports/{key}`.
2. **Mobile sheet** (`globals.css` `.sheet-content`): vertical scrolling (§1.4).
3. **Focus not obscured** (`globals.css`): `html` `scroll-padding-top` of `--spacing-header-h-sm`, and `--spacing-header-h-md` from `md`. This covers every page, the new anchor target included.
4. **Risk Register overdue marker** (`features/risks/risk-register.tsx` `TargetDate`): shown exactly when the D-04 server rule says overdue (not when complete or closed). It uses the dense `AlertUrgencyBadge` form (`CalendarX2Icon` plus `Overdue` in the danger `fg` token) instead of `TriangleAlert` in warning, which currently collides with the High severity icon and disagrees with the alert urgency tokens (UI-D13). The same marker appears in dashboard widget 3.
5. **Risk detail anchor** (`features/risks/risk-details.tsx`): the Mitigation controls `DetailSection` receives `headingId="mitigation-controls"` so Control Implementation alerts deep-link to it.
6. **Risk Register `state` filter** (only if UI-D1 is confirmed): the closed query parameter `state` (`open` | `closed`; absent means all), published in `specification.json`, generated client, parsed by `riskRegisterQuerySchema`, a `Risk state` select in More filters, and chip `Risk state: Open`.
7. **`EmptyState` cleared variant** (`components/states/states.tsx`): `kind="cleared"` renders heading `No {noun}` with the same frame, icon and typography (X-11), with tests. Existing callers are unchanged.
8. **Requestor dashboard**: data source only (§7.6).

No other existing surface changes.

---

## Spacing

The direction document's §3.9 scale and layout tokens apply unchanged. This phase declares no phase-local scale and no exceptions; chart geometry waits for X-1 to X-4.

| Role | Rule |
|---|---|
| Page width and gutters | The shell `.page` (`--spacing-grid-max`, `--spacing-gutter-xs` / `-sm` / `-md`); report detail body also capped at `--spacing-container-max` |
| Header to body | `PageHeader`'s existing bottom margin (§4 Page header) |
| Between bands (strip to grid; report sections) | §3.9 section rhythm, upper bound |
| Grid gaps (tiles, widgets, index cards, chart beside table, small multiples) | `--spacing-gutter-xs` below `sm`, `--spacing-gutter-sm` from `sm` (§3.9 grid gap) |
| Card, tile and section padding | §4 Cards padding at the value the shipped Requestor `ActionWidget` frame uses |
| Rows inside cards | The shipped `DashboardItem` rhythm; link rows at least the §4 DataTable default row height |
| Table cells and rows | §4 DataTable (via `DataTable` or its conventions) |
| Badges and chips | §4 Status & risk badges; `DataTable` filter chips unchanged |
| Inline gaps (icon to text, badge to badge, bar label to bar, column gap) | The smallest §3.9 4px-scale steps |
| Targets | §8 Targets |

---

## Typography

The §3.10 scale applies unchanged: families, sizes, line heights, tracking, and weights 400/500/600. This phase adds no size, weight or family. Every pairing below is a §3.10 pair that the conformance scan (`design-system-conformance.spec.ts`) accepts. The Plus Jakarta Sans `tnum` feature is on for every number (§3.10).

| Emphasis level | Token | Weight | Phase use |
|---|---|---|---|
| 1. Page title | `--text-heading-lg` (Instrument Serif) | 400 | h1 on every page, via `PageHeader` |
| 2. KPI figure | `--text-display`, tabular | 600 | tile values only |
| 3. Panel title | `--text-heading-sm` | 600 | widget h2, report card h2, state headlines |
| 4. Data and labels | `--text-micro` (mono, uppercase via CSS) | 400 | tile captions, report section h2, queue group h3, table headers, month labels |
| | `--text-body` | 400; 500 for record identifiers, condition sentences in rows, bar values, the period label | descriptions and row text |
| | `--text-table` | 400; 500 for row headers and links | report tables and the Alerts table |
| | `--text-caption` | 400; 500 in badges and column value labels | supporting lines, secondary text, dates, notes, legend |
| | `--text-button` | 500 | footer links, segments, `Try again` |

Four emphasis levels carry the hierarchy; level 4 is the §3.10 data family. The GSD checker heuristics of "at most 4 sizes and 2 weights" and "8-point spacing set" are superseded by the project's approved scale (ADR 0001 gap 8, §3.9 and §3.10), as in Phase 06.5, whose contract deferred to the same sections and passed its checker. Serif appears only on h1 (§6 item 5). There is no uppercase outside `--text-micro`.

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | The canvas, and every tile, widget, card, section and table surface. Severity and urgency render only on white surfaces. |
| Secondary (30%) | `--color-bg-inset` (skeleton base), `--color-border-default`, `--color-text-secondary` / `--color-text-muted`, `--color-bg-sidebar` | Structure, supporting text, captions, navigation |
| Accent (10%): ink | `--color-primary`, `--color-text-link`, `--focus-ring`, `--chart-1` | Only as listed below |
| Status (semantic, §3.5) | danger, warning, info | Urgency badges, tile caption icons, the dense overdue marker. Never chart fills. |
| Severity (semantic, §3.6) | `--color-risk-*` | `RiskRatingBadge` and severity bar fills (X-6) |
| Chart (§3.14) | `--chart-1`, `--chart-grid` (`--chart-2` unused in Phase 7) | Ink marks, dashed partial outline, baseline |
| Destructive | none | This phase has no destructive action. Danger tokens appear only as the `overdue` urgency status (D-11). |

Ink as an interactive fill or indicator is reserved for: the checked segment of the period control, focus rings, record and text links (with their underline), the existing sidebar active bar, and `--chart-1` data marks. No Phase 7 surface adds a primary button. The only chroma on these pages is status and severity meaning, always paired with an icon and text (§1 thesis, §6 items 1 and 2).

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| Link tile and report card hover | §4 Cards link-card lift plus `--color-border-ink`, `--duration-fast` / `--ease-out-expo` |
| Link row hover | `--color-bg-hover`, `--duration-micro` / `--ease-standard`; no lift |
| Record link underline | existing `.record-link` transition |
| Segment checked state | `--duration-micro` / `--ease-standard` |
| Charts, rows, tiles on load | none: no entrance, stagger or fade (§5, §6 item 8) |
| Skeleton | shared `Skeleton`; static under reduced motion |

Nothing auto-refreshes or auto-advances (§6 item 9). Reduced motion is the global rule in `globals.css`.

---

## Proposed CSRM extensions

For the orchestrator to decide and, if accepted, add to `docs/design/csrm-design-direction.md` (value-bearing ones to §3.14; patterns to §4). Proposed values reuse §3.9 steps.

**Decision (2026-09-24): all thirteen accepted and recorded in `docs/design/csrm-design-direction.md`** — X-1 to X-8 under §3.14 "Chart geometry and marks", X-9 under §4 Forms, X-10 under §4 Cards / KPI tiles, X-11 under §4 Empty states, X-12 under §4 Status & risk badges, X-13 under §4 Record links. Executors take the values from the direction document, not from this table.

| # | Proposal | Proposed value or rule | Rationale |
|---|---|---|---|
| X-1 | `--chart-bar-thickness` | `0.5rem` | A thin mark reads as data rather than a control or field. A label line plus bar fits within the §4 DataTable default row height. |
| X-2 | `--chart-plot-height` (column charts) | `10rem` | Tall enough that a difference of one release stays visible at expected monthly volumes; short enough that chart, labels and table fit one screen at 1024 × 768 |
| X-3 | `--chart-column-max-width` | `2.5rem` (a §3.9 step) | Stops six columns in a wide section from becoming slabs |
| X-4 | `--chart-bar-min-length` | `2px` (the smallest §3.9 step) | A value of 1 against a large maximum stays visible; the direct label carries the exact value, so the distortion is bounded |
| X-5 | Square data marks | no radius on bars or columns | §3.8 shape meaning: a rounded thin bar reads as a pill (action) |
| X-6 | Severity mark fill | fill with the rating's §3.6 `fg` token, never the `bg` tint | Tints are about 1.05:1 on white and fail WCAG 1.4.11; the `fg` tokens clear 3:1 |
| X-7 | Partial-period mark | no fill, 1px dashed `--chart-1` outline, plus `(to date)` in the table and a one-item legend | Honest incomplete data without a new hue; dash is §3.14's sanctioned non-hue separator |
| X-8 | Chart hue rule made explicit | non-severity categories are always ink; status hues never fill a mark | §2 says "charts are ink + severity only"; §3.14 should state it where executors look |
| X-9 | Segmented control anatomy (§4 Forms) | §5.3 of this contract | §4 names the pattern ("Segmented controls are pills") without defining it |
| X-10 | KPI tile additions (§4 Cards / KPI tiles) | optional supporting line in `--text-caption` / `--color-text-secondary` after the value; trailing chevron on link tiles; `Not available` text for a null value; delta keeps its reserved position | The captions alone leave the object ambiguous ("Overdue" what?). Touch users need an at-rest cue that a tile opens a list. A null median must not render as 0. |
| X-11 | Cleared empty-state locked copy (§4 Empty states) | heading `No {noun}`, optional domain-fact description, no CTA | §4 names the "cleared/complete" type but locks copy only for first-use (`No {noun} yet`), which misstates a dashboard with nothing overdue |
| X-12 | Urgency vocabulary (§4 badges) | `overdue` danger + `CalendarX2`; `due-soon` warning + `CalendarClock`; `attention` info + `Flag`; urgency is a status, never a severity | Records D-11 in the design document so the Risk Register marker and future surfaces stay aligned |
| X-13 | Block-link cue | non-underlined block links (tiles, rows, cards) carry a trailing `ChevronRight` in `--color-text-muted` | §4 Record links gives inline links an at-rest underline; block links need an equivalent non-colour cue on touch devices |

Deferred, no decision needed now: a dash or pattern set for charts with more than two series. No Phase 7 chart has a second series.

---

## Decisions recorded

Made without asking, as discuss and UI phases run in auto mode. Each follows the locked context, `AGENTS.md` and the direction document.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | **Confirmed by the orchestrator (2026-09-24; CONTEXT D-36).** Exposure figures count open contextual Risks (no `closureDate`), and the Risk Register gains a closed `state` filter so every exposure figure links to an equal list (§9 item 6). **Fallback if declined:** exposure counts every contextual Risk in register scope, captions drop "open", and links use `residualRating` alone. | D-04 and D-10 already exclude closed Risks, and the seed holds a closed Risk. D-18 and D-24 require equal totals. No schema change is needed because `closureDate` exists. |
| UI-D2 | Nav: "Analyst dashboard" above the review queues; Alerts and Reports in a new "Reports" group; longest-match active rule. | Mirrors catalogue menu paths, as Administration does. Avoids two current items. |
| UI-D3 | KPI strip is the queue bucket plus the three urgencies. Seven widgets in action, exposure, time-bound, alerts and activity order. Widgets 4 to 6 overlap by stated predicate. | Answers "what needs me now" with four figures that all link to equal lists, and meets DASH-01 and the brief's analyst list (queues for requests, questionnaires and assessments; overdue mitigation; high and critical Risks; treatment due dates; activity; alerts). |
| UI-D4 | Widget headers carry no display-size count. | Keeps display type for the four tile values (3-second rule). |
| UI-D5 | Vertical severity lists and tables run Critical to Low. | Priority reading order, as the Risk Register's severity sort does. Horizontal ladders elsewhere keep their shipped order. |
| UI-D6 | No delta or sparkline in Phase 7. | Queue and alert counts are point-in-time with no stored history (D-01), so no honest comparison exists (D-18). |
| UI-D7 | HTML chart primitive; bar rows are two-line; months are columns from `@md`. | Real text satisfies §3.10 and the conformance scan. Two-line rows work at every width. |
| UI-D8 | Throughput period defaults to 6 months; the current month is included and marked partial. | Readable at every width; shows this month's releases without overstating them. |
| UI-D9 | Urgency icons `CalendarX2`, `CalendarClock`, `Flag`, with a visually hidden `Urgency:` prefix. | Disjoint from severity and status icons (D-11). Cards need the prefix without a column header. |
| UI-D10 | Alert filters are selects plus chips; sort is server-fixed. | House list pattern (the four-option Queue select is a select) and D-12. |
| UI-D11 | Bounded record lists are shared alert rows in both dashboard and reports; count tables are tables. | One row component across surfaces (D-20); tables where the content is tabular data. |
| UI-D12 | A cleared empty-state variant (X-11). | "No overdue treatments yet" misstates a clear dashboard. |
| UI-D13 | The Risk Register overdue marker adopts the urgency presentation and the D-04 rule. | D-04 requires one definition; the current triangle collides with High severity. |
| UI-D14 | Widget and section internals use container queries; page grids use viewport breakpoints. | The sidebar makes content narrower at 1024 than at 768. |
| UI-D15 | Report detail body capped at `--spacing-container-max`. | §2 Layout width: a report is a reading page. There is no effect at 1440 or below. |
| UI-D16 | The mobile sheet scrolls, and `html` gets `scroll-padding-top`. | New items overflow the sheet; SC 2.4.11 with a sticky header. |
| UI-D17 | Information System names in the risk-exposure report are plain text. | A link to a register list whose total differs from the adjacent figure would contradict D-24. |
| UI-D18 | Activity dates are absolute (UTC), never relative. | Matches the product's date style; avoids client and server clock drift and hydration mismatch. |
| UI-D19 | A web key-to-copy map drives report headers and metadata; the server definitions must match it by contract test. | The header renders before data; static metadata titles; the index stays data-driven. |
| UI-D20 | Report and index cards use a heading link with a stretched hit area, not `RecordLink`. | A report is not a record, and `RecordLink`'s fixed 500 weight at heading size is not a §3.10 pair. |
| UI-D21 | **Changed after code review WR-01 (2026-09-25).** The Review queue's Questionnaires row is labelled `Submitted`, not `Ready for review`, and the widget description is `Assessment Requests by queue, and Questionnaires and Risk Assessments by status.`, not `Work waiting in each analyst review list.` The count, its predicate and its link are unchanged. | Answers stay submitted after the Risk Assessment is drafted, reviewed and released, so the figure includes finished work and never drains; calling it waiting work misstated it. The actionable request-level work is already the `Requires my attention` row and tile. Keeping the predicate keeps the row equal to the list it opens (D-18, D-24) with no contract change, and `Submitted` is that list's own Status filter option. |

---

## UI considerations

Applicable state considerations resolved: 21 covered, 5 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution |
|---|---|---|---|
| loading | Dashboard, Alerts, Reports index, report detail | covered | Route-level `loading.tsx` with layout-matched skeletons (§6.1); no inherited Requestor skeleton (§1.5) |
| empty · first-use | Lifecycle section, Requestor widgets | covered | Locked `No {noun} yet` |
| empty · cleared | Dashboard widgets, Alerts unfiltered, report sections | covered | X-11 `No {noun}`, no CTA |
| empty · filtered | Alerts | covered | Locked filtered state with `Clear filters` |
| zero | KPI tiles, Review queue rows, bar rows, month series | covered | `0` rendered; categories never hidden |
| error · page | All new pages | covered | `ErrorState` with `Try again` via refresh or reset |
| error · partial | Dashboard units | covered | §6.2: failed unit shows a compact error; siblings render |
| permission · navigation | Requestor, Secondary Requestor | covered | No analyst items or group label |
| permission · direct URL | All new routes, including invalid report keys | covered | Capability check before reads and before key validation |
| populated | All surfaces | covered | §2 to §4 |
| partial data | Median days, not rated, no target date, no governing date | covered | `Not available`, `Not rated`, `No target date`, `No date recorded` |
| truncation | Widget lists, report top lists, activity | covered | `Showing {n} of {total}` only when truncated (D-03) |
| consistency | Tiles, rows and footers against linked lists | covered | Equal-predicate rule (§2.3, §2.4, §4.4); UI-D1 |
| zero-one-many | Counts, days, results | covered | Singular and plural forms in §3.2 and §7 |
| long text | Statements, titles, captions, system names | covered | Clamp with full DOM text; wrap captions; Condition and Record cells wrap |
| overflow | Alerts table at 768 and 1024; cross-tab at 375 | backstop | Browser check that there is no page overflow and that the cross-tab region is labelled and focusable |
| responsive | 375, 768, 1024, 1440 | backstop | Visual check of the §2.6, §3.6 and §4.6 tables at all four widths |
| keyboard | Segmented control, filters, rows | covered | §8 |
| focus obscured | Sticky header | covered | UI-D16 |
| contrast | Severity and ink marks | covered | X-6; tokens only |
| motion | Hover, segments, charts | covered | Motion section; reduced motion global |
| AI advisory | Activity and queue copy | covered | §7.7 |
| active nav | Nested review routes | covered | §1.3 with unit tests |
| mobile sheet | Analyst with administration | backstop | Browser check at 375 × 667 that every item and the role switcher are reachable |
| print | Reports | backstop | Export is deferred (D-06); layout avoids hover-only content, so browser print stays legible, but it is not a deliverable |
| deep link | Control Implementation alerts | backstop | Browser check that `#mitigation-controls` lands below the sticky header |

---

## Registry safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| shadcn official (local source-owned components) | none new. Existing `Card`, `Badge`, `Button`, `Skeleton`, `Table`, `Breadcrumb`, plus the `radix-ui` `RadioGroup` primitive already installed | not required: no block added, no registry fetched (2026-09-24) |
| Third-party | none | not applicable |

No new dependency: no chart library (D-19). Container queries are built into Tailwind 4.3.3.

---

## Verification contract

- **Unit and component (vitest):**
  - `KpiTile`: link and plain; name order; zero; `Not available`.
  - `BarChart`: scale; shared `scaleMax`; zero; minimum length; partial; tones; `labelled-values` names; no focusable descendants in `figure-with-table`.
  - `SegmentedControl`: radiogroup semantics; arrow keys; URL update.
  - `AlertUrgencyBadge`: three urgencies; icons disjoint from severity icons; prefix.
  - The alert presentation module: every kind at `{n}` of 0, 1 and many, null dates, source mapping, actor-correct hrefs.
  - Navigation: new items; Reports group; the single `aria-current` cases of §1.3.
  - Dashboard: every unit's five states and partial failure; no analyst read for a Requestor.
  - Alerts: filters, chips, cleared and filtered empty.
  - Reports: index; each key; not found; period parsing.
  - Risk Register: overdue marker follows the D-04 rule.
  - Requestor dashboard tests pass with copy unchanged.
- **Contract parity:** every new service joins `contract-response-parity.test.ts` (D-08). Report definitions match the web key-to-copy map (UI-D19).
- **E2E** (the dev servers stopped; sign-in helpers assert the Dashboard heading and the role in the banner):
  - `accessibility.spec.ts`: `/app/review`, `/app/alerts`, `/app/reports` and each `/app/reports/{key}`, zero violations at 1440 and 375, plus the Requestor permission render.
  - `design-contract.spec.ts`: `/app/alerts` joins `collectionSurfaces` (`RecordLink` parity, `DataTable` desktop and mobile, shared state headings, `Try again`, `Return to workspace`).
  - `design-system-conformance.spec.ts`: the new routes join `auditedRoutes` (type scan and five-state matrix); the dashboard partial fixture.
  - A dual-actor journey (D-25): dashboard → tile → equal list; dashboard → alert → source record; each report with its table; Requestor and Secondary Requestor see no analyst navigation and get the permission state on every direct URL.
  - Tests assert fixture membership and tile-to-list equality, never global totals (D-24).
- **Browser backstops** (orchestrator): the five backstop rows above at 375, 768, 1024 and 1440.

---

## Checker sign-off

- [ ] Dimension 1 Copywriting
- [ ] Dimension 2 Visuals
- [ ] Dimension 3 Color
- [ ] Dimension 4 Typography (deferral to §3.10, as 06.5)
- [ ] Dimension 5 Spacing (deferral to §3.9, as 06.5)
- [ ] Dimension 6 Registry Safety
- [ ] Dimension 7 Inventory Provenance

**Approval:** approved by orchestrator review on 2026-09-24 (UI-D1 confirmed, X-1 to X-13 accepted into the direction document). The seven-dimension checker pass was not run; the plan checker validates plans against this contract and the UI audit reviews the implementation.
