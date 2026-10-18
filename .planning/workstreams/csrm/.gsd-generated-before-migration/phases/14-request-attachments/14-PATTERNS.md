# Phase 14: Request attachments - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 74 (new and modified, from 14-CONTEXT D-01 to D-40, 14-RESEARCH "Recommended Project Structure", "Proposed plan seeds" and "Wave 0 Gaps", and 14-UI-SPEC "Component inventory" and "Proposed CSRM extensions")
**Analogs found:** 66 / 74 (the rest have no analog in the tree: see "No Analog Found")

**Written ahead.** Phases 10 to 13 execute first. Every analog below is today's tracked code (checked with `git ls-files`) or, where marked **[planned: NN-MM]**, the output an earlier plan will create. Phase 12's plans are under revision and Phase 13's are new: the plan numbers below are from the `NN-MM-PLAN.md` files present on 2026-10-01 (12-01 to 12-11, 12-14 to 12-19; 13-01 to 13-10). Stage 3 re-runs the plan check before execution, so the Phase 14 planner names each relied-on plan in its context section.

Path note: Strapi is `apps/backend`, the web app is `apps/csrm`.

## Earlier-phase changes to files Phase 14 touches

Phase 14's plans must build on the planned state of these files, not today's.

| File | Changed first by |
|---|---|
| `docs/references/specification.json`, `apps/csrm/src/lib/api/generated/schema.d.ts` | 10-06, 10-10, 10-11, 10-13, 10-15, 10-16, 10-18, 11-06, 11-07, 11-08, 11-10, 11-14 to 11-17, 12-07 to 12-11, 12-14, 13-03 to 13-06, 13-08 |
| `docs/references/idambox-csrm-role-function-api-catalogue.json`, `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` | 10-13, 11-10, 12-10, 12-11, 13-03 to 13-06, 13-08 |
| `docs/references/served-operations.json` | 10-13, 11-10, 11-12, 12-10, 12-11, 13-03 to 13-06 |
| `apps/backend/tests/fixtures/authorization-matrix.ts`, `apps/backend/tests/contract-catalogue.integration.test.ts` | 10-13, 11-10, 12-10, 12-11, 13-03 to 13-06, 13-08 |
| `apps/backend/tests/served-operations.integration.test.ts` | 11-10, 13-05 |
| `apps/backend/tests/helpers/strapi-http-harness.ts` | 10-13, 12-02 to 12-07, 13-03 |
| `apps/backend/src/policies/csrm-authorization.ts` (`HUMAN_ANALYST_ONLY_OPERATIONS`) | 10-13, 12-10, 12-11, 13-03 |
| `apps/backend/src/csrm/conflict-reasons.ts` (created by 10-06) + `tests/conflict-reasons.unit.test.ts` | 10-06, 12-07, 12-11, 13-03, 13-05, 13-06 |
| `apps/csrm/src/lib/api/conflict-reasons.ts` (+ test) | 10-06, 12-07, 12-11, 13-03, 13-05, 13-06 |
| `apps/csrm/src/lib/api/refusal-copy.ts` (+ test) | 10-07, 12-07, 12-11, 13-04, 13-05, 13-06 |
| `apps/backend/src/index.ts` (`register()`) | 12-04 |
| `apps/backend/.env.example` | 12-02 |
| `apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts` (request read summary, delete refusal) | 10-06, 11-06, 13-04, 13-06 (13-06 adds `REQUEST_HAS_NOTES`) |
| `apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts` | 10-06, 13-03, 13-04, 13-06 |
| `apps/backend/src/api/csrm-assessment-request/services/request-lock.ts` (`withRequestLock`) | created by 13-03 |
| `apps/backend/src/api/csrm-request-note/services/request-notes-policy.ts` (`acceptsNotes`, `canUseRequestNotes`, `authorPartFor`) | created by 13-05 |
| `apps/backend/src/api/csrm-request-note/{routes,controllers,services}/request-notes.ts`, `services/note-ai-input-log.ts` | created by 13-05, extended by 13-06 |
| `apps/backend/src/csrm/ai/prompt-sections.ts`, `assessment-context.ts`, `assessment-context-loader.ts`, `data-policy.ts` | created by 12-02 / 12-03 |
| `apps/backend/src/api/csrm-ai-run/**` (run record, context summary envelope, run read) | created by 12-04, extended by 12-10 |
| `apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts` | 10-06, 10-11, 10-13, 12-05, 12-07, 12-14, 13-08 |
| `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts` | 10-13, 12-02, 12-03, 12-06, 12-07, 12-11, 12-16, 13-08 |
| `apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts`, `csrm-assessment/controllers/csrm-assessment.ts` (analyst reads: notes summary and AI-inputs signal) | 13-08 last (after 10-x, 11-07, 12-07 to 12-11) |
| `docs/security/phase-08-residual-risks.md` | 12-10, 13-06, 13-08 |
| `apps/csrm/next.config.ts` | 11-02 (redirects) |
| `apps/csrm/playwright.config.ts` | 12-02 |
| `apps/csrm/src/features/contract-response-parity.test.ts` | 10-09, 10-15, 11-06 to 11-17, 12-08 to 12-10, 13-03 to 13-08 |
| `apps/csrm/src/components/csrm/status-badge.tsx` (+ test) | 11-01, 12-16 |
| `apps/csrm/src/components/csrm/navigation-guard.tsx` (+ test) | created by 10-08, extended by 11-19, 13-09 |
| `apps/csrm/src/lib/session-drafts/session-drafts.ts`, `draft-owner-key.ts` | created by 13-09 (the X-20 per-tab file store keys to the same owner key) |
| `apps/csrm/src/features/requests/request-form.tsx` (+ test) | 10-04 |
| `apps/csrm/src/features/requests/request-actions.ts` (`createRequestAction`) | 10-07 |
| `apps/csrm/src/features/requests/request-schema.ts`, `request-service.ts` | 11-08, 11-10 to 11-12, 13-04, 13-06 |
| `apps/csrm/src/features/requests/request-hub.tsx` (+ test) | 10-04, 10-14, 11-08, 11-09, 13-09, 13-10 |
| `apps/csrm/app/(app)/app/requests/[documentId]/page.tsx`, `loading.tsx` | 10-04, 11-09, 13-10 |
| `apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx`, `loading.tsx` | 10-02, 10-12, 10-14, 13-09, 13-10 |
| `apps/csrm/app/(app)/app/review/questionnaires/[documentId]/page.tsx`, `review/assessments/[documentId]/page.tsx` | 10-02, 10-09, 10-15, 10-18, 10-19, 12-15 |
| `apps/csrm/src/features/request-notes/*` (composer, thread, note item, section, actions, service, schema, domain) | created by 13-05, 13-06, 13-10 |
| `apps/csrm/src/features/ai-assistance/ai-run-sheet.tsx`, `ai-assistance-schema.ts`, `ai-assistance-domain.ts` | created by 12-10, 12-14 to 12-18 |
| `apps/csrm/src/features/assessments/questionnaire-generation-job.tsx`, `assessment-draft-job.tsx` (`CONTEXT_TOO_LARGE`) | 10-12, 10-14, 12-14, 13-08 |
| `apps/csrm/src/lib/performance/interface-copy-guard.test.ts`, `zod-client-boundary.test.ts` | many in 10 to 13 (last 13-10; zod guard 11-02, 11-09) |
| `docs/design/csrm-design-direction.md` | 10-01, 11-01, 12-01, 13-01 (X-18 recorded by 13-01; X-22 extends it) |
| root `CONTEXT.md` (glossary "Attachment", UI-D1) | 11-01, 12-19 |
| `apps/csrm/e2e/helpers/navigation.ts`, `helpers/requests.ts` | 11-02, 11-05, 11-06, 11-12, 11-13, 13-07 |

