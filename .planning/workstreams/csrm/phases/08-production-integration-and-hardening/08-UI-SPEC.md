---
phase: "08"
slug: "production-integration-and-hardening"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-09-25"
reviewed_at: "2026-09-25"
---

# Phase 08 — UI Design Contract

> Visual and interaction contract for the user-facing work Phase 8 closes: the provider-neutral drafting copy (D-08), the mobile navigation trigger's name (D-26), one shared status-badge recipe (D-27), the Risk Register filter bar and statement column (D-28), the DataTable scroll region and its edge cue (D-29), record-naming search labels (D-30), a single rendering of each question in the analyst questionnaire review (D-32), print behaviour (D-33), and what a production build shows when development sign-in is unavailable (D-11). It introduces no colour, type size, weight, family, radius, shadow, spacing step or duration of its own, and no new surface beyond one sign-in state and the production fallbacks.

---

## Binding inputs and value authority

- Locked decisions in `08-CONTEXT.md` govern this contract: D-08, D-26 to D-30, D-32, D-33 (the copy, states and layout behaviour this file fixes, per D-34), D-11 (the sign-in state), D-25 (the accessibility bar), D-21 (safe production copy) and D-02 (no schema change; nothing here needs one). Where a decision leaves a choice open, this contract makes it and records the reason under "Decisions recorded" (UI-D1 to UI-D13).
- `docs/design/csrm-design-direction.md`, adopted by `docs/adr/0001-adopt-bproton-design-system.md`, is the only value-bearing authority. This file names semantic tokens and cites the direction document by section (§). It restates no colour, size, spacing, radius or duration.
- Values or patterns the direction document does not define are listed under "Proposed CSRM extensions" (X-1 to X-5) with the exact wording and values to record. A plan task records each accepted extension in the direction document before the implementing task runs; executors take values from the direction document, not from this file.
- Requirements: INT-04 (WCAG 2.2 AA, responsive behaviour, critical journeys) and INT-03 (advisory AI framing, D-08). Acceptance bar: ROADMAP Phase 8 success criteria 4 and 5.
- Domain vocabulary is the JDL's: Assessment Request (`CsrmAssessmentRequest`), Questionnaire, Risk Assessment (`CsrmAssessment`, `CsrmAssessmentStatus`), Risk (`CsrmRisk`, `CsrmTreatmentStatus`), Control Implementation (`CsrmControlStatus`), Security Analyst, Requestor. No competing entity is introduced.
- Phase 7 UI review findings 2, 3 and 4 are settled here (§5, §8, §2). Finding 1 (dashboard widget stretch) is not: see "Notes carried".

---

## Design system

| Property | Value |
|----------|-------|
| Tool | shadcn/ui, source-owned local components (`apps/web/components.json`: style `new-york`, RSC, CSS variables, neutral base, `iconLibrary: lucide`) |
| Preset | new-york; neutral base; CSS variables; RSC; Lucide icons |
| Component library | Radix primitives through the installed `radix-ui` and `@radix-ui/react-dialog` packages, composed by the local shadcn/ui components |
| Icon library | `lucide-react`, per §4 Iconography |
| Font | Plus Jakarta Sans, Instrument Serif (page titles), IBM Plex Mono (micro-labels), per §3.10 |
| Tokens | Semantic tokens in `apps/web/app/globals.css`, whose values are the direction document's; feature code consumes the mapped utilities only |
| New dependencies | None. Overflow detection uses the platform `ResizeObserver`; print uses a `@media print` block in `globals.css`. |

---

## Component inventory

Local shadcn/ui set unchanged (30 files in `apps/web/src/components/ui/`). Shared CSRM primitives this phase changes, all in `apps/web/src/components/`:

| Primitive | Change | Section |
|---|---|---|
| `csrm/status-badge.tsx` | Becomes the one status badge for every workflow status family, driven by one exported status-to-tone mapping | §3 |
| `csrm/data-table.tsx` | Scroll region focusable and labelled only while overflowing; sticky first column and scroll-edge cue on every table while overflowing; `stickyFirstColumn` prop retired | §5 |
| `csrm/horizontal-scroll-region.tsx` (new, or a hook of the same name) | The overflow measurement and region semantics shared by `DataTable` and the report cross-tab (`features/reports/report-table.tsx`) | §5 |
| `shell/capability-navigation.tsx` | Mobile trigger named by its visible label | §2 |
| `states/states.tsx` | Unchanged; reused by the production fallbacks | §9 |
| `app/globals.css` | `@media print` block; nothing else | §8 |

Feature modules changed: `features/assessments/assessment-draft-job.tsx` (§1), `features/assessments/assessment-list.tsx` (§3, §6), `features/assessments/assessment-editor.tsx`, `features/assessments/released-assessment.tsx`, `features/risks/risk-details.tsx`, `features/risks/risk-register.tsx`, `features/risks/risk-register-filters.tsx` (§3, §4), `features/questionnaires/questionnaire-list.tsx`, `questionnaire-review-list.tsx`, `questionnaire-detail.tsx`, `questionnaire-review.tsx`, `questionnaire-governance.tsx` (§3, §7), `features/dashboard/requestor-dashboard.tsx` (§3), `app/sign-in/page.tsx` and `lib/auth/development-session-adapter.ts` (§9).

---

## Token names used in this contract

Naming only; every value lives in the direction document.

| Direction document token | Utility or class in the shipped code |
|---|---|
| `--color-bg-surface` / `--color-bg-inset` / `--color-bg-hover` | `bg-surface` / `bg-surface-muted` (`bg-muted`) / `bg-surface-hover` |
| `--color-text-primary` / `--color-text-secondary` / `--color-text-muted` | `text-foreground` / `text-foreground-secondary` / `text-muted-foreground` |
| `--color-border-default` | `border-border` |
| `--color-info-*` / `--color-success-*` / `--color-warning-*` / `--color-danger-*` | `Badge` variants `info` / `success` / `warning` / `danger` |
| `--focus-ring` | global `:focus-visible` outline; `ring-ring` |
| `--radius-sm` / `--radius-lg` / `--radius-full` | `rounded-sm` (badges) / `rounded-lg` (tables, cards) / `rounded-full` (buttons) |
| `--text-caption` / `--text-table` / `--text-body` / `--text-heading-sm` / `--text-heading-lg` | `text-xs` / `text-[length:var(--text-table-size)]` / `text-sm` / `text-heading-sm` / `text-heading-lg font-display` |
| `--spacing-gutter-xs` / `-sm` / `-md`; `--spacing-grid-max` | `.page` padding at each breakpoint; `.page` width |
| `--spacing-header-h-sm` / `-md` | `.header` height; `html` `scroll-padding-top` |
| `--duration-micro` + `--ease-standard` | row hover, as `DataTable` applies them |

---

## 1. Provider-neutral drafting copy (D-08)

**Surface:** the analyst request review (`/app/review/requests/{id}`), card `AssessmentDraftJob` (`features/assessments/assessment-draft-job.tsx`), composed by `assessment-detail.tsx:80`.

### 1.1 Every string that changes

