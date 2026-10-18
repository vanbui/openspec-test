---
phase: 02-requestor-risk-assessment-request-workflow
verified: 2026-08-30T01:43:04+10:00
status: passed
score: 25/25 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 0/1
  gaps_closed:
    - "The Phase 2 MVP goal is now a valid user story with an observable outcome."
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "The Requestor dashboard can populate recently released assessments from an authoritative persisted release fact."
    addressed_in: "Phase 4"
    evidence: "Phase 4 explicitly owns analyst release and the resulting authorised Requestor read-only assessment; Phase 2 correctly does not equate approval with release."
human_verification:
  status: passed
  completed: 2026-08-30T02:20:00+10:00
  evidence: "The complete Requestor journey passed responsive visual and interaction review at 375px and 1440px against live Strapi and Next.js servers."
---

# Phase 2: Requestor Risk Assessment Request Workflow Verification Report

**Phase Goal:** As a Requestor, I want to create, save, edit, submit, and track only my authorised Risk Assessment Requests, so that I can initiate and follow cyber-risk work without crossing record or workflow boundaries.
**Verified:** 2026-08-30T01:43:04+10:00
**Status:** passed
**Re-verification:** Yes — after MVP user-story pre-flight gap closure

## MVP User-Story Pre-flight

`gsd-sdk query user-story.validate` returned `valid: true` and extracted:

- Role: Requestor
- Capability: create, save, edit, submit, and track only authorised Risk Assessment Requests
- Outcome: initiate and follow cyber-risk work without crossing record or workflow boundaries

The previous verification's only blocker is closed. Because that report stopped at pre-flight, all implementation must-haves were verified at full depth in this pass.

## User Flow Coverage

| Step | Expected | Codebase/runtime evidence | Status |
| --- | --- | --- | --- |
| Sign in | A Requestor reaches the authorised workspace through the development-only fixture bridge. | `development-session-adapter.ts` maps Requestor to Jane; `server-client.ts` derives the header server-side; mounted gate matrix and Playwright sign-in passed. | VERIFIED |
| Open My Requests | Only owner-authorised requests are listed with status, search, filters, sorting, and bounded pagination. | `csrm-authorization.ts` sets trusted owner scope; `collection-scope.ts` applies it to data and count; `/app/requests/page.tsx` uses `listRequests`; mounted hostile-filter and browser list checks passed. | VERIFIED |
| Create and save | The structured form persists real CSRM fields and system/asset relations as an owner-bound draft. | `request-form.tsx` uses shared Zod input and Server Actions; Strapi creates server-owned owner, number, draft status, and timestamps; Playwright saved and reloaded real data. | VERIFIED |
| Resume and edit | Persisted draft values and relations reload and can be edited only while status is draft. | `getRequest` hydrates the two relation projections; edit defaults come from the persisted record; mounted workflow tests and Playwright reload/edit checks passed. | VERIFIED |
| Submit | Submission requires explicit irreversible confirmation, persists `submitted` plus server time, and removes edit controls. | `ConfirmDialog`, `submitRequestAction`, and Strapi `prepareRequestorUpdate` form one-way flow; repeated transition is rejected; browser status/date/no-edit checks passed. | VERIFIED |
| Track | The submitted request is discoverable through authorised list controls and dashboard widgets use owner-scoped service data. | Playwright searched/filtered/sorted the submitted record; dashboard uses `getRequestorDashboard` over `listDashboardRequests`. | VERIFIED |
| Preserve boundaries | Another owner, an anonymous caller, or a client-supplied workflow/owner fact cannot cross record or workflow boundaries. | Mounted HTTP tests passed cross-owner GET/PUT denial, hostile ownership-filter resistance, immutable server facts, anonymous denial, and unchanged persistence after rejected transitions; session-cleared detail navigation revealed no record content. | VERIFIED |
| Outcome | The Requestor can initiate and follow cyber-risk work without crossing record or workflow boundaries. | Complete real Strapi/Next Playwright journey passed plus mounted authorization/workflow tests. | VERIFIED |

## Goal Achievement

### Observable Truths

