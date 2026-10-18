---
phase: 08-production-integration-and-hardening
plan: 08
subsystem: ui
tags: [data-table, scroll-region, resize-observer, wcag-2.1.1, wcag-2.4.11, reflow, design-direction, risk-register, csv-import, vitest, playwright]

requires:
  - phase: 08-production-integration-and-hardening
    provides: the production-build browser harness that leaves the tree clean (08-02); the shared tinted status badges the register's treatment column already renders (08-07)
provides:
  - useHorizontalOverflow, horizontalScrollRegionProps, horizontalOverflowAttributes and HorizontalScrollRegion in components/csrm/horizontal-scroll-region.tsx - a table's scroller is a named, focusable region exactly while the table is wider than it (D-29)
  - the X-1 scroll cue, X-2 region behaviour and X-3 long-text column in docs/design/csrm-design-direction.md section 4 DataTable, and the --table-scroll-fade-width token with its end-edge fade in globals.css
  - every DataTable, the risk-exposure cross-tab and the three CSV import tables on that one primitive; the DataTable wrap column option; stickyFirstColumn retired
  - the Risk Register filter bar laid out for 768 to 1279 and from 1280, and a statement column that wraps and clamps (D-28)
  - search inputs named after their records on the two analyst review lists (D-30), and a template button that fits every import page at 375px
affects: [08-09 (print: the scrollers are one-cell grids and the cue is a ::after keyed on data-overflow), 08-10 (the cross-tab fade probe uses a constructable stylesheet), 08-11 (journeys meet regions only while tables overflow), 08-12 (accessibility sweep; axe scrollable-region-focusable at the import pages), 08-14 (phase gate), Phase 8 UI review]

tech-stack:
  added: []
  patterns:
    - "A table scroller renders data-overflow and data-overflow-end from measured geometry; role, name, tab stop, focus ring, the sticky identifier column and its hairline exist only while data-overflow is true."
    - "The end-edge cue is a sticky ::after that shares a one-cell grid with the table, so it stays at the visible edge while the table scrolls under it; scrollers therefore use a grid display (md:grid on DataTable)."
    - "Browser proofs of overflow-dependent semantics compare data-overflow with the measured scrollWidth/clientWidth first, so neither the region branch nor the no-region branch can pass vacuously."
    - "jsdom layout-dependent behaviour is unit-tested through src/test/layout-stubs.ts: per-element scroll geometry and a ResizeObserver that reports synchronously."

key-files:
  created:
    - apps/web/src/components/csrm/horizontal-scroll-region.tsx
    - apps/web/src/components/csrm/horizontal-scroll-region.test.tsx
    - apps/web/src/test/layout-stubs.ts
  modified:
    - docs/design/csrm-design-direction.md
    - apps/web/app/globals.css
    - apps/web/src/components/csrm/data-table.tsx
    - apps/web/src/components/csrm/data-table.test.tsx
    - apps/web/src/features/reports/report-table.tsx
    - apps/web/src/features/reports/report-views.test.tsx
    - apps/web/src/features/administration/csv-import-flow.tsx
    - apps/web/src/features/administration/administration-workflow.test.tsx
    - apps/web/src/features/risks/risk-register.tsx
    - apps/web/src/features/risks/risk-register.test.tsx
    - apps/web/src/features/risks/risk-register-filters.tsx
    - apps/web/src/features/assessments/assessment-list.tsx
    - apps/web/src/features/assessments/assessment-list.test.tsx
    - apps/web/e2e/risk-register-workflow.spec.ts
    - apps/web/e2e/administration-workflow.spec.ts
    - apps/web/e2e/analyst-insights.spec.ts

