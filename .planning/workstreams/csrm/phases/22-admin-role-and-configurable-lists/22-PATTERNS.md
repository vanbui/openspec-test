# Phase 22: Admin role and configurable lists - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 46 (grouped by area)
**Analogs found:** 44 / 46
**Economy (stage2-rules §3a):** areas an earlier pattern map already covers are cited, not re-surveyed. `B/` = `apps/backend/`, `W/` = `apps/csrm/`. "Changed first by" names the earlier v2.0 plan (or phase) that touches the file before Phase 22 executes, so the executor reads that plan's planned shape, not today's file. All analogs below are git-tracked source.

## Earlier pattern maps reused

| Area | Cite |
|---|---|
| AI data policy module, `config/ai.ts`, ceiling env, run record and provenance envelope, human-only operations | `12-PATTERNS.md` §`B/src/csrm/ai/data-policy.ts`, §`config/ai.ts`, §`ai-run-record.ts and ai-provenance.ts`, §`csrm-authorization.ts + catalogue` |
| Attachment policy point (retention), event log, security residuals | `14-PATTERNS.md` §`attachment-config.ts`, §`attachment-event-log.ts`, §`csrm-authorization.ts` |
| Contract-gap record, catalogue chain (spec, both catalogues, served-operations, matrix row), fixture subjects | `17-PATTERNS.md`; `17.1-PATTERNS.md` (catalogue chain, `…5e04`, configuration points) |
| `risk-scale.ts`, the matrix picker, derived-rating check, saved views (`CsrmSavedView`) | `18-PATTERNS.md` (incl. `parseWritableRiskFields` 561-585) |
| Export module and log, import flow, `administration-workflow.ts` and `csrm-authorization.ts` mods | `19-PATTERNS.md` §`administration-workflow.ts (mod)`, §`csrm-authorization.ts (mod)` |
| Notification eligible-person predicate, `strapi-capabilities.ts` change | `19.1-PATTERNS.md` |
| Suggestions read, usage reads, bootstrap order in `src/index.ts` | `20-PATTERNS.md` §`B/src/index.ts (bootstrap order)` |
| Stage recorder | `21-RESEARCH.md` / 21-CONTEXT D-07 (no PATTERNS yet) |

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match | Changed first by |
|---|---|---|---|---|---|
| `docs/contract-gaps/phase-22-*.md` (4) + dated amendments | doc | — | `docs/contract-gaps/phase-06.1-revert-audit-facts.md`; 17.1 record | exact | 17.1 (record amended) |
| `B/src/api/csrm-configuration-setting/content-types/.../schema.json` | model | CRUD | `B/src/api/csrm-information-system/content-types/csrm-information-system/schema.json` | role-match | — |
| `B/src/api/csrm-configuration-change/.../schema.json` | model (append-only log) | event | same + 12's `csrm-ai-run` schema (12-PATTERNS) | role-match | — |
| `B/src/api/csrm-division/…`, `csrm-business-unit/…` schemas | model | CRUD | `csrm-information-system` schema (`owner` manyToOne) | exact | — |
| `csrm-risk-type` schema (`isActive`), `csrm-information-asset` schema (`owner`) | model mod | CRUD | `csrm-information-system.owner` (lines 22-26 of its schema) | exact | asset: Phase 10 (D-37 display) |
| `CsrmAssessmentRound` schema (`criteria`) | model mod | CRUD | Phase 17's round schema | exact | 17 / 17.1 |
| `B/src/csrm/configuration/*` (parsers, defaults, store, `criteriaFor`, list rules, role-change diff) | utility (pure) + store | transform | `B/src/csrm/ai/data-policy.ts` (12-02) ; `risk-scale.ts` (12-02, 17-14) ; `review-policy.ts` (17.1) | role-match | 12-02, 17.1 |
| `risk-scale.ts`, `review-policy.ts`, `csrm/ai/data-policy.ts`, attachment policy | utility mod (getters read store) | transform | themselves per 17.1-RESEARCH "Configuration Points" | exact | 12-02, 16-02, 17-14, 17.1; 14-03 |
| `B/src/csrm/configuration/register-role-change-recording.ts` | middleware (document) | event-driven | `B/src/keycloak/register-idambox-user-provisioning.ts` 49-89 | exact | — |
| `B/src/index.ts` | config | — | itself lines 17-26 | exact | 14, 20 (bootstrap order) |
| `B/src/api/csrm-configuration/` (routes, controllers, services, operations) | route/controller/service | request-response | `B/src/api/csrm-administration/` | exact | — |
| `B/src/api/csrm-administration/routes/csrm-administration.ts` (read vs manage scope) | route | request-response | itself lines 1-40 | exact | 14-06, 19-13, 19-14 |
| `B/src/api/csrm-administration/services/administration-workflow.ts` (change rows, retire, owner) | service | CRUD | itself; 19-PATTERNS mod | exact | 19-13, 19-14 |
| `B/src/policies/csrm-authorization.ts` | middleware/policy | request-response | itself lines 285-310 | exact | 17-09 (last), 19 |
| `B/src/api/csrm-current-user/services/effective-access.ts` | service | request-response | itself | exact | 17 |
| catalogue ×2, `specification.json`, `served-operations.json` | config | — | 17.1 chain (17.1-PATTERNS) | exact | 17, 17.1, 19, 20 |
| `B/src/bootstrap/seed-csrm-data.ts` (create-only, Admin role, persona, lists) | config/seed | batch | itself lines 304-375 | exact | 13-07 (last v2) |
| `B/src/keycloak/development-fixture-subjects.ts`, `idp/keycloak/import/idambox-realm.json`, `idp/README.md` | config | — | 17-02's Riley pattern | exact | 17-02, 17-19, 17.1 |
| Manual start services (questionnaire, draft) | service | request-response | `questionnaire-generation-workflow.ts` :31-36; `assessment-workflow.ts` :699-798 | exact | 12-05, 12-06, 13 |
| `questionnaire-governance-log.ts` (kind `started-without-ai`) | utility (closed parser) | transform | itself :26-33, :58 | exact | 16-02 (last) |
| `assessment-draft-registry.ts` (active-job query); `ai-run-record.ts` (`latestAiRunFor`) | service | — | `questionnaire-generation-registry.ts` :32-33 | exact | 12-05, 12-06 |
| Request workflow (division/unit rule) | service | CRUD | Phase 20's suggestions read (20-PATTERNS) | role-match | 20 |
| Saved-view governance service | service | CRUD | 18's saved-view service (18-PATTERNS) | exact | 18, 20 |
| Role holders / change log reads + exports | service | request-response | Phase 19 export module (19-PATTERNS) | exact | 19 |
| Strapi tests (11 new files, matrix, harness, `keycloak-identity.unit.test.ts`) | test | — | `B/tests/administration.integration.test.ts`; `authorization-matrix.integration.test.ts`; `strapi-http-harness.ts` :514-551 | exact | matrix: 19.1-04 (last); harness: 17 |
| `W/src/lib/capabilities/{capability-adapter,strapi-capabilities,development-capabilities}.ts` (+ tests) | config | — | themselves | exact | 19.1-07 |
| `W/src/lib/auth/session-adapter.ts`, `development-session-adapter.ts` | config | — | themselves (`developmentRoles`, line 5) | exact | 17-02 |
| `W/src/config/navigation/navigation.ts` | config | — | itself lines 68-71 | exact | 14-13 (last) |
| `W/app/(app)/app/admin/{configuration,divisions,shared-views,role-holders,change-log}/**/page.tsx` | route (RSC) | request-response | `W/app/(app)/app/admin/[collection]/page.tsx` | exact | — |
| `W/app/(app)/app/admin/[collection]/**` (read vs manage gate) | route mod | request-response | itself | exact | 19 |
| `W/src/features/configuration/*`, `features/lists/*`, `features/access-review/*`, `features/shared-views/*` (service, actions, domain, components) | component/service/actions | request-response | `W/src/features/administration/` (service, actions, domain, workspace) | exact | 19 |
| `W/src/features/generation/manual-start.tsx` | component | request-response | 12's policy alert in the generation cards (12-PATTERNS) | role-match | 12 |
| `W/src/features/requests/request-form.tsx` (selects) | component | request-response | itself + `NativeSelect` | exact | 14-14, 20 |
| `W/src/lib/refusal-copy.ts` (family AA) | utility | transform | itself | exact | 19.1-08 (last) |
| `W/e2e/admin-configuration.spec.ts`; `administration-workflow.spec.ts` mod | test | — | `W/e2e/administration-workflow.spec.ts` | exact | — |
| `docs/design/csrm-design-direction.md` (X-74..X-80), root `CONTEXT.md` glossary, brief amendment, `docs/security/phase-08-residual-risks.md` | doc | — | earlier X-n record tasks (17, 18) | exact | 17-21 phases |

