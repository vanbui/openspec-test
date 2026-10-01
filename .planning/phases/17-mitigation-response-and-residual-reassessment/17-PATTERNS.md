# Phase 17: Mitigation response and residual reassessment - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 58 (new and modified, grouped where one analog serves a family)
**Analogs found:** 55 / 58
**Economy (Stage 2 rules §3a):** code areas already mapped by earlier phases are cited, not re-surveyed: `10-PATTERNS.md`, `11-PATTERNS.md`, `12-PATTERNS.md`, `13-PATTERNS.md`, `14-PATTERNS.md`, `15-PATTERNS.md`, `16-PATTERNS.md`, `19-PATTERNS.md`, `19.1-PATTERNS.md` (all in `.planning/phases/<phase>/`). Excerpts below are only for code those maps do not cover or that Phase 17 changes in a new way. Line numbers are today's code (`post-demo`, 2026-10-01); executors re-locate them after the earlier plans land.

**Prior-change markers.** `[Prior: …]` names every plan (Phases 10 to 16, committed or under check) or phase (19, 19.1: PATTERNS and UI-SPEC only, no plans yet) that changes a file before Phase 17. Phase 17 plans are written against those planned outputs and must re-read the file at execution (Stage 3 plan check). Plan numbers in the "Proposed plan" column follow `17-RESEARCH.md` "Plan grouping and wave order".

`B` = `apps/backend`, `W` = `apps/csrm`.

## File Classification

### Records, contract chain and catalogue

| File | Role | Data flow | Closest analog | Quality | Proposed plan |
|---|---|---|---|---|---|
| `docs/contract-gaps/phase-17-response-rounds.md` (new) + dated amendments to `phase-16-risk-withdrawal-and-history.md`, `phase-12-ai-run-record-and-provenance.md` | doc / contract record | — | `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md` (gate fact plus narrating log); 19.1-PATTERNS row 1 | exact | 17-01 |
| `docs/contract-gaps/phase-17-participant-read.md` (new) + amendments to `phase-04-composite-release-fact.md`, `phase-13-request-assignment.md` [Prior: 13-01, 13-03], `phase-19-exports-and-export-log.md` [Prior: Phase 19, 19.1] | doc / contract record | — | `phase-04-composite-release-fact.md` ("Requestor visibility and projections") | exact | 17-01 |
| `docs/references/specification.json`, `W/src/lib/api/generated/schema.d.ts` | contract | — | 19-PATTERNS row 36 (the chain) | exact | each API plan, one owner per wave |
| both catalogue copies, `docs/references/served-operations.json` | config | — | 12-PATTERNS "`csrm-authorization.ts` + catalogue (human-only, R-08-42)" | exact | 17-04 to 17-10 |
| `B/src/csrm/conflict-reasons.ts`, `W/src/lib/api/conflict-reasons.ts` [Prior: 10-06, 10-07, 12-02, 12-03, 12-07, 12-11, 13-03, 13-05, 13-06, 14-05, 15-03, 15-10, 16-03, 16-11; Phase 19] | config (closed vocabulary) | — | 10-PATTERNS "conflict-reasons.ts … and the transport" | exact | 17-04 onward (append only) |
| `W/src/lib/api/refusal-copy.ts` (family U1 to U7) [Prior: 10-07, Phases 12, 13, 16, 19] | config | transform | itself (10-07) | exact | 17-11 |
| `CONTEXT.md` (root glossary: "Response round", "Participant") | doc | — | itself | exact | 17-15 |
| `docs/design/csrm-design-direction.md` (X-36 to X-41) [Prior: 10-01, 11-01, 12-01, 12-02, Phases 13 to 16, 19, 19.1] | doc | — | its existing X-n entries | exact | 17-12 (first task) |

### Strapi: schema

| File | Role | Data flow | Closest analog | Quality | Proposed plan |
|---|---|---|---|---|---|
| `B/src/api/csrm-assessment-round/content-types/csrm-assessment-round/schema.json`, `csrm-round-response/…`, `csrm-response-item/…` (new; no core router, no controllers) | model | CRUD | `B/src/api/csrm-ai-run/content-types/csrm-ai-run/schema.json` [Prior: 12-02] (12-PATTERNS "csrm-ai-run schema"); 19.1-PATTERNS row 2 (`csrm-notification`, unidirectional manyToOne to `idambox-user`, `draftAndPublish: false`) | exact | 17-02 |
| `B/src/api/csrm-assessment/content-types/csrm-assessment/schema.json` (mod: `sharedWithParticipantsAt`, `sharedWithParticipantsBy`, `private: true`) [Prior: 12-02/12-03 provenance attrs per 12-PATTERNS; Phase 16 per 16-PATTERNS] | model | — | 13-03's private request facts on `csrm-assessment-request/schema.json` [Prior: 13-03] | exact | 17-02 |