| Location | Current | New |
|---|---|---|
| `assessment-draft-job.tsx:204` (card `h2`) | `Deterministic draft assistance` | `Assessment draft generation` |
| `:205` (card description) | `Draft initiated by the signed-in analyst and always subject to analyst review.` | `Generate a draft Risk Assessment from the submitted questionnaire. The draft is advisory: it is recorded as initiated by you and is released only by a Security Analyst after review.` |
| `:211` (primary button, idle) | `Start deterministic draft assistance` | `Generate assessment draft` |
| `:211` (primary button, pending) | `Starting draft assistance…` | `Starting draft generation…` |
| `:37` `statusCopy.queued` | `Draft assistance is queued` | `Draft generation is queued` |
| `:38` `statusCopy.running` | `Draft assistance is running` | `Draft generation is running` |
| `:39` `statusCopy.completed` | `Draft assistance is ready for analyst review` | `Draft generation is ready for Security Analyst review` |
| `:40` `statusCopy.failed` | `Draft assistance failed` | `Draft generation failed` |
| `:49` (completed body) | `The generated content remains a reviewable draft and has not been released.` | `The generated draft is advisory and has not been released.` |
| `:55` (running body) | `Deterministic draft assistance is preparing a reviewable proposal.` | `A reviewable draft is being prepared from the questionnaire answers.` |
| `:68` (lifecycle list `aria-label`) | `Draft assistance lifecycle` | `Draft generation lifecycle` |
| `:118`, `:126` (announcement) | `Draft assistance polling timed out` | `Draft generation polling timed out` |
| `:140` (announcement) | `Draft assistance status could not be checked` | `Draft generation status could not be checked` |
| `:162` (announcement) | `Draft assistance could not be started` | `Draft generation could not be started` |
| `:183` (announcement) | `Draft assistance could not be retried` | `Draft generation could not be retried` |
| `:196` (announcement) | `Checking the current draft assistance status` | `Checking the current draft generation status` |
| `:215` (retry button, idle / pending) | `Retry draft assistance` / `Retrying draft assistance…` | `Retry draft generation` / `Retrying draft generation…` |
| `:216` (link after completion) | `Open completed assessment` | `Open assessment draft` |

Unchanged: the queued body (`:57`), `Status unavailable` (`:213`), the timed-out block (`:214`), `Attempt {n}` (`:207`), the `Sparkles` and `RotateCcw` icons (both `aria-hidden`; a sparkle is a generation affordance, not a provider), and the sibling `Questionnaire generation` card, whose copy is already provider-neutral.

### 1.2 Rules the copy must satisfy

- The card names the action (generate a draft) and the actor who reviews and releases (a Security Analyst). It never names a provider, model, vendor or the word "deterministic".
- Advisory framing appears in the description and in the completed state, in words: `advisory`, `has not been released`. Nothing in this card says approved, released, final or complete about a draft (hence `Open assessment draft`).
- Sentence case; verb-first button labels of two to three words (§2 Voice).

### 1.3 Where recorded provenance names the source

| Fact | Where it is recorded | Where it is shown | Rule |
|---|---|---|---|
| Initiating Security Analyst (`generatedBy`) | `CsrmAssessment` | `assessment-list.tsx:165-166, 334` (`Draft initiated by {name}`), `released-assessment.tsx:202` (`Generated by`) | Unchanged. This is the only recorded provenance of an assessment draft; the draft job DTO carries no provider fields (`assessment-schema.ts` `jobBaseShape`), so no provider is named. |
| Questionnaire generation provider (`providerName`, `providerVersion`) | The questionnaire generation job DTO | `questionnaire-generation-job.tsx:178` (`Provider: {name} ({version}). Review the generated questionnaire before use.`) | Unchanged: recorded provenance may name its source. |
| Deterministic provider's own summary text (for example `Deterministic assessment assistance identified 3 reviewable risk proposals.`) | The draft's `summary` written by the provider | Anywhere the summary renders | Data, not copy. Unchanged. |

Optional alignment, not required by D-08: the released detail's definition label `Generated by` (`released-assessment.tsx:202`) may become `Draft initiated by` to match the list. If taken, its tests change with it.

### 1.4 Tests that change deliberately

`src/features/assessments/assessment-review-workflow.test.tsx:278, 308, 310, 311, 312, 323, 326`; `e2e/assessment-release-workflow.spec.ts:160, 163, 164, 165, 170`. The fixture string at `assessment-review-workflow.test.tsx:263` (`failureMessage`) is server data and may stay.

---

## 2. Mobile navigation trigger (D-26; Phase 7 UI review finding 4)

**Surface:** `shell/capability-navigation.tsx:120-130`, rendered in the shell header below the `lg` breakpoint.

| Aspect | Contract |
|---|---|
| Accessible name | `Menu`: the button's visible content (`Menu` icon `aria-hidden`, then the text `Menu`). The `aria-label="Open navigation"` is removed. Label in Name (SC 2.5.3) then holds by construction. |
| State | `aria-expanded` reflects the sheet (`false` closed, `true` open) and `aria-controls` references the sheet content, both as Radix `Dialog.Trigger` exposes them (`aria-haspopup="dialog"` included). The existing explicit `aria-expanded={open}` may stay. |
| Sheet | `role="dialog"` named `Navigation` (unchanged). Close control: visible `Close`, accessible name `Close navigation` (unchanged: the visible text is contained in the name, so SC 2.5.3 holds). Focus returns to the trigger on close (unchanged). |
| Visuals | `.mobile-trigger` unchanged (§4 Buttons outline pill at the touch-target height below 768). |

Tests that change deliberately (name `Open navigation` → `Menu`): `src/components/shell/mobile-navigation.test.tsx:233, 308, 373, 401`; `e2e/app-shell.spec.ts:24, 46`; `e2e/questionnaire-generation-workflow.spec.ts:72`; `e2e/analyst-insights.spec.ts:250`; `e2e/questionnaire-workflow.spec.ts:175`; `e2e/requestor-request-workflow.spec.ts:144, 274`; `e2e/administration-workflow.spec.ts:41`; `e2e/assessment-release-workflow.spec.ts:116`. The `Close navigation` assertions stay.

---

## 3. Status badges: one recipe, one mapping (D-27)

### 3.1 Recipe (by reference)

Every workflow status badge is the §4 Status & risk badges subtle tier: rounded rectangle at `--radius-sm`, never a pill; tinted `bg`, same-hue `fg` text at `--text-caption` 500, soft same-hue border; a leading Lucide icon at the §4 Iconography badge size (`aria-hidden`) plus a sentence-case label; icon and label always. The neutral tone is the tinted recipe in neutrals: `--color-bg-inset` background, `--color-text-secondary` text, `--color-border-default` border (the shipped request `draft` treatment). A `Badge variant="outline"` with no tint is not a status treatment (§4).

### 3.2 Tone vocabulary (X-5)

| Tone | Meaning | `Badge` variant / classes |
|---|---|---|
| neutral | not yet started, or terminal | neutral recipe above |
| info | in progress with, or waiting on, the Requestor | `info` |
| warning | waiting on a Security Analyst | `warning` |
| success | submitted, approved or released | `success` |
| danger | a recorded overdue state | `danger` |

### 3.3 The shared mapping

One module (recommended: `components/csrm/status-badge.tsx` exporting `statusPresentation` and a `StatusBadge` that takes a family and a value) owns every row below. Feature code passes `family` and `value` and never chooses a tone, icon or label itself. Labels are what filter options, chips and cards render too.

**Request (`CsrmRequestStatus`)**: unchanged from the shipped `StatusBadge`, except the two tones amended after the phase code review (WR-03, 2026-09-26): `draft` is work in progress with the Requestor (info, as the questionnaire draft), and `submitted` is submitted (success, as the submitted questionnaire). As first written the rows read `draft` neutral and `submitted` info, which contradicted the X-5 vocabulary.

| Value | Label | Tone | Icon |
|---|---|---|---|
| `draft` | Draft | info | `FilePenLine` |
| `submitted` | Submitted | success | `Send` |
| `questionnaire-in-progress` | Questionnaire in progress | info | `ClipboardList` |
| `risk-assessment-drafted` | Risk assessment drafted | warning | `FileWarning` |
| `under-review` | Under review | warning | `SearchCheck` |
| `approved` | Approved | success | `CircleCheck` |
| `closed` | Closed | neutral | `LockKeyhole` |

