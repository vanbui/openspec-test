---
phase: 03-strapi-scim-2-0-service
plan: "04"
subsystem: auth
tags: [scim, filters, pagination, projections, source-isolation]
status: complete
requires:
  - phase: 03-03
    provides: Fixed public SCIM mapping and closed error envelopes
provides:
  - Bounded eq/and filter grammar compiled to typed source equality inputs
  - Raw query validation, normalized safe paging and public response projections
  - Source-scoped case-insensitive equality with literal-safe counts and pages
affects: [03-09, 03-10, 03-13, 03-14]
tech-stack:
  added: []
  patterns: [closed query grammar, public projection allowlist, scoped literal refinement]
key-files:
  created:
    - apps/backend/src/iam/scim/filter.ts
    - apps/backend/src/iam/scim/query.ts
    - apps/backend/tests/iam-scim-query.unit.test.ts
    - apps/backend/tests/iam-scim-query.integration.test.ts
  modified:
    - apps/backend/src/iam/identity/identity-service.ts
key-decisions:
  - Locked P3-17 normalization overrides conflicting plan minimum wording
  - Keep externalId exact and permit caseInsensitive only on username, email and employeeNumber
  - Refine LIKE-sensitive literals before totals and pagination using scoped Document Service reads
requirements-completed: ["PROV-02"]
coverage:
  - id: bounded-filter-grammar
    description: Restricted paths and eq/and syntax with JSON escaping and inclusive input bounds
    requirement: PROV-02
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-query.unit.test.ts
        status: pass
    human_judgment: false
  - id: query-paging-projection
    description: Raw duplicate rejection, safe normalized pagination, zero-count envelopes and public field projection
    requirement: PROV-02
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-query.unit.test.ts
        status: pass
      - kind: integration
        ref: apps/backend/tests/iam-scim-query.integration.test.ts
        status: pass
    human_judgment: false
  - id: scoped-database-comparisons
    description: Real persistence proves ownership visibility, exact source keys, literal-safe comparisons and counts before pages
    requirement: PROV-02
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-scim-query.integration.test.ts
        status: pass
      - kind: integration
        ref: apps/backend/tests/iam-identity.integration.test.ts
        status: pass
    human_judgment: false
actuals:
  tasks: 1
  files: 5
  commits: 2
duration: approximately 15 min
completed: "2026-10-15T15:48:35Z"
---

# Phase 3 Plan 04: Constrained SCIM queries summary

Bounded list queries compile into source-safe equality DTOs, preserve scoped totals and deterministic pages, and project only allowlisted public SCIM attributes.

## Scope and accomplishments

Executed only 03-04: one task and five owned implementation/test files. Earlier summaries were treated as completed work. Reviewed the current shared identity boundary and the locked context, and reran all 18 phase plan structure checks: valid, zero errors or warnings.

- The filter parser accepts only a comparison followed by zero or more `and` comparisons. Paths and operators are case-insensitive; JSON string values retain their decoded contents. Only userName, externalId, emails.value and Enterprise employeeNumber (including its shorthand) are supported. Empty supplied filters, unsupported grammar/literals, injection and trailing input fail with safe invalidFilter errors. Limits are 4096 text characters, 20 terms and 255 decoded value characters.
- Query parsing consumes raw entries and rejects duplicates, structured values, unknown keys and sorting parameters. It validates safe integer syntax, normalizes low startIndex/negative count, caps effective count at 500 and translates to zero-based service offsets. List envelopes use scoped totals and actual page lengths; count zero omits Resources and beyond-end pages return an empty array.
- Response projections validate case-insensitive public paths, reject private/unknown paths and combined inclusion/exclusion, support parent/subattribute selection, and retain id/schemas. Projection starts from the existing fixed public mapper and cannot broaden service fields.
- The service permits explicit case-insensitive equality only for username/email/employeeNumber, preserving legacy equality DTOs and exact externalId. Existing visibility predicates, fresh source authority, public service projection and id:asc ordering remain enforced. Real SQLite persistence tests prove own/manual visibility and exclusion of foreign, protected and tombstoned records before filtering/counts/pages.
- Literal percent, underscore and backslash values receive exact refinement before counts/pages. This prevents the installed database adapter's LIKE implementation from turning equality into pattern matching. Reads use scoped Document Service queries in 500-row batches; ordinary comparisons retain database count/page execution.

