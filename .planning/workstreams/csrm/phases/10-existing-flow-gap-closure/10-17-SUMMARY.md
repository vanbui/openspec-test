---
phase: 10-existing-flow-gap-closure
plan: 17
subsystem: ui, api, database
tags: [strapi, seed, control-label, administration, csv-import, copy, d-36, d-38, d-44, d-29]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-15 controlLabel and controlTitle (control-label.ts); 10-16 the Administration form and workspace with the owner by name and the new systems columns; 10-02 the interface copy guard"
provides:
  - "The thirteen Australian Privacy Principle titles complete and in sentence case, with the nine leaked legalText fragments removed (D-44), applied by the existing control seed reconciliation"
  - "User-facing descriptions for the three seeded Risk Types (UI-SPEC §16.3), applied by the existing Risk Type reconciliation"
  - "The control label rule on every Administration surface: the controls list Name column (title part or Not provided), the mobile card, the control edit title and breadcrumb, and the Risk Type form's options and selections (Control not found, never an id)"
  - "searchApplicableControlsAction over listAdministrationControls: one page of 25 matched on number, name and framework (D-29)"
  - "applicable-controls.ts: the zod-free option builder (first 100 by number plus each saved selection beyond them, by controlLabel)"
  - "keyLabel (Control number for Controls, else Name) in the web CSV parser, mirrored in Strapi's csv-import.ts, and the UI-SPEC §17.1 Administration and CSV copy in both"
affects: [10-20, 10-21, 10-22, 10-23, phase-22-administration]

actuals:
  tokens: 88327
  tasks: 3
  commits: 6
plan_head_before: 5c7c1166756b066f2e5ddae389d0f00294b47659
plan_head_after: 37e9084f8250332ed58f50733fee586f4d1ca968

tech-stack:
  added: []
  patterns:
    - "A catalogue correction is a one-off script over the parsed JSON that refuses to run unless the round-trip is byte-identical (CRLF preserved) and each fix matches the truncation it repairs"
    - "A Risk Type picker's first options are built server-side by one zod-free helper that also adds each saved selection beyond the first page, so the form labels every selection without a second read"
    - "A CSV message names the matching column through keyLabel, the same words in the web parser and in Strapi"

key-files:
  created:
    - apps/csrm/src/features/administration/applicable-controls.ts
  modified:
    - apps/backend/src/bootstrap/controls/privacy-act-app-ndb-2026-06-04.json
    - apps/backend/src/bootstrap/seed-assessment-workflow.ts
    - apps/backend/src/api/csrm-administration/services/csv-import.ts
    - apps/backend/tests/assessment-seed.integration.test.ts
    - apps/backend/tests/administration.integration.test.ts
    - apps/backend/tests/administration.unit.test.ts
    - apps/csrm/src/features/administration/administration-actions.ts
    - apps/csrm/src/features/administration/administration-form.tsx
    - apps/csrm/src/features/administration/administration-workspace.tsx
    - apps/csrm/src/features/administration/csv-client-parser.ts
    - apps/csrm/src/features/administration/csv-import-flow.tsx
    - apps/csrm/app/(app)/app/admin/[collection]/new/page.tsx
    - apps/csrm/app/(app)/app/admin/[collection]/[documentId]/page.tsx
    - apps/csrm/src/features/administration/administration-workflow.test.tsx
    - apps/csrm/src/features/administration/administration-schema.test.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/administration-workflow.spec.ts

key-decisions:
  - "10-17: the seed corrections are proven both ways: a fresh seeded database stores the corrected APP names and descriptions, and a seeded start rewrites an APP-11 row an earlier seed stored truncated (same documentId, 2,646 controls); the Risk Type rerun test already proved the description repair"
  - "10-17: the Risk Type form's option labels come from one zod-free helper (applicable-controls.ts) shared by both pages and the search action, rather than inline in each page"
  - "10-17: a saved selection whose control the library no longer holds gets no option and reads Control not found; when the picker list read fails the pages offer no options (the numbered Reusable Control fallback is gone)"
  - "10-17: the control edit page's breadcrumb uses controlLabel too, so the number shows once there as well (D-36 'everywhere a control is named')"
  - "10-17: the Risk Type form keeps its existing local filter over the first 100 options before searching the server; the Search Controls button always searches the server"
  - "10-17: Strapi wraps a CSV parse error in 'The CSV file could not be validated.' before responding, so the new 'This file can’t be imported:' prefix is proven at the parser (unit) and the repeated-key message through a mounted preview"

patterns-established:
  - "applicableControlOptions(controls, selectedIds): the Risk Type form's first options"
  - "keyLabel(kind) / keyLabel(contract): the CSV matching column in people's words"

requirements-completed: [ADMIN-05, UX-06]

