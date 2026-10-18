---
phase: 19
review: 19-REVIEW.md
recorded: 2026-10-17
open: 0
total: 43
fixed: 39
skipped: 2
deferred: 2
---

# Phase 19 code review disposition

Every Critical and Warning was confirmed by a failing test before its fix (a RED commit, then a GREEN commit), except where the row says otherwise. Each Info item is fixed, skipped with evidence, or deferred with a route to a named later phase. The two deferrals are recorded in `deferred-items.md` and as a dated "Carried from Phase 19" section in `22-CONTEXT.md` (`1e0dff69`).

The pilot raised three Info findings to Warning: BE1-06 and BE1-07 (record-level defence in depth, and a silent limit in a released export is data loss) and BE2-08 (a stale grant row on a moved URL). With them the review holds 1 Critical, 14 Warnings and 28 Info. The Severity column below gives the severity the finding was dispositioned at.

Rulings and approvals, all dated 2026-10-17:
- **G-6:** the review amendment to `docs/contract-gaps/phase-19-exports-and-export-log.md` (`EXPORT_CELL_TOO_LONG`, a 422 with `column` and `cellLimit` on XLSX only; and the log-only `EXPORT_FAILED` at warn) was proposed in `c7a30e7d` and approved in `3b5c66fa`, with its copy as written. The BE1-08 and BE2-10 errata in the same record are documentation corrections, not contract changes (pilot ruling).
- **Copy:** 19-UI-SPEC review amendment R1 (FE4-06, FE4-07 / item (a), FE4-09, FE4-16, and the §7 toast exception for FE4-12) was proposed in `cbcdc393` and approved in `6f4f99b0`. Review amendment R2, the pilot's ruling on the 21 import-flow strings the copy guard caught, is `0e9190fd`: 18 approved as written and three reworded because the import takes Excel too.
- **The pilot's other rulings** on each lane are quoted in the rows: BE1-01, BE1-02, BE1-03, BE1-04, BE1-05, BE1-08, BE1-09, BE1-10; BE2-01 to BE2-11; BE3-01 (fixed first, then refined so a formatted workbook is not refused) and BE3-02 to BE3-06.

