---
phase: 12-ai-context-suggestions-and-provenance
reviewed: 2026-10-08T02:12:30Z
depth: standard
diff_base: 7e4fa02
lanes: 4
operator_pass: 2026-10-06T21:09:48Z
files_reviewed: 180
files_reviewed_list:
  - CONTEXT.md
  - apps/backend/.env.example
  - apps/backend/config/ai.ts
  - apps/backend/package.json
  - apps/backend/src/api/csrm-ai-run/content-types/csrm-ai-run/schema.json
  - apps/backend/src/api/csrm-ai-run/controllers/csrm-ai-run.ts
  - apps/backend/src/api/csrm-ai-run/operations.ts
  - apps/backend/src/api/csrm-ai-run/routes/ai-runs.ts
  - apps/backend/src/api/csrm-ai-run/routes/csrm-ai-run.ts
  - apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts
  - apps/backend/src/api/csrm-ai-run/services/csrm-ai-run.ts
  - apps/backend/src/api/csrm-assessment/content-types/csrm-assessment/schema.json
  - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
  - apps/backend/src/api/csrm-assessment/operations.ts
  - apps/backend/src/api/csrm-assessment/routes/csrm-assessment.ts
  - apps/backend/src/api/csrm-assessment/services/ai-proposal-decisions.ts
  - apps/backend/src/api/csrm-assessment/services/ai-provenance.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-draft-provider.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
  - apps/backend/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts
  - apps/backend/src/api/csrm-assessment/services/openai-compatible-assessment-draft-provider.ts
  - apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts
  - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
  - apps/backend/src/api/csrm-questionnaire/services/deterministic-questionnaire-generation-provider.ts
  - apps/backend/src/api/csrm-questionnaire/services/openai-compatible-questionnaire-generation-provider.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-provider.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-workflow.ts
  - apps/backend/src/api/csrm-risk/content-types/csrm-risk/schema.json
  - apps/backend/src/api/csrm-risk/services/risk-workflow.ts
  - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/backend/src/csrm/ai-config-validation.ts
  - apps/backend/src/csrm/ai/assessment-context-loader.ts
  - apps/backend/src/csrm/ai/assessment-context.ts
  - apps/backend/src/csrm/ai/data-policy.ts
  - apps/backend/src/csrm/ai/library-ranking.ts
  - apps/backend/src/csrm/ai/prompt-sections.ts
  - apps/backend/src/csrm/conflict-reasons.ts
  - apps/backend/src/csrm/openai-compatible-client.ts
  - apps/backend/src/csrm/risk-scale.ts
  - apps/backend/src/index.ts
  - apps/backend/src/policies/csrm-authorization.ts
  - apps/backend/tests/ai-data-policy.integration.test.ts
  - apps/backend/tests/ai-data-policy.unit.test.ts
  - apps/backend/tests/ai-proposal-decisions.integration.test.ts
  - apps/backend/tests/ai-provenance.unit.test.ts
  - apps/backend/tests/ai-provider-assessment.unit.test.ts
  - apps/backend/tests/ai-provider-boot.unit.test.ts
  - apps/backend/tests/ai-provider-failures.unit.test.ts
  - apps/backend/tests/ai-provider-guardrails.unit.test.ts
  - apps/backend/tests/ai-provider-questionnaire.unit.test.ts
  - apps/backend/tests/ai-run.integration.test.ts
  - apps/backend/tests/assessment-context.integration.test.ts
  - apps/backend/tests/assessment-context.unit.test.ts
  - apps/backend/tests/assessment-workflow.integration.test.ts
  - apps/backend/tests/assessment-workflow.unit.test.ts
  - apps/backend/tests/authorization-matrix.integration.test.ts
  - apps/backend/tests/authorization-policy.unit.test.ts
  - apps/backend/tests/authorization.integration.test.ts
  - apps/backend/tests/conflict-reasons.unit.test.ts
  - apps/backend/tests/contract-catalogue.integration.test.ts
  - apps/backend/tests/fixtures/ai-wire/assessment-v2-accept-on-high.json
  - apps/backend/tests/fixtures/ai-wire/assessment-v2-rating-field.json
  - apps/backend/tests/fixtures/ai-wire/assessment-v2-uat-a.json
  - apps/backend/tests/fixtures/ai-wire/assessment-v2-unknown-control.json
  - apps/backend/tests/fixtures/ai-wire/assessment-v2-unknown-source.json
  - apps/backend/tests/fixtures/ai-wire/assessment-v2-unknown-system.json
  - apps/backend/tests/fixtures/ai-wire/questionnaire-v2-blank-help-text.json
  - apps/backend/tests/fixtures/ai-wire/questionnaire-v2-boolean.json
  - apps/backend/tests/fixtures/ai-wire/questionnaire-v2-five-questions.json
  - apps/backend/tests/fixtures/ai-wire/questionnaire-v2-missing-not-sure.json
  - apps/backend/tests/fixtures/ai-wire/questionnaire-v2-twenty-one-questions.json
  - apps/backend/tests/fixtures/ai-wire/questionnaire-v2-uat-a.json
  - apps/backend/tests/fixtures/authorization-matrix.ts
  - apps/backend/tests/fixtures/uat-a-like-context.ts
  - apps/backend/tests/helpers/questionnaire-context-fixture.ts
  - apps/backend/tests/helpers/strapi-http-harness.ts
  - apps/backend/tests/library-ranking.unit.test.ts
  - apps/backend/tests/questionnaire-generation.integration.test.ts
  - apps/backend/tests/questionnaire-generation.unit.test.ts
  - apps/backend/tests/questionnaire-governance.integration.test.ts
  - apps/backend/tests/risk-register.integration.test.ts
  - apps/backend/tests/risk-scale.unit.test.ts
  - apps/backend/types/generated/contentTypes.d.ts
  - apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/review/questionnaires/[documentId]/loading.tsx
  - apps/csrm/app/(app)/app/review/questionnaires/[documentId]/page.tsx
  - apps/csrm/e2e/ai-context-provenance.spec.ts
  - apps/csrm/e2e/assessment-release-workflow.spec.ts
  - apps/csrm/e2e/helpers/assessment-release.ts
  - apps/csrm/e2e/performance.spec.ts
  - apps/csrm/e2e/questionnaire-generation-workflow.spec.ts
  - apps/csrm/e2e/quick-find.spec.ts
  - apps/csrm/playwright.config.ts
  - apps/csrm/src/components/csrm/relation-picker.tsx
  - apps/csrm/src/components/csrm/status-badge.test.tsx
  - apps/csrm/src/components/csrm/status-badge.tsx
  - apps/csrm/src/components/shell/quick-find-trigger.test.tsx
  - apps/csrm/src/components/shell/quick-find-trigger.tsx
  - apps/csrm/src/components/ui/alert.tsx
  - apps/csrm/src/features/ai-assistance/ai-assistance-actions.test.ts
  - apps/csrm/src/features/ai-assistance/ai-assistance-actions.ts
  - apps/csrm/src/features/ai-assistance/ai-assistance-domain.test.ts
  - apps/csrm/src/features/ai-assistance/ai-assistance-domain.ts
  - apps/csrm/src/features/ai-assistance/ai-assistance-notice.test.tsx
  - apps/csrm/src/features/ai-assistance/ai-assistance-notice.tsx
  - apps/csrm/src/features/ai-assistance/ai-assistance-schema.ts
  - apps/csrm/src/features/ai-assistance/ai-assistance-service.test.ts
  - apps/csrm/src/features/ai-assistance/ai-assistance-service.ts
  - apps/csrm/src/features/ai-assistance/ai-citations.test.tsx
  - apps/csrm/src/features/ai-assistance/ai-citations.tsx
  - apps/csrm/src/features/ai-assistance/ai-control-suggestions.test.tsx
  - apps/csrm/src/features/ai-assistance/ai-control-suggestions.tsx
  - apps/csrm/src/features/ai-assistance/ai-field-marker.test.tsx
  - apps/csrm/src/features/ai-assistance/ai-field-marker.tsx
  - apps/csrm/src/features/ai-assistance/ai-generation-facts-schema.ts
  - apps/csrm/src/features/ai-assistance/ai-policy-gate.tsx
  - apps/csrm/src/features/ai-assistance/ai-provenance-domain.ts
  - apps/csrm/src/features/ai-assistance/ai-provenance-header.test.tsx
  - apps/csrm/src/features/ai-assistance/ai-provenance-header.tsx
  - apps/csrm/src/features/ai-assistance/ai-review-bar.test.tsx
  - apps/csrm/src/features/ai-assistance/ai-review-bar.tsx
  - apps/csrm/src/features/ai-assistance/ai-run-sheet-trigger.tsx
  - apps/csrm/src/features/ai-assistance/ai-run-sheet.test.tsx
  - apps/csrm/src/features/ai-assistance/ai-run-sheet.tsx
  - apps/csrm/src/features/ai-assistance/ai-source-popover.tsx
  - apps/csrm/src/features/ai-assistance/ai-uncited-claims.test.tsx
  - apps/csrm/src/features/ai-assistance/ai-uncited-claims.tsx
  - apps/csrm/src/features/ai-assistance/use-ai-decisions.test.tsx
  - apps/csrm/src/features/ai-assistance/use-ai-decisions.ts
  - apps/csrm/src/features/assessments/analyst-assessment-route.test.tsx
  - apps/csrm/src/features/assessments/assessment-actions.ts
  - apps/csrm/src/features/assessments/assessment-detail.tsx
  - apps/csrm/src/features/assessments/assessment-draft-job.tsx
  - apps/csrm/src/features/assessments/assessment-editor.test.tsx
  - apps/csrm/src/features/assessments/assessment-editor.tsx
  - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
  - apps/csrm/src/features/assessments/assessment-schema.ts
  - apps/csrm/src/features/assessments/assessment-service.test.ts
  - apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx
  - apps/csrm/src/features/assessments/questionnaire-generation-job.tsx
  - apps/csrm/src/features/assessments/released-assessment.test.tsx
  - apps/csrm/src/features/assessments/released-assessment.tsx
  - apps/csrm/src/features/assessments/risk-editor.tsx
  - apps/csrm/src/features/contract-response-parity.test.ts
  - apps/csrm/src/features/parser-free-modules.ts
  - apps/csrm/src/features/questionnaires/questionnaire-detail.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-governance.test.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-governance.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-introduction.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-list.test.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-renderer.test.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-renderer.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-review.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.test.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-schema.test.ts
  - apps/csrm/src/features/questionnaires/questionnaire-schema.ts
  - apps/csrm/src/features/questionnaires/questionnaire-service.test.ts
  - apps/csrm/src/features/questionnaires/questionnaire-service.ts
  - apps/csrm/src/features/questionnaires/questionnaire-submitted-answers.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx
  - apps/csrm/src/features/quick-find/quick-find-constants.ts
  - apps/csrm/src/features/quick-find/quick-find-domain.ts
  - apps/csrm/src/features/risks/risk-details.test.tsx
  - apps/csrm/src/features/risks/risk-details.tsx
  - apps/csrm/src/lib/api/conflict-reasons.test.ts
  - apps/csrm/src/lib/api/conflict-reasons.ts
  - apps/csrm/src/lib/api/generated/schema.d.ts
  - apps/csrm/src/lib/api/refusal-copy.test.ts
  - apps/csrm/src/lib/api/refusal-copy.ts
  - apps/csrm/src/lib/api/transport/server-client.test.ts
  - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
  - docs/contract-gaps/phase-12-ai-run-record-and-provenance.md
  - docs/design/csrm-design-direction.md
  - docs/references/idambox-csrm-role-function-api-catalogue.json
  - docs/references/served-operations.json
  - docs/references/specification.json
  - docs/security/phase-08-residual-risks.md
findings:
  critical: 6
  warning: 35
  info: 28
  total: 69
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-10-08T02:12:30Z
**Depth:** standard
**Files Reviewed:** 180
**Status:** issues_found

## Summary

Phase 12 is reviewed from `7e4fa02` (`PHASE_12_BASE`, the last commit before any Phase 12 code) to `ff625f2`. The scope is every file the range added, modified or renamed outside `.planning/` (`git diff --name-only --diff-filter=AMR 7e4fa02..HEAD -- . ':(exclude).planning'`), less three operator housekeeping files that are not Phase 12 work: `ClaudeCodexOrchestrationPrompt.md`, `overlay-with-bproton-dev-csrm.sh` and `pnpm-lock.yaml` (whose only Phase 12 change is the approved `knex` declaration). That is 180 files. No file was deleted in the range.

The operator's single-pass review of 2026-10-06 (`5d91441`) is the review of record. It covered 161 of the 180 files at standard depth. It did not include 19 changed files, among them the core AI-context, policy and scale modules: `apps/backend/.env.example`, `apps/backend/config/ai.ts`, `apps/backend/package.json`, `apps/backend/src/csrm/ai-config-validation.ts`, `apps/backend/src/csrm/ai/assessment-context.ts`, `apps/backend/src/csrm/ai/data-policy.ts`, `apps/backend/src/csrm/ai/library-ranking.ts`, `apps/backend/src/csrm/ai/prompt-sections.ts`, `apps/backend/src/csrm/openai-compatible-client.ts`, `apps/backend/src/csrm/risk-scale.ts`, `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`, `docs/design/csrm-design-direction.md`, and the tests `ai-data-policy.unit.test.ts`, `ai-provider-boot.unit.test.ts`, `assessment-context.integration.test.ts`, `assessment-context.unit.test.ts`, `fixtures/uat-a-like-context.ts`, `library-ranking.unit.test.ts` and `risk-scale.unit.test.ts`.

Following the Phase 10 rule for reviews over 50 files (`STATE.md` Decisions), four `gsd-code-reviewer` lanes then reviewed the whole 180-file scope in parallel, at standard depth, diffed from `7e4fa02`, read-only, each writing its own report. Every lane read Phase 12's `12-CONTEXT.md` and the contract-gap record `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md` as the intended behaviour; lanes 1, 3 and 4 also read `12-UI-SPEC.md`, and the two test lanes read the `12-VALIDATION.md` maps. Each took the operator's four findings as already known. The lanes are: 1xx, Strapi source and contract (`apps/backend/src/**`, `apps/backend/types/**`, `apps/backend/config/ai.ts`, `apps/backend/.env.example`, `apps/backend/package.json`, `docs/**`, `CONTEXT.md`; 51 files); 2xx, Strapi tests, fixtures and harness (`apps/backend/tests/**`; 41 files); 3xx, web source (every changed `apps/csrm/**` file that is not a unit test, not under `e2e/` and not `playwright.config.ts`; 48 files); 4xx, web unit tests, Playwright specs and helpers, and `apps/csrm/playwright.config.ts` (40 files). Large contract and data files (`specification.json`, both catalogue copies, `served-operations.json`, the generated types, the design direction and the residual-risk register) were reviewed by their Phase 12 diff only, as were large test files whose Phase 12 change is a minority of the file.

This file keeps the operator's review verbatim under "Operator review, 2026-10-06", with its IDs (CR-01, CR-02, WR-01, WR-02) unchanged, its title line replaced by that heading and its other headings moved down one level. Each lane report follows verbatim, one section per lane, with its headings moved down one level. Lane finding IDs keep their lane's hundreds: BLOCKER is Critical (CR-), then WARNING (WR-) and INFO (IN-).

| Source | Files | Critical | Warning | Info | Total |
|---|---|---|---|---|---|
| Operator review, 2026-10-06 | 161 | 2 | 2 | 0 | 4 |
| Lane 1 (1xx): Strapi source and contract | 51 | 0 | 7 | 10 | 17 |
| Lane 2 (2xx): Strapi tests, fixtures and harness | 41 | 2 | 10 | 10 | 22 |
| Lane 3 (3xx): web source | 48 | 1 | 8 | 4 | 13 |
| Lane 4 (4xx): web unit tests, Playwright specs and helpers, playwright.config.ts | 40 | 1 | 8 | 4 | 13 |
| All | 180 | 6 | 35 | 28 | 69 |

The counts are per source and are not deduplicated: a lane finding that repeats or extends another finding still counts in its lane, and the "Overlaps" list below names each one. Lane severities are reviewer claims until they are adjudicated. The dispositions, and the fixes for every confirmed Critical and Warning, go in `12-REVIEW-DISPOSITION.md`. Lane 2's header gives 42 files, but its list and its assignment hold 41; the table counts the list.

## Overlaps

**With the operator's findings**

- **WR-02** is extended by WR-209 and IN-110. WR-209: `ai-provider-questionnaire.unit.test.ts:59-63` asserts that a model's "Don’t know" choice keeps its own value, so the suite protects the behaviour WR-02 reports. IN-110: the same `appendNotSureChoice` can also append a second `not-sure` value. One normalisation fixes all three.
- **CR-01** is extended by IN-301. The header's "generated before CSRM recorded" note also keys on the assessment's envelope alone, so a malformed assessment envelope hides the counts while the Risk cards still show markers.
- **WR-01** is related to IN-103 (which cites it), WR-206 and WR-207. IN-103 and WR-206 report an in-transaction early return in `persistAssessmentDraft` that leaves a run `running`, which only the boot reconciliation of WR-01 later closes. WR-207 notes that no test drives that reconciliation through `src/index.ts`, so a WR-01 fix needs that test too.
- **CR-02** has no overlapping lane finding.

**The same defect reported by two lanes** (fix once; disposition both IDs)

- WR-206 (Lane 2) and IN-103 (Lane 1): the "assessment already exists" return at `assessment-workflow.ts:753-762` leaves the run `running`.
- WR-304 (Lane 3) and IN-107 (Lane 1): the Requestor's released assessment still carries `generatedBy`, in Strapi's projection and in the browser payload.
- WR-305 (Lane 3) and part of WR-404 (Lane 4): the Risk card's `aria-label` on a generic `span` at `assessment-editor.tsx:337`, which reads "1 fields".
- IN-303 (Lane 3) and WR-408 (Lane 4): the enqueue refusal for `AI_CLASSIFICATION_ABOVE_CEILING` does not name the classification or the ceiling, and the copy test pins that wording.
- WR-308 (Lane 3) and IN-104 (Lane 1): after a failed job, Retry is neither gated by the AI data policy in the card nor refused with the enqueue 409 by Strapi.
- WR-301 (Lane 3) and WR-405 (Lane 4): focus after a decision lands on the first remaining Confirm, and no test covers focus after a decision.

