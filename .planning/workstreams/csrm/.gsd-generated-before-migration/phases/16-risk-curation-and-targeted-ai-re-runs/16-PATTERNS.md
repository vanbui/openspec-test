# Phase 16: Risk curation and targeted AI re-runs - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 74 (new and modified, from 16-CONTEXT D-01 to D-52 and its Orchestrator Confirmations, and 16-RESEARCH "Recommended Project Structure", "The active-risk rule: the complete reader inventory", "Contract changes", "Plan grouping and wave order", "Wave 0 Gaps")
**Analogs found:** 70 / 74

**Written ahead.** Phase 16 executes after Phases 10 to 15. Phase 10 (23 plans) and Phase 11 (14 plans) have plans; Phase 12 has 12-01 and 12-02 written and the rest numbered in `12-PATTERNS.md` (12-03 to 12-16); Phases 13 to 15 have CONTEXT only (13) or nothing yet (14, 15). The column "Earlier changes" names the plan (or phase) that changes each file first; a Phase 16 plan builds on that planned state, names it in its context section, and is re-checked at Stage 3. Line numbers are today's code and will move.

Paths: `B/` = `apps/backend/`, `W/` = `apps/csrm/`. All analogs below are git-tracked source (no capability mirrors exist in this repo).

## File Classification

### Strapi: new modules

| New file | Role | Data flow | Closest analog | Match | Earlier changes | P16 plan (research) |
|---|---|---|---|---|---|---|
| `B/src/csrm/active-risk.ts` (`isActiveRisk`, `activeRisks`, `ACTIVE_RISK_FILTER`) | utility (pure) | transform | `B/src/csrm/prompt-data.ts` (pure, dependency-free); `$notNull` filter in `recent-activity-repository.ts:85` | role | - | 16-02 |
| `B/src/csrm/risk-history-changes.ts` (field diff + closed envelope parser) | utility (pure) | transform | `B/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts:1-60` (closed, versioned, append-only envelope) | exact | 10-10, 10-11 (log module) | 16-02 |
| `B/src/csrm/ai/risk-proposals/duplicate-scorer.ts` | utility (pure) | transform | Phase 12's `B/src/csrm/ai/library-ranking.ts` (tokeniser) | role | 12-03 (creates it) | 16-02 |
| `B/src/csrm/ai/risk-proposals/field-units.ts` (generic; Phase 17 reuses) | utility (pure) | transform | `assessment-workflow.ts:87-91` (`assertPayload`, closed field set) + Phase 12 `ai-provenance.ts` per-field envelope | partial | 12-04 | 16-02 |
| `B/src/csrm/ai/risk-proposals/proposal-envelope.ts` (v2 items, `itemStates`, parsers) | model (closed parser) | transform | `questionnaire-governance-log.ts`; Phase 12 `ai-run-record.ts` | exact | 12-04 | 16-02 |
| `B/src/csrm/ai/risk-proposals/suggestion-context.ts`, `rewrite-context.ts` | service (builder) | transform | Phase 12 `B/src/csrm/ai/assessment-context.ts` + `prompt-sections.ts` | exact | 12-03 | 16-08 |
| `B/src/csrm/ai/risk-proposals/suggestion-adapter.ts`, `rewrite-adapter.ts` | provider adapter | transform | Phase 12 `assessment-draft-provider.ts` v2 parser + draft adapter | exact | 12-06 | 16-08 |
| `.../deterministic-risk-proposal-provider.ts`, `openai-compatible-risk-proposal-provider.ts` | provider | request-response | `B/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts`, `openai-compatible-assessment-draft-provider.ts` | exact | 12-06 | 16-08 |
| `.../risk-proposal-registry.ts` | job registry | event-driven | `B/src/api/csrm-assessment/services/assessment-draft-registry.ts` (single flight **changed**: only while queued/running) | exact | 10-13, 12-07; Phase 13 D-18 (retry rule) | 16-09 |
| `.../risk-proposal-workflow.ts` (enqueue, execute, complete, supersede, lapse) | service | event-driven + CRUD | `assessment-workflow.ts` `generateAssessmentDraft`/`persistAssessmentDraft` (`:725-794`) + `withMutableAssessmentMutation` | role | 10-13, 12-07 | 16-09 |
| `B/src/csrm/ai/analyst-instruction.ts` (only if Phase 15 has not placed it) | utility (validator) | transform | `revert-reason.ts:9-18` | role | Phase 15 (no plans yet) | 16-08 |
| `B/src/api/csrm-risk-history-event/content-types/csrm-risk-history-event/schema.json` | model | - | `B/src/api/csrm-risk/content-types/csrm-risk/schema.json:45-49` (unidirectional manyToOne, no `inversedBy`); Phase 12 `csrm-ai-run` schema | exact | 12-04 (ai-run type exists) | 16-03 |
| `B/src/api/csrm-risk-history-event/services/risk-history.ts` (`recordRiskHistory`, paginated read) | service | CRUD (append + read) | `questionnaire-governance-log.ts` (only writer, no removal); batched names `questionnaire-scope.ts:283-307` | role | 10-10, 10-11 | 16-03, 16-05 |
| `B/src/api/csrm-risk-history-event/{routes,controllers}` (core router `only: []`) | route | - | Phase 12 `B/src/api/csrm-ai-run/` | exact | 12-04 / 12-10 | 16-03 |
| `B/src/api/csrm-risk/services/risk-curation.ts` (withdraw, reinstate) | service | CRUD (batch) | `risk-workflow.ts:193-225` (`updateRisk` inside `withMutableAssessmentMutation`) | exact | 10-18; 12-07 | 16-05 |

