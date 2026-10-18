---
phase: 13-request-pick-up-and-notes
plan: 04
subsystem: api
tags: [strapi, request-assignment, people-projection, populate-allow-list, refusal-copy, server-actions, openapi, zod]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: the request assignment operation, isEligibleAssignee, projectAnalystAssignment, request-people.ts, the assignment Function and the human-only literal at 13 (13-03)
  - phase: 10-workflow-integrity-and-generation-reliability
    provides: normalizeTransportError with its closed reason list (10-06) and refusal-copy.ts families A to I (10-07)
  - phase: 12-ai-context-suggestions-and-provenance
    provides: refusal family J and the human-only matrix mirror pattern
provides:
  - GET /api/v1/assessment_requests/{requestId}/assignable_analysts (listAssignableAnalysts, ASSIGNABLE_ANALYSTS_LIMIT 50, ASSIGNABLE_CANDIDATES_LIMIT 200), human-analyst-only, function.risk_assessment_requests.assignment_api.api.02
  - The request read's populate allow-list (ALLOWED_REQUEST_READ_POPULATE, filterRequestReadPopulate) and the projected revertedBy on the read and the revert response (D-04)
  - The request read's assignment field (analyst view or the Requestor's display name alone) with REQUEST_PEOPLE_POPULATE and projectRequestorAssignment
  - Spec AssignableAnalystListResponse (maxItems 50) and AssessmentRequestRequestorAssignment; the request read's populate enum narrowed to four names
  - Web listAssignableAnalysts, listAssignableAnalystsAction, changeAssigneeAction (AssignmentActionResult), pickerOptions, assignmentTitle
  - Refusal family K (requestAssignment) and assignmentRefusal; a transport that keeps a closed-list reason on a 403
  - requestAssignmentViewSchema, RequestAssignmentView and isAnalystAssignmentView on the request detail
affects: [13-05, 13-06, 13-07, 13-08, 13-09, 13-10, 13-11, 13-12, 13-19, 17, 17.1, 19.1]
actuals:
  tokens: 31800
  tasks: 3
  commits: 6
plan_head_before: 92f8f8a18e54970a5ed45787f593dba1525657ee
plan_head_after: 67ebff1f5fc24fa34e92b830045e6a8120ed3368
tech-stack:
  added: []
  patterns:
    - "A caller's populate is filtered to an allow-list before the core handler runs; every person on the record is projected by the server as documentId and displayName"
    - "One eligibility predicate serves both the write and the list a picker offers, so the picker never offers a person the write would refuse"
    - "Server Actions return family copy with a kind (blocked or retryable) and re-read once to name who changed the record"
key-files:
  created:
    - apps/csrm/src/features/request-assignment/assignment-actions.ts
    - apps/csrm/src/features/request-assignment/assignment-actions.test.ts
    - apps/csrm/src/features/request-assignment/assignment-domain.test.ts
  modified:
    - apps/backend/src/api/csrm-assessment-request/services/request-assignment.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/request-assignment.ts
    - apps/backend/src/api/csrm-assessment-request/routes/request-assignment.ts
    - apps/backend/src/api/csrm-assessment-request/services/request-people.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts
    - apps/backend/src/policies/csrm-authorization.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/specification.json
    - docs/references/served-operations.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts
    - apps/backend/tests/authorization-policy.unit.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/request-assignment.integration.test.ts
    - apps/backend/tests/request-workflow.integration.test.ts
    - apps/csrm/src/features/request-assignment/assignment-domain.ts
    - apps/csrm/src/features/request-assignment/assignment-schema.ts
    - apps/csrm/src/features/request-assignment/assignment-service.ts
    - apps/csrm/src/features/request-assignment/assignment-service.test.ts
    - apps/csrm/src/lib/api/refusal-copy.ts
    - apps/csrm/src/lib/api/refusal-copy.test.ts
    - apps/csrm/src/lib/api/transport/server-client.ts
    - apps/csrm/src/lib/api/transport/server-client.test.ts
    - apps/csrm/src/features/requests/request-schema.ts
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/requests/request-service.ts
    - apps/csrm/src/features/requests/request-service.test.ts
