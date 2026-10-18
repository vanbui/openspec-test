---
phase: 05-risk-register-and-mitigation-management
verified: 2026-09-01T21:36:21+10:00
status: passed
score: 37/37 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 30/31
  gaps_closed:
    - "The Risk Register now supports an inclusive target-date start, end, or closed range through the authorised repository, OpenAPI/generated client, strict browser state, responsive controls, and isolated browser journey."
  gaps_remaining: []
  regressions: []
human_verification:
  status: passed
  approved: 2026-09-01
  evidence: "The populated Risk Register and mutable/released Risk details passed live visual verification at 375px and 1440px with clear hierarchy, responsive presentation, no clipping or page-level overflow, and correct read-only treatment. Consecutive Playwright runs passed 12/12 twice."
---

# Phase 5: Risk Register and Mitigation Management Verification Report

**Phase Goal:** As a Security Analyst, I want to search, filter, sort, and maintain contextual Risks and their mitigation-control implementations in an organisation-level register, so that I can track and manage risk exposure across all assessments.
**Verified:** 2026-09-01T21:36:21+10:00
**Status:** passed
**Re-verification:** Yes — after Plans 05-10 through 05-12 closed the sole prior gap

## User Flow Coverage

| Step | Expected | Evidence in codebase | Status |
|---|---|---|---|
| Open register | An explicitly granted human Security Analyst reaches `/app/risks`; denied actors learn no Risk facts | Capability gate in `apps/web/app/(app)/app/risks/page.tsx:13-20`; exact-human scope in `apps/strapi/src/policies/csrm-authorization.ts:170-178`; mounted/browser denial coverage | VERIFIED |
| Search/filter/sort/page | All required risk, rating, ownership, date, relationship, and mitigation dimensions are server-authoritative | Closed parser and shared SQLite predicate in `risk-register-query.ts:51-56,96-111,123-150` and `risk-register.ts:264-302,369-380`; mounted combination/date/pagination tests | VERIFIED |
| Use a target-date range | One-sided, equal, and closed inclusive bounds work; invalid state fails closed | Backend predicates at `risk-register.ts:275-276`; strict browser schema at `risk-schema.ts:44-72`; route makes no data calls after validation failure at `page.tsx:19-24` | VERIFIED |
| Open contextual Risk | A register row opens complete contextual Risk detail distinct from reusable Risk Type data | Five ordered detail sections and contextual/reusable labels in `risk-details.tsx`; generated detail service and mounted tests | VERIFIED |
| Maintain Risk and mitigations | Mutable Risk edits and mitigation-control add/edit/remove persist after authoritative refresh | Typed server actions, `risk-details.tsx:32-46,70-102`, focused lifecycle tests, and repeatable isolated E2E persistence | VERIFIED |
| Preserve release/security boundary | Released parents expose no mutations; Requestor denial remains non-enumerating | Server-owned parent lock, transaction recheck, zero-affordance component tests, and existing/random browser denial assertions | VERIFIED |
| Outcome | Track and manage risk exposure across all assessments | Global register repository, assessment relations, full filter matrix including dates, and persistent detail/mitigation management all flow through real data | VERIFIED |

## Goal Achievement

### Observable Truths

The three earlier plan truths that deliberately rejected or omitted date filters (05-02, 05-03, and 05-04) are not counted as current must-haves: Plans 05-10 through 05-12 explicitly supersede that temporary contract. No override of RISK-01 was used.

