# Phase 8 performance baseline (production build)

- **Date:** 2026-09-26
- **Decisions:** D-24 (measure the production build, record budgets, fix only real problems, no new tooling), D-51 (answer research Open Question 2 with one `next experimental-analyze --output` run), D-23 (no dependency added).
- **Evidence:** `apps/csrm/e2e/performance.spec.ts` (the measurement), `apps/csrm/src/lib/testing/performance-metrics.ts` (the median and budget arithmetic, unit-tested), `apps/csrm/src/lib/performance/zod-client-boundary.test.ts` (the guard the fixes below added).
- **Measured on:** commit `5f4c741`. The first measured run ran on the same tree just before that commit; the committed spec differs from it by one comment line.

**These figures are a baseline for this host, not a production SLA.** The browser, the web server and the API all ran on one workstation. A later phase compares against this record by re-running the command at the end, on comparable hardware.

## Scope and environment

| Item | Value |
|---|---|
| Host | Windows 11 Pro 10.0.26200 workstation: AMD Ryzen 7 9800X3D (8 cores, 16 threads, 4.7 GHz), 31 GB RAM |
| Co-location | `next start`, the E2E Strapi and Chromium share the machine. Another project's development servers (not CSRM's) were running on ports 3000 and 1337 during both measured runs |
| Runtime | Node 24.19.0, pnpm 11.24.0 |
| Web | Next 16.3.6 production build (`next build`, then `next start` with its default gzip compression), React 19.2.4. The root layout renders per request (`force-dynamic`, for the CSP nonce, plan 08-10) |
| API | Strapi 5.51.0 `develop` on a run-isolated SQLite database seeded by `IDAMBOX_SEED_CORE` and `IDAMBOX_SEED_CSRM`, with the deterministic AI provider |
| Browser | Playwright 1.58.2 driving Chromium 145.0.7632.6 (the `desktop` project's Desktop Chrome profile), viewport 1440×900, HTTP cache disabled |
| Harness | `apps/csrm/playwright.config.ts`: the attested production E2E runtime (plans 08-02 and 08-11); both servers on derived loopback ports |

## Method

Each of the ten key routes is measured five times. Each sample runs in a fresh browser context:

1. The context registers a buffered `largest-contentful-paint` observer and attaches the CSP collector. Over CDP, `Network.enable` and `Network.setCacheDisabled` disable the HTTP cache. A measured navigation follows a sign-in that has already fetched the shared chunks, and `Request.sizes()` reports zero bytes for a cache hit; with the cache on, the shared chunks would silently drop out of every figure.
2. The sample signs in as the route's actor, asserting the shell (the Dashboard heading and the role in the banner).
3. It leaves for `about:blank`, then starts recording `/_next/static/` script and stylesheet responses. The sign-in navigation and its late requests are never counted.
4. It opens the route and waits for it to settle. Settled means the URL, the exact document title and the level-one heading are present and nothing is loading. It then proves populated content (the route's fixture record or region) and no error state, so neither a redirect to sign-in nor an error page can be measured.
5. **The completeness self-check.** Every `/_next/static/` script and stylesheet in the settled document must have a recorded response with a non-zero delivered size; otherwise the sample fails with `PERFORMANCE_ACCOUNTING_INCOMPLETE`. The exception is Next's legacy-browser polyfill: a `nomodule` script (112,594 bytes raw) that a module-capable browser never downloads.
6. It reads the navigation timings and the LCP candidate, and asserts zero CSP violations.

Trace recording is off in the spec: its DOM snapshots and screencast would run inside the browser being timed. Each route's five samples are reduced to medians by `summariseRouteSamples`. The medians of delivered JavaScript, TTFB and LCP are held to the route's budget by `findBudgetBreaches` (a value equal to its budget passes).

| Metric | Definition |
|---|---|
| First load | The downloaded scripts and stylesheets the route's own document names: its HTML tags and the chunks its inline RSC payload lists for the client components it renders |
| Delivered | Encoded response body bytes (`Request.sizes().responseBodySize`): gzip, as `next start` sends them. **The budget applies to delivered JavaScript** |
| Decoded | The body's own length after decoding (`Response.body()`), which equals the chunk files on disk. For `/app/risks` both are 780,430 bytes |
| TTFB | `responseStart` of the navigation entry. The layouts render per request and stream, so this is the first byte of the streamed shell, not of the page's data |
| DOMContentLoaded, load | `domContentLoadedEventEnd` and `loadEventEnd`. DOMContentLoaded comes after the whole streamed document has parsed |
| LCP candidate | The `startTime` of the latest `largest-contentful-paint` entry buffered at settle time. It is a candidate: the browser finalises LCP only on the first interaction or when the page is hidden |

**Why first load is attributed by the document, not by time.** Once a page hydrates, the router prefetches the routes behind the links in view, and the prefetch payloads make the browser download those routes' chunks. On the analyst's pages that is the sidebar's routes, up to 176,293 bytes delivered. Those bytes are another route's code, and they arrive on no fixed schedule:
- **By sample:** on `/app` the prefetch download was 108,466 bytes in three samples of five and nothing in the other two.
- **Before the load event:** on the Risk detail it began at 166–194 ms, before the 200 ms load event.

The first attempt, counting everything until the page settled, therefore varied between samples of one route: `/app` counted 14 scripts in one sample and 22 in the next. Attributing by the document's own references makes first load identical in all five samples of every route, and every chunk it names was requested before the load event. The prefetch bytes are kept per sample in the JSON record and are never budgeted.

## Results

The Task 2 measured run (2026-09-26 03:11:36Z–03:13:02Z): 10 passed, 1.4 min reported, 86 s wall. Values are medians of five samples.

| Route | Actor | Scripts | Delivered JS (bytes) | Decoded JS (bytes) | Delivered CSS (bytes) | TTFB (ms) | DOMContentLoaded (ms) | Load (ms) | LCP candidate (ms) |
|---|---|---|---|---|---|---|---|---|---|
| `/app` | Requestor | 15 | 193,757 | 627,557 | 18,397 | 11.4 | 113.4 | 114.5 | 188 |
| `/app/requests` | Requestor | 18 | 216,571 | 697,630 | 18,397 | 8.1 | 81.4 | 109.3 | 124 |
| `/app/requests/{documentId}` | Requestor | 21 | 233,150 | 747,825 | 18,397 | 7.4 | 76.0 | 116.8 | 124 |
| `/app/questionnaires/{documentId}` | Requestor | 24 | 328,472 | 1,129,438 | 18,397 | 7.8 | 67.9 | 111.1 | 124 |
| `/app/review` | Security Analyst | 17 | 198,663 | 640,050 | 18,397 | 9.8 | 99.3 | 101.5 | 388 |
| `/app/review/assessments/{documentId}` | Security Analyst | 24 | 269,653 | 866,440 | 18,397 | 7.8 | 162.0 | 163.4 | 452 |
| `/app/risks` | Security Analyst | 20 | 243,545 | 780,430 | 18,397 | 12.5 | 83.9 | 128.8 | 140 |
| `/app/risks/{documentId}` | Security Analyst | 24 | 272,617 | 875,659 | 18,397 | 7.7 | 175.6 | 185.3 | 420 |
| `/app/reports/risk-exposure` | Security Analyst | 20 | 234,085 | 749,605 | 18,397 | 7.9 | 75.2 | 109.8 | 120 |
| `/app/admin/controls` | Security Analyst | 18 | 216,513 | 702,913 | 18,397 | 6.5 | 68.0 | 106.9 | 124 |

**Watch: `/app/risks/{documentId}` (2026-10-08).** Measured after `c586c45` on 2026-10-08, the Risk detail delivers 299,594 bytes of first-load JavaScript against its 300,000-byte budget: 406 bytes of headroom (99.86 %). The budget is unchanged. Its first load carries the app shell (whose navigation guard brings `ConfirmDialog` and its `AlertDialog`), the shared Toaster and the Risk Register's loading state (finding 3 below), so a change to any of them needs this route measured before it lands. The first such change after the measurement is `3061ad6` (Phase 12 UI review, UI-01), which lengthens one `AlertDialog` class by five characters.

The record routes open seeded fixtures:
- **Request:** `RAR-E2E-NAV-OWNER-001`, *Enterprise password manager rollout*.
- **Questionnaire:** Jane's *Customer portal questionnaire draft*.
- **Review editor:** `ASM-E2E-NAV-OWNER-001`.
- **Risk:** `RSK-DEV-MUTABLE-001`.

### Stability re-run

The Task 3 re-run (2026-09-26 03:17:27Z–03:18:54Z) also passed 10 of 10: 1.4 min reported, 87 s wall.

| Route | Delivered JS run 1 → run 2 (bytes) | TTFB (ms) | DOMContentLoaded (ms) | Load (ms) | LCP candidate (ms) |
|---|---|---|---|---|---|
| `/app` | 193,757 → 193,758 | 11.4 → 11.1 | 113.4 → 101.1 | 114.5 → 107.5 | 188 → 168 |
| `/app/requests` | 216,571 → 216,572 | 8.1 → 9.7 | 81.4 → 87.3 | 109.3 → 100.6 | 124 → 124 |
| `/app/requests/{documentId}` | 233,150 → 233,157 | 7.4 → 9.1 | 76.0 → 73.6 | 116.8 → 115.7 | 124 → 128 |
| `/app/questionnaires/{documentId}` | 328,472 → 328,475 | 7.8 → 7.9 | 67.9 → 71.0 | 111.1 → 115.2 | 124 → 132 |
| `/app/review` | 198,663 → 198,664 | 9.8 → 12.0 | 99.3 → 116.0 | 101.5 → 119.9 | 388 → 456 |
| `/app/review/assessments/{documentId}` | 269,653 → 269,648 | 7.8 → 9.3 | 162.0 → 175.3 | 163.4 → 193.7 | 452 → 460 |
| `/app/risks` | 243,545 → 243,546 | 12.5 → 11.7 | 83.9 → 77.0 | 128.8 → 119.0 | 140 → 132 |
| `/app/risks/{documentId}` | 272,617 → 272,621 | 7.7 → 6.9 | 175.6 → 158.5 | 185.3 → 159.6 | 420 → 424 |
| `/app/reports/risk-exposure` | 234,085 → 234,086 | 7.9 → 11.0 | 75.2 → 73.3 | 109.8 → 111.3 | 120 → 132 |
| `/app/admin/controls` | 216,513 → 216,514 | 6.5 → 7.9 | 68.0 → 79.5 | 106.9 → 124.1 | 124 → 140 |

Variance worth noting:
- **Delivered JavaScript is effectively fixed.** It is byte-identical across the five samples of every route. Between the two builds it moves by at most 7 bytes of gzip output.
- **Within 20 % of a budget.** Three routes sit within 20 % of the 300,000-byte ceiling: the Risk detail (90.9 %), the review editor (89.9 %) and the Risk Register (81.2 %). Every TTFB median is under 3 % of its 500 ms budget, and every LCP median under 19 % of 2,500 ms.
- **LCP is bimodal on two routes.** On `/app` and `/app/review` it lands either early (120–170 ms) or after the streamed content (390–470 ms); the medians moved 388 → 456 and 188 → 168. The review editor and the Risk detail paint their candidate later (420–460 ms) because their documents stream for longer (DOMContentLoaded 160–175 ms).
- **TTFB of the first sample runs slow.** It is often the highest of the five (for example 43.6 ms against about 10 on `/app`) as the server warms that route. The median absorbs it.

## Budgets

`PERFORMANCE_BUDGETS` in `apps/csrm/e2e/performance.spec.ts` holds the research ceilings (08-RESEARCH A8). It is never loosened:

| Metric | Ceiling |
|---|---|
| Delivered first-load JavaScript | 300,000 bytes |
| TTFB | 500 ms |
| LCP candidate | 2,500 ms |

`ROUTE_BUDGET_OVERRIDES` holds two entries. Phase 12 added the second (plan 12-16); it is recorded here since 2026-10-08 (Phase 12 code review, WR-407):

| Route | Budget | Reason |
|---|---|---|
| `/app/questionnaires/{documentId}` | delivered JavaScript 500,000 bytes | Inherent. The Requestor's answers are validated in the browser by a zod schema built from the questions (react-hook-form's `zodResolver`), so the route carries zod's full API: 64,389 bytes delivered, 284,738 raw, not tree-shakeable. The budget is 1.5 × the 328,599-byte median measured before the fixes, rounded up. |
| `/app/review/assessments/{documentId}` | delivered JavaScript 460,000 bytes | Inherent. Phase 12 D-37 puts the AI review UI in the editor: field markers, per-record review bars and the decision hook beside every Risk form. With it the route measured 304,218 bytes after plan 12-16, once a duplicated chunk group had been removed (quick task 261007-jbs). The budget is 1.5 × that median, rounded up. |

**The review editor's override (Phase 12).** The route's Phase 8 median was 269,653 bytes, 89.9 % of the ceiling (R-08-34). Quick task 261007-jbs (2026-10-07) fixed its growth at the source (quick find's search code had joined the shell's first load) and brought it back to 299,553 bytes with no override. Plan 12-16 then added the AI review UI, a cost the D-24 triage classed as inherent: 304,218 bytes, and 1.5 × 304,218 = 456,327, rounded up to 460,000. Plan 12-17 (cited sources, suggested controls, uncited claims) measured 307,724. Phase 12 D-36 keeps the route as small as that UI allows:
- the provenance header renders on the server;
- the editor's client pieces stay zod-free;
- the body of the "What the AI used" sheet and the body of a citation's source view load only when an analyst asks for them.

Since the code review (WR-307, `7f8e2bd`), the sheet's frame and the source's popover and bottom-sheet frames load with the route, so each opens at once on its title; only their bodies stay code-split. The phase's final gate re-measures the route against 460,000 bytes (`12-19-SUMMARY.md`).

With more than 150,000 bytes of headroom, the budget can no longer catch the regressions D-36 guards against, so source checks in `apps/csrm/src/lib/performance/zod-client-boundary.test.ts` hold them instead (WR-407):
- the route walk fails on any static import chain from a client module the route renders to zod;
- four AI assistance modules may import zod: the Server Action, the server-only service and the two schemas, each listed with why the browser never loads it. Every other AI assistance module reaches no zod through a static import chain. That includes the two lazily loaded bodies, which the route walk stops before;
- the two bodies load only through `import()`, and no module in the web source imports either statically.

**Derivation rule (D-24 triage).** A route whose median exceeds a ceiling is investigated first for a real defect, which is fixed at its source. Examples: a client component pulling in a module a server component could own, an unnecessary `'use client'` boundary, a loader without a limit, a duplicated fetch, a blocking font or stylesheet. Only an inherent cost earns an override, set at 1.5 × the measured median rounded up to the next 10,000 bytes or 50 ms, with a one-line reason in the spec and here.

## Fixes

The first measurement found seven of the ten routes over 300,000 bytes. Each carried zod's full classic API (`ZodObject`, `toJSONSchema` …; 64,389 bytes delivered) as first load. Only the questionnaire uses it in the browser. On the other six, a client component took a constant, a formatter or a sibling component from a module that also defines zod schemas, so the whole library followed.

Each fix moves those values or components into a zod-free module (`*-domain.ts`, or the component's own file); the schema module re-exports what it moved. `zod-client-boundary.test.ts` walks each key route's segment files, follows server imports into every `'use client'` boundary, and fails on any client import chain that reaches zod. It failed first on seven routes (commit `d5aee5a`); each fix turned its routes green. Before is the corrected measurement taken before any fix. After is the measurement at the fix's own commit.

| Commit | Route | Cause | Delivered JS before → after (bytes) | Decoded before → after (bytes) |
|---|---|---|---|---|
| `84b89f2` | `/app/reports/risk-exposure` | The period control read `reportPeriods` from `report-schema.ts` | 308,243 → 233,811 | 1,073,556 → 749,491 |
| `5dcdcf9` | `/app/risks` | The register's table and filters read their vocabularies from `risk-schema.ts`, and its loading state parsed the URL with the zod query schema. Now `risk-domain.ts`, with a zod-free reader held to the schema on 18 cases | 309,352 → 243,146 | 1,075,018 → 779,524 |
| `5dcdcf9` | `/app/review` | The dashboard's error boundary took `formatRiskTargetDate` from `risk-schema.ts` (within budget before; the same helper fix) | 265,403 → 198,346 | 937,053 → 639,144 |
| `3a08ab8` | `/app/review/assessments/{documentId}` | The Risk and Control Implementation editors, and the review list that is the editor's loading state, read field lists and statuses from `assessment-schema.ts` | 337,936 → 270,191 | 1,167,387 → 866,440 |
| `3a08ab8` | `/app/risks/{documentId}` | The same editor field lists, plus the register loading state it inherits from `risks/loading.tsx` (fixed by `5dcdcf9`) | 349,018 → 281,258 | 1,204,111 → 901,159 |
| `553becc` | `/app/requests/{documentId}` | `RequestWorkflowActions` lived in `request-form.tsx` beside the zod-validated create and edit form; moved unchanged into its own module | 333,244 → 233,153 | 1,138,839 → 747,827 |
| `3d09144` | `/app/admin/controls` | The collection list shared `administration-workspace.tsx` with the create and edit form and read its filter vocabularies from `administration-schema.ts`; the form moved unchanged into its own module | 327,321 → 216,514 | 1,137,557 → 702,913 |

Several fixes saved more than the zod chunk. The request detail and the Controls list also stopped loading react-hook-form, the resolver and the forms' pickers. Each fix commit carries its before and after medians. The final column of the results table is the complete tree. A few routes moved by a few hundred bytes after the last fix, where Turbopack regrouped modules shared by several routes (`/app` went from 14 to 15 scripts, +332 bytes).

## Findings recorded, not fixed

1. **Prefetch downloads other routes' code after hydration.** Up to 176,293 bytes delivered on `/app/review` and 134,618 on the review editor. It includes the zod chunk, which a sidebar route's list pulls in. It is not first load and is outside the budget, but it spends bandwidth on every analyst page; the JSON record keeps it per sample.
2. **Zod still reaches the browser on routes outside these ten.**
   - Incidentally, through schema modules: the Alerts list (`alert-schema.ts`), the questionnaire lists and governance view (`questionnaire-domain.ts`, which imports zod), and the Requestor's released assessment (`request-hub.tsx` reads `assessmentStatuses` from `assessment-schema.ts`, though it is now in `assessment-domain.ts`).
   - Corrected after the phase code review (WR-07, 2026-09-26): the last route is the analyst request review, not the Requestor's released assessment, which carries no zod. `request-hub.tsx` now imports `assessmentStatuses` from `assessment-domain.ts`, so the analyst request review downloads no zod, and `zod-client-boundary.test.ts` guards it.
   - Legitimately, where a form validates in the browser: the request create and edit form, the questionnaire renderer and review, the Administration create and edit form, and the CSV import flow.
   - Follow-up: extend `zod-client-boundary.test.ts` to every route and move those vocabularies the same way.
3. **The Risk detail inherits the Risk Register's loading state.** Next renders ancestor `loading.tsx` boundaries, so `risks/loading.tsx` puts the register table's client code into `/app/risks/{documentId}`'s first load. It is inherent to the route layout and within budget, at 90.9 %.
4. **The questionnaire route is the one inherent cost.** It holds the override above. Phase 12 added a second, the review editor's AI review UI, with its own override (see Budgets).
5. **The legacy polyfill is referenced by every page but never fetched.** It is Next's `nomodule` polyfill file, 112,594 bytes raw. A module-capable browser does not fetch it, so it is neither delivered nor counted.
6. **Builds depend on Google Fonts.** `next/font/google` fetches the three families during every `next build`. Two measurement builds failed while the host's connection to `fonts.googleapis.com` and `fonts.gstatic.com` dropped out ("There was an issue establishing a connection while requesting https://fonts.gstatic.com/…"); the third passed once it recovered. This is the same dependency as the recorded `next/font/google` transient; font loading is unchanged.

## Corroboration: `next experimental-analyze --output` (D-51, research Open Question 2)

**Run.** Once, on commit `5f4c741`, with CSRM's development servers stopped, from `apps/csrm`:

```bash
export PATH="/c/ProgramData/nvm/v24.19.0:$PATH"
pnpm exec next experimental-analyze --output
```

It printed `Analyze completed in 3.0s. Results written to …\apps\web\.next\diagnostics\analyze.` in 4 s wall, and left `git status --porcelain` empty (`.next/` is ignored).

**Output location (a correction to the research).** `apps/csrm/.next/diagnostics/analyze`, not `apps/csrm/.tmp/`. `build/analyze/index.js` hard-codes `distDir = join(dir, '.next')`, so `CSRM_NEXT_DIST_DIR` does not move it. That directory is shared with `next dev`, which is why the development servers must be stopped.

**Output shape.** The analyzer's static UI plus `data/`, 33 files, 8.6 MB:
- **`data/routes.json`:** a flat array of 29 route patterns, the 13 dynamic routes first, then 16 static ones (including `/icon.png` and `/sign-in`), for example `"/app/admin/[collection]"`, `"/app/risks/[documentId]"`, `"/app"`. It lists routes only.
- **`data/modules.data`:** 3,206 modules (`ident`, `path`) and the module dependency graph.
- **`data/analyze.data`, and one `data/<route>/analyze.data` for each route directory:** 31 files. Each is a 4-byte big-endian length, a JSON header and a binary tail. A route file's header holds:
  - `sources`, the module tree (`parent_source_index`, `path`);
  - `chunk_parts`: `source_index`, `output_file_index`, `size` and `compressed_size`;
  - `output_files`, the server and client chunk file names;
  - offset and length pointers into the binary tail for `output_file_chunk_parts`, `source_chunk_parts` and `source_children`.

**The answer to Open Question 2.** Research assumption A7 holds: the analyzer data does carry sizes, per module part, per output file and per route.

**Agreement with the browser accounting on `/app/risks`.** The analyzer compiles separately (its build id is `analyze-build`). None of its chunk file names match the measured build's first-load chunks (only the unchanged polyfill file keeps its name), so the comparison is by totals:

| Source | `/app/risks` client JavaScript |
|---|---|
| Analyzer, 22 files | 915,149 bytes uncompressed; 802,555 without the `nomodule` polyfill |
| `next build` `diagnostics/route-bundle-stats.json` for the measured build | 803,978 bytes uncompressed |
| Browser accounting, first load | 780,430 bytes decoded, 243,545 delivered |

The analyzer and the build agree to 1,423 bytes (0.2 %). The build's figure is the browser's plus 23,548 bytes: the root `not-found` boundary's chunk (next/link), which every page's client-reference manifest lists but a page that renders never downloads. The analyzer's `compressed_size` is summed per module part (319,739 bytes without the polyfill), so it overstates what the browser receives as whole gzip files (243,545).

**A second corroboration source.** `next build` no longer prints per-route sizes, but in Next 16.3.6 it writes `diagnostics/route-bundle-stats.json` on every build, with `route`, `firstLoadUncompressedJsBytes` and `firstLoadChunkPaths`. For the measured build, on all ten routes, its chunk list is exactly the browser's first-load script set plus that `not-found` chunk, and its total exceeds the measured decoded bytes by exactly 23,548. Browser accounting stays primary, because it measures delivered bytes as the browser receives them.

## How to re-run

With CSRM's development servers stopped (ports 1337 and 3000 must be free of CSRM's servers; `apps/backend/dist` is shared with `strapi develop`), from the repository root in Git Bash:

```bash
export PATH="/c/ProgramData/nvm/v24.19.0:$PATH"
pnpm --filter @csrm/web test:e2e --project=desktop e2e/performance.spec.ts
```

- **Linux build host:** use `export PATH="/opt/node24/bin:$PATH"` and `export PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` instead.
- **Project flag:** write `--project=desktop`. The spaced form `--project desktop <file>` takes the file path as a project name.
- **Output:** each run writes its medians, samples and first-sample asset list to `apps/csrm/.tmp/performance/baseline-desktop.json` (ignored) and attaches `performance-summary` and `performance-assets` to each test.
- **Time:** about 90 s, including the Strapi boot and `next build`.
- **Analyzer:** run `pnpm exec next experimental-analyze --output` from `apps/csrm` with the development servers stopped.
- **Afterwards:** the tree stays clean. `git status --porcelain` printed nothing after every run above.

### In the full suite

The spec's `trace: 'off'` is a worker-scoped option, so Playwright gives the file a worker of its own and schedules it after the other desktop specs. By then `questionnaire-workflow.spec.ts` has submitted Jane's questionnaire, so that route is measured read-only. It loads the same client modules: submitted, 328,477 bytes delivered, 1,129,438 decoded, 24 scripts; as a draft, 328,475, 1,129,438 and 24.

The first full run found the questionnaire's populated check accepting only the draft (80 passed, 1 failed); `ad7003f` accepts both states. On that commit the full suite then passed 81 of 81 in both projects (660 s wall, no retry). Its medians inside the full suite were delivered JavaScript within 2 bytes of the results table, TTFB 5.3–8.6 ms and LCP candidates 100–436 ms.
