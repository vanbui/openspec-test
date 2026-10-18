# Phase 18: Risk table and spreadsheet interoperability - Research

**Researched:** 2026-10-01
**Domain:** an editable ARIA grid on TanStack Table, the bulk write path's bounds and risk-number allocation, the Excel clipboard, and an interaction-latency measure
**Confidence:** HIGH for the grid scoring, the bounds and the risk-number findings (read in the installed packages and the code this session); MEDIUM for the lag thresholds (official web-performance sources, with thresholds chosen here); LOW to MEDIUM for Excel's clipboard behaviour (no Excel in this environment; the pilot's manual paste is the oracle)

**Scope (stage2-rules §3a).** This file answers only the five questions `18-CONTEXT.md` leaves to research, plus the Validation Architecture. Everything else is settled in the CONTEXT (D-01 to D-30) and in earlier research, which is cited and not repeated:
- `16-RESEARCH.md` and `16-PATTERNS.md`: the guard, the inner `*WithinMutation` functions, the history writer with `batchId`, Pitfall 1 (nested serialisation deadlock) and Pitfall 10 (base values normalised as stored).
- `17.1-RESEARCH.md`: the round lock, the voids by fingerprint, Pitfall 10 (sequential awaits inside a transaction on PostgreSQL).
- `19-RESEARCH.md` and the Phase 19 plans: the XLSX writer, `value-convert.ts`, the export pipeline, Pitfall 5 (UTC serial dates).
- Phase 14's plans: the spreadsheet reader (14-02).

<user_constraints>
## User Constraints (from CONTEXT.md)

**Locked decisions:** D-01 to D-30 in `18-CONTEXT.md` bind this research and the plans, together with the UI-SPEC's orchestrator amendments. Following stage2-rules §3a, they are cited, not copied in full. These are the decision texts this research answers, verbatim:
- **D-04 (measured):** "the leading candidate's grid on the real Risks route (D-06) with 150 and 1,000 risks, against the four criteria: axe, a scripted APG keyboard walk and a manual screen-reader pass by the pilot; the route's delivered JavaScript within 300,000 bytes in `performance.spec.ts`; D-27's lag measure; semantic tokens only. A `checkpoint:decision` records pass or fail."
- **D-13 (bounds):** "every unsaved change goes in one call, up to the 1,000-risk cap and a payload bound research sets."
- **D-27 (lag):** "'Without visible lag' is a measured threshold that research defines (for example, the interaction latency of a cell commit, and long frames while scrolling, in Playwright at 1440px with 150 risks), asserted by a phase spec."
- **Code context (risk numbers):** "research checks that risk-number allocation for many creates stays safe (pre-checked numbers, or savepoints)."
- **UI-D10:** "Copied dates are `30/11/2026`. … research may confirm."

**Claude's discretion:** see the CONTEXT's "Planner's Discretion" (paths, names, reason codes, bounds, module placement).

**Deferred (out of scope):** see the CONTEXT's `<deferred>` section (the register's views, Admin scales, autosave, co-editing, formulas, risk files, portfolio import).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| ASSESS-15 | Configurable columns, sort, filter, a frozen first column, saved views; 150 risks without lag | Answer 1 (TanStack pinning, sizing, ordering and visibility features); Answer 2 (the lag thresholds) |
| ASSESS-16 | Inline editing, one batch save, undo, conflicts | Answer 3 (the bound); Answer 4 (risk numbers inside the batch) |
| ASSESS-17 | The APG grid; copy and paste with Excel and SharePoint | Answer 1 (cell selection and roving tabindex); Answer 5 (the clipboard formats) |
| ASSESS-18 | Controlled scales and the derived rating | No open question (D-20 to D-22 settled); covered by the Validation Architecture |
| ASSESS-19 | Import and export | No open question (Phase 19 machinery reused); the import commit avoids the JSON bound (Answer 3) and uses Answer 4's creates |
</phase_requirements>

## Summary

