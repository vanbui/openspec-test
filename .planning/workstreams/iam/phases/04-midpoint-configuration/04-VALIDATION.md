---
phase: "04"
slug: "midpoint-configuration"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-16"
---

# Phase 4 validation strategy

This is a precise plan/task map, not executed acceptance. All outcomes remain Planned; only actual checks and complete live evidence may change them. No success evidence file is created by planning.

## Check infrastructure and inputs

Use installed Node/node:test, host javac/JDK standard JAXP, existing bundled Commons CSV 1.10.0, Bash/PowerShell and local XSD/catalog inputs. No package install or committed binary. Host inspection established java/javac 21 with --release11 support and existing image build stage gradle:7.2-jdk11. Container java/JAXP and exact CSV jar/classpath/digest must be observed by10before helper/parser use; image Node/Python availability is never assumed.

`MIDPOINT_SCHEMA_ROOT` is operator-provided extracted midPoint 4.8.14 schema/xml/ns/public; `MIDPOINT_SCHEMA_CATALOG` is its complete local import resolver; `CSV_ROOT` is matching extracted CSV 2.8 root with lib/commons-csv-1.10.0.jar. Missing artifacts/imports fail closed. Full XSD checks resolve all namespaces locally and disable network/entities. Manifest-only checks and text assertions cannot establish full XSD or dynamic connector acceptance. New XML vocabulary requires exact namespace/parent/type/order citation in schema-vocabulary.md before use.

## Sampling and sequential waves

Run each named behavior check after its task, then aggregate all existing standalone tests after each offline wave. Target quick behavior checks under30seconds; measure during implementation. No three consecutive implementation tasks run without checks. Plans 01–09 form offline preparation, then each early probe10–13has its own live plan and evidence; any blocked/missing support stops downstream writes. All later live runners are implemented/tested in preceding offline plans. Multi-hour retry/cap and actual UTC schedule observations use real clocks, never accelerated unit fixtures.

All commands assume repository root. Existing/backend commands are reused verbatim, including test compilation before focused compiled replay tests. The offline replay in plan 29 may use the existing isolated test-created in-process Strapi instance, disposable test database and loopback listener; it may not depend on an external developer/production Strapi, Docker, midPoint or Keycloak runtime. Full backend suite remains unfiltered. Actual baseline in01does not authorize excluding historical WINDOWS entry 11 files in32. A failed unfiltered run remains failed even if an exactly named diagnostic subset passes.

## Exact task verification map

