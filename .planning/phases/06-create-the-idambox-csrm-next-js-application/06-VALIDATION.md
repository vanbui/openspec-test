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
| 06-01-01 | 06-01 | 1 | APP-06 | T-06-SC | Every direct package publisher/repository/integrity/postinstall is approved before installation | setup/manual gate | `for p in next react react-dom server-only lucide-react class-variance-authority clsx tailwind-merge tw-animate-css @radix-ui/react-avatar @radix-ui/react-collapsible @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-tooltip shadcn typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss postcss eslint eslint-config-next openapi-typescript msw vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test; do npm view "$p" name version maintainers repository.url dist.integrity deprecated scripts.postinstall; done` | ❌ W0 | ⬜ pending |
| 06-01-02 | 06-01 | 1 | APP-06 | T-06-01 / T-06-02 | Bounded production probe receives HTTP 200 and exact foundation copy on port 3001, then releases the listener | build/runtime tracer | `yarn workspace @idambox/csrm check-types && yarn workspace @idambox/csrm lint && yarn workspace @idambox/csrm build && yarn workspace @idambox/csrm verify:runtime && yarn turbo run build --filter=@idambox/csrm --dry=json > /tmp/idambox-csrm-turbo.json && rg '"task":"build"|@idambox/csrm' /tmp/idambox-csrm-turbo.json` | ❌ W0 | ⬜ pending |
| 06-02-01 | 06-02 | 2 | APP-06 | T-06-03 / T-06-06 | Prefix-safe server transport carries generated GET /applications through MSW | integration/tracer | `yarn workspace @idambox/csrm test:unit --run src/lib/api/csrm-service.test.ts -t 'lists applications through the generated contract|preserves the configured Strapi prefix'` | ❌ W0 | ⬜ pending |
| 06-02-02 | 06-02 | 2 | APP-06 | T-06-03 | Full generated API artifact is committed and drift-checkable without mutation | static/type | `yarn workspace @idambox/csrm generate:openapi && yarn workspace @idambox/csrm verify:openapi && git diff --exit-code -- apps/csrm/src/lib/api/generated/openapi.ts` | ❌ W0 | ⬜ pending |
| 06-02-03 | 06-02 | 2 | APP-06 | T-06-04 / T-06-05 | Raw errors are normalized and undeclared MSW traffic cannot escape | integration | `yarn workspace @idambox/csrm test:unit --run src/lib/api/csrm-service.test.ts` | ❌ W0 | ⬜ pending |
| 06-03-01 | 06-03 | 2 | APP-06 | T-06-08 / T-06-10 | Capability/route registry matches all Function IDs and never role strings | unit/tracer | `yarn workspace @idambox/csrm test:unit --run src/config/capabilities.test.ts && yarn workspace @idambox/csrm check-types` | ❌ W0 | ⬜ pending |
| 06-03-02 | 06-03 | 2 | APP-06 | T-06-07 | Fixture elevation is server-derived and impossible in production | unit | `yarn workspace @idambox/csrm test:unit --run src/lib/fixtures/resolve-identity.test.ts && yarn workspace @idambox/csrm check-types` | ❌ W0 | ⬜ pending |
| 06-03-03 | 06-03 | 2 | APP-06 | T-06-08 / T-06-09 | Forbidden/planned/unknown outcomes resolve before protected callbacks | unit | `yarn workspace @idambox/csrm test:unit --run src/domain/route-access.test.ts && yarn workspace @idambox/csrm test:unit --run src/config/capabilities.test.ts src/lib/fixtures/resolve-identity.test.ts` | ❌ W0 | ⬜ pending |
| 06-04-01 | 06-04 | 3 | APP-06 | T-06-12 / T-06-13 | Exact semantic tokens meet contrast and foundation TSX has no raw brand values | unit/tracer | `yarn workspace @idambox/csrm test:unit --run src/styles/tokens.test.ts && yarn workspace @idambox/csrm check-types && yarn workspace @idambox/csrm lint` | ❌ W0 | ⬜ pending |
| 06-04-02 | 06-04 | 3 | APP-06 | T-06-SC | Only approved official shadcn sources are added with no package drift | static/type | `yarn workspace @idambox/csrm check-types && yarn workspace @idambox/csrm lint && git diff --exit-code -- apps/csrm/package.json yarn.lock` | ❌ W0 | ⬜ pending |
| 06-05-01 | 06-05 | 4 | APP-06 | T-06-11 / T-06-13 | Typed boundary safely renders loading, error, empty, and ready | component/tracer | `yarn workspace @idambox/csrm test:unit --run src/components/states/states.test.tsx -t 'loading|recoverable error|empty|ready' && yarn workspace @idambox/csrm check-types` | ❌ W0 | ⬜ pending |
| 06-05-02 | 06-05 | 4 | APP-06 | T-06-11 / T-06-13 | Partial, overflow, cardinality, forbidden, and unavailable states preserve safe semantics | component | `yarn workspace @idambox/csrm test:unit --run src/components/states/states.test.tsx && yarn workspace @idambox/csrm check-types` | ❌ W0 | ⬜ pending |
| 06-06-01 | 06-06 | 5 | APP-06 | T-06-14 / T-06-16 | Server shell filters planned navigation and preserves landmarks/desktop geometry | component/tracer | `yarn workspace @idambox/csrm test:unit --run src/components/shell/shell.test.tsx -t 'renders the desktop foundation shell|filters planned navigation' && yarn workspace @idambox/csrm check-types` | ❌ W0 | ⬜ pending |
| 06-06-02 | 06-06 | 5 | APP-06 | T-06-14 / T-06-17 | Loading/unavailable/forbidden routes expose no protected work or metadata | component/build | `yarn workspace @idambox/csrm test:unit --run src/components/shell/shell.test.tsx -t 'loading|planned route|analyst-only|production evidence route' && yarn workspace @idambox/csrm test:unit --run src/domain/route-access.test.ts src/components/states/states.test.tsx && yarn workspace @idambox/csrm build` | ❌ W0 | ⬜ pending |
| 06-07-01 | 06-07 | 6 | APP-06 | T-06-16 / T-06-18 | Drawer/collapse islands are accessible and persist only presentation | component/tracer | `yarn workspace @idambox/csrm test:unit --run src/components/shell/shell.test.tsx -t 'opens and dismisses mobile navigation|persists only sidebar presentation|collapses desktop navigation' && yarn workspace @idambox/csrm check-types` | ❌ W0 | ⬜ pending |
| 06-07-02 | 06-07 | 6 | APP-06 | T-06-15 / T-06-16 | Account/identity/focus islands are accessible, server-derived, and absent from production | component/build | `yarn workspace @idambox/csrm test:unit --run src/components/shell/shell.test.tsx -t 'changes development identity|omits fixture controls in production|announces route and identity changes' && yarn workspace @idambox/csrm check-types && yarn workspace @idambox/csrm build` | ❌ W0 | ⬜ pending |
| 06-08-01 | 06-08 | 7 | APP-06 | T-06-20 | Desktop/mobile tracer proves focus, overflow, targets, visuals, and local-only network | focused E2E/visual | `yarn workspace @idambox/csrm test:e2e --grep 'Requestor desktop foundation|Requestor mobile navigation'` | ❌ W0 | ⬜ pending |
| 06-08-02 | 06-08 | 7 | APP-06 | T-06-19 / T-06-20 / T-06-21 / T-06-22 | Remaining viewports, UI backstops, states, access, and production fixture exclusion pass focused smoke groups | focused E2E | `yarn workspace @idambox/csrm test:e2e --grep 'remaining viewport matrix|access and state matrix|production fixture exclusion'` | ❌ W0 | ⬜ pending |
| 06-08-03 | 06-08 | 7 | APP-06 | T-06-19 / T-06-22 | Full E2E/unit/OpenAPI/build gate plus human visual review approve the contract | final checkpoint | `yarn workspace @idambox/csrm test:e2e && yarn workspace @idambox/csrm test && yarn workspace @idambox/csrm verify:openapi && yarn workspace @idambox/csrm build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Planner replaces TBD identifiers with final plan/task IDs.*

---

## Wave 0 Requirements

- [ ] Plan 06-01 creates `apps/csrm/package.json`, strict TypeScript/Next/Tailwind/PostCSS/shadcn initialization, root Turbo integration, and a bounded HTTP 200/exact-copy runtime tracer with cleanup after the package checkpoint.
- [ ] Plan 06-02 creates `vitest.config.ts`, shared MSW lifecycle/handlers/payloads, generated full OpenAPI types, focused service tests, and non-mutating drift verification.
- [ ] Plan 06-03 creates exact catalogue-derived capability, route, fixture, and access contracts with unit tests.
- [ ] Plan 06-04 creates semantic tokens and the approved primitive inventory; Plan 06-05 creates all reusable UI states with Testing Library evidence.
- [ ] Plan 06-06 creates the server shell/direct-route states; Plan 06-07 adds bounded responsive/account/identity client islands.
- [ ] Plan 06-08 creates Playwright configuration, local-only browser networking, focused task smoke groups, a final full gate, committed golden convention, and coverage for 375×812, 390×844, 430×932, 768×1024, 1024×768, and 1440×900.

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
