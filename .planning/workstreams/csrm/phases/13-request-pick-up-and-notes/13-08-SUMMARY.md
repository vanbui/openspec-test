---
phase: 13-request-pick-up-and-notes
plan: 08
subsystem: api
tags: [strapi, generation-jobs, d-18, human-analyst-only, retry-attribution, openapi, contract-bounds, parity-guard, catalogue, residual-register, job-cards, playwright]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: the humanAnalyst policy fact (13-03), resolvePeople (13-03), the Second Security Analyst sign-in (13-07)
  - phase: 10-workflow-integrity-and-generation-reliability
    provides: latestForRequest / latestForQuestionnaire, GET /v1/assessment_requests/{requestId}/generation_jobs, the second-analyst harness identity, the job cards' seeding (10-13, 10-14)
  - phase: 12-ai-context-and-provenance
    provides: one run per generation with initiatedBy (12-05 to 12-07), the human-only draft job Functions (12-10)
provides:
  - Every human Security Analyst reads and retries a request's questionnaire generation and draft jobs by id, from the policy's humanAnalyst fact; the Requestor and the service agent stay 403, an unknown id 404
  - canRetry means "the job failed and this viewer may retry it" (registry mayRetry) in the generation-jobs read and on every job projection
  - A retry is the retrying analyst's attempt in both registries (generatedBy and the new run's initiatedBy name them)
  - canRetry, initiatedBy (documentId and display name, resolved at read time) and initiatedByViewer, required on QuestionnaireGenerationJob and all four AssessmentDraftJob variants
  - Declared jobId bounds on the four by-id job paths and every bounded job field; 10-13's six narrowed parity paths and two job-parser grandfathers retired (backlog 41 to 39)
  - Neutral catalogue descriptions for the questionnaire job read and retry; R-08-36's Phase 13 line
  - Job cards that say "Started by {name}." and offer the retry to every analyst; e2e/request-pick-up.spec.ts with REQ08_COLLEAGUE_FOLLOWS_JOB @journey in both projects
affects: [13-09, 13-10, 13-11, 13-17, 13-18, 13-19, 21]
actuals:
  tokens: 50700
  tasks: 3
  commits: 6
plan_head_before: 55f31266c981fb5059aa2f60d56408086c4e6f7c
plan_head_after: be0093c1ba60cf2ff83d4edcfb2b9773b49f0005
tech-stack:
  added: []
  patterns:
    - "A job viewer's facts (canRetry, initiatedBy, initiatedByViewer) computed at projection time from the registry's own retry rule and one bounded people read (src/csrm/generation-job-viewer.ts); nothing stored in the registry"
    - "A workflow actor widened only by the policy's humanAnalyst fact passed from the controller, never a constant, failing closed to the initiator without it"
    - "Response parsers that check exactly the contract's declared bounds (no .trim() the contract cannot state), so the boundary modes hold them without grandfathering"
key-files:
  created:
    - apps/backend/src/csrm/generation-job-viewer.ts
    - apps/csrm/e2e/request-pick-up.spec.ts
  modified:
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-draft-registry.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
    - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
    - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/questionnaire-generation.unit.test.ts
    - apps/backend/tests/questionnaire-generation.integration.test.ts
    - apps/backend/tests/assessment-workflow.unit.test.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - apps/csrm/src/features/assessments/assessment-schema.ts
    - apps/csrm/src/features/assessments/assessment-service.ts
    - apps/csrm/src/features/assessments/assessment-service.test.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/features/assessments/questionnaire-generation-job.tsx
    - apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx
    - apps/csrm/src/features/assessments/assessment-draft-job.tsx
    - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
    - docs/security/phase-08-residual-risks.md
    - apps/csrm/playwright.config.ts
key-decisions:
  - "Access is widened only through the policy's humanAnalyst fact, which the controllers read from ctx.state.csrmAuthorization and the workflows turn into canReadAll…; a caller without the fact keeps only the jobs they started (fail closed). No grant changed."
  - "canRetry is the registry's own retry rule (mayRetry: failed, nothing else active for the request or questionnaire, and the viewer passes authorize), so the projection can never offer a retry the registry would refuse with 409."
  - "The initiator's name is resolved in the workflows (they hold strapi) at projection time with resolvePeople, one bounded read per response; the generation-jobs read resolves both jobs' initiators in one read. initiatedBy is null when that person cannot be read, and the card then shows no Started by line rather than inventing copy."
  - "The job parsers drop .trim() on the bounded job fields: the contract's minLength 1 cannot express a trim, and the server's nonBlank never serves blank text, so the parsers check exactly the declared bounds and the boundary modes hold them."
  - "The cards key the Started by line and the polling route on initiatedByViewer and read canRetry from the served job; a failed job the viewer may not retry still offers a new start."
  - "REQ-08 stays Pending until the phase gate (the 13-03 to 13-07 precedent)."
