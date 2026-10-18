---
phase: 19-csv-export-and-import-hardening
plan: 10
subsystem: exports
tags: [csv-export, xlsx, released-assessment, record-read-check, risk-assessments, my-risk-assessments, authorization, service-identity, function-catalogue, served-operations, authorization-matrix, shared-backend]
status: complete

requires:
  - phase: 19-csv-export-and-import-hardening
    provides: "19-04: runFixedTableExport, runListExport, ExportTable, tables.released-assessment, EXPORT_MEDIA_TYPES, exportFileName, sendExportFile, sendExportError, resolveExportActor; 19-02/19-04: ASSESSMENT_NOT_RELEASED, ExportRefusalError; 19-05: SERVICE_IDENTITY_REFUSED_OPERATIONS, underlyingRead, the analyst-export branch of humanAnalystDenialMessage, the export test helpers; 19-07: function.analyst_exports.list_export_api and function.my_exports.list_export_api; 19-09: logRefusedFixedTableRequest, the human-only count at 36"
  - phase: "Phase 16 (risk curation)"
    provides: "the active-risk rule (ACTIVE_RISK_FILTER, activeRiskSql, isActiveRisk) and active-risk-readers.unit.test.ts"
provides:
  - "apps/backend/src/api/csrm-assessment/services/released-assessment-read.ts: type AssessmentViewer, RELEASED_ASSESSMENT_FILTERS, RELEASED_ASSESSMENT_POPULATE, readableAssessmentFilters, composeAssessmentFilters, isReadableReleasedAssessment, findReadableReleasedAssessment (the one record-read check Phases 17, 17.1 and 19.1 extend)"
  - "the analyst assessment detail's required `released` flag (spec AnalystAssessmentDetail.released), parsed by the web in server-only assessment-server-schema.ts"
  - "GET /api/v1/risk_assessments/{assessmentId}/export (exportReleasedAssessment, operationId assessment-workflow/export-released-risk-assessment)"
  - "GET /api/v1/risk_assessments/export (exportAssessments, human Security Analyst only) and GET /api/v1/my_risk_assessments/export (exportMyAssessments, owner scope for every person)"
  - "csrm/exports/released-assessment-export.ts: releasedAssessmentExportTables, RELEASED_ASSESSMENT_EXPORT_VIEW, RELEASED_ASSESSMENT_AI_NOTICE, releasedAssessmentFileStem"
  - "export views riskAssessmentsExportView, myRiskAssessmentsExportView; buildAssessmentExportQuery (assessment-scope.ts)"
  - "CSRM_ASSESSMENT_OPERATIONS.exportReleased, .exportList, .exportMine"
  - "catalogue: function.risk_assessments.export_api (.api.01) for role.security_analyst and role.requestor; function.analyst_exports.list_export_api.api.04; function.my_exports.list_export_api.api.03"
  - "three matrix rows; the human-only mirror and count (37); the refusal-set mirror"
affects: [19-11, 19-12, 19-14, 19-15, phase-17, phase-17.1, phase-19.1]

actuals:
  tokens: 41191
  tasks: 4
  commits: 7

plan_head_before: 61ad95c2d6e1bdeed3cc0aa7726726fadc164371
plan_head_after: e652484fa2948c81e7ccd0dc6879c46ca03e324a

tech-stack:
  added: []
  patterns:
    - "One record-read check: both rules as Document Service filters merged into one object (composeAssessmentFilters, so the owning-request join is one), and the same rules again in memory on the record read back"
    - "A released read's rows are shared functions (readAssessmentRisks, readRiskControlImplementations) the API handlers and the export both call, so the file holds exactly what the reads return"
    - "A server-only schema module (assessment-server-schema.ts) for a parse only the server needs, typed in the client-loaded module through an erased type re-export"

key-files:
  created:
    - apps/backend/src/api/csrm-assessment/services/released-assessment-read.ts
    - apps/backend/src/csrm/exports/released-assessment-export.ts
    - apps/csrm/src/features/assessments/assessment-server-schema.ts
    - apps/backend/tests/released-assessment-read.unit.test.ts
  modified:
    - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
    - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
    - apps/backend/src/api/csrm-assessment/routes/csrm-assessment.ts
    - apps/backend/src/api/csrm-assessment/operations.ts
    - apps/backend/src/csrm/exports/export-views.ts
    - apps/backend/src/csrm/exports/run-export.ts
    - apps/backend/src/csrm/exports/export-vocabulary.json
    - apps/csrm/src/features/exports/export-vocabulary.json
    - apps/backend/src/policies/csrm-authorization.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/served-operations.json
    - apps/csrm/src/features/assessments/assessment-schema.ts
    - apps/csrm/src/features/assessments/assessment-service.ts
    - apps/backend/tests/exports.integration.test.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - apps/backend/tests/assessment-workflow.unit.test.ts
    - apps/backend/tests/export-vocabulary.unit.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/csrm/src/features/assessments/assessment-service.test.ts
    - apps/csrm/src/features/assessments/released-assessment-route.test.ts
    - apps/csrm/src/features/assessments/assessment-editor.test.tsx
    - apps/csrm/src/features/assessments/risk-editor.test.tsx
    - apps/csrm/src/features/assessments/analyst-assessment-route.test.tsx

