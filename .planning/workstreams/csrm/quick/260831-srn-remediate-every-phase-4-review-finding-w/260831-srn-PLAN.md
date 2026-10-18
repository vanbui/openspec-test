---
phase: quick
plan: 260831-srn
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/verify-phase-04-integrity.test.ps1
  - apps/strapi/src/policies/csrm-authorization.ts
  - apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts
  - apps/strapi/src/api/csrm-assessment/services/assessment-draft-provider.ts
  - apps/strapi/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts
  - apps/strapi/src/api/csrm-assessment/services/assessment-draft-registry.ts
  - apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts
  - apps/strapi/tests/helpers/strapi-http-harness.ts
  - apps/strapi/tests/assessment-workflow.unit.test.ts
  - apps/strapi/tests/assessment-workflow.integration.test.ts
  - apps/web/src/components/csrm/risk-rating-badge.tsx
  - apps/web/src/components/csrm/risk-rating-badge.test.tsx
  - apps/web/src/features/assessments/owner-combobox.tsx
  - apps/web/src/features/assessments/owner-combobox.test.tsx
  - apps/web/src/features/assessments/risk-editor.tsx
  - apps/web/src/features/assessments/control-implementation-editor.tsx
  - apps/web/src/features/assessments/assessment-draft-job.tsx
  - apps/web/src/features/assessments/assessment-editor.tsx
  - apps/web/src/features/assessments/assessment-editor.test.tsx
  - apps/web/src/features/assessments/assessment-list.tsx
  - apps/web/src/features/assessments/assessment-domain.ts
  - apps/web/src/features/assessments/assessment-review-workflow.test.tsx
  - apps/web/src/config/navigation/navigation.ts
  - apps/web/src/components/shell/mobile-navigation.test.tsx
  - apps/web/app/(app)/app/review/assessments/loading.tsx
  - apps/web/app/(app)/app/review/assessments/error.tsx
  - apps/web/app/(app)/app/review/assessments/[documentId]/loading.tsx
  - apps/web/app/(app)/app/review/assessments/[documentId]/error.tsx
  - apps/web/app/(app)/app/review/requests/loading.tsx
  - apps/web/app/(app)/app/review/requests/error.tsx
  - apps/web/app/(app)/app/review/requests/[documentId]/loading.tsx
  - apps/web/app/(app)/app/review/requests/[documentId]/error.tsx
autonomous: true
requirements:
  - ASSESS-01
  - ASSESS-02
  - ASSESS-03
  - ASSESS-04
  - ASSESS-05
  - INT-03
