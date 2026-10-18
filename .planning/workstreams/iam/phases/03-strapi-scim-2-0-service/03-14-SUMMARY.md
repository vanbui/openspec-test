---
phase: 03-strapi-scim-2-0-service
plan: "14"
subsystem: testing
tags: [scim, midpoint, replay, provenance, source-isolation]
status: complete
requires:
  - phase: 03-13
    provides: Passed genuine connector capture and published sanitized evidence
provides:
  - Byte-identical 47-envelope fixture with verified digests and invocation provenance
  - Deterministic mounted Strapi HTTP replay with exact received requests and exact responses
  - Persistence, retained roles/references, tombstone and two-source isolation assertions
affects: [03-15, 03-18, 04-midpoint-configuration]
tech-stack:
  added: []
  patterns: [exact wire replay, declared id substitutions, isolated database preparation]
key-files:
  created:
    - apps/backend/tests/fixtures/iam-scim/connector-lifecycle.json
    - apps/backend/tests/fixtures/iam-scim/PROVENANCE.md
    - apps/backend/tests/iam-scim-replay.integration.test.ts
  modified:
    - apps/backend/tests/helpers/iam-scim-http-harness.ts
key-decisions:
  - Retain all background ResourceTypes and Groups requests and the real unpaged page scenario
  - Resolve the created id only from POST response body with a Location cross-check; resolve baseline ids from actual list responses
  - Retain captured manual candidates and claim unrelated shared-harness people under a second source before replay
requirements-completed: ["PROV-08","PROV-01","PROV-02","PROV-03","PROV-04","LIFE-03"]
coverage:
  - id: fixture-provenance
    description: Exact published capture bytes, SHA-256 digests, declared substitutions and complete operation coverage
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-scim-replay.integration.test.ts#replay fixture preserves every published capture envelope byte for byte
        status: pass
      - kind: integration
        ref: apps/backend/tests/iam-scim-replay.integration.test.ts#published digests, declared substitutions and genuine operation coverage are complete
        status: pass
    human_judgment: false
  - id: mounted-replay
    description: Exact HTTP order and shapes, persisted mapping, roles, retained references, tombstones and two-source isolation
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-scim-replay.integration.test.ts#all 47 captured envelopes replay in order through mounted HTTP with persistence and source isolation
        status: pass
    human_judgment: false
actuals:
  tasks: 1
  files: 4
  implementation_commits: 2
duration: approximately 5 min from first task commit
completed: "2026-10-15T22:01:37Z"
---

# Phase 3 Plan 14: Genuine connector HTTP replay

All 47 sanitized capture envelopes replay unchanged against mounted Strapi HTTP, including background discovery and the real unpaged list, with only declared user-id substitutions.

## Accomplishments

- Created the byte-identical lifecycle fixture and provenance recording runtime versions, connector source/repository commits, capture date/command, all scenario invocations, coverage, SHA-256 digests and the five permitted user-id substitutions. The published capture and manifest were never edited. Three direct discovery probes retain their separate origin labels.
- Added exact wire sending and safe observation to the existing root HTTP harness. Replay uses fresh in-memory source credentials, isolated SQLite and an ephemeral loopback listener. Every received method, relative path/query, safe header, body and arrival position is compared; every response status, safe header and full JSON body is compared without sorting, dropping fields or wildcards. Create Location is additionally checked. Missing evidence, mismatched provenance, omitted operations or unresolved/undeclared ids fail.
- Asserted employeeNumber source-key fallback, names/email/title/activation persistence, source tuple/ownership, initial roles=[], subsequent administrator-assigned role preservation, retained request/risk/system references, tombstones and repeated DELETE stability. Foreign records remain unchanged; separate negative probes cover foreign reads/searches/writes, protected service users, deleted users and unauthenticated discovery.

## Task commits

1. `85b70f5f` — `test(iam): require exact connector capture replay fixture`
2. `80d38fa0` — `feat(iam): replay genuine connector lifecycle through mounted HTTP`