## Pattern Assignments

### Role-change document middleware (D-08)
**Analog:** `B/src/keycloak/register-idambox-user-provisioning.ts` lines 49-89. Copy the shape: guard on `context.uid`/`context.action` and `return next()` early; wrap in `strapi.db.transaction(async () => { const result = await next(); ... return result; })`; use `strapi.db.query(UID)` for reads (never `strapi.documents`, RESEARCH Pitfall 1).
```ts
return async (context, next) => {
  if (context.uid !== IDAMBOX_USER_UID || (context.action !== "create" && context.action !== "update")) {
    return next();
  }
  const data = readWriteData(context.params);
  return strapi.db.transaction(async () => {
    const result = await next();
    ...
  });
};
function readWriteData(params: unknown): Record<string, unknown> { ... }
```
Register in `B/src/index.ts` `register()` unconditionally, after `registerIdamboxUserProvisioning(strapi);` (line 20). Origin via `strapi.requestContext.get()?.state` — skeleton in 22-RESEARCH §"Code Examples".

### Policy scope (D-02)
**Analog:** `B/src/policies/csrm-authorization.ts` 297-306 (today's branch to split into read: human analyst OR admin; write: admin only):
```ts
if (config.requireAnalystAdministrationScope || (config.administrationListOperation && operation === config.administrationListOperation)) {
  if (!hasHumanAnalystOperation(grants.explicitRoles, operation)) {
    return deny(policyContext, "CSRM Administration access is denied.");
  }
  policyContext.state.csrmAuthorization = { ...policyContext.state.csrmAuthorization, administrationCollectionScope: "all" };
  return true;
}
```
`HUMAN_ANALYST_ONLY_OPERATIONS` at line 41 (manual start joins it); `loadEffectiveGrants` 162; `hasHumanAnalystOperation` 212. Also cite 12-PATTERNS and 19-PATTERNS for this file's planned mods.

### Routes for new Admin APIs
**Analog:** `B/src/api/csrm-administration/routes/csrm-administration.ts` 1-40:
```ts
const policies = (operation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation, requireAnalystAdministrationScope: true } },
];
{ method: "PATCH", path: "/v1/risk_types/:riskTypeId", handler: "api::csrm-administration.csrm-administration.updateRiskType",
  config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.updateRiskType) } },
```
New config flag (proposed `requireAdminScope`) beside `requireAnalystAdministrationScope`. Folder layout `controllers/ routes/ services/ operations.ts` as `csrm-administration`.

### Schemas
**Analog:** `csrm-information-system/schema.json` (`"options": { "draftAndPublish": false }`, `owner` manyToOne `api::idambox-user.idambox-user`, unidirectional). New four types replace `"pluginOptions": {}` with `{ "content-manager": { "visible": false }, "content-type-builder": { "visible": false } }` (first use in the repo; RESEARCH §2).

### Seeds create-only (D-06)
**Analog:** `B/src/bootstrap/seed-csrm-data.ts` 343-375 `seedCsrmControls`: delete the `controlNeedsUpdate` branch (304-311, 361-367) so only `controlService.create` runs; keep the log line with `updated` removed. Role/persona seeding via `strapi.documents("api::role.role")` at 404; wrap in `runWithChangeSource("seed", …)` (RESEARCH §1).

### Manual start (D-22, D-23)
**Analogs:** `questionnaire-generation-workflow.ts` :31-36 (gate `requestStatus !== "submitted"`, `questionnaires.create`), `assessment-workflow.ts` `loadDraftTarget` :699-723, lock :744-751, create :753-765, request status :795-798. Reuse the eligibility functions; do not restate gates. Governance kinds: extend `GOVERNANCE_EVENT_KINDS` (questionnaire-governance-log.ts :26-33) in the same task (Pitfall 4). As planned by 12-05/12-06 (12-PATTERNS run record).

### Web page gate (SC4)
**Analog:** `W/app/(app)/app/admin/[collection]/page.tsx` 22-33:
```tsx
const sessionAdapter = getSessionAdapter();
const session = await sessionAdapter.current();
const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
if (!can('administration:manage', granted)) return <AdministrationAccessDenied kind={kind} />;
...
if (result.error?.status === 403) return <AdministrationAccessDenied kind={kind} />;
```
Every new static route copies this (capability check before any read; 403 from Strapi also renders the state), plus `resolveE2eUiState` fixture states. `generateMetadata` title `{h1} | IdamBox CSRM`.

### Server Actions
**Analog:** `W/src/features/administration/administration-actions.ts` 1-33: `'use server'`, zod schemas from `*-schema.ts`, service call, `revalidatePath`, result union:
```ts
export type AdministrationActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; values?: Record<string, unknown>; fieldErrors?: Record<string, string[]>; formError: string };
```
Client forms stay zod-free (domain module), per D-25 route budgets.

### Capabilities
**Analog:** `W/src/lib/capabilities/strapi-capabilities.ts` 13-24 (`capabilityAnchors`); split `'administration:manage'` into `reference-data:read` (the four `GET:/api/v1/...` list reads), `reference-data:manage`, `configuration:manage`, `access-review:read`. Update `capability-adapter.ts:1`, `development-capabilities.ts:8` (add `Admin`), tests `capability-adapter.test.ts:26`, `strapi-capabilities.test.ts:39`, `e2e-ui-state-route-authorization.test.tsx:73`. Navigation items `navigation.ts` 68-71 move to `reference-data:read`; new Administration group items follow the same object shape.

## Shared Patterns

- **Catalogue chain / matrix row per route / contract-gap record + checkpoint:** 17.1-PATTERNS (cite), harness role lookup `strapi-http-harness.ts` :515-517 gains `"Admin"`.
- **Transaction + after-commit store swap:** provisioning middleware's nested `strapi.db.transaction`; `onCommit` per RESEARCH §5.
- **Exports:** Phase 19 module (19-PATTERNS).
- **Refusal copy:** `W/src/lib/refusal-copy.ts` families (last changed by 19.1-08); add family AA.
- **Fixture ids:** proof loop in `B/tests/keycloak-identity.unit.test.ts` :278-288.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `W/src/features/configuration/band-preview-matrix.tsx` + setting editor with before/after confirmation (X-74/X-75) | component | New patterns; use UI-SPEC §6 and X-24/X-56 (18's conflict alert) |
| `W/src/features/lists/list-editor.tsx` (two-level, X-76) | component | No two-level editor exists; use UI-SPEC §7 |

## Metadata
**Search scope:** `apps/backend/src/{api,policies,keycloak,bootstrap,csrm}`, `apps/backend/tests`, `apps/csrm/{app,src}`, earlier phases' PATTERNS and PLAN files.
**Pattern extraction date:** 2026-10-01