| # | Truth | Status | Evidence |
|---:|---|---|---|
| 1 | Responsive search/filter/sort/pagination covers required risk, rating, ownership, date, relationship, and mitigation fields | VERIFIED | Date gap is closed end to end; all pre-existing dimensions passed quick regression and the exact full product gate. |
| 2 | Risk Details distinguish contextual Risk from reusable Risk Type and expose full mitigation-control management | VERIFIED | Five-section detail, typed mutations, released lock, focused tests, and browser persistence remain wired. |
| 3 | Assessment-created/edited records are discoverable subject to server-side authorization | VERIFIED | Global `csrm_risks` query, assessment relation, exact analyst scope, and isolated fixture journey. |
| 4 | 05-01 Bob happy path is specified and executable | VERIFIED | Final Playwright journey performs register, detail, Risk edit, and mitigation maintenance. |
| 5 | 05-01 Jane learns no count/existence clue and released data has no mutation affordance | VERIFIED | Mounted and browser assertions compare list plus existing/random detail denial and released zero-action rendering. |
| 6 | 05-02 granted analyst receives a bounded page with every approved filter/sort | VERIFIED | Closed parser/repository and mounted all-filter composition test. |
| 7 | 05-02 totals, semantic ordering, null-last dates, and pagination are globally honest | VERIFIED | Count and ordered page execute in SQLite before hydration; honest empty/out-of-range tests pass. |
| 8 | 05-02 Requestors and ungranted identities receive denial before record work | VERIFIED | Route policy requires human analyst scope; service asserts scope before parsing; mounted denial matrix is unchanged. |
| 9 | 05-03 mounted read has closed OpenAPI/generated types | VERIFIED | Canonical operation and generated declaration agree; `api:check` passes. |
| 10 | 05-03 web serializes canonical query and rejects hostile/over-populated responses | VERIFIED | Strict Zod boundary and generated `client.GET`; schema/service tests pass. |
| 11 | 05-03 catalogue, route, OpenAPI, generated client, and copies remain in parity | VERIFIED | Integrity gate passed; catalogue copies remain byte-identical at the locked SHA-256. |
| 12 | 05-04 Bob can search/filter/sort/page/clear/open Risks from a shareable URL | VERIFIED | Canonical URL writer and responsive register component/browser tests pass. |
| 13 | 05-04 accessible table/cards use honest totals | VERIFIED | Shared DataTable, mobile cards, viewport geometry, and server pagination evidence. |
| 14 | 05-04 populated/loading/empty/error/permission states retain deliberate copy | VERIFIED | Route Suspense/error/permission branches and component tests remain substantive. |
| 15 | 05-05 complete contextual Risk detail has all five UI groups and bounded relations | VERIFIED | Detail aggregate and five ordered `DetailSection` groups remain wired. |
| 16 | 05-05 complete released/mutable parents get a server-owned lock and partial facts fail closed | VERIFIED | Repository projection and mounted partial-release matrix remain intact. |
| 17 | 05-05 Jane receives no clue for existing/random Risk IDs | VERIFIED | Exact-grant policy precedes lookup; mounted/browser comparisons pass. |
| 18 | 05-06 isolated workflow has a stable editable Risk with contextual mitigation | VERIFIED | Triple-gated seed, repository read, and browser journey use real persisted rows. |
| 19 | 05-06 seed fresh/repeat/repair runs are idempotent and preserve reusable/released facts | VERIFIED | Seed integration coverage remains part of the 96-test Strapi gate. |
| 20 | 05-06 fixture activates only under every development/seed/identity gate | VERIFIED | Seed gates and negative integration cases remain unchanged. |
| 21 | 05-07 detail read is a closed generated contract with catalogue parity | VERIFIED | Generated DTO, mounted route, and integrity hash checks pass. |
| 22 | 05-07 actions reuse existing mutations, submit deltas, and refresh after conflict | VERIFIED | Typed action tests and authoritative 409 handling remain green. |
| 23 | 05-08 Bob sees five ordered sections and distinguishes contextual/reusable records | VERIFIED | `risk-details.tsx` and component ordering assertions. |
| 24 | 05-08 mutable Risk supports delta edits and accessible mitigation add/edit/remove | VERIFIED | Editors, server actions, live status, focus restoration, and persistence evidence. |
| 25 | 05-08 released/safe states expose no mutations or Risk facts | VERIFIED | Structural no-form/action tests and browser denial assertions. |
| 26 | 05-09 original RED journey is GREEN on isolated real servers | VERIFIED | Orchestrator final gate: 12/12 Playwright tests on 1338/3100; Risk journey is discovered and substantive. |
| 27 | 05-09 no sentinel, escape, schema/raw-fetch/colour/catalogue/package/live-port violation survives | VERIFIED | Independent `node scripts/verify-phase-05-integrity.mjs` passed every named check. |
| 28 | 05-09 validation rows map to executable commands | VERIFIED | Reconciled `05-VALIDATION.md` includes all historical and six gap-task rows. |
| 29 | 05-10 analyst can filter by inclusive start, end, equal, or closed target-date range | VERIFIED | Parser plus `>=`/`<=` predicates; mounted cases at `risk-register.integration.test.ts:146-175`. |
| 30 | 05-10 date totals/pages share the authorised pre-pagination predicate, including zero matches | VERIFIED | `applyFilters` is called by both `count` and `orderedQuery`; empty page preserves requested page/pageSize with total/pageCount zero. |
| 31 | 05-10 malformed/impossible/repeated/overlong/inverted ranges fail closed and denial stays first | VERIFIED | Exact parser matrix plus mounted 400/403 tests; service order is `assertRiskRegisterScope` then parse. |
| 32 | 05-11 canonical URL/generated service preserve valid ranges and reject invalid browser state | VERIFIED | `riskRegisterQuerySchema.safeParse` gates the route before all five data calls; generated `client.GET` receives serialized canonical bounds. |
| 33 | 05-11 desktop/mobile surfaces expose labelled keyboard-operable date controls | VERIFIED | Shared labelled native inputs and 44px clear action in `risk-register-filters.tsx:67-80`; component and browser keyboard coverage. |
| 34 | 05-11 bounds participate in counts, chips, page reset, individual/paired/global clearing | VERIFIED | `risk-register.tsx:28-40,90-111,126-130`; component tests preserve sort/pageSize. |
| 35 | 05-12 real browser proves inclusive bounds, totals, persistence, composition, empty result, and clearing | VERIFIED | `risk-register-workflow.spec.ts:182-275` exercises equal bounds, all filter families, zero total, and individual/paired/global clearing. |
| 36 | 05-12 Requestor denial remains non-enumerating | VERIFIED | Browser assertions at `risk-register-workflow.spec.ts:369-389` expose no count, date/filter control, Risk number, or existing/random clue. |
| 37 | 05-12 contract record/validation are reconciled and all integrity/product gates pass | VERIFIED | Gap doc says resolved; validation maps 05-10-01..05-12-02; independent integrity plus orchestrator exact gates are green. |

