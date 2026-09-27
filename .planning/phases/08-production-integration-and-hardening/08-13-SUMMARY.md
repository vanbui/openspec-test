---
phase: 08-production-integration-and-hardening
plan: 13
subsystem: performance
tags: [performance, first-load-js, ttfb, lcp, playwright, cdp, next-16-3, experimental-analyze, route-bundle-stats, zod, bundle-size, vitest]

requires:
  - phase: 08-production-integration-and-hardening
    provides: the production-build harness and expectSettled (08-02); the CSP collector (08-10); signInAs and the desktop project (08-11); the settled titles and headings per route (08-12)
provides:
  - apps/web/src/lib/testing/performance-metrics.ts, the pure median, summariseRouteSamples and findBudgetBreaches, unit-tested
  - apps/web/e2e/performance.spec.ts, ten key routes with five cache-disabled samples each on the production build, medians held to budgets, the completeness self-check and first load attributed by the route's own document
  - apps/web/src/lib/performance/zod-client-boundary.test.ts, a static guard that no client module on nine key routes reaches zod
  - five source fixes that take zod (and, on two routes, react-hook-form and the forms) out of six key routes' first load
  - docs/performance/phase-08-baseline.md, the baseline, the budgets and their derivation, the fixes, the findings, the analyzer corroboration and the re-run command
affects: [08-14 (the full gate runs performance.spec.ts last in the desktop project; the suite is 81 tests in 660 s; the residual register takes the Google Fonts build dependency), Phase 8 code and UI review (zod on routes outside the ten; the router prefetch cost)]

tech-stack:
  added: []
  patterns:
    - "Client components read vocabularies and pure helpers from zod-free *-domain.ts modules; the *-schema.ts module builds its parsers on the same values and re-exports them for server code."
    - "A component rendered on a page that validates nothing in the browser never shares a module with a zod-validated form."
    - "First-load bytes are attributed by the route's own document (its HTML tags and the chunks its inline RSC payload names), never by time: what the router prefetches after hydration is another route's code."

key-files:
  created:
    - apps/web/src/lib/testing/performance-metrics.ts
    - apps/web/src/lib/testing/performance-metrics.test.ts
    - apps/web/e2e/performance.spec.ts
    - apps/web/src/lib/performance/zod-client-boundary.test.ts
    - apps/web/src/features/reports/report-periods.ts
    - apps/web/src/features/risks/risk-domain.ts
    - apps/web/src/features/risks/risk-domain.test.ts
    - apps/web/src/features/requests/request-workflow-actions.tsx
    - apps/web/src/features/administration/administration-domain.ts
    - apps/web/src/features/administration/administration-form.tsx
    - docs/performance/phase-08-baseline.md
  modified:
    - apps/web/src/features/reports/report-schema.ts
    - apps/web/src/features/reports/report-period-control.tsx
    - apps/web/src/features/risks/risk-schema.ts
    - apps/web/src/features/risks/risk-register.tsx
    - apps/web/src/features/risks/risk-register-filters.tsx
    - apps/web/src/features/risks/risk-register-loading.tsx
    - apps/web/src/features/risks/risk-detail-editor.tsx
    - apps/web/src/features/risks/mitigation-control-list.tsx
    - apps/web/src/features/analyst-dashboard/analyst-dashboard-presentation.ts
    - apps/web/src/features/assessments/assessment-domain.ts
    - apps/web/src/features/assessments/assessment-schema.ts
    - apps/web/src/features/assessments/assessment-list.tsx
    - apps/web/src/features/assessments/risk-editor.tsx
    - apps/web/src/features/assessments/control-implementation-editor.tsx
    - apps/web/src/features/requests/request-form.tsx
    - apps/web/src/features/requests/request-form.test.tsx
    - apps/web/src/features/requests/request-workflow.test.tsx
    - apps/web/app/(app)/app/requests/[documentId]/page.tsx
    - apps/web/src/features/administration/administration-workspace.tsx
    - apps/web/src/features/administration/administration-schema.ts
    - apps/web/src/features/administration/administration-config.ts
    - apps/web/src/features/administration/administration-workflow.test.tsx
    - apps/web/app/(app)/app/admin/[collection]/new/page.tsx
    - apps/web/app/(app)/app/admin/[collection]/[documentId]/page.tsx

