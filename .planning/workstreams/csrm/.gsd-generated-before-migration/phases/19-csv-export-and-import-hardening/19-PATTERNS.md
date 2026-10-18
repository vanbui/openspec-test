# Phase 19: CSV export and import hardening - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 46 (new and modified, grouped by family)
**Analogs found:** 41 / 46
**Basis:** today's code plus the planned outputs of Phases 10 and 11 (plans), Phase 12 (`12-PATTERNS.md`, plans in progress), Phase 13 and 16 (CONTEXT; 16 RESEARCH). Phases 14 and 15 have no artifacts yet. Every analog path below is git-tracked source.

## Earlier-phase ownership (build on the planned state)

Files Phase 19 edits that an earlier phase changes first. The Phase 19 planner reads the named plan's `files_modified` and must_haves before writing against the file; Stage 3 re-checks.

| File | Changed earlier by | What it will contain when Phase 19 starts |
|---|---|---|
| `apps/backend/src/csrm/conflict-reasons.ts` (+ web mirror `apps/csrm/src/lib/api/conflict-reasons.ts`) | **10-06** (creates), 10-07, **12-02**, Phase 16 (CONTEXT/RESEARCH: new reasons) | `CONFLICT_REASONS` frozen list, `type ConflictReason`, web `isConflictReason`. Phase 19 appends export-cap, not-released and import-file reasons (D-03 item 4). |
| `apps/csrm/src/lib/api/refusal-copy.ts` | **10-07** (creates), Phase 12, Phase 16 | reason → fix-it copy map; Phase 19 adds import and export refusals. |
| `apps/csrm/src/lib/time/viewer-time-zone.ts`, `format-instant.ts` (`isValidTimeZone`) | **10-01** (creates) | `csrm-time-zone` cookie reader; Phase 19's export Actions read it (D-07). |
| `apps/backend/src/policies/csrm-authorization.ts` | **10-13**, Phase 12 (12-PATTERNS), Phase 13 (assignee grants), Phase 16 | new human-analyst-only operations added to `HUMAN_ANALYST_ONLY_OPERATIONS`; Phase 19 adds `underlyingRead` config, `EXPORT_OPERATIONS`, the agent-role refusal. |
| `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts` | **10-15**, **10-18**, **11-07**, Phase 12, **Phase 16** (active-risk filter, S-8) | richer projections (`requestTitle`, `riskCount`, `highestResidualRating`), withdrawn risks excluded. Phase 19 gathers the released predicate here (D-14). |
| `apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts` | **10-15**, **11-07**, Phase 12, Phase 16 | `releasedForOwner` still at the three call sites (detail, risks, control implementations) unless Phase 16 moved them. |
| `apps/backend/src/api/csrm-risk/services/risk-register.ts`, `risk-register-query.ts` | **10-15**, **11-04**, **11-07**, **11-14** (stage + treatmentAction filters/fields), Phase 16 (withdrawn excluded) | repository `count/selectPage/hydrate`, projection with stage and accepted markers. Export iterates it unchanged. |
| `apps/backend/src/api/csrm-risk/routes/csrm-risk.ts` | Phase 16 (CONTEXT: withdraw/rewrite routes) | export route must be registered before `/v1/risks/:riskId` (Pitfall 1). |
| `apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts`, `review-queue-repository.ts` | **11-06**, **11-10**, **Phase 13** (assignee column, "Assigned to me", `assignee`/`notes` filters) | queue export vocabulary includes assignee; never a note (13-CONTEXT line 460-462). |
| `apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts` | 10-09, 10-10, 10-11, **11-10**, Phase 12 | — |
| `services/my-requests.ts` (request API) | **11-10** (creates, serves `GET /v1/my_requests`) | holder/stage/next-action projection; becomes its own export columns (D-06). |
| `apps/backend/src/api/csrm-administration/services/csv-import.ts` | **10-17** | label/copy changes only; parser and `sanitizeSpreadsheetCell` unchanged. |
| `apps/backend/src/api/csrm-administration/services/administration-query.ts` | **10-16** (owner display name) | `normalizeAdministrationNaturalKey` unchanged. |
| `apps/csrm/src/features/administration/csv-import-flow.tsx`, `csv-client-parser.ts`, `administration-actions.ts` | **10-17** (+10-02 for actions) | copy changes; client parser still present (Phase 19 retires it). |
| `apps/csrm/src/components/csrm/status-badge.tsx` | **11-01** ("Released" label), Phase 12, Phase 16 (withdrawn) | the one status mapping the label-parity test compares with Strapi `labels.ts`. |
| `apps/csrm/src/features/requests/request-domain.ts` | 10-04, 10-12, **11-01**, 11-08 to 11-12 | request status labels. |
| `apps/csrm/src/features/risks/risk-domain.ts` | **11-14** | stage/accepted/due-state labels. |
| `apps/csrm/app/(app)/app/assessments/[documentId]/page.tsx` | 10-02, **10-15**, **10-18**, 10-19 | released loader to factor out for the report route. |
| `apps/csrm/src/features/assessments/released-assessment.tsx` | 10-02, **10-15**, 11-04, **11-07**, Phase 12 (AI disclosure, D-23), Phase 16 | header action slot receives Export + Print report. |
| `apps/csrm/src/components/shell/app-shell.tsx` (`PageHeader`) | 10-01, 10-08, **11-05**, 11-13 | action slot; `data-print="hidden"`. |
| `apps/csrm/app/globals.css` (`@media print`) | **11-05**, 11-13 | print block at ~line 920; report adds `@page { size: A4 }`. |
| Every list page under `apps/csrm/app/(app)/app/` (review/requests, review/questionnaires, review/assessments, risks, alerts, reports/[reportKey], admin/[collection], My lists) | Phase 11 plans 11-03 to 11-14 (filters, columns, headers), Phase 13 (queue) | each header gains the Export action. |
| `docs/references/specification.json`, `apps/csrm/src/lib/api/generated/schema.d.ts` | 10-06…10-18, 11-06…11-14, **12-01**, **12-02**, Phase 13, Phase 16 | many new ops; Phase 19 adds binary responses. |
| both catalogue copies, `docs/references/served-operations.json` | 10-06, **10-13**, 10-23, **11-10…11-13**, **12-01/12-02**, Phase 13, Phase 16 | — |
| `apps/backend/tests/fixtures/authorization-matrix.ts` | **10-13**, **11-10**, Phase 12, 13, 16 | six-actor rows per op. |
| `apps/csrm/src/features/contract-response-parity.test.ts`, `contract-operation-chain.test.ts` | nearly every API plan of 10 and 11, Phase 12, 13, 16 | Phase 19 adds a `file-response` mode. |
| `docs/design/csrm-design-direction.md` | **10-01** (X-1…X-5), 10-21, 10-22, **11-01** (X-6…X-10), 11-05, 11-09, **12-01/12-02** (X-11…X-14), Phase 13, 16 | Phase 19 extensions follow the last X-n used by 13–16. |
| `apps/csrm/e2e/administration-workflow.spec.ts` | 10-16, **10-17**, 10-19, 10-22, 11-03, 11-05 | deliberate changes named in its plan (D-39). |
| `apps/csrm/src/features/administration/administration-service.ts` | (none found) | — |

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `docs/contract-gaps/phase-19-exports-and-export-log.md` (new) | doc/contract | — | `docs/contract-gaps/phase-07-derived-insights.md`, `phase-06.8-questionnaire-governance-facts.md` | exact |
| `docs/contract-gaps/phase-19-import-tolerance.md` (new) | doc/contract | — | `docs/contract-gaps/phase-06-administration-import-contract.md` | exact |
| `apps/backend/src/csrm/spreadsheets/neutralise.ts` (new) | utility | transform | `csv-import.ts:295-299` (moved) | exact (move) |
| `apps/backend/src/csrm/spreadsheets/csv-writer.ts` (new) | utility | file-I/O | `csv-client-parser.ts` `csvDocument` + RESEARCH Ex. 2 | role-match |
| `apps/backend/src/csrm/spreadsheets/xlsx-writer.ts` (new) | utility (dep wrapper) | file-I/O | none (RESEARCH Ex. 1) | no analog |
| `apps/backend/src/csrm/spreadsheets/xlsx-reader.ts` (new) | utility (dep wrapper) | file-I/O | none (RESEARCH Ex. 7) | no analog |
| `apps/backend/src/csrm/spreadsheets/zip-guard.ts` (new) | utility | file-I/O | `csv-import.ts:98-127` (`assertBytesAndPreflightRecords`) | partial |
| `apps/backend/src/csrm/spreadsheets/file-sniff.ts` (new) | utility | transform | `csv-import.ts:129-135` (`decodeUtf8`) | partial |
| `apps/backend/src/csrm/spreadsheets/header-match.ts` (new) | utility | transform | `csv-import.ts:137-157` (`parseHeaders`) | exact (extract) |
| `apps/backend/src/csrm/spreadsheets/value-convert.ts` (new) | utility | transform | `csv-import.ts:163-190` (`parseCell`) | exact (extract) |
| `apps/backend/src/csrm/spreadsheets/file-response.ts` (new) | utility | request-response | `csrm-risk.ts` controller `safeError` (41-46) + RESEARCH Ex. 3 | partial |
| `apps/backend/src/csrm/exports/export-cap.ts`, `export-views.ts`, `columns/<view>.ts`, `run-export.ts` (new) | service | batch | `csrm-assessment.ts:145-161` (`statusSummary` paged loop) + `risk-register.ts` repository | role-match |
| `apps/backend/src/csrm/exports/labels.ts` (new) | config | transform | `apps/backend/src/api/csrm-analyst-insight/services/report-definitions.ts` (server copy parity-tested with `report-copy.json`) | exact |
| `apps/backend/src/csrm/audit/security-event-log.ts` (new) | utility | event-driven (log) | `apps/backend/src/csrm/openai-compatible-client.ts:26-28` | exact |
| `apps/backend/src/policies/csrm-authorization.ts` (mod) | middleware/policy | request-response | itself: `requireAnalystInsightScope` 334-344 + `HUMAN_ANALYST_ONLY_OPERATIONS` 41-62 | exact |
| `apps/backend/src/api/*/operations.ts` (mod; export constants) | config | — | `apps/backend/src/api/csrm-risk/operations.ts` | exact |
| list route files (`csrm-risk`, `csrm-assessment-request`, `csrm-questionnaire`, `csrm-assessment`, `csrm-analyst-insight`, `csrm-administration`, info-system/asset routes) (mod) | route | request-response | `apps/backend/src/api/csrm-risk/routes/csrm-risk.ts:11-41` | exact |
| list controllers (same APIs) (mod; export handlers) | controller | request-response → file | `apps/backend/src/api/csrm-risk/controllers/csrm-risk.ts:98-125` | exact |
| list query parsers (`risk-register-query.ts`, `buildAssessmentCollectionQuery`, queue, questionnaire, alert, report, administration) (mod: `parse<List>ExportQuery`) | utility | transform | the parsers themselves | exact |
| `assessment-scope.ts` + `csrm-assessment.ts` (mod: one released predicate) | service | CRUD read | `assessment-scope.ts:159-189`, controller 100-106 | exact |
| `administration-workflow.ts` (mod: XLSX upload, similar decisions, result record, issue codes) | service | file-I/O + CRUD | itself: `readCsvUpload` 133-150, `PreviewRecord` 199-210 | exact |
| `csv-import.ts` (mod: uses spreadsheet modules, `similar` state) | service | transform | itself 14-15, 198-255 | exact |
| `apps/backend/package.json` (mod: `write-excel-file@4.1.1`, `read-excel-file@9.3.10`, exact pins) | config | — | existing `"csv-parse": "7.0.2"` pin | exact |
| `apps/backend/tests/spreadsheet-*.unit.test.ts`, `security-event-log.unit.test.ts` (new) | test | — | `apps/backend/tests/administration.unit.test.ts` | role-match |
| `apps/backend/tests/exports.integration.test.ts` + `tests/helpers/` read-back (new) | test | — | `apps/backend/tests/analyst-reports.integration.test.ts`, `administration.integration.test.ts` | role-match |
| `authorization-matrix.ts`, `contract-catalogue`, `served-operations` tests (mod) | test | — | themselves | exact |
| `apps/csrm/src/lib/files/save-file.ts` (new) | utility (client) | file-I/O | `csv-client-parser.ts:228-236` (`downloadAdministrationCsv`) | exact (move) |
| `apps/csrm/src/lib/files/file-response.ts` (new) | utility (server) | request-response | `administration-service.ts` `request(...)` wrapper + `server-client.ts` | role-match |
| `apps/csrm/src/features/*/*-service.ts` (mod: one export fn per view) | service | request-response (binary) | `administration-service.ts:119-145` (multipart POST per kind) | exact |
| `apps/csrm/src/features/*/*-actions.ts` (mod: one export Action per view) | controller (Server Action) | request-response | `administration-actions.ts:53-94` | exact |
| `apps/csrm/src/components/csrm/export/export-dialog.tsx`, `export-button.tsx` (new) | component (client) | request-response | `apps/csrm/src/features/administration/csv-import-flow.tsx` (dialog-free stepper with downloads) | role-match |
| `apps/csrm/app/(app)/app/assessments/[documentId]/report/page.tsx`, `app/(app)/app/review/assessments/[documentId]/report/page.tsx` (new) | route (Server Component) | CRUD read | `apps/csrm/app/(app)/app/assessments/[documentId]/page.tsx` | exact |
| `apps/csrm/src/features/assessments/released-report.tsx` (new) + print CSS in `globals.css` | component | transform | `released-assessment.tsx` + `globals.css:920-935` | role-match |
| `apps/csrm/src/features/administration/csv-import-flow.tsx`, `csv-import-schema.ts`, `administration-actions.ts`, `administration-service.ts` (mod) | component/service | file-I/O | themselves | exact |
| `apps/csrm/src/features/administration/csv-client-parser.ts` (retire parsing) | utility | — | — | delete/shrink |
| `apps/csrm/src/features/export-label-parity.test.ts` (new) | test | — | `apps/csrm/src/features/reports/report-schema.test.ts` (report-copy parity) | exact |
| `apps/csrm/src/components/csrm/export/*.test.tsx`, `src/lib/files/*.test.ts` (new) | test | — | `apps/csrm/src/features/administration/administration-workflow.test.tsx` | role-match |
| `apps/csrm/e2e/exports-and-imports.spec.ts` (new) | test (E2E) | — | `apps/csrm/e2e/administration-workflow.spec.ts:339-353` (download), `design-system-conformance.spec.ts:374-401` (print) | exact |

