---
phase: 10-existing-flow-gap-closure
plan: 13
subsystem: api
tags: [strapi, authorization, catalogue, openapi, zod, server-actions, generation-jobs]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-06 closed conflict reasons and safeError details; 10-11 generation workflow and controller; 10-12 hub job panel copy"
provides:
  - "GET /api/v1/assessment_requests/{requestId}/generation_jobs: the request's questionnaire generation job and its questionnaire's assessment draft job, each with the viewer's canRetry (D-25)"
  - "Function function.questionnaire_generation.request_jobs_read_api (role.security_analyst only) in both catalogue copies, and the literal in HUMAN_ANALYST_ONLY_OPERATIONS"
  - "latestForRequest (questionnaire generation registry) and latestForQuestionnaire (assessment draft registry)"
  - "getRequestGenerationJobs (workflow) and latestAssessmentDraftJobForQuestionnaire (assessment workflow)"
  - "Spec schemas RequestGenerationJobsResponse, RequestGenerationJobs, RequestQuestionnaireGenerationJob, RequestAssessmentDraftJob and the regenerated client"
  - "Web requestGenerationJobsResponseSchema, type RequestGenerationJobs, getRequestGenerationJobs (service, registered parser) and getRequestGenerationJobsAction"
  - "Harness identity second-analyst (identities.secondAnalyst, users.secondAnalyst)"
affects: [10-14, phase-13-job-reads, phase-21-jobs]

actuals:
  tokens: 17279
  tasks: 3
  commits: 5
plan_head_before: 4f04aa4bb78cf29a34a00d3d9a43d79a817f504c
plan_head_after: 12a3680bcd94a492cde5eaf602bbb19194361d47

tech-stack:
  added: []
  patterns:
    - "A shared status read beside initiator-only by-id reads: the registry read neither authorises nor touches lastAccess, and returns only a per-viewer canRetry beside the closed job projection"
    - "A nullable reference in the spec is anyOf [$ref, {type: null}] with the object branch first, so the parity guard exercises the job parsers in every non-nullable mode"

key-files:
  created:
    - .planning/phases/10-existing-flow-gap-closure/10-13-SUMMARY.md
  modified:
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-draft-registry.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
    - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
    - apps/backend/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts
    - apps/backend/src/api/csrm-questionnaire/operations.ts
    - apps/backend/src/policies/csrm-authorization.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - docs/references/served-operations.json
    - apps/csrm/src/features/assessments/assessment-schema.ts
    - apps/csrm/src/features/assessments/assessment-service.ts
    - apps/csrm/src/features/assessments/assessment-actions.ts
    - apps/csrm/src/features/assessments/assessment-actions.test.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - apps/backend/tests/questionnaire-generation.integration.test.ts
    - apps/backend/tests/questionnaire-generation.unit.test.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts

key-decisions:
  - "D-27 holds as the code stands: another analyst's by-id job read is refused with 403 (the registry's authorize), not the 404 the plan's truths name; the mounted case asserts that unchanged 403 with no data"
  - "A completed questionnaire generation job whose questionnaire can no longer be loaded reads as null on the request read instead of failing it, so the hub never loses both panels to one stale job"
  - "The request read selects the active job, else the retained job with the latest queuedAt (ties: the job registered last); the draft read first takes the job the questionnaire is mapped to"
  - "The matrix row issues the analyst's 200 (exercisesAllowed) on the seeded submitted request instead of citing a proof, and keeps the mounted refusal test as seeAlso"

patterns-established:
  - "Per-viewer facts on a shared read: compute canRetry from the registry's initiator id and never project the id"

requirements-completed: [UX-06]