key-decisions:
  - "First load is the downloaded /_next/static/ scripts and stylesheets that the route's own server-rendered document names (its tags and its inline RSC payload's chunk lists). What the router prefetches after hydration is recorded apart and never budgeted. Counting to the settled page varied from 14 to 22 scripts between samples of one route, and a load-event cut missed prefetch that began before the load event of a longer-streaming page."
  - "Trace recording is off in the performance spec, because its snapshots and screencast would load the browser being timed. The option is worker-scoped, so in a full run the spec runs last in the desktop project."
  - "D-24 triage: zod's full classic API (64,389 bytes delivered) was first load on eight of the ten key routes. On six it arrived through incidental imports and was fixed at the source, in five commits. On the questionnaire detail it is inherent, because the Requestor's answers are validated in the browser; that route has the one override, 500,000 bytes (1.5 × 328,599, rounded up)."
  - "The D-51 answer: next experimental-analyze --output writes apps/web/.next/diagnostics/analyze. data/routes.json lists route patterns only; the per-route analyze.data files carry per-module sizes (size and compressed_size) for each output file, so research assumption A7 holds. The analyzer compiles separately, so its chunk names differ from the build's; its /app/risks total agrees with next build's route-bundle-stats.json to 0.2 %."
  - "next build writes diagnostics/route-bundle-stats.json on every build. For the measured build it names exactly the browser's first-load chunks on all ten routes, plus the root not-found boundary's chunk (23,548 bytes), which a rendered page never downloads."

patterns-established:
  - "zod-client-boundary.test.ts walks a route's segment files, follows server imports into each 'use client' boundary and fails on any client import chain that reaches zod; type-only imports and 'use server' modules do not count."
  - "A zod-free reader of a URL that a zod schema also parses is held to that schema by a parity test over the same inputs, the refusals included."

requirements-completed: [INT-04]

duration: 1h 58m
completed: 2026-09-26
---

# Phase 08 Plan 13: Production-build performance baseline, budgets, and zod out of six routes' first load Summary

**The ten key routes' first-load JavaScript and CSS, TTFB, DOMContentLoaded, load and LCP candidate are measured on the production build: five cache-disabled samples per route against the seeded E2E database, reduced to medians and held to the recorded budgets.**

- **What the first measurement found.** Seven routes were over the 300,000-byte JavaScript ceiling. Each carried zod's full API (64,389 bytes delivered) as first load, and only the questionnaire uses it in the browser.
- **Fixes.** Five source fixes remove it from the other six. Each moves a constant, a formatter or a sibling component out of a zod-defining module; a new static guard, written first, keeps it out.
- **Results.** Every route now passes; the questionnaire carries the one reasoned override. Delivered JavaScript ranges from 193,757 bytes (`/app`) to 272,617 (the Risk detail), and 328,472 on the questionnaire. TTFB is 6.5–12.5 ms and LCP candidates 120–452 ms.
- **Stability.** Both measured runs passed 10 of 10. The analyzer corroborates the accounting to 0.2 %, and so does `next build`'s own per-route record, which the research did not know about. The full suite passes 81 of 81 on the final tree.

## Performance

- **Duration:** 1h 58m.
- **Started:** 2026-09-26T01:59:34Z.
- **Completed:** 2026-09-26, the metadata commit.
- **Tasks:** 3 of 3, plus the five D-24 fixes, the zod guard and the full-suite fix.
- **Files:** 35 across the code and record commits (11 created, 24 modified), plus this summary, STATE, ROADMAP and deferred-items.

## Results (Task 2 measured run, medians of five samples)