key-decisions:
  - "The end-edge fade is a position: sticky ::after placed in the same grid cell as the table (the scroller is a one-cell grid: md:grid on DataTable, grid on the cross-tab and CSV wrappers). The plan's absolutely positioned ::after scrolls away with the content inside a scroll container; a browser hit-test probe fails on that version part-way through the scroll (hit TD) and passes on this one."
  - "The hook owns measurement only. data-overflow and data-overflow-end render from its state, so server markup starts as data-overflow=\"false\" with no region; the hook writes just one value imperatively, --table-sticky-inline-start, which globals.css turns into scroll-padding-inline-start while data-overflow is true, and it is non-zero only when the first cell's computed position is sticky."
  - "The hook re-subscribes only when the scroller element can be replaced (DataTable: its state; cross-tab: scrollLabel; HorizontalScrollRegion: never). A ResizeObserver on the scroller, its first child and its table follows every change of rows, columns or density without re-rendering, so a fresh data array on each render (the register passes [...risks]) costs nothing."
  - "The cross-tab's scrollLabel stays the region's whole name and is applied verbatim, because the copy already ends in ', scrolls horizontally'."
  - "The desktop filter labels take whitespace-nowrap through a labelClassName prop on the shared CoreFilterFields; the mobile sheet's labels are unchanged."
  - "The retired generic search label is asserted absent with /search collection/i, which is stronger than the literal and keeps the plan's zero-match grep over apps/web/src and apps/web/e2e clean."

patterns-established:
  - "A new horizontally scrolling table uses DataTable, or wraps a plain Table in HorizontalScrollRegion with a grid display; never a bare overflow-x-auto div, which leaves the table primitive's container as an unlabelled inner scroller."
  - "A layout-dependent unit test stubs geometry with stubHorizontalGeometry and delivers resizes with TestResizeObserver.notifyAll() inside act()."

requirements-completed: [INT-04]

duration: about 50 min
completed: 2026-09-25
---

# Phase 08 Plan 08: Scroll regions with an edge cue, the Risk Register filter layout and named search inputs Summary

**Every table that scrolls horizontally is now a keyboard-focusable region named `{table}, scrolls horizontally` while, and only while, it is wider than its container. That covers each DataTable, the risk-exposure cross-tab and the three CSV import tables. While overflowing, a DataTable sticks its identifier column with its hairline, and every scroller shows a 1.5rem surface-coloured fade at the end edge until the end of the scroll. A table that fits has no tab stop, no sticky column and no vertical rule. The Risk Register filter bar is two rows from 768 to 1279px and one row of four tracks from 1280px. Its search input measured 601, 569, 244 and 308px at 768, 1024, 1280 and 1440. The statement column wraps and clamps, so at 1440 the first five columns are visible without scrolling. The analyst review searches name their records, and all four import pages fit 375px. X-1 to X-3 were recorded first. The targeted browser set passed 23 of 23 on the production build.**

## Performance

- **Duration:** about 50 min
- **Started:** 2026-09-25T19:18:20Z
- **Completed:** 2026-09-25T20:08Z (the metadata commit)
- **Tasks:** 3 of 3 (Tasks 1 and 2 test-first, RED then GREEN)
- **Files:** 19 across the code commits (3 created, 16 modified), plus this summary, STATE and ROADMAP

## Accomplishments

- **X-1, X-2, X-3 recorded before any component change (D-45).** In `docs/design/csrm-design-direction.md` §4 DataTable:
  - the sentence "The scroll container is a labelled, keyboard-scrollable region." is replaced by the X-2 wording verbatim;
  - `**Scroll cues (CSRM extension, 2026-09-25):**` carries `--table-scroll-fade-width: 1.5rem` and the X-1 wording;
  - `**Long-text columns (CSRM extension, 2026-09-25):**` carries the X-3 wording (14rem to 28rem, two-line clamp, three on cards).
- **One overflow primitive (D-29, UI-D8).** `components/csrm/horizontal-scroll-region.tsx` (`'use client'`) exports:
  - `useHorizontalOverflow(ref, deps)`, which measures after mount, on resize of the scroller, its first child and its table, and on scroll. It returns `{ overflowing, atEnd }`, where the end is `scrollLeft + clientWidth >= scrollWidth - 1`, and falls back to measuring without a `ResizeObserver`;
  - `horizontalScrollRegionProps(label, overflowing)`: `{ role: 'region', 'aria-label': '{label}, scrolls horizontally', tabIndex: 0 }` or `{}`;
  - `horizontalOverflowAttributes` and `horizontalScrollRegionFocusClassName`;
  - `HorizontalScrollRegion({ label, className, children })`, a grid `div` that always carries `[&>[data-slot=table-container]]:overflow-visible`, so the `ui/table.tsx` container never scrolls on its own.
