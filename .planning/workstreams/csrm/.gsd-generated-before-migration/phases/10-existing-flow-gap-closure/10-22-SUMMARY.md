---
phase: 10-existing-flow-gap-closure
plan: 22
subsystem: database, api, testing
tags: [strapi, seed, control-library, control-titles, iso-27001, apra, pspf, d-46, d-42, d-29, playwright]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-17 the APP title corrections and the seeded-start reconciliation proof; 10-18 the control picker and searchControlsAction over the Administration control search; 10-21 the last owner of the release journey; 10-15 the D-36 control label rule"
provides:
  - "apps/backend/src/bootstrap/controls/csrm-control-titles.json: 386 CSRM titles (93 Annex A control names, 293 descriptive titles for CPS 230, CPS 234 and the PSPF) beside the vendored catalogues"
  - "readControlLibrary, parseControlTitles and createControlSeeds (exported with ControlCatalogue and ControlSeed): a title applies only where the catalogue gives no label, and the seed refuses a malformed title file naming the file and the control"
  - "Every one of the 2,646 seeded controls carries a title; the existing reconciliation renames a control stored by its number on the next seeded start"
  - "Browser proofs: 5.1 reads Policies for information security, CPS-234-15 and PSPF-001 read by titles, and masking finds 8.11 · Data masking in the mitigation control picker"
affects: [10-23, phase-22-administration]

actuals:
  tokens: 15290
  tasks: 3
  commits: 5
plan_head_before: 3df0742babc536c58a3cde714225e6e30c7263a2
plan_head_after: 575172ed0cc72cfdd8941ff0ad9fd63cf55b6e12

tech-stack:
  added: []
  patterns:
    - "CSRM-authored data that supplements a vendored catalogue lives in its own file beside it, keyed by catalogue file name, so the publisher's file stays byte-identical"
    - "A descriptive title is proved against its source paragraph by an anchor check (a non-generic five-letter stem shared with the paragraph), with generic stems measured per framework"

key-files:
  created:
    - apps/backend/src/bootstrap/controls/csrm-control-titles.json
    - apps/backend/tests/control-titles.unit.test.ts
  modified:
    - apps/backend/src/bootstrap/seed-csrm-data.ts
    - apps/backend/tests/assessment-seed.integration.test.ts
    - apps/backend/tests/administration.integration.test.ts
    - apps/csrm/e2e/administration-workflow.spec.ts
    - apps/csrm/e2e/assessment-release-workflow.spec.ts

key-decisions:
  - "10-22: the Annex A names were cross-checked against the isms.online ISO 27001:2022 Annex A listing; all 93 agree with the plan's forms (5.34 Privacy and protection of PII and 8.1 User endpoint devices included). The listing abbreviates 5.21 to 'ICT', and its 8.18 and 8.27 rows carry markup concatenation, so the plan's forms stand. No name was changed"
  - "10-22: parseControlTitles also requires a non-blank description and a non-blank note per source, alongside the plan's rules; coverage stays a test-time proof, so a later catalogue update cannot stop Strapi from starting"
  - "10-22: the seven Essential Eight requirements in the PSPF (PSPF-099 to PSPF-106) read 'Maturity Level Two: {strategy}', keeping the strategy's framework name searchable without copying the paragraph's opening"
  - "10-22: the unit test also holds descriptive titles to the voice rules (2 to 8 words, at most 80 characters, a capital first letter, no must or shall, not the paragraph's opening) and measures generic stems per framework rather than hard-coding them"

patterns-established:
  - "parseControlTitles(sourceFile, source, catalogues): the validation gate for CSRM titles over vendored catalogues"
  - "readControlLibrary(appRoot): the one reader of the control catalogues and the title file, shared by the seed and the unit test"

requirements-completed: [ADMIN-05]

