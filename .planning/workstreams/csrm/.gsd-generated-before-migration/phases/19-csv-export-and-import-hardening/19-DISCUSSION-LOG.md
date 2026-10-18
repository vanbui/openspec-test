# Phase 19: CSV export and import hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 19-csv-export-and-import-hardening
**Mode:** `--auto`, one pass.
- Every area was selected automatically, and each question took the recommended option with no user prompt: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005; ISO/IEC 27001:2022 Annex A 8.12, 8.15 and 8.16), at the G-4 premium bar, consistent with decisions 1 to 18, G-1 to G-10 and G-11 to G-18.
- The orchestrator seeded the requirements, the export inventory, the predicate seam, the log, OWASP neutralisation, the XLSX library, the import hardening items, the A4 report and the Phase 18 and 20 seams. The code read during the scout confirmed or corrected each seed before it was recorded.
- No todo matched the phase (`todo.match-phase 19`: 0), no `.continue-here.md`, SPEC.md or checkpoint existed, no discuss hooks were active, and advisor mode was off.
- The discussion completed in one pass, so no `19-DISCUSS-CHECKPOINT.json` remains.

**Seeds corrected by the scout:**
- The seed's "export log with no content-type change": confirmed. The scout found no structured or audit logging in Strapi today, only `strapi::logger` request lines (R-08-13), so the phase builds the event log module (D-18).
- "Neutralisation per OWASP": a neutraliser already exists, twice (`csv-import.ts` and `csv-client-parser.ts`), with full-width and whitespace-led triggers. OWASP's current page adds an Excel save-and-reopen caveat, which research checks (D-11).
- "Import hardening on the existing imports": the web pre-parses every file with its own copy of the parser, and Strapi's preview swallows the specific message. So UAT-051's "unsupported header" text came from the browser, and hardening only the server would leave two parsers drifting (D-25).
- "Requestor exports only their own released assessment": the Requestor's released reads are gated by `releasedForOwner` and three query helpers. They become the one predicate (D-14).
- "XLSX library": no XLSX package exists in either app. ExcelJS's last stable release is 4.4.0 (October 2023); SheetJS's npm package is stale with unpatched advisories; `write-excel-file` and `read-excel-file` are MIT and maintained (D-12).
- The catalogue reserves `GET /api/v1/risks/export?format={format}` and `POST /api/v1/reports/{reportKey}/export`; the specification has no export path yet.

**Areas discussed:**
1. Contract records without a content-type change
2. Where files are generated
3. Which views export
4. How an export reuses its list
5. Columns and the column choice
6. Cell values and labels
7. Formats and the About sheet
8. Formula neutralisation
9. The XLSX dependency
10. Grants and the human-only rule
11. The released-assessment predicate
12. An analyst exporting an unreleased assessment
13. Row limits and streaming
14. The export log
15. Delivery to the browser
16. The export experience
17. The released-assessment export
18. The print-ready report
19. One parser and file-level refusals
20. Accepted files and encodings
21. Headers and unknown columns
22. Values: flags, clearing, the mark and the example row
23. Near-match names
24. Templates
25. Error reports
26. The reference-list round trip
27. Value conversion for Phase 18
28. Verification and plan shape

---

## 1. Contract records without a content-type change

| Option | Description | Selected |
|--------|-------------|----------|
| Two records (exports and their log; import tolerance amending the Phase 6 import contract), approved at a checkpoint before any contract plan | The Phase 6 record states behaviours this phase reverses (unknown headers fail, booleans only true/false, no clearing, five classifications, no raw content returned), and the log is an audit record with no entity, a model gap AGENTS.md says to document | ✓ |
| No record, as Phase 11 did for API-only changes | Leaves the Phase 6 record contradicting the code, and the audit-without-entity choice undocumented | |
| One combined record | Workable, but the pilot could not approve the export and import halves independently | |

**Choice:** `[auto] Records: Q: "Which contract-gap records does a phase with no schema change write?"` → two records with a G-6 checkpoint (recommended default).

---

## 2. Where files are generated