### Strapi: modified files

| File | Role | Data flow | Analog (self lines) | Earlier changes | P16 plan |
|---|---|---|---|---|---|
| `B/src/api/csrm-risk/content-types/csrm-risk/schema.json` (3 withdrawal attrs) | model | - | self `:45-49` (`riskOwner` relation form) | - (frozen; only P16 changes) | 16-03 |
| `B/src/api/csrm-assessment/services/assessment-workflow.ts` (hot): `assertAssessmentEditable`, `withAssessmentMutation({transition})`, readiness over active risks, `aiProposalsDecided`, history in `persistAssessmentDraft` | service | CRUD | self `:128-134`, `:268-300`, `:381-396`, `:430-481` | 10-13, 10-17; 12-02 (risk-scale/policy wiring), 12-04, 12-07, 12-10 (no-transition variant for dismissals, 12-CONTEXT confirmation); Phase 13 (CONTEXT mentions) | 16-04, 16-10 |
| `B/src/api/csrm-risk/services/risk-workflow.ts` (hot): inner `*InMutation`, history, withdrawn guard | service | CRUD | self `:168-225` | 10-18; 12-07 | 16-04 |
| `B/src/api/csrm-control-implementation/services/control-implementation-workflow.ts` | service | CRUD | self `:200-249` | 10-15; 12-10 (reuse) | 16-04 |
| `B/src/api/csrm-assessment-request/services/revert-reason.ts` (extract `parseReasonText`) | utility | transform | self `:1-18` | - | 16-02 |
| `B/src/api/csrm-assessment/controllers/csrm-assessment.ts` (withdraw/reinstate/suggest/proposals/job handlers; active filters `:254-290`) | controller | request-response | self `:162-186`, `:254-290`, `getDraftJob`/`retryDraftJob` `:292-293` | 10-15; 11-07; 12-09, 12-10 | 16-05, 16-06, 16-09, 16-10 |
| `B/src/api/csrm-assessment/routes/*`, `operations.ts` | route, config | - | `B/src/api/csrm-risk/routes/csrm-risk.ts:5-60` (`policies(operation)`) | 10-13; 12-10, 12-11 | 16-05, 16-09, 16-10 |
| `B/src/api/csrm-risk/routes/csrm-risk.ts`, `operations.ts`, `controllers/csrm-risk.ts` (history read, rewrite) | route, controller | request-response | self `operations.ts:1-10`, routes `:28-60` | - | 16-05, 16-09 |
| `B/src/api/csrm-assessment/services/assessment-scope.ts` (`withdrawal` block, `openAiProposals`, `aiInputsChanged`) | projection | transform | self `projectAnalystRiskDetail`, `:204-223` | 10-15, 10-18; 11-07; 12-09 | 16-06 |
| `B/src/api/csrm-assessment-request/services/relationship-scope.ts` (reader **not in D-13**) | projection | transform | self `:30-77` | 10-12; 11-10 | 16-06 |
| `B/src/api/csrm-risk/services/risk-register.ts` (`applyActiveRisk`, detail `withdrawal`) | repository (SQL) | CRUD (read) | self `:113-164` (`applyDisclosableParent`) | 10-15; 11-04, 11-07, 11-14 (stage predicates) | 16-07 |
| `B/src/api/csrm-risk/services/risk-register-query.ts` (closed `withdrawal` filter) | utility (query parser) | transform | self `:7` (`RISK_REGISTER_STATES`) | 11-14 | 16-07 |
| `B/src/api/csrm-analyst-insight/services/dashboard-summary.ts`, `alert-repository.ts`, `report-repository.ts` | repository (SQL) | CRUD (read) | `dashboard-summary.ts:147-149`, `alert-repository.ts:233-248` | alerts/reports: 11-14; dashboard: Phase 13 (CONTEXT) | 16-07 |
| `B/src/csrm/conflict-reasons.ts` (hot) | config (closed vocab) | - | 10-06 contract | 10-06, 10-07; 12-02, 12-05, 12-10 | 16-05 (single owner per wave) |
| `B/src/policies/csrm-authorization.ts` (hot) | policy | request-response | self `:41-65` (`HUMAN_ANALYST_ONLY_OPERATIONS`, `humanAnalystDenialMessage`) | 10-13; 12-10, 12-11; Phase 13 | 16-05, 16-09 |
| Phase 12's decision service (`ai_proposal_decisions`) + `ai-provenance.ts` + `ai-run-record.ts` (run operations, `openProposals`) | service | CRUD (batch) | Phase 12 modules | 12-04, 12-07, 12-10 | 16-09, 16-10 |
| `B/src/api/csrm-assessment-request/` delete guard (Orchestrator Confirmation: refuse delete once an assessment exists) | controller/service | request-response | `request-workflow.ts` closed-reason refusals | 10-04, 10-06; Phase 13 | 16-05 (or own plan) |
| Both catalogue copies, `docs/references/specification.json`, `W/src/lib/api/generated/schema.d.ts`, `docs/references/served-operations.json` | contract | - | `function.questionnaire_generation.*` entries; `served-operations.json:2230-2234` (`regenerate_draft`) | spec: 10-06/10/11/13/15/16/18, 11-06/07/08/10/14, 12-05/08/09/10/12; catalogue: 10-13, 11-10, 12-11; served: 10-13, 11-10, 11-12, 12-10, 12-11 | 16-05, 16-06, 16-07, 16-09, 16-10 (serialised) |
| `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md` (new) + dated amendments to `phase-12-ai-run-record-and-provenance.md`, `phase-04-deterministic-draft-jobs.md` | doc | - | `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`, `phase-06.1-revert-audit-facts.md` | phase-12 record: 12-01 | 16-01 |