| Route | Actor | Scripts | Delivered JS | Decoded JS | CSS | TTFB ms | DCL ms | Load ms | LCP ms | Budget |
|---|---|---|---|---|---|---|---|---|---|---|
| `/app` | Requestor | 15 | 193,757 | 627,557 | 18,397 | 11.4 | 113.4 | 114.5 | 188 | 300,000 |
| `/app/requests` | Requestor | 18 | 216,571 | 697,630 | 18,397 | 8.1 | 81.4 | 109.3 | 124 | 300,000 |
| `/app/requests/{documentId}` | Requestor | 21 | 233,150 | 747,825 | 18,397 | 7.4 | 76.0 | 116.8 | 124 | 300,000 |
| `/app/questionnaires/{documentId}` | Requestor | 24 | 328,472 | 1,129,438 | 18,397 | 7.8 | 67.9 | 111.1 | 124 | 500,000 (override) |
| `/app/review` | Security Analyst | 17 | 198,663 | 640,050 | 18,397 | 9.8 | 99.3 | 101.5 | 388 | 300,000 |
| `/app/review/assessments/{documentId}` | Security Analyst | 24 | 269,653 | 866,440 | 18,397 | 7.8 | 162.0 | 163.4 | 452 | 300,000 |
| `/app/risks` | Security Analyst | 20 | 243,545 | 780,430 | 18,397 | 12.5 | 83.9 | 128.8 | 140 | 300,000 |
| `/app/risks/{documentId}` | Security Analyst | 24 | 272,617 | 875,659 | 18,397 | 7.7 | 175.6 | 185.3 | 420 | 300,000 |
| `/app/reports/risk-exposure` | Security Analyst | 20 | 234,085 | 749,605 | 18,397 | 7.9 | 75.2 | 109.8 | 120 | 300,000 |
| `/app/admin/controls` | Security Analyst | 18 | 216,513 | 702,913 | 18,397 | 6.5 | 68.0 | 106.9 | 124 | 300,000 |

Bytes are delivered (gzip from `next start`) or decoded; TTFB, LCP and every JavaScript budget apply to the medians. TTFB is budgeted at 500 ms and LCP at 2,500 ms on every route.

**Runs:**

| Run | Result | Time |
|---|---|---|
| Task 2 measured run | 10 passed | 1.4 min, 86 s wall |
| Task 3 stability re-run | 10 passed | 1.4 min, 87 s wall |

- **Between the runs:** delivered JavaScript is within 7 bytes on every route and byte-identical across each route's five samples.
- **Timings:** TTFB medians sit under 3 % of budget and LCP medians under 19 %.
- **Close to the JavaScript ceiling:** the Risk detail (90.9 %), the review editor (89.9 %) and the Risk Register (81.2 %).

## Budgets and the one override

- **`PERFORMANCE_BUDGETS`:** 300,000 bytes delivered JavaScript, 500 ms TTFB, 2,500 ms LCP (the research ceilings, A8). It was never changed.
- **`ROUTE_BUDGET_OVERRIDES`:** `/app/questionnaires/{documentId}` is allowed 500,000 bytes.
  - **Reason, as in the spec comment:** the Requestor's answers are validated in the browser by a zod schema built from the questions (react-hook-form's `zodResolver`), so the route carries zod's full API.
  - **Derivation:** 1.5 × the 328,599-byte median, rounded up.
  - **Same code in both states:** a submitted questionnaire loads the same client modules (1,129,438 decoded bytes either way).

## The D-24 fixes

The before figures come from run 4, the corrected measurement taken before any fix. The after figures are measured at each fix's commit.