must_haves:
  truths:
    - Every one of the 45 Phase 4 dossier entries has an explicit fixed, already-correct, duplicate-of, or not-applicable disposition backed by evidence in the quick-task summary.
    - The Security Analyst Agent service role cannot release an assessment or become its approver, while a human Security Analyst retains the exact authorised release flow.
    - Every rejected aggregate mutation is proven side-effect free by mounted read-back, and every contract-integrity hostile fixture actually mutates and executes the production guard.
    - Assessment owner selection, validation, status, severity, polling, readiness, headings, loading, error, and navigation behavior is keyboard-operable, screen-reader coherent, recoverable, and consistent at mobile and desktop widths.
    - A valid submitted questionnaire with no deterministic risk mapping still creates a reviewable assessment, and suggested reusable control numbers remain visible to the analyst without changing a frozen schema or transport contract.
    - A second authorised analyst receives the existing idempotent draft job rather than a false denial.
    - Content-type schemas remain unchanged, both catalogue copies remain byte-identical, no test is weakened, and no sentinel or escape hatch is introduced.
    - The exact Strapi and web acceptance gate passes under Node v24.19.0 on dylan-test without touching live ports 1337 or 3000.
  artifacts:
    - path: apps/strapi/tests/assessment-workflow.integration.test.ts
      provides: Mounted release-role, denial-persistence, active-user search, no-mapping draft, idempotent job, and suggested-control regressions
    - path: scripts/verify-phase-04-integrity.test.ps1
      provides: Executable hostile-fixture proof for findings 2 and 19
    - path: apps/web/src/features/assessments/owner-combobox.test.tsx
      provides: Keyboard, focus, dismissal, loading, and option identity regressions for findings 6, 7, 22, 23, 30, 31, and 32
    - path: apps/web/src/features/assessments/assessment-editor.test.tsx
      provides: Validation, readiness, status, severity consumer, live-region, heading, recovery, and server-key regressions
    - path: .planning/quick/260831-srn-remediate-every-phase-4-review-finding-w/260831-srn-SUMMARY.md
      provides: Numbered disposition ledger for findings 1 through 45 with test and commit evidence
  key_links:
    - from: apps/strapi/src/policies/csrm-authorization.ts
      to: POST:/api/v1/risk_assessments/{assessmentId}/release
      via: operation-specific human Security Analyst eligibility before controller execution
      pattern: risk_assessments.*release
    - from: apps/strapi/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts
      to: apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts
      via: closed parsed proposal whose zero-risk result persists a reviewable assessment and whose treatment-plan projection preserves suggested control numbers
      pattern: suggestedControlNumbers
    - from: apps/web/src/features/assessments/owner-combobox.tsx
      to: apps/web/src/features/assessments/risk-editor.tsx
      via: form-safe combobox events, valid option identity, and controlled dismissal
      pattern: onKeyDown
    - from: apps/web/src/features/assessments/assessment-domain.ts
      to: apps/web/src/features/assessments/assessment-editor.tsx
      via: one status presentation and server-format readiness path parser used by every assessment view
      pattern: readiness
---

<objective>
Remediate every Phase 4 review finding in blocker, major, then minor priority order, including transparent duplicate handling and an evidence-backed disposition for all 45 dossier entries.

Purpose: Close the release-authority blocker, persistence and contract-test gaps, deterministic workflow dead ends, and assessment-review accessibility and reachability defects without changing frozen schemas or catalogues.
Output: Small conventional commits on `dylan-test`, regression coverage for every implementation group, a 45-item disposition ledger in the quick-task summary, and the exact final acceptance gate green under Node v24.19.0.
</objective>

<execution_context>
@gsd-core/workflows/execute-plan.md
@gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@.planning/phases/04-assessment-review-risk-editing-and-release/04-REVIEW-FINDINGS.md
@docs/CSRM-PROJECT-BRIEF.md
@docs/design/csrm-design-direction.md
@docs/references/specification.json
@docs/references/idambox-datamodel.jdl
@docs/references/idambox-csrm-role-function-api-catalogue.json
@apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
</context>