coverage:
  - id: D1
    description: "An analyst reads a request's running questionnaire generation job (status, canRetry true for the initiator, no draft job) through GET /api/v1/assessment_requests/{requestId}/generation_jobs"
    requirement: UX-06
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-generation.integration.test.ts#mounted analyst reads the running questionnaire generation job of a request"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every human analyst sees the same job; only its initiator may retry it; the by-id read stays initiator-only (D-27)"
    requirement: UX-06
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-generation.integration.test.ts#mounted analysts share a request's running job and only its initiator may retry it"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/questionnaire-generation.unit.test.ts#latestForRequest returns the active job, else the latest retained job, with the viewer's retry right"
        status: pass
    human_judgment: false
  - id: D3
    description: "The read returns the assessment draft job for the request's questionnaire under assessmentDraft"
    requirement: UX-06
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-generation.integration.test.ts#mounted request generation read returns the draft job for the request's questionnaire"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/questionnaire-generation.unit.test.ts#latestForQuestionnaire returns the questionnaire's current draft job with the viewer's retry right"
        status: pass
    human_judgment: false
  - id: D4
    description: "No jobs read as two nulls; an unknown request is 404; Requestors, the role-less and service identities and no identity get 403 (T-10-32)"
    requirement: UX-06
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-generation.integration.test.ts#mounted request generation read answers no jobs, an unknown request and every refused caller"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/authorization-matrix.integration.test.ts#GET:/api/v1/assessment_requests/{requestId}/generation_jobs answers each actor as stated"
        status: pass
    human_judgment: false
  - id: D5
    description: "The D-02 chain: exact grant in both byte-identical catalogue copies, human-analyst guard literal, spec plus regenerated client, closed registered parser, matrix row and regenerated served-operations inventory"
    verification:
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts#questionnaire generation routes have byte-identical catalogue and human-only effective grants"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/served-operations.integration.test.ts#the checked-in served-operations inventory matches the mounted Strapi"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts#getRequestGenerationJobs accepts the payload its contract component declares"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-operation-chain.test.ts#agrees with the served-operations inventory about which operations the web calls, and from where"
        status: pass
      - kind: other
        ref: "pnpm --dir apps/csrm api:check (clean)"
        status: pass
    human_judgment: false
  - id: D6
    description: "getRequestGenerationJobsAction polls by request identifier alone, maps refusals through serviceFailure and revalidates nothing"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-actions.test.ts#polls the generation jobs of a request by request identifier alone, without revalidating"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-actions.test.ts#refuses a request generation poll the server refuses, without disclosing why"
        status: pass
    human_judgment: false

duration: 33min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 13: Request generation-jobs read Summary

**`GET /api/v1/assessment_requests/{requestId}/generation_jobs` is now a human-analyst-only read. It returns the request's questionnaire generation job and its questionnaire's assessment draft job, each in its existing closed shape with the viewer's `canRetry`, and comes with a new API-only grant, contract, registered parser, polling Server Action, matrix row and inventory entry.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-10-02T07:36:54Z
- **Completed:** 2026-10-02T08:10:20Z
- **Tasks:** 3 of 3
- **Files modified:** 23 (plus this SUMMARY)

## Accomplishments

- **Strapi.**
  - The questionnaire registry's `latestForRequest` returns the active job, else the retained job queued last.
  - The draft registry's `latestForQuestionnaire` returns the questionnaire's mapped job, else the retained job queued last.
  - Neither read authorises or touches `lastAccess`. `get`, `retry` and `authorize` are unchanged (D-27).
  - `getRequestGenerationJobs` returns 404 for a missing request. Otherwise it projects both jobs with the existing projections (the initiator is never disclosed) and adds the viewer's `canRetry` beside each.
- **Authorization.**
  - The route goes through `generationPolicies(getRequestGenerationJobs, true)`, whose request scope passes an explicit analyst operation.
  - The literal is in `HUMAN_ANALYST_ONLY_OPERATIONS`.
  - The new Function `function.questionnaire_generation.request_jobs_read_api` and its FunctionAPI are held by `role.security_analyst` only, and both catalogue copies are byte-identical (`cmp` silent).
- **Contract.** The path is in the spec with `questionnaire-generation/get-request-generation-jobs` and four closed schemas, and the client is regenerated. `api:check` is clean.
- **Web.**
  - `requestGenerationJobsResponseSchema` reuses the two closed job schemas and is registered in the parity guard; the grandfather count is still 43.
  - `getRequestGenerationJobs(requestId)` is in the assessment service.
  - `getRequestGenerationJobsAction` polls without revalidating.
- **Proofs.**
  - Unit: registry selection.
  - Mounted:
    - the initiator reads the held job;
    - a second analyst reads the same job with `canRetry: false` and is still refused the by-id read;
    - the draft job is returned for the request's questionnaire;
    - a request with no jobs reads as two nulls, and an unknown request is 404;
    - the owner, the other Requestor, the role-less agent, the service agent and a caller with no identity get 403.
  - Matrix row `humanAnalystOnly(200)`.
  - Catalogue test route and the regenerated `served-operations.json`, whose web caller is `src/features/assessments/assessment-service.ts`.