| Commit | Route | Cause | Delivered JS before → after | Decoded before → after |
|---|---|---|---|---|
| `84b89f2` | `/app/reports/risk-exposure` | The period control read `reportPeriods` from `report-schema.ts`; it now lives in `report-periods.ts` | 308,243 → 233,811 | 1,073,556 → 749,491 |
| `5dcdcf9` | `/app/risks` | The register's table and filters read their vocabularies from `risk-schema.ts`, and its loading state parsed the URL with the zod schema. The vocabularies now live in `risk-domain.ts`, with a zod-free reader held to the schema on 18 cases | 309,352 → 243,146 | 1,075,018 → 779,524 |
| `5dcdcf9` | `/app/review` | The dashboard's error boundary took `formatRiskTargetDate` from `risk-schema.ts` (within budget already) | 265,403 → 198,346 | 937,053 → 639,144 |
| `3a08ab8` | `/app/review/assessments/{documentId}` | The Risk and Control Implementation editors and the review list (the editor's loading state) read field lists and statuses from `assessment-schema.ts`; they now live in `assessment-domain.ts` | 337,936 → 270,191 | 1,167,387 → 866,440 |
| `3a08ab8` | `/app/risks/{documentId}` | The same editor lists, plus the register loading state it inherits from `risks/loading.tsx` (fixed by `5dcdcf9`) | 349,018 → 281,258 | 1,204,111 → 901,159 |
| `553becc` | `/app/requests/{documentId}` | `RequestWorkflowActions` lived in `request-form.tsx` beside the zod-validated form; it moved unchanged to `request-workflow-actions.tsx` | 333,244 → 233,153 | 1,138,839 → 747,827 |
| `3d09144` | `/app/admin/controls` | The list shared `administration-workspace.tsx` with the create and edit form and read its vocabularies from `administration-schema.ts`; the form moved unchanged to `administration-form.tsx` and the vocabularies to `administration-domain.ts` | 327,321 → 216,514 | 1,137,557 → 702,913 |

**How the fixes were checked:**
- **Moves are verbatim:** both moved components are byte-identical to their originals (checked by diff).
- **Server code unchanged:** each schema module re-exports what it moved, so server code and the existing tests keep their imports.
- **Final tree:** the results table reflects it. Turbopack regrouped a few shared modules after the last fix, so `/app` gained one script (+332 bytes).

## Corroboration (D-51, research Open Question 2)

**The run.** `pnpm exec next experimental-analyze --output`, from `apps/web` on `5f4c741`, printed `Analyze completed in 3.0s. Results written to …\apps\web\.next\diagnostics\analyze.` It took 4 s wall, and the tree stayed clean.

**The output location.** It is `apps/web/.next/diagnostics/analyze`, because `distDir` is hard-coded to `.next`. This corrects the research's `.tmp` placement.

**The output shape.** 33 files in `data/`, 8.6 MB:
- **`routes.json`:** a flat array of 29 route patterns, the 13 dynamic routes first.
- **`modules.data`:** 3,206 modules and the dependency graph.
- **31 `analyze.data` files:** each is a 4-byte big-endian length, then a JSON header, then a binary tail.
  - `sources`: the module tree.
  - `chunk_parts`: each entry has `source_index`, `output_file_index`, `size` and `compressed_size`.
  - `output_files`: the server and client chunk file names.
  - Offset pointers into the binary tail.

**Agreement on `/app/risks`.**

| Source | Figure |
|---|---|
| Analyzer | 915,149 bytes uncompressed in 22 client files; 802,555 without the `nomodule` polyfill |
| `next build`'s `route-bundle-stats.json` | 803,978 bytes (within 1,423 of the analyzer) |
| Browser | 780,430 decoded, which is the chunk files on disk |

The build's figure is the browser's plus the root not-found chunk (23,548 bytes). The analyzer's chunk names differ because it compiles separately. Its `compressed_size` is summed per module part (319,739 bytes), so it overstates the 243,545 bytes delivered as whole gzip files.

## Task Commits

1. **Task 1: the pure aggregation**
   - `ec82d2d` test(08-13): specify the performance sample aggregation. RED: the module is missing.
   - `a6c05f8` feat(08-13): add the pure performance sample aggregation. GREEN: 15 of 15, 94 lines, no import.
2. **Task 2: the measured spec, the D-24 triage and its fixes**
   - `d5aee5a` test(08-13): expect the key routes that validate nothing in the browser to download no zod. RED: 7 failed, 3 passed.
   - `84b89f2` fix(08-13): keep the report period control from downloading zod.
   - `5dcdcf9` fix(08-13): read the Risk Register's vocabularies and loading URL without zod.
   - `3a08ab8` fix(08-13): give the Risk and control editors their field lists without zod.
   - `553becc` fix(08-13): give the request detail its workflow actions without the request form.
   - `3d09144` fix(08-13): keep the Administration lists from downloading the create and edit form. The guard now passes 10 of 10.
   - `5f4c741` test(08-13): measure first-load assets and navigation timings for the key routes on the production build. 10 of 10.
3. **Task 3: the corroboration, the record and the gate**
   - `a60e166` docs(08-13): record the production-build performance baseline and budgets.
4. **Extra full-suite verification**
   - `ad7003f` fix(08-13): keep the questionnaire's populated check true once its journey has submitted it.
   - `acabe06` docs(08-13): record how the performance spec runs inside the full suite.

**Plan metadata:** the `docs(08-13): complete …` commit, carrying this summary, STATE, ROADMAP and deferred-items.

## TDD Gate Compliance

- **Task 1:** `ec82d2d` (RED: vitest could not resolve `./performance-metrics`) came before `a6c05f8` (GREEN: 15 passed; typecheck exit 0; `grep -c "^import"` 0).
- **The zod guard:**
  - RED at `d5aee5a`: 7 failed and 3 passed. The three were `/app`, `/app/requests` and the questionnaire exception, which proves the walker finds a real chain.
  - It went green one fix at a time: 6 failing after A, 4 after B, 2 after C, 1 after D and 0 after E.
- **The zod-free reader:** it was written with its parity test. A mutation check changed two rules in the reader (the 200-character search bound and the default page size) and failed 12 cases. The restored reader passes 21 of 21.

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1: bug in my self-check] Next's `nomodule` polyfill was required to be downloaded**
- **Found during:** Task 2, run 1. All ten tests failed `PERFORMANCE_ACCOUNTING_INCOMPLETE` on `0cz1d0mv5g_q7.js`.
- **Cause:** that file is `buildManifest.polyfillFiles`, rendered with `noModule: true` (`app-render.js:1899`), and Chromium never downloads it.
- **Fix:** `referencedAssets` skips `nomodule` scripts. The header says why.
- **Committed in:** `5f4c741`.