| Task | Wave | Requirements | Mode | Automated check | Result artifact | Threat ref | Status |
|---|---|---|---|---|---|---|---|
| 04-01.1 | 1 | ENG-01, ENG-02 | Offline | `pnpm --dir apps/backend test` | Named test summary / 04-BASELINE.md | T-04-01, T-04-01-SC | Planned |
| 04-01.2 | 1 | ENG-01, ENG-02 | Offline | `node --test docker/midpoint/tests/hr-fixtures.test.mjs` | Named test summary / owned source assertion | T-04-01, T-04-01-SC | Planned |
| 04-02.1 | 2 | ENG-01, ENG-02 | Offline | `node --test docker/midpoint/tests/hr-snapshot.test.mjs` | Named test summary / owned source assertion | T-04-02, T-04-02-SC | Planned |
| 04-02.2 | 2 | ENG-01, ENG-02 | Offline | `node --test docker/midpoint/tests/accepted-snapshot.test.mjs` | Named test summary / owned source assertion | T-04-02, T-04-02-SC | Planned |
| 04-03.1 | 3 | ENG-01, ENG-03, PROV-06 | Offline | `node --test docker/midpoint/tests/config-manifest.test.mjs` | Named test summary / owned source assertion | T-04-03, T-04-03-SC | Planned |
| 04-03.2 | 3 | ENG-01, ENG-03, PROV-06 | Offline | `node --test docker/midpoint/tests/config-validation.test.mjs` | Named test summary / owned source assertion | T-04-03, T-04-03-SC | Planned |
| 04-04.1 | 4 | ENG-01, ENG-03 | Offline | `node --test docker/midpoint/tests/config-render.test.mjs` | Named test summary / owned source assertion | T-04-04, T-04-04-SC | Planned |
| 04-04.2 | 4 | ENG-01, ENG-03 | Offline | `node --test docker/midpoint/tests/seed-spool.test.mjs` | Named test summary / owned source assertion | T-04-04, T-04-04-SC | Planned |
| 04-05.1 | 5 | ENG-01, ENG-03 | Offline | `node --test docker/midpoint/tests/seed-contract.test.mjs` | Named test summary / owned source assertion | T-04-05, T-04-05-SC | Planned |
| 04-05.2 | 5 | ENG-01, ENG-03 | Offline | `node --test docker/midpoint/tests/reload-contract.test.mjs` | Named test summary / owned source assertion | T-04-05, T-04-05-SC | Planned |
| 04-06.1 | 6 | ENG-01, ENG-02, ENG-03, ENG-04, PROV-06 | Offline | `node --test docker/midpoint/tests/phase4-evidence.test.mjs` | Named test summary / owned source assertion | T-04-06, T-04-06-SC | Planned |
| 04-06.2 | 6 | ENG-01, ENG-02, ENG-03, ENG-04, PROV-06 | Offline | `node --test docker/midpoint/tests/phase4-population.test.mjs` | Named test summary / owned source assertion | T-04-06, T-04-06-SC | Planned |
| 04-07.1 | 7 | ENG-03, ENG-04, LIFE-04 | Offline | `node --test docker/midpoint/tests/phase4-retry.test.mjs` | Named test summary / owned source assertion | T-04-07, T-04-07-SC | Planned |
| 04-07.2 | 7 | ENG-03, ENG-04, LIFE-04 | Offline | `node --test docker/midpoint/tests/phase4-runtime.test.mjs` | Named test summary / owned source assertion | T-04-07, T-04-07-SC | Planned |
| 04-08.1 | 8 | ENG-01, ENG-02, PROV-06 | Offline | `node --test docker/midpoint/tests/probe-csv.test.mjs` | Named test summary / owned source assertion | T-04-08, T-04-08-SC | Planned |
| 04-08.2 | 8 | ENG-01, ENG-02, PROV-06 | Offline | `node --test docker/midpoint/tests/probe-connector.test.mjs` | Named test summary / owned source assertion | T-04-08, T-04-08-SC | Planned |
| 04-09.1 | 9 | PROV-06, LIFE-04, ENG-03, ENG-04 | Offline | `node --test docker/midpoint/tests/probe-correlation.test.mjs` | Named test summary / owned source assertion | T-04-09, T-04-09-SC | Planned |
| 04-09.2 | 9 | PROV-06, LIFE-04, ENG-03, ENG-04 | Offline | `node --test docker/midpoint/tests/probe-retry.test.mjs` | Named test summary / owned source assertion | T-04-09, T-04-09-SC | Planned |
| 04-10.1 | 10 | ENG-01, ENG-02 | Live | `node docker/midpoint/e2e/probe-csv.mjs --run --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CSV-PROBE.md ; node docker/midpoint/e2e/probe-csv.mjs --verify-evidence --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CSV-PROBE.md` | `.planning/workstreams/iam/phases/04-midpoint-configuration/04-CSV-PROBE.md` | T-04-10, T-04-10-SC | Planned |
| 04-11.1 | 11 | ENG-01, ENG-02, PROV-06 | Live | `node docker/midpoint/e2e/probe-connector.mjs --run --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CONNECTOR-PROBE.md ; node docker/midpoint/e2e/probe-connector.mjs --verify-evidence --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CONNECTOR-PROBE.md` | `.planning/workstreams/iam/phases/04-midpoint-configuration/04-CONNECTOR-PROBE.md` | T-04-11, T-04-11-SC | Planned |
| 04-12.1 | 12 | PROV-06, ENG-04 | Live | `node docker/midpoint/e2e/probe-correlation.mjs --run --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CORRELATION-PROBE.md ; node docker/midpoint/e2e/probe-correlation.mjs --verify-evidence --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CORRELATION-PROBE.md` | `.planning/workstreams/iam/phases/04-midpoint-configuration/04-CORRELATION-PROBE.md` | T-04-12, T-04-12-SC | Planned |
| 04-13.1 | 13 | ENG-03, ENG-04, LIFE-04 | Live | `node docker/midpoint/e2e/probe-retry.mjs --run --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-RETRY-PROBE.md ; node docker/midpoint/e2e/probe-retry.mjs --verify-evidence --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-RETRY-PROBE.md` | `.planning/workstreams/iam/phases/04-midpoint-configuration/04-RETRY-PROBE.md` | T-04-13, T-04-13-SC | Planned |
| 04-14.1 | 14 | ENG-01, ENG-02 | Offline | `node --test docker/midpoint/tests/resource-contract.test.mjs` | Named test summary / owned source assertion | T-04-14, T-04-14-SC | Planned |
| 04-14.2 | 14 | ENG-01, ENG-02 | Offline | `node --test docker/midpoint/tests/runtime-package.test.mjs` | Named test summary / owned source assertion | T-04-14, T-04-14-SC | Planned |
| 04-15.1 | 15 | ENG-01, ENG-02, PROV-06 | Offline | `node --test docker/midpoint/tests/template-correlation.test.mjs` | Named test summary / owned source assertion | T-04-15, T-04-15-SC | Planned |
| 04-15.2 | 15 | ENG-01, ENG-02, PROV-06 | Offline | `node --test docker/midpoint/tests/disable-contract.test.mjs` | Named test summary / owned source assertion | T-04-15, T-04-15-SC | Planned |
| 04-16.1 | 16 | ENG-02, ENG-03, LIFE-04 | Offline | `node --test docker/midpoint/tests/hr-task-contract.test.mjs` | Named test summary / owned source assertion | T-04-16, T-04-16-SC | Planned |
| 04-16.2 | 16 | ENG-02, ENG-03, LIFE-04 | Offline | `node --test docker/midpoint/tests/managed-task-contract.test.mjs` | Named test summary / owned source assertion | T-04-16, T-04-16-SC | Planned |
| 04-17.1 | 17 | ENG-01, ENG-02, ENG-04 | Offline | `node --test docker/midpoint/tests/configuration-gate.test.mjs` | Named test summary / owned source assertion | T-04-17, T-04-17-SC | Planned |
| 04-17.2 | 17 | ENG-01, ENG-02, ENG-04 | Offline | `node --test docker/midpoint/tests/lifecycle-gate.test.mjs` | Named test summary / owned source assertion | T-04-17, T-04-17-SC | Planned |
| 04-18.1 | 18 | ENG-01, ENG-03 | Live | `node docker/midpoint/e2e/configuration-gate.mjs --run --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CONFIGURATION-EVIDENCE.md ; node docker/midpoint/e2e/configuration-gate.mjs --verify-evidence --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CONFIGURATION-EVIDENCE.md` | `.planning/workstreams/iam/phases/04-midpoint-configuration/04-CONFIGURATION-EVIDENCE.md` | T-04-18, T-04-18-SC | Planned |
| 04-19.1 | 19 | ENG-01, ENG-02, ENG-04 | Live | `node docker/midpoint/e2e/lifecycle-gate.mjs --run --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-LIFECYCLE-EVIDENCE.md ; node docker/midpoint/e2e/lifecycle-gate.mjs --verify-evidence --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-LIFECYCLE-EVIDENCE.md` | `.planning/workstreams/iam/phases/04-midpoint-configuration/04-LIFECYCLE-EVIDENCE.md` | T-04-19, T-04-19-SC | Planned |
| 04-20.1 | 20 | ENG-03, ENG-04, PROV-06 | Offline | `node --test docker/midpoint/tests/authority-gate.test.mjs` | Named test summary / owned source assertion | T-04-20, T-04-20-SC | Planned |
| 04-20.2 | 20 | ENG-03, ENG-04, PROV-06 | Offline | `node --test docker/midpoint/tests/completeness-gate.test.mjs` | Named test summary / owned source assertion | T-04-20, T-04-20-SC | Planned |
| 04-21.1 | 21 | PROV-06, ENG-04 | Live | `node docker/midpoint/e2e/authority-gate.mjs --run --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CORRELATION-EVIDENCE.md ; node docker/midpoint/e2e/authority-gate.mjs --verify-evidence --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CORRELATION-EVIDENCE.md` | `.planning/workstreams/iam/phases/04-midpoint-configuration/04-CORRELATION-EVIDENCE.md` | T-04-21, T-04-21-SC | Planned |
| 04-22.1 | 22 | ENG-01, ENG-03, ENG-04, PROV-06 | Live | `node docker/midpoint/e2e/completeness-gate.mjs --run --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-COMPLETENESS-EVIDENCE.md ; node docker/midpoint/e2e/completeness-gate.mjs --verify-evidence --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-COMPLETENESS-EVIDENCE.md` | `.planning/workstreams/iam/phases/04-midpoint-configuration/04-COMPLETENESS-EVIDENCE.md` | T-04-22, T-04-22-SC | Planned |
| 04-23.1 | 23 | ENG-03, ENG-04, LIFE-04 | Offline | `node --test docker/midpoint/tests/recovery-gate.test.mjs` | Named test summary / owned source assertion | T-04-23, T-04-23-SC | Planned |
| 04-23.2 | 23 | ENG-03, ENG-04, LIFE-04 | Offline | `node --test docker/midpoint/tests/conflict-gate.test.mjs` | Named test summary / owned source assertion | T-04-23, T-04-23-SC | Planned |
| 04-24.1 | 24 | ENG-03, ENG-04, LIFE-04 | Live | `node docker/midpoint/e2e/recovery-gate.mjs --run --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-RECOVERY-EVIDENCE.md ; node docker/midpoint/e2e/recovery-gate.mjs --verify-evidence --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-RECOVERY-EVIDENCE.md` | `.planning/workstreams/iam/phases/04-midpoint-configuration/04-RECOVERY-EVIDENCE.md` | T-04-24, T-04-24-SC | Planned |
| 04-25.1 | 25 | ENG-03, ENG-04, LIFE-04 | Live | `node docker/midpoint/e2e/conflict-gate.mjs --run --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CONFLICT-EVIDENCE.md ; node docker/midpoint/e2e/conflict-gate.mjs --verify-evidence --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CONFLICT-EVIDENCE.md` | `.planning/workstreams/iam/phases/04-midpoint-configuration/04-CONFLICT-EVIDENCE.md` | T-04-25, T-04-25-SC | Planned |
| 04-26.1 | 26 | ENG-01, ENG-02, ENG-04 | Offline | `node --test docker/midpoint/tests/throughput-gate.test.mjs` | Named test summary / owned source assertion | T-04-26, T-04-26-SC | Planned |
| 04-26.2 | 26 | ENG-01, ENG-02, ENG-04 | Offline | `node --test docker/midpoint/tests/phase4-capture.test.mjs` | Named test summary / owned source assertion | T-04-26, T-04-26-SC | Planned |
| 04-27.1 | 27 | ENG-01, ENG-02, ENG-04 | Live | `node docker/midpoint/e2e/throughput-gate.mjs --run --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-THROUGHPUT-EVIDENCE.md ; node docker/midpoint/e2e/throughput-gate.mjs --verify-evidence --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-THROUGHPUT-EVIDENCE.md` | `.planning/workstreams/iam/phases/04-midpoint-configuration/04-THROUGHPUT-EVIDENCE.md` | T-04-27, T-04-27-SC | Planned |
| 04-28.1 | 28 | ENG-01, ENG-02, ENG-03, ENG-04, PROV-06, LIFE-04 | Live | `node docker/midpoint/e2e/phase4-capture-scim.mjs --run --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CAPTURE-EVIDENCE.md ; node docker/midpoint/e2e/phase4-capture-scim.mjs --verify-evidence --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CAPTURE-EVIDENCE.md` | `.planning/workstreams/iam/phases/04-midpoint-configuration/04-CAPTURE-EVIDENCE.md` | T-04-28, T-04-28-SC | Planned |
| 04-29.1 | 29 | ENG-01, ENG-02, ENG-03, ENG-04, PROV-06, LIFE-04 | Offline | `node docker/midpoint/e2e/phase4-capture-scim.mjs --verify-evidence --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-CAPTURE-EVIDENCE.md` | Named test summary / owned source assertion | T-04-29, T-04-29-SC | Planned |
| 04-29.2 | 29 | ENG-01, ENG-02, ENG-03, ENG-04, PROV-06, LIFE-04 | Offline | `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false ; pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-scim-replay.integration.test.js .tmp/tests-dist/tests/iam-scim-phase4-replay.integration.test.js` | Named test summary / owned source assertion | T-04-29, T-04-29-SC | Planned |
| 04-30.1 | 30 | ENG-01, ENG-02, ENG-03, ENG-04, PROV-06, LIFE-04 | Offline | `node docker/midpoint/e2e/capture-scim.mjs --check` | Named test summary / owned source assertion | T-04-30, T-04-30-SC | Planned |
| 04-30.2 | 30 | ENG-01, ENG-02, ENG-03, ENG-04, PROV-06, LIFE-04 | Offline | `node --test docker/midpoint/tests/final-gate.test.mjs` | Named test summary / owned source assertion | T-04-30, T-04-30-SC | Planned |
| 04-31.1 | 31 | ENG-01, ENG-02, ENG-03, ENG-04, PROV-06, LIFE-04 | Review | `node docker/midpoint/e2e/final-gate.mjs --review-record --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-REVIEW.md` | `.planning/workstreams/iam/phases/04-midpoint-configuration/04-REVIEW.md` | T-04-31, T-04-31-SC | Planned |
| 04-32.1 | 32 | ENG-01, ENG-02, ENG-03, ENG-04, PROV-06, LIFE-04 | Live | `pnpm --dir apps/backend test ; pnpm --dir apps/csrm api:check ; pnpm --dir apps/csrm typecheck ; pnpm --dir apps/csrm test ; node --test docker/midpoint/tests/*.test.mjs ; node docker/midpoint/validate-config.mjs --check ; node docker/midpoint/e2e/final-gate.mjs --verify-evidence --require-supported --evidence .planning/workstreams/iam/phases/04-midpoint-configuration/04-GATE-EVIDENCE.md` | `.planning/workstreams/iam/phases/04-midpoint-configuration/04-GATE-EVIDENCE.md` | T-04-32, T-04-32-SC | Planned |

