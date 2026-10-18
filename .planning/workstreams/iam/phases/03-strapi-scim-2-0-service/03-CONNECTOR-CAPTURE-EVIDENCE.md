# Phase 3 connector capture evidence (plan 03-13)

**Status:** Passed. Orchestrator-run live gate; `node docker/midpoint/e2e/capture-scim.mjs --verify-evidence` exits 0.
**Date:** 2026-10-15T21:50:19.284Z (2026-10-16 08:50 AEDT)
**Run:** `iam-scim-gate-e350c500-ff4c-4332-90fa-8a7dd3b414bc`
**Command:** `node docker/midpoint/e2e/capture-scim.mjs --run` (from the repository root, after commit `4fe5432b`)

Evidence: [capture.json](evidence/connector-capture/capture.json) (47 sanitized envelopes) and [manifest.json](evidence/connector-capture/manifest.json). The procedure is the scoped contract in [docker/midpoint/e2e/README.md](../../../../../docker/midpoint/e2e/README.md).

## Runtime

| Item | Value |
| --- | --- |
| midPoint | 4.8.14 (`idambox/midpoint:4.8.14-scim2-1.2.9`, Ninja reports 4.8.14) |
| Connector | Provision IAM SCIM2 1.2.9, one matching connector object |
| Connector source commit | `05c404bbecf9c28938e2183411c7b04b4f8f4226` |
| Endpoint | `http://host.docker.internal:1337/scim/v2` |
| Gate | Isolated Strapi process on 127.0.0.1:1337, compiled `dist`, new SQLite `apps/backend/.tmp/<run>.sqlite`, IAM seeds on, capture hook preloaded; `IDAMBOX_KEYCLOAK_PROVISIONING=false` and `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=false` on the gate process only |

The developer Strapi server was stopped for the gate and restarted afterwards. The `idp` stack kept running throughout.

## Scenarios

Every scenario is in order. Each connector scenario was triggered by its midPoint REST invocation (shadow model seam) and recorded with it. Background `GET /ResourceTypes` and `GET /Groups` requests that the connector makes on each operation are kept in the capture and left out of this table.

| Scenario | Origin | midPoint invocation | Observed SCIM requests |
| --- | --- | --- | --- |
| connection | connector | `POST /resources/{resource}/test` | 5 × `GET /ResourceTypes` 200 |
| lookup | connector | `POST /shadows/search` (userName equality) | `GET /Users?filter=userName eq "…"` 200, no results |
| create | connector | `POST /shadows` | `POST /Users` 201 |
| read | connector | `GET /shadows/{shadow}?options=forceRefresh` | `GET /Users/{id}` 200 |
| list | connector | `POST /shadows/search` | `GET /Users` 200, ListResponse |
| filter | connector | `POST /shadows/search` (userName equality) | `GET /Users?filter=…` 200, one result |
| page | connector | `POST /shadows/search` with offset 0 / maxSize 1 | `GET /Users` 200, unpaged ListResponse (5 of 5), see P3-36 |
| mover | connector | `PATCH /shadows/{shadow}` title delta | `GET /Users/{id}`, `PUT /Users/{id}` 200, title "Gate Mover", still active |
| multi-value | connector | `PATCH /shadows/{shadow}` email delete + add | `PUT /Users/{id}` 200, then `PATCH /Users/{id}` 200 with `remove emails[value eq "gate.joiner@idambox.test"]` then `add emails` (`"primary":"true"`); response primary is `gate.mover@idambox.test` |
| leaver | connector | `PATCH /shadows/{shadow}` administrativeStatus disabled | `PUT /Users/{id}` 200 with `"active": false`; response inactive |
| delete | connector | `DELETE /shadows/{shadow}` | `DELETE /Users/{id}` 204 |
| schemas | direct-probe | authenticated `GET /scim/v2/Schemas` | 200, three schemas |
| config | direct-probe | authenticated `GET /scim/v2/ServiceProviderConfig` | 200, PATCH and filter supported |
| groups | direct-probe | authenticated `GET /scim/v2/Groups` | 200, empty list |