**Risk Assessment (`CsrmAssessmentStatus`)**: tones mirror the request states they coincide with (drafted and under review are analyst work).

| Value | Label | Tone | Icon |
|---|---|---|---|
| `draft` | Draft | warning | `CircleDashed` |
| `in-review` | In review | warning | `CircleDot` |
| `approved` | Released | success | `CircleCheck` |
| `closed` | Closed | neutral | `LockKeyhole` |

**Questionnaire**: four presentation values derived from the served summary (`state` plus the `release` fact, which the Strapi summary projection already carries, `questionnaire-scope.ts:355`). One pure function derives them for every surface, taking the served `state` and an explicit nullable `release` parameter: `release === null` → `analyst-review`; otherwise the served `state`. A projection that carries no `release` field at all (the Requestor dashboard items, `requestor-dashboard.tsx:32-60`, which are released by construction) passes the served state directly and never lets an absent field read as "unreleased".

| Value | Label | Tone | Icon |
|---|---|---|---|
| `analyst-review` | Analyst review | warning | `ClipboardPenLine` |
| `not-started` | Not started | neutral | `CircleDashed` |
| `draft` | Draft | info | `FilePenLine` |
| `submitted` | Submitted | success | `CircleCheck` |

**Risk treatment (`CsrmTreatmentStatus`)**: stored values display verbatim (§7.7 of the Phase 7 contract). A null value renders the plain text `Not provided`, not a badge.

| Value | Label | Tone | Icon |
|---|---|---|---|
| `Not Started` | Not Started | neutral | `CircleDashed` |
| `In Progress` | In Progress | info | `Clock3` |
| `Overdue` | Overdue | danger | `ClockAlert` |
| `Complete` | Complete | success | `CircleCheck` |

Icon disjointness: no status uses an urgency icon (`CalendarX2`, `CalendarClock`, `Flag`; §4 Urgency) or a severity icon (§3.6 shapes). `ClockAlert` replaces the register's `AlertTriangle`, which collided with the High severity triangle. The register's target-date Overdue marker stays the dense urgency form (Phase 7 UI-D13); when a Risk carries both, the row shows the treatment status badge in its own column and the urgency marker beside the date, which is two facts, not one repeated.

**Control Implementation (`CsrmControlStatus`) and effectiveness rating:** shown only as definition-list values (`mitigation-control-list.tsx:128-129`, `assessment-editor.tsx:342`, `released-assessment.tsx:133`) and stay plain text. A `<dd>` value is not a badge, and effectiveness is a rating, not a status. The mapping gains these families only if a list surface ever badges them.

### 3.4 Surfaces that change

| Surface (file:line) | Today | Contract |
|---|---|---|
| Risk assessment review list, `assessment-list.tsx:38-48` (table cell and mobile card) | `Badge variant="outline"`, neutral | `StatusBadge` assessment family; the status filter options (`:312`) read the mapping's labels, so `approved` shows `Released` |
| Risk assessment editor header, `assessment-editor.tsx:167` | neutral outline classes, `aria-live="polite"` | `StatusBadge` assessment family with `live` |
| Released risk assessment header, `released-assessment.tsx:186` | ad hoc success `Released` | `StatusBadge` assessment `approved` (renders `Released`) |
| Requestor released list status filter, `released-assessment.tsx:92` | option `Approved` | option label from the mapping (`Released`); value stays `approved` |
| Risk detail header, `risk-details.tsx:102` | neutral outline `Released — read only` | `StatusBadge` assessment `approved` (`Released`); the read-only consequence stays in the Alert beneath it (its title may drop the em dash to `Released assessment - read only`, §2 Voice) |
| Risk Register treatment status, `risk-register.tsx:61-65` (table cell and mobile card) | neutral outline, `AlertTriangle` for Overdue | `StatusBadge` treatment family |
| My Questionnaires, `questionnaire-list.tsx:27-31, 64, 104` (cell, card, status chip label) | local tinted map | `StatusBadge` questionnaire family via the shared derivation |
| Questionnaires for review, `questionnaire-review-list.tsx:31-34, 80, 160` | local map: `Awaiting submission` (warning) / `Ready for review` (success) | `StatusBadge` questionnaire family: `Analyst review`, `Not started`, `Draft` or `Submitted`. The page's filter keeps its three served-state options (`Not started` / `Draft` / `Submitted`; a fourth would be a contract change, out of scope), so the four labels map onto three options: an unreleased questionnaire's served state is `not-started`, and the `Not started` option returns rows labelled both `Analyst review` and `Not started`. The executor and the UI auditor should expect that. |
| Requestor dashboard questionnaire items, `requestor-dashboard.tsx:32-60` | local tinted map | `StatusBadge` questionnaire family |
| Requestor questionnaire detail header, `questionnaire-detail.tsx:41` | ad hoc `In progress` / `Submitted` | `StatusBadge` questionnaire family from the served state (`Not started`, `Draft` or `Submitted`) |
| Analyst questionnaire review header, `questionnaire-review.tsx:69, 79` | ad hoc `Analyst review` (info) / `Submitted` | `StatusBadge` questionnaire family (`Analyst review` is warning); the awaiting-submission heading (`:63`) gains the same badge for its served state |
| Request badges (`request-table.tsx`, `request-form.tsx`, `assessment-detail.tsx`, `assessment-list.tsx:135, 280`, requestor dashboard) | `StatusBadge` | unchanged output |

### 3.5 Not a status: unchanged

`RiskRatingBadge` (severity, §3.6), `AlertUrgencyBadge` (§4 Urgency), the lifecycle steppers, the `Attempt {n}` tags and the draft job's `Queued / Running / Completed` step chips, and the placeholders `Not rated` (`requestor-dashboard.tsx:214`) and `Rating not recorded` (`released-assessment.tsx:55, 93`). The two placeholders are outline chips that carry no status; aligning them to the Alerts precedent (plain `--color-text-secondary` text, Phase 7 §3.4) is welcome but outside D-27.

### 3.6 Tests that change deliberately

`src/features/assessments/assessment-list.test.tsx:137` (`Approved` → `Released` for the assessment family only; `:110` and `:122` assert request-list options and are unchanged); `e2e/assessment-navigation-lifecycle.spec.ts:175` (assessment filter options) while `:162, 168` (request options) stay; `e2e/assessment-release-workflow.spec.ts:270` (its `getByText('Approved', { exact: true }).first()` would keep matching the request badge, so the replacement targets the assessment header badge reading `Released`; the stepper on that page already reads `Released`); `src/features/questionnaires/questionnaire-workflow.test.tsx:355-356` (`Ready for review` / `Awaiting submission` → the mapping's labels for the fixtures' states); any `In progress` assertion on the Requestor questionnaire detail. `questionnaire-governance.test.tsx:15` (`Analyst review` heading) is a heading, not the badge, and stays.

---

## 4. Risk Register filter bar and statement column (D-28)

**Surface:** `features/risks/risk-register-filters.tsx:171-207` and `risk-register.tsx:125`. Content widths follow the shell: `.page` is `min(100%, --spacing-grid-max)` with `--spacing-gutter-md` from 1024 and `--spacing-gutter-sm` from 768; the sidebar column is fixed from 1024. Widths below are derived from those rules, not new values.

### 4.1 Layout by viewport

