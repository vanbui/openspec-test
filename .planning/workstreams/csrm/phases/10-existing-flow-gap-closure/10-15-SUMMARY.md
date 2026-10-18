---
phase: 10-existing-flow-gap-closure
plan: 15
subsystem: api, ui
tags: [strapi, openapi, zod, released-assessment, control-label, local-time, d-34, d-36]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-01 LocalInstant and the date-long style; 10-02 the gated analyst assessment route and the copy guard; 10-13 the parity guard at 43 grandfathered labels; 10-14 the latest hub and release journey state"
provides:
  - "AssessmentRiskListItem / AssessmentRiskListResponse on GET /v1/risk_assessments/{assessmentId}/risks (D-34), with RiskSummary unchanged for the Risk create and update responses"
  - "ControlImplementationControlSummary as the required nullable controlSummary on every control implementation response (list, create, update)"
  - "controlLabel and controlTitle: the zod-free D-36 control label rule (apps/csrm/src/features/assessments/control-label.ts)"
  - "ReleasedRiskDetails: one read-only Risk for the Requestor's released view (h4 groups) and the analyst's read-only editor (h3 groups)"
  - "canMutateAssessment and assessmentRiskListItemFromAnalystRisk in the zod-free assessment-domain.ts"
  - "Released view copy per UI-SPEC §15.1 and §15.3, with the assessment and release dates in the viewer's zone"
affects: [10-17, 10-20, 10-21, 10-22, 10-23, phase-11-dashboards-and-reports]

actuals:
  tokens: 19247
  tasks: 3
  commits: 6
plan_head_before: eb9b377518e40889e09e2032f3f08b066f101d6b
plan_head_after: 52dace51c52f785556e2c82148eb887d1281f73f

tech-stack:
  added: []
  patterns:
    - "A list read gets its own wider item schema while the mutation responses keep the narrow summary (research Pitfall 9)"
    - "A bounded relation summary is null when any field falls outside the contract's bounds, never partial"
    - "A Phase 10 parser mirrors the contract's bounds with no .trim(), and mirrors an unbounded shared component (ActiveUserSummary) without bounds, so it passes all five parity modes without grandfathering"
    - "A shared read-only component takes its group heading level from its page (3 or 4)"

key-files:
  created:
    - apps/csrm/src/features/assessments/control-label.ts
    - apps/csrm/src/features/assessments/control-label.test.ts
    - apps/csrm/src/features/assessments/released-risk-details.tsx
  modified:
    - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
    - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
    - apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/assessments/assessment-schema.ts
    - apps/csrm/src/features/assessments/assessment-service.ts
    - apps/csrm/src/features/assessments/assessment-service.test.ts
    - apps/csrm/src/features/assessments/assessment-domain.ts
    - apps/csrm/src/features/assessments/assessment-editor.tsx
    - apps/csrm/src/features/assessments/assessment-editor.test.tsx
    - apps/csrm/src/features/assessments/released-assessment.tsx
    - apps/csrm/src/features/assessments/released-assessment.test.tsx
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx
    - apps/csrm/app/(app)/app/assessments/[documentId]/page.tsx
    - apps/csrm/e2e/assessment-release-workflow.spec.ts

key-decisions:
  - "10-15: the analyst's read-only editor renders the whole shared Risk, mitigation group included, at h3; in read-only mode it no longer renders the separate Mitigation controls section, RiskReadOnly or ControlReadOnly, so a released Risk reads identically to both actors (UI-D20)"
  - "10-15: the list item's owners mirror ActiveUserSummary, which declares no bounds, so their parser is unbounded; the system and asset summaries are declared inline in AssessmentRiskListItem with 1-255 bounds, so the phase adds only the three schemas the plan names"
  - "10-15: a controlSummary or a system or asset summary is null when a field falls outside its 1-255 bound, so the server never serves a value the contract forbids"
  - "10-15: a released-view contract mismatch is logged on the server as [csrm-contract] response contract mismatch: {operation}, because normalizeResponseParserError does not log and UI-SPEC §15.3 keeps the operation in the server log"
  - "10-15: the grandfather backlog count falls from 43 to 42 (listAssessmentRisks retired; listAssessmentRiskItems registered without grandfathering)"

patterns-established:
  - "ReleasedRiskDetails({ risk, implementations, groupHeadingLevel }) is the one read-only Risk"
  - "controlLabel names a control everywhere; controlTitle gives the title part for the Administration Name column (10-17)"