Roadmap success criteria are retained as the contract. Clear plan restatements are merged into the matching roadmap truth; plan-specific security, transport, accessibility, and wiring truths remain separately checked.

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Requestors see only authorised requests in a responsive, searchable, filterable, paginated My Requests view and dashboard action widgets. | VERIFIED | Owner scope drives both data and count; URL controls are bounded; mounted and browser checks passed. |
| 2 | New Request and Request Details use actual persisted CSRM fields rather than duplicate UI-only data. | VERIFIED | Shared schema maps persisted fields and relations through typed services; reload/edit browser proof passed. |
| 3 | Draft requests can be saved, resumed, and edited only while status permits. | VERIFIED | Strapi rejects non-draft Requestor updates; UI exposes mutation controls only for draft; persistence journey passed. |
| 4 | Submission validates the request, confirms the irreversible transition, and makes resulting workflow state clear. | VERIFIED | Shared validation, focus-managed confirmation, server transition/date, status badge, and browser assertions passed. |
| 5 | A complete browser contract covers create, save, reload, edit, submit, track, mobile, keyboard, and unauthenticated denial through real Next-to-Strapi data. | VERIFIED | `requestor-request-workflow.spec.ts` is substantive and independently passed. |
| 6 | The development identity resolves only active persisted users under both exact environment gates. | VERIFIED | Middleware checks exact development/true gates, exact email, active status, and contributes only persisted document ID; mounted matrix passed. |
| 7 | Development public permissions are idempotent, CSRM-only, and contain no IAM action. | VERIFIED | Closed six-action allowlist validates `api::csrm-`; mounted repeated seed and denial checks passed. |
| 8 | Only the server-only typed transport derives Jane/Bob fixture identity headers under exact gates. | VERIFIED | `server-client.ts` imports server-only adapter and exposes no caller header input; 11 transport tests passed. |
| 9 | The reusable DataTable supplies controlled sorting/filtering/pagination, responsive cards, persisted density, focus safety, and deliberate states. | VERIFIED | Substantive TanStack composite is used by RequestTable; focused component tests passed. |
| 10 | Strapi creates owner-bound drafts with unique server request numbers and ignores client-owned workflow facts. | VERIFIED | Controller invokes bounded crypto-number creation and `prepareRequestorCreate`; mounted mass-assignment assertions passed. |
| 11 | Requestor workflow permits only draft edits and the one-way draft-to-submitted transition with server `submittedDate`. | VERIFIED | Persisted state is loaded before mutation; repeat and invalid transitions return denial without persistence; mounted test passed. |
| 12 | Owner-scoped results and pagination metadata stay scoped despite hostile filters. | VERIFIED | One trusted scope builds `dataQuery` and `countQuery`; hostile requestor filter/populate integration case passed. |
| 13 | Generated API types model request query/pagination/relations and exclude server-owned create facts. | VERIFIED | Authoritative specification regenerated without drift; parsed contract integration test passed. |
| 14 | Requestor and analyst reference-data reads traverse exact catalogue grants while IAM and unrelated CRUD remain denied. | VERIFIED | Catalogue parity test and mounted GET/403/405 matrix passed. The SDK link check's false negative was caused by its conceptual non-file `from` value, not missing wiring. |
| 15 | My Requests distinguishes populated/loading/empty/filtered/error/permission states and closed service projections preserve only requested relations. | VERIFIED | Route, RequestTable, schema normalization, and service tests cover all states and over-population stripping. |
| 16 | The structured form creates, resumes, and edits persisted assessment-request fields and authorised relations. | VERIFIED | RHF/Zod form calls server actions; edit page receives hydrated defaults; component and browser checks passed. |
| 17 | Only drafts expose edit/submit; submit is revalidated, confirmed, irreversible, and displays authoritative returned status/date. | VERIFIED | Closed `canRequestorEdit`, shared submit schema/action, modal feedback, Strapi state machine, and browser check all agree. |
| 18 | Dashboard actions derive only from authorised typed request data. | VERIFIED | Server Component calls `getRequestorDashboard`; projection filters real owner-scoped request records. |
| 19 | Released-assessment presentation does not invent release from approval when no authoritative release fact exists. | VERIFIED | Service returns explicit `contract-unavailable`; UI states approved is not released. Actual released-data population is deferred to Phase 4. |
| 20 | Shared PageHeader and labelled semantic detail/form sections are reused without domain logic or raw brand colours. | VERIFIED | Single compatibility re-export and section composites are wired into routes/forms; semantic-token scan found no raw feature colours. |
| 21 | Every persisted request status is communicated by icon plus sentence-case label. | VERIFIED | Closed `Record<RequestStatus, StatusPresentation>` is rendered by list/detail/dashboard; exhaustive test passed. |
| 22 | Irreversible submission uses named focus-managed confirmation and one root notification provider. | VERIFIED | ConfirmDialog awaits/locks/restores focus; root layout mounts one Toaster; component and browser keyboard checks passed. |
| 23 | Browser-facing and Server Action mutation inputs share authoritative validation. | VERIFIED | `requestDraftSchema`/update/submit schemas are reused by form and action boundary; invalid-input tests passed. |
| 24 | Typed mutations cannot send client-owned requestor, request number, timestamps, release relations, or arbitrary sponsor-directory access. | VERIFIED | Closed service bodies and exact-property tests exclude those fields; no UI raw fetch or frontend API facade exists. |
| 25 | The original browser contract is green for creation, persistence/edit, submission, tracking, ownership denial, mobile, accessibility, and dashboard behavior. | VERIFIED | `pnpm --filter web test:e2e`: 9/9 passed, including the 6.5-second complete Requestor journey and axe/responsive suite. |

