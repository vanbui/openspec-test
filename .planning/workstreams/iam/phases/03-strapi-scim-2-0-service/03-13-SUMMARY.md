---
phase: 03-strapi-scim-2-0-service
plan: "13"
status: complete
executed_by: orchestrator
requirements: ["MODEL-02","PROV-01","PROV-02","PROV-03","PROV-04","PROV-08","LIFE-03"]
---

# Plan 03-13 summary: live connector capture

## Outcome

The orchestrator ran the isolated live gate. The real pinned connector in midPoint 4.8.14 drove all 11 connector scenarios against the real `/scim/v2` handlers, and the three direct discovery probes are labelled separately. Sanitized evidence was published and `node docker/midpoint/e2e/capture-scim.mjs --verify-evidence` passes. Details, the token proof and cleanup are in [03-CONNECTOR-CAPTURE-EVIDENCE.md](03-CONNECTOR-CAPTURE-EVIDENCE.md).

## Files

- `03-CONNECTOR-CAPTURE-EVIDENCE.md` (new)
- `evidence/connector-capture/capture.json` and `manifest.json` (new, published by the runner)
- `03-CONTEXT.md`: decision P3-36
- Commit `4fe5432b` (before the passing run): `docker/midpoint/e2e/scim-evidence.mjs` page check, `README.md` gate launch and overrides, and one new tooling test

## Checks

| Check | Result |
| --- | --- |
| `node docker/midpoint/e2e/capture-scim.mjs --check` | pass |
| Capture tooling tests (compiled with `.tmp/tsconfig.scim-capture.json`, which excludes only the two WINDOWS.md entry 11 files) | 19/19 pass |
| `node docker/midpoint/e2e/capture-scim.mjs --run` | pass |
| `node docker/midpoint/e2e/capture-scim.mjs --verify-evidence` | pass |
| Evidence secret scan (token shape, Bearer, Authorization, cookie, password, JWT shape) | No credential values; only ServiceProviderConfig descriptor text |
| P3-10: old token after rotation, revocation and reissue | 401 / 401 / reissued token 200, old one 401 |

## Deviations

- **P3-36 (validator change):** midPoint does not pass shadow-search paging to the connector, so no supported invocation produces `startIndex`/`count` on the wire. The page check now accepts the real unpaged ListResponse and still rejects partial paging, a zero count, a filter or an empty page. No request was authored to stand in for connector traffic.
- **Gate set-up corrections** (README updated): a CommonJS launch entry instead of the failing ESM one; `issue` instead of `rotate` for a new database; Keycloak provisioning and token verification off on the gate process.
- **The ignored dev env content was not opened.** `--write-dev-env` delivery is shown by the command's exit status and the working rotated token, not by reading the file.

## For later plans

- 03-14 may now create replay fixtures from this capture.
- 03-17 review: a Keycloak email conflict (409) during a source `PATCH` is reported as 503 `keycloakUnavailable`.
- Phase 4: unpaged connector lists return at most the default 100 users (P3-36). The JSON-string email mapping and Enterprise `employeeNumber` key are required (P3-33).
- Manual cleanup: fictitious Keycloak users from the probe and the first gate attempts remain in the resettable `idp` realm.
