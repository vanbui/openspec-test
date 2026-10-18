# Phase 4 live evidence: midPoint configuration against the running stack

**Date:** 2026-10-16 (all times UTC)
**Stack:** compose project `idp` — midPoint 4.8.14 (`idambox/midpoint:4.8.14-scim2-1.2.9`, connector 1.2.9 source commit `05c404bb`), Keycloak 26.6.1, the developer Strapi on the host (`pnpm develop`, port 1337) with Keycloak provisioning on in its git-ignored `.env`. Committed defaults stay off.
**Configuration under test:** `docker/midpoint/objects/` at `7d9cd434` plus the follow-ups in the next commit (strong `displayName`, retry-later on every HR and IdamBox task, corrected comments).
**Source:** the dev Identity Source "midPoint (dev)" (`paeio28neobo8wyj3q4n5k6z`), token issued with `scim:token ... rotate --write-dev-env` and rendered into the resource inside the container. No token, password or raw connector trace appears below.

How the evidence was read: midPoint REST (container-local, administrator), midPoint's native audit tables (`ma_audit_event`, `ma_audit_delta`), Strapi's `scim.request` log lines, and SCIM reads as the source from inside the midpoint container. People are fictitious (`hr.idambox.test`, `load.idambox.test`, `idambox.test`).

## 1. Seed, render and reload (criterion 1)

| Check | Result |
| --- | --- |
| `docker compose build`; `up -d --force-recreate midpoint_init midpoint_server` with the volumes kept | init: schema present, connector installed, schema extension installed, HR CSV seeded into `var/hr/hr.csv` |
| Schema extension `docker/midpoint/schema/idambox-extension.xsd` | loaded at startup (`Loading schema from file /opt/midpoint/var/schema/idambox-extension.xsd`) |
| `docker/midpoint/reload.sh` (all objects) | every numbered object `HTTP 201/202`, in dependency order 100 → 110 → 140 → 150 → 3xx |
| `pwsh docker/midpoint/reload.ps1 140-… 110-…` | `HTTP 201` each; connection test afterwards 15/15 success |
| IdamBox resource connection test with the rendered token | 15/15 operations `success`; the stored token is an `encryptedData` protected value, no `clearValue` in the repository |
| HR resource connection test | success |
| An object referring to one not yet loaded | `HTTP 240` partial error (found while ordering the files, fixed by ordering, not by accepting 240) |

A fresh-volume seed (midPoint containers and both volumes removed) was run four times: three capture gates and the final restore (sections 8 and 9). Each time init created both schemas, installed the connector and extension, rendered and seeded all ten numbered objects, and midPoint reported `Post-initial object import finished (10 objects imported, 0 scripts executed)` with the IdamBox connection test passing.

## 2. Joiners, movers and leavers from the HR CSV (criteria 1 and 2)

Initial reconciliation of the seven-row reference CSV (`310`, run on demand at 11:06:30): seven Identities named by `employeeNumber`, each linked to its HR row and to one IdamBox User.

