---
phase: "22"
slug: "admin-role-and-configurable-lists"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-10-01"
updated: "2026-10-02"
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source and scope.** Seeded on 2026-10-01 from `22-RESEARCH.md`'s "Validation Architecture" and rebuilt on 2026-10-02 from the 25 plans' tasks. It maps the following to automated proofs:
- ADMIN-07 and ADMIN-08;
- the four ROADMAP success criteria (SC1 to SC4);
- the carried items: G-20's manual start (22-14, 22-15, 22-24), the Information Asset owner (22-08, 22-22) and the records retention rule (22-06, 22-23);
- D-09, the agent's grants withdrawn (22-16);
- D-26, the Admin fixture (22-04's harness identity, 22-17's persona);
- every negative case in `22-CONTEXT.md` `<authorisation>`.

**How the map is read.**
- **Per-task map:** one row per task, taken from each task's `<automated>` verify block. Every command starts with POST-DEMO-BRIEF §4's Node 24 preamble, omitted below; `node --test …/x.js` stands for `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/x.js …)`.
- **Markers:** "❌ W0" marks a test file the row's own RED step creates; "✅" a file tracked today; "Phase N" a file an earlier phase's plans create (written ahead: Phase 22 executes last).
- **Status:** every status starts as ⬜ pending.
- **Gate plan:** 22-25 runs the full gate. Strapi files run with the dev servers stopped; Playwright rows run serially (one plan per wave after wave 1).

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
| **Phase gate** (22-25) | The full suite, then `pnpm --dir apps/csrm test:e2e` (both projects, `risk-owner-journey.spec.ts` green under the defaults). After it, all of these hold:<br>- `git status --short` shows only the brief's three operator items;<br>- the content-type freeze since PHASE_22_BASE lists exactly the seven approved schema files (the four new types, `csrm-risk-type`, `csrm-information-asset`, Phase 17's round schema);<br>- `cmp` of the two catalogue copies is silent;<br>- the Keycloak diff touches only `development-fixture-subjects.ts`, `idambox-realm.json` and `idp/README.md`, and `keycloak-identity.unit.test.js` passes;<br>- no dependency change in `package.json` or `pnpm-lock.yaml`;<br>- the four records carry `Approved by the pilot on`; `COVERAGE.md` declares no external API. |
| **Estimated runtime** | A web file takes under 20 s; a Strapi file 10–90 s; the matrix 2–4 min. The full web suite about 20 s, the full Strapi suite about 15–20 min, Playwright about 20–25 min. |

**Known infrastructure facts.**
1. Everything that compiles Strapi shares `apps/backend/dist` and `.tmp/tests-dist`, so Strapi proofs wait until the orchestrator's dev servers are stopped.
2. No live AI: suites pin `CSRM_AI_PROVIDER=deterministic` and an empty `CSRM_AI_DATA_CLASSIFICATION_CEILING`, and start with no setting row (D-16). Tests set values through the Admin's operation and restore them.
3. Keycloak stays off. The Admin's fixture subject and realm user change together (22-17), and the realm user carries no realm role or group (`verify-keycloak-idp.mjs`).
4. Specs that change a setting restore it in their own teardown (`restoreSettings`, 22-25), because Playwright shares one Strapi database.
5. Every harness identity and seed write now produces `role-assignment` change rows (22-11), so change-log assertions filter by subject or count the rows a write adds.
6. 22-10's list tests use `Fixture `-prefixed labels so 22-11's development list seed never collides.
7. On Windows, Vitest can fail with `EPERM: rename`. Rerun that file alone before treating it as a real failure.

---

## Sampling Rate

