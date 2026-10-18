---
phase: "03"
slug: "strapi-scim-2-0-service"
status: verified
nyquist_compliant: false
wave_0_complete: true
created: "2026-10-15"
---

# Phase 3 — Validation Strategy

## Test Infrastructure

Use the existing Node test runner, real Strapi HTTP harness and strict TypeScript configuration at `apps/backend/tests/tsconfig.json`. No new framework is needed. All commands run from the repository root; the local Node/pnpm installation must be on PATH.

- Compile before each targeted sample: `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false`.
- Quick sample: the specific compiled unit tests named in the current PLAN, using `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 <compiled-test-path>`.
- Full suite: `pnpm --dir apps/backend test`.
- Contract/client checks: `pnpm --dir apps/csrm api:check`, plus `pnpm --dir apps/csrm typecheck` and `pnpm --dir apps/csrm test` when the contract or CSRM changes.

Unit feedback target is under 30 seconds after compilation; integration checks have explicit 180–600 second bounds. Live checkpoints have separate bounded stage deadlines and cannot count as quick samples. Runtime estimates must be measured during execution.

## Sampling Rate

After each implementation task, compile and run its named behavior tests. After each protocol wave, run its HTTP suite plus affected ownership/source/Keycloak regressions. Never allow three successive implementation tasks without an automated behavior check. Every runnable verification command needs an immediately following observable failure rule. Before final acceptance, run the complete backend suite and required client checks after all remediation.

## Requirement and Security Verification Map

| Requirement | Secure behavior | Automated proof | Live evidence |
|---|---|---|---|
| MODEL-02 | Fresh digest/binding, rotation, safe one-time delivery | Token parsing, dummy comparison, issue/rotate/revoke/concurrency/export tests | `03-CONNECTOR-CAPTURE-EVIDENCE.md` |
| PROV-01 | Scoped create with no source role grants | HTTP mapping, persistence, uniqueness and rollback | Connector create capture |
| PROV-02 | Visibility before filters/count/pages | Grammar, case rules, safe projection and pagination tests | Connector lookup/read/filter/page |
| PROV-03 | Atomic PUT/PATCH, preserved owned fields | Replace omissions, PATCH casing/selection/order, concurrent deltas and blocking 503 | Connector mover/PATCH and outage evidence |
| PROV-04 | Authenticated discovery and unsupported Groups | All 21 mounted method/path checks, descriptors, 404/501 tests | Real ResourceTypes connection test; separate schema/config probes |
| PROV-08 | Genuine capture provenance and deterministic replay | Real-HTTP fixture replay only after capture | `03-CONNECTOR-CAPTURE-EVIDENCE.md` |
| LIFE-01 | Same valid human tokens refused immediately | SCIM PUT/PATCH refusal with fake Keycloak outage | `03-REFUSAL-EVIDENCE.md`, browser 1440 and 375 |
| LIFE-03 | Idempotent tombstone preserves references | DELETE, hidden reads, reserved tuple and retained relationships | Connector delete and refusal evidence |

Cross-cutting checks cover bounded throttling (1200/IP and 600/source per 60 seconds), one safe request event, independent activity timestamps, exact operation grants, no source/human confusion, compatibility and unchanged schemas/off defaults. Plans supply phase-unique threat IDs and exact test paths; synchronize this table to the final plan/task map before acceptance.

## Wave 0 Requirements

The existing harness is available. Implementation tasks must create their named token, wire, filter, PATCH, limiter, HTTP and gate-helper tests before invoking compiled files. No fabricated connector fixtures or placeholder lifecycle captures may be created. The replay task depends on the completed orchestrator capture checkpoint, and only then creates sanitized fixture files and provenance. Test status is pending until execution.

## Orchestrator-Run Checkpoints

| Checkpoint | Required action | Evidence path in this phase directory |
|---|---|---|
| Connector capture | Run Docker, pinned midPoint/connector, Keycloak and isolated Strapi; trigger actual lifecycle requests; sanitize before persistence; restore gate resources | `03-CONNECTOR-CAPTURE-EVIDENCE.md` |
| Immediate refusal | Prove existing OIDC session and positive API access, deactivate through SCIM, same-token refusal, real outage/pending outbox before recovery, browser/direct-detail/write denial at 1440/375 | `03-REFUSAL-EVIDENCE.md` |
| Code review/security | Run gsd-code-review and gsd-secure-phase after execution; remediate and rerun affected checks | Review and security reports explicitly named in the final plans |
| Final gate | Full backend/client checks, eight requirements mapped to five criteria, unchanged schemas and committed flags | `03-GATE-EVIDENCE.md` |

These are executable orchestrator responsibilities, not implementation claims or approval questions. Missing infrastructure or evidence keeps the gate pending. Phase 4 correlation/retry recovery and Phase 5 password/email/full CSV journey remain deferred.

## Final Plan and Per-Task Map

Planning synchronized to18 sequential waves. All task statuses are pending/not executed. Each plan defines exact new test/helper paths before compiled use; every command has an immediate fails_when rule.

