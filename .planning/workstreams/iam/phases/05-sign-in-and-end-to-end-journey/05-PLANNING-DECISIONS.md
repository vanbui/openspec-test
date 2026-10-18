# Phase 5 planning decisions and source audit

Status: planning only; execution, all test results and live acceptance pending. Locked P5-01–P5-25 remain unchanged.

## Decomposition and dependencies

Twelve plans in eight waves, with two tasks each. First slice is the real mounted SCIM → identity service → Document Service → actual outer commit → bounded invitation transport path verified offline with an injected remote client. The remote acceptance boundary is injected only for tests; production dispatch uses the real client. Actual SMTP, self-service form, OIDC, midPoint tasks and responsive proof are explicit later orchestrator checkpoints. They cannot be replaced by this offline tracer.

| Wave | Plans | Result |
|---|---|---|
| 1 | 05-01 | Trusted sourced-create invitation tracer and detached lifecycle |
| 2 | 05-02, 05-04, 05-05 | Transaction/exclusion matrix, SMTP seed, ordered gate/evidence |
| 3 | 05-03, 05-06 | Guarded resend and native CSV task adapters |
| 4 | 05-07, 05-09 | Mail/browser and version-contract/IN-03 adapters |
| 5 | 05-08 | Requestor continuity and pre-expiry refusal |
| 6 | 05-10 | Operating instructions and unfiltered offline gate |
| 7 | 05-11 | Orchestrator disposable reset and version contract checkpoint |
| 8 | 05-12 | Orchestrator complete two-width journey/evidence checkpoint |

Dependencies are explicit in each frontmatter. Shared files never occur in the same wave. Plan09 and plan07 use different modules; plan08 follows both browser and runtime ownership. Backend tests share one application compilation/dist directory, so no concurrent backend compilation/test process is allowed even where source files do not overlap.

## Selected implementation choices

- Register through public nested strapi.db.transaction onCommit after successful Document Service create while still under the original user lock. Installed Strapi reuses the outer callback list, clears transaction state before commit and synchronously invokes callbacks after commit; returned promises are not awaited. Never send merely because an inner call returned.
- Create instance-scoped detached AsyncResource at enabled bootstrap outside any request/source authority. Commit callback is synchronous/non-throwing, scheduler throws and all asynchronous rejections are caught, safe logging cannot throw. Tests prove both a live independent AsyncLocalStorage sentinel and source-write authority are absent in deferred work, including while the original request remains alive.
- Dispatch is read-only and rechecks committed eligibility. Existing identity upsert service plus Document Service remains the sole user-write path. No changes to content-type schemas, generated types, JDL or outbox operation are authorized.
- Name bounded service/dispatcher under apps/backend/src/iam/password-setup; operator command is iam:password-setup with one non-secret documentId. One post-commit automatic attempt has explicit crash/timeout uncertainty and explicit resend recovery.
- Initially omit optional action-email query parameters. Do not redirect action completion to an Auth.js callback without an initiated OIDC state. Exact client_id/redirect_uri/lifespan contract, SMTP and pre-existing requiredActions remain A1–A4 assumptions requiring actual 26.6.1 contract proof before live acceptance. Offline fake-client development is permitted.
- Default local seed SMTP is mailpit:1025, fictitious sender, auth/SSL/STARTTLS false. Existing realm clients/scopes/subjects/grants and committed activation flags remain intact/false.
- Use 300-second setup, 180-second normal stage, 120-second mail, 600-second per-viewport lifecycle excluding IN-03, 1500-second native retry recovery, 3600-second overall gate and separate 60-second cleanup. Deadlines stop dependent work and preserve original stage failure.
- Dedicated browser configuration/spec/reporter remains opt-in and inert under ordinary discovery/listing. Use one worker, zero retries, actual Next/OIDC at registered localhost:3000, distinct synthetic people per viewport and no automatic sensitive artifacts.
- Live modes are orchestrator checkpoints; all source/tests/seed/config/docs and --check remain offline. --verify-evidence is read-only offline once safe actual evidence exists. No planning command resets services, runs tests or declares runtime success.
- Calibration query returned factor 1, zero samples, confidence low. Estimate is raw 32000 tokens per offline plan or 22000 per live checkpoint, unchanged after calibration. Estimates describe later execution, not measured actual usage.
- No dependency install is planned; package legitimacy audit for new installs is inapplicable. No git writes/commits or workflow auto-execution are part of this planning run.

