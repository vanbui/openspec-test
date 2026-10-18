# Phase 3 — Plan Check

## VERIFICATION PASSED

- Workstream: `iam`.
- Phase: Strapi SCIM 2.0 service.
- Checked: 2026-10-15.
- Plans: 18, in sequential waves 1–18.
- Final findings: 0 blockers, 0 warnings, 0 advisories.
- Scope: planning only. No implementation, application tests, live stack, connector capture, browser proof or post-execution audit was executed by this check.

## Goal-backward result

The plans address the complete roadmap goal: an Identity Source uses its own bearer token to create, read, search, replace, patch and deactivate only permitted IdamBox Users through the root Strapi SCIM service, and genuine connector requests replay through real Strapi HTTP in ordinary backend tests. The workstream project requirements for source isolation, outage-safe immediate refusal, preserved roles and retained references are included. Other milestone requirements remain assigned to their later phases.

| Requirement | Principal implementing / proof plans | Roadmap criterion | Result |
|---|---|---|---|
| MODEL-02 | 03-01, 03-02, 03-06, 03-10, 03-13 | 1 | Covered |
| PROV-01 | 03-03, 03-09, 03-10, 03-13, 03-14 | 3 | Covered |
| PROV-02 | 03-04, 03-09, 03-10, 03-13, 03-14 | 3 | Covered |
| PROV-03 | 03-03, 03-05, 03-09, 03-10, 03-13–03-16 | 3 | Covered |
| PROV-04 | 03-08–03-11, 03-13, 03-14 | 2 | Covered |
| PROV-08 | 03-11–03-14 | 5 | Covered |
| LIFE-01 | 03-15, 03-16 | 4 | Covered |
| LIFE-03 | 03-09, 03-10, 03-13–03-16 | 4 | Covered |

All eight requirement identifiers appear in plan frontmatter and have concrete actions and verification. Plan 03-18 consolidates all five criteria and all eight requirements after remediation.

## Revision gate

The initial check reported one blocker in 03-11 Task 2: an ordinary served-operation drift check preceded the runtime inventory writer, so the check would fail against the intentionally stale tracked inventory before the task could regenerate it.

The revised task now compiles, runs `SERVED_OPERATIONS_WRITE=1 pnpm --filter @csrm/strapi served-operations:write`, then runs the ordinary compiled served-operations integration test. The action also explicitly requires the generated client output to be included in the implementation commit before `api:check`, matching that script's tracked-output diff guard. The runtime writer and client scripts were inspected. This ordering satisfies the failed invariant; the original blocker is closed. No regression was found in the final goal, scope, evidence or dependency checks.

## Locked decision coverage

Each locked decision was checked against actions and acceptance criteria, rather than credited solely from an identifier mention. The following is the substantive coverage map; `COVERAGE.md` carries individual decision rows.

All P3-01..P3-32 decisions are covered by executable actions and acceptance criteria; the individual map is in [COVERAGE.md](COVERAGE.md). Particular checks included private source authority, exact grants, fixed wire mapping, full PUT replacement, atomic in-lock PATCH, scope before counts, safe media/errors, token lifecycle/export, bounded filters/projections, truthful discovery, retained tombstones, independent timestamps, one safe event, actual root inventory and additive contract compatibility. P3-32's effective defaults are 1200/IP and 600/source per 60 seconds. The obsolete defaults are not implemented.

No deferred source screens, schema changes, Group governance, multi-address persistence, restoration, persistent HR mappings, correlation confirmation, scheduling, pending-operation completion or password/full CSV journey is introduced.

## Structure, scope and dependencies

The structure validator was rerun against all final plans: 18 valid results, no errors or warnings. All 24 tasks have explicit files, actions, verification and done criteria; automatic tasks include named behavior tests and checkpoints identify orchestrator ownership. Every plan has truths, artifacts and key links. Concrete task actions supply the actual route/policy/service, contract/inventory, capture/replay and session/capability/layout wiring.

Every plan after 03-01 depends on its immediate predecessor. There are no cycles, missing references or same-wave plan pairs; shared file mutations are ordered. Capture-to-replay and review-to-final-check dependencies cannot be bypassed. The sequential style is explicitly chosen to match Phase 2.

| Plan | Tasks | Files | Wave | Estimated tokens / budget | Confidence | Result |
|---|---|---|---|---|---|---|
| 03-01 | 1 | 4 | 1 | 24,000 / 100,000 | low | Valid |
| 03-02 | 1 | 5 | 2 | 24,000 / 100,000 | low | Valid |
| 03-03 | 1 | 4 | 3 | 24,000 / 100,000 | low | Valid |
| 03-04 | 1 | 5 | 4 | 24,000 / 100,000 | low | Valid |
| 03-05 | 1 | 4 | 5 | 24,000 / 100,000 | low | Valid |
| 03-06 | 1 | 5 | 6 | 24,000 / 100,000 | low | Valid |
| 03-07 | 2 | 7 | 7 | 30,000 / 100,000 | low | Valid |
| 03-08 | 1 | 2 | 8 | 24,000 / 100,000 | low | Valid |
| 03-09 | 1 | 5 | 9 | 24,000 / 100,000 | low | Valid |
| 03-10 | 2 | 3 | 10 | 30,000 / 100,000 | low | Valid |
| 03-11 | 2 | 8 | 11 | 30,000 / 100,000 | low | Valid |
| 03-12 | 1 | 4 | 12 | 24,000 / 100,000 | low | Valid |
| 03-13 | 1 | 3 | 13 | 16,000 / 100,000 | low | Valid |
| 03-14 | 1 | 4 | 14 | 24,000 / 100,000 | low | Valid |
| 03-15 | 2 | 8 | 15 | 30,000 / 100,000 | low | Valid |
| 03-16 | 2 | 6 | 16 | 16,000 / 100,000 | low | Valid |
| 03-17 | 2 | 2 | 17 | 16,000 / 100,000 | low | Valid |
| 03-18 | 1 | 3 | 18 | 16,000 / 100,000 | low | Valid |

