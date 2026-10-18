---
phase: 13-request-pick-up-and-notes
plan: 03
subsystem: api
tags: [strapi, request-assignment, compare-and-set, request-lock, separation-of-duties, catalogue, openapi, zod]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: the approved request assignment record (13-01, G-6, approved by the pilot on 2026-10-09)
  - phase: 10-workflow-integrity-and-generation-reliability
    provides: the closed conflict reason lists, denyConflict and the reason-carrying error details; the second analyst harness identity
  - phase: 12-ai-context-suggestions-and-provenance
    provides: HUMAN_ANALYST_ONLY_OPERATIONS with its matrix mirror and IN-101's own-words refusal pattern
provides:
  - The four private request attributes (assignedAnalyst, assignedAt, assignedBy, assignmentLog) and their two link tables
  - withRequestLock, the one per-request lock every Phase 13 write uses; the 06.1 revert runs inside it
  - PUT /api/v1/assessment_requests/{requestId}/assignee with compare-and-set, the server-derived action, an append-only capped log and every G-1, eligibility and change-rule refusal
  - isEligibleAssignee, deriveAssignmentAction, allowedAssignmentActions, requiresAssignee and assertAssignedAnalyst (REQUEST_UNASSIGNED, NOT_ASSIGNED_ANALYST) for 13-04 and Phase 17.1
  - isEligiblePerson, the shared eligible-person predicate (19.1 D-07), built early
  - request-people.ts (PERSON_FIELDS, projectPerson, resolvePeople) and projectAnalystAssignment
  - function.risk_assessment_requests.assignment_api (role.security_analyst only) and the Phase 13 catalogue design note
  - The policy facts csrmAuthorization.humanAnalyst and csrmAuthorization.viewerId on every allowed decision
  - OWN_REQUEST, ASSIGNMENT_CHANGED, ASSIGNEE_NOT_ELIGIBLE and ASSIGNMENT_REQUIRED in both closed reason lists and both published error schemas
  - The web typed service changeRequestAssignee with its closed parser, registered with the parity guard
affects: [13-04, 13-05, 13-06, 13-07, 13-08, 13-09, 13-10, 13-11, 13-12, 13-19, 17, 17.1, 19.1, 20, 21, 22]
actuals:
  tokens: 31000
  tasks: 2
  commits: 6
plan_head_before: faa7c8f8b3ed0eee99a6d6d9b650495e6da8b017
plan_head_after: 634cc6748850ebab2ec734b4aeef88cf76ea603f
tech-stack:
  added: []
  patterns:
    - "One per-request lock module (a promise tail, then the request row FOR UPDATE) shared by every writer to a request; never nested, always the first row a transaction locks"
    - "Current fact plus an append-only, schema-versioned, capped log written in one documents.update (the 06.8 split); the log is never read by an authorisation decision and reads fail safe to null"
    - "People cross the API as documentId and displayName only, resolved by one bounded read of PERSON_FIELDS"
    - "Every allowed policy decision carries the resolved caller's humanAnalyst and viewerId facts"
key-files:
  created:
    - apps/backend/src/api/csrm-assessment-request/services/request-lock.ts
    - apps/backend/src/api/csrm-assessment-request/services/request-people.ts
    - apps/backend/src/api/csrm-assessment-request/services/request-assignment-policy.ts
    - apps/backend/src/api/csrm-assessment-request/services/assignment-log.ts
    - apps/backend/src/api/csrm-assessment-request/services/request-assignment.ts
    - apps/backend/src/api/csrm-assessment-request/routes/request-assignment.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/request-assignment.ts
    - apps/backend/src/csrm/people/eligible-person.ts
    - apps/backend/tests/request-assignment.integration.test.ts
    - apps/backend/tests/request-assignment.unit.test.ts
    - apps/csrm/src/features/request-assignment/assignment-domain.ts
    - apps/csrm/src/features/request-assignment/assignment-schema.ts
    - apps/csrm/src/features/request-assignment/assignment-service.ts
    - apps/csrm/src/features/request-assignment/assignment-service.test.ts
  modified:
    - apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json
    - apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts
    - apps/backend/src/api/csrm-assessment-request/operations.ts
    - apps/backend/src/policies/csrm-authorization.ts
    - apps/backend/src/csrm/conflict-reasons.ts
    - apps/backend/types/generated/contentTypes.d.ts
    - docs/references/specification.json
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/served-operations.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/lib/api/conflict-reasons.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
key-decisions:
  - "The G-1 check (OWN_REQUEST, 403) runs first inside the lock, before the draft check and the compare-and-set, so a requesting analyst with a stale view learns only OWN_REQUEST."
  - "An unknown target documentId is ASSIGNEE_NOT_ELIGIBLE (409), the same as any other ineligible target, so the operation never says whether a user exists."
  - "Unassigning clears assignedAt and assignedBy with the assignee; the log keeps who unassigned and when."
  - "The assignment log checks that each event's action agrees with its transition (pick-up: from null to the actor; assign: from null to someone else; reassign: between two different people; unassign: to null), so the history can never record something the change did not do."
  - "isEligibleAssignee composes the shared isEligiblePerson (active, never the Security Analyst Agent; src/csrm/people/eligible-person.ts), the human analyst review grant and 'did not raise the request'; Phase 19.1 reuses isEligiblePerson."
  - "The reason description in both published error schemas now says the list also carries the 403 identity refusal OWN_REQUEST."
  - "The generated Strapi content types were regenerated with strapi ts:generate-types (register only, no database, Keycloak flags off) and committed alone, so nothing is pending for the orchestrator."