- **DataTable.** `stickyFirstColumn` is gone from the props (a `@ts-expect-error` proves it no longer type-checks). The desktop scroller is `md:grid` on the hook. The region props, focus ring, sticky first header and body cell (`sticky left-0 … border-r border-border bg-surface`) apply only while overflowing. `DataTableColumn` gains `wrap?: boolean`, whose body cells get `whitespace-normal min-w-56 max-w-md`; the header is unchanged. The loading skeleton is never a region or a tab stop.
- **Cross-tab.** `ReportTable` calls the hook unconditionally. The wrapper exists only with a `scrollLabel`. Its region semantics and the `@max-2xl:` sticky column with its hairline apply only while the matrix overflows.
- **CSV import tables.** The Guidance columns, import preview and import results wrappers are three `HorizontalScrollRegion`s named `{Label} CSV columns`, `{Label} import preview` and `{Label} import results`. The preview and results wrappers are `hidden md:grid`. No sticky column.
- **The cue (X-1).** `globals.css` adds `--table-scroll-fade-width: 1.5rem` and three rules keyed on the data attributes:
  - `[data-overflow] > *, [data-overflow]::after { grid-area: 1 / 1 }`;
  - `[data-overflow="true"] { scroll-padding-inline-start: var(--table-sticky-inline-start, 0px) }`;
  - `[data-overflow="true"][data-overflow-end="false"]::after`: `position: sticky; inset-inline-end: 0; justify-self: end; z-index: 20; width: var(--table-scroll-fade-width); pointer-events: none; background: linear-gradient(to right, transparent, var(--surface))`, with no transition. It paints over the sticky table header (z-index 10) and under the app header (30).
- **Risk Register (D-28, UI-D6, UI-D7).**
  - The desktop grid is `hidden gap-3 md:grid md:grid-cols-3 xl:grid-cols-[2fr_1fr_1fr_1fr]`, and the search form is `md:col-span-3 xl:col-span-1`.
  - The four desktop labels are `whitespace-nowrap`; the sheet is unchanged.
  - The Statement column is `wrap: true`, and its `RecordLink` keeps `line-clamp-2`; cards keep `line-clamp-3`.
- **Search labels (D-30, UI-D9).** `Search assessment requests` and `Search risk assessments`. `Search collection` occurs nowhere under `apps/web/src` or `apps/web/e2e`.
- **Template button (UI-SPEC §11 addendum).** `Download CSV template` on all four import pages; `Choose CSV file` and `Return to {Plural}` are unchanged.

## Browser measurements (production build; identical in both targeted runs)

| Measure | 375 | 768 | 1024 | 1280 | 1440 |
|---|---|---|---|---|---|
| Search Risks input width | sheet | 601px | 569px | 244px | 308px |
| Filter labels on one line (one line box, height ≤ line height) | - | yes | yes | yes | yes |
| Filter rows | sheet | 2 | 2 | 1 | 1 |
| Risk Register `data-overflow` | cards | true (Tab from the density toggle reaches it; ArrowRight scrolls) | true (same) | matched its width (value not recorded) | true |
| Controls results `data-overflow` | cards | true | - | true | false |
| Information Systems results `data-overflow` | cards | true | - | false | false |
| Alerts `data-overflow` | - | true (Tab reaches it; ArrowRight scrolls) | - | - | - |
| My assessment requests (analyst) | - | - | - | - | false: no region, no tab stop |

- **Register at 1440:** the table still overflows (`data-overflow="true"`, as UI-D7 predicts for eight columns). The first five headers (Risk number, Statement, Inherent rating, Residual rating, Treatment status) end at 1292px against a visible edge at 1399px, and the statement cell's `white-space` is `normal`.
- **Guidance tables at 375** (`data-overflow` of the `{Label} CSV columns` wrapper):
  - `risk-types`: `false`, no region;
  - `controls`, `information-systems`, `information-assets`: `true`. Each is the named region, takes focus and scrolls on ArrowRight.
- **All four import pages at 375:** no page overflow, `Download CSV template` inside the viewport, and no serious or critical axe violation under the five WCAG tags. The 2026-09-24 baseline found `scrollable-region-focusable` on three of these pages.
- **Cross-tab at 375:**
  - Before scrolling: `data-overflow="true"`, `data-overflow-end="false"`, and the `::after` is drawn with width equal to the token (24px) and a `0s` transition.
  - The hit-test probe finds the fade at the visible end edge, and only across its own width, both before scrolling and half-way through the scroll.
  - At the end of the scroll `data-overflow-end="true"` and the `::after` has `content: none`.
  - At 1440 its `data-overflow` follows its width, and it exposes a region only if it overflows.

