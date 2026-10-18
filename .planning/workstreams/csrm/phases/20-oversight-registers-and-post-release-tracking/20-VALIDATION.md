---
phase: "20"
slug: "oversight-registers-and-post-release-tracking"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-10-01"
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source and scope.** Seeded on 2026-10-01 from `20-RESEARCH.md`, "Validation Architecture"; the per-task map was rebuilt by the planner for the final 23 plans (20-01 to 20-23). It maps every requirement and success criterion, with their negative cases in the API and the UI, to an automated proof:
- the requirements RISK-03, RISK-04, RISK-05, RISK-06, ADMIN-06 and NOTIFY-02;
- the seven ROADMAP success criteria;
- the locked decisions D-01 to D-30 in `20-CONTEXT.md`.

The phase closes UAT-045, UAT-046, UAT-047 and UAT-058 and answers PD-5.

**How the maps are filled.**
- **Per-task map:** one row per task, taken from each task's `<automated>` verify block (abridged here; the plan holds the full command with POST-DEMO-BRIEF §4's Node 24 preamble). The plan check verifies the rows (Dimension 8).
- **Markers:** "❌ W0" marks a test file that the owning task's RED step creates (the project convention); "◐ earlier" a file an earlier phase's plan creates before Phase 20 runs; "✅" a file tracked today.
- **Status:** every status starts as ⬜ pending.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **Web:** vitest 4.1.11 (jsdom) with @testing-library/react.<br>**Strapi:** `node:test`, compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, with one process and one SQLite database per test file.<br>**E2E:** Playwright 1.58.2 with @axe-core/playwright, Chromium, on the production build. |
| **Config file** | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` (`desktop` 1440×900; `mobile` 375×812, `@journey` tests only; `workers: 1`) |
| **Node** | Prefix every command in Git Bash with POST-DEMO-BRIEF §4's Node 24 preamble. |
| **Quick run command** | **Web:** `pnpm --dir apps/csrm exec vitest run <path> [<path> …]`.<br>**Strapi file** (dev servers stopped): `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js)`.<br>**E2E** (dev servers stopped): `pnpm --dir apps/csrm test:e2e e2e/<spec>.spec.ts [--project desktop\|mobile]`. |
| **Contract commands** | `pnpm --dir apps/csrm api:generate`, then `pnpm --dir apps/csrm api:check`. After a new route or grant, `SERVED_OPERATIONS_WRITE=1 pnpm --dir apps/backend served-operations:write` (dev servers stopped). Then `cmp` the two catalogue copies, which must be silent. |
| **Full suite command** | `pnpm --dir apps/csrm api:check && pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm lint && pnpm --dir apps/csrm test && pnpm --dir apps/backend test` |
| **Phase gate** | Plan 20-23 Task 3: the full suite, then `pnpm --dir apps/csrm test:e2e` (both projects).<br>**Afterwards:**<br>- `git status --short` shows only POST-DEMO-BRIEF §2's three operator items;<br>- the content-type freeze since `PHASE_20_BASE` lists exactly the `csrm-reminder-delivery`, `csrm-risk` and `csrm-treatment-evidence` schema files;<br>- the dependency diff shows exactly `@strapi/provider-email-nodemailer` 5.51.0 in `apps/backend/package.json` (and its lockfile entries);<br>- no Keycloak flag or file changed; both records carry their approval; X-62 to X-67 and the glossary entries exist. |
| **Estimated runtime** | Web file under 20 s; Strapi file 10–90 s (the matrix 2–4 min); full Strapi suite about 15 min; full Playwright about 20–22 min. |

**Known infrastructure facts (from research).**
1. **The Strapi harness destroys cron jobs after `load()`.** Tests call `runReminders` through the harness's `runRemindersAt(now)` (20-14) and never wait for the timer. Playwright sets `CSRM_REMINDER_SCHEDULE: 'off'` (20-14) and relies on the start-up run, which `bootstrap()` awaits before Strapi listens.
2. **Harness pins before `load()`.** The schedule `off` (20-14); the email mode `capture`, a per-process capture directory, the sender, the web origin and the double key (20-15). A developer's `.env` must never change an outcome.
3. **Sends happen after commit and are not awaited.** Tests `await` the harness's `emailSenderDrain()` before reading the capture directory (20-15). Playwright polls the directory with `waitForCapturedMail` (`apps/csrm/e2e/helpers/mail-capture.ts`, 20-15).
4. **SQLite pool of one.** A raw `strapi.db.connection` query inside a transaction must call `.transacting(trx)`; otherwise it hangs about 60 s (19.1-RESEARCH Pitfall 1).
5. **Datetimes on SQLite are epoch milliseconds.** Bind `Date` objects, never ISO strings (19.1-RESEARCH Pitfall 3).
6. **PostgreSQL is not exercised (R-08-37).** Plan 20-14 records the new constructs in R-08-37: `ON CONFLICT … DO NOTHING RETURNING`, the CAS `UPDATE` (20-15) and the correlated `ORDER BY … LIMIT 1` subquery (20-08).
7. **The capture mailbox is outside the repository in Playwright** (`join(e2eRuntimeRoot, 'mail')`), so a run leaves the tree clean.
8. **Mounted tests read the bootstrap catalogue copy**, so each API plan's tracer task lands the route's grant in both catalogue copies with its first mounted test.

---

## Sampling Rate

- **After every task commit:** run the task's `<automated>` command (the touched web files by path; the touched Strapi files with dev servers stopped; `typecheck` when types change; `api:check` after any specification change).
- **After every plan wave:** the full Strapi suite and the full web suite (each API plan's last task runs `pnpm --dir apps/backend test`; each web plan's last task runs `pnpm --dir apps/csrm test`).
- **Before `/gsd-verify-work`:** the full suite, then Playwright at both widths, must be green, with a clean tree (20-23 Task 3).
- **Max feedback latency:** 120 seconds for a single file.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command (abridged) | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|------------------------------|-------------|--------|
| 20-01-01 | 20-01 | 1 | all six | T-20-01 | X-62 to X-67, the glossary, both records and eight amendments written, awaiting approval (D-01 to D-29) | static | `grep` over the direction, `CONTEXT.md` and the ten records (labels, tables, reasons, settings, awaiting lines) | ✅ / ❌ W0 (records) | ⬜ pending |
| 20-01-02 | 20-01 | 1 | all six | T-20-01, T-20-02 | Pilot approval (G-6), blocking-human `checkpoint:decision` | checkpoint | none (human); the answer is recorded verbatim | — | ⬜ pending |
| 20-01-03 | 20-01 | 1 | NOTIFY-02 | T-20-SC | Package legitimacy for `@strapi/provider-email-nodemailer@5.51.0`, blocking-human `checkpoint:human-verify` | checkpoint | none (human); the verdict gates 20-15 Task 1 | — | ⬜ pending |
| 20-01-04 | 20-01 | 1 | all six | T-20-02 | Dated approval lines in both records and eight amendments; no awaiting line left | static | `grep -Eq "Approved by the pilot on …"` per record and amendment | ✅ | ⬜ pending |
| 20-02-01 | 20-02 | 1 | RISK-06, RISK-05 | — | Applicability, effective progress, governing date, derived status; parts, act table, refusal order 404 → 403 → 400 → 409 (D-07 to D-09, D-13, D-21) | unit | `node --test …/treatment-facts.unit.test.js …/risk-people.unit.test.js` | ❌ W0 | ⬜ pending |
| 20-02-02 | 20-02 | 1 | RISK-05, NOTIFY-02 | — | Review date, state, reviewer and interval; reminder periods, keys, one per person; schedule parser (D-17, D-25 to D-27) | unit | `node --test …/decision-review.unit.test.js …/reminder-rules.unit.test.js …/reminder-schedule.unit.test.js` | ❌ W0 | ⬜ pending |
| 20-02-03 | 20-02 | 1 | NOTIFY-02 | T-20-03, T-20-04 | Provider always `nodemailer`; capture only under the double key; email holds no title, statement, rating or name (D-28) | unit + static | `node --test …/email-config.unit.test.js …/email-content.unit.test.js`; no other source names `sendmail` | ❌ W0 | ⬜ pending |
| 20-03-01 | 20-03 | 2 | RISK-04, RISK-06 | T-20-05 | Approved risk facts on a fresh boot; earlier releases unchanged (D-01, D-06, D-07) | integration | `node --test …/treatment-schema.integration.test.js …/risk-register.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| 20-03-02 | 20-03 | 2 | NOTIFY-02, RISK-06 | T-20-06 | Evidence and delivery tables; a real unique `reminder_key` index; the `ON CONFLICT` claim never aborts a transaction; no route mounted (D-18, D-27) | integration | `node --test …/treatment-schema.integration.test.js` | ❌ W0 | ⬜ pending |
| 20-03-03 | 20-03 | 2 | RISK-04 | T-20-05 | Post-release kinds and sources; null actor only for `scheduled-run`; `actorPart`; baseline envelope (D-19) | unit + integration | `node --test …/risk-history-actor.unit.test.js …/treatment-schema… …/risk-curation…`; `pnpm --dir apps/backend test` | ❌ W0 / ◐ earlier | ⬜ pending |
| 20-04-01 | 20-04 | 3 | RISK-06 | T-20-07 | The one rule switched to the resolve date and tracked treatments; SQL equals the function for every state and status (D-08, D-09; G-16) | unit + integration | `node --test …/analyst-insights.unit.test.js …/treatment-due-state-parity.integration.test.js …/risk-register.integration.test.js` | ✅ / ❌ W0 | ⬜ pending |
| 20-04-02 | 20-04 | 3 | RISK-06, RISK-04 | T-20-08 | Home, alerts, reports read the rule; under-assessment risks leave due figures; untreated reads progress; control delivery clears its alert (D-04, D-08, D-16) | integration | `node --test …/analyst-reports… …/analyst-alerts… …/analyst-dashboard… …/analyst-insights.unit…` | ✅ | ⬜ pending |
| 20-04-03 | 20-04 | 3 | RISK-06 | — | `not-tracked` published; web parser closed | contract + unit | `api:check`; `vitest run src/features/risks …parity…`; `typecheck`; `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 20-05-01 | 20-05 | 4 | RISK-04 | T-20-09 | One baseline before the first post-release write; released read, export and table deep-equal after writes and a scheduled-run write (D-05, D-06, D-30) | unit + integration | `node --test …/release-baseline.unit… …/release-baseline.integration… …/released-assessment-read.unit… …/exports.integration…` | ❌ W0 / ◐ earlier | ⬜ pending |
| 20-05-02 | 20-05 | 4 | RISK-04 | T-20-10 | Every pre-release write path refuses a released risk with 409 `ASSESSMENT_NOT_MUTABLE`, persistence deep-equal (D-05) | integration | `node --test …/release-baseline.integration.test.js` | ❌ W0 | ⬜ pending |
| 20-05-03 | 20-05 | 4 | RISK-05 | T-20-11 | Readability, parts and the assigned analyst; the SQL twin equals `riskPartsOf` (D-13, D-21, D-25) | integration | `node --test …/risk-people.integration.test.js`; `pnpm --dir apps/backend test` | ❌ W0 | ⬜ pending |
| 20-06-01 | 20-06 | 5 | RISK-04, RISK-06 | T-20-12, T-20-15 | Set progress end to end with baseline, history and re-derived status; Maya 404; stale base 409 (D-08, D-13, D-19, D-21) | integration | `node --test …/treatment-acts.integration.test.js`; `cmp` catalogues | ❌ W0 | ⬜ pending |
| 20-06-02 | 20-06 | 5 | RISK-06, RISK-05 | T-20-12, T-20-14 | Notes, completion on evidence (400 `TREATMENT_EVIDENCE_REQUIRED`), Undo, reopen; part and state refusals (D-10, D-11) | integration | `node --test …/treatment-acts.integration.test.js` | ❌ W0 | ⬜ pending |
| 20-06-03 | 20-06 | 5 | RISK-06 | T-20-13 | Reasoned date, plan and owner changes; a date change clears Overdue; the treatment owner 403 `TREATMENT_FIELD_NOT_PERMITTED` and no risk update (D-12; SC5, SC6) | integration | `node --test …/treatment-acts.integration.test.js` | ❌ W0 | ⬜ pending |
| 20-06-04 | 20-06 | 5 | RISK-05, RISK-06 | T-20-12 | Five operations published and granted to owners and human analysts; every Phase 20 reason and its copy; matrix rows for seven callers (D-02, D-03) | contract + matrix | `api:check`; `cmp`; `vitest run src/lib/api …chain… …parity…`; `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 20-07-01 | 20-07 | 6 | RISK-06 | T-20-16, T-20-17 | Evidence upload and download on Phase 14's pipeline; Maya 404 on list, upload and download (D-18, D-21) | integration | `node --test …/treatment-evidence.integration… …/request-attachments.integration…` | ❌ W0 / ◐ earlier | ⬜ pending |
| 20-07-02 | 20-07 | 6 | RISK-06, RISK-05 | T-20-16, T-20-18 | Removal, restore, closure read-only, limits, rescans, part refusals (D-18) | integration + unit | `node --test …/treatment-evidence.integration… …/attachment-rescan.unit…` | ❌ W0 / ◐ earlier | ⬜ pending |
| 20-07-03 | 20-07 | 6 | RISK-06 | T-20-16 | Evidence operations published and granted; matrix rows (D-02) | contract + matrix | `api:check`; `cmp`; guards; `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 20-08-01 | 20-08 | 7 | RISK-04 | T-20-20, T-20-21 | Close through the catalogued operation; G-1 and G-11 refusals; the agent refused (D-13, D-15) | integration | `node --test …/analyst-acts.integration.test.js`; `cmp` catalogues | ❌ W0 | ⬜ pending |
| 20-08-02 | 20-08 | 7 | RISK-04 | T-20-22 | Reopen, residual review with the exception's end, control delivery; released record unchanged (D-14 to D-16) | integration | `node --test …/analyst-acts.integration… …/release-baseline.integration…` | ❌ W0 | ⬜ pending |
| 20-08-03 | 20-08 | 7 | RISK-05 | T-20-19 | Decision review by the reviewer only; analysts 403 `DECISION_NOT_PERMITTED` before state; `REVIEW_NOT_DUE`, `REVIEW_AUTHORITY_MISSING`; SQL parity (D-17; G-14; SC7) | integration + unit | `node --test …/decision-review.integration… …/decision-review.unit…` | ❌ W0 | ⬜ pending |
| 20-08-04 | 20-08 | 7 | RISK-04, RISK-05 | T-20-21 | Close Risk moved and served; human-only literals; matrix rows (D-02, D-15) | contract + matrix | `api:check`; `cmp`; reserved close entry gone; guards; `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 20-09-01 | 20-09 | 8 | RISK-05 | T-20-23, T-20-24 | Owner read for the risk's people only; 404 Maya; 403 `NOT_RISK_PERSON`; no analyst-only facts (D-20, D-21) | integration | `node --test …/my-risks.integration.test.js`; `cmp` | ❌ W0 | ⬜ pending |
| 20-09-02 | 20-09 | 8 | RISK-05, RISK-06 | T-20-23, T-20-25 | My risks and treatments scoped to the viewer's parts; needs-you; summary; totals equal rows (D-09, D-17, D-20; SC3) | integration | `node --test …/my-risks.integration… …/risk-people.integration…` | ❌ W0 | ⬜ pending |
| 20-09-03 | 20-09 | 8 | RISK-05 | T-20-24 | Owner history of post-release rows only; the list export through Phase 19's module (D-19, D-20) | integration | `node --test …/my-risks.integration… …/exports.integration…` | ❌ W0 / ◐ earlier | ⬜ pending |
| 20-09-04 | 20-09 | 8 | RISK-05 | T-20-23 | Owner reads published and granted; matrix rows (D-02) | contract + matrix | `api:check`; `cmp`; guards; `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 20-10-01 | 20-10 | 9 | RISK-03 | T-20-26 | Register by type, division and business unit; `risk-register` views never grant rows (D-22, D-23; SC1) | integration | `node --test …/risk-register.integration… …/saved-views.integration… …/risk-register.unit…` | ✅ / ◐ earlier | ⬜ pending |
| 20-10-02 | 20-10 | 9 | RISK-03, ADMIN-06, RISK-04 | T-20-26 | Control, Risk Type, progress and review filters; accepted marker excludes not-confirmed; register detail's living state and withheld reason (D-13 to D-17, D-24) | integration | `node --test …/risk-register.integration… …/release-baseline.integration…` | ✅ | ⬜ pending |
| 20-10-03 | 20-10 | 9 | RISK-03 | T-20-27 | Queue and assessment list by type; parameters published; web parsers closed (D-22, D-24) | integration + contract | `node --test …/review-queue-buckets… …/assessment-workflow…`; `api:check`; `vitest run src/features/risks src/features/assessments …parity…`; `typecheck`; `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 20-11-01 | 20-11 | 10 | RISK-03 | T-20-28 | Exposure and throughput by type; Home exposure by type; each cell equals the register; export tables (D-17, D-22; SC1) | integration | `node --test …/analyst-reports… …/analyst-dashboard… …/exports.integration…` | ✅ / ◐ earlier | ⬜ pending |
| 20-11-02 | 20-11 | 10 | RISK-03 | — | Report and dashboard shapes published; web parsers closed | contract + unit | `api:check`; `vitest run src/features/reports src/features/analyst-dashboard …parity…`; `typecheck`; `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 20-12-01 | 20-12 | 11 | ADMIN-06 | T-20-30 | A system's Used in figures equal their lists; Requestor 403 (D-24; SC4) | integration | `node --test …/reference-usage.integration.test.js`; `cmp` | ❌ W0 | ⬜ pending |
| 20-12-02 | 20-12 | 11 | ADMIN-06, RISK-03 | T-20-29, T-20-30 | Assets, controls, Risk Types, list counts; suggestions scoped so no Requestor sees another's value (D-22, D-24) | integration | `node --test …/reference-usage… …/request-suggestions… …/administration.integration…` | ❌ W0 / ✅ | ⬜ pending |
| 20-12-03 | 20-12 | 11 | ADMIN-06 | T-20-30 | Usage reads human-analyst-only; suggestions for every person; matrix rows (D-02) | contract + matrix | `api:check`; `cmp`; `vitest run src/features/administration …`; `pnpm --dir apps/backend test` | ✅ | ⬜ pending |
| 20-13-01 | 20-13 | 12 | NOTIFY-02, RISK-05 | T-20-31, T-20-32 | 19.1's service with a system actor, explicit recipients and returned ids; readability while the part is held (D-25) | unit + integration | `node --test …/notification-kinds.unit… …/treatment-notifications… …/notifications.integration… …/notification-readability…` | ◐ earlier / ❌ W0 | ⬜ pending |
| 20-13-02 | 20-13 | 12 | NOTIFY-02, RISK-04 | T-20-31 | `treatment-assigned` at release and on an owner change; `decision-review-not-confirmed` to the assigned analyst (D-03 item 9, D-12, D-17) | integration | `node --test …/treatment-notifications… …/notification-readability… …/treatment-acts… …/decision-review… …/assessment-workflow…` | ❌ W0 / ✅ | ⬜ pending |
| 20-13-03 | 20-13 | 12 | NOTIFY-02 | — | Kinds published; centre shows icons and sentences | contract + unit | `api:check`; `vitest run src/features/notifications …parity…`; `typecheck`; `lint`; `pnpm --dir apps/backend test` | ◐ earlier | ⬜ pending |
| 20-14-01 | 20-14 | 13 | NOTIFY-02, RISK-06 | T-20-33, T-20-34 | The run writes Overdue with a baseline and system row, reminders and escalations exactly once, repeated and concurrent; one count-only log line (D-08, D-25 to D-27) | integration | `node --test …/reminder-run.integration… …/release-baseline.integration…` | ❌ W0 | ⬜ pending |
| 20-14-02 | 20-14 | 13 | NOTIFY-02 | T-20-33 | Review, waiting and assessment reminders by period; per-act evaluation reminds or stops at once (D-17, D-25, D-26) | integration | `node --test …/reminder-run… …/treatment-acts… …/decision-review…` | ❌ W0 | ⬜ pending |
| 20-14-03 | 20-14 | 13 | NOTIFY-02 | T-20-35 | Daily job in `Etc/UTC`, start-up run never failing boot, SC5 fixtures reconciled; Playwright pin (D-26, D-30) | unit + integration | `node --test …/reminder-schedule.unit… …/treatment-reminders-seed.integration…`; `pnpm --dir apps/backend test`; `grep "CSRM_REMINDER_SCHEDULE: 'off'"` | ❌ W0 | ⬜ pending |
| 20-15-01 | 20-15 | 14 | NOTIFY-02 | T-20-36, T-20-37, T-20-SC | One plain-text email per reminder in the capture mailbox after commit through the nodemailer-configured plugin; no forbidden content (D-27, D-28) | unit + integration | `node --test …/email-composition.unit… …/email-delivery.integration… …/reminder-run…`; dependency pinned | ❌ W0 | ⬜ pending |
| 20-15-02 | 20-15 | 14 | NOTIFY-02 | T-20-38 | Bounded retries, CAS single send across processes, send-time skips; decision waiting by email (D-27, D-28; SC5) | integration | `node --test …/email-delivery.integration.test.js` | ❌ W0 | ⬜ pending |
| 20-15-03 | 20-15 | 14 | NOTIFY-02 | T-20-37 | Settings commented with safe defaults; Playwright capture directory and reader (D-28, D-30) | static + typecheck | `grep` over `.env.example` and `playwright.config.ts`; `typecheck`; `lint`; `pnpm --dir apps/backend test` | ✅ / ❌ W0 | ⬜ pending |
| 20-16-01 | 20-16 | 15 | RISK-04, RISK-06 | T-20-40, T-20-41 | Owner page and status line; progress with Undo and rollback; no change control for a treatment owner; not-found and permission states (D-08, D-13, D-20, D-21, D-29) | web unit | `vitest run src/features/treatment src/features/contract-response-parity.test.ts`; `typecheck` | ❌ W0 | ⬜ pending |
| 20-16-02 | 20-16 | 15 | RISK-06 | T-20-40 | Completion on evidence with Undo; reopen with a reason; no lost input (D-10, D-29) | web unit | `vitest run src/features/treatment`; `typecheck` | ❌ W0 | ⬜ pending |
| 20-16-03 | 20-16 | 15 | RISK-04, RISK-06 | — | One status mapping per X-63 in sentence case; vocabulary copies identical (G-13; UI-D2) | web unit | `cmp` vocabularies; `pnpm --dir apps/csrm test`; `typecheck`; `lint` | ✅ / ◐ earlier | ⬜ pending |
| 20-17-01 | 20-17 | 16 | RISK-06 | T-20-42 | Reasoned change sheets; overdue cleared; treatment owner sees none (D-12) | web unit | `vitest run src/features/treatment`; `typecheck` | ❌ W0 | ⬜ pending |
| 20-17-02 | 20-17 | 16 | RISK-06 | T-20-43 | Notes and evidence; closed read-only; body-limit path (D-11, D-18) | web unit | `vitest run src/features/treatment src/features/attachments`; `typecheck` | ❌ W0 / ◐ earlier | ⬜ pending |
| 20-17-03 | 20-17 | 16 | RISK-05, RISK-04 | T-20-42 | Decision review for the reviewer only, never an analyst; post-release history (D-17, D-19; G-14) | web unit | `vitest run src/features/treatment src/features/risk-curation`; `typecheck`; `lint` | ❌ W0 / ◐ earlier | ⬜ pending |
| 20-18-01 | 20-18 | 17 | RISK-05 | T-20-44 | My risks and treatments for the viewer's own risks; states; capability (D-20, D-21; SC3) | web unit | `vitest run src/features/my-risks src/lib/capabilities`; `typecheck` | ❌ W0 / ✅ | ⬜ pending |
| 20-18-02 | 20-18 | 17 | RISK-05 | T-20-44 | Filters, sort, needs-you and export (D-20; CSV-01) | web unit | `vitest run src/features/my-risks src/features/exports`; `typecheck` | ❌ W0 | ⬜ pending |
| 20-18-03 | 20-18 | 17 | RISK-05 | T-20-44 | Track this risk on the viewer's own released risks only (D-21) | web unit | `pnpm --dir apps/csrm test`; `typecheck`; `lint` | ◐ earlier | ⬜ pending |
| 20-19-01 | 20-19 | 18 | RISK-05 | T-20-45 | Sidebar item and count opening the needs-you list (D-20) | web unit | `vitest run src/config/navigation src/components/shell`; `typecheck` | ◐ earlier | ⬜ pending |
| 20-19-02 | 20-19 | 18 | RISK-05, RISK-03 | T-20-45 | Requestor Home treatments and reviews; analyst Home exposure by type with equal-total links (D-09, D-20, D-22) | web unit | `pnpm --dir apps/csrm test`; `typecheck`; `lint` | ◐ earlier / ✅ | ⬜ pending |
| 20-19-03 | 20-19 | 18 | RISK-05, RISK-03 | — | Navigation and Home journey with Phase 20's items; clean tree | e2e | `test:e2e e2e/navigation-and-home.spec.ts`; `git status --short` | ◐ earlier | ⬜ pending |
| 20-20-01 | 20-20 | 19 | RISK-03 | T-20-46 | Suggestion field on the request form; scoped values only (D-22) | web unit | `vitest run src/components/csrm/suggestion-field.test.tsx src/features/requests`; `typecheck` | ❌ W0 / ◐ earlier | ⬜ pending |
| 20-20-02 | 20-20 | 19 | RISK-03 | — | Reports by type with filters, phone cards and the resolve-date copy (D-09, D-22) | web unit | `pnpm --dir apps/csrm test`; `typecheck`; `lint` | ✅ | ⬜ pending |
| 20-20-03 | 20-20 | 19 | RISK-03 | — | Analyst-insights journey with reports by type; clean tree | e2e | `test:e2e e2e/analyst-insights.spec.ts`; `git status --short` | ✅ | ⬜ pending |
| 20-21-01 | 20-21 | 20 | RISK-03 | T-20-47 | Register views Standard, Project, BAU, Accepted risks; saved views (D-23; SC1) | web unit | `vitest run src/features/risks src/features/saved-views src/features/risk-table`; `typecheck` | ✅ / ◐ earlier | ⬜ pending |
| 20-21-02 | 20-21 | 20 | RISK-03, ADMIN-06 | T-20-47 | Type, control, Risk Type, progress and review filters; queue and list by type; Used in with equal-total links and list counts (D-22, D-24; SC4) | web unit | `pnpm --dir apps/csrm test`; `typecheck`; `lint` | ❌ W0 / ✅ | ⬜ pending |
| 20-21-03 | 20-21 | 20 | RISK-03, ADMIN-06 | — | Register and administration journeys with views and Used in; clean tree | e2e | `test:e2e e2e/risk-register-workflow.spec.ts e2e/administration-workflow.spec.ts`; `git status --short` | ✅ | ⬜ pending |
| 20-22-01 | 20-22 | 21 | RISK-04 | T-20-48, T-20-49 | Post-release panel; close behind a confirmation; withheld analyst states; never an analyst Accept (D-13, D-15; G-1, G-11, G-14) | web unit | `vitest run src/features/risks src/features/treatment`; `typecheck` | ❌ W0 / ✅ | ⬜ pending |
| 20-22-02 | 20-22 | 21 | RISK-04 | T-20-48 | Residual review and control delivery sheets (D-14, D-16) | web unit | `vitest run src/features/risks`; `typecheck` | ❌ W0 | ⬜ pending |
| 20-22-03 | 20-22 | 21 | RISK-04 | — | Analyst released record caption and links (D-06) | web unit | `pnpm --dir apps/csrm test`; `typecheck`; `lint` | ✅ | ⬜ pending |
| 20-23-01 | 20-23 | 22 | all six | T-20-50, T-20-52 | The journey's final slice at 1440 and 375: tracked to Complete, reviewed and closed, released record unchanged, Maya and Bob refused at every step (D-30; SC2, SC6, SC7) | e2e | `test:e2e e2e/risk-owner-journey.spec.ts --project desktop` and `--project mobile` ("1 passed"); `git status --short` | ◐ earlier | ⬜ pending |
| 20-23-02 | 20-23 | 22 | RISK-03, RISK-05, RISK-06, ADMIN-06, NOTIFY-02 | T-20-50, T-20-51 | The phase spec: SC1 views and exposure by type, SC3 owner views, SC4 Used in, SC5 reminders in the app and the capture mailbox, Overdue, escalation and clearing, decision waiting, SC6 refusals; owner page route budget (D-29, D-30) | e2e | `test:e2e e2e/post-release-tracking.spec.ts e2e/performance.spec.ts`; `git status --short` | ❌ W0 / ✅ | ⬜ pending |
| 20-23-03 | 20-23 | 22 | all six | T-20-SC | The email integration's coverage matrix; the full gate and static checks (freeze, catalogues, dependency, flags, approvals, direction, glossary) (D-01, D-28, D-30; G-6) | gate | full suite; `test:e2e`; `git status --short`; freeze check; `cmp`; dependency and flag diffs; approval, direction, glossary and `COVERAGE.md` greps | ✅ / ❌ W0 (`COVERAGE.md`) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each owner creates its item in its first RED step, before the implementation it proves.

- [ ] Strapi harness pins before `load()`: `CSRM_REMINDER_SCHEDULE=off` and `runRemindersAt(now)` (20-14 Task 1); `CSRM_EMAIL_PROVIDER`, `CSRM_EMAIL_CAPTURE_DIR`, `CSRM_EMAIL_FROM`, `CSRM_WEB_PUBLIC_ORIGIN`, the double key, `emailSenderDrain()` and `captureDirectory()` (20-15 Task 1); `CsrmFixtureUid` members (20-03 Task 2); `seedReleasedTrackedAssessment` (20-05 Task 1).
- [ ] `apps/csrm/playwright.config.ts`: `CSRM_REMINDER_SCHEDULE: 'off'` (20-14 Task 3); `CSRM_EMAIL_CAPTURE_DIR: join(e2eRuntimeRoot, 'mail')` and `process.env.CSRM_E2E_MAIL_CAPTURE_DIR ??= …` (20-15 Task 3); the mobile `testMatch` entry for `post-release-tracking.spec.ts` (20-23 Task 2).
- [ ] `apps/csrm/e2e/helpers/mail-capture.ts` (20-15 Task 3).
- [ ] SC5 fixtures reconciled at each start, ordered before the start-up run (20-14 Task 3).
- [ ] The test files marked ❌ W0 above, each created by its task's RED step.
- [ ] `@strapi/provider-email-nodemailer@5.51.0` installed exactly (20-15 Task 1), after its blocking-human `checkpoint:human-verify` (20-01 Task 3).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Both contract-gap records and eight amendments approved (G-6) | all six | Governance approval | 20-01 Task 2 (blocking-human `checkpoint:decision`) |
| The nodemailer provider's legitimacy | NOTIFY-02 | Package legitimacy gate | 20-01 Task 3 (blocking-human `checkpoint:human-verify`) |
| A captured reminder renders in Outlook and Gmail with the link whole | NOTIFY-02 (UI-SPEC backstop) | Real mail clients | The pilot sends a capture-file body through a test relay to their own mailbox and opens it in both clients; the link opens CSRM after sign-in |
| With NVDA, setting In progress announces the new status line once | RISK-06 (UI-SPEC backstop) | Screen reader | The pilot sets In progress on an owner page with NVDA running and hears the status line once |
| Production SMTP against the organisation's relay or SES | NOTIFY-02 (D-28) | Deployment configuration and credentials | The operator sets the `smtp` block, triggers a start-up run against a staging copy, and confirms one `sent` delivery and SPF, DKIM and DMARC alignment in the received headers |
| PostgreSQL behaviour of `ON CONFLICT`, the CAS update and the correlated subquery | NOTIFY-02, D-17 | R-08-37: no suite runs on PostgreSQL | Recorded in R-08-37 (20-14); run the Strapi suites on PostgreSQL before a PostgreSQL deployment |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the two checkpoint tasks are human gates)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s for a single file
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (plan check)
