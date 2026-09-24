---
phase: quick
plan: 260901-oiw
subsystem: risk-register
tags: [strapi, nextjs, accessibility, playwright, authorization]
requires: [phase-05-risk-register]
provides: [consistent-risk-disclosure, searchable-relation-filters, lossless-risk-editing, rerun-safe-e2e]
affects: [risk-register, risk-details, development-seed, phase-05-verification]
tech-stack:
  added: []
  patterns: [fail-closed-parent-disclosure, bounded-server-relation-search, creation-only-fixtures, url-aware-loading]
key-files:
  created:
    - apps/web/src/features/risks/risk-register-loading.tsx
  modified:
    - apps/strapi/src/api/csrm-risk/services/risk-register.ts
    - apps/strapi/src/bootstrap/seed-risk-register-workflow.ts
    - apps/web/src/features/risks/risk-register-filters.tsx
    - apps/web/src/features/risks/risk-detail-editor.tsx
    - apps/web/src/features/risks/mitigation-control-list.tsx
    - apps/web/e2e/risk-register-workflow.spec.ts
decisions:
  - List and detail use the same fail-closed mutable-or-completely-released parent rule.
  - Editable development fixture relations are assigned only on first creation.
  - Relation filters search through typed server actions and retain URL-selected labels outside result pages.
metrics:
  duration: 61 min
  completed: 2026-09-01
---

# Quick Task 260901-oiw: Phase 5 Review Remediation Summary

Risk Register disclosure, relation filtering, detail editing, fixture reconciliation, and browser determinism now satisfy the confirmed review findings with frozen contracts unchanged.

## Finding Disposition Ledger

| ID | Severity | Disposition | Implementation | Regression / evidence | Commit |
|---:|---|---|---|---|---|
| 1 | major | Fixed | The journey reads the authoritative current target date, proves equal bounds against it, then persists an A/B date. | `risk-register-workflow.spec.ts`; two consecutive 12/12 suites. | `02b000b` |
| 2 | minor | Fixed | Mitigation Evidence toggles between stable A/B values, guaranteeing a mutation on retries and reruns. | Browser save feedback and authoritative reload assertion. | `02b000b` |
| 3 | major | Fixed | Removed literal `doe` bootstrap; owner filters use authorised server-backed search. | Component route-source regression plus live Bob owner selection. | `cc1f07a` |
| 4 | major | Fixed | Current control owners and impacted system/asset relations are merged into editor options before delta calculation. | Risk detail component suite and full browser workflow. | `3935525` |
| 5 | major | Fixed | Post-save owner projection resolves from the live selected-owner map, retaining newly searched owners immediately. | Risk detail changed-field component coverage. | `3935525` |
| 6 | minor | Fixed | List count/page queries now exclude closed and partial-release parents using the same eligibility rule as detail. | Mounted SQLite partial-parent exclusion regression. | `fbe6a29` |
| 7 | minor | Fixed | Active URL-selected labels are merged into picker options even when absent from the bounded response. | Relation-filter component coverage and visible selected-label UI. | `cc1f07a` |
| 8 | minor | Fixed | Reseed leaves existing Risk and ControlImplementation relations untouched and does not recreate a removed managed mitigation. | Seed integration preservation tests. | `fbe6a29`, `ddb8a40` |
| 9 | major | Duplicate of finding 3; fixed by the same implementation | The hard-coded owner term is absent and non-Doe users are reachable through the typed user search. | Route-source assertion and server-action combobox path. | `cc1f07a` |
| 10 | major | Fixed | All five relation filters are labelled debounced listbox comboboxes; system/asset text filtering occurs at Strapi before a bounded 20-option page. | Keyboard/listbox component test and live E2E relation selection. | `cc1f07a`, `1be25d2`, `4d235ab` |
| 11 | minor | Duplicate of finding 7; fixed by the same implementation | Selected assessment/system/asset/owner labels remain visible independently of the current search page. | `mergeSelectedRiskPickerOption` product wiring and component assertion. | `cc1f07a` |
| 12 | minor | Fixed | Route and segment loading derive canonical values from `useSearchParams` and render disabled controls without protected picker calls. | Loading-state component assertions for dates and active query state. | `cc1f07a` |
| 13 | minor | Fixed | Overdue warning icon uses explicit semantic `size-3`. | Register component rendering and browser icon evidence. | `cc1f07a` |
| 14 | minor | Fixed | Immutable empty mitigation state keeps `No mitigation controls added` plus the released body copy. | Risk detail component suite. | `3935525` |
| 15 | minor | Fixed | Edit/Add forms autofocus their first meaningful control; exit restores surviving Edit/Add anchors and removal focuses Add. | Risk detail component and browser focus evidence. | `3935525` |
| 16 | minor | Fixed | Edit mode retains Ratings and Ownership and treatment headings in the Risk form outline. | Risk detail heading/component coverage. | `3935525` |
| 17 | minor | Fixed | List projections can no longer disclose a row that the shared detail parent gate deliberately conceals. | Mounted list/detail parent-state tests. | `fbe6a29` |
| 18 | minor | Duplicate of finding 8; fixed by the same implementation | Existing analyst relations and replacements are preserved; an intentionally removed fixture mitigation is not recreated. | Seed idempotence/preservation integration suite. | `fbe6a29`, `ddb8a40` |