<preflight>
Before editing, require `git branch --show-current` to equal `dylan-test` and `node --version` to equal `v24.19.0`; abort rather than switching branches or runtimes. Record `git rev-parse HEAD` as the quick-task base SHA, record SHA-256 hashes and a byte comparison of both catalogue copies, and record the path-plus-hash inventory of every `apps/strapi/src/api/**/content-types/**/schema.json`. Record the existing dirty/untracked inventory and preserve user-owned changes, especially `apps/web/next-env.d.ts`, `apps/web/tsconfig.json`, `.planning/debug/`, `apps/web/.tmp/`, and the untracked findings dossier. Do not stage any unrelated file. Do not rewrite or amend historical commits, push, install dependencies, weaken/delete/skip tests, add sentinels or process/environment escape hatches, modify generated OpenAPI output except as the transient `api:check` comparison, kill or reuse live ports 1337/3000, start Phase 5, update ROADMAP.md, or mark Phase 4 complete. Playwright retains its isolated database and owns only Strapi 1338 and Next 3100.
</preflight>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Resolve every blocker and major finding with focused regressions</name>
  <files>scripts/verify-phase-04-integrity.test.ps1, apps/strapi/src/policies/csrm-authorization.ts, apps/strapi/src/api/csrm-assessment/services/assessment-draft-provider.ts, apps/strapi/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts, apps/strapi/tests/helpers/strapi-http-harness.ts, apps/strapi/tests/assessment-workflow.unit.test.ts, apps/strapi/tests/assessment-workflow.integration.test.ts, apps/web/src/components/csrm/risk-rating-badge.tsx, apps/web/src/components/csrm/risk-rating-badge.test.tsx, apps/web/src/features/assessments/owner-combobox.tsx, apps/web/src/features/assessments/owner-combobox.test.tsx, apps/web/src/features/assessments/risk-editor.tsx, apps/web/src/features/assessments/control-implementation-editor.tsx, apps/web/src/features/assessments/assessment-editor.tsx, apps/web/src/features/assessments/assessment-editor.test.tsx</files>
  <read_first>scripts/verify-phase-04-integrity.ps1; scripts/verify-phase-04-integrity.test.ps1; apps/strapi/src/policies/csrm-authorization.ts; apps/strapi/src/api/csrm-assessment/routes/csrm-assessment.ts; apps/strapi/src/api/csrm-assessment/services/assessment-draft-provider.ts; apps/strapi/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts; apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts; apps/strapi/tests/helpers/strapi-http-harness.ts; apps/strapi/tests/assessment-workflow.unit.test.ts; apps/strapi/tests/assessment-workflow.integration.test.ts; apps/web/app/globals.css; apps/web/src/components/csrm/risk-rating-badge.tsx; apps/web/src/features/assessments/owner-combobox.tsx; apps/web/src/features/assessments/risk-editor.tsx; apps/web/src/features/assessments/control-implementation-editor.tsx; apps/web/src/features/assessments/assessment-editor.tsx; docs/design/csrm-design-direction.md section 3.6</read_first>
  <behavior>
    - F-17 blocker: a mounted actor holding the actual seeded `Security Analyst Agent` role and release FunctionAPI grant receives 403 before the release controller runs; the assessment, owning request, approval triple, and approver remain unchanged. A human `Security Analyst` still releases the same ready aggregate successfully. Restrict only the release operation; preserve every other exact catalogue-backed operation the agent role may hold.
    - F-22 blocker plus F-6/F-7/F-23: the owner combobox uses one coherent option identity/selection mechanism, so `aria-activedescendant` names a real DOM option, the visible highlight and `aria-selected` follow ArrowUp/ArrowDown, and Enter always prevents enclosing-form submission while the combobox is active. With results and no prior arrow key, Enter selects the documented first active result; with no selectable result it performs no form submit.
    - F-2/F-19 duplicate pair: each named hostile fixture creates an isolated mutated specification for changed path, operationId, parameter, request body, non-200 response, or unrelated schema, invokes the production integrity guard, and asserts rejection. A constant source-string check cannot satisfy the regression.
    - F-5/F-24/F-29 duplicate cluster: Low, Moderate, High, and Critical use only the dedicated semantic risk ladder tokens and the section 3.6 circle, diamond, triangle, and octagon distinctions; Moderate never uses interactive/info blue, and Critical uses the specified critical tier.
    - F-8: every assessment and risk date, select, owner, and metadata field consumes returned `fieldErrors` with persistent icon-plus-text output, stable error IDs, `aria-invalid`, and `aria-describedby`; Summary retains the same recipe rather than becoming a special case.
    - F-9/F-25 duplicate cluster: every control-implementation field consumes `fieldErrors` with the same programmatic and visible recipe, and a failed delete displays and announces the actual safe failure inside the still-open `ConfirmDialog` through `errorMessage`.
    - F-41: a legal submitted questionnaire matching zero deterministic risk mappings produces a closed, valid zero-risk proposal and persists a draft assessment for analyst review instead of a permanently failed job. The parser intentionally allows 0..50 risks; the assessment remains unreleasable until a human adds and completes a Risk, preserving server-owned readiness.
  </behavior>
  <action>Write the focused failing tests before each production change. Split human and service-role release eligibility at the exact release operation in `csrm-authorization.ts` without editing either catalogue or weakening general explicit-grant checks; seed the real service role in the mounted harness and prove no release side effects. Replace the integrity test's vacuous loop with real temporary hostile specification fixtures passed through the production script using its supported entry point; do not add a test-only switch to production code. Refactor OwnerCombobox so Radix/cmdk cannot overwrite the IDs or selection state the external input advertises; prefer one library-owned keyboard model or render controlled listbox options with the existing popover primitives, close on blur/outside/Tab, and keep form submission impossible during combobox Enter handling. Implement the severity ladder entirely through existing semantic tokens and mandatory non-color shapes. Extract/reuse a small field-error presentation helper only if it reduces duplication without moving business rules into JSX; preserve all server schemas and mutation allowlists. Allow a zero-risk deterministic proposal and persist its assessment while keeping release readiness fail closed. Keep commits small by concern, for example release authority, integrity fixtures, owner combobox, form errors, and deterministic zero-risk draft; every commit body must contain actual newline-separated bullets, never literal backslash-n text.</action>
  <verify>
    <automated>pwsh -NoProfile -File scripts/verify-phase-04-integrity.test.ps1 &amp;&amp; cd apps/strapi &amp;&amp; npm test &amp;&amp; cd ../web &amp;&amp; pnpm test -- src/components/csrm/risk-rating-badge.test.tsx src/features/assessments/owner-combobox.test.tsx src/features/assessments/assessment-editor.test.tsx &amp;&amp; pnpm typecheck</automated>
  </verify>
  <done>Findings 2, 5-9, 17, 19, 22-25, 29-31, and 41 have direct failing-then-passing regressions; both blockers are closed before minor work begins; each focused concern is committed conventionally with a real multiline body.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Close minor, duplicate, workflow, accessibility, and reachability findings</name>
  <files>apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts, apps/strapi/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts, apps/strapi/src/api/csrm-assessment/services/assessment-draft-registry.ts, apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts, apps/strapi/tests/assessment-workflow.unit.test.ts, apps/strapi/tests/assessment-workflow.integration.test.ts, apps/web/src/components/csrm/risk-rating-badge.tsx, apps/web/src/components/csrm/risk-rating-badge.test.tsx, apps/web/src/features/assessments/owner-combobox.tsx, apps/web/src/features/assessments/owner-combobox.test.tsx, apps/web/src/features/assessments/risk-editor.tsx, apps/web/src/features/assessments/control-implementation-editor.tsx, apps/web/src/features/assessments/assessment-draft-job.tsx, apps/web/src/features/assessments/assessment-editor.tsx, apps/web/src/features/assessments/assessment-editor.test.tsx, apps/web/src/features/assessments/assessment-list.tsx, apps/web/src/features/assessments/assessment-domain.ts, apps/web/src/features/assessments/assessment-review-workflow.test.tsx, apps/web/src/config/navigation/navigation.ts, apps/web/src/components/shell/mobile-navigation.test.tsx, apps/web/app/(app)/app/review/assessments/loading.tsx, apps/web/app/(app)/app/review/assessments/error.tsx, apps/web/app/(app)/app/review/assessments/[documentId]/loading.tsx, apps/web/app/(app)/app/review/assessments/[documentId]/error.tsx, apps/web/app/(app)/app/review/requests/loading.tsx, apps/web/app/(app)/app/review/requests/error.tsx, apps/web/app/(app)/app/review/requests/[documentId]/loading.tsx, apps/web/app/(app)/app/review/requests/[documentId]/error.tsx</files>
  <read_first>apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts; apps/strapi/src/api/csrm-assessment/services/assessment-draft-registry.ts; apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts; apps/strapi/tests/assessment-workflow.integration.test.ts; apps/web/src/features/assessments/assessment-draft-job.tsx; apps/web/src/features/assessments/assessment-list.tsx; apps/web/src/features/assessments/assessment-domain.ts; apps/web/src/features/assessments/assessment-review-workflow.test.tsx; apps/web/src/config/navigation/navigation.ts; sibling apps/web/app/(app)/app/review/questionnaires loading.tsx and error.tsx; apps/web/src/components/csrm/status-badge.tsx; apps/web/src/components/csrm/confirm-dialog.tsx</read_first>
  <behavior>
    - F-3/F-20: after every denied 403 or immutable 409 PATCH, POST, and DELETE case, mounted tests re-read the exact Assessment, Risk, and ControlImplementation targets and compare pre/post projections; rejected creates also prove no matching row exists. Write-then-deny behavior fails the suite.
    - F-4: the capped-search fixture itself matches `search=a`, is active, sorts beyond the first 20, and is absent only because of the cap; separate coverage continues to prove inactive users are excluded.
    - F-18: `/v1/users` serves both actors when their exact catalogue grant authorizes the operation. Requestor coverage proves a bounded active-user projection and no record-scope expansion; actors without the exact grant remain 403.
    - F-10: routine queued, running, and completed job transitions use one pre-mounted polite status region and non-alert visual containers, avoiding duplicate assertive announcements; genuine failures may remain assertive.
    - F-11: timed-out polling retains the one-request/one-second/30-second bounds and offers a `Check again` control that resets only the client observation budget for the same authoritative job.
    - F-12: `AssessmentEditorSkeleton` and the populated editor use identical breakpoint and sidebar-width grid classes so 1024-1280px does not shift between one and two columns.
    - F-13/F-34 duplicate pair: one persistent polite readiness region owns both missing and ready content, so satisfying the final requirement announces `All release requirements are present.`.
    - F-14/F-27/F-40 duplicate cluster: exemption review date has a suitable datetime control or explicit persistent format help that survives typing and is linked to the field; accepted transport remains the existing ISO datetime contract.
    - F-15/F-28/F-35 duplicate cluster: one assessment-status presentation maps every enum to a sentence-case label and state-specific non-color icon and is reused in editor, detail, mobile cards, and desktop table.
    - F-16/F-37 overlapping route findings: each review requests and review assessments collection/detail segment has contextual `loading.tsx` and `error.tsx`; each error boundary names the failed area, retries locally, and offers the appropriate safe back route. Tests cover fallback, thrown failure, retry, and resolved content.
    - F-21: each Suspense regression resolves its deferred promise inside `act`, awaits fallback removal, and asserts the populated content; delete tautological Promise assertions.
    - F-26/F-33 duplicate pair: all inline validation errors use icon plus text and programmatic control association; this remains covered after Task 1's broader F-8 remediation.
    - F-32: every non-empty keystroke immediately enters pending state through the debounce window; `No matching active owners` appears only after a completed empty result, with stale requests unable to replace newer results.
    - F-36: each RiskRatingBadge exposes `Severity: {label} ({position} of 4)` while retaining visible label and decorative shape semantics.
    - F-38: no-change status regions in Risk and ControlImplementation editors exist before submission and update their text after the result so assistive technology announces the outcome.
    - F-39: Release readiness and deterministic draft panels contribute correctly nested real headings without changing Card primitives globally.
    - F-42: readiness labels and anchors parse the server's actual bare assessment keys and `risks[n].field` paths; tests use real `validateReleaseReadiness` output vocabulary, map assessment gaps to `#assessment-details`, and map risk gaps to the relevant identified-risk section.
    - F-43: any authorised analyst requesting generation for a questionnaire with an active or retained completed job receives the existing job idempotently; initiator metadata remains immutable, job-read policy still controls visibility, retry authorization is unchanged, and no duplicate execution occurs.
    - F-44: capability-gated navigation exposes `/app/review/assessments` to assessment reviewers and `/app/assessments` to Requestors; labels are unambiguous beside existing request/questionnaire entries, mobile/desktop navigation tests cover both allowed and hidden states, and the Requestor dashboard or released widget links to the full inventory.
    - F-45: sorted `suggestedControlNumbers` are preserved without a schema or API change by composing them into the persisted analyst-reviewable treatment plan as bounded advisory text; zero suggestions use honest copy and never claim suggestions exist. Unit and mounted tests prove the exact control numbers survive reload and appear in the existing editor projection.
  </behavior>
  <action>Add regressions before each fix and preserve every assertion already present. Extend mounted denial loops with exact before/after reads and absence queries. Align active-user search with the frozen grant graph instead of retaining an analyst-only controller contradiction. Repair polling and live regions without raising cadence or allowing concurrent requests. Centralize assessment status presentation and readiness-path parsing in domain code outside JSX. Create route-local boundaries by following the sibling questionnaire pattern while retaining each synchronous route shell and Suspense-wrapped async child. For F-43 return the existing job to an equally authorised analyst without changing its initiating analyst, and keep read-all checks at the job projection boundary. For F-45 do not create automatic ControlImplementations or invent another entity: persist the deterministic, sorted suggestion identifiers in the existing bounded treatmentPlan field so they are reviewable and editable, and update the no-suggestion wording. Commit backend persistence/authorization, workflow registry/provider, accessibility/status, route boundaries, and navigation as separate conventional concerns with actual multiline bodies.</action>
  <verify>
    <automated>cd apps/strapi &amp;&amp; npm test &amp;&amp; cd ../web &amp;&amp; pnpm test &amp;&amp; pnpm typecheck</automated>
  </verify>
  <done>Findings 3, 4, 10-16, 18, 20, 21, 26-28, 32-40, and 42-45 have direct regression evidence; duplicate groups share one substantive fix but retain individual dispositions; all minor work is committed in small conventional commits with real multiline bodies.</done>