## Task commits

1. `a9116543` — `test(iam): specify bounded source-safe SCIM queries`.
2. `c4c0ae0e` — `feat(iam): constrain SCIM filtering paging and projections`.

Summary/state/roadmap updates are committed separately as plan metadata.

## Verification

Commands ran from repository root using the supplied Node/pnpm installation on PATH.

| Check | Result |
|---|---|
| Phase plan structure checks | 18/18 valid; zero errors/warnings |
| Test-first baseline | Compilation passed against temporary uncommitted placeholders; 10/10 unit cases failed at runtime before implementation |
| `pnpm --dir apps/backend exec tsc -p .tmp/tsconfig.iam-scim-query.json --pretty false` | Pass; final exit 0 |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-scim-query.unit.test.js .tmp/tests-dist/tests/iam-scim-query.integration.test.js` | 15/15 pass: 10 unit, 5 real-persistence integration; zero failures/skips |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-identity.integration.test.js` | 7/7 pass; zero failures/skips |
| `git diff --check` | Pass |

The ignored temporary config extends `../tests/tsconfig.json` and excludes exactly `../tests/risk-curation-rules.unit.test.ts` and `../tests/risk-history-changes.unit.test.ts`. This is the requested WINDOWS.md entry 11 procedure, not a deviation. Neither excluded test nor the ordinary test compiler config changed. The full backend gate remains with the orchestrator.

Acceptance checks pass for grammar/bounds/escaping, opaque keys, allowed case comparisons, raw duplicate and malformed queries, projection safety, count zero, beyond-end and deterministic pages, and two-source/protected/manual/tombstone counts. The existing identity-service regression passes. No schema, generated content-type declaration, index, JDL, dependency, catalogue or committed configuration changed. The three committed activation examples remain false. No live credentials were used; `docker/.env` was never read, printed or written.

## Deviations and issues

1. **Locked pagination contract:** The plan describes startIndex/count minimums ambiguously. P3-17 explicitly requires startIndex below 1 to normalize to 1, negative count to normalize to zero and maximum effective count 500. Implemented and tested those rules rather than rejecting these inputs.
2. **Literal equality repair:** The first persistence run demonstrated that the installed Strapi `$eqi` predicate treats `%` and `_` as LIKE wildcards (`Alpha%` matched `Alpha`). Added scoped, bounded-memory literal refinement before totals/paging for these characters. Backslash also receives refinement because LIKE escape behavior differs by database dialect; its candidate predicate is non-null to avoid false negatives. Regression assertions cover literal matches, false matches, mixed case, hidden rows, zero count and page offsets. These inputs can scan more scoped candidates than ordinary equality; no raw SQL or model change was introduced. Verified on SQLite; no live PostgreSQL gate was part of this plan.

The explicit execution request overrides the plan's worker-only instruction to leave STATE.md and ROADMAP.md untouched; both are updated for 03-04 only. During the first persistence run, one projection expectation used lowercase email although the stored fixture preserved uppercase. Corrected the expectation to the exact persisted value; no assertion or requirement was weakened.

## Remaining gates and stop boundary

03-05 through 03-18 remain unstarted. This plan does not claim mounted HTTP lifecycle, live connector capture/replay, browser/refusal, review/security audit or full backend acceptance. PROV-02 remains pending in REQUIREMENTS.md because its sibling implementation and evidence plans remain incomplete. Phase 3 remains in progress at 4/18 plans. Stopped after 03-04 as requested.