| Task | Wave / dependency | Required behavior check | Status |
|---|---|---|---|
| 03-01/1 | 1 / Phase2 baseline | iam-scim-token.unit.test.ts, iam-scim-token.integration.test.ts | green |
| 03-02/1 | 2 / 03-01 | iam-scim-token-cli.unit.test.ts | green |
| 03-03/1 | 3 / 03-02 | iam-scim-wire.unit.test.ts | green |
| 03-04/1 | 4 / 03-03 | iam-scim-query.unit.test.ts, iam-scim-query.integration.test.ts | green |
| 03-05/1 | 5 / 03-04 | iam-scim-patch.unit.test.ts, iam-scim-patch.integration.test.ts | green |
| 03-06/1 | 6 / 03-05 | iam-scim-auth.unit.test.ts, iam-scim-auth.integration.test.ts | green |
| 03-07/1 | 7 / 03-06 | iam-scim-limiter.unit.test.ts | green |
| 03-07/2 | 7 / 03-06 | iam-scim-boundary.unit.test.ts | green |
| 03-08/1 | 8 / 03-07 | iam-scim-discovery.unit.test.ts | green |
| 03-09/1 | 9 / 03-08 | iam-scim-routes.integration.test.ts | green |
| 03-10/1 | 10 / 03-09 | iam-scim-lifecycle.integration.test.ts | green |
| 03-10/2 | 10 / 03-09 | iam-scim-security.integration.test.ts | green |
| 03-11/1 | 11 / 03-10 | contract-catalogue.integration.test.ts | green |
| 03-11/2 | 11 / 03-10 | served-operations.integration.test.ts | green |
| 03-12/1 | 12 / 03-11 | iam-scim-capture-tooling.unit.test.ts | green |
| 03-13/1 | 13 / 03-12 | ORCHESTRATOR checkpoint: 03-CONNECTOR-CAPTURE-EVIDENCE.md | green |
| 03-14/1 | 14 / 03-13 | iam-scim-replay.integration.test.ts | green |
| 03-15/1 | 15 / 03-14 | iam-scim-refusal.integration.test.ts, iam-scim-refusal-tooling.unit.test.ts | green |
| 03-15/2 | 15 / 03-14 | pnpm --dir apps/csrm test -- src/lib/auth/oidc-session-adapter.test.ts src/lib/api/transport/server-client-oidc.test.ts src/components/shell/protected-layout.test.tsx; pnpm --dir apps/csrm typecheck | green |
| 03-16/1 | 16 / 03-15 | ORCHESTRATOR checkpoint: 03-REFUSAL-EVIDENCE.md | green |
| 03-16/2 | 16 / 03-15 | ORCHESTRATOR checkpoint: 03-BROWSER-REFUSAL-EVIDENCE.md | green |
| 03-17/1 | 17 / 03-16 | ORCHESTRATOR checkpoint: 03-REVIEW.md | green |
| 03-17/2 | 17 / 03-16 | ORCHESTRATOR checkpoint: 03-SECURITY.md | green |
| 03-18/1 | 18 / 03-17 | ORCHESTRATOR checkpoint: 03-GATE-EVIDENCE.md | green |

## Evidence Ordering and Final Gates

- 03-12 builds capture scripts/tests only. 03-13 is an autonomous:false orchestrator checkpoint; it records actual pinned connector request sequence and03-CONNECTOR-CAPTURE-EVIDENCE.md before03-14 creates any fixture/replay.
- 03-15 builds refusal helpers/API/unit/browser assertions only. 03-16 is an autonomous:false orchestrator checkpoint; actual same-session/API refusal, real Keycloak outage with pending outbox before recovery, direct detail/write and1440/375 proof produce03-REFUSAL-EVIDENCE.md and03-BROWSER-REFUSAL-EVIDENCE.md.
- 03-17 runs post-execution gsd-code-review and gsd-secure-phase, producing exact03-REVIEW.md and03-SECURITY.md, with remediation/affected checks and required live reruns. ASVS L1; high/critical open findings block.
- 03-18 writes03-GATE-EVIDENCE.md only after actual final root backend/client checks and evidence validators pass. Eight requirement→five criterion mapping is inCOVERAGE.md; no criterion may be waived from synthetic or stale evidence.
- Shared schema/generated content-type/index/JDL baseline remains unchanged; three committed activation flags stay false; both catalogue copies stay byte-identical and preserve all21 original grant ids and URLs. No new dependency is planned.
- New live evidence files/screenshots are future execution outputs; screenshots remain local evidence, never binary additions in planning commits.


## Validation Sign-Off

- [ ] Every task has behavior verification or an explicit orchestrator checkpoint dependency.
- [ ] No three consecutive implementation tasks lack automated sampling.
- [ ] Named test files are created before execution; capture precedes replay.
- [ ] No watch flags, skipped required cases or historical baseline waivers.
- [ ] Code review and security audit findings have final dispositions.
- [ ] Full backend and applicable client checks are green.
- [ ] Actual measured evidence supports validation completion.

Planning status only: draft; implementation and live acceptance have not run.

## Execution result (2026-10-16)

Every task row above is green on the final source. The orchestrator checkpoints are recorded in 03-CONNECTOR-CAPTURE-EVIDENCE.md, 03-REFUSAL-EVIDENCE.md, 03-BROWSER-REFUSAL-EVIDENCE.md, 03-REVIEW.md, 03-SECURITY.md and 03-GATE-EVIDENCE.md. Final suites: backend 2012/2012 (only the two WINDOWS.md entry 11 files excluded), CSRM 5412/5412, `api:check` and typecheck pass.
