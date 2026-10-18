---
phase: 19-csv-export-and-import-hardening
reviewed: 2026-10-17
depth: deep
diff_base: bdd0f698
diff_ranges: bdd0f698..42262df9 (Phase 19's own change; PHASE_19_BASE from 19-01-SUMMARY.md)
files_reviewed: 147
findings:
  critical: 1
  warning: 11
  info: 31
  total: 43
status: issues_found
---

# Phase 19 code review

Four independent read-only lanes reviewed Phase 19's own change since `bdd0f698`, at `42262df9`: the Strapi export pipeline, views, writers, neutralisation, row cap, export log and released-assessment read (lane 1, `BE1-`); Strapi authorisation, `underlyingRead`, `SERVICE_IDENTITY_REFUSED_OPERATIONS`, effective access, the catalogue, grants and the 22 operations' routes and controllers (lane 2, `BE2-`); Strapi import tolerance, the reader, header matcher, converters, the similar tier, templates, error reports, result records and `IMPORT_CSV_MALFORMED` (lane 3, `BE3-`); and the web exports UI and actions, capabilities, report routes and print styles, the import flow, refusal copy and accessibility (lane 4, `FE4-`). Each lane checked the AGENTS.md rules and the phase's `T-19-*` threat model in its area. Lane bodies are preserved verbatim below. Severity is the reviewer's classification; `19-REVIEW-DISPOSITION.md` records the pilot's rulings, including three Info findings the pilot raised to Warning (BE1-06, BE1-07, BE2-08), and validates each claim before accepting it. The reviewed-file count is the sum of the lanes (41, 42, 16 and 48); lanes overlap on the contract and shared modules, so it is not a unique-source count. Lane 4 also judged the execution's items (a) and (b) in its closing "Execution items" section.

| Lane | Critical | Warning | Info | Total |
|------|----------|---------|------|-------|
| 1 backend export pipeline | 0 | 3 | 7 | 10 |
| 2 backend authorisation, catalogue and routes | 0 | 0 | 11 | 11 |
| 3 backend import tolerance | 1 | 2 | 3 | 6 |
| 4 web exports, report and import | 0 | 6 | 10 | 16 |
| **Total** | **1** | **11** | **31** | **43** |

## backend export pipeline lane

---
phase: 19-csv-export-and-import-hardening
lane: backend-export-pipeline
reviewed: 2026-10-17
depth: deep
diff_base: bdd0f698
files_reviewed: 41
files_reviewed_list:
  - apps/backend/src/csrm/exports/export-errors.ts
  - apps/backend/src/csrm/exports/export-time.ts
  - apps/backend/src/csrm/exports/export-views.ts
  - apps/backend/src/csrm/exports/export-vocabulary.ts
  - apps/backend/src/csrm/exports/export-vocabulary.json
  - apps/backend/src/csrm/exports/released-assessment-export.ts
  - apps/backend/src/csrm/exports/report-tables.ts
  - apps/backend/src/csrm/exports/run-export.ts
  - apps/backend/src/csrm/exports/send-export.ts
  - apps/backend/src/csrm/spreadsheets/csv-writer.ts
  - apps/backend/src/csrm/spreadsheets/xlsx-writer.ts
  - apps/backend/src/csrm/spreadsheets/neutralise.ts
  - apps/backend/src/csrm/audit/security-event-log.ts
  - apps/backend/src/api/csrm-assessment/services/released-assessment-read.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
  - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
  - apps/backend/src/api/csrm-analyst-insight/services/report-query.ts
  - apps/backend/src/api/csrm-analyst-insight/services/alert-query.ts
  - apps/backend/src/api/csrm-analyst-insight/controllers/reports.ts
  - apps/backend/src/api/csrm-analyst-insight/controllers/alerts.ts
  - apps/backend/src/api/csrm-risk/services/risk-register.ts
  - apps/backend/src/api/csrm-risk/services/risk-register-query.ts
  - apps/backend/src/api/csrm-risk/controllers/csrm-risk.ts
  - apps/backend/src/api/csrm-assessment-request/services/my-requests.ts
  - apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts
  - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
  - apps/backend/src/api/csrm-assessment-request/controllers/my-requests.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
  - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
  - apps/backend/src/api/csrm-administration/services/administration-query.ts
  - apps/backend/src/api/csrm-administration/controllers/csrm-administration.ts
  - docs/contract-gaps/phase-19-exports-and-export-log.md
  - docs/references/specification.json
  - apps/backend/tests/export-pipeline.unit.test.ts
  - apps/backend/tests/exports.integration.test.ts
  - apps/backend/tests/spreadsheet-writers.unit.test.ts
  - apps/backend/tests/spreadsheet-neutralise.unit.test.ts
  - apps/backend/tests/released-assessment-read.unit.test.ts
  - apps/backend/tests/security-event-log.unit.test.ts
  - apps/backend/tests/export-vocabulary.unit.test.ts
  - apps/backend/tests/helpers/export-files.ts
findings:
  critical: 0
  warning: 3
  info: 7
  total: 10
status: issues_found
---

# Phase 19 backend export pipeline review

Scope: the Phase 19 change (`bdd0f698..HEAD`) to the Strapi export pipeline. That covers the view registry and its 12 list views, the fixed-table path for reports and the released assessment, and the vocabulary. It also covers the CSV and XLSX writers, the neutraliser, the row cap, the zone and file-name helpers, the export and import event lines, the released-assessment read module, and every list reader an export reads through. I traced each export from its controller through `runListExport` / `runFixedTableExport` into the view, the list's own parser and repository, the projection, `typedCell`, the writer and `sendExportFile`. I compared each reader with its list read. I checked the export parts of `specification.json` and the approved record `phase-19-exports-and-export-log.md`, and the T-19 mitigations in this area. To confirm BE1-01 I ran a scratchpad probe against the installed `write-excel-file@4.1.1`. It wrote nothing to the repository.

What holds, verified against the code rather than the comments:

- **Record scope matches the list read, view by view (AGENTS.md, T-19-10, T-19-16, T-19-23, T-19-25, T-19-26, T-19-32).**
  - Risk register: the same `RiskRegisterRepository` count, `selectPage` and hydrate, with the same `registerQuery` base and the explicit Withdrawn branch.
  - Requests: `parseAnalystReviewQuery` and the one `review-queue-repository`.
  - My requests: `myRequestsReader`, which the list itself now uses. Its hydrate re-binds `requestor.id` to the policy's `ownRequestorId`.
  - Questionnaires and My questionnaires: the shared `questionnaireCollectionScope`, which carries the Requestor's `releasedAt` rule. The whole-scope read and the in-memory projection are the same ones the list uses.
  - Alerts: the alert repository's own count and pages.
  - Risk assessments and My risk assessments: the shared `assessmentCollectionFilters`. The owner variant composes `readableAssessmentFilters` with `RELEASED_ASSESSMENT_FILTERS`, and the populate never loads `generatedBy` for the owner.
  - Reference lists: the admin repository.

  The owner is always the policy's resolved user, never a query value. View objects are built per request, so the per-view caches (`parsedReader`, `ordered`, `hydrated`, `derived`, `populate`, `summaries`) cannot leak across callers.
- **The released read (D-14, D-21, T-19-32 to T-19-34).** One module decides who may read a released assessment. It applies both rules as filters and again in memory on the returned record. The owner-only helpers are gone from `assessment-scope.ts`.
  - A Requestor's export of someone else's assessment, or of their own unreleased one, gets the read's 404 with no event.
  - An analyst gets a 404 for a missing assessment and a 409 `ASSESSMENT_NOT_RELEASED`, with one line, for an unreleased one.
  - Both actors' tables are built from the released projections only (`projectReleasedAssessmentDetail` drops `generatedBy`). The Risks come from `ACTIVE_RISK_FILTER` and then `isActiveRisk`, so a withdrawn Risk and its implementations are absent.
- **Row cap (D-17, T-19-11, T-19-18).** `EXPORT_ROW_CAP` is defined once.
  - The count comes first: exactly 10,000 passes and 10,001 is refused.
  - Ids are read from offset 0 with `cap + 1`, and more than the cap is refused the same way, so no partial file is possible.
  - The header row is never counted. Hydration runs in batches of 500, in the list's order.
  - On the fixed-table path, the cap applies to the data rows and the one-row Summary is not counted.
- **Neutralisation on the data paths (D-11, T-19-05, T-19-49).** Every text, label, person, record and flag cell passes `sanitizeSpreadsheetCell` inside both writers, and so do the About sheet values. XLSX text is always `type: String` with format `@`. The module never passes `"Formula"`, and the library writes `<f>` only for that type, which I checked in `write-excel-file/modules/xlsx/files/sheet.xml/cell.js`. Numbers and dates are typed cells. The one exception is BE1-01.
- **Dates and zones.** The zone is canonicalised through `Intl`. An absent zone falls back to UTC and the file says so; an unknown or over-long zone is a 400, as the spec says. Instants (`submittedDate`, `approvalDate`, `updatedAt`, all `datetime` in the schemas) become the viewer's local calendar date. Calendar dates (`dueDate`, `targetDate`, `treatmentResolveDate`, `nextReviewDate`, all `date`) are written as their UTC midnight, so they never slip a day. The file name uses the viewer's local date.
- **Log content (D-18, T-19-12, T-19-13).** The line is built from an allow-list. `filters`, `search` and `sort` are the parsed values, cut to 255 characters with controls and bidi characters removed. `view`, `columns`, `table`, `format` and `reason` are closed codes. No cell value or raw query is ever logged. `EXPORT_ROW_LIMIT` logs at warn and the other reasons at info. A 403 or 404 policy denial writes no export event.
- **File responses (T-19-14).** The response goes through `sendStoredFile` with exactly the two declared media types, a server-built name matching `^[a-z0-9][a-z0-9-]{0,150}\.(csv|xlsx)$` (the released stem lower-cased) and `X-CSRM-Row-Count`.
- **Phase 16's BE1-02 is fixed for the export.** `projectRiskRegisterItem` now has `accepted: isActiveRisk(document) && …`.

## Critical

None.

## Warnings

### BE1-01 (Warning): A control character, U+FFFD or a C1 character before a formula trigger escapes the neutraliser, then `write-excel-file` strips it, so the workbook holds an unmarked `=…` string

**Files:**
- `apps/backend/src/csrm/spreadsheets/neutralise.ts:16` (`NEEDS_MARK`)
- `apps/backend/src/csrm/spreadsheets/xlsx-writer.ts:52-54` (`cell`: neutralise first, then hand the string to the library)
- `apps/backend/node_modules/write-excel-file/modules/xml/removeInvalidXmlCharacters.js:1-20` (the library strips `[\0-\x08\x0B\f\x0E-\x1F�￾￿]`, lone surrogates and the "discouraged" `\x7F-\x84\x86-\x9F﷐-﷯` from every text node)

**Evidence.**
- `NEEDS_MARK` marks a value only when a trigger is at the start, or after a run of quotes or `\s` whitespace. A leading U+0001, U+FFFD or U+0085 is none of those (JS `\s` does not include C0, C1 or U+FFFD), so `"\u0001=HYPERLINK(\"http://evil\",\"x\")"` is left unmarked.
- The library then removes the U+0001 while serialising the shared string.
- The scratchpad probe (`lane1-xlsx-probe.mjs`, run on the installed 4.1.1) printed `marked by neutraliser: [ false, false, false, true ]`. The shared strings were `<t>=HYPERLINK("http://evil","x")</t>`, `<t>=1+1</t>`, `<t>=1+1</t>` and `<t>'=1+1</t>`.
- No free-text input strips control characters. The only control-character filters in `api/` and `csrm/` are in `analyst-instruction.ts` and `attachment-policy.ts`. So a Requestor can plant such a value in a request title, which reaches the analyst's Requests, Questionnaires and Risk assessments workbooks.
- The same stripping silently changes any value that holds these characters anywhere, U+FFFD included. The XLSX copy of a record therefore differs from the stored record, and the CSV copy does not.

**Why it matters.**
- The approved record says one neutraliser "applies to every text cell in both formats" (Formats, Values and Neutralisation). T-19-05 and T-19-49 say "One neutraliser on every text cell in both formats".
- The `@` string cell means Excel does not evaluate the value on open, so this is not a direct code-execution path. The mark exists for what comes after: a user re-saves the workbook as CSV, or copies cells into another sheet, or CSRM's own import reads the value back. In each case the value now arrives as a bare `=HYPERLINK(...)`, which is the payload the neutraliser exists to defuse.
- A Requestor-controlled field reaches an analyst's file this way.

**Fix.** Remove the characters the library would strip before neutralising, so the neutraliser sees the string that will actually be written, and document the change (the round trip is then lossless for the XLSX that CSRM actually writes). For example, in `xlsx-writer.ts`:

```ts
// The characters write-excel-file drops from XML text (removeInvalidXmlCharacters), removed first so the
// neutraliser decides on the string the workbook will actually hold.
const XML_DROPPED = /[\0-\x08\x0B\f\x0E-\x1F\x7F-\x84\x86-\x9F﷐-﷯�￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
if (value.kind === "text") return { value: sanitizeSpreadsheetCell(value.value.replace(XML_DROPPED, "")), type: String, format: TEXT_FORMAT };
```

Alternatively, widen `NEEDS_MARK` so that `[\p{Cc}�]` counts as part of the leading-whitespace run (`^'*(?:[=+\-@\t\r\n＝＋－＠]|[\s\p{Cc}�]+[=+\-@＝＋－＠])`). That keeps `stripNeutraliserMark` an exact inverse, because it re-tests `needsNeutraliser(rest)`. Do one of the two, and record the XLSX character loss in the record's Values section.

**Test.** In `spreadsheet-writers.unit.test.ts`, write a workbook with the text cells `"\u0001=1+1"`, `"�=1+1"` and `"\u0085=1+1"`. Read `xl/sharedStrings.xml` back through `readSheetXml` and assert that every `<t>` that starts with `=` starts with `'=`. Today all three come back as a bare `=1+1`.

### BE1-02 (Warning): Nothing bounds an XLSX cell at Excel's 32,767-character limit, while the contract serves text of up to 65,535 characters

**Files:** `apps/backend/src/csrm/spreadsheets/xlsx-writer.ts:52-61` (`cell`), `apps/backend/src/csrm/exports/run-export.ts:126-128,144-151` (`textCell`, `typedCell`). The values come from `docs/references/specification.json:29611` (`AssessmentRiskListItem.riskStatement` and `.treatmentPlan`, `maxLength: 65535`), and the schemas declare `riskStatement`, `treatmentPlan`, `summary`, `overallRiskRationale` and `recommendationsSummary` as unbounded `text`.

**Evidence.**
- The writer passes any string length to the library, and `typedCell` never measures it.
- The released assessment's Summary sheet (summary, overall rationale, recommendations) and its Risks sheet (statement, treatment plan), and the register's statement and treatment plan columns, can all carry more than 32,767 characters.
- Microsoft's documented specification limit is 32,767 characters per cell. A longer value is cut when Excel opens or imports the file, and Excel is reported to offer a "repair" for an XLSX that holds one (that part is uncertain).
- The record, `19-UI-SPEC`, `19-CONTEXT` and the plans never mention the limit (`grep 32,767|32767` over the phase directory finds nothing).

**Why it matters.**
- The released export is the Requestor's copy of a released record, and the record says "a partial released record would misrepresent it" (UI-D5).
- A value cut on open is silent data loss in the delivered file. If the analyst then edits the file and re-imports it, the cut value is written back.
- The CSV path has the same exposure once the file is opened in Excel.

**Fix.** Decide the rule in a dated amendment to the record. Then enforce it in one place, the writers. One option is to refuse the export with a closed reason. Another is to write the first 32,767 characters with a visible marker, add an About-sheet row naming the truncated columns, and make the import refuse a marked cell. A third is to split the value across continuation columns. Whichever is chosen, `typedCell` or the writer must apply it, and the spec descriptions must say so.

**Test.** In `export-pipeline.unit.test.ts`, run `runFixedTableExport` for a released assessment whose `summary` is 40,000 characters. Assert the agreed behaviour (a refusal with its reason, or a marked 32,767-character cell plus the About-sheet row). Today the 40,000 characters are written as they are.

### BE1-03 (Warning): The `columns` pattern of the two assessment list exports is malformed in `specification.json`

**File:** `docs/references/specification.json:23177` (`GET /v1/risk_assessments/export`) and `:23833` (`GET /v1/my_risk_assessments/export`). Both were introduced in `87961422` (19-10).

**Evidence.**
- Both patterns read `^[a-zA-Z][a-zA-Z0-9]{0,63 }(,[a-zA-Z][a-zA-Z0-9]{0,63 }){0,39 }$`, with a space inside each quantifier. The ten other list exports carry the correct `{0,63}` / `{0,39}`.
- `new RegExp(p)` treats the braces as literal text, so the pattern rejects every valid value: `assessmentNumber` returns `false`.
- `new RegExp(p, "u")`, which is how JSON Schema validators such as Ajv compile patterns, throws `Incomplete quantifier`.

**Why it matters.**
- The specification is the authoritative API reference (AGENTS.md, reference 2). A generated client, a schema-driven request validator or a contract fuzzer either crashes on these two operations or refuses every `columns` value Strapi accepts.
- The approved record fixes the pattern as `^[a-zA-Z][a-zA-Z0-9]{0,63}$` per key, 1 to 40 keys. These two entries depart from it.
- No contract guard compiles query-parameter patterns, so nothing caught it.

**Fix.** Replace both patterns with `^[a-zA-Z][a-zA-Z0-9]{0,63}(,[a-zA-Z][a-zA-Z0-9]{0,63}){0,39}$`.

**Test.** Add a contract test (for example in `contract-catalogue.integration.test.ts`, or a small unit test over the JSON). It compiles every `schema.pattern` in `specification.json` with `new RegExp(pattern, "u")`. For each export operation's `columns` parameter, it asserts that the view's visible keys joined with commas match, as `exportViewColumns(view)` gives them. Today it throws on the two assessment exports.

## Info

### BE1-04 (Info): The pipeline promises one line per attempt, but a failure after parsing writes none, and some refused lines lose facts the pipeline already had

**Files:** `apps/backend/src/csrm/exports/run-export.ts:271-273` (the docstring), `:286-299`, `:313-314`, `:316-341`; `apps/backend/src/csrm/audit/security-event-log.ts:251-253` (`actorOf`).

**Evidence.**
- The docstring says "Every attempt that passes the scope writes exactly one `export.completed` or `export.refused` line", and T-19-12 says "One … line per attempt". But only `ExportQueryError` and the cap are logged. These failures write nothing:
  - a hydrate that cannot find a chosen row (`RiskRegisterError(400)` at `export-views.ts:266`, `AdministrationValidationError` at `:1026`, both answered as an ordinary 400);
  - a `cellFault` TypeError;
  - a writer `RangeError`;
  - a database error.
- When `parseExportControls` fails on `columns` after a valid `format`, `controls` is still `null`, so the line says `format: "unknown"`.
- The race refusal logs, and answers, `rowCount: 10001` (`ids.length`), not the count.
- The new export lines carry `actor.displayName` through `actorOf` unchanged. The same lines run `freeText` (control and bidi stripping) on `search`, so a display name with U+202E reaches the SIEM as it is. This is pre-existing for attachment lines, but Phase 19 adds new lines.

**Fix.** Either narrow the docstring to the outcomes the record names, or (through a record amendment) log a failed attempt with a closed reason such as `EXPORT_FAILED` from a `finally` that knows whether a line was written. Keep the parsed format by assigning `format` before `columns` is parsed. Run `actor.displayName` through `freeText` in `exportFields` and `importFields`.

**Test.** In `export-pipeline.unit.test.ts`, give the register view a hydrate that drops one id. Assert the agreed outcome (today: a 400 with zero captured lines). Add a case for `format=csv&columns=bogus` that asserts the line's `format` is `csv`.

### BE1-05 (Info): The writers neutralise data cells but never the header row

**Files:** `apps/backend/src/csrm/spreadsheets/csv-writer.ts:44` (`document.header.map(quote)`), `apps/backend/src/csrm/spreadsheets/xlsx-writer.ts:77` (header cells without `sanitizeSpreadsheetCell` or the `@` format).

**Evidence.**
- Every export header today is a static vocabulary label, so nothing is exploitable now.
- The one caller with data-derived headers, the import error report, neutralises them by hand (`administration-workflow.ts:918`).
- `neutralise.ts`'s header comment says "Every text cell CSRM writes to a CSV or a workbook passes through sanitizeSpreadsheetCell". At the writer boundary that is not true for the header row. Phases 18, 20 and 22 reuse these writers (record, "Later Phases").

**Fix.** Neutralise header labels inside both writers. The error report would then pass `stripNeutraliserMark(header)` (the raw value) and let the writer mark it once, so the label is not marked twice. Alternatively, have the writers assert `!needsNeutraliser(label)` and throw.

### BE1-06 (Info): The assessment list exports hydrate by id with no scope filter, which departs from the read module's "both rules twice" and from My requests

**File:** `apps/backend/src/csrm/exports/export-views.ts:898-907` (`hydrate`: `filters: { documentId: { $in: ids } }` only).

**Evidence.**
- `selectIds` applies the scoped `countQuery`, but the hydrate re-reads by id alone. No in-memory `isReadableReleasedAssessment` check follows, unlike the read module's stated rule ("Each read applies both rules twice … so a filter is never trusted alone").
- My requests' hydrate does re-bind the owner (`my-requests.ts`, `requestor: { id: { $eq: requestorId } }`).
- A record that leaves scope between the two reads is still written. Phase 17.1's request `closed` transition is the realistic case.

**Fix.** Hydrate with `filters: composeAssessmentFilters(parsed.countQuery.filters, { documentId: { $in: ids } })` (or `$and`), and filter the owner variant with `isReadableReleasedAssessment(document, { kind: "requestor", documentId })`.

### BE1-07 (Info): The released export inherits the released reads' silent 1,000-row limits

**Files:** `apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts:208` (`readAssessmentRisks`, `limit: 1_000`), `:216` (`readRiskControlImplementations`, `limit: 1_000`).

**Evidence.**
- An assessment with more than 1,000 active Risks, or a Risk with more than 1,000 implementations, exports a cut table with no refusal and no About-sheet note.
- That is consistent with what the released reads show, so it matches D-21's "exactly what the read discloses". It sits awkwardly with D-17's "never a partial file" and with `MAX_ASSESSMENT_RISKS`, which exists for the same bound.

**Fix.** Read with `limit: MAX_ASSESSMENT_RISKS + 1`, and refuse (or flag) when the bound is exceeded, in both the read and the export.

### BE1-08 (Info): The approved record contradicts itself, and the spec, on an invalid time zone

**File:** `docs/contract-gaps/phase-19-exports-and-export-log.md:156` against `:70`.

**Evidence.**
- Line 156 says "an absent or invalid zone falls back to UTC, and the About sheet names the fallback".
- Line 70, every export's `timeZone` description in `specification.json` ("A zone the server does not know is a 400") and `export-time.ts:21-25` all refuse it.
- A web caller built from line 156 would expect a file where Strapi answers 400.

**Fix.** Correct line 156 to "an absent zone falls back to UTC …; an unknown one is a 400" with a dated note. The pilot's approval covers the contract as served.

### BE1-09 (Info): A questionnaire export with a status filter loads the whole scope, with its questions, before the cap is checked

**File:** `apps/backend/src/csrm/exports/export-views.ts:626-629` (`count` for a set `status`: `(await read(parsed)).length`); `questionnaire-scope.ts` (`populate: { questions: true }`).

**Evidence.**
- T-19-11 and the record say the count comes "before it generates anything". With `status` set, the count is the full in-memory load of every questionnaire in scope and all its questions.
- The list does the same, and the view's comment admits it ("Without a status filter the scope's count is read first"). The cap therefore bounds the file, but not the memory of an over-cap attempt.

**Fix.** When `status` is set, read `documents().count(parsed.countQuery)` first and refuse when that upper bound already exceeds the cap. Only when it is within the cap, load the scope and count exactly.

### BE1-10 (Info): The views handle a row that disappears between selecting ids and hydrating in three different ways, and no test covers the race

**Files:** `apps/backend/src/csrm/exports/export-views.ts:264-268` (the register throws a 400 "data is invalid"), `:1024-1028` (reference lists throw `AdministrationValidationError`, answered 400), and `:412-414`, `:511-514`, `:904-907`, `:638-641`, `:759-762` (requests, My requests, assessments, questionnaires and alerts drop the row, so the file and `X-CSRM-Row-Count` are one short).

**Evidence.**
- Both throwing variants answer the caller with the same reasonless 400 an invalid query gets, and log no line (BE1-04).
- The pipeline's Pitfall 8 guard covers growth only, not removal.
- No unit or integration case covers either behaviour.

**Fix.** Pick one rule (drop the row, matching the lists' "a request removed between the two reads is not shown"), apply it in every view, and cover it with one pipeline unit test that uses a hydrate missing an id.

---

_Reviewed: 2026-10-17_
_Reviewer: Claude (gsd-code-reviewer), lane 1 backend export pipeline_
_Depth: deep_

## backend authorisation, catalogue and export routes lane

---
phase: 19-csv-export-and-import-hardening
lane: backend-authorisation-catalogue-routes
reviewed: 2026-10-17
depth: deep
diff_base: bdd0f698
files_reviewed: 42
files_reviewed_list:
  - apps/backend/src/policies/csrm-authorization.ts
  - apps/backend/src/api/csrm-current-user/services/effective-access.ts
  - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - docs/references/idambox-csrm-role-function-api-catalogue.json
  - docs/references/served-operations.json
  - docs/references/specification.json
  - apps/backend/src/csrm/conflict-reasons.ts
  - apps/backend/src/api/csrm-administration/operations.ts
  - apps/backend/src/api/csrm-administration/routes/csrm-administration.ts
  - apps/backend/src/api/csrm-administration/controllers/csrm-administration.ts
  - apps/backend/src/api/csrm-analyst-insight/operations.ts
  - apps/backend/src/api/csrm-analyst-insight/routes/alerts.ts
  - apps/backend/src/api/csrm-analyst-insight/routes/reports.ts
  - apps/backend/src/api/csrm-analyst-insight/controllers/alerts.ts
  - apps/backend/src/api/csrm-analyst-insight/controllers/reports.ts
  - apps/backend/src/api/csrm-analyst-insight/services/report-query.ts
  - apps/backend/src/api/csrm-analyst-insight/services/alert-query.ts
  - apps/backend/src/api/csrm-assessment-request/operations.ts
  - apps/backend/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts
  - apps/backend/src/api/csrm-assessment-request/routes/my-requests.ts
  - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
  - apps/backend/src/api/csrm-assessment-request/controllers/my-requests.ts
  - apps/backend/src/api/csrm-assessment/operations.ts
  - apps/backend/src/api/csrm-assessment/routes/csrm-assessment.ts
  - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
  - apps/backend/src/api/csrm-assessment/services/released-assessment-read.ts
  - apps/backend/src/api/csrm-questionnaire/operations.ts
  - apps/backend/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts
  - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
  - apps/backend/src/api/csrm-risk/operations.ts
  - apps/backend/src/api/csrm-risk/routes/csrm-risk.ts
  - apps/backend/src/api/csrm-risk/controllers/csrm-risk.ts
  - apps/backend/tests/authorization-matrix.integration.test.ts
  - apps/backend/tests/authorization-policy.unit.test.ts
  - apps/backend/tests/authorization.integration.test.ts
  - apps/backend/tests/contract-catalogue.integration.test.ts
  - apps/backend/tests/served-operations.integration.test.ts
  - apps/backend/tests/analyst-insight-catalogue-seed.integration.test.ts
  - apps/backend/tests/analyst-insight-routes.unit.test.ts
  - apps/backend/tests/keycloak-identity.unit.test.ts
  - apps/backend/tests/fixtures/authorization-matrix.ts
  - apps/backend/tests/conflict-reasons.unit.test.ts
findings:
  critical: 0
  warning: 0
  info: 11
  total: 11
status: issues_found
---

# Phase 19 backend authorisation, catalogue and export routes review

Scope: Phase 19's change (`bdd0f698..HEAD`) to Strapi authorisation and its contract. That covers the policy's new `underlyingRead` rule, `SERVICE_IDENTITY_REFUSED_OPERATIONS` and the human-only additions; `isOperationGranted` in effective access; the catalogue moves and grants; served-operations and the specification for the 22 new operations; and their routes and controllers. I traced each route from its policy config through the policy branch it reaches, then into the view's `assertScope` and parser (`csrm/exports/export-views.ts`, `run-export.ts`, `send-export.ts`, `export-errors.ts`), the record-read module, `eligible-person.ts` and the catalogue seeder (`bootstrap/seed-csrm-data.ts`). I report only on Phase 19's change. I ran no test.

What holds, checked against the code rather than the comments:

- **Every operation goes through the policy with the right FunctionAPI.** That is 22 operations: 14 exports, 4 templates and 4 error reports. Each route carries `global::csrm-app-enabled` then `global::csrm-authorization`, with its catalogue URL as `operation`. The four reference-list exports and the register export use the full `?format={format}` literal. The operation constant, route config, catalogue `url`, policy literal and fixture mirror all agree, and `served-operations.json` records the same `policyConfig` for all 22 (no collisions, no uncatalogued route). Every export route is registered before the `/:id` route it could be captured by. Every route is token-only.
- **Each export is no wider than the read it exports.** Every export names its list read as `underlyingRead`, and the policy checks it before any scope branch (`csrm-authorization.ts:495-501`). The read must come through the same path that admitted the export: the human Security Analyst role for an analyst export, explicit or birthright roles otherwise. Each export keeps its list's scope flags, so the record-level scope is the list's:
  - **Owner-scoped exports:** My requests (`requireRequestCollectionScope`, numeric owner id from the resolved user); My questionnaires (`requireQuestionnaireCollectionScope`, owner, released only for the requestor actor); My risk assessments (`requireAssessmentOwnerCollectionScope`, the resolved `documentId`).
  - **Analyst-wide exports:** the review queue (`requireAnalystRequestCollectionScope`); questionnaires for review (`allowAnalystQuestionnaireReviewScope`); the register (`requireAnalystRiskRegisterScope`, also asserted in the handler); alerts and reports (`requireAnalystInsightScope` plus Phase 7's four underlying reads); the four reference lists (`requireAnalystAdministrationScope`).
  - Each view's `assertScope` re-checks the scope the policy set. None reads a query value as an owner.
- **The released export.** It reads through `findReadableReleasedAssessment` with the policy's resolved viewer. A Requestor at another person's assessment, or at their own unreleased one, gets the missing record's 404 before the query is read and before anything is logged. An analyst gets 404 for a missing assessment and 409 `ASSESSMENT_NOT_RELEASED` for an unreleased one. The query keys are closed. The old owner-only helpers are gone: grep finds no `isReleasedAssessmentForOwner`, `releasedAssessmentQuery` or `releasedForOwner`.
- **The service identity and the human-only set.** `SERVICE_IDENTITY_REFUSED_OPERATIONS` holds exactly the record's 14 exports, and the policy checks it before the human-only check (`:485-488`), using `isEligiblePerson` on the resolved roles. `HUMAN_ANALYST_ONLY_OPERATIONS` gains the 10 analyst exports, which brings the matrix count to 41. The released export and the three My exports are correctly left out, because Requestors reach them. Templates and error reports are refused to the agent by their Administration Functions and the Administration scope, as the record says (`phase-19-exports-and-export-log.md:106`).
- **Effective access agrees with the policy at the grant level.** `isOperationGranted` applies the same two sets with the same `isEligiblePerson` call, imported rather than copied. The agent is never offered an export its birthright holds, and every human is offered the exports the policy admits. With the shipped catalogue, every holder of an export also holds its read, so no session is offered an export the policy refuses. BE2-04 covers the structural exception.
- **The catalogue follows Role → Function → FunctionAPI.** The two copies are byte-identical (`cmp`), and roles, functions and FunctionApis are symmetric (scripted check). The new export Functions are API-only:
  - three human-only Functions held by `role.security_analyst` alone;
  - one Function on the Requestor birthright;
  - the released export in one Function held by both roles, so an analyst is admitted as an analyst.
  - The two reserved entries moved, with name, URL and description unchanged, out of Functions the agent holds. `role.security_analyst_agent` gains nothing.
  - The seeder resets each Function's `functionApis` to the catalogued list, so an existing database loses the old links. BE2-08 notes the orphaned rows left behind.
- **Inputs are validated and nothing unvalidated is echoed.**
  - Format, columns and time zone are closed in `parseExportControls` and `runFixedTableExport`.
  - The report body is closed: `format`, `table`, `timeZone` and a `query` of at most 16 strings, each at most 200 characters. An unknown key is a 404 before the body is read.
  - The template query is exactly `format`. The error report fields are closed and its token is pattern-checked.
  - Log lines record parsed values only. A logged format is filtered to `csv`/`xlsx`. The released export's `subject.documentId` is logged only after the record has been found.
- **Error reasons.** The 20 Phase 19 reasons are appended in order. The 409, 413, 415 and 422 statuses match the header comment (13 file refusals at 422). The export refusal type is closed to `EXPORT_ROW_LIMIT` and `ASSESSMENT_NOT_RELEASED`.
- **AGENTS.md.** No new code reads the auth mode or Keycloak (grep over the added lines). The actor is always `ctx.state.idamboxUser`. Navigation is not authorisation: every refusal is in Strapi.
- **Threat register (my area).** Each listed threat has its mitigation in code: T-19-15, -16, -17, -23, -24, -25, -26, -28, -30, -31, -32 and -50. BE2-11 notes that T-19-33's "source check" was a one-off grep, not a test.

I found no security hole and no contract departure that changes behaviour. The findings below are defence-in-depth gaps, test gaps, and records or comments that say more than the code does.

## Critical

None.

## Warnings

None.

## Info

### BE2-01 (Info): The released export requires only the detail read, but it discloses three reads

**Files:** `apps/backend/src/api/csrm-assessment/routes/csrm-assessment.ts:82`; `apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts:201-233` (`readAssessmentRisks`, `readRiskControlImplementations`, `releasedExportOf`); `apps/backend/src/policies/csrm-authorization.ts:255,495-501`.

**Evidence.**
- The route's `underlyingRead` is `CSRM_ASSESSMENT_OPERATIONS.findOne` (`GET:/api/v1/risk_assessments/{assessmentId}`) alone.
- The file holds three things: the detail, the released risks read (`GET:/api/v1/risk_assessments/{assessmentId}/risks`), and each risk's control implementations (`GET:/api/v1/risks/{riskId}/control_implementations`). D-21 and the handler's own comment call these "the three released reads".
- `underlyingRead?: string` can name only one read.
- Today every holder of the detail read also holds the other two. For the Requestor, all three sit in `function.risk_assessments.risk_assessment_details_read_only`. For the analyst, they come through `risk_assessment_details` and `risk_register.risk_details`. So nothing leaks now.

**Why it matters.** Under D-13, an export is never wider than the reads it discloses. Suppose a later catalogue edit withdrew the control-implementation read from a role. Callers holding that role would still get every mitigation control in the Mitigation controls sheet, while the read itself refused them. The plan specified `findOne` (19-10-PLAN.md:179), so this is not a departure, but the two-grant rule is weaker here than for the list exports.

**Fix.** Let the config take a list (`underlyingReads?: readonly string[]`), and require every member through the admitting path, as `requireAnalystInsightScope` does with `ANALYST_INSIGHT_UNDERLYING_READS`. For the released export, pass the three released reads.

**Test.** In `authorization-policy.unit.test.ts`: a Requestor whose birthright holds the released export and `findOne`, but not `GET:/api/v1/risk_assessments/{assessmentId}/risks`, is refused with `CSRM export requires the list read.` This fails today.

### BE2-02 (Info): Nothing tests `underlyingRead`'s birthright branch

**Files:** `apps/backend/src/policies/csrm-authorization.ts:497-499`; `apps/backend/tests/authorization-policy.unit.test.ts:875-893`; `apps/backend/tests/exports.integration.test.ts:1258-1262` (and the matching blocks for other exports).

**Evidence.**
- The only unit case on the list read exercises the human-analyst branch, at the register export.
- The HTTP cases withdraw the read from `"Security Analyst"` only (`withRoleOperationWithdrawn("Security Analyst", input.listRead, …)`).
- No unit or HTTP case removes `GET:/api/v1/my_requests`, `GET:/api/v1/my_questionnaires` or `GET:/api/v1/my_risk_assessments` from the Requestor birthright, or the detail read from the Requestor at the released export.
- The matrix denial proofs for the three My exports cover the agent, no identity, no token and a page, but not the read.

**Why it matters.** The `hasOperation(explicitRoles, read) || hasOperation(requestorRoles, read)` branch guards four Requestor-reachable exports, and nothing would catch it if it regressed to `true`.

**Fix and test.** Add a unit case per Requestor-reachable export, using the existing `exportPolicyStrapi` helper. The birthright holds the export but not its read, so the call is refused with `CSRM export requires the list read.`. Also add one HTTP case (`withRoleOperationWithdrawn("Requestor", "GET:/api/v1/my_requests", …)` → 403 for Jane).

### BE2-03 (Info): The matrix's refusal-set mirror is never compared with the policy's set

**Files:** `apps/backend/tests/authorization-matrix.integration.test.ts:287-299`; `apps/backend/tests/fixtures/authorization-matrix.ts` (`SERVICE_IDENTITY_REFUSED_OPERATIONS` mirror).

**Evidence.**
- The new matrix test iterates the fixture's hand-copied mirror. It checks that each mirror literal appears in the policy source and that its row denies the agent.
- The only size guard is `SERVICE_IDENTITY_REFUSED_OPERATIONS.length >= 1`.
- The policy exports the real set (`csrm-authorization.ts:165`), but the test never compares the two.

**Why it matters.** Phases 17 and 19.1 add members. A member added to the policy but not to the mirror would never get its matrix row checked, and a member left in the mirror would still pass, as long as its literal appeared anywhere in the source.

**Fix.** Import the policy's exported set and assert `deepEqual([...policySet].sort(), [...mirror].sort())`, or iterate the policy's set directly. Do the same for `HUMAN_ANALYST_ONLY_OPERATIONS`, whose guard counts only the mirror.

**Test.** That assertion is the test. It would fail if a policy literal were added without a mirror row.

### BE2-04 (Info): Effective access claims it is "never wider" than the policy, but ignores the second-read rules

**File:** `apps/backend/src/api/csrm-current-user/services/effective-access.ts:32-52`.

**Evidence.**
- The comment says the route scope checks, "insight and export underlying reads" included, "still apply on each call, so this list can only ever be as wide as the policy, never wider".
- Those checks are exactly what `isOperationGranted` does not apply. A session can therefore be offered an export whose `underlyingRead` it lacks, and the policy then refuses it. The insight scope's four reads and the Administration scope behave the same way.
- 19-06 (`19-06-PLAN.md:136`) makes the web anchor each export capability to both the export and its read, so the web compensates. The comment has the direction backwards: these checks can make the list wider than the policy, never narrower.

**Fix.** Either correct the comment (the list is the grant-level decision, and route-level reads are anchored by the web), or mirror `underlyingRead` in effective access through an operation-to-read map exported beside the routes. Any change to `keycloak-identity.unit.test.ts` needs a new Keycloak path ruling in `19-PILOT-RULINGS.md`, per the pilot's ruling of 2026-10-17.

### BE2-05 (Info): The refusal set's comment counts 18 exports; the set and the record hold 14

**File:** `apps/backend/src/policies/csrm-authorization.ts:162`.

**Evidence.** The comment says "Phase 19 adds its 18 export operations". The set lists 14 (`:165-191`), and the approved record says "Phase 19's members are the 14 export operations" (`phase-19-exports-and-export-log.md:106`). The 8 templates and error reports are deliberately not members.

**Fix.** Change the comment to say "its 14 export operations".

### BE2-06 (Info): The human-only refusal chooses the export wording by refusal-set membership, so later members will be worded wrongly

**File:** `apps/backend/src/policies/csrm-authorization.ts:224`.

**Evidence.** `humanAnalystDenialMessage` returns "CSRM analyst exports require a human Security Analyst." for any operation in `SERVICE_IDENTITY_REFUSED_OPERATIONS`. The record says Phases 17 and 19.1 add non-export members there, such as people search and notifications. A future member that is also human-only would then be refused in the exports' words.

**Fix.** Keep a dedicated `HUMAN_ONLY_EXPORT_OPERATIONS` (the 10 analyst literals), spread it into `HUMAN_ANALYST_ONLY_OPERATIONS`, and branch the wording on that set.

### BE2-07 (Info): The Reports menu Function is now empty, but still granted to the agent

**File:** `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json:1427-1440` (`function.reports.reports`).

**Evidence.**
- After 19-09's move, `function.reports.reports` has `functionApiIds: []`, but it keeps `menuPath: "Reports:Reports"` and `roleIds` including `role.security_analyst_agent`.
- `summariseEffectiveAccess` adds a menu Function whatever its operations (`effective-access.ts:63-65`). The agent's `/v1/me/access` therefore still lists a Reports menu Function, behind which it can reach nothing.
- The seed test pins the empty Function (`analyst-insight-catalogue-seed.integration.test.ts:156`).

**Why it matters.** It is not a hole, because navigation is not authorisation. It is a grant with no purpose on the automation role, which the Phase 22 role review should not have to discover.

**Fix.** Record it for the Phase 22 role review. Alternatively, drop `role.security_analyst_agent` from the Function in a dated catalogue amendment.

### BE2-08 (Info): Re-seeding an existing database leaves orphaned FunctionApi rows for the two moved URLs

**File:** `apps/backend/src/bootstrap/seed-csrm-data.ts:966-1007`.

**Evidence.**
- The seeder matches a FunctionApi only among the Function's own populated `functionApis`.
- The new `function.risk_register.export_api` and `function.reports.export_api` have none, so the seeder creates fresh FunctionApi documents for `GET:/api/v1/risks/export?format={format}` and `POST:/api/v1/reports/{reportKey}/export`.
- The old Functions are then updated to their catalogued lists, which disconnects the old documents (a unidirectional `oneToMany`) but never deletes them.

**Why it matters.** Grants are read through Role → Function → FunctionApi, so an orphan grants nothing. It does leave two rows in the Content Manager carrying export URLs and no owner, which confuses an audit of who can export.

**Fix.** Before creating a FunctionApi, look it up by catalogue `url` and `name` across all FunctionApis, then reuse it and relink it. Or delete FunctionApis that no Function references at the end of the seed.

**Test.** A seed integration case: seed the pre-Phase-19 catalogue, re-seed the current one, and assert that exactly one `api::function-api.function-api` row has each export URL.

### BE2-09 (Info): The report export ignores the URL query string

**File:** `apps/backend/src/api/csrm-analyst-insight/controllers/reports.ts:95-133`.

**Evidence.**
- The handler reads only `ctx.params.reportKey` and `ctx.request.body`.
- `POST /api/v1/reports/assessment-throughput/export?period=12` therefore exports the 6-month default without complaint. The report read refuses unknown query keys (`parseReportRequest`), and so does every list export.
- The web sends the period in `body.query` (`apps/csrm/src/features/reports/report-service.ts:135-142`), so the web is unaffected.

**Fix.** Call `assertEmptyReportQuery(ctx.query)` inside the existing inner `try`, so a query string is a 400 with one `export.refused` line.

**Test.** Add to `exports.integration.test.ts` › reports: a POST with `?period=12` and a valid body is a 400 with one `INVALID_QUERY` line.

### BE2-10 (Info): The export contracts misstate the 403 rule and omit filters the server parses

**Files:**
- `docs/references/specification.json:22781, 23044, 23229, 23852` (403 descriptions);
- `:26145` and `:27102` (`/v1/information_systems/export` and `/v1/information_assets/export` parameters);
- `apps/backend/src/csrm/exports/export-views.ts:958-969`;
- `apps/backend/src/api/csrm-administration/services/administration-query.ts:99-121`.

**Evidence.**
- **The 403 rule.** Four 403 descriptions say the identity "holds neither the export nor the list read". The policy refuses a caller who lacks either one (`csrm-authorization.ts:480-501`).
- **The missing filters.** Both reference-list exports publish only `q`, `sort`, `format`, `columns` and `timeZone`. But `parseAdministrationExportQuery` accepts `environment`, `deploymentModel`, `lifecycleState` and `internetFacing` for systems, and `dataClassification` and the three `contains*` flags for assets. The export's About sheet has labels for them (`REFERENCE_FILTER_LABELS`).
- The list operations have the same gap from Phase 6, and the exports copied it.

**Fix.** Reword the four descriptions to "lacks the export or the list read". Publish the parsed filters on both exports, and on their lists, as `controls` already does with `framework` and `controlType`.

### BE2-11 (Info): T-19-33's "source check" is not a test

**Files:** `.planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-10-PLAN.md:390`; `19-10-SUMMARY.md:132`; `apps/backend/tests/released-assessment-read.unit.test.ts`.

**Evidence.**
- The threat register says the gathered owner-only helpers are removed, "proven by a source check".
- The SUMMARY records a one-off `git grep` at execution time. No test under `apps/backend/tests` scans the source for a reintroduced owner comparison, such as `requestor: { documentId: { $eq` or `requestor?.documentId ===`.
- Today, the only such comparisons are in `released-assessment-read.ts:69,97`.

**Why it matters.** Phases 17 and 17.1 are meant to widen readability in one module. A second owner check added elsewhere would silently keep the narrow rule.

**Fix.** Add a unit source scan over `src/api/csrm-assessment` and `src/csrm/exports`. It should assert that no requestor-ownership predicate appears outside `released-assessment-read.ts`, as `active-risk-readers.unit.test.ts` does for the active-risk rule.

**Overlaps, noted for other lanes and not counted here.**
- Lane 1: the released export reads at most 1,000 Risks, and at most 1,000 control implementations per Risk (`csrm-assessment.ts:201-216`). Past either bound it would write a partial file, not refuse with `EXPORT_ROW_LIMIT`. The released reads share the bound.
- Lane 3: the error report's 409, 413, 415 and 422 bodies come from the Administration handler as `name: "AdministrationImportRefusal"`, while the spec declares `AssessmentWorkflowErrorResponse`.

---

_Reviewed: 2026-10-17_
_Reviewer: Claude (gsd-code-reviewer), lane 2 backend authorisation, catalogue and export routes_
_Depth: deep_

## backend import-tolerance lane

---
phase: 19-csv-export-and-import-hardening
lane: backend-import-tolerance
reviewed: 2026-10-17
depth: deep
diff_base: bdd0f698
files_reviewed: 16
files_reviewed_list:
  - apps/backend/src/csrm/spreadsheets/import-file.ts
  - apps/backend/src/csrm/spreadsheets/xlsx-reader.ts
  - apps/backend/src/csrm/spreadsheets/header-match.ts
  - apps/backend/src/csrm/spreadsheets/value-convert.ts
  - apps/backend/src/csrm/spreadsheets/neutralise.ts
  - apps/backend/src/csrm/spreadsheets/csv-writer.ts
  - apps/backend/src/csrm/spreadsheets/xlsx-writer.ts
  - apps/backend/src/api/csrm-administration/services/csv-import.ts
  - apps/backend/src/api/csrm-administration/services/administration-workflow.ts
  - apps/backend/src/api/csrm-administration/services/administration-query.ts
  - apps/backend/src/api/csrm-administration/controllers/csrm-administration.ts
  - apps/backend/src/csrm/exports/export-vocabulary.ts
  - apps/backend/src/csrm/exports/export-vocabulary.json
  - docs/contract-gaps/phase-19-import-tolerance.md
  - docs/references/specification.json
  - apps/backend/tests/spreadsheet-reading.unit.test.ts
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 19 backend import-tolerance review

Scope: the Phase 19 change to Strapi import tolerance, diffed `bdd0f698..HEAD`: the one import reader (`import-file.ts`), the XLSX reader's new `readFirstSheet` path (`xlsx-reader.ts`), the header matcher (`header-match.ts`), the value converters (`value-convert.ts`), the neutraliser's import side (`neutralise.ts`), the classifier and the sixth `similar` state (`csv-import.ts`), the commit's decisions/result records/templates/error reports (`administration-workflow.ts`), `IMPORT_CSV_MALFORMED` and the file-refusal set, and the import vocabulary. I traced the upload path from the controller through `readImportUpload` → `readImportFile` → `readCsv`/`readXlsx` → `classifyAdministrationImport` → `classifyRows` → `commitAdministrationImport`, and I ran the compiled modules (`.tmp/tests-dist`) directly with crafted fixtures to confirm the CSV, XLSX used-range and classifier behaviour. The threat-model rows checked are T-19-05/06/07/08/09, T-19-43..49, T-19-51.

What holds, verified against the code and by execution rather than the comments:

- **CSV encoding and delimiter order (T-19-08).** `decodeStrictUtf8` uses a fatal `TextDecoder`, drops a UTF-8 BOM, and splits a non-UTF-8 file into `IMPORT_ENCODING_WINDOWS_1252` vs `IMPORT_ENCODING_UNKNOWN` by the five undefined Windows-1252 bytes. The header-line delimiter check and the encoding/row checks run before the parse, so a Windows-1252 or semicolon file keeps its own reason (confirmed: a quoted-header semicolon still refuses `IMPORT_DELIMITER`). No legacy decoding is attempted.
- **`IMPORT_CSV_MALFORMED` (pilot ruling 3, the 2026-10-17 amendment).** A real CSV the parser rejects (unclosed quote, stray quote, ragged row) becomes 422 `IMPORT_CSV_MALFORMED`, with `found.line` a positive integer only (guarded in `boundFound`), never the line's content. Confirmed by running the parser against each shape; `found` carries only `{ line }`.
- **Formula-injection round trip (T-19-05, T-19-49).** `sanitizeSpreadsheetCell`/`stripNeutraliserMark` are exact inverses including the leading quote-run; the writers neutralise every text cell and never emit `type: "Formula"`; the import strips exactly one mark only before a trigger. Templates, error reports and reference exports all route text through the one neutraliser.
- **XLSX macro/encrypted/legacy and archive bounds (T-19-06, T-19-09).** `readXlsx` refuses `xl/vbaProject.bin` and a macro-enabled content type, and `readImportFile` tells a CFB legacy `.xls` from an encrypted package by the `EncryptedPackage` marker before any inflate. `readZipDirectory(XLSX_IMPORT_BOUNDS)` enforces 512 entries / 50 MiB declared / ratio 200 / no ZIP64, and every inflate is bounded by a single 50 MiB budget. The zip-bomb, entry-flood and ZIP64 fixtures refuse as `IMPORT_WORKBOOK_TOO_LARGE`.
- **The decision gate (T-19-43, T-19-44).** Nothing is written at preview. The commit re-classifies from the live records, rejects drift (`rowNumber`/`state`/`matchedDocumentId`/`matchedUpdatedAt`/`matchedName`), checks `decisions` against the retained preview (never client rows), refuses an undecided `similar` row with 409 `IMPORT_DECISION_MISSING`, and refuses a non-`similar` decision with 400. A `similar` row is written only with an explicit `update`, inside the per-row transaction, keeping the stored name. Uniqueness keeps the broad `normalizeAdministrationNaturalKey`, so a case-only create is never offered.
- **Preview/result records (T-19-45).** Both stores share `makeRoom` (256 global, 16 per actor+kind, 5-minute TTL), `newToken` (32 random bytes), and bind to `actorDocumentId`+`kind`; retained issue data is capped at 1 MiB (`MAX_RETAINED_ISSUE_BYTES`) and refused as `IMPORT_WORKBOOK_TOO_LARGE`.
- **Error report as a reflection channel (T-19-48).** Built only from the uploader's own file and the server's record for the same actor+kind, with the digest checked; `errorReportFields` closes the body to `previewDigest`/`resultToken`/`timeZone` so a client `issues` field is refused; messages are regenerated from retained codes; cells are re-neutralised. No value the actor cannot already read is disclosed.
- **Templates (D-31).** `buildImportTemplate` draws headers, example row, formats and the Notes sheet from the import vocabulary, so a template cannot drift from what the import accepts; I diffed the import columns against the reference-export view columns and they match (the read-only `Owner`/`Applicable controls` columns are the documented, ignored extras).

The findings below are where the code departs from the approved record or a published contract, or where a server-side bound is weaker than the record claims.

## Critical

### BE3-01 (Critical): The XLSX used-range guard counts only valued cells, so a high empty `<row>` number (or a first sheet outside `xl/worksheets/`) bypasses both the 1,024-column and the 5,000-row caps and exhausts the heap

**File(s):** `apps/backend/src/csrm/spreadsheets/import-file.ts:356-374` (`usedRange`), `:409-420` (sheet selection and the bound checks in `readXlsx`), `:319-322` (`keptPart`).

**Evidence.**
- `usedRange` advances only on `<c>` elements whose content matches `/<(?:…:)?(?:v|t)\b[^>]*>[^<]/` — a cell that actually carries a value. A `<row r="N"/>` element with no cells, and a `<c r="…"/>` with no value, contribute nothing to `rows`/`columns`.
- The reading library (`read-excel-file`) does the opposite: on each `</row>` it fills the gap up to the row's `r` attribute (`while (state.rowNumber > … ) state.rows.push([])`, `modules/xlsx/parseSheet.js`), so it materialises one array per row index up to the highest `<row r>`, whether or not those rows hold a value. The guard therefore measures something different from what the library allocates.
- Running the compiled reader (`readImportFile`) against a ~1.9 KB workbook whose first sheet is `Name`/`P` plus a single trailing `<row r="30000000"></row>`: the used-range check passes (it sees 2 rows), and the library then allocated ~1.65 GB of heap for `rows.length === 1`. At `<row r="200000000"/>` the process died with `FATAL ERROR: … JavaScript heap out of memory` before any row-count or classifier bound could run. `IMPORT_TOO_MANY_ROWS` only ever fires on `shapeRows`, which runs after the library has already built the array.
- A second, independent bypass of the same guard: `keptPart` retains only `[content_types].xml`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels` and parts under `xl/worksheets/`. When the first sheet's relationship target resolves to any other path (e.g. `xl/data/s.xml`, which the OOXML spec permits), `parts.has(first)` is false and the fallback filter (`name.startsWith("xl/worksheets/")`) finds nothing, so the `for (const xml of sheets)` loop runs zero iterations and neither the column nor the row bound is applied. The library still reads that sheet (it reads sheet position 1 from the canonical rebuilt archive, which keeps every `.xml` part). Confirmed: a workbook with a `ZZZ1` cell at `xl/data/s.xml` read with `header width 18278` (past the 1,024-column cap), and the same sheet with `XFD20000` OOM-ed the process.
- The 2026-10-17 amendment and the pilot's approval claim exactly this is prevented: "a two-cell file spanning A1 to XFD1048576 would otherwise expand to billions of cells before any row bound applies … refusing an expansion bomb before any cell is materialised." The guard does refuse `buildSparseWorkbook([["A1","Name"],["XFD2",1]])` (a *valued* far cell on a standard worksheet), which is the only case the one test exercises (`spreadsheet-reading.unit.test.ts:297`), but not the empty-row or non-standard-path variants.

**Why it matters.** A Security Analyst import endpoint accepts a ~2 KB `.xlsx` that crashes the Strapi process (single-process boundary, per the import record), a denial of service from a file that passes every declared bound. This is the exact DoS T-19-06 and the column-cap amendment set out to close, left open for two reachable encodings of the same attack. It is pre-authentication-cheap for any holder of the import operation and needs no large upload.

**Fix.** Make the guard measure what the library allocates, and measure the sheet the library actually reads:
- In `usedRange`, track the maximum row number from every `<row r>` and the maximum column from every `<c r>` reference regardless of whether the cell holds a value (parse the `r`/`ref` attributes unconditionally), since the library pads by index. Keep the existing value-bearing logic only for trimming trailing blanks, not for the bound.
- Select the sheet to check by the same rule the reader uses: resolve the first `<sheet>` relationship target and check *that* part, and when it cannot be resolved or is not retained, refuse (`IMPORT_FILE_TYPE`) rather than skipping the check. Alternatively, retain every worksheet-typed part (by `[Content_Types].xml` override) in `keptPart`, not only those under `xl/worksheets/`.
- Belt-and-braces: pass a hard row/column ceiling into the reader so the library itself cannot materialise beyond `IMPORT_MAX_ROWS + 1` rows.

**Test.** Add to `spreadsheet-reading.unit.test.ts`: (a) `assertRefused(xlsx(<workbook whose first sheet ends with an empty `<row r="200000">`>), "IMPORT_TOO_MANY_ROWS")`; (b) `assertRefused(xlsx(<workbook whose sheet1 relationship target is `xl/data/s.xml` with a `ZZZ1` cell>), "IMPORT_WORKBOOK_TOO_LARGE")`. Both currently hang/OOM or read instead of refusing. `spreadsheet-fixtures.ts` needs a `buildSparseWorkbook` variant that takes the worksheet part name and lets a row carry an `r` with no cell.

## Warnings

### BE3-02 (Warning): An unknown header made only of control or bidi characters becomes an empty-string `warning`, which violates the preview contract (`minLength: 1`) and fails the whole preview in the web

**File(s):** `apps/backend/src/csrm/spreadsheets/import-file.ts:112-120` (`boundImportTexts`, `UNSAFE_TEXT`), `apps/backend/src/csrm/spreadsheets/header-match.ts:68-90` (unknown headers pushed to `warnings`), consumed by `apps/backend/src/api/csrm-administration/services/csv-import.ts:348`.

**Evidence.**
- `headerKey` strips only `[\s_-]` (after NFKC + lower-case), so a header whose only character is a bidi mark (U+200E) or a C0/C1 control produces a non-empty key, matches no column, and is pushed to `warnings` as the raw header.
- `boundImportTexts` then runs `value.replace(UNSAFE_TEXT, "")`, and `UNSAFE_TEXT` removes exactly those characters, leaving `""`.
- Confirmed by running `classifyAdministrationImport` with a Name column plus one U+200E-only header and one U+0007-only header: `warnings` came back `["",""]`.
- The published contract forbids this: `AdministrationImportPreviewData.warnings.items` is `{ "type":"string","minLength":1,"maxLength":200 }` (`specification.json`), and the web parser enforces it — `importHeaderTextSchema = z.string().min(1).max(200)` (`apps/csrm/src/features/administration/csv-import-schema.ts:174,182`). An empty item makes the entire preview response fail `safeParse`, so the analyst cannot preview a file whose only fault is an invisible-character column header — a file the record says must be "ignored, with a preview warning naming each header".

**Why it matters.** A legitimate, tolerant-import file is turned into an unrecoverable preview failure instead of the documented "ignore and warn", defeating the UAT-051 tolerance goal for that file and breaking the response contract this phase publishes. It is a server-produced value that no downstream consumer can accept.

**Fix.** After stripping controls in `boundImportTexts`, drop any entry that is now empty (or replace it with a placeholder such as `"(unnamed column)"`), so `warnings`, `readOnlyColumns`, `found.headers` and `found.labels` can never contain `""`. Prefer dropping for `warnings`/`readOnlyColumns` and a placeholder nowhere, to keep `minLength: 1` without inventing text.

**Test.** In `spreadsheet-headers-values.unit.test.ts`, extend the bounds case to assert that a header consisting only of a bidi mark or a control character yields `warnings` with no empty string (every item length ≥ 1); and in `administration.integration.test.ts` preview such a file and assert the response parses against `csvImportPreviewDataSchema`.

### BE3-03 (Warning): A `similar` row decided `update` whose only mapped value is the natural key writes nothing yet is reported and counted as `updated`, and skips the record's existence re-check

**File(s):** `apps/backend/src/api/csrm-administration/services/administration-workflow.ts:562-591` (the `Object.keys(values).length === 0` branch), `:462-467` (`outcomeOf`), `:452-460` (`resultSummary`).

**Evidence.**
- For a `similar` row decided `update`, `values` is the row's values with the natural key removed. When the file carried only the name column (or only values equal to the key), `values` is empty, and the code takes `documentId = row.matchedDocumentId ?? unavailable(...)` — returning the stored id without entering `repository.transaction` and **without** the `findOne(matchedDocumentId)` existence check the non-empty branch performs.
- `outcomeOf` still returns `"updated"` and `resultSummary` still increments `update` for that row, and the result record records `outcome: "updated"` with the `documentId`.
- The contract (`Decisions on Similar Rows`) defines `update` as "applies the row's other values and keeps the existing name … in the row's own transaction". With no other values there is nothing to apply, so the row is effectively a no-op, but the result and `import.committed` counts present it to the analyst and the audit log as a committed update.

**Why it matters.** The audit trail (`import.committed` counts, D-18) and the result record overstate what changed: a row that wrote nothing is logged as an update. The existence re-check is also skipped on this path; drift re-classification normally catches a deleted match, but relying on that leaves a narrower guard than the sibling branch for no reason. This is a contract/record departure in the commit's reporting, not a security hole, so Warning.

**Fix.** Treat an `update`-decided `similar` row with no applicable values as `unchanged` (increment `unchanged`, `outcome: "unchanged"`, still return the matched `documentId` after a `findOne` existence check), or route it through the same transaction/`findOne` as a normal update even though the mutation is empty. Either way, re-check the record exists before reporting success.

**Test.** In `administration.unit.test.ts` ("a similar row decided update keeps the stored name…"), add a case where the file row carries only the name column for a similar match, and assert the result row is `unchanged` (not `updated`) and that `import.committed.counts.updated` does not include it; add a case where the matched record is removed before commit and assert the row is not reported as a silent success.

## Info

### BE3-04 (Info): `convertEnum` calls `convertText` with a hard-coded `{ mode: "update" }`, a misleading no-op argument

**File(s):** `apps/backend/src/csrm/spreadsheets/value-convert.ts:159-165`.

**Evidence.** `convertEnum` resolves the canonical value and returns `convertText(canonical, column, { mode: "update" })`. `convertText` ignores its `context` entirely (it only checks `maxLength`), and a canonical enum value is always within `maxLength`, so the mode is irrelevant — but a future reader may take it to mean enum conversion behaves as an update. The hard-coded context is dead information.

**Fix.** Call `convertText(canonical, column, context)` to pass the real context through, or return `{ kind: "value", value: canonical }` directly, since the length check is already guaranteed by the canonical spelling.

### BE3-05 (Info): The used-range test fixture only exercises a valued far cell, so it cannot catch BE3-01's two bypasses

**File(s):** `apps/backend/tests/spreadsheet-reading.unit.test.ts:297,337`, `apps/backend/tests/helpers/spreadsheet-fixtures.ts:90-113` (`buildSparseWorkbook`).

**Evidence.** `buildSparseWorkbook` always writes a `<v>`/`<is>` value for each cell, and always under `xl/worksheets/sheet1.xml`. The two bound tests (`XFD2`, `A1048576`) therefore only cover the case the guard already catches. There is no fixture for an empty high-numbered `<row>`, a value-less far cell, or a first sheet at a non-`xl/worksheets/` part, which are exactly the encodings that defeat the guard (BE3-01).

**Fix.** Extend `buildSparseWorkbook` (or add a sibling) to place an empty `<row r="N"/>` and to accept the worksheet part name/relationship target, and add the two refusal tests named in BE3-01.

### BE3-06 (Info): `readImportUpload`'s `IMPORT_FILE_TOO_LARGE` uses the client-declared `upload.size` before the real byte length

**File(s):** `apps/backend/src/api/csrm-administration/services/administration-workflow.ts:160-171`.

**Evidence.** `readImportUpload` refuses when `typeof upload.size === "number" && upload.size > IMPORT_MAX_BYTES` (the multipart-declared size) before reading the file, then re-checks the real `bytes.byteLength` after `readFile`. The declared-size refusal reports `found.bytes: upload.size`, a client-controlled number, in the error envelope. The second check (on the real length) is authoritative, so there is no bypass — the only effect is that a spoofed `size` could surface a `found.bytes` that does not match the file. Low impact; noted for accuracy since the record says `found.bytes` is the file's size.

**Fix.** Report `found.bytes` from the real `bytes.byteLength` only (keep the early declared-size refusal as a cheap guard but without echoing the declared number), or document that the declared-size path reports the declared value.

---

_Reviewed: 2026-10-17_
_Reviewer: Claude (gsd-code-reviewer), lane 3 backend import tolerance_
_Depth: deep_

## web lane (exports, report, import)

---
phase: 19-csv-export-and-import-hardening
lane: web
reviewed: 2026-10-17
depth: deep
diff_base: bdd0f698
files_reviewed: 48
files_reviewed_list:
  - apps/csrm/src/features/exports/export-actions.ts
  - apps/csrm/src/features/exports/export-scope.ts
  - apps/csrm/src/features/exports/export-file-check.ts
  - apps/csrm/src/features/exports/export-refusal-copy.ts
  - apps/csrm/src/features/exports/export-vocabulary.ts
  - apps/csrm/src/features/exports/list-export-button.tsx
  - apps/csrm/src/components/csrm/export/export-button.tsx
  - apps/csrm/src/components/csrm/export/export-dialog.tsx
  - apps/csrm/src/components/csrm/export/column-choice.tsx
  - apps/csrm/src/lib/files/file-response.ts
  - apps/csrm/src/lib/files/save-file.ts
  - apps/csrm/src/lib/api/transport/server-client.ts
  - apps/csrm/src/lib/api/conflict-reasons.ts
  - apps/csrm/src/lib/capabilities/capability-adapter.ts
  - apps/csrm/src/lib/capabilities/strapi-capabilities.ts
  - apps/csrm/src/lib/capabilities/development-capabilities.ts
  - apps/csrm/src/lib/capabilities/viewer-capabilities.ts
  - apps/csrm/src/lib/capabilities/analyst-review-gate.ts
  - apps/csrm/app/(app)/app/assessments/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/assessments/[documentId]/report/page.tsx
  - apps/csrm/app/(app)/app/assessments/[documentId]/report/error.tsx
  - apps/csrm/app/(app)/app/assessments/[documentId]/report/loading.tsx
  - apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/review/assessments/[documentId]/report/page.tsx
  - apps/csrm/src/features/assessments/assessment-report.tsx
  - apps/csrm/src/features/assessments/assessment-report-model.ts
  - apps/csrm/src/features/assessments/released-assessment-report.ts
  - apps/csrm/src/features/assessments/released-assessment.tsx
  - apps/csrm/src/features/assessments/released-assessment-actions.tsx
  - apps/csrm/src/features/assessments/report-toolbar.tsx
  - apps/csrm/src/features/assessments/assessment-server-schema.ts
  - apps/csrm/src/features/assessments/assessment-schema.ts
  - apps/csrm/src/features/assessments/assessment-editor.tsx
  - apps/csrm/app/globals.css
  - apps/csrm/src/features/administration/administration-actions.ts
  - apps/csrm/src/features/administration/administration-service.ts
  - apps/csrm/src/features/administration/csv-import-flow.tsx
  - apps/csrm/src/features/administration/import-flow-rules.ts
  - apps/csrm/src/features/administration/import-refusal-copy.ts
  - apps/csrm/src/features/administration/import-row-status.tsx
  - apps/csrm/src/features/administration/csv-client-parser.ts
  - apps/csrm/src/features/administration/csv-import-schema.ts
  - apps/csrm/app/(app)/app/admin/[collection]/page.tsx
  - apps/csrm/app/(app)/app/admin/[collection]/import/page.tsx
  - apps/csrm/app/(app)/app/risks/page.tsx
  - apps/csrm/app/(app)/app/reports/[reportKey]/page.tsx
  - apps/csrm/app/(app)/app/alerts/page.tsx
  - apps/csrm/app/(app)/app/review/assigned/page.tsx
  - apps/csrm/src/components/csrm/status-badge.tsx
  - docs/design/csrm-design-direction.md
findings:
  critical: 0
  warning: 6
  info: 10
  total: 16
status: issues_found
---

# Phase 19 web review (exports, print report, import)

Lane 4 read Phase 19's web change (`git diff bdd0f698..HEAD -- apps/csrm docs/design`), covering:

- the export Server Actions and their schemas;
- the dialog, the button and the column-choice primitive;
- the shared file-response validator and the save helper;
- the transport's new `rowCount`, `rowCap` and `found` details;
- the export capabilities and their anchors;
- the released view's header actions and both print-report routes, with their model, loader, print CSS and states;
- the tolerant import flow, with its rules, refusal copy and row badges;
- every list page that gained an Export.

I traced each export from the page through `ListExportButton`/`ExportButton`, the bound Server Action, the typed service and `checkExportResponse` to `saveFile`. Where the web depends on Strapi, I checked Strapi too: `releasedExportOf` and `projectReleasedAssessmentDetail` in `csrm-assessment.ts`, `isAiAssistedAssessment`, the `/risks` active-only read, and the catalogue URLs.

**Verified sound:**

- **The server is the authority (T-19-19, T-19-36).** Every Server Action parses its input with the list's own parser or a closed schema: the format is closed, columns are a unique subset of the vocabulary (1 to 40), and the tables come from the vocabulary. `page` and `pageSize` are refused, never dropped. A bound key or id is validated (`reportKeySchema`, `documentIdSchema`, `administrationKindSchema`). Nothing filters records in the browser. Assigned to me carries `assignee: 'me'`, which Strapi resolves.
- **Capabilities only gate visibility (T-19-21, T-19-38, T-19-41).**
  - Export renders only from the data component, after a successful read, with that export's own capability.
  - Every anchor in `strapi-capabilities.ts` matches the catalogue URL byte for byte. This includes the `?format={format}` templates on the register and the four reference lists, and their absence elsewhere. I checked against `apps/backend/src` and `docs/references/idambox-csrm-role-function-api-catalogue.json`.
  - The development grants mirror the Requestor birthright.
- **No raw `fetch` and no Route Handler (T-19-22).** No new `fetch(` appears in `app/` or `src/` outside the generated client. No `dangerouslySetInnerHTML` was added. No hex, `rgb(` or BProton literal was added: the print CSS uses `--foreground-secondary` and `--font-sans`.
- **The file check (T-19-20, T-19-37, T-19-54).**
  - `exportFileRule` checks the type by its essence, the server's name against `^[a-z0-9][a-z0-9-]{0,150}\.(csv|xlsx)$` with the format's extension, the 64 MiB bound, and the BOM or PK signature.
  - `parseContentDispositionFileName` prefers RFC 5987, and its `filename` pattern cannot match `filename*`.
  - A template and an error report pass the same rule. A file without a valid `X-CSRM-Row-Count` is refused whole.
  - `saveFile` saves the validated bytes with `download`.
- **The transport details (T-19-03, T-19-04).** `rowCount` and `rowCap` cross only beside `EXPORT_ROW_LIMIT`. `found` crosses only beside an `IMPORT_` reason, through a closed guard (20 by 200 code points), with controls stripped. `line` crosses only beside `IMPORT_CSV_MALFORMED`. A 403 is worded by S1, never by the server's message.
- **The report (T-19-39, T-19-40).**
  - Both routes read only through Strapi's released reads, and a 404 or 403 is the in-shell not-found.
  - The model keeps only released-projection fields and active Risks: Strapi's `/risks` read applies `ACTIVE_RISK_FILTER` for both actors, and the analyst path filters by `withdrawal` too.
  - The document is a Server Component. Its only client module is `ReportToolbar`.
  - The print CSS hides the toolbar (`data-print="hidden"`), names the A4 page and starts the detail on a new page.
- **Route budgets (T-19-56).**
  - The import row badges moved to `import-row-status.tsx`, and `status-badge.tsx` shrank: four icons and the `importRow` family went.
  - `assessment-schema.ts` lost the released-view parser, which moved to the server-only `assessment-server-schema.ts`.
  - The dialog, the vocabulary JSON and S1 load only behind `next/dynamic`.
  - `import-flow-rules.ts` pulls the vocabulary JSON into the import route alone.
  - Nothing in this lane adds a static import to `/app/risks/{documentId}` or `/app/requests/{documentId}` beyond the ~127 bytes of chunk regrouping that the pilot accepted on 2026-10-17.
- **The browser parser is gone (T-19-52).** `csv-client-parser.ts` checks only the extension and the 5,242,880-byte size, and the Server Actions repeat that check. The 5 MB upload fits the proxy's 6 MiB ceiling on `/app/admin/{collection}/import`.
- **The dialog's request lifecycle** follows §2.6:
  - closing while pending discards the result through the `alive` ref;
  - choices stay read-only under `<fieldset disabled>`;
  - `Enter` on a radio or checkbox submits through `requestSubmit`;
  - the format is remembered under try/catch;
  - focus starts on the checked segment and returns to `Export`.

The defects are about the AI disclosure on paper, one not-found branch, focus and live-region handling, one UI-SPEC behaviour not built, and copy outside the UI-SPEC.

---

## Critical

None.

---

## Warnings

### FE4-01 (Warning): The printed report omits the AI notice for an AI-assisted assessment when the analyst prints it from the My route

**File(s):**
- `apps/csrm/src/features/assessments/assessment-report-model.ts:61-65`, `:98`
- `apps/csrm/src/features/assessments/assessment-server-schema.ts:69-72`
- `apps/csrm/app/(app)/app/assessments/[documentId]/report/page.tsx:36`

**Evidence:**
- `aiAssistedOf` returns `input.assessment.actor === 'requestor' && input.assessment.aiAssisted` for the `requestor` input.
- `releasedAssessmentDetailForActorSchema` drops every AI fact from the analyst branch: `{ ...parsed.data, actor: detail.actor }`.
- So when a Security Analyst opens their own request's released assessment at `/app/assessments/{id}/report`, the served detail is `actor: 'analyst'`. The model's `aiAssisted` is then `false`, and `Notes` shows no AI notice even when the assessment was AI-generated.
- The same assessment's report on `/app/review/assessments/{id}/report` shows the notice. `analystAiAssisted` reads `generation` there, under Strapi's rule.
- The same viewer's Export on the same My route carries the notice in its `About this export` sheet. Strapi builds that sheet from `projectReleasedAssessmentDetail(record)`, whose `aiAssisted` is `isAiAssistedAssessment(document)` for either actor (`csrm-assessment.ts` `releasedExportOf`, `assessment-scope.ts:429`, `released-assessment-export.ts:139`).
- The model's own header claims the opposite: "either actor's read gives the same paper" (`assessment-report-model.ts:15`).
- 19-12-SUMMARY records the behaviour under "Issues Encountered" (line 268) but leaves it unresolved.

**Why it matters:**
- 19-UI-SPEC §4.3 makes the notice depend on the assessment ("Phase 12 §10.1's AI notice when AI assisted"), not on who reads it.
- Paper leaves CSRM. An AI-assisted assessment printed from this route reads as entirely human work, while the file and the other route's paper both disclose AI. That departs from the INT-06 disclosure and from the project rule that AI output is visibly advisory.

**Fix:** Keep the fact in the server parse, and leave the view's Requestor-voiced notice gated as Phase 12 IN-302 ruled:

```ts
// assessment-server-schema.ts transform
return detail.actor === 'requestor'
  ? { ...parsed.data, actor: detail.actor, aiAssisted: detail.aiAssisted }
  : { ...parsed.data, actor: detail.actor, aiAssisted: Boolean(detail.generation?.generatedAt && detail.generation.providerName?.trim()) };

// assessment-report-model.ts
function aiAssistedOf(input: AssessmentReportInput): boolean {
  return input.actor === 'analyst' ? analystAiAssisted(input.assessment) : input.assessment.aiAssisted === true;
}
```

`released-assessment.tsx:189` keeps `assessment.actor === 'requestor' && …`, so the web view does not change.

**Test:** In `assessment-report.test.tsx`, build the model with `actor: 'requestor'` from an analyst-actor released detail whose analyst read had `generation: { generatedAt, providerName: 'Ollama' }`, and expect `AI helped prepare the first draft…` in `Notes`. In `released-assessment.test.tsx`, expect the released view for the same detail to still show no notice.

---

### FE4-02 (Warning): An analyst opening `/app/assessments/{id}/report` for an unreleased assessment gets the error boundary, not the in-shell not-found

**File(s):**
- `apps/csrm/src/features/assessments/assessment-server-schema.ts:44`, `:56-68`
- `apps/csrm/src/features/assessments/released-assessment-report.ts:83-89`
- `apps/csrm/src/lib/api/transport/server-client.ts:259-266`
- `apps/csrm/app/(app)/app/assessments/[documentId]/report/page.tsx:31-34`

**Evidence:**
- A Requestor gets 404 for an unreleased assessment. An analyst gets the analyst detail from `GET /v1/risk_assessments/{id}`, released or not.
- The analyst branch then runs through `releasedAssessmentViewSchema`, which `superRefine(requireReleaseFacts)` fails for any status other than `approved`.
- `request()` turns the ZodError into `normalizeResponseParserError`, which carries no status in production and `kind: 'response-contract-mismatch'` in development.
- `loadRequestorReleasedAssessment` then returns `error` or `contract-mismatch`. The page throws, and `error.tsx` renders `We couldn’t load this report` with `Try again`, which can never succeed. In development it also logs a false `[csrm-contract]` mismatch.

**Why it matters:**
- 19-UI-SPEC §4.4: "Not found or unreleased: the in-shell not-found (unchanged)".
- A stale or shared link shows a retry loop and a misleading contract-mismatch log, where the spec asks for not-found.

**Fix:** Decide release before parsing the released view. For example, in the transform, when `detail.actor === 'analyst' && !detail.released`, return a marker, and have `loadRequestorReleasedAssessment` return `notFoundResult` for it. Alternatively, parse the analyst branch with `analystAssessmentReadSchema` first and return `not-found` when `released` is false, as `loadAnalystReleasedAssessment:128` already does.

**Test:** In `released-assessment-route.test.ts`, mock `getReleasedAssessment` to serve an analyst detail with `assessmentStatus: 'in_review', released: false`. Expect `RequestorReportPage` to call `notFound()`, not throw, and `logContractMismatch` not to be called.

---

### FE4-03 (Warning): Refusal alerts are assertive live regions and also take focus, so a refusal is announced twice

**File(s):**
- `apps/csrm/src/components/ui/alert.tsx:32`
- `apps/csrm/src/components/csrm/export/export-dialog.tsx:151-153`, `:276-278`
- `apps/csrm/src/features/administration/csv-import-flow.tsx:277-279`, `:513`

**Evidence:**
- `Alert` always renders `role="alert"`.
- The export dialog's S1 refusal is an `Alert`, and its effect focuses the title (`refusalTitle.current?.focus()`).
- The import's S2 file refusal is an `Alert` with the same focus effect (`refusalTitleRef`).
- A screen reader announces the alert's whole content once as the live region and again when focus lands on the title.

**Why it matters:** The 19-UI-SPEC accessibility contract, row 4.1.3, says: "a refusal alert is not a live region because focus moves to it". The implementation contradicts the contract.

**Fix:** Pass `role={undefined}` (or `role="group"` with `aria-labelledby` on the title) on these two alerts. `Alert` spreads `props` after its own `role`, so the override wins. Leave `role="alert"` where focus does not move: the S3 `notice`, the over-limit alert and the template and report refusals.

**Test:** In `export-dialog.test.tsx`, after a 403 refusal, expect `screen.getByText('You don’t have access to export this list.').closest('[data-slot="alert"]')` to have no `role="alert"` and its title to be focused. Make the same assertion for the import's `IMPORT_DELIMITER` refusal in `administration-workflow.test.tsx`.

---

### FE4-04 (Warning): Controls that remove themselves on activation drop keyboard focus

**File(s):**
- `apps/csrm/src/components/csrm/export/column-choice.tsx:60-61`
- `apps/csrm/src/components/csrm/export/export-dialog.tsx:173`, `:279-292`
- `apps/csrm/src/features/administration/csv-import-flow.tsx:308`, `:324`, `:455`, `:509`

**Evidence:**
- `Select all` renders only while `!allChecked`, and `Reset to visible` only while `!isDefault`. Activating either unmounts the focused button.
- The dialog's `Try again` sits inside the refusal alert, and `send` starts with `setRefusal(null)`, which unmounts it.
- Inside the Radix dialog, focus falls back to the dialog container, so the person loses their place in the checklist.
- On the import page there is no focus scope. The template refusal's `Try again` (`:509` → `downloadTemplate` → `setTemplateRefusal(null)`) and the error report's `Try again` (`:455` → `downloadErrorReport` → `setReportRefusal(null)`) unmount the focused button, and focus goes to `<body>`. It stays there after the download succeeds.

**Why it matters:** WCAG 2.4.3 (Focus Order) and 19-UI-SPEC §9's keyboard path. A keyboard or screen-reader user who chooses `Select all` is sent to the top of the dialog. One who retries a template is sent to the top of the page.

**Fix:**
- In `ColumnChoice`, move focus to a stable target after the change: the first checkbox, or the other pill when it is shown. For example, keep a ref to the fieldset and, in an effect keyed on `allChecked` and `isDefault`, refocus when `document.activeElement` became the container or `body`. Alternatively, keep the pills mounted and toggle `hidden` together with `aria-hidden`.
- For `Try again`, keep the alert mounted while pending, with the button `disabled` and reading `Exporting…`, or move focus to `Export file` or the template button before clearing the refusal.

**Test:**
- In `export-dialog.test.tsx`, uncheck one column, focus `Select all`, press Enter, and expect `document.activeElement` to be inside the `Columns` fieldset.
- In `administration-workflow.test.tsx`, make `templateAction` fail once and then succeed. Click `Try again` and expect focus on `Download Excel template`, not `document.body`.

---

### FE4-05 (Warning): The import summary tiles' figures do not select their rows

**File(s):** `apps/csrm/src/features/administration/csv-import-flow.tsx:540`

**Evidence:** The six Review tiles render `<p className="text-2xl …">{preview.summary[state]}</p>` inside a plain `Card`. No figure is a control. Only the separate filter row (`:541`) changes `filter`.

**Why it matters:**
- 19-UI-SPEC §5.5: "Each tile's figure selects its state's filter (X-10 applied to the in-page list); a zero figure is plain text."
- §9 G-4: "Every figure opens its records: The import summary figures select their rows (§5.5)".
- The contract's behaviour is missing, and 19-15-SUMMARY does not record it as a deviation.

**Fix:** Render a non-zero figure as a button (or a link-styled button) that runs `setFilter(state); setRowPage(1)`. Give it `aria-pressed={filter === state}` and an accessible name such as `{label}: {n}`. Leave a zero figure as text.

**Test:** In `administration-workflow.test.tsx`, preview a file with 2 rejected rows, click the `Rejected` tile's `2`, and expect only rejected rows and `Rejected (2)` pressed. Expect a `0` tile to be no button.

---

### FE4-06 (Warning): New and changed UI copy that 19-UI-SPEC does not contain

**File(s):**
- `apps/csrm/src/features/administration/administration-actions.ts:119`, `:129`, `:159`, `:169`
- `apps/csrm/src/features/administration/csv-import-flow.tsx:115`, `:353`, `:372`, `:411`, `:427`
- `apps/csrm/src/components/csrm/export/export-dialog.tsx:115`
- `apps/csrm/src/features/assessments/assessment-report.tsx:73`, `:204`, `:208`
- `apps/csrm/app/(app)/app/assessments/[documentId]/report/page.tsx:25`
- `apps/csrm/app/(app)/app/review/assessments/[documentId]/report/page.tsx:25`

**Evidence:** These strings are new in this diff, or rewritten from Phase 10's, and are absent from 19-UI-SPEC (§5, §6 S1 to S3, §10 "Strings that change"; grep of the UI-SPEC for each finds nothing):

| Where | String |
|---|---|
| actions `:119` | `Choose one CSV or Excel file, up to 5 MB.` |
| actions `:129` | `We couldn’t check this file. Choose it again to retry.` (replaces Phase 10's 413 and parse copy) |
| actions `:159` | `The reviewed file no longer matches this import. Select the file again.` |
| actions `:169` | `The selected file no longer matches the reviewed preview.` |
| flow `:115` | `We couldn’t import this file. Review the file and try again.` |
| flow `:353` | `Choose one file to check.` |
| flow `:372` | `We couldn’t check this file. Choose a different file.` |
| flow `:411` | `The selected file is unavailable.` (dead, see FE4-11) |
| dialog `:115` | sr-only description `Choose the file’s format and columns, then export the file.` (also wrong for the fixed-table views, which have no column choice) |
| report `:73` | `Risks overview, scrolls horizontally` |
| report `:204`, `:208` | `Loading report`, `Loading report…` |
| both report routes `:25` | route titles `Print report {assessment number} \| IdamBox CSRM` and `Print report \| IdamBox CSRM` |

**Why it matters:** The project rule for this review is that new copy needs the pilot's approval. §10 lists every string that changes, and none of these is there.

**Fix:** Either add a 19-UI-SPEC §10 row for each string (proposed: keep them as written, but word the dialog description per view, e.g. `Choose the file’s format, then export the file.` for a fixed-table view), or reuse approved strings. For example, the select-file errors could use S2's `IMPORT_FILE_TYPE` and `IMPORT_FILE_TOO_LARGE` copy. Record the pilot's approval.

**Test:** Extend `interface-copy-guard.test.ts` with an allow-list of the export, report and import strings drawn from the UI-SPEC. It should fail on any literal that is not in it.

---

## Info

### FE4-07 (Info): Two 19-02 fallbacks say something that may be false

**File(s):** `apps/csrm/src/features/administration/import-refusal-copy.ts:113`; `apps/csrm/src/features/exports/export-refusal-copy.ts:34-36`

**Evidence:**
- `IMPORT_DELIMITER` without `found.delimiter` reads `This file separates columns with semicolons.`, which may be untrue for a tab-separated file. The transport drops `found` wholesale when any key fails the guard.
- `EXPORT_ROW_LIMIT` without `rowCount` reads `We couldn’t create the file.` with `Try again`, a retry that cannot succeed because the limit refuses it again.

**Fix:** See Execution item (a): neutral wording for the delimiter, and a warning without `Try again` for the row limit.

**Test:** `import-refusal-copy.test.ts`: `IMPORT_DELIMITER` with no `found` does not contain `semicolons`. `export-refusal-copy.test.ts`: `EXPORT_ROW_LIMIT` without `rowCount` has `retry: false` and `tone: 'warning'`.

---

### FE4-08 (Info): A bulk-decision `Undo` still in view can restore the previous file's choices onto a new file's preview

**File(s):** `apps/csrm/src/features/administration/csv-import-flow.tsx:303-305`, `:380-386`

**Evidence:**
- `decideAll` captures `previous` and offers `Undo` (`setDecisions(previous)`), and decisions are keyed by row number.
- `startOver` (a new file) clears `decisions` but neither dismisses the toast nor ties the Undo to the preview.
- If the toast is still open (it pauses on hover and focus) when a new file's preview arrives, `Undo` pre-decides that file's similar rows with the same row numbers. The person never chose them.
- The window is narrow: 5 seconds plus any paused time, across a guard, a file picker and a round trip.

**Fix:** Keep the toast id and call `toast.dismiss(id)` in `startOver`. Alternatively, guard the undo: `() => { if (previewRef.current?.previewDigest === digestAtBulk) setDecisions(previous); }`.

**Test:** Bulk-update, choose another file and preview it, then invoke the toast's action. Expect `0 of k decided`.

---

### FE4-09 (Info): S1's 403 and 404 sentences name a list and a risk assessment on every export

**File(s):** `apps/csrm/src/features/exports/export-refusal-copy.ts:43-44`

**Evidence:**
- A 404 on any list or report export reads `We couldn’t find this risk assessment…`. S1 scopes that row to "(released assessment)".
- A 403 on the released assessment or a report reads `…export this list.`

**Fix:** Pass the view kind into `exportRefusal` and use the 404 row only for `released-assessment`, falling back to `EXPORT_FAILED` elsewhere. Ask the UI-SPEC for a record-worded 403, or accept the list wording explicitly.

---

### FE4-10 (Info): The transport's control-stripping regex embeds invisible characters literally, and is narrower than the file-name rule

**File(s):** `apps/csrm/src/lib/api/transport/server-client.ts:227`

**Evidence:**
- The regex is written `/[\u0000-\u001F\u007F-\u009F` followed by the raw characters U+061C, U+200E, U+200F, U+202A to U+202E and U+2066 to U+2069, then `]/g`. Those characters sit in the source as raw bytes, not escapes (`od -c` shows `330 234 342 200 216 ...`).
- `file-response.ts:62-68` (IN-403) writes the same idea "with escapes only, so no invisible character in this source can be lost". It also covers `\p{Cf}`: zero-width characters, the soft hyphen and the byte order mark.

**Fix:** `/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu`, or escapes: `\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069`.

---

### FE4-11 (Info): `confirmImport` throws messages that its `catch` discards

**File(s):** `apps/csrm/src/features/administration/csv-import-flow.tsx:411`, `:427`, `:430-433`

**Evidence:**
- `throw new Error('The selected file is unavailable.')` and the `The import result couldn’t be loaded…` throw both land in a bare `catch`. That catch always shows `We couldn’t confirm whether the import completed…`.
- A missing file, where nothing was sent, is therefore reported as an unknown outcome.

**Fix:** Return early for `!file` with the S3 copy or `Choose one file to check.`. Use `catch (caught)` and show the thrown message for the parse failure.

---

### FE4-12 (Info): A failed load of the dialog's chunk replaces the whole list with the route error boundary (uncertain)

**File(s):** `apps/csrm/src/components/csrm/export/export-button.tsx:20`, `:87-95`

**Evidence:** `dynamic(() => import('./export-dialog'), { ssr: false })` has no error handling. A chunk load failure (a flaky network, or skew after a deploy) throws during render. I believe the nearest error boundary then replaces the page body, not just the dialog. I have not run this.

**Fix:** Wrap `<ExportDialog>` in a small error boundary that resets `requested` and shows S1's `We couldn’t create the file.` with `Try again`.

---

### FE4-13 (Info): The design direction still places `Matched by similar name` "in the one shared mapping"

**File(s):** `docs/design/csrm-design-direction.md:366`

**Evidence:** The new paragraph says the sixth state is "in the one shared mapping". 19-13 moved the import row family out of `status-badge.tsx` into `import-row-status.tsx` (B4, B5), and 19-UI-SPEC's component inventory says so.

**Fix:** Reword it as "the import-only row mapping, rendered through the shared tone badge".

---

### FE4-14 (Info): The header actions' visual order on desktop is the reverse of their focus order

**File(s):**
- `apps/csrm/src/features/assessments/released-assessment-actions.tsx:28`
- `apps/csrm/app/(app)/app/reports/[reportKey]/page.tsx:67`
- `apps/csrm/src/features/administration/administration-workspace.tsx:278`
- `apps/csrm/src/features/assessments/assessment-report.tsx:185`

**Evidence:**
- `md:flex-row-reverse` shows `Export | Print report` (and `Export | Import | Create`) left to right, while Tab visits them right to left.
- §1 asks for Export last in DOM order, which is met. The visual order is a side effect of keeping the primary at the right edge.
- The pattern predates this phase for Create and Import, so this is not a regression.

**Fix:** Record it as accepted, or order the DOM to match the visual order and use `order-*` only below 768px.

---

### FE4-15 (Info): The dialog duplicates S1's failed-file copy instead of using `EXPORT_FAILED`

**File(s):** `apps/csrm/src/components/csrm/export/export-dialog.tsx:180`

**Evidence:** The `catch` builds `{ tone: 'danger', message: 'We couldn’t create the file.', retry: true }` inline. `EXPORT_FAILED` is the same object in a plain module, and importing it costs nothing on the first load because the dialog is already a lazy chunk.

**Fix:** `import { EXPORT_FAILED } from '@/features/exports/export-refusal-copy'` and use it.

---

### FE4-16 (Info): The analyst route's paper carries a notice that addresses the reader as the Requestor

**File(s):** `apps/csrm/src/features/assessments/assessment-report.tsx:171`; `apps/csrm/src/features/ai-assistance/ai-assistance-notice.tsx:11`

**Evidence:**
- `/app/review/assessments/{id}/report` renders `…A Security Analyst reviewed it before releasing it to you.` to the analyst, often the one who released it.
- Phase 12 IN-302 removed exactly that sentence from the analyst's on-screen view.
- 19-UI-SPEC §4.3 mandates §10.1's text on the paper, so this follows the contract. On paper the sentence addresses the eventual reader, which is defensible.

**Fix:** Ask the pilot to confirm, or amend §4.3 with a paper-neutral sentence, e.g. `AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before it was released.`

---

## Execution items

### (a) 19-02's fallback copy when the server omits a detail

19-02-SUMMARY deviation 4 (lines 194-205) lists the fallbacks. Each is quoted below with its location and whether 19-UI-SPEC has an equivalent.

| # | Fallback (file:line) | 19-UI-SPEC equivalent | Reachable from today's callers? | Recommendation |
|---|---|---|---|---|
| 1 | `This file` for a missing name (`import-refusal-copy.ts:85`, used at `:121` `IMPORT_FILE_TYPE` and `:124-125` `IMPORT_FILE_TOO_LARGE`) | None: S2 has `“{file name}” isn’t…` and `“{file name}” is {size}…` only | Yes, for a file whose name is empty: both callers pass `file.name`, and `named('')` falls back | **Amend** |
| 2 | `“{name}” is larger than 5 MB. Split the rows into smaller files and import each.` (`:125`) | None: S2 requires `{size}` | No: `administration-actions.ts:77` and `csv-import-flow.tsx:356` always pass `formatFileSize(file.size)` | **Remove:** make `fileSize` required in `ImportFileRefusalInput`, so S2's own sentence is always shown |
| 3 | `It has more than 5,000 rows. Split the rows into smaller files and import each.` (`:129`) | None: S2 requires `{n}` | Yes: the transport drops `found` wholesale when any key fails `isImportRefusalFound` | **Amend** |
| 4 | `Two of the column names match the same column. Delete one of them, then choose the file again.` (`:97`) | None: S2 requires two headers and a label | Yes, as for #3 | **Amend** |
| 5 | `Add the required columns (they’re in the template), then choose the file again.` (`:88`) | None: S2 has one label or two | Yes, as for #3 | **Amend** |
| 6 | Three or more labels as a written-out list, `columns named A, B and C` (`:79-82`, `:89`) | Partial: S2 shows `{a column named {label}\|columns named {label} and {label}}` | Yes: the contract allows up to 20 labels | **Amend:** extend the pattern |
| 7 | `This file separates columns with semicolons.` when `found.delimiter` is absent (`:113`) | None: S2 is `{semicolons\|tabs}` | Yes, as for #3 | **Remove the default** and amend with neutral wording (FE4-07): a wrong "semicolons" is worse than a general sentence |
| 8 | `A row can’t be read. A quote may be missing, or a row has a different number of columns from the header.` (`:70`, for `IMPORT_CSV_MALFORMED` without `line`) | None in 19-UI-SPEC: S2 has no `IMPORT_CSV_MALFORMED` row at all. The pilot approved the copy, with and without `line`, in `docs/contract-gaps/phase-19-import-tolerance.md:228-231` and 248 ("the fix-it copy, approved as written") | Yes | **Amend** the UI-SPEC to carry the approved row, so the contract has one source |
| 9 | `EXPORT_ROW_LIMIT` without `rowCount` reads S1's `We couldn’t create the file.` with `Try again` (`export-refusal-copy.ts:34-36`, `:26`) | None: S1 requires `{count}` | Yes: the transport drops a non-integer `rowCount` | **Remove the mapping:** its retry can never succeed (FE4-07). Amend S1 with a count-free warning |

**Draft 19-UI-SPEC amendment** (for the pilot to approve; it extends §6 S1 and S2, and every string keeps the section's voice rules):

> **§6 S1, added row:**
>
> | Reason | Copy | Kind |
> |---|---|---|
> | `EXPORT_ROW_LIMIT`, when the server sends no count | `This export would hold more rows than the 10,000 limit. Narrow the search or filters, then export again.` | warning (no `Try again`) |
>
> **§6 S2, amended and added rows (when a detail the row names is absent, the bracketed form is shown):**
>
> | Reason | Title | Body |
> |---|---|---|
> | `IMPORT_FILE_TYPE`, `IMPORT_FILE_TOO_LARGE` | as now | `“{file name}”` reads `This file` when the file has no name. |
> | `IMPORT_TOO_MANY_ROWS` | as now | `It has {n} rows. The limit is 5,000.` [without a count: `It has more than 5,000 rows.`] `Split the rows into smaller files and import each.` |
> | `IMPORT_DELIMITER` | as now | `This file separates columns with {semicolons\|tabs}.` [without the separator: `This file doesn’t separate its columns with commas.`] then the same three steps |
> | `IMPORT_DUPLICATE_HEADER` | as now | `“{header}” and “{header}” both match {label}.` [without them: `Two of the column names match the same column.`] `Delete one of them, then choose the file again.` |
> | `IMPORT_MISSING_COLUMN` | as now | `Add {a column named {label}\|columns named {label} and {label}\|columns named {label}, {label} and {label}} (they’re in the template), then choose the file again.` [without labels: `Add the required columns (they’re in the template), then choose the file again.`] |
> | `IMPORT_CSV_MALFORMED` (422; the import record's amendment of 2026-10-17) | `Fix the CSV file` | `Line {line} can’t be read. A quote may be missing, or the row has a different number of columns from the header.` [without a line: `A row can’t be read. A quote may be missing, or a row has a different number of columns from the header.`] Steps: `Open the file in Excel, check that row, then:` and the three `CSV UTF-8` steps |
>
> `IMPORT_FILE_TOO_LARGE` always names its size, because the browser knows it. The "larger than 5 MB" form is retired.

If the pilot declines the amendment, do the following instead:
- Remove #2 by typing `fileSize` as required.
- Route #3 to #7 to the reason's title with the bare fix (for example `Separate the columns with commas` with the three steps and no body).
- Make #9 the §2.5 over-limit sentence without its count.

---

### (b) The AI notice on an analyst's own released assessment

**What 19-12 found:** an analyst reading their own request's released assessment on the My route (`/app/assessments/{id}`, served `actor: 'analyst'`) gets a report with no AI notice in `Notes`, because "that projection carries no AI fact (12-UI-SPEC §10.2)". The review route's report shows the notice (19-12-SUMMARY line 268).

**The released view in the same case shows no notice either.**
- `released-assessment.tsx:189` renders `{assessment.actor === 'requestor' && assessment.aiAssisted ? <AiAssistanceNotice /> : null}`.
- The parse feeding it, `assessment-server-schema.ts:69-72`, keeps `aiAssisted` for the Requestor branch only.
- Phase 19 changed neither condition: the view gained only `headerAction`.

**What the rules say:**
- **Phase 12 §10.1** (`12-UI-SPEC.md:539-544`): the Requestor's view shows `AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before releasing it to you.` "only when `aiAssisted`", and "it prints".
- **Phase 12 §10.2:** the analyst's surface is the read-only editor with the provenance header, not the Requestor sentence.
- **Phase 12 IN-302** (`12-REVIEW.md:1276`, fixed in c979049): an analyst on `/app/assessments/{id}` must not see the Requestor's sentence, because it "addresses the reader as the recipient". The fix gated the notice on `actor === 'requestor'`. The fix was about that sentence's wording on screen. It did not rule that an AI-assisted assessment should go undisclosed on paper.
- **19-UI-SPEC §4.3** (line 293): Notes carry "Phase 12 §10.1's AI notice when AI assisted". The condition is a fact about the assessment, not about the reader.
- **19-UI-SPEC §3.3** (line 254): the export's About sheet carries `AI assistance` "only when AI assisted". Strapi decides it for either actor from the record (`projectReleasedAssessmentDetail` → `isAiAssistedAssessment`).

**Conclusion:**
- **The report is a defect** (FE4-01, Warning).
  - The same viewer, on the same route, gets an Export file that discloses AI assistance and a printed report that does not.
  - The analyst route's paper for the same assessment discloses it too.
  - That contradicts §4.3, the model's own "either actor's read gives the same paper", and the rule that AI output is presented as AI-assisted.
  - The fix keeps the AI fact in the server-only parse for the analyst branch, and has the report model read it for both actors.
- **The released view is not a Phase 19 defect.**
  - Its behaviour is Phase 12 IN-302's deliberate ruling, and Phase 19 did not change it.
  - It does leave an analyst-requestor's screen with no AI disclosure at all, because §10.2's provenance header appears only in the editor.
  - Whether that screen should get an analyst-voiced line is a product decision for the pilot. It is a follow-up, not a fix this phase must make.

---

_Reviewed: 2026-10-17_
_Reviewer: Claude (gsd-code-reviewer), lane 4 of 4 (web)_
_Depth: deep_