### Strapi: tests

| New/modified test | Analog | Earlier changes | P16 plan |
|---|---|---|---|
| `B/tests/active-risk.unit.test.ts`, `risk-history-changes.unit.test.ts`, `risk-duplicate-scorer.unit.test.ts`, `risk-field-units.unit.test.ts` | `B/tests/risk-register.unit.test.ts`; `questionnaire-governance.unit.test.ts` | - | 16-02 |
| `B/tests/risk-no-delete.unit.test.ts` + static reader guard | `B/src/lib/performance`-style source scan; `apps/csrm/src/lib/performance/interface-copy-guard.test.ts` (scan-and-allow-list) | - | 16-04, 16-07 |
| `B/tests/risk-curation.integration.test.ts` | `B/tests/risk-register.integration.test.ts:1-40` (harness, spec-key pinning) | - | 16-04 to 16-06 |
| `B/tests/ai-provider-risk-proposals.unit.test.ts` + `tests/fixtures/ai-wire/risk-proposals/*.json` | `B/tests/ai-provider-assessment.unit.test.ts` via `tests/helpers/fake-openai-compatible-server.ts` | 12-05, 12-06 (wire fixtures) | 16-08 |
| `B/tests/risk-proposals.integration.test.ts`, `risk-proposal-decisions.integration.test.ts` | Phase 12 `ai-run.integration.test.ts`, `ai-proposal-decisions.integration.test.ts` | 12-04, 12-10 | 16-09, 16-10 |
| `B/tests/fixtures/authorization-matrix.ts`, `contract-catalogue.integration.test.ts`, `served-operations.integration.test.ts` | self (draft rows `:904-916`) | 10-13, 11-10, 12-10, 12-11; Phase 13 | 16-05, 16-09 |
| `B/tests/analyst-dashboard|analyst-alerts|analyst-reports|risk-register|assessment-workflow.integration.test.ts` | self | 10-15, 10-18, 11-07, 11-14 | 16-06, 16-07 |