**The grid (decision 7's paper stage).** Extend the DataTable on the installed `@tanstack/react-table` 9.2.4. It passes all four criteria on paper, and it adds no dependency. Version 9.2.4 ships a `cellSelectionFeature` with an anchor and focus range model, `moveCellSelection`, `extendCellSelection`, `selectAllCells`, `getSelectedCellRangesData` and a roving `getTabIndex()`. It also ships features for column pinning, sizing, resizing, ordering and visibility. The APG grid semantics (`role="grid"` on the `<table>`, `aria-selected`, `aria-readonly`, the Home, End, Page and Ctrl keys, the editing keys) are ours to render on top.

react-data-grid fails or is weak on three criteria:
- its only React 19 line is `7.0.0-beta.61`, a beta series running since 2021 (the last stable release is 6.1.0, from 2019);
- its documented clipboard API is per cell (`onCellCopy`, `onCellPaste`), and it documents no range selection;
- it adds about 23 KB gzip of JavaScript plus its own stylesheet, whose colours are hard-coded `light-dark()` defaults that must be overridden.

AG Grid Community, MUI X, Handsontable and Glide stay eliminated by `REPORT.md` §7 (D-04).

**The bounds and risk numbers.**
- **The payload bound** comes from Strapi's JSON body limit. `config/middlewares.ts` sets only `formLimit`, so `koa-body`'s default `jsonLimit: '1mb'` applies: 1,048,576 bytes. The Server Action limit (`'6mb'`) is above it. So the request is bounded by at most 1,000 row entries and at most 1,000,000 serialised bytes. The web enforces the byte bound on the change set before the change set grows past it, and Strapi's 413 is the backstop.
- **Risk numbers.** The CONTEXT's PostgreSQL pitfall does not arise as feared. `riskNumber`'s `"unique": true` creates no database index in Strapi 5.51, which builds a unique index only from `attribute.column.unique`; the development database confirms there is none. Uniqueness is the entity validator's `SELECT`, run on the same transaction. A collision is therefore a JavaScript `ValidationError` thrown before any failing SQL statement, and PostgreSQL does not abort the transaction. `createWithRiskNumber`'s retry is safe inside the bulk transaction on both PostgreSQL and SQLite.

**Lag.** "Without visible lag" becomes three measured thresholds in Playwright (Chromium 145, production build, 1440×900, 150 risks):
- every keyboard interaction's Event Timing duration has p75 ≤ 100 ms and a maximum ≤ 200 ms;
- a full-height wheel scroll produces no long animation frame over 100 ms;
- at most two long animation frames over 50 ms.

At 1,000 risks (D-04's virtualisation decision) the gate is the web.dev "good" INP line: p75 ≤ 200 ms, and no frame over 200 ms.

**Dates on the clipboard.** `text/plain` carries `30/11/2026` (UI-D10). An en-AU Excel or SharePoint reads it as a date, by the system or site locale. The `text/html` cell adds Office's `x:num` serial and an `mso-number-format`, so desktop Excel in any locale receives a real date.

**Primary recommendation:** build the risk table as the DataTable's grid mode on TanStack Table 9.2.4's own cell-selection, pinning, sizing, ordering and visibility features. Bound the bulk call at 1,000 rows and 1,000,000 bytes. Keep `createWithRiskNumber` and call it sequentially. Assert the lag thresholds in a desktop-only spec.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Grid navigation, selection, the change set, undo, clipboard formats, paste preview | Browser (Client Component) | — | Pure interaction state; the zod-free `risk-table-domain.ts` (08-13 rule) |
| Paste conversion (dates, scales, people, controls) | API (Strapi converters, authoritative) | Browser mirror for the preview, parity-tested (19 D-29) | Strapi validates every applied cell again on save |
| Bulk save: bounds, compare-and-set, all or nothing, risk numbers | API (Strapi bulk core in one transaction) | — | One write path (D-13) |
| Payload byte bound | Browser (change-set guard) | API (`koa-body` 413 backstop; parser row bounds) | The user learns before saving; the server never trusts the client |
| Lag measurement | Test tier (Playwright, Chromium) | — | Event Timing and Long Animation Frames are browser APIs |

## Standard Stack

### Core (no new dependency)
| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| `@tanstack/react-table` (with `@tanstack/table-core` 9.2.4) | 9.2.4, already in `apps/csrm/package.json` | Headless table: sorting, filtering, pinning, sizing, ordering, visibility and **cell range selection** | MIT [VERIFIED: npm registry; installed `package.json`]; legitimacy check `OK`, 25.6M weekly downloads; the DataTable already uses it (06.6 D-02 "extended, never forked") |

### Conditional (only if D-04's measurement fails at 1,000 risks)
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `@tanstack/react-virtual` | 3.14.13 (latest, published 2026-09-14); one dependency, `@tanstack/virtual-core` 3.17.11 | Row virtualisation with `aria-rowcount` and `aria-rowindex` | Only after the 1,000-risk gate fails. `[WARNING: flagged as suspicious — verify before using.]` The seam says `too-new`, because the latest release is 17 days old. The plan that adds it pins an exact version and carries a `checkpoint:human-verify` |

### Alternatives Considered (decision 7, scored on paper)

| Criterion (pass or fail) | DataTable on TanStack Table 9.2.4 | react-data-grid |
|---|---|---|
| **Licence** | MIT. **Pass** | MIT [VERIFIED: npm registry]. **Pass** |
| **Maintenance** | 9.2.4 is `latest`, modified 2026-08-28. **Pass** | `latest` is `7.0.0-beta.61` (2026-07-14). The 7.x betas began 2021-08-04, and the last stable release is 6.1.0 (2019-04-03) [VERIFIED: npm registry `time`]. Only the beta line declares React `^19.2`. **Weak:** a beta on the production path |
| **ARIA APG data grid at WCAG 2.2 AA** | Headless. The cell-selection feature provides roving `getTabIndex()`, a range model, `moveCellSelection` and `extendCellSelection` (up, down, left, right), `selectAllCells`, `getSelectionEdges` and `getSelectedCellRangesData` [VERIFIED: `table-core/dist/features/cell-selection/cellSelectionFeature.types.d.ts`]. It contains no ARIA, so the grid roles, the Home, End, Page and Ctrl keys, the edit keys and the live region are written by us on the `<table>`. APG: an HTML `table` with `role="grid"` keeps its implied row and cell semantics [CITED: w3.org/WAI/ARIA/apg/patterns/grid]. **Pass on paper; proven by the measured stage** | `role="grid"`, `aria-rowcount`, keyboard navigation and frozen columns are documented [CITED: package README]. Copy and paste are per-cell callbacks (`onCellCopy`, `onCellPaste`), and selection is `selectedRows` plus one active position. No multi-cell range is documented [ASSUMED absence]. D-17's Shift-extended ranges and D-18's range copy would have to be built around it. **Fail on paper** |
| **Route JavaScript budget (300,000 bytes delivered)** | Zero new packages. The added features measure 21,187 bytes gzip **unminified, with comments**; that is an upper bound, and the real cost is smaller [VERIFIED: measured this session, `gzip -c` over the six feature folders] | `lib/index.js` is 23,131 bytes gzip, plus `styles.css` at 2,210 bytes gzip [VERIFIED: measured from the 7.0.0-beta.61 tarball], **on top of** the DataTable, which every list keeps. **Weak** |
| **Semantic tokens only** | Our markup and our Tailwind token classes. **Pass** | Its stylesheet ships hard-coded `light-dark(...)` and `hsl(...)` defaults, themed only by overriding its `--rdg-*` variables, and dark mode follows `color-scheme` or `rdg-light` and `rdg-dark` classes [CITED: README "CSS Variables"]. **Conditional** |
| **Result** | **Leading candidate for the measured spike** | Eliminated on paper (range selection and clipboard), with maintenance and budget as weak points |

**Installation:** none.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---|---|---|---|---|---|---|
| `@tanstack/react-table` | npm | 9.2.4 published 2026-08-28 | 25.6M/wk | github.com/TanStack/table | [OK] | Approved (already installed) |
| `react-data-grid` | npm | 7.0.0-beta.61 published 2026-07-14 | 731K/wk | github.com/Comcast/react-data-grid | [OK] | Scored only; not recommended |
| `@tanstack/react-virtual` | npm | 3.14.13 published 2026-09-14 | 29.6M/wk | github.com/TanStack/virtual | [SUS] (`too-new`) | Conditional; flagged: the planner adds `checkpoint:human-verify` before any install |

No package has a `postinstall` script (seam signals). **Removed [SLOP]:** none. **Flagged [SUS]:** `@tanstack/react-virtual`, conditional only.

## Answer 1: the grid spike, the measured stage (D-04)

The first UI plan builds the grid on the real Risks route and records pass or fail at a `checkpoint:decision`, against:

1. **ARIA and WCAG 2.2 AA:**
   - axe (`@axe-core/playwright` 4.11.0, installed) with zero violations in both modes;
   - a scripted APG walk: Tab enters once; the arrows; Home and End; Ctrl+Home and Ctrl+End; Page Up and Page Down; Enter or F2 edits; Escape cancels; Shift+arrow extends; Ctrl+A. The walk asserts that `document.activeElement` is the expected cell and that there is exactly one `tabindex="0"` cell;
   - the pilot's manual screen-reader pass.
2. **Budget:** the Risks route in `performance.spec.ts` under `PERFORMANCE_BUDGETS.deliveredJsBytes = 300_000` [VERIFIED: `apps/csrm/e2e/performance.spec.ts:55` reads `const PERFORMANCE_BUDGETS: Budget = { deliveredJsBytes: 300_000, ttfbMs: 500, lcpMs: 2_500 };`]. An override needs the file's rule at lines 69-73: "1.5 × the measured median … with a one-line reason". Headroom is thin: R-08-34 recorded the existing review editor at 89.9 %. So the editors, the sheet, the preview, the chooser and the views menu load with `next/dynamic` (D-27).
3. **Lag:** Answer 2's thresholds, at 150 and 1,000 risks.
4. **Tokens:** `design-system-conformance.spec.ts` and a grep showing no hex or `hsl(` in `features/risk-table/`.

**What to build on TanStack Table:**
- Register `cellSelectionFeature`, `columnPinningFeature` (Risk number pinned left), `columnSizingFeature` with `columnResizingFeature`, `columnOrderingFeature` and `columnVisibilityFeature` beside the DataTable's three existing features, in a separate `tableFeatures({...})` for the grid mode, so the plain lists do not pay for them.
- `manualSorting` and `manualFiltering` stay for server-paged lists. The risk table sorts and filters on the client through D-08's pure module.
- The keys TanStack lacks (Home, End, Page Up and Page Down, the Ctrl jumps, row and column selection) are written with `setFocusedCell` and `selectCellRange` [VERIFIED: the same types file].
- Watch `autoResetCellSelection`, which defaults to true and resets the selection whenever `data` changes [VERIFIED: the same types file, lines 77-85]. Applying an edit changes `data`, so set `autoResetCellSelection: false` and keep the selection by row id.

## Answer 2: measuring "without visible lag" (D-27, SC5)

**The instruments** (Chromium 145.0.7632.6, from Playwright 1.58.2 [VERIFIED: `playwright-core/browsers.json`]):
- **Event Timing:** `new PerformanceObserver(cb).observe({ type: 'event', durationThreshold: 16, buffered: true })`. Each entry's `duration` runs from input to the next paint. That covers input delay, processing and presentation [CITED: web.dev/articles/inp], rounded to 8 ms, with a 16 ms minimum threshold, and grouped by `interactionId` [CITED: developer.mozilla.org PerformanceEventTiming].
- **Long Animation Frames:** `observe({ type: 'long-animation-frame', buffered: true })`. Frames over 50 ms, with `duration` and `blockingDuration`; shipped in Chrome 123 [CITED: developer.chrome.com/docs/web-platform/long-animation-frames]. Scrolling is not an INP interaction [CITED: web.dev/articles/inp], so frames are the scroll measure.
- **Accounting guard:** interactions under 16 ms produce no Event Timing entry. So before and after the script, read `performance.eventCounts.get('keydown')`. It must rise by the number of presses, which proves that Playwright's CDP key events are counted. Otherwise the run fails as `PERFORMANCE_ACCOUNTING_INCOMPLETE`, the existing spec's convention, rather than passing vacuously [ASSUMED: CDP-dispatched keys are trusted and counted; the guard verifies it].

**The script** (desktop project only, production build, fixture created through this phase's bulk operation):
- Warm-up: one Enter and Escape, so the `next/dynamic` editor chunk is loaded before measuring.
- Then: Down ×20, Right ×8, Page Down ×3, Ctrl+End, Ctrl+Home; ten edits (Enter, type, Enter); Shift+Down ×9, then a value committed with Ctrl+Enter (SC1's fill); Ctrl+Z; Ctrl+Y.
- After each key, await its visible effect (active cell, value or count) so that presentation is included.
- Scroll: `page.mouse.wheel(0, 400)` over the grid until the last row is visible, awaiting one animation frame per step.

**The thresholds:**

| Fixture | Interactions (per `interactionId`, max entry duration) | Scrolling | Meaning |
|---|---|---|---|
| **150 risks, comfortable density (SC5 assertion)** | p75 ≤ 100 ms **and** max ≤ 200 ms | no LoAF > 100 ms; at most 2 LoAF > 50 ms | 100 ms is the instant-response line behind Event Timing's 104 ms default [CITED: MDN]; 200 ms is "good" INP [CITED: web.dev] |
| **1,000 risks, compact (D-04 virtualisation gate, UI-SPEC backstop)** | p75 ≤ 200 ms **and** max ≤ 500 ms | no LoAF > 200 ms | "Good" INP at p75; "poor" begins above 500 ms [CITED: web.dev]. A fail adds TanStack Virtual |

- **Samples:** three fresh pages; assert the median of the per-sample p75 and the median of the per-sample maximum (the `median()` of `src/lib/testing/performance-metrics.ts`, the same approach as `performance.spec.ts`).
- **No CPU throttling in the assertion.** An optional 4× CDP-throttled run is recorded in the JSON record and not asserted, because throttled numbers vary across machines.
- **Record:** the raw entries, as `performance.spec.ts` records its samples.
- **Choices recorded `[ASSUMED]`:** the thresholds are this research's choice of numbers. The Assumptions Log records them for the orchestrator.

## Answer 3: the bulk payload bound (D-13)

**Facts:**
- `strapi::body` is configured with only `formLimit: '6mb'` and `formidable` [VERIFIED: `apps/backend/config/middlewares.ts:22-31`].
- `koa-body` 6.0.1 defaults to `jsonLimit: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().default('1mb')` [VERIFIED: `node_modules/.pnpm/koa-body@6.0.1/.../lib/types.js:31`].
- `bytes('1mb')` = **1,048,576** [VERIFIED: evaluated with `bytes` 3.1.2].
- The web's Server Action limit is `bodySizeLimit: '6mb'` [VERIFIED: `apps/csrm/next.config.ts:27`]; 14-14 keeps 6 MiB as the default.
- No risk text field has a length bound today: `parseWritableRiskFields` checks only types and enums [VERIFIED: `assessment-workflow.ts:561-585`]. So one long cell can be large.

**The bound:**

| Bound | Value | Where | Refusal |
|---|---|---|---|
| Row entries per call (updates plus creates) | ≤ 1,000, with no duplicate risk id | Strapi parser | 400 `RISK_CHANGES_TOO_LARGE` (a new code name; planner's discretion within D-03 item 8) |
| Creates | ≤ 1,000 minus the assessment's current risk count (`MAX_ASSESSMENT_RISKS`) | Bulk core, inside the transaction | 409 `ASSESSMENT_RISK_LIMIT` |
| Planned mitigation-control additions | ≤ 50 per row and ≤ 1,000 per call [ASSUMED numbers] | Strapi parser | 400 `RISK_CHANGES_TOO_LARGE` |
| Serialised request | ≤ **1,000,000 UTF-8 bytes** (`new TextEncoder().encode(JSON.stringify(body)).length`), under the 1,048,576-byte limit with room for the envelope | Web: checked when a paste, fill or import of edits would grow the change set; the preview refuses with "Save your changes first, then paste the rest" | Server backstop: `koa-body` 413 with no reason. The web maps an unreasoned 413 to the same words (the 14-05 precedent) |

- **Why not raise `jsonLimit`:** the setting is global, so raising it widens every JSON route's denial-of-service surface. Imports do not post rows as JSON (the commit references Strapi's preview record), so large changes already have a route. SC1's ten-risk batch is about 3 KB, and 150 risks × every writable field is under 1 MB unless the text is very long.
- **Recommendation:** pin `jsonLimit: '1mb'` explicitly in `config/middlewares.ts`, with a comment naming D-13, so the contract value is visible. The planner decides; this is a one-line change in a Strapi config file.
- **Undo** of a batch sends the inverse with the same cells, so it stays within the bound by construction.
- **Bases** are sent as full values, never hashes, because the conflict response returns current values anyway (D-14). Normalise them as stored (16-RESEARCH Pitfall 10).

## Answer 4: allocating risk numbers inside one transaction

**What the code does:**
- `createWithRiskNumber(create, generate = generateRiskNumber)` delegates to `createWithDomainNumber` [VERIFIED: `risk-number.ts:18-23`].
- That function makes `DOMAIN_NUMBER_CREATE_ATTEMPTS = 5` attempts and retries only when `isDomainNumberUniqueConflict` matches [VERIFIED: `domain-number.ts:5, 43-56`].
- The matcher accepts a validator detail whose path is `riskNumber` and whose message matches `/unique/i`, or `SQLITE_CONSTRAINT_UNIQUE`, or `/unique constraint/i` [VERIFIED: `domain-number.ts:26-41`].
- Numbers are `RSK-{UTC year}-{6 Crockford base32 characters}` [VERIFIED: `domain-number.ts:17-24`]: 32^6 = 1,073,741,824 per year.

**What enforces uniqueness:**
- The schema declares `"riskNumber": { "type": "string", "required": true, "unique": true }`, with `"draftAndPublish": false` [VERIFIED: `csrm-risk/schema.json:10-19`].
- In `@strapi/database` 5.51.0, a unique index is created only when `column.unique` is set. `createColumn` takes `unique` only from `attribute.column` [VERIFIED: `@strapi/database/dist/schema/schema.js:19-31, 94-104`].
- The development database's indexes on `csrm_risks` are `csrm_risks_documents_idx`, `csrm_risks_created_by_id_fk` and `csrm_risks_updated_by_id_fk`, and there is **no unique index** on `risk_number` [VERIFIED: read-only query of `apps/backend/.tmp/data.db` this session].
- Uniqueness is the entity validator's test `'unique', 'This attribute must be unique'`, a `strapi.db.query(uid).findOne` [VERIFIED: `@strapi/core/dist/services/entity-validator/validators.js:236-275`]. That query joins the open transaction through `transactionCtx.get()` [VERIFIED: `@strapi/database/dist/query/query-builder.js:536-542`].
- A nested `strapi.db.transaction` reuses the outer transaction and creates **no savepoint** [VERIFIED: `@strapi/database/dist/index.js:60-97`].

**Consequences:**
- **PostgreSQL:** a collision is a `ValidationError` thrown in JavaScript after a successful `SELECT`, with no failed statement, so the transaction is not put into the aborted state. PostgreSQL's aborted state follows only a failed statement: "ROLLBACK TO is the only way to regain control of a transaction block that was put in aborted state by the system due to an error" [CITED: postgresql.org/docs/current/tutorial-transactions.html]. The retry is safe. `[VERIFIED by code path; not run on PostgreSQL: pg is not installed (R-08-37)]`
- **SQLite:** the same validator path applies. Even a real constraint error would keep the transaction active ("changes caused by prior SQL statements within the same transaction are preserved and the transaction remains active", the default ABORT) [CITED: sqlite.org/lang_conflict.html]. **This is why SQLite tests cannot catch a PostgreSQL abort:** if a database unique index were ever added, the same retry would pass on SQLite and fail with "current transaction is aborted" on PostgreSQL.
- **Within one batch:** the validator sees the batch's own earlier inserts through the shared transaction, so two creates in one batch never share a number.
- **Across transactions:** under PostgreSQL's READ COMMITTED, the validator cannot see another transaction's uncommitted insert, and no index catches it. Two concurrent creates on different assessments could, in theory, commit the same number. The chance is about 1 in 10^9 per concurrent pair, and the per-assessment lock does not cover it. This holds today for every create path, not only Phase 18's.

**Prescription:**
1. The bulk core and the import call `createRiskWithinMutation` (16-04, which uses `createWithRiskNumber`) **sequentially**, one create at a time. Never use `Promise.all` (17.1-RESEARCH Pitfall 10).
2. Never catch and continue a database error inside the bulk transaction. Every refusal is decided before writes (validation, bounds, compare-and-set), and any thrown error rolls back the whole batch.
3. Do **not** add a database unique index in this phase. That would be a third schema change, outside D-01's two. The `phase-18-bulk-risk-changes-and-import.md` record states that `riskNumber` uniqueness is validator-level, names the residual cross-transaction race, and adds one line to R-08-37's checklist: "if `riskNumber` gains a database unique index, move the retry behind `SAVEPOINT` and `ROLLBACK TO SAVEPOINT` (raw, on the transaction)" [CITED: postgresql.org/docs/current/sql-savepoint.html].
4. **Tests** (Strapi integration, SQLite), each through the `generate` parameter:
   - a bulk batch of three creates whose generator first returns an existing risk's number commits three distinct numbers, with three `created` history rows sharing one `batchId`;
   - a generator that returns the same value twice inside one batch is retried, not duplicated;
   - a generator that always collides fails the whole batch, and persistence stays deep-equal.

## Answer 5: a clipboard date Excel reads as a date (D-18, UI-D10)

**Recommendation:**

| Flavour | A date cell | Who reads it |
|---|---|---|
| `text/plain` (tab-separated) | `30/11/2026` | Excel and SharePoint parse typed and pasted text by the system's (or the site's) regional settings. An en-AU locale reads `30/11/2026` as a date, while an en-US locale keeps it as text [CITED, MEDIUM: learn.microsoft.com Q&A and support pages on regional date formats; ASSUMED for SharePoint Quick edit] |
| `text/html` (inside `<html xmlns:x="urn:schemas-microsoft-com:office:excel">`) | `<td x:num="46356" style="mso-number-format:'dd\/mm\/yyyy'">30/11/2026</td>` | Office HTML keeps a cell's value in `x:num`, the display text in the cell and the format in `mso-number-format` [CITED, LOW-MEDIUM: Office HTML and XML Reference mirror, stigmortenmyre.no/mso/html/excel/xlconformulas.htm]. Desktop Excel takes the HTML flavour from a browser, so the date arrives as a real date in any locale [ASSUMED] |

- **The serial:** compute it from the calendar date, never from a local `Date`: `(Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000`. For 30/11/2026 that is **46356** [VERIFIED: evaluated]. This avoids 19-RESEARCH Pitfall 5's one-day shift.
- **Text cells** in the HTML carry `mso-number-format:'\@'`, so Excel keeps strings such as `1-2` as text instead of turning them into dates [ASSUMED].
- **Paste parsing:**
  - Read `text/plain` first, as Excel's tab-separated text: quoted fields may hold tabs and line breaks, with doubled quotes.
  - Fall back to `text/html` only when `text/plain` is absent. Parse it with `DOMParser`, which builds an inert document, and read only `textContent`.
  - Pasted HTML never reaches the DOM.
- **Proof:** no Excel exists here (19-VALIDATION fact 5). Vitest asserts the exact clipboard strings, the serial and the TSV quoting. The pilot's manual paste into desktop Excel and SharePoint (D-29; UI-SPEC backstop) is the oracle.

## Common Pitfalls

### Pitfall 1: The selection resets on every edit
TanStack's `autoResetCellSelection` defaults to true and resets the selection whenever `data` changes. **Avoid:** `autoResetCellSelection: false`, with stable `getRowId` (the risk documentId, or a client id for new rows).

### Pitfall 2: The lag spec passes vacuously
Event Timing omits interactions under 16 ms, and a key that never reached the page also leaves no entry. **Avoid:** the `performance.eventCounts` guard (Answer 2).

### Pitfall 3: The first edit pays for the chunk
`next/dynamic` editors download on first use, which inflates the first interaction. **Avoid:** the warm-up step. Also prefetch the editor chunk on grid focus (planner's choice).

### Pitfall 4: SQLite hides PostgreSQL aborts
The tests run only on SQLite (R-08-37). **Avoid:** Answer 4 rules 1 and 2, plus the R-08-37 checklist line.

### Pitfall 5: Copy carries formulas
A copied cell starting with `=`, `+`, `-` or `@` pasted as `text/plain` into Excel is evaluated. Exports neutralise these (19 D-11), but D-18 copies display values. **Avoid:** text cells marked `mso-number-format:'\@'` in HTML [ASSUMED effective]. Whether `text/plain` also applies the neutraliser is an **open question** for the orchestrator.

### Pitfall 6: The byte bound is discovered at save
If only the server enforced it, the analyst would learn after building a large change set. **Avoid:** the web checks the projected size in the paste and fill previews.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | react-data-grid documents no multi-cell range selection | Alternatives | Low: it is still weaker on maintenance and budget |
| A2 | CDP key events are counted by Event Timing | Answer 2 | None: the `eventCounts` guard detects it |
| A3 | Thresholds: 100 and 200 ms at 150 risks; 200 and 500 ms at 1,000; the LoAF limits | Answer 2 | Too strict means flaky runs or an unneeded Virtual; too loose means lag that users can see. The orchestrator confirms |
| A4 | The control-addition bounds (50 per row, 1,000 per call) | Answer 3 | Low: planner-adjustable |
| A5 | Excel prefers the HTML flavour and honours `x:num` and `mso-number-format` (date and `\@`) | Answer 5 | Dates arrive as text outside en-AU, or text converts. The manual paste catches it |
| A6 | SharePoint Quick edit pastes `text/plain` by the site's locale | Answer 5 | An en-AU site is the target. The manual check covers it |

## Open Questions (for the orchestrator)

1. **Should copy neutralise formula-like text in `text/plain`?** D-18 says display values, while CSV-01 and 19 D-11 neutralise exports. Recommendation: neutralise in `text/plain` with Phase 19's one function, and mark HTML text cells `\@`. A copy then leaves the system with the same protection as an export.
2. **Confirm the lag thresholds (A3)** and that the 1,000-risk gate decides virtualisation.
3. **Pin `jsonLimit: '1mb'` explicitly** in `apps/backend/config/middlewares.ts` (Answer 3), or leave the default implicit.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Playwright Chromium | The lag spec, the APG walk, clipboard E2E | ✓ | 1.58.2 / Chromium 145.0.7632.6 | — |
| `@axe-core/playwright` | The spike's axe criterion | ✓ | 4.11.0 | — |
| PostgreSQL (`pg`) | Answer 4 on the real target | ✗ | — | Correct by construction, plus R-08-37 (carried) |
| Desktop Excel, SharePoint | Answer 5's oracle | ✗ in automation | — | The pilot's manual check (D-29) |
| Node 24 | Every gate | ✓ via `/c/ProgramData/nvm/v24.19.0` (the PATH default is 22.19.0) | 24.19.0 | — |

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | Web: Vitest 4.1.11 (jsdom) and Testing Library. Strapi: `node:test` through `tsc -p tests/tsconfig.json`, SQLite, one database per file (`strapi-http-harness.ts`). E2E: Playwright 1.58.2 on the production build (`desktop` 1440×900; `mobile` 375×812, which lists its specs) |
| Config file | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` |
| Quick run command | Web: `pnpm --dir apps/csrm exec vitest run <paths>`. Strapi (dev servers stopped): `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js)`. Each command is preceded by the Node 24 preamble of 19-VALIDATION |
| Full suite command | `pnpm --dir apps/csrm api:check`, `typecheck`, `lint`, `test`; `pnpm --dir apps/backend test`; `pnpm --dir apps/csrm test:e2e`; then `git status --short` |

### Phase Requirements → Test Map
| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| ASSESS-15 | Columns, chooser, sort, filter, search, counts; the filter-and-sort module equal to Strapi's | unit and parity | `vitest run src/features/risk-table/risk-table-view.test.ts`; Strapi `risk-table-view.unit.test.js` | ❌ W0 |
| ASSESS-15 | Saved views: ownership, sharing, 404 or 403, the fail-safe parser | integration | Strapi `saved-views.integration.test.js` | ❌ W0 |
| ASSESS-15 | Phone card list at 375; 150-risk lag at 1440; the 1,000-risk gate | e2e | `test:e2e e2e/risk-table-performance.spec.ts` (desktop); `e2e/risk-table.spec.ts` (mobile) | ❌ W0 |
| ASSESS-16 | Change set, undo and redo, fill, conflict UI | unit | `vitest run src/features/risk-table/risk-table-domain.test.ts` | ❌ W0 |
| ASSESS-16 | Bulk core: all or nothing; compare-and-set; bounds (rows, creates, 413); history `table` and `batchId`; review withdrawal; round lock; void at resubmission; risk-number collisions | integration | Strapi `risk-changes.integration.test.js`; matrix rows in `authorization-matrix.ts` | ❌ W0 |
| ASSESS-17 | APG keymap, ranges, clipboard strings (TSV, HTML with `x:num` and `\@`), paste mapping and preview rules | unit | `vitest run src/features/risk-table/risk-table-clipboard.test.ts src/features/risk-table/risk-table-keyboard.test.tsx` | ❌ W0 |
| ASSESS-17 | SC1 keyboard ten-risk batch (one save request); SC2 copy and 3 × 4 paste; SC3 invalid cell and two analysts; SC4 read-only copy | e2e | `test:e2e e2e/risk-table.spec.ts` | ❌ W0 |
| ASSESS-18 | 25-cell derivation, the override rules, legacy free text read and refused | unit and integration | Strapi `risk-scale-derivation.unit.test.js`, `risk-changes.integration.test.js`; web `risk-scale-parity.test.ts` | ❌ W0 |
| ASSESS-19 | Import preview, commit and drift for both tables; export of the current view (scope, columns, neutraliser) | integration and e2e | Strapi `risk-import.integration.test.js`, `risk-table-export.integration.test.js`; `e2e/risk-table.spec.ts` round trip | ❌ W0 |

### Sampling Rate
- **Per task commit:** the task's own files (Vitest by path; Strapi file by path).
- **Per plan:** the full Strapi suite after each Strapi plan; the full web suite after each web plan; the plan's Playwright specs.
- **Phase gate:** the full suite plus Playwright, then a clean `git status --short`.

### Wave 0 Gaps
- [ ] `apps/csrm/e2e/risk-table-performance.spec.ts`: the Answer 2 harness (observers, guard, medians, JSON record); desktop only.
- [ ] A 150-risk and 1,000-risk fixture builder through the bulk operation, never a shared seed (D-29).
- [ ] A clipboard event helper for Playwright: dispatch `paste` with a constructed `DataTransfer` holding Excel-shaped `text/plain` and `text/html`. Read `copy` through `context.grantPermissions(['clipboard-read','clipboard-write'])`.
- [ ] Strapi fixtures for the risk-number collision (`generate` injection).

## Security Domain

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V4 Access Control | yes | Grants and record rules per `18-CONTEXT` `<authorisation>`; human-only operations |
| V5 Input Validation | yes | Closed parsers with byte, row and creation bounds (Answer 3); DOMParser text only for pasted HTML (Answer 5) |
| V11 Business Logic | yes | All-or-nothing compare-and-set under the lock; risk numbers decided sequentially |
| V12 Files | yes | Phase 19's reader bounds for import (reused) |

| Threat | STRIDE | Mitigation |
|---|---|---|
| An oversized JSON body | DoS | `jsonLimit` 1 MiB, row bounds, the web's change-set guard |
| Pasted HTML executing | Tampering, XSS | Inert `DOMParser`, `textContent` only |
| Formula injection through copy | Tampering | Open Question 1 |
| A stale overwrite | Tampering | Per-cell bases (D-14) |

## Sources

### Primary (HIGH)
- Installed packages, read this session: `@tanstack/table-core` 9.2.4 cell-selection types; `@strapi/database` 5.51.0 (`index.js` transaction, `schema/schema.js`, `query/query-builder.js`); `@strapi/core` 5.51.0 entity validator; `koa-body` 6.0.1 `lib/types.js`; `bytes` 3.1.2; `playwright-core` `browsers.json`.
- Repository code: `risk-number.ts`, `domain-number.ts`, `csrm-risk/schema.json`, `config/middlewares.ts`, `next.config.ts`, `performance.spec.ts`, `assessment-workflow.ts`; the development database's index list.
- npm registry: `npm view` and the package-legitimacy seam for all three packages; the react-data-grid 7.0.0-beta.61 tarball, measured in the scratchpad.

### Secondary (MEDIUM)
- w3.org/WAI/ARIA/apg/patterns/grid; web.dev/articles/inp; developer.mozilla.org PerformanceEventTiming; developer.chrome.com/docs/web-platform/long-animation-frames; postgresql.org docs (`tutorial-transactions`, `sql-savepoint`); sqlite.org/lang_conflict.html.

### Tertiary (LOW)
- Excel clipboard behaviour: learn.microsoft.com Q&A on regional dates; the Office HTML and XML Reference mirror (stigmortenmyre.no); community articles on `mso-number-format`.

## Metadata
- **Confidence:** grid scoring HIGH; bounds HIGH; risk numbers HIGH by code path (not run on PostgreSQL); lag MEDIUM (thresholds chosen); clipboard LOW to MEDIUM.
- **Valid until:** 2026-10-31 (TanStack moves quickly; re-check `@tanstack/react-virtual` before any install).