Task 1 is complete. The first task commit was at 2026-10-15T21:55:45Z; preparation preceded it. Four implementation/test files changed. Summary, STATE.md and ROADMAP.md are administrative updates.

## Verification

- Reconciled the clean initial tree at `7ccf95a6`, existing shared-backend helper and P3-33/P3-34/P3-35/P3-36. Rechecked all 18 phase plan structures: 18 valid, zero errors/warnings. Rechecked 03-14 against genuine capture dependency and locked decisions; no missing operation or scope blocker.
- RED: the named byte-preservation test failed on the explicit missing-fixture assertion, exit 1. The ignored `apps/backend/.tmp/iam-replay-red.json` record passed the evidence checker with `RED_EVIDENCE_OK`; the failing test was committed before implementation.
- `pnpm --dir apps/backend exec tsc -p .tmp/tsconfig.iam-replay.json --pretty false` — PASS, exit 0, no diagnostics. The ignored config extends `tests/tsconfig.json` and excludes exactly `risk-curation-rules.unit.test.ts` and `risk-history-changes.unit.test.ts`, as authorized for WINDOWS.md entry 11. Named compiled replay test exists.
- `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-scim-replay.integration.test.js` — PASS, 3/3 tests, 47/47 envelopes, zero failures/skips/cancellations, approximately 35 seconds. Final local output: `apps/backend/.tmp/iam-replay-green.log`.
- `node docker/midpoint/e2e/capture-scim.mjs --verify-evidence` — PASS inside the provenance test; offline validation only.
- `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 .tmp/tests-dist/tests/iam-scim-wire.unit.test.js .tmp/tests-dist/tests/iam-scim-patch.unit.test.js .tmp/tests-dist/tests/iam-scim-query.unit.test.js .tmp/tests-dist/tests/iam-scim-discovery.unit.test.js` — PASS, 40/40, zero skips, including P3-33 through P3-35 mapping/PUT/PATCH behavior and closed errors.
- `git diff --check` — PASS. Direct byte comparison — PASS; fixture/capture SHA-256 `52a5a3d28f4eee56cd398404c72f370572720041c4c8a173b831b53bd2a693ae`.

Acceptance: every envelope is traceable to the published capture and invocation; all background calls and direct probes are retained, request/response order/count/shapes are exact, and no Docker/midPoint/external-server dependency is used by replay. No production code, content-type schema, generated content-type declaration, index, JDL, dependency or activation configuration changed. The three committed activation defaults remain false. No existing developer service was stopped; the harness used its own ephemeral listener. The full backend gate remains with the orchestrator and was not run.

## Issues encountered

The existing convenience request helper combined its default Accept with the capture's lowercase accept, producing different negotiation. The new wire method sends exactly the captured headers; expected responses were unchanged. A development-build refresh briefly removed a compiled module during an intermediate run while helper edits were ongoing; the final run after edits completed passed without stopping the developer server.

## Deviations from plan

The plan calls the HTTP helper new, but it already existed from prior completed plans. Extended that helper instead of creating a competing harness (Task 1, `80d38fa0`); final compilation and all replay assertions pass. P3-34 asserted PUT and P3-36 unpaged behavior were retained exactly as required by the current context. The two test-compilation exclusions are the explicitly authorized gate workaround, not a deviation.

STATE.md and the ROADMAP.md checkbox were updated as explicitly requested, overriding the plan footer's administrative exclusion. Stale aggregate counters were reconciled to 14/18 Phase 3 plans and 32/36 total delivered plans. Shared requirement identifiers remain subject to the unfinished sibling plans and final phase verification.

## Readiness and stop point

Discovery, mapping, closed error semantics and this captured sequence are fixed and covered by the replay plus focused regressions. This satisfies the captured-sequence prerequisite for Phase 4 contract work; it does not complete Phase 3 or Phase 4. Phase 4 must re-capture if request configuration changes and must resolve the P3-36 default-100 connector-list limitation.

Stopped after 03-14. Plan 03-15 has not started. Same-session refusal preparation/live proof, review/security and final full-phase gates remain in 03-15 through 03-18.