**A contradiction, settled against the code**

- Lane 3's "Checked and found correct" says the strict web parsers would reject `generation` and `aiOrigin` on a Requestor's questionnaire read. Lane 4's CR-401 is right: the shared summary schema accepts `generation` (`questionnaire-service.ts:60`), and the question transform passes `aiOrigin` through (`questionnaire-service.ts:103`, `:118`). Strapi serves both to analysts only (`questionnaire-scope.ts:546`, `:586`), so nothing leaks today.

## Operator review, 2026-10-06

**Reviewed:** 2026-10-06T21:09:48Z
**Depth:** standard
**Files Reviewed:** 161
**Status:** issues_found

### Summary

Reviewed the phase diff across the backend AI run and decision paths, assessment release checks, questionnaire generation, client review controls, tests, and contract files. Two defects can let a generated assessment pass the review gate or leave a suggested control in a false completed state. Two further defects affect multi-instance generation and the Requestor's Not sure guidance.

### Narrative Findings (AI reviewer)

#### Critical Issues

##### CR-01 [BLOCKER]: Malformed provenance bypasses the AI review release gate

**File:** `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts:338` (also line 350)

**Issue:** Both release checks call `proposedFieldsOf(parse...AiProvenance(...))`. A non-null but malformed provenance envelope parses to `null`, and `proposedFieldsOf(null)` returns an empty array. The release gate then treats every AI field on that assessment or Risk as reviewed. The adjacent readiness projection also omits the review requirement for malformed envelopes (lines 288 and 302), and the unit test at `apps/backend/tests/assessment-workflow.unit.test.ts:629` locks in that behavior. A corrupted or partially migrated envelope can therefore permit release without a recorded human decision.

**Fix:** Distinguish absent legacy provenance from present but invalid provenance. In `validateReleaseReadiness`, add `aiProposalsReviewed` to `missing` whenever a non-null envelope fails parsing; apply the same rule to each Risk and to `projectReleaseReadiness`. Add a test in which an otherwise release-ready, AI-generated assessment has malformed non-null provenance and release returns 409.

##### CR-02 [BLOCKER]: Manual removal leaves an AI suggestion permanently marked as added

**File:** `apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts:311` (also `apps/backend/src/api/csrm-assessment/services/ai-provenance.ts:208` and `apps/csrm/src/features/ai-assistance/ai-control-suggestions.tsx:112`)

**Issue:** Accepting a suggestion records `state: "added"` and the created implementation ID. The ordinary delete path removes that implementation without updating the Risk's suggestion fact. The projection preserves `added` even when the implementation no longer exists, and the UI then displays “Added as a planned control” with no Add or Restore action. After the short Undo toast expires, an analyst cannot add that suggestion again through the page, while the review record falsely says the control remains added.

**Fix:** In the manual delete transaction, find an `added` suggestion whose `implementation` matches the deleted document, move it back to `proposed`, clear the implementation snapshot, and append an auditable run event. Also make the projection reconcile missing implementations so legacy stale records are actionable. Test accept → manual delete → page read → re-add.

#### Warnings

##### WR-01 [WARNING]: Startup reconciliation can interrupt another server's active AI run

**File:** `apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts:94` (called from `apps/backend/src/index.ts:33`)

**Issue:** Every Strapi instance marks all database runs with `status: "running"` as interrupted during bootstrap. If one instance starts while another is generating, it changes the other instance's live run to `interrupted`; that worker's later `completeAiRun` rejects the run because it is no longer running. Generation then fails despite a healthy worker.

**Fix:** Reconcile only runs proven orphaned, using a worker identity and lease/heartbeat or another shared ownership signal. Do not update all `running` rows on each process startup. Add a two-worker test where one worker boots while the other has an active run.

##### WR-02 [WARNING]: Model-provided “Not sure” choices are missed by the Requestor guidance

**File:** `apps/backend/src/api/csrm-questionnaire/services/openai-compatible-questionnaire-generation-provider.ts:53` (also `apps/csrm/src/features/ai-assistance/ai-assistance-domain.ts:106`)

**Issue:** `appendNotSureChoice` leaves an equivalent model choice such as `"Not sure"` unchanged, including its value. `offersNotSure` only recognizes the canonical value `"not-sure"`. The choice is available in the questionnaire, but the introduction tells the Requestor to give a best answer instead of choosing it.

**Fix:** Normalize any equivalent model choice to the canonical `{ value: "not-sure", label: "Not sure" }` while avoiding duplicate values, then test the model-provided `"Not sure"` and `"Unsure"` cases through the stored definition and introduction.

---

_Reviewed: 2026-10-06T21:09:48Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_

## Phase 12: Code Review Report, Lane 1 (Strapi source and contract)

**Reviewed:** 2026-10-08T02:06:01Z
**Depth:** standard
**Files Reviewed:** 51
**Status:** issues_found

### Summary

I read every Strapi source file in the lane in full. I reviewed the catalogue copies, `served-operations.json`, `specification.json`, `contentTypes.d.ts`, the design direction and the residual-risk register by their Phase 12 diff, plus targeted extraction of the schemas and grants each hunk touches. I gave the 12 files outside the operator's pass full attention. I traced callees and callers outside the list where a claim depended on them: `prompt-data.ts`, `development-identity-enabled.ts`, `assessment-draft-registry.ts`, `questionnaire-generation-registry.ts`, the risk controller's `handleError`, the governance workflow's question projections, and the web `risk-editor.tsx` and `changedWritableValues`, to confirm that an untouched AI field is never sent back trimmed. I ran no tests, builds or servers.

I found no new BLOCKER beyond the operator's CR-01 and CR-02. The seven warnings cover five areas:

- **Control candidates.** Selection starves Risk Types late in the alphabet and leaves nothing for the library shortlist (WR-101).
- **The decision operation.** "Confirm remaining" is not idempotent, and "restore" without fields does nothing (WR-102). The batch parser also coerces `action` with `String()`, so an array is accepted as an action (WR-106).
- **Run-record failures.** These surface as unmapped 500s, and one bad run can permanently block review and release of its assessment (WR-103). The run-record size bounds are tighter than the context bounds and fail with a generic code, not `CONTEXT_TOO_LARGE` (WR-104).
- **Requestor text in the run record.** Requestor free text reaches the run's `contextSummary` and `proposal`, which contradicts the contract-gap record and the glossary (WR-105).
- **Draft instructions.** The draft's model instructions omit the bounds the adapter enforces by failing the whole draft (WR-107).

**Checked and found correct:**
- **Catalogue:** both copies are byte-identical (`cmp`). Exactly three Functions (`core_api`, `delete_api`, `reference_data_api`) lose `role.security_analyst_agent`, and the agent's role list loses exactly those three. Draft generate, job read and retry moved into `function.assessment_draft.*` API Functions granted to `role.security_analyst` only, mirroring `function.questionnaire_generation.*`. The new run read and decision Functions are analyst-only. `served-operations.json` agrees row for row.
- **Human-only guard:** `HUMAN_ANALYST_ONLY_OPERATIONS` holds all five new or moved operations. The policy refuses them for the agent before any handler runs.
- **Run read:** the core router is `only: []`, the bespoke route is the only route, and a query string gets a 400. An unknown run gets the same 404 as any other, so ids cannot be enumerated. The projection is closed, matches `AiRun` and `AiRunContextSummary`, and never serves the proposal or the decisions.
- **Run versus assessment:** a run cannot be decided through another assessment. A risk target from another assessment, or an unknown risk, is a uniform 400, and the run always comes from the target's stored `aiProvenance`, never from the client.
- **No generic writes:** `aiProvenance` is in neither `RISK_WRITABLE_FIELDS` nor `ASSESSMENT_WRITABLE_FIELDS`. No generic route writes `CsrmAiRun`, and the Requestor projections carry only `aiAssisted`.
- **Data policy:**
  - the classification order and the Internal default (D-26);
  - the development double key, which matches `developmentIdentityEnabled`;
  - fail-closed elsewhere, and an invalid ceiling failing `register` (D-27);
  - the 409 at enqueue and the re-check when the job runs, before any run or provider call, for both operations and both providers (D-28);
  - transcript logging gated at `logCompletionDiagnostic`, with a boot warning outside development (D-30).
- **Context builder:**
  - no owner, comments, numbers or dates are sent;
  - every Requestor value is wrapped by `promptDataTag` inside `<requestorData>`, and the system prompts declare that block data;
  - the analyst slot stays empty;
  - `CONTEXT_TOO_LARGE` fires before the run and before the provider call;
  - the digest is over the exact `userPrompt` the client sends.
- **Ranking:** the ranking is deterministic, with an id tie-break.
- **Draft parser and adapter:**
  - the closed parser runs unconditionally for both providers, again in `persistAssessmentDraft`;
  - ratings are derived, and banding is 1–4, 5–9, 10–16 and 20–25;
  - Accept becomes Treat when High or Critical, or when suggestions exist, with the adjustment recorded;
  - systems and assets come only from short keys, classification only from the chosen asset;
  - unknown sources and controls are dropped with adjustments, and unknown systems are refused;
  - suggestions are capped at five.
- **Questionnaire adapter:** 6 to 20 questions, Boolean excluded from the wire enum, help text bounded at 2,000, and "Not sure" appended (WR-02 aside).
- **Run lifecycle:** a run is created immediately before the provider call and completed inside the persisting transaction. A failure is recorded outside the transaction, and a retry creates a new run. `decisions` is append-only: it is read, validated, then concatenated, never rewritten or truncated.
- **Decisions:**
  - every decision passes `withMutableAssessmentMutation`, which runs `assertMutableAssessment`;
  - only content changes take the edit transition;
  - an exact repeat is a no-op and a conflicting one gets `AI_PROPOSAL_ALREADY_DECIDED`;
  - restore of an added suggestion compares the snapshot first (`AI_SUGGESTION_CONTROL_CHANGED`);
  - `AI_ACCEPT_WITH_PLANNED_CONTROL` is checked after the whole batch, so a control added earlier in the same batch counts;
  - `aiProvenance` and the run log are written in the same transaction.
- **Edits:** risk and assessment edits mark `edited` in the same transaction, comparing relation document ids.
- **Questionnaire reads:** `helpText` is served to both actors, and `aiAssisted` to both. The `generation` block and `aiOrigin` are served to analysts only, and legacy records read as null.

### Warnings

#### WR-101 [WARNING]: Control candidate selection gives late-alphabet Risk Types and the whole-library shortlist no slots once applicable controls reach 150

**File:** `apps/backend/src/csrm/ai/assessment-context.ts:90-103` (`buildAssessmentContext`, the `selected` map); also `:81` (offered types sorted by name before the fill)
**Issue:** The candidate set is filled by walking `offeredTypes` in name order and taking up to 20 applicable controls per type until `selected.size >= 150`. The `break` exits only the inner loop. Every later type therefore contributes nothing, and the library shortlist loop (`:100-103`) breaks on its first iteration. D-12 promises "each offered Risk Type's applicable controls plus a deterministic lexical shortlist of the whole library". Past 150, the set is decided by alphabetical position, not relevance. The context summary records only `offered`/`total`, so the analyst cannot see which types were starved.
**Failure scenario:**
1. A library has 15 Risk Types with 12 applicable controls each (180 in total).
2. The first 12.5 types alphabetically fill all 150 slots.
3. A risk typed "Third-Party Dependency" or "Vulnerability Management" has no candidate controls, and no lexical shortlist control is offered.
4. The strict wire enum (`openai-compatible-assessment-draft-provider.ts:24`) forbids anything else, so those risks get no suggestions. This degrades success criterion (3) without any signal.
**Fix:** Allocate per type fairly. For example, give each offered type `floor(150 * 0.6 / offeredTypes.length)` slots (at least 1), ranked by `rankByRelevance` within the type. Reserve the remainder for the library shortlist, then fill leftovers by relevance across all types. Record the starved count in the summary, or keep it bounded as today. Prove it with a unit test in `assessment-context.unit.test.ts`: 15 types × 12 controls, plus a library control that matches the query lexically. Assert that every offered type has at least one candidate and the shortlist control is present.
**Content-type change:** none

#### WR-102 [WARNING]: "Confirm remaining" is not idempotent, and "restore" without `fields` can never restore anything

**File:** `apps/backend/src/api/csrm-assessment/services/ai-proposal-decisions.ts:201-202` (`const names = decision.fields ?? proposedFieldsOf(envelope); if (names.length === 0 …) invalid();`)
**Issue:** A field decision without `fields` targets the currently `proposed` fields. For `accept` ("Confirm remaining"), a repeat after every field has been decided finds no proposed fields and throws 400 "Proposal decision data is invalid." The whole batch then rolls back. D-24 and the contract-gap record ("an exact repeat is a no-op") require a no-op instead. For `restore`, the same default selects `proposed` fields, which `applyFieldDecision` can never restore (only `accepted` → `proposed`). A field-less restore is therefore always `unchanged`, or a 400 once nothing is proposed.
**Failure scenario:**
1. The analyst clicks "Confirm remaining" for a risk.
2. The Server Action's response is lost (a timeout or navigation), and the UI retries, or a double submit reaches the server.
3. The second batch `{ target: risk, action: "accept" }` returns 400, and every other decision in that batch (for example, confirmations on other risks) is discarded.
4. The analyst sees an error for an action that succeeded.
**Fix:** When `fields` is omitted:
- for `accept`, treat an empty `names` as `unchanged += 1; continue;`;
- for `restore`, either require `fields` in `parseAiProposalDecisionBatch` (400 at parse time) or default to the `accepted` fields.

Keep the 400 only for explicitly named fields that are not in the envelope. Prove it with an integration test in `ai-proposal-decisions.integration.test.ts`: post the same field-less accept twice and expect `{ applied: 1 }`, then `{ applied: 0, unchanged: 1 }`, with persistence otherwise deep-equal.
**Content-type change:** none

#### WR-103 [WARNING]: `AiRunRecordError` is never mapped, so one bad run record makes AI fields permanently uneditable and unconfirmable, as unhandled 500s

**File:** `apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts:29-33` (`AiRunRecordError`, status 409) and `:83-90` (`appendAiRunDecisions`); callers `apps/backend/src/api/csrm-risk/services/risk-workflow.ts:239`, `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts:528` and `apps/backend/src/api/csrm-assessment/services/ai-proposal-decisions.ts:238`. Controllers: `csrm-assessment.ts` (`decideAiProposals`/`updateAssessment` catch only `AssessmentScopeError`/`AssessmentWorkflowError`), and `csrm-risk.ts:98-106` (`handleError`).
**Issue:** Every decision, and every edit of a `proposed` or `accepted` AI field, appends to the run's `decisions`. `appendAiRunDecisions` throws `AiRunRecordError` in three cases:
- the run is missing (the content type is fully editable and deletable in the Strapi admin Content Manager, so "runs are never deleted" is not enforced);
- the stored `decisions` fail the closed parse;
- the log would exceed 5,000 events.

No controller maps this class, so the client gets a 500. The failure is permanent for that assessment. The `proposed` fields can no longer be confirmed (decision fails) or edited (edit fails), so `aiProposalsReviewed` stays outstanding, and the assessment can never be released except by deleting the risks.
**Failure scenario:** Either of two sequences ends the same way:
- An administrator deletes or edits a `CsrmAiRun` row in the admin panel.
- An analyst toggles Confirm and Undo on "Confirm all" across a 50-risk assessment about 100 times, which reaches the 5,000-event cap.

Afterwards, every `PATCH /risks/{id}` that touches an AI field, and every `POST …/ai_proposal_decisions`, returns 500. Release readiness never reaches ready.
**Fix:**
- Map `AiRunRecordError` in the assessment and risk controllers to a 409 with a safe message, or translate it to `AssessmentWorkflowError(409, …)` inside the workflows.
- Decide the degraded-mode rule explicitly. For example, when the run is missing or its log is unreadable, still update `aiProvenance` and record the history failure, rather than blocking the current fact on the history log. Alternatively, raise the cap and document the lockout.
- Mark `CsrmAiRun` read-only in the admin, with `pluginOptions` `content-manager`/`content-type-builder` visibility, so the "never deleted" rule is enforced.

Prove the fix with an integration test that seeds a draft, deletes its run, then PATCHes an AI field and decides one. Expect a 409 (or success per the chosen rule), never a 500.
**Content-type change:** optional: `"pluginOptions": { "content-manager": { "visible": false } }` on `csrm-ai-run/schema.json` to keep runs out of admin editing.

#### WR-104 [WARNING]: The run-record size bounds are tighter than the context and parser bounds, and they fail with a generic code, not `CONTEXT_TOO_LARGE`; an oversized proposal is discarded after the provider call

**File:** `apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts:46` (`contextSummaryBytes: 65_536` in `parseContextSummary`), `:52` (`proposalBytes: 1_048_576`) and `:65` (`createRunningAiRun` throws `AiRunRecordError`); `apps/backend/src/csrm/ai/assessment-context.ts:30` (`CONTEXT_BOUNDS`); `apps/backend/src/api/csrm-assessment/services/assessment-draft-provider.ts:31,76` (statements of 2,000 characters, 50 risks)
**Issue:** D-06 says anything over a hard bound fails before the provider call with `CONTEXT_TOO_LARGE` and a plain message. The summary, however, holds:
- a source per question: key, a label of up to 300 characters and a section;
- up to 100 systems and 100 assets with names of up to 255 characters (multi-byte names count in UTF-8 bytes);
- up to 60 Risk Type names.

That can exceed 64 KB inside `CONTEXT_BOUNDS`. `parseContextSummary` then returns null and `createRunningAiRun` throws `AiRunRecordError`. This happens outside the `try`, so the job fails as `DRAFT_GENERATION_FAILED`/`QUESTIONNAIRE_GENERATION_FAILED`, not `CONTEXT_TOO_LARGE`. Likewise, the draft parser admits proposals over 1 MB:
- 50 risks × 9 statements × 2,000 characters;
- plus claims and rationales;
- plus multi-byte text.