### Web

| File | Role | Data flow | Closest analog | Match | Earlier changes | P16 plan |
|---|---|---|---|---|---|---|
| `W/src/features/risk-curation/risk-curation-domain.ts` (zod-free: labels, rating hint, word diff) | model | transform | `W/src/features/assessments/assessment-domain.ts`; Phase 12 `ai-assistance-domain.ts` | exact | 12-12/13 | 16-11 |
| `.../risk-curation-schema.ts`, `-service.ts`, `-actions.ts` | model (zod), service, Server Action | request-response | `assessment-service.ts:338-353` (job POST/GET/retry), `assessment-actions.ts:158-189` | exact | 10-13 | 16-05, 16-09, 16-10 |
| `.../withdraw-risk-form.tsx` (X-5 in-place form; sheet on phones) | component | event-driven (optimistic) | Phase 10 X-5 form in `questionnaire-governance.tsx`; `components/csrm/confirm-dialog.tsx` (reason field) | role | 10-09; 12-15 | 16-11 |
| `.../risk-history-sheet.tsx` (lazy) | component | request-response | `W/src/features/questionnaires/questionnaire-revision-timeline.tsx:1-40` | exact | 10-10, 10-11 | 16-11 |
| `.../ai-proposals-panel.tsx`, `risk-rewrite-diff.tsx` (lazy) | component | event-driven (optimistic) | Phase 12 `ai-control-suggestions.tsx`, `ai-review-bar.tsx`, `ai-run-sheet.tsx` | role | 12-13, 12-14 | 16-11 |
| `.../risk-proposal-job.tsx` | component | event-driven (polling) | `W/src/features/assessments/assessment-draft-job.tsx:1-50` | exact | 10-02, 10-14; 12-12 | 16-11 |
| `.../withdrawn-risk-card.tsx` | component | request-response | Phase 12 `released-risk-details.tsx` (new in 10-15) | role | 10-15; 12-14 | 16-11 |
| `W/src/components/csrm/status-badge.tsx` ("Withdrawn" value) | component | transform | self `:100-125` (`statusPresentation`) | exact | 11-01; 12-13 (`aiReview` family) | 16-12 |
| `W/src/components/csrm/segmented-control.tsx` (Active/Withdrawn filter, reuse) | component | - | self | exact | - | 16-12 (reuse, no edit) |
| `W/src/features/assessments/assessment-editor.tsx`, `risk-editor.tsx` (hot; Discard, filter, panels) | component | CRUD | self | exact | editor: 10-02, 10-15, 10-18 to 10-21, 11-04, 12-14; risk-editor: 10-02, 10-19, 10-20, 12-14 | 16-12 |
| `W/src/features/assessments/released-assessment.tsx`, `control-implementation-editor.tsx` | component | request-response / CRUD | self | exact | released: 10-02, 10-15, 11-04, 11-05, 11-07, 12-14; CI editor: 10-18 | 16-12 |
| `W/src/features/assessments/assessment-schema.ts`, `assessment-service.ts`, `assessment-actions.ts`, `assessment-domain.ts` (hot) | model, service, action, domain | request-response | self | exact | schema/service: 10-13, 10-15, 10-18, 11-06, 11-07, 12-09, 12-12; actions: 10-07, 10-13, 10-18, 12-10; domain: 10-15, 10-20, 10-21, 11-01, 11-09 | 16-06, 16-10 |
| `W/src/features/assessments/release-readiness-summary.ts` | utility | transform | self | exact | 10-21; 12-14 | 16-10 |
| `W/src/features/risks/risk-schema.ts`, `risk-service.ts`, `risk-register-filters.tsx`, `risk-detail-editor.tsx`, `risk-details.tsx` | model, service, component | request-response | self | exact | schema: 10-18, 11-07, 11-14; filters: 11-04, 11-14; detail-editor: 10-02, 10-19, 10-20; details: 10-02, 10-15, 10-19 to 10-21, 11-03, 11-04 | 16-07, 16-12 |
| `W/src/lib/api/conflict-reasons.ts`, `refusal-copy.ts` | config | - | self | exact | 10-06, 10-07; 12-05, 12-10 | 16-05 |
| `W/src/features/contract-response-parity.test.ts`, `contract-operation-chain.test.ts`, `W/src/lib/performance/interface-copy-guard.test.ts` | test guard | - | self | exact | parity: 10-09, 10-15, 11-06/07/08/10/11/12/14, 12-08/09/10; copy guard: 10-02+, 11-12, 11-14, 12-14/15 | 16-05 to 16-12 |
| `W/app/(app)/app/review/assessments/[documentId]/page.tsx` | page loader | request-response | self | exact | 10-15, 10-18 | 16-12 |
| `W/e2e/risk-curation.spec.ts` (new) | E2E | - | `W/e2e/assessment-release-workflow.spec.ts`; Phase 12 `ai-context-provenance.spec.ts` | exact | 12-16 | 16-13 |
| `W/e2e/assessment-release-workflow.spec.ts`, `risk-register-workflow.spec.ts`, `performance.spec.ts`, `accessibility.spec.ts` | E2E | - | self | exact | many (10-15, 10-18, 11-07, 11-12, 11-14, 12-16) | 16-12, 16-13 |
| `docs/design/csrm-design-direction.md` (new X-n: field comparison, withdrawn record) | doc (shared) | - | Phase 12 X-11 to X-14 (12-01/12-02 first tasks) | exact | 10-01, 10-21, 10-22, 11-01, 11-05, 11-09, 12-01, 12-02 | 16-11 first task |
| Root `CONTEXT.md` ("Withdrawn (Risk)" already present at `:33-35`) | doc | - | - | - | 11-01, 12-01 | check only |