Files no earlier phase changes (build on today's code): `apps/backend/config/plugins.ts`, `config/middlewares.ts`, `apps/csrm/proxy.ts`, `apps/backend/README.md`, `docs/security/strapi-http-hardening.md`, `apps/backend/src/csrm/prompt-data.ts` (unless 13-08 adds an attribute helper; check at execution, RESEARCH Pattern 7).

## File Classification

### Strapi (apps/backend)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `docs/contract-gaps/phase-14-request-attachments.md` | doc (contract gap) | n/a | `docs/contract-gaps/phase-13-request-notes.md` **[planned: 13-02]**, `phase-12-ai-run-record-and-provenance.md` **[planned: 12-01]** | exact |
| `src/api/csrm-request-attachment/content-types/csrm-request-attachment/schema.json` | model | CRUD | `src/api/csrm-request-note/content-types/...` **[planned: 13-05]** | exact |
| `src/api/csrm-request-attachment/routes/request-attachments.ts` | route | request-response | `src/api/csrm-assessment-request/routes/my-request-status-summary.ts`; `request-notes.ts` **[13-05]** | exact |
| `src/api/csrm-request-attachment/controllers/request-attachments.ts` | controller | request-response + file-I/O | `src/api/csrm-administration/controllers/csrm-administration.ts` (multipart `importHandler`); `request-notes.ts` controller **[13-05]** (404 via `canUseRequestNotes`) | exact |
| `src/api/csrm-request-attachment/services/request-attachments.ts` | service | CRUD under lock | `request-notes.ts` service **[13-05/13-06]**; `request-assignment.ts` **[13-03]** (`withRequestLock`) | exact |
| `src/api/csrm-request-attachment/services/attachment-event-log.ts` | service | append-only log | `services/note-ai-input-log.ts` **[13-05]**, `assignment-log.ts` **[13-03]**, `csrm-questionnaire/services/questionnaire-governance-log.ts` | exact |
| `src/api/csrm-request-attachment/services/attachment-projection.ts` | service | transform | `request-people.ts` **[13-03]** (people as `documentId` + `displayName`) | role-match |
| `src/api/csrm-request-attachment/operations.ts` | config | n/a | `src/api/csrm-assessment-request/operations.ts` | exact |
| `src/csrm/files/attachment-config.ts` (+ boot validation) | config | env read | `src/csrm/ai-config-validation.ts`; `src/utils/development-identity-enabled.ts`; `csrm/ai/data-policy.ts` **[12-02]** | role-match |
| `src/csrm/files/attachment-policy.ts` | utility | transform | `csrm/ai/data-policy.ts` **[12-02]**; `apps/csrm/src/features/administration/csv-client-parser.ts` `sanitizedCsvFileName` | partial |
| `src/csrm/files/register-attachment-storage.ts` | provider/bootstrap | event-driven (register) | `src/keycloak/register-idambox-user-provisioning.ts` (called from `src/index.ts` `register()`) | role-match |
| `src/csrm/files/storage-port.ts`, `private-local-provider.ts` | service | file-I/O | none in tree (RESEARCH Pattern 1, Code Example 2) | none |
| `src/csrm/files/zip-archive.ts`, `content-check.ts`, `ooxml-text.ts` | utility | transform | none (RESEARCH Pattern 3, Code Example 4) | none |
| `src/csrm/files/scanner.ts`, `clamav-scanner.ts` | service (port + adapter) | request-response over TCP | `src/csrm/openai-compatible-client.ts` + `src/csrm/ai-provider-selection.ts` (adapter selected by config) | role-match |
| `src/csrm/files/rescan-scheduler.ts` | service | event-driven/batch | `src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts` (in-process jobs, boot, destroy) | role-match |
| `src/csrm/files/extraction.ts`, `extraction-worker.ts` | service | batch (worker) | none (RESEARCH Pattern 6, Code Example 8) | none |
| `src/csrm/spreadsheets/xlsx-reader.ts` | utility | file-I/O | none (Phase 19's planned seam) | none |
| `src/csrm/audit/security-event-log.ts` | utility | logging | `strapi.log.info` usage in `src/index.ts` lines 22-25; no structured logger exists | partial |
| `src/middlewares/csrm-multipart-cleanup.ts` | middleware | request-response | `src/middlewares/csrm-development-identity.ts` (global middleware factory) | role-match |
| `src/csrm/prompt-data.ts` (attribute helper) or `csrm/ai/prompt-sections.ts` | utility | transform | `src/csrm/prompt-data.ts` lines 1-10 | exact |
| `src/csrm/conflict-reasons.ts` (new reasons) | config | n/a | itself **[10-06 … 13-06]** | exact |
| `src/policies/csrm-authorization.ts` (`HUMAN_ANALYST_ONLY_OPERATIONS`) | middleware/policy | request-response | itself, lines 41-44, 278-281 | exact |
| `src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts` (summary + `REQUEST_HAS_ATTACHMENTS`) | controller | request-response | `REQUEST_HAS_NOTES` change **[13-06]** | exact |
| `src/csrm/ai/*` context builder + `csrm-ai-run` envelope (attachments section) | service | transform | Phase 13's notes block and notes envelope version **[13-08]** over 12-03 / 12-04 | exact |
| `src/index.ts` | config/bootstrap | n/a | itself lines 16-27 | exact |
| `config/plugins.ts` | config | n/a | itself lines 25-42 | exact |
| `config/middlewares.ts` | config | n/a | itself lines 21-35 | exact |
| `.env.example` | config | n/a | itself after 12-02 (AI block) | exact |
| `README.md` (S3, ClamAV deployment) | doc | n/a | the AI provider section 12-02 adds | role-match |
| both catalogue copies, `specification.json`, `served-operations.json`, `schema.d.ts` | contract | n/a | 13-05's notes entries | exact |
| `tests/fixtures/authorization-matrix.ts` | test | n/a | itself (13-05 rows) | exact |
| `tests/helpers/strapi-http-harness.ts` (upload plugin rows → unmounted; storage dir + scanner pins) | test | n/a | itself lines 575-625 (`POST:/api/upload` etc.), line 171 (`.tmp` dir) | exact |
| `tests/helpers/fake-clamd-server.ts`, `fake-object-store.ts` | test helper | TCP/HTTP fake | `tests/helpers/fake-openai-compatible-server.ts`, `fake-keycloak-server.ts` | exact |
| `tests/helpers/attachment-fixtures.ts`, `tests/fixtures/attachments/**` | test fixture | n/a | `tests/fixtures/ai-wire/*` **[12-05/12-06]** | partial |
| `tests/request-attachments.integration.test.ts`, `attachment-quarantine.integration.test.ts`, `attachment-ai-input.integration.test.ts`, `attachment-storage-s3.integration.test.ts` | test | request-response | `tests/request-status-summary.integration.test.ts` lines 1-40; `request-notes.integration.test.ts` **[13-05]** | exact |
| `tests/attachment-*.unit.test.ts`, `zip-archive.unit.test.ts`, `security-event-log.unit.test.ts` | test | n/a | `tests/ai-provider-boot.unit.test.ts`, `request-notes.unit.test.ts` **[13-05]** | exact |
| `docs/security/strapi-http-hardening.md`, `phase-08-residual-risks.md` | doc | n/a | `strapi-http-hardening.md` lines 141-147 | exact |

### Web (apps/csrm)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `next.config.ts` | config | n/a | itself lines 22-29 | exact |
| `proxy.ts` (+ `proxy.test.ts`) | middleware | request-response | itself lines 20-23, 74-84 | exact |
| `src/lib/files/file-response.ts` | utility | transform | `src/features/administration/csv-client-parser.ts` `sanitizedCsvFileName` | partial |
| `src/lib/files/save-file.ts` | utility (client) | file-I/O | `csv-client-parser.ts` `downloadAdministrationCsv` lines 228-236 | exact |
| `src/lib/files/format-file-size.ts` | utility | transform | `src/lib/time/format-instant.ts` **[10-01]** | partial |
| `src/features/attachments/attachments-service.ts` | service (server-only) | request-response + multipart + binary | `src/features/administration/administration-service.ts` lines 1, 50, 119-145 | exact |
| `src/features/attachments/attachments-actions.ts` | Server Action | request-response | `src/features/administration/administration-actions.ts` lines 38-93; `request-notes/notes-actions.ts` **[13-05]** | exact |
| `src/features/attachments/attachments-schema.ts` | schema (zod, server) | validation | `request-notes/notes-schema.ts` **[13-05]** | exact |
| `src/features/attachments/attachments-domain.ts` | domain (zod-free) | transform | `request-notes/notes-domain.ts` **[13-05/13-10]** | exact |
| `src/features/attachments/file-field.tsx`, `upload-queue.tsx` (lazy) | component (client) | event-driven | `src/features/administration/csv-import-flow.tsx`; `request-notes/note-composer.tsx` **[13-10]** | role-match |
| `src/features/attachments/files-section.tsx`, `file-row.tsx`, `file-chip.tsx` | component | request-response | `request-notes/notes-section.tsx`, `note-item.tsx` **[13-10]**; `components/csrm/data-table.tsx` | role-match |
| `src/features/attachments/file-ai-control.tsx`, `file-text-sheet.tsx` (lazy) | component (client) | request-response | Phase 13's note AI switch (X-18) **[13-10]**; `ai-assistance/ai-run-sheet.tsx` **[12-15]** | exact |
| `(app)` file store provider (X-20 per-tab memory) | provider (client) | event-driven | `src/lib/session-drafts/session-drafts.ts` **[13-09]** | role-match |
| `src/components/csrm/status-badge.tsx` (`attachment` family) | component | n/a | itself lines 58-85 | exact |
| `src/lib/api/conflict-reasons.ts`, `refusal-copy.ts` (families N, O, P) | config | n/a | themselves **[10-06/10-07 … 13-06]** | exact |
| `src/features/contract-response-parity.test.ts` (file-response mode) | test | n/a | itself line 25 (`mode: 'parsers' \| 'no-direct-response-parser'`) | exact |
| `src/features/requests/request-form.tsx`, `request-actions.ts` | component / action | request-response | themselves (`createRequestAction` lines 86-95) | exact |
| `request-notes/note-composer.tsx`, `note-item.tsx` (files) | component | event-driven | themselves **[13-10]** | exact |
| request pages (`requests/[documentId]`, `review/requests/[documentId]` page + loading) | page (Server Component) | request-response | themselves after 13-10 (Notes section placement) | exact |
| analyst questionnaire/assessment pages (files line) | page | request-response | Phase 13's notes summary line **[13-08 server, 13-10 web]** | exact |
| `ai-assistance/ai-run-sheet.tsx`, `ai-assistance-schema.ts` (Files group) | component / schema | transform | themselves **[12-10, 12-15]** plus 13's notes group | exact |
| `e2e/request-attachments.spec.ts`, `playwright.config.ts` (mobile `testMatch`, Strapi env pins) | test / config | n/a | `e2e/request-notes.spec.ts` **[13-10]**; `playwright.config.ts` lines 187-213 | exact |
| `docs/design/csrm-design-direction.md` (X-19 to X-23), root `CONTEXT.md` (Attachment) | doc | n/a | 13-01's X-15 to X-18 recording task | exact |

## Pattern Assignments

### `src/api/csrm-request-attachment/routes/request-attachments.ts` (route)

**Analog:** `apps/backend/src/api/csrm-assessment-request/routes/my-request-status-summary.ts` lines 1-31 (custom router file, no core router, policy chain).
```ts
const config: Core.RouterConfig = {
  type: "content-api",
  routes: [{
    method: "GET",
    path: "/v1/my_requests/status_summary",
    handler: "api::csrm-assessment-request.my-request-status-summary.statusSummary",
    config: {
      auth: { strategies: ["content-api-token"] },
      policies: ["global::csrm-app-enabled", { name: "global::csrm-authorization", config: { operation: myRequestStatusSummary, requireRequestCollectionScope: true } }],
    },
  }],
};
```
Use the `policies(operation)` helper style from `csrm-administration/routes/csrm-administration.ts` lines 7-10 for six routes. D-01: no `routes/csrm-request-attachment.ts` core router, matching Phase 13's notes (13-05).

### `src/api/csrm-request-attachment/operations.ts`

**Analog:** `apps/backend/src/api/csrm-assessment-request/operations.ts` lines 1-13: `"METHOD:/api/v1/..."` string constants in an `as const` object that the policy, the catalogue test and the matrix import.

### `src/api/csrm-request-attachment/controllers/request-attachments.ts` (multipart controller)

**Analog:** `apps/backend/src/api/csrm-administration/controllers/csrm-administration.ts` lines 120-136:
```ts
async function importHandler(ctx: RecordValue, kind: AdministrationKind): Promise<unknown> {
  try {
    const request = isRecord(ctx.request) ? ctx.request : {};
    const files = isRecord(request.files) ? request.files : {};
    const body = isRecord(request.body) ? request.body : {};
    const data = await commitAdministrationImport({ ..., state: ctx.state, uploads: files, ... });
    return { data };
  } catch (error) { return handleError(ctx, error); }
}
```
- Parts check: exactly `{ file, noteId? }`, any other part 400 (D-04 item 2).
- Record rule first: call `canUseRequestNotes` **[13-05]** and answer 404 (13-05's truth "every handler calls canUseRequestNotes and answers 404"; RESEARCH Pattern 2 order).
- Download: set the D-23 headers on `ctx` and assign `ctx.body` to the verified bytes (RESEARCH Code Example 7, lines 1161-1175).

### `src/api/csrm-request-attachment/services/request-attachments.ts`

**Analog:** Phase 13's `request-notes.ts` service **[13-05/13-06]** and `request-assignment.ts` **[13-03]**: every write in one `withRequestLock(requestId, …)` from `csrm-assessment-request/services/request-lock.ts` **[13-03]**. Follow RESEARCH Pattern 2: scan and storage `put` outside the lock; inside it only the re-checks and the insert; delete stored bytes on a late refusal. Window predicate `acceptsAttachments` builds on `acceptsNotes` from `request-notes-policy.ts` **[13-05]**; `uploaderPart` from `authorPartFor` **[13-05]**. Pitfall 14: no raw knex inside the lock.

### `services/attachment-event-log.ts` (append-only, versioned)

**Analog:** `note-ai-input-log.ts` **[13-05]**, `assignment-log.ts` **[13-03]**, and tracked `apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts` (06.8 pattern: `schemaVersion: 1`, closed parse, capped; malformed log projects as "history unavailable"; gates never read it — RESEARCH Pattern 5).

### `src/csrm/files/attachment-config.ts` (boot validation, D-15)

**Analog:** `apps/backend/src/csrm/ai-config-validation.ts` lines 1-25:
```ts
export class CsrmAiConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = "CsrmAiConfigurationError"; }
}
function requireValue(value: unknown, environmentVariable: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CsrmAiConfigurationError(`CSRM AI provider configuration requires ${environmentVariable}.`);
  }
}
```
Development double key: `apps/backend/src/utils/development-identity-enabled.ts` lines 1-7 (`NODE_ENV === "development" && CSRM_ENVIRONMENT === "development"`); use the first two terms only (D-12, without `CSRM_DEV_IDENTITY`). Phase 12's `csrm/ai/data-policy.ts` **[12-02]** is the "unset outside development = feature unavailable, rest runs" analog (D-15).

### `src/index.ts` and `src/csrm/files/register-attachment-storage.ts`

**Analog:** `apps/backend/src/index.ts` lines 16-27 (after 12-04's change):
```ts
register({ strapi }: { strapi: Core.Strapi }) {
  assertCsrmAiConfiguration(strapi);
  registerIdamboxUserProvisioning(strapi);
  ...
},
```
Add `registerAttachmentStorage(strapi)` after `assertCsrmAiConfiguration` (RESEARCH Code Example 2: `upload.provider.extend(...)`; `upload.routes["content-api"].routes = []`). The re-scan scheduler's boot hook goes in `bootstrap()` and its stop in a `destroy()` (Pitfall 11).

### `config/plugins.ts`

**Analog:** itself lines 25-42 (`upload.config.security` stays the second layer). Spread the S3 block exactly as RESEARCH Code Example 3 (`ACL: undefined`, `signedUrlExpires: 60`, KMS encryption, no `baseUrl`).

### `config/middlewares.ts` and `src/middlewares/csrm-multipart-cleanup.ts`

**Analog for placement:** `config/middlewares.ts` lines 21-31 (`strapi::body` with `formidable.maxFileSize: 52_428_800`); insert `'global::csrm-multipart-cleanup'` immediately after the `strapi::body` entry (RESEARCH Pitfalls 2 and 3: global, `finally`, every part, not only `files`).
**Analog for the factory shape:** `apps/backend/src/middlewares/csrm-development-identity.ts` lines 1-30 (`export default function name(_config: unknown, { strapi }: { strapi: Core.Strapi })` returning a koa middleware).

### `src/csrm/files/scanner.ts`, `clamav-scanner.ts`

**Analog:** the AI port: `src/csrm/ai-provider-selection.ts` (selection by config) and `src/csrm/openai-compatible-client.ts` (timeouts, closed failure mapping). Adapter uses `node:net` only (RESEARCH Code Example 5); the double builds EICAR from fragments (Code Example 6).

### `src/csrm/files/rescan-scheduler.ts`

**Analog:** `apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts` (in-process single-process job registry; 10-13 and 13-08 extend it). Timers `unref()`ed and cleared on destroy (Pitfall 11).

### Prompt blocks (`src/csrm/prompt-data.ts` / `csrm/ai/prompt-sections.ts`)

**Analog:** `apps/backend/src/csrm/prompt-data.ts` lines 1-10:
```ts
export function promptDataTag(label: string, value: string): string {
  return `<${label}>${value.replace(/[&<>]/g, (character) => entities[character])}</${label}>`;
}
```
Reuse any attribute helper 13-08 adds for notes; else add `promptDataBlock(label, attributes, value)` (attributes `[a-z0-9-]` and integers only). Blocks sit inside `<requestorData>` in `prompt-sections.ts` **[12-03]** (RESEARCH Pattern 7). The run envelope gains a new version beside 12-04's v1 and 13-08's notes version.

### `src/policies/csrm-authorization.ts`

**Analog:** itself, lines 41-44 and 278-281:
```ts
export const HUMAN_ANALYST_ONLY_OPERATIONS: ReadonlySet<string> = new Set([
  RELEASE_ASSESSMENT_OPERATION,
  "POST:/api/v1/questionnaires/{questionnaireId}/release", ...
```
Add only the AI inclusion and text preview operations (D-38), importing from the new `operations.ts`; mirror in the matrix.

### Request controller (summary + delete refusal)

**Analog:** 13-06's `REQUEST_HAS_NOTES` refusal on the core delete in `csrm-assessment-request.ts`; add `REQUEST_HAS_ATTACHMENTS` beside it (count includes removed). The viewer's attachment summary joins the request read in the same plan as its web parser (06.9 lesson).

### Tests (Strapi)

**Integration analog:** `apps/backend/tests/request-status-summary.integration.test.ts` lines 1-40:
```ts
import test, { after } from "node:test";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";
const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());
```
plus its `specKeys(componentName)` closed-component check. Identities: `harness.identities` (`owner`, `otherRequestor`, `analyst`, `analystAgent`, `serviceAnalystAgent`, `inactiveAnalyst`; harness lines ~600-612), plus 13-07's second analyst.
**Fake server analog:** `tests/helpers/fake-openai-compatible-server.ts` for `fake-clamd-server.ts` (TCP) and `fake-object-store.ts` (HTTP).
**Harness pins:** `strapi-http-harness.ts` line 171 (`databaseDir = path.join(appDir, ".tmp", "authorization-http")`): pin `CSRM_ATTACHMENT_LOCAL_DIR` under the same `.tmp` root and `CSRM_ATTACHMENT_SCANNER=development`.
**Upload rows → unmounted:** `strapi-http-harness.ts` lines ~575-625 (`POST:/api/upload`, `GET:/api/upload/files`, `DELETE:/api/upload/files/:id`, `GET:/api/upload/files/:id`, `GET:/api/upload/files/page`); convention `docs/security/strapi-http-hardening.md` lines 141-143 (GET 404, mutation 405).

### `apps/csrm/next.config.ts` and `proxy.ts`

**Analog:** `next.config.ts` lines 25-29:
```ts
experimental: { serverActions: { bodySizeLimit: '6mb' } },
```
→ `'26mb'` plus `proxyClientMaxBodySize: '26mb'` (Pitfall 1). `proxy.ts` lines 20-23: add the `exceedsActionBodyLimit` 413 gate as the first line of `proxy()` (RESEARCH Code Example 1); the matcher (lines 74-84) stays. 11-02 changes `next.config.ts` redirects only.

### `src/features/attachments/attachments-service.ts` (server-only; multipart and binary)

**Analog:** `apps/csrm/src/features/administration/administration-service.ts` lines 1, 50, 119-135:
```ts
import 'server-only';
const multipartBodySerializer = (body: unknown) => body as FormData;
function importForm(file: File, fields?: {...}): FormData {
  const form = new FormData();
  form.set('file', file, file.name);
  ...
}
return request((client) => client.POST('/v1/risk_types/import/preview', { body: body as never, bodySerializer: multipartBodySerializer }), parse);
```
Download: same `request` wrapper with openapi-fetch `parseAs: 'arrayBuffer'`, then `validateFileResponse` (RESEARCH Pattern 8). Pitfall 17: pass the `File` straight through, never re-buffer.

### `src/features/attachments/attachments-actions.ts`

**Analog:** `apps/csrm/src/features/administration/administration-actions.ts` lines 1, 38-66:
```ts
'use server';
export type CsvImportActionResult<T> = | { ok: true; data: T } | { ok: false; formError: string; unknownOutcome?: true };
function csvFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 && value.size <= 5_242_880 && value.name.toLocaleLowerCase('en-AU').endsWith('.csv') ? value : null;
}
```
Map refusals through the closed conflict reasons and `refusal-copy.ts` (Phase 10 pattern, 10-07) rather than status-only strings; mirror `notes-actions.ts` **[13-05]** for the result shape. Download action returns `{ ok: true, fileName, contentType, bytes: Uint8Array }`.

### `src/lib/files/save-file.ts` and `file-response.ts`

**Analog:** `apps/csrm/src/features/administration/csv-client-parser.ts` lines 223-236:
```ts
export function downloadAdministrationCsv(contents: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizedCsvFileName(fileName);
  anchor.rel = 'noopener';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
```
Generalise to bytes plus content type; do not move the CSV helper (Phase 19 does).

### `src/components/csrm/status-badge.tsx`

**Analog:** itself lines 58-85 (`{ icon, label, tone }` maps per family, e.g. `closed: { icon: LockKeyholeIcon, label: 'Closed', tone: 'neutral' }`). Add an `attachment` family: `Waiting for malware check` (`ShieldEllipsis`), `Blocked` (`ShieldX`), `File unavailable` (`FileX`), `Removed` (`ArchiveX`), all `neutral` (UI-D14). Build on 12-16's version.

### Contract parity guard

**Analog:** `apps/csrm/src/features/contract-response-parity.test.ts` line 25 (`mode: 'parsers' | 'no-direct-response-parser'`) and lines 216-219; add a `'file-response'` mode for the download (Pitfall 12).

### Web components

- **Files section / rows:** `request-notes/notes-section.tsx`, `note-item.tsx` **[13-10]** for frame, skeleton (`notes-skeleton.tsx`) and the not-found refusal; `components/csrm/data-table.tsx` for the ≥768px table with densities (UI-SPEC §3.2).
- **Upload field and queue:** `src/features/administration/csv-import-flow.tsx` (tracked; file input + action call) and `note-composer.tsx` **[13-10]**; navigation guard from `components/csrm/navigation-guard.tsx` **[10-08, 13-09]**.
- **Per-tab file memory:** `src/lib/session-drafts/session-drafts.ts` and `draft-owner-key.ts` **[13-09]** for owner keying; file contents stay in memory only (X-20).
- **AI control and preview:** Phase 13's note AI switch **[13-10]** and `ai-assistance/ai-run-sheet.tsx` **[12-15]** (X-13 sheet).
- **New-request form:** `request-form.tsx` (after 10-04) line 148 `RequestForm`, and `request-actions.ts` lines 86-95 (`createRequestAction` ends in `redirect(...)`; D-26 needs it to return the id while files are queued).

### Playwright

**Analog:** `e2e/request-notes.spec.ts` **[13-10]**; `playwright.config.ts` lines 187-213 (mobile project `testMatch`; Strapi webServer `env` with `CSRM_ENVIRONMENT: 'development'`, `CSRM_AI_PROVIDER: 'deterministic'`) — add the attachment storage dir under the run's temp root and `CSRM_ATTACHMENT_SCANNER: 'development'`. Upload files are built in memory (`setInputFiles` with buffers), never EICAR (D-14).

## Shared Patterns

### Authorisation chain
**Source:** route `policies` (`global::csrm-app-enabled` + `global::csrm-authorization` with the operation), then the record rule `canUseRequestNotes` **[13-05]** in the controller, answering 404. **Apply to:** all six attachment routes. Never branch on auth mode; read the user from `ctx.state`.

### Per-request serialisation
**Source:** `withRequestLock` in `services/request-lock.ts` **[13-03]**. **Apply to:** upload, removal/restore, AI inclusion, the re-scan verdict write.

### Closed refusals
**Source:** `apps/backend/src/csrm/conflict-reasons.ts` and `apps/csrm/src/lib/api/conflict-reasons.ts` **[10-06]**, `refusal-copy.ts` **[10-07]**, last extended by 13-06. **Apply to:** every new reason (UI-SPEC §8 families N, O, P), one owner per wave (D-40).

### Contract change chain
**Source:** 13-05 (spec → `api:generate` → both catalogues byte-identical → matrix row ×6 callers → `served-operations.json` regenerated → parity guard). **Apply to:** the plan after the 14-01 approval checkpoint only.

### Boot-time configuration
**Source:** `ai-config-validation.ts` + `index.ts` `register()`; `.env.example` after 12-02. **Apply to:** attachment config, storage registration, scanner selection.

### Server-only typed API layer
**Source:** `administration-service.ts` (`import 'server-only'`, openapi-fetch, multipart serializer) + `'use server'` actions. **Apply to:** upload, download, removal, AI inclusion, preview. No Route Handler, no raw `fetch`.

### People as projections
**Source:** `request-people.ts` **[13-03]**. **Apply to:** `uploadedBy`, `removedBy` (`documentId`, `displayName` only).

## No Analog Found

| File | Role | Data Flow | Reason / use instead |
|---|---|---|---|
| `src/csrm/files/storage-port.ts` | service | file-I/O | No storage code exists; RESEARCH Pattern 1 and Settled 2 |
| `src/csrm/files/private-local-provider.ts` | provider | file-I/O | RESEARCH Code Example 2 (`provider.extend`) |
| `src/csrm/files/zip-archive.ts` | utility | transform | RESEARCH Settled 3/4, Pitfall 16 |
| `src/csrm/files/content-check.ts`, `ooxml-text.ts` | utility | transform | RESEARCH Pattern 3, Code Example 4 |
| `src/csrm/files/extraction.ts`, `extraction-worker.ts` | worker | batch | RESEARCH Pattern 6, Code Example 8, Pitfalls 8 and 10 |
| `src/csrm/spreadsheets/xlsx-reader.ts` | utility | file-I/O | RESEARCH Settled 3 (`read-excel-file`, Phase 19 seam) |
| `src/csrm/audit/security-event-log.ts` | utility | logging | No structured event logger; D-37 and Phase 19 D-18 contract |
| `tests/helpers/attachment-fixtures.ts` (OOXML/CFB/PDF builders) | test | n/a | RESEARCH Wave 0 Gaps |

## Metadata

**Analog search scope:** `apps/backend/{config,src,tests}`, `apps/csrm/{proxy.ts,next.config.ts,playwright.config.ts,src,e2e}`, `docs/security`, and the `files_modified` of every PLAN in phases 10 to 13.
**Files scanned:** about 60 read or grepped; 41 tracked analog paths verified with `git ls-files`.
**Pattern extraction date:** 2026-10-01