Each of the 32 plans has a unique material threat T-04-NN and unique supply threat T-04-NN-SC; review 31 requires all 64 rows with no shared or duplicate identifier. Every plan command has an immediately following fails_when sibling. Nonzero, timeout, missing required summary/assertion or missing/blocked live proof is observable failure. Script checks assess behavior and record structure; they cannot establish that a live operation happened. Read live state/request/native audit independently.

## Wave0 completion obligations

- 01–02: synthetic exact-column fixtures and whole-snapshot/key/UTC behavior tests exist; rejected final rows preserve accepted population/bytes and keyed activation errors disable visibly. Valid exact-header zero-record input accepts population 0 through the same scheduled path and yields every formerly managed departure; invalid empty/missing/unreadable/broken sources preserve state.
- 03: one OID manifest and namespace-aware full local XSD validator; wrong-parent/type/order/import mutants reject; no workforce User object input.
- 04–05: same seed/Bash/PowerShell renderer contract, no mutation before full validation, stdin/private cleanup, stale-token refusal, preserved runtime state and suspended failures.
- 06: complete candidate/population/audit graph validators reject premature writes, incomplete lookup, missing/duplicate125population ids, orphan causal edges and secret fields.
- 07: eligibility ledger validates observed headers/actual failure times, increasing60-to3600cadence, ten-failure attention and continuing capped attempts; isolation/restoration negatives exist.
- 08–09: every early probe has an offline check/test before its live plan; unsupported native snapshot/case/retry mechanisms report BLOCKED, never fabricated working XML.