- **After every task commit:** the row's command below (touched web files and Strapi files by path; `typecheck` when types change; `api:check` after a specification change).
- **After every plan wave:** the plan's last task runs the full Strapi suite (backend plans) or the full web suite (web plans).
- **Before `/gsd-verify-work`:** 22-25's full gate, Playwright included, and a clean tree.
- **Max feedback latency:** 90 seconds per touched file (the matrix: 240 seconds). No three consecutive tasks lack an automated command (22-01 Task 3 is the only checkpoint).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-T1 | 01 | 1 | ADMIN-07, ADMIN-08 | — | X-74 to X-80, two glossary entries and the brief note recorded before use | doc check | `grep -qF` of the seven direction labels, the glossary entries and the brief note | ✅ (docs) | ⬜ pending |
| 22-01-T2 | 01 | 1 | ADMIN-07, ADMIN-08 | T-22-01 | Four records, eleven amendments and residual rows, awaiting approval | doc check | `grep -q` of each record's awaiting line, names and each amendment heading | Phase 12–21 (amended records) | ⬜ pending |
| 22-01-T3 | 01 | 1 | ADMIN-07, ADMIN-08 | T-22-01, T-22-02 | The pilot approves before any schema or contract change (G-6) | checkpoint (blocking human) | — (`checkpoint:decision`) | — | ⬜ pending |
| 22-01-T4 | 01 | 1 | ADMIN-07, ADMIN-08 | T-22-02 | Dated approvals in every record and amendment | doc check | `grep -Eq "Approved by the pilot on …"` over the 14 files; no awaiting line | ✅ (docs) | ⬜ pending |
| 22-02-T1 | 02 | 1 | ADMIN-07 | T-22-03 | Closed setting parsers, defaults, monotonic appetite, round criteria | unit | `node --test …/configuration-settings.unit.test.js` | ❌ W0 | ⬜ pending |
| 22-02-T2 | 02 | 1 | ADMIN-07 | T-22-03 | List label rules, the request field rule, the cascade | unit | `node --test …/configuration-lists.unit.test.js` | ❌ W0 | ⬜ pending |
| 22-02-T3 | 02 | 1 | ADMIN-08 | T-22-04 | Role-change diff, review notes, bounded change rows | unit | `node --test …/configuration-settings.unit.test.js …/configuration-lists.unit.test.js …/role-change-diff.unit.test.js` | ❌ W0 | ⬜ pending |
| 22-03-T1 | 03 | 2 | ADMIN-07 | T-22-05, T-22-06 | Approved tables on a fresh boot; the four new types unwritable from the panel | integration | `node --test …/configuration-schema.integration.test.js …/assessment-seed.integration.test.js`; no migration file | ❌ W0 | ⬜ pending |
| 22-03-T2 | 03 | 2 | ADMIN-07 | — | Ten reasons equal across Strapi, the specification and the web | unit + contract | `api:check`; `vitest run src/lib/api/conflict-reasons.test.ts`; `node --test …/conflict-reasons.unit.test.js` | Phase 10/19 | ⬜ pending |
| 22-04-T1 | 04 | 3 | ADMIN-07 | T-22-07 | The Admin edits a control; Bob 403 with persistence unchanged | integration | `cmp` catalogues; `node --test …/administration-admin-role.integration.test.js` | ❌ W0 | ⬜ pending |
| 22-04-T2 | 04 | 3 | ADMIN-07 | T-22-07, T-22-08, T-22-09 | Read scope for analysts and the Admin; writes Admin-only; the Admin never assignee or peer approver; `/v1/me/access` never wider | integration + unit | `node --test …/administration-admin-role… …/administration… …/contract-catalogue… …/authorization-policy.unit… …/served-operations…` | ✅ / ❌ W0 | ⬜ pending |
| 22-04-T3 | 04 | 3 | ADMIN-07 | T-22-08 | The `admin` caller stated and proven on every matrix row | matrix | `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 22-05-T1 | 05 | 4 | ADMIN-07 | T-22-10, T-22-11 | A reasoned setting change with its change row; Bob 403 | integration | `cmp`; `api:check`; `node --test …/configuration-store.integration.test.js` | ❌ W0 | ⬜ pending |
| 22-05-T2 | 05 | 4 | ADMIN-07 | T-22-11, T-22-12, T-22-13 | Stale, invalid and reasonless writes refused; the swap after commit; no route writes the log | integration | `node --test …/configuration-store.integration.test.js` | ❌ W0 | ⬜ pending |
| 22-05-T3 | 05 | 4 | ADMIN-07 | T-22-10 | Every caller at the configuration operations | matrix | `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 22-06-T1 | 06 | 5 | ADMIN-07 | T-22-15 | Getters read the store or the default; the narrowed Accept rule | unit + integration | `node --test …/configuration-points.unit… …/risk-scale.unit… …/configuration-store.integration…` | ❌ W0 / Phase 12 | ⬜ pending |
| 22-06-T2 | 06 | 5 | ADMIN-07 | T-22-14 | The Admin's ceiling over the bootstrap; a queued job refused | integration | `node --test …/ai-data-policy-setting.integration.test.js …/ai-data-policy.unit.test.js` | ❌ W0 / Phase 12 | ⬜ pending |
| 22-06-T3 | 06 | 5 | ADMIN-07 | T-22-16 | Descriptions in the system prompt only; retention served | integration + unit | `api:check`; `vitest run src/features/attachments`; `pnpm --dir apps/backend test` | Phase 14 | ⬜ pending |
| 22-07-T1 | 07 | 6 | ADMIN-07 | T-22-17, T-22-18 | The round keeps its snapshot; the next submission takes the change | integration | `node --test …/round-criteria.integration… …/risk-decisions.integration… …/acceptance-rounds.integration…` | ❌ W0 / Phase 17.1 | ⬜ pending |
| 22-07-T2 | 07 | 6 | ADMIN-07 | T-22-17 | Every in-round reader on the snapshot; the static guard | integration + unit | `node --test …/round-criteria.integration… …/round-criteria-guard.unit… …/release-and-close.integration…` | ❌ W0 / Phase 17.1 | ⬜ pending |
| 22-07-T3 | 07 | 6 | ADMIN-07 | — | Readiness items with `follows`; the round's criteria flag | unit + integration | `api:check`; `vitest run src/features/assessments`; `pnpm --dir apps/backend test` | Phase 17.1 | ⬜ pending |
| 22-08-T1 | 08 | 7 | ADMIN-07 | T-22-19, T-22-21 | The asset owner with its change row; ineligible owners refused | integration + unit | `api:check`; `vitest run src/features/administration`; `node --test …/administration-admin-role.integration.test.js` | ❌ W0 (22-04) | ⬜ pending |
| 22-08-T2 | 08 | 7 | ADMIN-07 | T-22-19 | Change rows for every reference write and import batch; the Active column | integration + unit | `vitest run src/features/exports`; `node --test …/administration-admin-role… …/administration.integration…` | ✅ / Phase 19 | ⬜ pending |
| 22-08-T3 | 08 | 7 | ADMIN-07 | T-22-20 | Create-only seeds keep the Admin's edits | integration | `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 22-09-T1 | 09 | 8 | ADMIN-07 | T-22-23 | Retire and reinstate Admin-only; the risk write refusal | integration | `cmp`; `api:check`; `node --test …/risk-type-retirement.integration.test.js` | ❌ W0 | ⬜ pending |
| 22-09-T2 | 09 | 8 | ADMIN-07 | T-22-22 | Status filter, picker, bulk, import and AI library exclude retired types | integration | `node --test …/risk-type-retirement… …/assessment-context.integration…` | ❌ W0 / Phase 12 | ⬜ pending |
| 22-09-T3 | 09 | 8 | ADMIN-07 | T-22-23 | Every caller at retire and reinstate | matrix | `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 22-10-T1 | 10 | 9 | ADMIN-07 | T-22-24 | Listed values only on new request values | integration | `cmp`; `api:check`; `node --test …/configuration-lists.integration.test.js` | ❌ W0 | ⬜ pending |
| 22-10-T2 | 10 | 9 | ADMIN-07 | T-22-25 | Rename only while unused; the cascade; recorded values never rewritten | integration | `node --test …/configuration-lists.integration… …/request-workflow.integration…` | ❌ W0 / ✅ | ⬜ pending |
| 22-10-T3 | 10 | 9 | ADMIN-07 | T-22-26 | Suggestions analysts-only; every caller at the list operations | matrix | `cmp`; `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 22-11-T1 | 11 | 10 | ADMIN-08 | T-22-27 | A panel role grant recorded with its operator | integration | `node --test …/role-change-recording.integration.test.js` | ❌ W0 | ⬜ pending |
| 22-11-T2 | 11 | 10 | ADMIN-08 | T-22-27, T-22-28, T-22-29 | No-op, deletes, rollback, origins, the static check, the list fixture | integration | `pnpm --dir apps/backend test` | ❌ W0 / ✅ | ⬜ pending |
| 22-12-T1 | 12 | 11 | ADMIN-08 | T-22-30 | Role holders for the Admin only, with notes and held-since | integration | `cmp`; `api:check`; `node --test …/role-holders.integration.test.js` | ❌ W0 | ⬜ pending |
| 22-12-T2 | 12 | 11 | ADMIN-07, ADMIN-08 | T-22-30, T-22-32 | The change log read with filters and origins, Admin only | integration | `cmp`; `api:check`; `node --test …/configuration-change-log.integration.test.js` | ❌ W0 | ⬜ pending |
| 22-12-T3 | 12 | 11 | ADMIN-07, ADMIN-08 | T-22-30, T-22-31 | Logged exports; every caller at the four operations | integration + matrix | `vitest run src/features/exports`; `pnpm --dir apps/backend test` | ✅ / Phase 19 | ⬜ pending |
| 22-13-T1 | 13 | 12 | ADMIN-07 | T-22-33 | Transfer to an active analyst only | integration | `cmp`; `api:check`; `node --test …/shared-view-governance.integration.test.js` | ❌ W0 | ⬜ pending |
| 22-13-T2 | 13 | 12 | ADMIN-07 | T-22-34, T-22-35 | Rename, unshare, exact Undo, stale refusals, definitions untouched | integration | `node --test …/shared-view-governance… …/saved-views.integration…` | ❌ W0 / Phase 18 | ⬜ pending |
| 22-13-T3 | 13 | 12 | ADMIN-07 | T-22-33 | Every caller at the governance operations | matrix | `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 22-14-T1 | 14 | 13 | ADMIN-07 | T-22-36, T-22-37 | The assignee starts a refused questionnaire; no AI facts written | integration + unit | `cmp`; `api:check`; `node --test …/manual-start.integration… …/questionnaire-governance.unit…` | ❌ W0 / ✅ | ⬜ pending |
| 22-14-T2 | 14 | 13 | ADMIN-07 | T-22-37, T-22-38 | The draft start; every availability condition including `CONTEXT_TOO_LARGE` | integration + unit | `api:check`; `node --test …/manual-start.integration… …/ai-provenance.unit…` | ❌ W0 / Phase 12 | ⬜ pending |
| 22-14-T3 | 14 | 13 | ADMIN-07 | T-22-36 | Assignee-only refusal order, deep-equal persistence, every caller | integration + matrix | `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 22-15-T1 | 15 | 14 | ADMIN-07 | T-22-40 | The served manual start state per viewer | integration + unit | `api:check`; `vitest run src/features/assessments/assessment-service.test.ts`; `node --test …/manual-start.integration.test.js` | ❌ W0 (22-14) / ✅ | ⬜ pending |
| 22-15-T2 | 15 | 14 | ADMIN-07 | T-22-39 | The manual origin for analysts; nothing for Requestors | integration + unit | `api:check`; `vitest run src/features/questionnaires src/features/assessments`; `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 22-16-T1 | 16 | 15 | ADMIN-08 | T-22-41, T-22-42 | The agent holds no explicit grant; keeps the birthright | integration | `cmp`; `node -e` no-agent-grant check; `node --test …/agent-role-withdrawal… …/contract-catalogue…` | ❌ W0 / ✅ | ⬜ pending |
| 22-16-T2 | 16 | 15 | ADMIN-08 | T-22-41 | `serviceAgent` 403 wherever its grants reached | matrix | `grep -c analystAndAgent` = 0; `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 22-17-T1 | 17 | 16 | ADMIN-07, ADMIN-08 | T-22-43, T-22-44 | The Admin persona with its fixed subject; realm user without realm roles | integration + unit | `node scripts/verify-keycloak-idp.mjs`; `node --test …/admin-persona-seed… …/keycloak-identity.unit… …/keycloak-identity.integration…` | ❌ W0 / ✅ | ⬜ pending |
| 22-17-T2 | 17 | 16 | ADMIN-07 | T-22-43 | "Continue as Admin"; no fixture email in production | unit + e2e | `typecheck`; `vitest run src/lib/auth src/components/shell`; `test:e2e e2e/production-hardening.spec.ts` | ✅ | ⬜ pending |
| 22-18-T1 | 18 | 17 | ADMIN-07 | T-22-45, T-22-46 | Read-only reference pages; the change permission state | unit | `typecheck`; `lint`; `vitest run src/lib/capabilities src/features/administration src/lib/testing/e2e-ui-state-route-authorization.test.tsx` | ✅ | ⬜ pending |
| 22-18-T2 | 18 | 17 | ADMIN-07 | — | The Admin's navigation profile | unit | `typecheck`; `vitest run src/config/navigation src/components/shell` | Phase 11 | ⬜ pending |
| 22-18-T3 | 18 | 17 | ADMIN-07 | T-22-45 | The Admin manages, Bob reads, at 1440 and 375 with axe | e2e | `test:e2e e2e/administration-workflow.spec.ts` | ✅ | ⬜ pending |
| 22-19-T1 | 19 | 18 | ADMIN-07, ADMIN-08 | T-22-47, T-22-48 | The change log screen; the access review permission state | unit | `typecheck`; `lint`; `vitest run src/features/access-review src/features/contract-response-parity.test.ts` | ❌ W0 | ⬜ pending |
| 22-19-T2 | 19 | 18 | ADMIN-08 | T-22-47 | Role holders with notes; both exports; no assignment control | unit | `typecheck`; `vitest run src/features/access-review src/features/exports src/features/contract-response-parity.test.ts` | ❌ W0 / Phase 19 | ⬜ pending |
| 22-19-T3 | 19 | 18 | ADMIN-07, ADMIN-08 | — | Record history; the Admin's Home section | unit | `typecheck`; `lint`; `pnpm --dir apps/csrm test` | ❌ W0 / Phase 11 | ⬜ pending |
| 22-20-T1 | 20 | 19 | ADMIN-07 | T-22-49, T-22-50, T-22-51 | A reviewed, reasoned setting change in the app | unit | `typecheck`; `lint`; `vitest run src/features/configuration src/features/contract-response-parity.test.ts` | ❌ W0 | ⬜ pending |
| 22-20-T2 | 20 | 19 | ADMIN-07 | T-22-49 | Conflicts and invalid values keep input; policy pages' sources | unit | `typecheck`; `vitest run src/features/configuration src/lib/api` | ❌ W0 / Phase 10 | ⬜ pending |
| 22-20-T3 | 20 | 19 | ADMIN-07 | — | The scale editor and band preview on the shared rating function | unit | `typecheck`; `vitest run src/features/configuration src/features/risk-table/risk-scale-parity.test.ts` | ❌ W0 / Phase 18 | ⬜ pending |
| 22-20-T4 | 20 | 19 | ADMIN-07 | — | The appetite editor's rules and phone cards | unit | `typecheck`; `lint`; `pnpm --dir apps/csrm test` | ❌ W0 | ⬜ pending |
| 22-21-T1 | 21 | 20 | ADMIN-07 | T-22-52, T-22-53 | The list editor; the request form's selects | unit | `typecheck`; `lint`; `vitest run src/features/lists src/features/requests src/features/contract-response-parity.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| 22-21-T2 | 21 | 20 | ADMIN-07 | T-22-52 | Moves, renames, retirement with rollback, Undo and AA2 | unit | `typecheck`; `vitest run src/features/lists src/lib/api` | ❌ W0 | ⬜ pending |
| 22-21-T3 | 21 | 20 | ADMIN-07 | T-22-52 | Jane chooses listed values at 1440 and 375 with axe | e2e | `pnpm --dir apps/csrm test`; `test:e2e e2e/requestor-request-workflow.spec.ts` | ✅ | ⬜ pending |
| 22-22-T1 | 22 | 21 | ADMIN-07 | T-22-54, T-22-55 | Retire in the app; retired types marked, not offered | unit | `typecheck`; `lint`; `vitest run src/features/administration src/features/assessments src/features/risk-table src/features/contract-response-parity.test.ts` | ✅ / Phase 18 | ⬜ pending |
| 22-22-T2 | 22 | 21 | ADMIN-07 | T-22-54 | The asset owner; History and plain usage for the Admin | unit | `typecheck`; `vitest run src/features/administration src/components/csrm/usage-panel.test.tsx` | ✅ / Phase 20 | ⬜ pending |
| 22-22-T3 | 22 | 21 | ADMIN-07 | — | List-backed analyst filters with retired and off-list values | unit | `typecheck`; `lint`; `pnpm --dir apps/csrm test` | ❌ W0 | ⬜ pending |
| 22-23-T1 | 23 | 22 | ADMIN-07 | T-22-56, T-22-57 | Shared view transfer with Undo; no register link | unit | `typecheck`; `lint`; `vitest run src/features/shared-views src/features/contract-response-parity.test.ts` | ❌ W0 | ⬜ pending |
| 22-23-T2 | 23 | 22 | ADMIN-07 | T-22-56 | Rename, unshare, AA3 refusals, states | unit | `typecheck`; `vitest run src/features/shared-views src/lib/api` | ❌ W0 | ⬜ pending |
| 22-23-T3 | 23 | 22 | ADMIN-07 | T-22-58 | Readiness captions and Clear; the round's criteria line; the retention line | unit | `typecheck`; `lint`; `pnpm --dir apps/csrm test` | Phase 14 / 17.1 | ⬜ pending |
| 22-24-T1 | 24 | 23 | ADMIN-07 | T-22-59 | The assignee's Start without AI from the card | unit | `typecheck`; `lint`; `vitest run src/features/generation src/features/assessments/questionnaire-generation-job.test.tsx src/features/contract-response-parity.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| 22-24-T2 | 24 | 23 | ADMIN-07 | T-22-60 | The draft start; the manual header; AA4; the amended copy | unit | `typecheck`; `vitest run src/features/generation src/features/ai-assistance src/features/risk-table src/lib/api` | ❌ W0 / Phase 12 | ⬜ pending |
| 22-24-T3 | 24 | 23 | ADMIN-07 | — | The amended refusal copy in the browser | e2e | `pnpm --dir apps/csrm test`; `test:e2e e2e/questionnaire-generation-workflow.spec.ts` | ✅ | ⬜ pending |
| 22-25-T1 | 25 | 24 | ADMIN-07, ADMIN-08 | T-22-61 | The appetite change reaches the change log; settings restored | e2e | `test:e2e e2e/admin-configuration.spec.ts` | ❌ W0 | ⬜ pending |
| 22-25-T2 | 25 | 24 | ADMIN-07, ADMIN-08 | T-22-61 | SC1 to SC4 and G-20 at 1440 and 375 with axe; the route budget | e2e | `test:e2e e2e/admin-configuration.spec.ts e2e/performance.spec.ts` | ❌ W0 / ✅ | ⬜ pending |
| 22-25-T3 | 25 | 24 | ADMIN-07, ADMIN-08 | T-22-62 | The full gate, the freeze and the static checks; a clean tree | gate | `COVERAGE.md` and approval checks; `cmp`; `api:check`; `typecheck`; `lint`; `pnpm --dir apps/csrm test`; `pnpm --dir apps/backend test`; `pnpm --dir apps/csrm test:e2e` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each new test file is created by its owning plan's first RED step:

- [ ] `apps/backend/tests/configuration-settings.unit.test.ts`, `configuration-lists.unit.test.ts`, `role-change-diff.unit.test.ts` (22-02)
- [ ] `apps/backend/tests/configuration-schema.integration.test.ts` (22-03)
- [ ] `apps/backend/tests/administration-admin-role.integration.test.ts` (22-04)
- [ ] `apps/backend/tests/configuration-store.integration.test.ts` (22-05)
- [ ] `apps/backend/tests/configuration-points.unit.test.ts`, `ai-data-policy-setting.integration.test.ts` (22-06)
- [ ] `apps/backend/tests/round-criteria.integration.test.ts`, `round-criteria-guard.unit.test.ts` (22-07)
- [ ] `apps/backend/tests/risk-type-retirement.integration.test.ts` (22-09)
- [ ] `apps/backend/tests/configuration-lists.integration.test.ts` (22-10)
- [ ] `apps/backend/tests/role-change-recording.integration.test.ts` (22-11)
- [ ] `apps/backend/tests/role-holders.integration.test.ts`, `configuration-change-log.integration.test.ts` (22-12)
- [ ] `apps/backend/tests/shared-view-governance.integration.test.ts` (22-13)
- [ ] `apps/backend/tests/manual-start.integration.test.ts` (22-14)
- [ ] `apps/backend/tests/agent-role-withdrawal.integration.test.ts` (22-16)
- [ ] `apps/backend/tests/admin-persona-seed.integration.test.ts` (22-17)
- [ ] `apps/csrm/src/features/access-review/access-review.test.tsx` (22-19), `features/configuration/configuration.test.tsx` (22-20), `features/lists/lists.test.tsx` (22-21), `features/lists/list-value-filter.test.tsx` (22-22), `features/shared-views/shared-views.test.tsx` (22-23), `features/generation/manual-start.test.tsx` (22-24)
- [ ] `apps/csrm/e2e/admin-configuration.spec.ts` (22-25)

No framework install is needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A role change made in the real Strapi admin panel shows its operator in the change log | ADMIN-08 | The admin HTTP login path is not exercised by any suite. The middleware's origin is proven through `strapi.requestContext.run` and the strategy source (22-11) | After the orchestrator's next Strapi start: sign in to the admin panel, add the Admin role to a test user, then open Change log as the Admin persona and see `Identity platform · {operator}` |
| Hidden types are absent from the panel's sidebar | ADMIN-07 criterion 4 | Visual check of the admin UI. The permission registry is asserted automatically (22-03) | Open the Content Manager and confirm the setting, change, division and business unit types are not listed |
| A business unit move announces its new position once with NVDA | ADMIN-07 | Screen-reader backstop (UI-SPEC UI Considerations) | With NVDA, press `Move up` on a business unit; one announcement, focus stays on the button |
| The appetite confirmation's forward effect is understood | ADMIN-07 | Comprehension backstop (UI-SPEC UI Considerations) | The pilot reads the confirmation and states that an open acceptance round keeps its authority |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (22-01 Task 3 is the only checkpoint)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s per file (matrix 240s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (validate-phase sets `status: validated` after execution)
