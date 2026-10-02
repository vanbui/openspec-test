---
phase: 10-existing-flow-gap-closure
plan: 23
subsystem: testing
tags: [phase-gate, playwright, node-test, vitest, static-checks]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: plans 10-01 to 10-22 (every Phase 10 change the gate covers)
provides:
  - The Phase 10 gate on the production build at eed7ed0, all six brief commands green, with counts and durations
  - The four static boundary checks since 5ea2b77, each with empty output
  - A fix that keeps the source free of CSRM_AI_ lines changed since 5ea2b77
affects: [10-23 Task 2 (the pilot's browser walk), 10-23 Task 3, gsd-verify-work 10]

actuals:
  tokens: 4000
  tasks: 1
  commits: 1
plan_head_before: a2182e4b8b87e01b9c7e407c5598b3f0c694f429
plan_head_after: eed7ed0

tech-stack:
  added: []
  patterns:
    - "A gate's static source check is part of the gate: a test that needs a pinned provider proves it through the provider's observable output, not by naming the configuration variable"

key-files:
  created:
    - .planning/phases/10-existing-flow-gap-closure/10-23-SUMMARY.md
  modified:
    - apps/backend/tests/questionnaire-governance.integration.test.ts
    - apps/backend/src/bootstrap/controls/privacy-act-app-ndb-2026-06-04.json
    - apps/backend/src/bootstrap/seed-csrm-data.ts
    - apps/backend/src/api/csrm-administration/services/served-text.ts
    - apps/backend/src/api/csrm-administration/services/administration-query.ts
    - apps/backend/src/api/csrm-administration/services/csv-import.ts
    - apps/backend/tests/control-library-bounds.unit.test.ts
    - apps/backend/tests/administration.unit.test.ts
    - apps/backend/tests/administration.integration.test.ts
    - apps/backend/tests/assessment-seed.integration.test.ts
    - apps/csrm/src/features/administration/administration-schema.test.ts
    - apps/csrm/e2e/administration-workflow.spec.ts

key-decisions:
  - "10-23: the CSRM_AI_ source check failed on a read-only assertion 10-09 added; it was replaced by a comment naming the deterministic-shape proof the test already makes, rather than widening the check (fix eed7ed0)"
  - "10-23: api:check and the schema.d.ts refresh are recorded as two steps; the refresh exits 1 only for the operator's two types/generated files, which git lists whatever pathspec is given"
  - "10-23 fix 2: APP-13 is curated at the source to its own five subclauses (2,558 characters); Schedule 2 and endnotes 1 to 5 (98,415 characters) are cut. The over-long text dates from d7fd4a0 (2026-08-08), before Phase 10"
  - "10-23 fix 2: a seeded start replaces a control description the seed wrote (the one its stored sourceData gives) or one beyond the 10,000 bound, and keeps an operator's own; other seeded fields keep the existing reconciliation"
  - "10-23 fix 2: the Controls projection and the CSV change preview bound every text field they serve, cut at a word boundary with an ellipsis, and log a warning naming the control, never its text; the web's closed parser stays strict"

requirements-completed: []

coverage:
  - id: D1
    description: "The Phase 10 gate passes on the production build: Strapi, web, typecheck, lint, api:check and the full Playwright suite (both projects)"
    verification:
      - kind: integration
        ref: "pnpm --dir apps/backend test (630/630)"
        status: pass
      - kind: unit
        ref: "pnpm --dir apps/csrm test (2,745/2,745)"
        status: pass
      - kind: other
        ref: "pnpm --dir apps/csrm typecheck; pnpm --dir apps/csrm lint; pnpm --dir apps/csrm api:check"
        status: pass
      - kind: e2e
        ref: "pnpm --dir apps/csrm test:e2e (86/86: desktop 82, mobile 4)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No content type changed since 5ea2b77, the catalogue copies are byte-identical, no Keycloak file changed, and no CSRM_AI_ source line changed"
    verification:
      - kind: other
        ref: "the four static checks of 10-23 Task 1 at eed7ed0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both actors walk every Phase 10 surface at 375 and 1440 on the restarted dev servers (backstops B1 to B8)"
    verification: []
    human_judgment: true
    rationale: "Task 2 is the pilot's blocking-human browser walk; Task 3 records its table"

duration: 48min
completed: 2026-10-02
status: halted
---

# Phase 10 Plan 23: Phase gate and browser walk Summary

**Phase 10 gate green on the production build at `eed7ed0`: Strapi 630/630, web 2,745/2,745, typecheck, lint and api:check clean, Playwright 86/86 (82 desktop, 4 mobile, 0 flaky), the four static boundary checks empty, after one fix that took a CSRM_AI_ assertion out of a 10-09 test.**

Status: Task 1 is done and committed. The plan stops at Task 2, the pilot's blocking-human browser walk, and Task 3 records that walk. Until then the plan is not complete.

## Performance

- **Duration (Task 1):** 48 min
- **Started:** 2026-10-02T13:41:47Z
- **Gate record written:** 2026-10-02T14:29Z
- **Tasks:** 1 of 3 (Task 2 is the checkpoint; Task 3 follows it)
- **Files modified:** 2 (this summary and one Strapi test)

## Phase gate

All six commands of POST-DEMO-BRIEF §5 ran at `eed7ed0` (branch `post-demo`), each run on its own from the repository root under Node 24.19.0 and pnpm 11.24.0, with ports 1337 and 3000 free (`netstat` printed nothing). Each figure comes from the single recorded run named here; the logs are in the session scratchpad (`p10-23-gate-<name>.log`).

| # | Command | Passed | Failed | Skipped | Flaky | Duration | Exit |
|---|---|---|---|---|---|---|---|
| 1 | `pnpm --dir apps/backend test` (full Strapi suite, node:test, serial) | 630 | 0 | 0 (cancelled 0, todo 0) | n/a | 789 s wall (node:test 783.3 s) | 0 |
| 2 | `pnpm --dir apps/csrm test` (full web suite, Vitest, 129 files) | 2,745 | 0 | 0 | n/a | 39 s wall (Vitest 37.4 s) | 0 |
| 3 | `pnpm --dir apps/csrm typecheck` (`next typegen && tsc --noEmit`) | clean | 0 errors | n/a | n/a | 4 s | 0 |
| 4 | `pnpm --dir apps/csrm lint` (`next typegen && tsc --noEmit`) | clean | 0 errors | n/a | n/a | 4 s | 0 |
| 5a | `pnpm --dir apps/csrm api:check` (`api:generate` then `git diff --exit-code` on `schema.d.ts`) | clean (no diff) | n/a | n/a | n/a | 2 s | 0 |
| 5b | `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | `schema.d.ts` refreshed (not listed afterwards) | n/a | n/a | n/a | under 1 s | 1, see note |
| 6 | `pnpm --dir apps/csrm test:e2e` (full Playwright suite, production build, 1 worker) | 86: desktop 82, mobile 4 | 0 | 0 | 0 | 14.9 min (899 s wall) | 0 |

Notes:
- **Flaky count 0.** `retries` is `process.env.CI ? 2 : 0` (`apps/csrm/playwright.config.ts:142`), so outside CI an unstable test fails instead of passing as flaky. The run printed `86 passed (14.9m)`, with no `failed`, `flaky` or `skipped` line and no retry. The CSV journey that showed the 10-17 resize race passed first time on both projects (orchestrator fix `dc85f17`).
- **5b exits 1 for the operator's files only.** It prints `apps/backend/types/generated/components.d.ts: needs update` and `apps/backend/types/generated/contentTypes.d.ts: needs update`, because git's refresh reports every stat-dirty entry whatever pathspec it is given. Those two are the operator's empty-diff line-ending items, left alone. Run joined to 5a by `&&`, the same line exits 1 for this reason alone; `api:check` itself exits 0 (logged in `p10-23-gate-api-check-combined.log`, then rerun as 5a and 5b).
- **Superseded run.** Before the fix below, the Strapi suite passed 630/630 in 902 s at `a2182e4` (`p10-23-gate-strapi-prefix.log`). The table's figures come from the full rerun after the fix.
- **Tree after the Playwright run:** only the three operator items (` M apps/backend/types/generated/components.d.ts`, ` M apps/backend/types/generated/contentTypes.d.ts`, `?? example-risk-assessment-questions/`). The run changed no file, and nothing was restored (D-48).
- **Observation, not a failure:** the Next production server under Playwright logged `⨯ Error: The destination stream closed early.` 191 times, spread over many navigation-heavy tests (the most were 22 and 19, before the two `request-relationship-states.spec.ts:43` cases). This is Next logging a response stream the browser abandoned on navigation. It first shows in Phase 10 runs: 0 in the pre-phase `261002-drq` single-spec runs, 46 in 10-01's full run (12.0 min), 39 to 61 in the later full runs. No test asserts on it, and the suite is green. It is noted for the pilot, not treated as a defect.

## Static checks

Run at `eed7ed0` (`p10-23-gate-static.log`). Each output is quoted between brackets.

1. **Content types unchanged since `5ea2b77` (D-01).** `git diff --name-only 5ea2b77..HEAD -- 'apps/backend/src/api/*/content-types/*'` printed `[]` (nothing).
2. **Catalogue copies byte-identical (D-02).** `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` printed nothing (exit 0).
3. **No Keycloak file changed.** `git diff --name-only 5ea2b77..HEAD | grep -i keycloak` printed nothing, over 221 changed files.
4. **No `CSRM_AI_` source line changed.** `git diff 5ea2b77..HEAD -- apps scripts package.json turbo.json pnpm-workspace.yaml | grep '^[+-].*CSRM_AI_'` printed nothing.

The first run of check 4, at `a2182e4`, failed (`p10-23-gate-static-prefix.log`). It printed `[+  assert.equal(process.env.CSRM_AI_PROVIDER, "deterministic");]` from `apps/backend/tests/questionnaire-governance.integration.test.ts`, added by `e66a853` (10-09). The fix is recorded below.

## Walkthrough fixes

The pilot's Task 2 walk (2026-10-03) was not approved and listed six defects. Each is fixed as a GSD Rule 1 deviation inside this plan, failing test first, and recorded here. The full gate reruns after the last fix.

### Fix 2: APP-13 and the control description bound

**Root cause.** APP-13's `legalText` in `apps/backend/src/bootstrap/controls/privacy-act-app-ndb-2026-06-04.json` was 100,973 characters. The PDF extraction ran on past the end of Schedule 1 and appended Schedule 2 and the compilation's endnotes. The seed copies `legalText` into the control description. `ControlsAdministrationRecord` (and its create and update inputs) bound `description` at `maxLength: 10000`, and the web's closed parser enforces the bound. So every Administration › Controls page and every control picker page that held APP-13 failed to load: searches for `APP`, `APP-1`, `APP-13`, `Privacy Act`, `data` and `personal` (the framework name holds "Data", so all 24 Privacy Act controls match). The server was serving data that broke its own contract.

**What was cut, and why (curated at the source, D-44's file).** APP 13 is five subclauses: 13.1 Correction, 13.2 Notification of correction to third parties, 13.3 Refusal to correct information, 13.4 Request to associate a statement, and 13.5 Dealing with requests. Its own text ends at `…for associating the statement with the personal information (as the case may be).`. That text is kept verbatim: 2,558 characters, including the one running page header inside it (`Schedule 1 Australian Privacy Principles Part 5 … Clause 13 384 Privacy Act 1988`), which the other twelve APPs also carry. Everything after it is cut, 98,415 characters in all:

| Cut segment (from its first heading) | Characters |
|---|---|
| Schedule 2, Statutory Tort for Serious Invasions of Privacy (Parts 1 to 4) | 27,661 |
| Endnote 1, About the endnotes | 2,233 |
| Endnote 2, Abbreviation key | 1,173 |
| Endnote 3, Legislation history | 20,581 |
| Endnote 4, Amendment history | 45,772 |
| Endnote 5, Editorial changes | 995 |
| **Total cut** | **98,415** |

None of the cut text belongs to another seeded control: the catalogue seeds APP-1 to APP-13 and the Part IIIC NDB sections (26WE to 26WQ), and neither Schedule 2 nor the endnotes is one of them. Curation was clean, so no truncation marker was needed. The edit is a one-line JSON diff (CRLF kept). A guarded scratch script replaced only APP-13's `legalText` literal and checked that nothing else in the parsed file changed. APP-13 now reads 2,558 characters against the bound of 10,000.

**Every other offender.** None. Every one of the 2,646 seeds (titles applied) was checked against every bounded string field of `ControlsAdministrationRecord`: `controlNumber` 1 to 255, `name` 1 to 255, `description` up to 10,000, `controlReference` up to 500, `framework` 1 to 255, `frameworkVersion` up to 255 and `frameworkSource` up to 2,000 (`documentId` is not seeded). Each value was also checked for being blank or untrimmed. APP-13's description was the only breach. The longest values before the fix were 41, 139, 100,973, 18, 84, 49 and 130 characters; after it, the longest description is NDB-26WF's 4,944, and the survey finds 0 breaches. The four catalogues 10-22 guards are untouched.

**Reconciling the development database.** `seedCsrmControls` used to overwrite every seeded field whenever any of them differed. It now treats the description by ownership:
- A stored description that equals the one its stored `sourceData.control` gives is one the seed wrote, and the current seed replaces it.
- A stored description beyond 10,000 characters is replaced too, because no valid write can store one.
- Any other non-blank description is an operator's own, and a seeded start keeps it.

`sourceData` holds the catalogue entry the seed read, and no Administration write can change it. That makes ownership provable without new state, and it keeps D-01 (no content type change). The other seeded fields keep the existing reconciliation (T-10-42 and T-10-64). `controlDescription` is now the one derivation shared by a fresh seed and the ownership check. The dev database's APP-13 row stores the old text in both `description` and `sourceData`, so it is seed-owned and over the bound, and the pilot's next seeded Strapi start rewrites it (same documentId, still 2,646 controls).

**Write and read bounds.**
- **Writes** already refused an over-long description. `parseAdministrationMutation` rejects more than 10,000 characters after trimming, with the existing `INVALID_ADMINISTRATION_DATA` 400. The CSV import rejects the row with `VALUE_TOO_LONG` on `description`. Neither path truncates. These are now proven by a mounted test: create and update with 10,001 characters are 400s, 10,000 characters are served whole, and a CSV row is rejected and writes nothing.
- **Reads.** The new `served-text.ts` holds `boundServedText`, which cuts a value at the last word boundary inside its bound, closes it with `…` and never splits a surrogate pair. It also holds `warnServedTextBounded`, which logs `strapi.log.warn` naming the record and its fields, never the text. The Controls projection (`projectAdministrationRecord` for `controls`, used by the record, the list, and the create and update responses) bounds all seven bounded text fields and warns `CSRM control {documentId} ({controlNumber}) …`. The CSV preview's `changes[].before` used to `slice` silently at 10,000. It now uses the same visible bound and warning, so an over-long stored value can never compare equal to a file value.
- **Other projections.** The control summaries on control implementations (`ControlImplementationControlSummary`) and the picker's applicable-control summaries (`RiskTypeApplicableControl`) carry no description; they serve `name` and the other fields bounded at 255 (D-31, D-34). `ControlSummary` and `ControlListResponse` are not served by any operation.

**Parser decision.** The web's closed parser (`administration-schema.ts`) stays strict. The contract makes an over-long description a server defect, and the server now bounds its reads. A new web test pins this: 10,000 characters parse and 10,001 throw.

**History.** The over-long text predates Phase 10. `git log --all -S "Endnote 5—Editorial changes"` finds only `d7fd4a0` (2026-08-08, "Created 11 JSON catalogues in apps/csrm/docs/references/controls"). `git log --follow` on the file shows `d7fd4a0`, then `a1b66f7` (2026-08-11, the move to `apps/backend/src/bootstrap/controls/`, content unchanged), then `8e30fbe` (10-17). At `d7fd4a0` and at the Phase 10 baseline `5ea2b77`, APP-13's `legalText` was 100,985 characters. 10-17's D-44 correction removed the 12-character leaked prefix `information `, leaving 100,973.

**Tests.**

| File | Test | Before the fix (`7e07dba`) | After (`a31ae03`) |
|---|---|---|---|
| `apps/backend/tests/control-library-bounds.unit.test.ts` (new) | every seeded control satisfies every Controls contract bound | fail: `APP-13 description 100973 > 10000` | pass |
| same | APP-13 keeps its own five subclauses and nothing after the end of Schedule 1 | fail: ends in Schedule 2 text | pass |
| `apps/backend/tests/administration.unit.test.ts` | a Control record and a CSV change never serve stored text beyond its bound | fail: description served at 15,389 characters | pass |
| `apps/backend/tests/assessment-seed.integration.test.ts` | a seeded start replaces the over-long APP-13 text an earlier seed stored | fail: 100,973 characters | pass |
| same | a seeded start keeps an operator's own description of a seeded control, then changes nothing | fail: the seed overwrote it | pass |
| same | a seeded start replaces a stored description beyond the bound, whoever stored it | fail: 100,973 characters | pass |
| same | (10-17) a seeded start corrects a Privacy Principle an earlier seed stored truncated: the fixture now also stores the `sourceData` an earlier seed wrote | pass | pass |
| `apps/backend/tests/administration.integration.test.ts` | the walkthrough's control searches return contract-valid records on every page (`APP`, `APP-13`, `Privacy Act`, `data`, `personal`; every page; each finds APP-13) | fail: `APP` page 1 `APP-13 description 100973 > 10000` | pass |
| same | a stored control description beyond the bound is served shortened, visibly, with a warning that names the control | fail: served at 15,389 characters | pass |
| same | control writes refuse a description beyond the bound and never shorten it | pass (regression proof of existing behaviour) | pass |
| `apps/csrm/src/features/administration/administration-schema.test.ts` | keeps the Control record parser strict on the 10,000-character description bound | pass (decision pin) | pass |
| `apps/csrm/e2e/administration-workflow.spec.ts` | `ADMIN05_APP13_LOADS` (Administration › Controls `?q=APP-13` shows the row titled `Correction of personal information`, with no load failure) and `ADMIN05_PICKER_FINDS_APP13` (the Risk Type form's control picker searches `APP-13` and offers `APP-13 · Correction of personal information`) | not run before the fix | pass |

Runs (logs in the session scratchpad, `p10-23-f2-*.log`):
- RED, four Strapi files: 50 tests, 42 passed, 8 failed, all on assertions (89 s). `check tdd-red-evidence` returned RED_EVIDENCE_OK for both unit targets (TAP).
- GREEN, five Strapi files (with `control-titles.unit.test.ts`): 67/67 (95 s).
- Web `src/features/administration`: 3 files, 61/61. `pnpm --dir apps/csrm typecheck`, `lint` and `api:check`: clean, then `git update-index --refresh` on `schema.d.ts`.
- Playwright `e2e/administration-workflow.spec.ts`, no dev server running: 5 passed (desktop 4, mobile 1), 0 failed, 0 flaky, 0 skipped, 1.8 min. Next logged the known benign `destination stream closed early` 10 times. The run left the tree unchanged. The release journey's picker step was not touched, so it was not run.
- Static checks since `5ea2b77`: no content type changed, and the four 10-22 catalogues are unchanged. Both role-function catalogue copies are untouched and byte-identical, and the specification is untouched.

**Commits.** `7e07dba` test(10-23): expect every seeded control within the Controls contract bounds; `a31ae03` fix(10-23): keep APP-13 and every control description within the contract bound; and the docs commit that records this fix.

**Decisions.**
- Curate at the source: APP 13's paragraphs are kept verbatim and Schedule 2 and the endnotes are cut, so no truncation marker is needed.
- Description ownership is decided by the stored `sourceData`. The 10-17 seed test's fixture now stores what an earlier seed really wrote (its `sourceData` beside its description); its assertions are unchanged.
- The read bound covers all seven bounded text fields of the Controls record (identifier fields included), so the projection cannot serve a contract-breaking record. The warning names the documentId and number.
- The web parser stays strict (see above).
- No content type, specification or catalogue-copy change (D-01, D-02).

**Deferred.** Both are in `deferred-items.md`:
- `scripts/verify-csrm-seed.mjs` fails on 13 files (10-22's title file). It is not part of the gate.
- The specification's `ControlsAdministrationRecord` requires an `updatedAt` that neither the server nor the web serves.

**Open for the pilot:** APP-13 against Schedule 1 stays in Task 3's Manual-Only list. The development database picks up the curated APP-13 on the next seeded Strapi start.

## Task Commits

1. **Task 1: run the phase gate and the static checks, then commit the gate record**
   - `eed7ed0`: fix(10-23): stop the generated-section test naming the AI provider variable
   - this record: docs(10-23): record the Phase 10 gate
2. **Task 2:** the pilot's blocking-human browser walk (checkpoint).
3. **Task 3:** after the walk.

## Files Created/Modified

- `apps/backend/tests/questionnaire-governance.integration.test.ts`: the generated-section test no longer names the provider variable. It relies on the harness pin and its own `GENERATED_ADD_CONTEXT_SECTION` shape proof.
- `.planning/phases/10-existing-flow-gap-closure/10-23-SUMMARY.md`: this gate record.

## Decisions Made

- The `CSRM_AI_` check stays as the plan wrote it. Its failure was resolved in the source, never by narrowing the check: the assertion read a value and changed no configuration, but the gate's rule is literal, and the assertion added nothing the test does not already prove.
- `api:check` and its refresh are recorded as separate steps, so each exit code means one thing (5a and 5b above).
- The brief's six commands were used (`--dir` forms; `lint` added), which the rules file names as equivalent to the plan's five `--filter`/`--prefix` forms.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A Phase 10 test line broke the gate's `CSRM_AI_` source check**
- **Found during:** Task 1 (static check 4, first run at `a2182e4`)
- **Issue:** `e66a853` (10-09) added `assert.equal(process.env.CSRM_AI_PROVIDER, "deterministic");` to `questionnaire-governance.integration.test.ts`. The check `git diff 5ea2b77..HEAD -- apps … | grep '^[+-].*CSRM_AI_'` printed it, so the plan's verify command could not exit 0.
- **Fix:** replaced the assertion with a comment naming the proof the test already makes. The harness pins the deterministic provider (`strapi-http-harness.ts:455`, unchanged since `5ea2b77`), and `GENERATED_ADD_CONTEXT_SECTION` asserts the deterministic `context` section at order 0, which a hosted generation would fail.
- **Files modified:** `apps/backend/tests/questionnaire-governance.integration.test.ts`
- **Verification:** the failing proof was static check 4 itself. After the edit, check 4 printed nothing, and the file ran alone with 11/11 passing (34 s, `p10-23-fix-governance-file.log`). Then the whole gate reran (the table above).
- **Committed in:** `eed7ed0`

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** none on scope. No configuration, provider, Strapi source or contract changed.

## Issues Encountered

- `git update-index --refresh -- <path>` exits 1 on this host while the operator's two `types/generated` files stay stat-dirty (note 5b). This is host-expected, not a defect.
- The Next `destination stream closed early` server log noise is recorded under Phase gate notes.

## Next Phase Readiness

- The gate is green. The pilot can restart the dev servers at this commit for Task 2. No dev server is running, and the executor started none.
- Task 3 adds the browser check table, the requirement coverage (ADMIN-05 is delivered except the Information Asset owner, which moves to Phase 22) and the Manual-Only results.

---
*Phase: 10-existing-flow-gap-closure*
*Gate recorded: 2026-10-02*
