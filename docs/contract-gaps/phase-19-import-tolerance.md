# Phase 19: Import Tolerance

## Gap

The four Administration imports refuse the spreadsheets people actually have (UAT-051, UAT-052; CSV-02, CSV-03):

- A file with a `Name` header in display case and an extra `Owner` column is refused outright, because `phase-06-administration-import-contract.md` ("CSV bounds and normalization") fails the file contract on any unknown header, and the web pre-parses with its own copy (`csv-client-parser.ts`), which is where UAT-051's message came from, while Strapi's preview answers only "The CSV file could not be validated."
- Excel's default CSV (Windows-1252), a semicolon- or tab-delimited file and an `.xlsx` workbook are all refused with no reason the person can act on.
- Flags accept only `true` and `false`; an optional value cannot be cleared from a file ("CSV cannot clear an optional value in Phase 6").
- A lower-case duplicate of an existing name (UAT-052) becomes an ordinary update, because one normaliser drives both matching and uniqueness.
- There is no template from Strapi and no error report a person can correct and import again.

This record amends the Phase 06 import contract with every rule Phase 19 changes. It changes no content type (D-01). The export operations, Functions, refusal set, event log and closed reasons are in `phase-19-exports-and-export-log.md`.

## Amends

`phase-06-administration-import-contract.md`, effective on this record's approval (that record's "Phase 19 amendment" section points here). The Phase 06 rules this record changes:

- **"CSV bounds and normalization":** CSV only, header case and outer whitespace normalised to the closed allowlist, unknown headers failing the file, booleans `true`/`false` only, no clearing from CSV. Amended by "Accepted Files and Bounds", "File Refusals", "Headers" and "Values" below.
- **"Raw file contents and unparsed CSV text are never returned to the browser":** amended by "Raw File Contents" below.
- **"Five authoritative classifications":** a sixth, `similar`, joins them ("Classifications: the Sixth State").
- **"Server-issued preview and confirmed apply":** the commit takes `decisions`, returns `resultToken` and `skipped`, and an expired or unknown preview gets a new reason ("Decisions on Similar Rows", "Error Reports and the Result Record").
- **The operation inventory:** each collection gains a template and an error-report operation ("Templates", "Error Reports and the Result Record"), and an export operation (`phase-19-exports-and-export-log.md`).

Everything else in the Phase 06 record stands: the operation inventory and its grants, the natural keys and the uniqueness normaliser, the preview record's binding and five-minute lifetime, single use, the serialised per-collection queue, the 65,536-record collection bound, drift as `ROW_PREVIEW_DRIFT`, per-row transactions, Information System `owner` and Risk Type `applicableControls` staying manual, and the single-process boundary.

## Accepted Files and Bounds

**Accepted files (D-26).**

- **CSV:** UTF-8 with or without a BOM, comma-delimited.
- **XLSX:** the first worksheet of an `.xlsx` workbook, other sheets ignored, cached cell values rather than formulas, so the XLSX template comes back as it is and nobody has to convert it to CSV. A formula error cell (`#DIV/0!`) imports as blank.
- **Type check:** the extension (`.csv` or `.xlsx`) and the content signature against that allow-list, as decision 2 checks attachments. The declared MIME type is advisory only (empty, `application/octet-stream`, `text/csv` or `application/vnd.ms-excel` for `.csv`; `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` for `.xlsx`).

**Bounds.**

- **Unchanged from Phase 06:** 5 MiB (5,242,880 bytes) per file; exactly one file under the `file` field; 5,000 data rows, excluding the header row; 65,536 bytes per record.
- **A record above 65,536 bytes** is now a `rejected` row with `VALUE_TOO_LONG` (field null), and the rest of the file is still read.
- **XLSX archive bounds,** checked before any inflate, through Phase 14's `readZipDirectory` (`csrm/files/zip-archive.ts`) with these bounds: an archive that declares **more than 512 entries** or **more than 52,428,800 bytes (50 MiB) uncompressed** in total is refused; so are an entry above a 200:1 ratio, ZIP64, an encryption flag, and a compression method other than stored or deflate. Every inflate uses `maxOutputLength`, so the actual total is bounded too. 50 MiB gives about ten times the headroom of a maximal legitimate 5,000-row template (19-RESEARCH Pattern 5) and refuses a 200 MiB bomb.
- **Retained issue data:** a preview record whose retained issue data exceeds 1,048,576 bytes is refused at preview with `IMPORT_WORKBOOK_TOO_LARGE`, which keeps the 256-record cap's memory bounded.

