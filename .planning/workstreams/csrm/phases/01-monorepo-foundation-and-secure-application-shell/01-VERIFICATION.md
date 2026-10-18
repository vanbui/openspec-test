---
phase: 01-monorepo-foundation-and-secure-application-shell
verified: 2026-08-29T09:55:53Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Requestor birthright no longer receives canonical hard DELETE; mounted HTTP and persistence coverage proves owner Requestor denial and exact-grant Security Analyst deletion."
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "Requestors cannot create requests in, or transition requests directly to, privileged workflow states."
    addressed_in: "Phases 2 and 4"
    evidence: "Phase 2 owns draft, edit, validation, and submission state rules; Phase 4 owns analyst-controlled review and release."
  - truth: "Assessment-request collection pagination follows the public REST pagination contract."
    addressed_in: "Phase 2"
    evidence: "REQ-01 and Phase 2 success criterion 1 explicitly require paginated My Requests."
  - truth: "Playwright exercises the built production runtime and proves development sign-in is unavailable in production."
    addressed_in: "Phase 8"
    evidence: "Production authentication and critical-journey hardening are Phase 8 responsibilities."
---

# Phase 1: Monorepo Foundation and Secure Application Shell Verification Report

**Phase Goal:** Establish the Turborepo, move the existing Strapi application into `apps/strapi`, create the Next.js `apps/web` foundation, and prove the shared security, API, design, and test boundaries.

**Verified:** 2026-08-29T09:55:53Z
**Status:** passed
**Re-verification:** Yes — after closure of the remaining FOUND-04 gap

## Goal Achievement

The remaining security gap is closed. The authoritative and runtime catalogues give Requestor exactly the four canonical list/create/read/update assessment-request operations and place canonical DELETE in a separate API-only Function assigned only to Security Analyst and Security Analyst Agent. The normal Strapi test command independently crossed the mounted HTTP router, authorization policy, controller, and isolated SQLite persistence boundary: owner Requestor DELETE returned 403 and retained the record; the exact-grant Security Analyst then received 204 and removed it.

All five roadmap success criteria remain satisfied. The root Turbo graph completed 7/7 tasks, the generated OpenAPI transport has no drift, and the two catalogue copies are byte-identical with SHA-256 `6CDAE19B7E3BAFE3EB28AB0DDCA73CFCF0C7BC51D710B2B05CA4A347F5076267`.

The roadmap labels the phase `mode: mvp`, while its technical goal is not in canonical user-story syntax (`user-story.validate` returned `false`). This re-verification follows the explicit five-item technical roadmap contract and records the metadata inconsistency as informational; it does not alter the observable phase outcome.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | The repository runs reproducible root tasks for both workspaces with one package-manager and lockfile strategy. | VERIFIED | Root `package.json` delegates finite tasks to Turbo, `pnpm-workspace.yaml` contains `apps/*`, pnpm 11.24.0 is pinned, and only the root lockfile is tracked. `pnpm turbo run lint typecheck test build` completed 7/7 tasks. |
| 2 | The web application provides an accessible, responsive, semantic-token AppShell with capability-driven navigation and deliberate states. | VERIFIED | The protected layout wires session capabilities into reusable shell/navigation components; strict TypeScript, semantic theme tokens, mobile navigation, state components, and Playwright/axe coverage remain present. Web lint/typecheck/build and 23/23 unit/component tests passed in the root graph. |
| 3 | A typed service boundary uses the Strapi OpenAPI contract without ad-hoc production fetch calls. | VERIFIED | Generated `schema.d.ts`, the server-only transport client, and the shell service remain wired. `api:check` regenerated without drift; source scan found no page/component `fetch` or `axios` calls. Existing loopback coverage asserts `/applications` resolves through the canonical `/api/applications` base. |
| 4 | Authentication/capability adapters and Strapi establish least-privilege Role -> Function -> FunctionAPI and record-level authorization boundaries. | VERIFIED | Current graph traversal finds no Requestor path to canonical DELETE. Both analyst roles link to the separate API-only delete Function. Exact-operation policy wiring, active-account denial, IDOR ownership, trusted collection scope, server-derived create ownership, and mounted persistence behavior are covered by the passing Strapi suite. |
| 5 | Unit, component/integration, and Playwright E2E foundations run through CI-oriented tasks. | VERIFIED | CI installs Chromium, runs `api:check`, and invokes Turbo lint/typecheck/test/build/test:e2e. The current root graph passed 7/7 tasks, including 23/23 web tests and 6/6 Strapi tests; browser specifications and the finite `test:e2e` task remain wired. |

**Score:** 5/5 truths verified

### Deferred Items

