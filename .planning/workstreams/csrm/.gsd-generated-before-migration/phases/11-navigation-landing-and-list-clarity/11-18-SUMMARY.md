---
phase: 11-navigation-landing-and-list-clarity
plan: 18
subsystem: ui
tags: [analyst-reports, figure-links, report-table, record-link, nextjs, vitest, playwright, ux-09, uat-048, x-10, d-35, d-36, d-37, d-39]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-06: the Requests queue's queue=all and status filters; 11-07: the assessment lists' approvedFrom, approvedTo and Released from/to chips; 11-14: the register's stage and treatmentAction filters; 11-15: dueState, mitigationStatus=any, mitigationEffectiveness, impactedSystem=none and the none values; 11-12 and 11-16: the Home figures and their links; 11-17: the staged exposure report, the 14-day window and the report tiles"
provides:
  - "ReportTable rows take optional header and cells links (ReportTableLink); a non-zero linked figure and a linked row header render as RecordLink with the presentation's accessible name; a zero is plain even with a link"
  - "report-presentation.ts builds every report figure's href and name: cellLinkName, monthLinkName, lifecycleLinkName, rowHeaderLinkName, figureLink (null at zero), riskListHref (URLSearchParams)"
  - "Treatment performance: Due within 14 days → due-soon alerts, Due later and No target date → register dueState lists, treatment status rows → state=open&treatmentStatus (none for Not provided)"
  - "Risk exposure: inherent, residual and accepted cells; matrix cells and row totals; system names and their Critical and High cells; Under assessment cells; the coverage note's View Critical and View High; a system's Total stays plain (D-37)"
  - "Assessment throughput: both tiles open the period's released assessments; each month opens its own range (last day, or today for the current month); each lifecycle row opens queue=all&status"
  - "Control effectiveness: the Mitigation controls tile opens mitigationStatus=any&state=open with 'View the Risks that have them'; status and rating row headers open the Risks with those mitigation controls; figures plain (D-36); the Select a status and Select a rating sentences"
  - "ReportSection noteLinks; the control-effectiveness skeleton reserves its tile's supporting line"
  - "figure-link-audit.test.ts: every figure of the four reports and both Homes links or is a documented exception; zeros carry no link"
  - "E2E: UX09_FIGURE_DUE_LATER, UX09_FIGURE_EXPOSURE_CELL, UX09_FIGURE_THROUGHPUT_MONTH, UX09_FIGURE_LIFECYCLE_ROW, UX09_FIGURE_CONTROL_ROW_HEADER"
affects: [11-19, 11-20, 11-21, 18, 20, 21]

actuals:
  tokens: 22942
  tasks: 3
  commits: 5
plan_head_before: 320c896851b957a9f2beaa898679bc8c02eb923b
plan_head_after: 8ffa694bb89c5e92d53a7b1ebbff5b202fafd8e3

tech-stack:
  added: []
  patterns:
    - "A report table row carries its own links: `cells` aligned with `values` (null where the figure is zero or no list holds exactly its records) and an optional `header`; the table renders them and never builds an href"
    - "Every figure href is built in the presentation module from the target list's closed filter vocabulary; served values (system ids, dates, stored statuses) are encoded with URLSearchParams or encodeURIComponent"
    - "A figure-link audit walks every surface's presentation output with every count above zero and again at zero, against an exceptions map whose entries cite D-36 or D-37 and must each still match a figure"

key-files:
  created:
    - apps/csrm/src/features/reports/report-table.test.tsx
    - apps/csrm/src/features/reports/figure-link-audit.test.ts
  modified:
    - apps/csrm/src/features/reports/report-table.tsx
    - apps/csrm/src/features/reports/report-presentation.ts
    - apps/csrm/src/features/reports/report-section.tsx
    - apps/csrm/src/features/reports/risk-exposure-report.tsx
    - apps/csrm/src/features/reports/assessment-throughput-report.tsx
    - apps/csrm/src/features/reports/control-effectiveness-report.tsx
    - apps/csrm/src/features/reports/report-detail.tsx
    - apps/csrm/src/features/reports/report-presentation.test.ts
    - apps/csrm/src/features/reports/report-views.test.tsx
    - apps/csrm/e2e/analyst-insights.spec.ts