No fix changed a content type or a path naming Keycloak, and `apps/backend/tests/keycloak-identity.unit.test.ts` is untouched (BE2-04 changed only the source comment).

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| BE1-01 | warning | fixed | `78b1bb20`, `8472fcad`: the neutraliser marks a formula trigger hidden behind a leading control, C1, format or non-character (U+FFFD among them), tested by writing the workbook with `write-excel-file` itself and reading the cell back, and through the CSV writer. The record's erratum states what an XLSX text cell can hold (`b4c51539`). |
| BE1-02 | warning | fixed | G-6 `c7a30e7d` proposed, `3b5c66fa` approved. `4f48bd7d`, `6daf7443`, `fab54da5` (Strapi; `6daf7443` alone does not typecheck, `fab54da5` lands the type): an XLSX export with a text cell longer than 32,767 characters is refused 422 `EXPORT_CELL_TOO_LONG` with `column` and `cellLimit` before anything is written; the writer itself refuses a longer cell; CSV is written whole; the error report writes a cut cell with a visible suffix. The regenerated `schema.d.ts` is in `6daf7443`. Web: `5c94e6c9`, `d57d0908` (the reason in the mirror, the transport keeps its two details, the approved S1 copy), `f96bfb95` (the S1 row in 19-UI-SPEC). |
| BE1-03 | warning | fixed | `6a2b3c3a`, `afbdfd38`: the two assessment list exports' `columns` pattern is a valid quantifier, and a test compiles every `pattern` in `specification.json` with the `u` flag and checks the export column keys against it. |
| BE1-04 | info | fixed | `57c45a0b`, `55e125e2`: a refused line keeps its format and the re-read row count, and display names lose control and bidi characters (log injection). The post-parse failure line needed G-6 (`3b5c66fa`): `4f48bd7d`, `fab54da5` log `EXPORT_FAILED` once at warn from one catch in each runner, never with a message or a cell; the response stays Strapi's 500. |
| BE1-05 | info | fixed | `e058dc57`, `baebc1ed`: both writers neutralise the header row, once; the error report hands its labels over raw so they are not marked twice. |
| BE1-06 | warning (raised from info) | fixed | `3d8a82d0`, `0ca6c6e7`: the assessment list exports re-read the chosen ids within the list's scope, and the owner's again in memory: the released read module's "both rules twice". |
| BE1-07 | warning (raised from info) | fixed | `4d08521c`, `2e18bae5`: the released export pages through its Risks and control implementations (ordered `id:asc`) instead of cutting them at 1,000; an over-cap assessment gets the existing `EXPORT_ROW_LIMIT`, so no contract change. |
| BE1-08 | info | fixed | `b4c51539`: a dated erratum in the exports record says an unknown time zone is a 400, matching the spec and the code. |
| BE1-09 | info | deferred: Phase 22 | A questionnaire export with a `status` filter loads the scope before the cap, because the status is computed in memory. The cap still bounds the file; the fix is not small. Routed to Phase 22's hardening (pilot ruling; `1e0dff69`). |
| BE1-10 | info | fixed | `5231a37d`, `117f1941`: every export view leaves out a row that disappears before it hydrates, by one shared rule, and the race is tested. |
| BE2-01 | info | fixed | `56daa92a`, `3a3606c0` (Strapi; `served-operations.json` regenerated): the released export requires the detail, risks and control-implementation reads it discloses. Web: `9f552db6`, `6f69fe4f`: the `released-assessment:export` capability anchors all three reads, so the button never shows where Strapi refuses. |
| BE2-02 | info | fixed | `3df9a409`: each Requestor-reachable export refuses a birthright that lacks its list read, and counts the read through either path. Test-only; the code already held. |
| BE2-03 | info | fixed | `a20c2f72`: the authorisation matrix's copies of the refused sets equal the policy's. Test-only. |
| BE2-04 | info | fixed | `2572d3a5`: effective access's comment says it is the grant-level decision and can be wider than a route's second-read checks. Source comment only; the Keycloak-named test is untouched (pilot ruling). |
| BE2-05 | info | fixed | `2faee703`: the refusal set's comment counts Phase 19's 14 export operations. |
| BE2-06 | info | fixed | `be5add66`, `7f853950`: the human-only refusal words an export by `HUMAN_ONLY_EXPORT_OPERATIONS`, so a non-export member of the service-identity refusal set (Phases 17 and 19.1) keeps its own wording. |
| BE2-07 | info | deferred: Phase 22 | `function.reports.reports` is empty after 19-09's move but still granted to the agent. Not a hole (navigation is not authorisation). Phase 22 withdraws the agent's explicit grants (D-09) (pilot ruling; `1e0dff69`). |
| BE2-08 | warning (raised from info) | fixed | `c3769ebb`, `cad035e9`: re-seeding a database seeded with `bdd0f698`'s catalogue leaves one FunctionAPI row per catalogued URL, held by its catalogued Function, so no stale grant remains on the two moved URLs (`catalogue-reseed.integration.test.ts`). |
| BE2-09 | info | skipped | The report export reads its period from the body, not the URL query string, and the contract says so (pilot ruling). |
| BE2-10 | info | fixed | `c3cb9d35`: the four export 403 descriptions say "lacks either", and the information-systems and information-assets exports publish the filters the server parses. Contract text only, no behaviour change, recorded as a dated erratum in the exports record (pilot ruling). The regenerated `schema.d.ts` landed with `71c2fd53`. |
| BE2-11 | info | fixed | `de61cd69`: T-19-33's source check is a persisted test: no assessment or export file outside the released-read module compares a requestor with the viewer. |
| BE3-01 | critical | fixed | `853f4cba`, `76fa3c54`: the XLSX guard reads the sheet the reader actually reads (resolved through `workbook.xml` and its rels) and bounds every row and cell reference; the reviewer's three bombs (an empty high row, a value-less far cell, a first sheet outside `xl/worksheets/`) no longer crash the process (exit 134 before; refused under 32 MiB after). Refined under the pilot's ruling, so a real workbook with formatted empty rows past row 5,001 or styled empty cells past column 1,024 is not refused (CSV-03): `676c0c5a`, `4a785563`: one linear pass keeps only the valued cells and their rows and drops `<dimension>` before the library reads, and the 1,024-column and 5,000-row caps count valued cells. Value-less bombs now read harmlessly (about 2.2 MB of heap growth); valued bombs are still refused with the existing reasons (under 250 KB each); the rewrite equals the library's own read on valued workbooks; the import tests pass under a 256 MiB heap. No contract change. **Correction (stage B, 2026-10-17):** the "one linear pass" claim did not hold. The pass's tag patterns (`SHEET_ELEMENT`, the `<sheetData` opener and the `<dimension>` remover) rescanned to the end of the sheet for every unterminated tag, so the pass was quadratic (`19-SECURITY.md` T-19-06). It is now linear: `08e2e72d` (RED), `d12f1fa2` (GREEN). One `indexOf` scan reads each tag to its `>` once and refuses `IMPORT_FILE_TYPE` at an unterminated tag or an attribute run over 8,192 characters. The workbook and rels scans, which had the same pattern, were fixed in the same change. |
| BE3-02 | warning | fixed | `e013c6ef`, `097bf356`: an unknown header made only of control or bidi characters never becomes `""` in `warnings`, so the preview stays valid. |
| BE3-03 | warning | fixed | `c55d97ad`, `ddcdd6e4`: a `similar` row decided as `update` whose only mapped value is the natural key is counted and logged as unchanged, and keeps the existence re-check. |
| BE3-04 | info | fixed | `a74d7bcb`: the dead `{ mode: "update" }` argument in `convertEnum` is removed. A refactor with no behaviour change, so there is no RED. |
| BE3-05 | info | fixed | Covered by BE3-01's fixtures (`853f4cba`, `676c0c5a`): an empty high row, a value-less far cell, a first sheet outside `xl/worksheets/`, and formatted empty rows and styled cells. |
| BE3-06 | info | fixed | `9fc089d6`, `9f247a5a`: `IMPORT_FILE_TOO_LARGE` reports only the measured size, never the client-declared one. |
| FE4-01 | warning | fixed | `a71807b8`, `c39b3ad4`: the report reads whether AI assisted for either actor, so the My route's paper discloses an AI draft. R1 part 4 then put the approved paper-neutral notice on every printed report: `a4dcd2e0`, `c8742704`. The on-screen released view keeps §10.1 and IN-302, and a test pins it. |
| FE4-02 | warning | fixed | `371f7636`, `0988b5cb`: an analyst's released read of an unreleased assessment is the in-shell not-found, decided before the release facts, with no false contract-mismatch log. |
| FE4-03 | warning | fixed | `9da5eeba`, `eaabea54`: the export and import refusals that take focus are announced once, not also as live regions (§4.1.3). `exports-and-imports.spec.ts` finds the S2 refusal by `[data-slot="alert"]`. |
| FE4-04 | warning | fixed | `145e70a0`, `8bbff743`: `Select all`, `Reset to visible` and each `Try again` hand focus to a remaining control. |
| FE4-05 | warning | fixed | `901d921a`, `b825ca4c`: each import summary figure above zero selects its state's rows (§5.5, §9); a zero figure is plain. |
| FE4-06 | warning | fixed | R1 part 1 approved the strings (`6f4f99b0`); row 10's fixed-table form: `af0bbb25`, `44512428`. The copy guard: `dee88182` fails on any export, report or import literal outside an allow-list drawn from the contract. It caught 21 import-flow strings, which the pilot ruled on in R2 (`0e9190fd`); the three rewordings: `a4e8bdb6`, `a3cc6eab` (`awaitingThePilot` is empty and pinned, and the guard refuses the three old strings; `administration-workflow.spec.ts` names `… columns in the file`). |
| FE4-07 | info | fixed | Item (a). `88ffc78d`, `6892ab69`: the unreachable too-large form is gone (the size is required) and a count-free row limit is a warning without `Try again`. R1 part 2 approved every remaining fallback, including the `IMPORT_DELIMITER` rewrite: `f3518bfe`, `116de5b0`. |
| FE4-08 | info | fixed | `ba358274`, `7efe4fca`: a bulk-decision Undo is dismissed with its review and restores only onto it. |
| FE4-09 | info | fixed | R1 part 3 approved per-view sentences: `f35cc8b8`, `7eaafad5`: S1's 403 names the list, report or risk assessment exported, and only the released assessment's 404 says it is missing. |
| FE4-10 | info | fixed | `c28aa531`, `6a8309df`: the transport strips the file-name rule's invisible characters, written with escapes only. |
| FE4-11 | info | fixed | `f7a57143`, `58ecd63b`: `confirmImport` throws no message it drops, and the dead unavailable-file string is gone. |
| FE4-12 | info | fixed | Reproduced with the app's own `next/dynamic`. `c0cffcd6`, `d0857060`: a failed load of the dialog's code stays with the button and shows S1's failed-file row with `Try again` in a danger toast (the §7 exception, approved in R1 part 5). |
| FE4-13 | info | fixed | `71c2fd53`: the design direction places the import row states, `Matched by similar name` among them, in the import-only row mapping. |
| FE4-14 | info | skipped | The reversed header wrapper (`md:flex-row-reverse`) is the pre-existing pattern for Create and Import that 19-15 kept unchanged ("Header action order"); DOM order puts Export last, as §1 asks. Not a regression. |
| FE4-15 | info | fixed | `e59a44c0`, `5a0116c2`: the dialog's failed file is `EXPORT_FAILED`, S1's one source. |
| FE4-16 | info | fixed | R1 part 4: every printed report, on both routes, carries `AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before it was released.` (`a4dcd2e0`, `c8742704`). |