</task>

<task type="auto">
  <name>Task 3: Audit all 45 dispositions and run the immutable full gate</name>
  <files>.planning/quick/260831-srn-remediate-every-phase-4-review-finding-w/260831-srn-SUMMARY.md, .planning/STATE.md</files>
  <read_first>.planning/phases/04-assessment-review-risk-editing-and-release/04-REVIEW-FINDINGS.md; .planning/STATE.md; every diff produced by Tasks 1-2; every focused and full-gate test result from Tasks 1-2</read_first>
  <action>Create the quick-task summary with a numbered table containing exactly F-1 through F-45 once each and columns for severity, disposition, implementation or one-line not-applicable justification, regression test/evidence, and commit SHA. Use `duplicate of F-X; fixed by the same implementation and independently covered by ...` for duplicate lenses rather than omitting them. F-1 must be `not fixable without history rewrite — existing shared commit bodies are immutable under this task`; do not amend, rebase, filter, replace, or otherwise rewrite history. Every other item must be fixed or, only after inspecting the current tree, marked already-correct/not-applicable with one concrete line of current-code and test evidence; an unsupported no-op is a failed task. Verify every new commit via `git cat-file -p &lt;sha&gt;` so its body has actual line breaks and contains no literal backslash-n bullet encoding. Run the exact final gate in the mandated order after all implementation commits. If any command fails, add a focused regression-preserving fix commit in the owning concern and rerun the complete gate from the beginning; never weaken a test, skip a command, use a sentinel, or add an escape hatch. Recheck immutable hashes, catalogue byte identity, dirty-tree ownership, port isolation, and scope before recording completion. Update only the Quick Tasks Completed table/continuity fields in STATE.md as the quick workflow requires; do not alter Phase 4 completion or start Phase 5.</action>
  <verify>
    <automated>cd apps/strapi &amp;&amp; npm test &amp;&amp; cd ../web &amp;&amp; pnpm typecheck &amp;&amp; pnpm test &amp;&amp; pnpm api:check &amp;&amp; pnpm test:e2e</automated>
  </verify>
  <done>The exact final gate is green under Node v24.19.0; the summary accounts for all 45 findings with evidence and SHAs; F-1 is the sole required historical not-fixable disposition unless current-tree inspection justifies another explicit non-defect; schemas/catalogues/user changes remain untouched; nothing is pushed and Phase 4 remains incomplete.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|---|---|
