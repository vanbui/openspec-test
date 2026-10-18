---
phase: 10-existing-flow-gap-closure
plan: 02
subsystem: ui
tags: [nextjs, server-components, authorization-presentation, react-cache, typescript-compiler-api, copy-guard, playwright]

requires:
  - phase: 10-01
    provides: "viewer-time-zone.ts (server-only), LocalInstant on the revision timeline and revert summary"
  - phase: 07
    provides: "the analyst dashboard's capability check before any read (07 D-16)"
provides:
  - "canViewerReviewAssessments(): one cached, server-only assessment:review check (apps/csrm/src/lib/capabilities/analyst-review-gate.ts)"
  - "The three analyst detail routes and their metadata refuse a viewer without assessment:review before any record read, with the static title"
  - "refusal?: 'record' | 'role' on AssessmentDetail, QuestionnaireReview and AssessmentEditor (type AnalystRefusal, exported from assessment-detail.tsx)"
  - "Exported AssessmentEditorContent from the analyst assessment route"
  - "Plain permission descriptions on the eight UI-SPEC 11.2 surfaces"
  - "The D-38 interface copy guard (apps/csrm/src/lib/performance/interface-copy-guard.test.ts): internalTerms, guardedFiles, a TypeScript-AST extractor of user-visible strings"
  - "viewer-time-zone.ts and analyst-review-gate.ts on the server-only gate list"
affects: [10-04, 10-05, 10-06, 10-08, 10-09, 10-11, 10-12, 10-13, 10-14, 10-15, 10-17, 10-21, phase-11-copy-sweep]

actuals:
  tokens: 9300
  tasks: 3
  commits: 6
plan_head_before: d583a21c56de581441292ba51d6f46613aa92a37
plan_head_after: 2838392c3b345b85df1f87ab3e37c35808d00e13

tech-stack:
  added: []
  patterns:
    - "Analyst routes gate on canViewerReviewAssessments() before their first service call, in the page and in generateMetadata; a refused viewer gets the static title and the role variant"
    - "Permission states carry a refusal variant: 'role' points to the viewer's own list and never into /app/review/; 'record' is the analyst's plain refusal with the Back to link"
    - "Copy guard: each later Phase 10 plan appends the files it cleans to guardedFiles (sorted)"

key-files:
  created:
    - apps/csrm/src/lib/capabilities/analyst-review-gate.ts
    - apps/csrm/src/features/assessments/analyst-route-gate.test.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
  modified:
    - apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx
    - apps/csrm/app/(app)/app/review/questionnaires/[documentId]/page.tsx
    - apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx
    - apps/csrm/src/features/assessments/assessment-detail.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-review.tsx
    - apps/csrm/src/features/assessments/assessment-editor.tsx
    - apps/csrm/src/components/states/states.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-detail.tsx
    - apps/csrm/src/features/assessments/released-assessment.tsx
    - apps/csrm/src/features/risks/risk-details.tsx
    - apps/csrm/src/features/administration/administration-workspace.tsx
    - apps/csrm/src/lib/security/server-only-boundary.test.ts
    - apps/csrm/src/lib/metadata/record-route-titles.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx
    - apps/csrm/src/components/states/states.test.tsx
    - apps/csrm/e2e/questionnaire-workflow.spec.ts
    - apps/csrm/e2e/assessment-release-workflow.spec.ts

key-decisions:
  - "The route tests use the real can() (a one-line Set lookup) and mock only the session adapter and the services, so they prove behaviour rather than a mocked predicate"
  - "AnalystRefusal is exported from assessment-detail.tsx and type-imported by assessment-editor.tsx and questionnaire-review.tsx; type-only imports are erased, so the zod client-boundary walk is unaffected"
  - "The assessment editor's new Back to risk assessments link shows on every non-role safe state (record refusal, empty, error), as the request hub and questionnaire review already do"
  - "The record-title test signs in as an analyst from Task 1, because the request route's metadata reads the session from then on"
  - "The copy guard reads strings through the TypeScript compiler API and treats a bare expression-statement string as a directive"

patterns-established:
  - "Gate before read: await canViewerReviewAssessments() as the first statement of an analyst route's page and generateMetadata"
  - "Guard list growth: a plan that removes the D-38 terms from a file adds that file to guardedFiles in the same plan"