coverage:
  - id: D1
    description: "The thirteen APP titles read as Schedule 1 titles them, in sentence case, and the nine leaked fragments no longer open their legal text; a seeded start applies them to fresh and to earlier-seeded rows"
    requirement: ADMIN-05
    verification:
      - kind: integration
        ref: "apps/backend/tests/assessment-seed.integration.test.ts#ADMIN-05 the seeded Privacy Principles carry their complete titles and legal text"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-seed.integration.test.ts#ADMIN-05 a seeded start corrects a Privacy Principle an earlier seed stored truncated"
        status: pass
    human_judgment: false
  - id: D2
    description: "The APP titles match Schedule 1 of the Privacy Act 1988 (Cth) word for word"
    requirement: ADMIN-05
    verification: []
    human_judgment: true
    rationale: "VALIDATION Manual-Only: a person checks the thirteen titles against the Act (plan 10-23)"
  - id: D3
    description: "The three seeded Risk Types carry UI-SPEC §16.3's descriptions"
    requirement: ADMIN-05
    verification:
      - kind: integration
        ref: "apps/backend/tests/assessment-seed.integration.test.ts#ADMIN-05 a seeded start gives each Risk Type its user-facing description"
        status: pass
    human_judgment: false
  - id: D4
    description: "The controls list shows each control number once (Name is the title part or Not provided); the mobile card, edit title and breadcrumb use the control label"
    requirement: ADMIN-05
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/administration/administration-workflow.test.tsx#UAT-007 shows each control number once in the controls list, its mobile card and the edit title"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/administration-workflow.spec.ts#ADMIN05_CONTROL_LABELS"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Risk Type form searches controls on the server (one page of 25 by number, name or framework) and labels options and selections by the control label; an unknown selection reads Control not found"
    requirement: ADMIN-05
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/administration/administration-workflow.test.tsx#asks the Administration control list for one bounded page and labels each option"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/administration/administration-workflow.test.tsx#UAT-007 labels each saved applicable control and never shows its id"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/administration/administration-workflow.test.tsx#offers the first 100 controls by number and adds each saved selection beyond them, by its control label"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/administration-workflow.spec.ts#ADMIN05_SELECTED_CONTROL_LABELLED"
        status: pass
    human_judgment: false
  - id: D6
    description: "Administration and CSV copy follows UI-SPEC §17.1 in the web and in Strapi's CSV messages, and the copy guard covers the four Administration files and applicable-controls.ts"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/administration/administration-workflow.test.tsx#UAT-054 explains each Administration form in plain words"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/administration/administration-schema.test.ts#UAT-054 says why a file can’t be imported and names the matching column plainly"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/administration.unit.test.ts#UAT-054 CSV messages say why a file can't be imported and name the matching column plainly"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/administration.integration.test.ts#UAT-054 a mounted CSV preview names a repeated key by its column"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Long control titles in the Controls list and its mobile cards wrap without horizontal page overflow at 375 and 1440"
    verification: []
    human_judgment: true
    rationale: "Backstop truth: recorded for the plan 10-23 browser check (the journey's existing no-page-overflow loop runs on the list, but the long titles of plan 10-22 are not loaded yet)"

duration: 36min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 17: Reference data reads as real content Summary

**The Privacy Principles carry their Schedule 1 titles, Risk Types explain themselves, each control number shows once across Administration with the Risk Type control search on the server, and the Administration and CSV screens (web and Strapi) speak plainly**

## Performance

- **Duration:** 36 min
- **Started:** 2026-10-02T10:01:01Z
- **Completed:** 2026-10-02T10:36:49Z
- **Tasks:** 3 (6 commits, RED then GREEN each)
- **Files modified:** 18 (1 created)

## Accomplishments

- **APP titles (D-36, D-44):** all thirteen titles complete and in sentence case per UI-SPEC §16.3; the nine corrected entries' `legalText` drop the leaked fragment (APP-1 `management of personal information `, APP-3/4/6/11/13 `information `, APP-5/8 `personal information `, APP-9 `government related identifiers `); APP-2, APP-7, APP-10 and APP-12 change case only. The diff is exactly 22 lines (13 titles, 9 legal texts). APP-7's text still opens `Direct marketing 7.1` (a heading, not a leak).
- **Seed proof:** on a fresh database the seeded APP-1, APP-2 and APP-11 names are `APP-n — {title}` and APP-11's description starts `11.1 If an APP entity holds`; a seeded start also rewrites an APP-11 row an earlier seed stored truncated (same documentId, control count stays 2,646), because `seedCsrmControls` updates any row whose seeded fields differ. The Risk Type descriptions are proven on a seeded start, and the existing rerun test already proves their repair.
- **Control label (D-36):** the controls list Name column renders `controlTitle(record) ?? 'Not provided'`; the mobile card link, the control edit page title and its breadcrumb render `controlLabel`.
- **Server-side search (D-29):** `searchApplicableControlsAction` calls `listAdministrationControls(parseAdministrationQuery('controls', { q, page: 1, pageSize: 25 }))` and labels results with `controlLabel` (framework included); an empty or invalid search makes no call. `listControls` is no longer imported by the action.
- **Risk Type form:** the pages build options with `applicableControlOptions` (first 100 by number plus each saved selection beyond them); the form seeds its selection labels from them and shows `Control not found` for an unknown id.
- **Copy (D-38):** every UI-SPEC §17.1 Administration and CSV row; Strapi's messages read `This file can’t be imported: {message}`, `This {key label} appears more than once in the file.` and `More than one existing record has this {key label}.`; the §19.2 row now expects `The final check before import changed the result for 1 row`.