requirements-completed: []
coverage:
  - id: D1
    description: "A Security Analyst picks up a submitted request through PUT /api/v1/assessment_requests/{requestId}/assignee; the four facts and one log event are written in one transaction under withRequestLock, and the Requestor's reads carry none of the private facts"
    requirement: "REQ-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-assignment.integration.test.ts#a Security Analyst picks up a submitted request and the facts and one log event are recorded (D-05, D-09)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-assignment.integration.test.ts#the Requestor's request reads carry none of the private assignment facts after a pick-up (D-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Separation of duties and eligibility: OWN_REQUEST for every action on one's own request; ASSIGNEE_NOT_ELIGIBLE for the service agent, an inactive analyst, the requestor, another Requestor and an unknown id; refusals by grant for the Requestors, the service agent and an inactive analyst; every refusal leaves persistence deep-equal"
    requirement: "REQ-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-assignment.integration.test.ts#an analyst who raised a request is refused every assignment action on it with OWN_REQUEST (G-1)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-assignment.integration.test.ts#naming the service agent, an inactive analyst, the requestor or another Requestor is refused with ASSIGNEE_NOT_ELIGIBLE"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/authorization-matrix.integration.test.ts#every human-analyst-only operation is served and its row denies the owner, the other Requestor and the service agent"
        status: pass
    human_judgment: false
  - id: D3
    description: "Compare-and-set and the change rules: the concurrent pick-up race, a stale expectedAnalyst, a draft, a released request (reassign yes, unassign no), a pre-Phase-13 released pick-up, the revert keeping the assignee, the no-op and the log cap"
    requirement: "REQ-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-assignment.integration.test.ts#two analysts picking up at once never overwrite each other: one succeeds and the other is told ASSIGNMENT_CHANGED (D-05)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-workflow.integration.test.ts#a revert and a pick-up sent together on one request both complete under the one request lock"
        status: pass
    human_judgment: false
  - id: D4
    description: "assertAssignedAnalyst built and unit-tested for Phase 17.1, wired to nothing; no questionnaire, assessment, Risk or control implementation code reads the assignment policy"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/backend/tests/request-assignment.unit.test.ts#assertAssignedAnalyst refuses with NOT_ASSIGNED_ANALYST (403) another analyst, a lapsed assignee and a caller without the human grant"
        status: pass
    human_judgment: false
  - id: D5
    description: "The contract chain: spec path and components, generated client, both catalogue copies byte-identical, the served inventory naming the web caller, the closed web parser and the parity guard"
    verification:
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts#Phase 13 request assignment is held by one human Security Analyst-only Function and published in the contract"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/request-assignment/assignment-service.test.ts"
        status: pass
    human_judgment: false
duration: 49min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 03: Request Assignment Operation Summary

**A Security Analyst can pick up, assign, reassign or unassign a submitted request through one Strapi operation. It does a compare-and-set under the shared request lock, writes an append-only capped history and enforces G-1 separation of duties, and the web's typed service can call it. `assertAssignedAnalyst` is ready for Phase 17.1.**

## Performance

- **Duration:** 49min
- **Started:** 2026-10-08T15:05:00Z
- **Completed:** 2026-10-08T15:53:46Z
- **Tasks:** 2 (each RED, then GREEN)
- **Files modified:** 36

## Accomplishments

