# Phase 13: Request pick-up and notes - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 58 (new and modified, grouped below)
**Analogs found:** 54 / 58
**Written ahead.** Analogs are read from today's code (`5a12215`, `post-demo`). Many target files are changed first by Phase 10, 11 or 12 plans; the "Earlier-phase owner" column names them. The Phase 13 planner writes against the **planned** state of those files, names those plans in each plan's context section, and Stage 3 re-checks before execution. Any `12-NN-PLAN.md` present is authoritative over `12-PATTERNS.md` (12-01 to 12-09 exist now).

## Earlier-phase owners of files Phase 13 edits

| File | Changed first by | What Phase 13 builds on |
|---|---|---|
| `apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts` | 10-06 | Closed conflict reasons on the revert; Phase 13 extracts the lock into `request-lock.ts` |
| `apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts` | 10-06, 11-06 | `findOne` augmentation, queue `find` with Phase 11 buckets |
| `apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts` | 11-06 | `REVIEW_QUEUE_BUCKETS`, `parseAnalystReviewQuery` |
| `apps/backend/src/api/csrm-assessment-request/services/review-queue-repository.ts` | 11-06, 11-10 | `applyCriteria`/`applyBucket`; My requests SQL |
| `apps/backend/src/api/csrm-assessment-request/services/request-status-summary.ts`, `services/my-requests.ts`, `controllers/my-requests.ts`, `routes/my-requests.ts`, `operations.ts` | 11-10 | `GET /v1/my_requests` (D-17 items gain assignee and unread) |
| `apps/backend/src/api/csrm-assessment-request/services/request-lifecycle.ts` | 11-08, 11-12 | Requestor holder sentences (UI-SPEC §12.1) |
| `apps/backend/src/api/csrm-analyst-insight/services/dashboard-summary.ts` | 11-16 | `reviewQueue` block gains `mine` and `unassigned` |
| `apps/backend/src/policies/csrm-authorization.ts` | 10-13 | `HUMAN_ANALYST_ONLY_OPERATIONS`; Phase 13 adds three URLs and a `humanAnalyst`/`viewerId` fact |
| `apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts` | 10-13, 12-05 | `latestForRequest`, `canRetry`; run linkage |
| `apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts` | 12-05, 12-07 | `actor()` flag; run creation |
| `apps/backend/src/api/csrm-assessment/services/assessment-draft-registry.ts` | 10-13 | `retry` attribution |
| `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts` | 12-02, 12-03, 12-06, 12-07 | `draftActor()`; draft generation using the context builder |
| `apps/backend/src/csrm/ai/assessment-context.ts`, `assessment-context-loader.ts`, `prompt-sections.ts` | 12-03 (new) | D-08 notes extension point (D-27) |
| `apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts` (+ controller) | 12-04 (new) | Context summary v1 parser; Phase 13 adds v2 (D-28) |
| `apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts`, `controllers/csrm-questionnaire.ts` | 11-10, 12-07, 12-08 | `generation` block; request summary gains assignee + `aiInputsChanged` |
| `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts`, `controllers/csrm-assessment.ts` | 11-07, 12-09 | Same, for the assessment |
| `apps/backend/src/csrm/conflict-reasons.ts`, `apps/csrm/src/lib/api/conflict-reasons.ts` | 10-06 (new), 12-02, 12-03, 12-07 | One closed list; Phase 13 adds its codes and documents 403 use |
| `apps/csrm/src/lib/api/refusal-copy.ts` | 10-07 (new), 12-07 (family J) | Families K, L, M |
| `docs/references/specification.json`, `apps/csrm/src/lib/api/generated/schema.d.ts` | 10-06/10/11/13/15/16/18, 11-06/07/08/10/14-17, 12-01 to 12-09 | Every operation |
| Both catalogue copies, `served-operations.json`, `apps/backend/tests/fixtures/authorization-matrix.ts` | 10-13, 11-10, 11-21 (catalogue) | Three new Functions, matrix rows |
| `apps/csrm/src/config/navigation/navigation.ts`, `components/shell/capability-navigation.tsx` | 10-08, 11-02, 11-04, 11-05, 11-13 | Assigned to me item and counts (UI-SPEC §1) |
| `apps/csrm/src/features/home/analyst-home.tsx`, `requestor-home.tsx`, `requestor-home-service.ts`, `requestor-home-presentation.ts`, `own-requests-panel.tsx` | 11-02, 11-12, 11-18 | Tile 1, new-notes row, assignee on items |
| `apps/csrm/src/features/analyst-dashboard/*` (schema, presentation, widget) | 11-02, 11-03, 11-12, 11-13, 11-16, 11-17, 11-18 | `Assigned to you` group (§3) |
| `apps/csrm/src/features/requests/request-hub.tsx` | 10-04, 10-14, 11-08, 11-09 | `Owner` → `Requestor`, `Assigned to`, `Notes` rows |
| `apps/csrm/src/features/requests/request-schema.ts`, `request-domain.ts`, `request-service.ts` | 11-08, 11-09, 11-10, 11-11, 11-12, 11-13, 11-19 | Parsers and services for the new blocks |
| `apps/csrm/src/features/requests/request-table.tsx` | 11-11 | My requests column `Security Analyst`, unread line, `Notes` filter |
| `apps/csrm/src/features/assessments/assessment-list.tsx`, `assessment-schema.ts`, `assessment-service.ts` (review queue table) | 11-06, 11-07 | `Assigned to` column, `Pick up`, filters |
| `apps/csrm/app/(app)/app/review/requests/page.tsx` (+ loading, error), `review/requests/[documentId]/page.tsx`, `app/requests/[documentId]/page.tsx` | 10-02, 11-03, 11-04, 11-09 | New `review/assigned` route copies these |
| `apps/csrm/src/features/quick-find/quick-find-domain.ts`, `quick-find-dialog.tsx` | 11-14, 11-19, 11-20 | Line 2 gains assignee |
| `apps/csrm/src/components/csrm/local-time.tsx`, `lib/time/format-instant.ts` | 10-01 (new) | Every note/assignment time |
| Navigation guard (unsaved-text) | 10-08 (new) | Composer and picker reason guard |
| `apps/csrm/e2e/helpers/navigation.ts`, `e2e/helpers/requests.ts`, sign-in helpers | 11-05, 11-06, 11-12, 11-13, 11-20, 11-21 | Second analyst sign-in, Assigned to me helper |
| Affected specs: `navigation-and-home.spec.ts`, `analyst-insights.spec.ts`, `assessment-navigation-lifecycle.spec.ts`, `review-lists.spec.ts`, `requestor-request-workflow.spec.ts` | 11-03, 11-05, 11-06, 11-08 | Label changes (Pitfall 7) |
| `docs/design/csrm-design-direction.md` | 10-01 (X-1..X-5), 11 first plan (X-6..X-10), 12-01 (X-11..X-14) | Phase 13 records X-15..X-18 |
| `apps/backend/tests/request-workflow.integration.test.ts` | 11-08 | D-04 populate leak test |
| `apps/backend/tests/review-queue-buckets.integration.test.ts`, `review-queue.unit.test.ts` | 11-06 | `open` bucket, assignee/unread oracle |

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `docs/contract-gaps/phase-13-request-assignment.md` | doc | — | `docs/contract-gaps/phase-06.1-revert-audit-facts.md` | exact |
| `docs/contract-gaps/phase-13-request-notes.md` | doc | — | `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`; `phase-12-ai-run-record-and-provenance.md` (12-01) | exact |
| `apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json` (+4 attrs) | model | CRUD | same file, `revertedBy` (lines ~76-85) | exact |
| `apps/backend/src/api/csrm-request-note/content-types/csrm-request-note/schema.json` (+ read-state type, own folder or same api) | model | CRUD | `csrm-ai-run` schema (12-04); request schema relations | role-match |
| `.../csrm-assessment-request/services/request-lock.ts` (new, extracted) | utility | transaction | `services/request-workflow.ts` lines 63-83 | exact |
| `.../services/request-people.ts` (new) | utility | transform | `controllers/csrm-assessment-request.ts` `findOne` lines 112-133 | role-match |
| `.../services/request-assignment-policy.ts` (new) | service (pure) | transform | `policies/csrm-authorization.ts` lines 9-14, 158, 278 | role-match |
| `.../services/request-assignment.ts` (new) | service | CRUD (compare-and-set) | `request-workflow.ts` `revertRequestToDraft` lines 85-120 | exact |
| `.../services/assignment-log.ts` (new); `csrm-request-note/services/note-ai-input-log.ts` | utility | transform | `csrm-questionnaire/services/questionnaire-governance-log.ts` | exact |
| `.../routes/request-assignment.ts` (or in core route file) | route | request-response | `routes/csrm-assessment-request.ts` lines 84-101 (`revertToDraftRoute`); `routes/my-request-status-summary.ts` | exact |
| `.../controllers/csrm-assessment-request.ts` (assignment handlers, `findOne` populate filter, `delete` refusal, D-20) | controller | request-response | same file `revertToDraft` lines 187-206 | exact |
| `.../operations.ts` | config | — | same file | exact |
| `csrm-request-note/services/request-notes-policy.ts`, `request-notes.ts`, `controllers/request-notes.ts`, `routes/request-notes.ts`, `operations.ts` | service/controller/route | CRUD | assignment analogs above + `routes/my-request-status-summary.ts` (separate router, no core router) | role-match |
| `review-queue-repository.ts`, `collection-scope.ts` | service | CRUD (SQL predicates) | same files; `request-status-summary.ts` lines 72-79 | exact |
| `request-status-summary.ts`, `my-requests.ts` (11-10) | service | CRUD | same | exact |
| `request-lifecycle.ts` | service | transform | same (11-08 shape) | exact |
| `csrm-analyst-insight/services/dashboard-summary.ts` | service | CRUD | same (11-16 shape) | exact |
| `policies/csrm-authorization.ts` | middleware | request-response | same, lines 41-49, 278-281 | exact |
| Job registries + workflows (4 files) | service | event-driven (in-process jobs) | same, `authorize` line 20, `actor()` line 15, `draftActor()` line 822 | exact |
| Phase 12 context builder/loader, `ai-run-record.ts` | service | transform | 12-03 / 12-04 planned modules; `prompt-data.ts` `promptDataTag` | exact (planned) |
| `questionnaire-scope.ts`, `assessment-scope.ts` + controllers | service | transform | same (12-08, 12-09 shape) | exact |
| `apps/backend/src/csrm/conflict-reasons.ts` | config | — | same (10-06) | exact |
| `apps/backend/src/bootstrap/seed-assessment-navigation-lifecycle.ts` (second analyst) | config/seed | batch | same, lines 46-63 (Maya) | exact |
| Both catalogue copies, `specification.json`, `served-operations.json`, matrix fixture | config | — | `function.risk_assessment_requests.revert_to_draft_api` entries | exact |
| `apps/backend/tests/request-assignment.{unit,integration}.test.ts`, `request-notes.{unit,integration}.test.ts` | test | — | `request-workflow.integration.test.ts`, `questionnaire-governance-log` unit tests, `authorization.integration.test.ts` 734-746 | role-match |
| `apps/csrm/src/features/requests/request-assignment-{schema,service,actions,domain}.ts` (or `features/request-assignment/`) | service / action | request-response | `features/requests/request-service.ts` 277-287; `request-actions.ts` 1-40, 77-83 | exact |
| `apps/csrm/src/features/requests/request-notes-{schema,service,actions,domain}.ts` | service / action | request-response | same | exact |
| `assignment-block.tsx`, `assign-picker.tsx`, `queue-pick-up-button.tsx`, `assignment-history.tsx` | component (client) | request-response, optimistic | `features/requests/request-workflow-actions.tsx` 1-30; quick-find dialog (11-19) for Command+debounce | role-match |
| `notes-section.tsx`, `note-item.tsx`, `note-composer.tsx`, `unread-marker.tsx`, `notes-summary.tsx` (server) | component | request-response | `request-workflow-actions.tsx`; `revert-audit-summary.tsx` (10-01) for server summary | role-match |
| `apps/csrm/app/(app)/app/review/assigned/page.tsx` (+ loading, error) | route (page) | request-response | `app/(app)/app/review/requests/page.tsx` (+ loading/error) | exact |
| `navigation.ts`, Homes, dashboard widget, hub, request table, queue list, quick find | component/config | transform | same files (planned state) | exact |
| `apps/csrm/src/lib/auth/development-session-adapter.ts`, `role-switcher.tsx`, `development-capabilities.ts` | config | — | same, lines 20-32 (`Secondary Requestor`) | exact |
| `apps/csrm/e2e/request-pick-up.spec.ts`, `request-notes.spec.ts` | test | — | `e2e/assessment-navigation-lifecycle.spec.ts` (Maya refusal) | role-match |
| `docs/design/csrm-design-direction.md` (X-15..X-18), root `CONTEXT.md` glossary (Note, Assigned analyst) | doc | — | 12-01 Task 1 | exact; glossary is a shared file (orchestrator) |
| `docs/security/phase-08-residual-risks.md`, `.planning/phases/08-*/08-SECURITY.md` (O-5, R-08-36, R-08-37 lines) | doc | — | existing entries | exact |

