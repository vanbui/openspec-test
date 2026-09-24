# Phase 06 Administration and CSV import contract resolution

## Status

**RESOLVED for the Phase 6 single-process deployment boundary.** This record closes INT-01 for the Administration CRUD and CSV transport contract without changing the four frozen Strapi content-type schemas or claiming guarantees the current topology cannot provide.

## Exact operation inventory

Administration exposes exactly six no-delete operations for each reusable collection, for 24 operations in total:

| Collection | List | Create | Detail | Update | Preview | Confirmed apply |
|---|---|---|---|---|---|---|
| Risk Types | `GET /api/v1/risk_types` | `POST /api/v1/risk_types` | `GET /api/v1/risk_types/{riskTypeId}` | `PATCH /api/v1/risk_types/{riskTypeId}` | `POST /api/v1/risk_types/import/preview` | `POST /api/v1/risk_types/import` |
| Controls | `GET /api/v1/controls` | `POST /api/v1/controls` | `GET /api/v1/controls/{controlId}` | `PATCH /api/v1/controls/{controlId}` | `POST /api/v1/controls/import/preview` | `POST /api/v1/controls/import` |
| Information Systems | `GET /api/v1/information_systems` | `POST /api/v1/information_systems` | `GET /api/v1/information_systems/{informationSystemId}` | `PATCH /api/v1/information_systems/{informationSystemId}` | `POST /api/v1/information_systems/import/preview` | `POST /api/v1/information_systems/import` |
| Information Assets | `GET /api/v1/information_assets` | `POST /api/v1/information_assets` | `GET /api/v1/information_assets/{informationAssetId}` | `PATCH /api/v1/information_assets/{informationAssetId}` | `POST /api/v1/information_assets/import/preview` | `POST /api/v1/information_assets/import` |

Every route keeps the content API token as its outer gate, followed by the application-enabled policy and exact FunctionAPI authorization. Twenty-two operations require the explicit human Security Analyst Administration scope. The two inventory picker list routes have an additional compatibility branch: `GET /api/v1/information_systems` and `GET /api/v1/information_assets` accept no query or canonical `page`/`pageSize`-only pagination under the implicit Requestor birthright grant. Any active IdamBox user receives that birthright even without an explicit CSRM role. The picker response uses the same closed Administration list projection; it does not expose persistence metadata, but it is the full authorised reusable inventory projection rather than an owner-scoped subset. Any search, sort, filter, mixed, or invalid pagination query is classified as Administration and requires the explicit human Security Analyst grant before parsing.

The two catalogue copies are byte-identical. Every Administration FunctionAPI occurs once, every one of the eight Administration Functions grants only `role.security_analyst`, and Security Analyst Agent and DELETE grants are absent. The implicit picker compatibility grant reuses the existing Requestor inventory-read FunctionAPIs; it does not add or alter catalogue entries.

## Compatibility response branching

`GET /api/v1/risk_types` and `GET /api/v1/controls` have one mounted route owner each. A request with no query retains the legacy assessment-picker `{ data: [...] }` response. Any explicit query is classified as an Administration request before query parsing and requires the canonical Administration grant. Canonical list requests supply `page`, `pageSize`, and `sort`; their response includes pagination metadata.

`GET /api/v1/information_systems` and `GET /api/v1/information_assets` also have one mounted route owner each, but their Requestor compatibility branch accepts a queryless request or canonical pagination containing only `page` and/or `pageSize`, with supported page sizes bounded at 100. Web request and assessment pickers request 100 records per page, validate `meta.pagination`, and aggregate every authoritative page with a hard 1,000-page safety cap. `q`, `sort`, filters, mixed queries, and out-of-range pagination remain analyst-only and return 403 to Requestors without query or collection disclosure.

OpenAPI cannot describe query-selected authorization as two operations on the same method and path. The generated Administration list response therefore keeps `meta` optional so the legacy no-query payload remains compatible. Web Administration consumers must require canonical metadata at their runtime validation boundary and must not infer totals from a picker response. The catalogue uses distinct query-qualified picker FunctionAPI identities only for authorization traceability; those catalogue strings do not change the mounted HTTP path.

## CRUD and natural-key contract