These previously accepted items retain explicit later-phase ownership and do not reduce the Phase 1 score.

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | Requestor create/update must enforce valid workflow states and prevent privileged transitions. | Phases 2 and 4 | Phase 2 owns draft/edit/submit state rules; Phase 4 owns analyst review and release. Phase 1 context excludes implementation of the Requestor workflow. |
| 2 | Assessment-request collection pagination must implement the public REST pagination contract. | Phase 2 | REQ-01 and Phase 2 success criterion 1 explicitly own pagination. |
| 3 | Browser tests should run the built production server and prove development authentication fails closed. | Phase 8 | Production integration, authentication, and critical-journey hardening are explicit Phase 8 outcomes. |

## Gap Closure Verification: Plan 01-10

| Must-Have | Status | Evidence |
| --- | --- | --- |
| Owner Requestor DELETE returns 403 and preserves the record. | VERIFIED | `authorization.integration.test.ts:142-149` sends DELETE through the mounted route as the owner, asserts 403, then reads the same record from Strapi persistence. Independent `npm test` output recorded HTTP 403 and a passing named subtest. |
| Exact-grant Security Analyst DELETE returns 204 and removes the record. | VERIFIED | The same mounted sequence uses the retained record, sends DELETE as the explicitly assigned analyst, asserts 204, then asserts the document service returns `null` (`authorization.integration.test.ts:151-153`). |
| Requestor retains four canonical non-delete operations and no DELETE Function. | VERIFIED | Direct graph traversal produced GET collection, POST collection, GET item, and PUT item only; `requestorHasDelete` was false. Test lines 42-50 and 60-63 assert the exact core membership and absence of the delete Function. |
| Security Analyst and Security Analyst Agent receive DELETE through a separate API-only Function. | VERIFIED | Catalogue roles reciprocally reference `function.risk_assessment_requests.delete_api`; its `roleIds` contain exactly the two analyst roles and it has no `menuPath`. Test lines 52-66 assert both directions. |
| Every canonical operation occurs exactly once and both catalogues are byte-identical. | VERIFIED | Test lines 34-37 compare raw bytes using paths derived from compiled `__dirname`; lines 69-75 assert exact-once URL ownership for all operation constants. Both files independently hash to `6CDAE19B7E3BAFE3EB28AB0DDCA73CFCF0C7BC51D710B2B05CA4A347F5076267`. |