| Option | Description | Selected |
|--------|-------------|----------|
| Strapi generates the CSV and XLSX; the web passes the bytes through | The catalogue's own words ("generates an export … in the requested supported format"); scope, log, neutraliser, reader and writer in one place for this phase and Phase 18; the XLSX library stays out of the web bundle. Cost: display labels mirrored in Strapi with a parity test, as `report-definitions.ts` already is | ✓ |
| Strapi serves a JSON "export dataset", and a Server Action builds the file with the web's labels and zone helpers | One label mapping and the screen's own formatting, but the XLSX writer lands in the web while the reader stays in Strapi; error reports and templates would need writers on both sides; an "export" operation returning JSON for `format=xlsx` misreads the catalogue | |
| The web pages through the existing list reads and builds the file | No server log of the export, about 100 requests for 10,000 rows, and no Strapi operation (REPORT §6 requires one) | |

**Choice:** `[auto] Generation: Q: "Which side builds the file?"` → Strapi (recommended default).
**Notes:** The label duplication is bounded by a parity test per family, so 17.1's "Closed" must extend both sides or fail.

---

## 3. Which views export

| Option | Description | Selected |
|--------|-------------|----------|
| Every list a person can see (the three review lists, the register, alerts, the four reports, the four reference lists, the three My lists) and a released assessment; Homes export through the lists their figures open | The goal's "any list I can see", CSV-01's "registers, lists, queues, alerts and reports", REPORT §6's table | ✓ |
| Only the register and a released assessment | Misses the queues, alerts, reports and reference round trip the UAT asked for | |
| Every list and every Home widget | Home figures already open lists that export (X-10); widget exports add surfaces with no new data | |

**Choice:** `[auto] Inventory: Q: "Which surfaces offer export?"` → every list plus the released assessment (recommended default).

---

## 4. How an export reuses its list

| Option | Description | Selected |
|--------|-------------|----------|
| A sibling operation per list that takes the list's own query (no pagination), parses it with the list's closed parser, resolves the list's scope and iterates the list's repository | One definition of each list's filters and scope; later list changes export for free | ✓ |
| One generic `exports/{view}` operation | One grant could not tell views apart, and the query parameters would be a loose union instead of each list's typed parameters | |
| Export only the current page | Not what a user means by "export the register" | |

**Choice:** `[auto] Reuse: Q: "How does an export stay equal to its list?"` → sibling operations on the list's own parser, scope and repository (recommended default).

---

## 5. Columns and the column choice

| Option | Description | Selected |
|--------|-------------|----------|
| A closed column vocabulary per view; the visible columns by default; the dialog offers the rest; only fields the actor can already read; markers become columns; the checklist is the primitive Phase 18's chooser adopts | CSV-01 criterion 1; data minimisation; Phase 11 D-33 holds (the on-screen chooser stays Phase 18's) | ✓ |
| Always every column | Over-discloses, and ignores CSV-01's "visible columns by default" | |
| Only the visible columns, with no choice | Fails CSV-01's "with a column choice" | |

**Choice:** `[auto] Columns: Q: "Which columns does a file hold?"` → visible by default, closed choice, no wider disclosure (recommended default).
**Notes:** The register adds Request title and Assessment type, as REPORT §6 asks.

---

## 6. Cell values and labels

| Option | Description | Selected |
|--------|-------------|----------|
| Display values (labels, names, record numbers), empty cells for absent values, Yes and No, typed numbers and dates, instants as the viewer's local date through Phase 10's zone, the due state from the one shared rule | What the list shows, as data a spreadsheet can sort and filter; "Released" everywhere (decision 16); Overdue follows G-16 | ✓ |
| Stored values (`approved`, document ids) | The UAT-056 lesson: ids mean nothing to the reader | |
| On-screen strings, placeholders included ("Not provided") | Placeholders pollute filters, sorts and re-import | |

**Choice:** `[auto] Values: Q: "What does a cell contain?"` → display values as data (recommended default).

---

## 7. Formats and the About sheet

| Option | Description | Selected |
|--------|-------------|----------|
| CSV: UTF-8 with a BOM, CRLF, text quoted, pure data. XLSX: data first with a frozen bold header and typed cells, never formulas, then an "About this export" sheet (view, filters, sort, columns, count, time, zone, exporter). XLSX by default | Machine-loadable CSV that re-imports; an XLSX that keeps types and leading zeros and records its provenance for files that leave the system | ✓ |
| Title and metadata rows at the top of every CSV | Breaks loading into tools and re-import | |
| CSV only | Excel users lose leading zeros and dates; decision 12 requires XLSX | |