coverage:
  - id: D1
    description: "Annex A controls carry the standard's 93 control names and no ISO control text, split 37, 8, 14 and 34 by theme"
    requirement: ADMIN-05
    verification:
      - kind: unit
        ref: "apps/backend/tests/control-titles.unit.test.ts#ADMIN-05 D-46 every Annex A control is named, by theme, and none carries ISO text"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-seed.integration.test.ts#ADMIN-05 D-46 a seeded start names an Annex A control and loads no ISO text"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/administration-workflow.spec.ts#ADMIN05_CONTROL_LABELS"
        status: pass
    human_judgment: false
  - id: D2
    description: "No seeded control is untitled: 386 titles cover every control whose catalogue gives no label, and a control stored by its number is renamed on the next seeded start, then left untouched"
    requirement: ADMIN-05
    verification:
      - kind: unit
        ref: "apps/backend/tests/control-titles.unit.test.ts#ADMIN-05 D-46 no seeded control is untitled"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-seed.integration.test.ts#ADMIN-05 D-46 a seeded start leaves no control named by its number alone"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-seed.integration.test.ts#ADMIN-05 D-46 a seeded start titles a control an earlier seed stored by its number, then changes nothing"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/administration-workflow.spec.ts#ADMIN05_CONTROL_TITLES_LOADED"
        status: pass
    human_judgment: false
  - id: D3
    description: "A picker search by a title word finds the control: masking finds 8.11 · Data masking through the Administration control search"
    requirement: ADMIN-05
    verification:
      - kind: unit
        ref: "apps/backend/tests/control-titles.unit.test.ts#ADMIN-05 D-46 a title word finds its control on the picker's first page"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/administration.integration.test.ts#ADMIN-05 D-46 the control search finds an Annex A control by a word from its name"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#ADMIN05_PICKER_FINDS_CONTROL_BY_TITLE_WORD"
        status: pass
    human_judgment: false
  - id: D4
    description: "The seed refuses a malformed title file (not an object, unknown catalogue, sources and titles that differ, bad basis, unknown id, a control its catalogue labels, titles outside the form rules), naming the file and the control"
    requirement: ADMIN-05
    verification:
      - kind: unit
        ref: "apps/backend/tests/control-titles.unit.test.ts#ADMIN-05 D-46 the seed refuses a title outside the form rules"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/control-titles.unit.test.ts#ADMIN-05 D-46 the seed refuses a title for a control its catalogue already labels"
        status: pass
    human_judgment: false
  - id: D5
    description: "Each CPS 230, CPS 234 and PSPF title is unique in its framework and passes the anchor check against its paragraph; the clause or section stays the reference and the paragraph the description"
    requirement: ADMIN-05
    verification:
      - kind: unit
        ref: "apps/backend/tests/control-titles.unit.test.ts#ADMIN-05 D-46 each descriptive title shares a specific word with its own paragraph"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-seed.integration.test.ts#ADMIN-05 D-46 a titled APRA or PSPF requirement keeps its reference and its paragraph"
        status: pass
    human_judgment: false
  - id: D6
    description: "Each descriptive title says what its paragraph requires, in CSRM's words"
    requirement: ADMIN-05
    verification: []
    human_judgment: true
    rationale: "VALIDATION Manual-Only: the orchestrator spot-checks the sample rows below against their paragraphs (plan 10-23 walk, B8); a word check cannot judge meaning"

duration: 43min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 22: Control titles for the whole seeded library Summary

**Every seeded control now has a title. The 93 Annex A controls carry the standard's names and no ISO text. The 293 APRA CPS 230, CPS 234 and PSPF requirements carry short titles in CSRM's own words, each anchored to its paragraph. A CSRM title file beside the untouched vendored catalogues holds them, and the seed reconciles them in, so typing `masking` finds `8.11 · Data masking` in the control picker.**

## Performance

- **Duration:** 43 min
- **Started:** 2026-10-02T12:53:25Z
- **Completed:** 2026-10-02T13:36:33Z
- **Tasks:** 3 (Task 1 tracer, 2 TDD, 1 browser proof)
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `csrm-control-titles.json` sits beside the vendored catalogues. It holds a `description`, a `sources` entry per catalogue (ISO `framework`; CPS 230, CPS 234 and PSPF `descriptive`) and `titles`: 93, 51, 24 and 218, in catalogue order.
- In `seed-csrm-data.ts`, `catalogueLabel` holds the existing label chain. `controlName(control, titles)` uses a title only where the catalogue gives no label, still writing `{number} — {title}`. `parseControlTitles` validates the title file, `readControlLibrary(appRoot)` reads the catalogues and the title file, and `createControlSeeds(catalogues, titles)` builds the seeds. All three are exported, with `ControlCatalogue` and `ControlSeed`, and `seedCsrmData` uses them. Description, reference, framework fields and `sourceData` are unchanged for every control.
- The unit test proves:
  - coverage: 386 titles, and no seed of the 2,646 named by its number;
  - uniqueness within each framework;
  - the voice rules;
  - the anchor check;
  - the proof word: `masking` matches only 8.11;
  - that titled and untitled runs differ only in the names of controls that had none.