`completeAiRun` then throws inside the persisting transaction, after the provider was paid and answered, and the draft is discarded as `ASSESSMENT_DRAFT_FAILED`.
**Failure scenario:** Either of two inputs fails a request that is within every published limit:
- A questionnaire with about 150 questions whose texts and section titles are long.
- A request selecting 100 systems and 100 assets with long names in a non-Latin script.

The analyst sees a generic "generation failed" instead of "The request is too large for this operation."
**Fix:**
- Check the summary byte size in `buildAssessmentContext` and throw `AssessmentContextTooLargeError` there.
- Alternatively, bound the summary contents so that 64 KB cannot be exceeded within `CONTEXT_BOUNDS` (cap source labels lower, cap counts).
- Make the parser's total-size bound match `proposalBytes`, so an oversized proposal is refused as `PROVIDER_OUTPUT_INVALID` before the transaction.

Prove it with unit tests: a 200-reference context with 255-character multi-byte names must throw `CONTEXT_TOO_LARGE` from the builder, and an over-1 MB proposal must be refused by the parser.
**Content-type change:** none

#### WR-105 [WARNING]: Requestor free text reaches the run record, contradicting "A run keeps no Requestor free text"

**File:**
- `apps/backend/src/api/csrm-questionnaire/services/deterministic-questionnaire-generation-provider.ts:12,13,17,18` (title, `businessPurpose`, `businessCriticality`, `regulatoryRequirements` and `assets[0].name` interpolated into the title and question text);
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts:118` (the whole proposal stored as `run.proposal`);
- `apps/backend/src/csrm/ai/assessment-context.ts:63,117` (question text, up to 300 characters, stored as `contextSummary.questions.sources[].label`);
- `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md:65,105`;
- `CONTEXT.md` ("AI run … never the Requestor's own text").
**Issue:** The contract-gap record says "The summary holds no Requestor free text" and "A run keeps no Requestor free text (G-3)". The deterministic questionnaire provider copies whole Requestor fields into question text, for example `How do you meet ${regulatoryRequirements}?`, where `regulatoryRequirements` is unbounded text. That text is then persisted twice in runs that "are never deleted":
1. in the questionnaire run's `proposal`;
2. in every later draft run's `contextSummary`, where the question text becomes a source label.

The analyst-only run read serves the summary verbatim. A hosted model's questions and draft statements can echo Requestor text the same way. The governance claim in the approved record is therefore false, and retention of personal data in `csrm_ai_runs` is not what the record describes.
**Failure scenario:**
1. A Requestor writes personal or sensitive detail into Regulatory requirements or Business purpose.
2. The analyst generates a questionnaire with the deterministic provider (the E2E and default provider).
3. The run's `proposal` stores that text inside question 5's text.
4. After the questionnaire is answered and a draft is generated, the draft run's `contextSummary.questions.sources[4].label` stores up to 300 characters of it again.
5. Both survive any later edit or regeneration of the questionnaire.
**Fix:** Pick one rule and make code and documents agree:
- either store question sources in the summary by key, section and a generic label (for example "Question 5"), and stop the deterministic provider interpolating Requestor fields into question text;
- or amend the contract-gap record and the glossary to say the run keeps AI output and question text, which may quote the Requestor, under the assessment's retention.

Add a unit test asserting that a context summary built from a questionnaire whose question text contains a sentinel Requestor string does not contain the sentinel.
**Content-type change:** none (the documentation amendment option would be a dated amendment to the contract-gap record)

#### WR-106 [WARNING]: The decision parser coerces `action` with `String()`, so an array action passes validation and is executed as `restore`

**File:** `apps/backend/src/api/csrm-assessment/services/ai-proposal-decisions.ts:39` (`!["accept","dismiss","restore"].includes(String(raw.action))`), `:50` (returns `raw.action` uncoerced), `:70-81` (`applySuggestionDecision`) and `:102-104` (`eventKind`)
**Issue:** `String(["accept"]) === "accept"`, so a body with `"action": ["accept"]` passes the closed parse, which should give a 400. The stored action is the array itself. In `applySuggestionDecision` both `action === "accept"` and `action === "dismiss"` are false, so control falls into the restore branch: an `added` suggestion returns `{ state: "proposed", effect: "remove" }`. The Planned implementation is deleted, the event is logged as `restored`, and `contentChanged` triggers the edit transition. For field decisions, the same array silently makes the item `unchanged`. AGENTS.md requires validating external input with closed schemas, and the specification declares `action` as a string enum.
**Failure scenario:**
1. A client bug or a crafted request posts `{ "decisions": [{ "target": { "kind": "risk", "riskId": "R1" }, "action": ["accept"], "suggestion": "CTRL-001" }] }` for a suggestion already added.
2. The server answers 200 `{ applied: 1 }`.
3. It removes the implementation it was asked to "accept", and the assessment regresses from in-review to draft if it was release-ready.
**Fix:** Validate the type: `typeof raw.action !== "string" || !["accept","dismiss","restore"].includes(raw.action)`. Apply the same check to `target.kind`, which is already compared strictly. Prove it with a unit test in `ai-proposal-decisions` asserting that `parseAiProposalDecisionBatch` throws a 400 for `action: ["accept"]`, `action: {}` and `action: 1`.
**Content-type change:** none

#### WR-107 [WARNING]: The draft's model instructions omit the bounds the adapter enforces by failing the whole draft

**File:** `apps/backend/src/api/csrm-assessment/services/openai-compatible-assessment-draft-provider.ts:32` (`ASSESSMENT_DRAFT_SYSTEM_INSTRUCTIONS`), `:46` (statements of at most 2,000 characters), `:52` (`uncitedClaims.length > 5` or a claim over 300 characters → `invalid()`), `:58` (suggestion rationale over 500 characters → `invalid()`); `apps/backend/src/api/csrm-assessment/services/assessment-draft-provider.ts:76` (more than 50 risks)
**Issue:** D-06 moves bounds out of the wire schema into the adapters, because the portable schema subset allows no `maxItems`/`maxLength`. But the system prompt tells the model none of these limits. It says only "List claims without a source under uncitedClaims" and nothing about five claims, 300 characters, a 500-character rationale or 2,000-character statements. Unlike suggestions, which are capped gracefully with `suggestions-capped`, a sixth uncited claim or a 301-character claim makes the whole draft `PROVIDER_OUTPUT_INVALID`. D-14's intent ("one bad citation never fails a draft") does not extend to claims. The same input on retry is likely to fail again.
**Failure scenario:**
1. On a UAT-C-like request, a hosted model lists six uncited claims for one risk, one of them a 320-character sentence, which is plausible precisely when the model invents facts (UAT-042).
2. The adapter throws, and the job fails as "Provider returned invalid output."
3. The analyst retries and gets the same result.
**Fix:**
- State every enforced bound in `ASSESSMENT_DRAFT_SYSTEM_INSTRUCTIONS`: at most 50 risks, at most five uncited claims of at most 300 characters each, at most five suggestions with rationales of at most 500 characters, and statements of at most 2,000 characters.
- Optionally cap uncited claims like suggestions, keeping the first five and recording `uncited-claims-capped`, but keep refusing over-long text, per "no silent truncation".

Add a wire fixture with six claims through the fake OpenAI-compatible server and assert the chosen behaviour.
**Content-type change:** none

### Info

#### IN-101 [INFO]: The human-analyst denial message for the five Phase 12 operations says "questionnaire governance"

**File:** `apps/backend/src/policies/csrm-authorization.ts:74-78` (`humanAnalystDenialMessage`)
**Issue:** The function special-cases only release and the insight operations. A service agent refused draft generation, the draft job read or retry, the run read or the decision operation is told "CSRM questionnaire governance requires a human Security Analyst."
**Failure scenario:** The agent calls `POST /api/v1/risk_assessments/{id}/ai_proposal_decisions` and gets a 403 whose message names questionnaire governance.
**Fix:** Add a branch for the AI operations, for example "CSRM AI assistance requires a human Security Analyst." Assert the message in `authorization-policy.unit.test.ts`.
**Content-type change:** none

#### IN-102 [INFO]: The draft run and the draft job record different failure codes for the same generic failure

**File:** `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts:823` (`ASSESSMENT_DRAFT_FAILED`, "Assessment draft generation failed."); `apps/backend/src/api/csrm-assessment/services/assessment-draft-registry.ts:94` (`DRAFT_GENERATION_FAILED`, "…failed safely.")
**Issue:** A non-`AssessmentDraftJobFailure` error, such as a 409 state change, gives the job `DRAFT_GENERATION_FAILED` but the run `ASSESSMENT_DRAFT_FAILED`. The questionnaire path uses one code for both (`QUESTIONNAIRE_GENERATION_FAILED`).
**Failure scenario:** Phase 21 counts failed runs by code, while the hub shows the job code. The two never match for the same incident.
**Fix:** Use the registry's code and message in `persistAssessmentDraft`'s catch, or export one constant.
**Content-type change:** none

#### IN-103 [INFO]: The in-transaction "assessment already exists" early return leaves the run `running`

**File:** `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts:762`
**Issue:** The run is created at `:747`. If the locked re-read finds an existing assessment, the transaction returns success without `completeAiRun` or `failAiRun`, so the run stays `running` until the next boot marks it `interrupted`. The path is hard to reach in one process (the registry dedupes per questionnaire), but it breaks the rule that every provider call's run ends in a terminal state.
**Failure scenario:** A concurrent path creates the assessment between the job's pre-check and its lock. The job "succeeds", and the run reads `running`, then later `interrupted`.
**Fix:** Call `failAiRun(core, run.documentId, { code: "ASSESSMENT_ALREADY_EXISTS", … })` before returning, or throw and let the catch record it.
**Content-type change:** none
**Overlaps:** WR-01 (the run reconciliation)

#### IN-104 [INFO]: The retry paths re-queue a job without the enqueue-time policy 409

**File:** `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts:899-905` (`retryAssessmentDraftJob`); `apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts:163,194`
**Issue:** D-28 says that when the analyst asks, the refusal is a 409 before a job is queued. Retry re-queues without evaluating the policy. The job-time re-check still refuses before any run or provider call, so nothing leaks, but the analyst gets a queued job that fails rather than an immediate closed reason.
**Failure scenario:** The ceiling is lowered after a failure, and the analyst clicks Retry. The job is accepted, then fails with `AI_CLASSIFICATION_ABOVE_CEILING`.
**Fix:** Evaluate `evaluateAiDataPolicy` in both retry entry points and throw the same 409 with its reason.
**Content-type change:** none

#### IN-105 [INFO]: Answers reach the prompt in lexicographic key order, not questionnaire order

**File:** `apps/backend/src/csrm/ai/assessment-context-loader.ts:35` (`.sort(... questionKey ...)`)
**Issue:** Generated keys are `q-1` … `q-20`, so the prompt lists q-1, q-10 … q-19, q-2, …. Sections are interleaved, and conditional follow-ups are separated from the questions they depend on. It is deterministic, but it degrades the context the model reads.
**Failure scenario:** On a 12-question questionnaire, the follow-up "What does the provider do?" (q-4) appears after q-11 and q-12, away from q-3.
**Fix:** Sort by section order, then question order, then key.
**Content-type change:** none

#### IN-106 [INFO]: The wire schema emits `enum: []` for `controlNumber` when there are no candidates

**File:** `apps/backend/src/api/csrm-assessment/services/openai-compatible-assessment-draft-provider.ts:24`
**Issue:** With an empty control library, or no candidates, `Object.keys(context.allowed.controlCandidates)` is empty, and strict structured-output validators commonly reject an empty `enum`. Every draft would then fail as "Provider rejected the completion request." I did not prove the rejection against Azure; it depends on the provider.
**Failure scenario:** A fresh tenant has no controls, and every hosted draft is refused by the endpoint.
**Fix:** When there are no candidates, emit `suggestedControls` with `items` whose `controlNumber` is `{ type: "string" }` (the adapter drops unknown numbers anyway), or omit the property's enum.
**Content-type change:** none

#### IN-107 [INFO]: The Requestor's released assessment still serves `generatedBy`

**File:** `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts:304` (`projectAssessmentDetail`) and `:348` (`projectReleasedAssessmentDetail`); `docs/references/specification.json` (`RequestorReleasedAssessmentDetail.required` still lists `generatedBy`)
**Issue:** D-23 removes "Generated by {analyst}" from the released view (UAT-032). The UI drops the label, but the Requestor's API still names the analyst who initiated AI generation. Provider and model are correctly withheld.
**Failure scenario:** A Requestor's client, or a later UI change, can still show who generated the draft.
**Fix:** Decide whether the Requestor should learn the generator. If not, omit `generatedBy` from the Requestor variant and the schema in the same plan, as D-02 requires.
**Content-type change:** none

#### IN-108 [INFO]: The contract-gap record and the catalogue note contain stale or inaccurate statements

**File:** `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md:93` ("no existing attribute, relation, enumeration value, endpoint or grant changes"); the Phase 12 design note in both catalogue copies ("the AI proposal decision operation gets its own Function in plan 12-12")
**Issue:** Phase 12 does change grants: D-32 moves three operations, and D-33 withdraws three Functions from the agent. The catalogue note still describes as future work the `function.ai_proposals.decide_api` Function that the same file already contains.
**Failure scenario:** Another workstream reading the record concludes that no grant changed in Phase 12.
**Fix:** Scope the sentence to "this extension", and name the catalogue moves as separate D-32/D-33 changes. Update the note to the past tense in both copies, keeping them byte-identical.
**Content-type change:** none

#### IN-109 [INFO]: Blank model help text is accepted silently as null

**File:** `apps/backend/src/api/csrm-questionnaire/services/openai-compatible-questionnaire-generation-provider.ts:69,92`
**Issue:** D-16 says every generated question carries short help text. The adapter accepts `""` or whitespace and stores `null` without recording an adjustment, so a model that skips help text yields a questionnaire with none, and the run gives no sign of it. This is consistent with `ai-provider-questionnaire.unit.test.ts:64-65`, so it is a deliberate leniency, but it is undocumented against D-16.
**Failure scenario:** A hosted model returns `helpText: ""` for every question. The non-expert Requestor sees no hints, and success criterion (5) silently fails.
**Fix:** Record a `help-text-missing` adjustment in the proposal envelope, or document the leniency in the contract-gap record.
**Content-type change:** none

#### IN-110 [INFO]: `appendNotSureChoice` can create a duplicate `not-sure` value

**File:** `apps/backend/src/api/csrm-questionnaire/services/openai-compatible-questionnaire-generation-provider.ts:51-54`
**Issue:** Equivalence is tested on the label against a fixed set ("not sure", "unsure", …). A model choice whose text is `not-sure` or `Not-sure` is not equivalent by label. Its value is its own text, so a `{ value: "not-sure" }` choice is appended next to a model choice whose value is also `not-sure` (exactly so for the lower-case form). If `parseQuestionnaireDefinition` rejects duplicate values, the whole questionnaire fails. I did not run it to confirm the duplicate-value refusal.
**Failure scenario:** The model returns choices `["Yes","No","not-sure"]`. The adapter appends `{value:"not-sure",label:"Not sure"}`, giving a duplicate value and `PROVIDER_OUTPUT_INVALID`.
**Fix:** Normalise both label and value (lower-case, hyphens and curly quotes as spaces) in the equivalence test, and never append a value that already exists.
**Content-type change:** none
**Overlaps:** WR-02

---

_Reviewed: 2026-10-08T02:06:01Z_
_Reviewer: Claude (gsd-code-reviewer), Lane 1_
_Depth: standard_

## Phase 12: Code Review Report, Lane 2 (Strapi tests, fixtures and harness)

**Reviewed:** 2026-10-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 42
**Status:** issues_found

### Summary

I read every new Phase 12 test file, fixture and helper in full. For the eight large files I read the `git diff 7e4fa02..HEAD` hunks and the setup they depend on. For each test, I traced the source it exercises to decide whether the test could fail if the behaviour it names broke. The source I read was: `csrm/ai/data-policy.ts`, `assessment-context.ts`, `assessment-context-loader.ts`, `library-ranking.ts`, `csrm/risk-scale.ts`, `ai-config-validation.ts`, `openai-compatible-client.ts`, both OpenAI-compatible adapters, the deterministic draft provider, `assessment-draft-provider.ts`, `ai-proposal-decisions.ts`, `assessment-workflow.ts` (`withMutableAssessmentMutation`, `transitionForAcceptedEdit`, `persistAssessmentDraft`), `csrm-authorization.ts`, `src/index.ts` and Strapi's own `dotenv` loading. I also used `git log`/`git show` to find which plan removed each deleted test. I ran nothing.

Main concerns:

1. **D-30 (G-7) has no test.** Plan 12-02 added the only proof that the transcript flag is ignored outside development. Plan 12-05 then deleted it, and `12-VALIDATION.md` still cites it.
2. **A cross-assessment negative test passes for the wrong reason.** The decision operation's "risk of another assessment" case is refused because that risk has no provenance, not because of the cross-assessment guard.
3. **Several claims in the VALIDATION map have no test behind them:**
   - the production fail-closed path (`AI_POLICY_NOT_CONFIGURED`);
   - `CONTEXT_TOO_LARGE` on the draft job;
   - Accept without a rationale;
   - the adapter's ordering;
   - reconciliation when Strapi boots.
4. **The fixtures cover less than their names suggest.** No AI wire fixture carries an uncited claim or an answer citation, and the mounted UAT-A-like draft cites no answers.

**Checked and found sound** (each of these can fail when its named behaviour breaks):

- **Harness pins (D-31).** The harness assigns these explicitly before `@strapi/strapi` is required:
  - `CSRM_AI_PROVIDER=deterministic`;
  - `CSRM_AI_DATA_CLASSIFICATION_CEILING` (empty by default);
  - `CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS=false`;
  - both Keycloak flags `false`.

  Explicit assignment wins whether Strapi's `dotenv.config()` (`@strapi/core/dist/configuration/index.js:14`, no override) runs before or after. An empty string really means unset: Strapi's `env()` returns `""`, and `parseClassificationCeiling("")` returns `null` (`data-policy.ts:38`). All of these variables are restored on `close()`. The labels and URLs of the hosted provider that `.env` supplies cannot change an outcome under the deterministic provider, and the tests assert `providerName` `deterministic-*`, which would catch a leak.
- **`ai-data-policy.integration.test.ts`:**
  - Enqueue refusal: a 409 with the exact reason and message, request and questionnaire deep-equal, no run, `assessmentDraft: null` and `aiPolicy` refused.
  - The Internal default refused under a Public ceiling, and Public allowed and completed.
  - Execution refusal with zero calls to either deterministic provider, through `withProviderCallRecorder`, which patches the same `dist` module instances Strapi resolves. The questionnaire retry test proves the patch reaches the provider.
- **`ai-run.integration.test.ts`:**
  - The append-only log: an earlier event survives later appends, and an oversized append changes nothing.
  - Interrupted reconciliation, then a second pass that changes nothing.
  - The run read is closed and omits the proposal and Requestor text; owner, other Requestor, service agent and no identity get 403; unknown runs give 404 with identical bodies; `?populate` gives 400.
- **`ai-proposal-decisions.integration.test.ts`:**
  - An exact repeat is a no-op, with risk, assessment and run deep-equal.
  - Owner, other Requestor and agent get 403 with persistence deep-equal.
  - 201 items give 400.
  - `AI_ACCEPT_WITH_PLANNED_CONTROL` for a manual Planned control and for a control added in the same batch, in both orders. Implemented controls and an AI Treat are not refused.
  - `AI_PROPOSAL_ALREADY_DECIDED` is atomic: the first decision in each batch would otherwise apply.
  - `ASSESSMENT_NOT_MUTABLE` is pinned by reason, so a removed guard would yield 400, not 409.
  - Undo is guarded by `AI_SUGGESTION_CONTROL_CHANGED`.
  - Dismiss and restore of a dismissed suggestion leave the review state unchanged, both in draft (where a wrongly applied accepted-edit would move it to in-review) and when release-ready (where it would regress to draft).
- **`assessment-workflow.integration.test.ts`:**
  - A persistence failure inside the transaction leaves a `failed` run for attempt 1, then a `completed` run for attempt 2.
  - Two Personal Information Handling risks, linked system and asset, and Restricted classification.
  - Edits mark only changed fields `edited`, and the edit events append.
  - The Requestor read is `aiAssisted` only.
  - The service agent is refused draft generation.
- **`questionnaire-generation.integration.test.ts`:** one run per call, a new run per retry, help text persisted and served, `aiOrigin` transitions, the Requestor sees no provenance, and `aiPolicy` on the jobs read.
- **The AI wire fixtures.** Each `unknown-*`, `rating-field`, `accept-on-high`, `boolean`, `five-questions`, `twenty-one-questions` (21 questions counted), `missing-not-sure` and `blank-help-text` fixture differs from a valid body only by its named defect. Each `accept-on-high` risk exercises a distinct branch, and the test pins the specific adjustment.
- **`uat-a-like-context.ts` resembles UAT-A:** three systems, a Restricted asset, the Privacy Act and TFN obligations, unsigned payment files, partial segregation of duties and an untested fallback.
- **Catalogue and authorisation:**
  - `authorization.integration.test.ts`: agent update and delete give 403 with the request deep-equal.
  - `contract-catalogue.integration.test.ts`: the Phase 12 block checks byte identity, the human-only Functions and the three withdrawn agent grants.
  - The matrix rows for draft generation, job read and retry, run read and decisions are `humanAnalystOnly`.
- **`conflict-reasons.unit.test.ts`:** parity with both published schemas.

### Critical Issues

#### CR-201 [BLOCKER]: The D-30 transcript gate has no test; plan 12-05 deleted the only proof, and the VALIDATION map still cites it

**File:** `apps/backend/tests/ai-provider-questionnaire.unit.test.ts` (whole file). The behaviour lives in `apps/backend/src/csrm/openai-compatible-client.ts:28`. The only related test is `apps/backend/tests/ai-provider-boot.unit.test.ts:149-168`, "AI configuration warns when transcript diagnostics are set outside development".

**Issue:** `logCompletionDiagnostic` writes the full system and user prompt, which is the Requestor's data, to `strapi.log.info` only when the flag is set and `isDevelopmentRuntime()` is true.

- Commit `de5d5b2` (plan 12-02) extended "questionnaire provider records transcripts only when explicitly enabled" to prove that nothing is logged under `CSRM_ENVIRONMENT=production` or `NODE_ENV=production`.
- Commit `2dba540` (plan 12-05) rewrote the file and deleted that test.

No test in the suite now calls `logCompletionDiagnostic` or asserts on `log.info`. The boot test proves only the boot warning, not that logging is suppressed. `12-VALIDATION.md` (G-7 · D-30 row) still cites "`ai-provider-questionnaire.unit.test.js` (the transcript case under both environments)". The proof of record for this data-policy control cannot fail because it no longer exists.

**Failure scenario:** someone drops `&& isDevelopmentRuntime()` from `openai-compatible-client.ts:28`, or changes it to `||`. Production with `CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS=true` then logs every Requestor prompt and model response to the Strapi log, and the whole suite stays green. Only the boot warning would still appear.

**Fix:** restore the deleted test against the v2 wire shape, using the fake server and `questionnaireContextFixture()`. Do the same for the assessment adapter.

```ts
test("questionnaire provider records transcripts only in development", async () => {
  const server = await startFakeOpenAiCompatibleServer({ responses: Array.from({ length: 4 }, () => ({ body: JSON.stringify(fixture("uat-a")) })) });
  const logs: unknown[] = []; const original = globalThis.strapi;
  const prior = { node: process.env.NODE_ENV, csrm: process.env.CSRM_ENVIRONMENT };
  const config = (diagnostics: boolean) => { globalThis.strapi = { config: { get: (k: string) => k === "ai" ? { providerLabel: "x", structuredOutputMode: true, requestTimeoutMs: 1000, reasoningEffort: "", completionTranscriptDiagnostics: diagnostics, questionnaireGeneration: { baseURL: server.baseURL, apiKey: "", model: "m", maxOutputTokens: 1024 }, assessmentDraft: { baseURL: "", apiKey: "", model: "", maxOutputTokens: 1 } } : undefined }, log: { info: (e: unknown) => logs.push(e) } } as never; };
  try {
    process.env.NODE_ENV = "development"; process.env.CSRM_ENVIRONMENT = "development";
    config(false); await provider.generate(input); assert.deepEqual(logs, []);
    config(true); await provider.generate(input); assert.ok(logs.length >= 2);
    logs.length = 0; process.env.CSRM_ENVIRONMENT = "production"; await provider.generate(input); assert.deepEqual(logs, []);
    process.env.CSRM_ENVIRONMENT = "development"; process.env.NODE_ENV = "production"; await provider.generate(input); assert.deepEqual(logs, []);
  } finally { /* restore env and globalThis.strapi; close server */ }
});
```

**Content-type change:** none

#### CR-202 [BLOCKER]: The "risk of another assessment" decision refusal passes because that risk has no provenance, not because of the cross-assessment guard

**File:** `apps/backend/tests/ai-proposal-decisions.integration.test.ts:138-147` (line 140, test "proposal batch bounds, conflicts and planned-control refusal are atomic"). The guard is in `apps/backend/src/api/csrm-assessment/services/ai-proposal-decisions.ts:141`.

**Issue:** the case `{ target: { kind: "risk", riskId: otherRiskId }, action: "accept", fields: ["riskStatement"] }` is meant to prove that a decision cannot reach a risk of another assessment through this assessment's endpoint. `otherRiskId` is `fixtures.aggregate.risk`, a risk seeded before Phase 12 with `aiProvenance: null`. The test at `assessment-workflow.integration.test.ts` ("mounted analyst detail projects missing or malformed provenance as null") asserts exactly that.

In `decideAiProposals`:

- line 141 refuses a mismatched parent with `invalid()` (400);
- line 143 also refuses a null envelope with `invalid()` (400).

The status is the same either way, so the test cannot tell whether line 141 exists. The snapshot also covers only the path assessment's risk, assessment and run, never `otherRiskId`.

**Failure scenario:** someone removes or breaks the parent check at line 141. An analyst then posts to `/risk_assessments/{A}/ai_proposal_decisions` with a risk of assessment B that carries proposed fields or suggestions:

- B's `aiProvenance` changes, and B's AI fields are marked accepted;
- a Planned implementation can be created on B's risk;
- B's mutability guard (`assertMutableAssessment`) and B's accepted-edit transition are bypassed, because only A is locked and checked. If B is released, this writes AI review facts and controls onto a released assessment.

The test still passes with 400.

**Fix:** give the foreign risk a valid envelope, so that only the cross-assessment check can refuse it, and snapshot it.

```ts
const foreignRunId = await harness.createAiRunFixture({ /* any run on B's request */ });
await harness.updateFixtureDocument("api::csrm-risk.csrm-risk", otherRiskId, { aiProvenance: { schemaVersion: 1, runId: foreignRunId, proposalKey: "risk-1",
  fields: { riskStatement: { state: "proposed", sources: [] } }, uncitedClaims: [], suggestions: [], adjustments: [] } });
