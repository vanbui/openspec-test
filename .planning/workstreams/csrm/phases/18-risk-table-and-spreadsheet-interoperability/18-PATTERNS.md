# Phase 18: Risk table and spreadsheet interoperability - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 58 (new and modified)
**Analogs found:** 52 / 58
**Economy (stage2-rules §3a):** areas already mapped are cited, not re-surveyed: `16-PATTERNS.md` (guard, inner functions, history writer, curation, routes and human-only set, controller shape, web service/action), `17-PATTERNS.md` (participant predicate and branch, new-route shape, people search, owner eligibility, guard order, matrix seventh caller, Playwright mobile project), `17.1-PATTERNS.md` (accepted-edit transition, readiness projections, human-only operations), `17.2-PATTERNS.md` (serialise + transaction + row lock, `projectControlImplementationSummary`, status mapping family), `19-PATTERNS.md` (spreadsheets, exports, security log, export routes, import flow, contract chain, record format), `19.1-PATTERNS.md` (new owned content type, closed versioned envelope). Prefixes: `B/` = `apps/backend/`, `W/` = `apps/csrm/`.

## Earlier-phase ownership (build on the planned state)

Every file below is changed first by the named earlier plan or phase. The Phase 18 planner reads that plan's `files_modified` and must_haves before writing against it; Stage 3 re-checks.

| File | Changed earlier by | What it holds when Phase 18 starts |
|---|---|---|
| `B/src/csrm/risk-scale.ts` | **12-02** (creates), 12-03, 12-06, 16-02 | canonical likelihood/consequence labels and bands (12 D-10). Phase 18 adds the reading function (D-21), derivation and descriptions (D-20) |
| `B/src/api/csrm-assessment/services/assessment-workflow.ts` | 10-x, **16-04** (`assertAssessmentEditable`), 16-09, **17-05/17-06** (round lock, owner rules), 17.1 (acceptance lock, `transitionForAcceptedEdit`), 17.2 | the one guard with actor; `parseWritableRiskFields` (561-585 today) |
| `B/src/api/csrm-risk/services/risk-workflow.ts`, `control-implementation-workflow.ts` | **16-04** (inner `*WithinMutation`), 17-05 (eligibility), 17.1 (approver clearing, exception refusal) | inner create/update used by the bulk core (D-13) |
| Risk history writer + `csrm-risk-history-event` (`sourceKind`, `batchId`) | **16-02, 16-03**, 17-05 | reserved `batchId`; Phase 18 adds sources `table`, `import` |
| `B/src/api/csrm-assessment/services/assessment-scope.ts` | 10-15, 10-18, 11-07, 12, **16** (active rule), **17** (participant projection), **17.1** (fingerprint, D-47), 17.2, **19** (released predicate) | `projectAnalystRiskDetail` (264), `projectControlImplementationSummary` (344) |
| `B/src/csrm/conflict-reasons.ts` + `W/src/lib/api/conflict-reasons.ts` | **10-06**, 12-02, 16, 17, 17.1, 19 | frozen closed list; append D-03 item 8 codes |
| `W/src/lib/api/refusal-copy.ts` | **10-07** … 19-15, 19.1-08 | add family X (UI-SPEC §12) |
| `B/src/policies/csrm-authorization.ts` | 10-13, 12, 13, 16, 17, 17.1, **19** (`SERVICE_IDENTITY_REFUSED_OPERATIONS`, `underlyingRead`) | `HUMAN_ANALYST_ONLY_OPERATIONS` |
| `B/src/csrm/spreadsheets/{xlsx-reader,header-match,value-convert,neutralise,xlsx-writer,csv-writer}.ts` | **14-02** (reader), **19-01, 19-03, 19-13** | Phase 18 extends reader (named sheet) and converters (dates, scales, people, controls) |
| `B/src/csrm/exports/*`, `B/src/csrm/audit/security-event-log.ts` | **14-03**, 17-04, **19-01, 19-04**, 19-13 | export pipeline, log line |
| `W/src/components/csrm/export/column-choice.tsx`, `export-dialog.tsx` | **19-06** | X-30 column-choice primitive (reused by X-61 chooser) |
| `W/src/components/csrm/data-table.tsx` | 06.6, 11-x (lists, density), 19-06 (export slot) | 453 lines today; features at 26-30, `useTable` at 224-236 |
| `W/src/components/csrm/status-badge.tsx` | 11-01, 12, 16, 17.1, **17.2** | one status mapping (G-13) |
| Navigation guard (10 D-12) | **10-08**, 11-05, 13-09, 14-12, 19.1-08 | leave warning for the record layout |
| `W/app/(app)/app/review/assessments/[documentId]/page.tsx` + `risk-editor.tsx`, `assessment-editor.tsx` | 10-02, 12, **16** (D-45 card pieces), **17**, **17.1**, **17.2** | per-risk surfaces that move into the detail sheet |
| `W/app/(app)/app/assessments/[documentId]/page.tsx`, `released-assessment.tsx` | 10-02, 10-15, 10-18, 11-07, 12, 16, **17** (participant page), **17.1**, **19** (Export, report) | participant page and released read |
| Three review list pages (requests, questionnaires, assessments) | 11-03…11-14, **13** (assignee column), 19 (Export) | DataTable consumers gaining `Columns` |
| `W/src/features/risks/risk-detail-editor.tsx` (Risk Register form) | 11-14, 16, 17 | gains bases + scale pickers (D-14, D-20) |
| `docs/references/specification.json`, `W/src/lib/api/generated/schema.d.ts`, both catalogue copies, `served-operations.json`, `B/tests/fixtures/authorization-matrix.ts`, parity/chain guards | every API plan of 10 to 17.2, 19, 19.1 | seven-caller matrix (17 D-75); file-response parity mode (19) |
| `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md`, `phase-19-import-tolerance.md`, `phase-19-exports-and-export-log.md`, `phase-17-participant-read.md`, 17.1 acceptance record | 16-01, 19-01, 17-01, 17.1 | amended by dated sections |
| `W/e2e/risk-owner-journey.spec.ts` | 15-14, 16-15, **17** (slice 1), 17.1, 17.2, 19-15, 19.1-10 | analyst steps move to Risks route and sheet (no new slice) |
| `W/e2e/performance.spec.ts` | 08, 19, Phase 17 routes | `PERFORMANCE_BUDGETS` line 55, overrides 69-73 |
| `docs/design/csrm-design-direction.md` | every UI phase through X-52 | X-53…X-61 recorded by a plan task |

