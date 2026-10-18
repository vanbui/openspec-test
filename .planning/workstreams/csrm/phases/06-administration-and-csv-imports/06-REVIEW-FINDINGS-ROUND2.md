# Phase 6 Remediation Review Findings — Round 2

Source: adversarial four-lens review of the remediation range `f4d9452..HEAD` (every finding independently verified against committed code). 14 confirmed findings deduplicated into 9 work items, R1/R2/R4 are blockers. Operator decisions baked in — implement exactly as specified, no checkpoints, no deferrals.

## R1 (BLOCKER). Multipart transport caps were removed, not re-scoped
`apps/strapi/config/middlewares.ts`: commit 19159bc deleted the global formidable caps and added NO replacement anywhere — `strapi::body` (koa-body/formidable 2.x) now falls back to ~200 MiB per file with no file-count cap, parsed globally BEFORE route auth. The rewritten unit test (administration.unit.test.ts ~36) locks in the ABSENCE of caps, and the remediation ledger's F6 row falsely claims bounds were applied to the import routes.
**Decision (accepting Strapi's global-body-parse constraint):** Restore bounded global formidable config: `maxFileSize: 52_428_800` (50 MiB), `maxTotalFileSize: 262_144_000` (250 MiB), no global maxFiles cap — large enough for admin media, bounded against trivial pre-auth disk exhaustion. Keep the strict import contract (exactly one file, 5 MiB, CSV_MAX_BYTES) enforced at the workflow trust boundary as it is now (the mounted two-file/oversize/unexpected-field zero-write regressions must stay green). Invert the unit test to lock the bounded global values. Correct the F6 ledger row in `260902-a9r-SUMMARY.md` and the multipart row in `06-VERIFICATION.md` to describe the real architecture: global 50 MiB transport bound + workflow-level 5 MiB/1-file import contract. Record the same in `docs/contract-gaps/phase-06-administration-import-contract.md`.

## R2 (BLOCKER). Requestor inventory pickers silently truncated to 25 records
`apps/web/src/features/requests/request-service.ts` (~99, ~111): pickers now issue queryless GET `/v1/information_systems|information_assets`; the server's queryless default is page 1 / pageSize 25; `parseRequestInventoryPayload` discards `meta.pagination`; and requestors cannot add ANY query parameter (403 under the new split). Pre-remediation the pickers fetched pageSize 100. An org with >25 systems loses picker options with no error.
**Decision:** Server: the queryless picker branch in the authorization policy additionally accepts canonical pagination-only queries — `page` and `pageSize` (pageSize bounded ≤100), nothing else — under the picker grant; `q`, `sort`, and filters remain analyst-only (403 for requestors). Web: `listInformationSystems`/`listInformationAssets` page through ALL results using `meta.pagination` (pageSize 100 per request, loop bounded by pageCount with a hard safety cap), stop discarding pagination metadata. Mounted regressions: requestor with pagination-only query → 200; requestor with `q`/`sort` → 403 with zero disclosure; web unit test proving the picker aggregates >25 records across pages.

## R3. Implicit-birthright scope of the picker grant — document
`csrm-authorization.ts` (~101-108, 167, 190-196): any active idambox user (no CSRM role needed) receives the implicit Requestor birthright and can therefore read the full inventory projection queryless. This matches the catalogue's implicit-Requestor design, so NO code change — but it must be documented explicitly in `docs/contract-gaps/phase-06-administration-import-contract.md` (who can read what through the picker grant, and that the projection is the administration list projection).

## R4 (BLOCKER). Fabricated F5 evidence — write the real call-count regression
`260902-a9r-SUMMARY.md` ledger row F5 claims "Repository call-count regression … proves a single initial collection read" — no such test exists (verified via git log -S across all history). The single-fetch code change itself is real.
**Decision:** Add the genuine regression: a unit/integration test that counts `findNaturalKeyRecords` invocations through a multi-create-row import commit (inject a counting repository or spy at the service seam) asserting exactly one initial collection read. Correct the ledger row to reference the real test. The test must fail if a per-row rescan is reintroduced.

## R5. Restore the max-records guard on the import path
`administration-workflow.ts` commitAdministrationImport (~272-291): replacing per-row `assertNaturalKeyAvailable` dropped its `records.length > 65_536` guard, so repeated 5,000-create imports can push a collection past ADMINISTRATION_MAX_RECORDS, after which `findNaturalKeyRecords` truncates at 65,537 and classification goes blind.
**Decision:** Enforce once per import (preview AND commit, inside the serialized queue): if `existingRecords.length + createRowCount > ADMINISTRATION_MAX_RECORDS`, fail the whole import with the bounded 4xx envelope and a clear message (no partial writes). Unit regression at the boundary (exactly at cap passes; cap+1 rejected).

## R6. F4 regression must be mounted, not only in-memory
`administration.unit.test.ts` (~163): the beyond-5,000 classification regression passes a synthetic array into `parseAdministrationCsv`, so a reintroduced fetch-layer truncation (e.g. a pageSize default at the documents.findMany call) would go unseen.
**Decision:** Add a mounted integration test: insert >5,000 records cheaply (direct repository/db loop inside the mounted harness), then run a real preview via HTTP classifying a beyond-window natural key as `update`. Keep the unit test as the fast path.

## R7. Integrity script gate-counting still maskable
`scripts/verify-phase-06-integrity.mjs` (~223): the 22 csrm-administration gates are counted by raw `content-api-token` string occurrences anywhere in the file — a removed gate plus a comment containing the literal still passes.
**Decision:** Parse per-route: extract each route object block and assert its own `auth` block contains the token strategy; count = number of route blocks that individually pass. A hostile fixture removing one gate (with a compensating comment) must fail.

## R8. Contract-gaps doc contradicts the shipped authorization split
`docs/contract-gaps/phase-06-administration-import-contract.md` (~18, 22) still says all 24 Administration routes require the explicit analyst Administration scope.
**Decision:** Rewrite those sections to the truth: the two picker list routes (`GET /v1/information_systems`, `GET /v1/information_assets`) accept queryless (and, after R2, pagination-only) requests under the implicit Requestor birthright picker grant; every queried/filtered/sorted read and all 22 remaining operations require the explicit analyst Administration scope. Fold in R1's multipart architecture and R3's birthright note.

## R9. apps/web/.tmp hygiene
`.gitignore` only ignores `apps/strapi/.tmp/`; each Playwright run leaves `apps/web/.tmp/playwright-next-*` dirt and `next dev` appends stale include globs to `apps/web/tsconfig.json`.
**Decision:** Add `apps/web/.tmp/` to `.gitignore`; strip the stale `playwright-next-*` include entries from `apps/web/tsconfig.json` down to the canonical include set and commit the clean file. (Accumulation across future runs is a known local artifact; no runtime code change.)

## Constraints (unchanged, non-negotiable)
Frozen content-type schemas; byte-identical catalogues; token-only outer gate; no AI attribution; real newlines in commit bodies; no escape hatches surviving GREEN (no sentinels, .skip, execArgv gates, message-prefix seams, hardcoded search literals). Finish with the full gate: `(cd apps/strapi && npm test)` and `(cd apps/web && pnpm typecheck && pnpm test && pnpm api:check && pnpm test:e2e)` under Node 24.19. Do NOT mark Phase 6 complete, do NOT touch Phase 7, do NOT push.