## Required live proof and stop boundaries

| Gate | Supported outcome required | Blocks on missing/BLOCKED |
|---|---|---|
| 10 CSV/runtime | Actual Java/JAXP/CSV classpath, dynamic schema, accepted immutable snapshot scheduling, valid-header zero-person acceptance with all managed disables/retained links and unchanged controls, invalid empty/missing/unreadable/broken-source refusal, and unchanged-byte UTC transition | ENG-01/02 and dependent configuration |
| 11 connector | Every D19 write/assertion/optional clear plus real complete employee/email equality translation | D19 mappings, create/claim and dependent configuration |
| 12 native case | Real remote-shadow/native focus/case graph, operator/time, zero prewrite, exact selected keyed PUT, one final Identity | PROV-06 and provisioning |
| 13 retry | Actual durable pending/classification/headers, increasing real-time60..3600 cadence, ten-failure attention and continuing capped attempts,401403suspension | LIFE-04/affected ENG-03 and automatic retries |
| 18 configuration | Fresh/reused seed, actual Bash/PowerShell reload, rotation/revocation/encrypted token, cleanup/state retention and fail-closed suspension | Resource/task activation |
| 19 tracer | Real CSV joiner/mover/terminated leaver, every D19 result/clear/role invariant, valid zero-person complete disappearance versus invalid-source unchanged state, <=300 second healthy timing and unchanged-byte dates, native causal audit | ENG-01/02/04 |
| 21 authority | Full actual candidate/claim/reject/race/protected/foreign matrix and subsequent source-key linkage | PROV-06 |
| 22 completeness |125 owned independently counted plus controls, beyond 100 email candidate/drift/leaver/lost link/absentHR, actual UTC tasks and exclusion | ENG-03/PROV-06 |
| 24 recovery | Genuine CSV joiner/mover/reactivation during stopped Keycloak, automatic native recovery, independent leaver outbox/session completion | LIFE-04/ENG-03 |
| 25 conflict | Repeated remote503/30rollback, local409separate, attention/capped continuation/no adoption | LIFE-04/ENG-03 |
| 27 throughput | Fresh full-reference cold measurement before warm, accurate count/flags/database/cadence; separate125run | Throughput record |
| 28 capture | Genuine full Phase 4 sequence/origin/causal graph, byte-exact immutable output and retained Phase 3 history | Replay 29/final 32 |
| 31 review | No blocking finding; concrete evidence for every T-04-NN and T-04-NN-SC for NN 01 through 32 | Final 32 |
| 32 final | All six requirements/five criteria, genuine capture/replay, unfiltered full suites and unchanged contract/grants/schemas/defaults | Overall acceptance |