const before = await harness.snapshot([() => harness.getRisk(otherRiskId), () => harness.getAiRun(foreignRunId), () => harness.getRisk(riskId), () => harness.getAssessment(assessmentId)]);
const response = await harness.request({ path, identity: harness.identities.analyst, init: body([{ target: { kind: "risk", riskId: otherRiskId }, action: "accept", fields: ["riskStatement"] }]) });
assert.equal(response.status, 400);
assert.deepEqual(await harness.snapshot([/* same getters */]), before);
```

Add the same probe with a suggestion `accept`, to prove that no implementation is created on the foreign risk.

**Content-type change:** none

### Warnings

#### WR-201 [WARNING]: Production fail-closed (`AI_POLICY_NOT_CONFIGURED`) is proven only on the pure function, never on the mounted or workflow path

**File:** `apps/backend/tests/ai-data-policy.unit.test.ts:13-26` and `:28-37`. Related: `apps/backend/tests/ai-data-policy.integration.test.ts` (whole file), `apps/backend/tests/helpers/strapi-http-harness.ts:575-576`, `apps/backend/src/csrm/ai/data-policy.ts:53-55`.

**Issue:** the grid test checks that `evaluateAiDataPolicy({ ceiling: null, developmentRuntime: false })` refuses. `readAiDataPolicyConfiguration` is tested only with an explicit development env, and its default `env = process.env` path is never exercised outside development.

The harness always sets `NODE_ENV` and `CSRM_ENVIRONMENT` to `development` after load. So every mounted test runs with the development double key, and no test sees `AI_POLICY_NOT_CONFIGURED` from a route, from `generation_jobs.aiPolicy`, or from a job run. `12-VALIDATION.md` (INT-05 · G-3 · D-26..D-28 row) claims "production with no ceiling refuses with `AI_POLICY_NOT_CONFIGURED` … at enqueue … and at execution" via `ai-data-policy.integration.test.js`. The file has no such case.

The execution-time refusal is checked only by calling `persistGeneratedQuestionnaire` or `persistAssessmentDraft` directly. The job's terminal `failureCode` ("a job that fails it ends with the same code") is never read.

**Failure scenario:** a call site or `readAiDataPolicyConfiguration` starts passing `developmentRuntime: true`, or reads the wrong variables, for example only `NODE_ENV`, which Strapi defaults to `development` (`@strapi/core/dist/configuration/index.js:17`). Production with no ceiling then generates freely, and every test passes.

**Fix:** add a mounted case using the harness's environment-switch helper (`strapi-http-harness.ts:1566`), with `NODE_ENV=production` or `CSRM_ENVIRONMENT=production` and an empty ceiling. Assert:

- a 409 with `{ reason: "AI_POLICY_NOT_CONFIGURED" }` for `generate_questionnaire` and `generate_assessment`;
- `generation_jobs.aiPolicy` equal to `{ status: "refused", reason: "AI_POLICY_NOT_CONFIGURED", … }`;
- no run;
- zero provider calls when the job fixture runs.

Add a unit assertion: `readAiDataPolicyConfiguration(cfg, { NODE_ENV: "development", CSRM_ENVIRONMENT: "production" }).developmentRuntime === false`. For the execution path, enqueue under an allowing ceiling while holding the job, tighten the ceiling, release the job, and assert the job's `failureCode`.

**Content-type change:** none

#### WR-202 [WARNING]: The 12-05 and 12-06 rewrites deleted existing coverage: the Phase 8 Risk Type ordering suite, the adapter sort, and the provider-selection safe default

**File:** `apps/backend/tests/ai-provider-assessment.unit.test.ts:23-33`, `apps/backend/tests/fixtures/ai-wire/assessment-v2-uat-a.json`, `apps/backend/tests/ai-provider-questionnaire.unit.test.ts` (whole file).

**Issue:** commit `7ab370e` (plan 12-06) removed six tests:

- "assessment provider orders mixed-case Risk Type names the way the parser checks them";
- "compareRiskTypeNames orders Risk Type names by UTF-16 code unit";
- "sortRiskProposals returns a copy…";
- "the parser accepts mixed-case Risk Types in the shared order and refuses the locale order";
- "the deterministic provider emits its Risk Types in the shared order…";
- "neither provider keeps a Risk Type ordering rule of its own".

Commit `2dba540` (plan 12-05) removed "provider selection defaults safely and persistence records provenance", along with the reasoning-effort and provider name/version assertions. No test references `compareRiskTypeNames`, `sortRiskProposals` or `CSRM_AI_PROVIDER_MODE` any more.

Every assessment wire fixture is already in shared order: Personal Information Handling, Personal Information Handling, then `null`. So the adapter's `sortRiskProposals(risks)` (`openai-compatible-assessment-draft-provider.ts:81`) is a no-op in every test. D-09's "no type last, model order kept within a type" and D-15's "the adapter assigns … the order" are unproven for hosted output. The only ordering check left is "reverse order is refused" by the parser.

**Failure scenario:** someone drops the adapter sort, or regresses to a locale sort, which is the Phase 8 bug that made the deterministic draft fail its own parser. Any real model that emits risks out of order, or uses mixed-case type names, then fails every draft with `PROVIDER_OUTPUT_INVALID`, and the suite stays green.

Separately, `ai-provider-selection.ts` could select `openai-compatible` for an unset or unknown `CSRM_AI_PROVIDER`, and nothing would fail.

**Fix:** add a wire fixture with risks in the order `null`, then `Personal Information Handling` (two, in a distinctive model order), then a mixed-case type. Assert the adapter's output order and that the within-type order is kept. Restore the mixed-case and code-unit ordering unit tests. Restore the selection test: unset and `anything-else` must give `deterministic`, and only `openai-compatible` selects it.

**Content-type change:** none

#### WR-203 [WARNING]: The parser's appetite gate is never isolated, and "Accept without a rationale becomes Treat" is untested (the code refuses instead)

**File:** `apps/backend/tests/assessment-workflow.unit.test.ts:166` (test "closed parser refuses mismatched ratings, invalid relations and citations, and disallowed Accept"). The rule lives in `apps/backend/src/api/csrm-assessment/services/assessment-draft-provider.ts:67`.

**Issue:**

- `changed(0, { treatmentAction: "Accept" })` targets the Internet Exposure risk, whose residual is Possible × Major = 12 (High). That risk also carries suggested controls from its applicable controls. Line 67 refuses when `!acceptProposalAllowed(residual) || suggestedControls.length > 0`, so this case passes on the suggestion half alone. The residual half, which is the closed parser's own copy of decision 8's appetite rule, is never tested by itself.
- The adapter test covers only the adapter's downgrade, and neither deterministic draft ever proposes a High Accept.
- The VALIDATION map's ASSESS-08 · D-10 · D-11 row says "Accept … without a rationale, becomes Treat with `accept-not-permitted`". No test exercises an empty rationale. In the source, an empty `treatmentPlan` makes `boundedString` call `invalid()` (adapter `:46`, parser `:47`), which fails the whole draft rather than downgrading one risk.

**Failure scenario:** someone deletes `!acceptProposalAllowed(value.residualRating) ||` from the parser. The unconditional gate (06.7 D-07) then admits a High or Critical Accept from any provider that bypasses the adapter, and no test fails. Separately, a model output with an empty Accept rationale fails the job, contrary to D-11, and no test shows it.

**Fix:** add a parser case on a risk with no suggestions: `changed(3, { residualLikelihood: "Likely", highestResidualConsequence: "Major", residualRating: "High" })` with Accept kept. Assert that it throws. Add an `accept-without-rationale` wire fixture and assert the decided outcome: either Treat plus an adjustment as D-11 says, or a recorded decision that refusal is intended, with the VALIDATION row corrected.

**Content-type change:** none

#### WR-204 [WARNING]: No wire fixture or mounted test carries an uncited claim or an answer citation (success criterion 2)

**File:**

- `apps/backend/tests/fixtures/ai-wire/assessment-v2-uat-a.json`: every source list is `["request.description"]` and every `uncitedClaims` is `[]`.
- `apps/backend/tests/ai-provider-assessment.unit.test.ts:23-49`.
- `apps/backend/tests/assessment-workflow.integration.test.ts:2359-2360`.
- `apps/backend/tests/ai-provenance.unit.test.ts:155,171-173`.

**Issue:**

- **Hosted adapter.** No assessment wire fixture contains an uncited claim, an `answer.*` citation, or a system or asset citation. `toAssessmentDraftProposal`'s handling of `uncitedClaims` (more than 5 refused, 300-character bound, passed through) is never exercised.
- **Mounted UAT-A-like draft.** It cites no answers. The deterministic provider cites only fixed keys (`internet-facing`, `handles-personal-data`, `recovery-tested`, and so on), and the UAT-A fixture's questions are `payment-files`, `duties`, `fallback` and `optional`. The mounted test asserts only a system and a request citation.
- **Analyst projection.** Answer citations are tested only for an unresolvable source (`answer.gone`, which becomes "Source no longer available"), never for a resolvable answer label.

The CONTEXT yardstick says a good draft "cites the payment-file and segregation answers", and UAT-042's invented fact must appear as an uncited claim.

**Failure scenario:** the hosted adapter returns `uncitedClaims: []`, or drops every `answer.*` key. Or the projection mislabels answer citations, for example with the wrong `kind` or label. UAT-042 regresses for the real provider, and the suite stays green.

**Fix:** add `answer.payment-files` and `answer.duties` citations, `"system-1"`, and an uncited claim to `assessment-v2-uat-a.json`. Assert they survive `toAssessmentDraftProposal`. Add a fixture with six uncited claims and assert it is refused. In the mounted test, give one UAT-A question a key the deterministic provider cites, or add an `answer.*` key to its rules. Then assert `citations.some(s => s.kind === "answer" && s.label === "Are payment files signed?")` and that some risk's `uncitedClaims` is non-empty.

**Content-type change:** none

#### WR-205 [WARNING]: `CONTEXT_TOO_LARGE` on the draft job is untested; the VALIDATION map cites a mounted refusal case that does not exist

**File:** `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts:743-744`. The only tests are `apps/backend/tests/assessment-context.unit.test.ts:85-92` (the pure builder) and `apps/backend/tests/questionnaire-generation.unit.test.ts` ("oversized questionnaire context refuses before creating a run", questionnaire only).

**Issue:** the D-06 row in `12-VALIDATION.md` names "the mounted refusal case in `assessment-workflow.integration.test.js`" for "`CONTEXT_TOO_LARGE` before any call and creates no run". `CONTEXT_TOO_LARGE` appears in no integration test. The draft path's `catch (error) { if (error instanceof AssessmentContextTooLargeError) throw new AssessmentDraftJobFailure(...) }` is never executed.

**Failure scenario:** someone moves the run creation above the context build, or changes the catch so the error becomes a generic `ASSESSMENT_DRAFT_FAILED`, or lets the provider run on a truncated context. The draft job then creates a run, or reports the wrong code, for a request with 101 assets, and no test fails.

**Fix:** in `assessment-workflow.integration.test.ts`, create a request with 101 information assets and a submitted questionnaire. Run `runAssessmentDraftJobFixture` inside `withProviderCallRecorder`, and assert:

- rejection with `code === "CONTEXT_TOO_LARGE"`;
- `counts.assessment() === 0`;
- `listAiRunsForRequest(requestId)` is `[]`.

Through the route, also assert that the job ends `failed` with `failureCode: "CONTEXT_TOO_LARGE"`.

**Content-type change:** none

#### WR-206 [WARNING]: No test covers the draft's "assessment already exists" branch, which returns without completing or failing the run

**File:** `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts:753-754` (inside the transaction in `persistAssessmentDraft`). The nearest test is `apps/backend/tests/assessment-workflow.integration.test.ts:394-405` (simultaneous requests), which single-flights before the run exists.

**Issue:** `createRunningAiRun` runs before the transaction. Inside the transaction, `if (existingAssessmentId) return { assessmentId: existingAssessmentId };` returns without reaching `completeAiRun`, and it is not an error, so the `catch` that calls `failAiRun` is skipped. The provider has already been called, and the run stays `running` until the next restart marks it `interrupted`. That breaks D-20: every provider call has exactly one run, which completes or fails. The questionnaire workflow has no equivalent early return.

No test reaches this branch. The draft tests also never assert the run count: they use `runs.some(...)` and `runs.find(...)` (`:447-451`) rather than `runs.length`, so a stray `running` or duplicate run would go unnoticed.

**Failure scenario:** two drafts race for one request, for example a retry while another questionnaire's draft commits, or a regeneration. A provider call leaves a permanently `running` run that the analyst's disclosure reads as in progress. Today this is invisible to the suite.

**Fix:** add a test that holds the draft job after `createRunningAiRun`, attaches an assessment to the request through `updateFixtureDocument`, then releases the job. Assert that the run ends `completed` or `failed` (whichever Lane 1 decides), never `running`. Tighten the draft assertions to `assert.equal(runs.filter(r => r.operation === "assessment-draft").length, 2)`.

**Content-type change:** none

#### WR-207 [WARNING]: The bootstrap wiring for D-20 reconciliation and the D-27 boot failure is untested

**File:** `apps/backend/tests/ai-run.integration.test.ts:59-62` and `apps/backend/tests/ai-provider-boot.unit.test.ts:144-147`. The wiring is in `apps/backend/src/index.ts:19` and `:33`.

**Issue:** both tests call the functions directly: `reconcileInterruptedAiRuns` through `reconcileInterruptedAiRunsFixture`, and `assertCsrmAiConfiguration`. No test proves that `register` refuses to boot on an invalid ceiling, or that `bootstrap` turns a `running` run into `interrupted`. `keycloak-provisioning.unit.test.ts` already drives `application.register` with a fake Strapi, so the pattern exists. The VALIDATION rows say "`running` runs become `interrupted` at boot" and "an invalid ceiling fails boot".

**Failure scenario:** someone deletes `await reconcileInterruptedAiRuns(strapi)` or `assertCsrmAiConfiguration(strapi)` from `src/index.ts`. Runs orphaned by a restart then stay `running` forever, or an invalid ceiling boots and fails only at the first generation. Every test passes.

**Fix:** with the fake Strapi from `keycloak-provisioning.unit.test.ts`, assert that `application.register` throws `CsrmAiConfigurationError` for `dataClassificationCeiling: "Secret"`. Assert that `application.bootstrap` calls the run reconciler, either through a fake `documents("api::csrm-ai-run.csrm-ai-run")` that records the `running` to `interrupted` update, or by seeding a `running` run before the next harness boot in a dedicated file.

**Content-type change:** none

#### WR-208 [WARNING]: "Applicable controls stop at 20" is never asserted, and the candidate cap is checked only as at most 150

**File:** `apps/backend/tests/assessment-context.unit.test.ts:77-83` (test "61 types offer 60 and applicable controls stop at 20").

**Issue:** the only control assertion is `context.summary.controlCandidates.offered <= 150`. With 60 offered types of 25 unique controls each, the global `break` at 150 is reached after six types whether or not the per-type bound of 20 (`CONTEXT_BOUNDS.applicableControlsPerType`) exists. The per-type bound also limits the `riskType.applicableControl` lines in the prompt, and no test counts them. `<= 150` also passes when zero candidates are offered.

**Failure scenario:** someone removes the per-type `rankByRelevance(..., 20, ...)` bound, or breaks candidate selection so nothing is offered. Prompts grow by up to 25 references per type, or the model gets no candidates, and the test passes.

**Fix:**

- Assert `context.summary.controlCandidates.offered === 150`.
- For one type, assert that the number of `riskType.applicableControl` entries starting with `Type 0:` in `userPrompt` is 20.
- Add a case with fewer than 150 total candidates, where removing the per-type bound changes the offered count. For example, 3 types × 25 controls gives 60 with the bound and 75 without it.

**Content-type change:** none

#### WR-209 [WARNING]: A test locks in that a model-provided "Don't know" keeps its own value, so the "Not sure" contract is asserted the wrong way

**File:** `apps/backend/tests/ai-provider-questionnaire.unit.test.ts:59-63`, `:43`, and `apps/backend/tests/fixtures/ai-wire/questionnaire-v2-missing-not-sure.json` (question 3).

**Issue:** "adapter adds Not sure once…" asserts that a Single select with `["Yes","Don’t know"]` stays at two choices with the label `Don’t know`. Through `appendNotSureChoice` (`openai-compatible-questionnaire-generation-provider.ts:51-54`), its value stays `Don’t know` rather than `not-sure`. Test 1 checks only the last `label` (`"Not sure"`), never the value. So the suite treats as correct exactly the shape that WR-02 says `offersNotSure` misses. It is not just missing a test.

**Failure scenario:** the Requestor introduction omits the "Not sure" mention (D-23) for every model-generated questionnaire that offers "Not sure", "Unsure" or "Don't know". The unit test actively protects that behaviour.

**Fix:** decide the contract. If the stored value must be `not-sure`, normalise equivalents in `appendNotSureChoice` and assert `choices.at(-1)` deep-equals `{ value: "not-sure", label: "Not sure" }` for questions 0, 1 and 2, plus the `uat-a` question 8. Otherwise, add an `offersNotSure` assertion that recognises the equivalent labels.

**Content-type change:** none

**Overlaps:** WR-02

#### WR-210 [WARNING]: The decision suite shares one mutable draft across order-dependent tests and addresses risks by unsorted index

**File:** `apps/backend/tests/ai-proposal-decisions.integration.test.ts:9-35`, `:101`, `:342`, `:402`. The same pattern is in `apps/backend/tests/assessment-workflow.integration.test.ts:2270-2275`.

**Issue:**

- `fixturePromise` generates one draft that every test mutates.
- Later tests assert state left by earlier ones: `assert.equal(draft.status, "draft", "the previous case left the assessment in draft")`, and test 9 restores a `treatmentAction` that tests 3 and 6 accepted.
- Risks are picked by position (`risks[3]` must be the AI Accept, Third-Party Dependency risk) from `harness.getAssessment(...).risks`, a relation populate with no `sort`.
- `seedUatALikeFixture` is memoised per harness, so every test in a file reuses the same request and questionnaire.

**Failure scenario:**

- Running one test with `--test-name-pattern`, or reordering or inserting a test, gives false failures.
- If the populate order changes (a database or Strapi upgrade), `risks[3]` stops being the Accept risk. Tests then fail for reasons unrelated to the behaviour, or `AI_ACCEPT_WITH_PLANNED_CONTROL` cases end up exercising a Treat risk and need re-reading to trust.

**Fix:** look risks up by property, for example `risks.find(r => r.treatmentAction === "Accept")` and `risks.find(r => r.riskType?.name === "Internet Exposure")`. Populate risks with an explicit `sort: "riskNumber:asc"`. Give tests that need a known starting state their own draft, using a helper that generates a fresh draft for a fresh UAT-A-like request.

**Content-type change:** none

### Info

#### IN-201 [INFO]: The risk-scale and policy-grid oracles mirror the implementation, and the scale vocabulary is never pinned

**File:** `apps/backend/tests/risk-scale.unit.test.ts:6-15` and `apps/backend/tests/ai-data-policy.unit.test.ts:13-26`.

**Issue:**

- The 25-cell test computes its expected value from `LIKELIHOODS.entries()` and `CONSEQUENCES.entries()`, the arrays under test. A reordered vocabulary, for example "Possible" and "Likely" swapped, passes.
- The policy grid recomputes `classification` with `requestClassification` itself and re-implements the reason formula.
- Neither test pins the labels: `"Rare" … "Almost certain"`, `"Insignificant" … "Severe"`.

**Failure scenario:** someone reorders or renames the scale. The derived ratings change silently, and only an indirect fixture might catch it.

**Fix:** assert `deepEqual(LIKELIHOODS, ["Rare","Unlikely","Possible","Likely","Almost certain"])` and the consequence list. Add a few literal cells (`Possible × Major === "High"`, `Unlikely × Minor === "Low"`, `Almost certain × Severe === "Critical"`). In the policy grid, use a literal expectation table for some rows.

**Content-type change:** none

#### IN-202 [INFO]: The library-ranking test never exercises `limit` or the weighting

**File:** `apps/backend/tests/library-ranking.unit.test.ts:6-11`.

**Issue:** the call passes `limit` 3 over 3 rows, so `slice(0, limit)` is unexercised. The query has one term, so the IDF weighting never decides an order.

**Failure scenario:** someone removes the slice or breaks the IDF scoring, and the test passes, but D-06 and D-12 bounds and relevance change.

**Fix:** add a case with `limit` below the row count, and a two-term query where a rarer term must outrank a common one.

**Content-type change:** none

#### IN-203 [INFO]: Link assertions compare to context-derived values, and "each risk is linked" is never asserted

**File:** `apps/backend/tests/ai-provider-assessment.unit.test.ts:26-28` and `apps/backend/tests/assessment-workflow.integration.test.ts:2274-2276`.

**Issue:**

- The adapter test compares `informationSystem` to `context.allowed.systems["system-1"]` and classification to `context.allowed.assets["asset-1"].classification`. A builder that mapped `system-1` to the wrong system, or recorded a null classification, still passes. The unit deterministic test uses the literals `"system-hr"` and `"Restricted"`, which is better.
- The `uat-a` wire fixture links only one of its three risks to a system.
- The mounted test spot-checks `risks[0]` and `risks[1]`.

Success criterion 1 says each risk links to the request's systems and assets.

**Failure scenario:** a builder mapping bug links risks to the wrong selected system, and the adapter test passes.

**Fix:** use literal documentIds (`"system-hr"`, `"asset-pay"`, `"Restricted"`). In the mounted test, assert that every non-null `informationSystemImpacted` or `informationAssetImpacted` is in `fixture.systemIds` or `fixture.assetIds`.

**Content-type change:** none

#### IN-204 [INFO]: The decision operation is missing from the Phase 12 catalogue and policy unit tests, and its matrix row sends an empty batch

**File:** `apps/backend/tests/contract-catalogue.integration.test.ts:1910-1915`, `apps/backend/tests/authorization-policy.unit.test.ts:474-481`, `apps/backend/tests/fixtures/authorization-matrix.ts` (the `POST:/api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions` row).

**Issue:**

- `assessmentDraftRoutes` and the policy unit list cover four operations but not `function.ai_proposals.decide_api` or its operation. Its role scope is pinned only indirectly, through the source-literal check in the matrix test.
- The matrix row posts `{ decisions: [] }`, which writes nothing even without a guard, so its `persistence` snapshot cannot detect a write.
- The no-identity actor is never refused on a real decision.

**Failure scenario:** someone grants `decide_api` to `role.security_analyst_agent` by mistake. Only the second refusal (`HUMAN_ANALYST_ONLY_OPERATIONS`) hides it, and no catalogue test reports the drift.

**Fix:**

- Add the decision route to `assessmentDraftRoutes`.
- Add the operation to the policy unit list.
- Use a one-item valid batch against a risk with provenance in the matrix row. For the analyst, use an `unchanged` repeat.

**Content-type change:** none

#### IN-205 [INFO]: Most wire fixtures bypass the fake server, and refusal assertions accept any error

**File:** `apps/backend/tests/ai-provider-assessment.unit.test.ts:34-52` and `apps/backend/tests/ai-provider-questionnaire.unit.test.ts:58-69`.

**Issue:** these fixtures go straight to the adapter, not through the hosted provider and the fake OpenAI-compatible server:

- `accept-on-high`, `unknown-source`, `unknown-control` and `unknown-system`;
- `missing-not-sure` and `blank-help-text`.

D-38 asked for wire fixtures through the fake server. The `unknown-system`, `rating-field`, `boolean`, `five-questions`, `twenty-one-questions` and long-help checks use a bare `assert.throws(...)`. Each fixture currently has a single defect, so this is acceptable, but it is brittle.

**Failure scenario:** a future fixture edit introduces a second defect, and the refusal test keeps passing for the wrong reason.

**Fix:** run each fixture through `openai...Provider.generate` on the fake server, and match `WireShapeError`, or the provider failure plus a diagnostic `reason`.

**Content-type change:** none

#### IN-206 [INFO]: Bounds are tested only from outside, never at the accepted edge

**File:** `apps/backend/tests/ai-provider-questionnaire.unit.test.ts:66` (5 and 21 questions), `apps/backend/tests/ai-proposal-decisions.integration.test.ts:105` (201 decisions), `apps/backend/tests/assessment-context.unit.test.ts:85-88` (101 systems or assets).

**Issue:** no test accepts exactly 20 questions (the D-16 rise from 15), 200 decisions or 100 systems or assets.

**Failure scenario:** a bound tightens, for example `MAX_QUESTIONS` reverting to 15 or the batch maximum to 100, and nothing fails.

**Fix:** add acceptance cases at 6 and 20 questions, at 200 decisions (a mix of new decisions and unchanged repeats), and at 100 systems.

**Content-type change:** none

#### IN-207 [INFO]: The UAT-A-like mounted fixture's Risk Types and controls never reach the draft, and some "context" assertions check the input

**File:** `apps/backend/tests/helpers/strapi-http-harness.ts:779`, `apps/backend/tests/assessment-context.integration.test.ts:32`, `apps/backend/tests/assessment-context.unit.test.ts:72`.

**Issue:**

- `seedUatALikeFixture` names its types `UAT Internet Exposure` and so on. The deterministic provider matches the exact names (`"Internet Exposure" in context.allowed.riskTypes`), so the mounted drafts take their types and suggested controls from `seedAssessmentWorkflowFixtures`, not from the UAT-A library. The "file integrity, segregation of duties, backup testing" suggestions are never shown, and the fixture is silently coupled to another seeder.
- `controlCandidates.total` equals `records.controls.length`, so `=== 12` and `>= 12` assert the fixture size, not the builder's output.

**Failure scenario:** the coupling hides the fact that the UAT-A library is never used, and the total assertions cannot catch a candidate-selection regression.

**Fix:** name the UAT-A types exactly, or extend the deterministic rules to cover them, and assert that the UAT-A controls (`UATA-001`, and so on) appear as suggestions. Assert `controlCandidates.offered`.

**Content-type change:** none

#### IN-208 [INFO]: Draft run counts and the job's policy failure code are not asserted

**File:** `apps/backend/tests/assessment-workflow.integration.test.ts:446-451` and `:2283-2285`, and `apps/backend/tests/ai-data-policy.integration.test.ts:73-78`.

**Issue:**

- The draft tests find runs with `some` and `find`, so a duplicate run for one provider call would pass. The questionnaire tests do assert `runs.length`.
- The execution refusal is proven by calling `persist*` directly, not by the registry job's terminal `failureCode`.

**Failure scenario:** the draft path creates a duplicate run, or the job maps the policy refusal to a different code, and no test fails.

**Fix:** assert exact draft run counts. Add one routed job refusal; see WR-201.

**Content-type change:** none

#### IN-209 [INFO]: Minimisation is asserted only for the questionnaire operation, and some secret checks are vacuous

**File:** `apps/backend/tests/assessment-context.integration.test.ts:19-22` and `apps/backend/tests/assessment-context.unit.test.ts:49-51`.

**Issue:**

- The forbidden-text loops run only for `questionnaire-generation`, which renders no answers, so the answer date `"2026-08-30"` check cannot fail there.
- The draft-operation tests (`:25-34`, `:65-75`), whose prompts carry answers, check no forbidden text.
- The identity checks (`"Private Requestor"`, `"Private Owner"`, the email) cannot fail through the allow-list. `asString` renders nested objects as `""`, and the loader never populates `requestor`.

The field allow-lists make a leak unlikely today, but the tests do not prove D-04 for the draft.

**Failure scenario:** someone adds an answer timestamp, or a new field, to the draft-only answer rendering, and nothing fails.

**Fix:** repeat the forbidden-text loop for `assessment-draft` in both files.

**Content-type change:** none

#### IN-210 [INFO]: The assessment wire-schema guard counts properties per object, not in total

**File:** `apps/backend/tests/ai-provider-assessment.unit.test.ts:56-66`, compared with `apps/backend/tests/ai-provider-questionnaire.unit.test.ts:18-33`.

**Issue:** D-06's bound is at most 100 object properties in the schema. The questionnaire guard sums properties. The assessment guard checks `Object.keys(row.properties).length <= 100` for each object, so the schema could grow past 100 in total and still pass. It holds 37 today.

**Failure scenario:** later phases add fields across nested objects, and the portable-subset guard misses a breach of the Azure limit.

**Fix:** reuse the questionnaire `walkSchema` total-property and depth guard for the assessment schema.

**Content-type change:** none

---

_Reviewed: 2026-10-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer), Lane 2_
_Depth: standard_

## Phase 12: Code Review Report, Lane 3 (web source)

**Reviewed:** 2026-10-08T02:05:19Z
**Depth:** standard
**Files Reviewed:** 48
**Status:** issues_found

### Summary

I reviewed every changed `apps/csrm` source file in scope against diff base `7e4fa02`. New modules were read in full. Changed modules were read through their Phase 12 diff plus the surrounding code each claim depends on. `schema.d.ts` was reviewed by diff only. I checked the code against AGENTS.md, 12-UI-SPEC (§1 to §13, the copywriting and accessibility contracts), 12-CONTEXT D-07, D-12 to D-14, D-21 to D-25, D-29, D-35 to D-37 and both Orchestrator Confirmations, and the Phase 12 contract-gap record.

I traced these callees and callers outside the list:
- the Strapi projections that feed the web parsers: `assessment-context.ts`, `ai-provenance.ts`, `assessment-scope.ts` and `questionnaire-scope.ts`;
- the transport's refusal mapping;
- `docs/references/specification.json` for the two new operations and the nine new schemas;
- sonner's injected stylesheet;
- `app/globals.css`;
- the `ai-context-provenance.spec.ts` axe call sites.

No tests, builds or servers were run.

The main defect is a contrast failure that makes every Undo label unreadable. The other defects:
- several §6.2 focus rules don't hold;
- the client provenance falls back to stale data after a save;
- the "Refresh page" path is a hard reload, which discards unsaved input;
- the Requestor's released-assessment payload still carries the generating analyst into the browser.

**Checked and found correct:**
- **Typed API layer.** Both new operations go through `openapi-fetch` in a `server-only` service (`ai-assistance-service.ts`) and are reached only through Server Actions. There is no raw `fetch` and no facade. Both parsers are closed (`.strict()`), registered in the parity inventory, and the actions module is registered as parser-free.
- **Zod boundary.** Every new client module (`ai-review-bar`, `ai-field-marker`, `ai-citations`, `ai-source-popover`, `ai-run-sheet`, `ai-control-suggestions`, `use-ai-decisions`) imports schema modules as types only. `ai-assistance-domain.ts` and `ai-provenance-domain.ts` are zod-free.
- **Requestor disclosure (D-23).** Strapi adds `generation` and `aiOrigin` only for the analyst actor (`questionnaire-scope.ts:546`, `:585`), and the strict web parsers would reject them on Requestor reads. The Requestor's questionnaire, introduction and released view render only `aiAssisted` and help text. No marker, provider, model or run reaches a Requestor surface. The one remaining gap, `generatedBy`, is WR-304.
- **Server Action input validation.** `decideAiProposalsAction` closes the target kinds and actions and bounds the batch at 1 to 200. Authorisation stays with Strapi. No button's visibility is treated as authorisation.
- **Family J and policy refusal copy.** The family J copy (§6.3) and the policy refusal copy (§11.1, §11.2) match the contract. A refused policy hides Generate and Replace in the idle state.
- **Citations.** System and asset citations are plain text, answer and request citations are buttons with `aria-haspopup` and `aria-expanded`, and the full text stays in the DOM under the clamp. The source keys (`request.<field>`, `answer.<questionKey>`) match what Strapi's context builder emits.
- **Run sheet.** All five states, the 300ms skeleton delay, focus to the title, focus return to the trigger, the phone full-screen variant and the draft-only groups are implemented.
- **Header.** The released, untracked, counts and questionnaire-counts variants are correct. The `#risk-…` and `#assessment-details` targets match the card and section ids.
- **Decision races.**
  - A double click on Confirm or Confirm remaining can't fire twice: the optimistic update removes the button synchronously.
  - Confirm remaining computes its field list from the optimistic state, so it never resends a field whose single Confirm is still in flight.
  - Add is guarded by `addingKey`.
  - A decision that resolves after `revalidatePath`'s RSC refresh doesn't reset unsaved form values, because the editor holds its own state.