## Task Commits

1. **Task 1: an analyst reads a request's running questionnaire job through the whole contract chain.** RED `847b3ed` (test), GREEN `041c08c` (feat).
2. **Task 2: the draft job, retry rights for other analysts, the refusals and the matrix row.** RED `2f478b9` (test), GREEN `a5f01b9` (feat).
3. **Task 3: a polling action for the hub, then both full suites.** `12a3680` (feat).

**Plan metadata:** the docs commit that follows this SUMMARY.

## TDD record

- **Task 1 RED.** The mounted case failed on its target assertion `REQUEST_GENERATION_JOBS_NOT_READ_analyst` (404 !== 200, because no route existed). `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK`.
- **Task 2 RED.**
  - The mounted draft case failed on `REQUEST_GENERATION_JOBS_DRAFT_JOB` (`assessmentDraft` was null), with `RED_EVIDENCE_OK`.
  - The draft-registry unit case failed on `DRAFT_REGISTRY_HAS_NO_LATEST_READ`.
  - The shared-read, refusal and `latestForRequest` cases already passed at RED, because Task 1 had implemented them. They are regression proofs, not the RED target.
- **GREEN** commits follow each RED. Nothing needed a refactor.

## Tests run

| Run | Result |
|-----|--------|
| Task 1 RED, mounted case, TAP | 1 test, 1 failed on its target assertion |
| Task 1 verify: `cmp`; vitest parity and chain guards; `api:check`; web typecheck; the Strapi tests' `tsc`; node:test on the questionnaire-generation, served-operations and contract-catalogue integration files | `cmp` silent; vitest 149/149; `api:check` and typecheck clean; node:test 32/32 (76.6 s) |
| Task 2 RED, both generation files | 19 tests, 17 passed, 2 failed (the two targets) |
| Task 2 verify: the questionnaire-generation unit and integration files, contract-catalogue, authorization-matrix-provenance unit and authorization-matrix integration | 161/161 in 96.9 s for all five files; the new matrix row ran in 93 ms |
| `assessment-actions.test.ts` | 26/26 |
| Full web suite (`pnpm --dir apps/csrm test`) | 2,553/2,553 passed in 125 files, 0 failed, 0 skipped, 33 s |
| Web typecheck, lint and `api:check` | clean; the schema index was refreshed afterwards |
| Full Strapi suite (`pnpm --dir apps/backend test`) | 600/600 passed, 0 failed, 0 skipped, 0 cancelled; 756 s by node:test, 762 s wall |
| Playwright | not run (the plan runs none) |

## `narrowedPaths` registered for `getRequestGenerationJobs`

- **The per-state restructure of the flat `QuestionnaireGenerationJob` component**, narrowed exactly as `getQuestionnaireGenerationJob` narrows it:
  - `data.questionnaireGeneration.job.startedAt`
  - `data.questionnaireGeneration.job.completedAt`
  - `data.questionnaireGeneration.job.failureCode`
  - `data.questionnaireGeneration.job.failureMessage`
  - `data.questionnaireGeneration.job.questionnaire`
- **The reused job parsers' identifier bounds**, which the by-id job operations declare later (D-27, Phase 13):
  - `data.questionnaireGeneration.job.jobId`
  - `data.questionnaireGeneration.job.requestId`
  - `data.questionnaireGeneration.job.providerName`
  - `data.questionnaireGeneration.job.providerVersion`
  - `data.assessmentDraft.job.jobId`
  - `data.assessmentDraft.job.questionnaireId`
- The new label is not in `boundaryGrandfathered`, which keeps 43 entries.

## Decisions Made