Writable DTOs are closed positive allowlists. They exclude `id`, `documentId`, timestamps, `sourceData`, downstream Risk and ControlImplementation fields, and other workflow relations. Relation identifiers are opaque and are resolved server-side. There is no DELETE service or DTO.

Control text limits are field-specific and identical in Strapi mutation parsing, web input/record schemas, and CSV parsing: `controlReference` is 500 characters, `frameworkVersion` is 255, and `frameworkSource` is 2,000. The authoritative OpenAPI source likewise specifies a 500-character maximum for Information System `hostingLocation` and Information Asset `location`; the JDL identifies both as `String` and does not narrow that published limit. Because the four content-type schemas are frozen and Strapi otherwise imposes an implicit 255-character validator on schema `string` fields, the closed Administration repository persists already-validated Control, Information System, and Information Asset mutations through Strapi's database query layer. This does not widen the route DTO: the Administration parser remains the authoritative closed positive allowlist and performs the exact limits before persistence.

Natural keys are Risk Type `name`, Control `controlNumber`, Information System `name`, and Information Asset `name`. Comparison uses:

```text
value.trim().normalize('NFKC').toLocaleLowerCase('en-AU')
```

The trimmed display value is persisted. A direct create or rename whose normalized key is already in use returns the bounded `409 NATURAL_KEY_CONFLICT` envelope. CSV uses the normalized key for lookup and never changes an existing key's spelling or casing during an update.

## CSV bounds and normalization

- Global multipart transport caps: **50 MiB (52,428,800 bytes) per file** and **250 MiB (262,144,000 bytes) total**. No global file-count cap is applied, preserving unrelated administration media workflows while bounding pre-route body parsing.
- Administration import maximum file size: **5 MiB (5,242,880 bytes)**.
- Administration import multipart files: **exactly one**, under the exact `file` field. The four import workflows enforce the exact field, one-file shape, media type, and 5,242,880-byte limit before any write, independently of the larger global transport ceiling.
- Maximum data rows: **5,000**, excluding the one header row.
- Maximum parsed record size: **65,536 bytes**.
- Input is CSV with fatal UTF-8 decoding, optional UTF-8 BOM, strict column counts, and original row/line information.
- Header outer whitespace and case are normalized to the collection's canonical closed allowlist. Duplicate normalized headers, unknown headers, missing required headers, and wider or shorter rows fail the file contract.
- Required cells are trimmed and non-empty. Enums match their exact persisted values case-insensitively and are stored canonically. Booleans accept only case-insensitive `true` or `false`.
- An empty optional CSV cell means leave unchanged for an update and omit/use the schema default for a create. CSV cannot clear an optional value in Phase 6; manual edit remains the supported clearing path.
- Information System `owner` and Risk Type `applicableControls` remain manual picker relations and are not accepted from CSV. No relation or owner picker uses caller-supplied search literals outside its closed typed contract.

Responses are bounded to 5,000 ordered row projections. Issue codes, fields, messages, changes, and values are closed and length/item bounded. Raw file contents and unparsed CSV text are never returned to the browser.

## Five authoritative classifications

Preview and result contracts preserve these five states everywhere:

- `create`: a valid row has no existing normalized natural-key match.
- `update`: exactly one existing match has at least one changed writable value.
- `unchanged`: exactly one existing match has no changed writable value; this is successful classification with no document write result.
- `rejected`: validation or expected processing failed; it is not a synonym for unchanged.
- `ambiguous`: the CSV repeats a normalized natural key or persisted data has multiple normalized matches; processing fails closed and never chooses a winner.

Summary counts, row state enums, filters, and final results retain all five names. A result `documentId` is valid only for `create` and `update`. Runtime validators must reject a write result attached to `unchanged`, `rejected`, or `ambiguous`; OpenAPI's optional property alone cannot express that conditional invariant.

## Server-issued preview and confirmed apply

Preview accepts exactly one multipart `file`. It authorizes the caller before inspecting file name, media type, bytes, headers, row count, or natural keys. Collection fetch, classification, capacity validation, and preview issuance run inside the same per-collection serialized queue used by mutations. The server returns a cryptographically random opaque `previewDigest` formatted as `sha256:<64 lowercase hexadecimal characters>` to preserve the frozen transport shape; the value is not the SHA-256 of the file and cannot be calculated by the caller.