requirements-completed: [UX-06]

coverage:
  - id: D1
    description: "A Requestor, or a viewer with no session, on /app/review/requests/{id}, /app/review/questionnaires/{id} or /app/review/assessments/{id} gets the route's permission state before any record or list read, with the role description, a Go to My ... link and no link into /app/review/"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/analyst-route-gate.test.tsx"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#UX06_REQUESTOR_ON_ANALYST_REQUEST_ROUTE, UX06_REQUESTOR_ON_ANALYST_QUESTIONNAIRE_ROUTE, UX06_REQUESTOR_ON_ANALYST_ASSESSMENT_ROUTE_AFTER_RELEASE"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-workflow.spec.ts#UX06_REQUESTOR_ON_ANALYST_QUESTIONNAIRE_ROUTE"
        status: pass
    human_judgment: false
  - id: D2
    description: "For a refused viewer each analyst route's metadata returns the static title without reading the record; an analyst keeps the read and the not-found title for a missing id"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/metadata/record-route-titles.test.ts"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/analyst-route-gate.test.tsx#static title"
        status: pass
    human_judgment: false
  - id: D3
    description: "An analyst whose read Strapi refuses sees the record variant: plain description and the route's Back to link (Back to risk assessments is new)"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/analyst-route-gate.test.tsx#record variant"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx#discards supplied questionnaire and answer content in safe detail states"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every UI-SPEC 11.2 permission description is plain; headings and actions unchanged"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/states/states.test.tsx"
        status: pass
      - kind: other
        ref: "grep -rn 'effective CSRM|Navigation visibility|record scope|enforced by your' apps/csrm/{src,app,e2e} (no match outside the guard)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The D-38 copy guard fails the web suite on any UI-SPEC 17.2 term in a listed file's user-visible strings, with positive controls"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts"
        status: pass
    human_judgment: false

duration: 41min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 02: Analyst route gate and plain permission copy Summary

**A Requestor who opens an analyst request, questionnaire or assessment URL is now refused before any record read, under the route's static title, and pointed to her own list. Every Phase 10 permission message says what the person can do instead of naming "effective CSRM capabilities", and a TypeScript-AST copy guard keeps the listed files free of the eighteen internal terms.**

## Performance

- **Duration:** 41 min
- **Started:** 2026-10-02T01:54:03Z
- **Completed:** 2026-10-02T02:35:00Z
- **Tasks:** 3 (of 3)
- **Files modified:** 20 (3 created, 17 modified)

## Accomplishments

- `canViewerReviewAssessments()` (`import 'server-only'` first, React `cache`) wraps the analyst dashboard's four-line check, so a route's metadata and page share one session read.
- The request, questionnaire and assessment detail routes await it as the first statement of the page content and of `generateMetadata`. A refused viewer gets `Assessment Request Review | IdamBox CSRM`, `Questionnaire Review | IdamBox CSRM` or `Risk Assessment Review | IdamBox CSRM` and no read, so existing and missing ids look the same (T-10-04, T-10-05).
- `AssessmentDetail`, `QuestionnaireReview` and `AssessmentEditor` take `refusal?: 'record' | 'role'`. `role` renders UI-SPEC 11.1's description and outline link (`Go to My Requests` → `/app/requests`, `Go to My Questionnaires` → `/app/questionnaires`, `Go to My Risk Assessments` → `/app/assessments`). `record` renders the 11.2 analyst variant with the existing `Back to …` link; the editor gains `Back to risk assessments` → `/app/review/assessments`.
- Past the gate, the request route builds its questionnaire and assessment links without a second capability read, and the questionnaire route's `analystRequestHref` reuses the cached gate.
- The eight 11.2 descriptions are verbatim; the headings, titles and actions are unchanged.
- `server-only-boundary.test.ts` now lists `analyst-review-gate.ts` and `viewer-time-zone.ts` (the 10-01 hand-on).

## Copy guard: initial files