## File Classification

### Records and contract chain
| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `docs/contract-gaps/phase-18-risk-scales-and-rating-override.md` (new) | doc | — | `phase-06.8-questionnaire-governance-facts.md`; format per 19-PATTERNS "Contract-gap record format" | exact |
| `docs/contract-gaps/phase-18-saved-views.md` (new) | doc | — | 19.1's notification record | exact |
| `docs/contract-gaps/phase-18-bulk-risk-changes-and-import.md` (new) | doc | — | `phase-16-risk-withdrawal-and-history.md` + `phase-19-import-tolerance.md` | exact |
| spec, catalogues, served-operations, matrix, parity/chain guards (mod) | config/test | — | 19-PATTERNS "Contract chain", 17-PATTERNS "Matrix seventh caller" | exact |
| `B/config/middlewares.ts` (mod, optional `jsonLimit: '1mb'`) | config | — | itself, lines 22-31 | exact |

### Strapi
| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `B/src/csrm/risk-scale.ts` (mod) | utility (pure) | transform | itself [12-02]; closed-tuple style of `ASSESSMENT_RATINGS` (`assessment-workflow.ts:12-13`) | exact |
| `B/src/csrm/risk-table/compare-and-set.ts` (new) | utility (pure) | transform | 16-RESEARCH Pitfall 10 normalisation; `parseWritableRiskFields` (561-585) | role-match |
| `B/src/csrm/risk-table/risk-table-view.ts` (new, filter-and-sort + view-definition parser) | utility (pure) | transform | `risk-register-query.ts` [11-14]; envelope parser per 19.1-PATTERNS `notification-facts.ts` (versioned, fail safe) | role-match |
| `B/src/csrm/risk-table/risk-changes.ts` (new bulk core) | service | batch / CRUD | `risk-curation.ts` [16-05] batch withdraw (16-PATTERNS "risk-curation.ts") + `updateRisk` (`risk-workflow.ts:192-225`) | exact |
| `B/src/api/csrm-assessment/services/assessment-workflow.ts` (mod: scale/override rules in `parseWritableRiskFields`) | service | request-response | itself 561-585 | exact |
| `B/src/api/csrm-risk/services/risk-workflow.ts` (mod: PATCH bases) | service | CRUD | itself 192-225 | exact |
| `B/src/api/csrm-assessment/services/assessment-scope.ts` (mod: control summary, override reasons, scale) | service | transform | `projectAnalystRiskDetail` 255-273; `projectControlImplementationSummary` 344 (17.2-PATTERNS) | exact |
| `B/src/csrm/spreadsheets/value-convert.ts`, `xlsx-reader.ts` (mod) | utility | transform / file-I/O | themselves [19-03, 14-02]; 19-PATTERNS "Shared spreadsheet modules" | exact |
| `B/src/csrm/risk-table/risk-import.ts` (new: two tables, preview, commit, drift) | service | batch / file-I/O | `csv-import.ts` + `administration-workflow.ts` preview records (19-PATTERNS lines 124-160) | exact |
| `B/src/csrm/risk-table/risk-table-export.ts` (new) | service | file-I/O | 19-PATTERNS "Export pipeline" and "Export routes and controllers" | exact |
| Assessment routes/controllers (mod: `risk_changes`, import, export) | route/controller | request-response | 16-PATTERNS "Routes, grants…" and "Controller handler shape"; 17-PATTERNS "New routes (no core router)" | exact |
| `B/src/api/csrm-saved-view/` (new: schema, routes, controller, service) | model + controller + service | CRUD | 19.1's `csrm-notification` (19.1-PATTERNS lines 16, 63-110): manyToOne `idambox-user`, `draftAndPublish: false`, own-records repository | exact |
| `B/src/policies/csrm-authorization.ts` (mod) | middleware | request-response | 17.1-PATTERNS "Human-only operations"; 19-PATTERNS lines 203-216 | exact |
| `B/tests/risk-changes.integration.test.ts`, `risk-import…`, `risk-table-export…`, `saved-views…` (new) | test | — | 16-PATTERNS "Integration tests"; 19-PATTERNS E2E/integration | exact |
| `B/tests/risk-scale-derivation.unit.test.ts`, `risk-table-view.unit.test.ts` (new) | test | — | existing `*.unit.test.ts` beside `risk-scale` [12-02] | exact |