- Mounted proofs:
  - a seeded start names 5.1 and gives it no description;
  - a 5.1 stored by its number is renamed, and a further start leaves `updatedAt` unchanged;
  - no stored control is named by its number;
  - CPS-234-15 and PSPF-001 keep `Clause 15` and `Section 01` and their paragraphs;
  - the analyst's `GET /api/v1/controls?q=masking` returns `8.11 — Data masking`.
- Browser proofs: `ADMIN05_CONTROL_LABELS` (5.1's Name cell), `ADMIN05_CONTROL_TITLES_LOADED` (CPS-234-15 and PSPF-001), and `ADMIN05_PICKER_FINDS_CONTROL_BY_TITLE_WORD` (`masking` in the E11 control picker).

## Task Commits

1. **Task 1: Annex A names through the seed to the control search (tracer, TDD)**
   - RED `ff097fb` (test): expect Annex A controls to carry their standard names
   - GREEN `00b022e` (feat): load the Annex A control names into the control seed
   - The tracer gate re-ran its automated verify (39/39) before expanding.
2. **Task 2: descriptive titles for every APRA and PSPF paragraph (TDD)**
   - RED `1636310` (test): expect every seeded control to carry a title
   - GREEN `2e76a2d` (feat): give every APRA and PSPF requirement a short descriptive title
3. **Task 3: browser proofs, full Strapi suite and both journeys**
   - `575172e` (test): prove the control titles and a search by a title word in the browser

**Plan metadata:** the docs commit that follows this summary.

## Tests Run

| Run | Result |
|---|---|
| Task 1 RED, unit | `tsc` refused `control-titles.unit.test.ts`: `readControlLibrary`, `parseControlTitles` and `createControlSeeds` are not exported (the planned API). `noEmitOnError` blocks every emit, so the mounted files were compiled through a scratch tsconfig under the git-ignored `apps/backend/.tmp/` |
| Task 1 RED, mounted (`--test-name-pattern=D-46`) | 3 tests, 0 passed, 3 failed, on assertions: masking returned `[]` instead of `['8.11 — Data masking']`, and 5.1's name was `'5.1'` twice. 79 s |
| Task 1 GREEN (unit, assessment-seed, administration) | 39 passed, 0 failed, 77 s |
| Task 2 RED (unit, assessment-seed) | 27 tests, 20 passed, 7 failed. All 7 are the new cases and fail on the missing 293 titles: counts `{iso: 93}` only, CPS-234-15 named by its number, empty titles failing the voice, uniqueness and anchor cases. The masking case already passed, because Task 1 loaded 8.11 |
| Task 2 GREEN (unit, assessment-seed) | 27 passed, 0 failed, 48 s |
| Full Strapi suite (`pnpm --dir apps/backend test`) | 630 passed, 0 failed, 0 cancelled, 0 skipped. It took 1,190 s, longer than the 676 s baseline; the web typecheck ran beside its first minutes |
| Playwright (`administration-workflow.spec.ts`, `assessment-release-workflow.spec.ts`) | desktop 5 passed, mobile 1 passed; 0 failed, 0 flaky, 0 skipped; 2.6 min (158 s). Next logged the known benign `The destination stream closed early` 21 times. The run changed nothing in the tree (D-48) |
| Web (`pnpm --dir apps/csrm test`) | 129 files, 2,745 passed, 73 s |
| `pnpm --dir apps/csrm typecheck`, `lint` | clean (lint is `next typegen && tsc --noEmit`) |
| `pnpm --dir apps/csrm api:check` | clean; `schema.d.ts` refreshed to no change |
| Static guards | the four vendored catalogues are unchanged since `5ea2b77`. No file under `apps/backend/src/api/*/content-types/` changed. The specification and both role-function catalogue copies are untouched |

## Descriptive Titles: Counts, Reading Pass and Spot-Check Samples

Each framework was drafted from its paragraphs. The drafts and their paragraphs went into the scratch review file `apps/backend/.tmp/control-title-review.md` (git-ignored, not staged), which lists each control's clause or section, full paragraph, draft title and anchoring stems. The file was then re-read row by row, and the measured generic stems match the plan:
- CPS 234: `apra`, `regul`, `entit`, `infor`, `secur`, `must`, `with`, `asset`;
- CPS 230: `apra`, `regul`, `entit`, `must`, `manag`, `opera`, `servi`, `provi`, plus `risk`;
- PSPF: `secur`.

| Framework | Titles | Corrected by the reading pass | Corrected by the copy check |
|---|---|---|---|
| APRA CPS 234 | 24 | 1 (`CPS-234-14`, made distinct from ISO 5.2: "Defined information security roles and responsibilities") | 0 |
| APRA CPS 230 | 51 | 0 | 0 |
| PSPF | 218 | 36 (titles that echoed the paragraph's opening words, such as the Essential Eight and Protective DNS titles; vague titles made specific, such as AUSTEO and AGAO) | 4 (`PSPF-048`, `-204`, `-209`, `-210` began with their paragraph's opening) |

No anchor-check failure reached the unit test: every final title shares a non-generic stem with its own paragraph.

Five sample rows per framework for the orchestrator's spot check (id | title | first 120 characters of the paragraph):

**APRA CPS 234**

| Id | Title | Paragraph (first 120 characters) |
|---|---|---|
| CPS-234-15 | Information security capability proportionate to threats | An APRA -regulated entity must maintain an information security capability commensurate with the size and extent of thre |
| CPS-234-20 | Classification of information assets by criticality and sensitivity | An APRA-regulated entity must classify its information assets, including those managed by related parties and third part |
| CPS-234-25 | Response plan stages and incident escalation | An APRA-regulated entity’s information security response plans must include the mechanisms in place for: (a) managing al |
| CPS-234-29 | Escalating unremediated control deficiencies | An APRA -regulated entity must escalate and report to the Board or senior management any testing results that identify i |
| CPS-234-36 | Notifying APRA of material control weaknesses | An APRA-regulated entity must notify APRA as soon as possible and , in any case, no later than 10 business days , after |

**APRA CPS 230**

| Id | Title | Paragraph (first 120 characters) |
|---|---|---|
| CPS-230-11 | Operational risk, critical operations and service provider risks | An APRA-regulated entity must: (a) effectively manage its operational risks, and set and maintain appropriate standards |
| CPS-230-24 | IT capability and information asset health | An APRA-regulated entity must maintain appropriate and sound information and information technology (IT) capability to m |
| CPS-230-34 | Critical operations defined by adverse customer impact | Critical operations are processes undertaken by an APRA -regulated entity or its service provider which, if disrupted be |
| CPS-230-40 | BCP capabilities and tolerance level monitoring | An APRA-regulated entity must maintain the capabilities required to execute the BCP, including access to people, resourc |
| CPS-230-57 | Relief for listed providers on standardised terms | An APRA-regulated entity need not comply with the requirements in paragraphs 53, 54, 55(d), 59(a) and 59(c) for a materi |

**PSPF**

| Id | Title | Paragraph (first 120 characters) |
|---|---|---|
| PSPF-001 | Portfolio security advice from the Department of State | The Department of State supports portfolio entities to achieve and maintain an acceptable level of protective security t |
| PSPF-050 | Clearance details kept off online platforms | Personnel do not publicise their security clearance information on online platforms. |
| PSPF-092 | Approved TikTok use with mitigations | The Chief Security Officer or Chief Information Security Officer approves any legitimate business reason for the use of |
| PSPF-149 | Approving citizenship eligibility waivers | The Accountable Authority (or the Chief Security Officer if delegated) approves a citizenship eligibility waiver after a |
| PSPF-207 | Ongoing facility access for people not engaged | The Accountable Authority or Chief Security Officer approves ongoing (or regular) access to entity facilities for people |

Titles cover only the operative requirement. Footnote text and next-heading fragments from the PDF extraction were not titled: for example, CPS-230-11's group footnote and CPS-234-14's trailing `Information security capability`.

## Annex A Cross-Check

The 93 names were confirmed against a second public listing, the isms.online "ISO 27001:2022 Annex A" table (`https://www.isms.online/iso-27001/annex-a-2022/`, fetched 2026-10-02), compared case-insensitively.
- 90 names are identical.
- 8.18 and 8.27 are identical apart from the site's markup, which joins the next cell's text onto the name.
- 5.21 is abbreviated on the site (`Managing Information Security in the ICT Supply Chain`); the plan's full form, which is the standard's, stands.
- 5.34 (`Privacy and protection of PII`) and 8.1 (`User endpoint devices`) match the plan's forms.

No name was changed. Only names are loaded: the vendored ISO file keeps `statement: null`, and no Annex A seed has a description.

## Files Created/Modified

- `apps/backend/src/bootstrap/controls/csrm-control-titles.json` (new): the 386 titles with their sources.
- `apps/backend/src/bootstrap/seed-csrm-data.ts`: `CONTROL_TITLE_FILE`, `catalogueLabel`, the two-argument `controlName`, `parseControlTitles`, `readControlLibrary`, the two-argument `createControlSeeds`, and the exported types.
- `apps/backend/tests/control-titles.unit.test.ts` (new): the Annex A, validation, coverage, uniqueness, voice, anchor and proof-word cases (17 tests).
- `apps/backend/tests/assessment-seed.integration.test.ts`: four D-46 mounted cases.
- `apps/backend/tests/administration.integration.test.ts`: the mounted `masking` search.
- `apps/csrm/e2e/administration-workflow.spec.ts`: the 5.1 Name assertion and `ADMIN05_CONTROL_TITLES_LOADED`. Plan 10-17's and the orchestrator's `settleElementWidth` changes are kept.
- `apps/csrm/e2e/assessment-release-workflow.spec.ts`: `ADMIN05_PICKER_FINDS_CONTROL_BY_TITLE_WORD` in the E11 control step. Every other assertion is unchanged.

## Decisions Made

- The Annex A names stand as planned after the cross-check (see above).
- The Essential Eight requirements in the PSPF read `Maturity Level Two: {strategy}`.
- Where the PSPF names a party (the Accountable Authority, the Chief Security Officer, the Chief Information Security Officer, the Authorised Vetting Agency, the Sponsoring Entity), the title names it too. Neighbouring duties then stay distinct, as the plan's PSPF-008 and PSPF-011 example asks. Party-first titles keep the rest in CSRM's words.
- Extra validation beyond the plan's list: a non-blank `description` and a non-blank `note` per source. Both protect the file's provenance, and both are cheap.
- The dev database picks up the titles on the orchestrator's next seeded Strapi start, as plan 10-17's corrections do. The reconciliation already overwrites seeded names (T-10-42), so an analyst's Administration edit to a seeded control's name would be overwritten on a development seeded start. That is accepted (T-10-64); editing titles under an Admin role is Phase 22's.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The RED compile emitted nothing, so the mounted RED cases first ran the old build**
- **Found during:** Task 1 RED.
- **Issue:** the backend tsconfig has `noEmitOnError: true`. The unit test's missing imports (the intended RED) stopped every emit, so the first run executed the previous `tests-dist` build (25/25, none of the new cases).
- **Fix:** compiled the two mounted files through a scratch tsconfig in the git-ignored `apps/backend/.tmp/` that excludes the unit file, then ran the new D-46 cases (3/3 failed on assertions). The unit file's RED is its compile refusal of the three planned exports.
- **Files modified:** none tracked.
- **Verification:** the RED evidence above; GREEN compiled through the normal `tests/tsconfig.json`.
- **Committed in:** not applicable.

**2. [Rule 1 - Bug] A type narrowing error in the new unit test**
- **Found during:** Task 1 RED compile.
- **Issue:** `libraryPromise ??= …; return libraryPromise;` did not narrow under strict TypeScript.
- **Fix:** `return (libraryPromise ??= readControlLibrary(appRoot));`.
- **Files modified:** `apps/backend/tests/control-titles.unit.test.ts`.
- **Committed in:** `ff097fb`.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug).
**Impact on plan:** none on scope. Both concerned running the RED step.

## Issues Encountered

- The full Strapi suite took 1,190 s against the 676 s baseline. All 630 passed. The new D-46 mounted cases add little; the web typecheck overlapped the start. The orchestrator's next full gate should show whether the slowdown persists.
- No Playwright harness defect: the tree was unchanged after the run.

## Deferred Items

None. ADMIN-05 criterion 1 (the Information Asset owner) stays with Phase 22, which plan 10-23 records.

## User Setup Required

None. The titles reach the operator's development database on the orchestrator's next seeded Strapi restart (`IDAMBOX_SEED_CSRM=true`); tests use their own databases.

## Next Phase Readiness

- Plan 10-23 can walk the Controls list and the control picker with every control titled. The spot-check rows above are for the orchestrator's manual check (VALIDATION Manual-Only, B8).
- D-42's `{number} · {framework}` fallback is unchanged, for any control imported later without a title.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*

## Self-Check: PASSED

- Files: `csrm-control-titles.json`, `control-titles.unit.test.ts` and this summary exist.
- Commits: `ff097fb`, `00b022e`, `1636310`, `2e76a2d`, `575172e` and `d208e12` are on `post-demo`, each with the Co-Authored-By trailer.
