---
phase: quick
plan: 260831-srn
subsystem: assessment-review
tags: [strapi, nextjs, authorization, accessibility, deterministic-drafts]
requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: Assessment review, risk editing, deterministic drafting, and release workflow
provides:
  - Human-only assessment release with persistence-checked denial coverage
  - Accessible assessment editing, status, readiness, severity, and owner selection
  - Recoverable review routes and reachable assessment inventories
  - Zero-mapping deterministic drafts with preserved advisory control suggestions

affects: [assessment-review, assessment-release, requestor-assessments, authorization]
tech-stack:
  added: []
  patterns: [operation-specific human-role guard, persistent live region, centralized status presentation, mounted failure injection]
key-files:
  created:
    - apps/web/src/components/csrm/risk-rating-badge.test.tsx
    - apps/web/app/(app)/app/review/assessments/loading.tsx
    - apps/web/app/(app)/app/review/assessments/error.tsx
  modified:
    - apps/strapi/src/policies/csrm-authorization.ts
    - apps/strapi/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts
    - apps/strapi/tests/assessment-workflow.integration.test.ts
    - apps/web/src/features/assessments/assessment-editor.tsx
    - apps/web/src/features/assessments/owner-combobox.tsx

key-decisions:
  - "Require the explicit human Security Analyst role only for release while preserving catalogue-backed agent grants for other operations."
  - "Persist deterministic control suggestions as bounded advisory treatment-plan text without adding a competing entity or schema field."
  - "Allow zero-risk draft proposals so valid zero-mapping questionnaires reach human review but remain server-unreleasable."

patterns-established:
  - "Routine asynchronous states update one pre-mounted polite region; only genuine failures are assertive."

requirements-completed: [ASSESS-01, ASSESS-02, ASSESS-03, ASSESS-04, ASSESS-05, INT-03]
duration: 48min
completed: 2026-08-31
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-27
  status: unknown
---

# Quick Task 260831-srn: Phase 4 Review Remediation Summary

**Human-only release, persistence-safe authorization regressions, resilient deterministic drafts, and accessible assessment review across all 45 review findings**

## Accomplishments

- Closed the agent-release blocker while retaining the frozen catalogue grant graph and added mounted before/after proof for denied and immutable mutations.
- Repaired deterministic draft idempotency, zero-mapping handling, advisory control persistence, and mounted failure injection against the module Strapi actually executes.
- Made status, readiness, severity, validation, owner selection, polling, and panel structure consistently accessible across assessment editing and lists.
- Added contextual review route boundaries and capability-gated navigation for analyst and Requestor assessment inventories.
- Replaced the vacuous integrity regression with six real hostile specification mutations that invoke the production guard and restore the authoritative specification bytes.

## Task Commits

1. `3367a54` — `fix(quick-260831-srn): harden assessment workflow authorization`
2. `ddf18f1` — `test(quick-260831-srn): exercise integrity guard failures`
3. `1097532` — `fix(quick-260831-srn): improve assessment review accessibility`
4. `60aafad` — `feat(quick-260831-srn): expose review inventory routes`
5. `ae7756e` — `test(quick-260831-srn): inject mounted provider failures`
6. `3112876` — `test(quick-260831-srn): align release journey status label`

Planning artifacts were intentionally left uncommitted for the orchestrator.

## Finding Dispositions

