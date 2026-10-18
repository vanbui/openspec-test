---
phase: 08-production-integration-and-hardening
plan: 04
subsystem: api
tags: [openapi, zod, contract-parity, vitest, openapi-typescript, alerts, analyst-dashboard, reports]

requires:
  - phase: 08-production-integration-and-hardening
    provides: the parity guard as 08-03 left it (the shell module removed from its inventory) and the unchanged specification; no Strapi source changes in this plan
provides:
  - the parity guard's two boundary modes (boundary-empty, boundary-long) beside minimal, maximal and nullable, run for every registered parser
  - boundaryGrandfathered, the allow-list of 33 pre-Phase-8 parsers with one reason each, a STALE_GRANDFATHER check, the count asserted, and the eight Phase 7 labels asserted never grandfathered (D-40)
  - minLength/maxLength declared in docs/references/specification.json on the nine identifier properties the Phase 7 parsers bound (D-05, D-02, D-03); api:check clean
  - the three Phase 7 schema modules with no .trim() and headers that state the identifier bounds are the contract's own
  - the free-text max(65_535) caps of the three Phase 7 parsers registered as narrowedPaths with their reason, and the service tests asserting exactly those narrowings
affects: [08-05-authorization-matrix, 08-13-verification, 08-14-phase-gate, contract-parity, any plan that adds or changes a response parser]

tech-stack:
  added: []
  patterns:
    - "Boundary parity: every response parser is fed the shortest string the contract permits (empty, or exactly minLength characters of whitespace) and the longest (exactly maxLength, or 70,000 characters when none is declared); a rejection outside narrowedPaths fails unless the label is grandfathered with a reason."
    - "A bound the server guarantees (documentId, domain number, deterministic alert id) is declared in the contract; a client cap the server does not guarantee (free text) stays a registered narrowing with its reason beside the parser (D-05, D-02)."
    - "The grandfather list is pruned by construction: an entry whose parser accepts both boundary payloads, or whose label no parser carries, fails as STALE_GRANDFATHER, and the count is asserted so the backlog changes only deliberately (D-40)."

key-files:
  created: []
  modified:
    - apps/web/src/features/contract-response-parity.test.ts
    - docs/references/specification.json
    - apps/web/src/features/reports/report-schema.ts
    - apps/web/src/features/analyst-dashboard/analyst-dashboard-schema.ts
    - apps/web/src/features/alerts/alert-schema.ts
    - apps/web/src/features/alerts/alert-service.ts
    - apps/web/src/features/analyst-dashboard/analyst-dashboard-service.ts
    - apps/web/src/features/reports/report-service.ts
    - apps/web/src/features/alerts/alert-service.test.ts
    - apps/web/src/features/analyst-dashboard/analyst-dashboard-service.test.ts
    - apps/web/src/features/reports/report-service.test.ts

key-decisions:
  - "boundary-empty serves exactly minLength characters of whitespace (not letters) for a string with a declared minLength, so a .trim() ahead of a .min() is visible as the narrowing IN-03 described; the must-have names trim explicitly."
  - "The boundary modes carry every declared property (like maximal and nullable), not only the required ones, so optional strings are checked at their edges too (D-05: nothing stays invisible)."
  - "Only four of the plan's eight Phase 7 labels can fail a boundary payload: alerts.getAlertSummary, reports.listReportDefinitions, reports.getReport.assessmentThroughput and reports.getReport.controlEffectiveness parse components with no free-form string (enumerations, dates, integers, or a minLength the parser already mirrors). The RED set is the four parsers IN-03 named; nothing was manufactured to reach eight."
  - "The free-text max(65_535) caps on AlertSource.title, DashboardRiskRow.riskStatement, ActivityItem.title and ActivityItem.actorDisplayName are not declared in the contract: a Strapi text or string attribute carries no server-enforced maximum (D-02 forbids adding a validator), so they are registered as narrowedPaths with their reason beside the three parsers (D-05, second branch)."
  - "schema.d.ts is byte-identical after api:generate (openapi-typescript 7.13.0 emits nothing for string bounds), so it is not in the commit; api:check proves the client matches the spec."
  - "INT-01 stays unchecked in REQUIREMENTS.md, matching the 08-01 to 08-03 convention: the phase gate verifies it."