The create body is the connector's real shape: the Core and Slack URNs in `schemas`, Enterprise `employeeNumber` as the only key (no `externalId`), `"groups": []` and the JSON-string email mapped to a proper `emails` array (P3-33). The mover and multi-value `PUT`s omit email and Enterprise data (P3-34), and the email `PATCH` uses string `primary` with remove-then-add (P3-35).

## Sanitation and substitutions

- Only requests that carried the in-memory gate credential were captured. Headers other than `accept`, `content-type` and `retry-after` were removed before any write. The file holds no `Authorization` header, cookie, token or password value. The only credential-related strings are the ServiceProviderConfig descriptors ("Bearer Token", `changePassword`).
- Substitution map (manifest `substitutions`): `USER_ID_1` … `USER_ID_5`, all of kind `user-id`. User names, emails, attribute spellings and operation shapes are kept verbatim.
- The fictitious person is `iam-scim-gate-8a7dd3b414bc` ("Gate Person", `gate.joiner@idambox.test` then `gate.mover@idambox.test`).

## Token delivery, rotation and revocation (P3-10)

Run live against the same gate database with the implemented `scim:token` command (`node dist/src/iam/scim/token-cli.js`). Tokens stayed in process memory; only statuses were recorded.

| Step | Result |
| --- | --- |
| First token for the new database: `issue` into the ignored handoff file `apps/backend/.tmp/.env.scim-capture` (mode 0600) | exit 0, one well-formed token |
| `rotate` (T1), then `GET /ServiceProviderConfig` with T1 | 200 |
| `rotate --write-dev-env` (T2) | exit 0, one well-formed token, ignored dev env written by the command |
| Next request with old T1 | 401 |
| Request with T2 | 200 |
| `revoke`, then request with T2 | stdout "SCIM token revoked.", 401 |
| `issue` (T3), then T3 and T2 | 200 and 401 |

The ignored dev env file was not opened to compare its contents. A local guard blocks commands that name it, and the file write itself is covered by the 03-02 CLI tests. After the gate, `rotate --write-dev-env` against the developer database put a valid developer token back in that file, with stdout discarded.

## Cleanup

- The runner removed its temporary resource, person and shadow and closed the capture session (`cleanup: true`). A search afterwards for midPoint objects named `iam-scim-gate*` found none.
- The gate process was stopped, and its database, socket and handoff file were deleted.
- The earlier live-probe resource (`…00e3`) and user (`…00f1`) were deleted from midPoint before the gate.
- Still to clean up manually: the `idambox` Keycloak realm holds fictitious users from the earlier probe and from the first two gate attempts, which ran with provisioning on (`probe.joiner`, `gate.mover@idambox.test`). They are development data in the resettable `idp` stack and affect nothing committed.

## Attempts before the passing run

Each attempt used a new run identifier and database. None published evidence.

1. The README's ESM launch failed: Strapi's CommonJS `lodash/fp` directory import is refused under ESM. The gate now starts through a CommonJS `-e` entry, and the README is updated.
2. `rotate` on a new database failed with `IAM_SCIM_TOKEN_PRECONDITION`, because the first token must be `issue`. The README is updated.
3. Run 1 performed all stages, but validation refused the result because the page request carried no `startIndex`/`count`. A repeat on the same run collided with run 1's tombstoned username (409) and stayed diagnostic.
4. Run 2 (Keycloak provisioning on): the email `PATCH` returned 503, because Keycloak still held `gate.mover@idambox.test` from run 1 (Keycloak 409, logged as `keycloakUnavailable`). The gate now runs with both Keycloak flags off. The mapping of a Keycloak email conflict to 503 is noted for the 03-17 review.
5. Runs 3–6 were diagnostics through the same runtime (sanitized entries saved outside the repository). The resource reports a native `pagedSearch` capability, yet midPoint returned every shadow and sent no paging to the connector, whether offset was 0 or 1, with ordering and with a configured capability. That led to P3-36 and commit `4fe5432b`.