## Task Commits

1. **Task 1: X-1 to X-3, the overflow hook and the DataTable, cross-tab and CSV import regions**
   - `93b33e9` docs: the direction document extensions.
   - `337779a` test, RED: 9 failing tests in the three existing files and the new test file failing to load (missing module), plus the type-level RED `TS2578: Unused '@ts-expect-error' directive` on `stickyFirstColumn`.
   - `b6564e6` feat, GREEN: 4 files, 61 tests; full web suite 75 files, 963 tests.
2. **Task 2: Filter layout, statement wrap, search labels, template button**
   - `90b9e20` test, RED: 4 failing, each on the old behaviour.
   - `29bc543` feat, GREEN: 9 files, 136 tests; full web suite 75 files, 966 tests.
3. **Task 3: Browser proofs**
   - `3f8bf46` test: the three specs, committed after both targeted runs and the gate.
   - `6df10d8` test: axe (five tags) on each import page at 375, the baseline's finding, re-run alone at 4 of 4.

**Plan metadata:** the `docs(08-08): complete …` commit that carries this summary, STATE and ROADMAP.

## TDD Gate Compliance

Tasks 1 and 2 each have a `test(08-08)` RED commit before their `feat(08-08)` GREEN commit.

- **Task 1 RED (`337779a`).**
  - 9 tests failed on the missing behaviour: 4 in `data-table.test.tsx`, 2 in `report-views.test.tsx` and 3 in `administration-workflow.test.tsx`. The failures were no `data-overflow`, no region with stubbed overflow, `md:block` in place of `md:grid`, and no wrap classes. `horizontal-scroll-region.test.tsx` failed to load, because its module did not exist.
  - `typecheck` failed with `TS2578: Unused '@ts-expect-error' directive` (the retired prop still existed) and `TS2307` (the module).
  - Two cases passed in RED by design. The loading-skeleton guard asserts behaviour that already held. The `@ts-expect-error` case is a type-level proof, so its RED is the typecheck failure.
  - One test bug was fixed before the commit. The DataTable's own `<section aria-label="… controls">` is itself a named region, so the skeleton case now queries the scroll-region name. The first RED run had shown 10 failures because of it.
- **Task 2 RED (`90b9e20`).** 4 failed:
  - no `Download CSV template`;
  - no `Search assessment requests` searchbox;
  - no `md:grid-cols-3`;
  - no `whitespace-normal min-w-56 max-w-md` on the statement cell.

## Assertions changed deliberately, and why

**Unit (vitest)**

| File | Assertion | Change | Reason |
|---|---|---|---|
| `data-table.test.tsx` | first test, desktop scroller classes | `'hidden', 'md:block', 'scroll-pt-10'` → `'hidden', 'md:grid', 'scroll-pt-10'` | The scroller is a one-cell grid so the end-edge cue can stick to the edge (deviation 1). |
| `data-table.test.tsx` | `omits unsupported controls and provides an opt-in labelled sticky scroll region` | Split into `omits unsupported controls` (same control assertions, no `stickyFirstColumn` prop) and a region case in which `role`, name, `tabindex="0"` and the sticky classes are asserted only after stubbed overflow, and asserted absent before and after it. | UI-SPEC §5.5: in jsdom a table fits, so the region must not exist (UI-D8). |
| `data-table.test.tsx` | the test prop types | `stickyFirstColumn` removed from `TestDataTableProps`; `wrap` added to `TestColumn` | The prop is retired; X-3 column option. |
| `report-views.test.tsx` | cross-tab region case | Now stubs overflow first. It adds `toBe(scroller)`, `data-overflow="true"`, `data-overflow-end="false"`, and `@max-2xl:border-r` on the first cells. | UI-SPEC §5.5. The region appears only while the matrix overflows, with the hairline. |