- **Help text.** Help text renders in the governance rows, in released questions, in the Requestor's form as the `-hint` named first in `aria-describedby`, and in the read-only answers. The 2,000-character error is implemented.
- **Generated types.** Every type added to `schema.d.ts` (`AiRun`, `AiRunContextSummary`, `AiGenerationFacts`, `AiSourceCitation`, `AiFieldReview`, `AiSuggestionReview`, `RiskAiProvenance`, `AssessmentAiProvenance`, `AiPolicyStatus`, `AiProposalDecision*`, the five new conflict reasons, `helpText`, `aiOrigin`, `aiAssisted`) agrees with the specification. The web parsers accept them, either at the same bounds or narrowed only where Strapi's writers already enforce the narrower bound (for example, trimmed non-empty claims and rationales via `boundedString`).

### Critical Issues

#### CR-301 [BLOCKER]: Every Undo toast renders its "Undo" label dark on dark, so the label can't be seen

**File:** `apps/csrm/src/features/ai-assistance/use-ai-decisions.ts:60` (also `:91`, `:126`, `:158`); `apps/csrm/src/components/ui/sonner.tsx` (`--normal-text: var(--popover-foreground)`); `apps/csrm/app/globals.css:176` (`--popover-foreground: var(--foreground)`)

**Issue:** Sonner styles every action button with `[data-sonner-toast][data-styled=true] [data-button]{color:var(--normal-bg);background:var(--normal-text)}`. The source-owned `Toaster` sets `--normal-text` to `var(--popover-foreground)`, which resolves to `var(--foreground)` (`#141413`), so the button's background is near-black. The Phase 12 `actionButtonStyle` / `toastActionStyle` is applied inline and overrides only `color`, also to `var(--foreground)`. It does not override `background`. The Undo label therefore renders `#141413` on `#141413`, a contrast of 1:1. `borderRadius: 'var(--radius)'` (0.5rem) also doesn't give the X-14 "outline small pill".