patterns-established:
  - "A parser registered in Phase 7 or later never enters boundaryGrandfathered: it declares the bound in the contract or registers the path in narrowedPaths."
  - "A service test asserts the exact narrowedPaths of its registrations rather than claiming no narrowing."

requirements-completed: [INT-01]

duration: 17 min
completed: 2026-09-25
---

# Phase 08 Plan 04: Parity boundary mode Summary

**The parity guard now feeds every response parser the contract's shortest and longest strings, the nine identifier bounds the Phase 7 parsers relied on are declared in the contract and mirrored without `.trim()`, the four free-text caps are registered narrowings with their reason, and the 33 older parsers whose bounds the contract still does not declare are named, counted and reasoned in one allow-list that fails when an entry goes stale.**

## Performance

- **Duration:** about 17 min
- **Started:** 2026-09-25T14:57:52Z
- **Completed:** 2026-09-25T15:14:47Z (the metadata commit `2412521`; this timestamp corrected afterwards)
- **Tasks:** 2 of 2, both test-first (RED, GREEN)
- **Files modified:** 11 (0 created, 11 modified, 0 deleted)

## Accomplishments

- `contract-response-parity.test.ts` runs five modes per parser. `boundary-empty` serves every free string at the shortest length the contract permits (empty, or exactly `minLength` characters of whitespace); `boundary-long` at the longest (exactly `maxLength`, or 70,000 characters, longer than the largest client cap `max(65_535)`, when the contract declares none). Constants, enumerations, dates and patterned strings keep their one synthesised value. A rejection outside `narrowedPaths` fails with the label, the mode, the issue list and the remedy.
- IN-03 is closed by contract: `minLength: 1, maxLength: 255` on `ExposedSystem.documentId`, `DashboardRiskRow.documentId`, `DashboardRiskRow.riskNumber`, `ActivityItem.documentId`, `ActivityItem.identifier` (type still `["string", "null"]`), `AlertSource.documentId`, `AlertSource.identifier` and `AlertLink.documentId`; `minLength: 1, maxLength: 512` on `AlertItem.id`. Each is a bound the server already guarantees (a documentId is a 24-character cuid2, a domain number is `PFX-YYYY-XXXXXX`, an alert id is `kind:sourceDocumentId`, at most 57 characters). No operation, path or response shape changed; nine lines of the spec changed and nothing else.
- The three Phase 7 schema modules carry no `.trim()`; their `min(1)/max(255|512)` are the contract's own bounds, and their headers say so. The `max(65_535)` free-text caps remain, registered as `narrowedPaths` beside `alerts.listAlerts` (`data.0.source.title`), `analystDashboard.getDashboardSummary` (`riskStatement`, `title`, `actorDisplayName` of its rows) and `reports.getReport.treatmentPerformance` (`data.mostOverdue.rows.0.source.title`).
- `boundaryGrandfathered` names 33 pre-Phase-8 parsers with one reason each (the VERIFICATION backlog, D-40), the count is asserted, a stale entry fails as `STALE_GRANDFATHER`, and the eight Phase 7 labels are asserted absent. The guard passes 66/66; web 73 files / 884 tests; typecheck and `api:check` clean.

## Task Commits

1. **Task 1: Add the boundary mode and the grandfather allow-list (RED, then GREEN guard-only)** — `a4c9a53` (test, RED: 37 failed / 29 passed of 66; the grandfather list empty), `4b674b2` (feat, guard GREEN: 33 entries with reasons, 4 failed / 62 passed, the four IN-03 parsers named in the body as the deliberate RED left for Task 2)
2. **Task 2: Declare the bounds in the contract, regenerate the client, align the parsers and correct the headers (GREEN)** — `a36569d` (feat: the spec, the three schema modules, the three registrations with `narrowedPaths`, the three service tests; guard 66/66)

**Plan metadata:** the `docs(08-04): complete parity boundary mode plan` commit that carries this summary.

## TDD Gate Compliance

Task 1 has a `test(08-04)` commit whose run was observed RED for the right reason (37 unregistered boundary rejections, no other test failing), followed by a `feat(08-04)` commit observed at exactly the four-label RED the plan's Task 2 turns GREEN. Task 2 is the GREEN of that RED: its `feat(08-04)` commit was observed 66/66 on the guard and green on the targeted patterns, the full web suite and typecheck. No refactor commit was needed.

## The RED report, exactly as observed