## Pattern Assignments

### `assessment-workflow.ts`: the guard and the two wrappers (16-04)

**Today's predicate** (`:128-134`), which `assertAssessmentEditable({ assessment, actor })` wraps:
```typescript
export function assertMutableAssessment(value: unknown): void {
  if (!isRecord(value)) throw new AssessmentWorkflowError(409, "CSRM assessment is not mutable.");
  const hasReleaseFact = value.assessmentStatus === "approved" || value.approvedBy != null || value.approvalDate != null;
  if (hasReleaseFact || (value.assessmentStatus !== "draft" && value.assessmentStatus !== "in-review")) {
    throw new AssessmentWorkflowError(409, "CSRM assessment is not mutable.");
  }
}
```
**Serialisation** (`:381-396`): per-assessment promise queue; never call a wrapped function from inside the wrapper (Pitfall 1).
**Wrapper body** (`:443-480`): `serializeAssessmentMutation` → `strapi.db.transaction` → `lockAssessment` (forUpdate) → `findOne({ populate: assessmentReleasePopulate })` → `assertMutableAssessment` → `transitionForAcceptedEdit({..., releaseReady: validateReleaseReadiness(assessment).ready})` → `mutate` → `assessments.update({assessmentStatus, reviewedBy})` (+ request status when `draft`). Phase 16 adds `transition: "accepted-edit" | "none"` and skips the write when `mutate` reports nothing changed (Pitfall 4). If 12-10 already ships a no-transition variant, reuse it and add only `actor`.
**Readiness** (`:268-300`): `projectReleaseReadiness` builds `risks[${index}]` paths from its own loop; filter both it and `validateReleaseReadiness` with `activeRisks(...)` so indexes align.
**Closed payload** (`:87-91`): `assertPayload(input, allowed)` — unknown keys are 400; use the same for withdrawal bodies and to prove D-44.