key-decisions:
  - "11-18: presentation rows carry a null cell link for a zero figure, and ReportTable also renders a zero plain, so the audit's zero pass proves X-10 at the presentation layer and the table enforces it at render"
  - "11-18: the Under assessment table's cells link too (§9.3, the 11-17 handoff): /app/risks?residualRating={r}&state=open&stage=under-assessment, none for Not rated"
  - "11-18: the coverage note's View Critical and View High render whenever the note does (risksWithoutSystem > 0). The report serves only the High plus Critical sum, so either list may be empty; the note's figure stays plain (D-37)"
  - "11-18: the effectiveness Not provided row header links mitigationEffectiveness=none, named 'Not provided: view the Risks with mitigation controls whose effectiveness is not recorded', because the §8.1 pattern would read 'Not provided mitigation controls'. The implementation-status Not provided header stays plain: the register's mitigationStatus=none lists Risks with no mitigation control, not controls with no status"
  - "11-18: a month cell's range runs from the month's first day to its last, or to the server's today for the partial month; both period tiles use periodStart to today"
  - "11-18: UX-09 stays open: requirements.ready-ids reports 0/1 ready, because later Phase 11 plans also declare it"

patterns-established:
  - "Figure links: report rows carry `cells` and `header` built in report-presentation.ts; views pass rows straight to ReportTable"
  - "Figure-link audit: new report or Home figures join figure-link-audit.test.ts, linked or listed as a cited exception"

requirements-completed: []

