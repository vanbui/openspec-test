---
phase: "18"
slug: "risk-table-and-spreadsheet-interoperability"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-10-01"
updated: "2026-10-02"
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source.** Seeded on 2026-10-01 from `18-RESEARCH.md` "Validation Architecture" and `18-CONTEXT.md` D-29; the per-task map was rebuilt on 2026-10-02 from the 19 final plans (`18-01` to `18-19`), one row per task from its `<automated>` block, citing its plan's threat register (`T-18-NN`). The infrastructure facts of `19-VALIDATION.md` apply unchanged: shared `dist`, Node 24, Windows `EPERM` reruns, no Excel in automation, and the base changing first.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **Web:** Vitest 4.1.11 (jsdom) with Testing Library.<br>**Strapi:** `node:test` compiled by `tsc -p tests/tsconfig.json` into `.tmp/tests-dist`, with one SQLite database per file (`apps/backend/tests/helpers/strapi-http-harness.ts`).<br>**E2E:** Playwright 1.58.2, Chromium 145, production build; `desktop` 1440×900 and `mobile` 375×812, which lists its specs (`risk-table.spec.ts` added by 18-05). |
| **Config file** | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` |
| **Node preamble** | `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && pnpm() { /c/ProgramData/nvm/v24.19.0/node /c/ProgramData/nvm/v24.19.0/node_modules/corepack/dist/pnpm.js "$@"; } &&` (POST-DEMO-BRIEF §4); every command below starts with it in its plan |
| **Quick run command** | **Web:** `pnpm --dir apps/csrm exec vitest run <paths>`.<br>**Strapi file** (dev servers stopped): `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js)`.<br>**E2E** (dev servers stopped): `pnpm --dir apps/csrm test:e2e e2e/<spec>.spec.ts [--project=desktop] [-g "<describe>"]` |
| **Clean-tree check** | `GS="$(git status --short)" && test -z "$(printf '%s\n' "$GS" \| grep -v -E '^( M apps/backend/types/generated/\|\?\? example-risk-assessment-questions/)' \| grep -v '^$')"` (written "clean" below) |
| **Full suite command** | `pnpm --dir apps/csrm api:check`; `pnpm --dir apps/csrm typecheck`; `pnpm --dir apps/csrm lint`; `pnpm --dir apps/csrm test`; `pnpm --dir apps/backend test`; `pnpm --dir apps/csrm test:e2e`; then the clean-tree check (18-19 Task 3) |
| **Estimated runtime** | Web file < 20 s; Strapi unit 10–30 s; Strapi integration 30–120 s; the lag spec about 3–6 min; full Strapi about 15–20 min; full Playwright about 25–35 min |

---

## Sampling Rate

- **After every task commit:** the task's own Vitest or Strapi files by path; `typecheck` when types change; `api:check` and `cmp` of the catalogue copies after any spec or catalogue change.
- **After every plan wave:** the full Strapi suite after a Strapi plan (18-04 T3, 18-06 T3, 18-07 T3, 18-08 T3, 18-09 T3, 18-10 T3); the full web suite after a web plan; the plan's Playwright describes, and the full Playwright suite after 18-16 and 18-17.
- **Before `/gsd-verify-work`:** 18-19 Task 3's full gate and the clean-tree check.
- **Max feedback latency:** 120 seconds for a task's quick run (Playwright tasks excepted, scoped by `-g`).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | ASSESS-15 to 19 | T-18-01 | X-53 to X-61, glossary, three records and five amendments written before any code | doc grep | the 18-01 Task 1 `grep -qF` loop over the nine labels, records, amendments and awaiting lines | n/a (docs) | ⬜ pending |
| 18-01-02 | 01 | 1 | ASSESS-15 to 19 | T-18-01, T-18-02 | The pilot approves before schema (G-6) | checkpoint | manual: `checkpoint:decision` (blocking-human) | n/a | ⬜ pending |
| 18-01-03 | 01 | 1 | ASSESS-15 to 19 | T-18-02 | Dated approvals in every record | doc grep | `grep -Eq "Approved by the pilot on …"` over the three records and five amendments | n/a (docs) | ⬜ pending |
| 18-02-01 | 02 | 1 | ASSESS-18 | T-18-04 | 25-cell derivation, override rules, free-text reading | unit | Strapi `risk-scale-derivation.unit.test.js risk-scale.unit.test.js` | ❌ W0 (RED in task) | ⬜ pending |
| 18-02-02 | 02 | 1 | ASSESS-16 | T-18-05 | Compare-and-set per cell; body bounds | unit | Strapi `risk-changes-body.unit.test.js` | ❌ W0 (RED in task) | ⬜ pending |
| 18-02-03 | 02 | 1 | ASSESS-15, 19 | T-18-03, T-18-04 | Fail-safe view parser; filter-and-sort; converters; parity fixture | unit | Strapi `risk-table-view.unit.test.js risk-value-convert.unit.test.js spreadsheet-headers-values.unit.test.js` | ❌ W0 (RED in task) | ⬜ pending |
| 18-03-01 | 03 | 2 | ASSESS-17 | T-18-06, T-18-07 | One grid path: roles, roving focus, edit and mark | component | `vitest run src/features/risk-table/risk-table-keyboard.test.tsx src/components/csrm/data-table.test.tsx` | ❌ W0 (RED in task) | ⬜ pending |
| 18-03-02 | 03 | 2 | ASSESS-16, 17 | T-18-06 | APG keymap, ranges, fill, clear, undo, announcements; read-only keys | unit | `vitest run src/features/risk-table/risk-table-domain.test.ts src/features/risk-table/risk-table-keyboard.test.tsx` | ❌ W0 (RED in task) | ⬜ pending |
| 18-03-03 | 03 | 2 | ASSESS-15 | T-18-06 | Review lists' column chooser per browser | component | `vitest run src/components/csrm/data-table.test.tsx src/features/assessments/assessment-list.test.tsx src/features/questionnaires/questionnaire-review-list.test.tsx` then `typecheck`, `lint`, `test` | ✅ partly; new list test W0 | ⬜ pending |
| 18-04-01 | 04 | 2 | ASSESS-16, 18 | T-18-08, T-18-09 | Approved schema only; legacy unchanged; 413 above 1 MiB | integration | Strapi `risk-table-schema.integration.test.js` | ❌ W0 (RED in task) | ⬜ pending |
| 18-04-02 | 04 | 2 | ASSESS-16 | T-18-08 | Closed reasons on both sides; error schemas | unit and contract | `vitest run src/lib/api/conflict-reasons.test.ts`; `api:check`; Strapi `conflict-reasons.unit.test.js` | ✅ (extended) | ⬜ pending |
| 18-04-03 | 04 | 2 | ASSESS-15 | T-18-10 | `riskTableMode` equals the guard in 17.1 D-23's order | integration and parity | `api:check`; `vitest run src/features/contract-response-parity.test.ts`; `typecheck`; `pnpm --dir apps/backend test` | ✅ (extended) | ⬜ pending |
| 18-05-01 | 05 | 3 | ASSESS-15, 17 | T-18-11 | Gated Risks route; axe in both modes; APG walk; Maya not-found | e2e | `vitest run src/components/csrm/record-local-nav.test.tsx`; `typecheck`; `test:e2e e2e/risk-table.spec.ts`; clean | ❌ W0 (spec created in task) | ⬜ pending |
| 18-05-02 | 05 | 3 | ASSESS-15 | T-18-12 | Lag at 150 and 1,000 risks; route ≤ 300,000 bytes; accounting guard | e2e (perf) | `vitest run src/lib/testing/performance-metrics.test.ts`; `test:e2e e2e/risk-table-performance.spec.ts e2e/performance.spec.ts --project=desktop` | ❌ W0 (harness created in task) | ⬜ pending |
| 18-05-03 | 05 | 3 | ASSESS-15, 17 | T-18-12 | Decision 7's spike result and the screen-reader pass | checkpoint | manual: `checkpoint:decision` (blocking-human) | n/a | ⬜ pending |
| 18-05-04 | 05 | 3 | ASSESS-15 | T-18-SC | Package check before any install (conditional) | checkpoint | manual: `checkpoint:human-verify` (blocking-human), skipped on pass | n/a | ⬜ pending |
| 18-05-05 | 05 | 3 | ASSESS-15 | T-18-SC, T-18-12 | Exact pin and `aria-rowindex` if virtualised | e2e (conditional) | `grep` of the pin and `aria-rowindex`, then `test:e2e e2e/risk-table.spec.ts e2e/risk-table-performance.spec.ts --project=desktop`; prints `virtualisation not selected` otherwise | conditional | ⬜ pending |
| 18-06-01 | 06 | 4 | ASSESS-16, 18 | T-18-13, T-18-14, T-18-15 | Closed scales, derivation, override, clearing; PATCH bases conflict; create and PATCH share the rule | integration | `api:check`; Strapi `risk-scale-rules.integration.test.js risk-curation.integration.test.js` | ❌ W0 (RED in task) | ⬜ pending |
| 18-06-02 | 06 | 4 | ASSESS-18 | T-18-16 | Scale, control summary and reasons in reads; participants get reasons only | integration and parity | `api:check`; `vitest run src/features/contract-response-parity.test.ts`; `typecheck`; Strapi `risk-scale-rules.integration.test.js participant-read.integration.test.js` | ✅ (extended) | ⬜ pending |
| 18-06-03 | 06 | 4 | ASSESS-18 | T-18-14 | `Ratings follow the scale` readiness; fingerprint version voids nothing; existing flows green | integration and e2e | `pnpm --dir apps/backend test`; `test:e2e e2e/assessment-release-workflow.spec.ts e2e/ai-context-provenance.spec.ts e2e/risk-register-workflow.spec.ts`; clean | ✅ (extended) | ⬜ pending |
| 18-07-01 | 07 | 5 | ASSESS-16 | T-18-17, T-18-21 | One save, one act: history `table` with one `batchId`; review withdrawn; served and granted | integration | `cmp` catalogues; `api:check`; Strapi `risk-changes.integration.test.js contract-catalogue.integration.test.js` | ❌ W0 (RED in task) | ⬜ pending |
| 18-07-02 | 07 | 5 | ASSESS-16 | T-18-17, T-18-18, T-18-19, T-18-20, T-18-22 | Every refusal before any write: seven callers, both round locks, named actors, foreign 404, withdrawn, bounds, conflicts, invalid cells, risk numbers | integration | Strapi `risk-changes.integration.test.js authorization-matrix.integration.test.js` | ❌ W0 (RED in task) | ⬜ pending |
| 18-07-03 | 07 | 5 | ASSESS-16, 18 | T-18-21 | Control entries; no-op saves; voids only for changed risks at resubmission | integration | `pnpm --dir apps/backend test` | ✅ (extended) | ⬜ pending |
| 18-08-01 | 08 | 6 | ASSESS-19 | T-18-24 | Named-sheet read; classification; bulk body with bases | unit | `cmp` vocabulary copies; Strapi `risk-import.unit.test.js spreadsheet-reading.unit.test.js export-vocabulary.unit.test.js` | ❌ W0 (RED in task) | ⬜ pending |
| 18-08-02 | 08 | 6 | ASSESS-19 | T-18-25 | Controls table; actor-bound previews; drift; templates; error reports | unit | Strapi `risk-import.unit.test.js` | ✅ (task 1) | ⬜ pending |
| 18-08-03 | 08 | 6 | ASSESS-19 | T-18-23 | Current-view export on Phase 19's pipeline; neutraliser; cap | unit | `pnpm --dir apps/backend test` | ❌ W0 (RED in task) | ⬜ pending |
| 18-09-01 | 09 | 7 | ASSESS-19 | T-18-28 | Import over HTTP: preview, commit through the bulk core, log line | integration | `cmp`; `api:check`; Strapi `risk-import.integration.test.js contract-catalogue.integration.test.js` | ❌ W0 (RED in task) | ⬜ pending |
| 18-09-02 | 09 | 7 | ASSESS-19 | T-18-28 | Import refusals for seven callers, locks, other actor, changed file, drift, cap; round trip | integration | Strapi `risk-import.integration.test.js authorization-matrix.integration.test.js` | ✅ (task 1) | ⬜ pending |
| 18-09-03 | 09 | 7 | ASSESS-19 | T-18-26, T-18-27 | Export scope, columns, file, any stage; service identity refused | integration | `cmp`; `api:check`; `pnpm --dir apps/backend test` | ❌ W0 (RED in task) | ⬜ pending |
| 18-10-01 | 10 | 8 | ASSESS-15 | T-18-29 | Save and list a personal view; served and granted | integration | `cmp`; `api:check`; Strapi `saved-views.integration.test.js contract-catalogue.integration.test.js` | ❌ W0 (RED in task) | ⬜ pending |
| 18-10-02 | 10 | 8 | ASSESS-15 | T-18-29, T-18-30 | 404 for others' personal views; 403 `NOT_VIEW_OWNER`; Save as; bounds | integration | Strapi `saved-views.integration.test.js` | ✅ (task 1) | ⬜ pending |
| 18-10-03 | 10 | 8 | ASSESS-15 | T-18-31 | Strict writes, fail-safe reads, seven callers | integration | `pnpm --dir apps/backend test` | ✅ (task 1) | ⬜ pending |
| 18-11-01 | 11 | 9 | ASSESS-16 | T-18-33 | One request per save; Undo; parsers and chain | e2e and unit | `vitest run src/features/risk-table/risk-table-actions.test.ts src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; `test:e2e e2e/risk-table.spec.ts --project=desktop -g "saving"` | ❌ W0 (created in task) | ⬜ pending |
| 18-11-02 | 11 | 9 | ASSESS-16 | T-18-32 | Conflicts and invalid cells in place; family X; nothing lost on refusal | component | `vitest run src/features/risk-table/risk-table-saving.test.tsx src/features/risk-table/risk-table-domain.test.ts src/lib/api/refusal-copy.test.ts src/lib/api/transport/server-client.test.ts` | ❌ W0 (RED in task) | ⬜ pending |
| 18-11-03 | 11 | 9 | ASSESS-16 | T-18-34 | Undo against newer saves conflicts; review line; round refusal keeps edits | e2e and component | `typecheck`; `lint`; `test`; `test:e2e e2e/risk-table.spec.ts`; clean | ✅ (extended) | ⬜ pending |
| 18-12-01 | 12 | 10 | ASSESS-16, 17 | T-18-35 | SC1: ≤ 80 presses, one save request, `Saved 30 changes to 10 risks.` | e2e | `typecheck`; `test:e2e e2e/risk-table.spec.ts --project=desktop -g "SC1"` | ✅ (extended) | ⬜ pending |
| 18-12-02 | 12 | 10 | ASSESS-18 | — | Matrix picker; web derivation equals Strapi's over the fixture | unit and component | `vitest run src/features/risk-table/risk-scale-parity.test.ts src/features/risk-table/cell-editors.test.tsx` | ❌ W0 (RED in task) | ⬜ pending |
| 18-12-03 | 12 | 10 | ASSESS-16 | — | Record, control and long-text editors; read-only cells | component | `vitest run src/features/risk-table/cell-editors.test.tsx src/features/risk-table/risk-table-keyboard.test.tsx` | ✅ (task 2) | ⬜ pending |
| 18-12-04 | 12 | 10 | ASSESS-16 | T-18-36 | Rows, bulk withdraw and reinstate, Confirm AI values (G-1), kept changes, leave warning | e2e and unit | `typecheck`; `lint`; `test`; `test:e2e e2e/risk-table.spec.ts`; clean | ✅ (extended) | ⬜ pending |
| 18-13-01 | 13 | 11 | ASSESS-17 | T-18-38 | SC2: two clipboard flavours out; 3 × 4 paste preview in | e2e | `typecheck`; `test:e2e e2e/risk-table.spec.ts --project=desktop -g "SC2"` | ❌ W0 (helper created in task) | ⬜ pending |
| 18-13-02 | 13 | 11 | ASSESS-17 | T-18-37, T-18-38, T-18-39 | Exact TSV and HTML; inert pasted HTML; conversion parity; apply rules | unit and component | `vitest run src/features/risk-table/risk-table-clipboard.test.ts src/features/risk-table/risk-value-convert.test.ts src/lib/spreadsheets/neutralise.test.ts src/features/risk-table/paste-preview-dialog.test.tsx` | ❌ W0 (RED in task) | ⬜ pending |
| 18-13-03 | 13 | 11 | ASSESS-16, 17 | T-18-32 | SC3: invalid paste held; two analysts see a conflict | e2e | `test`; `test:e2e e2e/risk-table.spec.ts`; clean | ✅ (extended) | ⬜ pending |
| 18-14-01 | 14 | 12 | ASSESS-15 | T-18-41 | Filters, sort and search in the address; save and reopen a view | e2e | `vitest run src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; `typecheck`; `test:e2e e2e/risk-table.spec.ts --project=desktop -g "views and columns"` | ✅ (extended) | ⬜ pending |
| 18-14-02 | 14 | 12 | ASSESS-15 | T-18-40 | View parity with Strapi; owner-only actions; Undo of a deletion; resize by keys | unit and component | `vitest run src/features/risk-table/risk-table-view.test.ts src/features/risk-table/risk-table-views.test.tsx src/features/saved-views/saved-views-actions.test.ts` | ❌ W0 (RED in task) | ⬜ pending |
| 18-14-03 | 14 | 12 | ASSESS-15 | — | Withdrawn only under its filter, read-only; empty states | e2e and component | `test`; `test:e2e e2e/risk-table.spec.ts`; clean | ✅ (extended) | ⬜ pending |
| 18-15-01 | 15 | 13 | ASSESS-15, 16 | T-18-43 | The card as the detail sheet; on-open read; deep link | e2e | `typecheck`; `test:e2e e2e/risk-table.spec.ts --project=desktop -g "detail sheet"` | ✅ (extended) | ⬜ pending |
| 18-15-02 | 15 | 13 | ASSESS-16, 18 | T-18-42, T-18-43 | Matrix in the form; field conflicts; held read-only; release helper | component and e2e | `vitest run src/features/assessments/risk-editor.test.tsx src/features/risk-table/risk-detail-sheet.test.tsx`; `test:e2e e2e/assessment-release-workflow.spec.ts` | ❌ W0 (sheet test created in task) | ⬜ pending |
| 18-15-03 | 15 | 13 | ASSESS-16 | T-18-43 | Register form bases; toolbar risk actions | e2e and unit | `test`; `test:e2e e2e/risk-table.spec.ts e2e/risk-register-workflow.spec.ts`; clean | ✅ (extended) | ⬜ pending |
| 18-16-01 | 16 | 14 | ASSESS-15, 17 | T-18-44 | Release spec and the journey through Risks and the sheet, negatives kept | e2e | `test:e2e e2e/assessment-release-workflow.spec.ts e2e/risk-owner-journey.spec.ts`; clean | ✅ (earlier phases) | ⬜ pending |
| 18-16-02 | 16 | 14 | ASSESS-15 | T-18-44 | Phase 12 and 16 specs through the sheet | e2e | `test:e2e e2e/ai-context-provenance.spec.ts e2e/risk-curation.spec.ts`; clean | ✅ (earlier phases) | ⬜ pending |
| 18-16-03 | 16 | 14 | ASSESS-15 | T-18-44 | Phase 17, 17.1 and 17.2 specs through the sheet; full suite | e2e | `test:e2e`; clean | ✅ (earlier phases) | ⬜ pending |
| 18-17-01 | 17 | 15 | ASSESS-15 | — | One record, two routes, one layout; titles | e2e and unit | `vitest run src/lib/metadata/record-route-titles.test.ts`; `typecheck`; `test:e2e e2e/risk-table.spec.ts --project=desktop -g "overview and readiness"` | ✅ (extended) | ⬜ pending |
| 18-17-02 | 17 | 15 | ASSESS-15 | T-18-45 | Figures equal their filtered totals; readiness opens cells; no control reads on the Overview | component | `vitest run src/features/risk-table/risks-summary.test.tsx src/features/assessments/assessment-editor.test.tsx src/features/assessments/release-readiness-summary.test.ts` | ❌ W0 (RED in task) | ⬜ pending |
| 18-17-03 | 17 | 15 | ASSESS-15 | — | Budgets, accessibility and hardening specs for the split | e2e | `test`; `test:e2e`; clean | ✅ (extended) | ⬜ pending |
| 18-18-01 | 18 | 16 | ASSESS-17 | T-18-46, T-18-47 | Participant read-only grid copies; Maya refused in the UI and the API | e2e | `typecheck`; `test:e2e e2e/risk-table.spec.ts --project=desktop -g "read-only and participants"` | ✅ (extended) | ⬜ pending |
| 18-18-02 | 18 | 16 | ASSESS-15, 17 | T-18-47 | Banners from `riskTableMode`; read-only toolbar; skip link | component and e2e | `vitest run src/features/risk-table/risk-table-modes.test.tsx src/features/assessments/released-assessment.test.tsx`; `test:e2e e2e/risk-table.spec.ts --project=desktop -g "read-only and participants"` | ❌ W0 (RED in task) | ⬜ pending |
| 18-18-03 | 18 | 16 | ASSESS-15 | — | Phone cards, filters sheet, sheet as editor; questionnaire at 375 | component and e2e | `vitest run src/features/risk-table/risk-card-list.test.tsx`; `test`; `test:e2e e2e/risk-table.spec.ts`; clean | ❌ W0 (RED in task) | ⬜ pending |
| 18-19-01 | 19 | 17 | ASSESS-19 | T-18-49 | SC4 round trip: export the view, import it back | e2e | `vitest run src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; `typecheck`; `test:e2e e2e/risk-table.spec.ts --project=desktop -g "import and export"` | ✅ (extended) | ⬜ pending |
| 18-19-02 | 19 | 17 | ASSESS-19, 17 | T-18-48 | Import states and refusals (drift); shortcuts dialog | component and e2e | `vitest run src/features/risk-table/risk-import-flow.test.tsx src/features/risk-table/risk-table-actions.test.ts`; `test:e2e e2e/risk-table.spec.ts --project=desktop -g "import and export"` | ❌ W0 (RED in task) | ⬜ pending |
| 18-19-03 | 19 | 17 | ASSESS-15 to 19 | T-18-50 | Full gate; freeze, approvals, direction, empty migrations; clean tree | gate | `api:check`, `typecheck`, `lint`, `test`, `pnpm --dir apps/backend test`, `test:e2e`, approval and label greps, migrations empty; clean | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Gate plan:** 18-19 Task 3 runs the full suite. **Sampling continuity:** no three consecutive tasks lack an automated command (the only manual rows are 18-01-02, 18-05-03 and the conditional 18-05-04, each followed by an automated task).