`a4c9a53`, `pnpm --filter @csrm/web exec vitest run contract-response-parity --reporter=json` (`/tmp/csrm-phase-08/08-04-parity-red.json`): 66 tests, **37 failed / 29 passed**, every failure a per-label `<label> accepts the payload its contract component declares` test and no other test failing. The failing labels:

- **Phase 7 (4, the parsers IN-03 named):** `alerts.listAlerts`, `analystDashboard.getDashboardSummary`, `reports.getReport.riskExposure`, `reports.getReport.treatmentPerformance`.
- **Older (33):** `request.listRequests`, `request.getRequest`, `request.createRequest`, `request.updateRequest`, `request.revertRequestToDraft`; `listMyQuestionnaires`, `listQuestionnairesForReview`, `getQuestionnaire`, `saveQuestionnaireDraft`, `submitQuestionnaire`, `revertQuestionnaireToDraft`, `releaseQuestionnaire`, `returnQuestionnaireToAnalystReview`, `addQuestionnaireQuestion`, `editQuestionnaireQuestion`, `deleteQuestionnaireQuestion`; `listAssessmentRequests`, `getAssessmentDraftJob`, `getQuestionnaireGenerationJob`, `listMyReleasedAssessments`, `listAnalystAssessments`, `getAssessment`, `getReleasedAssessment`, `getReleasedAssessment (analyst actor)`, `listAssessmentRisks`, `listControlImplementations`, `listRiskTypes`, `listControls`, `listActiveUsers`; `risks.getRiskDetail`, `listRiskRegisterAssessments`, `listRiskRegisterRiskTypes`, `listRiskRegisterControls`.

The other four Phase 7 registrations passed in RED, as their components predict: `AlertSummary` and `ControlEffectivenessReport` and `AssessmentThroughputReport` hold only enumerations, `format: date` strings and integers; `ReportDefinition.title` and `.description` declare `minLength: 1`, which `z.string().min(1)` mirrors exactly. After the guard-only GREEN (`4b674b2`) the failing set was exactly the four Phase 7 labels above (4 failed / 62 passed), and 21 registered parsers accept both boundary payloads with no entry at all.

## The grandfather backlog (D-40): 33 entries

The VERIFICATION backlog figure is **33**. Each entry's reason in the test names the family, the fields it bounds client-side and that the contract bound is a Phase 8 backlog item. The paths each parser rejected, by mode, on the RED tree:

| Label | Module | boundary-empty rejects | boundary-long rejects |
|-------|--------|------------------------|-----------------------|
| `request.listRequests` | requests/request-service.ts | `requestNumber`, `title`, `informationSystems.0.name`, `informationAssets.0.name`, `questionnaire.title` | `requestor.displayName` |
| `request.getRequest` | requests/request-service.ts | as the list, plus `relationships.questionnaire.documentId`, `relationships.assessment.documentId` | `requestor.displayName`, both relationship documentIds |
| `request.createRequest` | requests/request-service.ts | as the list | `requestor.displayName` |
| `request.updateRequest` | requests/request-service.ts | as the list | `requestor.displayName` |
| `request.revertRequestToDraft` | requests/request-service.ts | `documentId`, `requestNumber`, `title`, `revertedBy.documentId` | none |
| `listMyQuestionnaires` | questionnaires/questionnaire-service.ts | `documentId`, `questionnaireNumber`, `title`, `assessmentRequest.{documentId,requestNumber,title,requestStatus}`, `revertedBy.documentId`, `release.releasedBy.documentId`, `events.0.by.documentId` | the same plus `description`, `revertReason` and every `displayName` |
| `listQuestionnairesForReview` | questionnaires/questionnaire-service.ts | as `listMyQuestionnaires` | as `listMyQuestionnaires` |
| `getQuestionnaire` | questionnaires/questionnaire-service.ts | as `listMyQuestionnaires` (unwrapped) | as `listMyQuestionnaires` (unwrapped) |
| `saveQuestionnaireDraft` | questionnaires/questionnaire-service.ts | `questionnaireId` | `questionnaireId` |
| `submitQuestionnaire` | questionnaires/questionnaire-service.ts | `questionnaireId` | `questionnaireId` |
| `revertQuestionnaireToDraft` | questionnaires/questionnaire-service.ts | `questionnaireId`, `revert.revertedBy.documentId` | the same |
| `releaseQuestionnaire` | questionnaires/questionnaire-service.ts | as `getQuestionnaire` without events | as `getQuestionnaire` without events |
| `returnQuestionnaireToAnalystReview` | questionnaires/questionnaire-service.ts | as `getQuestionnaire`, plus `events.0.by`, `clearedAnswers.0.questionKey`, `clearedAnswers.0.explanation` | as `releaseQuestionnaire` |
| `addQuestionnaireQuestion` | questionnaires/questionnaire-service.ts | as `returnQuestionnaireToAnalystReview` | as `releaseQuestionnaire` |
| `editQuestionnaireQuestion` | questionnaires/questionnaire-service.ts | as `returnQuestionnaireToAnalystReview` | as `releaseQuestionnaire` |
| `deleteQuestionnaireQuestion` | questionnaires/questionnaire-service.ts | as `returnQuestionnaireToAnalystReview` | as `releaseQuestionnaire` |
| `listAssessmentRequests` | assessments/assessment-service.ts | `documentId`, `requestNumber`, `title` | the same |
| `getAssessmentDraftJob` | assessments/assessment-service.ts | `jobId`, `questionnaireId` | the same |
| `getQuestionnaireGenerationJob` | assessments/assessment-service.ts | `jobId`, `requestId`, `providerName`, `providerVersion` (beyond the union restructure already narrowed at `data`) | the same |
| `listMyReleasedAssessments` | assessments/assessment-service.ts | `documentId`, `assessmentNumber`, `generatedBy.{documentId,displayName}` | the same plus `summary` |
| `listAnalystAssessments` | assessments/assessment-service.ts | as `listMyReleasedAssessments` | as `listMyReleasedAssessments` |
| `getAssessment` | assessments/assessment-service.ts | `documentId`, `assessmentNumber`, `assessmentRequest.{documentId,requestNumber,title}`, `generatedBy`, `reviewedBy`, `approvedBy` (documentId and displayName) | the same plus `summary`, `recommendationsSummary`, `overallRiskRationale` |
| `getReleasedAssessment` | assessments/assessment-service.ts | as `getAssessment` | as `getAssessment` |
| `getReleasedAssessment (analyst actor)` | assessments/assessment-service.ts | as `getAssessment`, plus every `risks.0` reference field, `risks.0.{documentId,riskNumber}`, `ownerLabels.0.{documentId,displayName}`, `releaseReadiness.requirements.0.{key,label,destination}` | as `getAssessment`, plus every `risks.0` text and reference field and the same owner-label and readiness fields |
| `listAssessmentRisks` | assessments/assessment-service.ts | `documentId`, `riskNumber` | the same plus `riskStatement` |
| `listControlImplementations` | assessments/assessment-service.ts | `documentId`, `control`, `controlOwner.{documentId,displayName}` | the same plus `evidence` |
| `listRiskTypes` | assessments/assessment-service.ts | `documentId`, `name` | the same plus `description` |
| `listControls` | assessments/assessment-service.ts | `documentId`, `controlNumber`, `name` | the same plus `description` |
| `listActiveUsers` | assessments/assessment-service.ts | `documentId`, `displayName` | the same |
| `risks.getRiskDetail` | risks/risk-service.ts | `data` (its wrapper reports any inner rejection as one root issue) | `data` |
| `listRiskRegisterAssessments` | risks/risk-schema.ts | `documentId`, `assessmentNumber`, `generatedBy.{documentId,displayName}` | the same plus `summary` |
| `listRiskRegisterRiskTypes` | risks/risk-schema.ts | `documentId`, `name` | the same plus `description` |
| `listRiskRegisterControls` | risks/risk-schema.ts | `documentId`, `name`, `controlNumber` | the same plus `description` |

Paths are shown relative to `data` or `data.0`. Resolving an entry means declaring the bound the server guarantees in the contract (identifiers, numbers, display names) or dropping it from the parser (free text), then deleting the entry; the count assertion then changes on purpose.

## The nine contract properties changed