## Private environment contract

Fresh-database prerequisite: current seedCoreData(strapi: Core.Strapi) is guarded by IDAMBOX_SEED_CORE and seeds approved Applications only. Current seedCsrmData(strapi: Core.Strapi), guarded by IDAMBOX_SEED_CSRM, reads local control libraries and seeds Applications/Functions/FunctionAPIs/Roles before Jane/Bob/control/workflow fixtures. Plan06 extracts only its existing capability-catalogue block into explicit seedCapabilityCatalogue(strapi), returning the role map and retaining the exact approved partition/linkage. Full seedCsrmData continues to call it with unchanged existing fixture behavior. Gate administration loads with provisioning/token-verification and automatic seeds false, explicitly calls seedCoreData with its flag temporarily true/restored, then seedCapabilityCatalogue, asserts exact active IAM app/provisioning role/function/APIs, and only then calls registerIdentitySource. Full seedCsrmData and broad fixture bootstrap never run in gate administration/listener. Real fresh SQLite tests prove the initial missing-grant refusal, subsequent catalogue→source→token success, idempotence and zero remote provisioning/email calls. Existing user-write authority remains unchanged.

Require IAM_JOURNEY_DISPOSABLE=true; IAM_JOURNEY_RUN_DIR must be an owner-only ignored directory under apps/backend/.tmp, and DATABASE_FILENAME must be a new file below it. IAM_JOURNEY_EVIDENCE_DIR points to the selected Phase5 evidence directory for the run. Verify owner/modes/containment before use. Read no developer database. Copy no ambient .env implicitly: construct allowlisted isolated child environments, with ENV_PATH pointing to a private gate-owned config.

Private inputs use process environment/stdin or owner-only handoffs, never CLI credentials: KEYCLOAK_BASE_URL, KEYCLOAK_REALM, KEYCLOAK_ADMIN_CLIENT_ID, KEYCLOAK_ADMIN_CLIENT_SECRET, KEYCLOAK_ISSUER, KEYCLOAK_TOKEN_CLIENT_ID; AUTH_URL, AUTH_SECRET, AUTH_KEYCLOAK_ID, AUTH_KEYCLOAK_SECRET, AUTH_KEYCLOAK_ISSUER; CSRM_API_BASE_URL and CSRM_API_TOKEN. Existing gate client input names IAM_LIVE_CLIENT_ID/IAM_LIVE_CLIENT_SECRET may map into Auth.js child variables. Runner generates IAM_JOURNEY_CONTROL_TOKEN and private loopback IAM_JOURNEY_CONTROL, passes them only to browser child, and generates all people/passwords per run. Optional IAM_KEYCLOAK_VENDOR_DIR selects a local version-pinned vendor checkout, never a network fetch.

The owned compose environment supplies actual KC_BOOTSTRAP_ADMIN_USERNAME and KC_BOOTSTRAP_ADMIN_PASSWORD, MIDPOINT_ADMIN_PASSWORD, MIDPOINT_DB_NAME, MIDPOINT_DB_USER, MIDPOINT_DB_PASSWORD and MIDPOINT_SCIM_TOKEN, matching docker/docker-compose.yaml and docker/.env.example. IAM_JOURNEY_COMPOSE_ENV_FILE selects an owner-only no-symlink private file under IAM_JOURNEY_RUN_DIR; pass --env-file explicitly on every compose call and construct an allowlisted child environment so ambient variables cannot override it. Refuse legacy KEYCLOAK_ADMIN/KEYCLOAK_ADMIN_PASSWORD aliases or missing required keys. Never read or modify developer docker/.env, display values or dump compose config.