### `risk-workflow.ts` / `control-implementation-workflow.ts`: inner functions (16-04)

**Analog** `updateRisk` (`risk-workflow.ts:193-225`): parse outside, `findOne` with `populate: { assessment: true }` for the ancestor, then inside `mutate` re-read the authoritative risk, check `"CSRM Risk ancestor changed."` (409), `resolveRelations`, `documents(RISK_UID).update`. Split into `updateRiskInMutation({ strapi, transaction, riskDocumentId, parsed, actor, source })` that adds: withdrawn guard (`RISK_WITHDRAWN`), `riskChanges(before, after)`, `recordRiskHistory` in the same transaction (Pitfall 7). Same split for `createAssessmentRisk` (`:168-191`, `createWithRiskNumber`) and the three CI functions (`control-implementation-workflow.ts:200-249`; the delete at `:247` keeps the removed values in a `control-implementation-removed` row).

### `risk-curation.ts` (withdraw/reinstate, 16-05)

Copy the `updateRisk` ancestor pattern for a batch: load `documentId $in riskIds` with `assessment` inside the transaction; any mismatch → 404 for the whole batch. Reason via extracted parser (`revert-reason.ts:1-18`):
```typescript
export const REVERT_REASON_MAX_LENGTH = 500;
// parseRevertReason requires a one-key body; extract parseReasonText(value) beside it:
const reason = body.reason.trim();
if (reason.length < 1 || reason.length > REVERT_REASON_MAX_LENGTH) { throw ... }
```
Undo uses a closed `undo: true` flag (Pitfall 5).

### Active-risk rule (16-02, 16-06, 16-07)