## Edge and assumption coverage

ENG-01 unresolved adjacency/empty/ordering is resolved by exact ordered headers, whole snapshot before mutation, automatic acceptance of a valid UTF-8 exact ordered full header with zero data records as a complete zero-person workforce, with all formerly managed projections disabled and Identity/link/history retained; empty bytes, missing/unreadable files and malformed headers reject without mutation or an added confirmation input. ENG-04 adjacency/empty/ordering/concurrency is resolved by a complete nonempty cause/decision/request/state graph with prewrite decision and independent concurrent-target attribution. LIFE-04 idempotency/concurrency is resolved by durable operation/target retention, shared one-writer exclusion and no duplicate/adoption across automatic recovery.

ENG-02,ENG-03,PROV-06 remain flagged runtime assumptions until respectively actual 300 second timing, complete native known-population/retry/schedule proof, and remote-shadow/native case proof pass. No unclassified concern is silently discarded. Complete managed repair does not assert arbitrary remote orphan discovery. No descriptor-less safety predicate is fabricated from these planning statements; every named check must exist in its owned task and be exercised.

## Sign-off after actual checks

- [ ] Every required offline behavior/negative check passes and relevant latency is measured.
- [ ] All early probes produce supported actual configuration or correctly block dependents.
- [ ] Every live gate has complete real sanitized exchanges/state/native audit and successful cleanup.
- [ ] Genuine Phase 4 and historical replay pass without changing captured bodies.
- [ ] Current unfiltered backend/client checks pass with complete counts and no blanket exclusions.
- [ ] Every requirement/criterion/threat has concrete passing evidence and no blocking review finding.

Acceptance remains pending. Planning review cannot set nyquist_compliant or wave_0_complete true.