key-decisions:
  - "The transport keeps a closed-list reason on a 403 as well as a 409, and on no other status (research A4; the 2026-10-01 confirmation). Before this plan it kept a reason on a 409 only. A 400 still carries none (T-10-14), and that test is unedited."
  - "The human-only count is 14: the eligible-analyst read is a quoted literal in HUMAN_ANALYST_ONLY_OPERATIONS and in the matrix mirror, and a mis-granted automation identity is told 'CSRM request assignment requires a human Security Analyst.'"
  - "Task 3 ran before Task 2, because changeAssigneeAction's ASSIGNMENT_CHANGED re-read needs the request read's assignment field. Each task kept its own RED and GREEN commits."
  - "The request read's spec no longer declares requestor or sponsor as a populated IdamBox User document. requestor is the server's { displayName } projection, and sponsor is gone because it can no longer be populated. This is D-04's 'replacing any populated-user shape'."
  - "filterRequestReadPopulate accepts the string, comma-list, array and object forms. It keeps only the four allowed names, one level deep, and drops *, dotted paths and any nested populate, so no person can be reached through an allowed relation."
  - "changeAssigneeAction takes an optional analystName (the picker's chosen display name), used only to fill ASSIGNEE_NOT_ELIGIBLE's {name}. Without it, the sentence reads 'This Security Analyst …'."
  - "On ASSIGNMENT_CHANGED, when the one re-read fails, the action leaves currentHolder out and reads family K's 409 fallback rather than guess who holds the request. It also revalidates the assignment pages, because someone else changed them."
  - "listAssignableAnalystsAction reads family K for 403, 404 and 409, and the picker's own 'We couldn’t load Security Analysts.' (UI-SPEC §6) when the list could not load."
  - "The eligible-analyst read takes no request lock: it is a read, and the assignment write re-decides eligibility inside the lock."
requirements-completed: []
coverage:
  - id: D1
    description: "GET …/assignable_analysts returns exactly the analysts isEligibleAssignee admits (documentId and displayName, by name, at most 50, searchable by q). The current assignee is kept. A bad query is 400, a draft 409 REQUEST_NOT_SUBMITTED, a missing request 404. The requesting analyst gets 403 OWN_REQUEST, and the Requestors, the service agent and an inactive analyst get 403."
    requirement: "REQ-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-assignment.integration.test.ts#a Security Analyst lists exactly the analysts who may hold a request, by name only and searchable (D-06)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-assignment.integration.test.ts#an analyst who raised a request cannot list who may hold it (OWN_REQUEST), and the Requestors and the service agent are refused (D-07)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/authorization-matrix.integration.test.ts#every human-analyst-only operation is served and its row denies the owner, the other Requestor and the service agent"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts#Phase 13 eligible-analyst read is held by the assignment Function alone and published as a closed list of at most 50 people"
        status: pass
    human_judgment: false
  - id: D2
    description: "The web's changeAssigneeAction and listAssignableAnalystsAction call Strapi only through the typed service. They map every refusal to family K verbatim with its kind, and on ASSIGNMENT_CHANGED re-read once and name the holder. The transport keeps OWN_REQUEST on a 403."
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-assignment/assignment-actions.test.ts"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/api/refusal-copy.test.ts#assignmentRefusal (family K)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/api/transport/server-client.test.ts#keeps a closed-list reason on a 403 identity refusal"
        status: pass
    human_judgment: false
  - id: D3
    description: "The request read carries assignment: the analyst view (actions per viewer, ownRequest, history, with null when the log is malformed) or the Requestor's { assignee: { displayName } }."
    requirement: "REQ-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-assignment.integration.test.ts#the request read names who holds the request: the analyst view for analysts and the display name alone for the Requestor (D-09, D-16, D-17)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-assignment.integration.test.ts#an analyst reading a request they raised sees ownRequest and no actions, and a malformed history reads as unavailable"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-04: populate=revertedBy, populate=* and the object forms return no email, username, external subject, account status or names. revertedBy is projected on the read and on the revert response, and the web never asks for it."
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-workflow.integration.test.ts#the request read projects people: revertedBy is a documentId and a display name, and populate=* returns no email (D-04)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-service.test.ts#reads both assignment views and the projected revertedBy, and refuses an assignment with a key the contract does not declare"
        status: pass
    human_judgment: false