Live child flags: IDAMBOX_KEYCLOAK_PROVISIONING=true and IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true for backend; CSRM_AUTH_OIDC_ENABLED=true and CSRM_DEV_IDENTITY=false for web. Keep issuer/origin consistent. Ordinary committed defaults stay false. Backend gates must not borrow a developer listener or shared compiler output.

## Exact orchestrator command contract

All commands run separately from repository root and are future implementation/live contracts. No command below was run during planning. The compose file declares name: idp; explicitly pin --project-name idp and refuse a conflicting COMPOSE_PROJECT_NAME. Gate preflight verifies disposable ownership before reset.

```sh
node docker/midpoint/e2e/journey.mjs --check
docker compose --project-name idp --env-file "$IAM_JOURNEY_COMPOSE_ENV_FILE" --project-directory docker -f docker/docker-compose.yaml down -v
docker compose --project-name idp --env-file "$IAM_JOURNEY_COMPOSE_ENV_FILE" --project-directory docker -f docker/docker-compose.yaml up -d --build
node docker/midpoint/e2e/journey.mjs --probe-keycloak
node docker/midpoint/e2e/journey.mjs --verify-evidence --contract
node docker/midpoint/e2e/journey.mjs --run
node docker/midpoint/e2e/journey.mjs --verify-evidence
```

--run owns a new full reset and fresh backend database after probe completion; a failed/partial run requires reset again. --verify-evidence --contract selects the A1–A4 manifest instead of the journey manifest and requires actual complete safe observations.

Runtime bootstrap is strictly sequential and exclusive: compile/load administration-mode Strapi with seeds/workers/listeners suppressed, explicitly initialize approved core/catalogue prerequisites as described below, then invoke compiled registerIdentitySource(strapi, manifest) from source-registration.ts using seed-iam-data.ts exact development-source manifest, then destroy application. Only after destruction run the supported token CLI command below in a separate child against the private DB/config, with stdout privately piped to memory (never terminal). Wait for its compilation/load/destroy and successful exit, validate its one issued token line, populate the owner-only private compose env handoff, recreate owned midPoint services/reload, and only then start the backend listener from compiled output. No compiler or administration application may overlap the running backend. The developer-export option writes hardwired docker/.env and is deliberately excluded:

```sh
pnpm --dir apps/backend scim:token "midPoint (dev)" rotate
bash docker/midpoint/reload.sh
bash docker/midpoint/hr-publish.sh <private-snapshot-path>
```

After privately capturing and validating token CLI stdout, the exact owned midPoint recreation command is:

```sh
docker compose --project-name idp --env-file "$IAM_JOURNEY_COMPOSE_ENV_FILE" --project-directory docker -f docker/docker-compose.yaml up -d --force-recreate midpoint_init midpoint_server
```

Registration's administration application and the token command must both be fully destroyed before any backend listener starts. Initial compose startup may have an empty token and skip the unrenderable source; successful token injection, service recreation and ordered reload are required before connection/lifecycle stages.

The displayed token CLI invocation is an internal child command only: the runner captures stdout privately in memory with no shell/tee/terminal output. Do not use --write-dev-env: ENV_PATH/DATABASE_FILENAME do not redirect its hardwired docker/.env destination. After successful CLI destruction/exit, use safe exclusive no-follow writes to create/update IAM_JOURNEY_COMPOSE_ENV_FILE with fresh MIDPOINT_SCIM_TOKEN. Initially its token is empty; source reload follows only after fresh token injection and owned midPoint recreation. Every compose call receives the explicit private env-file, actual compose keys and an allowlisted process environment. Cleanup removes only owned private handoffs. Offline tests prove developer docker/.env bytes/stat are untouched on success/failure, symlink/ownership/mode/race refusal, secret-safe output, correct compose allowlist propagation and zero compiler/listener overlap. No backup/restoration lease of developer config is needed because the gate never writes it.

Task control uses authenticated container-side REST with credential from environment and bounded output. Exact normal task operation is POST /midpoint/ws/rest/tasks/11000000-0000-4000-8000-000000000300/run followed by GET of that task until a newly finished run is observed. Reconciliation uses suffix310/320, pending refresh330, validity340 as applicable. Preserve A5 native retryLater scanner (five/fifteen minutes). Operating instructions must show the implemented exact argv/stdin with redacted outputs; no direct SCIM mutation can stand in for these lifecycle calls.