**Score:** 37/37 current merged must-have truths verified

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/strapi/src/api/csrm-risk/services/risk-register-query.ts` | Closed exact target-date parsing | VERIFIED | Exists, substantive, allowlists both keys, UTC round-trips calendar components, rejects inverted ranges. |
| `apps/strapi/src/api/csrm-risk/services/risk-register.ts` | Authorised shared inclusive predicate | VERIFIED | Scope assertion precedes parse/repository; one `applyFilters` path feeds count and page selection before offset/limit. |
| `docs/references/specification.json` | Canonical optional date query parameters | VERIFIED | Both optional `format: date` parameters occur immediately before sort. |
| `apps/web/src/lib/api/generated/schema.d.ts` | Generated typed date transport | VERIFIED | Both optional string properties present; independent integrity run reports generated drift false. |
| `apps/web/src/features/risks/risk-schema.ts` | Strict browser/query boundary | VERIFIED | Valid bounds round-trip; blank, repeated, malformed, impossible, and inverted input fails validation. |
| `apps/web/app/(app)/app/risks/page.tsx` | Permission-first, fail-closed page boundary | VERIFIED | Capability denial precedes parsing; parse failure renders non-data state before register/picker calls. |
| `risk-service.ts`, `risk-register-filters.tsx`, `risk-register.tsx` | Typed service plus accessible responsive controls | VERIFIED | Generated client is wired; shared date inputs, chips, count, reset, and clear behavior are substantive. |
| `apps/web/e2e/risk-register-workflow.spec.ts` | Isolated full-stack acceptance proof | VERIFIED | No interception/sentinel/focus/skip/live-port escape; covers the required date, denial, and persistence journey. |
| `05-UI-SPEC.md`, `05-VALIDATION.md`, resolved gap doc | Reconciled authoritative contracts | VERIFIED | No operative obsolete omission/rejection contract remains. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Risk route | exact analyst authorization | mounted policies + scope state | WIRED | Token/app/policy gates run before controller service; Requestor and agents are denied. |
| Register service | parser/repository | scope → parse → Promise.all count/page/labels | WIRED | Authorization remains before malformed-query disclosure and record work. |
| Parser filters | `csrm_risks.target_date` | shared `applyFilters` | WIRED | Inclusive bounds feed both total and selected page before pagination. |
| OpenAPI | generated schema | canonical generation/API drift check | WIRED | Both layers expose the same optional date-only parameters. |
| Page URL state | typed service | strict safeParse → serialize → generated `client.GET` | WIRED | Invalid state renders without any data call; valid state preserves either/both bounds. |
| Shared filter UI | canonical URL | `onChange` → page reset → `router.replace` | WIRED | Desktop popover and mobile Sheet reuse one labelled date fieldset. |
| Browser journey | isolated production paths | real 3100 web → 1338 Strapi | WIRED | Equal bounds, composition, empty result, clearing, denial, and persistence are covered. |

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| Risk Register | `query`, `risks`, `pagination`, `selectedLabels` | URL → strict schema → generated GET → analyst policy → SQLite count/page → bounded hydration | Yes | FLOWING |
| Date controls | `targetDateFrom`, `targetDateTo` | Native inputs → canonical URL → typed request → shared SQL predicate | Yes; equal/one-sided/closed/zero ranges tested | FLOWING |
| Risk Details | `detail` | typed detail GET → scoped repository → bounded implementations | Yes | FLOWING |
| Risk/mitigation editors | changed allowlisted values | form → typed mutation → transaction/release check → DB → revalidation | Yes; repeatable browser persistence tested | FLOWING |

## Behavioral Spot-Checks

| Behavior | Command/evidence | Result | Status |
|---|---|---|---|
| Focused web date, route, UI, detail, and feedback behavior | `corepack pnpm --filter @csrm/web exec vitest run` for six Risk files | Independently run: 6 files, 75/75 tests passed | PASS |
| Phase integrity | `node scripts/verify-phase-05-integrity.mjs` | Independently run: every branch/runtime/schema/catalogue/auth/anti-escape/transport/token/port/API check passed | PASS |
| Exact Strapi gate | `cd apps/strapi && npm test` | Full Strapi suite passed | PASS |
| Exact complete web gate | `cd apps/web && pnpm typecheck && pnpm test && pnpm api:check && pnpm test:e2e` | Typecheck, 253/253 Vitest, API drift check, and two consecutive 12/12 Playwright runs passed | PASS |
| Production build | web build | Final gate: production build passed | PASS |

## Probe Execution

No `probe-*.sh` scripts are declared. The phase-specific integrity executable was independently run under Behavioral Spot-Checks and passed.

## Requirements Coverage

| Requirement | Source plans | Status | Evidence |
|---|---|---|---|
| RISK-01 | 05-01..05-04, 05-06, 05-09..05-12 | SATISFIED | Search, every required filter family including inclusive dates, all sorts, honest pagination, strict URL/API transport, and responsive browser controls are implemented and tested. |
| RISK-02 | 05-01, 05-05..05-09 | SATISFIED | Complete detail, Risk edits, mitigation add/edit/remove, release lock, persistence, and non-enumerating denial remain verified. |

No orphaned Phase 5 requirements exist: ROADMAP and REQUIREMENTS map exactly RISK-01 and RISK-02, and both are claimed by plans.

## Frozen Contract and Security Invariants

- Independent integrity verification confirmed frozen content schemas/packages/lockfile and inspected 68 changed paths.
- Catalogue copies are byte-identical at SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- Neither Risk read is exposed through users-permissions public grants.
- No raw Risk feature fetch, literal feature colour, sentinel/focused test/conditional escape, generated drift, or executable reference to live 1337/3000 survives.
- The branch remains `dylan-test`; user-owned dirty `next-env.d.ts`, `tsconfig.json`, `.planning/debug/`, and `apps/web/.tmp/` were not altered by verification.

## Review Findings and Anti-Patterns

All 18 findings in `05-REVIEW-FINDINGS.md` were fully remediated through quick tasks `260901-oiw` and `260901-qri`. The disposition ledger retains every finding, including duplicate pairs, with implementation and regression evidence; none were deferred.

No unreferenced `TBD`, `FIXME`, or `XXX` marker was found in Phase 5 production/test files. `return null` and “not available” matches are nullable domain projections or intentional closed failure states, not stubs.

## Human Verification Completed

### 1. Visual finish at representative widths

**Approved:** 2026-09-01

The populated Risk Register and mutable/released Risk details were verified live at 375px and 1440px. The register retained clear hierarchy, sortable severity presentation, responsive filters, honest counts, contained desktop scrolling, and a mobile card layout with no clipping or page-level overflow. Released details showed all five sections and no mutation affordances; the mutable fixture exposed the expected editing controls. The complete evidence is recorded in `05-HUMAN-UAT.md`.

## Gaps Summary

No gap remains. The previous RISK-01 date-filter gap is closed without an override, all 37 current merged must-haves are verified, all 18 review findings are remediated with none deferred, the complete automated gate is green, consecutive Playwright runs pass 12/12 twice, and human visual verification passed.

---

_Verified: 2026-09-01T21:36:21+10:00_
_Verifier: Phase 5 verification_
