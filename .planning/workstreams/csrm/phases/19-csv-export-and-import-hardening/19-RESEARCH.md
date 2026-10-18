# Phase 19: CSV export and import hardening - Research

**Researched:** 2026-10-01
**Domain:** spreadsheet export and import in Strapi 5.51 (CSV and XLSX writing and reading, formula neutralisation, encoding detection, zip-bomb bounds), list-scoped export authorisation, binary file transfer through a Next 16.3 Server Action, and a print-ready A4 report.
**Confidence:** HIGH for the library facts, the Server Action binary path, the zip bound and the code facts. All were read or measured this session, on Node 24.19.0. MEDIUM for OWASP's guidance, which comes from the official page. LOW (ASSUMED) for how Microsoft Excel treats a leading quote or tab in a CSV on save and reopen: Excel is not installed here, so it could not be tested.

## Summary

Phase 19 adds 22 file-producing operations, plus changes to the 8 existing import operations. They are regular, so most of the risk sits in five shared seams:
1. one XLSX writer and one XLSX reader, wrapped behind CSRM's own module in Strapi;
2. one neutraliser, which must stay invertible across the round trip;
3. one bounded reading pipeline: signature sniff, then encoding, then a zip-bomb guard, then header matching and value conversion;
4. one authorisation extension: the export's own grant, plus the list's read, plus "no service identity";
5. one binary transfer path from Strapi to the browser.

Everything else is a thin adapter per view, over the list's own parser, scope and repository.

**The dependency (D-12).** The leaning pair passes every D-12 criterion: `write-excel-file` 4.1.1 and `read-excel-file` 9.3.10, both MIT and both published in 2026.
- **Measured on Node 24.19.0** (scratchpad, not the repo): 10,000 rows × 15 columns write to a 0.89 MB XLSX in about 0.46 s, with about 128 MB RSS growth, and read back in about 0.18 s.
- **No formulas:** string cells are shared strings with no `<f>` element; a formula is written only for an explicit `type: 'Formula'`.
- **What the writer covers:** frozen rows (`stickyRowsCount`), bold header cells (`fontWeight: 'bold'`), column widths and several sheets.
- **What the reader covers:** cached formula values, booleans as `true` and `false`, `'0042'` kept as a string under the `@` format, and dates as UTC `Date`s. A legacy `.xls` raises `XLS_FILE_NOT_SUPPORTED`.
- **What the reader lacks: any decompression bound.** CSRM must check the archive before calling it. Node's built-in `zlib.inflateRawSync(…, { maxOutputLength })` enforces that bound: it threw `ERR_BUFFER_TOO_LARGE` on a 200 MiB bomb at a 50 MiB budget, measured on Node 24.19.0.
- **ExcelJS** carries `uuid@^8` (a moderate advisory with no fix in 8.x) and has had no release since 2023-10-19.
- **SheetJS `xlsx` 0.18.5** has two high advisories, both confirmed by the npm advisory endpoint.

**The transfer path (D-19).** The Server Action route works at the cap.
- **Why it works:** React 19's Flight serializer emits a `Uint8Array` as a raw, length-prefixed binary row (`serializeTypedArray(request, "o", value)`), not as base64 or JSON. Verified in `react-server-dom-webpack-server.node.production.js`, bundled with Next 16.3.6.
- **The service call:** openapi-fetch 0.17.0 reads the body with `parseAs: "arrayBuffer"`, and still JSON-parses the error body on a non-2xx response.
- **The sizes at the cap:** 0.9 MB for XLSX and about 5 MB for CSV with typical widths. These are far inside any practical bound. No Route Handler is needed, so no deviation is recorded.

**The neutraliser (D-11).** OWASP's page lists two marks.
- **The leading single quote:** OWASP's first recommendation.
- **A leading tab inside the quoted field:** which OWASP says "reliably" prevents execution in Excel.
- **The caveat:** OWASP also warns that "Microsoft Excel may remove quotes or escape characters from CSV cells when a file is saved and re-opened."

Neither behaviour can be observed here, because Excel is not installed. D-11 switches marks only on evidence, so the single quote stays. Both marks keep a CSRM round trip lossless, because the import strips the mark when it is present, and a value whose mark Excel removed is already the original value.

**Primary recommendation:** Add exactly `write-excel-file@4.1.1` and `read-excel-file@9.3.10`, pinned, to `apps/backend` only. Read XLSX through `read-excel-file/universal` with an `ArrayBuffer` and `trim: false`, after a CSRM central-directory guard verified by `zlib.inflateRawSync(…, { maxOutputLength })`. Return export bytes from a Server Action as `Uint8Array`. Build every export as list parser, then list scope, then list repository, then column vocabulary, then neutraliser, then writer, then event log line.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Scope and contract boundary

- **D-01:** No content-type schema change (`apps/backend/src/api/*/content-types/*` stays frozen; ROADMAP Phase 19). The phase still changes two documented contracts, so it writes two contract-gap records first, in the format of the existing records:
  - `docs/contract-gaps/phase-19-exports-and-export-log.md`: the export operation family and its grants (D-13); the human-only and underlying-read rules; the row cap (D-17); formats, neutralisation and file names; binary file responses in the published contract; the export event log as the audit record with no persisted entity (D-18); serving the reserved `GET /api/v1/risks/export` and `POST /api/v1/reports/{reportKey}/export`, which closes item 4 of `phase-07-derived-insights.md` and its row in item 5; the released-assessment export predicate and its Phase 17 and 17.1 seams (D-14).
  - `docs/contract-gaps/phase-19-import-tolerance.md`, amending `phase-06-administration-import-contract.md`: XLSX input and its bounds; header matching by label; ignored columns; encoding refusals; flag spellings; the clear token; the neutraliser mark stripped on import; the template's example row; the sixth classification `similar` and its decisions; templates and error reports served by Strapi, which amends "Raw file contents and unparsed CSV text are never returned to the browser" (the user's own cells return only inside a downloaded error report, never as JSON a page renders); import commits in the event log.

  **Approval checkpoint:** a `checkpoint:decision` task at which the executor stops after writing both records. Under G-6 the pilot approves each record after review, and the approval is recorded in the record. No plan changes `specification.json`, either catalogue copy or the import contract before that approval.
- **D-02:** Every new or changed operation follows the established chain:
  - exact Role → Function → FunctionAPI grants in both catalogue copies, byte-identical;
  - record-level checks in Strapi against the resolved IdamBox User (`ctx.state` after the identity middlewares), never branching on the auth mode;
  - the operation in `docs/references/specification.json`, then `api:generate` and a clean `api:check`;
  - closed response parsers, or a file-response validator for binary responses (D-19), registered in the contract parity guard;
  - a row per new operation in the six-actor authorization matrix;
  - `docs/references/served-operations.json` regenerated with the dev servers stopped.

  The server shape and its web parser change in the same plan (the 06.9 lesson).
- **D-03:** The API changes are these four groups, and no others:
  1. **List exports:** one export operation per list in D-04, each a sibling of its list with the list's query parameters plus `format`, `columns` and `timeZone` (the planner names paths and parameters within this family). The reserved `GET /api/v1/risks/export` and `POST /api/v1/reports/{reportKey}/export` are served at their catalogued URLs.
  2. **The released-assessment export:** `GET /api/v1/risk_assessments/{assessmentId}/export`, for both actors.
  3. **Administration:** per collection, a template operation (`GET …/import/template`) and an error-report operation (`POST …/import/error_report`); the existing preview and commit operations accept XLSX, return file-level refusals with closed reasons, warnings and the `similar` row state, and the commit takes the decisions for `similar` rows.
  4. **Closed refusal reasons**, added to Phase 10's reason list (`apps/backend/src/csrm/conflict-reasons.ts` and its web mirror): the export row limit, an analyst export of an unreleased assessment, and each import file refusal (D-26, D-27).

  **Reversibility:** costly — published operations, parameters and a row-state vocabulary.

### What exports, and what a file holds (CSV-01; UAT-049)

- **D-04:** Every list a person can see exports, each through its own Strapi operation:
  - **Security Analyst:** Requests (`/app/review/requests`), Questionnaires (`/app/review/questionnaires`), Risk assessments (`/app/review/assessments`), Risk register (`/app/risks`), Alerts (`/app/alerts`), each of the four Reports (`/app/reports/{reportKey}`) and the four Reference data lists (`/app/admin/{collection}`);
  - **every person, own records only:** My requests, My questionnaires and My risk assessments;
  - **a released Risk Assessment:** from the Requestor's released view and from the analyst's review page once released.

  Not exported: either Home (every Home figure opens a list that exports, X-10); a single request; questionnaire answers, notes and attachments (no finding asks, and attachments are already files); an unreleased assessment's risks (Phase 18's risk table export, ASSESS-19).