**Failure scenario:**
1. An analyst presses Confirm, Confirm remaining, Add as planned control or Dismiss.
2. The success toast shows a solid dark block where "Undo" should be.

A sighted user can't read or discover the only Undo path that D-36 and G-4 require instead of a confirmation (WCAG 1.4.3 fails). No axe scan in `e2e/ai-context-provenance.spec.ts` runs while a toast is visible: the scans are at `:121` to `:211` and `:287`, and the Undo click at `:243` is never scanned. This explains why the gate didn't catch it. I verified this from the shipped CSS and sonner's injected stylesheet, not from a rendered screenshot.

**Fix:** Give the Undo action the outline-pill treatment through a class, not a partial inline style. Use `classNames: { actionButton: '!bg-transparent !text-foreground border border-border rounded-full …' }` on these toasts, or `actionButtonStyle` with `background: 'transparent'` and `borderRadius: 'var(--radius-full)'`. Keep it to these toasts only, as Notes carried requires. Test: an e2e step that runs `expectAccessible` while the Confirm toast and the Add toast are visible, plus a unit assertion that the Undo action's computed background differs from its text colour.

**Content-type change:** none

### Warnings

#### WR-301 [WARNING]: Focus after Confirm, Undo, Dismiss and Add goes to the first remaining control, not the next one (§6.2)

**File:** `apps/csrm/src/features/ai-assistance/use-ai-decisions.ts:30`, `:55`; `apps/csrm/src/features/ai-assistance/ai-control-suggestions.tsx:32-38`, `:48`

**Issue:**
- `focusAfterDecision` moves focus to `form.querySelector('[data-ai-confirm]')`, which is the *first* remaining Confirm in the form. §6.2 requires "the next `Confirm` in the same form, in field order".
- The Undo success path (`:55`) also focuses the first Confirm. §6.2 requires "the restored field's `Confirm`".
- For suggestions, `focusAfter(key)` computes `keys.indexOf(key)` against `order.current`, and `order.current` is rebuilt on every render from the rows still `proposed`. `useOptimistic` commits on the sync lane before the `requestAnimationFrame` callback (Dismiss), and Add calls `focusAfter` only after `await onUpdated()`. Either way, the decided key is already gone, so `index` is always `-1`. The candidates then become every key in order, so focus lands on the *first* remaining suggestion. The "next, else previous" logic never runs.

**Failure scenario:**
1. A keyboard user reviews a Risk whose Issue statement, Potential impact and Treatment plan are proposed.
2. They press Confirm on Potential impact. Focus jumps back up to Issue statement's Confirm, and the page scrolls away from where they were working.
3. With five suggestions, dismissing the fourth sends focus to the first row's "Add as planned control", not the fifth's.

**Fix:**
- For fields, record the decided field's DOM position before the optimistic update and focus the first `[data-ai-confirm]` that follows it, falling back to the review-bar status. On Undo, focus `[data-ai-confirm]` inside the restored field's label row: give the button `data-ai-field={name}` and query by it.
- For suggestions, snapshot `order.current` and the index *before* calling `changeRow` or `send`, and pass them to `focusAfter`.
- Tests: confirm the middle of three proposed fields and assert `document.activeElement` is the third field's Confirm. Dismiss row 2 of 3 and assert focus is on row 3's Add.

**Content-type change:** none

#### WR-302 [WARNING]: After a save, an AI field the analyst just edited reverts to "AI proposed" with Confirm, and stays that way if the follow-up read fails

**File:** `apps/csrm/src/features/assessments/risk-editor.tsx:250-253` (also `:175-180`, `:185`); `apps/csrm/src/features/assessments/assessment-editor.tsx:215-219`, `:233-236`

**Issue:** On an accepted risk save, `saved = { ...savedRisk, ...submitted, … }` carries the *old* `aiProvenance`, in which the field is still `proposed`. `applySavedRisk(saved)` puts that object back into `risks`, so the editor's base `fields` say `proposed`. Meanwhile `initial` now equals the saved value, so `fieldMarkerState` returns `proposed`. The field Strapi just marked `edited` (D-21) shows the `AI proposed` badge and a Confirm button again, and the review bar counts it again. It is corrected only when `refreshAssessment()` succeeds. On any failure that function returns silently (`if (!result.ok) return;`), and because the editor holds its data in `useState`, the RSC refresh from `revalidatePath` doesn't help.

The same fallback hits a successful decision whose follow-up read fails. The success toast says "confirmed", but when the transition ends the optimistic `accepted` state falls back to the stale `proposed` base.

**Failure scenario:**
1. The analyst edits the AI-proposed Treatment plan and saves.
2. During the round trip, or permanently if the refresh read fails, the field shows "AI proposed" with Confirm.
3. The analyst presses Confirm. Strapi holds the field as `edited`, so it refuses the conflicting repeat with `AI_PROPOSAL_ALREADY_DECIDED`.
4. The toast tells them "Someone has already reviewed this proposal": wrong and confusing, because it was them.

**Fix:**
- In `RiskEditor.submit` and `AssessmentMetadata.submit`, apply D-21's rule locally. For every AI fact whose field is in `submitted` and whose state is `proposed`, set its state to `edited` before `setSavedRisk` and `onUpdated`.
- In `useAiDecisions`, keep the confirmed state until a successful re-read. For example, keep a local "server-acknowledged" overlay that clears when the base `fields` change.
- When `refreshAssessment` fails after a decision, surface that state instead of returning silently.
- Test: save an edit to a proposed field with `refreshAnalystAssessmentAction` mocked to fail, then assert the marker reads "Edited" and no Confirm button is present.

**Content-type change:** none

#### WR-303 [WARNING]: "Refresh page" in decision refusals is a hard reload that discards every unsaved edit on the editor

**File:** `apps/csrm/src/features/ai-assistance/use-ai-decisions.ts:48`, `:112`; `apps/csrm/src/lib/api/refusal-copy.ts` (`AI_SUGGESTION_CONTROL_CHANGED`, `AI_ACCEPT_WITH_PLANNED_CONTROL` classed `blocked`)

**Issue:** Every blocked refusal offers "Refresh page" as `window.location.reload()`. The assessment editor holds unsaved input in one `react-hook-form` instance per Risk plus the assessment details, and registers no navigation guard: `beforeunload` is used only by the questionnaire autosave and the navigation-guard module. G-4 and §13 say decisions never lose input. Phase 10's precedent for "Refresh page" is a *soft* refresh (`questionnaire-renderer.tsx:260`). Two of the blocked reasons don't need a refresh at all, because their copy points to an in-page fix:
- `AI_ACCEPT_WITH_PLANNED_CONTROL`: "Change the treatment action to Treat, or remove the planned control";
- `AI_SUGGESTION_CONTROL_CHANGED`: "Remove it from the risk".

**Failure scenario:**
1. The analyst has typed into Risk 2's Risk statement without saving.
2. They press Confirm remaining on Risk 1, whose proposed Accept now sits beside a planned control.
3. The danger toast offers "Refresh page". They press it and lose Risk 2's text.

**Fix:** Make "Refresh page" call the editor's `refreshAssessment()` (pass it in as `onUpdated`) rather than reloading the document. For the two in-page reasons, offer no action, or a "Show treatment action" focus link, instead of "Refresh page". Test: with a dirty field in another Risk form, trigger a blocked refusal, click the toast action, and assert the dirty value survives.

**Content-type change:** none

#### WR-304 [WARNING]: The Requestor's released-assessment page still ships the generating analyst (`generatedBy`) to the browser

**File:** `apps/csrm/src/features/assessments/assessment-schema.ts:227` and `:505` (the `releasedAssessmentDetailForActorSchema` transform); `apps/csrm/app/(app)/app/assessments/[documentId]/page.tsx:78`; `apps/csrm/src/features/assessments/released-assessment.tsx` (`'use client'`)

**Issue:** UAT-032 and D-23 remove "Generated by" from the Requestor's view, and §9.3 says the Requestor sees no "analyst name for the AI". Phase 12 deleted only the visible row. The transform still copies every `assessmentDetailShape` key, including `generatedBy` and `generatedDate`, into the object it returns. The page passes that object whole to the `ReleasedAssessmentDetailView` Client Component, so it is serialised into the RSC payload in the Requestor's browser. Strapi also still projects `generatedBy` for the Requestor actor (`assessment-scope.ts:340`, `:349`).

**Failure scenario:** A Requestor opens their released assessment and views the page source or the RSC response. It contains `"generatedBy":{"documentId":"…","displayName":"<analyst>"}`, which identifies who ran the AI generation, a fact D-23 withholds from them.

**Fix:** In the transform, omit `generatedBy` (and `generatedDate`, which nothing renders) when `detail.actor === 'requestor'`. Better still, return only the fields `ReleasedAssessmentDetailView` renders. Raise the Strapi projection with the backend lane so the field isn't served at all. Test: parse a Requestor fixture and assert the result has no `generatedBy` key. Render the page and assert the serialised props don't contain the analyst's name.

**Content-type change:** none. A specification change applies only if Strapi drops the field from the Requestor variant.

#### WR-305 [WARNING]: The Risk card's "AI proposed" count is set with `aria-label` on a generic `span`, so assistive technology ignores it, and it reads "1 fields"

**File:** `apps/csrm/src/features/assessments/assessment-editor.tsx:337`

**Issue:** §3.3 asks for the badge's accessible name to be extended to `AI proposed: {n} {field|fields} to review` "through visually hidden text after the visible label". The code wraps the badge in `<span aria-label=…>`. ARIA 1.2 prohibits naming the generic role, so screen readers announce only "AI proposed" and the count is lost. axe reports this as "needs review", not as a violation, which is why `expectAccessible(page, 'the editor with proposals')` passes. The string also hard-codes `fields`, so one proposal reads "1 fields to review".

**Failure scenario:** A screen-reader user moves through the Risk cards and hears "AI proposed" with no count. A sighted user who inspects it gets "1 fields".

**Fix:** Render `<StatusBadge family="aiReview" value="proposed" />` followed by `<span className="sr-only">: {n} {n === 1 ? 'field' : 'fields'} to review</span>`, using the `outstandingProposalsLabel` helper, and drop the `aria-label`. Test: query the card header by accessible text "AI proposed: 1 field to review".

**Content-type change:** none

#### WR-306 [WARNING]: Each field's Confirm button stays 32px tall on phones, below the contract's touch-target height

**File:** `apps/csrm/src/features/ai-assistance/ai-field-marker.tsx:28`

**Issue:** §3.2's 375 row says "each field's `Confirm` meets the touch-target height". The button is `size="sm"` (`h-8`, 32px) at every width. Every other Phase 12 action uses `min-h-11 … sm:min-h-*` for phones: the review bar's Confirm remaining, the suggestion actions and the sheet trigger.

