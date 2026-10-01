---
phase: "20"
slug: "oversight-registers-and-post-release-tracking"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-01"
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source and scope.** This file was seeded on 2026-10-01 from `20-RESEARCH.md`, "Validation Architecture", before any plan exists. It maps every requirement and success criterion, with their negative cases in the API and the UI, to an automated proof:
- the requirements RISK-03, RISK-04, RISK-05, RISK-06, ADMIN-06 and NOTIFY-02;
- the seven ROADMAP success criteria;
- the locked decisions D-01 to D-30 in `20-CONTEXT.md`.

The phase closes UAT-045, UAT-046, UAT-047 and UAT-058 and answers PD-5.

**How the maps are filled.**
- **Per-task map:** the planner rebuilds it for the final plans, one row per task, taken from each task's `<automated>` verify block. The plan check verifies the rows (Dimension 8).
- **Markers:** "❌ W0" marks a test file that the owning plan's first RED task creates (the project convention).
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
| **Phase gate** | The full suite, then `pnpm --dir apps/csrm test:e2e` (both projects).<br>**Afterwards:**<br>- `git status --short` shows only POST-DEMO-BRIEF §2's three operator items;<br>- the content-type freeze check lists exactly the approved schema files (records 1 and 2);<br>- the dependency diff shows exactly `@strapi/provider-email-nodemailer` 5.51.0 in `apps/backend/package.json` and the lockfile. |
| **Estimated runtime** | Web file under 20 s; Strapi file 10–90 s (the matrix 2–4 min); full Strapi suite about 15 min; full Playwright about 18–20 min. |

**Known infrastructure facts (from research).**
1. **The Strapi harness destroys cron jobs after `load()`.** Tests call `runReminders(strapi, { now })` with an injected clock and never wait for the timer. Playwright sets `CSRM_REMINDER_SCHEDULE: 'off'` and relies on the start-up run, which `bootstrap()` awaits before Strapi listens.
2. **Harness pins before `load()`.** The pins are the email mode (`capture`), a per-process capture directory, the sender, the web origin, the schedule `off`, and the double key (`NODE_ENV` and `CSRM_ENVIRONMENT` set to `development`). A developer's `.env` must never change an outcome.
3. **Sends happen after commit and are not awaited.** Tests `await sender.drain()` before reading the capture directory. Playwright polls the directory with `expect.poll`.
4. **SQLite pool of one.** A raw `strapi.db.connection` query inside a transaction must call `.transacting(trx)`; otherwise it hangs about 60 s (19.1-RESEARCH Pitfall 1).
5. **Datetimes on SQLite are epoch milliseconds.** Bind `Date` objects, never ISO strings (19.1-RESEARCH Pitfall 3).
6. **PostgreSQL is not exercised (R-08-37).** A plan task records the new constructs in R-08-37: `ON CONFLICT … DO NOTHING RETURNING`, the CAS `UPDATE`, and the correlated `ORDER BY … LIMIT 1` subquery.
7. **The capture mailbox is outside the repository in Playwright** (`join(e2eRuntimeRoot, 'mail')`), so a run leaves the tree clean.

---

## Sampling Rate

- **After every task commit:** run the touched web files by path; the touched Strapi file (dev servers stopped); `typecheck` when types change; `api:check` after any specification change.
- **After every plan wave:** the full Strapi suite and the full web suite.
- **Before `/gsd-verify-work`:** the full suite, then Playwright at both widths, must be green, with a clean tree.
- **Max feedback latency:** 120 seconds for a single file.

---

## Per-Task Verification Map

