---
phase: 6
slug: administration-and-csv-imports
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-01
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Playwright owns derived ports and per-run databases; the live services on ports 1337 and 3000 are never test targets.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node 24 mounted Strapi tests; Vitest 4.0.18 + Testing Library; Playwright 1.58.2 + axe 4.11.0 |
| **Config file** | `apps/web/playwright.config.ts`, `apps/web/vitest.config.ts`, `apps/strapi/package.json` |
| **Quick run command** | `corepack pnpm --filter @csrm/strapi test` or `corepack pnpm --filter @csrm/web test -- src/features/administration` for the subsystem changed |
| **Full suite command** | `corepack pnpm typecheck && corepack pnpm test && corepack pnpm --filter @csrm/web api:check` |
| **Phase E2E command** | `corepack pnpm --filter @csrm/web test:e2e -- e2e/administration-workflow.spec.ts` |
| **Estimated runtime** | Quick subsystem feedback under 120 seconds; full non-E2E and isolated E2E at wave/phase gates |

---

## Sampling Rate

- **After every backend task commit:** Run `corepack pnpm --filter @csrm/strapi test`.
- **After every web task commit:** Run `corepack pnpm --filter @csrm/web test -- src/features/administration`.
- **After contract/catalogue tasks:** Run the Strapi suite, `corepack pnpm --filter @csrm/web api:check`, and the byte-identical catalogue assertion.
- **After every plan wave:** Run `corepack pnpm typecheck && corepack pnpm test` plus `node scripts/verify-phase-06-integrity.mjs`.
- **Before `$gsd-verify-work`:** Run the full non-E2E suite, API check, integrity gate, and isolated Phase 6 Playwright journey.
- **Max feedback latency:** 120 seconds for the task-level targeted suite; longer suites are wave gates.

---

## Per-Requirement Verification Map

| Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| ADMIN-01 | T-06-01, T-06-05 | Analyst-only Risk Type list/detail/create/update; normalized-name 409; no delete or disclosure to Requestors | mounted backend + component | `corepack pnpm --filter @csrm/strapi test`; `corepack pnpm --filter @csrm/web test -- src/features/administration` | ❌ Wave 0 | ⬜ pending |
| ADMIN-02 | T-06-01, T-06-02, T-06-05 | Analyst-only bounded Control administration over all 2,646 seeded controls; controlNumber 409; exact server totals | mounted backend + component + E2E | backend and web targeted suites; Phase 6 E2E command | ❌ Wave 0 | ⬜ pending |
| ADMIN-03 | T-06-01, T-06-02, T-06-05 | Analyst-only System/Asset administration with enum, boolean, owner, and normalized-name validation | mounted backend + component + E2E | backend and web targeted suites; Phase 6 E2E command | ❌ Wave 0 | ⬜ pending |
| ADMIN-04 | T-06-01, T-06-03, T-06-04, T-06-06, T-06-07 | Bounded server parsing; digest-bound preview/commit; distinct create/update/unchanged/rejected/ambiguous classification; unchanged no-write; per-row atomic writes; safe results/report | unit + mounted backend + component + E2E | backend and web targeted suites; Phase 6 E2E command | ❌ Wave 0 | ⬜ pending |
| INT-01 support | T-06-01, T-06-02 | Typed literal `/v1` operations and exact grants in both byte-identical catalogues; contract gap documented | contract + integration | `corepack pnpm --filter @csrm/web api:check`; backend authorization suite | Partial | ⬜ pending |
| INT-04 support | T-06-01 | Responsive, keyboard-operable, non-enumerating UI at 375/768/1280/1440 with serious/critical axe checks | Playwright | Phase 6 E2E command | ❌ Wave 0 | ⬜ pending |

### Threat References