requirements-completed: [ASSESS-07, ADMIN-05, UX-06]

coverage:
  - id: D1
    description: "Every control implementation response (list, create, update) carries a bounded controlSummary, and both actors read each mitigation control by number and title, never by id"
    requirement: ASSESS-07
    verification:
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#mounted contextual ControlImplementation routes cover every frozen writable field and exact Risk parent"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#mounted Requestor reads require owner scope and the complete release aggregate"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/released-assessment.test.tsx#names each mitigation control by its number and title, never by its internal id (D-34, D-36)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#ASSESS07_CONTROL_NAMED_BY_NUMBER_AND_TITLE"
        status: pass
    human_judgment: false
  - id: D2
    description: "The D-36 control label rule: number once, then the title, else the framework, else the number alone; zod-free"
    requirement: ADMIN-05
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/control-label.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The released risk list carries statement, system, asset, inherent and residual likelihood, consequence and rating, treatment action, plan and status, risk owner, treatment owner and target date for the owning Requestor and the analyst; another Requestor gets 404; Risk create and update responses keep five fields"
    requirement: ASSESS-07
    verification:
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#mounted released risk list carries each Risk's treatment and ownership for both actors and no one else"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#mounted contextual Risk routes cover the frozen writable surface and bounded references"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts#records the grandfather backlog count so it changes only deliberately"
        status: pass
    human_judgment: false
  - id: D4
    description: "One shared read-only Risk on both surfaces: h3 Risk number and h4 groups on the released view, h3 groups in the analyst's read-only editor, badges for ratings and treatment status, plain Not recorded, responsive grid, no internal id"
    requirement: ASSESS-07
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/released-assessment.test.tsx#shows each Risk’s system, asset, ratings, treatment and owners, never an internal id (D-34, UI-SPEC §15.2)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#shows a released Risk through the shared read-only component with h3 groups (D-34, UI-SPEC §15.2)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#ASSESS07_TREATMENT_AND_OWNERS_VISIBLE"
        status: pass
    human_judgment: false
  - id: D5
    description: "Released view copy (Release date, Released by, the new description, the mismatch as the ordinary error state) and the assessment and release dates in the viewer's zone"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/released-assessment.test.tsx#shows the assessment and release dates in the viewer’s local time and keeps calendar dates as stored (D-19)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/released-assessment.test.tsx#renders a contract mismatch as the ordinary error state and never names the operation on the page (UI-SPEC §15.3)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts#src/features/assessments/released-assessment.tsx shows no internal term"
        status: pass
    human_judgment: false
  - id: D6
    description: "The released Risk reads as a finished document at the G-4 bar (visual hierarchy of the h3/h4 groups and badges at 375 and 1440 px)"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts (no horizontal overflow at 375 and 1440 px, no serious axe violation)"
        status: pass
    human_judgment: true
    rationale: "The journey proves layout and accessibility, but whether the released document reads well is a visual judgement for the phase walkthrough (10-23)."

duration: 32min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 15: Released Assessment as a Finished Document Summary

**The assessment's risk list now serves each Risk's system, asset, ratings, treatment and owners by name through a new `AssessmentRiskListItem`, every control implementation response carries a bounded `controlSummary`, and one shared `ReleasedRiskDetails` renders the released Risk for both the Requestor and the analyst. Controls are named by the D-36 rule, never by id, and the released dates show in the viewer's zone.**

## Performance

- **Duration:** about 32 min
- **Started:** 2026-10-02T08:44:09Z
- **Completed:** 2026-10-02T09:16:09Z
- **Tasks:** 3 (tracer + 2), each RED then GREEN
- **Files modified:** 22 (3 created)

## Accomplishments