- **Schema.** The four approved attributes are on `CsrmAssessmentRequest`, exactly as the record names them: private and one-way, with no `inversedBy`. A fresh database reads legacy requests as unassigned. `PRAGMA table_info` lists `assigned_at` and `assignment_log` and both link tables (`csrm_assessment_request_id`, `idambox_user_id`).
- **Lock.** `withRequestLock` (`request-lock.ts`) is the one per-request lock. The 06.1 revert runs inside it; `serializeRequestRevert`, `lockRequest` and `requestRevertTails` are gone. Its doc comment states the CR-101 lock order and names the three other request-row lock paths. Nothing under `csrm-questionnaire` or `csrm-assessment` calls it, and it imports neither.
- **Operation.** `PUT /api/v1/assessment_requests/{requestId}/assignee` checks its guards in the planned order: 404, `OWN_REQUEST` 403, `REQUEST_NOT_SUBMITTED`, `ASSIGNMENT_CHANGED`, `ASSIGNEE_NOT_ELIGIBLE`, `ASSIGNMENT_REQUIRED`, then the no-op, then `HISTORY_UNAVAILABLE`. It then writes the facts and the log in one `documents.update`. The response is `{ assignee, assignedBy, assignedAt, actions, ownRequest, history }`, and people cross it as `documentId` and `displayName` only.
- **Grant.** `function.risk_assessment_requests.assignment_api` is written both ways (the Function's `roleIds` and `role.security_analyst`'s `functionIds`). The two catalogue copies are byte-identical. A Phase 13 design note records that the agent holds none of Phase 13's Functions. The operation is in `HUMAN_ANALYST_ONLY_OPERATIONS` and its matrix mirror, so the human-only count is now 13. A mis-granted automation identity is told `CSRM request assignment requires a human Security Analyst.`
- **Matrix.** The row for `PUT:/api/v1/assessment_requests/{requestId}/assignee` is `humanAnalystOnly(200)`. It denies the owner, the other Requestor, the service agent and the caller with no identity (403), and the caller with no token (401). Each denial is checked against two persistence snapshots, and Bob's success is proven by the mounted pick-up test.
- **Reasons.** `OWN_REQUEST`, `ASSIGNMENT_CHANGED`, `ASSIGNEE_NOT_ELIGIBLE` and `ASSIGNMENT_REQUIRED` are in both closed lists, in the same order. Both error schemas publish them.
- **Web.** `features/request-assignment/`: a zod-free domain, closed parsers that mirror `ActiveUserSummary` without bounds, and `changeRequestAssignee` (`import 'server-only'`), registered with the parity guard.

## Test Counts

- **Task 1 verify:** cmp silent; `api:check` clean; vitest `Tests 170 passed` (request-assignment, the parity guard, the chain guard); web typecheck and Strapi `tsc` over `src` and tests clean. The six node:test files ran `# pass 166 / # fail 0`: request-assignment.integration, request-workflow.integration, contract-catalogue.integration, served-operations.integration, authorization-matrix-provenance.unit and authorization-matrix.integration.
- **After the fix commit:** every backend unit file ran `# pass 394 / # fail 0`.
- **Task 2 focused:** request-assignment.unit, authorization-policy.unit, conflict-reasons.unit and request-assignment.integration ran `# pass 47 / # fail 0`. The web reason, assignment, parity and chain tests ran `Tests 221 passed`. `api:check` was clean and the web typecheck passed.
- **Full Strapi suite (`pnpm --dir apps/backend test`, once, at the end):** `# pass 850 / # fail 0` (`ℹ tests 850`, about 15.7 minutes, exit 0), with the dev servers stopped and nothing listening on 1337 or 3000.
- **Race test, observed:** one pick-up 200, the other 409 with `details` exactly `{ reason: "ASSIGNMENT_CHANGED" }`. The persisted assignee is the winner and the log holds one event. On SQLite, the in-process tail and the single connection serialise the two pick-ups. The PostgreSQL row lock is still unproven until R-08-37 runs.
- **Matrix:** one new row (the assignee operation); the human-only count is 13 (`13 + insightOperations.size`).

## Task Commits

1. **Task 1 RED:** `940e3b3` (test). Mounted pick-up, private facts, schema columns, the shared-lock case, the matrix row and count, the catalogue and contract expectation, and the web service test.
2. **Task 1 GREEN:** `1ac2f3b` (feat). The schema, the lock, the operation, the grant, the contract, the served inventory and the web service.
3. **Generated types:** `5c1302c` (chore(backend)). `contentTypes.d.ts` only.
4. **Rule 1 fix:** `3402853` (fix). The decision assertions name the new policy facts.
5. **Task 2 RED:** `b864090` (test). Every refusal, the race, the cap, the unit predicates, the mis-granted agent's sentence and the reason lists.
6. **Task 2 GREEN:** `634cc67` (feat). The closed reasons, `assertAssignedAnalyst` and the denial sentence.

## Decisions Made