Plan 01-10 intentionally supersedes Plan 01-09's over-broad statement that all five served operations belong to one core Function assigned to Requestor. The later gap-closure contract preserves exact-once operation coverage while splitting destructive DELETE into the elevated Function; this is the required correction, not a regression or override.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `pnpm-lock.yaml` | Single reproducible workspace/task graph | VERIFIED | Both applications are workspace packages; one lockfile and finite Turbo dependencies remain in place. |
| `apps/strapi` | Migrated production backend without nested history or committed local state | VERIFIED | Strapi source/config is present under the workspace; no nested Git/planning history or legacy workspace lockfile is part of the migration. |
| `apps/web/app/layout.tsx`, `apps/web/src/components/shell/*`, `apps/web/app/globals.css` | Strict, semantic, responsive App Router shell | VERIFIED | Substantive, protected-layout wiring remains intact; current typecheck and production build pass. |
| `apps/web/src/lib/auth/development-session-adapter.ts` | Replaceable server-only development authentication seam | VERIFIED | Development cookie/session behavior remains isolated behind the adapter; production behavior fails closed. |
| `apps/web/src/lib/api/generated/schema.d.ts` | Committed OpenAPI-derived transport types | VERIFIED | Direct `api:check` passed with no diff. |
| `apps/web/src/lib/api/transport/server-client.ts` | Sole server-only typed Strapi transport | VERIFIED | Typed client creation and canonical `/api` base validation remain substantive and tested. |
| `apps/strapi/src/policies/csrm-authorization.ts` | Active-account, exact FunctionAPI, and ownership enforcement | VERIFIED | Route-wired policy denies absent operations before ownership evaluation and permits cross-owner access only through an explicitly assigned analyst role carrying the exact operation. |
| `docs/references/idambox-csrm-role-function-api-catalogue.json` | Authoritative least-privilege grant graph | VERIFIED | DELETE is unique and belongs only to the analyst-only API Function; Requestor reaches only four non-delete operations. |
| `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` | Runtime seed graph matching the authority | VERIFIED | Byte-identical to the authoritative file; used by `seedCsrmData` in the mounted harness. |
| `apps/strapi/tests/authorization.integration.test.ts` | Catalogue integrity and real HTTP/persistence authorization coverage | VERIFIED | Substantive 154-line suite compiled and ran under normal package `npm test`; all 6 tests passed. |
| `.github/workflows/ci.yml` | Contract-first CI quality harness | VERIFIED | Runs OpenAPI drift checking before the Turbo quality graph and includes Playwright. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Root scripts | Turbo graph | `turbo run` | WIRED | Root command completed 7/7 tasks across `@csrm/web` and `@csrm/strapi`. |
| Protected session layout | AppShell/navigation | granted capability set and centralized `can()` projection | WIRED | Capability navigation and adapter tests remain in the passing web suite. |
| Shell service | typed server client | typed `GET('/applications')` | WIRED | Service consumes generated transport types through the single server client; no page/component raw fetch was found. |
| Assessment-request router | authorization policy | five exact operation constants | WIRED | DELETE route supplies `CSRM_ASSESSMENT_REQUEST_OPERATIONS.delete` and `requireRequestOwnership: true`; policy first requires an effective exact-operation grant. |
| Policy | Role -> Function -> FunctionAPI graph | `loadEffectiveGrants` plus exact URL comparison | WIRED | Requestor's implicit and any duplicated explicit Requestor paths both lack DELETE; elevated DELETE is available only through an explicitly assigned analyst role. |
| Authoritative catalogue | bootstrap catalogue | complete raw-byte copy | WIRED | Direct byte comparison and SHA-256 parity pass; normal Strapi tests execute the parity assertion. |
| Bootstrap catalogue | mounted test database | production `seedCsrmData` call | WIRED | Harness invokes the production seeder after Strapi load, then routes loopback HTTP through Koa, policy, controller, and SQLite. |
| Mounted DELETE test | persisted request | `fetch` plus document-service re-read | WIRED | 403 retains the row; subsequent analyst 204 removes it. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| Capability navigation | granted capability set | server session adapter -> capability adapter -> protected layout | Yes; the typed set drives `can()` navigation filtering | FLOWING |
| Shell service | applications | generated Strapi client -> runtime validation -> domain model | Yes; loopback coverage observes the canonical request path and parses transport data | FLOWING |
| Assessment-request collection | documents and trusted scope | identity -> grant graph -> policy scope -> controller query -> SQLite | Yes; mounted tests seed two owners and assert returned document IDs | FLOWING |
| Request ownership | trusted Requestor relation | `ctx.state.idamboxUser` -> create controller -> SQLite | Yes; forged ownership is overwritten and persisted ownership is re-read | FLOWING |
| DELETE authorization | exact operation grant and target record | seeded catalogue -> policy -> mounted route -> controller -> SQLite | Yes; denied and allowed responses are paired with persistence reads | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Mounted authorization and catalogue integrity | `npm test` in `apps/strapi` | 6/6 pass; HTTP log includes Requestor DELETE 403 then analyst DELETE 204 | PASS |
| Workspace quality graph | `pnpm turbo run lint typecheck test build` | 7/7 tasks successful; web 23/23 and Strapi 6/6 tests pass; both production builds succeed | PASS |
| OpenAPI generation drift | `pnpm --filter @csrm/web api:check` | Exit 0; generated schema unchanged | PASS |
| Catalogue parity | SHA-256 plus raw byte comparison | Both hashes identical; `BYTE_IDENTICAL=true` | PASS |
| Content-type schema drift | Git path diff from the previous verification commit | `CONTENT_TYPE_SCHEMA_CHANGED=false` | PASS |

The local runtime was Node 22.19.0 while the root engine requests `>=24.19.0 <25`; pnpm emitted an engine warning, but all verification commands exited successfully. This is an environment alignment warning, not a source failure.

### Probe Execution

No phase probe scripts are declared or present. Step 7c is not applicable.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| FOUND-01 | 01-01, 01-05 | Reproducible Turbo tasks for both workspaces | SATISFIED | Single pnpm workspace/lockfile and successful 7-task root graph. |
| FOUND-02 | 01-02, 01-05 | Strict App Router, semantic theme, responsive reusable shell | SATISFIED | Strict TypeScript, semantic token shell, capability navigation, states, and browser test foundation remain wired; current web checks pass. |
| FOUND-03 | 01-04, 01-06 | OpenAPI-derived typed service boundary without page fetches | SATISFIED | Generated schema, one server-only client, validated REST base, feature service, no frontend facade, and no page/component raw fetch. |
| FOUND-04 | 01-02, 01-03, 01-04, 01-07, 01-08, 01-09, 01-10 | Capability projection plus Strapi FunctionAPI and record authorization | SATISFIED | Exact-grant and record-level enforcement pass at mounted HTTP/persistence boundary; Requestor has no DELETE path and both analyst roles have the separate API-only delete Function. |
| FOUND-05 | 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09 | Unit, component/integration, E2E, and deliberate states | SATISFIED | Web and backend automated suites, Playwright/axe specifications, deliberate state components, and CI task wiring are present and current finite checks pass. |