The single-process server retains a bounded preview record for five minutes. Each record is bound to the trusted analyst `documentId`, Administration collection, raw file SHA-256, expiry, and the ordered reviewed row state plus matched `documentId` and `updatedAt` snapshot. The registry retains at most 256 records globally and 16 per actor/collection after expiry pruning.

Apply accepts the same multipart file bytes, the server-issued `previewDigest`, and literal `confirmed=true`. It rejects missing, expired, replayed, wrong-actor, wrong-collection, and file-mismatched preview values with no import writes. A valid record is single-use and is consumed before mutation processing. Apply ignores all client-supplied preview rows, counts, classifications, values, and document identifiers.

Inside the existing per-collection mutation queue, apply fetches the complete collection exactly once, builds one normalized natural-key map, reparses and reclassifies the file against that map, and compares every ordered row state, matched `documentId`, and matched `updatedAt` with the retained snapshot **before the first transaction or write**. A multi-create repository call-count regression locks the single initial read. Successful creates update the same map. A drifted row is explicitly skipped and returned as `rejected` with `ROW_PREVIEW_DRIFT`; `previewChanged` counts these rows. A reviewed `create` can therefore never become an unreviewed `update`, and a concurrent natural-key insertion or non-key edit is not overwritten. Non-drifted eligible rows retain the per-row transaction behavior below.

Preview and apply both reject the whole import with bounded `409 IMPORT_RECORD_LIMIT_EXCEEDED` when the complete existing-record count plus rows classified as `create` would exceed 65,536. Exactly 65,536 records is accepted. This check occurs once per import inside the serialized queue and before any import write, so repeated 5,000-row imports cannot push a collection beyond the repository's complete-classification boundary.

Eligible rows are processed sequentially. Each row enters a fresh **per-row transaction**, rechecks the normalized natural key against the commit map, and either commits its own create/update or rolls back independently. Unchanged rows perform no write. Any unexpected `Error` during one row write becomes the stable `ROW_WRITE_FAILED` rejection with a generic safe message; raw infrastructure details are never returned and later rows continue.

HTTP guarantees are: 400 malformed confirmation or closed multipart shape with no writes; 403 authorization-before-parse with no file facts or writes; 409 missing/expired/replayed/binding/file mismatch preview with no import writes (or direct CRUD natural-key conflict with no CRUD write); 413 parser bounds exceeded with no writes; 415 unsupported media type with no writes. A 500/503 after apply begins may have a partial outcome because non-drifted rows commit independently. The client must not auto-retry or claim failure; it directs the analyst to the collection.

## INT-01 frozen-schema and topology boundary

Risk Type `name` and Control `controlNumber` already have frozen database uniqueness. Information System and Information Asset `name` do not. Phase 6 therefore targets a **single Strapi process** for normalized Information System and Information Asset mutation serialization, using a module-level per-collection queue plus a transaction-time normalized-key recheck.

This is an honest process-local guarantee: **cross-process uniqueness is not guaranteed** for Information System or Information Asset names. If multi-process production is adopted, closing that gap requires a later **separately approved unique index/schema migration**, including normalized-key storage/index design and duplicate-data remediation. Phase 6 does not modify a content-type schema, create a competing entity, or describe the present deployment as multi-process.

## Remaining specification limitations

- OpenAPI binary multipart fields generate a compile-time transport shape; runtime code still supplies a real `File` and lets the multipart serializer set `Content-Type` and its boundary.
- Preview records are process-local and intentionally target the documented single-Strapi-process boundary. A restart invalidates outstanding previews; a future multi-process topology would require an approved shared short-lived store in addition to the unique-index work described above.
- Natural-key uniqueness for Information Systems and Information Assets remains a serialized single-process guarantee with no database unique backstop while schemas are frozen.
- Drift detection is deliberately per-row rather than per-field: any `updatedAt` change rejects the reviewed update instead of attempting to merge fields.
- No import-result content type, persistence, or status endpoint is introduced because schemas are frozen. A lost apply response has an unknown outcome and is not retried automatically.
- Per-row transactions deliberately permit partial success. The bounded final response is authoritative only for rows processed before a fatal infrastructure stop.

These limitations are explicit contract boundaries, not alternate domain models.