Added, none loosened:
- `horizontal-scroll-region.test.tsx` (new, 8 tests);
- in `data-table.test.tsx`: the loading skeleton, the wrap column, server markup and `@ts-expect-error`;
- the cross-tab no-overflow case;
- the Guidance region case, and the preview and results wrapper assertions in `administration-workflow.test.tsx`, plus `Download CSV template` with no collection-named variant in the per-collection Guidance case;
- two Risk Register cases (the filter grid and labels; the statement wrap and clamp);
- one assessment-list case (the two search names).

No earlier test asserted `Search collection` or the collection-named template label (grep, 2026-09-25), so none changed.

**Browser (Playwright)**

| Spec | Change | Reason |
|---|---|---|
| `risk-register-workflow.spec.ts` | `viewportWidths` gains `1280` (seven widths). | 1280 is where the filter bar becomes one row; the plan's truth covers 1280, so it is proven in the browser, not only backstopped. |
| `risk-register-workflow.spec.ts` | `expectRegisterGeometry` from 768 adds the filter-bar geometry and the region proof. At 768 and 1024 it proves the region: it must exist, Tab reaches it from the density toggle, ArrowRight scrolls it, and `data-overflow-end="false"`. At 1440 it adds the five visible columns and `white-space: normal`. After the sweep it checks Alerts at 768 and My Requests at 1440 (fits, no region). | D-28, D-29 and UI-SPEC §5.5. `releasedNoticeHeading` already read `Released assessment - read only` (08-07) and was left alone. |
| `administration-workflow.spec.ts` | The three sweeps gain the region proof: Controls and Information Systems results from 768, and the Risk Type Guidance at every width. The imports test then visits the four `/import` pages at 375 and runs axe on each. It returns to `/app/admin/risk-types/import` at 1440 for the existing `Choose CSV file` focus and axe checks. | D-29, the UI-SPEC §5 and §11 addenda, and the 2026-09-24 baseline finding. |
| `analyst-insights.spec.ts` | The 375 cross-tab block adds `data-overflow`, `data-overflow-end`, the `::after` width equal to the token, no transition, and the hit-test probe before and half-way through the scroll. At the end of the scroll the cue is gone. A new 1440 branch checks that `data-overflow` follows the cross-tab's width. | X-1, and Phase 7 UI review finding 2. |

Every region proof first compares `data-overflow` with the measured `scrollWidth > clientWidth`, then asserts the matching branch, so neither branch passes vacuously.

## Files Created/Modified

- `docs/design/csrm-design-direction.md`: X-1, X-2, X-3 in §4 DataTable.
- `apps/web/app/globals.css`: the token and the three `data-overflow` rules.
- `apps/web/src/components/csrm/horizontal-scroll-region.tsx` / `.test.tsx` (new): the hook, region props, attributes and wrapper.
- `apps/web/src/test/layout-stubs.ts` (new): `stubHorizontalGeometry`, `stubRenderedWidth`, `TestResizeObserver`, `installTestResizeObserver`.
- `apps/web/src/components/csrm/data-table.tsx` / `.test.tsx`: overflow-keyed region and sticky column, `wrap`, `stickyFirstColumn` retired.
- `apps/web/src/features/reports/report-table.tsx`, `report-views.test.tsx`: the cross-tab on the hook.
- `apps/web/src/features/administration/csv-import-flow.tsx`, `administration-workflow.test.tsx`: three `HorizontalScrollRegion`s, `Download CSV template`.
- `apps/web/src/features/risks/risk-register-filters.tsx`, `risk-register.tsx`, `risk-register.test.tsx`: grid, labels, statement wrap, no `stickyFirstColumn`.
- `apps/web/src/features/assessments/assessment-list.tsx`, `assessment-list.test.tsx`: the two search names.
- `apps/web/e2e/risk-register-workflow.spec.ts`, `administration-workflow.spec.ts`, `analyst-insights.spec.ts`: the browser proofs.

## Decisions Made

