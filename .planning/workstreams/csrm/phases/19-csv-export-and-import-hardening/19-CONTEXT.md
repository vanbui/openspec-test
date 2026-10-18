# Phase 19: CSV export and import hardening - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning
**Mode:** discuss-phase `--auto`, one pass. Every gray area took the recommended option, grounded in:
- the product gap UAT (`.planning/workstreams/csrm/uat/product-gaps/`: UAT-049, UAT-051 and UAT-052, `REPORT.md` §6 and `JOURNEYS.md` area 6);
- the delegated decisions in `.planning/workstreams/csrm/NEXT-WAVE-DECISIONS.md` (#12 first, with #11, #16, G-1, G-3, G-4, G-6, G-12, G-13, G-16 and G-17);
- the orchestrator's seeds for this unit, each confirmed or corrected against the code;
- the planned outputs of Phases 10 and 11 (their CONTEXT, UI-SPEC, RESEARCH and Phase 10's plans) and Phase 12's CONTEXT;
- a read of the code each finding names.

There is no SPEC.md for this phase. The discussion log is `19-DISCUSSION-LOG.md`.

**Execution order.** Phase 19 executes after Phases 10 to 16 and before Phases 17, 17.1, 17.2 and 18 (`ROADMAP.md`: 10, 11, 12, 13, 14, 15, 16, 19, 17, …). Its plans are written against today's code plus those phases' planned outputs, and Stage 3 re-runs the plan check just before execution. Phases 13 to 16 had no CONTEXT when this was written, so the planner reads their CONTEXT and plans when they exist (D-35).

<domain>
## Phase Boundary

Let every person export any list they can see, in their authorised scope, to CSV and XLSX, and print a released Risk Assessment as a clean A4 report; and make the Administration imports tolerate spreadsheet habits, hold near-duplicate names for a decision, and return files a user can correct and import again. The phase closes UAT-049, UAT-051 and UAT-052, and delivers CSV-01, CSV-02 and CSV-03. It builds the shared export, spreadsheet-reading and value-conversion modules that Phase 18's risk-row import and export reuse, and the export predicate that Phase 17 widens to every participant (G-12).

In scope:
- export operations in Strapi for every list (D-04), with the list's own filters, search, sort and scope, a column choice, a row cap, formula neutralisation and an event log line per export;
- the export of a released Risk Assessment as a workbook, and its print-ready A4 report;
- the shared Strapi modules: spreadsheet writing (CSV and XLSX), the neutraliser, spreadsheet reading (CSV with encoding detection, and XLSX), header matching, value conversion and the security event log;
- the one justified XLSX dependency, in Strapi only (D-12);
- Administration import hardening on the four existing imports: header matching by label, ignored columns with a warning, encoding refusals with fix-it messages, flag spellings, a clear token, XLSX files, "Matched by similar name" held for a decision, templates and error reports served by Strapi;
- the web: an Export action and dialog on every list and released view, the report route, and the import flow's new states;
- two contract-gap records and their approval checkpoint (D-01);
- the tests that prove each of these, in the API and the UI.

Out of scope:
- any Strapi content-type schema change;
- risk-row and control-implementation import and the risk table export (Phase 18, ASSESS-19), which reuse this phase's modules;
- importable relations: an Information System's owner and a Risk Type's applicable controls (deferred);
- the on-screen column chooser (Phase 18, Phase 11 D-33);
- participant exports beyond the Requestor (Phase 17 widens the predicate this phase builds, G-12);
- "My risks and treatments" and its export (Phase 20); the Admin role's access-review export (Phase 22);
- a persisted audit store, an in-app export history, background or streamed exports past the cap;
- Keycloak; live AI generation.
</domain>

<requirements>
## Requirements and Success Criteria This Phase Owns

| Requirement | Acceptance (REQUIREMENTS.md) | Decisions |
|---|---|---|
| **CSV-01** Registers, lists, queues, alerts and reports export to CSV and XLSX | (1) current filters, search and sort; visible columns by default with a column choice; named after the view and date. (2) Strapi scopes each export to what the viewer may read; a Requestor exports only their own released assessments (decision 12). (3) `=`, `+`, `-`, `@`, tab and carriage return neutralised; CSV is UTF-8 with a BOM. (4) Every export logged with actor, view, filters and row count; a released assessment prints as an A4 report | D-04 to D-24 |
| **CSV-02** Imports tolerate spreadsheet habits and return files a user can fix and re-import | (1) headers match case-insensitively and by display label; unknown columns ignored with a warning naming them. (2) Windows-1252 gets a "Save as CSV UTF-8" explanation; Yes/No, Y/N and TRUE/FALSE accepted for flags; an explicit clear token empties a field. (3) Templates carry display headers, an example row and allowed values (CSV, and XLSX with a notes sheet); error reports are the original rows plus an Issues column, with a BOM | D-25 to D-29, D-31 to D-33 |
| **CSV-03** A near-match name in an import needs an explicit decision | Case- or whitespace-only matches show as "Matched by similar name" and are neither created nor updated until the user chooses | D-30 |

ROADMAP success criteria, each with its proof (D-39):

1. The filtered Risk Register exports to XLSX with the visible columns, and a value starting with "=" arrives as text. (D-05, D-06, D-08, D-11)
2. A Requestor can export only their own released assessment. (D-13 to D-16)
3. A file with "Name" headers and an extra column imports with a warning, and a Windows-1252 file gets a fix-it message. (D-26, D-27)
4. The error report reopens in Excel, can be corrected and re-imports. (D-32)
5. A lower-case duplicate of an existing name is held for a decision. (D-30)
6. A released assessment prints as a clean A4 report. (D-23, D-24)

Closes UAT-049, UAT-051 and UAT-052. Intent: Q3.
</requirements>

<decisions>
## Implementation Decisions

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

### Planner's Discretion

- Module placement under `apps/backend/src/csrm/` (for example `exports/`, `spreadsheets/` and `audit/`), and the web feature placement of the dialog and the save helper.
- Operation paths, parameter names (`columns` encoding, `format`, `timeZone`), view keys, and the export Function layout (one per actor or one per view), within D-03 and D-13.
- Column vocabularies per view, from each list as it stands after Phases 10 to 16, within D-06.
- Whether the web reads the import column contract from Strapi or keeps a parity-tested copy (D-31).
- The result record's shape for Results-step error reports (D-32).
- Whether the dialog remembers a viewer's last format and columns per view in browser storage, guarded by try/catch.
- The XLSX uncompressed bound and the alias lists, within D-26 and D-27.
- Copy, layout, file slugs and the extension wording: the UI-SPEC's.
</decisions>

<operator_decisions>
## Decisions This Phase Depends On

All are settled in `.planning/workstreams/csrm/NEXT-WAVE-DECISIONS.md` and the ROADMAP entry; none is open.

| Decision | What it settles here | Implemented by |
|---|---|---|
| #12 Exports | CSV (UTF-8, BOM) and XLSX in the viewer's scope; Requestors export their own released assessments; formula-like values neutralised; every export logged with actor, view, filters and row count; a print-ready A4 report through the print stylesheet | D-04 to D-24 |
| #16 Released label | "Released" for `approved` in every export | D-07 |
| #11 What exposure counts | The register's Stage and Accepted markers as export columns | D-06 |
| #2 Attachments (by analogy) | Files checked by extension and content signature against an allow-list | D-26 |
| G-1 Separation of duties | No service identity holds a human grant: exports are human-only | D-13 |
| G-3 AI data policy (by analogy) | Data minimisation: only chosen, readable columns are read and written | D-06 |
| G-4 Premium bar | Keyboard path, pending state, empty and refusal states, phone sheet, no lost choices | D-20, D-23 |
| G-6 Housekeeping | The pilot approves each contract-gap record; Playwright leaves the tree clean | D-01, D-39 |
| G-12 Who reads the assessment | Participants export and print what they read: one predicate that Phase 17 widens | D-14, D-34 |
| G-13 Release and close | "Closed" extends one label vocabulary; the released predicate takes `approved` or `closed` in one place | D-07, D-14, D-34 |
| G-16 Treatment tracking | Exports show the due state by the one shared rule | D-07, D-34 |
| G-17 People search | Its search log reuses this phase's event log | D-18, D-34 |
| PD-1 (through G-12) | The risk owner exports and prints the assessment from Phase 17 | D-14, D-37 |

No conflict was found between the ROADMAP entry and these decisions. The ROADMAP's "Requestors export their own released assessments" is extended by G-12 in Phase 17, and this phase's predicate is the seam for it.
</operator_decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings and intent
- `.planning/workstreams/csrm/uat/product-gaps/FINDINGS.md`: UAT-049, UAT-051 and UAT-052 in full; UAT-050, UAT-056 and UAT-057 for the Phase 18 seams.
- `.planning/workstreams/csrm/uat/product-gaps/JOURNEYS.md` area 6: the import test files (`rt-2-headers`, `rt-3-cp1252`, `is-1`, `is-2-roundtrip`), the template and error report formats, and the export inventory.
- `.planning/workstreams/csrm/uat/product-gaps/REPORT.md` §6 (import and export requirements, and the export table per screen), §7 ("Files" in the risk table), §8 (the Phase 19 proposal) and §9 decision 12.
- `.planning/workstreams/csrm/uat/product-gaps/evidence/a6-import-unsupported-header.jpg`.
- `.planning/workstreams/csrm/uat/product-gaps/BRIEF.md` Appendix A: Q3.

### Planning authority
- `.planning/workstreams/csrm/ROADMAP.md` Phase 19 (goal, success criteria 1 to 6, decisions, contract line), the execution-order note "Phase 19 runs before Phase 18", and the Phase 17, 17.1, 18, 20 and 22 entries for the seams.
- `.planning/workstreams/csrm/REQUIREMENTS.md`: CSV-01, CSV-02 and CSV-03; ASSESS-19 (Phase 18's rows); ASSESS-22 criterion 5 (participant export); RISK-06 criterion 2 (exports derive Overdue by the one rule); ADMIN-08 (access-review export).
- `.planning/workstreams/csrm/NEXT-WAVE-DECISIONS.md`: decisions 2, 11, 12 and 16; G-1, G-3, G-4, G-6, G-12, G-13, G-16 and G-17.
- `.planning/workstreams/csrm/POST-DEMO-BRIEF.md` §§1, 2: overrides and dev-mode rules.
- `.planning/workstreams/csrm/STATE.md` Decisions: the planning method, and plans written ahead.
- `.planning/workstreams/csrm/phases/10-existing-flow-gap-closure/10-CONTEXT.md` (D-19, D-22, D-34, D-40, D-41) and `10-01-PLAN.md` (the time zone modules).
- `.planning/workstreams/csrm/phases/11-navigation-landing-and-list-clarity/11-CONTEXT.md` (D-02, D-05, D-29 to D-46, D-55, D-58), `11-UI-SPEC.md` §7 to §10 (each list's columns, controls and markers) and `11-RESEARCH.md` "Contract changes" C1 to C6.
- `.planning/workstreams/csrm/phases/12-ai-context-suggestions-and-provenance/12-CONTEXT.md`: D-10 (`risk-scale.ts`), D-23 (the Requestor's AI disclosure), D-32 (human-initiated, the agent's grants).
- The CONTEXT and plans of Phases 13, 14 and 16 once written: the assignee, the file-transfer pattern and withdrawal.
- `.planning/workstreams/csrm/phases/07-analyst-dashboard-reports-and-alerts/07-CONTEXT.md`: D-04 (the due-state rule), D-06 (unserved operations), D-14 (underlying reads).

### Product and domain
- `docs/CSRM-PROJECT-BRIEF.md` §9 ("Make duplicate or ambiguous matches visible rather than silently overwriting records") and its import guidance.
- `docs/references/idambox-datamodel.jdl`: `CsrmRisk`, `CsrmAssessment`, `CsrmAssessmentRequest`, `CsrmRiskType`, `CsrmControl`, `CsrmInformationSystem`, `CsrmInformationAsset`.
- `CONTEXT.md` (repository root): the Released, Released for response, Risk owner and Closed entries.

### Contract, authorization and records
- `docs/contract-gaps/phase-06-administration-import-contract.md`: the import contract this phase amends (bounds, classifications, preview records, "Raw file contents … never returned to the browser").
- `docs/contract-gaps/phase-07-derived-insights.md`: items 4 and 5 (report export deferred and unserved), item 6 (the stored Overdue).
- `docs/contract-gaps/phase-04-composite-release-fact.md`: the released predicate ("Requestor visibility and projections"), which Phases 17 and 17.1 amend.
- `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`: the record format.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`: `function.risk_register.risk_register.api.04` (Export Risk Register), `function.reports.reports.api.03` (Export Report), design notes 8 and the Phase 8 note, and the Administration Functions.
- `docs/references/served-operations.json`: the two unserved export rows and `webCallers`.
- `docs/references/specification.json`: the list operations and their query parameters, and the Administration import schemas.
- `docs/security/phase-08-residual-risks.md`: R-08-13 (request lines and search terms in the log), R-08-34 (route budgets), R-08-36 (single process: preview records stay process-local).
- `apps/backend/src/policies/csrm-authorization.ts`: `HUMAN_ANALYST_ONLY_OPERATIONS`, `ANALYST_INSIGHT_UNDERLYING_READS`, the scope flags.
- `apps/backend/tests/fixtures/authorization-matrix.ts`, `apps/backend/tests/contract-catalogue.integration.test.ts`, `apps/csrm/src/features/contract-response-parity.test.ts` and `apps/csrm/src/features/contract-operation-chain.test.ts`.

### Design and framework
- `docs/design/csrm-design-direction.md`: §4 Print and its refinements, Dialogs, Toasts, Status and risk badges (the CSV import row states), Forms, Page header, Empty states, Buttons; §5 Motion; §6 Do-not list. `docs/adr/0001-adopt-bproton-design-system.md`.
- `apps/csrm/app/globals.css` `@media print` block: the shipped print rules the report builds on.
- Next.js 16.3.6 docs under `apps/csrm/node_modules/next/dist/docs/01-app/`: `02-guides/server-actions.md` (sequential dispatch, return values, security), `02-guides/forms.md`, `03-api-reference/05-config/01-next-config-js/serverActions.md` (the 6mb body limit already set).

### External
- OWASP, "CSV Injection" (https://community.owasp.org/attacks/CSV_Injection): the trigger characters, full-width forms, quoting, and the Excel save-and-reopen caveat (D-11).
- RFC 4180 (CSV) and RFC 5987/6266 (`Content-Disposition` file names).
- ISO/IEC 27001:2022 Annex A 8.12 (data leakage prevention), 8.15 (logging) and 8.16 (monitoring activities).
- The npm registry pages and advisories for `write-excel-file`, `read-excel-file`, `exceljs` and `xlsx` (D-12), checked again at research time.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/api/csrm-administration/services/csv-import.ts`: the parser, the five classifications, the bounds and `sanitizeSpreadsheetCell` (the neutraliser D-11 moves into the shared module).
- `apps/backend/src/api/csrm-administration/services/administration-workflow.ts`: preview records (actor-bound, 5-minute TTL, 256 global and 16 per actor and collection), the commit's drift check, per-row transactions and the per-collection queue, which D-30's decisions and D-32's result record extend.
- `apps/backend/src/api/csrm-administration/services/administration-query.ts`: `normalizeAdministrationNaturalKey` (trim, NFKC, lower case), the basis of the similar tier.
- `apps/backend/src/api/csrm-risk/services/risk-register.ts`: the repository (`count`, `selectPage`, `hydrate`, `selectedLabels`) and `projectRiskRegisterItem`, which the register export iterates; `risk-register-query.ts`, the closed parser it reuses.
- `apps/backend/src/csrm/insights/treatment-due-state.ts`: `deriveTreatmentDueState`, the one due-state rule.
- `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts` (`releasedAssessmentQuery`, `releasedAssessmentDetailQuery`, `isReleasedAssessmentForOwner`, `buildAssessmentCollectionQuery`) and the controller's `releasedForOwner`: the predicate D-14 gathers.
- `apps/backend/src/api/csrm-analyst-insight/services/report-definitions.ts`: the precedent for server-held display copy proven equal to the web's (`report-copy.json`).
- The list services each export reuses: `collection-scope.ts` and `review-queue-repository.ts` (requests), `questionnaire-scope.ts`, `assessment-scope.ts`, `alert-query.ts` with `alert-repository.ts`, `report-query.ts` with `report-repository.ts`, `administration-query.ts` with `administration-repository.ts`, and Phase 11's `services/my-requests.ts`.
- `csv-parse` 7.0.2 (both apps today): the CSV parser the reading module keeps on the Strapi side.
- Web: `apps/csrm/src/features/administration/csv-import-flow.tsx` (the five steps, download events), `csv-import-schema.ts` (closed preview and result parsers), `administration-actions.ts` (the Server Actions), `csv-client-parser.ts` (the parsing that retires; its download helper survives); `apps/csrm/src/components/csrm/status-badge.tsx` (the one status mapping, with the `importRow` family); `apps/csrm/app/(app)/app/assessments/[documentId]/page.tsx` (the released loader the report shares); `apps/csrm/src/components/shell/app-shell.tsx` `PageHeader` (the action slot, `data-print="hidden"`).
- Phase 10's planned modules: `apps/csrm/src/lib/time/viewer-time-zone.ts` and `format-instant.ts`; `apps/backend/src/csrm/conflict-reasons.ts`, `apps/csrm/src/lib/api/conflict-reasons.ts` and `refusal-copy.ts`.

### Established Patterns
- Typed openapi-fetch services in `src/features/*/*-service.ts` and Server Actions; the chain guard forbids raw `fetch` and unlisted operations; no Route Handler stands in for an API (01 D-15, Phase 6 research, Phase 11 D-49).
- Human-only API Functions plus `HUMAN_ANALYST_ONLY_OPERATIONS` as a second refusal; insights require their underlying reads (07 D-14).
- An unauthorised assessment read is 404; a policy denial is 403; denials leave persistence unchanged.
- Closed parsers and closed reason codes; every figure is the server's, and the web words what it is given.
- Server-issued preview records bound to the actor; single-use commits; process-local by design (R-08-36).
- Print: the shell and interaction-only controls carry `data-print="hidden"` or are hidden by the print block.

### Integration Points
- **Strapi:** each list's route file (export routes beside them), `csrm-authorization.ts`, the assessment controller and `assessment-scope.ts`, the administration controller, routes and workflow, `config/middlewares.ts` (`strapi::logger`; the 6mb form limit), both catalogue copies and the specification.
- **Web:** every list page under `apps/csrm/app/(app)/app/` (the Export action), `released-assessment.tsx` and the analyst review page (Export and Print report), the new report routes, the administration import route and flow, and each feature service.
- **Tests:** `authorization-matrix.ts`, `served-operations.integration.test.ts`, `contract-catalogue.integration.test.ts`, the analyst insight route inventory test (which refuses a mounted report export today), `administration.integration.test.ts` and `administration.unit.test.ts`, `apps/csrm/e2e/administration-workflow.spec.ts`, and `performance.spec.ts` (route budgets).
</code_context>

<specifics>
## Specific Ideas

- **The UAT's files are the fixtures.** `rt-2-headers` ("Name,Description" plus "Owner"), `rt-3-cp1252` (Excel's default "CSV (Comma delimited)" on Windows), `is-1` (Yes/No and Y flags; the lower-case "uat-b: core customer billing system" against "UAT-B: Core customer billing system") and `is-2-roundtrip`. Each becomes a byte fixture in the Strapi tests and a file in the import journey.
- **`0042`.** A control number with leading zeros must survive export and import. It does through XLSX. A CSV opened in Excel loses the zeros, which is why D-08 and D-33 prefer XLSX and the guidance says so.
- **The formula fixture.** A seeded Risk statement such as `=HYPERLINK("https://example.test","Click")` proves criterion 1 in both formats: a string cell with the mark and no formula element in XLSX, and a quoted, marked text cell in CSV.
- **Jane, the Secondary Requestor and Bob** are the browser actors: Jane's released assessment for her export and report; the Secondary Requestor refused at the same assessment; Bob for every analyst export and the imports.
- **The operator's development database** gains nothing: no seed changes are required beyond test fixtures, and new grants reach it only when the orchestrator restarts Strapi.
</specifics>

<deferred>
## Deferred Ideas

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
</deferred>

## Orchestrator Confirmations (2026-10-01, post-demo Stage 2)

The research raised three questions. Each is settled as follows:

- **The neutralising mark (D-11):** keep the leading single quote. It is OWASP's primary recommendation, and the CSRM import strips it, so the round trip is lossless. The plans list a manual-only check that a file saved and reopened in Excel keeps the mark, for the pilot to run where Excel exists.
- **Phase 14's downloads:** this phase sets how files reach the browser: a Server Action that returns the file's bytes from Strapi through the typed API layer. Phase 14's 25 MB attachment downloads reuse it, or record in their own context why a streamed alternative is needed. Strapi stays the API boundary either way.
- **Phase 14 builds three shared pieces first (14-CONTEXT D-24, D-37):** Phase 14 executes before this phase, so it builds the security event log module (to this phase's D-18 contract), the file-transfer pattern (D-19), and the one spreadsheet reader both phases use. This phase reuses and extends them, and does not build parallel ones. Its plans cite the Phase 14 plans that create them: `csrm/files/zip-archive.ts` (this phase's zip guard calls it), `csrm/spreadsheets/xlsx-reader.ts` with `read-excel-file@9.3.10` (already installed by Phase 14), `csrm/audit/security-event-log.ts`, and the web's `lib/files/file-response` and `save-file` helpers.
- **The service-identity refusal set is generic:** name it `SERVICE_IDENTITY_REFUSED_OPERATIONS` from the start, because Phase 19.1 (notifications) and Phase 17 (people search, responses) add members to it (19.1-CONTEXT confirmations).
- **Planner's discretion:** whether the row count travels in a response header, the web-side size bound, storing issue codes in the preview record, and the report export's POST body.

---

*Phase: 19-csv-export-and-import-hardening*
*Context gathered: 2026-10-01*
