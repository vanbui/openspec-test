---
phase: 04-assessment-review-risk-editing-and-release
plan: "04"
subsystem: api
tags: [strapi, deterministic-provider, single-flight-registry, risk-types, development-seed]

requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: closed draft-job contract, mutation DTOs, release rules, and secure aggregate identifiers from Plans 02-03
provides:
  - Closed provider-independent deterministic assessment proposal boundary
  - Actor-scoped single-flight draft-job registry with safe retry and bounded terminal retention
  - Triple-gated RiskType fixtures linked to stable existing Controls
affects: [04-06, 04-07, 04-08, 04-10, 04-11, 04-15, 04-16]

tech-stack:
  added: []
  patterns: [closed advisory proposal parser, questionnaire-key signal mapping, volatile single-flight jobs, terminal TTL and LRU retention, idempotent relation repair]

key-files:
  created:
    - apps/strapi/src/api/csrm-assessment/services/assessment-draft-provider.ts
    - apps/strapi/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts
    - apps/strapi/src/api/csrm-assessment/services/assessment-draft-registry.ts
    - apps/strapi/src/bootstrap/seed-assessment-workflow.ts
    - apps/strapi/tests/assessment-seed.integration.test.ts
  modified:
    - apps/strapi/tests/assessment-workflow.unit.test.ts
    - apps/strapi/src/index.ts

key-decisions:
  - "Questionnaire text is treated only as bounded data and is never echoed into proposal templates or interpreted as instructions."
  - "Job records expose safe metadata only; initiating analysts retain access while equivalent all-job scope must be asserted by the later exact-grant route boundary."
  - "Deterministic RiskTypes reuse six stable controls from the existing 2,646-control library and seed reconciliation replaces only managed descriptions and relations."

patterns-established:
  - "Advisory proposal boundary: exact keys, bounded strings and arrays, sorted unique RiskTypes and Controls, and no persistence, identity, status, timestamp, or release fields."
  - "Volatile registry boundary: opaque IDs, one in-flight promise per questionnaire, failed-only same-job retry, generic unexpected failures, and active-job-safe terminal cleanup."

requirements-completed: [ASSESS-02, ASSESS-03]

duration: 10min
completed: 2026-08-30
---

# Phase 4 Plan 4: Deterministic Assessment Draft Assistance Summary

**Closed deterministic risk proposals, an actor-scoped bounded job registry, and three realistic RiskTypes linked to the unchanged 2,646-control library.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-29T22:41:43Z
- **Completed:** 2026-08-29T22:51:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added a versioned provider interface and deterministic implementation that maps normalized questionnaire signals to stable ordered Internet Exposure, Personal Information Handling, and Third-Party Dependency proposals.
- Added strict proposal validation that rejects workflow, identity, relation, audit, instruction, tool, persistence, and release fields before advisory output can cross the provider boundary.
- Added a volatile registry covering queued, running, completed, failed, and failed-only retry states with opaque identifiers, safe actor-scoped projections, single-flight execution, and 500-record/one-hour TTL-LRU terminal bounds.
- Added exact-gated, idempotent RiskType fixtures using six real Controls while preserving all 2,646 Control records and the Phase 3 development request/questionnaire identifiers.

## Task Commits

Each TDD task was committed through separate RED and GREEN gates:

1. **Task 1 RED: Build the bounded deterministic proposal provider** - `71d6adc` (test)
2. **Task 1 GREEN: Build the bounded deterministic proposal provider** - `9d83574` (feat)
3. **Task 2 RED: Implement the bounded single-flight registry** - `7878294` (test)
4. **Task 2 GREEN: Implement the bounded single-flight registry** - `40a6725` (feat)
5. **Task 3: Seed deterministic RiskTypes and applicable Controls** - `c9093b0` (feat)

**Plan metadata:** committed separately with this summary and sequential tracking updates.

## Files Created/Modified

