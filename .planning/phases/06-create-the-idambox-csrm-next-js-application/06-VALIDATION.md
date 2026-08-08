---
phase: 6
slug: create-the-idambox-csrm-next-js-application
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-09
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 + Testing Library + MSW 2; Playwright 1 |
| **Config file** | `apps/csrm/vitest.config.ts` and `apps/csrm/playwright.config.ts` — Wave 0 installs |
| **Quick run command** | `yarn workspace @idambox/csrm check-types && yarn workspace @idambox/csrm test:unit --run` |
| **Full suite command** | `yarn workspace @idambox/csrm test && yarn workspace @idambox/csrm verify:openapi && yarn workspace @idambox/csrm test:e2e` |
| **Estimated runtime** | ~180 seconds after browser installation |

---

## Sampling Rate

- **After every task commit:** Run `yarn workspace @idambox/csrm check-types && yarn workspace @idambox/csrm test:unit --run`
- **After every plan wave:** Run `yarn workspace @idambox/csrm test && yarn workspace @idambox/csrm verify:openapi`
- **Before `$gsd-verify-work`:** Run `yarn check-types && yarn lint && yarn workspace @idambox/csrm test:e2e`
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-W0-01 | TBD | 0 | APP-06 | T6-01 / T6-05 | Dependencies are reviewed before installation and test interception cannot leak to the network | setup | `yarn workspace @idambox/csrm test:unit --run` | ❌ W0 | ⬜ pending |
| 06-W0-02 | TBD | 0 | APP-06 | T6-02 | Generated API types and server-only configuration do not drift or enter client code | static/type | `yarn workspace @idambox/csrm check-types && yarn workspace @idambox/csrm verify:openapi` | ❌ W0 | ⬜ pending |
| 06-W0-03 | TBD | 0 | APP-06 | T6-01 / T6-03 | Capability derivation is ID-based and fixture elevation is environment-gated | unit | `yarn workspace @idambox/csrm test:unit --run src/domain/capabilities.test.ts` | ❌ W0 | ⬜ pending |
| 06-W0-04 | TBD | 0 | APP-06 | T6-02 / T6-04 / T6-05 | API failures are normalized and undeclared requests fail closed | integration | `yarn workspace @idambox/csrm test:unit --run src/lib/api/csrm-service.test.ts` | ❌ W0 | ⬜ pending |
| 06-W0-05 | TBD | 0 | APP-06 | T6-03 | Unavailable navigation is hidden and protected destinations render forbidden state | component | `yarn workspace @idambox/csrm test:unit --run src/components/shell` | ❌ W0 | ⬜ pending |
| 06-W0-06 | TBD | 0 | APP-06 | T6-01 / T6-03 | Responsive shell and identity controls remain accessible and cannot become production auth | E2E/visual | `yarn workspace @idambox/csrm test:e2e` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Planner replaces TBD identifiers with final plan/task IDs.*

---

## Wave 0 Requirements

- [ ] `apps/csrm/package.json`, strict `tsconfig.json`, Next/Tailwind/PostCSS/shadcn initialization, root Turbo integration, and workspace scripts.
- [ ] `apps/csrm/vitest.config.ts`, `src/test/setup.ts`, `src/test/msw-server.ts`, shared handlers/payload factories, and a test render helper.
- [ ] `apps/csrm/playwright.config.ts`, deterministic fixture mode, `e2e/shell.spec.ts`, output/snapshot ignore policy, and browser install script.
- [ ] `apps/csrm/src/lib/api/generated/openapi.ts`, `generate:openapi`, and `verify:openapi` drift check.
- [ ] Automated viewport coverage for 375×812, 390×844, 430×932, 768×1024, 1024×768, and 1440×900.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Package legitimacy checkpoint | APP-06 | Registry legitimacy signals and postinstall metadata were unavailable during research | Before installation, inspect publisher/repository and `npm view <package> scripts.postinstall` for every proposed direct dependency; record approval in the execution summary. |
| Visual contract review | APP-06 | Screenshot assertions cannot judge hierarchy and brand restraint alone | Review Playwright screenshots at all six contract viewports against `06-UI-SPEC.md`, including focal point, sidebar modes, drawer behavior, overflow, and focus visibility. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