coverage:
  - id: D1
    description: "ReportTable renders a non-zero figure with a cell link and a row header with a header link as RecordLink with the presentation's accessible name, right-aligned with tabular-nums; a zero is plain even with a link; unlinked rows render as before"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/reports/report-table.test.tsx (5 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Treatment performance: Overdue, Due within 14 days and No target date tiles and rows open the overdue alerts, the due-soon alerts and the register's dueState=no-target-date list; Due later opens dueState=later; each treatment status opens state=open&treatmentStatus (none for Not provided); the Due later figure equals its list in the browser"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/reports/report-presentation.test.ts#treatment-performance tiles and rows"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/reports/report-views.test.tsx#treatment-performance report"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/analyst-insights.spec.ts#UX09_FIGURE_DUE_LATER"
        status: pass
    human_judgment: false
  - id: D3
    description: "Risk exposure: rating, accepted, matrix, row-total, system Critical and High, and Under assessment figures open released or under-assessment register lists; system names open their released open Risks; a system's Total stays plain; the coverage note's View Critical and View High open impactedSystem=none by rating; a matrix figure equals its list in the browser"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/reports/report-presentation.test.ts#risk-exposure rows"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/reports/report-views.test.tsx#risk-exposure report"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/analyst-insights.spec.ts#UX09_FIGURE_EXPOSURE_CELL"
        status: pass
    human_judgment: false
  - id: D4
    description: "Assessment throughput: both tiles open the period's released assessments (status=approved, approvedFrom=periodStart, approvedTo=today); each month opens its range; each lifecycle row opens /app/review/requests?queue=all&status={status}; a month and a lifecycle figure each equal their list in the browser"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/reports/report-presentation.test.ts#assessment-throughput tiles and rows"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/analyst-insights.spec.ts#UX09_FIGURE_THROUGHPUT_MONTH"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/analyst-insights.spec.ts#UX09_FIGURE_LIFECYCLE_ROW"
        status: pass
    human_judgment: false
  - id: D5
    description: "Control effectiveness: the Mitigation controls tile opens mitigationStatus=any&state=open with 'View the Risks that have them'; implementation status and effectiveness row headers open the Risks with those mitigation controls with §8.2 names; figures stay plain; implementation Not provided stays plain; the Select sentences are in the descriptions"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/reports/report-views.test.tsx#control-effectiveness report"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/analyst-insights.spec.ts#UX09_FIGURE_CONTROL_ROW_HEADER"
        status: pass
    human_judgment: false
  - id: D6
    description: "The figure-link audit: every figure of the four reports and both Homes has an href or a cited exception (D-36, D-37, implementation Not provided); excepted figures stay plain; names begin with the visible figure or label; hrefs are internal; zero table figures, chips and accepted counts carry no link while tiles and link rows still link"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/reports/figure-link-audit.test.ts (8 cases)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Linked figures read as record links in report tables at 375 and 1440 (underline at rest, no crowding in the scrolled matrix), and the coverage note's links sit legibly beneath the note"
    requirement: "UX-09"
    verification: []
    human_judgment: true
    rationale: "No test asserts the visual weight of underlined figures in dense tables or the note links' layout; the 11-21 walkthrough should look at the four reports at both widths"

duration: 37 min
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 18: Every report figure opens its records Summary

**Every figure in the four analyst reports now opens the list holding exactly its records, or is a documented exception. `ReportTable` takes optional figure and row-header links, which render as record links named by the presentation module, and a zero stays plain. The treatment report's due-state and status figures open the alert lists or the register's `dueState` and `treatmentStatus` lists. The exposure report's rating, accepted, matrix, system and Under assessment figures open released or under-assessment register lists. A system's Total stays plain, and the coverage note gains View Critical and View High. The throughput report's two tiles, each month and each lifecycle row open the released assessments list or the All requests queue. On the control report, the Mitigation controls tile and each status or rating row header open the Risks that hold those mitigation controls, and the figures stay plain (D-36). A unit audit walks every figure on the four reports and both Homes, so a new figure without a link or a cited exception fails the build. Five browser proofs show one figure of each kind equal to the list it opens.**

## Performance

- **Duration:** 37 min. This includes three runs of the changed spec, the tracer re-run, the full web suite and the full Playwright suite (14.1 min).
- **Started:** 2026-10-03T20:23:38Z
- **Completed:** 2026-10-03T21:00:00Z
- **Tasks:** 3 of 3
- **Files changed:** 12 (2 created, 10 modified, none deleted)

## Accomplishments

- **Table links (X-10).** `ReportTableRowData` gains `header?` and `cells?` (`ReportTableLink` = `{ href, accessibleName }`).
  - A figure above zero with a cell link renders as `RecordLink` with `aria-label` set to the cell's name, inside the existing right-aligned, `tabular-nums` cell.
  - A zero renders as plain text, even when its position has a link.
  - A row header with a link renders its label as `RecordLink`.
  - Callers that pass neither render exactly as before.
- **Names and hrefs (`report-presentation.ts`).**
  - The name helpers write singular and plural out:
    - `cellLinkName`: `{n} {Risk|Risks}: {row}[, {column}]`
    - `monthLinkName`: `{n} released in {Month Year}`
    - `lifecycleLinkName`: `{n} {request|requests}: {status}`
    - `rowHeaderLinkName`: `{label}: view {what}`
  - `figureLink` returns null for a zero. `riskListHref` encodes each filter with `URLSearchParams` (T-11-42).
- **Treatment performance (UI-SPEC §8.2).**
  - `Due within 14 days` (tile and row) → `/app/alerts?kind=risk-treatment-due-soon`.
  - `No target date` (tile and row) → `/app/risks?dueState=no-target-date`.
  - `Due later` → `/app/risks?dueState=later`.
  - Each treatment status → `/app/risks?state=open&treatmentStatus={value}`, with `none` for Not provided.
  - The "stay plain until" comment is gone.
- **Risk exposure (§9.3).**
  - Inherent and residual cells → `{inherent|residual}Rating={r}&state=open&stage=released` (`none` for Not rated). Accepted cells add `treatmentAction=Accept`.
  - Matrix cells → rating plus treatment status. Row totals → the rating alone.
  - System name → `system={id}&state=open&stage=released`, named `{name}: view its released open Risks`. Its Critical and High cells add the rating. Total is plain (D-37).
  - The coverage note is followed by `View Critical` and `View High` (`impactedSystem=none&residualRating={r}&state=open&stage=released`), with the §9.3 names. The note's figure stays plain.
  - Under assessment cells → `residualRating={r}&state=open&stage=under-assessment`. This item was handed over by 11-17.
  - The systems description gains `Select a system to view its released open Risks.`
- **Assessment throughput (D-39).**
  - `Released in period` and `Median days to release` → `/app/review/assessments?status=approved&approvedFrom={periodStart}&approvedTo={today}`. The median keeps `Across {n} releases with a submission date`, so its name says what it is computed from.
  - Each month → its first day to its last day, or to today for the partial month. February in a leap year ends on the 29th (tested).
  - Each lifecycle row → `/app/review/requests?queue=all&status={status}`. `approved` reads Released.
- **Control effectiveness (D-36, UI-D32).**
  - The `Mitigation controls` tile → `/app/risks?mitigationStatus=any&state=open`, with the supporting line `View the Risks that have them`.
  - Status row headers → `mitigationStatus={value}&state=open`. Rating row headers → `mitigationEffectiveness={value}&state=open`. Both are named `{label}: view the Risks with {label} mitigation controls`.
  - The figures stay plain. The implementation-status Not provided header stays plain.
  - The section descriptions gain the `Select a status …` and `Select a rating …` sentences.
- **Figure-link audit (`figure-link-audit.test.ts`, 8 cases).**
  - **What it walks:** with every count above zero, the four reports' tiles, tables and row headers, the coverage note and its links. On the analyst Home: tiles, review queue rows, exposure rows and accepted links, the under-assessment row and own-requests rows. On the Requestor Home: the section totals and the rating chips.
  - **What it asserts:**
    - Every figure has an href or a cited exception, and every excepted figure is plain.
    - Each exception cites D-36 or D-37, or is the documented Not provided status, and still matches a figure.
    - Both parts of each D-37 sum link.
    - Every name begins with its visible figure or label, and every href is an internal `/app/...` path.
    - At zero, no table figure, chip or accepted count links, while tiles and link rows still do.

## Audit exception list

| Key | Reason |
|---|---|
| `risk-exposure \| Most exposed Information Systems \| * \| Total` | D-37: a system's Total is the sum of its Critical and High figures, which each open their own list |
| `risk-exposure \| Most exposed Information Systems \| coverage note \| Risks without an impacted Information System` | D-37: the note's figure is the sum of its View Critical and View High links |
| `control-effectiveness \| Implementation status \| * \| Mitigation controls` | D-36: a count of mitigation controls never poses as an equal list; its row header opens the Risks that hold them |
| `control-effectiveness \| Effectiveness rating \| * \| Mitigation controls` | D-36: as above |
| `control-effectiveness \| Implementation status \| notProvided \| row header` | Not provided: no list holds Risks whose mitigation controls have no recorded status (the register's `none` lists Risks with no mitigation control); Phase 18's mitigation-control table owns that list |

## Task Commits

1. **Task 1: Treatment performance figures open their lists, through linked report table cells (tracer, TDD)**
   - `e5c262a`: test(11-18), RED
   - `f36a5a0`: feat(11-18), GREEN
2. **Task 2: Exposure, throughput and control effectiveness figures open their records, enforced by an audit (TDD)**
   - `046ec80`: test(11-18), RED
   - `1f8d68c`: feat(11-18), GREEN
3. **Task 3: Prove figure equals list for one figure of each kind in the browser**
   - `8ffa694`: test(11-18)

The ledger count is `git rev-list --count 320c896..8ffa694` = 5. Every commit ends with the `Co-Authored-By` trailer (5 of 5, checked with `git log --format=%(trailers)`).

## TDD Gate Compliance

- **Task 1:** RED `e5c262a` comes before GREEN `f36a5a0`.
  - `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed). The target was "ReportTable figure links > renders a non-zero figure with a cell link as a record link named by the cell, right-aligned with tabular figures", which failed because no link existed.
  - The run failed 10 of 121, each on an assertion.
  - The evidence record uses vitest's junit reporter. The default reporter reads as `zero_tests_discovered`, and the junit `testcase` attributes need `name` before `classname` for the checker.
- **Task 2:** RED `046ec80` comes before GREEN `1f8d68c`.
  - `RED_EVIDENCE_OK` for "risk-exposure rows > lists exposed Information Systems by name, the name opening the system's released open Risks and Critical and High their rating, with Total plain (D-37)".
  - The run failed 24 of 258 on assertions. The audit file failed to load because `exposedSystemsNoteLinks` did not exist yet: a missing export, as 11-17's RED also had.
- **Tracer feedback gate (Task 1):** the run was interactive, in end-of-phase mode, with an automated-only verify. The exact Task 1 verify was re-run against the committed tree and exited 0: web 121/121, typecheck clean, spec 14/14, tree unchanged. Task 2 started only after that.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED | web 10 failed of 121 |
| Task 1 GREEN | reports 6 files, 121/121; typecheck and lint clean |
| Playwright `analyst-insights.spec.ts` (Task 1) | **14 passed: desktop 14, mobile 0; 0 failed, 0 flaky, 0 skipped; 1.3 min**. Tree identical before and after |
| Tracer re-run (Task 1 verify) | exit 0: web 121/121, typecheck clean, spec 14 passed (1.3 min), tree unchanged |
| Task 2 RED | web 24 failed of 258 (plus the audit file's load failure) |
| Task 2 GREEN verify | reports, analyst dashboard, home and the copy guard: 14 files, 356/356; typecheck and lint clean |
| Playwright `analyst-insights.spec.ts` (Task 3), first run | 17 passed, 1 failed (UX09_FIGURE_CONTROL_ROW_HEADER: my locator; deviation 2); 1.6 min. Tree identical before and after |
| Playwright `analyst-insights.spec.ts` (Task 3), second run | **18 passed: desktop 18, mobile 0 (the file is not on the mobile project's list); 0 failed, 0 flaky, 0 skipped; 1.3 min**. Tree identical before and after |
| **Full web suite** (`pnpm --dir apps/csrm test`) | **143 files, 3,191/3,191** (11-17 ended at 141 files, 3,169) |
| `typecheck`, `lint`, e2e `tsc -p tsconfig.e2e.json` | clean |
| `api:check` | exit 0; `schema.d.ts` refreshed with `git update-index --refresh` and unchanged |
| **Full Playwright** (`pnpm --dir apps/csrm test:e2e`) | **143 passed: desktop 122, mobile 21; 0 failed, 0 flaky, 0 skipped; 14.1 min** (11-17: 138, desktop 117 and mobile 21). `git status --short` identical before and after |
| Strapi | not run: the plan is web only (no Strapi change, no specification change) |

The production server in the full run logged 83 `The destination stream closed early` messages and one `failed-to-find-server-action` (11-17 logged 71 and 1). Every test passed.

## Files Created/Modified

- `apps/csrm/src/features/reports/report-table.tsx`: `ReportTableLink`, `header?` and `cells?`, and `ReportFigure`, which renders a link only above zero
- `apps/csrm/src/features/reports/report-presentation.ts`: the name helpers, `figureLink`, `riskListHref`, the period and month hrefs, every row's links, the three tile links and the three section sentences
- `apps/csrm/src/features/reports/report-section.tsx`: `noteLinks`, rendered after the notes as record links
- `apps/csrm/src/features/reports/risk-exposure-report.tsx`: passes the coverage note links
- `apps/csrm/src/features/reports/assessment-throughput-report.tsx`: passes `today` to `releasedMonthRows`
- `apps/csrm/src/features/reports/control-effectiveness-report.tsx`: the doc comment for D-36
- `apps/csrm/src/features/reports/report-detail.tsx`: the control-effectiveness skeleton reserves the supporting line
- Tests:
  - `report-table.test.tsx` and `figure-link-audit.test.ts` are new.
  - `report-presentation.test.ts` and `report-views.test.tsx` are updated.
  - `e2e/analyst-insights.spec.ts` gains five proofs and the `cellValue`, `reportTableRow` and `firstFigureLink` helpers.

## Decisions Made

- **Zero is plain in two places.** The presentation returns a null cell link for a zero, and `ReportTable` renders a zero plain even when a link is present. The audit's zero pass therefore proves X-10 in the data, and the table enforces it on screen.
- **Under assessment cells link** (§9.3, the 11-17 handoff), even though the plan's behaviour list does not name them.
- **The coverage note's links show whenever the note does.** The report serves only the High plus Critical sum (`risksWithoutSystem`), so it cannot hide an empty half. Each link opens its own list, and the note's figure stays plain (D-37).
- **Effectiveness Not provided** links `mitigationEffectiveness=none`. Its name is `Not provided: view the Risks with mitigation controls whose effectiveness is not recorded`, because the literal pattern would read "Not provided mitigation controls". It still begins with the visible label.
- **Implementation status Not provided stays plain.** The register's `mitigationStatus=none` lists Risks with no mitigation control at all, not controls with no status. This is the plan's documented exception.
- **Month ranges:** a month runs from its first day to its last day, or to the server's `today` for the partial month. Both period tiles use `periodStart` to `today`. All the dates come from the server.
- **UX-09 stays open.** `requirements.ready-ids` reports 0/1 ready, because later Phase 11 plans also declare it. REQUIREMENTS.md is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1: test defect] One of my RED expectations had the wrong link count**
- **Found during:** Task 2 GREEN.
- **Issue:** the matrix view test expected 14 links, but the fixture has 13 non-zero figures (3, 4, 2, 2 and 2 by row).
- **Fix:** the expectation reads 13, with the per-row breakdown in a comment.
- **Committed in:** `1f8d68c`

**2. [Rule 1: test defect] A linked row header takes its link's name**
- **Found during:** Task 3's first spec run.
- **Issue:** `UX09_FIGURE_CONTROL_ROW_HEADER` located `rowheader { name: 'Existing' }`. Once the header holds a link, its accessible name is the link's: `Existing: view the Risks with Existing mitigation controls`. The run failed 1 of 18.
- **Fix:** the proof finds the link by its full name inside a row header. The second run passed 18/18.
- **Committed in:** `8ffa694`

**3. [Scope note] Three files outside the plan's list**
- `report-section.tsx` gains `noteLinks`, so View Critical and View High follow the coverage note in the notes block.
- `report-detail.tsx` reserves the supporting line in the control-effectiveness skeleton, because its tile now has one.
- `treatment-performance-report.tsx` in the plan's list needed no change: its rows carry their links.

**4. [Acceptance wording] Literal href greps**
- Task 1 and Task 2 grep `report-presentation.ts` for literal query fragments. Those hrefs are written as template literals over closed or server-validated values (`queue=all&status=`, `approvedFrom=`, `impactedSystem=none`) or as constants (`dueState=later`, `mitigationStatus=any`), so each literal is present.
- Hrefs with stored statuses or served ids use `URLSearchParams` (T-11-42).

---

**Total deviations:** 4: 2 defects in my own tests, 1 scope note and 1 wording note.
**Impact on plan:** No added scope. There is no Strapi or specification change, no content-type change, no new Function, FunctionAPI or role, and no dependency (D-01, D-02, T-11-SC).

## Issues Encountered

- **Bash heredocs with Python patches** failed to parse (`unexpected EOF`), as in 11-15 to 11-17. The patches were written to the scratchpad with the Write tool and run from there, through a helper that keeps each file's line endings.
- **The RED evidence checker** needs vitest's junit output with `name` before `classname`. The vitest output was reordered before the check, and the test results were unchanged.
- **The first Task 3 run** kept its database and builds under the ignored `apps/backend/.tmp/` and `apps/csrm/.tmp/` after its failure, as the harness does. `git status --short` was identical before and after.
- **Line endings:** the `LF will be replaced by CRLF` notices are `core.autocrlf` messages. The operator's two `apps/backend/types/generated/*.d.ts` files still report "needs update". They stay untouched and unstaged.

## Known Stubs

None. Every figure reads a server field and links or is a cited exception.

## Threat Flags

None.
- No new endpoint, route, query parameter or read was added. Every link opens a list the analyst can already open, and Strapi scopes it (T-11-43).
- **T-11-42:** every href is an internal path built in the presentation module from closed vocabularies and served values. Served values are encoded, and the audit asserts every href matches `/app/...`. The target lists re-validate their URLs.

## User Setup Required

None.

## Next Phase Readiness

- **11-19 and 11-20** can add figures; any new report or Home figure must join `figure-link-audit.test.ts`, linked or with a cited exception.
- **11-21:**
  - The coverage table can cite `figure-link-audit.test.ts` and the five `UX09_FIGURE_*` proofs for UX-09 criterion 2 and UAT-048.
  - The walkthrough should look at linked figures in the report tables at 375 and 1440 (coverage D7).
- **Phase 18:** its mitigation-control table can make the implementation-status Not provided row and the D-36 figures true equal lists. When it does, retire those exceptions.

## Self-Check: PASSED

- The created files `figure-link-audit.test.ts` and `report-table.test.tsx` exist, as do the modified `report-table.tsx` and `report-presentation.ts`.
- The five commits `e5c262a`, `f36a5a0`, `046ec80`, `1f8d68c` and `8ffa694` exist on `post-demo`, and each carries the trailer. There are 3 `test(11-18)` and 2 `feat(11-18)` commits.
- **Task 1 acceptance re-ran PASS:**
  - `report-table.tsx` renders `RecordLink` for cells and headers (3 matches).
  - `report-presentation.ts` contains `dueState=later`, `dueState=no-target-date` and `kind=risk-treatment-due-soon`.
  - The verify exited 0, twice (GREEN and the tracer re-run).
- **Task 2 acceptance re-ran PASS:**
  - `figure-link-audit.test.ts` cites D-36 (5 matches) and D-37 (6 matches).
  - `report-presentation.ts` contains `queue=all&status=`, `approvedFrom=`, `mitigationStatus=any` and `impactedSystem=none`.
  - The verify passed 356/356, with typecheck clean.
- **Task 3 acceptance re-ran PASS:** the spec contains all four `UX09_FIGURE_*` keys and passes 18/18 in the desktop project. The file is not on the mobile project's list, and the tree is clean.
- **The plan's verification passed:** web 3,191/3,191, typecheck, lint and `api:check` clean, the audit passes, and full Playwright 143/143 with the tree clean.
- STATE.md, ROADMAP.md and state.json are untouched; the orchestrator owns them. REQUIREMENTS.md is unchanged, because UX-09 is not ready.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*