### Strapi: services and predicates

| File | Role | Data flow | Closest analog | Quality | Proposed plan |
|---|---|---|---|---|---|
| `B/src/api/csrm-assessment/services/assessment-participation.ts` (new: `participationOf`, parts, stage, SQL EXISTS fragments, oracle) | utility (predicate, pure + knex) | transform | `collection-scope.ts` `selectReviewQueueBucket` (oracle) + `review-queue-repository.ts` `applyBucket` (SQL twin) [Prior: 11-06, 11-10, 13-03..13-05, 13-12] — 11-PATTERNS; 19.1-PATTERNS row 27 (SQL twin of the released predicate) | exact | 17-01 (pure), 17-06 (SQL) |
| `B/src/api/csrm-assessment/services/assessment-participation-repository.ts` (new: My risk assessments list, counts, filters) | repository | CRUD (SQL read) | `review-queue-repository.ts` lines 72-123, 208-257; `request-status-summary.ts` 54-80 (19.1-PATTERNS row 21) | exact | 17-06 |
| `B/src/api/csrm-assessment/services/response-rounds.ts` (new: open, close, release-for-response readiness, carry-forward) | service | event-driven (in-transaction writes under lock) | `assessment-workflow.ts` `projectReleaseReadiness` (268) / `validateReleaseReadiness` (317) / `releaseAssessment` (509-559); 13-PATTERNS "`request-lock.ts`" and "`request-assignment.ts` (compare-and-set)" | exact | 17-01 (readiness, pure), 17-07 |
| `B/src/api/csrm-assessment/services/response-drafts.ts` (new: draft envelope parser, save, submit completeness) | utility (closed parser) + service | transform | 15-PATTERNS "`questionnaire-proposal-envelope.ts`, `proposal-items.ts`"; 10-PATTERNS "`use-answer-autosave.ts`" (expectedSavedAt concurrency) | role-match | 17-01 (parser), 17-08 |
| `B/src/api/csrm-assessment/services/response-decisions.ts` (new: batch accept/reject/restore, lapse hook) | service | batch | 15-PATTERNS "`questionnaire-proposal-decisions.ts`"; Phase 12's `ai_proposal_decisions` batch (12-PATTERNS) | exact | 17-09 |
| `B/src/api/csrm-assessment/services/risk-owner-nomination.ts` (new) | service | batch | 16-PATTERNS "`risk-curation.ts` (withdraw/reinstate, 16-05)" (guarded batch with history source) | exact | 17-05 |
| `B/src/api/csrm-assessment/services/assessment-workflow.ts` (mod: guard order `ASSESSMENT_NOT_MUTABLE` → `RESPONSE_ROUND_OPEN` → `ACTOR_IS_RISK_OWNER`; v1 release refusal; readiness "No response round open", "Responses decided") [Prior: 10-13, 10-17, 12-02..12-07, 12-11, 12-12, 12-16, 13-08, 15-08, 16-02..16-06, 16-09, 16-10] | service | request-response | 16-PATTERNS "`assessment-workflow.ts`: the guard and the two wrappers (16-04)"; RESEARCH Code Example 1 | exact | 17-05 (owner rule), 17-07 (round rule) |
| `B/src/api/csrm-assessment/services/assessment-scope.ts` (mod: participant projection, `ParticipantAssessmentDetail`, `beingPrepared` mask; `parseActiveUserSearchQuery` lower bound 2) [Prior: 10-15, 10-18, 11-07, 12-09, 13-17, 14-11, 16-05, 16-06; Phase 19 gathers the released predicate here] | utility (projection) | transform | itself: `projectReleasedAssessmentDetail`, `projectActiveUserSummary` (340-342), `parseActiveUserSearchQuery` (360-369) | exact | 17-04, 17-06 |
| Phase 19's released-assessment predicate module (mod: split into "participant may read now" and "participant and released") [Prior: Phase 19 (19 D-14), 19.1 SQL twin] | utility (predicate) | transform | 19-PATTERNS rows 18-19; 19.1-PATTERNS row 27 | exact | 17-06 |
| `B/src/api/csrm-risk/services/risk-workflow.ts` (mod: `resolveRelations` uses eligible-person for `riskOwner`, `treatmentOwner`; owner-change history source; `searchActiveUserDocuments` eligible filter) [Prior: 10-18, 12-07, 12-11, 16-04, 16-06, 16-10] | service | CRUD | itself, lines 64-78 and 238-247 (excerpt below) | exact | 17-04, 17-05 |
| `B/src/api/csrm-control-implementation/services/control-implementation-workflow.ts` (mod: `controlOwner` eligibility; accepted-proposal creation link; restore delete-if-unchanged) [Prior: 10-15, 12-11, 12-12, 12-13, 16-04] | service | CRUD | 16-PATTERNS "inner functions (16-04)" | exact | 17-05, 17-09 |
| `B/src/api/csrm-risk/services/risk-curation.ts` (mod: lapse undecided items on withdraw) [Prior: 16-05] | service | event-driven | itself (16-PATTERNS) | exact | 17-09 |
| `B/src/csrm/people/eligible-person.ts` (mod: set-level query form for search) [Prior: Phase 19.1 creates] | utility (predicate) | transform | 19.1-PATTERNS row 3 | exact | 17-04 |
| `B/src/csrm/audit/security-event-log.ts` (mod: `recordPeopleSearch`, event `csrm.people.search`) [Prior: 14-03 creates; Phase 19 extends] | utility (logger) | event-driven | itself (14-PATTERNS; 14-03) | exact | 17-04 |
| `B/src/api/csrm-assessment-request/services/request-lifecycle.ts` (mod: step `released-for-response` with `skipped` state, holder `participants`, next-action sentences) [Prior: 11-08, 11-10, 11-12, 13-15] | service (projection) | transform | itself `REQUEST_LIFECYCLE_STEPS` (13-18), `actionFor` (42-62) — 11-PATTERNS, 19.1-PATTERNS row 22 | exact | 17-07 |
| `collection-scope.ts`, `review-queue-repository.ts`, `services/my-requests.ts` (mod: stage in buckets, holder SQL) [Prior: 11-06, 11-10, 13-03..13-05, 13-12, 13-14, 13-15] | utility + repository | CRUD | themselves (11-PATTERNS, 13-PATTERNS) | exact | 17-07 |
| `B/src/api/csrm-assessment-request/services/request-assignment.ts` (mod: unassign refused after gate `ASSIGNMENT_REQUIRED`; assignee not a named owner; actor-is-owner refusal) [Prior: 13-03, 13-04; Phase 19.1 notify hook] | service | request-response | itself (13-PATTERNS "compare-and-set") | exact | 17-05 |
| Phase 16's risk history module (mod: `sourceKind` + `nomination` with `batchId`, + `response`) [Prior: Phase 16 (16-02/16-04 per 16-PATTERNS)] | service (append-only log) | event-driven | itself | exact | 17-05, 17-09 |
| Phase 19.1 `notification-kinds.ts`, `notification-projection.ts`, readability in `notification-repository.ts` (mod: `response-requested`, `response-submitted`, part `risk-owner`; readability via the participant "may read now" half, Pitfall 2) [Prior: Phase 19.1 creates] | config / repository | event-driven | 19.1-PATTERNS rows 18, 21, 22 | exact | 17-07, 17-08 |

