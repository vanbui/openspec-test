---
phase: 03-strapi-scim-2-0-service
plan: "03"
subsystem: auth
tags: [scim, wire-validation, mapping, safe-errors]
status: complete
requires:
  - phase: 03-02
    provides: Completed source credential lifecycle and delivery boundary
provides:
  - Closed SCIM create and replacement parsers using the shared source DTO validator
  - Allowlisted Core and Enterprise User mapping with documentId locations
  - Safe protocol error envelopes and bodyless response helpers
affects: [03-04, 03-05, 03-07, 03-08, 03-09]
tech-stack:
  added: []
  patterns: [closed wire validation, shared source DTO validation, explicit outbound projection]
key-files:
  created:
    - apps/backend/src/iam/scim/wire.ts
    - apps/backend/src/iam/scim/mapping.ts
    - apps/backend/src/iam/scim/errors.ts
    - apps/backend/tests/iam-scim-wire.unit.test.ts
  modified: []
key-decisions:
  - Keep the existing source parser authoritative for internal field validation and replacement clearing
  - Reject owned fields before unsupported-path handling and construct error details only from closed constants
  - Project public fields explicitly, preserving exact source identifiers and omitting unavailable metadata
requirements-completed: ["PROV-01", "PROV-03"]
coverage:
  - id: wire-validation
    description: Complete mapped create and replace inputs, defaults, nulls, schema checks and mutability
    requirement: PROV-03
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-wire.unit.test.ts
        status: pass
      - kind: unit
        ref: apps/backend/tests/iam-identity-input.unit.test.ts
        status: pass
    human_judgment: false
  - id: public-mapping
    description: Core and Enterprise outbound projection with documentId locations and no private data
    requirement: PROV-01
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-wire.unit.test.ts#outbound allowlist omits private fields and unassigned optionals without inventing metadata
        status: pass
    human_judgment: false
  - id: safe-errors-and-media
    description: Closed SCIM errors, exact statuses and retry headers, direct resources and bodyless 204
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-wire.unit.test.ts
        status: pass
    human_judgment: false
actuals:
  tasks: 1
  commits: 2
duration: 6 min
completed: "2026-10-15T15:38:20Z"
---

# Phase 3 Plan 03: Fixed SCIM wire contract summary

Typed SCIM create/replacement validation maps the fixed Core/Enterprise fields through the existing source DTO contract, with safe direct resources and closed error envelopes.

## Scope and accomplishments

Only 03-03 was executed: one task, four owned files. Preparation and implementation took approximately six minutes. Earlier summaries were treated as completed work. Latest landed backend identity/token code was reconciled against the locked context, and all 18 phase plan structure checks passed with zero errors or warnings before implementation.

- Create and replacement require the Core User schema, username, selected email and exact opaque externalId. Enterprise attributes require the declared Enterprise schema. Ambiguous emails, invalid types, unsupported schemas and unknown writable fields fail closed. Owned fields fail mutability. Display name derives from trimmed name parts and then username; omitted active defaults true.
- Replacement verifies any echoed id against its target, ignores read-only metadata, and invokes the existing parser in replace mode to clear omitted optional fields. The resulting DTO contains only supported source fields; role/protection/subject/password/ownership values cannot enter the write input.
- Outbound mapping selects public fields explicitly, returns a single primary email, omits unassigned optional values and manual externalId, and roots encoded documentId locations at `/scim/v2/Users`. No version, timestamps, private fields or populated relations are emitted.
- Closed errors implement every planned status/scimType mapping with constant safe detail. Keycloak unavailability returns 503, `Retry-After: 30` and no scimType. Unknown exceptions are discarded. Transport helpers use SCIM media for bodies and omit the body/content type for 204.

## Task commits

1. `74985e79` — `test(iam): specify closed SCIM wire mapping and error behavior`.
2. `dfe71b76` — `feat(iam): validate and map the fixed SCIM user contract`.

Summary/state/roadmap updates are committed separately as plan metadata.

## Verification

Commands ran from repository root using the supplied Node/pnpm installation on PATH.

| Check | Result |
|---|---|
| Phase plan structure checks | 18/18 valid; zero errors/warnings |
| `pnpm --dir apps/backend exec tsc -p .tmp/tsconfig.iam-scim.json --pretty false` | Pass; final exit 0 |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 .tmp/tests-dist/tests/iam-scim-wire.unit.test.js` | 11/11 pass; zero failures/skips |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 .tmp/tests-dist/tests/iam-identity-input.unit.test.js` | 7/7 pass; zero failures/skips |
| `git diff --check` | Pass |

The ignored temporary compiler config extends `../tests/tsconfig.json` and excludes exactly `../tests/risk-curation-rules.unit.test.ts` and `../tests/risk-history-changes.unit.test.ts`. This follows the prescribed WINDOWS.md entry 11 procedure and is not a deviation. The ordinary test config and excluded tests are unchanged. The full backend gate remains with the orchestrator.

Acceptance checks cover every mapped field, default/omission/null behavior, replacement clearing and echoed ids, owned/unknown paths, primary-email ambiguity, public projection, safe errors/status/header behavior and 204 responses. All pass. No schema, generated content-type, index, JDL, dependency, catalogue or committed configuration changed. All three committed activation examples remain false. No credentials were issued; `docker/.env` was never read, printed or written.

## Deviations and issues

No functional deviation from the locked context. The explicit execution request overrides the plan's worker-only instruction to leave STATE.md and ROADMAP.md untouched; both are updated for 03-03 only.

The initial test-first compilation failed on the three not-yet-created modules. This was compilation-only evidence, rather than the runtime assertion failure required by the execution workflow's strict RED gate; it is recorded as a sequencing deviation, not claimed as an assertion RED. Final compilation and all named behavior tests pass. No assertion was weakened. During implementation, the configured TypeScript library rejected Object.hasOwn; using the existing hasOwnProperty.call pattern resolved that diagnostic without changing compiler settings.

## Remaining gates and stop boundary

03-04 through 03-18 remain unstarted. No route, live connector capture, HTTP lifecycle evidence, browser/refusal evidence, review/security audit or full backend gate is claimed by this unit-level adapter work. Shared PROV-01/PROV-03 requirements remain pending in REQUIREMENTS.md until their remaining sibling plans and execution gates complete. Phase 3 remains in progress at 3/18 plans. Stopped after 03-03 as requested.