- The second analyst's by-id read stays **403**. The plan's truths say 404, but the by-id route has always answered a non-initiator through `authorize` with 403. D-27 forbids changing that operation, so the mounted case asserts the unchanged 403 and that no data is returned.
- A completed questionnaire job whose questionnaire cannot be loaded reads as **null**. The by-id read answers that case with a 409; the request read drops the stale job instead, so the hub keeps the draft panel and the normal next action.
- **Selection.** The request read takes the active job first, else the retained job with the latest `queuedAt` (a tie goes to the job registered last). The draft read first takes the job its questionnaire maps to, which the draft registry keeps for any status.
- **Matrix row.** It issues the analyst's 200 (`exercisesAllowed`) on the seeded submitted request instead of citing a proof. The mounted refusal test is listed as `seeAlso`.
- **Second analyst.** `second.analyst@example.test`, username `second-analyst`, display name "Second Analyst", active, with the Security Analyst role. No matrix actor was added, so the matrix keeps its six actors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Matrix human-analyst-only count**
- **Found during:** Task 2.
- **Issue:** `authorization-matrix.integration.test.ts` pins `HUMAN_ANALYST_ONLY_OPERATIONS.length` at 6 plus the insight operations. The plan did not list this file.
- **Fix:** The pin is now 7 plus the insight operations, and the matrix fixture's list carries the new literal.
- **Files modified:** `apps/backend/tests/authorization-matrix.integration.test.ts`, `apps/backend/tests/fixtures/authorization-matrix.ts`.
- **Commit:** `2f478b9`.

**2. [Rule 1 - Plan fact] The second analyst's by-id read answers 403, not 404**
- **Found during:** Task 2.
- **Issue:** Plan truth 4 and the Task 2 behaviour say "404". The unchanged by-id route answers 403.
- **Fix:** The mounted case asserts 403 with `data: null`, keeping D-27's "untouched" rule over the plan's wording.
- **Commit:** `2f478b9`.

**3. [Rule 3 - Blocking] Draft-job fixture**
- **Found during:** Task 2 RED.
- **Issue:** The seeded `ownerSubmitted` questionnaire's draft job fails with `DRAFT_GENERATION_FAILED`, so the first RED failed for the wrong reason.
- **Fix:** The mounted case drafts from the answered and submitted conditional questionnaire, with the assessment workflow fixtures, exactly as the mounted draft lifecycle test does. The RED was re-run and failed on its target.
- **Commit:** `2f478b9`.

**4. [Rule 3 - Blocking] RED that compiles**
- **Found during:** Task 2 RED.
- **Issue:** A direct call to the not-yet-existing `latestForQuestionnaire` would have failed the tests' `tsc`, which counts as INVALID_RED.
- **Fix:** The RED commit reached the method through a typed cast and asserted that it exists. The GREEN commit switched to the direct call.
- **Commits:** `2f478b9`, `a5f01b9`.

**Total deviations:** 4 auto-fixed (3 blocking, 1 plan-fact correction). **Impact:** No change to scope. The by-id operations, the content types, the Keycloak flags and `CSRM_AI_*` are untouched.

## Issues Encountered

- `api:check` compares the regenerated `schema.d.ts` against the index, so it fails until the regenerated client is staged. The spec and `schema.d.ts` were staged together before the check, as the rules intend, and the index was refreshed after every `api:check`.
- The working tree uses CRLF (`core.autocrlf=true`). Both catalogue copies were edited by one EOL-preserving script, so they stayed byte-identical.

## Threat Flags

None. The new endpoint is the planned surface, and T-10-32 to T-10-35 are mitigated as registered:
- an exact grant plus the guard literal, with the matrix row and the mounted refusals;
- no initiator id in the response;
- the by-id reads unchanged.

## Known Stubs

None.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

Ready for 10-14. The hub can seed both job panels from `getRequestGenerationJobs` on load and poll through `getRequestGenerationJobsAction`.
- Use `canRetry` to show Retry only to the initiator (D-26).
- Jobs stay process-local (R-08-36), so after a Strapi restart both entries are null.

## Self-Check: PASSED

- Every key file exists; this SUMMARY is created by this commit.
- Commits `847b3ed`, `041c08c`, `2f478b9`, `a5f01b9` and `12a3680` are on `post-demo`; the ledger count is 5.
- Acceptance checks:
  - the operation literal is in `operations.ts` and in `HUMAN_ANALYST_ONLY_OPERATIONS`;
  - both catalogue copies carry the new Function, and `cmp` is silent;
  - the inventory's `webCallers` is `["src/features/assessments/assessment-service.ts"]`;
  - the grandfather count is still 43;
  - the matrix row is `humanAnalystOnly(200)`;
  - the harness exposes `secondAnalyst`;
  - `getRequestGenerationJobsAction` is exported;
  - no content-type file changed.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
