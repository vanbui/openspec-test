---
phase: quick
plan: 260902-a9r
subsystem: administration-and-csv-imports
tags: [strapi, nextjs, csv, authorization, accessibility, openapi]
requires:
  - phase-06 administration implementation

provides:
  - hardened full-set CSV preview and commit workflow
  - accessible responsive administration routes and import UI
  - active-only OpenAPI administration contract

affects:
  - phase-06 verification

tech-stack:
  added: []
  patterns:
    - serialized full-record natural-key maps
    - timestamp-bound preview proofs
    - typed token-authenticated inventory pickers

key-files:
  created:
    - apps/web/app/(app)/app/admin/loading.tsx
    - apps/web/app/(app)/app/admin/error.tsx
  modified:
    - apps/strapi/src/api/csrm-administration/services/administration-workflow.ts
    - apps/strapi/src/api/csrm-administration/services/csv-import.ts
    - apps/web/src/features/administration/administration-workspace.tsx
    - apps/web/src/features/administration/csv-import-flow.tsx
    - docs/references/specification.json
    - scripts/verify-phase-06-integrity.mjs

decisions:
  - Preserve the frozen 500-character system and asset location contract through the trusted repository boundary.
  - Permit queryless requestor inventory pickers while retaining analyst-only queried administration lists.
  - Bind reviewed update rows to persisted updatedAt values and reject whole-row drift.

metrics:
  tasks: 3
  commits: 9
  completed: 2026-09-02
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-27
  status: unknown
---

# Quick Plan 260902-a9r: Phase 6 Independent Review Remediation Summary

Full-set, timestamp-bound CSV imports now sit behind scoped upload limits and server authorization, while the four Administration workflows expose resilient, accessible, responsive UI through typed active-only contracts.

## Outcome

All 21 independent-review work items were remediated. The exact Node 24.19.0 gate passed with 124 Strapi tests, 286 web unit/component tests, deterministic OpenAPI generation, and 16 Playwright journeys. The Phase 6 integrity verifier passed every check, including hostile removal of either mounted list token gate.

## Finding Ledger

| Finding | Decision and implementation | Failing-first regression / final evidence | Commit |
|---|---|---|---|
| F1 | Removed error-message special-casing; every unexpected row write error becomes a safe `ROW_WRITE_FAILED` rejection and later rows continue. | Mounted injected provider failure initially aborted; integration regression now exercises the ordinary production catch path and passes. | `19159bc` |
| F2 | Kept the authoritative 500-character caps and persisted contract-valid system/asset locations through the trusted repository path. | Exact-boundary and cap-plus-one mutation, preview, and commit cases exposed the Strapi validator mismatch; all boundary suites now pass. | `19159bc`, `5bb5056`, `e8dd759` |
| F3 | Normalized blank or whitespace Risk Type descriptions to `null`, including clearing an existing value. | Create-blank and clear-then-read regressions failed against the former empty-string submission and now pass. | `4c51ab6` |
| F4 | Server and browser classification build normalized maps from the complete existing collection, never a 5,000-record slice. | Beyond-window classification regression first reported create and now reports update. | `19159bc`, `4c51ab6` |
| F5 | Serialized commit fetches the collection once and incrementally updates one natural-key map after successful creates. | The genuine multi-create repository call-count regression in `administration.unit.test.ts` mutation-checks a per-row rescan and proves exactly one commit-time collection read. | `19159bc`, `ffa5b0f` |
| F6 | Restored bounded global Formidable transport caps of 50 MiB per file and 250 MiB total while retaining the workflow's exact one-file, 5 MiB import contract. | Global-config unit coverage locks both transport values; mounted two-file, oversize, and unexpected-field zero-write checks retain the stricter workflow boundary. | `19159bc`, `ffa5b0f` |
| F7 | Collection config now drives list, create, detail, and import metadata for every route shape. | Browser title assertions caught the shared Risk Type titles and all collection-specific titles now pass. | `4c51ab6` |
| F8 | Added segment loading/error boundaries and transition-driven disabled controls plus contextual live loading status. | Boundary and pending-state regressions failed before the route files and transition wiring existed and now pass. | `4c51ab6` |
| F9 | Search and framework controls retain local input and synchronize canonical URL state after 300 ms. | Fake-timer typing regressions reproduced snapback/eager navigation and now verify one debounced replacement. | `4c51ab6` |
| F10 | Each Yes/No fieldset now has a programmatic name with associated help and error state. | RTL accessibility queries could not name the former groups; named-group coverage now passes. | `4c51ab6` |
| F11 | Deleted the duplicate mobile shortcut strip and its fake sign-out; the drawer remains the sole mobile Administration navigation. | Mobile tab/focus and six-width Playwright coverage passes after explicitly opening the drawer. | `4c51ab6`, `3952105` |
| F12 | Web query parsing strips foreign keys, takes the first duplicate, and defaults invalid values; strict server list errors map to safe 400 responses. | Duplicate/foreign/invalid query and mounted controller regressions previously threw or returned 500 and now pass. | `13da3d7`, `4c51ab6` |
| F13 | Import filters expose pressed state, busy navigation becomes a disabled non-link, progress is indeterminate, file errors are associated, and rows paginate at 100 with mobile cards. | RTL and responsive browser checks failed on the old controls and unbounded table; accessible paginated states now pass. | `4c51ab6` |
| F14 | Import row states use semantic icon-plus-text variants and completion emits the exact aggregate toast. | State-variant and toast assertions were absent/failing and now pass through the production result transition. | `4c51ab6` |
| F15 | All four Create actions use the filled primary variant; Import CSV remains outline. | Cross-collection CTA regression exposed three outline Create buttons and now passes. | `4c51ab6` |
| F16 | Applicable Controls now tracks expansion, references only a mounted listbox, and announces option availability. | Combobox ARIA regression failed on missing expansion/mounted-target state and now passes. | `4c51ab6` |
| F17 | Filtered-empty panels include Clear filters and first-use panels include Create. | Empty-state action queries initially failed and now pass for both states. | `4c51ab6` |
| F18 | Unknown collection slugs call `notFound()`; genuine authorization denial retains the bounded permission state. | Route regression distinguished typo from denial only after the closed-config validation was added. | `4c51ab6` |
| F19 | Both themes define the sidebar border token, counts share locale formatting, and config-driven breadcrumbs cover list and subroutes. | CSS, count, breadcrumb, and browser assertions exposed the missing/inconsistent presentation and now pass. | `4c51ab6`, `3952105` |
| F20 | Removed the eight disabled legacy CRUD path objects, regenerated types, deleted the obsolete RED verifier, and made integrity parse both mounted auth declarations with hostile fixtures. | API diff and hostile in-memory route mutations failed before the cleanup/parser work; `api:check` and integrity now pass with zero removed-path consumers. | `2ae2312`, `ab91614` |
| F21 | Removed legacy import test props/digest fallback, drove RTL through production actions, and included matched `updatedAt` in reviewed snapshots so concurrent edits yield `ROW_PREVIEW_DRIFT` without overwrite; documented the frozen-schema limitations. | Production-action and concurrent-PATCH mounted regressions first exposed bypass/value overwrite and now preserve the concurrent value while continuing eligible rows. | `19159bc`, `4c51ab6` |