`guardedFiles`, sorted: `src/components/csrm/revert-audit-summary.tsx`, `src/components/states/states.tsx`, `src/features/administration/administration-actions.ts`, `src/features/assessments/assessment-actions.ts`, `src/features/assessments/assessment-detail.tsx`, `src/features/assessments/risk-editor.tsx`, `src/features/questionnaires/questionnaire-actions.ts`, `src/features/questionnaires/questionnaire-governance.tsx`, `src/features/questionnaires/questionnaire-revision-timeline.tsx`, `src/features/requests/request-actions.ts`, `src/features/requests/request-workflow-actions.tsx`, `src/features/risks/risk-detail-editor.tsx`.

Not listed yet, because another plan removes their terms: `questionnaire-review.tsx` (10-05, 10-09), `assessment-editor.tsx` and `risk-details.tsx` (10-21), `questionnaire-detail.tsx` (10-05), `released-assessment.tsx` (10-15), `administration-workspace.tsx` (10-17). The guard's RED run found only `states.tsx` (two terms on line 129); the other eleven files were already clean.

## Journey changes (UI-SPEC 19.1)

- **E1** (`questionnaire-workflow.spec.ts`): the Requestor on `/app/review/questionnaires/{id}` now expects the h1 `Questionnaire review`, `You don’t have permission to review this questionnaire` and `Go to My Questionnaires` → `/app/questionnaires`, instead of `Awaiting questionnaire submission`. The no-backlink and no-draft-content checks are unchanged.
- **E14** (`assessment-release-workflow.spec.ts`): the prerelease Requestor on the analyst assessment URL now expects the h1 `Risk assessment review` and `You don’t have permission to review this assessment`, instead of `Page not found`; the no-risk-statement check stays.
- **New, same journey:** `UX06_REQUESTOR_ON_ANALYST_REQUEST_ROUTE` (Jane's own request on the analyst route at 375 and 1440: the alert title, `Go to My Requests`, no `Generate…` or `Return to draft` button, no `a[href^="/app/review"]` anywhere on the page, no overflow); `UX06_REQUESTOR_ON_ANALYST_QUESTIONNAIRE_ROUTE` (`Go to My Questionnaires`, no `Contact details`, no questionnaire heading); `UX06_REQUESTOR_ON_ANALYST_ASSESSMENT_ROUTE_AFTER_RELEASE` (Jane, after release, on the analyst assessment URL: the permission state, `Go to My Risk Assessments`, no risk statement).
- `assessment-release-workflow.spec.ts`'s cross-owner `You don’t have permission to review this request` assertion (19.4) stays green unchanged.

## Task Commits

1. **Task 1: Gate the analyst request route before its read (tracer)**
   - `ca7f09d` test (RED): route tests over the request page and its metadata
   - `ea10b91` feat (GREEN): the gate helper, the request route, the refusal variants, the gate list, the journey step
2. **Task 2: Gate the questionnaire and assessment review routes and their titles**
   - `354f864` test (RED): questionnaire and assessment route cases, refused-viewer titles, the backlink source check; `AssessmentEditorContent` exported
   - `dcde98a` feat (GREEN): both routes, both components, E1 and E14
3. **Task 3: Plain permission descriptions and the copy guard**
   - `0883cfa` test (RED): the guard and the states description
   - `2838392` fix (GREEN): the five descriptions
   - No spec correction was needed: both journeys passed on their first run.

**Plan metadata:** recorded in the docs commit that adds this SUMMARY.

## Tests Run

| Run | Result |
| --- | --- |
| RED, Task 1 (`analyst-route-gate.test.tsx`) | 4 failed / 1 passed: three Requestor cases on `getRequest` called, the record case on the old description |
| GREEN, Task 1 verify set + `record-route-titles.test.ts` (4 files) | 75/75 passed; typecheck exit 0 |
| RED, Task 2 (gate, titles, questionnaire workflow, editor) | 10 failed / 56 passed: every Requestor case on a record read, the record variants on their copy, the source check on `canViewerReviewAssessments` |
| GREEN, Task 2 verify set + review workflow + server-only + zod boundary (7 files) | 139/139 passed; typecheck exit 0 |
| RED, Task 3 (guard + `states.test.tsx`) | 2 failed / 21 passed: `states.tsx:129` reported for `effective CSRM capabilities` and `Navigation visibility`; the states description assertion. Both positive controls passed |
| GREEN, Task 3 verify set (6 files) | 93/93 passed |
| Full web unit suite | 116 files, 2,125/2,125 passed, 25.9 s |
| Typecheck / lint (`next typegen && tsc --noEmit`, the same script) | exit 0 |
| Journeys (`questionnaire-workflow.spec.ts`, `assessment-release-workflow.spec.ts`) | 2/2 passed (desktop), 1.3 min, 80 s wall |
| **Full Playwright suite** (final code) | **86/86 passed: desktop 82, mobile 4; 0 failed, 0 flaky, 0 skipped; 11.5 min reported, 689 s wall** |
| `git status --short` after each Playwright run | only the three operator items (D-48) |

`api:check` was not run: no contract file changed. The full suite logged Next's benign `The destination stream closed early` 55 times (46 in 10-01's run; see 10-01 "Issues Encountered"); no assertion was affected.

