---
phase: 3
slug: dynamic-questionnaire-workflow
status: complete
researched: 2026-08-30
requirements: [QUES-01, QUES-02, QUES-03, QUES-04, QUES-05]
---

# Phase 3 — Dynamic Questionnaire Workflow Research

## Research outcome

Phase 3 can be delivered without changing either Strapi content-type schema. The safest design is to implement the catalogue's existing questionnaire-specific `/api/v1` operations, derive ownership and workflow state through `CsrmQuestionnaire.assessmentRequest`, and persist a versioned answer envelope in each `CsrmQuestion.answer` JSON field. A shared web renderer can support Requestor editing and Security Analyst read-only review from the same normalized model.

The current repository already supplies nearly every infrastructure pattern required: mounted HTTP authorization tests, identity and FunctionAPI enforcement, owner-scoped request controllers, typed `openapi-fetch` services, server actions, RHF/Zod forms, reusable state/composite components, and dual-server Playwright.

## Contract facts and gaps

### Persisted model

- `apps/strapi/src/api/csrm-questionnaire/content-types/csrm-questionnaire/schema.json` contains header data plus one assessment-request relation and one-to-many questions. It has no questionnaire status or submitted timestamp.
- `apps/strapi/src/api/csrm-question/content-types/csrm-question/schema.json` contains `questionText`, `answerType`, `options`, `answer`, and questionnaire relation. It also currently exposes `helpText`, `order`, and `reviewComment`, but the operator has locked Phase 3 grouping, ordering, requiredness, and conditionality to the `options` JSON convention. Plans must not depend on the extra fields for those semantics.
- `CsrmAssessmentRequest.requestStatus` contains `submitted` and `questionnaire-in-progress`; there is no dedicated persisted questionnaire lifecycle state.
- The JDL likewise defines no questionnaire lifecycle field. Inventing one in a schema would violate both the operator constraint and the source model.

### API and capability contract

- `docs/references/specification.json` currently exposes generic `/csrm-questionnaires` and `/csrm-questions` CRUD operations.
- Both byte-identical Role/Function/FunctionAPI catalogues already describe the intended workflow routes: `GET /api/v1/my_questionnaires`, `GET /api/v1/questionnaires/{questionnaireId}`, `GET /api/v1/questionnaires/{questionnaireId}/questions`, `PATCH /api/v1/questionnaires/{questionnaireId}/answers`, and `POST /api/v1/questionnaires/{questionnaireId}/submit`, plus analyst list/review operations.
- Implementing those custom routes is preferable to overloading generic question PUT calls: draft save and submit need server-side, questionnaire-wide validation and an all-or-nothing answer-state transition.
- The OpenAPI document must therefore be extended for the served Phase 3 custom routes and the generated web schema refreshed with `pnpm api:generate`; `pnpm api:check` must remain green. Generic CRUD routes must still receive the established `csrm-app-enabled` + `csrm-authorization` treatment or be deliberately narrowed so they cannot bypass the workflow routes.

## Recommended JSON convention

Document the convention in `docs/contract-gaps/phase-03-questionnaire-json-contract.md`. Use an explicit version so future AI-generated questions can evolve without guessing shapes.

### `options` version 1

Each question's `options` is a closed Zod-discriminated definition with this common metadata:

- `schemaVersion: 1`
- `questionKey: string` — stable questionnaire-local identifier used by conditions and RHF field mapping; unique within a questionnaire.
- `section: { key: string; title: string; description?: string; order: number }`
- `order: number` — question order within the section; do not use the persisted `order` field for Phase 3 semantics.
- `required: boolean`
- `visibility?: { questionKey: string; operator: "equals" | "notEquals" | "includes" | "notIncludes"; value: string | boolean }`
- `choices?: Array<{ value: string; label: string }>` — required only for Single select and Multi select; values must be unique.

Zod must cross-check the persisted `answerType` against the allowed metadata: choice types require non-empty choices, non-choice types reject choices, conditions may only target an earlier question, target keys must exist, section/question order must be deterministic, and cyclic/forward conditions must fail parsing. Unknown schema versions fail closed into the error state, never a best-effort form.

### `answer` version 1