**Score:** 25/25 truths verified

### Deferred Items

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | Populate “recently released assessments” from a real persisted release fact. | Phase 4 | Phase 4 owns explicit analyst release and the resulting authorised Requestor read-only assessment. Phase 2 correctly refuses to infer release from approval. |

### Required Artifacts

| Artifact group | Expected | Status | Details |
| --- | --- | --- | --- |
| E2E/config | Full workflow contract and isolated dual servers | VERIFIED | Both artifacts substantive; real run passed 9/9. |
| Strapi development bridge | Exact-gated identity and least-privilege permission seed | VERIFIED | Registered, bootstrapped, mounted, and fail-closed. |
| Typed server transport | Server-derived development identity | VERIFIED | Server-only, gated, imported, and exercised. |
| DataTable/shared composites | Reusable accessible responsive presentation | VERIFIED | Imported and used by Phase 2 screens; focused tests passed. |
| Strapi request workflow | Owner scope, request number, writable allowlist, state machine | VERIFIED | Controller and policies invoke substantive services; mounted persistence tests passed. |
| OpenAPI/catalogue | Generated types and exact reference grants | VERIFIED | No generation drift; canonical/runtime catalogue parity passed. |
| Request service/list | Typed projections and authorised My Requests route | VERIFIED | Server Component awaits service; real Strapi data reaches table/cards. |
| Request form/routes/actions | Create/detail/edit/submit workflow | VERIFIED | Shared schemas → Server Actions → typed service → Strapi; browser persistence passed. |
| Dashboard | Owner-scoped action projection and honest release state | VERIFIED | Server Component → service → list operation → Strapi data; rendered in browser. |
| Status/confirmation/notifications | Non-color-only state and irreversible feedback | VERIFIED | Used by list/detail/form/dashboard; one root Toaster. |

The SDK artifact verifier returned 20/20 substantive artifacts. Manual Level 3 checks confirmed all production artifacts are imported and used rather than orphaned.

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Playwright workflow | Playwright config | base URL and ordered dual servers | WIRED | Real suite passed. |
| Strapi middleware config | Development identity middleware | global middleware registration | WIRED | Exact middleware name registered. |
| Web typed client | Development session adapter | server-only resolver/header | WIRED | Header derived internally only. |
| Request routes | Strapi policy/controller/workflow services | route policy and trusted actor state | WIRED | Mounted HTTP behavior passed. |
| Specification | Generated schema | deterministic generation | WIRED | `api:check` passed without drift. |
| Catalogue roles/functions/APIs | Reference-data routes | exact canonical operation grants | WIRED | Parsed graph plus mounted request matrix passed. |
| My Requests page | Request service | awaited typed list operation | WIRED | Dynamic real-data browser flow passed. |
| Request form | Server Actions | validated callbacks | WIRED | Create/update/submit component and browser flows passed. |
| Server Actions | Typed request service | parsed input to exact generated mutation | WIRED | Action/service tests passed. |
| Dashboard page | Dashboard service | awaited Server Component load | WIRED | Real dashboard rendered in E2E. |
| Root layout | Toaster | single provider mount | WIRED | Feedback contract test passed. |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
| --- | --- | --- | --- | --- |
| My Requests | `result.data.requests` | typed GET `/csrm-assessment-requests` → owner-scoped Strapi query/count | Yes | FLOWING |
| Request details/edit | `result.data` / form defaults | typed detail GET with systems/assets populate | Yes | FLOWING |
| Create/update/submit | parsed action input and returned mutation | Server Action → typed mutation → Strapi persisted document | Yes | FLOWING |
| Requestor dashboard | dashboard projection | typed dashboard list → owner-scoped Strapi records | Yes | FLOWING |
| Recently released assessments | `releasedAssessments` | no authoritative persisted release fact in current model | No, intentionally unavailable | DEFERRED TO PHASE 4 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Strapi regression suite | `pnpm --filter strapi test` | 11/11 tests passed | PASS |
| Strict web typing | `pnpm --filter web typecheck` | Exit 0 | PASS |
| Web unit suite | `pnpm --filter web test` | 44 tests passed | PASS |
| Generated API drift | `pnpm --filter web api:check` | Regenerated schema matches repository | PASS |
| Complete real browser workflow | `pnpm --filter web test:e2e` | 9/9 tests passed | PASS |
| Owner and workflow boundary | Mounted Strapi request workflow suite within `pnpm test` | Cross-owner GET/PUT denied; hostile filters scoped; repeat submission rejected | PASS |
| Reference-data authorization | Mounted contract/catalogue suite within `pnpm test` | Requestor/analyst exact reads allowed; anonymous, IAM, and unrelated mutations denied | PASS |