## Pattern Assignments

### Shared spreadsheet modules (`apps/backend/src/csrm/spreadsheets/*`)

**Analog:** `apps/backend/src/api/csrm-administration/services/csv-import.ts` (299 lines; Phase 10-17 touches copy only).

**Bounds constants to keep (lines 8-12):**
```ts
export const CSV_MAX_BYTES = 5_242_880;
export const CSV_MAX_ROWS = 5_000;
export const CSV_MAX_RECORD_BYTES = 65_536;
export const CSV_MAX_ISSUES_PER_ROW = 20;
export const CSV_MAX_CHANGES_PER_ROW = 16;
```

**Neutraliser to move into `neutralise.ts` (lines 295-299), then add the quote-run trigger and its exact inverse (RESEARCH Pitfall 9):**
```ts
const FORMULA_INITIATORS = /^(?:[=+\-@\t\r\n＝＋－＠]|\s+[=+\-@＝＋－＠])/u;
export function sanitizeSpreadsheetCell(value: string): string {
  return FORMULA_INITIATORS.test(value) ? `'${value}` : value;
}
```

**Strict decoding (lines 129-135), basis for `file-sniff.ts`:** `new TextDecoder("utf-8", { fatal: true })` in try/catch; replace `csvError(...)` with a closed refusal reason (`IMPORT_ENCODING_WINDOWS_1252`, etc.).

**Header matcher to extract (lines 137-157):** `normalizedHeader` = `trim().normalize("NFKC").toLocaleLowerCase("en-AU")`; `byName` map; duplicate and missing-required refusals. Change: key also strips `[\s_-]`, matches display label, and `if (!column) csvError("…unsupported header.")` (line 150) becomes a warning naming the header.

**Value converter to extract (lines 163-190):** `parseCell(column, raw, issues)` with `REQUIRED_VALUE`, `VALUE_TOO_LONG`, `INVALID_BOOLEAN`, `INVALID_ENUM` issue codes via `issue()` (159-161). Extend booleans to yes/no/y/n, add `#CLEAR`, mark stripping, example-row skip.

