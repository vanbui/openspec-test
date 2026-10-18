---
phase: 05-sign-in-and-end-to-end-journey
plan: "05"
subsystem: testing
tags: [iam, journey, evidence, isolation]
status: complete
completed: 2026-10-17
requires:
  - phase: "05-01"
    provides: Password setup dispatch boundary
provides:
  - Inert static command and ordered injectable journey runner
  - Closed evidence validation and owner-only private input contracts
  - Atomic validated publication after successful cleanup
affects: [05-06, 05-07, 05-08, 05-09, 05-10, 05-11, 05-12]
requirements: [SIGN-02]
requirements-completed: []
tech-stack:
  added: []
  patterns: [injected stages and clock, closed evidence records, private disposable handoffs]
key-files:
  created:
    - docker/midpoint/e2e/journey.mjs
    - docker/midpoint/e2e/journey-evidence.mjs
    - docker/midpoint/e2e/journey.test.mjs
  modified: []
key-decisions:
  - Live runtime and contract adapters load only for explicit live modes and fail closed when unavailable.
  - Passing journey evidence requires unfiltered regression observations alongside complete native lifecycle and cleanup proof.
  - Setup shares a five-minute budget; both viewport lifecycles have separate ten-minute budgets; conflict recovery retains its twenty-five-minute budget.
actuals:
  tokens: 11363
  tasks: 2
  commits: 0
duration: 22min
---

# Phase 5 Plan 05: Ordered journey and evidence protocol Summary

An inert command validates static configuration; an injectable runner enforces the complete two-width lifecycle, bounded deadlines, first-failure preservation and independent cleanup. Closed evidence records reject partial runs and secret-bearing fields before publication.

## Tasks delivered

1. Added explicit `--check`, `--list`, `--run`, `--probe-keycloak` and `--verify-evidence [--contract]` dispatch. Imports, static checks and stage listing do not load live adapters, create private directories, compile applications, start listeners, read credentials or publish evidence. Ordered stages include source setup, each viewport's joiner/mail/password/sign-in/mover/leaver/refusal/remote completion, IN-03 and evidence. Abort signals and independent cleanup deadlines bound execution; errors expose only closed codes and the first failed stage. Adapters must stop their owned work on abort.
2. Added strict journey/contract validators, private path validation and atomic publication. Evidence requires pinned versions, reset/ownership assertions, ordered outcomes/timings, fresh task completion within its owning stage, distinct native audit/SCIM correlations, unchanged native paging/cadence, per-width identity linkage, pre-expiry refusal, remote disable/session termination, native conflict retry/correction/recovery, complete cleanup and unfiltered regressions. Only exact CSRM screenshot paths and matching viewport image headers are accepted. Screenshot content remains the browser adapter's responsibility.

Private inputs require explicit disposable consent, owner-only directories/files under the ignored backend runtime root, no symlinks, a nonexistent contained database, matching run-specific evidence directory, local origins, matching issuer, explicit private configuration/compose handoffs and required compose keys. Existing databases, foreign projects and legacy admin aliases are refused. The evidence parent must exist before a live invocation; static checks create nothing.

## Verification

- `node --test docker/midpoint/e2e/journey.test.mjs`: **58 passed, 0 failed, 0 skipped**, 165.419032 ms.
- `node docker/midpoint/e2e/journey.mjs --check`: **passed**, exit 0, after the focused suite.
- `git diff --check`: passed.
- Test-only publication/private directories were removed. Synthetic observations and image headers exercise the validator and filesystem boundary; they establish no live acceptance.

## Deviations from Plan

- No commits or staging were attempted, as explicitly required. All deliverables remain in the working tree; shared state/roadmap completion was left to the enclosing wave.
- The live runtime and contract adapters belong to subsequent plans. Their lazy imports deliberately fail closed rather than substituting fixture results; this plan does not implement later-wave Docker, browser, mail or conflict adapters.
- Task 1 began with two intentional assertion failures (missing order rejection and lost first-failure handling), then passed. The initial evidence validator and its main tests were introduced together; later strict-boolean and invalid-calendar tests each failed intentionally before correction. Separate RED/GREEN commits and persisted RED gate records were not produced in this uncommitted execution.
- Review corrected the IN-03 protocol to require mover `PUT`/503 and recovery `PUT`/200, rejecting substitute `POST` creates. Refusal observations must fall within the matching viewport's immediate-refusal stage and precede token expiry. Four added regressions cover both incorrect methods and observations before/after the required stage; the two timing regressions failed intentionally before the validator correction.

## Remaining acceptance

SIGN-02 and Phase 5 remain incomplete. Later plans must implement live adapters and prove disposable reset, actual versions, native tasks, mail/password setup, both browser widths, immediate leaver refusal and IN-03 recovery. The inherited unfiltered backend compilation failure remains a separate acceptance blocker; focused runner checks cannot satisfy it. No Docker, network, live service, browser or real identity operation ran here. No defaults, schemas, endpoints, grants, catalogues or API contracts changed in this plan.

## Self-Check: PASSED

All three implementation/test files and this summary exist. Focused checks passed, temporary test directories were removed, no dependency was added and no live evidence was retained.