The calibrated estimate check was run separately for every plan. No estimate exceeds the 100,000-token configured budget. Confidence is low because completed-phase actuals have not calibrated the estimates; these figures are sizing aids, not measured execution costs. Task/file counts independently remain within the requested small-plan scope.

## Verification and probe results

- Nyquist strategy exists in `03-VALIDATION.md`; all task completion states remain pending execution. Named new tests/helpers are created before compiled commands use them. All 18 implementation tasks have automated behavior checks; six orchestrator checkpoints have explicit evidence/report checks and substantive acceptance criteria. There are no watch commands, missing-test sentinels or three-task gaps in automated sampling. Longer integration/live checks have explicit bounds and are not represented as fast unit samples.
- The supplied failing-direction probe reports 54 runnable commands, 54 stated directions, zero blockers/warnings and no read error. Statements name nonzero exit, failed assertions, missing output/evidence or other observable signals.
- The supplied command-path probe reports 54 commands, zero blockers/warnings and no read error. Its status is `not_applicable`: it does not ground `pnpm --dir` command forms. This is a recognizer limitation, not proof of executable target resolution. Existing package scripts and test compilation configuration were read for command semantics; future test/helper creation remains an execution responsibility.
- The original decision recognizer does not support the locked `P3-` prefix. Exact identifier mapping covers all 32 decisions. A temporary normalized mirror changed only identifier prefixes in copies for the parser; its result is total 32, covered 32, uncovered none. The locked context was not modified. Substantive compliance was checked separately above.
- Canonical `COVERAGE.md` contains all eight requirement rows, all 32 locked decisions, research contributions and 31 explicit capability decisions, including all 21 SCIM operations and reasoned exclusions. The capability coverage preflight passed.
- Research has `Open Questions (RESOLVED)`. Remaining unknown connector payloads and live behavior are assigned to blocking execution checkpoints and cannot be resolved by manufactured fixtures.
- Architectural tier dimension: no formal Architectural Responsibility Map section exists, so its table comparison is not applicable. Independently, all source authentication, grants, input validation and persistence remain in the Strapi boundary; CSRM uses existing typed transport and protected server rendering.
- Pattern compliance: the plans load `03-PATTERNS.md`, use its existing source-principal/Document Service/locking, runtime HTTP inventory and session/refusal families, and explicitly implement the no-analog token/parser/capture portions with tests. No competing authority or storage model is introduced.
- Cross-plan contracts preserve exact source identifiers and safe projections. PATCH selection does not broaden list grammar. Sanitization removes secrets while retaining genuine wire shape/order; replay permits only declared dynamic substitutions.
- Root and CSRM project instructions are preserved: strict TypeScript, existing dependencies and components, semantic tokens, server authorization, compatible grants/contracts, no arbitrary UI API calls and no schema/model extensions. Relevant installed framework documentation must be read before a necessary production refusal repair.

## Required execution evidence

All paths below are within this phase directory. They are future execution outputs and were not created by planning.

| Blocking checkpoint | Evidence / output | Dependency enforced |
|---|---|---|
| 03-13 | `03-CONNECTOR-CAPTURE-EVIDENCE.md`, `evidence/connector-capture/capture.json`, `evidence/connector-capture/manifest.json` | Real Docker/midPoint/Keycloak/isolated Strapi, token delivery and genuine lifecycle capture before 03-14 fixture creation |
| 03-16 Task 1 | `03-REFUSAL-EVIDENCE.md` | Positive session/API baseline, real SCIM PUT/PATCH/DELETE, same-token 403 and actual Keycloak outage/pending work before recovery |
| 03-16 Task 2 | `03-BROWSER-REFUSAL-EVIDENCE.md`, `evidence/browser-refusal/{put,patch}-{1440,375}.png` | Actual existing-session browser proof, direct detail/write denial and visual inspection at both widths |
| 03-17 Task 1 | `03-REVIEW.md` | Post-execution gsd-code-review, remediation and affected test/live reruns |
| 03-17 Task 2 | `03-SECURITY.md` | Post-execution gsd-secure-phase, verified mitigations and no unresolved blocking threats |
| 03-18 | `03-GATE-EVIDENCE.md`, updated validation/coverage statuses | Final remediated implementation and actual linked evidence |

The final gate explicitly runs `pnpm --dir apps/backend test` from repository root, `pnpm --dir apps/csrm api:check`, `pnpm --dir apps/csrm typecheck`, `pnpm --dir apps/csrm test` and both live-evidence validators. It checks unchanged content-type/schema/index/JDL baselines, identical capability catalogues, existing grants/contracts and false committed `IDAMBOX_KEYCLOAK_PROVISIONING`, `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION` and `CSRM_AUTH_OIDC_ENABLED` values. Isolated runtime overrides do not change committed configuration.

## Final disposition

```yaml
status: passed
plans_verified: 18
requirements_covered: 8
locked_decisions_covered: 32
issues: []
implementation_executed: false
live_evidence_complete: false
```

Planning verification passes. Runtime acceptance remains pending every declared execution checkpoint and final gate. This check does not authorize or perform plan execution.