| Finding | Severity | Disposition | Implementation or justification | Regression test / evidence | Commit |
|---|---|---|---|---|---|
| F-1 | minor | Not fixable | not fixable without history rewrite — existing shared commit bodies are immutable under this task | New commit bodies were inspected with `git log`/`git cat-file` and contain real multiline bullets. | N/A |
| F-2 | major | Fixed | Six isolated hostile specification mutations now invoke the production integrity guard. | `verify-phase-04-integrity.test.ps1` rejects changed path, operationId, parameter, body, response, and schema. | `ddf18f1` |
| F-3 | minor | Fixed | Denied aggregate mutations now compare exact pre/post documents and descendant counts. | Mounted requestor 403 cases re-read Assessment, Risk, and ControlImplementation state. | `3367a54` |
| F-4 | minor | Fixed | The capped-search owner is active, matches `search=a`, and sorts beyond the first 20. | Mounted search proves absence due to the cap while inactive-user coverage remains separate. | `3367a54` |
| F-5 | major | Fixed | Severity badges use semantic risk tokens and distinct circle/diamond/triangle/octagon shapes. | `risk-rating-badge.test.tsx` covers all four presentations. | `1097532` |
| F-6 | major | Fixed | Enter is always intercepted for an active non-empty owner query and selects the first result when appropriate. | Owner combobox keyboard tests prove selection and no enclosing-form submission. | `1097532` |
| F-7 | major | Fixed | One controlled option model now owns visible highlight, active descendant, and selected state. | Arrow-key tests assert the coherent active option and selection. | `1097532` |
| F-8 | major | Fixed | Assessment and Risk metadata, date, select, and owner errors use stable IDs, icon plus text, `aria-invalid`, and descriptions. | Assessment editor workflow tests plus web suite 178/178. | `1097532` |
| F-9 | major | Fixed | ControlImplementation fields consume server errors and deletion failures remain visible inside the open dialog. | Editor regressions exercise field-error projection and `ConfirmDialog.errorMessage`. | `1097532` |
| F-10 | minor | Fixed | Routine draft states use non-alert containers and one persistent polite status region; failures remain alerts. | Assessment review workflow tests cover queued, running, completed, and failed states. | `1097532` |
| F-11 | minor | Fixed | Timed-out polling offers `Check again` and resets only the observation budget for the same job. | Workflow tests retain the one-request/second and 30-second bounds. | `1097532` |
| F-12 | minor | Fixed | Skeleton and populated editor share the same `xl` breakpoint and 22rem sidebar grid. | Typecheck and component regression suite pass. | `1097532` |
| F-13 | minor | Fixed | A persistent readiness status region owns both missing and ready content. | Tests assert the final ready announcement after fallback content is replaced. | `1097532` |
| F-14 | minor | Fixed | Exemption review date has persistent ISO datetime help linked to the input. | Risk editor regression retains the format guidance during typing. | `1097532` |
| F-15 | minor | Fixed | Central status presentation maps enums to sentence-case labels and state-specific icons. | Editor, mobile cards, desktop table, unit tests, and E2E use `Draft`, `In review`, and `Approved`. | `1097532`, `3112876` |
| F-16 | minor | Fixed | Review assessment collection/detail segments have contextual loading and error boundaries. | Files exist with local retry and safe back navigation; Playwright passes 11/11. | `60aafad` |
| F-17 | blocker | Fixed | Release alone requires the explicit human `Security Analyst` role; the seeded agent role is denied before controller execution. | Mounted agent denial snapshots assessment/request state and human release still succeeds. | `3367a54` |
| F-18 | minor | Fixed | Active-user search follows the exact catalogue grant instead of imposing contradictory analyst-only controller scope. | Mounted Requestor search proves bounded active projection; ungranted actors remain 403. | `3367a54` |
| F-19 | minor | Fixed | duplicate of F-2; fixed by the same implementation and independently covered by named per-fixture rejection output. | All six production-guard invocations pass and authoritative bytes are restored. | `ddf18f1` |
| F-20 | minor | Fixed | duplicate of F-3; fixed by the same implementation and independently covered by immutable 409 read-backs and rejected-create counts. | Assessment, Risk, and ControlImplementation 409 cases prove no persisted write. | `3367a54` |
| F-21 | minor | Fixed | Suspense regressions resolve deferred promises inside `act`, await fallback removal, and assert populated content. | Assessment review workflow tests pass without tautological Promise assertions. | `1097532` |
| F-22 | blocker | Fixed | Owner listbox active IDs now name real DOM options through one controlled implementation. | Keyboard regression validates `aria-activedescendant`, visible active styling, and Enter selection. | `1097532` |
| F-23 | major | Fixed | duplicate of F-6/F-7; fixed by the same implementation and independently covered by no-arrow Enter selection. | Owner combobox test proves first-result selection without implicit submit. | `1097532` |
| F-24 | major | Fixed | duplicate of F-5; fixed by the same implementation and independently covered for the full ordered token ladder. | Badge tests assert Low, Moderate, High, and Critical classes and shapes. | `1097532` |
| F-25 | major | Fixed | duplicate of F-9; fixed by the same implementation and independently covered by field-level and modal-error projection. | Full editor test suite and Playwright release journey pass. | `1097532` |
| F-26 | minor | Fixed | Inline errors use icon plus text and programmatic invalid/error associations. | Risk field regression and axe-backed E2E pass. | `1097532` |
| F-27 | minor | Fixed | duplicate of F-14; fixed by the same persistent linked datetime guidance. | Risk editor tests retain the visible ISO format hint. | `1097532` |
| F-28 | minor | Fixed | duplicate of F-15; fixed by the shared status presentation across mobile and desktop lists. | Web tests and release E2E assert human-readable labels. | `1097532`, `3112876` |
| F-29 | major | Fixed | duplicate of F-5; fixed by semantic risk ladder tokens without interactive/info blue. | Badge class assertions and full web suite pass. | `1097532` |
| F-30 | major | Fixed | Popover dismissal handles outside open-state changes, Tab, Escape, and selection. | Owner combobox tests cover closure behavior and controlled expanded state. | `1097532` |
| F-31 | major | Fixed | duplicate of F-7; fixed by the same controlled highlight and selection mechanism. | ArrowUp/ArrowDown tests keep visual and programmatic state aligned. | `1097532` |
| F-32 | minor | Fixed | Every non-empty keystroke immediately enters pending state through debounce; empty text appears only after a completed search. | Owner search regressions cover loading and stale-response protection. | `1097532` |
| F-33 | minor | Fixed | duplicate of F-26; fixed by icon, text, `aria-invalid`, and `aria-describedby` on Risk and assessment controls. | Component suite 178/178 and accessibility E2E pass. | `1097532` |
| F-34 | minor | Fixed | duplicate of F-13; fixed by the persistent live region and independently covered by the ready-state announcement. | Assessment editor test asserts `All release requirements are present.` | `1097532` |
| F-35 | minor | Fixed | duplicate of F-15; fixed by one enum-to-label/icon mapping reused across editor and list views. | Unit and E2E status assertions pass. | `1097532`, `3112876` |
| F-36 | minor | Fixed | Each badge exposes `Severity: {label} ({position} of 4)` while retaining visible text and decorative shape. | Four badge accessibility-name tests pass. | `1097532` |
| F-37 | minor | Fixed | duplicate of F-16; fixed across both review requests and review assessments collection/detail segments. | Eight route-local boundary files provide contextual retry and back links; E2E passes. | `60aafad` |
| F-38 | minor | Fixed | Risk and ControlImplementation no-change status regions are mounted before their text changes. | Editor regressions exercise the persistent live outcomes. | `1097532` |
| F-39 | minor | Fixed | Release readiness and deterministic draft panels now contribute real nested `h2` headings. | Component queries and axe E2E pass without changing Card primitives. | `1097532` |
| F-40 | minor | Fixed | duplicate of F-14; fixed by the persistent ISO guidance and linked description. | Risk editor regression confirms the hint survives input. | `1097532` |
| F-41 | major | Fixed | Valid zero-mapping questionnaires produce a closed zero-risk draft assessment for human review instead of a permanent job failure. | Unit parser/provider tests and mounted persistence/readiness test pass. | `3367a54` |
| F-42 | minor | Fixed | Readiness presentation parses server bare assessment keys and `risks[n].field` paths into labels and correct anchors. | Fixtures now use actual server vocabulary and map to assessment/risk sections. | `1097532` |
| F-43 | minor | Fixed | Equally authorized analysts receive the existing active/completed job without changing initiator metadata or scheduling duplicate execution. | Registry unit test and mounted second-agent test assert the same job and initiator. | `3367a54` |
| F-44 | minor | Fixed | Capability-gated navigation exposes analyst review and Requestor assessment inventories with unambiguous labels. | Mobile navigation tests cover allowed and hidden states; Playwright shell tests pass. | `60aafad` |
| F-45 | minor | Fixed | Sorted suggested control numbers are composed into bounded advisory treatment-plan text; zero suggestions use honest copy. | Unit and mounted reload assertions prove exact identifiers survive persistence. | `3367a54` |