**2. [Rule 1: bug in my guard] The populated check found the hidden card rendering at 1440**
- **Found during:** run 1, on `/app/requests`.
- **Fix:** the check filters to `visible: true`.
- **Committed in:** `5f4c741`.

**3. [Rule 1: measurement definition] Router prefetch was counted as first load**
- **Found during:** runs 2 and 3.
- **Issue:** counting every response until the page settled varied between samples of one route (`/app` counted 14 scripts, then 22), because the router's prefetch of the links in view downloads other routes' chunks after hydration.
- **First correction, rejected:** a load-event cut still miscounted 2 of 5 samples on the review editor (420,564 against 337,936), where prefetch began before the load event.
- **Fix:** first load is attributed by the route's own document. It is then identical in all five samples of every route. Prefetch bytes are recorded per sample, and no route's own script was requested after its load event.
- **Committed in:** `5f4c741`.

**4. [Rule 1: real defects, D-24 triage] Five source fixes across 24 files** (the fixes table above)
- **Why this is a deviation:** the plan anticipated fixes but not their scale. Each fix is its own commit with before and after medians, and each is behaviour-preserving.

**5. [Rule 2: regression guard] `zod-client-boundary.test.ts` was added**
- **Why:** it is not in the plan's file list. It is the fixes' failing test and keeps the next client import from bringing zod back without a browser run, following 08-10's static-guard pattern.

**6. [Rule 1: bug in my guard, found by the extra full run] The questionnaire check assumed a draft**
- **Found during:** the first full suite run: 80 passed, 1 failed.
- **Cause:** the spec's worker-scoped `trace: 'off'` gives it its own worker, which a full run schedules after `questionnaire-workflow.spec.ts` has submitted Jane's questionnaire.
- **Fix:** the check accepts the read-only notice too. Both states load identical client code.
- **Verified:** in the full suite's order (20 of 20), then by a second full run (81 of 81).
- **Committed in:** `ad7003f`.

### Plan-text deviations and additions

7. **Analyst report values.** `/app/reports/risk-exposure` for the analyst settles on `Risk Exposure Report | IdamBox CSRM` with heading `Risk exposure`, as `accessibility.spec.ts` has them. The plan's `Reports` values are the Requestor refusal's.
8. **Next version.** Next is 16.3.6 (since 08-10), not the plan's 16.3.3.
9. **Resolving record links.**
   - The request and review-editor links are resolved through the list's own search (`?q=RAR-E2E-NAV-OWNER-001`, `?q=ASM-E2E-NAV-OWNER-001`), so their page position cannot matter.
   - The questionnaire link is chosen by its exact name rather than "the first link".
10. **Sign-in exclusion.** The page leaves the dashboard for `about:blank` before recording starts, rather than clearing the recorded list after sign-in, so no late dashboard request is counted.
11. **Trace recording.** It is off for the spec, as decided above.
12. **The JSON record** also keeps each sample, its prefetch bytes and the first sample's per-asset list (with request times and the document-reference flag), for a later comparison.
13. **`next build`'s `route-bundle-stats.json`** was used as a second corroboration source.
14. **Extra verification:** two full-suite runs, where the plan has none; 08-14 owns the gate. They found and closed deviation 6 before the gate.
15. **Windows host translations** follow the preamble:
    - Node from `/c/ProgramData/nvm/v24.19.0`, with no `PLAYWRIGHT_BROWSERS_PATH`;
    - ports checked with `Get-NetTCPConnection`;
    - logs in `apps/web/.tmp/logs/csrm-phase-08/`;
    - `--project=desktop`.
    - **Git Bash path conversion:** it rewrote any `--grep` argument that starts with `/`, and pnpm doubled backslashes; targeted greps therefore avoid both.
    - **Targeted unit runs** used `pnpm --filter @csrm/web exec vitest run <path>`. The plan's `test -- performance-metrics` runs the whole suite, and was used for the final gate.