- **Strapi.** `projectAssessmentRiskListItem` and `ASSESSMENT_RISK_LIST_POPULATE` (system, asset, risk owner, treatment owner) on `listAssessmentRisks`. Owners cross as `ActiveUserSummary`, and analyst working facts never cross (issue, cause, rationales, escalation, comments, classification, exemption). `projectControlImplementationControlSummary` is shared by both `projectControlImplementationSummary` functions, so the list, create and update responses all carry `controlSummary`. The create and update reads already populate `control: true`, which loads `controlNumber`, `name` and `framework`. Record scope is unchanged: `releasedForOwner` still gates both released reads.
- **Contract.** `AssessmentRiskListItem` and `AssessmentRiskListResponse` (bounds declared, `maxItems: 1000`) answer `GET /v1/risk_assessments/{assessmentId}/risks`. `ControlImplementationControlSummary` and the required, nullable `controlSummary` are on `ControlImplementationSummary`. `RiskListResponse` is removed because nothing references it. `RiskSummary` and `RiskResponse` are unchanged. The client is regenerated and `api:check` is clean.
- **Web contract.** `assessmentRiskListItemSchema` and `assessmentRiskListResponseSchema` are registered as `listAssessmentRiskItems` with no grandfathering. The stale `listAssessmentRisks` entry is removed and the **grandfather count falls from 43 to 42**, with the history comment updated. `controlImplementationControlSummarySchema` mirrors the contract's 1-255 bounds.
- **Label rule.** `controlLabel` and `controlTitle` are zod-free. They strip a leading number joined by a spaced em dash, en dash, hyphen, middle dot or colon, and join with the spaced middle dot (X-4). They fall back to the framework (D-42), or to the number alone where the shape has no framework.
- **Shared Risk.** `ReleasedRiskDetails` shows the system and asset rows with no heading, then `Ratings` (`RiskRatingBadge`), `Ownership and treatment` (`StatusBadge` treatment family, calendar target date, wide plan) and `Mitigation control implementations` (the label, wide evidence). The grid is 1/2/3 columns at the 640 and 1024 px breakpoints, labels use `.micro-label` and values `text-sm`. An absent value reads as plain `Not recorded`, never as a badge.
- **Both surfaces.** On the released view the Risk number is an h3 and the groups are h4. In the analyst's read-only editor the groups are h3. The review page reads the list items exactly when `canMutateAssessment` (now in `assessment-domain.ts`) is false. `assessmentRiskListItemFromAnalystRisk` names relations from the loaded labels if a list item is missing.
- **Copy and dates (UI-SPEC §15.1, §15.3, D-19).** The overview now reads `Release date` and `Released by`. `Assessment date` and `Release date` render through `LocalInstant style="date-long"`, while `Next review date` and every Risk and control date stay calendar dates. The description now reads `Each Risk with its ratings, treatment and the controls that mitigate it.` A contract mismatch shows the ordinary error state, and the route logs the operation on the server. `released-assessment.tsx`, `released-risk-details.tsx` and `control-label.ts` are now in the copy guard.
- **Journey (E12 and ASSESS-07).** Jane sees the control's number and title and never its id. The journey now also asserts the treatment plan, risk owner, treatment owner and target date (`ASSESS07_TREATMENT_AND_OWNERS_VISIBLE`). The no-mutation checks are unchanged.

## Task Commits

1. **Task 1 (tracer): A released mitigation control shows its number and name from the served summary**
   - `a37cdb8` test (RED)
   - `a3a13de` feat (GREEN), spec committed with the regenerated `schema.d.ts`
   - Tracer gate (end-of-phase mode, automated-only verify): re-run green before expanding
2. **Task 2: The released risk list carries treatment and ownership, rendered once for both actors**
   - `3c6f97a` test (RED)
   - `fd12337` feat (GREEN), spec committed with the regenerated `schema.d.ts`
3. **Task 3: Released view copy and local dates, the guard, then the release journey**
   - `09acdbc` test (RED)
   - `52dace5` fix (GREEN)

**Plan metadata:** the SUMMARY commit and the STATE/ROADMAP commit follow this file.

## Tests Run