## Pattern Assignments

### `request-lock.ts` (utility, transaction) — extract, do not copy twice

**Analog:** `apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts` lines 63-83
```ts
async function serializeRequestRevert<T>(documentId: string, work: () => Promise<T>): Promise<T> {
  const previous = requestRevertTails.get(documentId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  requestRevertTails.set(documentId, tail);
  await previous;
  try { return await work(); }
  finally { release(); if (requestRevertTails.get(documentId) === tail) requestRevertTails.delete(documentId); }
}
async function lockRequest(strapi: WorkflowStrapi, documentId: string, transaction: unknown): Promise<void> {
  const query = strapi.db.queryBuilder("api::csrm-assessment-request.csrm-assessment-request");
  query.select(["id"]); query.where({ documentId }); query.forUpdate(); query.transacting(transaction);
  await query.execute<unknown>();
}
```
Combine into `withRequestLock(strapi, requestId, work(trx))` (RESEARCH "The shared lock"); `revertRequestToDraft` switches to it (one tail map). Raw knex inside must `.transacting(trx)` (Pitfall 1). 10-06 edits this file first.

### `request-assignment.ts` (service, compare-and-set)

**Analog:** `request-workflow.ts` `revertRequestToDraft` lines 85-120: parse body outside the lock, then lock, `documents.findOne` with populate, guards that throw `AssessmentRequestWorkflowError(msg, 409)`, then one `requests.update({ documentId, data: {...facts}, populate })`. Phase 13 order of guards per RESEARCH §E step 3 (requestor check first, Pitfall 5). Replace `populate: { revertedBy: true }` with the `request-people.ts` projection.