The pnpm launcher emitted an engine warning because its wrapper is installed beside Node 22.19.0, while `node` and `pnpm exec node` resolve Node 24.19.0. All checks completed successfully; this is an environment-wrapper warning, not implementation failure.

### Probe Execution

Step 7c: SKIPPED — no phase plan or summary declares a probe script, and no conventional Phase 2 probe exists.

### Requirements Coverage

| Requirement | Source plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| REQ-01 | 01–07, 09, 11 | Authorised request inventory with status and list controls | SATISFIED | Owner-scoped mounted tests, request service/table tests, and E2E list tracking passed. |
| REQ-02 | 01–06, 08–10, 12 | Structured persisted request creation | SATISFIED | Shared schema/action/service/Strapi flow and browser persistence passed. |
| REQ-03 | 01–06, 08–12 | Save, resume, and state-permitted draft editing | SATISFIED | Mounted draft state machine plus reload/edit browser flow passed. |
| REQ-04 | 01–06, 08–12 | Valid submission with clear workflow confirmation | SATISFIED | Explicit confirmation, server-owned transition/date, repeat rejection, and browser status passed. |
| REQ-05 | 01–04, 06, 09–11 | Data-driven dashboard actions and recently released assessments | SATISFIED WITH DEFERRED RELEASE DATA | Request/questionnaire actions use owner-scoped live data. The widget honestly reports release data unavailable; Phase 4 explicitly owns authoritative release and Requestor read-only viewing. |

All five Phase 2 requirement IDs appear in plan frontmatter and in `.planning/REQUIREMENTS.md`. No additional requirement is mapped to Phase 2 without a claiming plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `requestor-dashboard-service.ts` | 65 | Static empty released-assessment projection | INFO | Intentional fail-honest boundary: no persisted release fact exists. Specifically deferred to Phase 4. |
| Phase-modified source set | — | `TBD` / `FIXME` / `XXX` | NONE | No unreferenced debt marker found. |
| Phase web feature/routes | — | raw `fetch`/Axios or raw colour literals | NONE | Typed service boundary and semantic tokens preserved. |

### Disconfirmation Pass

- Partial requirement found: REQ-05 cannot yet populate released assessments; this is explicitly deferred to the Phase 4 release contract rather than hidden as a pass.
- Potentially misleading test checked: dashboard unit tests can prove the honest unavailable state but cannot prove a future released-data feed. The report does not treat them as such evidence.
- Uncovered judgment path found: automated checks establish semantics, keyboard behavior, accessibility rules, and responsive overflow, but not visual polish. This remains the human item below.

### Human Verification Completed

#### 1. Responsive visual and interaction quality

**Test:** Complete the Requestor dashboard → My Requests → New Request → draft detail → edit → submit journey at 375px and 1440px.

**Expected:** Layout, hierarchy, table/card switching, form grouping, confirmation, status feedback, and focus presentation are visually coherent and comfortably usable with no clipping.

**Result:** Passed. The full journey was exercised at 375px and 1440px against live servers. The dashboard, list, create, detail, edit, confirmation, submission, tracking, responsive card/table transitions, focus behavior, and page-level overflow were reviewed successfully.

### Gaps Summary

No Phase 2 blocking implementation gaps remain. All 25 merged roadmap and plan must-haves are verified, the responsive human UAT passed at both target widths, and all 19 independent review findings were remediated in quick task `260830-1hh`. The final gate passed with Strapi 11/11, strict web typechecking, 44 web unit tests, API contract drift checking, and 9/9 end-to-end tests. The released-assessment data capability remains explicitly scheduled for Phase 4 and does not block Phase 2.

---

_Verified: 2026-08-30T01:43:04+10:00_
_Verifier: phase goal-backward verification_
