# Phase 6: Administration and CSV Imports - Research

**Researched:** 2026-09-01  
**Domain:** Strapi 5 authorised reference-data administration, Next.js App Router CRUD, and bounded CSV preview/commit workflows  
**Confidence:** HIGH

## User Constraints

The following operator-supplied orchestration context is locked for planning:

1. Do not replan foundations: token-only outer gate on every route (auth enabled + policy chain + exact catalogue grants in BOTH byte-identical catalogue copies); `/v1` route pattern; existing composites (`DataTable`, `PageHeader`, `DetailSection`, `FormSection`, `ConfirmDialog`, comboboxes, toasts); typed `openapi-fetch` services; dual-server Playwright harness with per-run unique ports/databases; triple-gated idempotent dev seeds with workflow facts only at creation. 2646 controls and risk types already seeded.
2. Backend: analyst-only admin CRUD (list search/filter/sort/pagination, detail, create, update, NO delete) for `csrm-risk-type`, `csrm-control`, `csrm-information-system`, `csrm-information-asset` via `/v1` routes and exact catalogue grants. Server-side natural-key uniqueness: Risk Type `name`, Control `controlNumber`, System `name`, Asset `name`, safe 409 conflicts. CSV import per collection. Deliberately decide contract shape; recommended validate/preview server-side endpoint returning per-row create/update/reject classifications keyed by natural key, then commit confirmed batch atomically per row with summary. Document new operations in `docs/contract-gaps/` under INT-01. Explicit file-size and row-count bounds. Schemas FROZEN. Requestors receive no admin routes.
3. Frontend: four list+detail areas and five-step CSV flow per UI spec; navigation capability-gated for analysts; add administration capability using existing config pattern; five deliberate states; typed services only; RHF+zod forms.
4. Tests: mounted tests for analyst-only access, Requestor denial, uniqueness 409, import create/update/reject classification, bounds. E2E: Bob administers each collection, creates plus edits in at least two collections, completes full CSV import happy and rejection path on one collection.
5. Environment: Node v24.19.0; live 1337/3000 servers must not be touched; Playwright owns derived ports/databases; test-integrity NON-NEGOTIABLE; `dylan-test`; no schema modifications; never push; no AI attribution.
6. Planning-only run. Stop after checked plans are committed; never execute.

The approved `06-UI-SPEC.md` is also a locked implementation contract: the exact routes, collection nouns, responsive behavior, five deliberate states, five-step CSV interaction, field grouping, copy, semantic tokens, and no-delete rule must be implemented without redesign. [VERIFIED: `.planning/phases/06-administration-and-csv-imports/06-UI-SPEC.md`]

## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| ADMIN-01 | A Security Analyst can list and create, view, or edit `CsrmRiskType` records without conflating them with contextual Risks. | Prescriptive `/v1/risk_types` query/detail/mutation contract, natural-key rules, Risk Type form fields, catalogue grants, and compatibility handling for the existing assessment picker are defined below. [VERIFIED: `.planning/REQUIREMENTS.md`; `docs/references/idambox-datamodel.jdl`] |
| ADMIN-02 | A Security Analyst can list and create, view, or edit reusable `CsrmControl` records without conflating them with control implementations. | Server-side pagination for the 2,646-record library, closed Control writable fields, no `sourceData` JSON editor, and read-only downstream-use context are defined below. [VERIFIED: `.planning/REQUIREMENTS.md`; `apps/strapi/src/api/csrm-control/content-types/csrm-control/schema.json`] |
| ADMIN-03 | A Security Analyst can list and create, view, or edit `CsrmInformationSystem` and `CsrmInformationAsset` records. | Frozen-schema field contracts, owner relation handling, list filters, uniqueness enforcement, and safe `/v1` route ownership are defined below. [VERIFIED: `.planning/REQUIREMENTS.md`; the two content-type schemas] |
| ADMIN-04 | A Security Analyst can import all four collections from CSV with guidance, client validation, preview, row errors, confirmation, and result summary. | A deliberate multipart preview/commit API, 5 MiB/5,000-row bounds, digest binding, row classification, per-row transactions, CSV parser configuration, and error semantics are defined below. [VERIFIED: `.planning/REQUIREMENTS.md`; `06-UI-SPEC.md`; official sources cited below] |

## Project Constraints (from AGENTS.md)

- Use Next.js App Router and strict TypeScript; prefer Server Components and use Client Components only for interaction. [VERIFIED: `AGENTS.md`]
- Use existing shadcn/ui primitives and semantic theme tokens; do not hard-code BProton colors; support mobile and desktop widths. [VERIFIED: `AGENTS.md`]
- Keep business/domain logic out of JSX and API calls behind the typed service layer; validate external input with shared schemas. [VERIFIED: `AGENTS.md`]
- Keep Strapi as the production API boundary; do not add a frontend API facade or raw page/component fetches. [VERIFIED: `AGENTS.md`]
- Keycloak authenticates and Strapi enforces Role -> Function -> FunctionAPI plus record-level authorization; navigation visibility is not authorization. [VERIFIED: `AGENTS.md`]
- Preserve JDL terminology; document contract/model gaps instead of inventing entities; do not alter the frozen content-type schemas. [VERIFIED: `AGENTS.md`; locked operator context]
- Add automated tests for every material workflow and introduce dependencies only for a concrete reason. [VERIFIED: `AGENTS.md`]
- Never commit secrets, move `node_modules`, silently merge nested Strapi history, push, or add AI attribution. [VERIFIED: `AGENTS.md`; locked operator context]

## Summary

Phase 6 should be implemented as one configuration-driven administration domain with four collection adapters, not as four unrelated CRUD implementations. The adapter owns natural key, fields, enums, list filters/sorts, projections, CSV columns, and route labels; common services own closed query parsing, list repositories, conflict mapping, CSV parsing/classification, and per-row commit. This yields the consistent UI and API behavior required by the locked design while keeping collection-specific facts explicit. [VERIFIED: `06-UI-SPEC.md`; `docs/CSRM-PROJECT-BRIEF.md` lines 401-435]

The most important integration issue is that `GET /api/v1/risk_types` and `GET /api/v1/controls` are already mounted by `csrm-risk` as unpaginated assessment-picker operations, but the authoritative FunctionAPI catalogue assigns those exact URLs to Administration. Existing assessment and Risk parsers require a strict `{ data: [...] }` response. Preserve no-query compatibility while making every Phase 6 administration call send canonical `page`, `pageSize`, and `sort`; the presence of administration query parameters selects the paginated `{ data, meta }` response. Add optional `meta` to the OpenAPI response and use a strict administration parser that requires it, while legacy no-query callers continue receiving the old envelope. Do not mount duplicate routes. [VERIFIED: `apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts`; `apps/web/src/features/assessments/assessment-service.ts`; `docs/references/specification.json`; catalogue]

