---
phase: 08-production-integration-and-hardening
plan: 01
subsystem: dependency-hygiene
tags: [pnpm, audit, overrides, vitest, turbo, sharp, nodemailer, tar, js-yaml, security-record]

requires:
  - phase: 07-analyst-dashboard-reports-and-alerts
    provides: the green baseline (Strapi 350/350, web 834/834) that the patched tree is measured against
provides:
  - in-major bumps of vitest (4.0.18 → 4.1.11) and turbo (2.8.16 → 2.11.3), and pnpm-workspace.yaml overrides for tar 7.5.22, js-yaml 4.3.2, nodemailer 9.1.1 and sharp 0.35.4
  - pnpm audit moved from critical 1 / high 6 / moderate 19 / low 2 to critical 0 / high 1 / moderate 13 / low 1
  - docs/security/dependency-audit-phase-08.md, the D-23 evidence with every fixed advisory and every accepted residual
  - the patched dependency tree every later Phase 8 plan runs on
affects: [08-14-phase-gate, 08-security-audit, dependency-upgrades]

tech-stack:
  added: []
  patterns:
    - "Transitive advisories under Strapi-pinned packages are fixed with pnpm-workspace.yaml overrides in the same major, never by adding a direct dependency."
    - "A dependency change is proven by the suite that boots the affected packages: the Strapi harness exercises the sharp and nodemailer overrides, the web suite the vitest bump."

key-files:
  created:
    - docs/security/dependency-audit-phase-08.md
  modified:
    - apps/web/package.json
    - package.json
    - pnpm-workspace.yaml
    - pnpm-lock.yaml

key-decisions:
  - "Only critical and high advisories with an in-major patch are fixed here (D-23); the moderate and low residuals with in-major patches (undici, ajv, qs, dompurify) are recorded as candidates for the next dependency pass rather than silently left."
  - "vite 5.4.21 under @strapi/strapi 5.51.0 stays as the one high residual: its fix is a major behind Strapi's pin and the advisory concerns the Vite development server only."

patterns-established:
  - "Dependency audit record: before and after totals, a fixed table keyed by advisory id, a residual table with reason and re-check trigger, and the suite results on the patched tree."

requirements-completed: [INT-04]

duration: 1h 25m (including a 40-minute stall after verification, see Issues Encountered)
completed: 2026-09-25
---

# Phase 08 Plan 01: Dependency hygiene Summary

**The auditable dependency advisories are closed with in-major bumps and overrides, the one remaining high advisory is a recorded Strapi-pinned residual, and both suites are green on the patched tree.**

## Performance

- **Duration:** about 1h 25m end to end (verification itself: Strapi 10.7 minutes, web 56 seconds)
- **Started:** 2026-09-25T10:30:00Z (approximate executor start)
- **Completed:** 2026-09-25 (metadata commit)
- **Tasks:** 2 of 2
- **Files modified:** 5

## Accomplishments
- `pnpm audit` drops from critical 1 / high 6 / moderate 19 / low 2 to critical 0 / high 1 / moderate 13 / low 1, with no package added or removed.
- The overrides are proven by the suites that load them: the Strapi harness boots `@strapi/upload` (sharp 0.35.4) and `@strapi/email` (nodemailer 9.1.1) in every integration file; the web suite runs under vitest 4.1.11.
- `docs/security/dependency-audit-phase-08.md` records the evidence the phase gate (plan 08-14) re-checks and the security audit cites.

## Task Commits

1. **Task 1: Apply the audited version bumps and overrides, and regenerate the lockfile** - `46e7563` (chore)
2. **Task 2: Prove the suites on the patched tree and write the audit record** - `e8697db` (docs)

**Plan metadata:** the `docs(08-01): complete dependency hygiene plan` commit that carries this summary.

## Files Created/Modified
- `apps/web/package.json` - `vitest` `^4.1.11` (was pinned 4.0.18).
- `package.json` - `turbo` `^2.9.14` (was pinned 2.8.16; resolves 2.11.3).
- `pnpm-workspace.yaml` - overrides `tar: 7.5.22`, `js-yaml: 4.3.2`, `nodemailer: ^9.1.1`, `sharp: 0.35.4` beside the existing `@types/react*` overrides.
- `pnpm-lock.yaml` - regenerated; `pnpm install --frozen-lockfile` passes.
- `docs/security/dependency-audit-phase-08.md` - the audit record (21 advisory ids).

## Verification

| Check | Result |
|-------|--------|
| `pnpm install --frozen-lockfile` | Already up to date |
| `pnpm --filter @csrm/strapi test` | 350 passed / 0 failed (10.7 min) |
| `pnpm --filter @csrm/web test` | 69 files, 834 passed / 0 failed (55.9 s) |
| `pnpm --filter @csrm/web typecheck` | clean |
| `pnpm --prefix apps/web api:check` | clean |
| `pnpm audit --json` | critical 0; the remaining high is `vite` 5.4.21 (recorded residual) |
| `git diff 46e7563^..46e7563 -- apps/strapi/src/api` | empty (no Strapi source change) |

## Decisions Made
- Versions came from the research's legitimacy table; every proposed target resolved (`turbo` resolved 2.11.3 under `^2.9.14`).
- `@vitest/mocker` was not added as a direct dependency; it followed `vitest` to 4.1.11 and its advisory cleared.
- Moderate residuals with in-major patches (`undici`, `ajv`, `qs`, `dompurify`) are named as candidates for the next dependency pass instead of being fixed here, keeping this plan inside D-23's high-and-critical scope.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The executor was stopped by an interrupt after its Task 2 verification had completed (its suite logs and audit outputs were intact) but before it wrote the audit record and this summary. The orchestrator wrote both from those logs and the Task 1 commit, re-ran `pnpm install --frozen-lockfile`, and did the plan bookkeeping. No verification result is claimed beyond what the logs show.

## User Setup Required

None.

## Next Phase Readiness
- Every later Phase 8 plan runs on this patched tree; 08-02 (the production-build browser harness) follows.
- The phase gate re-runs `pnpm audit` and compares against the recorded totals.