Seed rows by requirement and decision; the planner replaces them with one row per task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-TBD | TBD | 1 | RISK-06 (D-09) | — | The rule gives a due state only to released Treat risks; the governing date is `COALESCE(treatmentResolveDate, targetDate)`; the order holds | unit | `…/treatment-due-state.unit.test.js` | ❌ W0 | ⬜ pending |
| 20-TBD | TBD | 3 | RISK-06 (D-09) | — | The SQL predicate equals the function over every state's fixtures | integration | `…/treatment-due-state-parity.integration.test.js` | ❌ W0 | ⬜ pending |
| 20-TBD | TBD | 1 | RISK-06 (D-07, D-08) | — | Progress and status derivation; earlier-release defaults; Overdue leaves only by completion or a date change | unit | `…/treatment-status.unit.test.js` | ❌ W0 | ⬜ pending |
| 20-TBD | TBD | 4 | RISK-04 (D-06) | Tampering | The released read, export and report deep-equal after every act and after a daily run; one baseline only | integration | `…/release-baseline.integration.test.js` | ❌ W0 | ⬜ pending |
| 20-TBD | TBD | 1 | RISK-04 (D-19) | Repudiation | A null actor only for `scheduled-run`; person rows refuse null | unit | `…/risk-history-actor.unit.test.js` | ❌ W0 | ⬜ pending |
| 20-TBD | TBD | 4–8 | RISK-05, RISK-06 (5) | Elevation, information disclosure | Maya 404; a participant without a part 403 `NOT_RISK_PERSON`; a treatment owner 403 `TREATMENT_FIELD_NOT_PERMITTED`; 400 `TREATMENT_EVIDENCE_REQUIRED`; analyst G-1 and G-11 refusals; the service identity 403; refusal order 404 → 403 → 400 → 409 | integration + matrix | `…/treatment-acts.integration.test.js`, `…/authorization-matrix.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| 20-TBD | TBD | 7 | RISK-05 (D-17) | Elevation | The review date's sources and SQL parity; authority by rating; `REVIEW_NOT_DUE`; `REVIEW_AUTHORITY_MISSING`; an analyst is refused | unit + integration | `…/decision-review.unit.test.js`, `…/decision-review.integration.test.js` | ❌ W0 | ⬜ pending |
| 20-TBD | TBD | 1 | NOTIFY-02 (D-26) | — | Schedule parser; an invalid rule fails boot; the job registers with `Etc/UTC`; `off` registers none | unit | `…/reminder-schedule.unit.test.js` | ❌ W0 | ⬜ pending |
| 20-TBD | TBD | 11 | NOTIFY-02 (D-25, D-27) | Information disclosure | Kinds, periods, recipients, one per person; readability at write and send; repeated and concurrent runs write nothing twice; retries bounded | unit + integration | `…/reminder-rules.unit.test.js`, `…/reminder-run.integration.test.js` | ❌ W0 | ⬜ pending |
| 20-TBD | TBD | 1, 11 | NOTIFY-02 (D-28) | Information disclosure | Provider always `nodemailer`, never `sendmail`; capture only under the double key; a capture file per email; no title, name or rating in content; `text/plain` only | unit + integration | `…/email-config.unit.test.js`, `…/email-content.unit.test.js`, `…/email-delivery.integration.test.js` | ❌ W0 | ⬜ pending |
| 20-TBD | TBD | 9 | RISK-03 (D-22, D-23) | Information disclosure | Type, division and business-unit filters only narrow; built-in views; scoped suggestions (a Requestor sees only their own values) | integration + web | `…/risk-register.integration.test.js`, `…/request-suggestions.integration.test.js`; `vitest run src/features/risks` | ✅ / ❌ W0 | ⬜ pending |
| 20-TBD | TBD | 10 | ADMIN-06 (D-24) | — | "Used in" figures equal their filtered lists; a Requestor is refused (403) | integration + web | `…/reference-usage.integration.test.js`; `vitest run src/features/administration` | ❌ W0 | ⬜ pending |
| 20-TBD | TBD | 12 | RISK-05, RISK-06 | — | UI refusal states: no date control for a treatment owner, no tracking link without a part, no review control for an analyst, Maya's not-found page; confirmations, Undo and rollback | web unit | `pnpm --dir apps/csrm exec vitest run src/features/my-risks src/features/treatment` | ❌ W0 | ⬜ pending |
| 20-TBD | TBD | 13 | SC7 | — | The journey's final slice at 1440 and 375 with negatives | e2e | `pnpm --dir apps/csrm test:e2e e2e/risk-owner-journey.spec.ts` | Phase 17 | ⬜ pending |
| 20-TBD | TBD | 13 | SC1, SC3 to SC6 | — | The phase spec: views and exposure by type; owner views; "Used in"; reminders, the capture mailbox, Overdue, escalation and clearing; the refusals | e2e | `pnpm --dir apps/csrm test:e2e e2e/<phase spec>.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Strapi harness: environment pins before `load()` (email mode, capture directory, sender, web origin, `CSRM_REMINDER_SCHEDULE=off`, the double key) added to the restored list; helpers `runReminders(strapi, { now })`, `emailSender().drain()` and `captureDirectory()`.
- [ ] `apps/csrm/playwright.config.ts`: in the Strapi `webServer.env`, `CSRM_REMINDER_SCHEDULE: 'off'` and `CSRM_EMAIL_CAPTURE_DIR: join(e2eRuntimeRoot, 'mail')`; `process.env.CSRM_E2E_MAIL_CAPTURE_DIR ??= …`.
- [ ] `apps/csrm/e2e/helpers/mail-capture.ts`: poll and parse the JSON capture files.
- [ ] SC5 fixtures reconciled at each start (a treatment due in three days, one overdue, an act waiting eight days, a review due), ordered before the start-up run.
- [ ] The test files marked ❌ W0 above.
- [ ] `@strapi/provider-email-nodemailer@5.51.0` installed exactly, after its `checkpoint:human-verify` (the seam rated it SUS for the latest tag's age only).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A captured reminder renders in Outlook and Gmail with the link whole | NOTIFY-02 (UI-SPEC §14 backstop) | Real mail clients | The pilot sends a capture-file body through a test relay to their own mailbox and opens it in both clients; the link opens CSRM after sign-in |
| Production SMTP against the organisation's relay or SES | NOTIFY-02 (D-28) | Deployment configuration and credentials | The operator sets the `smtp` block, triggers a start-up run against a staging copy, and confirms one `sent` delivery and SPF, DKIM and DMARC alignment in the received headers |
| PostgreSQL behaviour of `ON CONFLICT`, the CAS update and the correlated subquery | NOTIFY-02, D-17 | R-08-37: no suite runs on PostgreSQL | Recorded in R-08-37; run the Strapi suites on PostgreSQL before a PostgreSQL deployment |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
