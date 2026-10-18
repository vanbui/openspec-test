---
phase: 12-ai-context-suggestions-and-provenance
plan: 02
subsystem: backend
tags: [risk-scale, data-policy, configuration, testing]
requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: baseline assessment workflow and test harnesses
provides:
  - Shared 5 x 5 risk derivation and rating vocabulary
  - Classification ceiling decision with a fail-closed production default
  - Development-only completion transcript diagnostics
  - Deterministic suite ceiling pins
affects: [12-06, 12-10, 12-14, 18, 22]
actuals:
  tokens: 5600
  tasks: 2
  commits: 4
tech-stack:
  added: [knex direct development dependency for the existing test suite]
  patterns: [pure risk scale and data policy modules]
key-files:
  created:
    - apps/backend/src/csrm/risk-scale.ts
    - apps/backend/src/csrm/ai/data-policy.ts
    - apps/backend/tests/risk-scale.unit.test.ts
    - apps/backend/tests/ai-data-policy.unit.test.ts
  modified:
    - apps/backend/config/ai.ts
    - apps/backend/src/csrm/ai-config-validation.ts
    - apps/backend/src/csrm/openai-compatible-client.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
    - apps/backend/tests/ai-provider-boot.unit.test.ts
    - apps/backend/tests/ai-provider-questionnaire.unit.test.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - apps/csrm/playwright.config.ts
    - apps/backend/.env.example
    - apps/backend/package.json
    - pnpm-lock.yaml
key-decisions:
  - "A deployment with no classification ceiling refuses generation outside development."
  - "Both development flags are required before transcript diagnostics can log."
requirements-completed: [ASSESS-08, INT-05]
status: complete
completed: 2026-10-05
---

# Phase 12 Plan 02 Summary

## Accomplishments

- Derived every rating from the shared likelihood and consequence scales and placed the Accept rule with that vocabulary.
- Added a closed data-classification ceiling parser and a pure policy decision. Invalid ceiling configuration stops registration for every provider.
- Restricted transcript logging to development, moved existing assessment vocabularies to the shared modules, and pinned the ceiling and transcript flag in both automated harnesses.

## Task Commits

1. `test(12-02): pin the risk scale, classification policy and transcript gate` — `de5d5b2`
2. `fix(12-02): declare knex for the backend test that imports it` — `b651366`
3. `feat(12-02): derive ratings and enforce the classification and transcript policy` — `4ee3d44`
4. `docs(12-02): summarize the risk scale and data policy` — this summary's commit

## Verification

- New and changed focused backend tests: 19 passed, 0 failed.
- Backend source and test TypeScript compilations: passed.
- Web typecheck: passed.
- Full backend suite: first run reached 2 failures in the register tests (the minimal logger lacked `warn`); the corrected full run passed, 718/718 with 0 failures.
- Static acceptance checks and `git diff --check`: passed.

## Deviations

The test TypeScript compilation found that `request-status-summary.unit.test.ts` imports `knex`, which was present transitively but absent from the backend's direct dependencies. The first compilation failed with module-resolution and related implicit-type errors. Declaring the existing locked `knex@3.0.1` version as a development dependency resolved the compilation without a network download. This changes `apps/backend/package.json` and `pnpm-lock.yaml`; it is the sole dependency change. Git writes were prohibited for this run, so commit SHAs are pending.

The first full backend run found two failures in a register test whose logger has no `warn` function. The new optional configuration warning now checks for that function. The failing file and the configuration tests pass together, 38/38. The full backend suite then passed, 718/718.

## Self-Check: PASSED

The full backend suite, web typecheck, focused policy tests, static acceptance checks and whitespace check pass. No content-type schema file changed.