**SQL sibling** of `applyDisclosableParent` (`risk-register.ts:126-164`, outer alias `r`); add `applyActiveRisk(query)` (`r.withdrawn_at IS NULL`), never fold it in (the register's "Withdrawn" filter must reach rows). Callers to extend:
```typescript
// dashboard-summary.ts:147-149
return applyDisclosableParent(connection.queryBuilder().from("csrm_risks as r")).whereRaw("r.closure_date IS NULL");
// alert-repository.ts:233-235, 241-248 (same shape, .whereNull("r.closure_date"))
```
**Document filter**: `controllers/csrm-assessment.ts:262-264` `findMany({ filters: { assessment: { documentId: { $eq: documentId } } }, ... })` gains `...ACTIVE_RISK_FILTER`; `listRiskControlImplementations` (`:272-290`) returns 404 "CSRM Risk was not found." for a Requestor on a withdrawn risk.
**In memory**: `relationship-scope.ts:57-77` `residualRiskCounts` / `controlImplementationCount` read `assessment.risks` from `assessmentReleasePopulate` — wrap with `activeRisks`. Analyst detail (`controllers/csrm-assessment.ts:174-180`) keeps all risks but computes `projectReleaseReadiness` over active ones.

### History entity schema (16-03)

Copy the unidirectional relation form from `csrm-risk/schema.json:45-49` (no `inversedBy`, so `csrm-risk/schema.json` gains only the three withdrawal attributes):
```json
"riskOwner": { "type": "relation", "relation": "manyToOne", "target": "api::idambox-user.idambox-user" }
```
`"collectionName": "csrm_risk_history_events"`, `"draftAndPublish": false` as in `:1-13`. Do **not** copy `assessment`'s `inversedBy: "risks"` (`:168-172`).

### History writer and envelope (16-02, 16-03)

**Analog** `questionnaire-governance-log.ts:1-60`: header comment stating it is never read by a gate; `SCHEMA_VERSION = 1`; `Object.freeze([...] as const)` kind vocabulary; exact-key closed parser; read path degrades a malformed envelope (`changes: null`) instead of failing. One exported writer, no update/delete function.

### History sheet (16-11)

**Analog** `questionnaire-revision-timeline.tsx:1-40`: `eventPresentation` map of kind → `{ icon, label }` (lucide), `<time dateTime>`, `actor()` never shows a document id, `Reason:` row with `[overflow-wrap:anywhere]`, semantic tokens only (`border-border bg-card text-muted-foreground`). Replace the local `formatDate` with Phase 10's `formatInstant`/`LocalInstant` (X-3).

### Proposal registry (16-09)

**Analog** `assessment-draft-registry.ts` (types `:1-60`, launch/enqueue/get/retry `:150-234`). Copy: `queued|running|completed|failed`, bounded terminal retention (`MAX_TERMINAL`, `TERMINAL_TTL_MS`), `safeFailure`, `RegistryError(400|403|404|409)`, retry only when `failed` and not in flight. **Change** the single flight at `:177-183` (returns any retained job) to return only a `queued`/`running` job (Pitfall 8). Target key `suggestions:{assessmentId}` / `rewrite:{riskId}`. Retry: any analyst who may read the request, recorded as the run's initiator (Orchestrator Confirmation; Phase 13 D-18).

### Routes, grants and the human-only set (16-05, 16-09)

**Route analog** `csrm-risk/routes/csrm-risk.ts:5-8, 46-56`:
```typescript
const policies = (operation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation } },
];
{ method: "PATCH", path: "/v1/risks/:riskId", handler: "api::csrm-risk.csrm-risk.updateRisk",
  config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_RISK_OPERATIONS.update) } },
```
Operation keys go in `operations.ts` as `"POST:/api/v1/risk_assessments/{assessmentId}/risk_withdrawals"`. **Policy analog** `csrm-authorization.ts:41-49` (`HUMAN_ANALYST_ONLY_OPERATIONS` set) and `:61-65` (`humanAnalystDenialMessage`: add a branch, the fallback is questionnaire wording). Catalogue: copy `function.questionnaire_generation.*` (API-only, `role.security_analyst` only) into both copies byte-identically.

### Controller handler shape (16-05)

**Analog** `controllers/csrm-assessment.ts:186-206` (`updateAssessment`): `assertAnalystAssessmentScope(ctx.state)`, `assertClosedAssessmentQuery(ctx.query)`, identity from `ctx.state.idamboxUser.documentId` (never branch on auth mode), call workflow, `catch` known error classes → `safeError(ctx, error.status, error.message)`, rethrow others.

### Web service, action, job panel (16-05, 16-09, 16-11)

**Service** `assessment-service.ts:338-353`: `request((client) => client.POST('/v1/...', { params: { path: {...} } }), parser)`. **Action** `assessment-actions.ts:158-189`: `'use server'`, zod `safeParse` → `validationFailure`; `result.error` → `serviceFailure(status)`; `revalidatePath` set (`:148-155`); returns `{ ok: true, data }`. Batch decisions are one action (Next 16.3 sequential dispatch). **Job panel** `assessment-draft-job.tsx:1-50`: injectable `timing` (poll 1 s, timeout 30 s), `statusCopy` record per status, "Check again" after timeout.

### Status tag (16-12)

`status-badge.tsx:116-125`: `statusPresentation` is the one family → value → `{ icon, label, tone }` mapping; add a "Withdrawn" value (neutral tone, icon, text), never a local badge.

### Integration tests (all Strapi plans)

`risk-register.integration.test.ts:1-40`: `startAuthorizationHttpHarness()` once per file with `after(close)`; `specKeys(component)` asserts served keys equal the closed spec component (`additionalProperties: false`). Every refusal asserts persistence deep-equal.

## Shared Patterns

- **Current fact plus append-only log** (06.8; Phase 12 D-21): withdrawal facts and `itemStates`/`openProposals` are read by gates; history rows and run `decisions` narrate only. Source: `questionnaire-governance-log.ts` header.
- **Record-level authorisation from `ctx.state`**: `assertAnalystAssessmentScope(ctx.state)`; Requestor reads 404 via `releasedForOwner` (`controllers/csrm-assessment.ts:168-171, 258-260`). Apply to every new handler.
- **Closed inputs**: `assertPayload` (`assessment-workflow.ts:87-91`) on the server, zod `.strict()` in actions (`assessment-actions.ts:177`).
- **Closed refusal reasons**: Phase 10's `conflict-reasons.ts` (both copies) + `refusal-copy.ts`; no `AI_PROPOSAL_NOT_OPEN` (reuse Phase 12's code, extended to lapsed).
- **Transaction joining**: every write (risk, history, run, `aiProvenance`) inside the wrapper's `strapi.db.transaction` callback (`assessment-workflow.ts:443-480`).
- **Hot-file ownership** (D-51): one plan per wave owns `assessment-workflow.ts`, spec/client, catalogue copies, `served-operations.json`, matrix, parity guards, `csrm-authorization.ts`, `conflict-reasons.ts`.