**csv-parse options to keep (lines 273-282):** `bom: true, columns: false, max_record_size, relax_column_count: false, relax_quotes: false, skip_empty_lines: false, trim: false`.

**Error style:** module-local `csvError(message): never` throwing `Error` (94-96). New modules throw a typed error carrying a closed reason code instead (the Phase 10 `CONFLICT_REASONS` style).

`xlsx-writer.ts`, `xlsx-reader.ts`, `zip-guard.ts`: no repo analog; use RESEARCH Code Examples 1, 6, 7 verbatim as the starting shape.

---

### Classification and `similar` tier (`csv-import.ts`, mod)

**Row states (lines 14-15)** gain `"similar"`:
```ts
export const csvRowStates = ["create", "update", "unchanged", "rejected", "ambiguous"] as const;
```
**Existing-key index (lines 204-210)** uses `normalizeAdministrationNaturalKey` (`administration-query.ts:217-219`, trim+NFKC+lower). Build two indexes (exact NFC, similar NFKC+lower+collapsed whitespace); keep the broad normaliser for uniqueness (`assertNaturalKeyAvailable`).
**Return shape (lines 226-254):** every branch returns the full `CsvImportRow` literal; the `similar` branch carries `matchedDocumentId`, `matchedUpdatedAt` and the existing name.