16. **Another project's servers.** From 03:02Z, another project's development servers (`edalas-dylan`: Next on 3000, Strapi on 1337) ran on this host. They share no directory with CSRM, so the `apps/strapi/dist` and `.next` hazards did not apply, and CSRM's runs use derived ports. Both measured runs and the analyzer ran alongside them, and the record says so. They were gone by the end.

**Total deviations:** 6 auto-fixed (5 Rule 1, 1 Rule 2) and 10 recorded.

**Impact:**
- **No Strapi change:** no Strapi source, content-type schema, contract, grant, `CSRM_AI_*`, Keycloak or `package.json` change.
- **Product changes:** module moves in the web app. Two components move verbatim, and vocabularies move with re-exports.
- **Behaviour:** unchanged, except that the Risk Register's loading state now reads its URL without zod, with the same results.

## Issues Encountered

- **Google Fonts connectivity.** Two measurement builds for fix E failed while the host's connection to `fonts.googleapis.com` and `fonts.gstatic.com` dropped. The log read "There was an issue establishing a connection while requesting https://fonts.gstatic.com/…", then later the same for the stylesheets. `curl` confirmed DNS failures and timeouts. After the Strapi suite ran, the third attempt built. This is the same dependency as the recorded `next/font/google` transient; font loading is unchanged.
- **Server log noise:** `The destination stream closed early.` appeared 33 times in the second full run, against 26 after 08-12. This is the known 08-02 note.

## Verification

| Command | Result |
|---|---|
| RED `vitest run src/lib/testing/performance-metrics.test.ts` | fails: `Failed to resolve import "./performance-metrics"` |
| GREEN, same | **15 passed**; typecheck exit 0; `grep -c "^import"` 0 |
| Guard RED (`d5aee5a`) | 7 failed, 3 passed |
| `performance.spec.ts`, run 1 (first spec) | 0/10: the polyfill self-check and the hidden-card guard |
| run 2 (counting until the page settled) | 1/10; figures inflated by prefetch |
| run 3 (load-event cut) | 3/10; 7 breaches |
| run 4 (document attribution, before the fixes) | 3/10; 7 breaches. This is the before baseline |
| Per-fix runs: A report 1/1; B review 1/1 and risks 1/1; C editor and Risk detail 2/2; D request detail 1/1; E Controls 1/1 | all passed. Fix E passed on its third attempt: two builds failed on Google Fonts connectivity |
| **Task 2 measured run, `--project=desktop e2e/performance.spec.ts`** | **10 passed / 0 failed / 0 flaky**, 1.4 min, 86 s wall; tree clean |
| **Task 3 stability re-run** | **10 passed / 0 failed / 0 flaky**, 1.4 min, 87 s wall; tree clean |
| `next experimental-analyze --output` | `Analyze completed in 3.0s`, 4 s wall; tree clean |
| Full suite, both projects (extra), run 1 | 80 passed / 1 failed (deviation 6); 11.9 min, 716 s wall |
| The full suite's order reproduced: `app-shell`, `questionnaire-workflow`, `performance` | **20 passed** (1.6 min, 98 s wall) |
| **Full suite, both projects, final tree (`ad7003f`)** | **81 passed / 0 failed / 0 flaky**, no retries: `desktop` 77, `mobile` 4. 11.0 min, 660 s wall; tree clean; nothing left running |
| **`pnpm --filter @csrm/strapi test`** | **504 passed / 0 failed / 0 skipped** (760.0 s; 02:56:44 to 03:09:28Z). No Strapi file changed in this plan |
| **`pnpm --filter @csrm/web test -- performance-metrics`** (the whole suite) | **90 files, 1674 tests passed** (26.4 s) |
| **`pnpm --filter @csrm/web typecheck`** | exit 0 |
| **`pnpm --prefix apps/web api:check`** | exit 0, no drift |
| Task 1 acceptance | the exports; no `import`; 15 `it(` cases including both error strings |
| Task 2 acceptance | all 23 required strings present; 382 lines; the override has its `//` reason on the line after `ROUTE_BUDGET_OVERRIDES`; no `package.json` change |
| Task 3 acceptance | the ten route strings and the required terms; a Fixes section; 201 lines; `git show --stat a60e166` lists only the record; nothing under `.next/` or `.tmp/` is tracked |
| Frozen paths since `ec82d2d~1` (`apps/strapi`, `docs/references`, `.env*`, manifests, lockfile) | empty |
| Added lines naming `CSRM_AI_` or Keycloak; tool attribution in messages or lines | 0; 0 |