Persist an envelope per question:

- `schemaVersion: 1`
- `value: string | boolean | string[] | null`, narrowed by `answerType`; Date uses an ISO `YYYY-MM-DD` string.
- `state: "draft" | "submitted"`
- `updatedAt: string` — server-owned ISO timestamp.
- `submittedAt?: string` — server-owned and present only for submitted answers.

Do not accept client-owned timestamps or state on the draft endpoint. The server writes `draft`; the submit endpoint revalidates the entire current response set and stamps all active answers as `submitted` in one transaction. Hidden answers should be cleared during authoritative save/submit normalization so stale sensitive data does not remain reviewable when its controlling answer changes.

### Derived questionnaire state

- `not-started`: no active answer envelope has a value.
- `draft`: at least one active answer exists and no submitted batch is complete.
- `submitted`: all active answer envelopes have `state: submitted` with the same server submission timestamp.

The owning request is answerable only in `submitted` or `questionnaire-in-progress`. The first accepted draft save advances `submitted` to `questionnaire-in-progress`; later draft saves remain there. Submission stamps the answer batch and remains distinguishable from an editable draft through the submitted envelopes. Phase 4 may decide the subsequent request transition; Phase 3 should not misuse `risk-assessment-drafted` before an assessment draft exists.

## Backend architecture

### Authorization and ownership

Follow `apps/strapi/src/api/csrm-assessment-request/operations.ts`, routes, controller, collection-scope service, and `apps/strapi/src/policies/csrm-authorization.ts`.

- Add exact questionnaire/question operation constants, including the custom catalogue URLs.
- Extend `csrm-authorization` with generic resource configuration rather than embedding authorization in JSX or trusting client filters. For questionnaire routes, load the questionnaire with `assessmentRequest.requestor`; Requestor ownership is equality with `ctx.state.idamboxUser.documentId`, while Security Analyst/Agent grants permit all.
- For question routes, load `question.questionnaire.assessmentRequest.requestor`; never trust a supplied questionnaire relation or owner filter.
- Set a typed questionnaire actor/scope in `ctx.state.csrmAuthorization` so controllers can enforce mutation rules without reinterpreting roles.
- Collection reads overwrite hostile Requestor filters with the owner predicate and use bounded allowlisted populate/sort/pagination, as `collection-scope.ts` does for requests.
- Answer mutations allowlist only `{ answers: [{ questionKey, value }] }`; the server resolves question records from the authorised questionnaire. Requestors cannot change question text, type, options, relations, review comments, workflow state, or timestamps.
- Analysts are read-only for Phase 3 responses unless a separately granted, explicitly scoped review operation is implemented. QUES-05 does not require comment editing or review completion.

### Controller/services

Create focused pure services under the questionnaire/question APIs:

- definition parser and question ordering/conditional graph validation;
- response visibility/progress/required validation;
- collection/detail scope query builder;
- draft normalization and request-state transition;
- atomic submit transaction and submitted response projection.

Controllers remain thin: validate path/body, call services using `strapi.documents`, sanitize/transform output, and map malformed input to 400, unauthorized ownership to 403, missing records to 404, and non-answerable/submitted conflicts to 409. Do not return raw internal errors or answer contents in logs.

### Catalogue and development permissions

- Update both catalogue files in the same task and assert byte equality by hash/content test.
- Ensure every served custom route has an exact FunctionAPI string and role assignment. Reuse the existing questionnaire functions rather than creating competing domain functions. If generic CRUD remains served, add only the minimum API-only grants needed and prevent Requestor create/delete/definition update.
- Add only questionnaire/question read and answer-route actions to `DEVELOPMENT_CONTENT_API_ACTIONS`. Preserve the existing `api::csrm-` prefix guard and never add application/role/function/function-api/idambox-user actions.

## Development seed

Add a dedicated seed module called from `src/index.ts` after core CSRM data is available. Gate it with the same development intent as existing fixtures: `IDAMBOX_SEED_CSRM=true` plus the development identity gates where browser workflow data is involved. It must be idempotent by stable unique business keys, not record counts.

Seed:

- a submitted assessment request owned by Jane with a stable request number/title;
- questionnaire `QUES-DEV-001` related to that request;
- realistic sections such as Service context, Data and privacy, Hosting and access, and Third parties;
- all rendered answer types except File upload;
- at least one Boolean or Single-select controller and one dependent required question;
- deterministic `questionKey`, section/order metadata, and null answers.

On rerun, update fixture definitions and relations by stable keys and do not duplicate questions. The seed should leave production unchanged when gates are off.

## File upload scope decision

Defer File upload rendering in Phase 3. The repository has no authoritative upload endpoint, media ownership rule, storage policy, malware scanning contract, attachment authorization model, or generated typed workflow operation. Adding it would expand this phase into a security-sensitive storage subsystem.

The renderer must handle `answerType: "File upload"` deliberately: show a semantic unavailable notice in read/write modes, exclude it from the seeded exercisable questionnaire, fail submission if a definition marks it visible and required, and document the limitation in the Phase 3 contract-gap note. Do not silently treat it as text or accept an arbitrary URL.

## Web architecture

Create `apps/web/src/features/questionnaires/` with domain, schema, service, server actions, shared renderer, list/review projections, and focused tests. Mirror `src/features/requests/`:

- server-only service functions use `createStrapiClient()` and generated custom paths only;
- Zod parses every external payload and converts to a normalized render model outside JSX;
- server actions parse unknown input again, map 400/403/404/409 to safe messages, revalidate dashboard/list/detail routes, and never redirect on failed draft save;
- App Router pages are Server Components that load typed states; the renderer alone is a Client Component because it owns RHF watches, conditional visibility, validation, and mutation feedback.

Use one `QuestionnaireRenderer` with `mode: "edit" | "read-only"`. It receives the same normalized sections/questions/answers model. Read-only mode uses semantic output elements and the same visibility calculation, not a second response implementation.

Recommended routes:

- Requestor: `/app/questionnaires` and `/app/questionnaires/[documentId]`.
- Analyst: `/app/review/questionnaires/[documentId]` (and an analyst list only if required to make QUES-05 discoverable).
- Dashboard questionnaire items should link to the questionnaire detail, not back to the request, once the typed questionnaire relation is available.

RHF field names should use `answers.<questionKey>`. A schema factory builds per-question validation from the parsed definitions. `useWatch` drives visibility; progress is `answered active questions / active questions`, with required-unanswered count separately announced. When a controlling answer hides a dependent field, unregister/clear it and ensure focus moves predictably if the hidden field held focus.

## UI, accessibility, and responsive requirements

- Reuse `PageHeader`, `FormSection`, `DetailSection`, `StatusBadge`, `ConfirmDialog`, and existing shadcn inputs. Add no custom primitive unless an answer type cannot be composed accessibly.
- Group sections with real headings/`fieldset`/`legend` associations. Each input uses the persisted question text as its accessible label and connects help/error text through IDs.
- Boolean must not rely on color or an ambiguous unlabeled switch. Single select uses radios when the set is short; Multi select uses checkboxes; Date uses a labelled date input/calendar with typed ISO parsing.
- Progress includes text (`N of M answered`) and a progress element/role; unanswered indicators include text/icon and error summary links, not color alone.
- Submit opens `ConfirmDialog`, describes irreversibility, keeps failures inside the open dialog, and moves focus to the first invalid visible question when validation fails.
- Save draft preserves values on failure, provides pending status, and announces success without presenting draft save as submission.
- At 375px use one column and full-width actions; section navigation and action bars must not cause horizontal overflow. At wider widths a sticky summary/section navigation may be used only if keyboard and zoom behaviour remain sound.
- Implement populated, loading, empty, error, and permission-denied states for list/detail/review. Submitted read-only is a populated workflow state with explicit status and no editing controls.

## Security threat model inputs