---

### `administration-workflow.ts` (mod)

**Upload check to widen (lines 133-150):**
```ts
const fileName = basename(upload.originalFilename).slice(0, 255);
const mime = typeof upload.mimetype === "string" ? upload.mimetype.toLocaleLowerCase("en-AU") : "";
if (!fileName.toLocaleLowerCase("en-AU").endsWith(".csv")
  || (mime !== "" && mime !== "text/csv" && mime !== "application/vnd.ms-excel")) {
  importError(415, "UNSUPPORTED_IMPORT_MEDIA", "Select a CSV file to import.");
}
```
→ extension allow-list `{.csv,.xlsx}`, MIME advisory, signature authoritative (Pitfall 14).

**Preview record to extend (lines 199-210):**
```ts
type PreviewRecord = {
  actorDocumentId: string; kind: AdministrationKind; fileDigest: string; expiresAt: number;
  rows: readonly { state: CsvRowState; matchedDocumentId: string | null; matchedUpdatedAt: string | null }[];
};
const PREVIEW_TTL_MS = 5 * 60 * 1_000;
const MAX_PREVIEW_RECORDS = 256;
const MAX_PREVIEWS_PER_ACTOR_AND_KIND = 16;
```
Add compact issue codes per row; copy this exact TTL/cap/actor-binding shape for the new Results-step result record (D-32).

