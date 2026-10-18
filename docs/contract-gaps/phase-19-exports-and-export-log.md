# Phase 19: Exports and the Export Log

## Gap

A person cannot take a list they can see out of CSRM as a file (UAT-049). Decision 12 (`.planning/workstreams/csrm/NEXT-WAVE-DECISIONS.md`) asks for CSV (UTF-8 with a BOM) and XLSX in the viewer's authorised scope, Requestors exporting their own released assessments, formula-like values neutralised, every export recorded in the server log with the actor, the view, the filters and the row count, and a print-ready A4 report of a released assessment. CSV-01 delivers it.

The published contract holds almost none of it:

- The role-function catalogue reserves only two exports: `GET:/api/v1/risks/export?format={format}` (`function.risk_register.risk_register.api.04`) and `POST /api/v1/reports/{reportKey}/export` (`function.reports.reports.api.03`). Both are unserved: items 4 and 5 of `phase-07-derived-insights.md` defer the report export "beyond this milestone" and list it among the catalogued operations left unserved. Both sit in menu Functions that the Security Analyst Agent holds.
- No other list (requests, questionnaires, alerts, risk assessments, the three My lists, the four reference lists) and no released assessment has an export operation.
- `docs/references/specification.json` declares no binary response today: every 200 is `application/json`, and the contract guards (`contract-response-parity.test.ts`, `contract-catalogue.integration.test.ts`) read only that key.
- The datamodel has no export or audit entity, and Phase 19 changes no content type (D-01), so the record of an export cannot be a persisted entity.

This record fixes every operation, parameter, grant, refusal, bound, file rule and log event Phase 19 publishes for exports. The import changes are in `phase-19-import-tolerance.md`, which amends `phase-06-administration-import-contract.md`.

## Compatibility Extension

- **No content type changes.** No file under `apps/backend/src/api/*/content-types/` changes, no attribute, relation or enumeration value is added, and no migration accompanies the phase.
- **Operations are added, and the two reserved ones are served at their catalogued URLs.** `GET /api/v1/risks/export` and `POST /api/v1/reports/{reportKey}/export` keep the catalogue's names, URLs and descriptions; their FunctionApis move into human-only API Functions ("Functions, Grants and the Service Identity"). No existing request or response changes, except the additive closed reasons and details listed under "Closed Reasons".
- **Phase 14's shared pieces are reused, not rebuilt:** the security event log (`csrm/audit/security-event-log.ts`), the ZIP reader (`csrm/files/zip-archive.ts`), the XLSX reader (`csrm/spreadsheets/xlsx-reader.ts`, on the installed `read-excel-file@9.3.10`), the stored-file sender (`csrm/files/send-stored-file.ts`) and the web's file-response validator and save helper (`lib/files/file-response.ts`, `lib/files/save-file.ts`).
- **One new dependency, in Strapi only (D-12):** `write-excel-file@4.1.1` in `apps/backend`, justified in plan 19-03 against D-12's pass-or-fail criteria and wrapped behind the module's own XLSX writer. Nothing reaches the web bundle, and the web never builds, parses or alters a file (D-19).

## Export Operations and Parameters

Phase 19 serves 14 export operations (D-03 groups 1 and 2): 13 list exports (the 12 list views below and the report export) and the released-assessment export. With the eight import-support operations of `phase-19-import-tolerance.md` that is 22 new operations (D-41).

**An export is its list, whole (D-05).** Each export takes exactly its list's query parameters without `page` and `pageSize`, parses them with the list's own closed parser, resolves the list's own scope and reads through the list's own repository, in the list's own order. The file holds every row the list would show across all its pages. A filter, search or sort the list refuses, the export refuses (400). A list a later phase changes (Phase 13's assignee column and `Assigned to me` view, Phase 16's Withdrawn filter, Phase 17's participant lists, Phase 20's type filter and saved views) exports the change with no export work.

### List exports (D-03 group 1)

`GET`, each registered before any parametrised sibling in its router, so `/export` never reaches a `/:id` route (19-RESEARCH Pitfall 1). Query:

- the list's own query parameters without `page` and `pageSize`, parsed by the list's own closed parser;
- `format`: `csv` | `xlsx`, required;
- `columns`: optional; comma-separated column keys of the view's closed vocabulary, 1 to 40 unique keys, each matching `^[a-zA-Z][a-zA-Z0-9]{0,63}$`; absent means the view's visible columns; written in the view's canonical order whatever order is named (D-06);
- `timeZone`: optional IANA zone of at most 64 characters.