CSV import should use `POST /v1/{collection}/import/preview` and the existing catalogue path `POST /v1/{collection}/import` for commit. Both accept the same bounded multipart CSV; preview returns a server SHA-256 digest, authoritative whole-file classifications and diffs, and commit requires the same bytes, digest, and explicit confirmation. Commit reparses and reclassifies current state, then runs one transaction per eligible row so an invalid/conflicting row is rejected without rolling back successful independent rows. [CITED: https://docs.strapi.io/cms/database-transactions] [CITED: https://openapi-ts.dev/openapi-fetch/api]

**Primary recommendation:** Build one closed, config-driven Administration service and UI feature; preserve the two existing picker responses deliberately; enforce analyst scope before parsing; use `csv-parse` 7.0.2 on client and server; and make preview/commit byte-bound, bounded, revalidated, and transactional per row. [VERIFIED: codebase and official sources listed below]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Analyst authorization and exact operation grant | API / Backend | Frontend Server | Strapi is authoritative; the Next server guard prevents disclosure and renders the locked permission state before service calls. [VERIFIED: `AGENTS.md`; `csrm-authorization.ts`; Risk Register page analog] |
| Search/filter/sort/pagination | API / Backend | Browser / Client | Strapi owns global query semantics and totals; URL state and `DataTable` only express and render the authoritative result. [VERIFIED: `06-UI-SPEC.md`; `risk-register.ts`; `risk-register.ts` backend service] |
| CRUD validation and natural-key uniqueness | API / Backend | Browser / Client | RHF+zod provides feedback, but the backend revalidates positive allowlists and uniqueness and returns safe field-addressable 409 errors. [VERIFIED: `AGENTS.md`; locked operator context] |
| CSV file selection and advisory parse | Browser / Client | Frontend Server | The File API, fatal UTF-8 decoding, step state, and early header/row feedback are client concerns; the Server Action transports the file through the typed boundary. [VERIFIED: `06-UI-SPEC.md`; official Next Server Actions docs] |
| CSV preview classification | API / Backend | Browser / Client | Strapi loads current natural keys and determines create/update/unchanged/rejected/ambiguous for the whole file; UI renders but does not authorize or decide persistence. [VERIFIED: `docs/CSRM-PROJECT-BRIEF.md` lines 419-435; resolved Phase 6 contract] |
| CSV commit | API / Backend | Database / Storage | Strapi revalidates and performs each eligible row in its own database transaction; the database persists the successful row or rolls it back. [CITED: https://docs.strapi.io/cms/database-transactions] |
| Templates/error/result reports | Browser / Client | API / Backend | Columns come from the shared contract; generated human-facing CSV must neutralize spreadsheet formula cells and quote correctly. [CITED: https://owasp.org/www-community/attacks/CSV_Injection] |

## Existing Analogs and Required Integration Points

| Concern | Exact analog / integration file | Planning implication |
|---|---|---|
| Token + policy route chain | `apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts` | Every administration route uses `auth: { strategies: ['content-api-token'] }`, then `global::csrm-app-enabled`, then `global::csrm-authorization` with an administration-scope flag and exact operation constant. [VERIFIED: codebase] |
| Human analyst collection scope | `apps/strapi/src/policies/csrm-authorization.ts` (`requireAnalystRiskRegisterScope`) | Add `requireAnalystAdministrationScope` and `administrationCollectionScope: 'all'`, using the existing exact human `Security Analyst` check. Services assert the scope again before caller-controlled lookup/query parsing. [VERIFIED: codebase] |
| Operation constants | `apps/strapi/src/api/csrm-risk/operations.ts` | Add a dedicated `csrm-administration/operations.ts`; constants contain catalogue notation with `{parameter}` while mounted paths use `:parameter`. [VERIFIED: codebase and catalogue] |
| Controller error mapping | `apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts` | Thin controller extracts route/body/file, calls service, and maps typed 400/403/404/409/413/415 errors; domain logic remains in services. [VERIFIED: codebase] |
| List repository | `apps/strapi/src/api/csrm-risk/services/risk-register-query.ts` and `risk-register.ts` | Reuse closed query parse -> count and ordered ID selection -> bounded hydrate -> preserve selected order. Map every sort field to a constant SQL column and bind all search/filter values. [VERIFIED: codebase] |
| Transactions | `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts` | Use `strapi.db.transaction`; Document Service calls inside inherit transaction context. [VERIFIED: codebase] [CITED: https://docs.strapi.io/cms/database-transactions] |
| Byte-identical catalogues | `apps/strapi/tests/authorization.integration.test.ts` | Edit `docs/references/idambox-csrm-role-function-api-catalogue.json`, copy the exact bytes to the bootstrap copy, and retain the byte-comparison assertion. Add exact one-grant and no-admin-delete assertions. [VERIFIED: codebase] |
| Contract gap convention | `docs/contract-gaps/phase-05-risk-register-date-filter.md` | Add `docs/contract-gaps/phase-06-administration-import-contract.md` describing operations, compatibility branch, bounds, normalization, statuses, and frozen-schema uniqueness limitation under INT-01. [VERIFIED: codebase] |
| OpenAPI generation | `apps/web/package.json` scripts `api:generate` and `api:check` | Add `/v1` operations/schemas to `specification.json`, regenerate `schema.d.ts`, and make `api:check` green. [VERIFIED: codebase] |
| Typed server transport | `apps/web/src/features/risks/risk-service.ts`; `src/lib/api/transport/server-client.ts` | New `administration-service.ts` is `server-only`, calls literal generated paths with `openapi-fetch`, uses a multipart `bodySerializer`, and strictly parses returned DTOs. [VERIFIED: codebase] [CITED: https://openapi-ts.dev/openapi-fetch/api] |
| Server actions | `apps/web/src/features/requests/request-actions.ts`; `risk-actions.ts` | Validate action input, map 409 to the natural-key field, revalidate list/detail only after success, and return safe structured errors. File preview/commit actions accept `FormData`. [VERIFIED: codebase] |
| Route gating | `apps/web/app/(app)/app/risks/page.tsx` and `[documentId]/page.tsx` | Resolve `administration:manage` before any collection service call; denied list/detail/create/import routes show only the non-enumerating permission state. [VERIFIED: codebase] |
| URL-driven list | `apps/web/src/features/risks/risk-schema.ts`, `risk-register.tsx`, `risk-register-filters.tsx` | Reuse closed URL parsing, canonical serialization, `DataTable` manual modes, mobile cards, server totals, stable ordering, loading/error/empty/permission slots. Extend page size to the locked 100 option. [VERIFIED: codebase; `06-UI-SPEC.md`] |
| Forms | `apps/web/src/features/requests/request-form.tsx`; `risk-detail-editor.tsx` | Reuse RHF `mode: 'onBlur'`, zod resolver, `FormSection`, pending state, field errors, alerts/toasts, and `ConfirmDialog`; add the locked multi-error focus/summary behavior. [VERIFIED: codebase; `06-UI-SPEC.md`] |
| Navigation | `apps/web/src/config/navigation/navigation.ts`; `capability-navigation.tsx`; `app-shell.tsx` | Add singular capability `administration:manage`, grant only the development Security Analyst, and extend the flat navigation model/rendering with an Administration group containing four links. [VERIFIED: codebase; `06-UI-SPEC.md`] |
| Mounted HTTP tests | `apps/strapi/tests/helpers/strapi-http-harness.ts`; `risk-register.integration.test.ts` | Extend the isolated harness with administration fixtures/helpers and mounted requests; never call localhost 1337. [VERIFIED: codebase] |
| Dual-server E2E | `apps/web/playwright.config.ts`; `e2e/risk-register-workflow.spec.ts`; `e2e/harness-urls.ts` | Retain derived loopback ports, process-unique SQLite/Next directories, `reuseExistingServer:false`, Node/Corepack pnpm entry point, Bob/Jane sign-in baselines, responsive and axe checks. [VERIFIED: codebase] |
| Seed invariants | `seed-risk-register-workflow.ts`; `seed-assessment-workflow.ts` | If Phase 6 needs stable mutable admin fixtures, add a separate triple-gated, serialized, stable-key seed; creation owns initial editable facts and repeat runs must not overwrite analyst edits. Do not recreate or modify the 2,646 Control library. [VERIFIED: codebase; locked operator context] |

## Standard Stack

### Core

| Library / facility | Version | Purpose | Why Standard |
|---|---:|---|---|
| Node.js | 24.19.0 | Runtime and test orchestration | Locked runtime and currently installed executable. [VERIFIED: environment probe; root `package.json`] |
| Strapi | 5.51.0 | Production API, policies, Document Service, transactions | Existing production boundary; custom routes/controllers/services and transactions are officially supported. [VERIFIED: `apps/strapi/package.json`] [CITED: https://docs.strapi.io/cms/backend-customization/routes] |
| Next.js App Router | 16.3.3 | Server-gated routes and Server Actions | Locked frontend architecture; Server Actions carry client-selected files to the server-only typed transport without a frontend API facade. [VERIFIED: `apps/web/package.json`] [CITED: https://nextjs.org/docs/app/getting-started/mutating-data] |
| TypeScript | 5.9.3 | Strict cross-tier implementation | Strict mode is mandatory and already configured. [VERIFIED: `AGENTS.md`; `apps/web/package.json`] |
| Zod | 4.4.3 | Closed DTO, URL, form, and CSV row validation | Existing trust-boundary pattern across web features. [VERIFIED: `apps/web/package.json`; feature schemas] |
| React Hook Form + resolvers | 7.86.0 + 5.9.1 | Create/edit form behavior | Explicitly locked by the UI contract and already installed. [VERIFIED: `apps/web/package.json`; `06-UI-SPEC.md`] |
| openapi-fetch | 0.17.0 | Literal-path typed Strapi transport | Existing service boundary; official API supports custom FormData serialization for multipart. [VERIFIED: `apps/web/package.json`] [CITED: https://openapi-ts.dev/openapi-fetch/api] |
| `csv-parse` | 7.0.2 | Standards-capable CSV parse in Node and browser ESM | One parser can enforce identical quoting/BOM/record-width behavior at both boundaries; browser ESM and bounded record options are officially documented. [VERIFIED: npm registry] [CITED: https://csv.js.org/parse/distributions/browser_esm/] |

### Supporting

| Library / component | Version | Purpose | When to Use |
|---|---:|---|---|
| Existing CSRM composites | repository | Tables, sections, dialogs, states | Use for every list/detail/form and extend only shared behavior. [VERIFIED: `apps/web/src/components/csrm/`] |
| shadcn/Radix/Lucide/sonner | installed repository versions | Accessible primitives, icons, feedback | Use only installed official primitives listed in the UI contract; add no CSV UI kit. [VERIFIED: `06-UI-SPEC.md`; `apps/web/package.json`] |
| `@tanstack/react-table` | 9.2.4 | Manual table model | Existing `DataTable` already sets manual filtering/sorting/pagination and authoritative row count. [VERIFIED: `data-table.tsx`; package manifest] |
| Vitest / Testing Library | 4.0.18 / 16.3.0 | Web schema, service, component, mounted UI tests | Quick per-task web checks. [VERIFIED: `apps/web/package.json`] |
| Node test runner | Node 24.19.0 | Strapi unit and mounted integration tests | Existing Strapi suite compiles then runs `node --test`. [VERIFIED: `apps/strapi/package.json`] |
| Playwright + axe | 1.58.2 / 4.11.0 | Isolated analyst/Requestor browser journey and accessibility | Phase gate using existing dual-server harness. [VERIFIED: `apps/web/package.json`; Playwright config] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| `csv-parse` | Hand-written `split(',')` parser | Rejected: quoting, embedded newlines, escaped quotes, BOM, and record-width rules are deceptively complex and security-sensitive. [CITED: https://csv.js.org/parse/] |
| Multipart file transport | JSON containing CSV text | Rejected: Strapi JSON defaults to 1 MiB and JSON escaping inflates CSV; multipart is already supported by Strapi body middleware and `openapi-fetch`. [CITED: https://docs.strapi.io/cms/configurations/middlewares] [CITED: https://openapi-ts.dev/openapi-fetch/api] |
| Preview registry/result table | Digest-bound repeat upload | Use digest-bound repeat upload for MVP because schemas are frozen and no durable import entity exists; this deliberately means results are not refresh-persistent. [VERIFIED: locked frozen-schema constraint; `06-UI-SPEC.md` allows persistence only when backend supports it] |
| Content-type lifecycle uniqueness hook | Explicit administration domain service | Use the service: it can return field-addressable 409s, classify without mutation, and transact each row. Core mutation routes are removed, so production mutations are centralized without surprising seed/internal Document Service writes. [VERIFIED: current routers and seed services] |

**Installation:**

```bash
corepack pnpm --filter @csrm/web add csv-parse@7.0.2
corepack pnpm --filter @csrm/strapi add csv-parse@7.0.2
```

The package must be a direct dependency of both workspaces because the browser ESM import is bundled from web and the server parser runs in Strapi. [CITED: https://csv.js.org/parse/distributions/browser_esm/]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Postinstall | Disposition |
|---|---|---:|---:|---|---|---|---|
| `csv-parse` 7.0.2 | npm | package created 2013-10-25; version published 2026-08-02 | 19,061,702/week for 2026-08-23..29 | `github.com/adaltas/node-csv` | OK | none declared | Approved; official docs name the package and browser paths. [VERIFIED: npm registry] [CITED: https://csv.js.org/parse/] |

**Packages removed due to slopcheck `[SLOP]` verdict:** none. [VERIFIED: slopcheck run 2026-09-01]  
**Packages flagged as suspicious `[SUS]`:** none. [VERIFIED: slopcheck run 2026-09-01]

## Recommended API Contract

### Route and grant matrix

Use exact operation strings below, with mounted paths replacing braces by Strapi `:parameter` syntax. All routes use the content API token strategy plus the two-policy chain; every service action additionally asserts `administrationCollectionScope === 'all'`. [VERIFIED: existing route/policy pattern]

| Collection | List/Create | Detail/Update | Preview | Commit |
|---|---|---|---|---|
| Risk Types | `GET|POST:/api/v1/risk_types` | `GET|PATCH:/api/v1/risk_types/{riskTypeId}` | `POST:/api/v1/risk_types/import/preview` | `POST:/api/v1/risk_types/import` |
| Controls | `GET|POST:/api/v1/controls` | `GET|PATCH:/api/v1/controls/{controlId}` | `POST:/api/v1/controls/import/preview` | `POST:/api/v1/controls/import` |
| Systems | `GET|POST:/api/v1/information_systems` | `GET|PATCH:/api/v1/information_systems/{informationSystemId}` | `POST:/api/v1/information_systems/import/preview` | `POST:/api/v1/information_systems/import` |
| Assets | `GET|POST:/api/v1/information_assets` | `GET|PATCH:/api/v1/information_assets/{informationAssetId}` | `POST:/api/v1/information_assets/import/preview` | `POST:/api/v1/information_assets/import` |

Do not mount a DELETE route. Remove the four existing Administration delete FunctionAPI entries (`risk_type_details.api.03`, `control_details.api.03`, `information_system_details.api.03`, `information_asset_details.api.03`) from both catalogue copies and their owning `functionApiIds` arrays without renumbering surviving IDs. Add one preview FunctionAPI to each list/import Function while retaining each existing `.api.03` import URL as commit. Assert Requestor functions contain none of these operations. [VERIFIED: authoritative catalogue currently contains the four delete entries and four commit paths]

Disable generic core mutation/delete exposure: Risk Type and Control core routers should mount no generic content routes; System and Asset core routers should retain only the already-authorised generic `find` used as Requestor reference data. Administration uses only `/v1`. [VERIFIED: current four core routers; `request-service.ts` uses generic System/Asset lists]

### List contract

Every administration list call supplies `page`, `pageSize`, and `sort`; valid page sizes are 10, 25, 50, 100, default 25. Query strings are closed, duplicate scalar parameters are rejected by Strapi, search is trimmed to 200 characters, filter values are allowlisted, and sort maps through a constant field table. Search/filter changes reset page in the web URL. [VERIFIED: `06-UI-SPEC.md`; Risk Register query analog]

Response:

```json
{
  "data": [{ "documentId": "opaque", "name": "Example", "updatedAt": "2026-09-01T00:00:00.000Z" }],
  "meta": { "pagination": { "page": 1, "pageSize": 25, "pageCount": 1, "total": 1 } }
}
```

Count and selected page must share one pre-pagination predicate. Order by the requested field, then the collection natural key, then `document_id` as the final deterministic tie-break. Controls must search `control_number`, `name`, and `framework` and filter framework/type entirely before count and pagination. [VERIFIED: `06-UI-SPEC.md`; `risk-register.ts` repository analog]

For `/v1/risk_types` and `/v1/controls` only, an entirely absent query retains the existing picker `{ data: [...] }` response. Administration always supplies canonical pagination, and the OpenAPI response models `meta` as optional for compatibility. Do not infer admin totals from the legacy response. [VERIFIED: existing strict assessment picker clients and existing routes]

### CRUD DTOs and natural keys

| Collection | Natural key | Create/update allowlist | CSV allowlist |
|---|---|---|---|
| Risk Type | `name` | `name`, `description`, `applicableControls` (distinct Control documentIds, bounded to 1,000) | `name`, `description`; relations remain manual form edits. [VERIFIED: schema/JDL] |
| Control | `controlNumber` | `controlNumber`, `name`, `description`, `controlType`, `controlReference`, `framework`, `frameworkVersion`, `frameworkSource` | Same scalar fields; exclude `sourceData`. [VERIFIED: schema/JDL; UI spec] |
| Information System | `name` | `name`, `description`, `systemType`, `owner`, `environment`, `deploymentModel`, `businessCriticality`, `internetFacing`, `externalAccessRequired`, `hostingLocation`, `lifecycleState` | Same scalar fields except `owner`; owner remains a manual active-user selection. [VERIFIED: schema/JDL; UI spec] |
| Information Asset | `name` | `name`, `description`, `location`, `type`, `dataClassification`, `confidentialityRating`, `integrityRating`, `availabilityRating`, `containsPersonalData`, `containsLegalData`, `containsCreditCardData`, `comments` | Same scalar fields. [VERIFIED: schema/JDL] |

Reject unknown keys and all `id`, `documentId`, timestamps, downstream relations, contextual Risk/ControlImplementation data, and `sourceData`. Resolve supplied relation documentIds server-side and project only closed DTOs. Create returns 201, update/detail/list return 200, denied returns safe 403, unknown ID returns non-enumerating 404, and natural-key conflict returns 409 with `{ code: 'NATURAL_KEY_CONFLICT', field, message }`. [VERIFIED: existing workflow allowlist/error patterns]

Normalize every natural key for comparison with `value.trim().normalize('NFKC').toLocaleLowerCase('en-AU')`, while persisting the trimmed display value. Direct edit may rename a key only when the normalized target is unused. Import uses the key only for lookup and does not change its spelling/casing on update. [RECOMMENDED: contract-defined normalization required by locked UI]

Risk Type and Control have frozen `unique: true` schema attributes; System and Asset do not. Use a module-level serialized mutation queue per collection plus a transaction that rechecks the normalized key immediately before every create/update. Map both application matches and database unique errors to the same safe 409. This is deterministic for the project’s single Strapi process and mounted concurrency tests, but cannot provide cross-process uniqueness for System/Asset without a database constraint, which the frozen-schema rule forbids; record that limitation in the contract gap. [VERIFIED: four frozen schemas; existing serialized seed pattern] [CITED: https://docs.strapi.io/cms/database-transactions]

### CSV columns and value semantics

Use the scalar CSV allowlists above. Required columns are exactly those locked in the UI spec: `name`; `controlNumber,name,framework`; `name`; `name`. Normalize header BOM/outer whitespace/case to canonical field names, reject duplicate normalized or unknown headers at file level, and reject structurally wider/shorter rows. [VERIFIED: `06-UI-SPEC.md`] [CITED: https://csv.js.org/parse/options/columns/]

- Parse UTF-8 with fatal decoding in the browser; the server treats malformed input as invalid rather than silently replacing bytes. Enable `bom:true`, keep `relax_column_count:false`, set `max_record_size:65_536`, and retain row/line info. [CITED: https://csv.js.org/parse/options/] [CITED: https://csv.js.org/parse/options/bom/]
- Maximum file size is **5 MiB (5,242,880 bytes)** and maximum data rows are **5,000**, excluding the single header row. Configure Next Server Actions to 6 MiB and Strapi formidable to 5 MiB plus minimal multipart overhead as appropriate, but retain explicit application checks and exact user-facing limits. Next Server Actions default to 1 MiB, so the config change is required. [CITED: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions] [CITED: https://docs.strapi.io/cms/configurations/middlewares]
- Required cells are trimmed and non-empty. Enums accept case-insensitive matches to the exact persisted display values and store the canonical enum. Booleans accept only case-insensitive `true` or `false`. [RECOMMENDED: closed frozen-schema mapping]
- Empty optional cells mean “leave unchanged” for updates and “omit/use schema default” for creates. CSV cannot clear an optional field in MVP; manual edit can. State this in Guidance and template notes. [RECOMMENDED: prevents accidental bulk erasure]
- Any normalized natural key appearing more than once in the CSV makes every occurrence `ambiguous`, even if rows are byte-identical. Multiple existing normalized matches also produce `ambiguous`; never pick a winner. [RECOMMENDED: deterministic duplicate safety]
- A syntactically valid unmatched row is `create`; a single existing match with at least one changed writable value is `update`; a single match with no writable-field changes is first-class `unchanged` with no write; field failures are `rejected`. Duplicate normalized keys or multiple existing matches are `ambiguous`. These five states remain distinct in preview DTOs, counts, rows, commit results, UI badges/filters/summaries, and tests. [RESOLVED: five-state Phase 6 contract]

### Preview request and response

`multipart/form-data` fields: `file` (required binary), `fileName` (sanitized display name or derive from file), and no client classifications. Server authorizes before inspecting file name, size, headers, counts, or natural keys. [CITED: https://openapi-ts.dev/openapi-fetch/api] [VERIFIED: non-enumerating project authorization pattern]

Preview returns 200 even when all rows are rejected/ambiguous:

```json
{
  "data": {
    "fileName": "controls.csv",
    "previewDigest": "sha256:...",
    "limits": { "maxBytes": 5242880, "maxRows": 5000 },
    "summary": { "create": 2, "update": 1, "unchanged": 1, "rejected": 1, "ambiguous": 0 },
    "rows": [
      {
        "rowNumber": 2,
        "state": "update",
        "naturalKey": "CTRL-1",
        "matchedDocumentId": "opaque",
        "values": { "controlNumber": "CTRL-1", "name": "Updated", "framework": "Local" },
        "changes": [{ "field": "name", "before": "Old", "after": "Updated" }],
        "issues": []
      }
    ]
  }
}
```

Bound each issue message, each field, and total response size; rows are returned in original CSV order and can be honestly paginated/virtualized in the browser because the complete bounded classification is present. Never return raw unparsed file content. [RECOMMENDED: UI whole-file totals and bounded trust boundary]

### Commit request, processing, and response

Commit repeats the same file and includes `previewDigest` and `confirmed=true`. Reject digest mismatch with 409 and perform no writes. Reparse and reclassify against current database state; do not trust preview rows, client counts, documentIds, or values. [RECOMMENDED: binds explicit review to bytes while retaining server authority]

Process eligible rows sequentially. For each row, enter the collection mutation queue and a fresh `strapi.db.transaction`, recheck normalized uniqueness/current record, then create or update. Expected validation/conflict failures roll back only that row and become a final rejected result; successful rows commit independently. A fatal infrastructure exception stops processing and returns an error without claiming the unprocessed or already-committed outcome. [CITED: https://docs.strapi.io/cms/database-transactions]

Successful or partially successful processing returns 200 with server-authoritative `created`, `updated`, `unchanged`, `rejected`, and `ambiguous` counts and a final row result containing `documentId` only for created/updated rows. `unchanged` rows perform no write and remain distinct from validation failures. Include `previewChanged` count when commit classification differs. A fully invalid file fails before writes; partial row rejection is not an HTTP failure. [VERIFIED: locked UI Results contract plus resolved five-state classification]

Failure status semantics:

| Status | Meaning | Write guarantee |
|---:|---|---|
| 400 | malformed multipart/CSV/header/required contract | no writes |
| 403 | no explicit human analyst administration scope | authorization runs before parse; no file facts disclosed and no writes |
| 409 | preview digest/file mismatch or direct CRUD natural-key conflict | no import writes for digest mismatch; no CRUD write for conflict |
| 413 | file exceeds 5 MiB or data rows exceed 5,000 | no writes |
| 415 | no CSV extension or supplied non-CSV media type | no writes |
| 500/503 | fatal infrastructure failure | outcome may be partial because rows commit independently; UI must use the locked unknown-outcome copy and direct the analyst to the collection |

No import-result persistence or status endpoint is recommended in this frozen-schema MVP. Do not auto-retry commit after a lost response. [VERIFIED: frozen schemas; `06-UI-SPEC.md` unknown-outcome requirement]

## Architecture Patterns

### System Architecture Diagram

```text
Security Analyst browser
  -> Next route Server Component
     -> administration:manage presentation guard
        denied -> non-enumerating permission state
        allowed -> server-only typed administration service
          -> openapi-fetch + API token + development identity bridge
             -> Strapi /api/v1 administration route
                -> content-api-token outer gate
                -> csrm-app-enabled policy
                -> exact FunctionAPI + human analyst administration scope
                   -> closed query/body/file parser
                      CRUD/list -> collection adapter -> repository -> SQLite
                      preview -> CSV parser -> natural-key snapshot -> classifications -> browser review
                      commit -> digest check -> reparse/reclassify
                        -> for each eligible row: mutation queue -> Strapi transaction -> create/update/rollback
                        -> authoritative summary -> Results step
```

[VERIFIED: existing route/transport/policy architecture; official transaction and multipart docs]

### Recommended Project Structure

```text
apps/strapi/src/api/csrm-administration/
├── controllers/csrm-administration.ts
├── routes/csrm-administration.ts
├── operations.ts
└── services/
    ├── administration-config.ts
    ├── administration-query.ts
    ├── administration-repository.ts
    ├── administration-workflow.ts
    └── csv-import.ts

apps/web/src/features/administration/
├── administration-config.ts
├── administration-schema.ts
├── administration-service.ts
├── administration-actions.ts
├── administration-list.tsx
├── administration-form.tsx
├── administration-detail.tsx
├── csv-import-schema.ts
├── csv-client-parser.ts
└── csv-import-flow.tsx

apps/web/app/(app)/app/admin/
├── risk-types/{page,new/[documentId],import}
├── controls/{page,new/[documentId],import}
├── information-systems/{page,new/[documentId],import}
└── information-assets/{page,new/[documentId],import}
```

The Strapi custom API contains no content type and therefore does not change frozen schemas; it coordinates the four existing UIDs. Strapi 5.51.0's installed API loader registers route/controller/service-only API directories and treats a missing `content-types` directory as an empty content-type map. Remove the two duplicate `/v1` picker route declarations from `csrm-risk` only when the central administration router assumes those same exact operations. [VERIFIED: installed `@strapi/core` 5.51.0 `dist/loaders/apis.mjs`] [CITED: https://docs.strapi.io/cms/backend-customization/routes]

### Pattern 1: Closed collection adapter

**What:** A discriminated configuration maps a fixed collection key to UID, table, natural key, allowed fields, enums, filters, sorts, CSV columns, and projection functions. No caller supplies UID/table/column names. [RECOMMENDED: avoids four copies and dynamic injection]

```typescript
type AdministrationKind = 'risk-types' | 'controls' | 'information-systems' | 'information-assets';

const ADMINISTRATION = {
  controls: {
    uid: 'api::csrm-control.csrm-control',
    table: 'csrm_controls',
    naturalKey: 'controlNumber',
    naturalKeyColumn: 'control_number',
    defaultSort: 'controlNumber:asc',
  },
  // three explicit adapters; never accept a runtime UID/table name
} as const satisfies Record<AdministrationKind, AdministrationConfig>;
```

### Pattern 2: Route authorization before parsing

```typescript
const policies = (operation: string) => [
  'global::csrm-app-enabled',
  { name: 'global::csrm-authorization', config: { operation, requireAnalystAdministrationScope: true } },
];

{
  method: 'POST',
  path: '/v1/controls/import/preview',
  handler: 'api::csrm-administration.csrm-administration.previewControls',
  config: { auth: { strategies: ['content-api-token'] }, policies: policies(ADMIN_OPERATIONS.controls.preview) },
}
```

[VERIFIED: adapted from `csrm-risk/routes/csrm-risk.ts` and Strapi route docs]

### Pattern 3: Shared browser/server CSV parser options

```typescript
import { parse } from 'csv-parse/browser/esm/sync'; // browser feature service
// Strapi uses: import { parse } from 'csv-parse/sync'

const records = parse(text, {
  bom: true,
  columns: (headers) => normalizeAndValidateHeaders(headers, contract),
  info: true,
  max_record_size: 65_536,
  relax_column_count: false,
  skip_empty_lines: false,
  trim: false,
});
```

[CITED: https://csv.js.org/parse/distributions/browser_esm/] [CITED: https://csv.js.org/parse/options/]

### Pattern 4: Typed multipart transport

```typescript
return client.POST('/v1/controls/import/preview', {
  body: { file },
  bodySerializer(body) {
    const form = new FormData();
    form.append('file', body.file);
    return form;
  },
});
```

Do not set `Content-Type` manually; returning FormData allows fetch to add the boundary. [CITED: https://openapi-ts.dev/openapi-fetch/api]

### Anti-Patterns to Avoid

- **Four copy-pasted feature stacks:** collection differences belong in explicit adapters; behavior belongs in common services/components. [RECOMMENDED: maintainability rule]
- **Generic dynamic UID/table from route input:** use a closed compile-time map only. [RECOMMENDED: injection prevention]
- **Core router CRUD or DELETE left mounted:** this bypasses the exact `/v1` contract/no-delete promise. [VERIFIED: current core routers expose delete]
- **Authorization after parse/read:** denied callers must not learn file validity, natural-key matches, totals, or record existence. [VERIFIED: locked permission contract]
- **Client preview as commit input:** upload the same file again and revalidate; never accept client-classified rows or matched IDs. [VERIFIED: project brief]
- **Batch-wide transaction:** one bad row would roll back unrelated successes and contradict per-row atomic results. [VERIFIED: locked operator contract]
- **Parallel row mutations:** it complicates natural-key ordering/conflict safety; sequential per-row commits are bounded to 5,000 and deterministic. [RECOMMENDED]
- **Loading all 2,646 Controls in an admin browser list:** count/search/filter/sort/page on the server. [VERIFIED: `06-UI-SPEC.md`]
- **CSV spreadsheet editor:** correction happens in the source file and re-upload. [VERIFIED: `06-UI-SPEC.md`]
- **Quotes-only CSV export safety:** generated error/result reports containing untrusted cells must neutralize formula-leading cells in addition to correct CSV quoting. [CITED: https://owasp.org/www-community/attacks/CSV_Injection]

## Code Examples

Verified implementation shapes the planner should reference directly:

### Deterministic natural-key normalization

```typescript
export function normalizeNaturalKey(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase('en-AU');
}
```

Apply this comparison key consistently in form CRUD, preview, commit, and duplicate-row detection, while persisting the trimmed display value rather than the folded comparison key. [RECOMMENDED: deliberate Phase 6 contract]

### One transaction per eligible CSV row

```typescript
for (const row of eligibleRows) {
  try {
    const outcome = await strapi.db.transaction(async () => {
      await assertNaturalKeyStillAvailable(row);
      return applyCreateOrUpdate(row);
    });
    results.push({ row: row.number, status: outcome.kind });
  } catch (error) {
    results.push(toSafeRejectedResult(row.number, error));
  }
}
```

Document Service operations called inside the callback inherit the transaction context. Keep the loop sequential so duplicate handling and result order are deterministic. [CITED: https://docs.strapi.io/cms/database-transactions] [RECOMMENDED: bounded per-row atomicity contract]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| CSV grammar | Comma/newline splitting | `csv-parse` 7.0.2 | Handles quoted commas/newlines, escaped quotes, BOM, strict column counts, row info, and record limits. [CITED: https://csv.js.org/parse/] |
| Typed multipart | Raw `fetch` and hand-set boundaries | Generated `openapi-fetch` path plus `bodySerializer` returning FormData | Preserves the contract and correct boundary handling. [CITED: https://openapi-ts.dev/openapi-fetch/api] |
| Transactions | Manual compensation or direct connection juggling | `strapi.db.transaction` around one row | Document Service calls inherit transaction context and rollback on throw. [CITED: https://docs.strapi.io/cms/database-transactions] |
| Tables/forms/dialogs/states | New primitives | Existing CSRM composites and installed shadcn primitives | Locked UI and repository patterns already cover these behaviors. [VERIFIED: `06-UI-SPEC.md`] |
| Authorization | Component role string checks | `administration:manage` presentation capability plus exact Strapi FunctionAPI scope | Navigation is usability; Strapi remains authority. [VERIFIED: `AGENTS.md`] |
| CSV report generation | String concatenation | A small wrapper around the same CSV ecosystem or rigorously tested shared serializer | Quoting and formula neutralization must be consistent; if `csv-stringify` is proposed later it requires a separate legitimacy gate. [CITED: https://owasp.org/www-community/attacks/CSV_Injection] |

**Key insight:** the difficult part is not rendering four forms; it is preserving one authoritative, bounded, non-enumerating contract across list queries, natural-key races, preview/commit drift, existing picker compatibility, and generated reports. [VERIFIED: codebase integration findings]

## Common Pitfalls

### Pitfall 1: Breaking existing assessment picker calls
**What goes wrong:** Changing `/v1/risk_types` or `/v1/controls` to always paginate/add required metadata breaks strict existing parsers and may reduce Control choices to 25. [VERIFIED: `assessment-service.ts`; `assessment-schema.ts`]  
**How to avoid:** Preserve the no-query legacy response and require canonical query parameters for Administration; add optional OpenAPI meta and separate strict parsers. [RECOMMENDED]  
**Warning signs:** Phase 4/5 component tests fail, or mitigation forms show only the first page. [VERIFIED: existing consumers]

### Pitfall 2: Catalogue and mounted routes disagree
**What goes wrong:** A route has no exact grant, stale delete grants remain, or the bootstrap/reference catalogues diverge byte-wise. [VERIFIED: catalogue integration test]  
**How to avoid:** Update operation constants, both copies byte-identically, function membership, and exact one-grant/no-delete tests in one task. [RECOMMENDED]  
**Warning signs:** 403 for Bob, catalogue duplicate counts, or byte-compare failure.

### Pitfall 3: Relying on frozen schema uniqueness
**What goes wrong:** System/Asset `name` is not schema-unique; preflight-only checks race and existing case variants can be multiple matches. [VERIFIED: frozen schemas]  
**How to avoid:** Normalized query, serialized mutation queue, transaction recheck, ambiguous preview classification, and documented multi-process limitation. [RECOMMENDED]  
**Warning signs:** concurrent creates both succeed or preview chooses between two matches.

### Pitfall 4: Preview/commit time-of-check drift
**What goes wrong:** Another mutation changes a match after preview; blindly applying preview IDs overwrites the wrong current state. [RECOMMENDED threat model]  
**How to avoid:** Digest-bind reviewed bytes but reclassify current database state at commit and surface `previewChanged`. [RECOMMENDED]  
**Warning signs:** commit accepts client documentIds/counts or does not reload natural keys.

### Pitfall 5: Limits exist only in UI
**What goes wrong:** Direct callers bypass size/row limits, or parser record buffers are unbounded. [CITED: OWASP ASVS 5 V5.1/V5.2]  
**How to avoid:** Align browser validation, Next body limit, Strapi multipart limit, application byte/row checks, and `max_record_size`; test cap and cap+1. [CITED: https://csv.js.org/parse/options/max_record_size/]

### Pitfall 6: Empty CSV cells erase data
**What goes wrong:** Bulk updates turn omitted knowledge into null/false. [RECOMMENDED threat model]  
**How to avoid:** Blank optional means unchanged on update and omitted/default on create; clearing is manual-only in MVP. [RECOMMENDED]

### Pitfall 7: Generated reports execute formulas
**What goes wrong:** A natural key/name beginning with formula characters is interpreted by spreadsheet software. [CITED: https://owasp.org/www-community/attacks/CSV_Injection]  
**How to avoid:** Neutralize every untrusted output cell for human-facing downloads and test `=`, `+`, `-`, `@`, tab, CR, LF, and full-width variants. [CITED: same]

### Pitfall 8: File upload passes through Next’s default 1 MiB limit
**What goes wrong:** Valid files fail before the action, while the UI advertises 5 MiB. [CITED: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions]  
**How to avoid:** Set `experimental.serverActions.bodySizeLimit: '6mb'` in the existing typed Next config and retain application 5 MiB enforcement. [CITED: same]

### Pitfall 9: Seeds overwrite administration acceptance edits
**What goes wrong:** E2E reload/restart restores seeded fields after Bob edits them. [VERIFIED: Phase 5 seed decisions]  
**How to avoid:** Stable-key create facts only; repeat reconciliation repairs only safe relationships/presentation when explicitly required and never mutable admin evidence. [VERIFIED: `seed-risk-register-workflow.ts`]

## State of the Art

| Old/current approach | Phase 6 approach | Impact |
|---|---|---|
| Generic Strapi core CRUD for four content types | Exact `/v1` custom administration operations; generic mutation/delete disabled | Closed DTOs, safe errors, and exact grants. [VERIFIED: current routers and locked direction] |
| Unpaginated `/v1` Risk Type/Control picker lists | Compatibility no-query branch plus paginated admin query branch | Avoids regression while providing honest admin totals. [VERIFIED: current route collision] |
| Browser-only import concept in catalogue | Server preview + confirmed digest-bound commit | Final validation and matching remain authoritative. [VERIFIED: project brief and locked direction] |
| Handled-as-one import | Per-row transaction with whole-file summary | Independent valid rows persist; rejected rows do not. [CITED: Strapi transaction docs] |
| ASVS 4 category assumptions | ASVS 5.0.0 V2 Validation, V5 File Handling, V8 Authorization, V16 Logging/Error | Use current stable category names and controls. [CITED: https://github.com/OWASP/ASVS] |

**Deprecated/outdated:**

- Do not use `require('csv-parse/lib/sync')`; current package exports `csv-parse/sync` and `csv-parse/browser/esm/sync`. [CITED: https://csv.js.org/parse/changelog/]
- Do not add a Next Route Handler as a frontend API facade; Server Actions call the existing server-only typed Strapi service. [VERIFIED: `AGENTS.md`; existing action/service pattern]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---:|---|
| Node.js | all builds/tests | yes | 24.19.0 | none; locked [VERIFIED: environment probe] |
| Corepack pnpm | workspace commands | yes | 11.24.0 | invoke through the active Node Corepack JS entry in Playwright/wrappers [VERIFIED: environment probe; Playwright config] |
| npm registry | package verification | yes | npm CLI 11.17.0 | lockfile/codebase if temporarily offline [VERIFIED: environment probe] |
| Git | research/plan commits and integrity | yes | 2.50.1.windows.1 | none [VERIFIED: environment probe] |
| SQLite / better-sqlite3 | mounted and E2E data | yes | better-sqlite3 12.8.0 | isolated per-run DB only [VERIFIED: Strapi package/config] |
| Strapi/Next dev servers | E2E only | launched by Playwright | repository versions | never reuse live 1337/3000 [VERIFIED: Playwright config; locked context] |
| `csv-parse` | implementation | not installed | recommended 7.0.2 | none; do not hand-roll [VERIFIED: manifests and npm registry] |

**Missing dependencies with no fallback:** `csv-parse` 7.0.2 must be added to both workspaces before CSV implementation. [VERIFIED: manifests]  
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Backend unit/integration | TypeScript compile + Node 24 test runner; mounted Strapi HTTP harness [VERIFIED: `apps/strapi/package.json`] |
| Web unit/component | Vitest 4.0.18 + Testing Library [VERIFIED: `apps/web/package.json`] |
| Browser | Playwright 1.58.2 + axe 4.11.0, one worker, derived ports, unique SQLite/Next directories [VERIFIED: `apps/web/playwright.config.ts`] |
| Backend quick | `corepack pnpm --filter @csrm/strapi test` (existing script compiles and runs the full mounted suite) [VERIFIED: package script] |
| Web quick | `corepack pnpm --filter @csrm/web test -- src/features/administration` [VERIFIED: Vitest script pattern] |
| Contract | `corepack pnpm --filter @csrm/web api:check` [VERIFIED: package script] |
| Full non-E2E | `corepack pnpm typecheck && corepack pnpm test` [VERIFIED: root scripts] |
| Phase E2E | `corepack pnpm --filter @csrm/web test:e2e -- e2e/administration-workflow.spec.ts` [VERIFIED: Playwright script/config] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| ADMIN-01 | Risk Type list/detail/create/update, normalized name 409, relation validation, no delete, Requestor denial | backend mounted + web component | backend test; web administration feature test | no - Wave 0 |
| ADMIN-02 | 2,646-Control server search/framework filter/sort/page totals; create/update; controlNumber 409; reusable/contextual copy | backend mounted + web component + E2E | backend test; web test; phase E2E | no - Wave 0 |
| ADMIN-03 | System/Asset CRUD, enum/boolean/owner validation, normalized name 409, Requestor denial | backend mounted + web component + E2E | backend test; web test; phase E2E | no - Wave 0 |
| ADMIN-04 | client file/header/value validation; server bounds; preview create/update/unchanged/rejected/ambiguous; unchanged no-write; digest mismatch; per-row commit summary; report safety | pure unit + backend mounted + component + E2E | all three suites | no - Wave 0 |
| INT-01 support | OpenAPI operations generate typed literal paths and catalogue operations match mounted routes exactly | contract/integration | `api:check`; backend authorization integration | partial existing; Wave 0 additions |
| INT-04 support | 375/768/1280/1440, keyboard stepper/file/preview/confirm/results, axe, no overflow, denial non-enumeration | Playwright | phase E2E | no - Wave 0 |

### Required Backend Coverage

- Assert token missing -> 401, identity/grant missing -> 403, exact human Bob grant -> success, Requestor and analyst-agent-only cases -> safe denial before malformed query/file parsing. [VERIFIED: existing authorization test conventions]
- Assert every mounted operation constant appears exactly once in the byte-identical catalogues; no Administration DELETE grant or mounted DELETE route exists. [VERIFIED: existing catalogue test]
- For each collection: closed query validation, every filter/sort, count/page agreement, documentId tie-break, safe detail 404, positive mutation allowlist, natural-key trim/case/NFKC conflict, simultaneous conflict, and no downstream cascade. [RECOMMENDED: locked contract]
- For Controls: exact 2,646 invariant, search across all three fields, framework/type filters, page sizes including 100, and no full-library response for admin queries. [VERIFIED: locked UI]
- CSV parser table tests: BOM, CRLF/LF, quotes, commas/newlines, escaped quotes, duplicate/unknown/missing headers, too-wide/short rows, blank required cells, enums/booleans, invalid UTF-8, empty file, header-only file, 5,000 and 5,001 rows, exact 5 MiB and +1 byte, max record size. [CITED: csv-parse options/errors docs]
- Classification tests: create/update/unchanged/rejected/ambiguous as five distinct states, every duplicate normalized key ambiguous, multiple existing matches ambiguous, unchanged performs no write, before/after diff, stable original row numbers. [RESOLVED]
- Commit tests: same digest succeeds, mismatch makes zero writes, current-state drift changes final classification, each expected row error rolls back only its row, successful rows persist, summary equals final results. [CITED: Strapi transaction docs]

### Required Web Coverage

- Shared schemas/config: collection route/labels/columns/required fields, URL canonicalization and reset, strict response bounds, FormData body serializer, error-to-field mapping. [VERIFIED: existing feature-test patterns]
- Four lists render desktop table/mobile cards, five deliberate states, semantic booleans/enums, exact totals, 300 ms debounce and Enter, stale response protection, page size 100, and permission state with no data clues. [VERIFIED: UI spec]
- Forms use on-blur then on-change-after-failure validation, focus first invalid, multi-error summary, 409 natural-key field message, pending button, retained values, success toast/redirect, unsaved confirmation, and no delete. [VERIFIED: UI spec]
- Import flow covers all five steps, focus/live announcements, backward state, file metadata, no upload after client file-level failure, preview filters/diffs/errors, confirmation checkbox, unknown outcome, results divergence, safe downloads, and reduced motion. [VERIFIED: UI spec]

### E2E Acceptance Journey

One serial `administration-workflow.spec.ts` should: health/sign-in/shell baseline; Bob sees grouped Administration links; prove each collection list/detail; create a unique record in all four collections; edit at least two and reload to prove persistence; exercise Control search/framework/server totals against 2,646 records; run one full five-step CSV with create + update + rejected row, download/check error report, explicitly confirm, verify server result and detail links; run a rejected/ambiguous preview path without writes; check 375/768/1280/1440, reduced motion, keyboard focus and serious/critical axe; sign in Jane and prove list/detail/create/import routes expose no data/file/total/existence clues. [VERIFIED: locked E2E requirement; Risk Register E2E analog]

Playwright owns the ports and databases. Do not set 1337/3000 overrides and do not use `reuseExistingServer:true`. Use unique natural-key suffixes per run where fixture mutations could collide, while stable seeded counts remain explicitly asserted. [VERIFIED: locked context; current Playwright config]

### Wave 0 Gaps

- [ ] `apps/strapi/tests/administration.unit.test.ts` - query, DTO, normalization, classification, parser, transaction-service units.
- [ ] `apps/strapi/tests/administration.integration.test.ts` - mounted auth/CRUD/import/concurrency/bounds.
- [ ] Extend `apps/strapi/tests/helpers/strapi-http-harness.ts` with safe administration fixture/query helpers.
- [ ] Extend `apps/strapi/tests/authorization.integration.test.ts` with exact admin operation/no-delete/catalogue-copy assertions.
- [ ] `apps/web/src/features/administration/administration-schema.test.ts`.
- [ ] `apps/web/src/features/administration/administration-service.test.ts` including multipart serialization.
- [ ] `apps/web/src/features/administration/administration-workflow.test.tsx` covering lists/forms/import states.
- [ ] `apps/web/e2e/administration-workflow.spec.ts`.
- [ ] `scripts/verify-phase-06-integrity.mjs` mirroring Phase 5 integrity scope and scanning new production/test lines for skips, `.only`, secrets, live ports, schema changes, and attribution.

### Sampling Rate

- **Per backend task commit:** backend test script plus targeted web feature test when generated contract is unchanged. [RECOMMENDED]
- **Per web task commit:** `corepack pnpm --filter @csrm/web test -- src/features/administration`. [RECOMMENDED]
- **Per contract/catalogue task:** backend suite + `api:check` + byte-identical catalogue assertion. [RECOMMENDED]
- **Per wave merge:** root typecheck/test and Phase 6 integrity script. [RECOMMENDED]
- **Phase gate:** full non-E2E suite, API check, integrity gate, then isolated Phase 6 Playwright journey green. [VERIFIED: project test-integrity convention]

## Security Domain

OWASP ASVS 5.0.0 is the current stable ASVS; relevant Phase 6 categories are V2 Validation and Business Logic, V5 File Handling, V8 Authorization, V14 Data Protection, and V16 Security Logging/Error Handling. [CITED: https://github.com/OWASP/ASVS]

### Applicable ASVS Categories

| ASVS category | Applies | Standard control |
|---|---:|---|
| V2 Validation and Business Logic | yes | Positive closed schemas, documented limits, server validation, expected step order, digest binding, per-row transaction/locking. [CITED: ASVS 5.0 flat JSON] |
| V5 File Handling | yes | CSV extension/content validation, explicit 5 MiB/5,000-row limits, no archive support, no persistent upload storage, sanitized display filename. [CITED: ASVS 5.0 V5] |
| V8 Authorization | yes | Exact FunctionAPI plus explicit human analyst scope on every route; Requestor gets no function/data/field disclosure. [CITED: https://github.com/OWASP/ASVS/blob/master/5.0/en/0x17-V8-Authorization.md] |
| V14 Data Protection | yes | Do not log or expose raw CSV; bound preview; discard temporary upload after request; no file content in URLs. [CITED: ASVS V14] |
| V16 Logging/Error Handling | yes | Safe status/error envelopes, security-relevant denial/limit events without sensitive row content, unknown-outcome honesty. [CITED: ASVS V16] |
| Authentication/session/cryptography changes | no | Reuse existing token/session foundation. SHA-256 is only byte binding, not a new authentication or authorization control. [VERIFIED: locked foundation]

### Known Threat Patterns

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Requestor/admin-agent calls admin route directly | Elevation / disclosure | Token gate, exact catalogue operation, human analyst scope, service assertion, deny before parsing. [VERIFIED: existing auth pattern] |
| Caller supplies UID/sort column/filter structure | Injection / disclosure | Closed collection map, zod/allowlist query, bound query-builder values, constant sort maps. [VERIFIED: Risk Register analog] |
| Oversized or pathological CSV | Denial of service | Next/Strapi/body/application byte bounds, row cap, `max_record_size`, sequential processing. [CITED: ASVS V5; csv-parse max record docs] |
| Client tampers with preview/matched IDs | Tampering | Commit repeats file, verifies digest, reparses and reclassifies; ignores client classifications. [RECOMMENDED]
| Duplicate concurrent natural-key writes | Tampering/integrity | Normalized key queue + transaction recheck + DB unique mapping where present; ambiguous existing matches fail closed. [CITED: ASVS V2 business logic; Strapi transactions] |
| CSV formula injection in report download | Execution/injection | Neutralize formula-leading untrusted output cells and correctly quote; test known initiators. [CITED: OWASP CSV Injection] |
| Raw CSV or row values in logs/errors/URLs | Disclosure | Bounded safe messages/codes only; never log content; no raw CSV URL state. [CITED: ASVS V14/V16] |
| Delete through stale generic/core route | Tampering | Unmount generic mutation/delete and remove catalogue delete grants; assert 404/405/no grant. [VERIFIED: current exposure and locked no-delete rule] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | **RESOLVED — Phase 6 scope boundary:** the schema-frozen MVP targets one Strapi process for normalized System/Asset natural-key mutation serialization plus transaction recheck. Cross-process normalized uniqueness is not guaranteed in Phase 6 and requires a later separately approved database unique index/schema migration if multi-process production is adopted. This does not assert the unknown current production topology. [RESOLVED] | CRUD uniqueness | INT-01 must state the limitation honestly; deployment adoption of multiple processes requires a later approved schema/index decision. |

## Resolved Questions

No planning-blocking questions remain. Deployment topology is still unknown, but the Phase 6 implementation boundary is resolved: one Strapi process is the supported schema-frozen MVP target for normalized System/Asset mutation serialization; cross-process enforcement is excluded and must remain documented under INT-01. [RESOLVED]

## Sources

### Primary (HIGH confidence)

- Repository `AGENTS.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, and approved `06-UI-SPEC.md` - scope, locked architecture, UI, tests, terminology. [VERIFIED: codebase]
- `docs/CSRM-PROJECT-BRIEF.md`, `specification.json`, JDL, and both catalogue copies - production contract, fields, relationships, operations, roles/grants. [VERIFIED: codebase]
- Four Strapi content-type schemas and current routes/controllers/services - frozen fields, current uniqueness, generic-route exposure. [VERIFIED: codebase]
- Existing Risk Register, assessment, request, capability, navigation, service, mounted test, seed, and Playwright files cited in the analog table. [VERIFIED: codebase]
- https://docs.strapi.io/cms/backend-customization/routes - custom/core routes and policy configuration. [CITED: official Strapi docs]
- https://docs.strapi.io/cms/database-transactions - transaction behavior and implicit Document Service context. [CITED: official Strapi docs]
- https://docs.strapi.io/cms/configurations/middlewares - multipart parser and default body limits. [CITED: official Strapi docs]
- https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions - Server Action body limit. [CITED: official Next.js docs]
- https://openapi-ts.dev/openapi-fetch/api - multipart FormData serializer behavior. [CITED: official OpenAPI TypeScript docs]
- https://csv.js.org/parse/ and linked options/browser distribution pages - package/API/parser behavior. [CITED: official CSV project docs]
- npm registry and npm downloads API - `csv-parse` 7.0.2 metadata/downloads; slopcheck returned OK and no postinstall was declared. [VERIFIED: npm registry]
- https://github.com/OWASP/ASVS and version 5.0 sources - current stable categories and controls. [CITED: official OWASP repository]
- https://owasp.org/www-community/attacks/CSV_Injection - report/export formula risk and mitigation caveats. [CITED: OWASP]

### Secondary (MEDIUM confidence)

- None; implementation recommendations are derived from primary sources and verified codebase constraints. [VERIFIED: research record]

### Tertiary (LOW confidence)

- Current or future production process topology remains unknown; it is not an implementation assumption because the supported Phase 6 boundary is explicitly resolved above. [RESOLVED SCOPE / UNKNOWN TOPOLOGY]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - repository versions, official docs, npm registry, and slopcheck verified. [VERIFIED]
- Architecture: HIGH - follows exact existing route/policy/service/repository/action/UI/harness patterns and locked constraints. [VERIFIED]
- CSV contract: HIGH - deliberately specified from locked UX/security needs and official parser/transport/transaction documentation. [VERIFIED/CITED]
- Frozen-schema cross-process uniqueness: HIGH for the resolved Phase 6 scope boundary; current production topology remains unknown and is not claimed. [RESOLVED]
- Pitfalls: HIGH - most are direct codebase collisions/constraints or official security/library guidance. [VERIFIED/CITED]

**Research date:** 2026-09-01  
**Valid until:** 2026-10-01 for repository architecture; recheck package/docs versions before installation. [RECOMMENDED]