- **OWN_REQUEST first.** It is decided before every other rule, so a requesting analyst learns only that this is their own request (Pitfall 5).
- **Unknown target.** A target documentId that names no user is refused as `ASSIGNEE_NOT_ELIGIBLE`, never a 404, so the operation does not reveal whether a user exists.
- **Unassign.** Unassigning clears `assignedAt` and `assignedBy`; the log keeps who unassigned the request, when and why.
- **Log consistency.** Each event's action must agree with its transition, so the closed parser refuses a history that contradicts itself.
- **Reason text.** A reason is trimmed, 1 to 500 characters, with the newline allowed and every other C0 control character refused.
- **Policy facts.** `humanAnalyst` and `viewerId` are set on every allowed decision, right after the human-only check, from the resolved IdamBox User and never from the query (T-13-09).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two unit files compare whole policy decisions**
- **Found during:** after Task 1 GREEN, in the backend unit run.
- **Issue:** `authorization-policy.unit` (the My routes case) and `analyst-insight-authorization.unit` (five insight cases) compared whole decisions. They failed once every allowed decision carried `humanAnalyst` and `viewerId`.
- **Fix:** both expectations now name the two facts. The insight case keeps its point: no scope widens.
- **Files modified:** `apps/backend/tests/authorization-policy.unit.test.ts`, `apps/backend/tests/analyst-insight-authorization.unit.test.ts`
- **Verification:** all backend unit files ran `# pass 394 / # fail 0`.
- **Committed in:** `3402853`

**2. [Orchestrator overlay - allowed deviation] The shared eligible-person predicate, built now**
- `apps/backend/src/csrm/people/eligible-person.ts` exports `isEligiblePerson`: an active user who does not hold the Security Analyst Agent role. It fails closed when the status or roles are missing.
- `isEligibleAssignee` composes it, then adds the human analyst review grant and "did not raise the request".
- It was cheap: one 20-line module, unit-tested in `request-assignment.unit.test.ts`.
- **Committed in:** `1ac2f3b` (module) and `b864090` (tests).

**3. [Orchestrator overlay v2] The generated content types were regenerated and committed**
- **Plan:** record the `contentTypes.d.ts` regeneration as pending.
- **What changed:** the overlay says to commit it alone. It was produced with `strapi ts:generate-types` (register only, no database, Keycloak flags off, deterministic AI provider) and committed alone in `5c1302c`. The diff is exactly the four attributes, and `components.d.ts` did not change.
- **Effect:** the plan's acceptance line "`git diff --name-only PHASE_13_BASE..HEAD -- apps/backend/types/generated` prints nothing" no longer holds. The overlay supersedes it, and nothing is pending.

**4. [Rule 2 - Missing critical] Harness helpers for the persistence checks**
- The harness gained `getRequestAssignment` (the four private facts, relations as documentIds) and `listTableColumns` (`PRAGMA table_info`), beside the planned `users.inactiveAnalyst`.
- Without them, the deep-equal persistence checks and the matrix row could not see the private facts, which Document Service reads do not populate by default.

---

**Total deviations:** 4 (one Rule 1 fix, one Rule 2 addition, two orchestrator-directed).
**Impact on plan:** none widens scope. The content-type change is exactly the approved schema file.

## Issues Encountered

- **`api:check` before staging.** `api:check` runs `git diff --exit-code` on the generated client, so it fails while the regenerated `schema.d.ts` is unstaged. It was run after staging the spec and the client, then followed by `git update-index --refresh`.

## Threat Model Coverage

- **T-13-05:** OWN_REQUEST first, inside the lock. `isEligibleAssignee` excludes the requestor. The mounted cases check persistence deep-equal.
- **T-13-06:** the grant goes to the human analyst only, the operation is human-only, eligibility excludes the agent role, and the matrix has 403 rows.
- **T-13-07:** `expectedAnalyst` is compared after the row lock, and the mounted race passes. The PostgreSQL proof stays open as R-08-37.
- **T-13-08:** one versioned event per change, in the same `documents.update` as the facts. At the cap the change fails closed with `HISTORY_UNAVAILABLE` and nothing is written; this is proven mounted.
- **T-13-09:** `viewerId` and `humanAnalyst` are policy facts of the resolved user.

## User Setup Required

None.

## Next Phase Readiness

- **13-04** can serve `GET …/assignable_analysts` with `CSRM_REQUEST_ASSIGNMENT_OPERATIONS.listAssignableAnalysts`, `isEligibleAssignee`, `resolvePeople` and `projectAnalystAssignment`. Its human-only literal and matrix row take the count to 14.
- **13-05** onward write notes inside `withRequestLock`.
- **REQ-08** stays Pending until the phase gate (the 13-01 and 13-02 precedent). This plan proves criteria 1, 4 and 5 at the API; the UI criteria come later in the phase.

---
*Phase: 13-request-pick-up-and-notes*
*Completed: 2026-10-09*

## Self-Check: PASSED

All 14 created files exist. All six plan commits exist: 940e3b3, 1ac2f3b, 5c1302c, 3402853, b864090, 634cc67. The content-type freeze since ab000f6 lists only the request schema. `assignment-service.ts` starts with `import 'server-only'`, and `assignment-domain.ts` imports nothing from zod.