| List | Path | View key | Underlying read |
| --- | --- | --- | --- |
| Risk register | `/api/v1/risks/export` (catalogue URL `GET:/api/v1/risks/export?format={format}`, reserved, unchanged) | `risk-register` | `GET:/api/v1/risks` |
| Requests | `/api/v1/assessment_requests/export` | `requests` | `GET:/api/v1/assessment_requests` (Phase 13's `Assigned to me` view uses it with its assignee filter) |
| Questionnaires | `/api/v1/questionnaires/export` | `questionnaires` | `GET:/api/v1/questionnaires` |
| Alerts | `/api/v1/alerts/export` | `alerts` | `GET:/api/v1/alerts` (plus Phase 7's insight underlying reads, as the alert list requires) |
| Risk assessments | `/api/v1/risk_assessments/export` | `risk-assessments` | `GET:/api/v1/risk_assessments` |
| My requests | `/api/v1/my_requests/export` | `my-requests` | `GET:/api/v1/my_requests` |
| My questionnaires | `/api/v1/my_questionnaires/export` | `my-questionnaires` | `GET:/api/v1/my_questionnaires` |
| My risk assessments | `/api/v1/my_risk_assessments/export` | `my-risk-assessments` | `GET:/api/v1/my_risk_assessments` |
| Risk Types | `/api/v1/risk_types/export` | `risk-types` | `CSRM_ADMINISTRATION_OPERATIONS.listRiskTypes` |
| Controls | `/api/v1/controls/export` | `controls` | `CSRM_ADMINISTRATION_OPERATIONS.listControls` |
| Information Systems | `/api/v1/information_systems/export` | `information-systems` | `CSRM_ADMINISTRATION_OPERATIONS.listInformationSystems` |
| Information Assets | `/api/v1/information_assets/export` | `information-assets` | `CSRM_ADMINISTRATION_OPERATIONS.listInformationAssets` |

The catalogue URL of the register export carries its query (`?format={format}`), and the policy compares grants against the catalogue string exactly; `served-operations.json` keeps it as `GET:/api/v1/risks/export` under the existing normalisation (19-RESEARCH Pitfall 2). Every new list-export catalogue URL follows the same form, `GET:/api/v1/{segment}/export?format={format}`.

Each view has a closed column vocabulary: a key, a header label equal to the on-screen column header, a cell type and an extractor (D-06). A column is offered only if the same actor can already read that field through the list's scope or the record's own read; only the chosen columns are read and written. A secondary on-screen marker is its own column (the register's Stage, Accepted and treatment due state; My requests' holder and next step). Reference lists use the import template's columns, then the list's read-only columns (D-33).

### Fixed-table exports (D-03, D-21, D-22; UI-D5)

Reports and the released assessment take no `columns` parameter: their tables are fixed record content, and a partial released record would misrepresent it (19-UI-SPEC UI-D5).

- **Reports:** `POST /api/v1/reports/{reportKey}/export` (reserved, URL unchanged), view `report:{reportKey}`, underlying read `GET:/api/v1/reports/{reportKey}`. Closed JSON body `{ format, table?, timeZone?, query? }`:
  - `format`: `csv` | `xlsx`, required;
  - `table`: one of that report's table keys, required when `format` is `csv` and refused (400) when `xlsx`;
  - `timeZone`: as for list exports;
  - `query`: an object of the report's own query parameters as strings (at most 16 keys, each value at most 200 characters), parsed by the report's own parser.

  XLSX holds one sheet per report table, with the report's as-at date and period in the About sheet; CSV holds the one chosen table. The report's own figures and windows are unchanged (Phase 11 D-38).
- **The released assessment (D-03 group 2):** `GET /api/v1/risk_assessments/{assessmentId}/export?format&table&timeZone`, view `released-assessment`, underlying read `GET:/api/v1/risk_assessments/{assessmentId}`. `table` is `risks` or `mitigation-controls`, required for CSV and refused (400) for XLSX. Its content is exactly what the released read discloses, with no analyst-only field (D-21): XLSX holds a `Summary` sheet (assessment and request numbers and title, Released date and released by, overall rating, overall control effectiveness, summary, overall rationale, recommendations, next review date), a `Risks` sheet (one row per risk in the released read) and a `Mitigation controls` sheet (one row per control implementation, keyed by risk number), then About; CSV holds the Risks table or the Mitigation controls table. Phase 12's disclosure that AI assisted and a Security Analyst reviewed appears in the About sheet. Phase 16's withdrawn risks are absent because the read excludes them.

An invalid filter, sort, column, format, table or zone is a 400 with no reason code (D-16).

## File Responses

A 200 is the file, served through `sendStoredFile`:

- **`Content-Type`**, exactly one of two strings, as sent and as declared:
  - CSV: `text/csv; charset=utf-8`;
  - XLSX: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

  `sendStoredFile` sets the given media type with `ctx.set`, so Koa adds and removes nothing. The specification declares these same two strings as the 200's content keys, each with an equal `contentMediaType` (OpenAPI 3.1: `{ "type": "string", "contentMediaType": … }`). The web parity guard (`contract-response-parity.test.ts`, which gains a file-response mode) and the web validator's accepted list are exactly these two strings; the guard is never weakened (19-PLAN-CHECK lane B W2, the pilot's ruling).
- **The four headers `sendStoredFile` sets:** `Content-Disposition: attachment` with an ASCII `filename` and an RFC 5987 `filename*` (through `contentDispositionFor`); `X-Content-Type-Options: nosniff`; `Cache-Control: no-store`; `Content-Security-Policy: default-src 'none'; sandbox`.
- **`X-CSRM-Row-Count`** on every export: the server's integer row count, the data rows across the table sheets, the Summary sheet not counted. The web's success toast reads it (19-UI-SPEC UI-D8).
- **File names (19-UI-SPEC §3.2; D-10):** `{slug}-{local date YYYY-MM-DD}.{csv|xlsx}`, with the slugs `requests`, `questionnaires`, `risk-assessments`, `risk-register`, `alerts`, `my-requests`, `my-questionnaires`, `my-risk-assessments`, `risk-types`, `controls`, `information-systems` and `information-assets`; a report is `{reportKey}-report` (XLSX) or `{reportKey}-{table slug}` (CSV); a released assessment is `{assessment number}-risk-assessment` (XLSX) or `{assessment number}-risks` / `{assessment number}-mitigation-controls` (CSV). The local date is in the viewer's zone, or UTC on the fallback. The web uses the server's name.
- **Errors are JSON:** `AssessmentWorkflowErrorResponse`, with a closed `details.reason` where the refusal has one ("Closed Reasons"), or Strapi's policy error for a 403.

## Functions, Grants and the Service Identity

**Functions (D-13).** Every export FunctionApi sits in a Function that only human roles hold. The new Functions are API-only, without a `menuPath`:

| Function | Name | Roles | FunctionApis |
| --- | --- | --- | --- |
| `function.risk_register.export_api` | Risk Register Export API | `role.security_analyst` | `.api.01`: the moved "Export Risk Register" entry |
| `function.reports.export_api` | Report Export API | `role.security_analyst` | `.api.01`: the moved "Export Report" entry |
| `function.analyst_exports.list_export_api` | Analyst List Export API | `role.security_analyst` | `.api.01` Requests, `.api.02` Questionnaires, `.api.03` Alerts, `.api.04` Risk assessments |
| `function.my_exports.list_export_api` | My List Export API | `role.requestor` | `.api.01` My requests, `.api.02` My questionnaires, `.api.03` My risk assessments |
| `function.risk_assessments.export_api` | Risk Assessment Export API | `role.security_analyst`, `role.requestor` (as `function.risk_assessment_requests.revert_to_draft_api` is granted) | `.api.01`: the released-assessment export |

- **The two moves.** `function.risk_register.risk_register.api.04` becomes `function.risk_register.export_api.api.01` (plan 19-05), and `function.reports.reports.api.03` becomes `function.reports.export_api.api.01` (plan 19-09), each with its name, URL and description unchanged. Each leaves its menu Function (`function.risk_register.risk_register`, `function.reports.reports`), which the Security Analyst Agent holds; those menu Functions keep their menu paths and grants.
- **The four Administration Functions** (`function.administration.risk_types`, `.controls`, `.information_systems`, `.information_assets`; `role.security_analyst` only) each gain three FunctionApis with their next free numbers (today `.api.05` export, `.api.06` template, `.api.07` error report), so Phase 22's re-grant of Reference data moves them together.
- **Application.** Every new Function sits in the `idambox-csrm` application: `seed-csrm-data.ts` seeds every catalogue Function except `function.identity_provisioning.api` there, and `served-operations.integration.test.ts` asserts it ("IAM Function belongs only to the active IAM Application"). `role.identity_provisioning` is untouched. Neither the agent role nor any service role is granted a new Function. Both catalogue copies stay byte-identical.

**Two grants, the underlying read (D-13).** `AuthorizationConfig` gains `underlyingRead?: string`: the list read, which the caller must hold through the same grant path that admitted the export (the human Security Analyst role for an analyst operation; the explicit or birthright roles otherwise), as Phase 7's insights require their underlying reads. A caller holding the export but not the read is denied with `CSRM export requires the list read.` The route keeps the list's policy configuration (its scope flags), so the export resolves exactly the list's scope. The field is optional and absent on every existing route.

**Human only.** Each of the ten analyst exports (register, requests, questionnaires, alerts, risk assessments, reports and the four reference lists) joins `HUMAN_ANALYST_ONLY_OPERATIONS` as a quoted literal; the matrix guard's literal moves from 31 to 41 across plans 19-05, 19-07, 19-08, 19-09, 19-10 and 19-14. The own-record exports (the three My lists and the released assessment) do not join it, because its guard would refuse human Requestors.

**The service identity.** `csrm-authorization.ts` exports `SERVICE_IDENTITY_REFUSED_OPERATIONS: ReadonlySet<string>`, named generically because Phases 19.1 and 17 add members. Phase 19's members are the 14 export operations. A caller who is not an eligible person under `isEligiblePerson` (`csrm/people/eligible-person.ts`), that is, one holding the role named by the re-exported `SECURITY_ANALYST_AGENT_ROLE_NAME`, is refused 403 on every member, whatever it holds, its Requestor birthright included (G-1; an export is a human act). No new role-name constant is added, and human eligibility is decided only through `isHumanSecurityAnalyst` and `hasHumanAnalystOperation`. Templates and error reports are Administration operations, refused to the agent by their human-only Function grants, and are not members.

**The two exact 403 messages** a refused export gets. Each is Strapi's error message; neither is a closed reason, and the web never renders it (19-UI-SPEC S1 words every export 403 as `You don’t have access to export this list.`):

- the service-identity refusal, on every member of `SERVICE_IDENTITY_REFUSED_OPERATIONS`: `CSRM exports are refused to automation identities.` (`serviceIdentityDenialMessage`, one sentence today; a later phase that adds a non-export member adds its own branch before it);
- the human-only refusal, through `humanAnalystDenialMessage`'s branch for every member of `SERVICE_IDENTITY_REFUSED_OPERATIONS` (placed before its questionnaire-governance fall-through, so plans 19-07 to 19-10 and 19-14 inherit it; only the analyst exports are human-only, so only they reach it): `CSRM analyst exports require a human Security Analyst.`

**Negative cases (D-16),** each proven in the API and in the UI, with a six-actor matrix row (owner, other, analyst, serviceAgent, noIdentity, noToken) per operation: a Requestor at any analyst export is 403; the service agent at every export is 403; another Requestor's released assessment and the Requestor's own unreleased assessment are 404; a My-list export by an analyst holds their own records only; no identity is 403; no token follows its token family; an invalid query is 400; over the cap is `EXPORT_ROW_LIMIT`; an analyst export of an unreleased assessment is 409 `ASSESSMENT_NOT_RELEASED`. Navigation visibility is not authorisation: a hidden Export button never stands in for a refusal.

**The catalogue design note** (appended last to `designNotes` by plan 19-05, Task 1, in both catalogue copies):

> Phase 19 serves the reserved risk register and report exports at their catalogued URLs and adds the list, released-assessment, template and error-report operations of docs/contract-gaps/phase-19-exports-and-export-log.md and phase-19-import-tolerance.md. Their FunctionApis sit in human-only API Functions (function.risk_register.export_api, function.reports.export_api, function.analyst_exports.list_export_api), a Requestor-birthright API Function for own records (function.my_exports.list_export_api), one Function granted to role.security_analyst and role.requestor for the released assessment (function.risk_assessments.export_api), and the four Administration Functions for reference data; the reserved entries moved with their names, URLs and descriptions unchanged. Every export also requires its list read, and the policy refuses the service identity on every export whatever it holds (SERVICE_IDENTITY_REFUSED_OPERATIONS).

## The Released-Assessment Record-Read Check

One module decides who may read a released assessment (D-14; the orchestrator's constraint): `apps/backend/src/api/csrm-assessment/services/released-assessment-read.ts`. It exports the viewer type, `type AssessmentViewer = { kind: "requestor"; documentId: string } | { kind: "analyst" }`, and four values:

- `RELEASED_ASSESSMENT_FILTERS`: today `assessmentStatus` `approved`, the release facts (`approvalDate`, `assessmentDate` and `approvedBy` present) and the owning request `approved`;
- `readableAssessmentFilters(viewer)`: today the requestor is the viewer, and the analyst reads all;
- `isReadableReleasedAssessment(document, viewer)`;
- `findReadableReleasedAssessment({ documents, viewer, documentId, populate })`.

It gathers today's `releasedForOwner` in the assessment controller and `releasedAssessmentQuery`, `releasedAssessmentDetailQuery` and `isReleasedAssessmentForOwner` in `assessment-scope.ts`.

**Callers.** The released detail, risks and control-implementation reads, the released-assessment export and (through those reads) the A4 report route (`/app/assessments/{documentId}/report`, `/app/review/assessments/{documentId}/report`) all call it. Nothing else decides who may read a released assessment, and there is no separate "the Requestor raised it" check (G-12 seam). Plan 19-10 switches the three released reads and the My risk assessments list to it with no behaviour change.

**Outcomes.**

- **The Requestor:** the export is "readable and released". Another person's assessment, or the Requestor's own unreleased one, is 404, the refusal a missing record gets, as at the read.
- **The analyst (D-15):** exports through the analyst read. An unreleased assessment is 409 `ASSESSMENT_NOT_RELEASED`, because the analyst can read it, so a 404 would be untrue; analysts export an unreleased assessment's risks from Phase 18's risk table.
- **Both actors get the same file** (D-21): the released record built from the released read, as the Requestor reads it.

**Later widenings, in this one module:** Phase 17 widens "readable" to every current participant (the Requestor, the nominated risk owners and named executive approvers, G-12); Phase 17.1 widens "released" to an owning request in `approved` or `closed` (G-13). The export, the report and My risk assessments follow with no export change.

## Row Cap

- `EXPORT_ROW_CAP = 10_000`, defined once, in `apps/backend/src/csrm/exports/run-export.ts` (D-17). It is a data-leakage control, not a setting.
- Strapi counts before it generates anything and refuses a larger export with 422 `EXPORT_ROW_LIMIT`, with `details.rowCount` (the count) and `details.rowCap` (the cap), and writes no file.
- Ids are then fetched with `limit: cap + 1`, and an export is refused the same way if more than the cap arrive, so a list that grows between the count and the read never yields a partial file (19-RESEARCH Pitfall 8). Rows are hydrated in batches in the list's order.
- Within the cap, files are built in memory: no streaming and no background job, because the transport buffers anyway (D-19) and the cap bounds the memory.
- The dialog knows the list's total, warns and disables `Export file` before the request (X-30), and the server still enforces.

## Formats, Values and Neutralisation

**Values (D-07).**

- Header labels equal the on-screen column headers in their source sentence case.
- Display values, never internal ids: record numbers, display names and labels.
- Status, stage, due state, holder, alert kind and urgency labels come from one label vocabulary per family in Strapi, proven equal to the web's one status mapping by a parity test, so a file reads `Released`, never `approved`; Phase 17.1's `Closed` (G-13) must extend both sides.
- An absent value is an empty cell, never placeholder text. Flags read `Yes` and `No`. Numbers are numbers.
- Instants are the viewer's local calendar date. The web passes the zone from Phase 10's `csrm-time-zone` cookie; Strapi validates it as an IANA zone; an absent or invalid zone falls back to UTC, and the About sheet names the fallback.
- The treatment due state comes from the list's own projection (`deriveTreatmentDueState`), never recomputed in the export module (G-16), so Phase 20's change reaches every export with no export work.

**CSV (D-08):** UTF-8 with a BOM, CRLF line ends, RFC 4180 with every text cell quoted; one header row of display labels, then one row per record; no title or metadata rows. Dates are ISO `YYYY-MM-DD` (UI-D9). A multi-table view's CSV holds the one table chosen.

**XLSX (D-08):** the data on the first sheet (a multi-table view: one sheet per table), with a bold, frozen header row and sized columns; typed cells, text always as strings, no formula, no external link and no macro (`.xlsx` only); dates as typed date cells with the `d mmm yyyy` display format, written as the viewer-local calendar date; then a last sheet, `About this export` (D-09; 19-UI-SPEC §3.3): `View`, `Search`, `Filters`, `Sorted by`, `Columns`, `Rows`, `As at` and `Period` (reports), `Exported` (date and time with the IANA zone, or the UTC fallback sentence), `Exported by`, `Values that look like formulas`, and `AI assistance` (the released assessment, only when AI assisted). Sheet names are cut to 31 characters.

**Neutralisation (D-11; Orchestrator Confirmations).** One shared function, the existing `sanitizeSpreadsheetCell` moved into `csrm/spreadsheets/neutralise.ts`, applies to every text cell in both formats:

- a value starting with `=`, `+`, `-`, `@`, tab, carriage return or line feed, their full-width forms, or any of these after leading whitespace, is prefixed with the mark;
- a value that begins with one or more `'` followed by such a trigger is marked too, so the mark is invertible (19-RESEARCH Pitfall 9);
- **the mark is a leading single quote**, OWASP's primary recommendation and today's tested behaviour;
- numbers and dates are typed values and never marked;
- the import strips exactly the mark, one leading `'` only when what follows is a trigger or the quote-run pattern, so an export, edit and import round trip is lossless (`phase-19-import-tolerance.md`, "Values").

In an XLSX string cell the mark is literal content, so Excel shows the quote; the About sheet says so in `Values that look like formulas`. A manual-only check that a file saved and reopened in Excel keeps the mark is for the pilot to run where Excel exists. **Reversibility: costly** (files in circulation carry the mark).

## The Export Event Log

Every export is one structured line in Phase 14's security event log (`csrm/audit/security-event-log.ts`, `logSecurityEvent`), written through Strapi's logger with the `csrm.security_event` prefix, a stable event name and a JSON payload (D-18). **No persisted entity is added.**

- **`export.completed`:** outcome `exported`.
- **`export.refused`:** outcome `refused`, with the reason `EXPORT_ROW_LIMIT`, `INVALID_QUERY` or `ASSESSMENT_NOT_RELEASED`.
  - `INVALID_QUERY` is a log-only reason in `SECURITY_EVENT_LOG_REASONS`, beside `NOT_FOUND`, because the log closes every reason to `^[A-Z][A-Z0-9_]{0,79}$` and the 400 names none. It is in no reason enum.
  - `EXPORT_ROW_LIMIT` joins `SECURITY_EVENT_WARN_REASONS`, so that refusal logs at warn level; the rest log at info.
- **Fields:** the time (UTC); `actor { documentId, displayName }`; `view`; `format`; `columns` (keys); `table`; `filters`, `search` and `sort` (the closed parsed values, never the raw query); `timeZone` (the zone, or `UTC-fallback`); `rowCount` (null when refused before counting); and `subject` (`{ kind: "risk-assessment", documentId }` for the released export).
- **Never** an exported value or a cell.
- **Policy denials** (403 and 404) stay in Strapi's request log line, as today, and are not export events.
- **Imports** log `import.committed` through the same module (`phase-19-import-tolerance.md`). Templates and error reports are not exports of records and are not logged as one.
- **Not logged as an export:** the print-ready report. Its content is the released view itself, and printing happens in the browser, where the server cannot observe it.

**Where it is queryable.** In the log platform the deployment ships Strapi's log to (a SIEM), by actor, view, outcome and time (ISO/IEC 27001:2022 Annex A 8.15 logging and 8.16 monitoring activities), not in the app.

**Retention.** The deployment's log policy, which R-08-13 already says must treat these lines as personal data (they hold display names and search terms).

**Deferred.** A persisted, in-app audit view of exports needs a content type, so it is deferred to a contract-gap record of its own.

**Reuse.** Phase 17's people-search log (G-17) writes `people.searched` through this module, "as exports are". **Reversibility: costly** (log consumers key on the event names and fields).

## Closed Reasons

Phase 19 appends 19 codes, in this order, to `CONFLICT_REASONS` (`apps/backend/src/csrm/conflict-reasons.ts`), its web mirror and both specification reason enums (`AssessmentWorkflowErrorResponse` and `QuestionnaireWorkflowErrorResponse`), after the codes Phases 10 to 16 added (D-03 group 4):

- **Exports:**
  - `EXPORT_ROW_LIMIT` (422), with `details.rowCount` and `details.rowCap`;
  - `ASSESSMENT_NOT_RELEASED` (409). 19-UI-SPEC recommended `EXPORT_NOT_RELEASED`; the code is named so Phase 17 D-29 reuses this one code for a participant's export before release.
- **Imports** (each 422 unless stated, with the closed details object `found`; the meaning of each is in `phase-19-import-tolerance.md`, "File Refusals"): `IMPORT_FILE_TYPE` (415), `IMPORT_FILE_TOO_LARGE` (413), `IMPORT_TOO_MANY_ROWS`, `IMPORT_ENCODING_WINDOWS_1252`, `IMPORT_ENCODING_UTF16`, `IMPORT_ENCODING_UNKNOWN`, `IMPORT_DELIMITER`, `IMPORT_LEGACY_XLS`, `IMPORT_MACRO_WORKBOOK`, `IMPORT_ENCRYPTED_WORKBOOK`, `IMPORT_WORKBOOK_TOO_LARGE`, `IMPORT_NO_HEADER`, `IMPORT_NO_ROWS`, `IMPORT_DUPLICATE_HEADER`, `IMPORT_MISSING_COLUMN`, and `IMPORT_DECISION_MISSING` (409) and `IMPORT_REVIEW_EXPIRED` (409).

`AssessmentWorkflowErrorResponse.error.details` gains the optional, closed `rowCount`, `rowCap` and `found` (`found`: `headers` and `labels`, each at most 20 strings of at most 200 characters with controls removed; `delimiter`, `semicolon` | `tab`; `rows`; `bytes`). The web transport keeps them beside their reasons only. An invalid filter, sort, column, format, table or zone is a 400 with no reason code (D-16).

## What This Extension Does Not Add

- **No content type**, attribute, relation or enumeration value, and no migration.
- **No streamed or background export:** files are built in memory within the cap.
- **No in-app export history** or persisted audit view: the log platform holds the record.
- **No participant export before Phase 17:** only the Requestor reads (and exports) a released assessment as its owner until Phase 17 widens "readable".
- **No PDF dependency:** the A4 report prints through the print stylesheet (X-31), and the browser prints or saves the PDF.
- **No export of** either Home, a single request, questionnaire answers, notes or attachments, or an unreleased assessment's risks (Phase 18's risk table, ASSESS-19).
- **No new role, role-name constant or agent grant**, and no change to `loadEffectiveGrants`, the registered-source-service denial or `role.identity_provisioning`.
- **No web-built file:** the web never builds, parses or alters a file, and there is no Route Handler or raw `fetch` for exports.

## Later Phases

- **Phase 17:** widens "readable" in `released-assessment-read.ts` to every current participant (G-12); reuses `ASSESSMENT_NOT_RELEASED` for a participant's export before release (D-29); adds members (people search, responses) to `SERVICE_IDENTITY_REFUSED_OPERATIONS`; writes `people.searched` through the event log (G-17).
- **Phase 17.1:** widens "released" to an owning request in `approved` or `closed` (G-13) in the same module; its `Closed` label extends both sides of the label vocabulary; its decisions join the Risks sheet when it adds them to the released read.
- **Phase 18:** reuses the export module (the risk table's current view as one more view), the XLSX reader and writer, the neutraliser, the value-conversion module and the column-choice primitive (D-06); its risk-row import uses the same reading, header-matching, error-report and similar-name machinery.
- **Phase 19.1:** adds its notification members to `SERVICE_IDENTITY_REFUSED_OPERATIONS`.
- **Phase 20:** "My risks and treatments" exports through the module; its switch to `treatmentResolveDate` and its server-written Overdue reach every export through the lists' projections (G-16).
- **Phase 21:** a chart's data-table alternative may export through it.
- **Phase 22:** the Admin's access-review export of role holders (ADMIN-08) uses it; re-gating Reference data moves the reference-list exports, templates and error reports with the four Administration Functions.

Every later export keeps this phase's rules: human only, the underlying read, the cap, the log and the neutraliser (D-36).

## Delivery

Fifteen plans, one per wave, each the single owner of its shared files in that wave (D-40, D-41):

| Wave | Plan | Scope |
| --- | --- | --- |
| 1 | 19-01 | The design direction's X-30 to X-32, this record and `phase-19-import-tolerance.md`, the Phase 06 and Phase 07 amendments, and the pilot's approval (G-6) |
| 2 | 19-02 | The 19 closed reasons, the `rowCount`, `rowCap` and `found` details, and refusal copy family S |
| 3 | 19-03 | `write-excel-file@4.1.1` (Strapi only), the neutraliser and its inverse, the CSV and XLSX writers, the first-sheet read, the bounded import reader, header matching and value conversion |
| 4 | 19-04 | The export pipeline and cap, the view registry with the Risk register, the column and label vocabulary, the zone, file-name and About helpers, the export and import events |
| 5 | 19-05 | The Risk register export served at its reserved URL; `SERVICE_IDENTITY_REFUSED_OPERATIONS` and `underlyingRead`; the first catalogue move and the design note |
| 6 | 19-06 | The register's Export in the web: service, file-response validator, Server Action, the X-30 dialog and column choice |
| 7 | 19-07 | The Requests and My requests exports |
| 8 | 19-08 | The Questionnaires, My questionnaires and Alerts exports |
| 9 | 19-09 | The report export served at its reserved URL; the second catalogue move |
| 10 | 19-10 | `released-assessment-read.ts`, the released-assessment export, the Risk assessments and My risk assessments exports |
| 11 | 19-11 | The web's export services, actions and Export buttons on every list served by 19-07 to 19-10 |
| 12 | 19-12 | The shared released loader, the two report routes and the X-31 document |
| 13 | 19-13 | The four imports on the tolerant reader, the `similar` tier and its decisions, the result record and `import.committed` |
| 14 | 19-14 | Templates, error reports and the four reference-list exports |
| 15 | 19-15 | The web import flow on Strapi's tolerant import, Export on the reference lists, and the phase gate |

No plan changes `docs/references/specification.json`, either catalogue copy, `served-operations.json` or the import contract before this record and `phase-19-import-tolerance.md` carry the pilot's dated approval line (D-01, G-6).

## Affected Workstreams

`apps/backend` is shared by every workstream (`.planning/PROJECT.md`, "GSD Workstreams", "The shared backend"). On 2026-10-16 that section's workstream table lists two workstreams: `csrm` (`apps/csrm`) and `iam` (a platform workstream with no application: the midPoint identity engine and Strapi SCIM).

- **`csrm`** is the only workstream whose application calls the export, template, error-report, preview and commit operations, or reads the reason codes, details, row states and file responses this record and `phase-19-import-tolerance.md` publish.
- **`iam`**'s plans and records read three of the files Phase 19 changes (`apps/backend/src/policies/csrm-authorization.ts`, the role-function catalogue and `docs/references/served-operations.json`, beside `specification.json` and `conflict-reasons`), and none of Phase 19's names. Its reads concern the registered-source-service isolation (`loadEffectiveGrants`, the early denial of a registered source service, `isEligiblePerson`), `function.identity_provisioning.api` in the `idambox-iam` application and the `IAM_SCIM_RESERVATIONS` in served-operations; Phase 19 changes none of them.

The two greps, re-run on 2026-10-16 from the repository root at `PHASE_19_BASE=bdd0f698` plus the direction commit:

- **Grep A**, the shared files `iam` reads: `grep -rlE "csrm-authorization|idambox-csrm-role-function-api-catalogue|served-operations|specification\.json|conflict-reasons" .planning/workstreams/iam/` printed 10 files, all in IAM phase 02 (`02-identity-model-and-leaver-safe-keycloak-sync`): `02-03-PLAN.md`, `02-03-SUMMARY.md`, `02-05-PLAN.md`, `02-13-PLAN.md`, `02-CONTEXT.md`, `02-GATE-EVIDENCE.md`, `02-RESEARCH.md`, `02-REVIEW.md`, `02-SECURITY.md` and `02-VALIDATION.md`.
- **Grep B**, Phase 19's names: `grep -rlE "CONFLICT_REASONS|HUMAN_ANALYST_ONLY|SERVICE_IDENTITY_REFUSED|/v1/[a-z_]+/export|export_api|csv-import|import/preview|import/template|error_report|function\.risk_register|function\.reports|function\.administration|AssessmentWorkflowErrorResponse|write-excel-file|xlsx-reader|security-event-log" .planning/workstreams/iam/` printed nothing (exit status 1).

Each change, with its backward-compatibility position:

1. **The new operations** (the 13 list exports, the released-assessment export, and the template and error-report operations per collection), and the two reserved ones served at their catalogued URLs: additive; no existing request or response changes.
2. **The moved FunctionApis:** `function.risk_register.risk_register.api.04` becomes `function.risk_register.export_api.api.01` (plan 19-05), and `function.reports.reports.api.03` becomes `function.reports.export_api.api.01` (plan 19-09), each with its name, URL and description unchanged. Both were unserved until now, so a reader keyed on the old ids re-reads the catalogue and no served grant is lost. `function.risk_register.risk_register` and `function.reports.reports` keep their menu paths and grants.
3. **The five new API-only Functions and the four Administration Functions' new `.api.05` to `.api.07`:** additive; each seeded into the `idambox-csrm` application (`seed-csrm-data.ts` seeds every catalogue Function except `function.identity_provisioning.api` there); `role.identity_provisioning` is untouched.
4. **`SERVICE_IDENTITY_REFUSED_OPERATIONS`**, a new export of `csrm-authorization.ts` that refuses a caller who is not an eligible person on its members only: no existing operation's decision changes, and `loadEffectiveGrants`, `isHumanSecurityAnalyst`, `hasHumanAnalystOperation` and the registered-source-service denial are unchanged.
5. **`HUMAN_ANALYST_ONLY_OPERATIONS` grows by the ten analyst exports** (the matrix guard's literal moves from 31 to 41 across plans 19-05, 19-07, 19-08, 19-09, 19-10 and 19-14): additive; no member is removed, and the current user's effective operations read the same set.
6. **The optional `AuthorizationConfig.underlyingRead`:** absent on every existing route, so no existing decision changes.
7. **The 19 reason codes** appended to `CONFLICT_REASONS`, both specification enums and the web mirror, **and the optional `rowCount`, `rowCap` and `found`** on the closed `AssessmentWorkflowErrorResponse.error.details` (`EXPORT_ROW_LIMIT` carries `rowCount` and `rowCap`): additive, but a strict reader of that envelope must accept the new enum values and keys. Only `csrm` reads it.
8. **The new event names `export.completed`, `export.refused` and `import.committed`, the log-only reason `INVALID_QUERY`, and `EXPORT_ROW_LIMIT` at warn** on the `csrm.security_event` lines: additive; the existing attachment lines are unchanged.
9. **The export 403 messages** (`CSRM exports are refused to automation identities.`, `CSRM analyst exports require a human Security Analyst.`, `CSRM export requires the list read.`): new messages on new operations only; no existing operation's message changes.

## Approval

Status: **approved by the pilot on 2026-10-16** (G-6).

What the pilot checked (2026-10-16): the 14 export operations and their two-grant rule (`underlyingRead`); the six-actor negative cases, including an unrelated Requestor's 404 on another person's released assessment and the service agent's 403 on every export whatever it holds; one released-assessment read module, so Phases 17 and 17.1 widen scope in one place; the 10,000-row cap counted before generation and re-checked on the read; formula neutralisation; every export logged with actor, view, filters and row count, and never a cell value (CSV-01, ISO/IEC 27001:2022 A 8.15); AGENTS.md (Strapi enforces every rule against the resolved IdamBox User; navigation visibility is not authorisation; Requestors never reach another Requestor's records; AI is not involved; JDL terminology); the role-function catalogue (new API-only Functions, human-only analyst exports, the Requestor-birthright own-record Function, no grant to the Security Analyst Agent or any service role, both copies byte-identical); `specification.json` changes additive only; no content-type change; and `.planning/PROJECT.md` "The shared backend": the Affected Workstreams section re-ran both greps, `iam` reads none of Phase 19's names, and every change keeps existing endpoints, grants and decisions backward compatible. Rulings on the executor's four points: (1) `ASSESSMENT_NOT_RELEASED`, not the UI-SPEC's `EXPORT_NOT_RELEASED`, so Phase 17 D-29 reuses one reason, and the UI-SPEC row follows the record; (2) `columns` applies to the 12 list views only, never to the report export (UI-D5); (3) an unreadable import file answers 422 with a closed reason and a malformed multipart request stays 400, and `csrm` (the only caller) is updated in 19-15; (4) a record over 64 KiB becomes one rejected row `VALUE_TOO_LONG`, not a whole-file refusal, which keeps the import tolerant and the error report correctable.

No `docs/references/specification.json` operation, no catalogue grant, no `served-operations.json` entry and no import-contract change for Phase 19 lands before the pilot's dated approval line is written here and in `phase-19-import-tolerance.md` (D-01, G-6). The pilot writes the line; the executor never does.

## Phase 19 review erratum (2026-10-17)

Documentation corrections from the Phase 19 code review (lane 1). Each brings this record into line with the contract as served and the approved code; none changes the contract, and the approval above stands as written.

- **An unknown time zone is a 400 (BE1-08).** "Formats, Values and Neutralisation", Values, says "an absent or invalid zone falls back to UTC, and the About sheet names the fallback". That contradicts "Export Operations and Parameters" ("An invalid filter, sort, column, format, table or zone is a 400 with no reason code"), every export's `timeZone` description in `specification.json` ("A zone the server does not know is a 400") and `csrm/exports/export-time.ts`, which all refuse it. Read the Values line as: **an absent zone falls back to UTC, and the About sheet names the fallback; an unknown or over-long zone is a 400 with no reason code (D-16).** The pilot's approval covers the contract as served.
- **What an XLSX text cell can hold (BE1-01).** `write-excel-file` removes the C0 controls other than tab, line feed and carriage return, DEL and the C1 controls it calls discouraged, U+FFFD, lone surrogates and non-characters from every text node it writes. So an XLSX copy of a value that holds one of them differs from the stored value by those characters; the CSV copy keeps them. The neutraliser decides on the value with those characters (and format characters such as zero-width and bidi marks) removed, so a trigger hidden behind them, such as `\u0001=HYPERLINK(...)`, is still marked once, and the import's `stripNeutraliserMark` stays its exact inverse.

## Phase 19 review erratum (2026-10-17, lane 2): the export 403 rule and the reference-list filters

Contract-text corrections from the Phase 19 code review (lane 2, BE2-10). Neither changes behaviour; each makes `specification.json` say what Strapi already does. The approval above stands as written.

- **The 403 rule.** Four export 403 descriptions said the identity "holds neither the export nor the list read" (or "the detail read"). The policy refuses a caller who lacks **either** (`csrm-authorization.ts`, the `underlyingRead` check). They now read "lacks the export or the list read" (My questionnaires, My requests, My risk assessments), and, for the released assessment, "lacks the export or any of the three released reads it discloses (the detail, the released risks read and the control implementations read)", which the policy has required since BE2-01.
- **The reference-list filters.** `GET /api/v1/information_systems/export` and `GET /api/v1/information_assets/export` published only `q`, `sort`, `format`, `columns` and `timeZone`, while `parseAdministrationExportQuery` (the list's own closed parser) also takes `environment`, `deploymentModel`, `lifecycleState` and `internetFacing` for systems, and `dataClassification`, `containsPersonalData`, `containsLegalData` and `containsCreditCardData` for assets, and the About sheet names them. Both exports now publish those parameters with the parser's closed values (the flags as booleans, sent as `true` or `false`), as `controls` already publishes `framework` and `controlType`. The list operations keep their Phase 6 parameters unchanged here.

## Phase 19 review amendment (2026-10-17): a cell longer than Excel allows, and an export that fails after parsing

Two gaps from the Phase 19 code review (lane 1) need a contract change, so they wait for the pilot's approval (G-6). Nothing below is wired before the approval line at the end is written. BE1-07 (the released export's 1,000-row reads) needed no change here: the export now pages through both reads, and an over-cap assessment gets the existing `EXPORT_ROW_LIMIT`.

### 1. A cell longer than 32,767 characters (BE1-02)

**Gap.** Excel holds at most 32,767 characters in a cell. Nothing in the export bounds a text cell, while the contract serves longer text: `AssessmentRiskListItem.riskStatement` and `.treatmentPlan` are `maxLength: 65535`, and `summary`, `overallRiskRationale` and `recommendationsSummary` are unbounded `text`. They reach the released assessment's Summary and Risks sheets and the register's statement and treatment plan columns. Excel cuts such a value when it opens the file (and may offer to "repair" the workbook), so the delivered copy silently loses text. For the released assessment that is the partial record UI-D5 rules out ("a partial released record would misrepresent it"), and D-17 says an export is never a partial file.

**Proposal: refuse the workbook with one closed reason; write CSV whole.**

| Reason | Status | When | `details` |
| --- | --- | --- | --- |
| `EXPORT_CELL_TOO_LONG` | 422 | An `xlsx` export (any of the 12 list exports, the report export or the released-assessment export) in which a text cell, as written (after the neutraliser's mark), is longer than 32,767 UTF-16 code units | `column`: the first such column's key (`^[a-zA-Z][a-zA-Z0-9]{0,63}$`, a closed vocabulary key, never a value); `cellLimit`: `32767` |

- **Where it is enforced.** Once, in the export pipeline (`csrm/exports/run-export.ts`, where `typedCell` builds the XLSX cell, for both `runListExport` and `runFixedTableExport`), before the workbook is written: no file, no partial file. The constant `XLSX_CELL_MAX_LENGTH = 32_767` is defined once, in `csrm/spreadsheets/xlsx-writer.ts`, and the writer also refuses (a `RangeError`) a longer text cell from any caller, so no CSRM workbook ever holds one.
- **CSV is unchanged.** RFC 4180 has no cell limit, so a CSV holds the value whole and is the lossless route for a list export. This record states that Excel cuts a CSV cell past 32,767 characters when it opens the file; the CSV is still complete for any other reader.
- **The log line.** `export.refused` with `reason: "EXPORT_CELL_TOO_LONG"` at info, `rowCount` the rows counted, and the column key in `columns` as today. Never the value.
- **Specification changes.** `EXPORT_CELL_TOO_LONG` joins `CONFLICT_REASONS`, its web mirror and both specification reason enums (`AssessmentWorkflowErrorResponse` and `QuestionnaireWorkflowErrorResponse`), after `ASSESSMENT_NOT_RELEASED`. `AssessmentWorkflowErrorResponse.error.details` gains the optional, closed `column` (string, the pattern above) and `cellLimit` (integer, `32767`), sent only with this reason; the transport guard keeps them beside it only, as it keeps `rowCount` and `rowCap`. Each export operation's `422` response description adds: "`EXPORT_CELL_TOO_LONG` when `format` is `xlsx` and a text cell is longer than Excel's 32,767-character limit; the CSV holds the value whole." `columns` patterns, request shapes and every other response are unchanged.
- **Proposed fix-it copy** (19-UI-SPEC S1 style; the web owns it):
  - Title: `A value is too long for Excel`
  - List exports and reports: `{Column label} holds text longer than Excel's 32,767-character cell limit, so the workbook would cut it. Export as CSV instead, or shorten the text in CSRM.`
  - The released assessment: `{Column label} holds text longer than Excel's 32,767-character cell limit, so the workbook would cut it. Export the Risks or Mitigation controls table as CSV, or use the print-ready report for the whole record.`
- **Not exports, unchanged.** Templates hold static vocabulary text. The import error report reflects the analyst's own rejected rows: every import column is at most 10,000 characters (the import vocabulary), so a longer cell is already a `VALUE_TOO_LONG` row; the error report writes such a cell cut to 32,767 characters with the visible suffix ` [cut: longer than Excel allows]`, which re-imports as `VALUE_TOO_LONG` again and can never be written back.

**Alternatives considered.**

- *Write the first 32,767 characters with a visible marker, add an About-sheet row naming the cut columns, and make the import refuse a marked cell.* Rejected: the file is still a partial copy of the record (UI-D5, D-17), every reader of the file must know the marker, and the import gains a second, fragile marker rule beside the neutraliser's.
- *Split a long value across continuation columns.* Rejected: it changes a view's columns per file, breaks the closed `columns` vocabulary and the reference lists' import round trip, and no spreadsheet reader rejoins it.
- *Refuse CSV too.* Not proposed: the CSV is complete, and refusing it would leave a list export with a long value no file route at all. If the pilot prefers it, the same reason and details apply to both formats.

### 2. An export that fails after its query is parsed (BE1-04)

**Gap.** "The Export Event Log" lists `export.completed` and `export.refused` with `EXPORT_ROW_LIMIT`, `INVALID_QUERY` or `ASSESSMENT_NOT_RELEASED`. An attempt that passes parsing and then fails unexpectedly (a fault such as a cell type the column cannot write, a writer `RangeError` or a database error) answers Strapi's 500 and writes no line, so the log does not hold one line per attempt (T-19-12). The review fixed the parts that need no change: a refused line keeps a known format, the cap race logs the re-read count, a row that disappears before hydration is left out by one rule in every view, and display names lose control and bidi characters.

**Proposal.**

- One log-only reason, `EXPORT_FAILED`, joins `SECURITY_EVENT_LOG_REASONS` beside `NOT_FOUND` and `INVALID_QUERY`, and `SECURITY_EVENT_WARN_REASONS`, so it logs at warn. It is in no response enum: the response stays Strapi's 500, with no new body, status or reason.
- `runListExport` and `runFixedTableExport` write it from one `catch` that knows whether a line was already written: `export.refused`, `reason: "EXPORT_FAILED"`, with the parsed format, columns, filters, search, sort and zone, and `rowCount` the count when it was read (else null). Never the error's message or a cell. A policy denial (403 or 404) is still not an export event.
- "The Export Event Log" then reads: `export.refused`, with the reason `EXPORT_ROW_LIMIT`, `INVALID_QUERY`, `ASSESSMENT_NOT_RELEASED`, `EXPORT_CELL_TOO_LONG` (if section 1 is approved) or `EXPORT_FAILED`.

### Affected Workstreams

- **`csrm`** is the only workstream that calls the exports or reads their refusal reasons and `details`, and the only one whose lines these are.
- **`iam`:** on 2026-10-17 the record's grep B, run from the repository root, printed nothing (exit status 1). So did a narrower grep for `EXPORT_CELL_TOO_LONG|EXPORT_FAILED|cellLimit|32,767|32767` in `.planning/workstreams/iam/` (exit status 1).
- **Backward compatibility:** additive. One closed reason, two optional `details` keys sent only with it, and one log-only reason. A workbook that would hold a cut cell today is refused with a reason that names the fix; every other export, CSV included, is unchanged. No endpoint, grant or content type changes.

Phase 19 review amendment status: **approved by the pilot on 2026-10-17** (G-6).

What the pilot checked (2026-10-17): section 1 against D-17 and UI-D5 (no partial file). The refusal is chosen over a marker or split columns, and it names the fix. `details` carries a closed column key and the limit, never a value. The CSV stays whole as the lossless route. Refusing before the workbook is written means no file exists. The error report's visible cut suffix is accepted, because it reflects the analyst's own rejected rows and is not a record export. Section 2 closes T-19's one-line-per-attempt rule with a log-only reason, leaves the response a plain 500, and logs no error message or cell. The proposed copy is approved as written. The change is additive. Neither `iam` grep prints anything, and only `csrm` reads either reason (`.planning/PROJECT.md`, "The shared backend").
