---
phase: 12-ai-context-suggestions-and-provenance
plan: 10
subsystem: authorization, contract and AI run read
tags: [authorization, catalogue, contract, ai-run, least-privilege]
requires:
  - phase: 12-04
    provides: the CsrmAiRun record and its envelope parsers
  - phase: 12-09
    provides: the shared features/ai-assistance folder
provides:
  - GET /api/v1/ai_runs/{runId}, human Security Analyst only, closed and proposal-free
  - human Security Analyst-only draft generation, draft job read and draft retry
  - the service agent's request grants withdrawn (R-08-42), R-08-12 and R-08-42 closed
  - getAiRun (typed service) and getAiRunAction (Server Action) for the "What the AI used" sheet
affects: [12-12, 12-15, 22]
tech-stack:
  added: []
  patterns: [API-only human analyst Function, closed contract-exact parser]
key-files:
  created:
    - apps/backend/src/api/csrm-ai-run/operations.ts
    - apps/backend/src/api/csrm-ai-run/routes/ai-runs.ts
    - apps/csrm/src/features/ai-assistance/ai-assistance-schema.ts
    - apps/csrm/src/features/ai-assistance/ai-assistance-service.ts
    - apps/csrm/src/features/ai-assistance/ai-assistance-actions.ts
  modified:
    - apps/backend/src/api/csrm-ai-run/controllers/csrm-ai-run.ts
    - apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts
    - apps/backend/src/policies/csrm-authorization.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/specification.json
    - docs/references/served-operations.json
    - docs/security/phase-08-residual-risks.md
    - apps/backend/tests/fixtures/authorization-matrix.ts
key-decisions:
  - "The service agent keeps the Requestor birthright every identity holds, so it can still create its own request and read the request selectors; what the withdrawal removes is its reach into other people's requests (read, update, delete) and the core reference-data REST reads. The plan expected 403 on the two reference-data reads; the birthright grant keeps those selector routes open to every identity, and the matrix states that."
  - "The run read's web parser carries exactly the contract's bounds, with only the digest pattern registered as a narrowing, so the parity guard holds in every mode."
  - "The Phase 12 design note is appended at the end of the catalogue's designNotes, so earlier notes keep the indices other tests cite."
requirements-completed: [INT-05, INT-06]
status: complete
completed: 2026-10-06
---

# Phase 12 Plan 10 Summary

## Accomplishments

- `GET /api/v1/ai_runs/{runId}` serves a human Security Analyst the run's operation, status, times, initiator (named only while active), provider facts, context summary and outcome, with its targets. It never serves the proposal or Requestor free text; a query is refused (400) and an unknown run is 404 with one body for every unknown id.
- `function.ai_runs.read_api` grants the read to `role.security_analyst` only, with its FunctionApi, in both byte-identical catalogue copies, the specification (`AiRunResponse`, `AiRun`, `AiRunContextSummary`), the generated client and the served inventory.
- Draft generation, the draft job read and the draft retry moved into `function.assessment_draft.generate_api`, `.job_read_api` and `.retry_api`, held by the human analyst only; their FunctionApis kept their names, URLs and descriptions. All four operations are in `HUMAN_ANALYST_ONLY_OPERATIONS` and the matrix's own list.
- The service agent no longer holds `function.risk_assessment_requests.core_api`, `.delete_api` or `.reference_data_api`; the Requestor and the human analyst keep theirs.
- The web has `getAiRun` through the typed client with a registered closed parser, and `getAiRunAction` returning the UI-SPEC's error and permission copy.
- R-08-42 and R-08-12 are closed in the residual register with their evidence.

## Verification

- Strapi: `ai-run.integration` 3/3 (the run read, its refusals, 404 and closed body); `authorization-policy.unit`, `contract-catalogue.integration`, `served-operations.integration`, `authorization-matrix-provenance.unit`, `authorization-matrix.integration` and `authorization.integration` together 193/193; the suites that use the service agent (`assessment-workflow`, `questionnaire-generation`, `questionnaire-workflow`, `request-workflow`, `keycloak-identity`, `analyst-insight-authorization`) 95/95 after the fix below.
- Web: `src/features/ai-assistance` 7/7; the response parity, operation chain and zod client boundary guards 180/180; typecheck clean; `cmp` of the catalogue copies silent.

## Deviations

- Executed by the pilot. The three tasks landed as one feature commit, with their tests.
- The draft lifecycle test used the service agent as its second authorised analyst; it now uses the second human analyst and proves the agent is refused with no job disclosed.
- The two T-08-A2 tests no longer send as the service agent, and their names and the matrix proofs citing them drop "or the service agent".
- The 12-04 run test's assertion that the analyst detail carries no `aiProvenance` key was out of date since 12-09 (it now carries null for a legacy row); this plan corrects it.

## Self-Check: PASSED
