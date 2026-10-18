# Phase 19 Deferred Items

## From 19-11 (route budgets; pilot ruling 2026-10-17)

- **Reclaim route-budget headroom on `/app/risks/{documentId}` and `/app/requests/{documentId}` (target at least 5 KB each) by analysing the shared shell chunks, as a GSD quick task the pilot runs after Phase 19 closes and before Phase 19.1.**
  - **Why:** 19-11 made `ExportButton` reachable from nine more routes, and Turbopack regrouped the shell's modules between two chunks that every route loads. The modules are the same and the decoded total is identical (62,841 bytes), but the new grouping compresses about 125 bytes worse. Headroom against the 300,000-byte budget fell from 278 to 151 bytes on `/app/risks/{documentId}` and from 620 to 483 bytes on `/app/requests/{documentId}` (490 after 19-12). See `19-11-SUMMARY.md` "Route budgets" and deviation 7.
  - **Ruling:** accepted for Phase 19 (option a). Lazy loading the list Export (option c) is rejected, because a primary action that flashes or disables itself falls below the G-4 bar.
  - **Pressure:** Phases 17, 17.1 and 20 all change these two pages and cannot absorb a 151-byte margin.
  - **Owner:** the pilot (quick task). Severity: medium (no budget is exceeded today, but the next phases that touch these pages are blocked without headroom).
  - **Resolved (2026-10-18):** quick task 261018-1al (`30fb66af`) scoped the Risk Register's and My requests' loading boundaries to their lists: `/app/risks/{documentId}` 262,456 and `/app/requests/{documentId}` 289,383 of 300,000.

## Phase 19 code review: findings deferred with a route (pilot rulings, 2026-10-17)

From `19-REVIEW.md`; the full disposition is in `19-REVIEW-DISPOSITION.md`. Each route is also recorded as a dated "Carried from Phase 19" section in the target phase's CONTEXT.

- **BE1-09:** a questionnaire export with a `status` filter loads the whole scope, with its questions, before the row cap is checked, because the status is computed in memory. The cap bounds the file but not the memory of an over-cap attempt. Route: **Phase 22**'s configuration and hardening work. Low exposure: analyst-only, bounded by the analyst's questionnaire scope.
- **BE2-07:** `function.reports.reports` has no FunctionApis after 19-09's move but keeps its `Reports:Reports` menu path and its grant to `role.security_analyst_agent`, so the agent's effective access lists an empty menu Function. Not a hole (navigation is not authorisation). Route: **Phase 22**, which withdraws the agent's explicit grants (D-09).

## Phase 19 security audit: deferred with a route (pilot ruling, 2026-10-17)

From `19-SECURITY.md` ("Notes"), recorded as the dated "Carried from Phase 19 (security audit)" section in `22-CONTEXT.md`.

- **Export rate and concurrency limit:** the 14 export operations have no per-actor rate or concurrency limit, and Strapi puts no byte bound on a built file (the web's 64 MiB check runs after Strapi has built it). Each export is bounded by 10,000 rows, 40 columns and its stored fields' own lengths, and no Phase 19 plan declared a rate limit. Route: **Phase 22**'s configuration and hardening work, beside Phase 16's BE2-13 limit on concurrent provider calls: one configurable per-actor (or per-process) bound around the export pipeline, and a byte bound on the built file. Low exposure: every export needs a granted human actor and reads only that actor's scope.
