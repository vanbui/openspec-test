# Connector lifecycle replay provenance

The fixture is a byte-for-byte copy of the published sanitized capture; all 47 envelopes remain in their original order. No authored requests or responses were added. Direct probes remain labelled `direct-probe` and are not connector coverage.

Source evidence: `.planning/workstreams/iam/phases/03-strapi-scim-2-0-service/03-CONNECTOR-CAPTURE-EVIDENCE.md` and its `evidence/connector-capture/{capture,manifest}.json`.

Checked-in copies, byte for byte: `connector-lifecycle.json` (capture.json) and `connector-lifecycle.manifest.json` (manifest.json). The replay reads only these copies, so the phase records may be archived.

- Capture date: 2026-10-15T21:50:19.284Z
- Capture run: `iam-scim-gate-e350c500-ff4c-4332-90fa-8a7dd3b414bc`
- Capture command: `node docker/midpoint/e2e/capture-scim.mjs --run`
- Repository source commit: `4fe5432b` (published in `125a74bd`)
- midPoint: 4.8.14, image `idambox/midpoint:4.8.14-scim2-1.2.9`
- Provision IAM SCIM2 connector: 1.2.9, source commit `05c404bbecf9c28938e2183411c7b04b4f8f4226`
- Backend: Strapi 5.51.0, isolated SQLite, Keycloak provisioning and token verification disabled
- Replay: existing mounted Strapi HTTP harness, fresh isolated SQLite and in-memory source credentials; no Docker, midPoint or external server

## Digests

- capture.json SHA-256: `52a5a3d28f4eee56cd398404c72f370572720041c4c8a173b831b53bd2a693ae`
- manifest.json SHA-256: `dce38dc15a161c19044c18cb87c12e4989952b0e2fc613cb452e32299c289a5f`

## Observed operations

Every envelope carries its invocation, origin and sequence. Background ResourceTypes and Groups calls are replayed too.

| Scenario | Origin | Explicit invocation | Sequences |
| --- | --- | --- | --- |
| connection | connector | `POST /resources/{resource}/test` | 1, 2, 3, 4, 5 |
| lookup | connector | `POST /shadows/search` | 6, 7 |
| create | connector | `POST /shadows` | 8, 9 |
| read | connector | `GET /shadows/{shadow}` | 10, 11, 12 |
| list | connector | `POST /shadows/search` | 13, 14, 15, 16, 17, 18, 19 |
| filter | connector | `POST /shadows/search` | 20, 21, 22 |
| page | connector | `POST /shadows/search` | 23, 24, 25, 26, 27, 28, 29 |
| mover | connector | `PATCH /shadows/{shadow}` | 30, 31, 32, 33 |
| multi-value | connector | `PATCH /shadows/{shadow}` | 34, 35, 36, 37, 38 |
| leaver | connector | `PATCH /shadows/{shadow}` | 39, 40, 41, 42 |
| delete | connector | `DELETE /shadows/{shadow}` | 43, 44 |
| schemas | direct-probe | `GET /scim/v2/Schemas` | 45 |
| config | direct-probe | `GET /scim/v2/ServiceProviderConfig` | 46 |
| groups | direct-probe | `GET /scim/v2/Groups` | 47 |

The page invocation used offset 0 / maxSize 1 at midPoint, which emitted an unpaged `GET /Users` (P3-36). Replay adds no paging parameters. Mover PUT preserves omitted fields (P3-34); the email PATCH removes then adds with string primary (P3-35). The create uses the employeeNumber key fallback, empty groups and Slack URN (P3-33).

## Permitted substitutions and initial state

| Marker | Kind | Resolution |
| --- | --- | --- |
| USER_ID_1 | user-id | Only the actual POST response body id, cross-checked against Location |
| USER_ID_2 | user-id | Actual list response id for captured manual candidate jane.doe |
| USER_ID_3 | user-id | Actual list response id for captured manual candidate bob.doe |
| USER_ID_4 | user-id | Actual list response id for captured manual candidate maya.requestor |
| USER_ID_5 | user-id | Actual list response id for captured manual candidate sam.analyst |

Only declared id markers in id, user paths and meta.location are substituted. No timestamp markers occur in this capture. Nothing is dropped, sorted, wildcarded or normalized in the response comparison. The capture's safe response header set is content-type/retry-after/accept; volatile transport headers were never captured. Location is additionally asserted on create.

The captured list contains four pre-existing manual users, preceding the created person. Replay retains Jane/Bob from the shared harness and creates missing Maya/Sam directly from their captured public projections. Extra shared-harness users are claimed by a second Identity Source through the existing identity service, preserving references and excluding them from the primary source's counts. This is initial test database preparation, not captured connector traffic. Role/reference fixtures and negative isolation probes are kept outside the replay sequence.

The evidence validator must pass before replay. Missing evidence, mismatched hashes, omitted operations or changed shapes fail acceptance. Re-capture whenever Phase 4 changes request configuration. Phase 4 reconciliation above 100 users remains subject to P3-36; this fixture does not prove connector paging.