| Viewport | Content width | Rows above the table | Track widths (with the shipped `gap-3` grid gap) |
|---|---|---|---|
| 375 | 343 | Unchanged: `Filters ({n})` button opens the sheet with search, core and more filters | not applicable |
| 768 (`md`) | 720 | Row 1: the search form alone (label, input, `Search Risks` button). Row 2: `Treatment status`, `Inherent rating`, `Residual rating` in three equal columns. Row 3: `More filters` (unchanged). | selects 232 each |
| 1024 (`lg`) | 688 | as 768 (the sidebar makes content narrower than at 768) | selects 221 each |
| 1280 (`xl`) | 944 | Row 1: one row of four tracks `2fr 1fr 1fr 1fr`: search, then the three selects. Row 2: `More filters`. | search 363 (input about 240 after the button), selects 182 each |
| 1440 | 1104 | as 1280 | search 427 (input about 305), selects 214 each |

Checkable rules at every viewport from 768:

- The search input (`input[name="q"]`, `aria-label="Search Risks"`) is at least 200px wide.
- Every filter label (`Search Risks`, `Treatment status`, `Inherent rating`, `Residual rating`) renders on one line: label text does not wrap (`white-space: nowrap`), and no track is narrower than its label.
- Selects keep the house height (`h-9` from `md`) and `nativeSelectClassName` styling; the search button stays a primary pill at the default height, end-aligned with the input.
- The `More filters` popover and the mobile sheet are unchanged.

Implementation hint (not a contract): `md:grid-cols-3` with the search form spanning all three columns, and `xl:grid-cols-[2fr_1fr_1fr_1fr]` with the form spanning one.

### 4.2 Statement column (X-3)

- The Statement cell content is a block that wraps (`whitespace-normal`, opting out of the shared `TableCell` `nowrap`), clamps to two lines (`line-clamp-2`, already applied to the `RecordLink` but inert today), keeps the full statement in the DOM (assistive technology reads it; the link opens the record), and is bounded by the X-3 widths. Rows grow to fit two lines; vertical centring stays (§4 DataTable).
- At 1440 with the seeded fixture, at least the first five columns (Risk number, Statement, Inherent rating, Residual rating, Treatment status) are fully visible without horizontal scrolling; the remaining columns are reached through the §5 region and cue. At 1280 and below the same clamp applies and the region carries the rest.
- Mobile cards keep `line-clamp-3` (unchanged).

---

## 5. DataTable scroll region and scroll-edge cue (D-29; Phase 7 UI review finding 2)

**Surfaces:** every `DataTable` desktop layout (`data-table.tsx:289-302`) and the report cross-tab region (`report-table.tsx:107-117`, label `Residual rating by treatment status, scrolls horizontally`). DataTables in scope, by `ariaLabel`: `My assessment requests`, `My questionnaires`, `My released risk assessments`, `Assessment requests for review`, `Risk assessments for review`, `Questionnaires for review`, `Risk Register results`, `Alerts`, and `{Risk Types|Controls|Information Systems|Information Assets} results`.

**Addendum (2026-09-25, plan check finding (a)).** The CSV import flow's three plain `Table` scrollers (`csv-import-flow.tsx:169, 183, 202`: `{Label} CSV columns`, `{Label} import preview`, `{Label} import results`, with `{Label}` the singular collection name) follow §5.1, §5.3 and §5.4 through the same hook and region props, with the wrapper as the single scroller: `[&>[data-slot=table-container]]:overflow-visible` neutralises the `ui/table.tsx` container's `overflow-x-auto`, which axe otherwise reports as `scrollable-region-focusable` at 375px on the controls, information-systems and information-assets import Guidance. §5.2's sticky identifier column does not apply to them (plain `Table`, no identifier column). The Guidance table renders at every width, so it joins the cross-tab as a horizontal scroller below `md` under the same rules. Owner: plan 08-08 Task 1; the four import pages are asserted at 375 in 08-08 Task 3.

### 5.1 When the region exists

| Condition | Semantics |
|---|---|
| The scroller's content is wider than the scroller (`scrollWidth > clientWidth`) | `role="region"`, `aria-label="{table name}, scrolls horizontally"`, `tabIndex=0`, and `data-overflow="true"` on the scroller |
| It is not | no `role`, no `aria-label`, no `tabIndex`, `data-overflow="false"` |

- `{table name}` is the DataTable `ariaLabel` (for example `Risk Register results, scrolls horizontally`, `Alerts, scrolls horizontally`); the cross-tab keeps its `scrollLabel`.
- Overflow is measured after mount and on every resize of the scroller and its table (`ResizeObserver`), so a filter change, a page change or a viewport change re-evaluates it. Server-rendered markup starts without the region attributes.
- The loading skeleton is never focusable.
- Below `md`, `DataTable` renders cards and has no scroller. The cross-tab and the CSV import Guidance table (addendum above) are the only horizontal scrollers below `md` and follow the same rules.

### 5.2 Sticky first column and the start-edge cue

- While `data-overflow="true"`, the first header cell and first body cell of every DataTable stay sticky at the start, keep their row-state background, and show the 1px `--color-border-default` end hairline with no shadow (§4 DataTable). The hairline appears only while overflowing, so no table ever shows a vertical rule at rest (§6 item 4). The `stickyFirstColumn` prop is retired; the Risk Register call site drops it.
- The cross-tab keeps its container-size rule (sticky below the `@2xl` container size) and gains the same hairline-only-while-overflowing behaviour.
- The start edge therefore needs no fade: the sticky column's hairline is the cue that columns are hidden behind it.

### 5.3 Scroll-edge cue at the end edge (X-1)

- While columns are hidden beyond the end edge, a horizontal fade of `--table-scroll-fade-width` (X-1) runs from transparent to `--color-bg-surface` over the end edge of the header and body. It is decorative (`pointer-events: none`, no text, not in the accessibility tree), disappears once the scroller reaches its end, and has no transition, so it needs no reduced-motion rule.
- Implementation hint: the two-layer background technique with `background-attachment: local, scroll` on the scroller renders it with no script and updates during scrolling; a `::after` overlay toggled by `data-overflow` and a scroll listener is an acceptable alternative.
- The cue is never a shadow (§6 item 3) and never a new hue.

### 5.4 Keyboard and focus

- Tab reaches the region (while it exists) before the first control inside the table. Left and Right arrow keys scroll it, the platform's behaviour for a focused scroll container, so no custom key handling is added; whether Home and End reach the horizontal edges varies by platform and is not asserted (§5.5 asserts `ArrowRight` only).
- Focus ring: `--focus-ring` drawn on the scroller's rounded frame (the shipped `focus-visible:ring-2 focus-visible:ring-ring`), applied whenever the region exists.
- Focus not obscured (SC 2.4.11): a link or button inside a scrolled cell that receives focus is scrolled into view clear of the sticky column and header. The scroller sets `scroll-padding-inline-start` to the measured sticky column width (a CSS custom property set by the same observer) and keeps `scroll-padding-top` at the header height (`scroll-pt-10`).
- Scrolling uses `scroll-behavior: auto`; the global reduced-motion rule already forces it.

### 5.5 Tests

- `src/components/csrm/data-table.test.tsx:235` (the opt-in region) changes deliberately: with jsdom's zero layout the region must not exist; a test that stubs `scrollWidth` and `clientWidth` asserts the region name, `tabindex`, `data-overflow`, the hairline class and the first column's sticky classes; another asserts their absence without overflow. The cross-tab test at `report-views.test.tsx:191` follows the same pattern.
- E2E: at 768 and 1024 the Risk Register and Alerts regions exist and are reachable by Tab; ArrowRight changes `scrollLeft`; at 1440 a table that fits has no `role="region"`; the cross-tab at 375 shows the end-edge fade while `scrollLeft` is 0 and hides it at the end.