patterns-established:
  - "Job viewer facts: canRetry from the registry rule, initiatedBy from a read-time people read, initiatedByViewer from the actor; every job projection carries all three"
requirements-completed: []
coverage:
  - id: D1
    description: "Any human Security Analyst reads Bob's questionnaire generation and draft jobs by id (200, initiatedBy Bob, initiatedByViewer false); the Requestor and the service agent stay 403, an unknown id 404"
    requirement: "REQ-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-generation.integration.test.ts#mounted analysts share a request's running job and any analyst follows it by id (D-18)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#mounted second analyst follows and retries Bob's failed draft job and the retry is theirs (D-18)"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/questionnaire-generation.unit.test.ts#the by-id generation job read is open to every human analyst and names the analyst who started it"
        status: pass
    human_judgment: false
  - id: D2
    description: "canRetry means the job failed and the viewer may retry it; a retry is the retrying analyst's attempt (generatedBy and the new run's initiatedBy)"
    requirement: "REQ-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-generation.integration.test.ts#mounted second analyst retries Bob's failed questionnaire generation and the retry is theirs (D-18)"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/questionnaire-generation.unit.test.ts#a retried questionnaire generation job is the retrying analyst's attempt"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/assessment-workflow.unit.test.ts#a retried assessment draft job is the retrying analyst's attempt"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/questionnaire-generation.unit.test.ts#latestForRequest returns the active job, else the latest retained job, with whether the viewer may retry it"
        status: pass
    human_judgment: false
  - id: D3
    description: "The job components and by-id paths declare their bounds; the parity guard holds both job parsers to the boundary modes (backlog 39); the catalogue descriptions are neutral; R-08-36 records the widening"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts#records the grandfather backlog count so it changes only deliberately"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts#Phase 13 generation job FunctionAPIs are neutral about who follows them and keep their grants (D-18)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The job cards say Started by {name}. for a colleague's job, offer the retry to every analyst on a failed job, and retire the two Phase 10 sentences; a colleague follows Bob's job in the browser at 1440 and 375"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#shows a colleague’s failed job with Started by {name} and offers Retry questionnaire generation, not %s"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#shows a colleague’s failed draft job naming them and offers Retry draft generation, not Generate assessment draft"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-pick-up.spec.ts#REQ08_COLLEAGUE_FOLLOWS_JOB @journey"
        status: pass
    human_judgment: true
    rationale: "The UI Considerations row (Jobs: Started by {name}, retry for every analyst) is a browser backstop the orchestrator walks; the deterministic job usually finishes before the colleague's page loads, so the browser run proves the colleague reaches the request and its questionnaire with no refusal, and the Started by line is proven by the unit cases."
duration: 55min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 08: Every analyst on a request follows its jobs Summary

**Any human Security Analyst who may read a request now reads and retries its questionnaire generation and draft jobs by id, sees who started each (`Started by Bob Doe.`), and a retry is credited to the analyst who made it; the job contract declares its bounds, which retires 10-13's narrowed parity paths (backlog 41 to 39).**

## Performance

- **Duration:** about 55 min
- **Completed:** 2026-10-09
- **Tasks:** 3, each RED then GREEN. Task 1 is the tracer; its gate re-ran the verify pieces after GREEN, and they passed.
- **Files changed:** 28 (27 modified, `generation-job-viewer.ts` and `request-pick-up.spec.ts` created), plus this SUMMARY

## Accomplishments

- **Access (D-18).**
  - The questionnaire workflow's `actor()` and the draft workflow's `draftActor()` take the policy's `humanAnalyst` fact, which the controllers read from `ctx.state.csrmAuthorization`. They pass `canReadAllQuestionnaireGenerationJobs` / `canReadAllDraftJobs` equal to it. No literal `false` is left.
  - The routes keep their human-only grants, so the Requestor and the service agent stay 403.
