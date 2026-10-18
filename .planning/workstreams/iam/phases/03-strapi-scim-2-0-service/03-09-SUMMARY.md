---
phase: 03-strapi-scim-2-0-service
plan: "09"
subsystem: api
tags: [scim, routes, source-authorization, lifecycle]
status: complete
requires:
  - phase: 03-08
    provides: Closed discovery and Group responses over the existing source policy and identity service
provides:
  - Exactly 21 authenticated SCIM operations at the Strapi root with no content-api aliases
  - Thin source-scoped read, create, replace, atomic patch and tombstone adapters
  - Real mounted HTTP coverage of exact grants, retained references and provisioning failure semantics
affects: [03-10, 03-11, 03-13, 03-14, 03-15, 03-16]
tech-stack:
  added: []
  patterns: [bootstrap root registration, explicit per-operation source policy, identity-service adapters]
key-files:
  created:
    - apps/backend/src/iam/scim/routes.ts
    - apps/backend/src/iam/scim/handlers.ts
    - apps/backend/tests/helpers/iam-scim-http-harness.ts
    - apps/backend/tests/iam-scim-routes.integration.test.ts
  modified:
    - apps/backend/src/index.ts
    - apps/backend/tests/ai-run-boot.unit.test.ts
key-decisions:
  - Preserve catalogue grant templates with literal {id} while mounting router parameters with :id
  - Omit the root router type as locked; confine the installed declaration mismatch to the registration seam
  - Keep all persistence and source ownership decisions in the existing identity service
requirements-completed: ["PROV-01","PROV-02","PROV-03","PROV-04","LIFE-03"]
coverage:
  - id: root-operations-and-grants
    description: Exactly 21 root operations mount once, reject content-api aliases and require current source credentials and exact operation grants
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-scim-routes.integration.test.ts
        status: pass
    human_judgment: false
  - id: scoped-lifecycle-and-retained-references
    description: Public scoped reads, replacement and manual claim, atomic PATCH, role preservation and idempotent tombstones retain request, risk and system-owner references
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-scim-routes.integration.test.ts
        status: pass
    human_judgment: false
  - id: rollback-outbox-and-compatibility
    description: Blocking provisioning failure returns safe 503 with Retry-After 30 and rolls back; inactive updates commit pending outbox work without a remote call; existing CSRM and boot behavior remains
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-scim-routes.integration.test.ts
        status: pass
      - kind: command
        ref: pnpm --dir apps/backend exec tsc --pretty false
        status: pass
      - kind: unit
        ref: apps/backend/tests/ai-run-boot.unit.test.ts
        status: pass
      - kind: unit
        ref: apps/backend/tests/keycloak-provisioning.unit.test.ts
        status: pass
      - kind: unit
        ref: apps/backend/tests/iam-write-discipline.unit.test.ts
        status: pass
      - kind: unit
        ref: apps/backend/tests/iam-schema-contract.unit.test.ts
        status: pass
    human_judgment: false
actuals:
  tasks: 1
  files: 6
  commits: 2
duration: approximately 7 min from first task commit
completed: "2026-10-15T16:40:41Z"
---

# Phase 3 Plan 09: Root SCIM transport summary

All 21 SCIM operations mount through the existing Strapi root manager, require source authentication and exact grants, and delegate User lifecycle decisions to the approved identity service.

## Accomplishments

- Bootstrap mounts the exported manifest once per backend instance at `/scim/v2`, omitting the routing type. Real router-layer assertions prove all 21 method/templates occur exactly once, even after repeated registration; no `/api/scim/v2` alias exists. Every operation has `auth:false` and the explicit `global::scim-source-bearer` policy with the catalogue's unchanged grant URL.
- Thin adapters use the server source context, raw query entries, closed wire parsers, public projections, discovery helpers and in-lock PATCH reducer. They preserve 201/Location creation, 200 replacement/PATCH, explicit manual PUT claim and bodyless 204 soft deletion. Foreign/protected/manual mutation refusals, reserved tuples, roles, subject and request/risk/system-owner references are exercised over real local HTTP and persistence.
- The real existing HTTP harness boots an isolated database and keeps source credentials in memory. Tests cover every individual grant withdrawal, human/CSRM credential refusal, discovery/404/501, representative unchanged CSRM authorization, safe 503/Retry-After 30 with rollback for active/inactive create, mirrored update, reactivation and manual claim, plus inactive PUT/PATCH committing pending outbox work with no provisioning call.