### `assignment-log.ts`, `note-ai-input-log.ts` (closed versioned logs)

**Analog:** `apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts`
- header comment lines 1-19 (never read by authorisation, only writer is the appender);
- constants lines 23-24 (`SCHEMA_VERSION = 1`, `MAX_ENTRIES = 1_000`; AI-input log 200);
- closed exact-key event parser lines ~103-121 (`exactKeys`, `boundedString`, `instant`, frozen copy);
- `parseGovernanceLog` (null → `[]`, over cap → error) and `appendGovernanceEvent` (new array) lines ~127-140;
- `MAX_REASON_LENGTH = 500` line 58.
Read paths catch the error and project "history unavailable" (UI-SPEC §5.3 fail safe); at the cap the write is refused with `HISTORY_UNAVAILABLE`.

### Custom routes (assignment, notes, AI mark)

**Analog:** `routes/csrm-assessment-request.ts` lines 84-101
```ts
const revertToDraftRoute = {
  method: "POST",
  path: "/v1/assessment_requests/:requestId/revert_to_draft",
  handler: "api::csrm-assessment-request.csrm-assessment-request.revertToDraft",
  config: { policies: ["global::csrm-app-enabled",
    { name: "global::csrm-authorization", config: { operation: CSRM_ASSESSMENT_REQUEST_OPERATIONS.revertToDraft, requireRequestOwnership: true } }] },
};
```
- Assignment routes: grant only, **no** `requireRequestOwnership` (the analyst path returns early anyway; `OWN_REQUEST` is decided in the service).
- Notes routes: grant only, record rule in the controller → 404 (RESEARCH Pattern 2, Pitfall 3). For a new `csrm-request-note` api folder with no core router, copy the standalone router shape of `routes/my-request-status-summary.ts` (type `content-api`, `auth: { strategies: ["content-api-token"] }`, policies) and give the folder no core `routes/csrm-request-note.ts` (D-02).
- Operation constants in `operations.ts` beside `revertToDraft: "POST:/api/v1/assessment_requests/{requestId}/revert_to_draft"`.