### Web
| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `W/src/components/csrm/data-table.tsx` (mod: grid mode, no-pagination, column choice) | component | event-driven | itself (lines 1-40, 224-236, 317-395) | exact |
| `W/src/features/risk-table/risk-table-domain.ts` (new, zod-free) | utility | transform | `W/src/features/risks/risk-domain.ts` [11-14]; zod-free rule 08-13 | role-match |
| `W/src/features/risk-table/risk-table-view.ts` (new; parity with Strapi) | utility | transform | `report-definitions.ts` ↔ `report-copy.json` parity | role-match |
| `risk-table.tsx`, `risk-grid-cell.tsx`, `unsaved-changes-bar.tsx` (new) | component | event-driven | DataTable rows/cells (317-395), its bulk-action bar | role-match |
| `cell-editors/*`, `matrix-picker.tsx`, `paste-preview-dialog.tsx`, `column-chooser.tsx`, `views-menu.tsx`, `risk-detail-sheet.tsx`, `keyboard-shortcuts-dialog.tsx` (new, `next/dynamic`) | component | request-response | `owner-combobox.tsx` (X-2), 17's people picker, 19-06 `column-choice.tsx`, 16 history sheet (X-13) | role-match |
| `W/src/components/csrm/record-local-nav.tsx` (new, X-58) | component | — | none (see No Analog) | none |
| `W/src/features/assessments/assessment-schema.ts`, `assessment-service.ts`, `assessment-actions.ts` (mod) | service/schema | request-response | 16-PATTERNS "Web service, action, job panel"; 19-PATTERNS "Web export service + Server Action" | exact |
| `W/src/features/saved-views/*` (new schema/service/actions) | service | CRUD | 19.1-PATTERNS `notifications-service.ts` / `notifications-actions.ts` (access-service 1-37, request-actions 1-45) | exact |
| `W/app/(app)/app/review/assessments/[documentId]/layout.tsx` (new), `page.tsx` (mod Overview), `risks/page.tsx`, `risks/import/page.tsx` (new), with `loading.tsx`/`error.tsx` | route | request-response | current `page.tsx` (71 lines) and its `loading.tsx`/`error.tsx`; import page per 19-PATTERNS "Import flow (web)" | exact |
| Participant page and `released-assessment.tsx` (mod) | route/component | request-response | themselves [17, 19] | exact |
| Three review list pages (mod) | route | request-response | 11's list pages [13 assignee] | exact |
| `risk-detail-editor.tsx` (mod) | component | CRUD | itself; `risk-editor.tsx` | exact |
| Vitest: `risk-table-domain.test.ts`, `risk-table-clipboard.test.ts`, `risk-table-keyboard.test.tsx`, `risk-scale-parity.test.ts`, `risk-table-view.test.ts` | test | — | `data-table.test.tsx`; 19's converter parity test | exact |