---

### Export pipeline (`apps/backend/src/csrm/exports/*`)

**Repository analog:** `apps/backend/src/api/csrm-risk/services/risk-register.ts:50-55` (`count`, `selectPage`, `hydrate`, `selectedLabels`) — call `count`, refuse over `EXPORT_ROW_CAP`, `selectPage({ offset: 0, limit: cap + 1 })` (Pitfall 8), `hydrate` in batches, project with `projectRiskRegisterItem(document, today)` (due state via `deriveTreatmentDueState`; never recompute, G-16).

**Paged loop analog for document-service lists** (`csrm-assessment.ts:145-161`):
```ts
const pageSize = 1_000;
for (let start = 0;; start += pageSize) {
  const page = await documents().findMany({ populate: { generatedBy: true }, start, limit: pageSize });
  output.push(...page);
  if (page.length < pageSize) break;
}
```
Combine with `buildAssessmentCollectionQuery(ctx.query, ctx.state, scope)` (`assessment-scope.ts:102`), whose `dataQuery`/`countQuery` the list already uses (controller 108-120).

**Labels (`labels.ts`):** follow `apps/backend/src/api/csrm-analyst-insight/services/report-definitions.ts` — server-held display copy, proven equal to web copy by a web test (`apps/csrm/src/features/reports/report-schema.test.ts` against `report-copy.json`).

---

### Export routes and controllers (each list API, mod)

**Route analog:** `apps/backend/src/api/csrm-risk/routes/csrm-risk.ts:11-41`:
```ts
const riskRegisterPolicies = (operation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation, requireAnalystRiskRegisterScope: true } },
];
...
{ method: "GET", path: "/v1/risks", handler: "api::csrm-risk.csrm-risk.listRiskRegister",
  config: { auth: { strategies: ["content-api-token"] }, policies: riskRegisterPolicies(CSRM_RISK_OPERATIONS.listRegister) } },
{ method: "GET", path: "/v1/risks/:riskId", ... }
```
Insert `GET /v1/risks/export` **between** these two entries (Pitfall 1); keep the list's scope flag and add `underlyingRead: CSRM_RISK_OPERATIONS.listRegister`. The operation constant equals the catalogue URL `GET:/api/v1/risks/export?format={format}` (Pitfall 2). Administration routes use `policies()` with `requireAnalystAdministrationScope: true` (`csrm-administration/routes/csrm-administration.ts:7-10`); template and error-report routes go before `/:riskTypeId` etc.

