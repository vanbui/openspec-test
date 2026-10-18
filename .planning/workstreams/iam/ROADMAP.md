# Roadmap: IdamBox Identity and Access Management (IAM)

## Overview

Milestone v1.0 gives the IdamBox product suite its identity lifecycle. It first proves that midPoint 4.8 LTS and the community SCIM2 connector run beside Keycloak, because every later phase depends on that connector. It then makes the shared Strapi backend safe to feed: an identity model that records which Identity Source owns each IdamBox User, and a leaver path that commits even while Keycloak is down. On that foundation Strapi serves SCIM 2.0 to each Identity Source for its own users, midPoint is configured to turn HR CSV changes into joiners, movers and leavers, and the milestone closes with a scripted journey from a CSV row to a CSRM sign-in and back to refusal.

## Milestones

- 🚧 **v1.0 Identity Provisioning** — Phases 1–5 (in progress: Phases 1–4 complete, last on 2026-10-16; Phase 1 connector GO).

## v1.0 — Identity Provisioning

**Milestone goal:** midPoint provisions IdamBox Users from the customer's Identity Source through a Strapi SCIM 2.0 interface, so joiners, movers and leavers reach Keycloak and every IdamBox product without manual user administration.

**Sources:** `.planning/workstreams/iam/IDENTITY-PROVISIONING-BRIEF.md` (decisions D1–D26, section 7 phases, section 8 risks) and `.planning/workstreams/iam/REQUIREMENTS.md` (24 v1 requirements, each mapped to exactly one phase below).

**Execution order:** 1 → 2 → 3 → 4 → 5. Phase 4 may start alongside Phase 3 once Phase 3 has fixed the SCIM contract (discovery responses, the D19 attribute mapping, error semantics and the captured connector request sequence); Phase 4 still finishes after Phase 3, because its success criteria run against the working service. Phase 1's connector spike is a go/no-go gate for every later phase.

**Rules every phase follows** (`.planning/PROJECT.md`, "GSD Workstreams", and this workstream's constraints):
- Before executing a phase that touches `apps/backend`, pull in the other workstreams' latest backend changes and re-run the plan check against them.
- `pnpm --dir apps/backend test`, run from the repository root, is part of every phase gate. In the phases that change `apps/backend` (2, 3 and 5, and 4 if the replay fixtures change) it is also a success criterion.
- A content-type change starts with a `docs/contract-gaps/` record that names every reading workstream (`csrm` reads `IdamBoxUser`) and waits at an approval checkpoint. Only Phase 2 changes content types.
- Shared backend code, both role-function catalogue copies and the OpenAPI contract stay backward compatible: existing `csrm` endpoints and grants keep working.
- Credentials live only in the git-ignored `docker/.env`; no midPoint or connector binary is committed.
- CI never runs midPoint (D18). From Phase 3 on, each phase that touches SCIM records local evidence against a running midPoint.

**Reconciling the brief with the atomic requirements.** The brief's section 7 assigns its draft IDs (IAM-01 to IAM-11) to phases. Splitting them into 24 atomic IDs leaves five placements the brief does not settle. None of them changes the five-phase structure:
1. **PLAT-03 (reload script, reset, README) → Phase 1.** Section 7 lists the reload scripts under Phase 4, but IAM-01 (Phase 1) already requires `docker/README.md` to document reload, and the spike's own resource object is the first configuration that needs re-applying. Phase 4 uses the scripts.
2. **LIFE-01 (refusal after a SCIM deactivation) → Phase 3.** The brief puts IAM-05 in Phase 2, but LIFE-01 names SCIM, which Phase 3 serves. The outage-safe commit (LIFE-02) stays in Phase 2.
3. **LIFE-04 (503, then midPoint completes the operation) → Phase 4.** Phase 3 builds the 503 with `Retry-After`; midPoint completing the operation after Keycloak recovers needs Phase 4's pending-operation refresh task.
4. **ENG-04 (midPoint audit and Strapi request log) → Phase 4.** The brief splits IAM-09 between Phase 3 (Strapi) and Phase 4 (midPoint). Phase 3 builds Strapi's per-request log line; the requirement is verified in Phase 4, where one CSV change shows in both logs.
5. **PROV-06 (link by a confirmed claim) → Phase 4.** Phase 2's upsert service enforces the one-time claim of an unowned, unprotected manual user (under PROV-05); the operator confirming midPoint's correlation case is Phase 4.

**Granularity.** The shared configuration asks for fine granularity (typically 6–10 phases). The operator fixed five phases in D25, and a finer cut would only split coherent capabilities into thin phases (an outbox-only phase, a token-only phase). The roadmap therefore keeps five phases; Phases 2 and 3 are size L.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): planned milestone work
- Decimal phases (2.1, 2.2): urgent insertions (marked with INSERTED)

