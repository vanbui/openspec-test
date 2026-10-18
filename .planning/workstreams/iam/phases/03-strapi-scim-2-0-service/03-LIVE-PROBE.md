# Phase 3 live probe: SCIM2 connector against Strapi

**Date:** 2026-10-16
**Run by:** orchestrator, before plan 03-10
**Status:** Informative only. This is not the 03-13 capture and its requests are not replay fixtures (P3-26). It found contract gaps early, while the parser and tests were still cheap to change.

## Set-up

- `idp` stack: midPoint 4.8.14 (`idambox/midpoint:4.8.14-scim2-1.2.9`), Provision IAM SCIM2 connector 1.2.9 (source commit `05c404bbecf9c28938e2183411c7b04b4f8f4226`), Keycloak 26.6.1.
- Strapi `pnpm develop` on the host with `IDAMBOX_SEED_IAM=true`; the dev source "midPoint (dev)" holds a token issued with `scim:token ... rotate --write-dev-env`. The token went from the command's stdout straight into the temporary resource through a pipe and was never displayed or written to a tracked file.
- A temporary midPoint resource (OID `11000000-0000-4000-8000-0000000000e3`, not committed) pointed at a loopback-only logging proxy in front of Strapi. The proxy recorded method, path, `Accept`, `Content-Type`, `User-Agent`, body and response, never the `Authorization` header.
- One fictitious midPoint user (`probe.joiner`, employee number `P3-PROBE-0001`) assigned to that resource with outbound mappings for name, employee number, email, given and family name, full name, title and activation.

## Observations

1. **Accept header.** Every connector request sends `Accept: application/json` and `Content-Type: application/json`, including GETs. The boundary answered 406 until it negotiated `application/json` (fixed in `b17bbaac`). midPoint's connection test then passed: five `GET /scim/v2/ResourceTypes`, each 200.
2. **No externalId on writes.** The connector's user adapter (`Scim2UserAdapter`) reads `externalId` from responses but never sets it when building a create or update. D19's source key therefore arrives only as the Enterprise `employeeNumber`.
3. **Empty groups.** Every create body carries `"groups": []`.
4. **Wrong extension URN.** `Scim2UserAdapter.SCIM2_ENTERPRISE_USER_SCHEMA` holds `urn:ietf:params:scim:schemas:extension:slack:profile:2.0:User`, so `schemas` lists the Slack URN while the body carries Enterprise data under the Enterprise key.
5. **Emails as JSON strings.** The connector parses each `emails` value as a JSON object (`getComplexTypes`). A plain address fails silently and no `emails` are sent. With the mapping `JsonOutput.toJson([value: emailAddress, primary: true, type: 'work'])` the body carries a proper `emails` array.

## Observed create (after the P3-33 parser change)

```
POST /scim/v2/Users  ->  201  (application/json)
{"active":true,"displayName":"Pat Probe",
 "emails":[{"value":"pat.probe@idambox.test","type":"work","primary":true}],
 "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User":{"employeeNumber":"P3-PROBE-0001"},
 "groups":[],"name":{"familyName":"Probe","givenName":"Pat"},
 "schemas":["urn:ietf:params:scim:schemas:core:2.0:User","urn:ietf:params:scim:schemas:extension:slack:profile:2.0:User"],
 "title":"Probe Analyst","userName":"probe.joiner"}
```

The response carried the new user with `externalId` `P3-PROBE-0001`, the single primary email and `active: true`.

## Rest of the lifecycle (after P3-34 and P3-35)

| Step (midPoint) | Connector requests | Result |
| --- | --- | --- |
| Mover: title change | `GET /Users/{id}`, `GET /Groups` (twice), `PUT /Users/{id}` with only `active`, `displayName`, `groups`, `id`, `name`, `schemas`, `title`, `userName`; then `PATCH` `add emails` with `"primary":"true"` | `PUT` 200, `PATCH` 200; email, Enterprise data and source key kept |
| Leaver: administrative status disabled | Same GETs, `PUT` with `"active": false`, then the same email `PATCH` | 200, 200; the user is inactive |
| Delete (shadow deleted through provisioning) | `DELETE /Users/{id}` | 204; later `GET /Users/{id}` 404 and an `eq` search returns no results |

Before P3-34 the mover's partial `PUT` was refused (400 invalidValue: no email or key); before P3-35 the email `PATCH` was refused (string `primary`). Re-adding an assignment after midPoint lost its link (an overwrite `PUT` of the user drops `linkRef`) stopped inside midPoint on its existing shadow, before any request: that is Phase 4 correlation configuration.

## Consequences

- Parser tolerances (P3-33), asserted-attribute `PUT` (P3-34) and connector email `PATCH` shapes (P3-35), each with the observed bodies as tests.
- Phase 4 and the 03-13 capture configuration must map emails with the JSON-string expression above, and must carry the HR key in the Enterprise `employeeNumber`.
- The connector defects (no `externalId`, Slack URN) are upstream issues. Recording them in ADR 0006's community-support risk is part of Phase 4 or the phase close.