duration: 43min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 04: Eligible Analysts, Assignment Actions and the People-Projected Request Read Summary

**What this plan adds:**

- A Security Analyst's typed layer can list exactly who may hold a request, through a human-only Strapi read bounded at 50 people.
- The web can change the assignee, and when the change is refused it says why in family K's words, naming the current holder.
- The request read names who holds every request and returns every person as a documentId and display name only, which closes the `populate=revertedBy` and `populate=*` user-record leak (D-04).

## Performance

- **Duration:** 43min
- **Started:** 2026-10-08T15:55:56Z
- **Completed:** 2026-10-08T16:38:10Z
- **Tasks:** 3, each RED then GREEN
- **Files modified:** 33

## Accomplishments

### The eligible-analyst read

- **Strapi.** `listAssignableAnalysts` refuses in this order:
  - 404 for a missing request;
  - 403 `OWN_REQUEST` when the caller raised the request;
  - 409 `REQUEST_NOT_SUBMITTED` for a draft.

  It then makes one bounded read of active users with the `Security Analyst` role (200 candidates, by `displayName` then `id`, `q` as `$containsi`). Each candidate passes through `isEligibleAssignee`, and the first 50 are projected with `projectPerson`.
- **Query.** The controller accepts only `q`, 1 to 100 characters after trimming. Any other key is a 400.
- **Grant.** The route is the human-only literal in `csrm-authorization.ts` and in the matrix mirror, so the count is now 14. In both catalogue copies, which are byte-identical, it is `assignment_api.api.02`. The served inventory names `src/features/request-assignment/assignment-service.ts` as its web caller.

### Web assignment actions

- **Service and domain.**
  - `listAssignableAnalysts` uses a closed parser bounded at 50 and registered with the parity guard.
  - `pickerOptions` drops the current assignee and keeps the server's order.
  - `assignmentTitle` names the picker.
- **`changeAssigneeAction`.**
  - It validates its input strictly and refuses a reason over 500 characters with "Keep the reason to 500 characters or fewer.".
  - It calls `changeRequestAssignee` once and, on success, revalidates the five pages.
  - On `ASSIGNMENT_CHANGED` it calls `getRequest` once and returns `currentHolder` with family K's holder sentence, or the returned-to-queue sentence.
- **`listAssignableAnalystsAction`.** It reads family K for a refusal, and the picker's own error sentence when the list could not load.
- **Family K and the transport.**
  - Family K is in `refusal-copy.ts` exactly as §7.4 words it, and no sentence says "Accept" or "release".
  - `normalizeTransportError` now keeps a validated reason on a 403 as well as a 409. Before this plan it kept one on a 409 only (research A4).

### The request read

- **Populate allow-list.** `findOne` filters the caller's `populate` through `filterRequestReadPopulate` before `super.findOne`.
- **People.** It reads the people once with `REQUEST_PEOPLE_POPULATE` (`PERSON_FIELDS` only) and adds:
  - the projected `revertedBy`;
  - `assignment`: the analyst view for a human Security Analyst reading through the analyst grant, otherwise `{ assignee: { displayName } | null }`.
- **Revert response.** The revert response's `revertedBy` is projected the same way.
- **Spec and web.**
  - The populate enum is the four names.
  - The response declares `revertedBy` and `assignment`. `assignment` is `oneOf` the analyst view and the new `AssessmentRequestRequestorAssignment`.
  - The web parses both views closed and no longer asks for `revertedBy`.

