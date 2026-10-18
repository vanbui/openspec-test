---
phase: 04-assessment-review-risk-editing-and-release
verified: 2026-08-31T12:02:11.646Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "Analysts can edit the complete frozen contextual Risk surface and release a persisted ready assessment after navigation or reload."
    - "Analysts can select legitimate active owners without an arbitrary name filter affecting readiness."
  gaps_remaining: []
  regressions: []
human_verification:
  status: passed
  approved: 2026-08-31
  evidence: "The complete dual-role journey passed live at desktop and 375px, including keyboard interaction, zero horizontal overflow, analyst review and release, post-release mutation denial, prerelease Requestor denial, and Requestor released views."
---

# Phase 4: Assessment Review, Risk Editing, and Release Verification Report

**Phase Goal:** As a Security Analyst, review submitted requests, observe reviewable AI draft jobs, edit assessment risks and mitigations, explicitly release completed assessments, and provide Requestors vetted read-only assessments.
**Verified:** 2026-08-31T12:02:11.646Z
**Status:** passed
**Re-verification:** Yes — after gap closure

## User Flow Coverage

| Step | Expected | Codebase evidence | Status |
|---|---|---|---|
| Review submitted requests | A granted active analyst can see only the bounded review collection and detail. | `collection-scope.ts` authorises `assessmentReviewCollectionScope === "all"`, validates every filter/date, and the mounted integration suite exercises authorisation and query-expansion denial. | VERIFIED |
| Observe a reviewable draft | Draft work is observable/retryable but cannot release an assessment. | The bounded draft registry/workflow remains separate from `releaseAssessment`; release is an explicit controller action with analyst scope. Mounted lifecycle tests passed. | VERIFIED |
| Edit Risks and mitigations | The complete frozen writable Risk surface survives persistence, reload, and editor hydration. | `assessment-scope.ts:141-177` positively projects all 34 writable fields plus five relation document IDs. `csrm-assessment.ts:151-160` loads that persisted aggregate and server readiness; `assessment-editor.tsx:139-146` refreshes it after mutation. Mounted 68-test Strapi suite passed. | VERIFIED |
| Select owners | Search is accessible, debounced, server-backed, bounded, and existing persisted owners retain labels independently of search. | `owner-combobox.tsx` debounces 300ms, handles keyboard listbox selection and stale requests; server search accepts only bounded `search`; `risk-workflow.ts:140-165` derives selected labels solely from persisted relations with a 2,000 bound. | VERIFIED |
| Explicit release | Only an analyst can explicitly release a truly ready aggregate in one transaction. | `assessment-workflow.ts:321-376` row-locks, reloads the aggregate, calls `validateReleaseReadiness`, and writes assessment/request release facts atomically. UI reads server-provided `releaseReadiness`; it does not derive release eligibility. | VERIFIED |
| Requestor outcome | Only the owner can read a complete released aggregate, as a purpose-built read-only view. | Controller selects `projectReleasedAssessmentDetail` only after owner + complete-release scope; the strict Requestor variant omits `ownerLabels`, `releaseReadiness`, and analyst Risks. Mounted IDOR/mutation tests cover denials. | VERIFIED |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Analysts can review authorised submitted requests and observe or trigger a non-blocking, reviewable draft-job lifecycle. | VERIFIED | Exact queue scope and closed query parsing are implemented in `collection-scope.ts`; the mounted suite includes lifecycle, queue, and hostile-query checks. |
| 2 | Analysts can edit assessment context, all frozen non-server-owned Risk fields, and the exact ControlImplementation fields while server-owned facts stay protected. | VERIFIED | The analyst DTO now includes every writable Risk field and five relation IDs; strict web schemas/actions and server allowlists remain in the mutation path. Full-field save/reload is covered by mounted integration tests. |
| 3 | Draft assistance cannot automatically release; release is an explicit analyst-only, readiness-gated atomic action. | VERIFIED | Draft persistence has no release path; the separate release workflow revalidates after row lock and updates both release facts transactionally. |
| 4 | An authorised Requestor sees only an owner-scoped released assessment and cannot mutate it. | VERIFIED | Server-selected Requestor DTO excludes analyst fields; UI is separate read-only presentation; mounted and E2E tests assert owner scope and no mutation controls. |