Live browser child command is pnpm --dir apps/csrm exec playwright test --config playwright.iam-journey.config.ts with IAM_JOURNEY_LIVE=true only in its private environment; run it solely within orchestrator --run.

## Multi-source coverage audit

COVERED means assigned executable work, never accepted runtime behavior.

| Source | ID | Capability or constraint | Plans | Status |
|---|---|---|---|---|
| GOAL | Phase5 | CSV joiner chooses password/signs in Requestor, mover/leaver refused in one scripted responsive gate | 01–12 | COVERED |
| REQ | SIGN-01 | Passwordless sourced provisioning and actual self-service setup mail | 01–04,07,09,11,12 | COVERED |
| REQ | SIGN-02 | Fresh scripted CSV/native-task lifecycle and responsive UI/API refusal | 05–12 | COVERED |
| CONTEXT | P5-10 | The journey uses existing Auth.js and typed Strapi identity-token/access boundaries with exact registered localhost:3000 origin and no second facade. | 04,06,07,08,10,12 | COVERED |
| CONTEXT | P5-11 | The gate owns disposable idp reset, fresh backend database/compiler/listeners/private directories and refuses foreign state. | 05,06,10,11,12 | COVERED |
| CONTEXT | P5-12 | Protected token tooling, renderer/reload, validated whole snapshots and existing numbered native midPoint tasks drive provisioning. | 06,10,11,12 | COVERED |
| CONTEXT | P5-13 | Named ordered stages have bounded deadlines, stop dependants and preserve the first failure through separate cleanup. | 05,06,10,12 | COVERED |
| CONTEXT | P5-14 | On-demand fresh task completion proof preserves native paging, five-minute cadence and A5 retryLater five/fifteen-minute behavior. | 05,06,09,10,12 | COVERED |
| CONTEXT | P5-15 | A fresh run/recipient-matched Mailpit message supplies the actual validated local action link; fresh independent CSRM sign-in follows password choice. | 07,11,12 | COVERED |
| CONTEXT | P5-16 | Mover CSV department/title/email changes preserve source key/documentId/subject and Requestor session with no new invitation. | 06,08,12 | COVERED |
| CONTEXT | P5-17 | Actual capabilities equal catalogue Requestor birthright and direct restricted route/API/cross-owner record probes refuse. | 08,12 | COVERED |
| CONTEXT | P5-18 | Same-session UI and ordinary API access/read/write refuse before pre-leaver token expiry and independently of remote logout, followed by outbox remote completion. | 06,08,12 | COVERED |
| CONTEXT | P5-19 | A separate explicit opt-in config/spec uses real isolated Next/OIDC, one worker/zero retries and inert ordinary discovery. | 07,10,12 | COVERED |
| CONTEXT | P5-20 | Distinct people complete each whole lifecycle at 1440×900 and 375×812 with keyboard/focus/error/overflow and safe screenshot proof. | 07,08,12 | COVERED |
| CONTEXT | P5-21 | Secrets remain private memory/environment/stdin or owner-only disposable handoffs; automatic traces/video/screenshots/state and raw diagnostics stay off. | 05,06,07,08,09,10,11,12 | COVERED |
| CONTEXT | P5-22 | Passing evidence requires reset/versions/linkage/native audit/SCIM correlation/both widths/cleanup; partial runs cannot pass or invent history. | 05,06,08,09,10,11,12 | COVERED |
| CONTEXT | P5-23 | A named remote-only IN-03 email collision proves connector 503/Retry-After30, local rollback, unchanged ownership, no invite, native retry trigger/correction/recovery. | 09,10,12 | COVERED |
| CONTEXT | P5-24 | Injected clients plus real Document Service nested SQLite transaction tests cover timing, failures, exclusions, flag-off, safe logs and operator guards offline. | 01,02,03,10 | COVERED |
| CONTEXT | P5-25 | Current shared backend is reconciled and rechecked; unfiltered backend/CSRM regressions and frozen contracts/defaults govern honest acceptance. | 04,05,10,11,12 | COVERED |
| CONTEXT | P5-01 | Only a new trusted sourced human is eligible; claims, duplicates, moves, reconciliation, reactivation and manual/service/protected/inactive/tombstoned users never auto-send. | 01,02 | COVERED |
| CONTEXT | P5-02 | The sourced flow carries no password and sends exactly UPDATE_PASSWORD through a distinct action-email operation. | 01,04,07,09,11 | COVERED |
| CONTEXT | P5-03 | Dispatch waits for the actual outermost commit and no registration/scheduler/client/log error changes committed SCIM 201. | 01,02 | COVERED |
| CONTEXT | P5-04 | One bounded best-effort attempt has no automatic retry or durable queue; an operator recovers uncertain delivery. | 01,02,03,10 | COVERED |
| CONTEXT | P5-05 | Content-type schemas, generated types/JDL and the disableAndEndSessions-only outbox remain frozen. | 01,04,10 | COVERED |
| CONTEXT | P5-06 | Allowlisted closed events expose source/user documentIds and accepted/failed/skipped outcome without raw mail, credentials or errors. | 01,02,03 | COVERED |
| CONTEXT | P5-07 | Administration resend accepts one local documentId, rechecks sourced-human eligibility, uses its stored subject and mutates no user. | 03,10 | COVERED |
| CONTEXT | P5-08 | Only the local realm SMTP seed adds mailpit:1025 with fictitious sender; clients, subjects, scopes and grants remain intact. | 04,09,10,11 | COVERED |
| CONTEXT | P5-09 | All three committed activation defaults remain false; disabled boot creates no email client/timer and live activation disables the development bridge. | 01,02,03,04,06,10,11 | COVERED |
| RESEARCH | Outer commit | Installed hook ordering/synchronous throw and unawaited rejection containment | 01,02 | COVERED |
| RESEARCH | Authority detachment | Detached instance resource and real authority-context proof | 01,02 | COVERED |
| RESEARCH | A1–A4 | Unresolved version-specific endpoint/query/SMTP/requiredActions semantics | 09,11 | COVERED, live pending |
| RESEARCH | Responsibility map | Identity/authorization stay Strapi; forms/auth stay Keycloak/Auth.js; tasks stay midPoint | 01–12 | COVERED |
| RESEARCH | Bounded work | Total transport/read/scheduler and gate/retry deadlines with cleanup | 01–03,05–09 | COVERED |
| RESEARCH | Offline harness | Real SQLite Document Service plus fake remote boundary and inert check/list | 01–10 | COVERED |
| RESEARCH | Native inherited behavior | Phase4 A1–A10, unchanged paging, grants, mappings and retry semantics | 06,09,10,12 | COVERED |
| RESEARCH | Safe publication | Allowlisted evidence and secret-safe reporter/no automatic sensitive artifacts | 05,07–12 | COVERED |
| RESEARCH | Regression honesty | Full unfiltered backend/CSRM gates and inherited failure ownership | 10,12 | COVERED |

Deferred ideas remain excluded: durable invitation persistence/queue, resend UI/public endpoint, conflict reclassification, upgrades, brokering, broader user administration/screens, extra HR fields/source badges and HR role grants. No required source item is deferred or omitted.


## Final deterministic gates

- Twelve plans; 24 structured tasks; eight dependency waves. SIGN-01 and SIGN-02 covered (2/2); post-planning gap query passed.
- Native decision parser cannot parse the existing P5 identifier grammar (could-not-parse); it does not provide a coverage pass. An explicit independent check extracted all 25 P5-01–P5-25 bullets and verified each appears in plan must_haves.truths. The semantic mapping above and independent plan review cover 25/25. Locked context identifiers remain unchanged.
- UI contract review passed; 05-UI-SPEC.md records inherited tokens, exact delivered copy and responsive/security evidence obligations. Plans07/08/12 load that contract.
- No runtime result, network/Docker operation, implementation, commit or automatic execution is established by these planning gates.
