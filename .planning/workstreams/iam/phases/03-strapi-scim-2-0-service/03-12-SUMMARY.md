---
phase: 03-strapi-scim-2-0-service
plan: "12"
subsystem: testing
tags: [scim, midpoint, capture, sanitation, provenance]
status: complete
requires:
  - phase: 03-11
    provides: Mounted source-authenticated SCIM operations and published contract
provides:
  - Bounded temporary-resource capture runner with in-process observation and isolated-data preflight
  - Sanitizer and closed evidence validator before atomic publication
  - Authored offline behavior tests and exact orchestrator preparation instructions
affects: [03-13, 03-14, 03-18]
tech-stack:
  added: []
  patterns: [opt-in request observation, container-local REST, sanitize-before-write, independent cleanup budget]
key-files:
  created:
    - docker/midpoint/e2e/capture-scim.mjs
    - docker/midpoint/e2e/scim-evidence.mjs
    - docker/midpoint/e2e/README.md
    - apps/backend/tests/iam-scim-capture-tooling.unit.test.ts
  modified: []
key-decisions:
  - Observe actual request and response streams within the isolated Strapi process without introducing a SCIM server or writer
  - Use explicit supported shadow operations for connector lifecycle and label independent discovery probes separately
  - Read only a dedicated ignored owner-only token handoff; never open the shared Docker environment file
  - Preserve P3-33 through P3-35 wire shapes and asserted-attribute PUT
requirements-completed: ["MODEL-02","PROV-04","PROV-08"]
coverage:
  - id: capture-boundary
    description: Authored sanitation, closed metadata, stable substitutions, ordered scenarios and missing-operation rejection
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-capture-tooling.unit.test.ts
        status: pass
    human_judgment: false
  - id: bounded-orchestration
    description: Authored runtime checks for isolation, pins, explicit connector invocations, token handoff, timeout and cleanup
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-capture-tooling.unit.test.ts
        status: pass
      - kind: command
        ref: node docker/midpoint/e2e/capture-scim.mjs --check
        status: pass
    human_judgment: false
  - id: orchestrator-instructions
    description: Run preparation and evidence contract for the later live checkpoint
    verification: []
    human_judgment: true
    rationale: Actual pinned-connector execution is owned by 03-13 and has not run
actuals:
  tasks: 1
  files: 4
  implementation_commits: 3
duration: approximately 25 min
completed: "2026-10-15T21:35:20Z"
---

# Phase 3 Plan 12: Sanitized connector capture tooling

A bounded midPoint runner captures real Strapi request/response streams through an opt-in in-process hook, sanitizes before publication and refuses incomplete lifecycle evidence.

## Accomplishments

- Added `--check`, `--run` and `--verify-evidence`. Offline checks validate script syntax and tracked pins without secret reads, Docker, listeners or evidence output.
- Added an isolated SQLite/run-id/port preflight, pinned runtime/connector/source checks, temporary marked resource/person/shadow operations, explicit email delete/add deltas and independent authenticated discovery probes. Credentials travel in memory/stdin; the runner reads only `apps/backend/.tmp/.env.scim-capture` after ignore/tracking/permissions checks.
- Added request-arrival ordering, body-stream preservation, closed metadata/content-header sanitation, exact dynamic substitutions, required observed outcomes and atomic two-file publication after successful cleanup. Each stage is bounded to 180 seconds, overall execution to 20 minutes, with a separate 30-second cleanup budget and independent deletion attempts.
- Documented exact invocation and the required isolated listener/hook preparation. No captured traffic, manifest, lifecycle fixture or checkpoint evidence was created.

## Task commits

1. `1742910a` — `test(iam): require capture sanitation before evidence writes`
2. `d1c2cd84` — `feat(iam): sanitize and validate connector capture evidence`
3. `7011a00b` — `feat(iam): add bounded midPoint capture runner and offline checks`

Task 1 is complete as offline tooling. The first recorded task commit was at 2026-10-15T21:10:30Z; final documentation was recorded at 2026-10-15T21:35:20Z. Four implementation/test files were created; the summary and two progress records are administrative updates.

## Verification

- Reconciled the clean starting tree at `57f7fdd7`, the current live-probe decisions and the existing phase plan-check. Rechecked all 18 plan structures: 18 valid, no errors. This plan adds no shared production API/schema change.
- RED: the named sanitation assertion failed because the initial implementation retained the authored credential. The recorded command exited 1 with one failing assertion; the evidence checker returned `RED_EVIDENCE_OK`. The local record is `apps/backend/.tmp/scim-capture-red.json` (ignored).
- `pnpm --dir apps/backend exec tsc -p .tmp/tsconfig.scim-capture.json --pretty false` — PASS. This ignored config extends `tests/tsconfig.json`, retains its default exclusions and excludes exactly `risk-curation-rules.unit.test.ts` and `risk-history-changes.unit.test.ts`, as authorized for WINDOWS.md entry 11. Named output exists at `.tmp/tests-dist/tests/iam-scim-capture-tooling.unit.test.js`.
- `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 .tmp/tests-dist/tests/iam-scim-capture-tooling.unit.test.js` — PASS, 18/18, no skipped or cancelled tests. All envelopes and runtime simulations are authored tests, not connector evidence.
- `node docker/midpoint/e2e/capture-scim.mjs --check` — PASS; no evidence directory created.
- `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 .tmp/tests-dist/tests/iam-scim-wire.unit.test.js .tmp/tests-dist/tests/iam-scim-patch.unit.test.js .tmp/tests-dist/tests/iam-scim-query.unit.test.js .tmp/tests-dist/tests/iam-scim-discovery.unit.test.js` — PASS, 40/40, including the P3-33/P3-34/P3-35 cases.
- `git diff --check` — PASS. No content-type schema, generated declaration, index, JDL, dependency or committed activation configuration changed. The three committed activation defaults remain false.

The full backend suite was not run; the orchestrator owns that gate. No Docker operation, SCIM listener, browser, token issuance or live connector run was performed during this task. Existing developer services were left running.

## Deviations from plan

- The task's “full PUT mover” wording is interpreted as the actual connector's asserted-attribute PUT, under P3-34, which supersedes the original P3-13 clearing rule. The runner changes the shadow title and requires the observed PUT result while preserving omitted fields; it never manufactures a full replacement request. The existing P3-33–P3-35 tests remain green.

The dedicated ignored token handoff implements the permitted ignored-env boundary while honoring the instruction never to read `docker/.env`. STATE.md and the ROADMAP.md checkbox were updated as explicitly requested by this invocation, overriding the plan footer's administrative exclusion.

## Pending gates and stop point

Plan 03-13 has not started. Its orchestrator must safely provide the isolated port-1337 listener with the preload hook, issue the gate token and run the real pinned connector lifecycle. The tool deliberately refuses an ordinary developer database, missing wire operations, wrong pins/provenance or unsuccessful cleanup. Offline tests do not prove this live preparation or the connector operation results.

`03-CONNECTOR-CAPTURE-EVIDENCE.md`, `evidence/connector-capture/capture.json` and `manifest.json` remain absent. PROV-08 and shared requirement completion remain pending the genuine capture, replay and later phase gates; the frontmatter lists this plan's required contribution identifiers only. No 03-13 SUMMARY or replay fixture exists. Stop here, before 03-13.
