---
phase: 05-risk-register-and-mitigation-management
plan: 12
subsystem: testing
tags: [playwright, nextjs, strapi, nyquist, accessibility, date-filtering]

requires:
  - phase: 05-risk-register-and-mitigation-management
    provides: Inclusive Strapi target-date filtering and responsive typed Risk Register controls
provides:
  - Isolated full-stack proof of the complete RISK-01 target-date filtering contract
  - Resolved date-filter contract record across backend, OpenAPI, generated transport, URL, and UI layers
  - Reconciled Nyquist mappings and final integrity, build, Strapi, Vitest, and Playwright evidence
affects: [phase-05-verification, RISK-01, risk-register]

tech-stack:
  added: []
  patterns: [stable-fixture inclusive browser assertions, keyboard-operated responsive filter verification, executable Nyquist evidence]

key-files:
  created:
    - .planning/phases/05-risk-register-and-mitigation-management/05-12-SUMMARY.md
  modified:
    - apps/web/e2e/risk-register-workflow.spec.ts
    - docs/contract-gaps/phase-05-risk-register-date-filter.md
    - .planning/phases/05-risk-register-and-mitigation-management/05-VALIDATION.md

key-decisions:
  - "Use the stable mutable Risk target date as the equal-bound browser assertion so inclusivity and authoritative totals are deterministic."
  - "Treat unknown URL state as canonicalized on the first filter interaction rather than requiring an initial server redirect."
  - "Keep Phase 5 in progress until the orchestrator completes re-verification, despite all Plan 05-12 gates passing."

patterns-established:
  - "Browser date-range closure: prove equal bounds, composition, no-match totals, individual/paired/global clearing, responsive keyboard access, and denial in one isolated journey."
  - "Nyquist gap closure: preserve historical rows while explicitly superseding only obsolete negative assertions and mapping every corrective task to its runnable command."

requirements-completed: [RISK-01]

duration: 43min
completed: 2026-09-01
---

# Phase 05 Plan 12: Target-Date Gap Closure Summary

**The real Risk Register journey now proves inclusive target-date filtering end to end, while reconciled evidence closes the contract record without weakening authorization or RISK-02.**

## Performance

- **Duration:** 43 min
- **Started:** 2026-08-31T21:26:39Z
- **Completed:** 2026-08-31T22:09:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Replaced the obsolete absent-date-control browser assertions with equal-bound inclusivity, canonical URL, composed-filter, zero-result, authoritative-total, and individual/paired/global clearing proof.
- Extended responsive browser coverage so both labelled native date inputs and keyboard clearing are exercised in the desktop popover and mobile Sheet without horizontal overflow.
- Strengthened Jane's safe denial proof to assert that existing and random Risks reveal no count, record, filter, or date clue.
- Rewrote the former contract-gap record as a resolved contract spanning parser, shared pre-pagination repository predicate, OpenAPI/generated transport, typed service, URL schema, UI, and mounted/component/browser evidence.
- Reconciled all six Plans 05-10 through 05-12 task IDs to exact runnable commands and actual GREEN results while preserving earlier Phase 5 historical evidence as explicitly superseded where necessary.

## Task Commits

Each task was committed atomically:

1. **Task 1: Prove the isolated browser journey and resolve the contract-gap record** - `55d2aa8` (test)
2. **Task 2: Reconcile Nyquist mappings and run integrity, build, and mandatory gates** - `8f19fb8` (docs)

## Files Created/Modified

- `apps/web/e2e/risk-register-workflow.spec.ts` - Full-stack target-date and unchanged Requestor-denial assertions on Playwright-owned ports.
- `docs/contract-gaps/phase-05-risk-register-date-filter.md` - Resolved RISK-01 date-filter contract and executable evidence record.
- `.planning/phases/05-risk-register-and-mitigation-management/05-VALIDATION.md` - Six gap-task mappings with actual test counts and superseded historical assertions.
- `.planning/phases/05-risk-register-and-mitigation-management/05-12-SUMMARY.md` - Execution results, deviations, verification, and handoff.

## Decisions Made

- Used the seeded `2026-12-01` mutable Risk date for equal inclusive browser bounds, keeping the result and total deterministic across isolated suites.
- Asserted unknown URL-state removal after the first canonical filter interaction, matching the established client URL-rebuild boundary rather than inventing a server redirect.
- Left Phase 5 marked In Progress and did not start Phase 6; the orchestrator owns the required phase re-verification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bug] Aligned unknown-key assertion with the canonical URL interaction boundary**
- **Found during:** Task 1
- **Issue:** The first positive browser draft expected unknown query keys to disappear immediately on server render, but canonical rebuilding occurs on filter interaction.
- **Fix:** Verified the valid date range on initial render and asserted unknown-key removal after removing the first date chip.
- **Files modified:** `apps/web/e2e/risk-register-workflow.spec.ts`
- **Verification:** Isolated Playwright journey passed.
- **Commit:** `55d2aa8`

**2. [Rule 3 - Blocking test interaction] Used keyboard activation for the popover clear action**
- **Found during:** Task 1
- **Issue:** Pointer activation of the open popover action was intercepted by the document during the route transition and exhausted the test timeout.
- **Fix:** Focused **Clear target dates**, asserted focus, and activated it with Enter, directly exercising the required keyboard contract.
- **Files modified:** `apps/web/e2e/risk-register-workflow.spec.ts`
- **Verification:** Isolated Playwright journey passed in 1.2 minutes.
- **Commit:** `55d2aa8`