- **canRetry.** Both registries expose `mayRetry`: the job failed, nothing else is active for its request or questionnaire, and the viewer passes `authorize`. `latestForRequest`, `latestForQuestionnaire` and every projection use it.
- **Attribution (G-3).** Both registries' `retry` set `job.initiatingAnalystDocumentId = actor.documentId` before `launch`.
- **Projection.** Every job response carries `canRetry`, `initiatedBy` and `initiatedByViewer`: start, by-id read, retry, and both entries of the generation-jobs read.
  - `initiatedBy` is `{ documentId, displayName }` from `resolvePeople`, one bounded read per response. It is never stored.
- **Contract.**
  - The three fields are required on `QuestionnaireGenerationJob` and all four `AssessmentDraftJob` variants.
  - `jobId` is 1 to 255 on both questionnaire job paths and on `AssessmentDraftJobId`.
  - Every bounded job field is declared. The ids, provider name and version, `assessmentId` and `failureCode` are 1 to 255; `failureMessage` is 1 to 2,000.
  - The wrapper `canRetry` description and the generation-jobs description are reworded.
- **Parity.**
  - The six `narrowedPaths` entries citing "D-27, Phase 13" and their comment are gone from `assessment-service.ts`.
  - `getAssessmentDraftJob` and `getQuestionnaireGenerationJob` left `boundaryGrandfathered`. **Backlog 41 → 39** (41 at HEAD before this plan, 39 after), with a sentence naming 13-08.
- **Catalogue (both copies, `cmp` silent).** The two descriptions now read `Returns a retained questionnaire generation job.` and `Retries a failed questionnaire generation job.`. The draft job descriptions had no "initiating analyst's" left after 12-10. No `roleIds` changed.
- **R-08-36** gains `Phase 13 widened job access to every human Security Analyst who may read the request; storage unchanged (D-19).` Its trigger is unchanged.
- **Cards (UI-SPEC §13).**
  - `Started by {name}.` shows whenever `initiatedByViewer` is false, for a queued, running or failed job.
  - Retry shows whenever the served job's `canRetry` is true. Otherwise the card offers a new start, as before.
  - Both retired sentences are gone from shipped code.
  - Polling is keyed on `initiatedByViewer`, and the by-id poll takes `canRetry` from the served job.
  - After the viewer's own retry, the card shows no Started by line.
- **E2E.** `REQ08_COLLEAGUE_FOLLOWS_JOB @journey` in the new `request-pick-up.spec.ts`. The mobile project's `testMatch` gains `'**/request-pick-up.spec.ts'`; its `grep: /@journey/` is unchanged.

## Inverted 10-13 cases (named deliberately)

- `questionnaire-generation.integration.test.ts` "mounted analysts share a request's running job and only its initiator may retry it" became "mounted analysts share a request's running job and any analyst follows it by id (D-18)".
  - The second analyst's by-id read of Bob's held job now answers **200**, with `initiatedBy` Bob, `initiatedByViewer` false and `canRetry` false. It answered **403** before (the plan text says 404; the served status was 403).
  - The case no longer asserts that the read never discloses Bob's documentId: D-18 projects it.
- The same file's "mounted analyst reads the running questionnaire generation job" now expects `canRetry` **false** for an active job, where it expected true.
- "mounted request generation read returns the draft job" now expects `canRetry` **false** for a completed draft job, for the initiator and the colleague alike. The colleague's copy differs only in `initiatedByViewer`.
- The unit cases "latestForRequest … with the viewer's retry right" and "latestForQuestionnaire …" were rewritten to the new `canRetry` meaning, with the viewer passed as the registry actor.
- U4 (UI-SPEC §16) was changed deliberately in `questionnaire-generation-job.test.tsx` and in `assessment-review-workflow.test.tsx`'s draft cases.

## Test Counts

- **Task 1 RED:**
  - Strapi units: `# pass 50 / # fail 5`.
  - Mounted (questionnaire-generation, assessment-workflow, authorization-matrix): `# pass 183 / # fail 6`. Every failure was an assertion on the planned behaviour, for example `SECOND_ANALYST_DRAFT_JOB_READ_REFUSED` and `A_HUMAN_ANALYST_WAS_REFUSED_THE_JOB`.
  - Web `assessment-service.test.ts`: `Tests 11 failed | 32 passed`.
- **Task 1 GREEN:**
  - Strapi units (questionnaire-generation, assessment-workflow, authorization-matrix-provenance): `# pass 55 / # fail 0`.
  - Mounted (the same three integration files): `# pass 189 / # fail 0`.
  - Web service and parity: `Tests 208 passed`; web assessments `Tests 454 passed`.
  - `api:check` clean, and both typechecks clean.