| Run | Result |
| --- | --- |
| T1 RED, web (`control-label.test.ts`, `released-assessment.test.tsx`) | label module not found (the planned RED for a new module, as in 10-01); released view 1 failed / 12 passed on the `Control` row assertion |
| T1 RED, mounted `assessment-workflow.integration.test.ts` | 23 tests: 20 pass, 3 fail (create keys and summary, the dependent hostile case, the owner's released `controlSummary`), 34 s |
| T1 GREEN, web (5 files incl. parity, service, editor) | 208 passed; typecheck clean |
| T1 GREEN, mounted | 23/23 pass, 34 s; `api:check` exit 0 |
| T2 RED, web (released view, editor, parity) | 4 failed / 160 passed, plus the released test file failing to load `released-risk-details` (count 43 vs 42, editor h3 groups, fallback names, `canMutateAssessment`) |
| T2 RED, mounted | 24 tests: 22 pass, 2 fail (list item key set, the new released list case), 30 s |
| T2 GREEN, web (`src/features/assessments`, parity, operation chain, zod boundary) | 16 files, 405 passed; typecheck and lint clean |
| T2 GREEN, mounted | 24/24 pass, 31 s; `api:check` exit 0 |
| T3 RED, web (released view, copy guard) | 4 failed / 52 passed (labels and description, Brisbane dates, mismatch source, guard on `Authoritative`) |
| T3 GREEN, web (`src/features/assessments`, copy guard) | 14 files, 284 passed; typecheck clean |
| Full web unit suite (`pnpm --dir apps/csrm test`) | 126 files, 2,611 passed, 0 failed, 33 s |
| Full Strapi suite (`pnpm --dir apps/backend test`) | 601 tests: 601 pass, 0 fail, 0 cancelled, 0 skipped, 650 s |
| Release journey (`e2e/assessment-release-workflow.spec.ts`) | desktop project: 1 passed, 0 failed, 0 flaky, 0 skipped; 75 s wall clock (test 20.9 s). Next logged the known benign `The destination stream closed early` 4 times (see 10-01). Tree clean afterwards (D-48) |
| Final `pnpm --dir apps/csrm lint` and `api:check` | exit 0 and exit 0 |

## Files Created/Modified

- `apps/csrm/src/features/assessments/control-label.ts` (new): the D-36 label rule, zod-free.
- `apps/csrm/src/features/assessments/released-risk-details.tsx` (new): `ReleasedRiskDetails` and `formatCalendarDate`.
- `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts`: list item projection, populate, control summary projection.
- `apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts`: list read populates and projects the list item.
- `apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts`: `controlSummary` on create and update responses.
- `docs/references/specification.json` and `apps/csrm/src/lib/api/generated/schema.d.ts`: the three schemas, the path's 200 response, and `RiskListResponse` removed.
- `apps/csrm/src/features/assessments/assessment-schema.ts`, `assessment-service.ts`: parsers and the `listAssessmentRiskItems` registration.
- `apps/csrm/src/features/assessments/assessment-domain.ts`: `canMutateAssessment`, `assessmentRiskListItemFromAnalystRisk`.
- `apps/csrm/src/features/assessments/assessment-editor.tsx`: read-only path on the shared component; `RiskReadOnly` and `ControlReadOnly` removed.
- `apps/csrm/src/features/assessments/released-assessment.tsx`: h3 Risk number, shared component, §15.1 and §15.3 copy, `LocalInstant` dates, diagnostic removed.
- `apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx`: reads the list items when the assessment can no longer change.
- `apps/csrm/app/(app)/app/assessments/[documentId]/page.tsx`: list item type, and a mismatch logged on the server instead of on the page.
- Tests: the mounted file, `control-label.test.ts`, `released-assessment.test.tsx`, `assessment-editor.test.tsx`, `assessment-service.test.ts`, `contract-response-parity.test.ts`, `interface-copy-guard.test.ts`, `assessment-release-workflow.spec.ts`.

## Decisions Made

- **Analyst read-only editor.** It renders the whole shared Risk, mitigation group included, at h3. The separate `Mitigation controls` section, `RiskReadOnly` and `ControlReadOnly` render only while the assessment can change. This reads UI-SPEC §15.2's "beside that page's existing h3 Mitigation controls" as a statement about heading level. It keeps one read-only Risk for both actors (UI-D20, D-34) and avoids two headings for the same controls. The editor reaches `controlLabel` through `released-risk-details.tsx`, not directly.
- **Fallback when no list item is served.** `assessmentRiskListItemFromAnalystRisk` names owners from `ownerLabels` and the system and asset from the loaded options. An unknown label reads as `Not recorded`, never as an id. The page always passes list items in read-only mode, so this is a guard only.
- **Owner bounds.** The list item's owners reference `ActiveUserSummary`, which declares no bounds. Their parser is therefore unbounded, and the list parser passes all five parity modes without grandfathering or `narrowedPaths`. The UI trims a blank display name to `Not recorded`.
- **Inline relation schema.** The system and asset summaries are declared inline in `AssessmentRiskListItem` with 1-255 bounds. This keeps the spec additions to the three schemas the plan names.
- **Out-of-bounds summaries.** A `controlSummary`, system or asset summary is null when a field is outside its 1-255 bound. The server never serves a value the contract forbids, and the reader sees `Not recorded`.
- **Mismatch logging.** `normalizeResponseParserError` does not log, so the released route logs `[csrm-contract] response contract mismatch: {operation}` with `console.error`. This follows the `[csrm-auth]` prefix convention and keeps the operation in the server log, as §15.3 requires.
- **No populate change on create and update.** `loadProjectedImplementation` already populates `control: true`, which carries `controlNumber`, `name` and `framework`.
- **Lists keep UTC.** The released list's `Released` column and mobile card keep their UTC formatter. D-19 leaves list instants to Phase 11.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two web fixtures needed the new required field**
- **Found during:** Task 1 GREEN (typecheck)
- **Issue:** `assessment-editor.test.tsx` and `assessment-service.test.ts` build `ControlImplementation` values that the now-required `controlSummary` rejects. Neither file is in Task 1's list.
- **Fix:** both fixtures gained a summary. The service test also proves that a missing summary or an empty framework is refused.
- **Committed in:** `a3a13de`

**2. [Rule 3 - Blocking] The service test's risk list fixture and an operation label**
- **Found during:** Task 2 GREEN
- **Issue:** the five-field risk fixture no longer matches the list parser. An operation label I had added to `readRisks` routed parse errors through `normalizeResponseParserError`, which the test's transport mock does not provide.
- **Fix:** the fixture became a list item, and the label was removed, so behaviour matches before this plan.
- **Committed in:** `fd12337`

**3. [Rule 3 - Blocking] The Requestor's released page is not in `files_modified`**
- **Found during:** Tasks 2 and 3
- **Issue:** the page needed the `AssessmentRiskListItem` type (Task 2), and dropping the diagnostic (Task 3) touches the route that passed it.
- **Fix:** both changes made, with the server-side log described above.
- **Committed in:** `fd12337`, `52dace5`

**4. [Plan wording] When the E12 journey change first ran**
- The E12 change was committed in Task 1 GREEN as the plan orders. Playwright first ran it in Task 3, with the full journey, and it passed. Task 1's verify command has no Playwright step.

---

**Total deviations:** 3 auto-fixed (all Rule 3), plus 1 sequencing note.
**Impact on plan:** no scope change. No content-type file changed, and no dependency was added.

## Issues Encountered

- One inline Python edit failed in Git Bash (an apostrophe inside a heredoc broke the shell's parsing). The edit scripts were moved to the scratchpad and run from there. Nothing was committed from the failed attempt.
- **TDD note.** The RED for each new module (`control-label.ts`, `released-risk-details.tsx`) was "module not found", the planned RED, as in 10-01. Every other RED failed on the target assertion. `workflow.tdd_mode` is not enabled, so no `tdd-red-evidence` record was required.

## Deferred / Handed On

- **Analyst editor copy.** The read-only alert (`Release is complete. Analyst mutation controls have been removed.`) and the readiness description (`Strapi rechecks …`) are UI-SPEC §17.1 strings owned by a later plan. `assessment-editor.tsx` is not yet in the copy guard.
- **Released list dates.** The released list's `Released` column stays in UTC until Phase 11 (D-19).
- **Control picker.** The analyst editor still loads the whole control library for its native picker (Pitfall 10). Now that the control summary has landed, the record picker plan can drop it.
- Nothing was added to `deferred-items.md` or the windows ledger: no stub, skipped test or unrun verify remains.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- 10-17 can use `controlTitle` for the Administration `Name` column and `controlLabel` for the control pages.
- 10-22's seeded titles flow through `controlLabel` unchanged; the D-42 fallback stays for untitled controls.
- The contract carries the D-03 item 5 change. The parity guard backlog is 42.

## Self-Check: PASSED

- FOUND: `apps/csrm/src/features/assessments/control-label.ts`, `control-label.test.ts`, `released-risk-details.tsx`
- FOUND commits: `a37cdb8`, `a3a13de`, `3c6f97a`, `fd12337`, `09acdbc`, `52dace5`, each ending with the `Co-Authored-By` trailer
- `git rev-list --count eb9b377..HEAD` = 6; no file under `apps/backend/src/api/*/content-types/` changed

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