| HR row | Expected | Observed in Strapi |
| --- | --- | --- |
| 000101 Ada, active, start 2024-02-05 | enabled | `active: true` |
| 000104 Dev, active, start 2099-01-04 (future starter) | disabled until the start date | `active: false`, Identity `validFrom 2099-01-04T00:00:00Z`, effective status disabled |
| 000105 Elif, terminated | disabled | `active: false`, administrative status disabled |
| 000106 Farid, active, end 2025-12-31 (ended) | disabled | `active: false`, `validTo 2025-12-31T00:00:00Z` |
| 000103 Chloé Østergaard, department `Legal, Risk and Compliance` (quoted), no dates | enabled, non-ASCII and quoted values intact | `active: true`, department as written |
| 000107 Grace "Gigi" O'Neill (escaped quotes in preferred name) | display name from preferred name | `displayName` `Grace "Gigi" O'Neill` as one value |

Movers and leavers by live sync (`300`):

| Change (published with `hr-publish.sh`) | Requests at Strapi | Result |
| --- | --- | --- |
| 000102 Bart: department, title, email | `PUT /Users/{id}` 200 (+ email `PATCH`) | email `bart.nakamura@sec.idambox.test`, title `Security Engineer`, Enterprise department `Security` |
| 000102 Bart again after an IdamBox Role grant (Security Analyst, granted in the Strapi admin) | `PUT` 200 | department `Security Operations`, title `Lead Security Engineer`, **roles still `['Security Analyst']`** |
| 000107 Grace `terminated` | `PUT` 200 with `active=false` | inactive; never a `DELETE` |
| 000109 Ivo joiner | `POST /Users` 201 | created and linked |

**One 5-minute cycle, scheduler only (ENG-02).** Live sync resumed on its 300-second schedule; no task was run by hand. A joiner (000112 Noor), a mover (000101 Ada: department and title) and a leaver (000103 Chloé `terminated`) were published together at **11:39:27**, three seconds after a scheduled run had started (that run read the file before the change, so this is close to the worst case). The next scheduled run delivered all three: Ada `PUT` 200 at **11:44:24.7**, Chloé `PUT` (`active=false`) at **11:44:25.1**, Noor `POST` 201 at **11:44:25.3**, i.e. 4 min 58 s after publication. The bound holds only while a sync run finishes well inside its interval; a long run (a large change set, or throttling) can push a change past five minutes.

No request in the whole session used `DELETE` (Strapi log: zero `DELETE:/scim/v2/Users/:id`); the IdamBox resource declares the delete capability disabled.

Found and fixed during these runs (all in the commit history of this phase):
- An explicit administrative status overrides validity in midPoint, so an `active` person's dates were ignored. HR now sets the administrative status only to disable, and the IdamBox outbound reads the effective status.
- `organizationalUnit` is multi-valued, so a department change produced two values and a fatal error. Department is now a single-valued extension property.
- Strapi's email read-back is `{"value":…,"primary":true}`; the original `type: work` form never matched and produced remove/add `PATCH` pairs that Strapi refused (`400 mutability`). The resource now sends the read-back form.
- One person's error stopped live sync (midPoint's default) and the change for 000108 was lost until the HR reconciliation repaired it at 11:17:54. Every HR and IdamBox task now retries a failed person later instead.

## 3. Correlation and confirmed claims (criterion 3, PROV-06)

| Step | Evidence |
| --- | --- |
| Manual user `kai.manual` created in the Strapi admin (unowned, unprotected); HR row 000111 `kai.mann` with the same email | `POST /Users` → **409** (`outcome conflict`); no link, the Identity has only its HR link |
| IdamBox reconciliation (`320`) | native case `Correlation of account 'kai.manual' on IdamBox (SCIM)`, options `existing-<Identity 000111>` (confidence 0.8, below the 1.0 needed to link automatically) and `none` |
| Before the decision | Kai's record unchanged (no `externalId`, no Enterprise data); **0** non-`GET` requests to its id |
| Operator decision (administrator, 11:25:09, work item completed through `/rpc/executeScript`) | case closed, outcome `existing-…`; the shadow is linked and one `PUT /Users/{id}` is sent |
| After the claim | same `documentId` and Keycloak subject; `sourceExternalId 000111`, `identitySource` set, username `kai.mann`, title/department from HR, no second user |
| Candidate beyond the first 100 list positions: `mia.manual` at position 139, HR row 001201 | case opened by `320`; confirmed at 11:38:56; one `PUT`; now sourced as 001201 with HR display name `Mia Moss` |
| Rejection: `lena.manual` (position 13), HR row 001200 | outcome `none`; Lena's record untouched (0 non-`GET` requests); 001200 stays unlinked and its create keeps failing with 409 at the retry interval until an operator acts |
| Protected users | never listed by Strapi to the source (the source sees 10 users before the load, none protected; Phase 2/3 enforce it), so never candidates |
| Audit | `WORK_ITEM` / `WORKFLOW_PROCESS_INSTANCE` request and execution events with initiator `administrator` at 11:21:14/11:25:10 and 11:32:51–11:38:58 |

## 4. Keycloak outage and automatic recovery (criterion 4, LIFE-04)

| Time | Event |
| --- | --- |
| 11:18:25 | `docker stop keycloak` |
| 11:18:26 | HR row 000110 Jonas published and live sync run: `POST /Users` → **503** (`outcome unavailable`); Strapi rolled the create back; Identity 000110 exists with only its HR link |
| 11:18:26 | the connector reports the 503 as a generic error, so midPoint keeps **no** provisioning pending operation; the task's retry-later reaction put a durable `shadow-reconcile` trigger on the HR row for 11:23:26 (`plannedOperationAttempt` 1) |
| 11:19:39 | `docker start keycloak` |
| 11:25:46 | midPoint's trigger scanner fired the trigger: `POST /Users` **201**; Identity 000110 linked; audit `ADD_OBJECT … Trigger Scanner … jonas.lehtonen ADD SUCCESS` |

No manual action between the outage and the recovery. The retry waited 5 minutes, well beyond Strapi's `Retry-After: 30`, and then every 15 minutes. The existing-user leaver outbox (Phase 2) is unaffected: deactivations commit in Strapi during the outage.

## 5. Complete reconciliation beyond 100 users and drift repair (criterion 4, P3-36)

| Run | Evidence |
| --- | --- |
| HR load: 125 generated rows (001000–001124) + 001200 + the earlier rows, 137 in all; first full HR reconciliation | 11:28:58.490 → 11:29:37.649 (39.2 s); 136 success, 1 failure (001200, the 409 above); Strapi: 125 `POST` 201, 11 `PUT` 200, 2 `POST` 409, 151 `GET /ResourceTypes`, 22 `GET /Users/:id`, 22 `GET /Groups` |
| Out-of-band drift: `load.tester120` (list position 134) title changed to `Drifted Title` directly through the source's SCIM `PATCH` | — |
| IdamBox reconciliation 1 (11:32:47 → 11:33:20) | 139 processed; **2 list requests** for 139 users (the connector paged: 100 + 39); 67 success, 72 failed with **429** (`throttled`) — Strapi's 600 requests per minute per source |
| Retry-later added to the IdamBox reconciliation; run 2 (11:35:06 → 11:38:10) | **139/139 success**; `load.tester120` title back to `Load Tester` |

## 6. Throughput (first full reconciliation)

- 125 creates with Keycloak provisioning on, against the developer Strapi (SQLite) and Keycloak 26.6.1 on one host, in 39.2 s: about **3.2 creates a second**.
- The connector costs three to four SCIM requests per user operation (`/ResourceTypes` before nearly every call, `/Groups` with reads). At Strapi's default 600 requests a minute per source, sustained processing is limited to roughly 150–200 users a minute; beyond that requests answer 429 and are retried by trigger. The first IdamBox reconciliation of 139 users needed a second run to converge (3 min 4 s).
- The strong `displayName` mapping adds one `PUT` (and one Keycloak update) per user to every IdamBox reconciliation, because the connector reads `displayName` back as the username (ADR 0006).
- No figure here is a promise for larger populations; a 10,000-person source needs its own measurement and probably a higher per-source limit.

## 7. Audit (criterion 5, ENG-04)

midPoint's native audit (`ma_audit_event` joined to `ma_audit_delta`) records each decision with its cause: event type, channel (`liveSync`, `reconciliation`, `recompute`, `import`), task (`HR live sync`, `HR reconciliation (nightly)`, `HR validity scan`, `Trigger Scanner`, …), resource, object and outcome. Examples:

```
11:06:33 ADD_OBJECT   000102 reconciliation SUCCESS     HR reconciliation (nightly) IdamBox (SCIM) bart.nakamura  ADD     SUCCESS
11:28:02 MODIFY_OBJECT 000102 liveSync      SUCCESS     HR live sync                IdamBox (SCIM) bart.nakamura  MODIFY  SUCCESS
11:18:26 ADD_OBJECT   000110 liveSync       FATAL_ERROR HR live sync                IdamBox (SCIM) jonas.lehtonen ADD     FATAL_ERROR
11:25:46 MODIFY_OBJECT 000110 reconciliation SUCCESS    Trigger Scanner             IdamBox (SCIM) jonas.lehtonen ADD     SUCCESS
11:25:10 SYNCHRONIZATION 000111 import       SUCCESS                                 IdamBox (SCIM) kai.manual     MODIFY  SUCCESS
```

Strapi's matching `scim.request` lines carry source, operation, target and outcome, for example:

```
{"event":"scim.request","source":"paeio28neobo8wyj3q4n5k6z","operation":"POST:/scim/v2/Users","target":null,"outcome":"unavailable","status":503,...}
{"event":"scim.request","source":"paeio28neobo8wyj3q4n5k6z","operation":"PUT:/scim/v2/Users/:id","target":"ydxy1f54ya0329vqhq1p6wpy","outcome":"success","status":200,...}
```

## 8. Connector recapture from the persistent configuration (criterion 5, P4-28)

Isolated gate: the developer Strapi stopped; a gate Strapi on 127.0.0.1:1337 with fresh SQLite, IAM seeds on, Keycloak provisioning and token verification off, and the Phase 3 capture hook preloaded; the gate's first token `issue`d into the handoff file and `docker/.env`; midPoint volumes reset and seeded from the committed objects with that token.

| Attempt | Result |
| --- | --- |
| 1 (`iam-scim-gate-4bd6…`) | refused in preflight, then at claim-case: runner bugs (REST GET objects are wrapped in their type name; an empty search has no inner list; work items carry `@id`; `WorkItemId` package). Fixed; gate discarded. |
| 2 | all stages ran; evidence refused, cause not printed. An opt-in diagnostic was added. Gate discarded. |
| 3 (`iam-scim-gate-6c1b4e26-1a3a-4042-b6cb-60dee3601fc1`) | all nine stages ran; the verifier refused a displayName-only `PUT` in `live-sync-baseline` (A6). Rule corrected to admit exactly that shape; evidence published from this run's drained, hook-sanitized entries. `--verify-evidence` passes. |

The capture: 83 envelopes, 5 user-id substitutions, stages connection, initial-import (`POST` 201), live-sync-baseline, mover (`PUT` with Enterprise department, `PATCH` email remove/add), leaver (`PUT active=false`), claim-conflict (`POST` 409 ×2), claim-case, claim-confirm (keyed `PUT`), reconciliation (`GET /Users?count=100&startIndex=1`). No token or Bearer string in the files. The fixture `apps/backend/tests/fixtures/iam-scim/connector-lifecycle-phase4.json` is a byte copy; `iam-scim-replay-phase4.integration.test.ts` passes 2/2 (every envelope replayed against fresh SQLite through the mounted HTTP harness). The gate process, database, socket and handoff were deleted afterwards.

## 9. Restore, token rotation and lost-link recovery

- The dev source's token was rotated (`scim:token ... rotate --write-dev-env`), retiring the earlier dev token, and the developer Strapi restarted.
- midPoint was reset again (fresh volumes) and seeded with the new token: connection test 15/15 success.
- HR reconciliation of the reference CSV on this empty midPoint, against Strapi users the source already owns: all seven Identities linked to their existing IdamBox Users (each `POST` 409, then midPoint's lookup by userName found the user and the definite source-key correlation linked it); no duplicates; 14 `PUT`s re-asserted HR values.

## 10. Duplicate keys in a snapshot (found and fixed)

Publishing a reference CSV with a second `000101` row (other name, `terminated`) and running live sync silently replaced Ada: username `ada.dup`, inactive. The CSV connector does not detect duplicate keys. HR reconciliation of the correct file restored her. Fix (`3353b875`): `hr-publish.sh` validates the whole snapshot with `hr-validate.mjs` first; the same duplicate file is now refused (`row 9: duplicate employeeNumber "000101" (first in row 2)`), the live file stays byte-identical to the reference, and `hr-publish.test.sh` covers duplicate, case-only duplicate, empty key and field-count refusals.

## 11. Not observed live

- A validity boundary crossing while the CSV is unchanged (a start or end date passing at 00:00 UTC) was not waited for. The validity scan (`340`, every 5 minutes) is midPoint's native focus validity scan over `validFrom`/`validTo`; import-time evaluation of past and future dates is shown in section 2.
- The nightly schedules were triggered on demand, not waited for; their cron patterns (`0 0 1 * * ?`, `0 0 2 * * ?`, container time zone UTC) are in the task objects.
- A mover or reactivation during a Keycloak outage (it uses the same retry path as the create shown in section 4), the existing-user leaver outbox during an outage (Phase 2 gate), and a Keycloak-side email conflict (IN-03) were not exercised in this phase.