| Authenticated identity to release operation | A catalogue-backed service role must not be accepted as the human approver required for release. |
| Controller denial to persistence | A 403/409 response is insufficient unless the aggregate and descendants are unchanged. |
| Persisted questionnaire to deterministic provider | Legal submitted answers may produce no mapping and must remain reviewable without bypassing human release. |
| Polling/search responses to interactive UI | Stale, pending, and terminal states must not submit forms, misstate selection, leak users, or create duplicate announcements. |
| Frozen contracts to remediation | Source schemas, OpenAPI transport, and both catalogue copies cannot be altered to make findings disappear. |
| Dirty working tree to commits | Existing user-owned modifications and untracked diagnostics must not enter remediation commits. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|---|---|---|---|---|
| T-260831-SRN-01 | Elevation of Privilege | Assessment release policy | mitigate | Require the human Security Analyst role for the exact release operation and prove the seeded service role receives 403 with no writes. |
| T-260831-SRN-02 | Tampering | Denied Assessment/Risk/ControlImplementation mutations | mitigate | Mounted pre/post reads and absence queries prove all rejected mutations are side-effect free. |
| T-260831-SRN-03 | Information Disclosure | Active-user search | mitigate | Preserve exact grant authorization, active-only filtering, bounded projection, deterministic cap, and mounted actor coverage. |
| T-260831-SRN-04 | Spoofing | Owner combobox selection | mitigate | Real DOM option identity, synchronized visual/programmatic selection, and form-safe Enter behavior prevent selection mismatch. |
| T-260831-SRN-05 | Denial of Service | Draft generation and observation | mitigate | Persist legal zero-mapping assessments, return idempotent existing jobs, and retain one-request/one-second/30-second client observation bounds. |
| T-260831-SRN-06 | Tampering | Specification integrity guard | mitigate | Execute the production guard against six genuinely mutated hostile fixtures. |
| T-260831-SRN-07 | Repudiation | Finding closure and commits | mitigate | Summary ledger maps every finding to evidence and a commit SHA; commit bodies are inspected for real multiline formatting. |
| T-260831-SRN-SC | Tampering | Package supply chain | accept | No package installation or dependency-manifest change is allowed. |
</threat_model>