## Verification

- Runtime: `node --version` -> `v24.19.0` with the mandated PATH prefix.
- Strapi: `npm test` -> 124 passed.
- Web typecheck: `pnpm typecheck` -> passed.
- Web unit/component suite: `pnpm test` -> 36 files, 286 tests passed.
- Generated contract: `pnpm api:check` -> passed with no generated diff.
- Browser suite: `pnpm test:e2e` -> 16 passed across Administration, requestor, assessment, questionnaire, risk, accessibility, and responsive shell journeys.
- Integrity: `node scripts/verify-phase-06-integrity.mjs` -> all checks passed, including both hostile mounted token-gate fixtures.
- Frozen data: all 15 content-type schema blobs match pre-remediation commit `f4d9452`; both catalogue copies remain byte-identical at SHA-256 `9A25C2E3AFF75A9FFF187B0D44CC4E10C2E762E44CF1F9BFCB208453200C4B6F`.
- Hygiene: `git diff --check` passed; no dependency or lockfile change, secret, attribution, raw UI fetch, frontend facade, skipped/focused test, fabricated digest, production injected-error branch, Phase 7 edit, roadmap edit, push, or Phase 6 completion occurred.

## Deviations from Plan

### Auto-fixed Issues

1. **Rule 3 - Verification output bound:** The larger generated-contract deletion exceeded the verifier's default child-process buffer. The buffer is now explicitly bounded high enough to inspect the complete Phase 6 diff (`ab91614`).
2. **Rule 1 - Relation identity mismatch:** Full mounted tests showed that the trusted repository must translate public owner document IDs to Strapi's numeric relation identity. The boundary translation preserves the public contract (`5bb5056`).
3. **Rule 1 - Picker authorization regression:** Migrating disabled inventory paths revealed that requestor creation still needs queryless inventory reads. Routes now distinguish queryless picker grants from analyst-only administration queries without weakening server authorization (`3952105`).
4. **Rule 3 - Clean-start browser timing:** Isolated database seeding and first Next compilation exceeded the former startup bound. Each Playwright server retains a finite ten-minute startup timeout (`a82520c`).

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| `threat_flag: authorization-scope` | `apps/strapi/src/policies/csrm-authorization.ts` | Queryless requestor picker reads use the existing generic read grant, while any caller-supplied list query remains restricted to the Administration operation. Mounted authorization tests cover both branches. |

## Decisions Made

- Preserve the frozen contract's 500-character location limits through repository persistence rather than changing schemas.
- Treat preview drift at row granularity using the matched record timestamp; per-field drift remains an explicit documented limitation.
- Keep system/asset natural-key uniqueness as a serialized single-process guarantee because content-type schemas are frozen.
- Do not update planning state or phase status as part of this executor handoff; the orchestrator retains that responsibility.

## Self-Check: PASSED

The summary exists, all nine remediation commits resolve in Git, all listed key files exist, and the final finding identifier multiset is exactly the complete 1-through-21 sequence with one occurrence each.