- T-03-01 IDOR through questionnaire/question IDs or hostile filters: enforce ownership through the full relation chain in Strapi and prove cross-owner 403 plus unchanged persistence.
- T-03-02 FunctionAPI bypass through unprotected generic CRUD/custom routes: attach both policies to every served route and seed exact grants only.
- T-03-03 mass assignment of definition, relation, state, or timestamps: allowlist answer values and keep lifecycle metadata server-owned.
- T-03-04 conditional/required bypass by crafted client payload: parse the stored definition and recompute visibility/validity server-side on save and submit.
- T-03-05 partial submit: transactionally stamp the full active answer set or persist none.
- T-03-06 sensitive response leakage: bounded projections, safe errors, no answer-body logging, and analyst access only through explicit grants.
- T-03-07 unsupported File upload abuse: reject required visible uploads and never accept paths/URLs as substitutes.

## Validation Architecture

### Backend

- Pure Node tests for options/answer schema validation, condition evaluation, progress, hidden-answer clearing, required validation, and workflow state transitions.
- Extend `apps/strapi/tests/helpers/strapi-http-harness.ts` with owner, other Requestor, analyst, submitted/non-answerable requests, questionnaires, and questions.
- Add `apps/strapi/tests/questionnaire-workflow.integration.test.ts` mounted HTTP cases for Requestor owner list/detail/save/submit, cross-owner GET/PATCH/POST 403 with unchanged persistence, analyst read-all, hostile relation/state/timestamp payloads, repeated submit conflict, and non-answerable state guards.
- Extend catalogue tests for exact served routes, Jane/Bob effective grants, both-copy byte equality, and no IAM development permission actions.

### Web

- `questionnaire-schema.test.ts`: all answer types, invalid options versions, missing/duplicate keys, forward/cyclic conditions, type/value mismatch, unsupported File upload.
- service/action tests: exact generated URL/body shapes, runtime payload rejection, safe 403/409 mapping, and revalidation.
- renderer component tests: group/order, conditional appearance/disappearance and clearing, progress/unanswered counts, per-question validation/focus, save failure preservation, explicit submit confirmation, and shared read-only rendering.
- list/page state tests: populated/loading/empty/error/permission-denied and no unauthorized content leakage.
- Extend the Playwright dual-server journey using the stable seed: Jane opens questionnaire, answers controller/dependent questions, saves, reloads and resumes, submits after confirmation, sees read-only; switch to Bob and review the same submitted answers. Assert 375px no overflow, keyboard focus, and axe checks at key pages.

### Commands and sampling

- Backend targeted/full: `pnpm --filter @csrm/strapi test`.
- Web targeted: `pnpm --filter @csrm/web test -- src/features/questionnaires`.
- Contract: `pnpm --filter @csrm/web api:check` after spec/generation.
- Type/build: `pnpm typecheck` and `pnpm build` at wave/final gates.
- E2E: `pnpm --filter @csrm/web test:e2e -- questionnaire-workflow.spec.ts`.

## Recommended plan decomposition

1. Contract note, OpenAPI custom operations, generated types, and catalogue parity.
2. Mounted test fixtures/RED contracts for authorization and state guards.
3. Questionnaire authorization scope, operations, routes, controllers, and pure workflow services.
4. Dev-gated idempotent questionnaire seed and permission allowlist.
5. Web domain/options/answer schemas and condition/progress engine.
6. Typed service/actions plus list/detail Server Component states.
7. Shared RHF renderer for all supported answer types, draft/resume, progress, conditions, validation, and confirmation/read-only transition.
8. Analyst read-only review route reusing the renderer plus dashboard/navigation integration.
9. Component/accessibility tests and the full dual-server Requestor-to-Analyst Playwright journey.

Plans can place independent contract/test-foundation work in the first wave, then backend and web-domain slices behind those contracts, followed by renderer/review, and finish with integrated E2E. Every plan must cite QUES IDs and D-01 through D-09 as applicable.

## Pitfalls to prevent in plans

- Do not modify either questionnaire/question `schema.json`.
- Do not use `helpText`, persisted `order`, or `reviewComment` to replace the locked JSON convention.
- Do not equate navigation visibility or development public-role permission with authorization.
- Do not expose generic question PUT as a mass-assignment path around the batch workflow.
- Do not trust client-computed visibility, completeness, timestamps, or submitted state.
- Do not create a second analyst renderer.
- Do not implement File upload as a URL/text workaround.
- Do not re-run API generation unless the spec changes; if custom workflow operations are added, update spec and generated schema in the same plan.

## RESEARCH COMPLETE