See `key-decisions` above. In short:
- the cue sticks inside a one-cell grid;
- the hook measures, and the component renders the attributes;
- the hook re-subscribes only when the scroller element can change;
- `scrollLabel` stays whole;
- the desktop-only nowrap labels use a prop;
- the absence check is case-insensitive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's end-edge fade would drift into the table once scrolled**
- **Found during:** Task 1 (design), confirmed by a sensitivity run in Task 3.
- **Issue:** The plan prescribes `position: relative` on the scroller and an absolutely positioned `::after` with `inset-inline-end: 0`. An absolutely positioned box whose containing block is a scroll container moves with the scrolled content, so after any scroll the fade covers a column in the middle of the table instead of the edge.
- **Fix:** The scroller is a one-cell grid. The table's container and the `::after` both take `grid-area: 1 / 1`, and the `::after` is `position: sticky; inset-inline-end: 0; justify-self: end`, so it sticks to the visible end edge. Sticky offsets are applied by the compositor, so the fade does not lag during a scroll. The scrollers use `md:grid` (DataTable, CSV preview and results) or `grid` (cross-tab, CSV Guidance) in place of `md:block` or plain block. The data-table assertion changed with it (table above).
- **Verification:** `expectFadeAtVisibleEnd` in `analyst-insights.spec.ts` passes before and half-way through the scroll. With the plan's absolute rule swapped back into `globals.css` temporarily, the same test failed with `Error: the fade covers the visible end edge part-way through the scroll (hit TD)` (41 s run, log `apps/web/.tmp/logs/csrm-phase-08/08-08-sensitivity-absolute-cue.log`). `globals.css` was then restored with `git checkout --`.
- **Commit:** `b6564e6` (rule); `3f8bf46` (probe).

**2. [Rule 3 - Blocking] `stickyFirstColumn` removed from the Risk Register call in Task 1**
- **Found during:** Task 1 GREEN.
- **Issue:** Retiring the prop from `DataTableProps` made `risk-register.tsx` fail `typecheck`, which is part of Task 1's gate. The plan removes the prop at that call site only in Task 2.
- **Fix:** Removed ` stickyFirstColumn` from the `DataTable` call in Task 1; Task 2 added `wrap: true` as planned.
- **Files:** `apps/web/src/features/risks/risk-register.tsx`. **Commit:** `b6564e6`.

**3. [Test bug, fixed before the RED commit] The skeleton case matched the DataTable's own controls section**
- `<section aria-label="Risk Register controls">` has role `region`, so an unscoped `queryByRole('region')` found it. The query now names the scroll region.

**4. [Test probe, fixed in Task 3] The fade probe hit-tested outside the viewport**
- **Run 1 result:** 22 passed, 1 failed. The failure was `analyst-insights.spec.ts:378` with `Error: the fade covers the visible end edge before the cross-tab scrolls … Expected: true Received: false`. At 375×812 the cross-tab sits below the fold, and `elementFromPoint` returns `null` outside the viewport. The fade checks before it (attributes, 24px width, `0s` transition) had passed.
- **Fix:** The probe scrolls the page to centre the region (never the region itself) and reports what it hit.
- **Run 2:** 23 of 23.

### Plan-text deviations

**5. [Plan file list] A shared jsdom layout stub.** `apps/web/src/test/layout-stubs.ts` is a 20th file. It saves four suites from each carrying a copy of the geometry and ResizeObserver stubs. `risk-register-page.test.tsx` is in the plan's list but unchanged: the filters render in `risk-register.test.tsx`, which the plan allowed.

**6. [Plan wording] How the hook sets the attributes.**
- The plan says the hook "sets `data-overflow`, `data-overflow-end` and `--table-sticky-inline-start` on the element". Instead, the attributes render from the hook's state through `horizontalOverflowAttributes`, which gives each attribute a single owner and gives server markup `data-overflow="false"`, as the plan's own server-render case requires. Only the custom property is written directly.
- Two helpers are exported beyond the three listed: `horizontalOverflowAttributes` and `horizontalScrollRegionFocusClassName`.
- `scroll-padding-inline-start` lives in `globals.css` keyed on `[data-overflow="true"]`, the plan's "equivalent" of a `scroll-pl-[var(--table-sticky-inline-start)]` class, so feature code carries no arbitrary value.

**7. [Plan wording] `scrollLabel` applied verbatim.** `horizontalScrollRegionProps` appends ", scrolls horizontally", and the cross-tab copy already ends with it. `ReportTable` therefore applies its `scrollLabel` as the whole name with the same role and tab stop, rather than stripping and re-appending the suffix.

**8. [Plan grep vs. RED text] Case-insensitive absence check.** The plan's Task 2 verification requires zero `Search collection` matches under `apps/web/src` and `apps/web/e2e`, while its RED text asserts `queryByText('Search collection')` is null. The test uses `/search collection/i` instead. This is stronger (any capitalisation), and the grep stays at zero.