### Playwright
| File | Role | Analog | Match |
|---|---|---|---|
| `W/e2e/risk-table.spec.ts` (new, desktop + mobile) | test | 19-PATTERNS `exports-and-imports.spec.ts`; 17-PATTERNS "Playwright mobile project" | exact |
| `W/e2e/risk-table-performance.spec.ts` (new, desktop) | test | `performance.spec.ts` (budgets 55, overrides 69-73, `median()` from `src/lib/testing/performance-metrics.ts`) | role-match |
| `performance.spec.ts`, `risk-owner-journey.spec.ts`, `assessment-release-workflow.spec.ts`, 12/16/17/17.1/17.2 specs (mod) | test | themselves | exact |

## Pattern Assignments (only what earlier maps do not give)

### DataTable grid mode — `W/src/components/csrm/data-table.tsx`
Features are module-level (lines 26-30); add a separate `riskGridFeatures = tableFeatures({...})` so lists do not pay (RESEARCH Answer 1):
```tsx
const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
});
```
Today's `useTable` is server-paged (224-236): `manualFiltering: true, manualSorting: true, manualPagination: true, rowCount: totalCount`. The grid mode drops these (client sort/filter through `risk-table-view.ts`), sets `autoResetCellSelection: false` and keeps `getRowId` stable (Pitfall 1). Density persistence (line 97, 243: `localStorage` keyed by user) is the model for per-browser column choice and last view (D-09, D-10), guarded by try/catch. Sticky first column (332, 348, 391-395) uses token classes only (`bg-surface`, `border-border`): copy that class pattern for pinned Risk number.

### `parseWritableRiskFields` — `B/.../assessment-workflow.ts` 561-585
One closed parser; every new rule (D-20 closed scale on the four likelihood/consequence fields, D-22 override reasons) is a further `else if` arm here, so single PATCH, create, bulk and import share it:
```ts
else if (["inherentRating", "residualRating"].includes(field) && value !== null && !isAssessmentRating(value)) invalid();
else if (field === "treatmentStatus" && !nullableEnum(value, TREATMENT_STATUSES)) invalid();
```
`RISK_WRITABLE_FIELDS` (26-32) and `RISK_DETAIL_FIELDS` (`assessment-scope.ts` 255-261) are twin lists: add both override reasons to both.

### Single-risk write — `B/.../risk-workflow.ts` `updateRisk` 192-225
The bulk core repeats this per row, inside one mutation: parse first, re-read authoritative row inside `withMutableAssessmentMutation`, check ancestor, then write. Bases compare against `authoritativeRisk` at the point marked:
```ts
const authoritativeRisk = await input.strapi.documents(RISK_UID).findOne({ documentId: input.riskDocumentId, populate: { assessment: true } });
if (!authoritativeRisk) throw new RiskWorkflowError(404, "CSRM Risk was not found.");
if (documentId(authoritativeRisk.assessment) !== assessmentDocumentId) throw new RiskWorkflowError(409, "CSRM Risk ancestor changed.");
// D-14: compare-and-set here, before resolveRelations
const data = await resolveRelations(input.strapi, parsed);
```
After 16-04 this body is `updateRiskWithinMutation`; the bulk core calls the inner functions **sequentially** (RESEARCH Answer 4; 17.1 Pitfall 10), never `Promise.all`. `MAX_ASSESSMENT_RISKS` (line 99) is the create bound; `loadAnalystAssessmentRiskDetails` (116-139) already populates controls for the D-27 summary.