## File Refusals

A file-level refusal answers with a closed reason in `details.reason` and safe details in `details.found`, in the `AssessmentWorkflowErrorResponse` envelope, which the web maps to fix-it copy (19-UI-SPEC S2). `AdministrationWorkflowError` gains the 422 status. Each refusal writes nothing. These replace today's single 400 for a file the parser cannot read ("The CSV file could not be validated."); a malformed multipart shape stays 400, and authorisation still precedes any inspection of the file (Phase 06).

| Reason | Status | When | `found` |
| --- | --- | --- | --- |
| `IMPORT_FILE_TYPE` | 415 | Not `.csv` or `.xlsx`; content that does not match its extension; a malformed archive, an archive comment, or an unsupported compression method | |
| `IMPORT_FILE_TOO_LARGE` | 413 | More than 5,242,880 bytes | `bytes` |
| `IMPORT_TOO_MANY_ROWS` | 422 | More than 5,000 data rows | `rows` |
| `IMPORT_ENCODING_WINDOWS_1252` | 422 | Not valid UTF-8 and no byte undefined in Windows-1252 (Excel's default CSV) | |
| `IMPORT_ENCODING_UTF16` | 422 | A UTF-16 BOM, or NUL bytes in the text ("Unicode Text") | |
| `IMPORT_ENCODING_UNKNOWN` | 422 | Not valid UTF-8, with a byte undefined in Windows-1252 (0x81, 0x8D, 0x8F, 0x90 or 0x9D) | |
| `IMPORT_DELIMITER` | 422 | The header line has no comma and has a semicolon or a tab (a one-column file is accepted) | `delimiter`: `semicolon` or `tab` |
| `IMPORT_LEGACY_XLS` | 422 | An old `.xls` (CFB) workbook | |
| `IMPORT_MACRO_WORKBOOK` | 422 | A workbook with `xl/vbaProject.bin` or a macro-enabled content type | |
| `IMPORT_ENCRYPTED_WORKBOOK` | 422 | An encrypted or password-protected workbook (a CFB `EncryptedPackage`, or the ZIP encryption flag) | |
| `IMPORT_WORKBOOK_TOO_LARGE` | 422 | The archive bounds above, or the retained issue-data bound | |
| `IMPORT_NO_HEADER` | 422 | The first row is empty or every cell is blank | |
| `IMPORT_NO_ROWS` | 422 | A header and no data row | |
| `IMPORT_DUPLICATE_HEADER` | 422 | Two headers map to one field | `headers` (both as typed), `labels` |
| `IMPORT_MISSING_COLUMN` | 422 | A required column is missing | `labels` (its display label) |

`found` is closed: `headers` and `labels` hold at most 20 strings of at most 200 characters each, with controls removed; `delimiter` is `semicolon` or `tab`; `rows` and `bytes` are integers.

**CSRM never guesses a legacy encoding,** because a wrong guess silently corrupts names. A non-UTF-8 file is refused with the fix: save as "CSV UTF-8 (Comma delimited)", or upload the `.xlsx` workbook itself. Trailing fully blank rows are dropped before the row count.

## Headers

- **Matching (D-27):** each header is matched after trimming, Unicode NFKC, lower-casing and removing spaces, underscores and hyphens, against each column's API field name and its display label (the template's header), under the same key. `Name`, `name` and `NAME` all match `name`; `Internet facing` and `internetFacing` match `internetFacing`.
- **Unknown columns are ignored,** with a preview warning naming each header as typed (`warnings`, at most 50 of at most 200 characters). The UAT's `Owner` column is ignored this way.
- **Known non-imported columns are ignored with an informational note, not a warning:** the error report's `Issues` column (note `issues-column`) and a reference export's read-only columns (note `read-only-columns`, with their labels in `readOnlyColumns`), so an exported reference list and a corrected error report import back.
- **Refusals:** two headers that map to one field (`IMPORT_DUPLICATE_HEADER`, naming both), and a missing required column (`IMPORT_MISSING_COLUMN`, naming its display label).