---

## 6. Search inputs name their records (D-30)

| Surface | File:line | Current label | Contract |
|---|---|---|---|
| Assessment request review (`/app/review/requests`) | `assessment-list.tsx:254` | `Search collection` | `Search assessment requests` |
| Risk assessment review (`/app/review/assessments`) | `assessment-list.tsx:309` | `Search collection` | `Search risk assessments` |
| My Requests | `request-table.tsx:123-124` | `Search requests` | unchanged |
| My Questionnaires; Questionnaires for review | `questionnaire-list.tsx:103`; `questionnaire-review-list.tsx:125-126` | `Search questionnaires` | unchanged |
| My released risk assessments | `released-assessment.tsx:92` | `Search risk assessments` | unchanged |
| Risk Register (row and sheet) | `risk-register-filters.tsx:176-177, 198` | `Search Risks` | unchanged |
| Administration collections | `administration-workspace.tsx:222` | `Search {plural label}` (`Search Risk Types`, `Search Controls`, `Search Information Systems`, `Search Information Assets`) | unchanged |

- The visible label text and the input's `aria-label` are the same string (the `Controls` component already reuses `label` for both), so Label in Name holds.
- The filter chip label `Search` and the generic `Search` submit button are unchanged.
- `Search collection` appears nowhere after this phase (grep-checkable in `apps/web/src` and `apps/web/e2e`).
- Capitalisation differs between surfaces (`Search Risks` and the administration labels capitalise the entity; the others do not). Harmonising it is not part of D-30 and is recorded as a follow-up, not a change.

---

## 7. Analyst questionnaire review renders each question once (D-32)

**Surface:** `features/questionnaires/questionnaire-review.tsx:67-70` (`analyst-review` state) with `questionnaire-governance.tsx:71-72` and `questionnaire-renderer.tsx:331-339`.

Today the `analyst-review` branch renders the governance `Question editor` list (every question, with Edit and Delete) and then `QuestionnaireRenderer mode="read-only"`, which lists every question again under a `Submitted` alert that is untrue for an unreleased questionnaire.

Contract for the `analyst-review` state (questionnaire not yet released):