key-decisions:
  - "One module decides who may read a released assessment (D-14): the three released reads, My risk assessments and its rating summary, the analyst detail's released flag and the released export call it; releasedForOwner, releasedAssessmentQuery, releasedAssessmentDetailQuery and isReleasedAssessmentForOwner are gone"
  - "The released export's Risks table has no Risk Type column: the released risks read does not disclose a Risk's type, so the column was dropped from tables.released-assessment in both vocabulary copies (D-21)"
  - "The analyst's file is built from the same released projections as the Requestor's (projectReleasedAssessmentDetail with RELEASED_ASSESSMENT_POPULATE), so both actors get identical tables"
  - "Released-export query check order: the Requestor's 404 first (no export event), then the closed-key check (400, export.refused INVALID_QUERY), then the analyst's 409 ASSESSMENT_NOT_RELEASED (export.refused with that reason)"

requirements-completed: []

duration: 71min
completed: 2026-10-17
---

# Phase 19 Plan 10: Released-assessment record-read check and the assessment exports Summary

**One released-assessment record-read check now gates the released reads, My risk assessments and the new released-assessment export. Jane exports her released assessment as Summary, Risks and Mitigation controls (with the AI notice). The analyst exports the same tables once the assessment is released and gets 409 ASSESSMENT_NOT_RELEASED before that. The Risk assessments and My risk assessments lists export whole in their viewer's scope.**

## Performance

- **Duration:** 71 min
- **Started:** 2026-10-16T20:50:06Z
- **Completed:** 2026-10-16T22:01:40Z
- **Tasks:** 4
- **Files modified:** 32

## Accomplishments

- `released-assessment-read.ts` holds both rules once. "Released" means approved with the complete release facts, on an approved request. "Readable" means the Requestor's own request, or any analyst. Its header comment names the Phase 17 and Phase 17.1 widenings and the Phase 19.1 SQL twin. The detail, risks and control-implementation reads, `myRatingSummary` and the My risk assessments query all call it, with no behaviour change. The owner-only helpers are deleted.
- The analyst detail now carries `released`, set by `isReadableReleasedAssessment(document, { kind: "analyst" })`. The spec publishes it as required. The web parses it only in `server-only` code.
- `GET /api/v1/risk_assessments/{assessmentId}/export` is served for both actors through `runFixedTableExport`:
  - XLSX holds Summary, Risks, Mitigation controls and About this export. About carries Phase 12's §10.1 notice when AI assisted.
  - CSV holds the `risks` or `mitigation-controls` table.
  - File names use the lower-cased assessment number.
  - Each attempt writes one `export.completed` line with `view: "released-assessment"` and the subject.
- `GET /api/v1/risk_assessments/export` is human-only and needs the list read. `GET /api/v1/my_risk_assessments/export` is owner-scoped and needs the My list read. Both run through the lists' own parser, order and projection. Risks and Highest residual rating come from `riskSummariesFor`.
- The spec has the three paths with binary responses. Both catalogue copies are updated and byte-identical, the served inventory is regenerated, the matrix has three new rows, the human-only count is 37 and the refusal-set mirror is extended.

## Task Commits

1. **Task 1: one record-read check gates the released reads and Jane's export**
   - RED: `ae738765` (test)
   - GREEN: `9813c1c7` (feat)
2. **Task 2: every refusal at the released export, and the analyst's identical file**
   - RED: `875f510c` (test)
   - GREEN: `0339765d` (feat)
3. **Task 3: the Risk assessments and My risk assessments exports**
   - RED: `fe836ede` (test)
   - GREEN: `87961422` (feat)
4. **Task 4: the three matrix rows, the catalogue proof and the full suite:** `e652484f` (test)

## Verification

- **Task 1 verify:** exit 0.
  - `api:check` clean and `cmp` identical.
  - Web `vitest` (assessments and parity): 812/812.
  - Web `typecheck` and Strapi tests `tsc`: clean.
  - Strapi focused run: 131/131, 0 failed, 0 skipped. Files: `released-assessment-read.unit`, `assessment-workflow.integration`, `exports.integration`, `active-risk-readers.unit`, plus `assessment-workflow.unit` and `export-vocabulary.unit`, which this task changed.