**Failure scenario:** At 375px, an analyst confirming a run of fields hits 32px targets that sit in a wrapping label row next to the badge. Mis-taps land on the label, which focuses the field, or on the neighbouring control.

**Fix:** Add `className="min-h-11 sm:min-h-8"` to the Confirm button. Test: a 375px e2e assertion that the Confirm bounding box is at least 44px tall.

**Content-type change:** none

#### WR-307 [WARNING]: The lazily loaded sheet and source popover give no loading feedback, and a failed chunk load is silent or replaces the editor

**File:** `apps/csrm/src/features/ai-assistance/ai-run-sheet-trigger.tsx:28`, `:38`; `apps/csrm/src/features/ai-assistance/ai-citations.tsx:10`

**Issue:** §2.4 and §4.2 require a skeleton after 300ms and an error state with Try again. Both skeletons live *inside* the lazily loaded modules, so neither shows while the chunk itself downloads.
- **Run sheet:** `onClick` sets `open` and starts `import()`. Nothing renders until the chunk resolves. If the chunk fails, `loading.current = null`, `open` stays `true` and no error appears: the button looks dead.
- **Source popover:** the citation sets `aria-expanded="true"` at once, but no dialog exists until the chunk arrives. Because `next/dynamic` (React.lazy) throws a failed import to the nearest error boundary, the route's `error.tsx` (`app/(app)/app/review/assessments/[documentId]/error.tsx`) replaces the whole editor, including every unsaved Risk form.

**Failure scenario:**
1. On a slow phone connection, an analyst taps "Show what the AI used". Nothing happens for several seconds and they tap again.
2. After a redeploy (chunk skew) or a network drop, tapping a citation swaps the editor for the error page, and the typed but unsaved Risk edits are lost.

**Fix:**
- In the trigger, while `open && !Sheet`, render the X-13 frame or a `role="status"` skeleton after 300ms. On load failure, render the §2.4 error copy with Try again, which retries `load()`.
- For citations, load the popover with a plain `import()` held in state, as the sheet trigger does, so a failure is caught and shown as "We couldn't load this source." with Try again rather than thrown.
- Tests: mock the dynamic import to reject and assert the error copy appears and the editor stays mounted. Delay it and assert a skeleton after 300ms.

**Content-type change:** none

#### WR-308 [WARNING]: After a failed job, Retry and Replace aren't gated by the AI data policy, so the hub offers a generation the policy refuses

**File:** `apps/csrm/src/features/assessments/assessment-draft-job.tsx:338`; `apps/csrm/src/features/assessments/questionnaire-generation-job.tsx:345-347`

**Issue:** D-29 says "The hub offers generation only when the policy allows it". `AiPolicyGate` wraps only the idle Generate and Replace actions. In the failed state, these are rendered unwrapped even when the served `aiPolicy` is `refused`:
- "Retry draft generation";
- "Retry questionnaire generation";
- the acknowledged `replace` for `QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED`.

**Failure scenario:**
1. A draft job fails with `AI_CLASSIFICATION_ABOVE_CEILING`. The card says "…nothing was sent to the AI. Contact your administrator." and still shows "Retry draft generation".
2. The analyst retries. Strapi refuses again, either with a new failed job or with an enqueue refusal, and the analyst is sent round the same loop.

**Fix:** Wrap the retry button and the failed-state `replace` in `<AiPolicyGate action={…} policy={aiPolicy} />`. Alternatively, hide Retry when `aiPolicy?.status === 'refused'` and show the §11.1 refusal alert once. Test: render a failed job with a refused `aiPolicy` and assert no Retry button and one refusal alert.

**Content-type change:** none

### Info

#### IN-301 [INFO]: The header's "generated before CSRM recorded" note depends on the assessment's run id alone, so it can contradict per-Risk markers

**File:** `apps/csrm/src/features/ai-assistance/ai-provenance-domain.ts:44`

**Issue:** `review.kind = 'untracked'` whenever `generation.runId === null`. Strapi derives that `runId` only from the *assessment's* own `aiProvenance` (`assessment-scope.ts:343`). If that envelope projects as null (malformed, per CR-01's class of data), but the Risks still carry valid provenance, the header shows three wrong things at once:
- it says "its fields aren't marked" while the Risk cards show `AI proposed` markers;
- it hides the outstanding count;
- it drops "Show what the AI used".

**Fix:** Treat the record as untracked only when the assessment's and every Risk's `aiProvenance` are null. Otherwise take `runId` from the first Risk envelope and keep the counts. Test: assessment `aiProvenance: null`, Risk provenance present: the header shows counts, not the untracked note.

**Content-type change:** none

**Overlaps:** CR-01

#### IN-302 [INFO]: An analyst opening `/app/assessments/{id}` sees the Requestor's notice, which ends "releasing it to you"

**File:** `apps/csrm/src/features/assessments/released-assessment.tsx:184`; `apps/csrm/src/features/assessments/assessment-schema.ts:505`; `apps/csrm/src/features/ai-assistance/ai-assistance-notice.tsx:11`

**Issue:** The transform derives `aiAssisted` for the analyst actor too (`generation !== null`), and the view renders the §10.1 Requestor sentence for both actors. §10.2 gives the analyst the provenance header instead. The sentence addresses the reader as the recipient.

**Fix:** Render `AiAssistanceNotice` only when `assessment.actor === 'requestor'`, or give the analyst the §1 header without line 3. Test: an analyst fixture renders no "releasing it to you".

**Content-type change:** none

#### IN-303 [INFO]: The enqueue refusal for `AI_CLASSIFICATION_ABOVE_CEILING` doesn't name the classification or the approved limit

**File:** `apps/csrm/src/lib/api/refusal-copy.ts:124`, `:139`

**Issue:** §11.3 says an enqueue refusal uses §11.1's description, which names `{level}` and `{ceiling}`, and D-28 says the message "names the request's classification and the ceiling". Families I and the draft family call `aiPolicyRefusalCopy` without details, so they fall back to the §11.2 *job-failure* sentence: "…is now classified above the limit…, so nothing was sent". Whenever the served `aiPolicy` is available, the card could pass it through.

**Fix:** When the card has `aiPolicy`, format the refusal with `aiPolicyRefusalCopy(reason, aiPolicy)`. Keep the generic sentence only when it is absent. Test: a 409 enqueue refusal with `aiPolicy` present shows "classified Restricted, above the Internal limit".

**Content-type change:** none

#### IN-304 [INFO]: Two minor deviations in §6.1's toast copy and pending state

**File:** `apps/csrm/src/features/ai-assistance/ai-assistance-domain.ts:55-57`; `apps/csrm/src/features/assessments/risk-editor.tsx:196`; `apps/csrm/src/features/assessments/assessment-editor.tsx:520`

**Issue:**
- `confirmToastMessage` uses the single-field sentence ("Issue statement confirmed on R-1.") when Confirm remaining confirms exactly one field. §6.1 specifies `{n} AI-proposed {field|fields} confirmed …` for that action.
- Every marker in a form receives `pending={decisions.isPending}`, so one Confirm dims every marker on the Risk, not only the decided one. §6.1 applies the pending opacity to "the marker" that changed.

**Fix:** Pass the action kind to `confirmToastMessage`. Track pending field names in `useAiDecisions` and dim only those markers. Test: Confirm remaining with one field shows "1 AI-proposed field confirmed on R-1." During a pending single Confirm, the other markers carry `data-pending="false"`.

**Content-type change:** none

## Phase 12: Code Review Report, Lane 4 (web unit tests and Playwright specs)

**Reviewed:** 2026-10-08T02:01:51Z
**Depth:** standard
**Files Reviewed:** 40
**Status:** issues_found

### Summary

I reviewed every Phase 12 web unit test, the Playwright specs and helper, and `playwright.config.ts`. For the six large files I read the `git diff 7e4fa02..HEAD` hunks and the fixtures they depend on. For each test I asked two questions: could it fail if the behaviour it names were broken, and does it pass reliably when it is not? To answer them I traced the code under test: `use-ai-decisions.ts`, `ai-control-suggestions.tsx`, `ai-run-sheet.tsx`, `ai-source-popover.tsx`, `ai-citations.tsx`, `ai-provenance-header.tsx`, `ai-field-marker.tsx`, `ai-review-bar.tsx`, `risk-editor.tsx`, `assessment-editor.tsx`, `questionnaire-governance.tsx`, `questionnaire-detail.tsx`, `questionnaire-service.ts`, `released-assessment.tsx`, `refusal-copy.ts` and `ai-assistance-actions.ts`. On the Strapi side I traced `config/ai.ts`, `ai-provider-selection.ts`, `ai-config-validation.ts`, `data-policy.ts`, both Keycloak flag readers and the deterministic draft provider. I ran nothing; every judgement comes from reading the code.

The main gaps are these:
- No test can catch a leak of AI internals onto the Requestor's questionnaire page.
- The browser journey checks optimistic UI and HTTP 200 instead of persisted decisions.
- The editor-level wiring of the AI review UI has no unit test, and one real copy defect is already hiding there.
- The copy guard and the performance budget can no longer detect the regressions they were set up to catch.

**Checked and found sound (each can fail when its behaviour breaks):**
- `playwright.config.ts` pins every variable it needs, and an empty ceiling reads as unset:
  - The Strapi webServer pins `CSRM_AI_PROVIDER=deterministic`, `CSRM_AI_DATA_CLASSIFICATION_CEILING=''`, both Keycloak flags `'false'`, `CSRM_DEV_IDENTITY=true` and the transcript flag off. `CSRM_AUTH_OIDC_ENABLED=false` is set on the runner's `process.env`, so both servers inherit it.
  - Strapi's `env("CSRM_AI_DATA_CLASSIFICATION_CEILING", "")` returns `''`, and `parseClassificationCeiling('')` returns `null`. With `NODE_ENV` and `CSRM_ENVIRONMENT` both `development`, the policy allows generation.
  - `CSRM_AI_PROVIDER_MODE` is `openai-compatible` only on an exact match, and `assertCsrmAiConfiguration` returns before reading the hosted base URL or model. The hosted variables loaded from `.env` are therefore inert.
  - Both Keycloak readers treat `'false'` as off.
  - One residual I could not prove, because I did not run anything: whether `''` survives the Windows shell to the Strapi child. If it does not, a ceiling from `.env` would make generation refuse or allow outright. A refusal fails the journey loudly; an allow changes nothing in development. Either way it cannot pass silently.
- `ai-context-provenance.spec.ts`:
  - It creates its own systems, asset and request per project with `Date.now()` and the project name. It is in the mobile `testMatch` and titled `@journey`, so the UAT-A-like journey runs at both 375 and 1440 (D-38).
  - It checks help text, `aria-describedby` and `Not sure`, the two Personal Information Handling risks, the classification pre-fill note, a citation opening its answer with focus returning to it, `No source cited`, `Claims to check`, Add → Undo → re-add, axe on every new surface, and the Requestor's notice. It also checks that the Requestor's `main` text has no `Provider:`, `Model:`, `AI proposed` or provider name.
- `assessment-release-workflow.spec.ts` checks that `Review of AI proposals` is outstanding before Confirm remaining (E1), presses Enter on Confirm remaining (a keyboard path), and after a reload proves `All release requirements are met` against the server. On the released view it checks the notice and that no `Generated by` row exists (E2).
- `questionnaire-generation-workflow.spec.ts` covers E3: the header, a help-text line, `Not sure` in the choices, and the allowed-policy caption.
- `released-assessment.test.tsx` and `assessment-service.test.ts`:
  - The Requestor's released schema refuses `generation` and `aiProvenance` and requires `aiAssisted`. That is a real parser-level D-23 guard.
  - The `Generated by` negative would match the `dt` if it came back.
- `ai-provenance-header.test.tsx` covers who, when, provider and model, the singular and plural count, the first-Risk link, the untracked and released variants, and the questionnaire counts.
- `ai-run-sheet.test.tsx` covers all five states, the 300 ms skeleton delay, focus to the title and back to the trigger, the group order, and the questionnaire group set.
- `ai-citations.test.tsx` covers the source states, the skeleton delay, `aria-expanded`, focus return, and the bottom sheet below 768 px.
- `ai-control-suggestions.test.tsx` covers Add waiting for the server, focus moving to the next suggestion, Undo of Add, a refused Undo, dismiss, the toggle and restore, a refused dismissal rolling back, and the phone layout.
- `ai-assistance-actions.test.ts` covers input refusal before any read, the source reads, `revalidatePath` only on success, and the family J copy.
- `refusal-copy.test.ts` covers family J verbatim, including `AI_ACCEPT_WITH_PLANNED_CONTROL`.
- `conflict-reasons.test.ts` and `server-client.test.ts` cover the new reasons and their published parity.
- `questionnaire-generation-job.test.tsx` and the draft-card cases in `assessment-review-workflow.test.tsx` cover the allowed caption, both refusal alerts with no `Generate`, the three failure codes, and the §11.4 running copy.
- `questionnaire-governance.test.tsx` covers the origin markers, the help-text field and its 2,000-character error, and the release description.
- `questionnaire-renderer.test.tsx` checks that the hint comes before the control, its id and `aria-describedby`, and the served order of `Not sure`.
- `contract-response-parity.test.ts` registers `ai-assistance-service.ts` (both `getAiRun` and `decideAiProposals`) and `ai-assistance-actions.ts` as parser-free.
- `status-badge.test.tsx` covers the `aiReview` family.

### Critical Issues

#### CR-401 [BLOCKER]: Nothing can catch AI internals appearing on the Requestor's questionnaire page

**File:** `apps/csrm/src/features/questionnaires/questionnaire-renderer.test.tsx:581-586` (test "tells the Requestor that AI helped, and how to answer Not sure, only when that is true"); `apps/csrm/e2e/ai-context-provenance.spec.ts:138-162` (step "the Requestor answers with help text and Not sure, told that AI helped"); `apps/csrm/src/features/questionnaires/questionnaire-service.ts:59-60,103,118`

**Issue:** The unit test's D-23 negative, `expect(document.body.textContent).not.toMatch(/AI proposed|Provider|Model/)`, renders `QuestionnaireDetail` with fixtures that hold no AI facts:
- The `question()` helper (lines 32-52) never sets `aiOrigin`.
- The summary is `{ ...questionnaire, aiAssisted: true }`, with no `generation` block.

So no marker, provider or model is ever in the input, and the assertion cannot fail.

The web layer also has no parser guard here. `questionnaireSummarySchema` is shared by both actors and accepts `generation: aiGenerationFactsSchema.optional()`. The question-list transform also passes `aiOrigin` through for the Requestor's read. This differs from the released assessment, whose Requestor schema refuses `generation` and `aiProvenance` (`assessment-service.test.ts`).

The E2E Requestor questionnaire step asserts only the positive sentences. It has no negative on that page.

UI-SPEC §9.3 and D-23 say the Requestor sees no marker, provider, model, run or analyst name for the AI. As far as the web is concerned, nothing proves this. There is no leak today, because `QuestionnaireDetail` renders neither field.

**Failure scenario:** Strapi starts serving `generation` or per-question `aiOrigin` on the Requestor's read, or a later change reuses `AiProvenanceHeader` or `questionOriginMarker` in `QuestionnaireDetail`. Both would put `Provider: …`, `Model: …` or `AI proposed` in front of the Requestor, and every web unit test and every E2E would still pass.

**Fix:**
1. In the renderer test, render with `questionnaire={{ ...questionnaire, aiAssisted: true, generation: { generatedAt, generatedBy: { documentId: 'a', displayName: 'Bob Analyst' }, providerName: 'deterministic-questionnaire-generation', providerVersion: '2', runId: 'run-1' } }}` and a definition whose questions carry `aiOrigin: 'generated'`. Then assert that `/AI proposed|Provider:|Model:|deterministic-questionnaire-generation|Bob Analyst|Show what the AI used|Generated with AI/` does not match.
2. In `ai-context-provenance.spec.ts` after line 149, add `expect(await page.getByRole('main').innerText()).not.toMatch(/AI proposed|Provider:|Model:|deterministic-questionnaire|Generated with AI|Show what the AI used/)`. Also assert that `page.getByRole('region', { name: 'AI generation' })` has count 0.
3. Preferably, make the Requestor's questionnaire parse refuse `generation` and `aiOrigin`, as the released-assessment schema does, and test that refusal.

**Content-type change:** none

### Warnings

#### WR-401 [WARNING]: Journey decisions are checked through optimistic UI and HTTP 200, not persisted state; Dismiss and Restore are never verified

**File:** `apps/csrm/e2e/ai-context-provenance.spec.ts:227-230, 248-257`; `apps/csrm/e2e/assessment-release-workflow.spec.ts:256-266`

**Issue:** Three separate weaknesses:
- Each Confirm remaining pass asserts `(await decided).ok()`, but the decision is a Server Action. A refused decision (`{ ok: false, status: 409, … }`) is still an HTTP 200 POST, so `.ok()` cannot see a refusal. The predicate also matches any POST to `/app/review/assessments/`. After the previous pass, `useAiDecisions` fires `onUpdated` (`refreshAnalystAssessmentAction`, another POST to the same URL), so `decided` can resolve on that trailing refresh rather than on this decision. The following `toHaveCount(0)` is satisfied by the optimistic state before any rollback.
- For Dismiss and Restore (lines 248-255), every assertion reads the `useOptimistic` rows. The test then reloads at line 257 without waiting for the restore's response, and never re-reads the suggestion state.
- Suggestions do not block release, so no later check depends on either decision having been stored.

The Confirm path is rescued by the reload and `All release requirements are met`. Dismiss and Restore are not.

**Failure scenario:** Strapi accepts `dismiss` and `restore` but does not store them, or refuses `restore` with `AI_PROPOSAL_ALREADY_DECIDED`. The optimistic row still shows `Add as planned control` long enough for line 255 to pass, the reload discards the evidence, and the journey passes. A Confirm remaining that is refused once and then succeeds on a later pass also passes without any check noticing.