## Execution items

- **(a) 19-02's fallback copy.** Lane 4 found nine fallbacks, none in 19-UI-SPEC. Two were removed (FE4-07: the unreachable too-large form; a count-free row limit's impossible `Try again`). The rest, including a rewritten `IMPORT_DELIMITER` fallback that is true for any separator, were proposed as R1 part 2 and approved (`6f4f99b0`), then built (`f3518bfe`, `116de5b0`). R1 also records in S2 the `IMPORT_CSV_MALFORMED` copy already approved in the import record.
- **(b) The AI notice on an analyst's own released assessment.** Not a defect on screen: the released view shows no notice to an analyst reading their own assessment by Phase 12 IN-302's ruling, unchanged by Phase 19. It was a defect on paper (FE4-01): the analyst's export file disclosed the AI draft and the printed report did not. Fixed, and R1 part 4 makes every printed report carry the paper-neutral notice.
- **(c) The stale Phase 7 catalogue note.** `9885790e`: `designNotes[7]` now says the report export, deferred there, is served by Phase 19 (note 14), and `designNotes[8]`'s "Risk export … deferred" clause, stale the same way, now defers only the Risk close intent. Both copies edited in place, byte-identical, indices unchanged.
- **(d) 19-15's base lookup.** `e7fb0d57`: the plan's `BASE=$(grep … | cut -d= -f2 | head -n 1)` takes one line.