Executed only 03-09: one task, six implementation/test files including the necessary bootstrap fixture adjustment. Earlier summaries were treated as complete. Fetched current remote references, reviewed shared-backend history and confirmed no incoming changes to this plan's identity, bootstrap or middleware boundaries. Rechecked all 18 phase plan structures: valid, zero errors or warnings. No next-plan work or live checkpoint was started.

The frontmatter requirements record this plan's contribution. All five remain pending in REQUIREMENTS.md because later sibling plans declare them; the readiness query returned 0/5 ready to mark complete.

## Task commits and test-first evidence

1. `10d67182` — `test(iam): specify root SCIM routes and scoped HTTP lifecycle`.
2. `f1fcbcec` — `feat(iam): mount source-scoped SCIM operations at the Strapi root`.

The named mount assertion first failed against the pre-change bootstrap: actual root operations `[]`, expected all 21. Repeating that baseline with TAP output produced `RED_EVIDENCE_OK` from the evidence validator. The mount test asserts bootstrap mounting before exercising repeated registration. Final behavior is 10/10 passing with no skips. No separate refactor was necessary. The first task commit was at 2026-10-15T16:32:56Z; final code verification and implementation commit completed at 2026-10-15T16:39:18Z. Preparation preceded that measured interval.

## Verification

Commands ran from repository root with the supplied Node/pnpm installation prepended to PATH.

| Check | Result |
| --- | --- |
| Phase plan structure checks | All 18 valid; zero errors or warnings |
| `pnpm --dir apps/backend exec tsc --pretty false` | Pass, exit 0 |
| `pnpm --dir apps/backend exec tsc -p .tmp/iam-03-09-tests.json --pretty false` | Pass, exit 0; named compiled route test exists |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-scim-routes.integration.test.js` | 10/10 pass, zero failures/skips, approximately 37 seconds |
| Focused regression command below | 80/80 pass, zero failures/skips, approximately 15 seconds |
| Production Document Service write inventory | Pass; 270 source files covered |
| `git diff --check` | Pass |
| Changed paths and tracked activation examples | No content-type/schema/generated declaration/index/JDL/configuration changes; all three activation flags remain false |

```sh
pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/ai-run-boot.unit.test.js .tmp/tests-dist/tests/keycloak-provisioning.unit.test.js .tmp/tests-dist/tests/iam-write-discipline.unit.test.js .tmp/tests-dist/tests/iam-schema-contract.unit.test.js
```

The ignored compiler config extends `../tests/tsconfig.json` and excludes exactly `../tests/risk-curation-rules.unit.test.ts` and `../tests/risk-history-changes.unit.test.ts`, as authorized for WINDOWS.md entry 11. This is not a deviation. The regular test config and the two excluded tests are unchanged. The full backend gate remains with the orchestrator.

The initial CSRM compatibility assertion expected 404 for another Requestor's request. The established authorization suite specifies 403 for that route; the new assertion was corrected to that existing contract. Production CSRM authorization was unchanged.

## Deviations from Plan

1. **[Rule 3 — declaration blocker] Root router compatibility assertion.** Installed Strapi declarations require `Router.type`, although the inspected runtime explicitly selects the root manager when it is absent. Adding a type would violate P3-03. Kept the required runtime object and used one localized assertion at `server.routes` in `routes.ts`. Verified by production/test compilation and actual root-layer and HTTP checks. Commit: `f1fcbcec`.
2. **[Rule 3 — regression fixture blocker] Existing bootstrap fixture needs the server surface.** The focused bootstrap regression initially failed two cases because its fake backend lacked `server.routes`. Added a one-line no-op method to that fixture in `apps/backend/tests/ai-run-boot.unit.test.ts`; retained all existing assertions. All three bootstrap tests and the complete 80-test focused regression selection pass. Commit: `f1fcbcec`.

Total deviations: 2 compatibility fixes. No model, architecture, grant, dependency or activation change.

## Remaining gates and stop point

03-09 is complete and verified. Phase 3 is 9/18 plans complete; 03-10 through 03-18 remain unstarted. Connector capture/replay, live refusal/outage/browser proof, inventory/contract updates, review/security audit and final full gates remain assigned to their later plans. Local authored HTTP assertions and an unavailable in-memory provisioning client do not claim live connector or outage evidence. Stop before 03-10 as requested.