- **Task 2 verify:** `exports` and `assessment-workflow` integration 80/80, 0 failed. The gathered-helper `git grep` is empty, and a source check found no requestor comparison left in the controller.
- **Task 3 verify:** exit 0.
  - `api:check` and `cmp` clean.
  - `exports.integration` and `active-risk-readers.unit`: 45/45.
  - Extra run: `export-vocabulary`, `export-pipeline`, `assessment-workflow` and `authorization-policy` unit files 103/103.
  - Web contract, api and export tests: 732/732.
- **Task 4 verify (full Strapi suite):** exit 0, 2198 tests, 2197 passed, 0 failed, 1 skipped. The skip is the existing POSIX-mode check on Windows. Run time 30.4 min. The run includes `authorization-matrix.integration.test.js` and `active-risk-readers.unit.test.js`, which needed no new exemption.
- **Content-type freeze:** `git diff --name-only bdd0f698 -- 'apps/backend/src/api/*/content-types/*' …` prints nothing.

## Module final exports

`released-assessment-read.ts` exports:
- `type AssessmentViewer`
- `RELEASED_ASSESSMENT_FILTERS` and `RELEASED_ASSESSMENT_POPULATE` (deep-frozen)
- `readableAssessmentFilters(viewer)`
- `composeAssessmentFilters(...filters)`
- `isReadableReleasedAssessment(document, viewer)`
- `findReadableReleasedAssessment({ documents, viewer, documentId, populate? })`

`composeAssessmentFilters` is an addition. It merges both rules into one filter object, so the owning-request join stays one join, exactly as the former hand-written filter was.

## Released-table column dropped

- `tables.released-assessment.risks` loses `riskType` (`Risk Type`). The released risks read (`projectAssessmentRiskListItem`) does not disclose a Risk's type.
- Both vocabulary copies were changed together and stay byte-identical. `export-vocabulary.unit.test.ts` was updated to match.
- Every other column of Summary, Risks and Mitigation controls is disclosed by the released reads.

## Matrix rows

| Operation | owner | other | analyst | serviceAgent | noIdentity | noToken |
| --- | --- | --- | --- | --- | --- | --- |
| `GET:/api/v1/risk_assessments/{assessmentId}/export` | 200 | 404 | 200 | 403 | 403 | 401 |
| `GET:/api/v1/risk_assessments/export` | 403 | 403 | 200 | 403 | 403 | 401 |
| `GET:/api/v1/my_risk_assessments/export` | 200 | 200 | 200 | 403 | 403 | 401 |

- **Proofs:** each allowed success cites its `exports.integration.test.ts` test.
- **Human-only mirror:** adds only `GET:/api/v1/risk_assessments/export`. The count goes from 36 to 37.
- **Refusal-set mirror:** adds all three operations.

## Web move (19-PLAN-CHECK recheck B W-2)

- **New module:** `apps/csrm/src/features/assessments/assessment-server-schema.ts` starts with `import 'server-only'`. It holds:
  - `analystAssessmentReadSchema` (`analystAssessmentDetailSchema.extend({ released: z.boolean() }).strict()`);
  - the released view schema and its keys;
  - `releasedAssessmentDetailForActorSchema`, whose analyst branch is the extended schema.
- **Client-loaded `assessment-schema.ts`:** gains no runtime code and loses the released view parse.
  - It only exports `assessmentDetailShape` and `requireReleaseFacts`.
  - It types `AnalystAssessmentDetail` as `z.infer<...> & { released: boolean }`.
  - It type-re-exports `ReleasedAssessmentDetailForActor`, which is erased at build time.
  - `released-assessment.tsx`, `assessment-editor.tsx`, `assessment-actions.ts` and `assessment-domain.ts` keep their imports.
- **`assessment-service.ts`:** parses the analyst detail with `analystAssessmentReadSchema`. The parity entry `getReleasedAssessment (analyst actor)` now checks the extended schema against `AnalystAssessmentDetail`.
- **Tests updated:**
  - `assessment-service.test.ts` reads both schemas from `assessment-server-schema`, and gains a service and schema case for the flag.
  - `released-assessment-route.test.ts` imports from `assessment-server-schema`, and its analyst payload has `released: true`.
  - The five typed fixtures carry `released`.

## Decisions Made

- **Query check order on the released export:**
  1. The Requestor's 404 comes first, with no export event (D-18).
  2. Then the closed-key check: 400 and `export.refused` `INVALID_QUERY`.
  3. Then the analyst's 409 `ASSESSMENT_NOT_RELEASED` with `export.refused` naming that reason.
  4. Then format, table and zone, checked by the pipeline.
