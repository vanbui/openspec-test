---
phase: 02-identity-model-and-leaver-safe-keycloak-sync
plan: "06"
status: complete
subsystem: authorization
tags: [iam, csrm, people-selectors, strapi, integration-tests]
requires:
  - phase: "02-05"
    provides: Fresh persisted service-binding helpers and the shared eligible-person discriminator
provides:
  - Registered service exclusion before bounded human selection
  - Server-side service rejection for submitted assignee and owner identifiers
  - Protected human and historical label compatibility
affects: [iam, csrm]
tech-stack:
  added: []
  patterns: [Fresh persisted binding checks, Document Service exclusion before selection limits]
key-files:
  created:
    - apps/backend/tests/iam-human-selectors.integration.test.ts
  modified:
    - apps/backend/src/api/csrm-assessment-request/services/request-assignment.ts
    - apps/backend/src/api/csrm-risk/services/risk-workflow.ts
    - apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts
    - apps/backend/src/api/csrm-administration/services/administration-repository.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
key-decisions:
  - Persisted IdentitySource.serviceUser binding defines non-human status independently of protection, source activity and grants.
  - Existing system, asset, control and risk counts and historical owner labels remain unchanged; the two human selectors expose bounded lists without total counts.
requirements-completed: ["MODEL-01", "PROV-05"]
coverage:
  - id: request-assignment
    description: Services are excluded before the analyst candidate window and rejected as submitted assignees.
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-human-selectors.integration.test.ts#registered services cannot consume the 200-candidate analyst search window
        status: pass
      - kind: integration
        ref: apps/backend/tests/iam-human-selectors.integration.test.ts#assignable analysts exclude a bound service even with a human grant, and direct assignment refuses it
        status: pass
    human_judgment: false
  - id: owner-search
    description: Shared owner search excludes services before its 20-person limit and preserves human selection.
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-human-selectors.integration.test.ts#shared owner search excludes services before its 20-person boundary and preserves protected and ordinary people
        status: pass
    human_judgment: false
  - id: submitted-owners
    description: Risk, treatment, control implementation and administration owner writes reject services without changing records or counts.
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-human-selectors.integration.test.ts#risk and treatment owner creates and updates reject services and keep persisted owners unchanged
        status: pass
      - kind: integration
        ref: apps/backend/tests/iam-human-selectors.integration.test.ts#control owner creates and updates refuse services without writes and accept protected people
        status: pass
      - kind: integration
        ref: apps/backend/tests/iam-human-selectors.integration.test.ts#administration system owner creates and updates reject services without changing counts or records
        status: pass
    human_judgment: false
  - id: historical-people
    description: Binding changes are read freshly, inactive sources remain excluded and historical references retain safe labels.
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-human-selectors.integration.test.ts#binding changes are read freshly, inactive sources remain excluded, and historical people retain safe labels
        status: pass
    human_judgment: false
duration: 34 min
implementation-started: 2026-10-14T07:18:10Z
completed: 2026-10-14T07:52:15Z
tasks-completed: 1
commits: 0
---

# Phase 2 Plan 02-06: Human selector service exclusion

Registered source services cannot consume human selection windows or be selected as new assignees or owners; protected people and historical labels remain compatible.

## Accomplishments

- Request assignment uses fresh registered service document IDs in the Document Service filter before the 200-candidate read and subsequent 50-person limit. Submitted assignees are checked against their persisted service binding before user grant hydration. Existing analyst, automation and own-request constraints remain in place.
- The shared `/api/v1/users` owner search excludes services in its Document Service filter before the 20-person limit. This selector serves risk, treatment, control implementation and administration owner selection. Searches still project only documentId and displayName.
- Risk and treatment owner resolution, control implementation owner resolution and administration system owner resolution reject registered services server-side on both create and update paths. Existing error contracts are preserved, and refused writes leave records and counts unchanged.
- Seven tests use the running HTTP harness and real Strapi persistence. They cover a registered active service with a malformed extra human grant, a protected human analyst, ordinary people, the existing analyst, both selection limits, create/update refusal, successful human writes, inactive sources, binding removal and historical people projections. The candidate-window case places 199 automation-role holders before the only eligible human, proving that a service cannot consume a slot before pagination.