| Component.property | Before | After |
|--------------------|--------|-------|
| `ExposedSystem.documentId` | `{ "type": "string" }` | `minLength: 1, maxLength: 255` |
| `DashboardRiskRow.documentId` | `{ "type": "string" }` | `minLength: 1, maxLength: 255` |
| `DashboardRiskRow.riskNumber` | `{ "type": "string" }` | `minLength: 1, maxLength: 255` |
| `ActivityItem.documentId` | `{ "type": "string" }` | `minLength: 1, maxLength: 255` |
| `ActivityItem.identifier` | `{ "type": ["string", "null"] }` | `["string", "null"]`, `minLength: 1, maxLength: 255` |
| `AlertSource.documentId` | `{ "type": "string" }` | `minLength: 1, maxLength: 255` |
| `AlertSource.identifier` | `{ "type": "string" }` | `minLength: 1, maxLength: 255` |
| `AlertLink.documentId` | `{ "type": "string" }` | `minLength: 1, maxLength: 255` |
| `AlertItem.id` | `{ "type": "string" }` | `minLength: 1, maxLength: 512` |

`ExposedSystem.name` already declared `minLength: 1, maxLength: 255` and is unchanged. `git diff --stat` on the spec: 9 insertions, 9 deletions, one file. `pnpm --prefix apps/web api:check` exits 0; `api:generate` rewrote `schema.d.ts` byte-identical (openapi-typescript 7.13.0 emits no annotation for `minLength`/`maxLength`), so the generated client is not in the diff.

## Files Created/Modified

- `apps/web/src/features/contract-response-parity.test.ts` — `Mode` with `boundary-empty` and `boundary-long`; `modes`, `boundaryModes`, `OVER_LONG_LENGTH = 70_000`; `stringFor(schema, mode)`; `boundaryGrandfathered` (33 entries), `grandfatheredLabels`, `phase7Labels`; `describeContract`, `unregisteredRejection`; the per-label test over five modes with the grandfather skip and the remedy in its message; the stale-narrowing test over five modes; three new tests (never grandfathers the Phase 7 parsers; STALE_GRANDFATHER; the recorded count).
- `docs/references/specification.json` — the nine properties above.
- `apps/web/src/features/reports/report-schema.ts`, `analyst-dashboard/analyst-dashboard-schema.ts`, `alerts/alert-schema.ts` — `.trim()` removed from every identifier (and from `ExposedSystem.name`); headers state that the identifier bounds mirror the contract's declared `minLength`/`maxLength` and name the one registered free-text narrowing.
- `apps/web/src/features/alerts/alert-service.ts`, `analyst-dashboard/analyst-dashboard-service.ts`, `reports/report-service.ts` — `narrowedPaths` with the reason beside `alerts.listAlerts`, `analystDashboard.getDashboardSummary` and `reports.getReport.treatmentPerformance`.
- `apps/web/src/features/alerts/alert-service.test.ts`, `analyst-dashboard/analyst-dashboard-service.test.ts`, `reports/report-service.test.ts` — the "with no narrowing" assertions replaced by the exact registered narrowings per label.

## Verification

| Check | Result |
|-------|--------|
| Task 1 RED, `vitest run contract-response-parity --reporter=json` (`a4c9a53`) | **37 failed / 29 passed** of 66; the failing set is listed above, no other test failing |
| Task 1 guard-only GREEN (`4b674b2`) | **4 failed / 62 passed**; the plan's verify block as written printed `PARITY_FAILING_SET_MISMATCH` because it expected eight labels (`failed` = the four IN-03 labels, `expected` = the eight); the same assertion against the four observed labels exits 0 (`parity failures are exactly the four Phase 7 labels IN-03 named`) |
| `grep -c boundaryGrandfathered` | 4; `'boundary-empty'`, `'boundary-long'`, `STALE_GRANDFATHER` and `70_000` present |
| Phase 7 label names in the guard | only in `phase7Labels` (lines 133–140), the constant the never-grandfathered assertion reads; the two other grep hits are the dashboard module's import identifier |
| Task 2, `python3 -c … print(maxLength(AlertItem.id), minLength(riskNumber), maxLength(identifier))` | `512 1 255` |
| `grep -c "trim()"` on the three schema modules | `0`, `0`, `0` |
| `grep -n minLength` on the three schema modules | the corrected headers (report-schema.ts:18, analyst-dashboard-schema.ts:19, alert-schema.ts:17) |
| `vitest run contract-response-parity` after Task 2 | **66 passed / 0 failed** (JSON report `/tmp/csrm-phase-08/08-04-parity-green.json`) |
| `vitest run contract-response-parity alert analyst-dashboard report` | **15 files, 340 tests passed** (three service tests failed first on their "no narrowing" claim; corrected, see deviations) |
| `pnpm --filter @csrm/web test` | **73 files, 884 tests passed** (61.2 s; 881 before the plan plus the three new guard tests) |
| `pnpm --filter @csrm/web typecheck` (`next typegen && tsc --noEmit`) | clean |
| `pnpm --prefix apps/web api:check` | clean (exit 0), before and after the commit |
| `pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false` | clean; `apps/strapi/.tmp/tests-dist/tests/contract-catalogue.integration.test.js` present |
| `node --test … contract-catalogue.integration.test.js` | **not run**: it boots a Strapi instance, and the dev servers were running on 1337 and 3000 for the orchestrator's browser checks (its spec reads are of `RevertReasonRequest`, request bodies and operation refs, none of the nine properties) |
| `pnpm --filter @csrm/strapi test` (plan-level verification) | **not run** for the same reason (a running `strapi develop` compiles into `apps/strapi/dist`); no Strapi source changed |
| `git diff --name-only b77adb8..HEAD -- apps/strapi/src` | empty |
| `git diff --name-only HEAD~1 HEAD` for the Task 2 commit | ten files (the spec, three schema modules, three registrations, three service tests); `schema.d.ts` unchanged, see deviations |
| AI-tool attribution in the diff and in the three commit messages | 0 / 0 |
| `git status --porcelain` after every commit | empty |
| Dev servers | untouched throughout; no process of mine left running |