## Commits

- `fbe6a29` — `fix(strapi): align risk register disclosure`
- `cc1f07a` — `fix(web): make risk relation filters searchable`
- `3935525` — `fix(web): preserve risk detail relation edits`
- `02b000b` — `test(web): make risk register journey rerun safe`
- `1c8cccd` — `fix(web): drive relation comboboxes in browser journey`
- `789872d` — `fix(web): accept en-AU September abbreviation`
- `fdf07ef` — `fix(web): await hydrated risk rows in E2E`
- `1be25d2` — `fix(web): search full risk inventories server-side`
- `4d235ab` — `fix(web): use Strapi inventory text search`
- `ddb8a40` — `fix(strapi): never recreate removed fixture mitigation`

Every commit has a conventional subject and real newline-separated bullet body. No history was amended, rewritten, or pushed.

## Verification

- `node scripts/verify-phase-05-integrity.mjs` — PASS.
- `pnpm --filter @csrm/web build` — PASS; all routes compiled and TypeScript completed.
- `apps/strapi: npm test` — PASS, 97/97 tests (final post-fix run).
- `apps/web: pnpm typecheck` — PASS.
- `apps/web: pnpm test` — PASS, 253/253 tests.
- `apps/web: pnpm api:check` — PASS; generated schema has no drift.
- `apps/web: pnpm test:e2e` — PASS, 12/12.
- Immediate second `apps/web: pnpm test:e2e` — PASS, 12/12.
- `git diff --check` — PASS.

The final consecutive browser runs used fresh UUID-isolated database and Next dist paths, `reuseExistingServer: false`, and only Playwright-owned ports 1338/3100. Live services on 1337/3000 were inspected only and never stopped, rebound, or reused.

## Frozen Artifact Evidence

- Both catalogue copies remain byte-identical at SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- All 15 content-type schema path/hash entries match the preflight inventory exactly; no schema was added, removed, or changed.
- No dependency, lockfile, generated-contract, sentinel, escape hatch, ROADMAP, Phase 6, or Phase 5 completion change was introduced.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 3 - Blocking test mismatch] Updated browser interaction for the new relation comboboxes**
   - The existing journey still attempted native `selectOption` calls after the contracted combobox replacement.
   - It now types a search, selects the authorised listbox option, and asserts the opaque URL ID.
   - Commit: `1c8cccd`.

2. **[Rule 3 - Blocking locale assertion] Accepted the valid en-AU `Sept` abbreviation**
   - The unrelated requestor E2E required exactly three month letters even though the rendered locale output is `Sept`.
   - The structural submitted-date assertion remains exact apart from accepting three or four month letters.
   - Commit: `789872d`.

3. **[Rule 3 - Blocking streamed-render race] Awaited hydrated Risk rows**
   - One fresh run rendered the authoritative count before streamed table rows were present.
   - The test now awaits the stable Risk link before preserving the original count-versus-distinct-row assertion.
   - Commit: `fdf07ef`.

4. **[Rule 1 - Seed deletion bug] Prevented recreation after analyst removal**
   - Creation-only relation handling still needed to distinguish first fixture creation from a later intentionally empty mitigation set.
   - The seed records whether the Risk pre-existed and creates the managed mitigation only with a new Risk.
   - Commit: `ddb8a40`.

One intermediate E2E invocation encountered Windows OS error 1450 while Turbopack wrote an isolated cache. No product assertion ran in that invocation; subsequent fresh invocations passed. Targeted cleanup was rejected by the environment, so existing `.tmp` content was preserved.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, authentication path, schema boundary, or file-access surface was introduced; searches remain behind existing typed authenticated Strapi reads.

## Self-Check: PASSED

- All named code files exist.
- All listed commits are present on `dylan-test`.
- Ledger identifiers are exactly 1 through 18 once each, with duplicate pairs retained explicitly.
- The summary and all planning artifacts remain uncommitted for orchestrator close-out.
- `.planning/STATE.md` and `.planning/ROADMAP.md` were not modified by this executor, per orchestration constraints.