## Files Created/Modified

- `apps/csrm/src/lib/capabilities/analyst-review-gate.ts` (new): `canViewerReviewAssessments`.
- The three analyst route pages: the gate first in the page content and `generateMetadata`; `AssessmentEditorContent` exported; the inline capability reads removed.
- `assessment-detail.tsx`: `AnalystRefusal` type and the two variants in `SafeDetailState`. The full-width Request context card and the gap after the relationships card (quick tasks 261001-kxa, 261001-le4) are untouched.
- `questionnaire-review.tsx`, `assessment-editor.tsx`: the `refusal` prop and variants; the editor imports `Link` and `buttonVariants`.
- `states.tsx`, `questionnaire-detail.tsx`, `released-assessment.tsx`, `risk-details.tsx`, `administration-workspace.tsx`: one description string each.
- Tests: `analyst-route-gate.test.tsx` and `interface-copy-guard.test.ts` (new); `server-only-boundary.test.ts`, `record-route-titles.test.ts`, `questionnaire-workflow.test.tsx`, `states.test.tsx`; the two journeys.

## Decisions Made

- The route tests use the real `can()` and mock only the session adapter and the services.
- `AnalystRefusal` lives in `assessment-detail.tsx` and is type-imported by the other two components.
- The editor's back link shows on every non-role safe state, matching the request hub and questionnaire review.
- The E2E "no link into the analyst routes" check is page-wide (`a[href^="/app/review"]`), so it covers the shell navigation as well as the page body.
- I ran the full Playwright suite even though the plan asks only for the two journeys. The gate changes what the production-hardening sweep, the governance denial and the accessibility routes render, so they needed a run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The record-title test's session mock moved forward to Task 1**
- **Found during:** Task 1 (GREEN)
- **Issue:** Once the request route's `generateMetadata` awaits the gate, `record-route-titles.test.ts` would reach the real development session adapter (`next/headers` outside a request) and fail.
- **Fix:** Task 1 adds the session-adapter mock with an analyst session in `beforeEach`; Task 2 adds the refused-viewer cases as planned.
- **Files modified:** `apps/csrm/src/lib/metadata/record-route-titles.test.ts`
- **Verification:** 75/75 in Task 1's run
- **Committed in:** `ea10b91`

**2. [Plan ordering] `AssessmentEditorContent` was exported in the Task 2 RED commit**
- The plan exports it as part of RED so the test can await it. Without the export, the RED failed with `is not a function` instead of on its assertions. With the export, every Requestor case failed on `getAnalystAssessment must not run for a refused viewer`.
- **Committed in:** `354f864`

---

**Total deviations:** 1 auto-fixed (Rule 3), plus one ordering note.
**Impact on plan:** None on scope. Each commit leaves the web suite green.

## Issues Encountered

- **TDD note.** Every RED failed on assertions for the target behaviour (a record read for a refused viewer, or the old copy), never on imports. `workflow.tdd_mode` is not enabled, so no `tdd-red-evidence` record was required. The Task 1 tracer gate (interactive, end-of-phase, automated-only verify) re-ran its verify green before expansion.
- **No harness defect.** Both Playwright runs left the tree clean.

## Deferred / Handed On

- Plans 10-05, 10-09, 10-15, 10-17 and 10-21 add their cleaned files to `guardedFiles` (UI-SPEC 17.2).
- No new item for `deferred-items.md`.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- The gate helper and the refusal variants are ready for the plans that next edit these routes (10-04, 10-12, 10-14 edit `assessment-detail.tsx`).
- Ready for 10-03.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*

## Self-Check: PASSED