No Phase 1 requirements are orphaned. All five FOUND IDs appear in phase plans and have implementation evidence.

### Plan Must-Have Coverage

| Plan | Must-have outcome | Status | Evidence |
| --- | --- | --- | --- |
| 01-01 | Root-only Git/planning authority, one pnpm lockfile, Turbo task graph | VERIFIED | Workspace files and repository layout remain correct; root graph passes. |
| 01-02 | Semantic responsive shell, centralized development role seam, validated internal return paths | VERIFIED | Shell/auth/capability artifacts remain substantive and web checks pass. |
| 01-03 | Backend tests prove FunctionAPI and record-level denial | VERIFIED | Direct policy runner plus mounted suite run under the package test command. |
| 01-04 | Typed server-only service boundary, deterministic OpenAPI generation, documented backend contract gaps | VERIFIED | `api:check` passes; transport/service files remain wired; no frontend API facade exists. |
| 01-05 | Unit/component/browser accessibility coverage and contract-first CI order | VERIFIED | CI and finite test tasks remain wired; root suite passes. |
| 01-06 | Canonical `/api` base validation and real loopback `/api/applications` composition | VERIFIED | Transport tests remain in the passing 23-test web suite. |
| 01-07 | Active denial, exact analyst grants, trusted collection scope/create ownership, five canonical route operations | VERIFIED | Policy/routes/controllers are wired and mounted HTTP tests cover the security paths. |
| 01-08 | Real Strapi/Koa/SQLite boundary with own/all scope, IDOR, and missing-identity denial | VERIFIED | Harness boots actual Strapi, mounts middleware before router, seeds production data, listens on loopback, and re-reads persistence. |
| 01-09 | Catalogue parity, canonical exact-once operations, mounted GET/PUT/DELETE matrix | VERIFIED AS SUPERSEDED | Exact-once and matrix outcomes remain verified. Its former bundled-five-operation assignment is superseded by Plan 01-10's least-privilege split. |
| 01-10 | Requestor DELETE denial, analyst DELETE success, four-plus-one graph split, parity | VERIFIED | All five plan truths pass through static topology assertions and mounted persistence behavior. |

### Review Warning Reconciliation

| Review finding | Classification | Evidence and rationale |
| --- | --- | --- |
| WR-01 — upgrade seeding may retain a detached legacy DELETE FunctionAPI record | WARNING — NON-BLOCKING | `seed-csrm-data.ts:475-516` searches reusable FunctionAPIs only within the currently processed Function. A pre-split re-seed can therefore leave the old record detached and create the new linked record. The stale record has no Role -> Function path and cannot authorize a request, so it does not invalidate FOUND-04's current grant or enforcement boundary. Add an upgrade-transition regression and global reconnect/delete handling during persistence hardening. |
| WR-02 — mounted suite does not separately exercise an implicit-only Requestor or an explicitly assigned Security Analyst Agent | WARNING — NON-BLOCKING | The mounted owner has an explicit Requestor assignment in addition to the policy's implicit birthright role; the Agent-named negative fixture has no elevated role. Static graph traversal plus `loadEffectiveGrants` proves implicit-only Requestor cannot acquire DELETE, and reciprocal catalogue assertions prove the Agent role receives the elevated Function. The missing permutations reduce regression breadth but do not contradict a Phase 1 must-have. Add explicit mounted cases when expanding authorization coverage. |

Disconfirmation check: WR-02 is the partially covered path, the mounted owner test is potentially misleading if read as implicit-only coverage, and WR-01 is the uncovered upgrade error path. None supplies a working Requestor DELETE path or invalidates the phase goal, so they remain warnings rather than blockers.

### Anti-Patterns Found

No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `PLACEHOLDER`, empty implementation, or console-only handler marker was found in the three Plan 01-10 implementation/test artifacts. `git diff --check` passed. No content-type schema changed. The only untracked path is the pre-existing unrelated `docs/design/`, which was not modified by verification.

### Human Verification Required

None. The remaining gap and all Phase 1 technical success criteria are deterministically verifiable through source inspection, graph traversal, compilation, mounted HTTP behavior, persistence reads, and finite test/build commands. No deferred `<human-check>` blocks were found in the phase plans.

### Gaps Summary

No blocking gaps remain. The previous Requestor hard-DELETE overgrant is closed without changing route, policy, schema, package, or OpenAPI contracts. The two review warnings are worthwhile robustness follow-ups but neither creates a current authorization bypass nor defeats an explicit Phase 1 must-have.

---

_Verified: 2026-08-29T09:55:53Z_
_Verifier: phase goal-backward verification_