1. Page header with the questionnaire title, `questionnaireNumber` description and the `Analyst review` status badge (§3.3).
2. The Assessment Request link (unchanged).
3. `QuestionnaireGovernance`, whose `Question editor` is the single list of questions, grouped by section: a `.micro-label` `h4` per section title in definition order (amended 2026-09-26 by the phase UI review, verdict 3: the captions sit inside the `h3` `Question editor` group, so they are `h4`; as first written they were `h3` siblings of it), then one row per question in question order. Each row shows the question text (`--text-body` 500), a caption line `{Answer type} · Required` or `{Answer type} · Optional` in `--text-caption` / `--color-text-secondary`, and for `Single select` and `Multi select` a second caption line `Choices: {label 1}, {label 2}, …`; then the existing `Edit` and `Delete` actions, each named for its question after its visible word (`Edit question: {question text}`, `Delete question: {question text}`; amended 2026-09-26 by the phase UI review, W-9, so a screen reader's button list tells the eight pairs apart). The `Add question` button and the release control are unchanged.
4. The revision timeline (unchanged).
5. No `QuestionnaireRenderer` and no `Submitted` alert.

Contract for the `submitted` state: unchanged. `QuestionnaireGovernance` shows only the `Return to analyst review` control (no question list) and `QuestionnaireRenderer mode="read-only"` shows each question once with its answer, so nothing is duplicated. The `awaiting-submission` state shows no questions (draft answers stay private); unchanged.

Checkable: on the analyst review page in the `analyst-review` state, each question text occurs exactly once in the document, and the text `Questionnaire submitted. This questionnaire is read-only` does not occur. Tests that relied on two renderings change deliberately (`questionnaire-workflow.test.tsx` analyst-review cases; the generation E2E `questionnaire-generation-workflow.spec.ts` asserts only the number and axe today and needs no change).

---

## 8. Print (D-33; Phase 7 UI review finding 3; X-4)

A `@media print` block in `globals.css` is the whole implementation. It introduces no value: page margins are the browser's defaults, typography and colour are the §3.10 and §3 tokens unchanged.

| Concern | Contract |
|---|---|
| Hidden | `.skip-link`, `.sidebar`, `.header` (mobile trigger, title and role tag), `.shell-footer`, `.sheet-overlay`, `.sheet-content`, open overlays (`[role="dialog"]`, `[role="alertdialog"]`, `[data-radix-popper-content-wrapper]`, the toaster `[data-sonner-toaster]` mounted in `app/layout.tsx`), and every element marked `data-print="hidden"`. |
| Marked `data-print="hidden"` | `PageHeader`'s action slot; every `form[role="search"]` and list filter row (search inputs, status and queue selects, `More filters`, `Filters ({n})`); the DataTable toolbar's density toggle, the chip remove buttons and `Clear filters`; the DataTable footer's `Rows per page` select and page buttons. The `{n} results` and `Page {x} of {y}` outputs and the filter chips' text still print, so a filtered table never prints as an unfiltered one (§4 DataTable). |
| Printed | `main.page` content at full page width: `.shell` becomes a single column, `.page` loses its max width and padding, `html` and `body` print on `--color-bg-surface` with `overflow: visible`. Headings, tables, cards, tiles, badges, charts with their tables, definition lists and forms print as rendered. |
| Tables | Scroll regions expand (`overflow: visible`), sticky cells and headers become static, the edge cue is removed; the desktop layout prints regardless of paper width (`[data-slot="data-table-mobile"]` hidden, `[data-slot="data-table-desktop"]` shown); table cells wrap (`white-space: normal`) so a wide table fits the paper instead of being cut; `thead` repeats on each page; `tr`, list items, cards and KPI tiles avoid page breaks inside; headings avoid a break after them. |
| Colour | Status, urgency and severity badges and chart marks (`[data-slot="badge"]`, `[data-slot="bar-chart-mark"]`) set `print-color-adjust: exact` so their tints survive where the browser allows; meaning never depended on the tint (icon and text carry it, §3.5, §3.6), so a printer that drops backgrounds loses nothing. |
| Links | Record and text links keep their underline (`--text-link-decoration` prints as grey) and print no URL suffix: identifiers are the durable reference and appended URLs would swamp dense tables. |
| Typography and spacing | The screen scale (§3.10) and §3.9 rhythm print unchanged; no print-specific size or margin. |

Checkable with `page.emulateMedia({ media: 'print' })` at a 794px viewport (A4 width at 96dpi): the hidden selectors are hidden, `main` is visible, no element inside `main` is `position: sticky`, every `[data-print="hidden"]` is hidden, the Risk Register table's `scrollWidth` does not exceed the page width, and a report page shows its charts' tables.

---

## 9. Sign-in without an available development session (D-11) and production fallbacks (D-21)

### 9.1 `/sign-in`

| Runtime | Rendering |
|---|---|
| Development session available: `next dev`, or a production build inside the attested E2E runtime (D-11 gates all satisfied) | The shipped development sign-in card, byte-identical: eyebrow `IdamBox CSRM`, `h1` `Development sign-in`, the lead, three `Continue as {role}` pills, the note. The E2E sign-in helpers keep working unchanged. |
| Development session unavailable: any D-11 gate missing or invalid (the production case) | The same `.sign-in` / `.sign-in-card` frame (§4 Sign-in): the logo lockup; eyebrow `IdamBox CSRM`; `h1` `Sign-in unavailable`; lead `Session authentication is not configured.` (the adapter's existing message, `development-session-adapter.ts:16`) followed by `Contact your administrator.`; no form, no button; note `Access is granted by your organisation’s authorization service, never by navigation alone.` (the development card's note names the backend product, which a production page must not). Document title `Sign-in unavailable | IdamBox CSRM`. HTTP 200. The page names no development feature, fixture role, internal system or environment variable. |

- Today the page calls `notFound()` outside development (`sign-in/page.tsx:15`); the unavailable card replaces that, because the application layout sends every unauthenticated visitor here (§9.2).
- The sign-in server action refuses outside an available runtime (fail closed): the proof in D-11 posts to it under a production build without the attestation and asserts no session cookie is set and `/app` still redirects to `/sign-in`.

### 9.2 Application routes without an available session

The `(app)` layout currently throws `Session authentication is not configured.` from `UnavailableSessionAdapter.current()`, which a production build surfaces as the framework's default error page. Contract: with the session unavailable, `current()` resolves `null` and `signIn()` redirects to `/sign-in?returnTo={validated path}` exactly as the development adapter does, so a visitor lands on the unavailable card. Nothing else changes; Strapi still issues no identity.

### 9.3 Production fallbacks (safe copy, D-21)

Both render without the shell, in the `.sign-in` card frame, with no stack trace, digest, internal message or environment detail.

| Route file | `h1` | Lead | Action |
|---|---|---|---|
| `app/not-found.tsx` | `Page not found` | `The page you asked for doesn’t exist or has moved.` | primary pill `Return to workspace` → `/app` (the same destination keeps the label `PermissionDeniedState` already uses, SC 3.2.4) |
| `app/global-error.tsx` | `Something went wrong` | `The application hit an unexpected error. Please try again. If the problem continues, contact your administrator.` (the locked error body, §4 Empty states) | primary pill `Try again` (calls `reset`) |

Document titles `Page not found | IdamBox CSRM` and `Something went wrong | IdamBox CSRM`. Segment `error.tsx` files keep the shared `ErrorState`. A global error UI replaces the root layout, so `app/global-error.tsx` must render its own `<html>` and `<body>` and import `globals.css` and the `next/font` setup itself (Next 16.3 `error.md`, "global-error"); otherwise the `.sign-in` frame and tokens do not apply to it.

---

## 10. Five-state contract

Phase 8 adds no list or detail surface; every existing surface keeps its Phase 06.6 and Phase 7 five-state contract, and the D-27 and D-29 changes must leave the `design-contract.spec.ts` state matrix and the `design-system-conformance.spec.ts` type scan green (badge text stays a §3.10 pair: `--text-caption` 500).

| Surface | States |
|---|---|
| `/sign-in` | available (development card) · unavailable (§9.1). No loading, empty or error state: the page reads no data. |
| Application routes with no session | redirect to `/sign-in` (§9.2) |
| Root not-found, global error | §9.3 |
| DataTable scroll region | present (overflowing) · absent (fits) · loading (never focusable) |
| Analyst questionnaire review, `analyst-review` | populated per §7; `empty`, `error`, `permission`, `awaiting-submission` unchanged |

---

## 11. Copywriting contract

**Voice:** Australian English, sentence case, verb-first buttons of two to three words, spaced hyphen or middle dot rather than an em dash, typographic apostrophes (§2 Voice; Phase 7 §7).

| Element | Copy |
|---|---|
| Primary CTA (D-08) | `Generate assessment draft`; after completion `Open assessment draft` |
| Secondary actions (D-08) | `Retry draft generation`, `Check again` |
| Mobile trigger | `Menu` |
| Search labels (D-30) | `Search assessment requests`, `Search risk assessments`; others unchanged (§6) |
| Status labels (D-27) | the §3.3 tables |
| Empty states | unchanged locked patterns: `No {noun} yet`, `No {noun} match these filters` + `Clear filters`, cleared `No {noun}` |
| Error states | unchanged locked pattern: `We couldn’t load {noun}` + `Please try again. If the problem continues, contact your administrator.` + `Try again` |
| Sign-in unavailable | `Sign-in unavailable` · `Session authentication is not configured. Contact your administrator.` |
| Fallbacks | `Page not found` · `Something went wrong` (§9.3) |
| Destructive actions | none added; existing confirmations unchanged |
| Terminology | `Risk Assessment`, `Assessment Request`, `Security Analyst`, `Requestor` in full in new copy; stored enum values verbatim; AI output described as a draft that is advisory and not released |

**Addendum (2026-09-25, plan check finding (b)).** CSV import template button (`csv-import-flow.tsx:170`, the Guidance step of all four `/app/admin/{risk-types,controls,information-systems,information-assets}/import` pages): `Download CSV template`, replacing `Download {Plural} CSV template`. Reason: `Button` is a `whitespace-nowrap` pill, and the collection-named label cannot fit the 343px content column at a 375px viewport (`Download Information Systems CSV template` and `Download Information Assets CSV template` measured a document `scrollWidth` of 377 and 391 at 375), so the page overflowed horizontally; the page heading `Import {Plural} from CSV` already names the collection. The label stays verb-first in the voice above. `Choose CSV file` and `Return to {Plural}` are unchanged. Owner: plan 08-08 Task 2; the four import pages are asserted at 375 in 08-08 Task 3.

---

## 12. Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| 2.5.3 Label in Name | Mobile trigger named `Menu` by its content (§2); search inputs' `aria-label` equals the visible label (§6); status badges have no `aria-label` (their text is the name); the scroll region's name repeats the table's visible name. |
| 4.1.2 Name, role, value | The scroll region carries `role`, name and `tabindex` only while scrollable, so no non-scrolling table gains a purposeless tab stop and axe's `scrollable-region-focusable` passes in both states. `aria-expanded` and `aria-controls` on the trigger. |
| 2.1.1 Keyboard | Region scrolling by arrow keys; every table control still reachable by Tab; no hover-only content. |
| 2.4.7 / 2.4.11 Focus | `--focus-ring` on the region frame; `scroll-padding` keeps focused cells clear of the sticky column and header; the global `scroll-padding-top` keeps them clear of the app header. |
| 1.4.1 Use of colour | Every status badge is icon plus text (§3); the scroll fade and hairline are cues for sighted users only and duplicate nothing that assistive technology needs (the region's name says it scrolls). |
| 1.4.10 Reflow | No horizontal page scroll from 320 to 1440; the only horizontal scrollers are labelled regions. Wrapping statement cells reduce table width at every viewport. |
| 1.4.11 Non-text contrast | Badge borders remain decorative by design (§3.5); the focus ring and the neutral badge text meet the §3 ratios. |
| 2.5.8 Target size | Unchanged: filter controls at the house heights, the §4 Buttons touch-target height below 768, the §4 DataTable minimum inside rows. |
| 1.3.1 Info and relationships | Governance question list grouped under section headings (§7); the cross-tab keeps `caption` and `th scope`. |
| 3.2.4 Consistent identification | One label, tone and icon per status value across every surface (§3.3). |
| Print | Content prints without chrome, with wrapped tables and repeated headers (§8). |
| Automated | Zero axe violations (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) on every route for every actor at 375 and 1440 (D-25), including `/sign-in` in both states and the root fallbacks. |

---

## Spacing

The §3.9 scale and layout tokens apply unchanged; this phase declares no scale and no exception. Filter grid gaps use the shipped `gap-3` step; badge padding and table cell padding are §4's; the print block adds no spacing value. X-1 and X-3 reuse rem multiples of the 4px scale (`1.5rem`, `14rem`, `28rem`) and are recorded in the direction document before use.

---

## Typography

The §3.10 scale applies unchanged (families, sizes, line heights, tracking, weights 400/500/600). Pairings used: `--text-heading-lg` (Instrument Serif) for the sign-in and fallback `h1`; `--text-heading-sm` for card titles; `--text-body` at 500 for governance question text; `--text-caption` at 500 in badges and at 400 for captions; `--text-micro` for section `h4` captions (amended 2026-09-26, verdict 3) and table headers; `--text-table` for cells. The GSD checker's "3-4 sizes, 2 weights" heuristic is superseded by the project's approved scale (ADR 0001 gap 8), as in Phases 06.5 and 07. No uppercase outside `--text-micro`; the serif never below the page-title size.

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | canvas, tables, cards, the sign-in card, print background |
| Secondary (30%) | `--color-bg-inset`, `--color-border-default`, `--color-text-secondary` / `--color-text-muted`, `--color-bg-sidebar` | neutral badge tone, hairlines, captions, navigation |
| Accent (10%): ink | `--color-primary`, `--color-text-link`, `--focus-ring` | primary pills (`Generate assessment draft`, `Go to workspace`, `Try again`), record links, focus rings |
| Status (semantic, §3.5) | info, success, warning, danger | status badges only, always with icon and text; never a chart fill |
| Severity (§3.6) | `--color-risk-*` | `RiskRatingBadge`, unchanged |
| Destructive | none added | existing destructive confirmations unchanged |

Accent is reserved for: primary buttons, record and text links with their underline, focus rings, the sidebar active bar and chart ink. The scroll-edge fade uses `--color-bg-surface` only. No new hue anywhere.

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| Row hover | `--color-bg-hover` at `--duration-micro` / `--ease-standard` (unchanged) |
| Scroll-edge cue | none: appears and disappears with the scroll position, no transition |
| Region scrolling | `scroll-behavior: auto`; arrow-key scrolling is instant |
| Badges | unchanged (`transition-[color,box-shadow]` from `Badge`, imperceptible at rest) |
| Print | not applicable |

Nothing auto-advances; reduced motion needs no new rule beyond the global one.

---

## Proposed CSRM extensions

For the orchestrator to accept and record in `docs/design/csrm-design-direction.md` before implementation (values in the table; patterns as wording). A plan task performs the recording.

| # | Where | Proposal | Exact wording or value to record | Rationale |
|---|---|---|---|---|
| X-1 | §4 DataTable | Scroll-edge cue | Add token `--table-scroll-fade-width: 1.5rem` to a "Scroll cues (CSRM extension, 2026-09-25)" paragraph: "While columns are hidden beyond the end edge of a horizontally scrolling table, a fade of `--table-scroll-fade-width` from transparent to `--color-bg-surface` covers that edge of the header and body. It is decorative and pointer-transparent, disappears at the end of the scroll, has no transition and is never a shadow. The start edge is cued by the sticky first column's 1px `--color-border-default` end hairline, which appears only while the table overflows." | Finding 2 of the Phase 7 UI review: a cut on a column boundary said nothing about hidden columns, and the direction allowed only a hairline. A fade in the surface colour is the only cue that adds no hue and no shadow. |
| X-2 | §4 DataTable | Scroll region behaviour | Replace the sentence "The scroll container is a labelled, keyboard-scrollable region." with: "Whenever the table is wider than its container, and only then, the scroll container is a keyboard-focusable region (`role="region"`, `tabindex="0"`) named `{table name}, scrolls horizontally`; a table that fits exposes no region. Arrow keys scroll it, the focus ring draws on its frame, and `scroll-padding` keeps a focused cell clear of the sticky column and header. Every DataTable applies the sticky identifier column while it overflows." | D-29 generalises the Risk Register's opt-in region; a region that exists without overflow is a purposeless tab stop and an axe finding. |
| X-3 | §4 DataTable | Long-text columns | Add: "A long-text column (a statement, a title, a condition) wraps, clamps to two lines, keeps the full text in the DOM and is bounded between `14rem` and `28rem` wide. Rows grow to fit; cells stay vertically centred. Mobile cards clamp to three lines." | The Risk Register statement column pushed six columns into the scroll at 1440 (STATE follow-up). Phase 7 clamps titles in rows; tables lacked the rule. |
| X-4 | §4 (new subsection "Print") | Print pattern | Add: "Print (CSRM extension, 2026-09-25). The shell (sidebar, header, skip link, footer, sheets, overlays) and interaction-only controls (search and filter inputs, density and pagination controls, header actions) do not print; page content prints at full width on `--color-bg-surface` with the screen type scale and the browser's default page margins. Scroll regions expand and sticky cells become static; table cells wrap so a table fits the paper; table headers repeat; rows, cards and tiles avoid breaking inside. Badges and chart marks keep their tints with `print-color-adjust: exact`; if a printer drops them, icon and text still carry the meaning. Links keep their underline and print no URL." | D-33; finding 3 of the Phase 7 UI review. No value is introduced. |
| X-5 | §4 Status & risk badges | Tone vocabulary | Add after "Every status badge uses the tinted recipe, whatever the record type": "Tones mean one thing across every record type: neutral for not yet started or terminal, info for work in progress with or waiting on the Requestor, warning for work waiting on a Security Analyst, success for submitted, approved or released, danger for a recorded overdue state. One shared mapping owns every status value's label, tone and icon; feature code never chooses them." | D-27; makes the mapping's assignments checkable against a stated meaning rather than taste. |

---

## Decisions recorded

Made without asking, as this phase runs in auto mode. Each follows the locked context, `AGENTS.md` and the direction document.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | Drafting copy uses "Assessment draft generation" / "Generate assessment draft" / "Draft generation is …", parallel to the shipped "Questionnaire generation" card, and the completion link becomes `Open assessment draft`. | Same card family, same grammar; "completed assessment" contradicted the advisory framing D-08 requires. |
| UI-D2 | The trigger's name comes from its content (`Menu`), with no `aria-label`; the close control keeps `Close navigation`. | The visible label must be in the name (2.5.3); an `aria-label` that merely equals the text is a second source of truth. `Close` is contained in `Close navigation`, so it already complies. |
| UI-D3 | Assessment status `approved` is labelled `Released`. Fallback if the orchestrator declines: keep `Approved` and change only the recipe (§3.6 test list shrinks accordingly). | Every other surface (lifecycle stepper, review queue, Requestor pages, alerts, activity) already calls this fact "released"; the list badge and filter option were the outliers. The stored value and query parameter stay `approved`; `Approved` remains the request status label. |
| UI-D4 | Questionnaire status is one derived four-value family (`analyst-review`, `not-started`, `draft`, `submitted`); the analyst list's `Awaiting submission` / `Ready for review` labels retire. | The list and its own filter disagreed, "Ready for review" outlived the review (Phase 7 UI-D21 reasoning), and the summary projection already carries the release fact the page uses. |
| UI-D5 | Control Implementation status and effectiveness stay definition-list text; `Not rated` and `Rating not recorded` placeholders are out of scope. | A definition value is not a badge; badging every enum in a detail sheet would exceed the §4 status density guidance. |
| UI-D6 | Filter bar: two rows from 768 to 1279, one four-track row from 1280; search input at least 200px; labels never wrap. | The sidebar makes content narrower at 1024 than at 768, so the single row cannot start before `xl`; the widths in §4.1 are derived from the shell's own tokens. |
| UI-D7 | Statement cells wrap and clamp to two lines within 14–28rem; the 1440 promise is "at least the first five columns visible". | Eight columns of headers and padding exceed the 1104px content width at 1440 regardless of the statement, so zero scroll cannot be promised honestly; the clamp plus the D-29 region is the truthful contract. |
| UI-D8 | Region semantics exist only while overflowing, measured by `ResizeObserver`; sticky first column and hairline on every table while overflowing; `stickyFirstColumn` retired. | The direction already says the identifier column is sticky "when horizontal scrolling is needed"; a permanent region or hairline would add tab stops and vertical rules where nothing scrolls. |
| UI-D9 | Only the two `Search collection` labels change; other search labels, already naming their records, stay byte-identical. | D-30 removes the generic label; renaming conformant labels would spend test churn for no user gain in a hardening phase. |
| UI-D10 | In `analyst-review` the governance `Question editor` is the single question list, grouped by section with answer type, required flag and choices; the read-only renderer is not rendered in that state. | The renderer added a false `Submitted` alert and showed no answers (none exist), while the editor is where the analyst acts; grouping and choices restore the information the renderer's section structure carried. |
| UI-D11 | Print hides chrome and interaction-only controls, wraps table cells, keeps underlines and prints no URLs, with default page margins. | Legibility without a new value; URLs after every record link would swamp dense tables. |
| UI-D12 | `/sign-in` renders an "unavailable" card (HTTP 200) when the development session is unavailable; the `(app)` layout redirects there instead of throwing; root `not-found.tsx` and `global-error.tsx` carry safe copy. | A production build without the attestation currently shows the framework's default 404 and error pages; the redirect keeps the fail-closed behaviour while giving D-21 its safe copy. |
| UI-D13 | `Generated by` on the released detail may become `Draft initiated by`, optionally. | Provenance is the initiating analyst, which the list already says precisely; not required by D-08. |

---

## Notes carried

- **Phase 7 UI review finding 1 (dashboard widget stretch at 1440)** is being settled by the orchestrator in the Phase 7 close-out and is not part of this contract. Whichever option lands (`items-start` cards or higher row caps), nothing in Phase 8 depends on it.
- The tests listed in §1.4, §2, §3.6, §5.5 and §7 change deliberately with their surfaces; no test is loosened.

---

## UI considerations

| Category | Element(s) | Status | Resolution |
|---|---|---|---|
| copy · provider neutrality | Draft generation card | covered | §1: no provider, model or "deterministic" in copy; provenance only where recorded |
| copy · advisory | Draft generation card | covered | `advisory`, `has not been released`, `Open assessment draft` |
| label in name | Menu trigger, search inputs | covered | §2, §6 |
| status consistency | All badge surfaces | covered | §3.3 one mapping, §3.4 surface list |
| responsive · filter bar | Risk Register 768–1440 | covered | §4.1 with derived widths |
| long text | Statement column | covered | §4.2 clamp within bounds |
| overflow · keyboard | Every DataTable, cross-tab | covered | §5 region only while overflowing, arrow keys, cue |
| focus obscured | Sticky column and header | covered | §5.4 `scroll-padding` |
| reduced motion | Cue and scrolling | covered | no transitions; `scroll-behavior: auto` |
| duplication | Analyst questionnaire review | covered | §7 single list |
| print | Every application page | covered | §8 |
| production build | `/sign-in`, app routes, 404, global error | covered | §9 |
| five states | Existing surfaces | covered | unchanged; harness must stay green (§10) |
| zero / empty | Question list with one question | covered | `Delete` disabled as today; list still renders once |
| responsive · print width | Wide tables on paper | backstop | browser check at 794px print emulation (§8) |
| responsive · 1280 | Filter bar single row | backstop | visual check that the search input is at least 200px and labels are one line |
| overflow · 1440 | Risk Register five visible columns | backstop | visual check with the seeded fixture |

---

## Registry safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| shadcn official (local source-owned components) | none new; existing `Badge`, `Button`, `Table`, `Input`, `Popover`, `Sheet`, `Card`, `Alert`, `Checkbox`, `Label`, `Textarea` | not required: no block added, no registry fetched (2026-09-25) |
| Third-party | none | not applicable |

No new dependency (`ResizeObserver` and `@media print` are platform features).

---

## Verification contract

- **Unit and component (vitest):**
  - `StatusBadge`: every family and value renders the mapped label, tone classes and icon; the questionnaire derivation maps `release` absent → `analyst-review`; no status renders `variant="outline"` without a tone; filter options read the mapping's labels.
  - `DataTable` and `ReportTable`: region present only with stubbed overflow; name pattern; hairline and sticky classes; no region in the loading state; `stickyFirstColumn` no longer accepted.
  - `RiskRegisterFilters`: the two layouts by breakpoint (class assertions) and the statement cell's wrap and clamp classes.
  - `AssessmentDraftJob`: every string in §1.1, the announcements in each state, no occurrence of `deterministic` or `assistance`.
  - `MobileNavigation`: trigger named `Menu` with `aria-expanded` and `aria-controls`.
  - Search labels: the two new labels; a grep test or assertion that `Search collection` is absent from the feature modules.
  - `QuestionnaireReview` in `analyst-review`: each question text once, grouped by section, with the caption line; no `Submitted` alert.
  - Sign-in and fallbacks: the unavailable card's copy with no `Continue as` control under the unavailable adapter; `not-found` and `global-error` copy.
- **E2E** (dev servers stopped; sign-in helpers assert the Dashboard heading and the role in the banner):
  - `accessibility.spec.ts`: existing routes plus `/sign-in` (both states, the unavailable one under the production-build project without attestation) and the root fallbacks; zero violations at 375 and 1440.
  - `design-contract.spec.ts`: `collectionSurfaces` unchanged; status badges on each surface resolve to a tinted tone (no bare outline); the scroll region assertions of §5.5 at 768 and 1024.
  - `design-system-conformance.spec.ts`: unchanged routes; the type scan still resolves every badge to `--text-caption` 500.
  - Journeys (D-14): the assessment journey uses `Generate assessment draft`, the `Draft generation …` states and `Open assessment draft`; the Risk Register journey asserts the filter bar at 1440 and the five visible columns; the questionnaire generation journey asserts each question once on the review page.
  - Print: `emulateMedia print` checks of §8 on the Risk Register, a report and a detail page.
- **Browser backstops** (orchestrator): the three backstop rows above, plus the cross-tab fade at 375 and the sign-in unavailable card on the production build.

---

## Checker sign-off

- [x] Dimension 1 Copywriting (flagged, non-blocking: seven recommendations, all applied in this revision)
- [x] Dimension 2 Visuals
- [x] Dimension 3 Color
- [x] Dimension 4 Typography (deferral to §3.10, as 06.5 and 07)
- [x] Dimension 5 Spacing (deferral to §3.9, as 06.5 and 07)
- [x] Dimension 6 Registry Safety
- [x] Dimension 7 Inventory Provenance

**Checked:** 2026-09-25 (gsd-ui-checker role): APPROVED. The checker verified the D-08 string locations (16/16 exact), the D-26 locations (14/14), the §3.4 surface citations (12/12) and the §3.6 test citations (one drift, fixed above), and confirmed no restated token value and no contradiction with a locked decision.

**Approval (orchestrator, 2026-09-25):** approved. UI-D3 is accepted: assessment status `approved` displays as `Released`, the stored value and query parameter stay `approved`, and the plan that implements it creates the root `CONTEXT.md` glossary (per `docs/agents/domain.md`; no such file exists yet) with the entry mapping the JDL value to the product label, so the term stays traceable (CONTEXT D-50). UI-D4 is accepted with the derivation taking an explicit nullable `release` (§3.3) and the three-option filter behaviour stated in §3.4. X-1 to X-5 are accepted as CSRM extensions; the plan that first needs each records it in `docs/design/csrm-design-direction.md` before implementation. The production fallbacks (§9.3) are in scope under D-21.