## Test Counts

- **Task 1:**
  - RED: web 8 failed and 5 passed; Strapi 7 failing, as expected.
  - GREEN: cmp silent, `api:check` clean, vitest `Tests 208 passed` (request-assignment, parity, chain, zod boundary), web typecheck and Strapi `tsc` clean.
  - node:test over request-assignment.integration, contract-catalogue.integration, served-operations.integration, authorization-policy.unit, authorization-matrix-provenance.unit and authorization-matrix.integration: `# pass 196 / # fail 0`.
  - `served-operations:write`: `# pass 7 / # fail 0`.
- **Task 3** (run before Task 2):
  - RED: Strapi 3 failing (the D-04 case failed on `UNEXPECTED_REVERT_RESPONSE_PERSON_KEYS`); web 2 failing.
  - GREEN: request-assignment.integration and request-workflow.integration `# pass 24 / # fail 0`; `api:check` clean; vitest `Tests 262 passed` (requests, parity, chain); web typecheck clean.
- **Task 2:**
  - RED: 20 family K and action cases and the 403 transport case failing.
  - GREEN: vitest `Tests 281 passed` (request-assignment, refusal-copy, server-client, interface-copy guard); web typecheck clean.
- **Full Strapi suite** (`pnpm --dir apps/backend test`, once, after Task 3's GREEN; Task 2 changed no backend file): `# pass 857 / # fail 0` (`ℹ tests 857`, about 16 minutes, exit 0). Nothing was listening on 1337 or 3000.
- **Full web suite** (after Task 2): `Test Files 169 passed`, `Tests 3741 passed`.
- **Matrix:** one new row, `GET:/api/v1/assessment_requests/{requestId}/assignable_analysts`, `humanAnalystOnly(200)`, issued by the matrix itself (`exercisesAllowed`). The human-only count is `14 + insightOperations.size`.

## Task Commits

1. **Task 1 RED:** `e0f3150` (test)
2. **Task 1 GREEN:** `b6600c4` (feat)
3. **Task 3 RED:** `d49a250` (test)
4. **Task 3 GREEN:** `170a96e` (fix)
5. **Task 2 RED:** `37b11ae` (test)
6. **Task 2 GREEN:** `67ebff1` (feat)

## Decisions Made

- **403 reason in the transport.** A closed-list reason now crosses on 403 and 409 only. `OWN_REQUEST` is an identity refusal that stays a 403 (the 2026-10-01 confirmation). A 400 still drops any reason (T-10-14).
- **Task order.** Task 3 ran before Task 2, because the `ASSIGNMENT_CHANGED` re-read reads the request read's `assignment` field.
- **The read's people shapes.** The spec's request read now declares `requestor` as the server's `{ displayName }` projection and drops `sponsor`, which can no longer be populated. It previously declared both as full IdamBox User documents, which the server never returned after this plan (D-04).
- **`analystName` input.** `changeAssigneeAction` accepts an optional `analystName`, used only to fill the `ASSIGNEE_NOT_ELIGIBLE` sentence. The server never sees it.
- **Unknown holder.** When the `ASSIGNMENT_CHANGED` re-read fails, the action reads family K's 409 fallback and leaves `currentHolder` out. It never guesses who holds the request.
- **Populate filter.** Each allowed relation is populated one level deep only, so no person can be reached through `assessment` or `questionnaire`.

## Deviations from Plan

### Ordering and small additions

**1. [Plan ordering] Task 3 executed before Task 2**
- **Reason:** Task 2's `changeAssigneeAction` reads `getRequest(...).data.assignment`, which Task 3 adds to the request detail parser and domain.
- **Effect:** none on scope. Each task kept its own RED and GREEN commits, and every verify ran.

**2. [Rule 2 - Missing critical] The spec's request read no longer advertises a populated user document**
- **Found during:** Task 3, while declaring `revertedBy` and `assignment`.
- **Issue:** the findOne response schema declared `requestor` and `sponsor` as `ApiIdamboxUserIdamboxUserDocument`. That is the shape D-04 removes, and it was never what the server served for `requestor`.
- **Fix:** `requestor` is now `{ displayName }`, closed, and `sponsor` is removed. The generated client was regenerated, and `api:check` and the parity guard pass.
- **Commit:** `170a96e`

**3. [Rule 2 - Missing critical] `analystName` on `changeAssigneeAction`**
- **Issue:** §7.4's `ASSIGNEE_NOT_ELIGIBLE` sentence names the analyst, but the planned strict input carried only documentIds.
- **Fix:** an optional `analystName` (1 to 255 characters), used for that sentence only.
- **Commit:** `67ebff1`

**4. [Plan file list] `contract-response-parity.test.ts` unchanged**
- The new parser is registered through `assignment-service.ts`'s `responseParserModule`, which the guard already imports, so the guard's own file needed no edit.

---

**Total deviations:** 4 (one ordering, two Rule 2 additions, one file-list note).
**Impact on plan:** none widens scope. No content-type schema changed: the freeze check since `ab000f6` still lists only 13-03's approved request schema.

## Issues Encountered

- **`api:check` before staging.** `api:check` diffs the generated client against the index, so the spec and `schema.d.ts` were staged before running it, as 13-03 did. `git update-index --refresh` followed.
- **Line endings.** Several files are CRLF in the working tree. Edits kept each file's own ending.

## Threat Model Coverage

- **T-13-10:**
  - `filterRequestReadPopulate` runs before `super.findOne`, and people are projected.
  - The mounted test proves no `email`, `username`, `externalSubject`, `accountStatus`, `firstName` or `lastName` in any of seven populate forms, for both the analyst and the Requestor.
  - The revert response is projected.
- **T-13-11:**
  - The read is human-analyst-only twice, through the grant and the human-only literal.
  - The requesting analyst gets `OWN_REQUEST`.
  - The result is bounded at 50 people with a 100-character term, and only eligible people appear, by name.
- **T-13-12:** the Requestor's view is `{ assignee: { displayName } }` only. The test checks that no analyst documentId appears in Jane's read.
- **T-13-13:** `expectedAnalyst` is sent as the page showed it. `ASSIGNMENT_CHANGED` re-reads and names the holder.
- **T-13-SC:** no package was added.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: query-oracle (pre-existing, not widened) | apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts | The request read still passes the caller's `filters` to the core handler. Filters only narrow a single-record read the caller is already allowed, and the spec lists scalar filter keys only. A relation filter (for example on `requestor`) could still act as a yes-or-no oracle about a related person. Not introduced here; a candidate for the code review. |

## User Setup Required

None.

## Next Phase Readiness

- 13-09's request page has what it needs:
  - `listAssignableAnalystsAction`, `changeAssigneeAction`, `pickerOptions` and `assignmentTitle`;
  - family K through `assignmentRefusal`;
  - the read's `assignment`, through `isAnalystAssignmentView`.
- 13-06 moves the human-only count to 15 with the AI-input mark.
- REQ-08 stays Pending until the phase gate, as in 13-01 to 13-03. This plan proves criterion 1 (the assignee's name on the request) and criterion 5's picker at the API and the typed web layer.

---
*Phase: 13-request-pick-up-and-notes*
*Completed: 2026-10-09*

## Self-Check: PASSED

All three created files exist. All six plan commits exist: e0f3150, b6600c4, d49a250, 170a96e, 37b11ae, 67ebff1. Both catalogue copies are byte-identical, `assignment-actions.ts` starts with `'use server'` and imports nothing from `@/lib/api/transport`, `request-service.ts` has no `revertedBy` in a populate array, and the content-type freeze since ab000f6 lists only the request schema 13-03 changed.