**3. [Rule 1 - Test race] Waited for the lower-bound URL update before changing the upper bound**
- **Found during:** Task 1
- **Issue:** Consecutive controlled-input fills could race, allowing the second navigation to rebuild from stale query state and drop the first bound.
- **Fix:** Added an observable URL synchronization point between the two fills.
- **Files modified:** `apps/web/e2e/risk-register-workflow.spec.ts`
- **Verification:** Equal and no-match closed ranges both passed in the isolated journey and complete suite.
- **Commit:** `55d2aa8`

**4. [Rule 1 - Test integrity] Made persisted Risk comments repeat-run safe**
- **Found during:** Post-plan code-review gate
- **Issue:** Repeated full-suite runs could reuse the already-persisted fixed comment, producing no mutation delta and therefore no save-success announcement.
- **Fix:** Read the current Comments input and deterministically toggle between two explicit evidence strings before saving, then assert the selected value after authoritative reload.
- **Files modified:** `apps/web/e2e/risk-register-workflow.spec.ts`
- **Verification:** Focused isolated Risk Register Playwright journey passed on ports 1338/3100.
- **Commit:** Recorded in the post-plan atomic fix commit.

**5. [Rule 1 - Feedback lifecycle bug] Preserved successful Risk save status across same-record revalidation**
- **Found during:** Post-code-review complete Playwright gate
- **Issue:** `revalidatePath` correctly refreshed the Risk detail route after mutation, but the client prop-synchronization effect cleared the live-region message whenever the refreshed same-Risk object arrived. Under full-suite timing the mutation and persisted data were visible while **Risk changes saved.** had already disappeared.
- **Fix:** Track the Risk document/parent-lock identity and preserve feedback when fresh props represent the same Risk in the same lock state; clear feedback for a different Risk, changed lock authority, or non-ready state.
- **Files modified:** `apps/web/src/features/risks/risk-details.tsx`, `apps/web/src/features/risks/risk-details.test.tsx`, `apps/web/src/features/risks/risk-actions.test.ts`
- **Verification:** 20/20 focused component/action tests, strict typecheck, and 12/12 Playwright journeys passed.
- **Commit:** Recorded in the post-review atomic fix commit.

**Total deviations:** 5 auto-fixed (3 test bugs, 1 blocking interaction, 1 feedback lifecycle bug). **Impact:** Canonical URL and repeat-run browser evidence remain strict, while accessible mutation feedback now survives the authoritative same-record cache refresh without retaining stale feedback across identity or authorization-state changes.

## Issues Encountered

- The first complete Playwright suite run passed the new Risk Register journey but the unrelated Requestor workflow missed its transient submit-dialog keyboard action, leaving the request in Draft. No unrelated source was changed; the exact complete web gate was rerun and passed all 12 journeys.
- The global `pnpm` shim reports a different host runtime on this machine. All authoritative pnpm commands were routed through Node 24.19.0's Corepack entry point, consistent with the locked project runtime and earlier Phase 5 execution.

## Known Stubs

None. The modified test and documentation files contain no sentinel, focused test, conditional GREEN escape, placeholder UI data, or unresolved implementation stub.

## Verification

- Inherited RED baseline - PASS: the pre-plan browser journey failed specifically because it expected both shipped date controls to be absent.
- `pnpm --filter @csrm/web exec playwright test e2e/risk-register-workflow.spec.ts --reporter=line` - PASS, 1/1 isolated full-stack journey on ports 1338/3100.
- `node scripts/verify-phase-05-integrity.mjs` - PASS: Node/branch, immutable schemas/packages/lock, catalogue identity/hash, authorization, anti-escape, typed transport, semantic colours, isolated ports, AI-attribution, and generated-contract checks.
- `pnpm --filter @csrm/web build` - PASS, Next.js production build completed.
- `cd apps/strapi && npm test` - PASS, 96/96 tests.
- `cd apps/web && pnpm typecheck && pnpm test && pnpm api:check && pnpm test:e2e` - PASS on exact full-gate retry: strict typecheck, 241/241 Vitest tests, stable generated API, and 12/12 Playwright journeys.
- `pnpm --filter @csrm/web exec vitest run src/features/risks/risk-details.test.tsx src/features/risks/risk-actions.test.ts` - PASS, 20/20 focused feedback/action tests after the revalidation lifecycle fix.
- `pnpm --filter @csrm/web typecheck` - PASS after the feedback lifecycle fix.
- `pnpm --filter @csrm/web test:e2e` - PASS, all 12 isolated Playwright journeys after the feedback lifecycle fix.
- Validation scan - PASS: all six `05-10-01` through `05-12-02` task IDs are mapped, with obsolete negative date assertions explicitly superseded and no operative rejection/absence claim remaining.
- Protected paths - PASS: content schemas, package manifests, lockfile, catalogue copies, RISK-02 feature files, and live 1337/3000 servers were unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05-12 is complete and the sole RISK-01 date-filter gap has executable backend, typed web, component, and browser evidence.
- Phase 5 remains In Progress pending orchestrator-owned re-verification; this executor did not mark the phase complete or start Phase 6.

## Self-Check: PASSED

- All three planned modified files and this summary exist.
- Task commits `55d2aa8` and `8f19fb8` exist in git history.
- The final integrity/build/Strapi/web gates pass, and only the explicitly excluded pre-existing working-tree paths remain dirty.

---
*Phase: 05-risk-register-and-mitigation-management*
*Completed: 2026-09-01*