### Controller handlers

**Analog:** `controllers/csrm-assessment-request.ts` `revertToDraft` lines 187-206 (actor from `ctx.state.idamboxUser?.documentId`, service call, `sanitizeOutput`/`transformResponse`, map `error.status === 409 ? denyConflict : denyBadRequest`). Add a 403 path using `ctx.forbidden(message, { reason })` (RESEARCH §C) and a 404 path. Helpers `denyBadRequest`/`denyConflict` lines 43-53 (10-06 adds reason-carrying variants; extend them, do not fork).
**`findOne` (D-04):** lines 112-133 — filter `ctx.query.populate` to the allow-list before `super.findOne` (pattern `safePopulate` in `collection-scope.ts` 136-142), then add `assignment`, `notes`, `aiInputs`, projected `revertedBy` beside `requestor`, `relationships`, `lifecycle`. Remove `revertedBy` from the web's populate in `request-service.ts` line 78.

### `csrm-authorization.ts`

**Analog lines:** 41-49 (`HUMAN_ANALYST_ONLY_OPERATIONS` with comment block 18-40 to extend for the three URLs), 278-281 (the human-only deny), 184 (`requestorId: user.id`, to expose as `viewerId` for the analyst scope), 9-14 (role names: export them or a predicate for `request-assignment-policy.ts` rather than duplicating literals). Mirror in `apps/backend/tests/fixtures/authorization-matrix.ts` (~line 75).