## Decisions Made

- **Whitespace for the `minLength` edge.** `boundary-empty` serves exactly `minLength` characters of *whitespace* for a bounded string. The must-have names `.trim()` among the narrowings that may no longer stay invisible, and a trim ahead of a `.min()` only shows when the payload's characters are blank; letters would have hidden it. The four `.trim()` sites IN-03 named were all visible in RED for that reason.
- **The boundary modes carry every declared property**, as `maximal` and `nullable` do, so optional strings reach their edges too. The plan's "numbers and everything else as in `minimal`" is read as the leaf synthesis (numbers as `max(minimum, 1)`, booleans, nullables non-null), which is what `instanceOf` does.
- **The honest RED set is four labels, not eight.** `alerts.getAlertSummary`, `reports.listReportDefinitions`, `reports.getReport.assessmentThroughput` and `reports.getReport.controlEffectiveness` cannot reject a boundary payload (see the RED section), so the plan's verify assertion, written for eight, cannot pass on any truthful run. All eight remain in the never-grandfathered assertion, which is what D-40 needs.
- **Free-text caps stay, as registered narrowings.** `riskStatement` is a Strapi `text` attribute; `title` and `displayName` are `string` attributes without `maxLength`; neither the validator nor SQLite enforces a maximum, so the contract cannot honestly declare 65,535 and D-02 forbids adding a validator. The plan's own reading of D-05 ("any remaining deliberate narrowing goes into `narrowedPaths` with a reason") applies, and the caps keep the convention every other feature schema uses.
- **One GREEN commit for Task 2** carrying the registrations and the service tests with the plan's five-file change, so no commit after `4b674b2` is RED; the plan named one commit for the task.
- **Targeted runs use `pnpm --filter @csrm/web exec vitest run <pattern>`** (the `test -- <pattern>` form runs the whole suite here, as 08-02 and 08-03 recorded); the full suite ran with `pnpm --filter @csrm/web test`.
- **INT-01 stays unchecked** (see key decisions).

## Deviations from Plan

### Recorded, not fixable

**1. The plan's RED expectation names eight Phase 7 labels; four of them cannot fail.** The verify block asserts the failing set is exactly the eight Phase 7 registrations. Four parse components with no free-form string (or a `minLength: 1` the parser mirrors), so no boundary payload can be rejected by them. The RED and guard-only GREEN runs were recorded as observed (37, then exactly the four IN-03 parsers); no test was bent to reach eight. The plan's Task 2 acceptance ("the eight Phase 7 labels outside `boundaryGrandfathered`") holds: none of the eight is grandfathered and the assertion enforcing that passes.

### Auto-fixed Issues