### Strapi: AI (residual reassessment)

| File | Role | Data flow | Closest analog | Quality | Proposed plan |
|---|---|---|---|---|---|
| `B/src/csrm/ai/residual-reassessment/` (new: context part, wire, adapter, deterministic + hosted providers) | service (AI pipeline) | request-response (job) | Phase 16's risk rewrite pipeline (16-PATTERNS, plans 16-08 to 16-10); 12-PATTERNS "`prompt-sections.ts` + `assessment-context.ts`", "`assessment-draft-provider.ts` parser v2" | exact | 17-10 |
| Phase 12 run vocabulary `AI_RUN_OPERATIONS` / `ai-run-record.ts` (mod: + `residual-reassessment`) [Prior: 12-02, 12-04; 15-01..15-04; 16-01..16-03] | config | — | 12-PATTERNS "`ai-run-record.ts` and `ai-provenance.ts`" | exact | 17-10 |
| Phase 15 `proposal-job-registry.ts` (mod: target `residual:{assessmentId}`) [Prior: 15-06, 16-09] | service (registry) | event-driven | 15-PATTERNS "`proposal-job-registry.ts`" | exact | 17-10 |
| Phase 12 context builder (mod: `targetRisks` with controls and decided response items in the data block) [Prior: 12-04..12-06, 13-02, 14-10, 15-01, 16-08] | utility (builder) | transform | 12-PATTERNS "`assessment-context-loader.ts`" | exact | 17-10 |
| `B/tests/fixtures/fake-openai-compatible-server.ts` use in a new provider test | test | — | Phase 16 rewrite provider tests | exact | 17-10 |