### Queue SQL (`review-queue-repository.ts`, `collection-scope.ts`)

**Analog:** `applyBucket` lines 136-168 (switch with `never` default) and `applyCriteria` 174-186; link-table join from `request-status-summary.ts` 72-79:
```ts
.from("csrm_assessment_requests as r")
.join("csrm_assessment_requests_requestor_lnk as o", "o.csrm_assessment_request_id", "r.id")
.where("o.idambox_user_id", requestorId)
```
Add `case "open": return;` (statuses only, `REVIEWABLE_REQUEST_STATUSES` from `collection-scope.ts` 45-52), `assignedTo`/`unassigned` `whereExists` predicates and the unread `EXISTS` (RESEARCH "Queue and count SQL", "Assignee predicates"). Bucket list and parser in `collection-scope.ts` as 11-06 leaves them; oracle `selectReviewQueueBucket` in `review-queue.unit.test.ts`.

### Job registries (D-18)

**Analog:** `questionnaire-generation-registry.ts` line 20 `authorize`; `questionnaire-generation-workflow.ts` line 15 `actor()` returns `canReadAllQuestionnaireGenerationJobs: false`; `assessment-workflow.ts` line 822 `canReadAllDraftJobs: false`. Change the flag to a policy-set fact; in each `retry` set `job.initiatingAnalystDocumentId = actor.documentId` before `launch` (RESEARCH "Retry attribution"). 10-13 and 12-05 change these files first.

### Schema attributes

**Analog:** request `schema.json` `revertedBy` (manyToOne `api::idambox-user.idambox-user`, no `inversedBy`) and `revertedAt` (datetime). New note types: `draftAndPublish: false`, relations with no `inversedBy` (RESEARCH §A table).

### Second analyst persona