**Controller analog:** `apps/backend/src/api/csrm-risk/controllers/csrm-risk.ts`:
- `safeError(ctx, status, message)` (41-46) and `handleError` mapping typed errors to 400/403/404/409 (98-108);
- the handler shape (113-125): `try { return await listRiskRegister({ repository: createStrapiRiskRegisterRepository(strapi), state: ctx.state, query: ctx.query, today: utcToday(new Date()) }) } catch (error) { return handleError(ctx, error); }`. The export handler mirrors it, then calls `sendFile(ctx, …)` (RESEARCH Ex. 3) instead of returning JSON.
- Identity: `analystDocumentId(ctx)` (53-57) reads `ctx.state.idamboxUser.documentId` — the actor for the event log.

---

### `csrm-authorization.ts` (mod)

**Human-only set (lines 41-49)** — add each analyst export. **Underlying reads (57-62)** and the check to generalise (334-344):
```ts
if (config.requireAnalystInsightScope) {
  const requiredOperations = [config.operation, ...ANALYST_INSIGHT_UNDERLYING_READS];
  if (!requiredOperations.every((required) => hasHumanAnalystOperation(grants.explicitRoles, required))) {
    return deny(policyContext, "CSRM analyst insight access is denied.");
  }
```
**Config type (70-92):** add `underlyingRead?: string`. **Role names (9-14):** `SECURITY_ANALYST_ROLE_NAMES` includes `"Security Analyst Agent"` — the new export-wide agent refusal tests for that role name on the resolved user (covers own-record exports, Pitfall 7). Analyst scope flags set as in 323-332.

---

### Released predicate (`assessment-scope.ts` + controller, mod)

**Analog:** `assessment-scope.ts:159-189` (`releasedAssessmentQuery`, `releasedAssessmentDetailQuery`, `isReleasedAssessmentForOwner`) and the controller (100-106):
```ts
async function releasedForOwner(ctx: RecordValue, documentId: string): Promise<RecordValue | null> {
  assertRequestorAssessmentScope(ctx.state);
  const ownerDocumentId = identityDocumentId(ctx);
  if (!ownerDocumentId) throw new AssessmentScopeError(403);
  const document = await documents().findOne(releasedAssessmentDetailQuery(ownerDocumentId, documentId));
  return isReleasedAssessmentForOwner(document, ownerDocumentId) ? document : null;
}
```
Lift into one exported function in `assessment-scope.ts` (or a sibling module); call sites at controller 168, 259, 283, plus the new export. Analyst branch (171-173) reads `ASSESSMENT_DETAIL_QUERY`; export refuses unreleased with a 409 reason (D-15). Re-read after Phase 16 (withdrawn-risk filter) and before Phase 17/17.1 widen it.

---

### Security event log (`apps/backend/src/csrm/audit/security-event-log.ts`, new)

**Analog:** `apps/backend/src/csrm/openai-compatible-client.ts:26-28`:
```ts
export function logCompletionDiagnostic(config: CsrmAiOperationConfig, payload: Record<string, unknown>) {
  if (config.completionTranscriptDiagnostics) globalThis.strapi.log.info(JSON.stringify(payload));
}
```
Make the sink injectable (default `globalThis.strapi.log.info`); one function per event (`csrm.export`, `csrm.import.commit`); G-17 reuses it.

---

### Web export service + Server Action (each feature, mod)

**Service analog:** `apps/csrm/src/features/administration/administration-service.ts` — `import 'server-only'` (1), `createStrapiClient`/`normalizeTransportError`/`TransportResult` from `../../lib/api/transport/server-client` (3-8), a `request((client) => client.POST('/v1/…', {...}), parse)` per kind (129-145), `multipartBodySerializer` (50). The export function uses `client.GET('/v1/risks/export', { params: { query }, parseAs: 'arrayBuffer' })`, then `lib/files/file-response.ts` validates type, name, size, signature.

**Action analog:** `administration-actions.ts:53-94`: `'use server'`, validate input (zod), call the service, map `result.error.status` to copy, return a discriminated `{ ok: true, data } | { ok: false, formError }`. Export Actions return `{ ok: true, fileName, contentType, bytes: Uint8Array, rowCount }` or a closed refusal mapped through Phase 10's `refusal-copy.ts`; no `revalidatePath`, no `cookies().set` (read the zone only).