- **T-06-01:** Requestor or analyst-agent calls an Administration route directly.
- **T-06-02:** Caller injects a UID, sort column, filter structure, or unsupported field.
- **T-06-03:** Oversized or pathological CSV exhausts server resources.
- **T-06-04:** Commit payload tampers with preview classifications or matched IDs.
- **T-06-05:** Concurrent natural-key writes create duplicates.
- **T-06-06:** Downloaded error report permits spreadsheet formula injection.
- **T-06-07:** Raw CSV or row values leak through logs, errors, or URLs.

---

## Wave 0 Requirements

- [ ] `apps/strapi/tests/administration.unit.test.ts` — query, DTO, normalization, CSV parser, classification, and transaction-service coverage.
- [ ] `apps/strapi/tests/administration.integration.test.ts` — mounted auth, CRUD, uniqueness, import, concurrency, and bound enforcement.
- [ ] `apps/strapi/tests/helpers/strapi-http-harness.ts` — safe Administration fixtures and request helpers.
- [ ] `apps/strapi/tests/authorization.integration.test.ts` — exact Administration operations, no-delete exposure, and catalogue-copy assertions.
- [ ] `apps/web/src/features/administration/administration-schema.test.ts` — closed client schemas, URL state, and bound validation.
- [ ] `apps/web/src/features/administration/administration-service.test.ts` — typed paths and multipart serialization.
- [ ] `apps/web/src/features/administration/administration-workflow.test.tsx` — lists, forms, five deliberate states, and five-step import behavior.
- [ ] `apps/web/e2e/administration-workflow.spec.ts` — Bob CRUD and CSV journeys plus Jane denial.
- [ ] `scripts/verify-phase-06-integrity.mjs` — test-integrity, live-port, secret, schema-change, skip/only, and attribution guard.

---

## Mandatory Coverage Details

- Authorization tests prove missing token `401`, missing identity/grant `403`, Bob success, Jane denial, and denial before malformed query/file parsing.
- Catalogue tests prove every mounted operation constant appears exactly once in both byte-identical copies and that no Administration delete operation or route exists.
- CRUD tests cover closed queries, all filters/sorts, count/page agreement, deterministic tie-breaks, safe `404`, mutation allowlists, NFKC/trim/case natural-key conflicts, and concurrent conflicts.
- CSV parser tables cover BOM, line endings, quoting, embedded commas/newlines, escaped quotes, duplicate/unknown/missing headers, row width, blank required cells, enums/booleans, invalid UTF-8, empty/header-only files, exactly 5,000 and 5,001 rows, exactly 5 MiB and one byte over, and maximum record size.
- Import tests cover distinct create/update/unchanged/rejected/ambiguous rows, unchanged no-write, duplicate normalized keys, stable row numbers, before/after diffs, digest mismatch with zero writes, current-state drift, per-row rollback, and accurate five-way final summaries.
- Web tests cover desktop/mobile presentations, five deliberate states, 300 ms debounce plus Enter, stale response suppression, canonical URL state, error focus/summary, 409 field mapping, unsaved confirmation, retained values, no delete, all import steps, backward navigation, preview diffs/errors, explicit confirmation, unknown outcomes, results divergence, safe downloads, and reduced motion.
- E2E uses the existing dual-server harness only, creates uniquely suffixed records in all four collections, edits and reloads at least two, exercises Control server totals over 2,646 records, completes a create/update/reject CSV import, verifies an error report and rejected preview path, and proves Jane receives no data/file/total/existence clues.

---

## Manual-Only Verifications

All Phase 6 acceptance behaviors have automated coverage. The frozen-schema, single-process limitation for normalized System/Asset name uniqueness must be recorded in the contract-gap/implementation documentation; multi-process enforcement is out of scope unless the schema freeze is explicitly lifted.

---

## Validation Sign-Off

- [ ] All plan tasks have automated verification or an explicit Wave 0 dependency.
- [ ] Sampling continuity: no three consecutive tasks without automated verification.
- [ ] Wave 0 covers every missing test reference above.
- [ ] No watch-mode flags are used.
- [ ] Targeted feedback latency stays below 120 seconds.
- [ ] The test-integrity script passes without exceptions or suppressions.

**Approval:** pending execution