**Deferred findings:** None.

## Verification

- Node: `v24.19.0`.
- `apps/strapi npm test`: PASS — 72/72 tests.
- `apps/web npm run typecheck`: PASS.
- `apps/web npm test`: PASS — 178/178 tests.
- `apps/web npm run api:check`: PASS — generated schema unchanged.
- `apps/web npm run test:e2e`: PASS — 11/11 tests.
- `pwsh scripts/verify-phase-04-integrity.test.ps1`: PASS — six hostile fixtures rejected and production integrity clean.
- Catalogue copies: PASS — byte-identical SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- Content-type schemas: PASS — 15 tracked schemas and zero diffs from base `aad34317c`.
- Port isolation: PASS — existing listeners on 1337/3000 predated execution; no process on either port was started, stopped, or modified.
- `git diff --check`: PASS.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test injection] Targeted the mounted provider module**
- **Found during:** Final Strapi gate.
- **Issue:** The provider-failure helper mutated the test-compiled module while mounted Strapi executed the production-compiled module; zero-mapping support exposed the false failure proof.
- **Fix:** The harness now injects failure into the exact production-compiled provider instance used by mounted Strapi.
- **Commit:** `ae7756e`.

**2. [Rule 1 - Test contract] Aligned E2E with human-readable status labels**
- **Found during:** Final Playwright gate.
- **Issue:** The release journey still asserted raw `draft`, `in-review`, and `approved` tokens after the required sentence-case status remediation.
- **Fix:** Retained the workflow assertions and targeted `Draft`, `In review`, and `Approved`.
- **Commit:** `3112876`.

## Known Stubs

None.

## Threat Flags

None. The authorization change narrows the existing release operation; it introduces no endpoint, schema, file-access, or new trust-boundary surface.

## Self-Check: PASSED

- All implementation commits exist and contain real multiline bodies.
- All created route/test files exist.
- The finding table contains F-1 through F-45 exactly once in its Finding column.
- User-owned dirty files and directories remain uncommitted and untouched by task commits.
