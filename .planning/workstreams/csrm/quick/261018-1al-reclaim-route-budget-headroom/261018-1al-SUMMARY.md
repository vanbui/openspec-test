---
phase: quick-261018-1al
plan: 01
status: complete
workstream: csrm
commits:
  red: 3c2d2d81
  green: 30fb66af
  experiment_red: afc19d71
  experiment_revert: 70ef7d8a
---

# Quick 261018-1al: reclaim route-budget headroom

Both record routes now have far more than 5 KB of headroom under the unchanged 300,000-byte delivered JavaScript budget. No budget changed, no dependency was added, and no primary action loads lazily.

| Route (desktop, five-sample median, delivered bytes) | Phase 19 gate (`31d7c70d`) | After (`70ef7d8a`) | Change | Headroom |
|---|---:|---:|---:|---:|
| `/app/risks/{documentId}` | 298,576 | **262,456** | -36,120 | 37,544 (was 1,424) |
| `/app/requests/{documentId}` | 297,838 | **289,383** | -8,455 | 10,617 (was 2,162) |
| `/app/questionnaires/{documentId}` | 363,656 | 363,650 | -6 | of 500,000 |
| `/app/review/assessments/{documentId}` | 412,161 | 412,159 | -2 | of 460,000 |
| `/app` (Requestor and Security Analyst) | 230,271 | 230,272 | +1 | |
| `/app/requests` | 261,744 | 261,745 | +1 | |
| `/app/risks` | 278,645 | 278,646 | +1 | |
| `/app/reports/risk-exposure` | 257,234 | 257,235 | +1 | |
| `/app/admin/controls` | 251,960 | 251,961 | +1 | |

The measurements come from the full gate's `performance.spec.ts` run, recorded in the ignored `apps/csrm/.tmp/performance/baseline-desktop.json`. Risk detail went from 28 scripts to 25 (954,165 to 836,404 decoded bytes). Request detail went from 28 to 27 (946,282 to 919,861). The shared shell did not change: every route without a moved boundary moved by 1 byte or less.

## How it was measured

- I built the web for production into ignored dist directories under `apps/csrm/.tmp/`, with the e2e harness's environment.
- I read each route's chunk set from Next's `diagnostics/route-bundle-stats.json` and the build manifest's root main files.
- I mapped each chunk to the segment entries that own it through the route's `page_client-reference-manifest.js`.
- One extra build had `productionBrowserSourceMaps` switched on in a temporary, reverted edit to `next.config.ts`. From its source maps I attributed each chunk's gzipped bytes to source modules.
- The scripts lived in the scratchpad only. The builds were deleted afterwards.
- The static estimate runs about 8 KB above the browser's figure, because it counts a fallback chunk the document never requests, but the deltas agree. The estimate predicted -36,068 and -8,448; the browser measured -36,120 and -8,455.

### Top contributors before (risk detail, estimated gzipped bytes)

| Bytes | Contributor |
|---:|---|
| 154,265 | Next.js runtime (`react-dom-client` alone 62,853) |
| **36,069** | **`app/(app)/app/risks/loading.tsx` alone:** the Risk Register table, its filters, owner and relation pickers, `data-table`, and `@tanstack/table-core` (15,669 in one chunk) |
| 30,741 | the risk detail page's own chunks |
| 11,720 | react-hook-form |
| 9,787 | sonner |
| ~10,800 | next/image (`get-img-props`, `image-component`, `head`), duplicated in three chunks: the shell layout, the global error and the not-found boundary |
| 8,155 | tailwind-merge |
| 7,608 | lucide-react |

On request detail, `app/(app)/app/requests/loading.tsx` alone brought 8,437 bytes (the My requests table).

## Fix (kept)

- **RED** `3c2d2d81`: `apps/csrm/src/lib/performance/list-boundary-scope.test.ts`. It fails when a directory holding a page and its `loading.tsx` also holds child route segments, unless that directory is on an explicit list where each entry gives its reason. It also pins the risks, requests and reports lists in their route groups, and keeps each section's `error.tsx` in the section directory. It failed 3 of 6 before the fix.
- **GREEN** `30fb66af`: moved `risks/page.tsx` and `risks/loading.tsx` into `risks/(register)/`, and `requests/page.tsx` and `requests/loading.tsx` into `requests/(my-requests)/`. This is Phase 18's `(report-index)` pattern and the route-group recipe in Next's docs (`route-groups.md`, "Opting for loading skeletons on a specific route"). URLs are unchanged.
  - Why it works: Next renders a segment's `loading.tsx` around everything below it. The list skeleton, a client component that renders the real register or table, was therefore a client reference in every record route's RSC payload.
  - Each section's `error.tsx` stays where it was, so New request and Edit request (which have no error boundary of their own) keep the My requests error state.
  - Tests that import the moved files by path were updated: `page-boundaries`, `list-export-placement`, `request-routes`, `request-table`, `risk-register-page`, `risk-register`, `interface-copy-guard`, and `zod-client-boundary`'s route map.

**Behaviour note (one transient state).** A client navigation from another section straight to a record, such as Home to a Risk, used to flash the list skeleton. That happened because the outermost new segment's loading boundary was the list's. It now shows the record's own skeleton. The reports index was moved for the same reason ("a report opened from anywhere never flashes the index skeleton"). A server render, and any navigation from the list to a record, already used the record's skeleton, so neither changed. No copy, accessibility or primary action changed.

## Experiment (reverted)

The lockup mark came from `getImageProps` instead of the `next/image` component, to drop the three duplicated image-component copies from the shell. The RED commit `afc19d71` held two behaviour pins, which passed against next/image, and a guard. The rebuild raised every route by 62 to 70 estimated bytes, because `next/image`'s module still brings the component. The code change was never committed. `70ef7d8a` reverts the RED commit. Importing Next's internal `get-img-props` was not tried, because it is a private path. The shared shell is unchanged.

## Gate (on `70ef7d8a`)

| Check | Result | Duration |
|---|---|---:|
| `api:check` + `git update-index --refresh` on `schema.d.ts` | clean | 3 s |
| `typecheck` | clean | 7 s |
| `lint` | clean | 6 s |
| `test` (web, alone) | 246 files, **6,446/6,446** (6,440 + 6 new) | 136 s |
| `apps/backend` test | **skipped**: nothing under `apps/backend` changed. Citing Phase 19's final gate at `31d7c70d`: 2,306 passed, 1 skipped | |
| `test:e2e` (full) | **268/268**, 0 flaky | 41.4 min |

## Deviations

- `typecheck` first failed on a stale `apps/csrm/.next/dev/types/validator.ts`, an ignored file that `next dev` generated on 2026-10-12 and that still referenced the old page paths. I moved that directory into the session scratchpad rather than deleting it. `next dev` regenerates it.
- The web server printed `Error: The destination stream closed early.` 886 times during the Playwright run, with no test failing. I did not compare this against an earlier run's log.
- The other routes that still wrap their records (assessments, questionnaires, and three review lists) are on the guard's list with "not yet moved into a route group". Moving them is a follow-up if their budgets ever tighten.
- `gsd-tools quick-tasks-append` resolves only the root `.planning/STATE.md` and ignores `--ws`, so the quick-task row was added to `.planning/workstreams/csrm/STATE.md` by hand, in the table's own format. The description contains no `|`.