- **Task 2 RED:**
  - Parity: `Tests 3 failed | 162 passed`. The draft, generation and generation-jobs parsers failed on the undeclared bounds; the count assertion was already at 39.
  - Catalogue: `# pass 22 / # fail 1` (`PHASE13_QUESTIONNAIRE_JOB_READ_DESCRIPTION`).
- **Task 2 GREEN:**
  - The node bounds check printed `bounds ok`.
  - Parity, chain and assessments: `Tests 628 passed`.
  - Catalogue: `# pass 23 / # fail 0`.
  - `cmp` was silent, `api:check` clean (the generated client did not change for the bounds), and typecheck clean.
- **Full Strapi suite** (dev servers stopped, nothing on 1337 or 3000): **`# pass 899 / # fail 0`** (`ℹ tests 899`, 987 s, about 16.5 min, exit 0).
- **Task 3 RED:** card units `Tests 15 failed | 126 passed`, all assertions on the planned copy and polling route.
- **Task 3 GREEN:**
  - Card units and the copy guard: `Tests 276 passed`; typecheck clean.
  - The whole web unit suite: `Test Files 173 passed`, `Tests 3825 passed`.
  - `playwright test --list --project=mobile e2e/request-pick-up.spec.ts` collects REQ08_COLLEAGUE_FOLLOWS_JOB.
  - **Playwright `e2e/request-pick-up.spec.ts`: `2 passed`, desktop 1 and mobile 1** (1.0 min). The tree was clean after the run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The job parsers drop `.trim()` on the bounded job fields**
- **Found during:** Task 2 GREEN.
- **Issue:** the parity guard's boundary-empty payload is `minLength` characters of whitespace, so a `.trim().min(1)` parser rejects `' '` even once the contract declares `minLength: 1`. Declaring the bounds alone could not let the two job parsers leave `boundaryGrandfathered`.
- **Fix:** `assessment-schema.ts` checks the job ids, provider name and version, `assessmentId` and `failureCode` with `z.string().min(1).max(255)`, and `failureMessage` with `min(1).max(2_000)`, exactly the declared bounds. The server's `nonBlank` never serves blank text. This file was outside Task 2's list.
- **Commit:** `a1ddeae`.

**2. [Rule 3 - Blocking] `generation-job-viewer.ts` added; the name is resolved in the workflows**
- **Issue:** both workflows need the same viewer-facts rule, and the generation-jobs read needs one people read for both jobs.
- **Fix:** a small shared module, `apps/backend/src/csrm/generation-job-viewer.ts`, wraps `resolvePeople` and builds the three facts. The workflows call it, so every caller (start, read, retry, jobs read) projects the same way. The controllers only pass the `humanAnalyst` fact.
- **Commit:** `e1bd33a`.

**3. [Rule 1 - Bug in the verify command] `--project mobile` → `--project=mobile`**
- **Issue:** Playwright's `--project` is variadic, so `--list --project mobile e2e/request-pick-up.spec.ts` reads the spec path as a project name and exits with `Project(s) "e2e/request-pick-up.spec.ts" not found`.
- **Fix:** the check ran as `--project=mobile`, which collects the test. The intent of the check is unchanged.

**4. [Rule 3] A test mock gained `normalizeResponseParserError`**
- **Issue:** `assessment-service.test.ts`'s server-client mock lacked `normalizeResponseParserError`, which `getRequestGenerationJobs`'s labelled parse uses. Without it the new jobs-read case crashed instead of asserting.
- **Fix:** the mock gained it before the RED commit (the ai-assistance test's form).
- **Commit:** `cc05ca0`.

## Threat Flags

None beyond the plan's register.
- T-13-27: no grant changed. The widening comes only from the `humanAnalyst` fact, and the mounted 403 cases cover the Requestor and the service agent.
- T-13-28: `generatedBy` and the run's `initiatedBy` are asserted mounted.
- T-13-29: only `{ documentId, displayName }` is projected, through the people module.

## Known Stubs

None.

## Next Phase Readiness

13-09 can build on `request-pick-up.spec.ts`: a 375 test carries `@journey`, and a desktop-only test leaves it off. The job contract is bounded, and `getRequestGenerationJobs` registers only the flat questionnaire job's per-state narrowed paths.

## Self-Check: PASSED

- Created files exist: `apps/backend/src/csrm/generation-job-viewer.ts` and `apps/csrm/e2e/request-pick-up.spec.ts`.
- All six commits exist: `cc05ca0`, `e1bd33a`, `469f1e7`, `a1ddeae`, `f14a4b8`, `be0093c`.
