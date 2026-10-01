---
phase: "22"
slug: "admin-role-and-configurable-lists"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-01"
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source and scope.** Seeded on 2026-10-01 from `22-RESEARCH.md`'s "Validation Architecture", before any plan exists. It maps the following to automated proofs:
- ADMIN-07 and ADMIN-08;
- the four ROADMAP success criteria (SC1 to SC4);
- the carried items: G-20's manual start, the Information Asset owner and the records retention rule;
- D-09 (the agent's grants withdrawn);
- D-26 (the Admin fixture);
- every negative case in `22-CONTEXT.md` `<authorisation>`.

**How the maps are filled.**
- **Per-task map:** the planner replaces the seeded rows with one row per task, taken from each task's `<automated>` verify block, following D-28's eleven waves. The plan check verifies them (Dimension 8).
- **Markers:** "❌ W0" marks a test file that the owning plan's first RED task creates. "Phase N" marks a file an earlier phase's plans create.
- **Status:** every status starts as ⬜ pending.
- **Written ahead:** Phase 22 executes last. Rows that rely on earlier phases' files depend on those plans creating them:
  - `risk-scale.unit.test.ts` and `ai-data-policy.unit.test.ts` (12-02);
  - the matrix's callers (17, 17.1);
  - Phase 19's export tests;
  - Phase 21's stage-history oracle.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **Web:** Vitest (jsdom) with Testing Library.<br>**Strapi:** `node:test`, compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, one SQLite database per file.<br>**E2E:** Playwright with @axe-core/playwright, Chromium, on the production build. |
| **Config file** | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` (`desktop` 1440×900, `mobile` 375×812, `workers: 1`) |
| **Node** | Prefix commands with POST-DEMO-BRIEF §4's Node 24 preamble |
| **Quick run command** | **Web:** `pnpm --dir apps/csrm exec vitest run <path> [<path> …]`.<br>**Strapi file** (dev servers stopped): `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js)`.<br>**E2E:** `pnpm --dir apps/csrm test:e2e e2e/<spec>.spec.ts [--project desktop\|mobile]` |
| **Contract commands** | `pnpm --dir apps/csrm api:generate`, then `pnpm --dir apps/csrm api:check`. After a route, grant or web-caller change: `SERVED_OPERATIONS_WRITE=1 pnpm --dir apps/backend served-operations:write` (dev servers stopped) |
| **Full suite command** | `pnpm --dir apps/csrm api:check`; `pnpm --dir apps/csrm typecheck`; `pnpm --dir apps/csrm lint`; `pnpm --dir apps/csrm test`; `pnpm --dir apps/backend test` |
| **Phase gate** | The full suite, then `pnpm --dir apps/csrm test:e2e` (both projects). After it, all of these hold:<br>- `git status --short` shows only the brief's three operator items;<br>- the content-type freeze check lists exactly the approved schema files (the four new types, `csrm-risk-type`, `csrm-information-asset`, and Phase 17's round schema);<br>- `cmp` of the two catalogue copies is silent;<br>- the Keycloak diff touches only `development-fixture-subjects.ts`, `idambox-realm.json` and `idp/README.md`, and `keycloak-identity.unit.test.js` passes;<br>- no dependency change in `package.json` or `pnpm-lock.yaml`. |
| **Estimated runtime** | A web file takes under 20 s; a Strapi file 10–90 s; the matrix 2–4 min. The full web suite about 20 s, the full Strapi suite about 15–20 min, Playwright about 20–25 min. |

**Known infrastructure facts.**
1. Everything that compiles Strapi shares `apps/backend/dist` and `.tmp/tests-dist`, so Strapi proofs wait until the orchestrator's dev servers are stopped.
2. No live AI: suites pin `CSRM_AI_PROVIDER=deterministic` and an empty `CSRM_AI_DATA_CLASSIFICATION_CEILING`, and start with no setting row (D-16).
3. Keycloak stays off. The Admin's fixture subject and realm user change together, and the realm user carries no realm role or group (`verify-keycloak-idp.mjs`'s rule).
4. Specs that change a setting restore it in their own teardown, because Playwright shares one Strapi database.
5. Every harness identity now writes `role-assignment` change rows, so change-log assertions filter by subject.
6. On Windows, Vitest can fail with `EPERM: rename`. Rerun that file alone before treating it as a real failure.

---

## Sampling Rate

- **After every task commit:** run the touched web test files and Strapi files by path; run `typecheck` when types change, and `api:check` after a specification change.
- **After every plan wave:** run the full web suite and the full Strapi suite.
- **Before `/gsd-verify-work`:** the full suite and Playwright must be green, and the tree clean.
- **Max feedback latency:** 90 seconds per touched file (the matrix: 240 seconds).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-W1 | records + pure modules | 1 | ADMIN-07, ADMIN-08 | — | Setting parsers, appetite monotonicity, list rules and the role-change diff are pure and closed | unit | `node --test .tmp/tests-dist/tests/configuration-settings.unit.test.js .tmp/tests-dist/tests/role-change-diff.unit.test.js` | ❌ W0 | ⬜ pending |
| 22-W2 | schema | 2 | ADMIN-07 | T-22-tamper-panel | The four new types are hidden; no `explorer.create`, `update` or `delete` subject exists for them | integration | `configuration-change-log.integration.test.js` (registry assertion) | ❌ W0 | ⬜ pending |
| 22-W3 | role, re-grant, policy, `admin` caller | 3 | ADMIN-07 SC1, SC4 | T-22-eop | Analysts read but cannot write; the Admin is 403 on analyst routes | integration + matrix | `authorization-matrix.integration.test.js`; `administration-admin-role.integration.test.js` | ✅ / ❌ W0 | ⬜ pending |
| 22-W4 | store, change log, round snapshot | 4 | ADMIN-07 SC2, criterion 4 | T-22-tamper-round | Version, reason and the transaction; the swap after commit; a mid-round change leaves the round on its snapshot | integration | `configuration-store.integration.test.js`; `round-criteria.integration.test.js` | ❌ W0 | ⬜ pending |
| 22-W5 | reference writes, seeds, asset owner, retirement | 5 | ADMIN-07 SC1 | — | Change rows per record; create-only seeds; `RISK_TYPE_RETIRED` | integration | `administration-admin-role.integration.test.js` | ❌ W0 | ⬜ pending |
| 22-W6 | lists, request rule | 6 | ADMIN-07 SC2 | — | `DIVISION_NOT_ON_LIST`, `BUSINESS_UNIT_NOT_ON_LIST`, `LIST_LABEL_IN_USE`; the cascade (amendment 1) | integration | `configuration-lists.integration.test.js` | ❌ W0 | ⬜ pending |
| 22-W7 | role holders, middleware, log reads | 7 | ADMIN-08 SC3 | T-22-repudiation | User and role sides, no-op, deletes, rollback, operator and `system` origins | integration | `role-change-recording.integration.test.js`; `role-holders.integration.test.js` | ❌ W0 | ⬜ pending |
| 22-W8 | shared views, manual start | 8 | G-20 | T-22-eop-ai | Assignee only; available only when refused, failed or interrupted; no run written | integration | `manual-start.integration.test.js` | ❌ W0 | ⬜ pending |
| 22-W9 | agent withdrawal | 9 | D-09 | T-22-eop | The agent is refused on every route its grants reached | matrix | `authorization-matrix.integration.test.js` | ✅ | ⬜ pending |
| 22-W10 | web | 10 | ADMIN-07 SC4, ADMIN-08 | — | Permission states, read-only reference pages, confirmations, Undo and rollback, capability anchors | unit | `pnpm --dir apps/csrm exec vitest run src/features/configuration src/features/access-review src/lib/capabilities` | ❌ W0 | ⬜ pending |
| 22-W11 | fixtures, phase spec, gate | 11 | SC1–SC4, G-20, D-26 | — | Fixture ids match the realm; the spec at 1440 and 375 with axe; a clean tree | unit + e2e | `keycloak-identity.unit.test.js`; `pnpm --dir apps/csrm test:e2e e2e/admin-configuration.spec.ts` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/tests/configuration-settings.unit.test.ts`: the setting parsers, defaults and constraints
- [ ] `apps/backend/tests/role-change-diff.unit.test.ts`: the role and status diff
- [ ] `apps/backend/tests/configuration-store.integration.test.ts`: writes, versions, reasons, the swap after commit and forward application
- [ ] `apps/backend/tests/round-criteria.integration.test.ts`: the snapshot and its readers
- [ ] `apps/backend/tests/configuration-lists.integration.test.ts`
- [ ] `apps/backend/tests/ai-data-policy-setting.integration.test.ts`
- [ ] `apps/backend/tests/configuration-change-log.integration.test.ts`: including the panel registry assertion
- [ ] `apps/backend/tests/role-holders.integration.test.ts`
- [ ] `apps/backend/tests/role-change-recording.integration.test.ts`: `strapi.requestContext.run` for the admin origin
- [ ] `apps/backend/tests/manual-start.integration.test.ts`
- [ ] `apps/backend/tests/administration-admin-role.integration.test.ts`
- [ ] `apps/csrm/e2e/admin-configuration.spec.ts`: the phase spec (the planner names it)
- [ ] Vitest files beside each new web module

No framework install is needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A role change made in the real Strapi admin panel shows its operator in the change log | ADMIN-08 | The admin HTTP login path is not exercised by any suite. The middleware's origin is proven through `strapi.requestContext.run` and the strategy source | After the orchestrator's next Strapi start: sign in to the admin panel, add the Admin role to a test user, then open Change log as the Admin persona and see `Identity platform · {operator}` |
| Hidden types are absent from the panel's sidebar | ADMIN-07 criterion 4 | Visual check of the admin UI. The permission registry is asserted automatically | Open the Content Manager and confirm the setting, change, division and business unit types are not listed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s per file (matrix 240s)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