---

## Wave 0 Requirements

Every Wave 0 item is owned by the task that first needs it (RED first within the task), so no separate Wave 0 plan exists:

- [ ] `apps/csrm/e2e/risk-table-performance.spec.ts`: Event Timing and Long Animation Frame observers, the `performance.eventCounts` guard, three-sample medians and a JSON record — **18-05 Task 2**.
- [ ] The 150 and 1,000-risk fixture builder (`e2e/helpers/risk-table-fixtures.ts`), never a shared seed — **18-05 Task 1** (single creates), switched to one `risk_changes` call by **18-12 Task 1**.
- [ ] The Playwright clipboard helper (`e2e/helpers/clipboard.ts`: `pasteExcelRange`, `readCopiedFlavours`) — **18-13 Task 1**.
- [ ] The Strapi risk-number collision fixture through `createRiskWithinMutation`'s `generateRiskNumber` seam — **18-06 Task 1** (seam) and **18-07 Task 2** (cases).
- [ ] The shared parity fixture `apps/backend/tests/fixtures/risk-table-parity.json` — **18-02 Tasks 1 and 3**, read by 18-12, 18-13 and 18-14's web parity tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Screen-reader pass of the grid | ASSESS-17 | D-04: assistive technology cannot be automated here | At 18-05 Task 3, the pilot walks the APG keys with NVDA (or Narrator) in both modes, plus the matrix picker and paste preview once built (18-12, 18-13) |
| Paste from and copy to desktop Excel and SharePoint | ASSESS-17 | No Excel in automation (19-VALIDATION fact 5) | After 18-13: paste a 3 × 4 range from Excel and from a SharePoint list; copy ten rows into Excel; confirm `30/11/2026` arrives as a date (right-aligned, the format applies) and that text stays text (UI Considerations backstop) |
| A 4,000-character statement in the editor and cell line | ASSESS-16 | The scroll and wrap are visual (UI Considerations backstop) | After 18-12: the editor scrolls after ten lines and the cell line wraps to three lines; a screen reader reads the full text |

The 1,000-risk compact backstop is automated by 18-05 Task 2 (p75 ≤ 200 ms, max ≤ 500 ms, no frame over 200 ms).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are checkpoints followed by an automated task
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (each owned by a named task)
- [x] No watch-mode flags
- [x] Feedback latency < 120s for unit and integration quick runs
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (plan check)