**Fix:**
- Wait for the decision's own outcome rather than the HTTP status: wait for the success toast text (`Suggestion dismissed: {label}.`, `Suggestion restored: {label}.`, `… confirmed on {risk}.`) and assert that no `[data-sonner-toast][data-type="error"]` appears.
- After the reload at 257, open `Show dismissed suggestions` on the Personal Information Handling risk and assert that the restored suggestion is back in the proposed list. Also assert that the re-added control is still listed.
- Drop the `.ok()` checks on Server Action POSTs, or keep them only as a smoke check.

**Content-type change:** none

#### WR-402 [WARNING]: The browser journeys never prove the AI markers or the header's who, when and provider on real data (criterion 4), and other G-4 paths

**File:** `apps/csrm/e2e/ai-context-provenance.spec.ts:116-120, 183-192, 216-232`; `apps/csrm/e2e/assessment-release-workflow.spec.ts:144`; `apps/csrm/e2e/questionnaire-generation-workflow.spec.ts:120`

**Issue:**
- None of the three specs asserts an `AI proposed` badge, a `Confirm {field}` button, a `Confirmed` or `Edited` note, or a governance origin marker. The only AI marker checks are unit renders on hand-built fixtures.
- The header checks are all `/^Generated with AI at the request of /`. They never check the analyst's name or read line 2 (time · `Provider:` · `Model:`).
- Criterion 1 ("links each risk to the request's systems and assets") is checked on two of the five risks.
- The G-4 keyboard paths are exercised only for Escape on a citation and Enter on Confirm remaining. Neither the `Alt+T` toast Undo nor the Undo of a Confirm is exercised.

**Failure scenario:** Strapi stops projecting per-field `aiProvenance.fields` on the analyst read. The editor would show no markers, but the bars would still render if `outstanding` were served. Or `generation` arrives with an empty `providerName` or `generatedBy`. The header still begins "Generated with AI", the Confirm remaining loop simply runs zero times, and the release still passes once the readiness requirement disappears. Criterion 4 would regress with every browser test green.

**Fix:**
- In the editor step, assert `riskCard(page, recoveryStatement).getByText('AI proposed').first()` is visible and `getByRole('button', { name: 'Confirm Issue statement' })` exists.
- After Confirm remaining, assert the `Confirmed` note.
- Assert the header line `Generated with AI at the request of {analyst display name}` and `toContainText(/Provider: deterministic-assessment-draft · Model: 2/)`.
- On the governance page, assert the `AI proposed` badge on a generated question row.
- Add one `Alt+T` → `Undo` keyboard path for a field Confirm and assert `Confirmation undone.` and that the `Confirm {field}` button is back.
- Assert `Selected system:` or `Selected asset:` on each risk the deterministic provider links.

**Content-type change:** none

#### WR-403 [WARNING]: The journey adds the suggested control to a Risk it has just set to Accept, contrary to the planned proof

**File:** `apps/csrm/e2e/ai-context-provenance.spec.ts:220, 235-246`

**Issue:**
- Line 220 completes every Risk with `completeRiskForRelease(page, index, 'Accept')`, overwriting the deterministic `Treat` proposal on the Internet Exposure risk (`deterministic-assessment-draft-provider.ts:36`).
- Lines 235-246 then add the suggested control to that same risk and release.
- `12-VALIDATION.md` (row "D-38 (UAT-A-like journey)") specifies "add a suggestion of a Treat risk".
- The 2026-10-01 Orchestrator Confirmation (G-14) says "Accept fits only a Risk with no planned control" and that the draft never proposes Accept beside a suggested control.

The journey therefore releases a Risk with an Accept treatment and a Planned control from an AI suggestion, a combination the phase's own rules are built to avoid. It also never meets the `AI_ACCEPT_WITH_PLANNED_CONTROL` refusal in the browser. I could not determine whether release readiness should refuse this combination; the specification does not list it as a release requirement.

**Failure scenario:** A regression lets the decision operation confirm an AI-proposed Accept beside a planned control, or lets the editor present Accept with a suggestion's planned control as consistent. The journey cannot notice, because it builds that state itself and treats it as the happy path.

**Fix:** Complete the Internet Exposure risk with `'Treat'`, matching its AI proposal and the validation map, before adding the suggestion. Keep `'Accept'` only for the Third-Party Dependency risk, whose AI proposal is Accept.

**Content-type change:** none

#### WR-404 [WARNING]: The "no lost input" test cannot fail for the real hazard, and no editor-level unit test covers the AI review UI

**File:** `apps/csrm/src/features/assessments/assessment-editor.test.tsx:1440-1461` ("keeps an unsaved value while another field is confirmed"); `apps/csrm/src/features/assessments/assessment-editor.tsx:337, 506-560`

**Issue:** The test renders `RiskEditor` with `onDecision={async () => {}}`, so the `risk` prop never changes after the decision. The real D-36 hazard ("no lost input") is in what happens next:
- In the editor, `onDecision` is `refreshAssessment`, which replaces `risks` with a new object.
- `RiskEditor` then resets `savedRisk` and recomputes `initial` (`risk-editor.tsx:176-181`).
- A remount, a `form.reset(initial)`, or a change to the Card `key` on that path would discard the unsaved value.

The test never delivers a refreshed `risk`, so it passes trivially.

No test renders `AssessmentEditor` with AI facts. That leaves untested:
- the Risk card header badge (§3.3);
- the `Assessment details` markers, `aria-describedby` and review bar;
- the absence of markers, bars, citations, claims and suggestions after release (§10.2, `mutable` gating);
- the suggestion wiring (`reloadImplementations`).

A defect is already sitting in that gap: `assessment-editor.tsx:337` hard-codes `aria-label={\`AI proposed: ${n} fields to review\`}`, so one proposal reads "1 fields". UI-SPEC §3.3 requires `{field|fields}` and visually hidden text rather than `aria-label` on a generic `span`.

**Failure scenario:** A refactor makes `RiskEditor` reset its form when a refreshed Risk arrives. Every Confirm on another field then wipes the analyst's unsaved edit, and the test stays green. Markers rendering after release would also go unnoticed.

**Fix:**
- In the existing test, after the click, `rerender(<RiskEditor … risk={{ ...proposedRisk, aiProvenance: { ...proposedRisk.aiProvenance, fields: [{ ...fields[0], state: 'accepted' }, fields[1]], outstanding: 1 } }} />)` and assert that `Risk cause` still has `'Unsaved analyst revision'` and its description is still `Edited, not saved`.
- Add `AssessmentEditor` tests with `aiProvenance` that:
  - assert the header badge's accessible name for n = 1 and n = 2;
  - check the details form's markers and bar;
  - render an `approved` assessment and assert that `AI proposed`, `Confirm remaining`, `Sources for` and `Suggested by AI` are absent.
- Fix the plural at line 337.

**Content-type change:** none

#### WR-405 [WARNING]: The decision-hook tests omit focus (§6.2), the re-read after a decision, and several failure paths

**File:** `apps/csrm/src/features/ai-assistance/use-ai-decisions.test.tsx:17-61`; `apps/csrm/src/features/ai-assistance/ai-control-suggestions.test.tsx:58-111`

**Issue:** UI-SPEC §14.2 asks for decision tests covering "optimistic, rollback, Undo, focus". The current tests leave these untested:
- **Focus.** Nothing tests `focusAfterDecision`: focus to the next `[data-ai-confirm]`, then to `[data-ai-review-status]` after Confirm remaining or after the last Confirm. Nothing tests focus after a field Undo either. Only focus after Add is tested for suggestions; focus after Dismiss and Restore is not.
- **The re-read.** The `onUpdated` mock in `input()` is never asserted. If the hook stopped calling it, `useOptimistic` would drop the `accepted` state when the transition ends, and the marker would snap back to `AI proposed`. The test would still pass, because it reads the state only before the transition settles.
- **Failure paths.** The `Try again` action re-sending the same decision, the `Couldn’t undo` title when a field `restore` fails, `Control not added`, and `Suggestion not restored` are all untested.

**Failure scenario:**
- The hook drops `await onUpdated()`: confirmed markers revert visually after every Confirm, and the unit suite stays green.
- Focus after Confirm remaining lands on `body`: G-4 and §6.2 regress, and no test fails.

**Fix:**
- Assert `expect(props.onUpdated).toHaveBeenCalledOnce()` after success, and not after a refusal.
- Render the hook inside a form fixture with two `[data-ai-confirm]` buttons and a `[data-ai-review-status]` element. Flush `requestAnimationFrame` and assert `toHaveFocus` for Confirm, Confirm remaining and Undo.
- Click the danger toast's `Try again` and assert the second call carries the same decisions.
- Add the `Couldn’t undo`, `Control not added` and `Suggestion not restored` cases.

**Content-type change:** none

#### WR-406 [WARNING]: The copy guard misses most Phase 12 copy and two of the UI-SPEC's forbidden terms

**File:** `apps/csrm/src/lib/performance/interface-copy-guard.test.ts:63-86, 255-258, 327-337`

**Issue:** UI-SPEC §14.2 says the guard's "file list gains the `ai-assistance` files; its terms gain `provenance`, `run record`, `context summary` and `ceiling`".

The guard reads only `src/features/ai-assistance/*.tsx`. The `.ts` modules that produce most of the visible Phase 12 copy are not in `guardedFiles` at all, so even the Phase 10 base terms are not checked there:
- `ai-provenance-domain.ts`: header lines, sheet description and outcomes;
- `ai-assistance-domain.ts`: policy captions, failure copy and toast messages;
- `use-ai-decisions.ts`: every toast title;
- `ai-assistance-actions.ts`: the sheet's error copy.

The AI terms apply only to the `.tsx` files. Other files that carry new Phase 12 copy are checked against the base list only: `risk-editor.tsx`, `assessment-editor.tsx`, `questionnaire-governance.tsx`, `questionnaire-introduction.tsx`, `released-assessment.tsx`, and `refusal-copy.ts`, which holds the §11.1 "limit" copy.

The voice rules also forbid "proposal key", "deterministic" and "aiProvenance", which are not listed. `run record` is dropped entirely rather than allowing the one sanctioned `No AI run record`.

The reason the code gives for excluding `.ts` files, closed codes such as `AI_CLASSIFICATION_ABOVE_CEILING`, could be handled by skipping `^[A-Z0-9_]+$` literals.

**Failure scenario:** Changing `aiPolicyRefusalCopy` to "above the Public ceiling", or a toast to "Provenance updated.", passes the guard. Those are exactly the regressions the guard exists to catch.

**Fix:**
- Read every non-test `.ts` and `.tsx` in `src/features/ai-assistance`, and apply the AI terms to the Phase 12 copy files above as well.
- Skip string literals matching `/^[A-Z][A-Z0-9_]+$/`.
- Add `run record` with an allow-list for `No AI run record`. Add `proposal key`, `aiProvenance` and `deterministic`.
- Add an in-memory case for each new term.

**Content-type change:** none

#### WR-407 [WARNING]: The editor route's JavaScript budget is raised to 460,000 bytes, so the performance guard can no longer detect the D-36 regressions

**File:** `apps/csrm/e2e/performance.spec.ts:76-77`; `docs/performance/phase-08-baseline.md:61,84`

**Issue:** D-36 set the conditions for the editor: the route sits at 89.9% of its 300,000-byte budget (R-08-34), client pieces stay zod-free, the sheet and the source view load on demand, and "`performance.spec.ts` must stay green". The override raises the route to 460,000 bytes. That is 1.5 × the measured 304,218 bytes, leaving about 156 KB of headroom.

The spec's own rule requires the reason "beside it and in the baseline record". The baseline record still shows 269,653 bytes for this route and has no override entry.

No unit test asserts that `ai-run-sheet` or `ai-source-popover` stays code-split. Only `ai-provenance-header.tsx` and `ai-assistance-domain.ts` have zod-free source checks.

**Failure scenario:** A client component on the editor route imports a zod schema (about 64 KB delivered, the figure the questionnaire route records), or the run sheet's `import()` becomes a static import. The route grows past both the old budget and the D-36 intent, and `performance.spec.ts` stays green.

**Fix:**
- Record the override and its measured median in `docs/performance/phase-08-baseline.md`.
- Set the override to the documented 1.5 × only if the triage really classed the cost as inherent. Otherwise fix the cost at its source and restore 300,000, as the spec's own triage rule says.
- Add source checks that `ai-run-sheet-trigger.tsx` and `ai-citations.tsx` load their sheet and popover with `import()`. Add a check that no module under `src/features/ai-assistance/*.tsx` or `use-ai-decisions.ts` imports `zod`.

**Content-type change:** none

#### WR-408 [WARNING]: The enqueue-refusal copy test pins the execution-time sentence, contrary to §11.3, and no card renders a refused enqueue

**File:** `apps/csrm/src/lib/api/refusal-copy.test.ts:86, 100, 116-118`; `apps/csrm/src/lib/api/refusal-copy.ts:7-9, 124, 139`

**Issue:** UI-SPEC §11.3 says a refusal at enqueue reads §11.1's description: "This request’s information is classified {level}, above the {ceiling} limit the AI provider is approved for, …". D-28 says the message names the classification and the ceiling.

The family rows call `aiPolicyRefusalCopy` without details. For `AI_CLASSIFICATION_ABOVE_CEILING` they therefore fall back to the §11.2 execution-time sentence ("…is now classified above the limit…, so nothing was sent to the AI."), and the test asserts that deviation as correct. Both cards hold the served `aiPolicy`, which has the level and the ceiling, but nothing passes it through.

There is also no card-level test in which `startQuestionnaireGenerationAction` or `startAssessmentDraftAction` returns this 409 reason, and `AssessmentDetail` is never rendered with a refused `aiPolicy`.

**Failure scenario:** The jobs read allowed generation, but the ceiling changed before the analyst pressed Generate. The analyst reads "now classified above the limit" without the classification or the ceiling, which breaks D-28, and the copy test enforces that wording.

**Fix:**
- Pass the card's `aiPolicy` (`requestClassification`, `ceiling`) into the enqueue refusal copy when present. Change the family rows and the test to expect the §11.1 sentence when details exist, and the fixed sentence only when they do not.
- Add a `QuestionnaireGenerationJob` and an `AssessmentDraftJob` test in which the start action resolves `{ ok: false, reason: 'AI_CLASSIFICATION_ABOVE_CEILING' }`.
- Add one `AssessmentDetail` test with a refused `aiPolicy` asserting that neither card offers Generate.

**Content-type change:** none

### Info

#### IN-401 [INFO]: The run-sheet test imports another test file, re-registering its tests and mocks

**File:** `apps/csrm/src/features/ai-assistance/ai-run-sheet.test.tsx:9`; `apps/csrm/src/features/ai-assistance/ai-assistance-service.test.ts:52-80`

**Issue:** `import { aiRunFixture } from './ai-assistance-service.test'` loads that file's `describe` blocks, its `vi.mock('../../lib/api/transport/server-client')`, its top-level `await import('./ai-assistance-service')` and its `afterEach` into the run-sheet test file. Six service tests run twice, and the run-sheet suite depends on another suite's mocks. The `vi.mock('server-only')` at line 11 of the run-sheet test exists only because of this import.

**Failure scenario:** A change to the service test's mocks or hooks breaks or alters the run-sheet suite. A failure in a service test is reported twice, the second time under the wrong file.

**Fix:** Move `aiRunFixture` to `src/features/ai-assistance/test-fixtures.ts` and import it from both tests.

**Content-type change:** none

#### IN-402 [INFO]: Several negatives are narrower than the state they claim

**File:** `apps/csrm/src/features/ai-assistance/ai-field-marker.test.tsx:23-29`; `apps/csrm/src/features/questionnaires/questionnaire-governance.test.tsx:492-495`

**Issue:**
- In `ai-field-marker.test.tsx`, the `state={null}` case asserts only that `Edited` is absent. A marker that rendered `AI proposed` or `Confirmed` for `null` would pass.
- In the same file, the `accepted` and `edited` cases never assert that the `Confirm` button is gone; only `changed` does.
- The governance test "shows no origin marker once the questionnaire is released" checks only `AI proposed`, not `Edited` or `Added by analyst`.

**Failure scenario:** `AiFieldMarker` renders the `Confirm` button for an `accepted` field, letting an analyst re-confirm, and the test passes.

**Fix:**
- For `null`, assert that the container is empty.
- Assert `queryByRole('button')` is null after each reviewed rerender.
- In the released governance case, assert `queryByText(/AI proposed|Edited|Added by analyst/)` is null.

**Content-type change:** none

#### IN-403 [INFO]: The journey branches on observed state before release

**File:** `apps/csrm/e2e/ai-context-provenance.spec.ts:262-270`

**Issue:** `if (await readiness.getByRole('link', { name: 'Assessment status' }).count() > 0)` reads a count once and chooses one of two paths. That hides whether the D-13 return to draft happened, and it reads the list as soon as the readiness text shows. The result depends on timing even though the server state is deterministic.

**Failure scenario:** If the returned-to-draft state is ever not yet reflected at that instant, the test skips the extra save and fails later at `All release requirements are met`. A real change in D-13 behaviour is also never reported.

**Fix:** Decide the expected state from the journey's own steps: the last accepted edit came after release readiness was met, so the assessment is in draft. Assert that state explicitly, then save, rather than branching.

**Content-type change:** none

#### IN-404 [INFO]: No test feeds a "Not sure" answer into the draft

**File:** `apps/csrm/e2e/ai-context-provenance.spec.ts:153-154`

**Issue:** The Requestor checks `Not sure` and immediately changes the answer to `Yes`, so the submitted questionnaire carries no "Not sure" answer. The draft, the citation popover (`Requestor’s answer`) and the run sheet are never exercised with one. Criterion 5 only requires the choice to be offered, so this is a robustness gap rather than a criterion miss.

**Failure scenario:** The context builder or the answer display mishandles the `not-sure` value, for example by rendering the raw value or dropping the question as unanswered. No web test notices.

**Fix:** Submit `Not sure` for one question whose answer the deterministic draft cites. Then assert the citation popover shows `Not sure` under `Requestor’s answer`, and that the run sheet's `{answered} of {included}` counts it.

**Content-type change:** none

---

_Reviewed: 2026-10-08T02:01:51Z_
_Reviewer: Claude (gsd-code-reviewer), Lane 4_
_Depth: standard_