## Values

- **Flags** accept `Yes`/`No`, `Y`/`N` and `TRUE`/`FALSE` in any case, and XLSX boolean cells.
- **Enumerations** match their values case-insensitively and are stored canonically (as today).
- **Cells are trimmed.** A blank cell leaves an updated field unchanged and gives a created record the default (as today).
- **`#CLEAR`,** in any case and as the whole trimmed cell, empties an optional field on an update. On a required field it is a row issue; on a create it equals blank. **Reversibility: costly** (templates and habits carry the token).
- **Mark stripping:** a leading single quote before a formula trigger (the neutraliser's mark, `phase-19-exports-and-export-log.md`, "Formats, Values and Neutralisation") is removed: exactly one leading `'`, only when what follows is a trigger or the quote-run pattern. It is the neutraliser's exact inverse, matching Excel's own reading of a quote-prefixed cell, so an export, edit and import round trip is lossless.
- **Numbers in text columns** (a control number typed as `42` in a workbook) arrive as numbers and are read as their text.
- **The template example row:** a row whose natural key equals the reserved key `Example (CSRM skips this row)` (`EXAMPLE` for a Control number), compared trimmed and in NFC, is skipped with the note `example-row`. The natural-key validation refuses the reserved key on a create, so no real record can carry it.

The converters (text, flag, enumeration, clear token, mark stripping) form the shared value-conversion module Phase 18 extends (D-29).

## Classifications: the Sixth State

The five Phase 06 classifications stay, and a sixth joins them (D-30):

- **Exact tier:** the trimmed key in Unicode NFC. An exact hit classifies as today: `create`, `update` or `unchanged`.
- **Similar tier:** equal only after NFKC, lower-casing and collapsing internal whitespace (`administrationSimilarKey`). A similar-only hit is **`similar`**, with `matchedDocumentId`, `matchedUpdatedAt` and **`matchedName`** (the existing record's name), shown as `Matched by similar name` (X-32).
- **Ambiguous:** two rows of one file that share a similar key stay `ambiguous`.
- **Uniqueness keeps its broader rule.** `normalizeAdministrationNaturalKey` (trim, NFKC, `en-AU` lower case) still guards every create and rename, so a case-only create is never offered and never written.
- **Limit of the rule:** JavaScript has no full Unicode case folding, so `ß`/`SS` and the Turkish dotless `ı` are not folded; the rule is stated as "NFKC, lower case, collapsed whitespace" (19-RESEARCH Pitfall 20).

Summary counts, row-state enums, filters and results carry all six names. The preview's `summary` holds a count per state, six in all. A `similar` row has no write result until it is decided. **Reversibility: costly** (a published row-state vocabulary).

## Decisions on Similar Rows

A `similar` row is neither created nor updated until the Security Analyst decides it, per row or for every similar row at once:

- **`update`** applies the row's other values and keeps the existing name, as an update does today, in the row's own transaction;
- **`skip`** leaves the record as it is and writes nothing.

**The commit's `decisions` field:** optional, a multipart field holding a JSON object of row number (a string of 1 to 5 digits) to `update` or `skip`, at most 5,000 entries, parsed closed (else 400). Strapi checks it against its retained preview record, never against client-supplied rows:

- every `similar` row of the retained preview needs a decision, else 409 `IMPORT_DECISION_MISSING`;
- a decision for a row that is not `similar` is 400;
- the commit re-classifies, and a row whose state or match changed since preview is rejected as drifted (`ROW_PREVIEW_DRIFT`), as today.

**The commit's response** adds `resultToken`. Its state-keyed `summary` holds `create`, `update`, `unchanged`, `rejected` and `ambiguous`, plus **`skipped`**: a similar row decided `update` counts under `update`, one decided `skip` under `skipped`. `previewChanged` stays. Each result row carries its `state` (a similar row keeps `similar`) and, for a similar row, its `decision`.

**An expired preview.** An expired, unknown, other-actor or other-collection preview token at commit changes from 409 `IMPORT_PREVIEW_CHANGED` to **409 `IMPORT_REVIEW_EXPIRED`** (plan 19-13). A file whose digest differs from the reviewed one keeps 409 `IMPORT_PREVIEW_CHANGED`.

## Templates

`GET /api/v1/{segment}/import/template?format=csv|xlsx`, for each segment `risk_types`, `controls`, `information_systems` and `information_assets` (D-31), generated from the import contract on request, so a template never drifts:

- display-label headers and one example row whose reserved natural key the import skips ("Values");
- text columns in the `@` (text) format, so Excel keeps what is typed (`0042`);
- in XLSX, a `Notes` sheet: each column's label, its API name (`Also accepted as`), `Required` or `Optional`, its format and allowed values (in their display labels), and what a blank does; then the six rules of 19-UI-SPEC §3.4 (the flag spellings, `#CLEAR`, the example row, ignored columns, Excel error cells, and keeping the file as an `.xlsx`);
- no dropdown validation, because `write-excel-file` needs an add-on for it (D-12);
- the file name `{collection slug}-import-template.{csv|xlsx}`, with no date.

Phase 22's configurable lists flow into the allowed values with no template change. Templates are served with the export file headers (`phase-19-exports-and-export-log.md`, "File Responses") without `X-CSRM-Row-Count`. A template is not an export of records and is not logged as one.

## Error Reports and the Result Record

`POST /api/v1/{segment}/import/error_report` (D-32), multipart: the same `file`, and exactly one of `previewDigest` (at Review) or `resultToken` (at Results).

- **Server-authoritative:** built from the uploaded file and Strapi's own retained preview record or result record, bound to the same actor and collection, with the file's digest checked against the record. Client-supplied issues are never accepted.
- **Content:** the original header row as typed, then every row not (or not yet) imported, its cells verbatim and neutralised, plus a last `Issues` column naming each problem by its column's display label, with the original row number.
- **Excluded:** imported rows, and similar rows the person chose to skip.
- **Format:** the uploaded file's: CSV (UTF-8 with a BOM) or XLSX. The file name is `{collection slug}-import-issues-{local date}.{format of the uploaded file}`.
- **Offered** at Review (for Rejected, Ambiguous and similar rows) and at Results (for any row not imported except the person's own skips).
- **The round trip:** the person corrects the report in Excel and imports it again; `Issues` is ignored with a note, and rows now valid create or update.

**The preview record** keeps, per row, its issue codes (`{ code, field }`, at most 20) and `matchedName`, beside today's state, matched `documentId` and `updatedAt`.

**The result record** mirrors the preview record: bound to the actor and collection, with the file digest, file name, format and per-row `{ rowNumber, outcome, decision, issues }`; a five-minute TTL (`IMPORT_RESULT_TTL_MS = 300_000`); at most 256 records globally and 16 per actor and collection, pruned on issue; keyed by an opaque `resultToken` (`sha256:` plus 64 lowercase hexadecimal characters of 32 random bytes). Like preview records it is process-local, within Phase 06's single-process boundary. No import-result content type is introduced.

An error report is not an export of records and is not logged as one.

## Reference-List Round Trip

The four reference-list exports (`phase-19-exports-and-export-log.md`) hold the import template's columns, then the list's read-only columns (an Information System's owner, for example), which the import recognises and ignores with a note (D-33). An exported list, edited and imported again, updates by natural key. The guidance recommends XLSX for the round trip, because Excel strips leading zeros (`0042`) and converts date-like text when it opens a CSV.

## Raw File Contents

The Phase 06 sentence "Raw file contents and unparsed CSV text are never returned to the browser" is amended to:

> The uploader's own cells return only inside a downloaded error report built from the server's records, never as JSON a page renders.

The preview's `warnings` name ignored headers as typed (bounded, controls removed) and `found` names headers and labels (bounded, controls removed); no response returns a cell value as JSON, and the error report's cells are neutralised.

## Import Commit Events

Each commit writes one `import.committed` line through Phase 14's security event log (`csrm/audit/security-event-log.ts`), after the commit's transactions (D-18):

- outcome `committed`;
- `actor { documentId, displayName }`;
- `collection`;
- `fileName`: at most 255 characters, controls removed (D-18 names it);
- `sha256`: the file's digest;
- `format`: `csv` or `xlsx`;
- `counts`: `created`, `updated`, `unchanged`, `rejected`, `ambiguous` and `skipped`.

Never a cell value. Previews, templates and error reports write no event. Retention follows R-08-13.

## What This Extension Does Not Add

- **No content type**, attribute, relation, enumeration value or migration; no import-result entity.
- **No legacy-encoding guess:** no Windows-1252, Mac Roman or UTF-16 decoding.
- **No relation or owner columns from a file:** Information System `owner` and Risk Type `applicableControls` stay manual, and an export's owner column is read-only.
- **No create offered for a similar row**, and no change to the uniqueness rule.
- **No other worksheet** than the first, no formula evaluation, no `.xls`, `.xlsm` or encrypted workbook.
- **No client-side parsing:** the web's parser retires (plan 19-15), and the browser checks only the extension, the declared type and the 5 MB size before upload (D-25).
- **No dropdowns** in templates (D-12).
- **No multi-process preview or result store:** both stay within Phase 06's single-process boundary.

## Affected Workstreams

`apps/backend` is shared by every workstream (`.planning/PROJECT.md`, "GSD Workstreams", "The shared backend"). On 2026-10-16 that section's workstream table lists two workstreams: `csrm` (`apps/csrm`) and `iam` (a platform workstream with no application).

- **`csrm`** is the only workstream whose application calls the preview, commit, template and error-report operations, or reads the row states, reasons, details, warnings and notes this record publishes.
- **`iam`** reads `csrm-authorization.ts`, the role-function catalogue and `served-operations.json`, and none of Phase 19's import names.

The two greps, re-run on 2026-10-16 from the repository root:

- **Grep A:** `grep -rlE "csrm-authorization|idambox-csrm-role-function-api-catalogue|served-operations|specification\.json|conflict-reasons" .planning/workstreams/iam/` printed 10 files, all in IAM phase 02 (`02-identity-model-and-leaver-safe-keycloak-sync`): `02-03-PLAN.md`, `02-03-SUMMARY.md`, `02-05-PLAN.md`, `02-13-PLAN.md`, `02-CONTEXT.md`, `02-GATE-EVIDENCE.md`, `02-RESEARCH.md`, `02-REVIEW.md`, `02-SECURITY.md` and `02-VALIDATION.md`. Their reads concern the registered-source-service isolation, `function.identity_provisioning.api` and the `IAM_SCIM_RESERVATIONS`, which Phase 19 does not change.
- **Grep B:** `grep -rlE "CONFLICT_REASONS|HUMAN_ANALYST_ONLY|SERVICE_IDENTITY_REFUSED|/v1/[a-z_]+/export|export_api|csv-import|import/preview|import/template|error_report|function\.risk_register|function\.reports|function\.administration|AssessmentWorkflowErrorResponse|write-excel-file|xlsx-reader|security-event-log" .planning/workstreams/iam/` printed nothing (exit status 1).

Each change, with its backward-compatibility position:

1. **The preview and commit accept `.xlsx` and more CSV spellings** (headers by label, flag spellings, `#CLEAR`, the stripped mark, ignored columns): every file accepted before is still accepted with the same rows.
2. **The sixth row state `similar` with `matchedName`:** a reader that switches exhaustively over the five states must handle it. Only `csrm` reads it (plans 19-13 and 19-15).
3. **The commit's optional `decisions`** (409 `IMPORT_DECISION_MISSING` when a `similar` row has none), **its `resultToken` and `skipped` count, and the preview's `warnings` and `notes`:** additive. A commit without `decisions` behaves as before whenever no row is `similar`.
4. **File refusals now carry closed reasons, with new 413, 415 and 422 statuses** (`AdministrationWorkflowError` gains 422): a file refused before is still refused, now with a reason. Today an unreadable file is 400 (`INVALID_IMPORT_FILE`, "The CSV file could not be validated."), an oversize file 413 and an unsupported type 415; with this record a file-content refusal is 422 with its reason, and the 413 and 415 refusals gain theirs. A malformed multipart shape stays 400. A strict reader of the error envelope must accept the new statuses, reasons and `found`; only `csrm` reads them.
5. **An expired or unknown preview at commit changes from 409 `IMPORT_PREVIEW_CHANGED` to 409 `IMPORT_REVIEW_EXPIRED`** (plan 19-13), while a file changed since its preview keeps `IMPORT_PREVIEW_CHANGED`: a deliberate change, still a 409 with no writes; only `csrm` reads it, and plan 19-13 names it in a test.
6. **The template and error-report operations and `import.committed`:** additive; no existing operation or log line changes.

## Approval

Status: **approved by the pilot on 2026-10-16** (G-6).

What the pilot checked (2026-10-16): UTF-8 CSV or an `.xlsx` first sheet, with archive bounds checked before unpacking and no encoding guessed (a Windows-1252 file gets a fix-it refusal, CSV-03); header matching by field name or label with unknown columns warned and ignored; the `similar` row state held for an analyst decision, never auto-merged (success criterion 5); a re-importable error report (criterion 4); the `import.committed` event; AGENTS.md (Strapi enforces every rule against the resolved IdamBox User; navigation visibility is not authorisation; Requestors never reach another Requestor's records; AI is not involved; JDL terminology); the role-function catalogue (new API-only Functions, human-only analyst exports, the Requestor-birthright own-record Function, no grant to the Security Analyst Agent or any service role, both copies byte-identical); `specification.json` changes additive only; no content-type change; and `.planning/PROJECT.md` "The shared backend": the Affected Workstreams section re-ran both greps, `iam` reads none of Phase 19's names, and every change keeps existing endpoints, grants and decisions backward compatible. Rulings on the executor's four points: (1) `ASSESSMENT_NOT_RELEASED`, not the UI-SPEC's `EXPORT_NOT_RELEASED`, so Phase 17 D-29 reuses one reason, and the UI-SPEC row follows the record; (2) `columns` applies to the 12 list views only, never to the report export (UI-D5); (3) an unreadable import file answers 422 with a closed reason and a malformed multipart request stays 400, and `csrm` (the only caller) is updated in 19-15; (4) a record over 64 KiB becomes one rejected row `VALUE_TOO_LONG`, not a whole-file refusal, which keeps the import tolerant and the error report correctable.

No import-contract change, `docs/references/specification.json` operation, catalogue grant or `served-operations.json` entry for Phase 19 lands before the pilot's dated approval line is written here and in `phase-19-exports-and-export-log.md` (D-01, G-6). The pilot writes the line; the executor never does.

## Phase 19 execution amendment (2026-10-17): a CSV that cannot be parsed

**Gap.** Plan 19-03's reader refuses a CSV whose text it cannot parse as `IMPORT_FILE_TYPE` (415). Examples are a quote that is never closed, a stray quote inside an unquoted field, or a row whose column count differs from the header's. "File Refusals" gives `IMPORT_FILE_TYPE` only for a file that is not `.csv` or `.xlsx`, content that does not match its extension, or a broken archive. An unparseable CSV is none of these: it is a real CSV with a broken row. Its file-type copy ("Choose a CSV or Excel file") would tell the analyst the wrong fix, and CSV-03 asks for fix-it messages. The pilot ruled on 2026-10-17 that it gets its own 422 reason (ruling 3: an unreadable import file answers 422 with a closed reason).

**Change.** One closed reason joins the "File Refusals" table:

| Reason | Status | When | `found` |
| --- | --- | --- | --- |
| `IMPORT_CSV_MALFORMED` | 422 | A `.csv` file whose UTF-8 text the CSV parser refuses: an unclosed quote, an invalid closing quote, or a record whose field count differs from the header's | `line`: the 1-based source line on which the parser failed, when the parser reports one; omitted otherwise |

- **`found` stays closed.** It gains one key, `line`: a positive integer, sent only with `IMPORT_CSV_MALFORMED`. The transport guard keeps it beside that reason only, as it keeps `rows`, `rowCount`, `rowCap` and `found` today (19-02).
- **The check order is unchanged.** The encoding, delimiter, header and row-count checks run before the parse, as they do now. A Windows-1252 or semicolon-delimited file still gets its own reason. `IMPORT_FILE_TYPE` keeps every case "File Refusals" lists for it.
- **Nothing is written,** and no row is classified. The whole file is refused, as with every other file refusal. A single over-long record is still a `VALUE_TOO_LONG` row, never this refusal (ruling 4).
- **The raw text is never echoed.** `found.line` carries the line number only, never the line's content ("Raw File Contents").

**Proposed fix-it copy** (19-UI-SPEC S2 style, `features/administration/import-refusal-copy.ts`):

- Title: `Fix the CSV file`
- Body with `line`: `Line {line} can’t be read. A quote may be missing, or the row has a different number of columns from the header.`
- Body without `line`: `A row can’t be read. A quote may be missing, or a row has a different number of columns from the header.`
- Steps: the existing `SAVE_AS_CSV_UTF8` steps, prefixed with `Open the file in Excel, check that row, then:`. Their step 3 already offers the alternative of uploading the `.xlsx` workbook itself.

**The two 19-03 guards (checked; no new reason needed).** Both reasons are already closed in this record, with their statuses and S2 copy (19-02, `import-refusal-copy.ts`). Each guard only adds a trigger to an existing row:

- **`IMPORT_TOO_MANY_ROWS` (422, `found.rows`):** the record's "More than 5,000 data rows". The XLSX check before reading (a cell beyond row 5,001, the header plus 5,000 rows) is the same bound, measured before the reader pads the sheet. The copy is unchanged.
- **`IMPORT_WORKBOOK_TOO_LARGE` (422):** the record lists "the archive bounds above, or the retained issue-data bound". This amendment adds a third trigger to that row: a first sheet whose used range is wider than **1,024 columns** (`XLSX_IMPORT_MAX_COLUMNS`). The reading library pads every row to the sheet's used range, so a two-cell file spanning A1 to XFD1048576 would otherwise expand to billions of cells before any row bound applies. The copy is unchanged ("This workbook is too large to open"). No legitimate template comes close: the widest has fewer than 30 columns.

**Where it lands, after approval.** The reason goes into Strapi's `CONFLICT_REASONS`, both specification enums, the web mirror, the transport guard (`found.line`), the S2 copy, and the reader's parse `catch` in `csrm/spreadsheets/import-file.ts`, all in one commit with its tests (D-02). That commit belongs to plan 19-13, which moves the imports onto the 19-03 reader. 19-15 maps it in the web import flow. Nothing is wired before the approval line below is written.

### Affected Workstreams

- **`csrm`** is the only workstream that calls the import preview or reads its refusal reasons and `found`.
- **`iam`:** on 2026-10-17 the record's grep B, run from the repository root, printed nothing (exit status 1). So did a narrower grep for `CONFLICT_REASONS|IMPORT_CSV_MALFORMED|IMPORT_WORKBOOK_TOO_LARGE|IMPORT_TOO_MANY_ROWS|AssessmentWorkflowErrorResponse|csv-import|import/preview` in `.planning/workstreams/iam/` (exit status 1).
- **Backward compatibility:** additive. There is one new reason in a closed list, one new `found` key sent only with it, and one new trigger for an existing reason. A file that is refused today is still refused, now with a 422 and a reason that names the fix rather than a 415 with the wrong fix. No endpoint, grant, row state or decision changes. Only `csrm` reads any of it.

Phase 19 execution amendment status: **approved by the pilot on 2026-10-17** (G-6).

What the pilot checked (2026-10-17): the gap against the approved "File Refusals" table (an unparseable CSV is neither a wrong type nor a mismatched extension); one additive closed reason, `IMPORT_CSV_MALFORMED` 422, with `found.line` holding a line number only and never the line's content ("Raw File Contents"); the unchanged check order, so encoding and delimiter refusals keep their own fix-it copy; the fix-it copy, approved as written (it names the likely cause and the fix, and offers the .xlsx route); the two 19-03 guards, which only add triggers to existing reasons, with the 1,024-column bound refusing an expansion bomb before any cell is materialised; no new dependency (`csv-parse` 7.0.2 was already a Strapi dependency before `PHASE_19_BASE`); and `.planning/PROJECT.md` "The shared backend": the iam greps print nothing and only `csrm` reads the reason.