## No Analog Found

| File | Role | Data flow | Reason |
|---|---|---|---|
| `B/src/csrm/ai/risk-proposals/duplicate-scorer.ts` (Jaccard) | utility | transform | No pairwise similarity exists; tokeniser from Phase 12 `library-ranking.ts` (planned), scorer from RESEARCH "Jaccard scorer" |
| `B/src/csrm/ai/risk-proposals/field-units.ts` (units, base capture, stale) | utility | transform | No diff/stale mechanism exists; RESEARCH "Rewrite units and stale detection" |
| `B/tests/risk-no-delete.unit.test.ts` (source scan) | test | - | No Strapi-side static source guard exists; closest is the web `interface-copy-guard.test.ts` scan |
| Word-level text diff in `risk-curation-domain.ts` | utility | transform | Nothing in the web app diffs text; pure, no dependency (RESEARCH) |

## Metadata

**Analog search scope:** `apps/backend/src/api/{csrm-assessment,csrm-risk,csrm-control-implementation,csrm-assessment-request,csrm-analyst-insight,csrm-questionnaire}`, `apps/backend/src/policies`, `apps/backend/tests`, `apps/csrm/src/{features,components/csrm}`, `apps/csrm/e2e`; earlier-phase ownership from `files_modified`/mentions in `10-*-PLAN.md`, `11-*-PLAN.md`, `12-01/02-PLAN.md`, `12-PATTERNS.md`, `13-CONTEXT.md`.
**Files scanned:** about 30 source files plus 39 plan files.
**Pattern extraction date:** 2026-10-01