## Known Stubs

None.

## Threat Flags

None: no endpoint, grant, data path or trust boundary is added. Each mitigation holds:
- **T-08-13-01:** CDP cache-disabled, the completeness self-check and a zero-delivered-bytes check.
- **T-08-13-02:** the record holds sizes, timings, versions and commit hashes. The analyzer's output path is shown without the home directory.
- **T-08-13-03:** `.next/` and `apps/web/.tmp/` are ignored, staging is explicit, and the tree was clean after every run.
- **T-08-13-04:** `PERFORMANCE_BUDGETS` is unchanged. The one override carries its reason in the spec and the record, and every fix commit carries before and after medians.

## Open issues for the orchestrator (also in STATE and deferred-items)

1. **Zod still reaches the browser on routes outside the ten.**
   - **Incidental:** the Alerts list (`alert-schema.ts`), the questionnaire lists and governance view (`questionnaire-domain.ts` imports zod), and the Requestor's released assessment (`request-hub.tsx` reads `assessmentStatuses` from `assessment-schema.ts`, though it is now in `assessment-domain.ts`).
   - **Legitimate:** the request, questionnaire and Administration forms, and the CSV import.
   - **Follow-up:** extend the guard to every route.
2. **The router's prefetch cost.** After hydration it downloads the sidebar routes' code, up to 176,293 bytes on `/app/review`, and that includes zod. This is bandwidth, not first load.
3. **Builds need Google Fonts.** Connectivity failures broke two builds here; this belongs in the residual register (test hermeticity).
4. **Two 08-04 rows in `deferred-items.md` name 08-13 as a co-owner** of the parity-guard parser backlog (33 grandfathered parsers). This plan has no task for it, so it stays with 08-14 and the phase VERIFICATION.
5. **The performance spec runs last in a full run's desktop project** (its worker-scoped trace option) and adds about 90 s. The suite is now 81 tests in 660 s wall.

## Browser backstops for the orchestrator

Against `next dev` on port 3000, as Security Analyst unless stated.

1. **Risk Register loading state.**
   - From the dashboard, open `/app/risks?treatmentStatus=In%20Progress&inherentRating=High&sort=riskNumber:desc` and watch the loading skeleton: its filter bar should show those filters, as before.
   - Open `/app/risks?targetDateFrom=2026-02-30`: it should render the invalid-filter state.
2. **Request detail.** On your own submitted request (`Other Requestor security assessment`), `Return to draft` opens its confirmation. Cancel it; do not confirm.
3. **Administration.**
   - `/app/admin/controls` filters by type and framework.
   - `/app/admin/controls/new` shows its required-field messages on an empty submit.
   - A Control record page opens its form. Save nothing.
4. **Reports.** On the throughput report, the period control switches between 6 and 12 months.
5. **Network panel (optional).** On a cold load of `/app/risks`, no script containing `toJSONSchema` is requested before the page has hydrated.

## Next Phase Readiness

- `REQUIREMENTS.md` is unchanged, as in 08-01 to 08-12. INT-04 closes at the phase gate (08-14).
- **08-14 can start.**
  - The full gate runs `performance.spec.ts`; it passed there in both runs, 81 of 81 on the final tree.
  - The residual register takes the Google Fonts build dependency, the router prefetch cost, and zod on routes outside the ten.

## Self-Check: PASSED

- **Created files exist:** all eleven listed under `key-files.created`.
- **The twelve plan commits are on `dev`:** `ec82d2d`, `a6c05f8`, `d5aee5a`, `84b89f2`, `5dcdcf9`, `3a08ab8`, `553becc`, `3d09144`, `5f4c741`, `a60e166`, `ad7003f` and `acabe06`.
- **Acceptance re-run:** the acceptance criteria of all three tasks, and the plan's verification, were re-run on the final tree and pass.
- **Tables:** every Markdown table in the record and this summary has consistent cells.
- **Attribution:** no tool attribution or trailer appears in this plan's commits, added lines or documents.

---
*Phase: 08-production-integration-and-hardening*
*Completed: 2026-09-26*