### Strapi: routes, controllers, policy, seeds

| File | Role | Data flow | Closest analog | Quality | Proposed plan |
|---|---|---|---|---|---|
| `B/src/api/csrm-assessment/routes/*.ts` + `operations.ts` (mod or new `CSRM_RESPONSE_OPERATIONS`: risk_owners, response_rounds, close, my_response, submit, response_decisions, residual_reassessments) [Prior: 12-09..12-12, 13-08, 16-04, 16-06, 16-09] | route | request-response | `B/src/api/csrm-control-implementation/routes/csrm-control-implementation.ts` lines 1-30 (excerpt below) | exact | 17-05 to 17-10 |
| `B/src/api/csrm-assessment/controllers/csrm-assessment.ts` (mod: `releasedForOwner` → participant branch at 100-106, 167-169, 259, 283; new handlers) [Prior: 10-15, 11-07, 12-09, 12-11, 12-12, 13-08, 13-17, 16-04, 16-06, 16-09, 16-10] | controller | request-response | itself (excerpt below) | exact | 17-06 onward |
| `B/src/policies/csrm-authorization.ts` (mod: `HUMAN_ANALYST_ONLY_OPERATIONS` +4, `SERVICE_IDENTITY_REFUSED_OPERATIONS` + search, my_response) [Prior: 10-13, 12-10, 12-12, 13-03, 13-05, 13-06, 13-08, 14-09, 15-07, 15-09, 16-05, 16-09; Phase 19 creates the refusal set; 19.1] | middleware (policy) | request-response | 13-PATTERNS "`csrm-authorization.ts`"; 19.1-PATTERNS row 8 | exact | 17-04 to 17-10 |
| `B/src/keycloak/development-fixture-subjects.ts`, `idp/keycloak/import/idambox-realm.json`, `idp/README.md` [Prior: 13-07 (seed/subjects)] | config (dev fixture) | — | themselves (excerpt below; realm user lines 11-28) | exact | 17-03 |
| `B/src/bootstrap/seed-assessment-navigation-lifecycle.ts` (mod: Riley Chen persona) [Prior: 13-07 adds `sam.analyst`] | seed | CRUD | itself, Maya `reconcile` lines 47-62 (excerpt below) | exact | 17-03 |
| `B/src/bootstrap/seed-risk-register-workflow.ts` and other seeds naming Bob as `riskOwner` (Pitfall 1) | seed | CRUD | itself lines 182-185 | exact | 17-05 |

### Strapi: tests

