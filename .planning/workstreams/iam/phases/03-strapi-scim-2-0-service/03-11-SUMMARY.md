---
phase: 03-strapi-scim-2-0-service
plan: "11"
subsystem: contract
tags: [scim, openapi, catalogue, runtime-inventory, compatibility]
status: complete
requires:
  - phase: 03-10
    provides: Mounted and verified source-scoped SCIM lifecycle and security behavior
provides:
  - Additive root SCIM contract and generated client declarations for all 21 operations
  - Byte-identical catalogue descriptions with existing capability identities and grants preserved
  - Runtime-generated inventory backed by observed root registrations and actual Koa layers
affects: [03-12, 03-13, 03-14, 03-18]
tech-stack:
  added: []
  patterns: [root registration observation, operation-local servers, additive compatibility fingerprints]
key-files:
  created: []
  modified:
    - docs/references/specification.json
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - apps/backend/tests/served-operations.integration.test.ts
    - docs/references/served-operations.json
key-decisions:
  - Describe P3-33 through P3-35 tolerances and asserted-attribute PUT without reverting to the superseded clearing rule
  - Observe root-manager configuration before bootstrap and validate it against actual mounted layers, independently of manifest expectations
  - Classify source-bearer separately from content API token authentication and preserve every unrelated inventory row
requirements-completed: ["PROV-01","PROV-02","PROV-03","PROV-04","PROV-08"]
coverage:
  - id: additive-contract-and-grants
    description: All 21 rooted source-bearer operations, negotiated media, wire schemas, errors, headers and preserved legacy contract/grants
    verification:
      - kind: integration
        ref: apps/backend/tests/contract-catalogue.integration.test.ts
        status: pass
      - kind: command
        ref: pnpm --dir apps/csrm api:check
        status: pass
      - kind: command
        ref: pnpm --dir apps/csrm typecheck
        status: pass
    human_judgment: false
  - id: actual-mounted-inventory
    description: Observed root configuration, exact layer counts, source policy, absent aliases and unchanged existing inventory classifications
    verification:
      - kind: integration
        ref: apps/backend/tests/served-operations.integration.test.ts
        status: pass
    human_judgment: false
  - id: connector-and-client-regressions
    description: Existing wire, query, PATCH, discovery, boundary, HTTP lifecycle/security and CSRM behavior remain green
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-scim-lifecycle.integration.test.ts
        status: pass
      - kind: integration
        ref: apps/backend/tests/iam-scim-security.integration.test.ts
        status: pass
      - kind: command
        ref: pnpm --dir apps/csrm test
        status: pass
    human_judgment: false
actuals:
  tasks: 2
  files: 8
  commits: 5
duration: approximately 11 min
completed: "2026-10-15T21:07:12Z"
---

# Phase 3 Plan 11: Root SCIM contract and runtime inventory summary

All 21 existing SCIM capabilities now have an additive root OpenAPI contract, generated declarations and runtime inventory backed by actual Strapi registration and Koa layers.

## Accomplishments

- Published operation-local `servers: [{url: '/'}]`, distinct operation IDs and source-bearer security for every SCIM operation. Documented direct SCIM resources, negotiated JSON media, query/filter/projection bounds, primary-email selection, immutable exact source keys with the Enterprise fallback, asserted PUT omissions, confirmed-claim trust, atomic email PATCH, retained DELETE, safe errors and response headers. Group reads remain empty/404 and all eight writes are authenticated 501 responders.
- Changed only the 21 existing catalogue descriptions; both copies remain byte-identical. Existing ids, URLs, Function linkage, roles, menus and Application partition are unchanged. The compatibility guard retains the original legacy-contract and capability fingerprints. Generated declarations are additive, with no existing declaration removed and no frontend SCIM calls added.
- Extended the existing harness to observe real root-manager registrations before bootstrap. Inventory checks compare those configurations and the manifest against actual root Koa layers, require each method/template exactly once, reject missing/duplicate/incorrect layers, aliases and incorrect auth/policies, and label source-bearer separately. Negative mutation checks prove these guards fail in the intended direction.
- Regenerated the inventory through its existing runtime writer: 120 served operations, including 21 SCIM operations, and 33 unrelated unserved entries. Every non-SCIM inventory record and unrelated unserved reason is unchanged. The ordinary read/check run verifies the generated output without skips.