### Analyst projection — `assessment-scope.ts` 264-273
```ts
export function projectAnalystRiskDetail(document: RecordValue): RecordValue {
  const result: RecordValue = { documentId: document.documentId, riskNumber: document.riskNumber };
  for (const field of RISK_DETAIL_FIELDS) { ... }
```
Add `controlImplementations: (document.controlImplementations ?? []).map(projectControlImplementationSummary)` (line 344, 17.2-PATTERNS) and the two reasons; the analyst detail gains the served scale.

### Analyst page's per-risk reads — `W/app/(app)/app/review/assessments/[documentId]/page.tsx` 11-59
Today: `listControls()` (38) and `listControlImplementations(risk.documentId)` per risk (49-53). D-27 removes both from the Risks route; the detail sheet loads one risk's implementations on open.

### Saved view entity — follow 19.1's `csrm-notification`
Schema, own-records repository and envelope per 19.1-PATTERNS lines 16, 96-114. Differences: 404 for another's personal view, 403 `NOT_VIEW_OWNER` on a shared view; unique (owner, viewKey, name) enforced in service (Strapi's `unique` is validator-level, RESEARCH Answer 4).

### JSON limit — `B/config/middlewares.ts` 22-31
```ts
name: 'strapi::body',
config: { formLimit: '6mb', formidable: { ... } },
```
Optional `jsonLimit: '1mb'` with a D-13 comment (RESEARCH Open Question 3).

### Performance — `W/e2e/performance.spec.ts` 55, 57-67, 69-73
Add `'/app/review/assessments/{documentId}/risks'` to `KeyRoute`; any override follows the 1.5 × median rule with a one-line reason.

## Shared Patterns
- **Policy chain, error responses, typed API layer, contract chain, record format:** 19-PATTERNS "Shared Patterns" (lines 294-310), unchanged.
- **Serialise + transaction + row lock** for bulk save and import commit: 17.2-PATTERNS (`assessment-workflow.ts` 381-405, 430-460); guard order: 17-PATTERNS (`assertMutableAssessment` 128, `withMutableAssessmentMutation` 430) as 16-04/17.1 extend it.
- **History rows** with `sourceKind` and `batchId`: 16-PATTERNS "History writer and envelope".
- **Human-only operations and grants:** 16-PATTERNS "Routes, grants…", 17.1-PATTERNS "Human-only operations".
- **Status labels:** one mapping, 17.2-PATTERNS "Status mapping family" (`status-badge.tsx` 65-82, 116-125).
- **Web mirrors parity-tested:** 19 D-29 converter parity; Phase 18 adds scale derivation and filter-and-sort parity.
- **Tokens only:** DataTable's class usage; no hex or `hsl(` in `features/risk-table/` (RESEARCH Answer 1, criterion 4).

## No Analog Found
| File | Role | Reason |
|---|---|---|
| `W/src/features/risk-table/risk-table-domain.ts` keymap, range and undo stack | utility | No grid or undo stack exists; use TanStack 9.2.4 `cellSelectionFeature` (RESEARCH Answer 1) |
| Clipboard formats (TSV + Office HTML with `x:num`) | utility | None; RESEARCH Answer 5 |
| `matrix-picker.tsx` (5 × 5 radio grid) | component | None; UI-SPEC §4.1 |
| `record-local-nav.tsx` (X-58) | component | No local navigation in the shell; UI-SPEC §1.1 |
| `risk-table-performance.spec.ts` Event Timing / LoAF harness | test | `performance.spec.ts` measures load only; RESEARCH Answer 2 |
| `compare-and-set.ts` | utility | No optimistic concurrency exists (last write wins today) |

## Metadata
**Analog search scope:** `B/src/api/{csrm-assessment,csrm-risk}`, `B/config`, `W/src/components/csrm`, `W/app/(app)/app/review/assessments`, `W/e2e`, earlier phases' PATTERNS and PLANs (plan IDs by grep of `*-PLAN.md`).
**Files scanned:** 14 source files, 6 PATTERNS maps, plan index of phases 10 to 19.1.
**Pattern extraction date:** 2026-10-01