| File | Role | Closest analog | Proposed plan |
|---|---|---|---|
| `B/tests/assessment-participation.unit.test.ts`, `response-rounds.unit.test.ts`, `response-drafts.unit.test.ts`, `residual-reassessment-adapter.unit.test.ts` (new) | test (node:test unit) | 19.1-PATTERNS row 13 (`authorization-policy.unit.test.ts` shape) | 17-01, 17-10 |
| `B/tests/response-rounds.integration.test.ts`, `participant-read.integration.test.ts`, `response-decisions.integration.test.ts`, `people-search.integration.test.ts`, `risk-owner-nomination.integration.test.ts`, `residual-reassessment.integration.test.ts`, `risk-owner-seed.integration.test.ts` (new) | test (integration) | `tests/questionnaire-workflow.integration.test.ts` (rollback at :356); 13-07's `second-analyst-seed` test | 17-03 to 17-10 |
| `B/tests/fixtures/authorization-matrix.ts` (mod: `riskOwner` seventh actor, required key) [Prior: 10-13, 11-10, 12-10, 12-12, 13-03..13-06, 13-08, 14-04, 14-06..14-09, 15-09, 16-03, 16-05, 16-09; Phase 19, 19.1] | test fixture | itself lines 28-29, 172-178 (excerpt below) | 17-06 |
| `B/tests/fixtures/matrix-provenance.ts` (mod: `riskOwner: /\bidentities\.riskOwner\b/`) | test fixture | itself lines 17-24 | 17-06 |
| `B/tests/helpers/strapi-http-harness.ts` (mod: `risk-owner` identity) [Prior: 10-11, 10-13, 10-22, 12-02..12-07, 12-12, 12-13, 13-03, 13-16; 19.1] | test helper | itself (13-16's second-analyst identity) | 17-06 |
| `B/tests/keycloak-identity.unit.test.ts` (unchanged; proves fixture parity, 278-288) | test | — | 17-03 (run only) |

### Web

| File | Role | Data flow | Closest analog | Quality | Proposed plan |
|---|---|---|---|---|---|
| `W/src/features/responses/responses-schema.ts`, `responses-service.ts`, `response-actions.ts` (new) | schema / typed service / Server Actions | request-response | 19.1-PATTERNS rows 43-45 (`access-schema.ts`, `access-service.ts`, `request-actions.ts:1-45`) | exact | 17-11 |
| `W/src/features/responses/responses-domain.ts` (new, zod-free: completeness, parts, summary counts) | utility | transform | 10-PATTERNS "`questionnaire-workflow-rules.ts` (D-22 predicates)"; registration in `parser-free-modules.ts` | role-match | 17-11 |
| `round-panel.tsx`, `participants-section.tsx`, `response-items.tsx` (new, server-rendered parts) | component | request-response | `W/src/components/csrm/detail-section.tsx`; 16 §2 `AI proposals` section [Prior: 16-12..16-14] | role-match | 17-12, 17-13 |
| `response-form.tsx` (new client island, `next/dynamic`, autosave, phone sheet) | component | event-driven (autosave) | 10-PATTERNS "`use-answer-autosave.ts`" + "`navigation-guard.tsx`" | exact | 17-13 |
| `decision-form.tsx`, `nomination-sheet.tsx` (new, on demand) | component | request-response | Phase 16 decision rows/toasts (16-PATTERNS; 16-11, 16-14); 13-PATTERNS assignment sheet (X-13) | exact | 17-12 |
| `W/src/features/assessments/owner-combobox.tsx` → X-40 people picker (mod: two-character rule, eligibility caption) [Prior: 10-08, 10-18, 10-20] | component | request-response | 10-PATTERNS "`relation-picker.tsx` (D-28, X-2)" | exact | 17-04 (rule), 17-12 |
| `W/src/features/assessments/assessment-schema.ts`, `assessment-service.ts`, `assessment-actions.ts` (mod: participant detail union, stage, parts, readiness) [Prior: schema 10-13..10-21, 11-06, 11-07, 12-09, 12-14, 12-15, 12-17, 13-08, 13-12, 13-17, 14-10, 14-11, 16-06, 16-07; service 10-13..10-15, 11-06, 11-07, 11-12, 11-13, 11-19, 12-09, 12-10, 13-12, 13-13, 15-13, 16-11; actions 10-02, 10-07, 10-13, 10-14, 10-18, 12-10, 12-13, 13-04, 15-13, 16-11] | schema / service | request-response | themselves (`getReleasedAssessment` already parses both actor branches) | exact | 17-06 (same plan as server shape, 06.9 lesson), 17-11 |
| `assessment-editor.tsx`, `risk-editor.tsx` (mod: panels, pause, reassess controls) [Prior: editor 10-02, 10-15, 10-18..10-21, 11-04, 12-15..12-17, 13-18, 16-14; risk 10-02, 10-19, 10-20, 12-16, 12-17, 16-11, 16-14] | component | — | themselves; 16-PATTERNS editor order (16 §1) | exact | 17-12 |
| `released-assessment.tsx` → stage-aware participant view; `app/(app)/app/assessments/[documentId]/page.tsx` [Prior: view 10-02, 10-15, 11-04, 11-07, 12-15, 13-18; page 10-02, 10-15, 10-18, 10-19, 12-15, 13-18, 16-14; Phase 19 header actions and report loader] | component / route | request-response | themselves | exact | 17-06 (parser), 17-13 |
| `app/(app)/app/assessments/page.tsx`, `features/assessments/assessment-list.tsx` (My risk assessments: stage, part, filters) [Prior: 11-04, 11-07] | route / component | request-response | 11-PATTERNS "`assessment-list.tsx` (C1, C2 columns)" | exact | 17-13 |
| `W/src/components/csrm/status-badge.tsx` (mod: stage, response, proposal, citation families) [Prior: 11-01, 11-21, 12-16, 12-18, 14-13, 15-11, 16-12; Phase 19 parity] | config (one mapping) | transform | 11-PATTERNS "`status-badge.tsx` and `request-domain.ts`" | exact | 17-12 |
| Requestor Home and analyst Home sections (`features/home/*`, `app/(app)/app/page.tsx`) [Prior: 11-02, 11-12, 11-18, 13-15] | component | request-response | 11-PATTERNS "`app/(app)/app/page.tsx` (Home)" | exact | 17-13 |
| `W/src/config/navigation/navigation.ts` + `navigation-counts.ts` (awaited-response count) [Prior: 10-01, 10-08, 11-02, 11-04..11-06, 11-13, 11-19, 11-20, 12-19, 13-07..13-09, 13-13, 14-12, 14-13, 14-17, 15-14, 16-15] | config | — | 11-PATTERNS "`navigation.ts`" and "`navigation-counts.ts`" | exact | 17-13 |
| request lifecycle stepper (`skipped` state) [Prior: 11-08..11-12] | component | — | 11-PATTERNS "`request-lifecycle-stepper.tsx` (compact variant)" | exact | 17-13 |
| `W/src/lib/auth/development-session-adapter.ts`, `W/src/lib/capabilities/development-capabilities.ts` (persona `Payroll Manager`) [Prior: 10-01, 13-07; 19.1 `notification:read`] | config (dev) | — | 13-07's Second Security Analyst entries | exact | 17-03 |
| `W/src/features/contract-response-parity.test.ts`, `contract-operation-chain.test.ts`, `zod-client-boundary.test.ts` | test | — | themselves (19.1-PATTERNS row 55) | exact | each API plan |

### Playwright

| File | Role | Closest analog | Proposed plan |
|---|---|---|---|
| `W/e2e/risk-owner-journey.spec.ts` (new, one `@journey` test, slice functions over `JourneyRecords`) | test (E2E) | `W/e2e/assessment-navigation-lifecycle.spec.ts` (multi-context pattern, 173-174); RESEARCH Code Example 4 | 17-14 |
| `W/e2e/response-stage.spec.ts` (new) | test (E2E) | same | 17-15 |
| `W/e2e/helpers/strapi-api.ts`, `helpers/journey-guards.ts` (new) | test helper | none in-repo (see No Analog) | 17-14 |
| `W/e2e/helpers/navigation.ts` (`SignInRole` + `'Payroll Manager'`) [Prior: 10-01, 11-02, 11-05, 11-06, 11-13, 11-20, 13-07, 14-12, 14-13, 14-17] | test helper | itself line 4 | 17-03 |
| `W/playwright.config.ts` (mobile `testMatch` + both specs) [Prior: most of 10-xx, 11-06, 12-02, 12-19, 14-03, 14-12, 14-17, 15-14, 16-15] | config | itself lines 186-196 (excerpt below) | 17-14 |
| `W/e2e/production-hardening.spec.ts` (`fixtureEmails` + persona, line 602) | test | itself | 17-03 |
| `W/e2e/risk-register-workflow.spec.ts` (Bob-as-owner edit, Pitfall 1); other deliberately changed specs (My risk assessments heading, stepper, readiness, header) | test | themselves | 17-05, 17-15 |

## Pattern Assignments (only what earlier maps do not already give)

### `assessment-participation.ts` (predicate, pure + SQL, one oracle)

**Analog:** Phase 11's queue oracle and its SQL twin (11-PATTERNS; `selectReviewQueueBucket` / `applyBucket`), plus 19.1-PATTERNS row 27 for the released predicate's knex twin. Pattern 1 in RESEARCH: export a pure `participationOf(viewer, assessment)` and `participantExistsSql(knex, viewerId)`; an integration test runs both over the same fixtures and asserts equality. Read the gate fact `sharedWithParticipantsAt` directly (06.8 posture), never rounds. Use raw-knex link-table names resolved from metadata (Pitfall 5, Strapi shortens identifiers over 55 chars) and `.transacting(trx)` (13-RESEARCH Pitfall 1).

### Controller participant branch (`csrm-assessment.ts`)

Today (lines 100-106, 167-169):
```typescript
async function releasedForOwner(ctx: RecordValue, documentId: string): Promise<RecordValue | null> {
  assertRequestorAssessmentScope(ctx.state);
  const ownerDocumentId = identityDocumentId(ctx);
  if (!ownerDocumentId) throw new AssessmentScopeError(403);
  const document = await documents().findOne(releasedAssessmentDetailQuery(ownerDocumentId, documentId));
  return isReleasedAssessmentForOwner(document, ownerDocumentId) ? document : null;
}
...
if (actor(ctx) === "requestor") {
  const released = await releasedForOwner(ctx, documentId);
  return released ? { data: projectReleasedAssessmentDetail(released) } : safeError(ctx, 404, "CSRM assessment was not found.");
}
```
Replace `releasedForOwner` with one `readableForParticipant(ctx, id)` at all three call sites (167, 259, 283); keep the 404 wording and `safeError`. Legacy (no gate) path stays "Requestor and released" (D-23). Phase 19 may already have moved these into its predicate (19-PATTERNS row 19): re-locate.

### New routes (no core router)

Copy `B/src/api/csrm-control-implementation/routes/csrm-control-implementation.ts` lines 1-30:
```typescript
const policies = (operation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation } },
];
const config: Core.RouterConfig = { type: "content-api", routes: [ {
  method: "POST", path: "/v1/risks/:riskId/control_implementations",
  handler: "api::csrm-control-implementation.csrm-control-implementation.createRiskControlImplementation",
  config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_CONTROL_IMPLEMENTATION_OPERATIONS.create) },
}, ...
```
Register `…/response_rounds/:roundNumber/close` and `…/my_response/submit` before any parametrised sibling (19-RESEARCH Pitfall 1). The three new content types ship `schema.json` only; the matrix inventory proves no core route.

### People search hardening

`assessment-scope.ts` 360-369 (change `< 1` to `< 2`; one-key rule already holds):
```typescript
export function parseActiveUserSearchQuery(query: unknown): string {
  if (!isRecord(query) || Object.keys(query).length !== 1 || typeof query.search !== "string") {
    throw new AssessmentScopeError(400, "CSRM active-user search is invalid.");
  }
  const search = query.search.trim();
  if (search.length < 1 || search.length > 100) { ... }
```
`risk-workflow.ts` 238-247 (add the eligible-person set filter from 19.1's module; never `$not` over `roles`, Pitfall 4):
```typescript
return strapi.documents("api::idambox-user.idambox-user").findMany({
  filters: { accountStatus: { $eq: "active" }, displayName: { $containsi: search } },
  sort: ["displayName:asc"], limit: 20,
});
```
Projection `projectActiveUserSummary` (340-342) is already `documentId` + `displayName`: keep. Log line via 14-03's `security-event-log.ts` (RESEARCH Code Example 2). Agent refusal joins Phase 19's `SERVICE_IDENTITY_REFUSED_OPERATIONS`; matrix row `GET:/api/v1/users` moves from `everyIdentity(200)` (matrix 1093-1097) to agent 403.

### Owner relation eligibility (`risk-workflow.ts` 64-78)

```typescript
const relation = await strapi.documents(uid).findOne({ documentId: relationId });
if (!relation || ((field === "riskOwner" || field === "treatmentOwner") && relation.accountStatus !== "active")) {
  throw new RiskWorkflowError(400, "CSRM Risk reference is invalid.");
}
```
Replace the `accountStatus` check with 19.1's `isEligiblePerson` (populate roles), add `OWNER_IS_ASSIGNED_ANALYST` / `OWNER_NOT_ELIGIBLE` 409s; mirror in `control-implementation-workflow.ts` `resolveReferences` for `controlOwner`.

### Guard order (`assessment-workflow.ts` `assertMutableAssessment` 128, `withMutableAssessmentMutation` 430)

Follow 16-PATTERNS "the guard and the two wrappers (16-04)"; extend the one guard with the actor parameter, order fixed `ASSESSMENT_NOT_MUTABLE` → `RESPONSE_ROUND_OPEN` → `ACTOR_IS_RISK_OWNER` (RESEARCH Code Example 1). Lock order request-then-assessment (13-PATTERNS `request-lock.ts`; Pitfall 8). Readiness projection copies `projectReleaseReadiness` (268) shape: keys, labels, states, destinations.

### Matrix seventh caller

`authorization-matrix.ts` 28-29 and 172-178:
```typescript
export type MatrixActor = "owner" | "other" | "analyst" | "serviceAgent" | "noIdentity" | "noToken";
function everyIdentity(status: number): MatrixExpectation {
  return { owner: status, other: status, analyst: status, serviceAgent: status, noIdentity: 403 };
}
function humanAnalystOnly(status: number): MatrixExpectation {
  return { owner: 403, other: 403, analyst: status, serviceAgent: 403, noIdentity: 403 };
```
Add `riskOwner` to the union, `MATRIX_ACTORS` and as a required key in `MatrixExpectation` so TypeScript forces every row; helpers default it to the Requestor-shaped outcome; participant rows state 200 with mounted proofs.

### Development persona (17-03)

`development-fixture-subjects.ts` 14-17: add `"riley.chen@idambox.com": "5d0f1c3a-6b1e-4c2a-9f0e-1a2b3c4d5e03"` (the parameter type follows the map keys). Realm user copies Jane's block (`idambox-realm.json` 11-28, password `riley`). Seed copies Maya's `reconcile` in `seed-assessment-navigation-lifecycle.ts` 47-62 (`roles: []`, `accountStatus: "active"`) plus `...developmentFixtureSubject(...)`, behind the existing `IDAMBOX_SEED_CSRM` / `developmentIdentityEnabled()` gate (line 48). Web persona copies 13-07's Second Security Analyst entries.

### Playwright mobile project

`playwright.config.ts` 186-196: append `'**/risk-owner-journey.spec.ts'` and `'**/response-stage.spec.ts'` to the mobile `testMatch` list (Pitfall 3); `grep: /@journey/` stays.

## Shared Patterns

- **Authorisation chain:** Function → FunctionAPI in both catalogue copies, `HUMAN_ANALYST_ONLY_OPERATIONS` second refusal, birthright operations with record rules and an explicit service-identity refusal (12-PATTERNS catalogue section; 13-PATTERNS `csrm-authorization.ts`; 19.1-PATTERNS row 8). Analysts calling birthright-only `my_response` arrive as `requestor` (`csrm-authorization.ts` 272-283), which is how analyst-participants respond.
- **404 vs 403:** unreadable record → `safeError(ctx, 404, "CSRM assessment was not found.")` with persistence deep-equal; analyst on a participant-only op → 403 `NOT_A_PARTICIPANT`.
- **Closed reasons:** append to both `conflict-reasons.ts` copies and `refusal-copy.ts` (10-PATTERNS); `RELEASE_FOR_RESPONSE_NOT_READY` needs its own error schema (details closed).
- **In-transaction events:** notifications through 19.1's `notify` inside the workflow transaction (19.1-PATTERNS row 6); history rows through Phase 16's module.
- **Web typed layer:** zod schema + openapi-fetch service + `'use server'` actions that revalidate, batch actions for multi-decisions, zod-free `*-domain.ts` for client islands (19.1-PATTERNS rows 43-46; `zod-client-boundary.test.ts`).
- **G-4 UI:** Undo toasts (X-14) and decision focus from 16-PATTERNS; autosave and navigation guard from 10-PATTERNS; `next/dynamic` islands for the editor budget (11-PATTERNS quick-find trigger).

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `W/e2e/helpers/strapi-api.ts` | test helper | No spec calls Strapi directly with the dev token and `x-csrm-dev-identity` yet; use RESEARCH §L (token from `playwright.config.ts:100`, header resolved by `csrm-development-identity.ts:36-52`) |
| `W/e2e/helpers/journey-guards.ts` | test helper | New negative-case helpers; use RESEARCH §L |
| `risk-owner-journey.spec.ts` slice structure | test | No sliced single-test journey exists; use RESEARCH Code Example 4 (one `@journey` test, `JOURNEY_SLICE_BUDGETS_MS`) |

## Metadata

**Analog search scope:** earlier PATTERNS for Phases 10-16, 19, 19.1; `B/src/api/csrm-assessment`, `csrm-risk`, `csrm-control-implementation`, `B/src/keycloak`, `B/src/bootstrap`, `B/tests/fixtures`, `W/playwright.config.ts`; earlier PLAN files grepped for prior changes.
**Files scanned:** about 20 source files plus 9 PATTERNS and the Phase 10-16 plan set.
**Pattern extraction date:** 2026-10-01