## Decisions and scope

- Followed the approved contract-gap record and P2-08: service status comes from IdentitySource.serviceUser binding, including inactive sources or invalid service grants. Protection alone does not exclude a person. The existing shared eligible-person predicate already supports this distinction and required no change.
- Audited the four modules and their mounted entry points. There are two selectable-human reads: assignable analysts and shared active-user search. Neither publishes total counts. Administration counts systems, assets, controls and risk types; risk-register counts describe risks. These counts and their historical owner references are preserved. Tests verify unchanged counts after refused creates and unchanged records after refused updates.
- Historical request people and assessment owner-label resolution retain their documentId/displayName projections, including references to users that are now registered services. Selection policy is not applied to historical labels.
- Executed only plan 02-06. No schema, dependency, catalogue, default-setting or contract changes were made. No public provisioning route or later-wave ownership work was started.
- Requirement IDs above identify this plan's delivered slice. No requirement tracking, phase verification or phase completion files were updated.

## Verification

All commands ran from the repository root using installed dependencies and isolated local test databases. Compilation preceded each test invocation.

| Required check | Final actual outcome |
| --- | --- |
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` | Pass, exit 0; named integration test emitted |
| Four-file integration command below | Pass, exit 0; 68 tests, 68 passed, 0 failed, 0 cancelled, 0 skipped; 396,711 ms |
| `git diff --check` | Pass |

```powershell
pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/iam-human-selectors.integration.test.js .tmp/tests-dist/tests/request-assignment.integration.test.js .tmp/tests-dist/tests/risk-register.integration.test.js .tmp/tests-dist/tests/administration.integration.test.js
```

The passing command includes all seven new cases and 61 existing assignment, risk-register and administration regressions. Local output is retained in `apps/backend/.tmp/02-06-verification-complete.log`.

## Issues encountered

- The first test process's final output was unavailable after the session interruption; no outcome is claimed for it. The test-only check was repeated after confirming it was no longer running.
- The repeated initial test-only run exited 1 because the new risk fixture lacked its required riskNumber. All six cases failed in setup. The fixture was corrected. Tests were written before production changes, but that run did not establish runtime failure of the feature assertions; no such red-stage proof is claimed.
- The first required four-file run exited 1: 67 tests, 64 passed, 3 failed. New tests used an incorrect assessment route and PUT where PATCH is required, returning 405. The routes and methods were corrected.
- The next required run exited 1: 68 tests, 66 passed, 2 failed. Risk and control test bodies were incorrectly wrapped in data, producing 400 on positive human updates. The helper now distinguishes direct bodies from assignment's required envelope. Refusal assertions also check the precise owner-validation error message.
- The following required run exited 1: 68 tests, 66 passed, 2 failed. The direct-body tests reached the real workflow, exposing a fixture with a draft assessment but a submitted request. Positive writes correctly returned 409 under existing lifecycle rules. The fixture now starts at risk-assessment-drafted. No lifecycle rule was changed.
- The final required run passed all 68 tests. All earlier failures were corrected in the new test setup or assertions; the 61 existing regressions passed throughout the required runs. No required case was skipped or waived.

## Deviations from plan

One supporting file was added to the declared modification list: `tests/helpers/strapi-http-harness.ts` now provides a typed trusted fixture callback. It lets the tests register sources, create protected people and change bindings through Document Service against the same backend serving the mounted routes. No user write bypasses Document Service and no production test hook was added.

## Review and remaining gates

All plan-specific automated checks passed. The full backend suite was not run, as instructed; its gate belongs to the orchestrator. No Docker containers were started. No Git write command was run, and all changes remain unstaged and uncommitted for review. STATE.md and ROADMAP.md are untouched. This summary is the only planning artifact written.

Plan 02-07 is the next scoped wave and was not started.

## Orchestrator re-verification

Compilation passed. The named selector file plus the administration and request-assignment integration files ran three times together: the first run had one failure of the risk/treatment owner case after 18 ms (no assertion reached), and the case passed alone and in two further full combined runs (50 of 50 each). Recorded as an intermittent harness failure, not a product defect; watch for it at the phase gate.