<verification>
After all focused commits, run and record the following checks without changing their order or substituting narrower commands:

1. Require `git branch --show-current` = `dylan-test` and `node --version` = `v24.19.0`.
2. From `apps/strapi`, run `npm test`.
3. From `apps/web`, run `pnpm typecheck`.
4. From `apps/web`, run `pnpm test`.
5. From `apps/web`, run `pnpm api:check`.
6. From `apps/web`, run `pnpm test:e2e`; confirm its isolated services use only 1338/3100 and its own database, and never kill/reuse 1337/3000.
7. Re-run `pwsh -NoProfile -File scripts/verify-phase-04-integrity.test.ps1` if it is not already invoked by the Strapi test command, and require all six hostile mutations to execute.
8. Byte-compare the two catalogue copies and require both preflight hashes unchanged. Compare the final path-plus-hash content-type schema inventory to preflight and require no added, removed, or changed schema.
9. Inspect every remediation commit with `git cat-file -p`; require conventional subjects, actual multiline bodies, no literal backslash-n bullets, and no prohibited attribution text. Require no rewritten pre-base commit.
10. Inspect `git diff --check` and `git status --short`; preserve the pre-existing `apps/web/next-env.d.ts`, `apps/web/tsconfig.json`, `.planning/debug/`, `apps/web/.tmp/`, and findings dossier state, and require no dependency, sentinel, escape hatch, Phase 5, ROADMAP, or Phase 4 completion change.
11. Mechanically extract the summary disposition table and require the sorted identifiers to equal exactly F-1 through F-45 with no missing or duplicated identifier.
</verification>