## Task commits

| Task | Commit | Result |
| --- | --- | --- |
| 1 — Contract test | `f95e33a3` — test(iam): specify additive root SCIM contract compatibility | Initial check fails before publication |
| 2 — Inventory test | `3256494e` — test(iam): require source-protected mounted SCIM inventory | Initial check fails against the old inventory builder |
| 1 — Contract and catalogue publication | `f8802e52` — feat(iam): publish additive source-authenticated SCIM contract | 27/27 contract tests pass; declarations committed before api:check |
| 2 — Runtime inventory | `59f57309` — feat(iam): inventory actual root SCIM layers and source policies | Runtime writer succeeds; ordinary inventory 13/13 pass |

The final `docs(03)` commit records this summary and the requested STATE/ROADMAP updates. Only 03-11 was executed; 03-12 remains unstarted.

## Verification

All commands ran from the repository root with the supplied Node/pnpm installation prepended to PATH and installed dependencies reused.

The authorized compilation configuration is `apps/backend/.tmp/03-11-tests.json`, extending `../tests/tsconfig.json` and excluding exactly `../tests/risk-curation-rules.unit.test.ts` and `../tests/risk-history-changes.unit.test.ts`. The existing writer script's compiler path was temporarily redirected to this configuration for its run and its package file restored byte-for-byte afterwards; no package-script change is committed. These are the requested WINDOWS.md entry 11 accommodations.

| Check | Result |
| --- | --- |
| Phase plan structure check, all 18 plans | All valid; no errors or warnings |
| `pnpm --dir apps/backend exec tsc -p .tmp/03-11-tests.json --pretty false` | Pass |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/contract-catalogue.integration.test.js` | 27 pass, 0 fail, 0 skip |
| `pnpm --dir apps/csrm api:generate` | Pass; generated output committed with implementation |
| `SERVED_OPERATIONS_WRITE=1 pnpm --filter @csrm/strapi served-operations:write` with the authorized compiler configuration | 12 pass, 0 fail; one intentional writer-only drift-check skip |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/served-operations.integration.test.js` | 13 pass, 0 fail, 0 skip; ordinary drift check passes |
| `pnpm --dir apps/csrm api:check` | Pass after declaration commit and again after inventory implementation commit |
| `pnpm --dir apps/csrm typecheck` | Pass |
| `pnpm --dir apps/csrm test` | 222 files and 5,409 tests pass |
| `pnpm --dir apps/backend exec tsc --pretty false` | Pass |
| Compiled SCIM wire, PATCH, query, discovery and boundary unit suites, concurrency 1 / timeout 180000 | 54 pass, 0 fail, 0 skip |
| Compiled SCIM lifecycle and security integration suites, concurrency 1 / timeout 180000 | 17 pass, 0 fail, 0 skip |
| Parsed legacy contract/capability equality, catalogue byte equality and non-SCIM inventory comparison | Pass |
| `git diff --check` and owned-file audit | Pass; no content-type/schema, generated content-type declaration, index, JDL, dependency or committed configuration changes |

The committed provisioning, token-verification and OIDC activation defaults remain false. The running development server and identity stack were left running; only isolated test harnesses used ephemeral ports. No live connector capture, browser/outage gate or full backend suite was run; those remain with the orchestrator. Requirement identifiers above record this plan's contribution; shared phase requirements and Phase 3 completion remain pending their later plans and gates.

## Deviations from Plan

None. P3-33 through P3-35 are the supplied authoritative amendments, and the two-file compilation exclusion is explicitly authorized. STATE and ROADMAP updates follow the explicit execution request over the plan's worker-only output note.

## Issues Encountered

The compatibility guard caught an initially misplaced nested component insertion; it was corrected while retaining the original baseline fingerprints and existing assertions. Initial contract-test projection setup was corrected for the legacy specification's absent securitySchemes member. No production behavior or existing tests were weakened.

## Stop point

03-11 is complete. Phase 3 remains in progress at 11/18 plans. Stop before 03-12; connector capture, later conformance, refusal, review/security and final phase gates remain pending.