## Task Commits

1. **Task 1 (tracer): APP titles through the seed to the controls list** - `81f7e53` (test, RED), `8e30fbe` (fix, GREEN)
2. **Task 2: Risk Type descriptions and server-side control search** - `5dcf31e` (test, RED), `4145a6c` (fix, GREEN)
3. **Task 3: Administration and CSV copy in web and Strapi, guard, journey** - `66b02da` (test, RED), `37e9084` (fix, GREEN)

**Plan metadata:** recorded in the docs commit that adds this file.

## Tests run

| Run | Result |
| --- | --- |
| RED, Task 1: `assessment-seed.integration.test.js` (TAP) and the web `UAT-007` case | 2 target seed tests and the web case failed on their assertions; `check tdd-red-evidence` RED_EVIDENCE_OK |
| RED, Task 2: seed file (TAP), `administration-workflow.test.tsx` | the Risk Type description test and 3 web cases failed on assertions; RED_EVIDENCE_OK |
| RED, Task 3: `administration.unit.test.js` (TAP), `administration.integration.test.js`, web administration and guard | 1 unit, 1 mounted and 11 web cases failed on assertions; RED_EVIDENCE_OK |
| Task 1 verify | web administration 46/46, typecheck clean, seed file 5/5 |
| Task 2 verify | web administration 54/54, typecheck clean, seed file 6/6; parity, performance and service tests 195/195 |
| Task 3 targeted | web administration + guard 102/102; Strapi administration unit + mounted 30/30 |
| Full Strapi suite (`pnpm --dir apps/backend test`) | 607/607 passed, 0 failed, 0 skipped, 638 s (602 before plus 5) |
| Administration journey, first run (both projects) | 4 passed, 1 failed (desktop CSV journey, see Issues) in 1.5 min |
| Desktop CSV journey alone | 1/1 passed, 51 s |
| Administration journey, second run | 5/5 passed (desktop 4, mobile 1), 1.3 min, tree unchanged |
| Full web suite (`pnpm --dir apps/csrm test`) | 126 files, 2,635/2,635 passed, 27.9 s |
| `api:check`, typecheck, lint (typegen + tsc) | clean; `schema.d.ts` refreshed with no content change |

## Files Created/Modified

- `apps/backend/src/bootstrap/controls/privacy-act-app-ndb-2026-06-04.json` - thirteen APP titles and nine legal texts
- `apps/backend/src/bootstrap/seed-assessment-workflow.ts` - three Risk Type descriptions
- `apps/backend/src/api/csrm-administration/services/csv-import.ts` - keyLabel and the three CSV messages
- `apps/csrm/src/features/administration/applicable-controls.ts` (new) - the Risk Type form's options by controlLabel
- `apps/csrm/src/features/administration/administration-actions.ts` - server-side control search
- `apps/csrm/src/features/administration/administration-form.tsx` - control edit title, selection labels, §17.1 copy
- `apps/csrm/src/features/administration/administration-workspace.tsx` - Name column, mobile card, collection descriptions
- `apps/csrm/src/features/administration/csv-client-parser.ts` - keyLabel and the parser messages
- `apps/csrm/src/features/administration/csv-import-flow.tsx` - CSV guidance, confirm, alert, key column, load failures
- `apps/csrm/app/(app)/app/admin/[collection]/new/page.tsx`, `[documentId]/page.tsx` - options through applicableControlOptions; breadcrumb by label
- Tests: the seed, unit and mounted Strapi files, the web workflow and schema tests, the copy guard and the administration journey

## Decisions Made