- `apps/strapi/src/api/csrm-assessment/services/assessment-draft-provider.ts` - Provider-independent context, proposal types, and closed bounded proposal parser.
- `apps/strapi/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts` - Versioned stable mapping and advisory proposal templates.
- `apps/strapi/src/api/csrm-assessment/services/assessment-draft-registry.ts` - Opaque single-flight lifecycle with actor scope, retry, safe errors, and retention bounds.
- `apps/strapi/src/bootstrap/seed-assessment-workflow.ts` - Triple-gated RiskType and applicable-Control reconciliation.
- `apps/strapi/tests/assessment-workflow.unit.test.ts` - Unconditional provider and registry contract coverage.
- `apps/strapi/tests/assessment-seed.integration.test.ts` - Fresh, repeated, repair, gate, Control-count, and Phase 3 fixture integration coverage.
- `apps/strapi/src/index.ts` - Registers the assessment fixture after base Controls and questionnaire fixtures.

## Decisions Made

- Stable proposal templates consume questionnaire values only as mapping signals, preventing hostile answer text from introducing instructions, network targets, workflow fields, or persisted content.
- Sensitive or financial personal-information categories produce the highest closed draft rating, while overall rating is the highest applicable deterministic mapping; clients and later persistence flows still do not calculate or auto-release anything.
- Equivalent cross-job observation is represented as an explicit registry actor capability so later mounted routes must derive it from exact Security Analyst authorization rather than knowledge of a job ID.
- The seed uses existing `E8-PATCH_APPLICATIONS-003`, `V3.1.1`, `APP-12`, `GV.OC-03`, `CPS-234-16`, and `GV.SC-04` Controls and never creates, updates, or deletes Control definitions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reconciled sequential state fields unsupported by the installed state handlers**
- **Found during:** Plan close-out
- **Issue:** `state.advance-plan` could not parse the frontmatter-first state format, while `state.update-progress` wrote the completed-plan count as the percentage instead of calculating milestone progress.
- **Fix:** Retained successful handler updates for metrics, decisions, session, roadmap, and requirements; then reconciled Plan 5, 38/50 completed plans (76%), and the Plan 04-05 next action.
- **Files modified:** `.planning/STATE.md`
- **Verification:** STATE records `current_plan: 5`, `completed_plans: 38`, `percent: 76`, and `Stopped At: Completed 04-04-PLAN.md`; ROADMAP records 4/16 Phase 4 plans executed.
- **Committed in:** plan tracking commit

---

**Total deviations:** 1 auto-fixed (1 blocking issue).
**Impact on plan:** Sequential tracking was restored without changing production behavior or widening scope.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `npm test` in `apps/strapi` under Node 24.19.0 with `STRAPI_ADMIN_AUTO_OPEN=false`: PASS, 50/50 tests.
- Provider determinism, hostile-answer containment, proposal closure, and persistence/release dependency checks: PASS.
- Registry state, duplicate enqueue, actor denial, retry, safe failure, TTL, LRU, capacity constant, and active-retention checks: PASS.
- Mounted assessment seed fresh/repeated/repair verification: PASS with exactly three managed RiskTypes and exactly 2,646 Controls.
- Phase 3 fixture identifiers `RAR-DEV-QUES-001` and `QUES-DEV-001`: PASS and unchanged.
- Catalogue SHA-256 comparison: PASS, both copies remain byte-identical.
- Frozen content-type schema diff guard: PASS, no `schema.json` changes.
- Test-integrity scan: PASS, no Phase 4 sentinel, skip, file guard, or conditional test escape hatch.

## Known Stubs

None. The provider is intentionally deterministic and advisory for Phase 4; durable provider infrastructure remains explicitly assigned to Phase 8 and no production result is represented as released.

## Self-Check: PASSED

- All seven created or modified plan files exist.
- Task commits `71d6adc`, `9d83574`, `7878294`, `40a6725`, and `c9093b0` exist in repository history.
- Every task acceptance criterion and the plan-level verification command passed without touching frozen schemas or catalogue content.

## Next Phase Readiness

- Later generation routes can reload authoritative submitted answers, invoke the pure provider, and persist only the validated proposal through their own transaction boundary.
- Plan 04-05 can mount the exact analyst review queue without depending on provider or registry internals.
- No blocker, external configuration, schema change, or dependency addition remains.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*