**Score:** 4/4 roadmap must-haves verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts` | Closed actor-specific detail projections | VERIFIED | Analyst projection has all writable Risk fields; Requestor projection does not add analyst-only keys. |
| `apps/strapi/src/api/csrm-risk/services/risk-workflow.ts` | Bounded Risk/owner aggregate loading | VERIFIED | Uses 1,001 Risk probe and 2,000 persisted-owner-label bound before identity lookup. |
| `apps/web/src/features/assessments/owner-combobox.tsx` | Accessible debounced owner picker | VERIFIED | Keyboard combobox/listbox, 300ms debounce, async stale-response suppression, errors/retry, and selected-label display are substantive and used by `RiskEditor`. |
| `apps/web/src/features/assessments/assessment-editor.tsx` | Authoritative refresh and editor wiring | VERIFIED | Refresh action replaces assessment/Risks; options are derived from `currentAssessment.ownerLabels`, fixing the post-create refresh display defect. |
| `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts` | Immutable, authoritative release | VERIFIED | Shared readiness predicate, transaction lock/reload, and atomic assessment/request update are substantive. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Analyst detail controller | Full Risk/readiness projection | Authorised aggregate read → `loadAnalystAssessmentRiskDetails` → `projectAnalystAssessmentDetail` | WIRED | Controller lines 150-160 pass persisted Risks, relation labels, and `validateReleaseReadiness` to the DTO. |
| Owner combobox | Authorised server search | `RiskEditor` → `searchActiveUsersAction` → typed `GET /v1/users` | WIRED | Detail page injects the action; input is bounded/validated server-side, with no caller-supplied ID list. |
| Persisted owners | Editor selected labels | Risk relations → independently resolved `ownerLabels` → current editor options | WIRED | Labels do not depend on search results; refreshed assessment labels are retained in existing/new Risk editors. |
| Release control | Server authority | Detail `releaseReadiness` for UI guidance; release endpoint reloads and rechecks | WIRED | The UI cannot grant release; the server remains authoritative after every mutation. |
| Requestor detail route | Read-only UI | Owner/complete-release predicate → Requestor DTO → released presentation | WIRED | Actor branch occurs before serialization; Requestor fields are strict and mutation-free. |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| Analyst editor | `currentAssessment`, `risks`, `releaseReadiness` | Authorised Strapi aggregate/detail route | Persisted assessment/Risk records and shared server readiness validator | FLOWING |
| Owner combobox | `results` / selected owner labels | Authorised `/v1/users?search=` and persisted Risk relation lookup | Active search results; selected labels independently come from persisted relation IDs | FLOWING |
| Requestor released detail | Released assessment projection | Owner-scoped complete-release query | Persisted complete release fact only | FLOWING |

## Closure of Previous and Final Review Findings

| Finding | Verification result |
|---|---|
| Lossy analyst Risk read / stale client readiness | CLOSED — full projection, exact IDs, authoritative readiness response, and refresh wiring exist and are mounted-tested. |
| Fixed `'a'` owner filter / missing persisted owner labels | CLOSED — input-driven debounced search replaced it; labels derive only from persisted Risk owner relations. |
| Duplicate shared GET registrations | CLOSED — only actor-aware GET registrations remain in assessment routes; regression test passed. |
| Nullable exemption corruption | CLOSED — `isExempted` is nullable boolean in strict client/server schemas and tri-state control. |
| Create-refresh searched owner label loss (WR-01) | CLOSED — editor options now derive from refreshed `currentAssessment.ownerLabels`; regression test passed. |
| Owner-label 2,000 boundary | CLOSED — server rejects 2,001 before lookup and client schema caps at 2,000. |
| No-op edits | CLOSED — both edit forms detect an empty normalized delta and announce `No changes to save.` without calling update actions. |
| Whitespace Risk statement / invalid calendar date | CLOSED — Risk text is trim-validated and queue filter validates a real UTC date including leap-year behavior. |

## Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| ASSESS-01 | SATISFIED | Exact analyst queue/detail scope, bounded query parsing, and mounted denial coverage. |
| ASSESS-02 | SATISFIED | Reviewable queued/running/completed/failed/retry draft workflow; no release write path. |
| ASSESS-03 | SATISFIED | Lossless full Risk projection, strict mutation allowlists, owner picker/hydration, mitigation editing, and post-release locks. |
| ASSESS-04 | SATISFIED | Explicit analyst-only transactional release with authoritative shared readiness check. |
| ASSESS-05 | SATISFIED | Complete-release plus owner-scoped Requestor read, strict DTO separation, and no mutation UI/routes. |

No Phase 4 requirement is orphaned: all `ASSESS-01`–`ASSESS-05` are declared in Phase 4 plans and mapped to Phase 4 in `REQUIREMENTS.md`.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full mounted Strapi workflow and security suite | `npm test -- --test-name-pattern="save-reload|readiness|ownerLabels|2,000|2,001|whitespace|review date|leap"` | 68 passed, 0 failed/skipped/todo | PASS |
| Editor/owner/client contract regressions | Focused web Vitest suite | 52 passed across 4 files | PASS |
| Integrity guard regression | `powershell ... verify-phase-04-integrity.test.ps1` | Passed | PASS |
| Integrity guard | `powershell ... verify-phase-04-integrity.ps1` | Passed; Node v24.19.0, 121 phase files, 10 phase tests swept | PASS |

The final gate passed after the review remediation and API-token-only outer gate: the Strapi suite, web typecheck, 178 unit tests, API check, and all 11 end-to-end tests were green. Severity badges also exposed orderable aria-labels at 375px in the live verification.

## Probe Execution

Step 7c: SKIPPED — Phase 4 declares no `scripts/*/tests/probe-*.sh` probes.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| None in the Phase 4 implementation surface | — | No unreferenced `TBD`, `FIXME`, `XXX`, test skip/focus, `PHASE4_RED`, or `execArgv` escape remained after integrity sweep. | INFO | No blocker found. |

## Human Verification Completed

### Responsive keyboard journey

**Approved:** 2026-08-31

The complete dual-role journey was exercised live against both development servers. Analyst verification covered the review queue; deterministic queued, running, and completed draft-job lifecycle with the not-released notice; the generated three-risk assessment editor; release-readiness checklist; Risk and ControlImplementation edits; and atomic release through the served `/v1` routes. Release returned 200, the post-release analyst PATCH returned 409, the Requestor PATCH returned 403, and the prerelease Requestor read returned 404.

Requestor verification covered the released list, detail, and dashboard. The journey passed at desktop and 375px with `documentElement.scrollWidth` confirming zero horizontal overflow, and keyboard interaction checks passed on the editor controls.

## Gaps Summary

No gap remains. The prior `gaps_found` blockers are closed, the 45-finding review dossier is fully remediated with none deferred, the API-token-only outer gate is in place, the full automated gate is green, and responsive visual and keyboard acceptance passed.

---

_Verified: 2026-08-31T12:02:11.646Z_
_Verifier: Phase 4 verification_