**2. [Rule 3 - Blocking] The nine identifier bounds alone did not turn three Phase 7 parsers GREEN**
- **Found during:** Task 2 (the scratch per-mode report and the first targeted run)
- **Issue:** `alerts.listAlerts`, `analystDashboard.getDashboardSummary` and `reports.getReport.treatmentPerformance` also reject `boundary-long` on `max(65_535)` free-text caps (`source.title`, `riskStatement`, activity `title` and `actorDisplayName`) that the contract does not declare and, per D-02, cannot (no server-guaranteed maximum).
- **Fix:** registered each path in `narrowedPaths` beside its parser with the reason (D-05, second branch); the three service tests that asserted "no narrowing" now assert exactly those paths.
- **Files modified:** `alert-service.ts`, `analyst-dashboard-service.ts`, `report-service.ts` and their three tests (six files beyond the plan's `<files>` list)
- **Verification:** guard 66/66; the targeted patterns 340/340; the full suite 884/884
- **Committed in:** `a36569d`

**3. [Rule 1 - Bug] Three service tests encoded the untrue "no narrowing" claim** — the same fix as above; each test now names the registered narrowings, which is the assertion IN-03 asked for.

### Recorded

**4. `schema.d.ts` is not in the Task 2 commit.** `api:generate` produced a byte-identical file (openapi-typescript emits nothing for string bounds), so the acceptance criterion "`git diff --name-only HEAD~1 HEAD` is exactly the five files" reads ten files without the generated client. `api:check` proves the client matches the spec.

**5. The Strapi integration run and the Strapi suite were not run** (the dev servers were up, by the orchestrator's instruction); the test suite compile ran clean, and no Strapi source changed.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug), 3 recorded (an over-counted acceptance criterion, an unchanged generated file, two Strapi runs skipped on instruction).
**Impact on plan:** every must-have truth holds; the boundary mode, the declared bounds, the aligned parsers and the counted backlog are all delivered. Six files beyond the plan's list were needed to close IN-03 completely rather than leaving three Phase 7 parsers RED.

## Issues Encountered

- `pnpm --filter @csrm/web test -- --reporter=json --outputFile.json=…` does not forward the reporter flags (no JSON file was written); the full-suite figures come from the default reporter in `/tmp/csrm-phase-08/08-04-web-full.log`. The per-run JSON reports for the guard were produced with the `exec vitest run` form.
- The spec is written with one property per line inside two-space-indented component blocks, and `"documentId": { "type": "string" },` recurs across components, so the edit located each line inside its own component block and asserted a single match there; `git diff --stat` confirms nine lines.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: guard blind spot (T-08-R18 class) | `apps/web/src/features/risks/risk-service.ts`, `apps/web/src/features/administration/administration-service.ts`, `apps/web/src/features/assessments/assessment-service.ts` (`getQuestionnaireGenerationJob`) | Parsers registered through a `responseParser` wrapper report any inner rejection as one root issue, and their `narrowedPaths: ['data']` therefore tolerates every inner narrowing in every mode: the eight `administration.*` parsers, `risks.listRiskRegister` and `getQuestionnaireGenerationJob` are invisible to the boundary modes at the field level (`risks.getRiskDetail`, without the root narrowing, is grandfathered with that reason). Recorded in `deferred-items.md` for the plan that resolves the backlog. |

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- The parity guard now covers five modes for every parser; a new or changed parser that is stricter than the contract fails until the bound is declared or the path is registered, and a new grandfather entry changes the asserted count (33).
- VERIFICATION carries the backlog figure 33 and the table above; resolving the request, questionnaire, assessment, reference-data and Risk families is contract work (declare documentId, number and display-name bounds the server guarantees; drop or register free-text caps), not Strapi work.
- Orchestrator browser checks with the dev servers up: the analyst Dashboard (`/app/dashboard`), Alerts (`/app/alerts`) and Reports (`/app/reports`, each of the four reports) still render their rows; the parsers now accept identifiers exactly as served (no trim), so a served row is never rejected on whitespace.
- No Strapi source, grant, content-type schema or policy changed; the served-operations inventory and the web chain guard are unaffected (no service call changed).
- Ready for 08-05.

## Self-Check: PASSED

The eleven modified files exist on disk with the expected content (the guard contains `'boundary-empty'`, `'boundary-long'`, `boundaryGrandfathered`, `STALE_GRANDFATHER` and `70_000`; the spec prints `512 1 255`; the three schema modules contain no `trim()`), the three task commits (`a4c9a53`, `4b674b2`, `a36569d`) are in the history, and this summary is at `.planning/phases/08-production-integration-and-hardening/08-04-SUMMARY.md`.