<success_criteria>
- Both blocker findings and every major/minor finding are either fixed with regression evidence or explicitly shown not applicable in the current tree; all 45 retain individual dispositions even when review lenses duplicated a defect.
- The service-role release path is closed without changing catalogue bytes, and denied/immutable mutations are proven side-effect free.
- Owner selection, validation, severity, statuses, polling, readiness, headings, route recovery, and navigation satisfy the documented accessible design behavior.
- Legal zero-mapping submissions progress to human review, authorised analysts share idempotent jobs, and suggested reusable controls remain visible without automatic implementation or schema changes.
- The exact Strapi and web gate is green under Node v24.19.0, with Playwright isolated on 1338/3100.
- Content-type schemas are frozen, catalogue copies remain byte-identical, no tests are weakened, no dependencies/sentinels/escape hatches are introduced, and unrelated user files are not staged.
- Commits are small and conventional with actual multiline bodies; history is not rewritten, nothing is pushed, Phase 5 is not started, and Phase 4 is not marked complete.
</success_criteria>

<source_audit>

| Source | IDs | Requirement | Task | Status |
|---|---|---|---|---|
| CONTEXT | F-1 | Malformed historical bodies | 3 | COVERED — explicit not-fixable disposition; history rewrite prohibited |
| CONTEXT | F-2, F-19 | Vacuous integrity hostile-fixture loop | 1 | COVERED — duplicate pair, six executable mutations |
| CONTEXT | F-3, F-20 | Denial responses lack persistence proof | 2 | COVERED — duplicate/overlapping mounted read-back cases |
| CONTEXT | F-4 | Tautological capped-search fixture | 2 | COVERED |
| CONTEXT | F-5, F-24, F-29, F-36 | Severity tokens, shapes, and ordered accessible label | 1-2 | COVERED — duplicate cluster retained individually |
| CONTEXT | F-6, F-7, F-22, F-23, F-30, F-31, F-32 | Owner combobox form safety, identity, highlight, dismissal, and pending state | 1-2 | COVERED — overlapping cluster retained individually |
| CONTEXT | F-8, F-14, F-26, F-27, F-33, F-40 | Assessment/Risk validation association and persistent datetime guidance | 1-2 | COVERED — overlapping cluster retained individually |
| CONTEXT | F-9, F-25 | ControlImplementation field and modal delete errors | 1 | COVERED — duplicate/overlapping pair |
| CONTEXT | F-10, F-11 | Draft-job announcements and timeout recovery | 2 | COVERED |
| CONTEXT | F-12 | Skeleton/populated layout parity | 2 | COVERED |
| CONTEXT | F-13, F-34 | Readiness transition live announcement | 2 | COVERED — duplicate pair |
| CONTEXT | F-15, F-28, F-35 | Assessment status labels and icons | 2 | COVERED — overlapping cluster |
| CONTEXT | F-16, F-37 | Review route loading/error boundaries | 2 | COVERED — overlapping route scopes |
| CONTEXT | F-17 | Service role can release assessment | 1 | COVERED — blocker first |
| CONTEXT | F-18 | Requestor user-search grant/controller divergence | 2 | COVERED |
| CONTEXT | F-21 | Suspense tests never resolve | 2 | COVERED |
| CONTEXT | F-38 | Conditionally mounted no-change live region | 2 | COVERED |
| CONTEXT | F-39 | Missing panel headings | 2 | COVERED |
| CONTEXT | F-41 | Zero deterministic mappings dead-end workflow | 1 | COVERED |
| CONTEXT | F-42 | Readiness UI parses fictional path format | 2 | COVERED |
| CONTEXT | F-43 | Cross-analyst idempotent generation returns 403 | 2 | COVERED |
| CONTEXT | F-44 | Assessment inventories unreachable | 2 | COVERED |
| CONTEXT | F-45 | Suggested controls discarded | 2 | COVERED |
| GOAL | — | Remediate every dossier entry with per-finding disposition and full gate | 1-3 | COVERED |
| REQ | ASSESS-01..ASSESS-05, INT-03 | Preserve Phase 4 assessment review/edit/release behavior and prevent automated release | 1-3 | COVERED |
| CONTEXT | — | Node/branch/commit/no-push/full-gate/frozen-files/no-sentinel/isolated-ports/no Phase 5/completion constraints | Preflight, 1-3, verification | COVERED |

</source_audit>

<output>
Create `.planning/quick/260831-srn-remediate-every-phase-4-review-finding-w/260831-srn-SUMMARY.md` when done, then update only the `.planning/STATE.md` Quick Tasks Completed table and continuity metadata required by quick-task completion. Do not track or modify the findings dossier unless separately authorised, do not update ROADMAP.md, and do not mark Phase 4 complete.
</output>
