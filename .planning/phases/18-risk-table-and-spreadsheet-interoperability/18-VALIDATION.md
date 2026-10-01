---
phase: "18"
slug: "risk-table-and-spreadsheet-interoperability"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-01"
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source.** Seeded on 2026-10-01 from `18-RESEARCH.md` "Validation Architecture" and `18-CONTEXT.md` D-29. The planner replaces the per-task map with one row per task (`18-NN-MM`) from each task's `<automated>` block, citing its plan's threat register (`T-18-NN`). The infrastructure facts of `19-VALIDATION.md` apply unchanged: shared `dist`, Node 24, Windows `EPERM` reruns, no Excel in automation, and the base changing first.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **Web:** Vitest 4.1.11 (jsdom) with Testing Library.<br>**Strapi:** `node:test` compiled by `tsc -p tests/tsconfig.json` into `.tmp/tests-dist`, with one SQLite database per file (`apps/backend/tests/helpers/strapi-http-harness.ts`).<br>**E2E:** Playwright 1.58.2, Chromium 145, production build; `desktop` 1440×900 and `mobile` 375×812, which lists its specs. |
| **Config file** | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` |
| **Node preamble** | `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && pnpm() { /c/ProgramData/nvm/v24.19.0/node /c/ProgramData/nvm/v24.19.0/node_modules/corepack/dist/pnpm.js "$@"; } &&` (POST-DEMO-BRIEF §4) |
| **Quick run command** | **Web:** `pnpm --dir apps/csrm exec vitest run <paths>`.<br>**Strapi file** (dev servers stopped): `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js)`.<br>**E2E** (dev servers stopped): `pnpm --dir apps/csrm test:e2e e2e/<spec>.spec.ts` |
| **Full suite command** | `pnpm --dir apps/csrm api:check`; `pnpm --dir apps/csrm typecheck`; `pnpm --dir apps/csrm lint`; `pnpm --dir apps/csrm test`; `pnpm --dir apps/backend test`; `pnpm --dir apps/csrm test:e2e`; then `git status --short` (only the brief's three operator items) |
| **Estimated runtime** | Web file < 20 s; Strapi unit 10–30 s; Strapi integration 30–120 s; the lag spec about 3–6 min (three samples each at 150 and 1,000 risks); full Strapi about 15–20 min; full Playwright about 20–30 min |

---

## Sampling Rate

- **After every task commit:** the task's own Vitest or Strapi files by path; `typecheck` when types change; `api:check` and `cmp` of the catalogue copies after any spec or catalogue change.
- **After every plan wave:** the full Strapi suite after a Strapi plan; the full web suite after a web plan; the plan's Playwright specs.
- **Before `/gsd-verify-work`:** the full suite and Playwright green, then a clean `git status --short`.
- **Max feedback latency:** 120 seconds for a task's quick run.

---

## Per-Task Verification Map

Seed rows by requirement. The planner rewrites these per task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-W1 | records and pure modules | 1 | ASSESS-15, 18 | — | The view-definition parser drops unknown keys; derivation over 25 cells; the scale reading | unit | Strapi `risk-scale-derivation.unit.test.js`, `risk-table-view.unit.test.js`; web `vitest run src/features/risk-table/risk-table-view.test.ts` | ❌ W0 | ⬜ pending |
| 18-W2 | spike | 2 | ASSESS-15, 17 | — | axe clean; APG walk; route ≤ 300,000 bytes; lag thresholds at 150 and 1,000 | e2e | `test:e2e e2e/risk-table-performance.spec.ts e2e/performance.spec.ts` | ❌ W0 | ⬜ pending |
| 18-W4 | bulk core | 4 | ASSESS-16, 18 | T-18 bounds, CAS | All or nothing; per-cell conflicts; row, create and 413 bounds; history `table` and `batchId`; sequential risk-number retry; round lock; void at resubmission; every refusal in `<authorisation>` | integration | Strapi `risk-changes.integration.test.js`, `authorization-matrix` rows | ❌ W0 | ⬜ pending |
| 18-W5 | import and export | 5 | ASSESS-19 | T-18 import drift | Preview bound to the actor; drift refusal; the export's scope, columns and neutraliser | integration | Strapi `risk-import.integration.test.js`, `risk-table-export.integration.test.js` | ❌ W0 | ⬜ pending |
| 18-W6 | saved views | 6 | ASSESS-15 | T-18 view ownership | 404 for another analyst's personal view; 403 `NOT_VIEW_OWNER` | integration | Strapi `saved-views.integration.test.js` | ❌ W0 | ⬜ pending |
| 18-W7 | UI | 7 | ASSESS-15, 16, 17 | T-18 paste HTML | Keymap; ranges; change set and undo; clipboard strings (TSV; HTML with `x:num` and `\@`); paste preview; inert pasted HTML; refusal states | unit | `vitest run src/features/risk-table/` | ❌ W0 | ⬜ pending |
| 18-W8 | E2E and gate | 8 | ASSESS-15 to 19 | — | SC1 to SC5 at 1440 and 375; the unrelated Requestor refused | e2e | `test:e2e e2e/risk-table.spec.ts e2e/risk-table-performance.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/csrm/e2e/risk-table-performance.spec.ts`: Event Timing and Long Animation Frame observers, the `performance.eventCounts` guard, three-sample medians and a JSON record (18-RESEARCH Answer 2); desktop only.
- [ ] A fixture builder for 150 and 1,000 risks through the phase's bulk operation (never a shared seed).
- [ ] A Playwright clipboard helper: a `paste` event with a constructed `DataTransfer` (Excel-shaped `text/plain` and `text/html`); the copy read through `clipboard-read` and `clipboard-write` permissions.
- [ ] A Strapi risk-number collision fixture through `createWithRiskNumber`'s `generate` parameter.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Screen-reader pass of the grid | ASSESS-17 | D-04: assistive technology cannot be automated here | The pilot walks the APG keys with NVDA (or Narrator) in both modes, at the spike checkpoint |
| Paste from and copy to desktop Excel and SharePoint | ASSESS-17 | No Excel in automation (19-VALIDATION fact 5) | Paste a 3 × 4 range from Excel and from a SharePoint list; copy ten rows into Excel; confirm `30/11/2026` arrives as a date (right-aligned, the format applies) and that text stays text |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