## Regression gate

Run after every fix (code at `a3cc6eab`), on Node 24.19.0, with Keycloak off (`CSRM_AUTH_OIDC_ENABLED=false`, `CSRM_DEV_IDENTITY=true`, both Strapi Keycloak flags false). The suites ran one at a time: Strapi, then the web suite on its own (pilot rule), then Playwright.

| Check | Result |
|-------|--------|
| `pnpm --dir apps/csrm api:check` | clean: `schema.d.ts` regenerates identical to the committed one (it changed in BE2-10's `71c2fd53` and BE1-02's `6daf7443`) |
| `pnpm --dir apps/csrm typecheck` | clean |
| `pnpm --dir apps/csrm lint` | clean |
| `pnpm --dir apps/backend test` (at `0e9190fd`; the two later commits, `a4e8bdb6` and `a3cc6eab`, touch only the web) | 2,293 passed, 0 failed, 1 skipped of 2,294, 34.6 min (19-15: 2,245 passed, 1 skipped) |
| `pnpm --dir apps/csrm test`, alone | 6,433 passed, 0 failed (245 files), 61 s (19-15: 6,359). No file failed. |
| `pnpm --dir apps/csrm test:e2e` (full, desktop 1440 and mobile 375, `performance.spec.ts` included) | 268 passed, 0 failed, 0 flaky (268), 34.6 min |
| Route budgets (desktop delivered JS, full run) | `/app/risks/{documentId}` 298,576 (1,424 bytes of headroom; 298,267 at 19-15, +309); `/app/requests/{documentId}` 297,841 (2,159 bytes; 298,436 at 19-15, −595); every route within its budget (`performance.spec.ts` passed at both widths) |
| `git status --short` after the runs | only ` M .planning/workstreams/csrm/.verification-ledger.json` (left uncommitted, brief §2) |

The web fixer saw one or two web unit files fail, varying by run, while the Strapi suite ran alongside them (one was `src/features/risk-curation/proposed-risk-card.test.tsx`, a focus assertion that passes alone). Under the pilot's rule the web suite then ran on its own and no file failed, so nothing was retried and there is no defect to record from this gate. The observation is kept here for stage B: a focus assertion that depends on machine load is a timing assumption worth hardening if it recurs.