**Choice:** `[auto] Formats: Q: "How is each format laid out?"` → the recommended option.

---

## 8. Formula neutralisation

| Option | Description | Selected |
|--------|-------------|----------|
| One shared function (the existing one, moved), every text cell in both formats, the single-quote mark, the import strips exactly the mark; research checks OWASP's Excel save-and-reopen caveat and its leading-tab variant | OWASP's primary guidance, already tested here; lossless round trips; one oracle for both formats | ✓ |
| Leading tab inside quoted fields (OWASP's Excel-resistant variant) from the start | Survives Excel's save-and-reopen, but a hidden character stays in the data and contradicts the trigger list, which includes tab; adopted only if research shows it is needed and lossless | |
| Neutralise CSV only, and rely on typed XLSX cells | A string cell becomes a formula once a user edits it, or when the workbook is saved as CSV | |

**Choice:** `[auto] Neutralisation: Q: "How are formula-like values made safe?"` → the shared single-quote mark, both formats, stripped on import (recommended default).

---

## 9. The XLSX dependency

| Option | Description | Selected |
|--------|-------------|----------|
| Pass-or-fail criteria (permissive licence, npm-published and maintained, no unpatched advisories, typed multi-sheet writing, first-sheet value reading, pure JavaScript, measured cost), Strapi only, behind the module's interface; lean `write-excel-file` and `read-excel-file`, fallback ExcelJS, SheetJS excluded | A justified dependency with a verifiable choice, as decision 7 set criteria for the grid | ✓ |
| ExcelJS outright | Last stable release October 2023, with a dependency advisory; maintenance needs checking | |
| SheetJS (`xlsx`) | The npm package is 0.18.5 with CVE-2023-30533 and CVE-2024-22363 unpatched; patched builds are off the npm registry | |
| Hand-written XLSX (zip plus XML) | No dependency, but an unreviewed file-format implementation for a security product | |

**Choice:** `[auto] Library: Q: "Which XLSX library, and where?"` → criteria with the lean, in Strapi only (recommended default).

---

## 10. Grants and the human-only rule

| Option | Description | Selected |
|--------|-------------|----------|
| The export grant plus the list's own read (07 D-14), the list's scope; analyst exports human-only; own-record exports for active humans; no service identity exports; reserved FunctionAPIs moved from menu Functions into human-only API Functions; reference exports in the Administration Functions | No export ever widens scope; least privilege for automation (G-1, Phase 12 D-32); Phase 22's re-gating carries the reference exports | ✓ |
| Put export FunctionAPIs in the lists' menu Functions | The service agent holds those Functions, so automation could export the register | |
| Separate export rights distinct from read rights | No decision asks for them; deferred | |

**Choice:** `[auto] Grants: Q: "Who may export, and through which grants?"` → the recommended option.

---

## 11. The released-assessment predicate (stage2 seam, G-12)

| Option | Description | Selected |
|--------|-------------|----------|
| Gather `releasedForOwner` and its query helpers into one exported predicate that the three released reads, the export and the report call; export = readable and released | Phase 17 widens "readable" to participants and 17.1 widens "released" to `approved` or `closed`, each in one place | ✓ |
| A dedicated export check on the request's `requestor` | The hard-coded "the Requestor raised it" check the seam forbids; Phase 17 would have to find and change it | |
| Defer the assessment export to Phase 17 | Breaks CSV-01 criterion 2 and ROADMAP criterion 2 | |

**Choice:** `[auto] Predicate: Q: "What authorises a released assessment's export?"` → the one record-read predicate (recommended default).

---

## 12. An analyst exporting an unreleased assessment

| Option | Description | Selected |
|--------|-------------|----------|
| A 409 with a closed reason; analysts export an unreleased assessment's risks from Phase 18's table; both actors export the same released record | Truthful (the analyst can read it, so a 404 would lie); one deliverable whoever exports it | ✓ |
| A 404 | Misleads an actor who can read the record | |
| Export drafts as workbooks too | Drafts are not validated register risks (decision 11), and Phase 18 owns the table export | |

**Choice:** `[auto] Unreleased: Q: "What happens when an analyst exports an unreleased assessment?"` → the recommended option.

---

## 13. Row limits and streaming

| Option | Description | Selected |
|--------|-------------|----------|
| A 10,000-row cap, counted before generation, refused with the count and the cap; the dialog warns first; files built in memory | Comparable to common enterprise export limits; bounds memory for a buffered transport; a data-leakage control | ✓ |
| Stream unbounded exports | Unbounded memory in the Next server, and a bulk-exfiltration path | |
| Background export jobs | Needs a job store (R-08-36) and persistence; deferred | |
| An environment setting for the cap | Invites raising a control without review | |

**Choice:** `[auto] Limits: Q: "How are large exports bounded?"` → the recommended option.

---

## 14. The export log

| Option | Description | Selected |
|--------|-------------|----------|
| One security event log module writing a structured line through Strapi's logger: actor, view, format, columns, parsed filters, sort, zone, row count and outcome, never values; import commits too; queryable in the log platform; G-17's search log reuses it | Decision 12 verbatim with no content type; detection through the SIEM (Annex A 8.15, 8.16); one module for every later security event | ✓ |
| A new audit content type | A schema change the ROADMAP rules out | |
| Rely on the request log line | Misses the row count and the parsed filters, and records no refusals | |
| A JSON column on an existing record | Overloads an unrelated aggregate | |

**Choice:** `[auto] Log: Q: "Where does the export log live, and what is queryable?"` → the shared event log module (recommended default).
**Notes:** Retention follows R-08-13. An in-app audit view is deferred.

---

## 15. Delivery to the browser

| Option | Description | Selected |
|--------|-------------|----------|
| A typed service with a binary parse, called from a Server Action that validates input and returns the bytes; a client helper saves the file; the service validates type, name, size and signature | The project's Server Action pattern (no facade, no Route Handler); refusals shown in the dialog; research proves the binary return at the cap | ✓ |
| A Route Handler streaming Strapi's file | Better for very large files, but contradicts the project's no-Route-Handler stance, and a refusal becomes a broken download | |
| Base64 in a JSON action result | A third larger, and pointless now React 19 Flight carries typed arrays | |

**Choice:** `[auto] Transport: Q: "How does the file reach the browser?"` → the Server Action path (recommended default).
**Notes:** Phase 14's attachment downloads (25 MB) may choose a streaming route; the orchestrator aligns the two.

---

## 16. The export experience (G-4)

| Option | Description | Selected |
|--------|-------------|----------|
| An Export button in each page header, a dialog (format, columns, scope in words, cap warning, pending state), a success toast naming the file, refusals in place with choices kept, disabled on an empty list, a sheet on phones | Keyboard path, no lost input, empty and error states that say what to do (G-4); no confirmation or Undo because nothing changes | ✓ |
| A one-click download with no dialog | No column choice (CSV-01) and no warning before the cap | |
| A dropdown menu of formats only | Same gaps | |

**Choice:** `[auto] Experience: Q: "What does exporting look like?"` → the dialog (recommended default).

---

## 17. The released-assessment export

| Option | Description | Selected |
|--------|-------------|----------|
| The released read's content: Summary, Risks and Mitigation controls sheets plus About; CSV of one table; Phase 12's AI disclosure in About; 17.1's decisions join through the read | Never more than the read discloses; one deliverable for both actors; later phases extend it through the read | ✓ |
| Include analyst-only fields for analysts | Two versions of the formal deliverable | |

**Choice:** `[auto] Assessment export: Q: "What does a released assessment's workbook hold?"` → the recommended option.

---

## 18. The print-ready report

| Option | Description | Selected |
|--------|-------------|----------|
| A report route per actor, server-rendered from the released view's own loader and gated by the predicate, A4 through the print stylesheet, a screen-only toolbar, no PDF dependency; the layout an X-n extension | Decision 12's "through the print stylesheet"; one document structure; no new operation | ✓ |
| Print styles on the released view itself | Interactive and responsive structure, not a document; poor A4 pagination | |
| Server-side PDF generation (a headless browser or PDF library) | A heavy dependency the decision does not need | |

**Choice:** `[auto] Report: Q: "How is the A4 report produced?"` → a dedicated report route printed by the browser (recommended default).

---

## 19. Logging the report

| Option | Description | Selected |
|--------|-------------|----------|
| Not logged as an export; deferred | Its content is the released view itself, and the server cannot observe a browser print; a "report opened" line would be a misleading proxy | ✓ |
| A new logged report read operation | A new operation and grants for both actors for little value | |

**Choice:** `[auto] Report log: Q: "Is opening the report an export?"` → no, and deferred (recommended default).

---

## 20. One parser and file-level refusals

| Option | Description | Selected |
|--------|-------------|----------|
| Strapi parses; the web's client parsing retires; the browser checks only extension, type and size; file-level refusals carry closed reasons and safe details the web maps to fix-it copy (Phase 10 D-22) | One parser; the server's specific messages finally reach the user; less JavaScript on the import route | ✓ |
| Harden both parsers in step | Two implementations to keep equal, as today | |
| Harden only the web parser | The server stays authoritative, so its classification must change anyway | |

**Choice:** `[auto] Parser: Q: "Which parser is authoritative?"` → Strapi's alone (recommended default).

---

## 21. Accepted files and encodings

| Option | Description | Selected |
|--------|-------------|----------|
| CSV in UTF-8 (BOM optional, commas) and XLSX (first sheet, values), checked by extension and signature; fix-it refusals for Windows-1252, UTF-16, semicolon or tab delimiters, `.xls`, and macro-enabled, encrypted or password-protected workbooks; an uncompressed bound for XLSX | Excel users import the workbook directly (the goal's "without fighting the format"), the XLSX template comes back as is, and a legacy encoding is never guessed | ✓ |
| CSV only, with the Windows-1252 message | The XLSX template CSV-02 requires could not be imported | |
| Decode Windows-1252 automatically | A wrong guess (Latin-1, Mac Roman) silently corrupts names; CSV-02 asks for the fix-it message | |

**Choice:** `[auto] Files: Q: "Which files does an import accept?"` → CSV in UTF-8 and XLSX, with fix-it refusals (recommended default).

---

## 22. Headers and unknown columns

| Option | Description | Selected |
|--------|-------------|----------|
| Match API names and display labels after NFKC, lower-casing and removing spaces, underscores and hyphens; a small closed alias list only where unambiguous; unknown columns ignored with a named warning; `Issues` and reference read-only columns recognised and ignored with a note; duplicates and missing required columns refused by name | CSV-02 criterion 1; the error report and the reference export re-import cleanly | ✓ |
| Fuzzy header matching | Unpredictable mappings in a governance tool | |
| Keep rejecting unknown columns, but name them | Still fails UAT-051's extra "Owner" column | |

**Choice:** `[auto] Headers: Q: "How are headers matched?"` → the recommended option.

---

## 23. Values: flags, clearing, the mark and the example row

| Option | Description | Selected |
|--------|-------------|----------|
| Yes/No, Y/N and TRUE/FALSE in any case; blank leaves a field unchanged; the clear token `#CLEAR`, as the whole cell in any case, empties an optional field; the neutraliser's mark stripped; the template's example row skipped | CSV-02 criterion 2; a token that cannot be ordinary data; lossless round trips; the example row cannot create a record | ✓ |
| A blank cell clears the field | Every partial update would wipe the columns left empty | |
| `NULL` or `#N/A` as the token | `NULL` can be real text, and `#N/A` is Excel's own error value | |

**Choice:** `[auto] Values: Q: "How do cells map to values?"` → the recommended option.

---

## 24. Near-match names (CSV-03, UAT-052)

| Option | Description | Selected |
|--------|-------------|----------|
| Two tiers: exact (trimmed, NFC) as today; similar (NFKC, case-folded, whitespace collapsed) becomes a sixth state, "Matched by similar name", held until the analyst chooses Update (keeping the existing name) or Skip, per row or for all; confirmation needs every choice; Strapi checks the choices against its preview record | CSV-03 verbatim; the brief's "make duplicate or ambiguous matches visible rather than silently overwriting"; uniqueness rules out a create | ✓ |
| Show a warning but update anyway | The defect itself | |
| Reject near matches outright | Forces retyping names to their exact case when the user meant the update | |

**Choice:** `[auto] Near matches: Q: "What happens to a case- or whitespace-only match?"` → held for an explicit choice (recommended default).

---

## 25. Templates

| Option | Description | Selected |
|--------|-------------|----------|
| Served by Strapi from the import contract: display headers and an example row in CSV and XLSX, an XLSX Notes sheet (labels, API names, required, formats, allowed values, flag spellings, the clear token, blanks), optional dropdowns; the web's guidance contract proven equal or served | CSV-02 criterion 3; no drift; no XLSX writer in the browser; Phase 22's configurable lists flow in | ✓ |
| Built in the browser, as today | The XLSX writer would join the client bundle, and the contract stays duplicated | |
| Static files in `public/` | Drift unless generated and checked; XLSX zips are not byte-stable | |

**Choice:** `[auto] Templates: Q: "Where do templates come from?"` → Strapi (recommended default).

---

## 26. Error reports

| Option | Description | Selected |
|--------|-------------|----------|
| Built by Strapi from the same file and its own retained classification or outcome, in the upload's format (CSV with a BOM, or XLSX): the original headers, the rows not imported with their cells verbatim and neutralised, then `Issues` naming each problem and the original row number; offered at Review and Results; re-imports directly | CSV-02 criterion 3 and ROADMAP criterion 4; server-authoritative; XLSX keeps leading zeros the user is correcting | ✓ |
| The preview returns the original cells and the web builds the report | Returns raw content as JSON a page could render (the Phase 6 rule), and needs an XLSX writer in the web | |
| All rows with an empty `Issues` for the good ones | Hides the few rows to fix among thousands; established import tools return the failed rows only | |

**Choice:** `[auto] Error reports: Q: "What is the error report, and who builds it?"` → the recommended option.

---

## 27. The reference-list round trip

| Option | Description | Selected |
|--------|-------------|----------|
| Reference exports hold the template's columns, then read-only columns the import ignores with a note; XLSX recommended for the round trip | REPORT §6's "CSV in the import template's format", without hiding owners and other read-only facts | ✓ |
| The template's columns only | Drops facts the list shows | |
| The visible columns | The file would not re-import | |

**Choice:** `[auto] Round trip: Q: "What does a reference-list export hold?"` → the recommended option.

---

## 28. Value conversion for Phase 18

| Option | Description | Selected |
|--------|-------------|----------|
| One Strapi module of typed converters this phase uses (text, flag, enumeration, clear token, mark), with an interface Phase 18 extends (dates in dd/mm/yyyy and ISO, scale labels from `risk-scale.ts`, people, controls) and mirrors in the web for paste previews | Shared as the seed asks, without building converters no Phase 19 column needs | ✓ |
| Build Phase 18's date and rating converters now | Unused code with no column to prove it | |
| Let Phase 18 write its own | Two conversion rules for one product | |

**Choice:** `[auto] Conversion: Q: "How is value conversion shared?"` → the recommended option.

---

## 29. Verification and plan shape

| Option | Description | Selected |
|--------|-------------|----------|
| RED first at each seam; Strapi unit and integration tests that read the files back; a matrix row per operation for six callers; the UAT's own file shapes as fixtures; web unit tests for the dialog, refusals, import steps and report; Playwright journeys for the register export, the Requestor's own export and the other Requestor's refusal, the import journeys and the A4 report; plans grouped by family and serialised by shared files | Every criterion and every negative case proven in the API and the UI; the tree stays clean (G-6) | ✓ |

**Choice:** `[auto] Verification: Q: "How is the phase proved?"` → the recommended option.
**Notes:** About 22 new operations. They are regular, so the roadmap's M may become L.

---

## Planner's Discretion

- Module placement under `apps/backend/src/csrm/` and in the web features.
- Paths, parameter names, view keys and the export Function layout, within the families decided.
- Column vocabularies per view, from each list as it stands after Phases 10 to 16.
- Whether the web reads the import contract from Strapi or keeps a parity-tested copy.
- The result record for Results-step error reports.
- Remembering a viewer's last format and columns per view in browser storage.
- The XLSX uncompressed bound and the header alias lists.
- Copy, layout, file slugs and extension wording, which the UI-SPEC fixes.

## Deferred Ideas

- Importable relations (an Information System's owner, a Risk Type's applicable controls): Phase 22 or the backlog.
- Streamed or background exports past 10,000 rows.
- A persisted audit store and an in-app export history.
- A report-generation log entry.
- Protective markings on files, and export rate limits or anomaly alerts.
- Links back to CSRM records inside files.
- Exports of a single request, questionnaire answers, notes or Home widgets.
- Export rights separate from read rights.
- Importing a Windows-1252 file on an explicit choice.
- Date, rating, person and control converters: Phase 18.