- [x] **Phase 1: midPoint platform and connector spike** - midPoint 4.8 LTS runs in the `idp` compose project and the community SCIM2 connector is proven on it (go/no-go)
- [x] **Phase 2: Identity model and leaver-safe Keycloak sync** - IdamBox Users record their Identity Source and protection, and a leaver's deactivation commits even while Keycloak is down
- [x] **Phase 3: Strapi SCIM 2.0 service** - An Identity Source provisions its own IdamBox Users through `/scim/v2/Users` with its own bearer token
- [x] **Phase 4: midPoint configuration** - HR CSV joiners, movers and leavers reach Strapi on a 5-minute cycle, with correlation, reconciliation, retry and audit
- [ ] **Phase 5: Sign-in and end-to-end journey** - A CSV joiner sets a password and signs in as a Requestor, and one scripted gate proves joiner → mover → leaver

## Phase Details

### Phase 1: midPoint platform and connector spike

**Goal**: A developer runs midPoint 4.8 LTS beside Keycloak from the one `idp` compose project, and the community SCIM2 connector is proven to load and connect on it before anything depends on it.
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02, PLAT-03
**Decisions**: D4, D5, D9, D10, D23, D24 (ADRs 1 and 3)
**Size**: M
**Success Criteria** (what must be TRUE):
  1. With `docker/.env` copied from the committed `docker/.env.example`, one compose command starts Keycloak, ClamAV, midPoint 4.8.14 LTS (pinned image tag, never `latest`) with its PostgreSQL 16 repository prepared by the one-shot init service, and Mailpit. midPoint's console answers on `127.0.0.1:8081`, and no credential or binary is tracked by git.
  2. **Go/no-go gate:** the image built by the multi-stage `docker/midpoint/Dockerfile` (connector tag `V1.2.9` built from source) lists the Provision IAM SCIM2 connector as available, and a resource on it passes its connection test against a stub `/ResourceTypes` that lists User and Group. The go or no-go result is recorded. On no-go, Phase 2 does not start until the operator chooses the fallback (a custom ConnId connector or the midPoint 4.11 SCIMREST framework) and ADR 3 records it.
  3. A developer edits a numbered object in `docker/midpoint/objects/`, runs `docker/midpoint/reload.ps1` or `reload.sh`, and sees the change in midPoint. `docker compose down -v` returns a clean stack, `*.done` files are git-ignored, and `docker/README.md` documents start, reset and reload.
  4. `docs/adr/` holds ADR 1 (midPoint is the identity engine; SCIM 2.0 is Strapi's only inbound provisioning contract; it replaces the 2026-10-03 "Strapi is the hub" decision, and that brief is marked superseded) and ADR 3 (midPoint 4.8 LTS and the community SCIM2 connector: pinned versions, licence facts without a legal opinion, community-support risk and the fallback).

**Notes**: Expected to touch only `docker/` and `docs/`; the backend suite still runs at the phase gate (workstream constraint). `.planning/PROJECT.md` already records the platform-workstream exception (D4), so this phase only checks it still matches. `docs/iam-early-research/midpoint-docker-compose.yaml` is a starting point, not a copy (D5: no pgadmin, no Samba AD, no conflicting passwords).
**Plans**: 5 plans

Plans:

**Wave 1**

- [ ] 01-01-PLAN.md — Wave 0 tooling, isolated verification context and exact discovery fixtures (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 01-02-PLAN.md — Source-built connector discovery tracer and actual outcome (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 01-03-PLAN.md — Both ordered configuration reload paths and failure checks (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 01-04-PLAN.md — Consecutive startup/reused/reset lifecycle and backend regression (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 01-05-PLAN.md — Operator instructions, architecture ADRs and evidence audit (wave 5)

### Phase 2: Identity model and leaver-safe Keycloak sync

**Goal**: The shared backend knows which Identity Source owns each IdamBox User and enforces that ownership, and a leaver's deactivation commits in Strapi even while Keycloak is unavailable.
**Depends on**: Phase 1 (the connector go decision gates every later phase)
**Requirements**: MODEL-01, MODEL-03, PROV-05, PROV-07, LIFE-02
**Decisions**: D2, D6, D13, D14, D15, D16, D24 (ADR 0002 amendment)
**Size**: L
**Success Criteria** (what must be TRUE):
  1. **Approval checkpoint:** a `docs/contract-gaps/` record for `IdentitySource`, the new `IdamBoxUser` fields and `KeycloakSyncOutbox` (brief section 5) names `csrm` as a reader of `IdamBoxUser`, is checked against `docs/references/idambox-datamodel.jdl` and `CONTEXT.md` terms, and is approved by the operator before any content-type change. The schema that lands matches the approved record.
  2. The dev seed registers the Identity Source "midPoint (dev)" with its own non-human service identity, which holds only the Identity Provisioning Function in both catalogue copies. Every IdamBox User reads as sourced (Identity Source and source key) or manual, and as protected or not; existing users read as manual and unprotected, with their CSRM access unchanged.
  3. Through the identity upsert service, a source changes only the users it owns, or an unowned and unprotected manual user it claims once; it can never read or change another source's users or a protected user. An admin's edit of a sourced user's HR-owned fields through the Strapi user APIs is refused, while role changes still succeed.
  4. With Keycloak stopped and provisioning on, deactivating a user commits in Strapi and the person is refused on their next request. When Keycloak returns, the `KeycloakSyncOutbox` worker disables their Keycloak user and ends their sessions, and each outbox row is claimed once even with two Strapi instances. The ADR 0002 amendment records this.
  5. A test fails any `IdamBoxUser` write that bypasses the Document Service (for example through `strapi.db.query`), and `pnpm --dir apps/backend test` passes with every existing `csrm` endpoint and grant unchanged.

**Notes**: No UI. The source badge and read-only HR fields on CSRM screens are handed to the `csrm` workstream (brief section 9). Name the contract-gap record so it cannot be mistaken for one of `csrm`'s phase-numbered records (for example, with an `iam-` prefix). Risks addressed: middleware bypass (criterion 5) and claim misuse (claims logged, limited to unowned, unprotected users).
**Plans**: 13 plans; independently verified 2026-10-14; executed and gated 2026-10-15 (see `02-GATE-EVIDENCE.md`). The operator approved the exact contract-gap record on 2026-10-14, satisfying success criterion 1's approval gate. The first task reconciles the schemas against that record; no new human checkpoint is added.

Plans:

**Wave 1**
- [x] 02-01-PLAN.md — Exact approved schemas, generated declarations and durable physical constraints

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Verified pinned PostgreSQL runtime driver

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-03-PLAN.md — IAM catalogue/Application partition and unserved SCIM reservations

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-04-PLAN.md — Atomic source registration and opt-in development seed

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 02-05-PLAN.md — Fresh source principals, bootstrap integration and service grant isolation

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 02-06-PLAN.md — Registered service exclusion from human selectors and counts

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 02-07-PLAN.md — Always-on transactional ownership guard and shared identity input contracts

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 02-08-PLAN.md — Six-method scoped identity service, atomic claim and tombstone behaviour

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 02-09-PLAN.md — Transient credentials, nested Document Service linkage and atomic leaver outbox

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 02-10-PLAN.md — Bounded disable/logout client and fenced worker under the shared user lock

**Wave 11** *(blocked on Wave 10 completion)*
- [x] 02-11-PLAN.md — Orchestrator-run two-process PostgreSQL ownership, lease and reactivation gate

**Wave 12** *(blocked on Wave 11 completion)*
- [x] 02-12-PLAN.md — AST and runtime enforcement of Document Service-only user writes

**Wave 13** *(blocked on Wave 12 completion)*
- [x] 02-13-PLAN.md — ADR 0002 amendment, orchestrator-run live outage/recovery and green backend gate

Cross-cutting constraints:
- Keep existing CSRM endpoints, grants, user roles, subjects and references backward compatible; preserve frozen JDL terminology.
- Keep IDAMBOX_KEYCLOAK_PROVISIONING and IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION false/unset in committed configuration.
- Every user mutation uses Document Service and the approved transaction/ownership boundary; raw coordination is restricted to outbox work and SELECT locks.
- Live outage and two independent Strapi instances on shared PostgreSQL require orchestrator-run execution evidence. Planning verification does not satisfy runtime gates.
- No Phase 2 public provisioning endpoint, bearer-token tooling, correlation screen, source restoration or sign-in work.

### Phase 3: Strapi SCIM 2.0 service

**Goal**: An Identity Source, holding only its own bearer token, creates, reads, searches, updates and deactivates its own IdamBox Users through Strapi's SCIM 2.0 `/Users`, and the connector's real request sequence proves the contract in CI.
**Depends on**: Phase 2 (ownership, claim, protected and outbox rules); Phase 1 (a running midPoint for the connection test and the captured request sequence)
**Requirements**: MODEL-02, PROV-01, PROV-02, PROV-03, PROV-04, PROV-08, LIFE-01, LIFE-03
**Decisions**: D1, D11, D12, D15, D16, D18, D19, D20, D21
**Size**: L
**Success Criteria** (what must be TRUE):
  1. An operator runs `pnpm --dir apps/backend scim:token <source>` to issue, rotate or revoke an Identity Source's bearer token. The token is printed once and only its hash is stored, a rotated or revoked token is refused with 401, and the dev source's token goes into the git-ignored `docker/.env`.
  2. midPoint's SCIM2 resource, holding the dev source's token, passes its connection test against Strapi's `/ResourceTypes` (listing User and Group), `/Schemas` and `/ServiceProviderConfig`. `GET /Groups` returns an empty list, and Group writes answer 501.
  3. Through SCIM, `POST /Users` creates a sourced user who holds only the birthright Requestor role. `GET`, list and `eq`/`and` search on `userName`, `externalId`, `emails.value` and Enterprise `employeeNumber` page with `startIndex`/`count` and return only the source's own users plus unowned, unprotected manual users. Full `PUT` and `PATCH` (operation names in any case) change identity attributes without touching IdamBox Roles or other IdamBox-owned data. A duplicate create answers 409 `uniqueness`, and a Keycloak outage answers 503 with `Retry-After`.
  4. A user set to `active=false` through SCIM is refused on their next Strapi API request and in CSRM. A SCIM `DELETE` deactivates the user and sets `sourceDeletedAt`; later reads answer 404, and the record and every request, risk and owner reference to it remain.
  5. The connector's request sequence, captured once from midPoint against Strapi, replays as backend tests in CI. Every SCIM request is rate-limited and writes one structured log line (source, operation, target, outcome), every served SCIM operation is a FunctionApi of the Identity Provisioning Function, and `pnpm --dir apps/backend test` passes with `csrm` endpoints and grants unchanged.

**Notes**: Every SCIM write goes through Phase 2's upsert service and the Document Service. Connector quirks to honour (brief section 8): User and Group in `/ResourceTypes`, full-`PUT` updates under RFC 7644 replace semantics that must not wipe IdamBox-owned data, lowercase PATCH operations, `eq`-only search. Fixing the SCIM contract (discovery responses, D19 mapping, error semantics, captured sequence) is the point at which Phase 4 may start in parallel. The request log line built here is ENG-04's Strapi half; ENG-04 is verified in Phase 4. Risk addressed: token compromise (scoped to the source's own users, rotatable, every write logged with the source).
**Plans**: 18 plans in 18 sequential waves, preserving Phase 2's ordered small groups.

Plans:

**Wave 1**

- [x] 03-01-PLAN.md — Serialize source token issuance, rotation and revocation (wave 1; accepted on the backend gate minus the two csrm red-phase files, WINDOWS.md entry 11)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Deliver one-time credentials through a safe development CLI (wave 2, after 03-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03-PLAN.md — Validate and map the fixed SCIM wire contract (wave 3, after 03-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-04-PLAN.md — Constrain search, pagination and response projection (wave 4, after 03-03)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 03-05-PLAN.md — Reduce ordered PATCH atomically under the existing user lock (wave 5, after 03-04)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 03-06-PLAN.md — Authenticate source bearers and independently persist activity (wave 6, after 03-05)

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 03-07-PLAN.md — Bound the SCIM namespace before parsing and log each request once (wave 7, after 03-06)

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 03-08-PLAN.md — Describe authenticated discovery and unsupported Group behavior (wave 8, after 03-07)

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 03-09-PLAN.md — Mount all 21 root operations through thin scoped handlers (wave 9, after 03-08)

**Wave 10** *(blocked on Wave 9 completion)*

- [x] 03-10-PLAN.md — Prove protocol lifecycle, rollback, logs and source isolation through HTTP (wave 10, after 03-09)

**Wave 11** *(blocked on Wave 10 completion)*

- [x] 03-11-PLAN.md — Publish additive root SCIM contract and regenerate runtime inventory (wave 11, after 03-10)

**Wave 12** *(blocked on Wave 11 completion)*

- [x] 03-12-PLAN.md — Build sanitized real-connector capture tooling without fixtures (wave 12, after 03-11)

**Wave 13** *(blocked on Wave 12 completion)*

- [x] 03-13-PLAN.md — Orchestrator captures the real pinned connector lifecycle (wave 13, after 03-12; orchestrator checkpoint)

**Wave 14** *(blocked on Wave 13 completion)*

- [x] 03-14-PLAN.md — Replay genuine captured traffic against real backend HTTP in CI (wave 14, after 03-13)

**Wave 15** *(blocked on Wave 14 completion)*

- [x] 03-15-PLAN.md — Prepare same-token refusal tests and live gate helpers (wave 15, after 03-14)

**Wave 16** *(blocked on Wave 15 completion)*

- [x] 03-16-PLAN.md — Orchestrator proves immediate API and browser refusal during live outage (wave 16, after 03-15; orchestrator checkpoint)

**Wave 17** *(blocked on Wave 16 completion)*

- [x] 03-17-PLAN.md — Orchestrator reviews code and audits every security mitigation (wave 17, after 03-16; orchestrator checkpoint)

**Wave 18** *(blocked on Wave 17 completion)*

- [x] 03-18-PLAN.md — Orchestrator closes the five-criterion regression and evidence gate (wave 18, after 03-17; orchestrator checkpoint)

**Execution constraints**: No content-type/schema/index/JDL changes; all three committed activation flags remain false. Capture tooling precedes the orchestrator-run real connector capture, which precedes fixture/replay creation. Docker, Keycloak, midPoint, isolated dev servers, browser proof at 1440/375 and outage work run only at orchestrator checkpoints with phase-local evidence. Post-execution code review and security audit precede the final repository-root backend and contract/client gate. Plan completion checkboxes remain unset until actual execution.

### Phase 4: midPoint configuration

**Goal**: A change in the reference HR CSV becomes a joiner, mover or leaver in Strapi within one 5-minute cycle, with correlation, drift repair, retry and audit handled by midPoint, all kept as configuration in the repository.
**Depends on**: Phase 3 (a working SCIM service); may start once Phase 3 has fixed the SCIM contract
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, PROV-06, LIFE-04
**Decisions**: D3, D6, D12, D13, D18, D19, D20, D21, D23
**Size**: M
**Success Criteria** (what must be TRUE):
  1. midPoint imports the reference HR CSV from `docker/midpoint/hr/` with the D19 columns, and each person becomes one Identity named and correlated by `employeeNumber`. The resources, object template, mapping and tasks are numbered files in `docker/midpoint/objects/`, applied with the Phase 1 reload script.
  2. A joiner, a mover and a leaver (`status` `terminated`) added to the CSV reach Strapi within one 5-minute live-sync cycle as a create, an attribute update and `PUT active=false`, never a `DELETE`. The mover keeps every IdamBox Role granted inside IdamBox.
  3. A pre-existing manual user who matches a CSV person by email or employee number appears as a correlation case. Only the operator's confirmation links them, without a duplicate, and afterwards only the source key links them. Protected users never appear as candidates.
  4. With Keycloak stopped, a CSV joiner's create is answered 503 with `Retry-After`, waits in midPoint as a pending operation, and reaches Strapi and Keycloak after Keycloak returns, through the refresh task and without manual action. Drift in a midPoint-managed IdamBox User is repaired by the nightly reconciliation (triggered on demand for the check).
  5. midPoint's audit log shows each joiner, mover and leaver decision with its cause, and Strapi's SCIM log shows the matching request with source, operation, target and outcome. The replay tests still match the requests this configuration sends (re-captured if they changed), and `pnpm --dir apps/backend test` passes.

**Carried from Phase 3** (see `phases/03-strapi-scim-2-0-service/03-GATE-EVIDENCE.md`): midPoint 4.8.14 passes no paging to the connector, so an unpaged `GET /Users` returns the default 100 users (P3-36). Reconciliation above 100 users needs filtered correlation, a paging-capable configuration or an approved default change, proven here. A Keycloak email conflict during a SCIM write is reported as 503 under P3-19 (review IN-03). If this phase's midPoint configuration changes the connector's requests, recapture and update the replay fixture in this phase.
**Notes**: A DatabaseTable HR source is a stretch goal, not a requirement (D3). Risks addressed: retry storms (tune the refresh task against `Retry-After` so recovery does not flood Keycloak), config drift (reload scripts and README from Phase 1), throughput (measure and record the first full reconciliation of the reference CSV before any timing is promised for larger populations).
**Plans**: 32 plans in 32 sequential waves; 50 tasks. Planning review passed after revision 1 (`04-PLAN-CHECK.md`). Executed 2026-10-16 as one orchestrator-driven pass: the early live probes changed the design (amendments A1–A10 in `04-CONTEXT.md`); plan disposition in `04-EXECUTION.md`, criteria in `04-VERIFICATION.md`, evidence in `04-LIVE-EVIDENCE.md`.

**Wave 1**

- [ ] [04-01: Freeze the shared baseline and executable HR fixture contract](phases/04-midpoint-configuration/04-01-PLAN.md)

**Wave 2 *(blocked on Wave 1 completion)***

- [ ] [04-02: Implement and test whole-snapshot acceptance and UTC activation offline](phases/04-midpoint-configuration/04-02-PLAN.md)

**Wave 3 *(blocked on Wave 2 completion)***

- [ ] [04-03: Define fixed configuration identities and full local schema validation](phases/04-midpoint-configuration/04-03-PLAN.md)

**Wave 4 *(blocked on Wave 3 completion)***

- [ ] [04-04: Build the shared secure XML credential renderer offline](phases/04-midpoint-configuration/04-04-PLAN.md)

**Wave 5 *(blocked on Wave 4 completion)***

- [ ] [04-05: Wire seed, Bash and PowerShell to one fail-closed reload contract](phases/04-midpoint-configuration/04-05-PLAN.md)

**Wave 6 *(blocked on Wave 5 completion)***

- [ ] [04-06: Create closed phase evidence, audit and population validators offline](phases/04-midpoint-configuration/04-06-PLAN.md)

**Wave 7 *(blocked on Wave 6 completion)***

- [ ] [04-07: Prepare retry eligibility and isolated gate control contracts offline](phases/04-midpoint-configuration/04-07-PLAN.md)

**Wave 8 *(blocked on Wave 7 completion)***

- [ ] [04-08: Prepare CSV and connector compatibility probes offline](phases/04-midpoint-configuration/04-08-PLAN.md)

**Wave 9 *(blocked on Wave 8 completion)***

- [ ] [04-09: Prepare native-case and pending-operation compatibility probes offline](phases/04-midpoint-configuration/04-09-PLAN.md)

**Wave 10 *(blocked on Wave 9 completion)***

- [ ] [04-10: Orchestrator-run live verification of runtime, CSV acceptance and unchanged-byte dates](phases/04-midpoint-configuration/04-10-PLAN.md)

**Wave 11 *(blocked on Wave 10 completion)***

- [ ] [04-11: Orchestrator-run live verification of D19 writes, clears and equality translation](phases/04-midpoint-configuration/04-11-PLAN.md)

**Wave 12 *(blocked on Wave 11 completion)***

- [ ] [04-12: Orchestrator-run live verification of native manual-target confirmation](phases/04-midpoint-configuration/04-12-PLAN.md)

**Wave 13 *(blocked on Wave 12 completion)***

- [ ] [04-13: Orchestrator-run live verification of durable retry eligibility and capped cadence](phases/04-midpoint-configuration/04-13-PLAN.md)

**Wave 14 *(blocked on Wave 13 completion)***

- [ ] [04-14: Create persistent HR and D19 resource configuration from supported probes](phases/04-midpoint-configuration/04-14-PLAN.md)

**Wave 15 *(blocked on Wave 14 completion)***

- [ ] [04-15: Create the scoped HR template, native cases and disable semantics](phases/04-midpoint-configuration/04-15-PLAN.md)

**Wave 16 *(blocked on Wave 15 completion)***

- [ ] [04-16: Configure independent schedules, complete managed repair and proven pending refresh](phases/04-midpoint-configuration/04-16-PLAN.md)

**Wave 17 *(blocked on Wave 16 completion)***

- [ ] [04-17: Prepare configuration convergence and lifecycle timing checks offline](phases/04-midpoint-configuration/04-17-PLAN.md)

**Wave 18 *(blocked on Wave 17 completion)***

- [ ] [04-18: Orchestrator-run live verification of secure seed and explicit reload convergence](phases/04-midpoint-configuration/04-18-PLAN.md)

**Wave 19 *(blocked on Wave 18 completion)***

- [ ] [04-19: Orchestrator-run live lifecycle tracer from CSV through native audit to Strapi](phases/04-midpoint-configuration/04-19-PLAN.md)

**Wave 20 *(blocked on Wave 19 completion)***

- [ ] [04-20: Prepare authority and greater than 100 managed repair gates offline](phases/04-midpoint-configuration/04-20-PLAN.md)

**Wave 21 *(blocked on Wave 20 completion)***

- [ ] [04-21: Orchestrator-run live verification of confirmed claims and protected boundaries](phases/04-midpoint-configuration/04-21-PLAN.md)

**Wave 22 *(blocked on Wave 21 completion)***

- [ ] [04-22: Orchestrator-run live verification of complete 125-user repair and nightly schedules](phases/04-midpoint-configuration/04-22-PLAN.md)

**Wave 23 *(blocked on Wave 22 completion)***

- [ ] [04-23: Prepare genuine CSV outage, recovery and remote-conflict gates offline](phases/04-midpoint-configuration/04-23-PLAN.md)

**Wave 24 *(blocked on Wave 23 completion)***

- [ ] [04-24: Orchestrator-run live verification of automatic outage recovery and leaver outbox](phases/04-midpoint-configuration/04-24-PLAN.md)

**Wave 25 *(blocked on Wave 24 completion)***

- [ ] [04-25: Orchestrator-run live verification of remote conflict rollback and bounded attention](phases/04-midpoint-configuration/04-25-PLAN.md)

**Wave 26 *(blocked on Wave 25 completion)***

- [ ] [04-26: Prepare cold throughput and phase-local genuine capture runners offline](phases/04-midpoint-configuration/04-26-PLAN.md)

**Wave 27 *(blocked on Wave 26 completion)***

- [ ] [04-27: Orchestrator-run live first full-reference reconciliation measurement](phases/04-midpoint-configuration/04-27-PLAN.md)

**Wave 28 *(blocked on Wave 27 completion)***

- [ ] [04-28: Orchestrator-run live Phase 4 connector recapture from persistent configuration](phases/04-midpoint-configuration/04-28-PLAN.md)

**Wave 29 *(blocked on Wave 28 completion)***

- [ ] [04-29: Replay genuine Phase 4 envelopes through mounted backend HTTP offline](phases/04-midpoint-configuration/04-29-PLAN.md)

**Wave 30 *(blocked on Wave 29 completion)***

- [ ] [04-30: Document operations and prepare the final acceptance validator offline](phases/04-midpoint-configuration/04-30-PLAN.md)

**Wave 31 *(blocked on Wave 30 completion)***

- [ ] [04-31: Orchestrator review of final configuration, scripts and threat mitigations](phases/04-midpoint-configuration/04-31-PLAN.md)

**Wave 32 *(blocked on Wave 31 completion)***

- [ ] [04-32: Orchestrator-run final acceptance with unfiltered backend and contract checks](phases/04-midpoint-configuration/04-32-PLAN.md)

**Cross-cutting constraints:**

- Offline implementation and behavior checks precede their separate orchestrator-run live verification plans. All live evidence remains pending.
- Waves 10–13 must establish supported CSV, connector, native correlation and retry behavior before dependent persistent configuration. BLOCKED evidence cannot unlock later writes.
- Keep runtime/connector pins, HR authority, source/key ownership, explicit IdamBox roles, public contracts/grants/catalogues/schemas and committed false activation defaults intact.
- Render credentials only through the protected shared application contract; preserve runtime identities, links, cases, task progress and sync tokens. No secrets in tracked files or evidence.
- Final acceptance requires genuine Phase 4 capture/replay, all six requirements and five success criteria, and the unfiltered backend suite.

### Phase 5: Sign-in and end-to-end journey

**Goal**: A person added to the HR CSV sets their own password through Keycloak and signs in to CSRM as a Requestor, and one scripted local gate proves the whole joiner → mover → leaver journey.
**Depends on**: Phase 4
**Requirements**: SIGN-01, SIGN-02
**Decisions**: D17, D18, D20, D22
**Size**: M
**Success Criteria** (what must be TRUE):
  1. A CSV joiner receives Keycloak's set-password email (`execute-actions-email` with `UPDATE_PASSWORD`) in Mailpit and sets their own password through Keycloak. No SCIM request, mapping or provisioning step sets a password.
  2. The joiner then signs in to CSRM and has only the Requestor's capabilities.
  3. On a freshly reset stack, the scripted gate in `docker/midpoint/e2e/` runs CSV joiner → midPoint → Strapi → Keycloak → sign-in as Requestor → CSV mover → CSV leaver → refused in the CSRM UI and the Strapi API, and stops with the failing step named when any step breaks.
  4. A Playwright sign-in proof passes at 1440 and 375 widths, and the gate's evidence is recorded with the phase.
  5. `pnpm --dir apps/backend test` passes, and any change in `apps/csrm` is limited to the sign-in journey and passes CSRM's own checks.

**Notes**: `iam` touches `apps/csrm` only where the sign-in journey needs it (D22); every other CSRM screen change is handed to the `csrm` workstream (brief section 9). Corporate IdP brokering is backlog (FUT-03).
**Plans**: 12 plans in 8 waves; checked 2026-10-17. Implementation and live acceptance pending.

**UI hint**: yes

Planning records: [decisions and coverage](phases/05-sign-in-and-end-to-end-journey/05-PLANNING-DECISIONS.md), [plan check](phases/05-sign-in-and-end-to-end-journey/05-PLAN-CHECK.md), [UI contract](phases/05-sign-in-and-end-to-end-journey/05-UI-SPEC.md).

**Wave 1**

- [x] [05-01: Sourced-create invitation through the real outer commit](phases/05-sign-in-and-end-to-end-journey/05-01-PLAN.md)

**Wave 2 *(blocked on prerequisite waves)***

- [x] [05-02: Transaction failure and eligibility acceptance matrix](phases/05-sign-in-and-end-to-end-journey/05-02-PLAN.md)

**Wave 3 *(blocked on prerequisite waves)***

- [x] [05-03: Guarded operator resend administration command](phases/05-sign-in-and-end-to-end-journey/05-03-PLAN.md)

**Wave 2 *(blocked on prerequisite waves)***

- [x] [05-04: Reproducible local SMTP seed without enabling defaults](phases/05-sign-in-and-end-to-end-journey/05-04-PLAN.md)

- [x] [05-05: Ordered gate and fail-closed evidence protocol](phases/05-sign-in-and-end-to-end-journey/05-05-PLAN.md)

**Wave 3 *(blocked on prerequisite waves)***

- [x] [05-06: Fresh-stack CSV task-driven lifecycle adapters](phases/05-sign-in-and-end-to-end-journey/05-06-PLAN.md)

**Wave 4 *(blocked on prerequisite waves)***

- [x] [05-07: Actual mail-link password setup and independent browser sign-in](phases/05-sign-in-and-end-to-end-journey/05-07-PLAN.md)

**Wave 5 *(blocked on prerequisite waves)***

- [x] [05-08: Requestor mover continuity and pre-expiry leaver refusal](phases/05-sign-in-and-end-to-end-journey/05-08-PLAN.md)

**Wave 4 *(blocked on prerequisite waves)***

- [x] [05-09: Versioned endpoint contract and IN-03 recovery stage](phases/05-sign-in-and-end-to-end-journey/05-09-PLAN.md)

**Wave 6 *(blocked on prerequisite waves)***

- [x] [05-10: Operating contract and unfiltered offline regression gate](phases/05-sign-in-and-end-to-end-journey/05-10-PLAN.md)

**Wave 7 *(blocked on prerequisite waves)***

- [x] [05-11: Orchestrator checkpoint: fresh-stack endpoint contract](phases/05-sign-in-and-end-to-end-journey/05-11-PLAN.md)

**Wave 8 *(blocked on prerequisite waves)***

- [ ] [05-12: Orchestrator checkpoint: complete responsive journey and final evidence](phases/05-sign-in-and-end-to-end-journey/05-12-PLAN.md) (all 29 live stages pass; evidence publication blocked by B1, see 05-LIVE-EVIDENCE.md)

**Cross-cutting constraints:**

- Keep all three committed activation defaults false; preserve content types, JDL, grants and the disable-only outbox. Every user write uses the identity service and Document Service.
- Use offline code, real SQLite and injected clients for plans 01–10; plans 11–12 alone run orchestrator live checkpoints. No mock or historical result substitutes for live evidence.
- Preserve private credential handoffs, explicit compose environment, administration-before-listener compilation ownership and safe evidence.
- Require unfiltered backend and CSRM checks, fresh-stack two-width mail/password/OIDC/mover/leaver proof and named IN-03 recovery before acceptance. Keycloak A1–A4 remain gated on pinned-server proof.


## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 (Phase 4 may overlap Phase 3 once the SCIM contract is fixed).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. midPoint platform and connector spike | 5/5 (built directly; see 01-SUMMARY.md) | Complete — connector GO | 2026-10-14 |
| 2. Identity model and leaver-safe Keycloak sync | 13/13 | Complete — all gates green (02-GATE-EVIDENCE.md) | 2026-10-15 |
| 3. Strapi SCIM 2.0 service | 18/18 | Complete | 2026-10-16 |
| 4. midPoint configuration | 32/32 (consolidated; see 04-EXECUTION.md) | Complete | 2026-10-16 |
| 5. Sign-in and end-to-end journey | 11/12 | Live stages pass; acceptance blocked by B1 (unfiltered backend suite) | - |