**9. [Acceptance wording] "four `whitespace-nowrap` labels".** Rendered, four labels carry the class. The unit test asserts it and the browser measures one line box each. Textually, `whitespace-nowrap` appears twice in `risk-register-filters.tsx`: on the search label, and as the `labelClassName` given to the three shared select labels.

**10. [Windows host] Command translations from the preamble.**
- `/opt/node24/bin` became `/c/ProgramData/nvm/v24.19.0`.
- `PLAYWRIGHT_BROWSERS_PATH` was omitted.
- Ports were checked with `Get-NetTCPConnection` (free before every run).
- Logs went to `apps/web/.tmp/logs/csrm-phase-08/`.
- Single test files ran through `pnpm --filter @csrm/web exec vitest run <path>`.
- Playwright ran with `--reporter=list,json` so the measurement annotations are kept in `08-08-targeted-run{1,2}.json`.

**Total deviations:** 2 auto-fixed (Rule 1, Rule 3), 2 test fixes and 6 recorded. **Impact on plan:** none on scope. No schema, contract, grant, catalogue, Strapi or `CSRM_AI_*` change.

## Verification

| Command | Result |
|---|---|
| Task 1 files (`horizontal-scroll-region`, `data-table`, `report-views`, `administration-workflow`) | 4 files, 61 tests (GREEN) |
| Task 2 files (`src/features/risks`, `assessment-list`, `assessment-review-workflow`, `administration-workflow`) | 9 files, 136 tests (GREEN) |
| `pnpm --filter @csrm/web test` (final tree) | **75 files, 966 tests passed** (16.6 s); 948 before the plan plus 18 |
| `pnpm --filter @csrm/web typecheck` (`next typegen && tsc --noEmit`) | exit 0, on the gate tree and again after `6df10d8` |
| `pnpm --prefix apps/web api:check` | exit 0, no drift |
| Targeted Playwright run 1 (`risk-register-workflow`, `administration-workflow`, `analyst-insights`, `design-contract`, `app-shell`; production build) | 22 passed, 1 failed (the probe outside the viewport, deviation 4); 154 s reported, 156 s wall |
| Targeted Playwright run 2 (same set) | **23 passed, 0 failed, 0 flaky**, no retries; 146 s reported (2.4 min), 148 s wall |
| `administration-workflow.spec.ts` alone, after adding axe at 375 (fresh production build) | **4 passed**, 0 failed (55.8 s reported, 57 s wall) |
| Sensitivity run (the cross-tab test alone, with the plan's absolute cue swapped into `globals.css` temporarily) | 1 failed as intended: `the fade covers the visible end edge part-way through the scroll (hit TD)`; 41 s wall; `globals.css` restored with `git checkout --` |
| `pnpm --filter @csrm/strapi test` | **504 passed / 0 failed / 0 skipped** (506.8 s of tests, 511 s wall); the same count as 08-07, since no Strapi file changed |
| `grep -nE "#[0-9a-fA-F]{3,8}\|[0-9]+px"` over `horizontal-scroll-region.tsx`, `data-table.tsx`, `risk-register-filters.tsx`, `csv-import-flow.tsx` | nothing |
| `grep -rn "Search collection" apps/web/src apps/web/e2e` | nothing |
| Freeze diff since `aa38d74` (`apps/strapi`, `docs/references`) | empty; no `CSRM_AI_` line and no Keycloak line changed |
| Acceptance criteria of all three tasks, re-run on the final tree | 37 checks, 0 failed |
| `git status --porcelain` | Empty after every commit. Before and after each browser run it listed only the three spec files being edited, so no run changed a tracked file. Empty after the Task 3 commit. Nothing listens on 1337 or 3000. |

## Known Stubs

None.

## Threat Flags

None. No endpoint, grant, data path or trust boundary is added. The mitigations are each asserted:
- **T-08-08-01:** the region has `tabIndex=0` while overflowing, the `ArrowRight` proofs pass in the browser, and scroll padding follows the measured sticky column.
- **T-08-08-02:** region semantics follow measured overflow, with no-overflow unit and browser cases. The `ui/table.tsx` container is neutralised inside every region. The three overflowing Guidance tables at 375 are named regions, and axe passes on all four import pages at 375.
- **T-08-08-03:** X-1 to X-3 are recorded first. Feature code uses `min-w-56`, `max-w-md` and the token, and the verification grep for hex or px values in the four feature files prints nothing.
- **T-08-08-04 (accepted):** the clamp is visual; the full statement stays in the DOM (unit case).

## Browser backstops for the orchestrator

Restart the dev servers on this code, sign in as Security Analyst, and check:

1. **Risk Register filter bar (`/app/risks`).**
   - At **1280** and **1440**: one row with search, Treatment status, Inherent rating and Residual rating. The search input is at least 200px (measured 244 and 308), and every label is on one line.
   - At **768** and **1024**: the search form alone on the first row (input measured 601 and 569), with the three selects on the next.
   - At **375**: `Filters (n)` opens the sheet, unchanged.
2. **Risk Register table.**
   - At **1440** the statement column wraps to at most two lines, and Risk number to Treatment status are visible without scrolling.
   - At **1024** the table is a focusable region `Risk Register results, scrolls horizontally`. Risk number stays sticky with a hairline while the rest scroll, and a fade marks the right edge until the scroll reaches its end.
   - Scroll part-way: the fade stays at the edge and does not travel with the columns.
3. **Cross-tab fade at 375** (`/app/reports/risk-exposure`, section `Residual rating by treatment status`).
   - The fade is visible at the right edge at rest and part-way through the scroll, and gone at the end.
   - Tab reaches the region, and ArrowRight scrolls it.
4. **Alerts at 768** (`/app/alerts`): the table is the focusable region `Alerts, scrolls horizontally`, with the sticky first column, its hairline and the end fade.
5. **The four import pages at 375** (`/app/admin/{risk-types,controls,information-systems,information-assets}/import`).
   - No horizontal page scroll.
   - `Download CSV template` sits inside the viewport.
   - Risk Types' column guidance fits (no region, no tab stop).
   - Controls, Information Systems and Information Assets' guidance is a focusable region `{Label} CSV columns, scrolls horizontally` with the end fade.
6. **A table that fits.** For example `/app/requests` at 1440: no tab stop on the table frame, no sticky column, no hairline and no fade.
7. **Search labels.** `/app/review/requests` shows `Search assessment requests`, and `/app/review/assessments` shows `Search risk assessments`.

## Next Phase Readiness

- `REQUIREMENTS.md` is unchanged, as in 08-01 to 08-07. INT-04 closes at the phase gate (08-14).
- **08-09 can start.** It edits `globals.css` and `data-table.tsx` for print.
  - The scrollers are one-cell grids (`md:grid` / `grid`), and the cue is a `::after` keyed on `[data-overflow="true"][data-overflow-end="false"]`.
  - Removing it for print through `[data-overflow]::after { content: none }` also covers the CSV import wrappers, which the 08-09 plan text does not name. The grid display itself is layout-neutral.
- **08-10:** the cross-tab probe injects its pointer-events override through a constructable stylesheet (`document.adoptedStyleSheets`). 08-10 keeps `style-src 'unsafe-inline'`, and CSSOM stylesheets are not governed by `style-src` in any case.
- **STATE follow-ups this plan closes:**
  - the Risk Register filter bar at 1024px (06.6);
  - the statement column that did not wrap at 1440 (2026-09-24 baseline);
  - only the register's scroller was focusable (06.6);
  - `Search collection` (06.6).
  - The 2026-09-24 baseline's CSV import findings at 375 (axe `scrollable-region-focusable`, and the overflowing template pill) are resolved. The four-page check proves both in the browser, axe included.

## Self-Check: PASSED

- `horizontal-scroll-region.tsx`, `horizontal-scroll-region.test.tsx`, `layout-stubs.ts` and this summary exist.
- The seven plan commits are on `dev`: `93b33e9`, `337779a`, `b6564e6`, `90b9e20`, `29bc543`, `3f8bf46` and `6df10d8`.
- The acceptance criteria were re-run on the final tree: 37 checks, all passing.
- The verification greps and the freeze diff are clean.
- Neither this plan's commits nor this summary carry tool attribution or a trailer.

---
*Phase: 08-production-integration-and-hardening*
*Completed: 2026-09-25*