**Client save helper analog (`csv-client-parser.ts:228-236`):**
```ts
export function downloadAdministrationCsv(contents: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizedCsvFileName(fileName);
  anchor.rel = 'noopener';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
```
Generalise to `saveFile({ fileName, contentType, bytes })` in `apps/csrm/src/lib/files/save-file.ts`; Phase 14's attachment downloads reuse it (orchestrator confirmation).

---

### Import flow (web, mod)

`csv-import-flow.tsx` (five steps, download buttons), `csv-import-schema.ts` (closed preview/result parsers — add `similar`, warnings, file refusals), `administration-actions.ts:53-94` (preview/commit; commit form gains `decisions`; replace generic "could not be validated" with refusal copy). Client parsing in `csv-client-parser.ts` retires; keep only extension/type/5 MiB checks.

---

### Report routes (new)

**Analog:** `apps/csrm/app/(app)/app/assessments/[documentId]/page.tsx` (planned state after 10-15/10-18/10-19) — factor its loader into a shared function; both report pages call it and `notFound()` on refusal. Print rules build on `apps/csrm/app/globals.css:920-935`:
```css
@media print {
  .skip-link, .sidebar, .header, .shell-footer, .mobile-trigger, ...
  [data-print="hidden"], form[role="search"] { display: none !important; }
```

---

### E2E (`apps/csrm/e2e/exports-and-imports.spec.ts`, new)

**Download analog** (`administration-workflow.spec.ts:339-341`):
```ts
const errorDownload = page.waitForEvent('download');
await page.getByRole('button', { name: 'Download error report CSV' }).click();
expect((await errorDownload).suggestedFilename()).toBe('risk-types-errors.csv');
```
**Print analog** (`design-system-conformance.spec.ts:374-401`): `page.emulateMedia({ media: 'print' })`, loop widths, reset with `{ media: null }`; add `page.pdf({ format: 'A4', preferCSSPageSize: true })`.

## Shared Patterns

### Policy chain (every new Strapi route)
**Source:** `csrm-risk/routes/csrm-risk.ts:6-17`; `csrm-authorization.ts:41-62, 323-344`.
Every route: `"global::csrm-app-enabled"` + `global::csrm-authorization` with `operation` (exact catalogue URL incl. query) and the list's scope flag; `auth.strategies: ["content-api-token"]`.

### Error responses
**Source:** `csrm-risk/controllers/csrm-risk.ts:41-46, 98-108`. Typed errors → `safeError`; reasons via Phase 10 `CONFLICT_REASONS` in `details`.

### Typed API layer
**Source:** `administration-service.ts:1-8`. `server-only`, `createStrapiClient`, `TransportResult`; never raw `fetch`, never a Route Handler.

### Contract chain
Spec op → `api:generate` → closed parser or file-response validator registered in `contract-response-parity.test.ts` and `contract-operation-chain.test.ts` → matrix row → both catalogue copies → `served-operations.json`. Follow the most recent chain plan, `.planning/phases/11-*/11-10-PLAN.md` (`GET /v1/my_requests`), for task order.

### Contract-gap record format
**Source:** `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md` (`## Gap`, `## Approved Compatibility Extension`, …) and `phase-07-derived-insights.md` (numbered items 4-6 that this phase closes).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `spreadsheets/xlsx-writer.ts` | dep wrapper | file-I/O | no XLSX in repo; use RESEARCH Ex. 1 |
| `spreadsheets/xlsx-reader.ts` | dep wrapper | file-I/O | use RESEARCH Ex. 7 (`read-excel-file/universal`, `trim: false`) |
| `spreadsheets/zip-guard.ts` | utility | file-I/O | use RESEARCH Ex. 6 (APPNOTE offsets + `zlib.inflateRawSync` `maxOutputLength`) |
| Binary responses in `specification.json` | contract | — | spec has only `application/json` today (Pitfall 6) |
| `components/csrm/export/export-dialog.tsx` | client component | — | no existing export dialog; compose shadcn Dialog/Sheet + checklist per the UI-SPEC |

## Metadata

**Analog search scope:** `apps/backend/src/{api,policies,csrm}`, `apps/csrm/{app,src/features,src/components,e2e}`, `docs/contract-gaps`, `.planning/phases/10-16`.
**Files scanned:** ~40.
**Pattern extraction date:** 2026-10-01.