**Analog:** `seed-assessment-navigation-lifecycle.ts` lines 46-63 (`IDAMBOX_SEED_CSRM` + `developmentIdentityEnabled()` gate, `reconcile(userService, { email }, {...})`); give it the Security Analyst role (Maya has `roles: []`). Web: `development-session-adapter.ts` lines 20-32 add a `DevelopmentRole` case and email; `role-switcher.tsx`, `development-capabilities.ts`. No Keycloak fixture subject (D-31).

### Web service + Server Action

**Analog:** `apps/csrm/src/features/requests/request-service.ts`
- imports lines 1-33 (`'server-only'`, `createStrapiClient`, `normalizeTransportError`, `TransportResult`);
- call shape lines 277-287:
```ts
export async function revertRequestToDraft(documentId: string, reason: string): Promise<TransportResult<RequestRevertResult>> {
  try {
    const input = requestRevertSchema.parse({ documentId, reason });
    const client = await createStrapiClient();
    const { data, error, response } = await client.POST('/v1/assessment_requests/{requestId}/revert_to_draft', {
      params: { path: { requestId: input.documentId } }, body: { reason: input.reason },
    });
    if (error || !data) return normalizeFailure(error, response.status);
    return { data: requestRevertResponseSchema.parse(data).data, error: null };
  } catch (error) { return normalizeFailure(error); }
}
```
- register each parser in `contractResponseParsers` (lines ~260-275) for the parity guard.
**Action analog:** `request-actions.ts` lines 1-13 (`'use server'`, `revalidatePath`) and 77-83 (`safeParse` → service → `revalidate…` → `{ ok }`). Return the closed reason (not just status) so refusal copy families K/L/M apply; 10-06/10-07 transport keeps reasons — add a 403 case (A4).

### Client components (optimistic, Undo)

**Analog:** `request-workflow-actions.tsx` lines 1-30 (`'use client'`, `useRouter`, `toast` from `sonner`, Server Action import, zod-free — the comment at 16-21 is the zod-client-boundary rule). Undo toast is X-14 (12-01, used by Phase 12 decision UI); side sheet X-13. Picker search/debounce: 11-19's `quick-find-dialog.tsx` (Command + latest-result-wins).

### New `review/assigned` route

**Analog:** `apps/csrm/app/(app)/app/review/requests/page.tsx`, `loading.tsx`, `error.tsx` as 11-03/11-04 leave them, with a fixed `filters[assignee]=me` and default `open` queue.

## Shared Patterns

- **Errors with closed reasons:** `apps/backend/src/csrm/conflict-reasons.ts` + `apps/csrm/src/lib/api/conflict-reasons.ts` (10-06; 12-02/03/07 extend) and `refusal-copy.ts` (10-07; 12-07 family J). Apply to every new route and action.
- **People projection:** `{ documentId, displayName }` only (D-04); seed from `findOne` lines 125-127 (`requestor: { displayName }`).
- **Human-only twice:** grant to `role.security_analyst` + `HUMAN_ANALYST_ONLY_OPERATIONS` + matrix mirror.
- **Contract chain:** spec → `api:generate` → parity parser → catalogue (both copies, byte-identical) → `served-operations.json` → matrix row, in one plan per operation set (11-10 is the closest whole-chain plan to copy).
- **Times:** `LocalInstant` / `formatInstant` (10-01).

## No Analog Found

| File | Role | Reason |
|---|---|---|
| Unread read-state upsert under the lock | service | No per-person state entity exists; follow RESEARCH §A/§E |
| Notes thread with optimistic pending item and sessionStorage draft | component | No chat-like UI exists; RESEARCH + UI-SPEC §8-9, guard from 10-08 |
| Context summary v2 notes section | service | Phase 12's v1 is itself planned (12-04); copy its parser posture |
| D-29 "AI inputs changed" signal | service | New set-difference over run summaries; RESEARCH "Notes in the AI context" |

## Metadata

**Search scope:** `apps/backend/src/{api,policies,bootstrap,csrm}`, `apps/backend/tests`, `apps/csrm/src/{features,lib,components}`, `apps/csrm/app`, `apps/csrm/e2e`, `.planning/phases/10-*`, `11-*`, `12-*` plan frontmatter.
**Analogs verified tracked:** all named paths are under tracked `apps/` and `docs/` (no mirrors).
**Date:** 2026-10-01