- **D-05:** An export is its list, whole. It takes exactly the list's query parameters (filters, search and sort, never `page` or `pageSize`), parses them with the list's own closed parser, resolves the list's own scope, and reads through the list's own repository. The file holds every row the list would show across all its pages, in the list's order: for the Risk register, `count`, then the ordered ids, then `hydrate` in batches. A filter the list refuses, the export refuses (400). A list a later phase changes exports the change with no export work: Phase 13's assignee column and "Assigned to me" view, Phase 16's Withdrawn filter, Phase 17's participant lists, Phase 20's type filter and saved views.
- **D-06:** Columns. Each view has a closed column vocabulary; each column has a key, a header label equal to the on-screen column header, a cell type and an extractor.
  - **Default:** the list's visible columns, as the desktop table shows them. The export dialog offers the view's other columns.
  - **No wider disclosure:** a column is offered only if the same actor can already read that field through the list's scope or the record's own read in the app. Only the chosen columns are read and written (data minimisation, G-3's principle applied to files).
  - **One value per cell:** a secondary on-screen marker becomes its own column: the Risk register's Stage and Accepted markers (Phase 11 D-41, D-44) and its treatment due state; My requests' holder and next step (Phase 11 D-34).
  - **The Risk register** also offers Request title and Assessment type (`REPORT.md` §6), and its detail fields: Risk owner, Risk Type, Treatment action, Treatment plan, Impacted system and asset, Treatment resolve date and State.
  - **Order:** the view's canonical order, whatever order the request names.
  - **Reference lists** use the import template's columns (D-33).
  - **Phase 18:** its DataTable column chooser (Phase 11 D-33) later sets what is visible, and the export default follows it. The dialog's column checklist (D-20) is built as the column-choice primitive Phase 18 adopts, so column choice is still designed once.
- **D-07:** Cell values are what the list shows, as data:
  - display values, never internal ids: record numbers, display names and labels;
  - labels from one vocabulary per family in Strapi (request, questionnaire and assessment status, treatment status, due state, stage, holder, alert kind and urgency), which a web parity test proves equal to the web's one status mapping (`status-badge.tsx`, `request-domain.ts`, `risk-domain.ts`, `alert-presentation.ts`), as `report-definitions.ts` is proven equal to `report-copy.json` today. "Released" for `approved` (decision 16) is in it, and 17.1's "Closed" (G-13) must extend both sides or the test fails;
  - an absent value is an empty cell, never placeholder text such as "Not provided";
  - flags as `Yes` and `No`; numbers as numbers; calendar dates as dates;
  - instants as the viewer's local calendar date, as the lists show them (Phase 10 D-19, Phase 11 D-55). The web passes the zone from Phase 10's `csrm-time-zone` cookie, Strapi validates it as an IANA zone, and an absent or invalid zone falls back to UTC and says so in the About sheet;
  - the treatment due state from `deriveTreatmentDueState` (`apps/backend/src/csrm/insights/treatment-due-state.ts`), through the list's own projection, never recomputed in the export module (G-16).
- **D-08:** Formats:
  - **CSV:** UTF-8 with a BOM, CRLF line ends, RFC 4180 with every text cell quoted (OWASP); one header row of display labels, then one row per record; no title or metadata rows, so the file loads into any tool and re-imports.
  - **XLSX:** the data on the first sheet, with a bold, frozen header row and sized columns; typed cells: text always as strings, never formulas, no external links and no macros (`.xlsx` only); dates with the `d mmm yyyy` display format, as on screen; then a last sheet, "About this export" (D-09).
  - **Multi-table views** (each report, a released assessment): XLSX holds one sheet per table; CSV holds one table, which the dialog chooses.
  - **Default in the UI:** XLSX, because Excel keeps its types: CSV opened in Excel loses leading zeros (`0042`) and turns date-like text into dates.
- **D-09:** The XLSX "About this export" sheet names the view, the filters and search in words (labels, not ids), the sort, the columns, the row count, when it was exported (local date and time with the zone) and who exported it, and says that values starting like formulas begin with the neutraliser's mark (D-11). It records provenance for a file that leaves the system (ISO/IEC 27001:2022 Annex A 8.12, data leakage prevention). A CSV has no About section (D-08).
- **D-10:** File names follow `{view}-{local date}.{csv|xlsx}` (for example `risk-register-2026-10-01.xlsx`), and a record export is named after its record (`{assessment number}-risk-assessment-{local date}.xlsx`); the UI-SPEC fixes the slugs. Strapi sets `Content-Disposition: attachment` with an ASCII `filename` and an RFC 5987 `filename*`, the content type, `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`. The web uses the server's name.
- **D-11:** Neutralisation follows OWASP's CSV injection guidance, in one shared function:
  - the existing `sanitizeSpreadsheetCell` moves from `csv-import.ts` into the shared export module, and its web copy in `csv-client-parser.ts` retires (D-25);
  - it applies to every text cell in both formats: values starting with `=`, `+`, `-`, `@`, tab, carriage return or line feed, their full-width forms, and any of these after leading whitespace (the existing pattern);
  - the mark is a leading single quote, OWASP's primary recommendation and today's tested behaviour. Research checks OWASP's caveat that Excel can drop the mark on save-and-reopen, and its leading-tab variant, and switches only if the variant survives Excel's save-and-reopen and stays lossless on re-import;
  - numbers and dates are typed values and are never marked;
  - whatever the mark, the import strips exactly it (D-28), so an export, edit and import round trip is lossless;
  - the test oracle: no cell in either format evaluates as a formula when opened, and a value that began with `=` arrives as text.

  **Reversibility:** costly — files in circulation carry the mark, and the import must keep stripping it.
- **D-12:** Files are generated in Strapi, never in the web, and the XLSX dependency lives in Strapi only. Strapi is where the data, the scope, the log and the import parser already are, and the catalogue reserves exports that "generate an export … in the requested supported format". One location then holds one neutraliser, one writer and one reader for this phase and Phase 18. The web never builds, parses or alters a file (D-19). The dependency is chosen against pass-or-fail criteria, justified in the plan that adds it, and wrapped behind the module's own interface:
  - a permissive licence (MIT, Apache 2.0 or ISC);
  - published on the npm registry, actively maintained (a stable release in the last 12 months, or demonstrable maintenance), with no unpatched high or critical advisory in it or its dependencies;
  - writes several sheets with typed string, number and date cells, a frozen bold header row and column widths, and never writes a formula unless asked;
  - reads the first sheet's cell values (cached values, not formulas) for this phase's imports and Phase 18's;
  - pure JavaScript with no native build; its install size and its time and memory at the 10,000-row cap (D-17) measured.

  The lean is `write-excel-file` and `read-excel-file` (MIT, maintained, small; data validation needs an add-on package, so dropdowns are optional, D-31). ExcelJS (MIT; last stable release 4.4.0 in October 2023, with a dependency advisory) is the fallback. SheetJS is excluded: its npm package `xlsx` is stuck at 0.18.5 with unpatched advisories (CVE-2023-30533, CVE-2024-22363), and its patched builds are not published to the npm registry. Nothing reaches the web bundle. **Reversibility:** reversible — behind the module's interface.

### Authorisation and its negative cases (decision 12, G-1, G-12)

- **D-13:** Every export is authorised like its list, and never wider:
  - **Two grants:** the export's own FunctionAPI and the list's own read operation, both held by the caller, as Phase 7's insights require their underlying reads (`ANALYST_INSIGHT_UNDERLYING_READS`, 07 D-14). The route keeps the list's policy configuration, so the export resolves exactly the list's scope.
  - **Analyst views:** the human Security Analyst only. Each analyst export joins `HUMAN_ANALYST_ONLY_OPERATIONS`.
  - **Own-record views** (the My lists, a released assessment): any active human user, through the Requestor birthright, scoped to their own records exactly as the list or read is.
  - **No service identity exports anything**, whatever it holds: Strapi refuses a user holding the Security Analyst Agent role on every export, its Requestor birthright included. An export is a human act, and no agent workflow needs one (G-1; Phase 12 D-32).
  - **Catalogue:** the reserved risk-register and report export FunctionAPIs (`function.risk_register.risk_register.api.04`, `function.reports.reports.api.03`) move out of their menu Functions, which the agent holds, into human-only API Functions with their names, URLs and descriptions unchanged, as Phase 7 moved its insight entries. New export FunctionAPIs join Functions that only human roles hold: the four Administration Functions for the reference lists and their template and error-report operations (so Phase 22's re-grant moves them together), and new API-only Functions elsewhere. The planner chooses one API Function per actor or per view, and records the catalogue design note.

  **Reversibility:** costly — grants in both catalogue copies and the matrix.
- **D-14:** A released assessment's export, and its report (D-23), are authorised by the one record-read predicate, never by a separate "the Requestor raised it" check (G-12 seam):
  - Today `releasedForOwner` in the assessment controller, `releasedAssessmentQuery`, `releasedAssessmentDetailQuery` and `isReleasedAssessmentForOwner` (`assessment-scope.ts`) gate the released detail, its risks and its control implementations for the Requestor. This phase gathers them into one exported predicate that the three released reads, the export and the report route all call. For the Requestor, the export is "readable and released".
  - **Phase 17** widens "readable" to every current participant (the Requestor, the nominated risk owners and named executive approvers, G-12) in that one place; the export, the report and "My risk assessments" follow with no export change.
  - **Phase 17.1** widens "released" to an owning request in `approved` or `closed` (G-13) in the same place.
- **D-15:** An analyst exports a released assessment through the analyst read. An unreleased assessment is refused with a closed reason (409, "available once released"), because the analyst can read it, so a 404 would be untrue. Analysts export an unreleased assessment's risks from Phase 18's risk table. Both actors get the same file: the released record as the Requestor reads it (D-21).
- **D-16:** The negative cases, each proven in the API and in the UI:
  - another Requestor's released assessment: export 404, the refusal a missing record gets; the page is the in-shell not-found, so no export control renders;
  - the Requestor's own unreleased assessment: 404 at the export, as at the read;
  - a Requestor at any analyst export (Risk register, review lists, Alerts, Reports, Reference data): 403, as at the list; no export control, since the lists are gated;
  - the service agent at every export: 403;
  - a My-list export by an analyst: their own records only (06.3: My lists are owner-scoped for every actor);
  - no identity: 403; no token: per token family (D-51);
  - a filter, sort, column or format outside the view's closed vocabulary, or an invalid `timeZone`: 400;
  - over the row cap: the closed reason with the count and the cap, and no file (D-17);
  - an analyst export of an unreleased assessment: 409 (D-15).

  The matrix gains a row per new operation for all six callers (owner, other, analyst, serviceAgent, noIdentity, noToken). Navigation visibility is not authorisation: a hidden Export button never stands in for a refusal.

### Row limits

- **D-17:** One cap, 10,000 rows per export, defined once in the export module. Strapi counts before it generates anything and refuses a larger export with the closed reason, naming the count and the cap. The dialog knows the list's total, so it warns and disables Export before the request (D-20), and the server still enforces. Within the cap, files are built in memory: no streaming and no background jobs, because the transport buffers anyway (D-19) and the cap bounds the memory. The cap is a data-leakage control, not a setting. **Reversibility:** reversible.

### The export event log (decision 12; no content-type change)

- **D-18:** One security event log module in Strapi records every export as one structured line through Strapi's logger: a stable event name and a JSON payload.
  - **Fields:** the time (UTC), the actor (IdamBox User `documentId` and display name), the view key, the format, the columns, the parsed filters, search and sort (the closed parsed values, never the raw query), the `timeZone`, the row count and the outcome (`exported`, or `refused` with its reason: row cap, invalid query, not released).
  - **Never** an exported value.
  - **The same module** records each Administration import commit: actor, collection, file name, file digest and the counts by outcome.
  - **Where it is queryable:** in the log platform the deployment ships Strapi's log to (a SIEM), by actor, view, outcome and time (ISO/IEC 27001:2022 Annex A 8.15 and 8.16), not in the app. A persisted, in-app audit view would need a content type, so it is deferred with a contract-gap record of its own.
  - **Retention:** the deployment's log policy, which R-08-13 already says must treat these lines as personal data (they hold names and search terms).
  - **Reuse:** G-17's people-search log (Phase 17) writes through this module, "as exports are".

  Policy denials (403 and 404) stay in Strapi's request log line, as today. **Reversibility:** costly — log consumers key on the event name and fields.

### Delivery to the browser

- **D-19:** The web reaches each export through a typed service function in its feature's `*-service.ts`: openapi-fetch with a binary parse. A Server Action calls it after validating its input with the list's shared query schema, reads the viewer's zone, and returns either `{ fileName, contentType, bytes }` or a closed refusal. A small client helper saves the file through a Blob and an anchor, as the import's template and report downloads do today.
  - The service checks the content type against the view's allowed types, the file name against a safe pattern, the size against a bound, and the signature (the UTF-8 BOM, or `PK` for XLSX). The parity guard gains a file-response mode for these operations.
  - No Route Handler, no raw `fetch`, and the bytes reach the browser unchanged.
  - Research verifies the Server Action's binary return (React 19 Flight's typed-array support) at the cap for size, memory and time. Only if it fails there does the plan record a deviation.
  - Phase 14 downloads attachments (up to 25 MB) before this phase executes. The two should share one file-transfer pattern, which the orchestrator aligns (Phase 14 had no CONTEXT when this was written).

### The export experience (G-4)

- **D-20:** An Export action (an outline button with the `Download` icon) sits in each list's page header, and in the released assessment's header for both actors. It opens an export dialog (the 640px form size; a sheet below 768px):
  - **Format:** Excel workbook (`.xlsx`), the default, or CSV (`.csv`).
  - **Columns:** a checklist of the view's columns, the visible ones checked, with "Select all" and "Reset to visible".
  - **Scope, in words:** "{n} {records} that match the current search and filters, in the current order: every page, not just this one", with the active filters named.
  - **Over the cap:** the dialog says so before the request and disables Export, naming the cap and asking to narrow the filters.
  - **Pending:** the Export button shows its pending state (the direction's inline 16px spinner for a blocking submit).
  - **Success:** the dialog closes, the browser saves the file, and a toast names the file and the row count.
  - **Refusal:** shown in the dialog with its reason and the way to fix it, keeping the choices made.
  - **Empty list:** Export is disabled, and the reason says nothing matches.
  - **No confirmation and no Undo:** an export changes nothing.
  - **Keyboard:** the header button and the dialog form the keyboard path; focus starts on the format choice and returns to the Export button on close.

  The UI-SPEC writes the copy and proposes any new pattern as an X-n extension.
- **D-21:** The released-assessment export is the released record:
  - **Its content** is exactly what the released read discloses: no analyst-only field. XLSX holds a Summary sheet (assessment and request numbers and title, Released date and released by, overall rating, overall control effectiveness, summary, overall rationale, recommendations, next review date), a Risks sheet (one row per risk in the released read) and a Mitigation controls sheet (one row per control implementation, keyed by risk number), then About. CSV holds the Risks table, or the Mitigation controls table, chosen in the dialog.
  - Phase 12's disclosure that AI assisted and a Security Analyst reviewed (INT-06 criterion 3) appears in the About sheet.
  - Later phases extend it through the same read: Phase 16's withdrawn risks are absent because the read excludes them, and Phase 17.1's decisions (who decided, under what authority, the review date) join the Risks sheet when 17.1 adds them to the released read.
- **D-22:** Reports: XLSX holds one sheet per report table, with the report's as-at date and period in About; CSV holds one table, chosen in the dialog. The report's own figures and windows are unchanged (Phase 11 D-38).

### The print-ready report (decision 12)

- **D-23:** A released assessment has a report route per actor, `/app/assessments/{documentId}/report` and `/app/review/assessments/{documentId}/report`.
  - **Reads:** rendered on the server from the same reads as the released view, through one shared loader factored out of the released page, and gated by D-14's predicate. An unreleased assessment, or one the viewer cannot read, is the in-shell not-found.
  - **No new operation, no PDF dependency:** A4 portrait through the print stylesheet (`@page { size: A4 }`), so the browser prints or saves a PDF.
  - **A screen-only toolbar,** `data-print="hidden"`: "Print or save as PDF" calls `window.print()`, and "Back to the risk assessment" returns.
  - **Entry:** a "Print report" action beside Export on both released views.
  - **Not logged as an export:** its content is the released view itself, and printing happens in the browser, where the server cannot observe it. A report-generation log is deferred.
- **D-24:** The report is a document:
  - **A header:** IdamBox CSRM, "Cyber security risk assessment", the assessment number, the request number and title, Released date and released by, and the overall rating badge with its text;
  - **sections:** summary, overall rating and rationale, recommendations, overall control effectiveness and next review date; a risks overview table (number, statement, inherent and residual ratings, treatment); then each risk in detail with its mitigation controls;
  - **notes:** Phase 12's AI disclosure, and the generation date in local time.
  - **Print rules:** tables repeat their headers; a risk avoids breaking inside where it fits on a page; nothing is clamped; badges keep their text and icon if a printer drops tints (the direction's Print extensions).
  - **The UI-SPEC** proposes the report layout (A4 size, margins, header, page numbering where the browser supports `@page` margin boxes) as an X-n extension, recorded in the direction before the implementing task.

### Import hardening (CSV-02; UAT-051)

- **D-25:** Strapi holds the one authoritative parser. Today the web pre-parses with its own copy (`csv-client-parser.ts`), which is where UAT-051's message came from, while Strapi's preview answers only "The CSV file could not be validated."
  - The shared spreadsheet-reading module, under `apps/backend/src/csrm/`, decodes and parses; the administration import calls it.
  - The web's client parsing retires; the browser checks only the extension, the declared type and the 5 MiB size before upload.
  - Strapi answers a file-level refusal with a closed reason and safe details (the named headers, the detected encoding), which the web maps to fix-it copy through Phase 10's refusal-copy module (Phase 10 D-22). The client-side `csv-parse` leaves the import route's bundle.
- **D-26:** Accepted files:
  - **CSV:** UTF-8 with or without a BOM, comma-delimited;
  - **XLSX:** the first worksheet's cell values, other sheets ignored, cached values rather than formulas, so the XLSX template comes back as it is and nobody has to convert it to CSV.
  - **Type check:** extension and content signature against that allow-list, as decision 2 checks attachments.
  - **Bounds, unchanged:** 5 MiB per file, 5,000 data rows, the 64 KiB record bound. XLSX adds an uncompressed-size bound checked from the zip directory before inflating, because the lean reader has no zip-bomb guard (research sets the value).
  - **Refusals with a fix-it message:** a non-UTF-8 file that decodes as Windows-1252 (in Excel, File > Save As > "CSV UTF-8 (Comma delimited)", or upload the `.xlsx` workbook itself); UTF-16 ("Unicode Text"); a semicolon- or tab-delimited file; an old `.xls`; a macro-enabled, encrypted or password-protected workbook. Each names what was found and the fix.

  CSRM never guesses a legacy encoding, because a wrong guess silently corrupts names.
- **D-27:** Headers:
  - matched after trimming, Unicode NFKC, lower-casing and removing spaces, underscores and hyphens, against each column's API field name and its display label (the template's header). "Name", "name" and "NAME" all match `name`; "Internet facing" and "internetFacing" match `internetFacing`;
  - a short closed alias list per column only where unambiguous (the planner proposes it; none is required);
  - **unknown columns** are ignored, with a preview warning that names each;
  - **known non-imported columns** are recognised and ignored with an informational note, not a warning: the error report's `Issues` column (D-32) and a reference export's read-only columns (D-33);
  - **refusals:** two headers that map to one field, naming both; a missing required column, naming its display label.
- **D-28:** Values:
  - flags accept `Yes`/`No`, `Y`/`N` and `TRUE`/`FALSE` in any case, and XLSX boolean cells;
  - enumerations match their values case-insensitively (as today);
  - cells are trimmed; a blank cell leaves an updated field unchanged and gives a created record the default (as today);
  - the clear token `#CLEAR`, in any case and as the whole cell, empties an optional field on an update. On a required field it is a row issue; on a create it equals blank;
  - a leading neutraliser mark before a trigger character (D-11) is removed, matching Excel's own reading of a quote-prefixed cell, so round trips are lossless;
  - the template's example row (D-31) is skipped, with a note.

  **Reversibility:** costly — templates and habits carry the token.
- **D-29:** The value-conversion module is shared. Its typed converters (text, flag, enumeration, clear token, mark stripping) have an interface that Phase 18 extends: calendar dates (dd/mm/yyyy and ISO), the 5 × 5 scale labels from Phase 12's `risk-scale.ts` ("High", "Likely"), people by name, and controls by number. Phase 18 adds the web mirror for paste previews, with a parity test. This phase builds only the converters its imports use; the four collections have no date column.

### Near matches (CSV-03; UAT-052)

- **D-30:** Matching has two tiers:
  - **Exact** (the trimmed key in Unicode NFC) classifies as today: create, update or unchanged.
  - **Similar** (equal only after NFKC, case-folding and collapsing internal whitespace, today's normaliser plus whitespace) becomes the sixth row state, `similar`, shown as "Matched by similar name" with the existing record's name.

  A `similar` row is neither created nor updated until the analyst chooses, per row or for every similar row at once:
  - **Update {existing name}** applies the row's other values and keeps the existing name, as an update does today;
  - **Skip** leaves the record as it is.

  "Continue to confirmation" needs a choice for every similar row. The commit carries the choices, which Strapi checks against its retained preview record; a row whose classification changed by commit time is rejected as drifted, as today. Two rows of one file that match each other stay `ambiguous`. A create is never offered: the natural-key uniqueness rule refuses a case-only duplicate. The direction's five import row states gain a sixth, which the UI-SPEC proposes. **Reversibility:** costly — a published row-state vocabulary.

### Templates, error reports and the round trip

- **D-31:** Templates come from Strapi (`GET …/import/template?format=csv|xlsx`), generated from the import contract on request, so they never drift:
  - display-label headers and one example row, whose reserved natural key the import recognises and skips (D-28);
  - the XLSX adds a Notes sheet: each column's label, its API name, whether it is required, its format and allowed values, the flag spellings, the clear token and what a blank does; dropdown validation on enumeration and flag columns if the chosen library supports it (D-12);
  - Phase 22's configurable lists flow into the allowed values with no template change.

  The web keeps its copy of the column contract for the Guidance step, proven equal to Strapi's by a parity test, or reads it from Strapi (the planner decides).
- **D-32:** Error reports are built by Strapi (`POST …/import/error_report` with the same file), in the uploaded file's format: CSV (UTF-8 with a BOM) or XLSX.
  - **Content:** the original header row as typed, then every row not (or not yet) imported, with its cells verbatim and neutralised (D-11), plus a last `Issues` column naming each problem by its column's display label and giving the original row number.
  - **Excluded:** imported rows, and similar rows the analyst chose to skip.
  - **Offered** at Review and at Results.
  - **Server-authoritative:** built from the file and Strapi's own retained classification or commit outcome (the preview record, or a short-lived result record bound to the actor and collection like it), never from client-supplied issues.
  - **The round trip:** the user corrects it in Excel and imports it again. `Issues` is ignored (D-27), and rows that are now valid create or update.

  Neither templates nor error reports are exports of records, so neither is logged as one (D-18).
- **D-33:** Reference-list exports complete the round trip. They hold the import template's columns, then the list's read-only columns (an Information System's owner, for example), which the import recognises and ignores with a note (D-27). An exported list, edited and imported again, updates by natural key. The guidance recommends XLSX for the round trip, because Excel strips leading zeros (`0042`) and converts date-like text when it opens a CSV.

### Cross-phase seams (`stage2-rules.md`; this phase's own)

- **D-34:** The seams this phase serves:
  - **G-12 (Phase 17):** exports are reusable for participants. D-14's predicate is the one place Phase 17 widens; the export, the report and "My risk assessments" follow. Phase 17's success criterion 2 (the risk owner "prints and exports it as the Requestor can") and 17.1's second journey slice rely on it.
  - **G-13 (Phase 17.1):** the label vocabulary (D-07) is one extensible mapping on each side, proven equal, so "Closed" extends it without restructuring; the released predicate's `approved` or `closed` change lands in D-14's one place.
  - **G-16 (Phase 20):** exports show Overdue by the one shared due-state rule. The register and alert exports take the due state from the lists' own projections (D-07), so Phase 20's switch to `treatmentResolveDate` and its server-written Overdue reach every export with no export change. No `targetDate` due logic enters a new surface.
  - **G-17 (Phase 17):** the people-search log writes through D-18's module.
- **D-35:** What this phase builds on (planned outputs, re-checked at the plan check):
  - **Phase 10:** the viewer zone (`viewer-time-zone.ts`, `isValidTimeZone`), closed reason codes and refusal copy (D-22), the released view's control names and treatment (D-34), extensions X-1 to X-5.
  - **Phase 11:** each list's columns, filters, search and the served `GET /v1/my_requests` (D-02, D-29 to D-35), the "Released" label (D-46), the stage and accepted markers (D-40, D-41, D-44), extensions X-6 to X-10.
  - **Phase 12:** `risk-scale.ts` (D-10) and the Requestor's AI disclosure (D-23).
  - **Phase 13:** the queue's assignee column and "Assigned to me" view join the queue export's vocabulary.
  - **Phase 14:** the file-transfer pattern to align with (D-19).
  - **Phase 16:** withdrawn risks leave the reads the exports use.
- **D-36:** What later phases take from this one:
  - **Phase 18** reuses the export module (the risk table's current view as one more view: visible columns, filters and sort), the XLSX reader and writer, the value-conversion module (D-29) and the column-choice primitive (D-06); its risk-row import uses the same reading, header-matching, error-report and similar-name machinery.
  - **Phase 20:** "My risks and treatments" exports through the module.
  - **Phase 21:** a chart's data-table alternative may export through it.
  - **Phase 22:** the Admin's access-review export of role holders (ADMIN-08) uses it; re-gating Reference data moves the reference-list exports, templates and error reports with the Administration Functions (D-13).

  Every later export keeps this phase's rules: human only, the underlying read, the cap, the log and the neutraliser.
- **D-37:** Phase 19 adds no slice to the post-demo journey (`apps/csrm/e2e/risk-owner-journey.spec.ts`, which Phase 17 creates). It builds the export and the report that the journey's risk owner uses from Phase 17 onward.

### Verification and plan shape

- **D-38:** Each behaviour gets a failing test first at its seam.
  - **Strapi unit:** the neutraliser on every trigger, the full-width forms and leading whitespace; the CSV writer (BOM, CRLF, quoting); the XLSX writer read back by the reader (string cells, no formula elements, About sheet); header matching; encoding detection with byte fixtures (UTF-8 with and without a BOM, Windows-1252, UTF-16, semicolons, tabs); XLSX bounds; value conversion; the two matching tiers; the label vocabulary.
  - **Strapi integration** (`apps/backend/tests/*.integration.test.ts`): every export's scope, filters, sort, columns, cap and file name, with files read back; its log line; and every refusal in D-16.
  - **Matrix:** the six-actor row for each new operation.
  - **Imports:** the UAT's own file shapes: "Name,Description" plus "Owner"; Excel's default Windows-1252 CSV; Yes, No and Y flags; `#CLEAR`; a lower-case duplicate of an existing name; the error report re-imported after correction; an XLSX template filled in and imported.
  - **Web unit (Vitest):** the export dialog's states (default columns, cap warning, empty, pending, success, refusal with choices kept); the file-response validation; the refusal copy; the import steps (warnings, fix-it messages, similar decisions, per-row and bulk); the report layout; the label parity test.
- **D-39:** Playwright (`apps/csrm/e2e/`), each journey on its own records, at 1440px and 375px:
  - Bob filters the Risk register and exports XLSX (download event, name, type and signature); a CSV export of a list with a seeded `=` value carries it as text;
  - Jane exports her own released assessment, and the Secondary Requestor gets the not-found page at that assessment, with the export operation refusing them (404);
  - Bob imports the "Name" header file with an extra column and sees the warning; the Windows-1252 file gets the fix-it message; Bob downloads the error report, corrects it and imports it; a lower-case duplicate is held, then decided;
  - the released assessment's report renders for print (print media emulation, the shell absent; a Chromium A4 PDF of at least one page).

  The existing import journey's deliberate changes are named in its plan. A run leaves the tree clean (Phase 8 D-12, G-6).
- **D-40:** Plans are serialised by shared files, one owner per file per wave:
  - the specification and the generated client;
  - both catalogue copies and `served-operations.json`;
  - the authorization matrix and the parity guard;
  - `csrm-authorization.ts` and `conflict-reasons.ts`;
  - the list controllers and routes the exports join;
  - the administration import files on both sides;
  - the hot E2E specs.

  The contract-gap checkpoint (D-01) precedes the first contract plan. Dev servers are stopped for any plan that edits Strapi or runs Playwright. The last plan runs the full gate on the production build (`api:check`, typecheck, lint, the web and Strapi suites, `test:e2e`), then asserts a clean tree.
- **D-41:** Scale. About 22 new operations (13 list exports, the assessment export, and a template and an error report for each of four collections), plus changes to the 8 import operations. The operations are regular, one module with a thin adapter per view, so the planner groups them by family (analyst lists, own-record lists, reference lists, reports, the assessment, import support) rather than one plan per operation. The roadmap's size M may become L; the orchestrator decides.

### Claude's Discretion

- Module placement under `apps/backend/src/csrm/` (for example `exports/`, `spreadsheets/` and `audit/`), and the web feature placement of the dialog and the save helper.
- Operation paths, parameter names (`columns` encoding, `format`, `timeZone`), view keys, and the export Function layout (one per actor or one per view), within D-03 and D-13.
- Column vocabularies per view, from each list as it stands after Phases 10 to 16, within D-06.
- Whether the web reads the import column contract from Strapi or keeps a parity-tested copy (D-31).
- The result record's shape for Results-step error reports (D-32).
- Whether the dialog remembers a viewer's last format and columns per view in browser storage, guarded by try/catch.
- The XLSX uncompressed bound and the alias lists, within D-26 and D-27.
- Copy, layout, file slugs and the extension wording: the UI-SPEC's.

### Deferred Ideas (OUT OF SCOPE)

- **Importable relations:** an Information System's owner (by name) and a Risk Type's applicable controls (by control number), `REPORT.md` §6 item 8. CSV-02 does not ask for them; they suit Phase 22, where the Admin owns reference data and its imports.
- **Exports past 10,000 rows:** streamed or background exports, if a register outgrows the cap.
- **A persisted audit store and an in-app export history,** which need a content type and a contract-gap record; the log platform covers monitoring until then.
- **A report-generation log entry** for the print-ready report.
- **Protective markings** (an information classification line on exports and reports), and **export rate limits or anomaly alerts** beyond the log platform's monitoring.
- **Links back to CSRM records inside exported files.**
- **Exports of a single request, questionnaire answers, notes or Home widgets:** no finding asks for them.
- **Separate export rights** distinct from read rights, if an organisation wants to restrict exports for people who can read.
- **Importing a Windows-1252 file on an explicit choice,** rather than refusing with the fix-it message.
- **Date, rating, person and control converters:** Phase 18 (D-29).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CSV-01 | Registers, lists, queues, alerts and reports export to CSV and XLSX: (1) current filters, search and sort, visible columns by default with a column choice, named after the view and date; (2) Strapi scopes each export to what the viewer may read, and a Requestor exports only their own released assessments; (3) `=`, `+`, `-`, `@`, tab and carriage return are neutralised, and CSV is UTF-8 with a BOM; (4) every export is logged with actor, view, filters and row count, and a released assessment prints as an A4 report | Standard Stack (writer); Patterns 1–4 (export pipeline, policy extension, released predicate, binary transfer); Pattern 9 (event log); Pattern 10 (print); Pitfalls 1–8 and 12–15; Code Examples 1–5 |
| CSV-02 | Imports tolerate spreadsheet habits and return files a user can fix and re-import: (1) headers match case-insensitively and by display label, and unknown columns are ignored with a warning; (2) a Windows-1252 file gets a "Save as CSV UTF-8" explanation, Yes/No, Y/N and TRUE/FALSE are accepted, and a clear token empties a field; (3) templates carry display headers, an example row and allowed values, and error reports are the original rows plus an Issues column, with a BOM | Standard Stack (reader); Pattern 5 (reading pipeline); Pattern 6 (headers and values); Pattern 8 (templates and error reports); Pitfalls 9–11 and 16–19; Code Examples 6–8 |
| CSV-03 | A near-match name in an import needs an explicit decision: case- or whitespace-only matches show as "Matched by similar name", and are neither created nor updated until the user chooses | Pattern 7 (the two matching tiers and the commit decisions); Pitfall 20 |
</phase_requirements>

## Project Constraints (from AGENTS.md and the Stage 2 rules)

There is no `CLAUDE.md`. These directives come from `AGENTS.md` and the orchestrator's `stage2-rules.md`, and they carry the authority of locked decisions:

- **The API boundary.**
  - Strapi stays the production API boundary: no frontend API facade, no Route Handler standing in for an API, no raw `fetch` in page components.
  - The web calls Strapi only through the typed API layer (`apps/csrm/src/lib/api`), from server code and Server Actions.
- **Authorisation.**
  - Keycloak authenticates; Strapi enforces Role → Function → FunctionAPI plus record-level authorisation. Navigation visibility is not security.
  - Every new rule is enforced against the resolved IdamBox User (`ctx.state`) and never branches on the auth mode.
- **Domain.**
  - Requestor is an implicit birthright role; Security Analyst is explicit.
  - AI output is advisory; nothing here releases an assessment.
  - JDL terminology is the source of truth; document contract gaps rather than inventing entities.
- **Code quality.**
  - Strict TypeScript; Server Components by default; no business logic in JSX.
  - shadcn/ui first; semantic tokens only; never hard-coded BProton colours; responsive and accessible.
  - Validate external input with shared schemas.
- **Tests and dependencies.**
  - Tests with every material workflow: Strapi integration for every grant and refusal, Vitest for logic and refusal states, Playwright for flows.
  - A Playwright run leaves the git tree clean.
  - No new dependency without a concrete reason, justified in the plan that adds it (the XLSX pair, D-12).
- **Contract records.** Content-type schemas stay frozen in this phase (D-01). The contract-gap records come first, then a `checkpoint:decision` where the executor stops (G-6). After approval, update:
  - `specification.json`;
  - both catalogue copies, byte-identical;
  - `served-operations.json`, regenerated with the dev servers stopped;
  - `api:generate`, followed by a clean `api:check`.
- **Development mode.** Never start Keycloak or flip `CSRM_AUTH_OIDC_ENABLED`, `CSRM_DEV_IDENTITY`, `IDAMBOX_KEYCLOAK_PROVISIONING` or `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION`. New settings go in `.example` files with safe defaults. This phase needs none, because the cap and the bounds are constants.
- **Paths.** `apps/backend` and `apps/csrm` only. Never the pre-rename folder names.
- **UI.** Every value comes from `docs/design/csrm-design-direction.md`. New patterns are X-n extensions, recorded by a plan task before the implementing task. Meet the G-4 premium bar.
- **Gate.** `api:check`, `typecheck`, `lint`, `test` for both apps, `test:e2e`, then `git status --short`. Executors run under Node 24.19.0 (`export PATH="/c/ProgramData/nvm/v24.19.0:$PATH"`).
- **Project skills (`.agents/skills/`).**
  - **`tdd`:** a failing test first at each seam (D-38).
  - **`codebase-design`:** deep modules with thin adapters. One export module and one spreadsheet module, with per-view adapters, not 22 bespoke handlers.
  - **`domain-modeling`:** JDL names, and the glossary's "Released" for `approved`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Export authorisation (grant, underlying read, human-only, record scope) | API / Backend (Strapi policy and service) | — | Navigation visibility is not security. The export resolves exactly the list's scope (D-13). |
| Query parsing for an export | API / Backend (each list's closed parser) | Frontend Server (the shared web schema validates before the call) | One parser per list, so a filter the list refuses, the export refuses (D-05). |
| Row selection, ordering, cap, projection | API / Backend (list repository plus export module) | Database (count, ordered ids, batched hydrate) | Strapi counts before it builds anything (D-17). |
| File generation (CSV, XLSX), neutralisation, file name, headers | API / Backend (the shared spreadsheet module) | — | D-12: files are built only in Strapi; the web never builds, parses or alters a file. |
| Export event log | API / Backend (security event log module, through `strapi.log`) | Log platform / SIEM (where it is queryable) | No content type (D-18). |
| Byte transfer to the browser | Frontend Server (Server Action returns a `Uint8Array`) | Browser (Blob plus anchor save) | D-19; the typed API layer; no Route Handler. |
| Export dialog, column choice, cap warning | Browser / Client (Client Component) | Frontend Server (reads the list total and the visible columns) | Interaction state only; the server enforces the cap again. |
| Import file reading, encoding, bounds, header matching, value conversion, classification | API / Backend (the shared reading module plus the administration import) | — | D-25: Strapi holds the one authoritative parser; the client parser retires. |
| Similar-name decisions | API / Backend (preview record, commit validation) | Browser (per-row and bulk choice UI) | Decisions are checked against the server's retained preview record (D-30). |
| Templates and error reports | API / Backend | Frontend Server (Server Action passes the bytes through) | Server-authoritative, never built from client-supplied issues (D-32). |
| Print-ready report | Frontend Server (Server Component reading the released loader) | Browser (print stylesheet, `window.print()`) | No new operation and no PDF dependency (D-23). |

## Standard Stack

### Core (new, Strapi only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `write-excel-file` | 4.1.1 (published 2026-06-08) | XLSX writing: typed String, Number, Boolean and Date cells, several sheets, frozen header rows, bold cells, column widths, `@` text format | MIT; 1.25M weekly downloads; one dependency (`fflate`); `node` export with `toBuffer()`. It never writes a formula unless `type: 'Formula'` is given. [VERIFIED: npm registry; package source `modules/xlsx/files/sheet.xml/cell.js` read this session; measured] |
| `read-excel-file` | 9.3.10 (published 2026-08-10) | XLSX reading of the first sheet: cached values, booleans, dates, typed errors | MIT; 2.79M weekly downloads; reads cached formula results ("returning the value that is already pre-computed"); raises `InvalidInputError` with codes `XLS_FILE_NOT_SUPPORTED`, `FILE_NOT_SUPPORTED` and `INVALID_ZIP`. [VERIFIED: npm registry; README and source read; probed on Node 24.19.0] |

### Existing (reused, no change)

| Library or API | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| `csv-parse` | 7.0.2 (`apps/backend/package.json`) | CSV parsing (the reading module keeps it on the Strapi side; it leaves the web bundle) | CSV import only. [VERIFIED: apps/backend/package.json:26 grep] |
| `node:zlib` `inflateRawSync(buf, { maxOutputLength })` | Node 24.19.0 built-in | The actual-size zip-bomb bound (throws `ERR_BUFFER_TOO_LARGE`) | XLSX pre-check before the reader runs. [VERIFIED: probe output `maxOutputLength throws: ERR_BUFFER_TOO_LARGE Cannot create a Buffer larger than 52428800 bytes` on Node 24.19.0] |
| `TextDecoder('utf-8', { fatal: true })` | WHATWG built-in | Strict UTF-8 decoding (already in `csv-import.ts:129-135`) | CSV encoding check. [VERIFIED: csv-import.ts read] |
| `Intl.DateTimeFormat` with `timeZone` | built-in (full ICU in Node and official builds) | Viewer-local calendar dates; IANA zone validation by try/catch | Instants as local dates (D-07). [ASSUMED: full ICU in the deployment Node build] |
| `openapi-fetch` `parseAs: "arrayBuffer"` | 0.17.0 | Binary success body; JSON error body still parsed | Every export, template and error-report service call. [VERIFIED: `node_modules/openapi-fetch/dist/index.mjs:183-198` grep] |
| React Flight typed-array rows | React 19.2.4 in Next 16.3.6 | `Uint8Array` returned from a Server Action as raw binary | D-19 transfer. [VERIFIED: react-server-dom-webpack-server.node.production.js:1724-1725, 1930-1943] |
| Koa response headers | Koa 2.16.4 (Strapi 5.51) | `ctx.set`, `ctx.type`, `ctx.body = Buffer` | File responses. `ctx.attachment()` exists, but emits `filename*` only for non-ASCII names, so set the header explicitly (Code Example 3). [VERIFIED: node_modules/.pnpm/koa@2.16.4/…/lib/response.js:308-311] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `write-excel-file` + `read-excel-file` | `exceljs` 4.4.0 | It reads and writes both, supports data validation, and is MIT. But its last release was 2023-10-19, and it carries `uuid@^8.3.0` (moderate advisory GHSA-w5hq-g745-h8pq, fixed only in 11.1.1, unreachable within `^8`), `tmp@^0.2.0` and `archiver@5`. This is the D-12 fallback if the leaning pair fails a gate. [VERIFIED: npm view; npm advisory bulk endpoint] |
| — | `xlsx` (SheetJS) 0.18.5 on npm | Excluded. It has two high advisories (GHSA-4r6h-8v6p-xvw6, prototype pollution, <0.19.3; GHSA-5pgg-2g8v-p4x9, ReDoS, <0.20.2), and the patched builds are not on the npm registry. [VERIFIED: npm advisory bulk endpoint] |
| A CSRM central-directory scan + `zlib` | `yauzl` (validates entry sizes) | It would be a second new dependency to justify. The CSRM scan is about 80 lines over fixed APPNOTE offsets, with fixture tests. [ASSUMED: yauzl's behaviour, not checked this session] |
| The leading single quote (D-11) | OWASP's leading tab inside the quoted field | OWASP calls the tab "reliable" in Excel, and notes that "the tab character remains part of the underlying data". It switches only on Excel evidence (D-11), and none can be produced here. |
| Data-validation dropdowns in templates | `@onparallel/write-excel-file-data-validation` (the listed add-on) | Optional under D-31. It would be a third package. Recommend no dropdowns: the Notes sheet lists the allowed values. [CITED: write-excel-file README, "Features"] |

**Installation (Strapi only; executed by the plan that adds it, with its justification):**
```bash
export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && pnpm --filter @csrm/strapi add write-excel-file@4.1.1 read-excel-file@9.3.10 --save-exact
```

**Version verification (2026-10-01):**
- `npm view write-excel-file version`: 4.1.1.
- `npm view read-excel-file version`: 9.3.10.
- Both declare `engines.node: ">=18"`, and Node 24.19.0 ran both in the probe.
- The repository pins exact versions (`"csv-parse": "7.0.2"`). Keep that convention, because `read-excel-file` 9.x is moving fast. 9.3.3 (2026-07-20) fixed "non-ASCII characters were incorrectly interpreted" (CHANGELOG), so a non-ASCII round-trip test is mandatory.

## Package Legitimacy Audit

Ran `gsd-tools query package-legitimacy check --ecosystem npm` on the candidates and their transitive dependencies (2026-10-01):

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| write-excel-file 4.1.1 | npm | first release 2021-06-17; latest 2026-06-08 | 1,252,606/wk | gitlab.com/catamphetamine/write-excel-file | [OK] | Approved |
| read-excel-file 9.3.10 | npm | first release 2018-03-21; latest 2026-08-10 | 2,787,807/wk | gitlab.com/catamphetamine/read-excel-file | [OK] | Approved |
| fflate 0.8.3 (transitive) | npm | latest 2026-05-16 | 103M/wk | github.com/101arrowz/fflate | [OK] | Approved. Must resolve to 0.8.3: 0.8.0–0.8.2 carry GHSA-px8p-9vwx-vf98 (moderate, ZIP64 infinite loop) |
| unzipper-esm 0.13.3 (transitive) | npm | latest 2026-07-27 | 1.95M/wk | github.com/catamphetamine/node-unzipper | [OK] | Approved (used only by the `/node` reader path, which this research does not use) |
| worker-f 0.1.20 (transitive) | npm | latest 2026-08-07 | 1.48M/wk | gitlab.com/catamphetamine/worker-f | [OK] | Approved |
| saxen 11.2.0 (transitive) | npm | latest 2026-09-21 | 2.17M/wk | github.com/nikku/saxen | [SUS] (reason `too-new`: latest version 10 days old) | Kept, flagged. `read-excel-file` vendors its own SAX parser (`commonjs/xml/parseXmlStream.saxen.js` requires `../saxen/parser.js`, and `// import { Parser } from 'saxen'` is commented out), so `saxen` is installed but not loaded by the code paths used. The planner adds a `checkpoint:human-verify` before the install, and the install task checks the lockfile resolution. |
| graceful-fs 4.2.11, node-int64 0.4.0 (transitive via unzipper-esm) | npm | long-standing | — | — | not separately checked (graceful-fs is already in the lockfile) | Approved |
| exceljs 4.4.0 | npm | latest 2023-10-19 | 19M/wk | github.com/exceljs/exceljs | [OK] | Not chosen (fallback) |
| xlsx 0.18.5 | npm | latest 2022-03-24 | 15M/wk | github.com/SheetJS/sheetjs | [OK] (registry) but two high advisories | REMOVED (D-12) |

- **Postinstall scripts:** none for any package (`postinstall: null` from the seam). The probe install used `--ignore-scripts` and showed 8 packages, 8.1 MB on disk.
- **Advisories:** npm bulk advisory endpoint, 2026-10-01. None for `write-excel-file@4.1.1`, `read-excel-file@9.3.10`, `unzipper-esm`, `worker-f`, `saxen` or `fflate@0.8.3`.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `saxen` (transitive, `too-new`). The planner inserts a `checkpoint:human-verify` before the install task.

## Architecture Patterns

### System Architecture Diagram

```
EXPORT
 Browser: Export dialog (format, columns) ──► Server Action exportXAction(input)
     │                                          │ 1. validate with the list's shared web query schema
     │                                          │ 2. read the csrm-time-zone cookie (Phase 10)
     │                                          ▼
     │                               feature *-service.ts  (openapi-fetch, parseAs: "arrayBuffer")
     │                                          │ GET /api/v1/<list>/export?<list params>&format&columns&timeZone
     │                                          ▼
     │   Strapi: global::csrm-authorization ── export FunctionAPI held? ── list read held? ── agent role? ─► 403
     │                                          │ (sets the list's scope flags, exactly as the list route)
     │                                          ▼
     │   export controller ──► list's closed parser (400 on refusal) ──► list scope ──► repository.count
     │                                          │                                    │ > 10,000 → 409/422 + log "refused"
     │                                          ▼                                    ▼
     │                         ordered ids ──► hydrate in batches ──► list projection (due state, labels)
     │                                          ▼
     │                         column vocabulary (closed; chosen ∩ readable) ──► cell values (labels, dates in zone)
     │                                          ▼
     │                         neutraliser (text cells) ──► CSV writer | XLSX writer (+ About sheet)
     │                                          ▼
     │                         security event log line (actor, view, filters, columns, count, outcome)
     │                                          ▼
     │                         200 bytes + Content-Type + Content-Disposition + nosniff + no-store
     ▼                                          │
 service validates type, name, size and signature ◄──┘ ──► Action returns { fileName, contentType, bytes: Uint8Array } or a refusal
 client helper: Blob + anchor download ──► toast (file name, row count)

IMPORT
 Browser: choose file (extension, type, ≤ 5 MiB only) ──► Server Action (FormData) ──► service (multipart) ──► Strapi preview
   Strapi: upload ──► signature sniff (PK / D0CF11E0 / FFFE / BOM / text)
            ├─ XLSX: central-directory guard (entries, methods, flags, ZIP64, vbaProject) ──► zlib actual-size check ──► read-excel-file/universal (sheet 1, trim:false)
            └─ CSV: strict UTF-8 (BOM stripped) ── fail ─► refusal "windows-1252" / "utf-16" ── delimiter check ─► refusal
            ▼
          header matcher (NFKC, lower case, strip spaces, _ and -; field or label; aliases) ──► warnings / refusals
            ▼
          value converters (text, flag, enum, #CLEAR, mark strip, example-row skip)
            ▼
          classifier (exact NFC tier ─► create/update/unchanged; similar tier ─► similar; ambiguous; rejected)
            ▼
          preview record (actor, collection, file digest, row states, issue codes) ──► preview JSON
   Commit: file + previewDigest + decisions{rowNumber: update|skip} ──► drift check ──► per-row transactions ──► result record ──► log line
   Error report: file + previewDigest|resultToken ──► rebuild rows not imported + Issues ──► CSV (BOM) | XLSX bytes

REPORT
 /app/assessments/{id}/report  and  /app/review/assessments/{id}/report  (Server Components)
   ──► shared released loader ──► the released read gated by the one released predicate (D-14) ──► A4 print layout ──► window.print()
```

### Recommended Project Structure

```
apps/backend/src/csrm/
├── spreadsheets/
│   ├── neutralise.ts            # sanitizeSpreadsheetCell (moved) + stripNeutraliserMark (inverse)
│   ├── csv-writer.ts            # BOM, CRLF, RFC 4180, every text cell quoted
│   ├── xlsx-writer.ts           # the only importer of write-excel-file
│   ├── xlsx-reader.ts           # the only importer of read-excel-file (+ the guard)
│   ├── zip-guard.ts             # central-directory scan + zlib maxOutputLength
│   ├── file-sniff.ts            # signature and encoding sniffing → closed refusal reasons
│   ├── header-match.ts          # normalise, match field/label/alias, warnings, refusals
│   ├── value-convert.ts         # text, flag, enum, #CLEAR, mark strip (Phase 18 extends)
│   └── file-response.ts         # content types, safe names, headers on ctx
├── exports/
│   ├── export-cap.ts            # EXPORT_ROW_CAP = 10_000 (one definition)
│   ├── export-views.ts          # view registry: key, parser, scope, repository adapter, columns
│   ├── columns/<view>.ts        # closed column vocabulary per view
│   ├── labels.ts                # one display vocabulary per family (parity-tested with the web)
│   └── run-export.ts            # count → cap → ids → hydrate → project → write → log
└── audit/
    └── security-event-log.ts    # one structured line per event (export, import commit; G-17 reuses)

apps/csrm/src/
├── components/csrm/export/      # ExportDialog (format, column checklist primitive), ExportButton
├── lib/files/save-file.ts       # client helper: Blob + anchor (the existing download helper, moved)
├── lib/files/file-response.ts   # server-side: type, name, size and signature validation (parity guard file mode)
└── features/<feature>/*-service.ts + *-actions.ts   # one export function and action per view
```

### Pattern 1: An export is its list, whole (D-05)

**What:** an export controller reuses the list's own closed parser, scope assertion and repository, with `page` and `pageSize` removed, then iterates ordered ids in batches.
**When to use:** every list export. The Risk register is the reference implementation, because its repository already separates `count`, `selectPage` and `hydrate`:

```ts
// Source: apps/backend/src/api/csrm-risk/services/risk-register.ts:50-55 (read this session, verbatim)
export type RiskRegisterRepository = {
  count: (filters: RiskRegisterFilters) => Promise<number>;
  selectPage: (input: { filters: RiskRegisterFilters; sort: RiskRegisterSort; offset: number; limit: number }) => Promise<string[]>;
  hydrate: (documentIds: readonly string[]) => Promise<RecordValue[]>;
  selectedLabels?: (filters: RiskRegisterFilters) => Promise<Record<string, { documentId: string; label: string }>>;
};
```

The export uses `count(filters)`, refuses above the cap, then `selectPage({ filters, sort, offset: 0, limit: total })` and `hydrate` in batches of 500 [ASSUMED batch size], and projects each row with `projectRiskRegisterItem(document, today)`. That function already applies `deriveTreatmentDueState` (G-16), so the export never recomputes the due state. Lists that use `strapi.documents().findMany` with `buildAssessmentCollectionQuery` (assessments) paginate with `limit` and `start` up to the total.

**The parser problem.** Each list parser today requires or defaults `page` and `pageSize`. Add one exported helper per parser, `parse<List>ExportQuery`, that reuses the same closed filter and sort parsing and refuses `page` and `pageSize`. Do not copy the parser.

### Pattern 2: The export policy: own grant, plus underlying read, plus human (D-13)

**What:** the authorisation policy checks one `config.operation` today. Exports need the export's grant and the list's read, both held through the same role path, and a refusal for any service identity.

```ts
// Source: apps/backend/src/policies/csrm-authorization.ts:57-62 (verbatim)
const ANALYST_INSIGHT_UNDERLYING_READS = [
  CSRM_RISK_OPERATIONS.listRegister,
  listAnalystReviewRequests,
  CSRM_QUESTIONNAIRE_OPERATIONS.listAll,
  CSRM_ASSESSMENT_OPERATIONS.list,
] as const;
```

```ts
// Source: apps/backend/src/policies/csrm-authorization.ts:334-338 (verbatim)
  if (config.requireAnalystInsightScope) {
    const requiredOperations = [config.operation, ...ANALYST_INSIGHT_UNDERLYING_READS];
    if (!requiredOperations.every((required) => hasHumanAnalystOperation(grants.explicitRoles, required))) {
      return deny(policyContext, "CSRM analyst insight access is denied.");
    }
```

**Recommendation:** add to `AuthorizationConfig` an `underlyingRead?: string`, and a module-level set `EXPORT_OPERATIONS`.
- **Analyst exports:** require `hasHumanAnalystOperation(explicitRoles, …)` for both the export and the read. Each analyst export also joins `HUMAN_ANALYST_ONLY_OPERATIONS` (D-13).
- **Own-record exports:** require the export and the read through the same grant path that `effectiveOperation` uses (the Requestor birthright).
- **Every export:** deny when the caller holds the `Security Analyst Agent` role at all, its Requestor birthright included (G-1). This must be a new check. `HUMAN_ANALYST_ONLY_OPERATIONS` alone would also refuse human Requestors on own-record exports, because its guard tests `hasHumanAnalystOperation`.
- **Scope flags:** keep the route's existing flags (`requireAnalystRiskRegisterScope`, `requireAssessmentOwnerCollectionScope`, …) so the export resolves exactly the list's scope.

**Catalogue strings carry the query.** The reserved register export's catalogue URL is `GET:/api/v1/risks/export?format={format}` (catalogue line 1716, verbatim), and operation constants keep queries (`listRiskTypes: "GET:/api/v1/risk_types?picker=assessment"`, `operations.ts:7`). So the export operation constant must be exactly `GET:/api/v1/risks/export?format={format}`. Meanwhile `served-operations.json` lists it as `"catalogueUrl": "GET:/api/v1/risks/export"` (line 2131). Follow the existing normalisation; do not change the catalogue URL (D-13: "names, URLs and descriptions unchanged").

### Pattern 3: One released predicate (D-14)

Today four pieces gate the Requestor's released reads:

```ts
// Source: apps/backend/src/api/csrm-assessment/services/assessment-scope.ts:159-189 (verbatim excerpt)
export function releasedAssessmentQuery(ownerDocumentId: string): RecordValue {
  return {
    filters: {
      assessmentStatus: { $eq: "approved" },
      approvalDate: { $notNull: true },
      assessmentDate: { $notNull: true },
      approvedBy: { documentId: { $notNull: true } },
      assessmentRequest: {
        requestStatus: { $eq: "approved" },
        requestor: { documentId: { $eq: ownerDocumentId } },
      },
    },
    populate: releasedAssessmentPopulate,
  };
}
...
export function isReleasedAssessmentForOwner(document: unknown, ownerDocumentId: string): document is RecordValue {
  if (!isRecord(document) || !isReleased(document)) return false;
  const assessmentRequest = isRecord(document.assessmentRequest) ? document.assessmentRequest : null;
  const requestor = assessmentRequest && isRecord(assessmentRequest.requestor) ? assessmentRequest.requestor : null;
  return assessmentRequest?.requestStatus === "approved" && requestor?.documentId === ownerDocumentId;
}
```

The fourth is the controller's `releasedForOwner` (`csrm-assessment.ts:100-106`), used by the detail (:168), risks (:259) and control implementations (:283).

**Recommendation:** export one `findReadableReleasedAssessment({ documents, viewer, documentId })` (the name is the planner's) from a single module. It composes "readable by this viewer" (today: Requestor equals viewer) with "released" (today: `approved` plus the release facts). All three released reads, the assessment export and the report loader's Strapi read call it.
- **Phase 17** widens "readable" in that one place.
- **Phase 17.1** widens "released" to `approved` or `closed`.
- **Phase 16** (S-8) supplies the active-risk filter fragment that the risks read and the export both use.
- **The analyst export** reads through the analyst detail and refuses an unreleased record with a closed 409 reason (D-15).

### Pattern 4: Binary transfer through a Server Action (D-19)

- **Strapi** sends the bytes with explicit headers (Code Example 3).
- **The feature service** calls openapi-fetch with `parseAs: "arrayBuffer"`, then validates the response:
  - the `Content-Type` is in the view's allow-list;
  - the `Content-Disposition` file name matches `^[a-z0-9][a-z0-9-]{0,150}\.(csv|xlsx)$`;
  - the size is ≤ a bound;
  - the signature is right: `EF BB BF` for CSV, `50 4B 03 04` for XLSX.
- **The Action** returns `{ ok: true, fileName, contentType, bytes: new Uint8Array(arrayBuffer), rowCount }`.
- **The row count:** an `X-CSRM-Row-Count` response header that the service parses as an integer, or the count the dialog already shows. The planner decides, and records the header in the spec.

**Why it is safe at the cap:**
- Flight emits `Uint8Array` as a raw binary row. The source, verbatim from `react-server-dom-webpack-server.node.production.js:1724-1725`:
  ```js
  if (value instanceof Uint8Array)
        return serializeTypedArray(request, "o", value);
  ```
  `emitTypedArrayChunk` (:1930) pushes the bytes with a hex length prefix.
- The measured sizes at the cap are 0.9 MB (XLSX) and about 5 MB (CSV).
- Next's `serverActions.bodySizeLimit` ('6mb', `next.config.ts:26-27`) bounds the request, not the response.

**Consequences to plan for:**
- Next dispatches Server Actions one at a time per client (`server-actions.md`, "Sequential dispatch"). An export of about 1 s briefly queues any other action from that tab. This is acceptable, and the dialog's pending state covers it.
- An Action is a POST reachable by anyone who can send it. It still validates input, and Strapi still authorises.
- Do not call `cookies().set` in the export Action. Mutating cookies re-renders the page in the same response. Reading the zone cookie is fine.

### Pattern 5: The bounded reading pipeline (D-25, D-26)

1. **Sniff the signature** on the first bytes, never the extension alone:
   - `PK\x03\x04` is an XLSX candidate;
   - `D0 CF 11 E0 A1 B1 1A E1` is either a legacy `.xls` or an encrypted or password-protected OOXML. Both are CFB containers. Look for the UTF-16LE stream name `EncryptedPackage` to tell them apart, then refuse with the right reason;
   - `FF FE` or `FE FF` is UTF-16 ("Unicode Text");
   - `EF BB BF` is UTF-8 with a BOM;
   - NUL bytes in the first 4 KiB mean UTF-16 without a BOM, or a binary file;
   - otherwise, treat the file as CSV text.
2. **CSV:**
   - Decode with `TextDecoder('utf-8', { fatal: true })`. On failure, refuse with the Windows-1252 reason. CSRM never decodes a legacy encoding (D-26). The WHATWG `windows-1252` decoder never fails, so "decodes as Windows-1252" means any non-UTF-8 file without NUL bytes.
   - Then the delimiter check: refuse only if the header line contains no comma **and** contains `;` or a tab. A single-column file ("Name") is legitimate.
   - Keep `assertBytesAndPreflightRecords` and the `csv-parse` options.
3. **XLSX:**
   1. Run the central-directory guard (Code Example 6). It finds the EOCD and refuses:
      - ZIP64 markers;
      - more than 512 entries [ASSUMED];
      - an encryption flag (bit 0);
      - a method other than 0 or 8;
      - `xl/vbaProject.bin` or a `macroEnabled` content type, which means a macro-enabled workbook;
      - a declared uncompressed total above 50 MiB.
   2. Inflate each entry's compressed span with `zlib.inflateRawSync(span, { maxOutputLength: remaining })`, so the actual total is bounded too.
   3. Only then call `readSheet(arrayBuffer, 1, { trim: false })` from `read-excel-file/universal`. It unzips with `fflate`'s central-directory reader, the same entries the guard saw. The `/node` export streams local headers through `unzipper-esm`, which a crafted archive can make disagree with the central directory (a parser differential).
   4. Apply `CSV_MAX_ROWS` (5,000), and `CSV_MAX_RECORD_BYTES` (65,536) to each row's UTF-8 length.
4. **Map the reader's errors** onto closed reasons: `InvalidInputError.code` of `XLS_FILE_NOT_SUPPORTED`, `FILE_NOT_SUPPORTED` or `INVALID_ZIP` (verified by probe: `cfb InvalidInputError XLS_FILE_NOT_SUPPORTED …`, `csv InvalidInputError FILE_NOT_SUPPORTED …`).

**The bound value.** The probe's 10,000 × 15 workbook was 11.1 MB uncompressed from 0.89 MB, a ratio of about 12.5:1. The import's maximum, 5,000 rows, is about half that. A 50 MiB total (52,428,800 bytes) gives about 10× headroom over a maximal legitimate template, and refuses a 200 MiB bomb (verified). This is the planner's discretion under D-26; record it in `phase-19-import-tolerance.md`.

### Pattern 6: Headers and values (D-27, D-28)

- **Header key:** `value.trim().normalize("NFKC").toLowerCase().replace(/[\s_-]+/g, "")`. Match it against each column's field name and display label under the same key. Two headers mapping to one field is a refusal naming both; a missing required column is a refusal naming its label.
- **Today's code** refuses any unknown header:
  ```ts
  // csv-import.ts:149-150 (verbatim)
    const column = byName.get(normalized);
    if (!column) csvError("the file contains an unsupported header.");
  ```
  This becomes "ignored, with a warning naming the header". `Issues`, and a reference export's read-only columns, are ignored with an informational note instead.
- **Flags:** `yes`, `no`, `y`, `n`, `true` and `false` after lower-casing, plus XLSX booleans (`true` and `false` from the reader).
- **`#CLEAR`** applies to the whole trimmed cell, case-insensitively.
- **Number cells in text columns** (a control number typed as `42`) arrive as numbers from XLSX. Convert them with `String(value)`, and give templates and exports `format: '@'` on text columns so Excel keeps what users type as text (probe: `"0042"` round-tripped with `format: '@'`).
- **Mark stripping** is the exact inverse of the neutraliser (Pitfall 9).

### Pattern 7: Exact and similar tiers (D-30)

Today one normaliser drives both matching and uniqueness:

```ts
// administration-query.ts:217-219 (verbatim)
export function normalizeAdministrationNaturalKey(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-AU");
}
```

`classifyRows` keys existing records by this value (`csv-import.ts:204-210`). That is why UAT-052's lower-case row became an ordinary update.

**Recommendation:**
- `exactKey = trim + NFC`;
- `similarKey = trim + NFKC + toLowerCase + collapse internal whitespace (/\s+/g → " ")`;
- index existing records by both. An exact hit classifies as today. A similar-only hit becomes `similar`, carrying `matchedDocumentId` and the existing name.
- Leave `assertNaturalKeyAvailable` (uniqueness) on the broad normaliser, so a create can never introduce a case-only duplicate (D-30).
- The commit form gains a bounded `decisions` field: a JSON object of row number → `update` or `skip`, at most 5,000 entries, parsed closed. Strapi checks that every `similar` row of the retained preview has a decision, and that no decision targets a non-similar row. The preview record must therefore keep the `similar` state and `matchedDocumentId` (it already keeps `state`, `matchedDocumentId` and `matchedUpdatedAt`).

### Pattern 8: Templates and server-authoritative error reports (D-31, D-32)

- **Templates** are generated from `ADMINISTRATION_CSV_CONTRACTS` plus a display-label vocabulary: header labels, one example row with a reserved natural key (for example `Example – delete or replace this row`), and, in XLSX, a Notes sheet.
- **Error reports** need the issues the user saw. Today the preview record keeps only `{ state, matchedDocumentId, matchedUpdatedAt }` per row (`administration-workflow.ts:200-206`). Extend it with compact issue codes (`{ code, field }`, at most 20 per row; the message is regenerated from a closed issue vocabulary). A short-lived result record, keyed and bounded like preview records, holds the commit outcome for the Results-step report. The error-report operation takes the same file plus the token, checks the file digest against the record, rebuilds the rows from the file, and writes the original header as typed, plus the rows not imported, plus `Issues`.
- **Bound the retained bytes** per record (for example 1 MiB of issue data), refusing beyond it. That keeps the 256-record global cap's memory bounded.

### Pattern 9: The security event log (D-18)

One module with one function per event, writing `strapi.log.info(JSON.stringify({ event: "csrm.export", … }))`. The precedent is the transcript line in `openai-compatible-client.ts:27`, `globalThis.strapi.log.info(JSON.stringify(payload))`.
- **Testability:** make the sink injectable (a `(line: string) => void` parameter defaulting to `strapi.log.info`), so unit tests assert the payload, and integration tests capture lines through the harness.
- **Payload hygiene:** the payload holds parsed filters, never raw query strings, and never a cell value.

### Pattern 10: The print report (D-23, D-24)

- **The routes:** Server Components under `app/(app)/app/assessments/[documentId]/report/page.tsx`, and the analyst twin. They reuse a loader factored out of `app/(app)/app/assessments/[documentId]/page.tsx`.
- **The page box:** `@page { size: A4; margin: … }`. Chrome 131 added page margin boxes (`@top-center`, `counter(page)`, `counter(pages)`) [CITED: developer.chrome.com/blog/new-in-chrome-131].
- **Print rules:** `thead { display: table-header-group }` repeats table headers; `break-inside: avoid` keeps a risk card together.
- **The proof:** Playwright `page.emulateMedia({ media: 'print' })` (precedent: `design-system-conformance.spec.ts:374`) plus Chromium `page.pdf({ format: 'A4', preferCSSPageSize: true })`, asserting at least one page.

### Anti-Patterns to Avoid

- **A second copy of a list parser for its export.** It drifts. Factor `parse<List>ExportQuery` out of the same module (Pattern 1).
- **Building a file in the web,** or parsing an upload in the browser. Both are forbidden by D-12 and D-25. `csv-client-parser.ts`'s parsing and its `sanitizeSpreadsheetCell` copy retire; only its download helper survives.
- **A Route Handler for downloads.** Forbidden (AGENTS.md; D-19).
- **Recomputing the due state, or reading `targetDate`, in the export module.** G-16: take it from the list projection.
- **A Requestor-specific "raised it" check in the export.** G-12: call the one released predicate.
- **Logging cell values or raw query strings.** D-18.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XLSX packaging (OOXML parts, shared strings, styles, zip) | Your own OOXML writer | `write-excel-file` behind `xlsx-writer.ts` | The content types, relationships, styles index and frozen-pane XML are easy to get subtly wrong for Excel |
| XLSX parsing (shared strings, rich text, date styles, 1904 epoch, inline strings, cached formula values) | Your own SAX or regex reader | `read-excel-file/universal` | It handles `t="s"`, `t="inlineStr"`, `t="b"`, `t="e"`, `t="str"`, date-style detection and Strict OOXML (9.3.8) |
| Decompression size limiting | Counting stream bytes by hand | `zlib.inflateRawSync(…, { maxOutputLength })` | Built in; throws `ERR_BUFFER_TOO_LARGE` (verified) |
| CSV parsing | A split-on-comma parser | `csv-parse` 7.0.2 (kept) | Quoted newlines and doubled quotes; already proven by the 5,000-row bound tests |
| UTF-8 validation | A byte-pattern checker | `TextDecoder('utf-8', { fatal: true })` | Exact WHATWG semantics; already in use |
| Time-zone conversion | Offset arithmetic | `Intl.DateTimeFormat(…, { timeZone }).formatToParts` | DST, historical offsets, IANA validation by try/catch |
| PDF generation | A PDF library | Browser print with `@page` | D-23; no dependency |
| Binary transport | base64 inside JSON | Return `Uint8Array` from the Action | Flight sends raw binary rows; base64 adds 33% and a copy |

**Key insight:** the dangerous part of spreadsheets is everything around the cells: archive bombs, legacy encodings, formula triggers and parser differentials. Libraries cover the format. CSRM's own code must own the bounds and the refusals, and keep them in one module.

## Common Pitfalls

### Pitfall 1: `/export` captured by `/:id` routes
**What goes wrong:** `GET /v1/risks/export` matches `GET /v1/risks/:riskId` (`csrm-risk.ts:37-41`) and returns the detail's 404 or 400.
**Why it happens:** the router matches in registration order, and `:riskId` accepts `export`. The same applies to `/v1/risk_assessments/:assessmentId`, `/v1/questionnaires/:questionnaireId`, `/v1/information_systems/:informationSystemId` and the other detail routes.
**How to avoid:** register each export route before its sibling `/:id` route in the same routes file, as `/v1/risk_assessments/status_summary` precedes `/:assessmentId` today. Add an integration assertion that `/export` reaches the export handler (`Content-Type` is the file type).
**Warning signs:** an export returns JSON `{"error":{"status":404…}}`.

### Pitfall 2: The catalogue URL includes the query
**What goes wrong:** the policy denies the register export for everyone.
**Why it happens:** grants compare against the catalogue's `url` exactly, `GET:/api/v1/risks/export?format={format}`.
**How to avoid:** the operation constant equals that string; the served-operations row stays `GET:/api/v1/risks/export`. Prove both in `contract-catalogue` and the matrix.

### Pitfall 3: Strapi's TypeScript resolution
**What goes wrong:** `import … from "write-excel-file/node"` or `"read-excel-file/universal"` fails to typecheck.
**Why it happens:** `apps/backend/tsconfig.json` uses `"module": "CommonJS"` and `"moduleResolution": "Node"` (node10), which ignores `exports` maps. The packages ship subpath directories (`node/`, `universal/`), each with `index.d.ts` and a `package.json` whose `main` is `index.cjs`. Node10 directory resolution should fall back to `index.d.ts`. [ASSUMED: not compiled in the repo this session]
**How to avoid:** the plan that adds the dependency starts with a typecheck tracer. Import both subpaths in `xlsx-writer.ts` and `xlsx-reader.ts`, then run `tsc` and the test build. If resolution fails, add a typed local declaration for the narrow surface used, rather than changing `moduleResolution`.
**Runtime is safe:** `require` honours `exports`. The probe's `require('write-excel-file/node')` and `require('read-excel-file/universal')` ran on Node 24.19.0.

### Pitfall 4: `readSheet("string")` reads a file path
**What goes wrong:** in the `/node` export, a string input is treated as a path (README: "It can read from a file path, a Stream, a Buffer or a Blob").
**How to avoid:** use `/universal` with an `ArrayBuffer`. Slice it exactly: `buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)`, because Node Buffers share pooled memory.

### Pitfall 5: Dates written as UTC serials
**What goes wrong:** a local calendar date shifts by a day in Excel.
**Why it happens:** `convertDateToSerialNumber` is `date.getTime() / day + daysBeforeUnixEpoch`, which is UTC-based (package source, read this session).
**How to avoid:** compute the viewer-local calendar date with `Intl` (`formatToParts` in the viewer's zone), then write `new Date(Date.UTC(y, m - 1, d))` with `format: 'd mmm yyyy'`. The probe wrote `Date.UTC(2026, 9, 1)` and read back `2026-10-01T00:00:00.000Z`. For CSV, write ISO `YYYY-MM-DD` [ASSUMED format choice; the UI-SPEC confirms].

### Pitfall 6: The contract guards assume JSON responses
**What goes wrong:** the parity guard and `contract-catalogue` read `responses['200'].content['application/json']`. That is `contract-response-parity.test.ts:205` and `contract-catalogue.integration.test.ts:59`, among other places. Binary operations break both, and the spec has only `application/json` responses today (verified).
**How to avoid:**
- Add a `'file-response'` mode to the parity guard's module inventory: the validator names the allowed content types and the signature check.
- In OpenAPI 3.1, declare binary bodies as `content: { "text/csv": { schema: { type: "string", contentMediaType: "text/csv" } }, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { … } }`. Declare error bodies as JSON.
- Do this in the first contract plan.

### Pitfall 7: Every analyst export must refuse the agent, and the own-record exports too
**What goes wrong:** the service agent holds the Requestor birthright, so it passes an own-record export's grant check.
**How to avoid:** a dedicated "no Security Analyst Agent role" check for every export operation (Pattern 2). The matrix row `serviceAgent → 403` on every export, including My lists and the released assessment.

### Pitfall 8: The cap check races the data
**What goes wrong:** the count is below the cap, but more rows are written by the time of hydration.
**How to avoid:** fetch ids with `limit: cap + 1` after the count, and refuse if more than `cap` arrive. Never write a partial file.

### Pitfall 9: The neutraliser is not invertible
**What goes wrong:** a stored value that genuinely begins with `'=` is exported unmarked, because `'` is not a trigger. Re-import then strips the quote, and the value changes.
**Why it happens:** today's rule:
```ts
// csv-import.ts:295-299 (verbatim)
const FORMULA_INITIATORS = /^(?:[=+\-@\t\r\n＝＋－＠]|\s+[=+\-@＝＋－＠])/u;

export function sanitizeSpreadsheetCell(value: string): string {
  return FORMULA_INITIATORS.test(value) ? `'${value}` : value;
}
```
**How to avoid:** also mark values that begin with one or more `'` followed by a trigger (`/^'+(?:[=+\-@\t\r\n＝＋－＠]|\s+[=+\-@＝＋－＠])/u`). The import strips exactly one leading `'` only when what follows matches the trigger pattern, or the quote-run pattern.
**Proof:** a property test over a corpus that includes `'=x`, `''=x`, ` =x`, `＝x`, `-5` and `- n/a` shows `strip(mark(v)) === v`.

### Pitfall 10: XLSX shows the mark
**What goes wrong:** in an XLSX string cell the mark is literal content, so Excel shows `'=HYPERLINK(…)` with the quote visible (the probe read back `"'=HYPERLINK(\"https://example.test\",\"Click\")"`). This differs from a typed quote prefix, which Excel stores as the `quotePrefix` style. `write-excel-file` has no `quotePrefix` support (a grep found none).
**How to avoid:** accept it; D-11 mandates the mark in both formats. The About sheet says so (D-09). If the user retypes the cell, Excel stores the value without the quote, and the import receives the original value. That is still lossless.

### Pitfall 11: `trim` defaults to true in the reader
**What goes wrong:** leading whitespace before a trigger disappears before mark stripping and header matching, so CSV and XLSX behave differently.
**How to avoid:** `readSheet(…, { trim: false })`, and trim once in `value-convert.ts` for both formats (probe: `trim: false` returned `"'=1+2"` intact).

### Pitfall 12: Formula error cells become empty
**What goes wrong:** the reader silently turns `#DIV/0!` and similar errors into empty cells (README, "Formulas").
**How to avoid:** accept the behaviour, because a required field then gets `REQUIRED_VALUE`. Note it in the Notes sheet and the guidance copy.

### Pitfall 13: The `fflate` version
**What goes wrong:** the lockfile resolves `fflate` 0.8.2 for `write-excel-file`'s `^0.8.2`, which has GHSA-px8p-9vwx-vf98.
**How to avoid:** after install, `pnpm why fflate` must show only 0.8.3. Add a `pnpm-workspace.yaml` override only if it does not.

### Pitfall 14: Strapi multipart MIME for XLSX
**What goes wrong:** browsers send `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/octet-stream` or an empty string for `.xlsx`. Today's check (`administration-workflow.ts:141-144`) allows only `.csv`, with `text/csv` or `application/vnd.ms-excel`.
**How to avoid:** extension allow-list `{.csv, .xlsx}`, MIME advisory only (allowed set or empty or octet-stream), and the content signature authoritative (D-26).

### Pitfall 15: Server Action sequencing and the E2E download event
**What goes wrong:** the download fires after the Action resolves, through a programmatic anchor click. Playwright's `waitForEvent('download')` must be armed before clicking Export (precedent: `administration-workflow.spec.ts:339`).
**How to avoid:** assert `download.suggestedFilename()`, then read the saved file's first bytes for the signature.

### Pitfall 16: Encrypted workbooks look like `.xls`
**What goes wrong:** password-protected `.xlsx` files are CFB containers, so the reader reports `XLS_FILE_NOT_SUPPORTED`, and the fix-it message is wrong.
**How to avoid:** before calling the reader, scan the CFB directory for `EncryptedPackage` (UTF-16LE) and choose the encrypted reason. Fixture: an Excel-encrypted file. [ASSUMED: that marker; verify with a fixture produced by Excel or LibreOffice — neither is available here]

### Pitfall 17: The semicolon check versus single-column files
**What goes wrong:** a Risk Types file with only `Name` has no comma, and a naive check refuses it.
**How to avoid:** Pattern 5's rule (no comma **and** a `;` or tab in the header line).

### Pitfall 18: The template example row
**What goes wrong:** the example row is imported as a real record, or a real record is skipped because its name matched the reserved key.
**How to avoid:** the reserved key is a constant that the natural-key validation refuses for creates. The import skips a row only when its key equals the constant exactly (trimmed, NFC), and emits a note.

### Pitfall 19: Excel CSV habits that survive
**What goes wrong:** an Excel "CSV UTF-8" file starts with a BOM. A Mac "CSV" may be Mac Roman, which is refused as non-UTF-8. Leading zeros are lost on CSV open (`0042` becomes `42`).
**How to avoid:** BOM stripping (`bom: true` is already set), the fix-it copy, and XLSX-first guidance (D-33).

### Pitfall 20: Similar-tier normalisation
**What goes wrong:** JavaScript has no full Unicode case folding. `toLowerCase()` after NFKC misses `ß`/`SS`, and the Turkish dotless `ı`.
**How to avoid:** accept it, and document the rule ("NFKC, lower case, collapsed whitespace"). The uniqueness check stays broader, so a create never adds a near duplicate.

## Code Examples

### 1. The XLSX writer wrapper (the only importer of `write-excel-file`)
```ts
// Source: write-excel-file README ("Multiple Sheets", "Sheet Options", "Style") + probe on Node 24.19.0
import writeExcelFile from "write-excel-file/node";

export type XlsxCell = { kind: "text"; value: string } | { kind: "number"; value: number }
  | { kind: "date"; value: Date /* UTC midnight of the local calendar date */ } | { kind: "flag"; value: boolean } | null;
export type XlsxSheet = { name: string; header: readonly string[]; rows: readonly (readonly XlsxCell[])[]; widths: readonly number[] };

export async function writeWorkbook(sheets: readonly XlsxSheet[]): Promise<Buffer> {
  return writeExcelFile(sheets.map((sheet) => ({
    sheet: sheet.name,
    stickyRowsCount: 1,
    columns: sheet.widths.map((width) => ({ width })),
    data: [
      sheet.header.map((label) => ({ value: label, type: String, fontWeight: "bold" as const })),
      ...sheet.rows.map((row) => row.map((cell) => {
        if (cell === null) return null;
        if (cell.kind === "text") return { value: sanitizeSpreadsheetCell(cell.value), type: String, format: "@" };
        if (cell.kind === "number") return { value: cell.value, type: Number };
        if (cell.kind === "date") return { value: cell.value, type: Date, format: "d mmm yyyy" };
        return { value: cell.value ? "Yes" : "No", type: String }; // D-07: flags as Yes/No text
      })),
    ],
  }))).toBuffer();
}
```

### 2. The CSV writer
```ts
// Source: RFC 4180; OWASP CSV Injection ("Wrap each cell field in double quotes", "Escape every double quote")
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const quote = (text: string) => `"${text.replace(/"/g, '""')}"`;
export function writeCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): Buffer {
  const line = (cells: readonly CsvCell[]) => cells.map((cell) =>
    cell === null ? "" : cell.kind === "number" ? String(cell.value)
      : cell.kind === "date" ? cell.isoDate /* YYYY-MM-DD */ : quote(sanitizeSpreadsheetCell(cell.text))).join(",");
  return Buffer.concat([BOM, Buffer.from([header.map(quote).join(","), ...rows.map(line)].join("\r\n") + "\r\n", "utf8")]);
}
```

### 3. The file response in a Strapi controller
```ts
// Source: Koa 2.16.4 response API (ctx.set / ctx.type / ctx.body); RFC 6266 + RFC 5987
const SAFE_NAME = /^[a-z0-9][a-z0-9-]{0,150}\.(csv|xlsx)$/;
const TYPES = { csv: "text/csv; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } as const;
export function sendFile(ctx: KoaLikeContext, file: { name: string; format: "csv" | "xlsx"; bytes: Buffer; rowCount: number }): void {
  if (!SAFE_NAME.test(file.name)) throw new Error("unsafe export file name");
  ctx.set("Content-Disposition", `attachment; filename="${file.name}"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  ctx.set("X-Content-Type-Options", "nosniff");
  ctx.set("Cache-Control", "no-store");
  ctx.set("X-CSRM-Row-Count", String(file.rowCount)); // if the planner keeps the header
  ctx.type = TYPES[file.format];
  ctx.body = file.bytes;
}
```

### 4. The Server Action and service (web)
```ts
// Source: openapi-fetch 0.17 parseAs; Next 16.3 server-actions.md (validate, constrain returns)
'use server';
export async function exportRiskRegisterAction(input: unknown): Promise<ExportActionResult> {
  const parsed = riskRegisterExportInputSchema.safeParse(input);   // the list's shared web schema + format + columns
  if (!parsed.success) return { ok: false, reason: "INVALID_EXPORT_REQUEST" };
  const timeZone = await readViewerTimeZone();                      // Phase 10; null → Strapi falls back to UTC
  return exportRiskRegister({ ...parsed.data, ...(timeZone ? { timeZone } : {}) }); // service returns { ok, fileName, contentType, bytes: Uint8Array, rowCount } | refusal
}
```

### 5. The client save helper
```ts
// Source: the existing downloadAdministrationCsv in csv-client-parser.ts:228-235 (generalised)
export function saveFile(file: { fileName: string; contentType: string; bytes: Uint8Array }): void {
  const url = URL.createObjectURL(new Blob([file.bytes], { type: file.contentType }));
  const anchor = Object.assign(document.createElement("a"), { href: url, download: file.fileName });
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
```

### 6. The zip guard (central directory plus an actual-size bound)
```ts
// Source: PKWARE APPNOTE (EOCD 0x06054b50, CDFH 0x02014b50, LFH 0x04034b50) [ASSUMED offsets from the spec, to be proven by fixtures];
// node:zlib maxOutputLength (verified to throw ERR_BUFFER_TOO_LARGE on Node 24.19.0)
import { inflateRawSync } from "node:zlib";
export const XLSX_MAX_UNCOMPRESSED_BYTES = 52_428_800; // 50 MiB (research recommendation, D-26)
export const XLSX_MAX_ENTRIES = 512;
export function assertSafeXlsxArchive(bytes: Buffer): void {
  const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || bytes.length - eocd > 22 + 65_535) refuse("IMPORT_FILE_INVALID");
  const entries = bytes.readUInt16LE(eocd + 10), cdOffset = bytes.readUInt32LE(eocd + 16);
  if (entries > XLSX_MAX_ENTRIES || cdOffset === 0xffffffff) refuse("IMPORT_FILE_TOO_COMPLEX");
  let pointer = cdOffset, remaining = XLSX_MAX_UNCOMPRESSED_BYTES;
  for (let index = 0; index < entries; index += 1) {
    if (bytes.readUInt32LE(pointer) !== 0x02014b50) refuse("IMPORT_FILE_INVALID");
    const flags = bytes.readUInt16LE(pointer + 8), method = bytes.readUInt16LE(pointer + 10);
    const compressed = bytes.readUInt32LE(pointer + 20), declared = bytes.readUInt32LE(pointer + 24);
    const nameLength = bytes.readUInt16LE(pointer + 28), extraLength = bytes.readUInt16LE(pointer + 30), commentLength = bytes.readUInt16LE(pointer + 32);
    const localOffset = bytes.readUInt32LE(pointer + 42);
    const name = bytes.toString("utf8", pointer + 46, pointer + 46 + nameLength);
    if (flags & 0x1) refuse("IMPORT_WORKBOOK_ENCRYPTED");
    if (name === "xl/vbaProject.bin") refuse("IMPORT_WORKBOOK_MACRO_ENABLED");
    if ((method !== 0 && method !== 8) || declared === 0xffffffff || declared > remaining) refuse("IMPORT_FILE_TOO_LARGE");
    const start = localOffset + 30 + bytes.readUInt16LE(localOffset + 26) + bytes.readUInt16LE(localOffset + 28);
    const span = bytes.subarray(start, start + compressed);
    const actual = method === 0 ? span.length : inflateRawSync(span, { maxOutputLength: remaining }).length; // throws ERR_BUFFER_TOO_LARGE
    remaining -= actual;
    pointer += 46 + nameLength + extraLength + commentLength;
  }
}
```

### 7. Reading the first sheet
```ts
// Source: read-excel-file README (readSheet, trim option, InvalidInputError) + probe (universal + ArrayBuffer on Node 24.19.0)
import { readSheet, InvalidInputError } from "read-excel-file/universal";
export async function readFirstSheet(bytes: Buffer): Promise<unknown[][]> {
  assertSafeXlsxArchive(bytes);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  try { return await readSheet(arrayBuffer, 1, { trim: false }); }
  catch (error) { if (error instanceof InvalidInputError) refuse(mapReaderCode(error.code)); throw error; }
}
```

### 8. The encoding and shape sniff for CSV
```ts
// Source: WHATWG Encoding (TextDecoder fatal) — existing csv-import.ts:129-135 pattern
export function sniffCsv(bytes: Uint8Array): { text: string } | { refusal: ImportFileRefusal } {
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) return { refusal: "IMPORT_ENCODING_UTF16" };
  if (bytes.subarray(0, 4096).includes(0)) return { refusal: "IMPORT_ENCODING_UTF16" };
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return { refusal: "IMPORT_ENCODING_WINDOWS_1252" }; }
  const headerLine = text.replace(/^﻿/, "").split(/\r\n|\n|\r/, 1)[0] ?? "";
  if (!headerLine.includes(",") && headerLine.includes(";")) return { refusal: "IMPORT_DELIMITER_SEMICOLON" };
  if (!headerLine.includes(",") && headerLine.includes("\t")) return { refusal: "IMPORT_DELIMITER_TAB" };
  return { text };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `write-excel-file` 3.x `schema` / `getHeaderStyle`; bold header by default | 4.x: `columns`, per-cell `fontWeight`, `toBuffer()` result object; no default bold header | 4.0.0 (2026-04-22) | Set bold header cells explicitly; older blog examples are wrong |
| `read-excel-file` default export returning rows; DOM XML parser | 8.x/9.x: `readSheet()`; SAX parser (9.3.0); `InvalidInputError` codes (9.3.5); Strict OOXML (9.3.8) | 2026-06 to 2026-08 | Use `readSheet`; pin 9.3.10; test non-ASCII (the 9.3.3 fix) |
| OWASP: the single quote as the mitigation | OWASP now also documents the tab-inside-quotes variant and the Excel save-and-reopen caveat | Current page (redirected to community.owasp.org) | D-11 keeps the quote unless Excel evidence favours the tab |
| SheetJS from npm | SheetJS distributes patched builds off-registry; npm `xlsx` is frozen at 0.18.5 | 2023 onward | Excluded (D-12) |

**Deprecated/outdated:**
- `csv-client-parser.ts`'s parsing and its neutraliser copy are retired by D-25. Its download helper survives as `save-file.ts`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Excel treats a leading `'` in an opened CSV as a quote prefix and drops it on save as CSV (the reason for OWASP's caveat); the tab variant survives | Summary, Alternatives, Pitfall 10 | Low for CSRM round trips (lossless either way); medium for users who re-save CSVs and reopen them. Mitigated by XLSX as the default |
| A2 | TypeScript node10 resolution finds `node/index.d.ts` and `universal/index.d.ts` through the directory fallback | Pitfall 3 | Typecheck fails; fix with a local declaration file (small) |
| A3 | 50 MiB uncompressed total and 512 entries are the right XLSX bounds | Pattern 5, Code Example 6 | Too low refuses large legitimate workbooks (unlikely at 5,000 rows); too high wastes memory (bounded anyway) |
| A4 | Encrypted OOXML is detectable by the `EncryptedPackage` CFB stream name | Pitfall 16 | A wrong fix-it message (says `.xls`); no security impact |
| A5 | ZIP header offsets in Code Example 6 (APPNOTE) | Code Example 6 | The guard misparses; caught by fixture tests (a valid template, a bomb, ZIP64, encrypted flag, vbaProject) |
| A6 | 500-id hydrate batches stay within SQLite's variable limit and memory | Pattern 1 | Slow or failing hydrate; tune in tests |
| A7 | CSV dates are written as ISO `YYYY-MM-DD` | Pitfall 5 | A copy or UX choice; the UI-SPEC confirms |
| A8 | The deployment's Node has full ICU (IANA zones) | Standard Stack | Zones fall back to UTC; official Node builds ship full ICU |
| A9 | `yauzl` would validate entry sizes (alternative only) | Alternatives | None (not recommended) |

## Open Questions

1. **Does the neutraliser stay the single quote?**
   - What we know: OWASP documents both marks and the Excel caveat. Both marks keep CSRM round trips lossless.
   - What's unclear: Excel's actual save-and-reopen behaviour (no Excel here).
   - Recommendation: keep the quote (D-11). Offer the pilot an optional manual check before release (VALIDATION, Manual-Only). The mark is one constant plus its inverse, so switching before files circulate is cheap.
2. **Phase 14's file-transfer pattern.**
   - What we know: Phase 14 has no CONTEXT yet, and its attachments go up to 25 MB.
   - What's unclear: whether Phase 14 adopts the Server Action `Uint8Array` path.
   - Recommendation: the orchestrator aligns Phase 14 on this phase's `file-response.ts` validator and `save-file.ts` helper. At 25 MB, the Flight binary row still works, but browser memory roughly doubles (Blob plus array). Phase 14 records any deviation.
3. **Where the row count travels.** A response header (`X-CSRM-Row-Count`, declared in the spec) or the dialog's known total. Recommendation: the header, because it is the server's truth after the cap check.
4. **The export size bound in the web service.** Rows are capped, cell widths are not. Recommendation: 64 MiB, refused with a closed reason. Measure the Risk register's worst case (all columns, maximum text lengths) in the integration test and record it.
5. **The preview record's issue retention** (Pattern 8): store compact issue codes with a per-record byte bound (recommended), or re-derive on report and accept drift. This is the planner's choice, within D-32's "server-authoritative".
6. **Does the reports export keep `POST` with a JSON body for the report's filters?** The catalogue fixes `POST:/api/v1/reports/{reportKey}/export`. The body carries the report's query parameters, parsed by the report's own parser.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 | All gates (engines `>=24.19.0 <25`) | ✓ | 24.19.0 at `/c/ProgramData/nvm/v24.19.0` (PATH default is 22.19.0) | — |
| pnpm | Install, scripts | ✓ | 11.24.0 | — |
| npm registry access | Adding the XLSX pair | ✓ | — | — |
| Chromium (Playwright) | Downloads, print emulation, `page.pdf` | ✓ (existing suites use it) | Playwright 1.58.2 | — |
| Microsoft Excel | The neutraliser save-and-reopen check; producing an encrypted-workbook fixture | ✗ | — | Manual operator check (optional); a fixture committed from another machine |
| LibreOffice | An alternative fixture producer | ✗ | — | As above |

**Missing dependencies with no fallback:** none block execution.
**Missing dependencies with fallback:** Excel. Its two uses are an optional manual verification and a binary fixture; tests otherwise use generated fixtures.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **Web:** Vitest 4.1.11 (jsdom). **Strapi:** `node:test`, compiled by `tsc -p tests/tsconfig.json` into `.tmp/tests-dist`. **E2E:** Playwright 1.58.2 with Chromium. |
| Config file | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` |
| Quick run command | **Web:** `pnpm --filter @csrm/web exec vitest run <path>`. **Strapi file:** `pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js` |
| Full suite command | `pnpm --dir apps/csrm api:check && pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm lint && pnpm --dir apps/csrm test && pnpm --dir apps/backend test && pnpm --dir apps/csrm test:e2e && git status --short` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CSV-01 (3) · D-11 | The neutraliser marks every trigger, full-width form and leading-whitespace form; it never marks numbers or dates; `strip(mark(v)) === v` over the corpus | Strapi unit | quick run `spreadsheet-neutralise.unit.test.js` | ❌ W0 |
| CSV-01 (3) · D-08 | CSV: BOM, CRLF, every text cell quoted, doubled quotes; XLSX: string cells, no `<f>`, frozen bold header, About sheet, `d mmm yyyy` dates; written then read back | Strapi unit | quick run `spreadsheet-writers.unit.test.js` | ❌ W0 |
| CSV-01 (1) · D-05 · D-06 · D-07 | Each view's export equals its list across pages: filters, search, sort, default and chosen columns in canonical order, labels (Released), empty cells, Yes/No, local dates, due state from the projection | Strapi integration | quick run `exports.integration.test.js` (files read back) | ❌ W0 |
| CSV-01 (2) · D-13 to D-16 | Six-actor rows per export: owner, other (404 on the released assessment), analyst (own My lists only), service agent 403, no identity 403, no token; 400 on a closed-vocabulary violation; 409 for an unreleased analyst export; over-cap refusal with count and cap, and no file | Strapi integration + matrix | quick run `authorization-matrix.integration.test.js`, `exports.integration.test.js` | ✅ (matrix extended) / ❌ W0 |
| CSV-01 (4) · D-18 | One log line per export and per import commit, with the fields, outcome and refusals; never a cell value or raw query | Strapi unit + integration | quick run `security-event-log.unit.test.js`, `exports.integration.test.js` | ❌ W0 |
| CSV-01 (4) · D-23 · D-24 | The report route renders from the released loader; not-found for unreleased or unreadable; print media hides the shell; A4 PDF of at least one page | Web unit + E2E | `vitest run src/features/assessments/released-report.test.tsx`; `test:e2e e2e/exports-and-imports.spec.ts` | ❌ W0 |
| CSV-01 · D-19 · D-20 | Dialog states: default columns, Select all, Reset, cap warning disables, empty disabled, pending spinner, success toast, refusal with choices kept; the file-response validator (type, name, size, signature) | Web unit | `vitest run src/components/csrm/export src/lib/files` | ❌ W0 |
| CSV-01 · D-02 | Spec, generated client, file-response parity mode, operation chain, served inventory, byte-identical catalogue copies | Web unit + Strapi integration + static | `vitest run src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; quick run `served-operations.integration.test.js`, `contract-catalogue.integration.test.js`; `api:check`; `cmp` of the catalogue copies | ✅ (extended) |
| CSV-02 (1) · D-27 | Headers by field or label (case, spaces, `_`, `-`); unknown columns warned by name; `Issues` and read-only columns noted; duplicate mapping and missing required column refused with names | Strapi unit | quick run `spreadsheet-headers.unit.test.js` | ❌ W0 |
| CSV-02 (2) · D-26 | Byte fixtures: UTF-8 with and without a BOM accepted; Windows-1252, UTF-16, semicolon and tab refused with closed reasons; `.xls`, macro-enabled, encrypted, ZIP64, bomb and over-entries archives refused; the 5 MiB, 5,000-row and 64 KiB bounds | Strapi unit | quick run `spreadsheet-reading.unit.test.js` | ❌ W0 |
| CSV-02 (2) · D-28 | Flag spellings and XLSX booleans; enums case-insensitive; `#CLEAR` on an optional field (update), a required field (issue) and a create (blank); mark stripping; example row skipped | Strapi unit + integration | quick run `spreadsheet-values.unit.test.js`, `administration.integration.test.js` | ❌ W0 / ✅ |
| CSV-02 (3) · D-31 · D-32 · D-33 | Templates (CSV and XLSX, Notes sheet) from the contract; error report (original header, rows not imported, `Issues`, BOM, original row numbers) from server records only; the corrected report re-imports; reference export → edit → import updates by key | Strapi integration | quick run `administration.integration.test.js` | ✅ (extended) |
| CSV-03 · D-30 | A lower-case or whitespace-only duplicate classifies `similar` with the existing name; commit without decisions refused; `update` keeps the existing name; `skip` leaves the record; drift rejected; two matching rows in one file stay `ambiguous` | Strapi unit + integration | quick run `administration.unit.test.js`, `administration.integration.test.js` | ✅ (extended) |
| CSV-02 · CSV-03 (UI) | Import flow: XLSX accepted; fix-it messages from refusal copy; header warnings; similar decisions per row and in bulk; downloads at Review and Results; the client parser gone from the route bundle | Web unit + E2E | `vitest run src/features/administration`; `test:e2e e2e/administration-workflow.spec.ts` | ✅ (changed) |
| D-07 (G-13) | Strapi's label vocabulary equals the web's one status mapping | Web unit | `vitest run src/features/export-label-parity.test.ts` | ❌ W0 |
| Success criteria 1–6 | Bob's filtered register XLSX (name, type, `PK`, the `=` value as text); CSV with the `=` value quoted and marked; Jane's released export; the Secondary Requestor's not-found and 404; header-warning import; Windows-1252 fix-it; error report corrected and re-imported; lower-case duplicate held then decided; A4 print. At 1440 and 375 | E2E | `test:e2e e2e/exports-and-imports.spec.ts` | ❌ W0 |

### Sampling Rate
- **Per task commit:** the touched Vitest files by path; the touched Strapi file by path (dev servers stopped); `typecheck` when types change; `api:check` after any spec change.
- **Per wave merge:** the full web suite and `typecheck`; the full Strapi suite after each Strapi plan; each UI plan's targeted Playwright spec at its end.
- **Phase gate:** the full gate on the production build, then `git status --short` showing only the brief's three operator items, then `cmp` of the catalogue copies, then the content-type freeze check (no file under `apps/backend/src/api/*/content-types/` changed).

### Wave 0 Gaps
- [ ] `apps/backend/tests/spreadsheet-neutralise.unit.test.ts`: the trigger corpus and the invertibility property.
- [ ] `apps/backend/tests/spreadsheet-writers.unit.test.ts`: the CSV and XLSX writers, read back through the reader.
- [ ] `apps/backend/tests/spreadsheet-reading.unit.test.ts`, with byte fixtures under `apps/backend/tests/fixtures/spreadsheets/`:
  - `rt-2-headers.csv`;
  - `rt-3-cp1252.csv`;
  - `is-1.csv`;
  - `is-2-roundtrip.csv`;
  - UTF-16, semicolon and tab files;
  - a generated bomb, ZIP64 and vbaProject archives;
  - an `.xls` CFB header.

  Generate them in the test where possible, so no binary blob lands in git.
- [ ] `apps/backend/tests/spreadsheet-headers.unit.test.ts` and `spreadsheet-values.unit.test.ts`.
- [ ] `apps/backend/tests/security-event-log.unit.test.ts`.
- [ ] `apps/backend/tests/exports.integration.test.ts`, with a file read-back helper (`readSheet` and a CSV parse) in `tests/helpers/`.
- [ ] `apps/csrm/src/components/csrm/export/*.test.tsx`, `apps/csrm/src/lib/files/*.test.ts` and `apps/csrm/src/features/export-label-parity.test.ts`.
- [ ] `apps/csrm/e2e/exports-and-imports.spec.ts`.
- [ ] Dependency install: `pnpm --filter @csrm/strapi add write-excel-file@4.1.1 read-excel-file@9.3.10 --save-exact` in the plan that justifies it, after the `saxen` human-verify checkpoint.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | The existing identity middlewares; Keycloak stays off |
| V3 Session Management | no | — |
| V4 Access Control | yes | The `csrm-authorization` policy: the export grant, plus the underlying read, plus no service identity; record scope from the list; the one released predicate; 404 for unreadable records |
| V5 Input Validation | yes | The closed list parsers (Strapi) and shared web schemas; closed `format`, `columns` and `timeZone`; import signature, encoding, bounds and header vocabulary; closed `decisions` |
| V6 Cryptography | no new | SHA-256 file digest (existing `node:crypto`) |
| V7 Error handling and logging | yes | Closed refusal reasons; the security event log without values; R-08-13 retention |
| V12 Files and resources | yes | Size, row, record and decompression bounds; signature allow-list; macro, encrypted and legacy refusal; safe download names; `nosniff`; `no-store` |
| V14 Configuration | yes | Exact-pinned dependencies; no postinstall; the `fflate` 0.8.3 check |

### Known Threat Patterns for Strapi + Next export and import

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSV or formula injection | Tampering / Elevation (client) | The OWASP neutraliser on every text cell in both formats; typed XLSX strings; never `type: 'Formula'` |
| Zip bomb or decompression exhaustion | Denial of service | Central-directory guard plus `zlib` `maxOutputLength`; 5 MiB input bound |
| Zip parser differential | Tampering | Read through `/universal` (fflate, central directory), the same entries the guard checked |
| Export scope widening (IDOR, agent export) | Information disclosure | The list's own scope; an underlying-read requirement; an agent refusal; 404 for others' records; matrix rows |
| Data exfiltration volume | Information disclosure | The 10,000-row cap; the event log (actor, view, filters, count) for SIEM monitoring |
| Content sniffing or a hostile file name | Tampering | A server-built safe name pattern; `nosniff`; `attachment`; client-side name validation |
| Legacy-encoding corruption | Tampering (integrity) | Refuse non-UTF-8; never guess |
| Similar-name overwrite | Tampering (integrity) | The `similar` state needs an explicit decision; drift rejection |
| Error report as a reflection channel | Information disclosure | Built only from the uploader's own file and the server record, bound to the actor and collection; neutralised |
| Log injection or PII in logs | Repudiation / Disclosure | Structured JSON lines; parsed values only; no cell values; retention under R-08-13 |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`, 2026-10-01): `write-excel-file` 4.1.1, `read-excel-file` 9.3.10, `exceljs` 4.4.0, `xlsx` 0.18.5, and the transitive packages' versions, licences, engines and release history.
- npm advisory bulk endpoint (2026-10-01): GHSA-px8p-9vwx-vf98 (`fflate` <0.8.3), GHSA-4r6h-8v6p-xvw6 and GHSA-5pgg-2g8v-p4x9 (`xlsx`), GHSA-w5hq-g745-h8pq (`uuid` <11.1.1), and the `tmp` advisories.
- `gsd-tools query package-legitimacy check`: the verdicts in the audit table.
- Package sources, read from the tarballs:
  - `write-excel-file/modules/xlsx/files/sheet.xml/cell.js` (string → shared string; `<f>` only for `'Formula'`) and `helpers/convertDateToSerialNumber.js`;
  - `read-excel-file/modules/export/*` (the Node and universal unzip paths, the filter, `InputValidationStream`) and `CHANGELOG.md`.
- The probe on Node 24.19.0 (scratchpad): write and read timings and memory at 10,000 × 15; no `<f>`; frozen pane; the round trip of `'=…`, `0042`, non-ASCII, booleans and dates; `maxOutputLength` throwing; the reader's error codes.
- Next 16.3.6 bundled docs, `01-app/02-guides/server-actions.md`. React Flight source in `next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-server.node.production.js` (:1724-1725, :1930-1943).
- openapi-fetch 0.17.0 `dist/index.mjs` (:183-198) and `index.d.ts` (`ParseAs`).
- Koa 2.16.4 `lib/response.js` (:308-311).
- Repository code read this session:
  - `csv-import.ts`;
  - `administration-workflow.ts` (1-330);
  - `administration-query.ts:217-219`;
  - `csrm-authorization.ts` (1-120, 260-360);
  - `risk-register.ts` (36-60, 285-344);
  - `assessment-scope.ts:155-189`;
  - `csrm-assessment.ts:95-114`;
  - `csrm-risk/operations.ts`;
  - `csrm-risk/routes/csrm-risk.ts:1-44`;
  - `config/middlewares.ts`;
  - `apps/backend/tsconfig.json`;
  - `tests/tsconfig.json`;
  - the catalogue (:1712-1724);
  - `served-operations.json` (:2128-2135).

### Secondary (MEDIUM confidence)
- OWASP, CSV Injection (https://community.owasp.org/attacks/CSV_Injection; `owasp.org/www-community/attacks/CSV_Injection` redirects there): the trigger list, the single quote, the tab variant, the Excel caveat, quoting and full-width forms.
- Chrome developers, "New in Chrome 131" (https://developer.chrome.com/blog/new-in-chrome-131/) and "Add content to the margins of web pages when printed using CSS" (https://developer.chrome.com/blog/print-margins): `@page` margin boxes and page counters.

### Tertiary (LOW confidence)
- Excel's handling of a leading quote or tab on CSV open and save (A1); the CFB `EncryptedPackage` marker (A4); the APPNOTE offsets used in Code Example 6 (A5), to be proven by fixtures.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Registry, advisory, source read and runtime probe on the target Node.
- Architecture: HIGH. Built on code read this session and the locked decisions. The policy extension and the predicate consolidation are designs, to be proven by matrix rows.
- Pitfalls: HIGH for 1–9, 11, 13–15, 17–20 (code or probe verified); MEDIUM for 10, 12; LOW for 16.

**Research date:** 2026-10-01
**Valid until:** 2026-10-31. `read-excel-file` releases often; re-check `npm view` and the advisories at the plan check.