- **The analyst's 404:** the analyst reads the record's existence (`findOne` with `fields: ["documentId"]`). A missing assessment is 404 and writes no event.
- **No N+1 shortcut:** the Mitigation controls table reuses each active Risk's own control-implementation read, so it matches what the Requestor reads, row for row and in order.
- **List export id reads:** they select the sorted fields alongside `documentId`, so every database orders by selected columns.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `assessment-workflow.unit.test.ts` imported the deleted `releasedAssessmentQuery`**
- **Found during:** Task 1
- **Fix:** the owner-scope assertion now spells out the released predicate literally. This also proves the move kept the same filter.
- **Files:** `apps/backend/tests/assessment-workflow.unit.test.ts`
- **Commit:** `9813c1c7`

**2. [Rule 1 - Bug] Assertions that pinned the old shapes**
- **Found during:** Tasks 1 and 4
- **Fix:**
  - The analyst detail's exact key list in `assessment-workflow.integration.test.ts` gains `released` and asserts `false` on a draft.
  - The released vocabulary test drops `riskType`.
  - The Phase 06.9 status-filter check in `contract-catalogue.integration.test.ts` counts four published `status` parameters (both lists and both list exports) instead of two.
- **Files:** `assessment-workflow.integration.test.ts`, `export-vocabulary.unit.test.ts`, `contract-catalogue.integration.test.ts`
- **Commits:** `9813c1c7`, `e652484f`

**3. [Rule 2 - Missing functionality] `logRefusedFixedTableRequest` could only log `INVALID_QUERY`**
- **Found during:** Task 2
- **Fix:** it takes an optional closed `reason` (`INVALID_QUERY` | `ASSESSMENT_NOT_RELEASED`), so the analyst's 409 writes its one `export.refused` line with the right reason.
- **Files:** `apps/backend/src/csrm/exports/run-export.ts` (not in the plan's file list)
- **Commit:** `0339765d`

**4. [Rule 1 - Test bug] About-sheet chip date**
- **Found during:** Task 3
- **Issue:** the test expected `1 Jul 2026`, but ICU's en-AU short month is `July`.
- **Fix:** the test now formats the expected chip with the list chip's own formatter (`formatRequestDate`'s options). The server formats exactly as the web chip does.
- **Commit:** `87961422`

**5. Parity guard entry not added**
- **Found during:** Task 1
- **Issue:** a separate `getAnalystAssessment` parity entry would fail the parity guard on long-standing min-length bounds that the existing grandfathered analyst entry already carries.
- **Fix:** the plan's existing `AnalystAssessmentDetail` branch entry (`getReleasedAssessment (analyst actor)`) now checks the extended schema, as the plan says. No new entry was added.

**6. Catalogue test shape**
- **Found during:** Task 4
- **Change:** the Phase 19 table moved from `roleId` to `roleIds` (one or both Roles), and gained `fixedTables` (no `columns` parameter for the report and released exports).
- **Why:** `function.risk_assessments.export_api` is the first export Function granted to both Roles, with its own description pattern.

### Out-of-plan files

`apps/backend/src/csrm/exports/run-export.ts`, both `export-vocabulary.json` copies, `apps/backend/tests/assessment-workflow.unit.test.ts` and `apps/backend/tests/export-vocabulary.unit.test.ts`. Each is explained above.

## Route budgets

`assessment-schema.ts`, which the tight-budget routes load, gained only `export` keywords and type-only declarations. Its runtime released-view parse moved out, so client bundles can only shrink. No Playwright performance run was part of this plan, so the headroom is not re-measured here. 19-11, 19-12 and the 19-15 gate measure it.

## Threat Flags

None. The three operations are exactly those the approved record (`phase-19-exports-and-export-log.md`) lists. Each is in `SERVICE_IDENTITY_REFUSED_OPERATIONS`, and the list export is also in `HUMAN_ANALYST_ONLY_OPERATIONS`. Each requires its read. No content type changed.

## Known Stubs

None.

## Issues Encountered

None beyond the deviations above.

## Next Phase Readiness

- **Web (19-11 and 19-12):** can now offer Export and Print report on both released views, gated by the analyst detail's `released` flag. They can call the three operations through the generated client.
- **Phase 17:** widens "readable" in `released-assessment-read.ts` alone.
- **Phase 17.1:** widens "released" there.
- **Phase 19.1:** adds the SQL twin beside them.

## Self-Check: PASSED

- Files exist: `released-assessment-read.ts`, `released-assessment-export.ts`, `assessment-server-schema.ts`, `released-assessment-read.unit.test.ts`.
- Commits exist: `ae738765`, `9813c1c7`, `875f510c`, `0339765d`, `fe836ede`, `87961422`, `e652484f`.