- Seed corrections proven on a fresh database and on an earlier-seeded row (control seed) and on a seeded start (Risk Types); see key-decisions.
- One option-builder module serves both pages; the numbered `Reusable Control {n}` fallback is gone in favour of `Control not found`.
- The control edit breadcrumb uses the label, matching the title.
- The Risk Type form keeps its local filter over the first 100 options before a server search; Search Controls always asks the server.
- The `This file can’t be imported:` prefix is proven at Strapi's parser, because the controller wraps parse errors in its own message.
- The downloaded error and result report CSVs keep their machine column header `naturalKey` (file data, not interface copy).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The catalogue's working copy is CRLF**
- **Found during:** Task 1 GREEN
- **Issue:** `core.autocrlf=true` gives the JSON CRLF endings, so a plain JSON round-trip was not byte-identical.
- **Fix:** the one-off correction script (session scratchpad, not committed) normalises to LF, checks the round-trip, applies the fixes with per-entry guards and writes CRLF back; the diff is the 22 intended lines.
- **Files modified:** `privacy-act-app-ndb-2026-06-04.json`
- **Committed in:** `8e30fbe`

**2. [Rule 2 - Missing critical] A shared option builder in a new module**
- **Found during:** Task 2
- **Issue:** both pages and the action needed the same label rule and the saved-selection merge; a `'use server'` file may export only async functions.
- **Fix:** `applicable-controls.ts` (zod-free) holds `ApplicableControlOption`, `applicableControlOptions` and `applicableControlSearchOptions`; the action re-exports the type; the module joins the copy guard.
- **Committed in:** `4145a6c` (tests in `5dcf31e`)

**3. [Rule 3 - Blocking] Strapi CSV message tests outside the plan's file list**
- **Found during:** Task 3
- **Issue:** the parse-error prefix never reaches a response (`parseCsv` rethrows `INVALID_IMPORT_FILE`), and two existing records sharing a normalised name cannot be created through the mounted harness.
- **Fix:** the prefix and the multiple-match message are asserted in `apps/backend/tests/administration.unit.test.ts`; the repeated-key message for Controls and Risk Types through a mounted preview in `administration.integration.test.ts`, as planned.
- **Committed in:** `66b02da`

**4. [Rule 1 - Test fixture] Two RED fixtures corrected before RED was recorded**
- The Risk Type form renders Radix checkboxes for saved selections, so its cases install the shared ResizeObserver stub; the seed's Risk Type description test sits last in its file, because the development-gate test expects no Risk Types before the enabled seed runs. Neither changes an assertion.

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 missing critical, 1 test fixture)
**Impact on plan:** none on scope; every planned behaviour and acceptance criterion holds.

## Issues Encountered

- **Desktop CSV journey, first run:** `expectRegionFollowsOverflow` at 375px in the Risk Type import's viewport loop measured the Guidance table as overflowing just after resizing from 1440, then the region never appeared, and the final snapshot shows the table fitting. The test passed alone (51 s) and in a full second run (5/5). The table and its scroller are unchanged by this plan (only the paragraph above it changed), so this is recorded as a resize-transition race in the existing helper, not fixed here. Logged for the plan 10-23 gate run to watch.
- The harness could not delete one `apps/backend/.tmp/playwright-e2e-*.db` (EPERM) after the single-test rerun; `.tmp` is ignored and the tree stayed clean.

## Known Stubs

None. `Not provided` (untitled control) and `Control not found` (unknown selection) are the specified fallbacks.

## Threat Flags

None. The search action reads one bounded page through the existing Administration grant (T-10-43); the CSV messages name only the column and the problem (T-10-44).

## User Setup Required

None. The development database picks up the APP title and Risk Type description corrections on the orchestrator's next seeded Strapi restart; tests use their own databases.

## Next Phase Readiness

- Plan 10-22 loads titles for the untitled catalogues; the label sites here show them once loaded, and its journey extends `ADMIN05_CONTROL_LABELS` to assert 5.1's name.
- Orchestrator checks for plan 10-23: the thirteen APP titles against Schedule 1 of the Privacy Act, and the long-title backstop at 375 and 1440 in the Controls list and its mobile cards.
- ADMIN-05 stays open for the Information Asset owner (Phase 22); UX-06 continues in later Phase 10 plans.

## Self-Check: PASSED

- Files: `applicable-controls.ts`, the catalogue, the seed, `csv-import.ts`, the workspace, form, actions, CSV flow and parser, both pages and every test file exist.
- Commits: `81f7e53`, `8e30fbe`, `5dcf31e`, `4145a6c`, `66b02da`, `37e9084` are in `git log`.
- Acceptance criteria: APP-11 node check exits 0; the workspace imports `controlTitle` and `controlLabel`; the spec contains `ADMIN05_CONTROL_LABELS` and `ADMIN05_SELECTED_CONTROL_LABELLED`; the seed contains `Risks from services that can be reached from the internet`; the action calls `listAdministrationControls` and does not import `listControls`; the form contains `Control not found`; `csv-import-flow.tsx` contains `We check the file again before anything is written.`; `csv-import.ts` contains `This file can’t be imported:`; neither parser contains `Invalid Administration CSV`; the guard lists the four Administration files.
- No file under `apps/backend/src/api/*/content-types/`, the specification or either role-function catalogue changed (diff from `5c7c116`).

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
